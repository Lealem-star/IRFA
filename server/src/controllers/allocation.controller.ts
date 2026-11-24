import { Response } from 'express';
import prisma from '../config/db.js';
import { AuthenticatedRequest } from '../types/auth.js';
import { createAllocationSchema, bulkAllocationSchema } from '../validators/allocation.validator.js';
import { logAudit } from '../middleware/audit.js';
import { AllocationStatus, EligibilityStatus } from '@prisma/client';

export const listAllocations = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const { month, year, fuelTypeId, kebeleId, page = '1', limit = '20' } = req.query;

    const currentYear = year ? parseInt(year as string) : new Date().getFullYear();
    const currentMonth = month ? parseInt(month as string) : new Date().getMonth() + 1;

    const where: any = {
      year: currentYear,
      month: currentMonth,
    };

    if (fuelTypeId) where.fuelTypeId = fuelTypeId as string;
    if (kebeleId) {
      where.farmer = { kebeleId: kebeleId as string };
    }

    const skip = (parseInt(page as string) - 1) * parseInt(limit as string);
    const take = parseInt(limit as string);

    const [total, allocations] = await Promise.all([
      prisma.monthlyAllocation.count({ where }),
      prisma.monthlyAllocation.findMany({
        where,
        skip,
        take,
        include: {
          farmer: {
            include: {
              kebele: { include: { location: true } },
              irrigationProfile: true,
            },
          },
          fuelType: true,
        },
        orderBy: { createdAt: 'desc' },
      }),
    ]);

    res.json({
      success: true,
      data: allocations,
      pagination: {
        total,
        page: parseInt(page as string),
        limit: take,
        totalPages: Math.ceil(total / take),
      },
    });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Failed to retrieve allocations', error });
  }
};

export const createAllocation = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const data = createAllocationSchema.parse(req.body);

    // Verify farmer eligibility
    const farmer = await prisma.farmer.findUnique({
      where: { id: data.farmerId },
    });

    if (!farmer) {
      res.status(404).json({ success: false, message: 'Farmer not found' });
      return;
    }

    if (farmer.eligibilityStatus !== EligibilityStatus.ELIGIBLE) {
      res.status(400).json({
        success: false,
        message: `Farmer cannot receive fuel allocation: status is ${farmer.eligibilityStatus}`,
      });
      return;
    }

    // Check duplicate
    const existing = await prisma.monthlyAllocation.findUnique({
      where: {
        farmerId_fuelTypeId_month_year: {
          farmerId: data.farmerId,
          fuelTypeId: data.fuelTypeId,
          month: data.month,
          year: data.year,
        },
      },
    });

    if (existing) {
      res.status(400).json({
        success: false,
        message: 'An allocation for this farmer, fuel type, and period already exists.',
      });
      return;
    }

    const allocation = await prisma.monthlyAllocation.create({
      data: {
        farmerId: data.farmerId,
        fuelTypeId: data.fuelTypeId,
        month: data.month,
        year: data.year,
        allocatedLiters: data.allocatedLiters,
        usedLiters: 0,
        remainingLiters: data.allocatedLiters,
        status: AllocationStatus.ACTIVE,
        notes: data.notes || null,
      },
      include: {
        farmer: true,
        fuelType: true,
      },
    });

    await logAudit({
      userId: req.user?.userId,
      action: 'CREATE_ALLOCATION',
      entityType: 'MonthlyAllocation',
      entityId: allocation.id,
      details: { farmerId: data.farmerId, liters: data.allocatedLiters, period: `${data.month}/${data.year}` },
      ipAddress: req.ip,
    });

    res.status(201).json({
      success: true,
      message: 'Monthly allocation created successfully',
      allocation,
    });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Failed to create allocation', error });
  }
};

export const getAllocationSummary = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const month = req.query.month ? parseInt(req.query.month as string) : new Date().getMonth() + 1;
    const year = req.query.year ? parseInt(req.query.year as string) : new Date().getFullYear();

    const fuelTypes = await prisma.fuelType.findMany({ where: { isActive: true } });

    const summaries = await Promise.all(
      fuelTypes.map(async (ft) => {
        const allocations = await prisma.monthlyAllocation.findMany({
          where: {
            fuelTypeId: ft.id,
            month,
            year,
          },
        });

        const totalAllocated = allocations.reduce((sum, a) => sum + Number(a.allocatedLiters), 0);
        const totalUsed = allocations.reduce((sum, a) => sum + Number(a.usedLiters), 0);
        const totalRemaining = allocations.reduce((sum, a) => sum + Number(a.remainingLiters), 0);

        return {
          fuelTypeId: ft.id,
          fuelTypeName: ft.name,
          fuelTypeCode: ft.code,
          totalAllocated,
          totalUsed,
          totalRemaining,
          farmerCount: allocations.length,
          usagePercentage: totalAllocated > 0 ? Math.round((totalUsed / totalAllocated) * 100) : 0,
        };
      })
    );

    res.json({
      success: true,
      period: { month, year },
      summaries,
    });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Failed to retrieve allocation summary', error });
  }
};
