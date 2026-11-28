import { Response } from 'express';
import prisma from '../config/db.js';
import { AuthenticatedRequest } from '../types/auth.js';
import { reviewFuelRequestSchema } from '../validators/request.validator.js';
import { logAudit } from '../middleware/audit.js';
import { RequestStatus, ItemStatus, AuthStatus, AssignmentStatus, AllocationStatus } from '@prisma/client';

export class AllocationValidationError extends Error {
  code: string;
  statusCode: number;

  constructor(message: string, code = 'ALLOCATION_LIMIT_EXCEEDED', statusCode = 400) {
    super(message);
    this.name = 'AllocationValidationError';
    this.code = code;
    this.statusCode = statusCode;
  }
}

export const reviewRequest = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const data = reviewFuelRequestSchema.parse(req.body);

    const fuelRequest = await prisma.fuelRequest.findUnique({
      where: { id },
      include: { items: true },
    });

    if (!fuelRequest) {
      res.status(404).json({ success: false, message: 'Fuel request not found' });
      return;
    }

    if (fuelRequest.status !== RequestStatus.SUBMITTED && fuelRequest.status !== RequestStatus.UNDER_REVIEW) {
      res.status(400).json({
        success: false,
        message: `Cannot review request with status: ${fuelRequest.status}.`,
      });
      return;
    }

    const reviewed = await prisma.$transaction(async (tx) => {
      let totalApprovedLiters = 0;

      // Handle item decisions
      if (data.itemDecisions && data.itemDecisions.length > 0) {
        for (const dec of data.itemDecisions) {
          totalApprovedLiters += dec.approvedLiters;
          await tx.fuelRequestItem.update({
            where: { id: dec.itemId },
            data: {
              approvedLiters: dec.approvedLiters,
              itemStatus: dec.itemStatus as ItemStatus,
              remarks: dec.remarks,
            },
          });
        }
      } else if (data.status === 'APPROVED') {
        // Approve all items with requested volume
        for (const item of fuelRequest.items) {
          totalApprovedLiters += Number(item.requestedLiters);
          await tx.fuelRequestItem.update({
            where: { id: item.id },
            data: {
              approvedLiters: item.requestedLiters,
              itemStatus: ItemStatus.APPROVED,
            },
          });
        }
      }

      // Update FuelRequest status
      const updatedReq = await tx.fuelRequest.update({
        where: { id },
        data: {
          status: data.status as RequestStatus,
          totalLitersApproved: totalApprovedLiters,
          reviewedById: req.user!.userId,
          reviewedAt: new Date(),
          reviewRemarks: data.reviewRemarks || null,
        },
        include: { items: true },
      });

      // Record immutable review history
      await tx.fuelRequestHistory.create({
        data: {
          fuelRequestId: id,
          action: data.status === 'RETURNED' ? 'RETURNED_FOR_CORRECTION' : data.status,
          fromStatus: fuelRequest.status,
          toStatus: data.status as RequestStatus,
          actorId: req.user!.userId,
          feedback: data.reviewRemarks || null,
          snapshotData: JSON.stringify({
            decision: data.status,
            totalApprovedLiters,
          }),
        },
      });

      // If approved or partially approved, validate monthly allocation and create FuelAuthorization records
      if (data.status === 'APPROVED' || data.status === 'PARTIALLY_APPROVED') {
        const approvedItems = await tx.fuelRequestItem.findMany({
          where: {
            fuelRequestId: id,
            itemStatus: { in: [ItemStatus.APPROVED, ItemStatus.PARTIALLY_APPROVED] },
            approvedLiters: { gt: 0 },
          },
        });

        // Current month bounds
        const year = fuelRequest.periodYear;
        const month = fuelRequest.periodMonth;
        const validFrom = new Date(year, month - 1, 1);
        const validTo = new Date(year, month, 0, 23, 59, 59);

        // Track quota approved within this transaction across multiple items
        const accumulatedApprovedInTx: Record<string, number> = {};

        for (const item of approvedItems) {
          const approvedLiters = Number(item.approvedLiters);
          if (approvedLiters <= 0) continue;

          // 1. Verify MonthlyAllocation exists for this farmer, fuel type, and period
          const allocation = await tx.monthlyAllocation.findFirst({
            where: {
              farmerId: item.farmerId,
              fuelTypeId: item.fuelTypeId,
              month,
              year,
            },
          });

          if (!allocation) {
            throw new AllocationValidationError(
              `Farmer ${item.farmerId} has no monthly fuel allocation for period ${month}/${year}. Cannot authorize fuel without an active monthly allocation.`,
              'NO_MONTHLY_ALLOCATION',
              400
            );
          }

          if (allocation.status !== AllocationStatus.ACTIVE) {
            throw new AllocationValidationError(
              `Monthly fuel allocation for farmer ${item.farmerId} for period ${month}/${year} is not ACTIVE (current status: ${allocation.status}). Cannot authorize fuel.`,
              'ALLOCATION_INACTIVE',
              400
            );
          }

          // 2. Acquire exclusive write lock on monthly allocation row to serialize concurrent reviews
          await tx.$executeRaw`
            UPDATE monthly_allocations
            SET updatedAt = NOW()
            WHERE id = ${allocation.id}
          `;

          // 3. Query existing ACTIVE authorizations using locking read (FOR UPDATE) to prevent MVCC snapshot stale reads
          const [reservedRow] = await tx.$queryRaw<Array<{ reserved: string | number }>>`
            SELECT COALESCE(SUM(remainingLiters), 0) AS reserved
            FROM fuel_authorizations
            WHERE farmerId = ${item.farmerId}
              AND fuelTypeId = ${item.fuelTypeId}
              AND status = 'ACTIVE'
              AND fuelRequestItemId != ${item.id}
              AND (
                validFrom <= ${validTo} AND validTo >= ${validFrom}
              )
            FOR UPDATE
          `;

          const outstandingReserved = Number(reservedRow?.reserved || 0);

          const farmerFuelKey = `${item.farmerId}_${item.fuelTypeId}`;
          const inTxReserved = accumulatedApprovedInTx[farmerFuelKey] || 0;
          const totalReserved = outstandingReserved + inTxReserved;
          const allocRemaining = Number(allocation.remainingLiters);
          const availableQuota = allocRemaining - totalReserved;

          if (approvedLiters > availableQuota) {
            throw new AllocationValidationError(
              `Approved liters (${approvedLiters} L) exceeds available monthly allocation quota (${Math.max(0, availableQuota)} L available: allocated ${allocation.allocatedLiters} L, remaining ${allocRemaining} L, active reservations ${totalReserved} L).`,
              'ALLOCATION_LIMIT_EXCEEDED',
              400
            );
          }

          accumulatedApprovedInTx[farmerFuelKey] = inTxReserved + approvedLiters;

          // 4. Create or update FuelAuthorization record
          const authCode = `AUTH-${year}${month.toString().padStart(2, '0')}-${item.id.slice(-5).toUpperCase()}`;

          // Check if auth already exists for item
          const existingAuth = await tx.fuelAuthorization.findUnique({
            where: { fuelRequestItemId: item.id },
          });

          if (!existingAuth) {
            await tx.fuelAuthorization.create({
              data: {
                authCode,
                fuelRequestId: id,
                fuelRequestItemId: item.id,
                farmerId: item.farmerId,
                fuelTypeId: item.fuelTypeId,
                authorizedLiters: item.approvedLiters,
                consumedLiters: 0,
                remainingLiters: item.approvedLiters,
                validFrom,
                validTo,
                status: AuthStatus.ACTIVE,
                remarks: `Authorized via ${fuelRequest.requestNumber}`,
              },
            });
          }
        }
      }

      return updatedReq;
    }, {
      maxWait: 20000,
      timeout: 45000,
    });

    await logAudit({
      userId: req.user?.userId,
      action: 'REVIEW_FUEL_REQUEST',
      entityType: 'FuelRequest',
      entityId: id,
      details: { decision: data.status, remarks: data.reviewRemarks },
      ipAddress: req.ip,
    });

    res.json({
      success: true,
      message: `Request ${fuelRequest.requestNumber} review completed (${data.status})`,
      request: reviewed,
    });
  } catch (error: any) {
    if (error instanceof AllocationValidationError) {
      res.status(error.statusCode).json({
        success: false,
        code: error.code,
        message: error.message,
      });
      return;
    }
    if (error?.name === 'ZodError') {
      res.status(400).json({ success: false, message: 'Validation failed', errors: error.errors });
      return;
    }
    console.error('Failed to process request review:', error);
    res.status(500).json({ success: false, message: 'Failed to process request review', error: error?.message || error });
  }
};

