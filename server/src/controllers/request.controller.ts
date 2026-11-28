import { Response } from 'express';
import prisma from '../config/db.js';
import { AuthenticatedRequest } from '../types/auth.js';
import {
  createFuelRequestSchema,
  updateFuelRequestSchema,
  reviewFuelRequestSchema,
  resubmitFuelRequestSchema,
} from '../validators/request.validator.js';
import { logAudit } from '../middleware/audit.js';
import { RequestStatus, ItemStatus } from '@prisma/client';

/**
 * List fuel requests with filtering, pagination, and history.
 */
export const listRequests = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const { status, month, year, subCityId, search, page = '1', limit = '15' } = req.query;

    const where: any = {};
    if (status) where.status = status as RequestStatus;
    if (month) where.periodMonth = parseInt(month as string);
    if (year) where.periodYear = parseInt(year as string);

    if (subCityId) {
      where.items = {
        some: {
          farmer: {
            OR: [
              { subCityId: subCityId as string },
              { kebele: { subCityId: subCityId as string } },
            ],
          },
        },
      };
    }

    if (search) {
      where.OR = [
        { requestNumber: { contains: search as string } },
        { title: { contains: search as string } },
        {
          items: {
            some: {
              farmer: {
                OR: [
                  { fullName: { contains: search as string } },
                  { farmerCode: { contains: search as string } },
                ],
              },
            },
          },
        },
      ];
    }

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
            select: { id: true, fullName: true, username: true, role: true },
          },
          reviewedBy: {
            select: { id: true, fullName: true, username: true, role: true },
          },
          history: {
            include: {
              actor: {
                select: { id: true, fullName: true, username: true, role: true },
              },
            },
            orderBy: { createdAt: 'desc' },
          },
          items: {
            include: {
              farmer: {
                include: {
                  kebele: { include: { subCity: true } },
                  subCity: true,
                },
              },
              fuelType: true,
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
    console.error('Failed to retrieve fuel requests:', error);
    res.status(500).json({ success: false, message: 'Failed to retrieve fuel requests', error });
  }
};

/**
 * Get detailed request by ID including full audit & decision history.
 */
