import { Response } from 'express';
import prisma from '../config/db.js';
import { AuthenticatedRequest } from '../types/auth.js';
import { reviewFuelRequestSchema } from '../validators/request.validator.js';
import { logAudit } from '../middleware/audit.js';
import { RequestStatus, ItemStatus, AuthStatus, AssignmentStatus } from '@prisma/client';

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

      // If approved or partially approved, create FuelAuthorization records for approved items
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

        for (const item of approvedItems) {
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
  } catch (error) {
    res.status(500).json({ success: false, message: 'Failed to process request review', error });
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