export const assignStation = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const { authorizationId, fuelStationId, notes } = req.body;

    if (!authorizationId || !fuelStationId) {
      res.status(400).json({ success: false, message: 'Authorization ID and Fuel Station ID are required' });
      return;
    }

    const [auth, station] = await Promise.all([
      prisma.fuelAuthorization.findUnique({ where: { id: authorizationId } }),
      prisma.fuelStation.findUnique({ where: { id: fuelStationId } }),
    ]);

    if (!auth) {
      res.status(404).json({ success: false, message: 'Fuel Authorization record not found' });
      return;
    }

    if (!station || !station.isActive) {
      res.status(404).json({ success: false, message: 'Fuel Station not found or inactive' });
      return;
    }

    // Upsert station assignment
    const assignment = await prisma.stationAssignment.upsert({
      where: {
        fuelAuthorizationId_fuelStationId: {
          fuelAuthorizationId: authorizationId,
          fuelStationId,
        },
      },
      create: {
        fuelAuthorizationId: authorizationId,
        fuelStationId,
        assignedById: req.user!.userId,
        status: AssignmentStatus.ACTIVE,
        notes: notes || null,
      },
      update: {
        status: AssignmentStatus.ACTIVE,
        notes: notes || null,
        assignedById: req.user!.userId,
      },
      include: {
        fuelStation: true,
        fuelAuthorization: {
          include: { farmer: true, fuelType: true },
        },
      },
    });

    await logAudit({
      userId: req.user?.userId,
      action: 'ASSIGN_FUEL_STATION',
      entityType: 'StationAssignment',
      entityId: assignment.id,
      details: { authId: authorizationId, stationId: fuelStationId },
      ipAddress: req.ip,
    });

    res.json({
      success: true,
      message: `Station ${station.name} assigned successfully`,
      assignment,
    });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Failed to assign fuel station', error });
  }
};

