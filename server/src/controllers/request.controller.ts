import { Response } from 'express';
import prisma from '../config/db.js';
import { AuthenticatedRequest } from '../types/auth.js';
import { createFuelRequestSchema } from '../validators/request.validator.js';
import { logAudit } from '../middleware/audit.js';
import { RequestStatus } from '@prisma/client';

export const listRequests = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const { status, month, year, page = '1', limit = '15' } = req.query;

    const where: any = {};
    if (status) where.status = status as RequestStatus;
    if (month) where.periodMonth = parseInt(month as string);
    if (year) where.periodYear = parseInt(year as string);

    const skip = (parseInt(page as string) - 1) * parseInt(limit as string);
    const take = parseInt(limit as string);

    const [total, requests] = await Promise.all([
      prisma.fuelRequest.count({ where }),
      prisma.fuelRequest.findMany({
        where,
        skip,
        take,
        include: {
          submittedBy: {
            select: { id: true, fullName: true, username: true },
          },
          reviewedBy: {
            select: { id: true, fullName: true, username: true },
          },
          items: {
            include: {
              farmer: {
                include: { kebele: true },
              },
              fuelType: true,
              authorization: {
                include: {
                  assignments: {
                    include: { fuelStation: true },
                  },
                },
              },
            },
          },
        },
        orderBy: { submittedAt: 'desc' },
      }),
    ]);

    res.json({
      success: true,
      data: requests,
      pagination: {
        total,
        page: parseInt(page as string),
        limit: take,
        totalPages: Math.ceil(total / take),
      },
    });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Failed to retrieve fuel requests', error });
  }
};

export const getRequestById = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params;

    const request = await prisma.fuelRequest.findUnique({
      where: { id },
      include: {
        submittedBy: {
          select: { id: true, fullName: true, username: true },
        },
        reviewedBy: {
          select: { id: true, fullName: true, username: true },
        },
        items: {
          include: {
            farmer: {
              include: {
                kebele: { include: { location: true } },
                irrigationProfile: true,
              },
            },
            fuelType: true,
            authorization: {
              include: {
                assignments: {
                  include: { fuelStation: true },
                },
              },
            },
          },
        },
      },
    });

    if (!request) {
      res.status(404).json({ success: false, message: 'Fuel request not found' });
      return;
    }

    res.json({ success: true, request });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Failed to retrieve request details', error });
  }
};

export const createFuelRequest = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const data = createFuelRequestSchema.parse(req.body);

    const count = await prisma.fuelRequest.count();
    const requestNumber = `TR-${data.periodYear}-${(count + 42).toString().padStart(3, '0')}`;

    const totalLiters = data.items.reduce((sum, item) => sum + item.requestedLiters, 0);

    const newRequest = await prisma.$transaction(async (tx) => {
      const reqRecord = await tx.fuelRequest.create({
        data: {
          requestNumber,
          periodMonth: data.periodMonth,
          periodYear: data.periodYear,
          title: data.title,
          totalFarmersCount: data.items.length,
          totalLitersRequested: totalLiters,
          totalLitersApproved: 0,
          status: RequestStatus.SUBMITTED,
          submittedById: req.user!.userId,
          submittedAt: new Date(),
        },
      });

      await tx.fuelRequestItem.createMany({
        data: data.items.map((it) => ({
          fuelRequestId: reqRecord.id,
          farmerId: it.farmerId,
          fuelTypeId: it.fuelTypeId,
          requestedLiters: it.requestedLiters,
          approvedLiters: 0,
          remarks: it.remarks || null,
        })),
      });

      return reqRecord;
    });

    await logAudit({
      userId: req.user?.userId,
      action: 'SUBMIT_FUEL_REQUEST_TO_TRADE',
      entityType: 'FuelRequest',
      entityId: newRequest.id,
      details: { requestNumber, totalFarmers: data.items.length, totalLiters },
      ipAddress: req.ip,
    });

    res.status(201).json({
      success: true,
      message: `Fuel request ${requestNumber} submitted to Trade Office successfully`,
      request: newRequest,
    });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Failed to create fuel request', error });
  }
};
