import { Response } from 'express';
import prisma from '../config/db.js';
import { AuthenticatedRequest } from '../types/auth.js';
import { dispenseFuelSchema } from '../validators/dispense.validator.js';
import { logAudit } from '../middleware/audit.js';
import { AuthStatus, TransactionStatus } from '@prisma/client';

export const dispenseFuel = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const { authorizationId, quantityLiters, notes } = dispenseFuelSchema.parse(req.body);
    const stationId = req.user!.fuelStationId;

    if (!stationId) {
      res.status(403).json({ success: false, message: 'Unauthorized station operator' });
      return;
    }

    const receiptNumber = `TX-${new Date().toISOString().slice(0, 10).replace(/-/g, '')}-${Math.floor(1000 + Math.random() * 9000)}`;

    // Atomic interactive transaction to prevent race conditions & overdispensing
    const result = await prisma.$transaction(
      async (tx) => {
        // 1. Fetch authorization for station and metadata verification
        const auth = await tx.fuelAuthorization.findUnique({
          where: { id: authorizationId },
          include: {
            fuelType: true,
            farmer: true,
            assignments: {
              where: { fuelStationId: stationId, status: 'ACTIVE' },
            },
          },
        });

        if (!auth) {
          throw new Error('Fuel Authorization record not found');
        }

        if (auth.assignments.length === 0) {
          throw new Error('This authorization is not assigned to your fuel station');
        }

        if (auth.status !== AuthStatus.ACTIVE) {
          throw new Error(`Authorization is not active. Status is ${auth.status}`);
        }

        const unitPrice = Number(auth.fuelType.currentPricePerLiter);
        const totalAmount = quantityLiters * unitPrice;

        // 2. Atomic conditional decrement with InnoDB exclusive row lock
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
          const currentCheck = await tx.fuelAuthorization.findUnique({ where: { id: authorizationId } });
          const curRemaining = currentCheck ? Number(currentCheck.remainingLiters) : 0;
          throw new Error(
            `Requested quantity (${quantityLiters} L) exceeds remaining authorized balance (${curRemaining} L)`
          );
        }

        const newRemaining = Math.max(0, Number(auth.remainingLiters) - quantityLiters);

        // 3. Update monthly allocation for tracking
        const allocation = await tx.monthlyAllocation.findFirst({
          where: {
            farmerId: auth.farmerId,
            fuelTypeId: auth.fuelTypeId,
            month: auth.validFrom.getMonth() + 1,
            year: auth.validFrom.getFullYear(),
          },
        });

        if (allocation) {
          await tx.monthlyAllocation.update({
            where: { id: allocation.id },
            data: {
              usedLiters: Number(allocation.usedLiters) + quantityLiters,
              remainingLiters: Math.max(0, Number(allocation.remainingLiters) - quantityLiters),
            },
          });
        }

        // 4. Create Fuel Transaction record
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
            notes: notes || null,
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

        return { transaction, remainingAfter: newRemaining };
      },
      {
        maxWait: 10000,
        timeout: 25000,
      }
    );

    await logAudit({
      userId: req.user?.userId,
      action: 'FUEL_DISPENSED',
      entityType: 'FuelTransaction',
      entityId: result.transaction.id,
      details: {
        receiptNumber,
        liters: quantityLiters,
        farmer: result.transaction.farmer.fullName,
        remaining: result.remainingAfter,
      },
      ipAddress: req.ip,
    });

    res.status(201).json({
      success: true,
      message: `Fuel dispensing recorded successfully. Receipt #${receiptNumber}`,
      receipt: result.transaction,
      remainingBalance: result.remainingAfter,
    });
  } catch (error: any) {
    res.status(400).json({
      success: false,
      message: error.message || 'Dispensing transaction failed',
    });
  }
};

export const listTransactions = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const { search, stationId, fuelTypeId, page = '1', limit = '15' } = req.query;

    const where: any = {};

    // Station scoping
    if (req.user?.role === 'STATION_ADMIN') {
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