export const listAuthorizations = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const { search, stationId, status, page = '1', limit = '20' } = req.query;

    const where: any = {};
    if (status) where.status = status as AuthStatus;
    if (stationId) {
      where.assignments = {
        some: { fuelStationId: stationId as string, status: AssignmentStatus.ACTIVE },
      };
    }
    if (search) {
      where.OR = [
        { authCode: { contains: search as string } },
        { farmer: { fullName: { contains: search as string } } },
        { farmer: { farmerCode: { contains: search as string } } },
      ];
    }

    const skip = (parseInt(page as string) - 1) * parseInt(limit as string);
    const take = parseInt(limit as string);

    const [total, authorizations] = await Promise.all([
      prisma.fuelAuthorization.count({ where }),
      prisma.fuelAuthorization.findMany({
        where,
        skip,
        take,
        include: {
          farmer: {
            include: { kebele: true },
          },
          fuelType: true,
          fuelRequest: {
            select: { requestNumber: true, periodMonth: true, periodYear: true },
          },
          assignments: {
            include: { fuelStation: true },
          },
        },
        orderBy: { createdAt: 'desc' },
      }),
    ]);

    res.json({
      success: true,
      data: authorizations,
      pagination: {
        total,
        page: parseInt(page as string),
        limit: take,
        totalPages: Math.ceil(total / take),
      },
    });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Failed to retrieve authorizations', error });
  }
};

export const revokeAuthorization = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const { reason } = req.body || {};

    const result = await prisma.$transaction(async (tx) => {
      const auth = await tx.fuelAuthorization.findUnique({
        where: { id },
        include: {
          fuelRequest: true,
          fuelType: true,
          farmer: true,
        },
      });

      if (!auth) {
        throw new AllocationValidationError('Fuel authorization not found', 'AUTHORIZATION_NOT_FOUND', 404);
      }

      if (auth.status === AuthStatus.REVOKED) {
        throw new AllocationValidationError(
          'Authorization has already been revoked. Cannot revoke or release quantity twice.',
          'AUTHORIZATION_ALREADY_REVOKED',
          400
        );
      }

      if (auth.status === AuthStatus.EXHAUSTED || Number(auth.remainingLiters) <= 0) {
        throw new AllocationValidationError(
          'Authorization has already been completely exhausted (0 L remaining). Cannot revoke.',
          'AUTHORIZATION_EXHAUSTED',
          400
        );
      }

      if (auth.status !== AuthStatus.ACTIVE) {
        throw new AllocationValidationError(
          `Cannot revoke authorization with status ${auth.status}. Only ACTIVE authorizations can be revoked.`,
          'AUTHORIZATION_NOT_ACTIVE',
          400
        );
      }

      const releasedLiters = Number(auth.remainingLiters);
      const noteAppend = `[REVOKED: ${reason || 'Administrative revocation'}]`;

      const updatedAuth = await tx.fuelAuthorization.update({
        where: { id },
        data: {
          status: AuthStatus.REVOKED,
          remarks: auth.remarks ? `${auth.remarks} ${noteAppend}` : noteAppend,
        },
      });

      // Revoke any active station assignments
      await tx.stationAssignment.updateMany({
        where: {
          fuelAuthorizationId: id,
          status: AssignmentStatus.ACTIVE,
        },
        data: {
          status: AssignmentStatus.REVOKED,
          notes: `Revoked with authorization ${auth.authCode}`,
        },
      });

      return { updatedAuth, releasedLiters };
    }, {
      maxWait: 20000,
      timeout: 45000,
    });

    await logAudit({
      userId: req.user?.userId,
      action: 'REVOKE_FUEL_AUTHORIZATION',
      entityType: 'FuelAuthorization',
      entityId: id,
      details: {
        authCode: result.updatedAuth.authCode,
        releasedLiters: result.releasedLiters,
        reason,
      },
      ipAddress: req.ip,
    });

    res.json({
      success: true,
      message: `Authorization ${result.updatedAuth.authCode} successfully revoked. ${result.releasedLiters} L released back to available allocation.`,
      authorization: result.updatedAuth,
      releasedLiters: result.releasedLiters,
    });
  } catch (error: any) {
    if (error instanceof AllocationValidationError) {
      res.status(error.statusCode).json({
        success: false,
        code: error.code,
        message: error.message,
      });
      return;
    }
    console.error('Failed to revoke authorization:', error);
    res.status(500).json({ success: false, message: 'Failed to revoke authorization', error: error?.message || error });
  }
};

export const listFuelStations = async (_req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const stations = await prisma.fuelStation.findMany({
      include: {
        _count: {
          select: {
            assignments: true,
            transactions: true,
          },
        },
      },
      orderBy: { name: 'asc' },
    });

    res.json({ success: true, stations });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Failed to retrieve stations', error });
  }
};
