import { Response } from 'express';
import prisma from '../config/db.js';
import { AuthenticatedRequest } from '../types/auth.js';
import { createShortageSchema, reviewShortageSchema } from '../validators/shortage.validator.js';
import { ShortageCategory, ShortageStatus } from '@prisma/client';

export const reportShortage = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const user = req.user!;
    const validation = createShortageSchema.safeParse(req.body);
    if (!validation.success) {
      res.status(400).json({
        success: false,
        message: 'Validation failed',
        errors: validation.error.errors,
      });
      return;
    }

    const { fuelStationId, fuelTypeId, category, description, estimatedAvailable, estimatedShortage, notes } = validation.data;

    let targetStationId: string;
    if (user.role === 'STATION_ADMIN') {
      if (!user.fuelStationId) {
        res.status(400).json({
          success: false,
          message: 'Station representative is not assigned to any station',
        });
        return;
      }
      if (fuelStationId && fuelStationId !== user.fuelStationId) {
        res.status(403).json({
          success: false,
          message: 'Station representatives may only report shortages for their assigned station',
        });
        return;
      }
      targetStationId = user.fuelStationId;
    } else if (user.role === 'TRADE_OFFICE') {
      if (!fuelStationId) {
        res.status(400).json({
          success: false,
          message: 'Fuel station ID is required when Trade Office reports a shortage',
        });
        return;
      }
      targetStationId = fuelStationId;
    } else {
      res.status(403).json({
        success: false,
        message: 'Only Trade Office and Station Representatives can report shortages',
      });
      return;
    }

    const [station, fuelType] = await Promise.all([
      prisma.fuelStation.findUnique({ where: { id: targetStationId } }),
      prisma.fuelType.findUnique({ where: { id: fuelTypeId } }),
    ]);

    if (!station) {
      res.status(404).json({ success: false, message: 'Fuel station not found' });
      return;
    }
    if (!station.isActive) {
      res.status(400).json({ success: false, message: 'Cannot report shortage for inactive fuel station' });
      return;
    }
    if (!fuelType) {
      res.status(404).json({ success: false, message: 'Fuel type not found' });
      return;
    }

    const shortage = await prisma.fuelShortage.create({
      data: {
        fuelStationId: targetStationId,
        fuelTypeId,
        reportedById: user.userId,
        category,
        description,
        estimatedAvailable: estimatedAvailable !== undefined && estimatedAvailable !== null ? estimatedAvailable : null,
        estimatedShortage: estimatedShortage !== undefined && estimatedShortage !== null ? estimatedShortage : null,
        notes: notes || null,
        status: ShortageStatus.REPORTED,
      },
      include: {
        fuelStation: {
          select: { id: true, code: true, name: true, location: true },
        },
        fuelType: {
          select: { id: true, name: true, code: true },
        },
        reportedBy: {
          select: { id: true, fullName: true, role: true, username: true },
        },
      },
    });

    await prisma.auditLog.create({
      data: {
        userId: user.userId,
        action: 'SHORTAGE_REPORTED',
        entityType: 'FuelShortage',
        entityId: shortage.id,
        details: JSON.stringify({
          stationCode: station.code,
          stationName: station.name,
          fuelType: fuelType.name,
          category,
          estimatedShortage,
        }),
      },
    });

    res.status(201).json({
      success: true,
      message: 'Shortage reported successfully',
      shortage,
      data: shortage,
    });
  } catch (error: any) {
    console.error('Error reporting shortage:', error);
    res.status(500).json({ success: false, message: 'Failed to report shortage', error: error.message });
  }
};

