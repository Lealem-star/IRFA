import { Response } from 'express';
import prisma from '../config/db.js';
import { AuthenticatedRequest } from '../types/auth.js';
import { dispenseFuelSchema } from '../validators/dispense.validator.js';
import { logAudit } from '../middleware/audit.js';
import { AuthStatus, TransactionStatus, AssignmentStatus, AllocationStatus } from '@prisma/client';

export const dispenseFuel = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const { authorizationId, quantityLiters, notes, idempotencyKey } = dispenseFuelSchema.parse(req.body);
    const stationId = req.user!.fuelStationId;

    if (!stationId) {
      res.status(403).json({
        success: false,
        code: 'REPRESENTATIVE_NOT_ASSIGNED',
        message: 'Security Violation: User is not linked to any active Fuel Station.',
      });
      return;
    }

    // 1. Revalidate operator and station active status
    const operator = await prisma.user.findUnique({
      where: { id: req.user!.userId },
      include: { fuelStation: true },
    });

    if (!operator || !operator.isActive) {
      res.status(403).json({
        success: false,
        code: 'REPRESENTATIVE_INACTIVE',
        message: 'Station representative account is deactivated.',
      });
      return;
    }

    if (operator.fuelStationId !== stationId) {
      res.status(403).json({
        success: false,
        code: 'REPRESENTATIVE_UNAUTHORIZED',
        message: 'Representative is not authorized for this fuel station.',
      });
      return;
    }

    const station = operator.fuelStation;
    if (!station || !station.isActive) {
      res.status(400).json({
        success: false,
        code: 'STATION_INACTIVE',
        message: 'Fuel station is currently inactive or deactivated.',
      });
      return;
    }

    // Idempotency check: if notes contain idempotencyKey or receipt already processed
    if (idempotencyKey) {
      const existingTx = await prisma.fuelTransaction.findFirst({
        where: {
          fuelAuthorizationId: authorizationId,
          notes: { contains: `[IDEMPOTENCY:${idempotencyKey}]` },
        },
        include: {
          farmer: { include: { kebele: true } },
          fuelType: true,
          fuelStation: true,
          operator: { select: { id: true, fullName: true, username: true } },
        },
      });

      if (existingTx) {
        const curAuth = await prisma.fuelAuthorization.findUnique({ where: { id: authorizationId } });
        res.status(200).json({
          success: true,
          message: `Idempotent replay: Fuel dispensing previously recorded with Receipt #${existingTx.receiptNumber}`,
          receipt: existingTx,
          remainingBalance: curAuth ? Number(curAuth.remainingLiters) : 0,
        });
        return;
      }
    }

    // Generate collision-resistant unique receipt number
    const datePart = new Date().toISOString().slice(0, 10).replace(/-/g, '');
    const timePart = Date.now().toString().slice(-4);
    const randPart = Math.floor(100 + Math.random() * 900);
    const receiptNumber = `TX-${datePart}-${timePart}${randPart}`;

    // Fetch authorization with farmer and kebele for allocation check before entering lock transaction
    const auth = await prisma.fuelAuthorization.findUnique({
      where: { id: authorizationId },
      include: {
        fuelType: true,
        farmer: {
          include: {
            subCity: true,
            kebele: { include: { subCity: true } },
          },
        },
      },
    });

    if (!auth) {
      res.status(404).json({
        success: false,
        code: 'FUEL_AUTHORIZATION_NOT_FOUND',
        message: 'Fuel Authorization record not found.',
      });
      return;
    }

    if (auth.status !== AuthStatus.ACTIVE) {
      res.status(400).json({
        success: false,
        code: 'AUTHORIZATION_NOT_ACTIVE',
        message: `Authorization status is ${auth.status}. Only ACTIVE authorizations can be dispensed.`,
      });
      return;
    }

    const now = new Date();
    if (auth.validFrom > now || auth.validTo < now) {
      res.status(400).json({
        success: false,
        code: 'AUTHORIZATION_EXPIRED',
        message: 'Fuel authorization is not within its valid active period.',
      });
      return;
    }

    // Revalidate Station Allocation for the farmer's Sub-City at moment of dispensing!
    const farmerSubCityId = auth.farmer.subCityId || auth.farmer.kebele?.subCityId;
    const subCityName = auth.farmer.subCity?.name || auth.farmer.kebele?.subCity?.name || 'registered';

    if (!farmerSubCityId) {
      res.status(400).json({
        success: false,
        code: 'SUBCITY_NOT_ASSIGNED',
        message: 'Farmer profile is not assigned to a registered Sub-City.',
      });
      return;
    }

    const activeAllocation = await prisma.stationSubCityAssignment.findFirst({
      where: {
        subCityId: farmerSubCityId,
        fuelStationId: stationId,
        status: AssignmentStatus.ACTIVE,
      },
    });

    if (!activeAllocation) {
      res.status(400).json({
        success: false,
        code: 'STATION_NOT_ALLOCATED',
        message: `Station '${station.name}' is not authorized by the Trade Office to serve '${subCityName}' Sub-City.`,
      });
      return;
    }

    // Check remaining balance on authorization
    const currentRemaining = Number(auth.remainingLiters);
    if (currentRemaining < quantityLiters) {
      res.status(400).json({
        success: false,
        code: 'QUOTA_EXCEEDED',
        message: `Requested quantity (${quantityLiters} L) exceeds remaining authorized balance (${currentRemaining} L).`,
      });
      return;
    }

    // Check applicable monthly allocation balance
    const allocation = await prisma.monthlyAllocation.findFirst({
      where: {
        farmerId: auth.farmerId,
        fuelTypeId: auth.fuelTypeId,
        month: auth.validFrom.getMonth() + 1,
        year: auth.validFrom.getFullYear(),
      },
    });

    if (!allocation) {
      res.status(400).json({
        success: false,
        code: 'NO_MONTHLY_ALLOCATION',
        message: 'No active monthly fuel allocation found for this farmer and period.',
      });
      return;
    }

    if (allocation.status === AllocationStatus.EXHAUSTED || Number(allocation.remainingLiters) <= 0) {
      res.status(400).json({
        success: false,
        code: 'MONTHLY_ALLOCATION_EXHAUSTED',
        message: 'Monthly fuel allocation for this period has been exhausted (0 L remaining).',
      });
      return;
    }

    if (allocation.status !== AllocationStatus.ACTIVE) {
      res.status(400).json({
        success: false,
        code: 'MONTHLY_ALLOCATION_INACTIVE',
        message: `Monthly fuel allocation is not active (status: ${allocation.status}).`,
      });
      return;
    }

    const currentAllocRemaining = Number(allocation.remainingLiters);
    if (currentAllocRemaining < quantityLiters) {
      res.status(400).json({
        success: false,
        code: 'MONTHLY_ALLOCATION_EXCEEDED',
        message: `Requested quantity (${quantityLiters} L) exceeds remaining monthly allocation quota (${currentAllocRemaining} L).`,
      });
      return;
    }

    const unitPrice = Number(auth.fuelType.currentPricePerLiter);
    const totalAmount = quantityLiters * unitPrice;

    // 2. Interactive atomic transaction with row-level locks
    const result = await prisma.$transaction(
      async (tx) => {
        // 3. Atomic conditional decrement with InnoDB exclusive row lock on authorization
        const rowsAffected = await tx.$executeRaw`
          UPDATE fuel_authorizations 
          SET remainingLiters = remainingLiters - ${quantityLiters},
              consumedLiters = consumedLiters + ${quantityLiters},
              status = CASE WHEN remainingLiters - ${quantityLiters} <= 0 THEN 'EXHAUSTED' ELSE status END
          WHERE id = ${authorizationId} 
            AND status = 'ACTIVE'
            AND remainingLiters >= ${quantityLiters}
        `;

        if (rowsAffected === 0) {
          throw new Error('CONCURRENCY_ERROR: Unable to decrement quota atomically. Authorization balance may have changed concurrently or been exhausted.');
        }

        const newRemaining = Math.max(0, currentRemaining - quantityLiters);

        // 4. Atomic conditional decrement with InnoDB exclusive row lock on monthly allocation (if exists)
        let newAllocRemaining: number | null = null;
        if (allocation) {
          const allocRowsAffected = await tx.$executeRaw`
            UPDATE monthly_allocations
            SET remainingLiters = remainingLiters - ${quantityLiters},
                usedLiters = usedLiters + ${quantityLiters},
                status = CASE WHEN remainingLiters - ${quantityLiters} <= 0 THEN 'EXHAUSTED' ELSE status END
            WHERE id = ${allocation.id}
              AND remainingLiters >= ${quantityLiters}
          `;

          if (allocRowsAffected === 0) {
            throw new Error('CONCURRENCY_ERROR: Unable to decrement monthly allocation atomically. Monthly quota may have changed concurrently or been exhausted.');
          }

          newAllocRemaining = Math.max(0, Number(allocation.remainingLiters) - quantityLiters);
        }

        const txNotes = idempotencyKey
          ? `${notes || ''} [IDEMPOTENCY:${idempotencyKey}]`.trim()
          : notes || null;

        // 5. Create Fuel Transaction record
        const transaction = await tx.fuelTransaction.create({
          data: {
            receiptNumber,
            fuelStationId: stationId,
            operatorId: req.user!.userId,
            farmerId: auth.farmerId,
            fuelAuthorizationId: auth.id,
            fuelTypeId: auth.fuelTypeId,
            quantityLiters,
            pricePerLiter: unitPrice,
            totalAmount,
            transactionDate: new Date(),
            status: TransactionStatus.COMPLETED,
            notes: txNotes,
          },
          include: {
            farmer: {
              include: { kebele: true },
            },
            fuelType: true,
            fuelStation: true,
            operator: {
              select: { id: true, fullName: true, username: true },
            },
          },
        });

        return { transaction, remainingAfter: newRemaining, remainingAllocAfter: newAllocRemaining };
      },
      {
        maxWait: 20000,
        timeout: 45000,
      }
    );

    // 6. Audit logging outside critical lock window
    await logAudit({
      userId: req.user?.userId,
      action: 'FUEL_DISPENSED',
      entityType: 'FuelTransaction',
      entityId: result.transaction.id,
      details: {
        receiptNumber,
        liters: quantityLiters,
        farmerId: result.transaction.farmerId,
        stationId: result.transaction.fuelStationId,
        remainingAfter: result.remainingAfter,
        remainingMonthlyAllocation: result.remainingAllocAfter,
      },
      ipAddress: req.ip,
    });

    res.status(201).json({
      success: true,
      message: `Fuel dispensing recorded successfully. Receipt #${receiptNumber}`,
      receipt: result.transaction,
      remainingBalance: result.remainingAfter,
      remainingMonthlyAllocation: result.remainingAllocAfter,
    });
  } catch (error: any) {
    console.error('Dispensing error:', error);
    const msg = error.message || 'Dispensing transaction failed.';
    const parts = msg.split(':');
    const code = parts.length > 1 ? parts[0].trim() : 'DISPENSING_FAILED';
    res.status(400).json({
      success: false,
      code,
      message: msg,
    });
  }
};