export const getRequestById = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params;

    const request = await prisma.fuelRequest.findUnique({
      where: { id },
      include: {
        submittedBy: {
          select: { id: true, fullName: true, username: true, role: true },
        },
        reviewedBy: {
          select: { id: true, fullName: true, username: true, role: true },
        },
        history: {
          include: {
            actor: {
              select: { id: true, fullName: true, username: true, role: true },
            },
          },
          orderBy: { createdAt: 'desc' },
        },
        items: {
          include: {
            farmer: {
              include: {
                kebele: { include: { location: true, subCity: true } },
                subCity: true,
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
    console.error('Failed to retrieve request details:', error);
    res.status(500).json({ success: false, message: 'Failed to retrieve request details', error });
  }
};

/**
 * Create and submit a new fuel request bundle.
 */
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

      // Record initial history event
      await tx.fuelRequestHistory.create({
        data: {
          fuelRequestId: reqRecord.id,
          action: 'SUBMITTED',
          fromStatus: null,
          toStatus: RequestStatus.SUBMITTED,
          actorId: req.user!.userId,
          feedback: 'Initial fuel request submitted for review.',
          snapshotData: JSON.stringify({
            farmerCount: data.items.length,
            totalLitersRequested: totalLiters,
          }),
        },
      });

      return reqRecord;
    });

    await logAudit({
      userId: req.user?.userId,
      action: 'SUBMIT_FUEL_REQUEST',
      entityType: 'FuelRequest',
      entityId: newRequest.id,
      details: { requestNumber, totalFarmers: data.items.length, totalLiters },
      ipAddress: req.ip,
    });

    res.status(201).json({
      success: true,
      message: `Fuel request ${requestNumber} submitted successfully.`,
      request: newRequest,
    });
  } catch (error: any) {
    if (error.name === 'ZodError') {
      res.status(400).json({ success: false, message: error.errors[0]?.message || 'Invalid request input' });
      return;
    }
    console.error('Failed to create fuel request:', error);
    res.status(500).json({ success: false, message: 'Failed to create fuel request', error });
  }
};

/**
 * Review a fuel request (Agriculture Office Review).
 * Decisions: APPROVED, RETURNED (for correction), REJECTED, UNDER_REVIEW.
 * Mandatory feedback required for RETURNED and REJECTED.
 */
export const reviewFuelRequest = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const data = reviewFuelRequestSchema.parse(req.body);
    const feedback = (data.reviewRemarks || data.feedback || '').trim();

    const request = await prisma.fuelRequest.findUnique({
      where: { id },
      include: { items: true },
    });

    if (!request) {
      res.status(404).json({ success: false, message: 'Fuel request not found' });
      return;
    }

    // Protect against invalid status transitions
    if (request.status === RequestStatus.APPROVED) {
      res.status(400).json({
        success: false,
        message: 'Cannot review request that has already been officially approved.',
      });
      return;
    }

    if (request.status === RequestStatus.REJECTED && data.status !== RequestStatus.UNDER_REVIEW) {
      res.status(400).json({
        success: false,
        message: 'Cannot re-review request that has been rejected without reopening.',
      });
      return;
    }

    const previousStatus = request.status;
    const targetStatus = data.status as RequestStatus;

    let actionLabel = 'REVIEWED';
    if (targetStatus === RequestStatus.RETURNED) {
      actionLabel = 'RETURNED_FOR_CORRECTION';
    } else if (targetStatus === RequestStatus.REJECTED) {
      actionLabel = 'REJECTED';
    } else if (targetStatus === RequestStatus.UNDER_REVIEW) {
      actionLabel = 'PLACED_UNDER_REVIEW';
    } else if (targetStatus === RequestStatus.APPROVED) {
      actionLabel = 'OFFICIALLY_APPROVED';
    }

    const updated = await prisma.$transaction(async (tx) => {
      // Optional item level decisions
      if (data.itemDecisions && data.itemDecisions.length > 0) {
        for (const itemDec of data.itemDecisions) {
          await tx.fuelRequestItem.update({
            where: { id: itemDec.itemId },
            data: {
              approvedLiters: itemDec.approvedLiters,
              itemStatus: itemDec.itemStatus as ItemStatus,
              remarks: itemDec.remarks,
            },
          });
        }
      }

      // Update FuelRequest status and reviewer metadata
      const updatedReq = await tx.fuelRequest.update({
        where: { id },
        data: {
          status: targetStatus,
          reviewedById: req.user!.userId,
          reviewedAt: new Date(),
          reviewRemarks: feedback || null,
        },
        include: {
          items: true,
          submittedBy: { select: { id: true, fullName: true, username: true } },
          reviewedBy: { select: { id: true, fullName: true, username: true } },
        },
      });

      // Append immutable history entry
      await tx.fuelRequestHistory.create({
        data: {
          fuelRequestId: id,
          action: actionLabel,
          fromStatus: previousStatus,
          toStatus: targetStatus,
          actorId: req.user!.userId,
          feedback: feedback || `Status transitioned to ${targetStatus}`,
          snapshotData: JSON.stringify({
            decision: targetStatus,
            totalFarmers: request.totalFarmersCount,
            totalLitersRequested: Number(request.totalLitersRequested),
          }),
        },
      });

      return updatedReq;
    });

    await logAudit({
      userId: req.user?.userId,
      action: `REVIEW_REQUEST_${targetStatus}`,
      entityType: 'FuelRequest',
      entityId: id,
      details: {
        fromStatus: previousStatus,
        toStatus: targetStatus,
        feedback,
      },
      ipAddress: req.ip,
    });

    res.json({
      success: true,
      message: `Request ${request.requestNumber} review completed (${targetStatus}).`,
      request: updated,
    });
  } catch (error: any) {
    if (error.name === 'ZodError') {
      res.status(400).json({ success: false, message: error.errors[0]?.message || 'Invalid review input' });
      return;
    }
    console.error('Failed to review fuel request:', error);
    res.status(500).json({ success: false, message: 'Failed to process request review', error });
  }
};

/**
 * Edit permitted information on a request that has been RETURNED for correction.
 */
export const updateFuelRequest = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const data = updateFuelRequestSchema.parse(req.body);

    const request = await prisma.fuelRequest.findUnique({
      where: { id },
      include: { items: true },
    });

    if (!request) {
      res.status(404).json({ success: false, message: 'Fuel request not found' });
      return;
    }

    if (request.status !== RequestStatus.RETURNED && request.status !== RequestStatus.DRAFT) {
      res.status(400).json({
        success: false,
        message: `Cannot edit request with status '${request.status}'. Only requests returned for correction or drafts can be modified.`,
      });
      return;
    }

    // Submitter or Agriculture authority check
    if (request.submittedById !== req.user!.userId && req.user!.role !== 'AGRICULTURE_OFFICE') {
      res.status(403).json({
        success: false,
        message: 'Security Violation: You are not authorized to modify this request.',
      });
      return;
    }

    const updated = await prisma.$transaction(async (tx) => {
      let totalLiters = Number(request.totalLitersRequested);
      let totalFarmers = request.totalFarmersCount;

      if (data.items && data.items.length > 0) {
        // Replace items with corrected list
        await tx.fuelRequestItem.deleteMany({ where: { fuelRequestId: id } });
        await tx.fuelRequestItem.createMany({
          data: data.items.map((it) => ({
            fuelRequestId: id,
            farmerId: it.farmerId,
            fuelTypeId: it.fuelTypeId,
            requestedLiters: it.requestedLiters,
            approvedLiters: 0,
            remarks: it.remarks || null,
          })),
        });

        totalLiters = data.items.reduce((sum, item) => sum + item.requestedLiters, 0);
        totalFarmers = data.items.length;
      }

      const updatedReq = await tx.fuelRequest.update({
        where: { id },
        data: {
          title: data.title || request.title,
          periodMonth: data.periodMonth || request.periodMonth,
          periodYear: data.periodYear || request.periodYear,
          totalFarmersCount: totalFarmers,
          totalLitersRequested: totalLiters,
        },
        include: { items: true },
      });

      await tx.fuelRequestHistory.create({
        data: {
          fuelRequestId: id,
          action: 'CORRECTED',
          fromStatus: request.status,
          toStatus: request.status,
          actorId: req.user!.userId,
          feedback: 'Request items/details updated following feedback.',
          snapshotData: JSON.stringify({
            farmerCount: totalFarmers,
            totalLitersRequested: totalLiters,
          }),
        },
      });

      return updatedReq;
    });

    await logAudit({
      userId: req.user?.userId,
      action: 'UPDATE_RETURNED_REQUEST',
      entityType: 'FuelRequest',
      entityId: id,
      details: { title: data.title },
      ipAddress: req.ip,
    });

    res.json({
      success: true,
      message: `Request ${request.requestNumber} updated successfully.`,
      request: updated,
    });
  } catch (error: any) {
    if (error.name === 'ZodError') {
      res.status(400).json({ success: false, message: error.errors[0]?.message || 'Invalid input' });
      return;
    }
    console.error('Failed to update request:', error);
    res.status(500).json({ success: false, message: 'Failed to update request', error });
  }
};