export const listShortages = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const user = req.user!;
    const { status, category, fuelStationId, fuelTypeId, from, to } = req.query;

    const where: any = {};

    if (user.role === 'STATION_ADMIN') {
      if (!user.fuelStationId) {
        res.json({ success: true, count: 0, shortages: [], data: [] });
        return;
      }
      where.fuelStationId = user.fuelStationId;
    } else if (fuelStationId) {
      where.fuelStationId = String(fuelStationId);
    }

    if (status && Object.values(ShortageStatus).includes(status as ShortageStatus)) {
      where.status = status as ShortageStatus;
    }

    if (category && Object.values(ShortageCategory).includes(category as ShortageCategory)) {
      where.category = category as ShortageCategory;
    }

    if (fuelTypeId) {
      where.fuelTypeId = String(fuelTypeId);
    }

    if (from || to) {
      where.reportedAt = {};
      if (from) where.reportedAt.gte = new Date(String(from));
      if (to) where.reportedAt.lte = new Date(String(to));
    }

    const shortages = await prisma.fuelShortage.findMany({
      where,
      orderBy: { reportedAt: 'desc' },
      include: {
        fuelStation: {
          select: { id: true, code: true, name: true, location: true },
        },
        fuelType: {
          select: { id: true, name: true, code: true },
        },
        reportedBy: {
          select: { id: true, fullName: true, role: true, username: true },
        },
        reviewedBy: {
          select: { id: true, fullName: true, role: true, username: true },
        },
      },
    });

    res.json({
      success: true,
      count: shortages.length,
      shortages,
      data: shortages,
    });
  } catch (error: any) {
    console.error('Error listing shortages:', error);
    res.status(500).json({ success: false, message: 'Failed to retrieve shortages', error: error.message });
  }
};

export const getShortageById = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const user = req.user!;
    const { id } = req.params;

    const shortage = await prisma.fuelShortage.findUnique({
      where: { id },
      include: {
        fuelStation: {
          select: { id: true, code: true, name: true, location: true, contactPerson: true, phone: true },
        },
        fuelType: {
          select: { id: true, name: true, code: true },
        },
        reportedBy: {
          select: { id: true, fullName: true, role: true, username: true },
        },
        reviewedBy: {
          select: { id: true, fullName: true, role: true, username: true },
        },
      },
    });

    if (!shortage) {
      res.status(404).json({ success: false, message: 'Shortage incident not found' });
      return;
    }

    if (user.role === 'STATION_ADMIN' && shortage.fuelStationId !== user.fuelStationId) {
      res.status(403).json({
        success: false,
        message: 'Station representatives cannot view shortages of other stations',
      });
      return;
    }

    res.json({
      success: true,
      shortage,
      data: shortage,
    });
  } catch (error: any) {
    console.error('Error getting shortage:', error);
    res.status(500).json({ success: false, message: 'Failed to retrieve shortage', error: error.message });
  }
};

export const reviewShortage = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const user = req.user!;
    const { id } = req.params;

    if (user.role !== 'TRADE_OFFICE') {
      res.status(403).json({
        success: false,
        message: 'Only Trade Office personnel can review or update shortage status',
      });
      return;
    }

    const validation = reviewShortageSchema.safeParse(req.body);
    if (!validation.success) {
      res.status(400).json({
        success: false,
        message: 'Validation failed',
        errors: validation.error.errors,
      });
      return;
    }

    const { status, reviewRemarks } = validation.data;

    const existing = await prisma.fuelShortage.findUnique({
      where: { id },
      include: { fuelStation: true, fuelType: true },
    });

    if (!existing) {
      res.status(404).json({ success: false, message: 'Shortage incident not found' });
      return;
    }

    const isResolving = status === 'RESOLVED';
    const resolvedAt = isResolving ? new Date() : (status === 'CONFIRMED' || status === 'UNDER_REVIEW' ? null : existing.resolvedAt);

    const updated = await prisma.fuelShortage.update({
      where: { id },
      data: {
        status: status as ShortageStatus,
        reviewRemarks: reviewRemarks || existing.reviewRemarks,
        reviewedById: user.userId,
        resolvedAt,
      },
      include: {
        fuelStation: {
          select: { id: true, code: true, name: true, location: true },
        },
        fuelType: {
          select: { id: true, name: true, code: true },
        },
        reportedBy: {
          select: { id: true, fullName: true, role: true, username: true },
        },
        reviewedBy: {
          select: { id: true, fullName: true, role: true, username: true },
        },
      },
    });

    await prisma.auditLog.create({
      data: {
        userId: user.userId,
        action: `SHORTAGE_${status}`,
        entityType: 'FuelShortage',
        entityId: id,
        details: JSON.stringify({
          fromStatus: existing.status,
          toStatus: status,
          reviewRemarks,
          stationCode: existing.fuelStation.code,
        }),
      },
    });

    res.json({
      success: true,
      message: `Shortage status updated to ${status}`,
      shortage: updated,
      data: updated,
    });
  } catch (error: any) {
    console.error('Error reviewing shortage:', error);
    res.status(500).json({ success: false, message: 'Failed to update shortage', error: error.message });
  }
};