export const listTransactions = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const { search, stationId, fuelTypeId, page = '1', limit = '15' } = req.query;

    const where: any = {};

    // Station scoping
    if (req.user?.role === 'STATION_ADMIN') {
      if (!req.user.fuelStationId) {
        res.status(403).json({
          success: false,
          code: 'REPRESENTATIVE_NOT_ASSIGNED',
          message: 'Forbidden: User is not linked to any active Fuel Station.',
        });
        return;
      }
      if (stationId && String(stationId) !== req.user.fuelStationId) {
        res.status(403).json({
          success: false,
          code: 'CROSS_STATION_ACCESS_DENIED',
          message: 'Forbidden: Station representative cannot access transactions from another fuel station.',
        });
        return;
      }
      where.fuelStationId = req.user.fuelStationId;
    } else if (stationId) {
      where.fuelStationId = stationId as string;
    }

    if (fuelTypeId) where.fuelTypeId = fuelTypeId as string;

    if (search) {
      where.OR = [
        { receiptNumber: { contains: search as string } },
        { farmer: { fullName: { contains: search as string } } },
        { farmer: { farmerCode: { contains: search as string } } },
      ];
    }

    const skip = (parseInt(page as string) - 1) * parseInt(limit as string);
    const take = parseInt(limit as string);

    const [total, transactions] = await Promise.all([
      prisma.fuelTransaction.count({ where }),
      prisma.fuelTransaction.findMany({
        where,
        skip,
        take,
        include: {
          farmer: {
            include: { kebele: true },
          },
          fuelType: true,
          fuelStation: true,
          operator: {
            select: { id: true, fullName: true, username: true },
          },
        },
        orderBy: { transactionDate: 'desc' },
      }),
    ]);

    res.json({
      success: true,
      data: transactions,
      pagination: {
        total,
        page: parseInt(page as string),
        limit: take,
        totalPages: Math.ceil(total / take),
      },
    });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Failed to retrieve transactions', error });
  }
};