/**
 * Resubmit a corrected request that was RETURNED by Agriculture/Trade review.
 * Transitions status: RETURNED -> SUBMITTED.
 * Preserves review history, updates timestamp, records resubmission history.
 * DOES NOT create fuel authorizations.
 */
export const resubmitFuelRequest = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const data = resubmitFuelRequestSchema.parse(req.body);

    const request = await prisma.fuelRequest.findUnique({
      where: { id },
      include: { items: true },
    });

    if (!request) {
      res.status(404).json({ success: false, message: 'Fuel request not found' });
      return;
    }

    if (request.status !== RequestStatus.RETURNED) {
      res.status(400).json({
        success: false,
        message: `Cannot resubmit request with status '${request.status}'. Only requests with status 'RETURNED' can be resubmitted.`,
      });
      return;
    }

    // Submitter or Agriculture authority check
    if (request.submittedById !== req.user!.userId && req.user!.role !== 'AGRICULTURE_OFFICE') {
      res.status(403).json({
        success: false,
        message: 'Security Violation: You are not authorized to resubmit this request.',
      });
      return;
    }

    const previousFeedback = request.reviewRemarks;

    const resubmitted = await prisma.$transaction(async (tx) => {
      let totalLiters = Number(request.totalLitersRequested);
      let totalFarmers = request.totalFarmersCount;

      // If new item corrections provided directly during resubmission
      if (data.items && data.items.length > 0) {
        await tx.fuelRequestItem.deleteMany({ where: { fuelRequestId: id } });
        await tx.fuelRequestItem.createMany({
          data: data.items.map((it) => ({
            fuelRequestId: id,
            farmerId: it.farmerId,
            fuelTypeId: it.fuelTypeId,
            requestedLiters: it.requestedLiters,
            approvedLiters: 0,
            remarks: it.remarks || null,
          })),
        });

        totalLiters = data.items.reduce((sum, item) => sum + item.requestedLiters, 0);
        totalFarmers = data.items.length;
      }

      // Transition status back to SUBMITTED
      const updatedReq = await tx.fuelRequest.update({
        where: { id },
        data: {
          status: RequestStatus.SUBMITTED,
          title: data.title || request.title,
          totalFarmersCount: totalFarmers,
          totalLitersRequested: totalLiters,
          submittedAt: new Date(),
        },
        include: {
          items: {
            include: { farmer: true, fuelType: true },
          },
          submittedBy: { select: { id: true, fullName: true, username: true } },
          reviewedBy: { select: { id: true, fullName: true, username: true } },
        },
      });

      // Record resubmission in immutable history table
      await tx.fuelRequestHistory.create({
        data: {
          fuelRequestId: id,
          action: 'RESUBMITTED',
          fromStatus: RequestStatus.RETURNED,
          toStatus: RequestStatus.SUBMITTED,
          actorId: req.user!.userId,
          feedback: data.resubmissionNotes
            ? `Corrected and resubmitted: ${data.resubmissionNotes}`
            : 'Corrected and resubmitted following review feedback.',
          snapshotData: JSON.stringify({
            farmerCount: totalFarmers,
            totalLitersRequested: totalLiters,
            priorFeedback: previousFeedback,
          }),
        },
      });

      return updatedReq;
    });

    await logAudit({
      userId: req.user?.userId,
      action: 'RESUBMIT_FUEL_REQUEST',
      entityType: 'FuelRequest',
      entityId: id,
      details: {
        previousFeedback,
        resubmissionNotes: data.resubmissionNotes || null,
      },
      ipAddress: req.ip,
    });

    res.json({
      success: true,
      message: `Request ${request.requestNumber} resubmitted for official review successfully.`,
      request: resubmitted,
    });
  } catch (error: any) {
    if (error.name === 'ZodError') {
      res.status(400).json({ success: false, message: error.errors[0]?.message || 'Invalid input' });
      return;
    }
    console.error('Failed to resubmit request:', error);
    res.status(500).json({ success: false, message: 'Failed to resubmit fuel request', error });
  }
};
