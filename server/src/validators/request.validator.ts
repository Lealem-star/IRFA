import { z } from 'zod';

export const createFuelRequestSchema = z.object({
  periodMonth: z.number().int().min(1).max(12),
  periodYear: z.number().int().min(2025).max(2035),
  title: z.string().min(3, 'Request title is required'),
  items: z
    .array(
      z.object({
        farmerId: z.string().min(1, 'Farmer ID is required'),
        fuelTypeId: z.string().min(1, 'Fuel Type ID is required'),
        requestedLiters: z.number().positive('Requested liters must be positive'),
        remarks: z.string().optional(),
      })
    )
    .min(1, 'At least one farmer item must be included in the request'),
});

export const updateFuelRequestSchema = z.object({
  title: z.string().min(3).optional(),
  periodMonth: z.number().int().min(1).max(12).optional(),
  periodYear: z.number().int().min(2025).max(2035).optional(),
  items: z
    .array(
      z.object({
        id: z.string().optional(),
        farmerId: z.string().min(1),
        fuelTypeId: z.string().min(1),
        requestedLiters: z.number().positive(),
        remarks: z.string().optional(),
      })
    )
    .min(1, 'At least one farmer item is required')
    .optional(),
});

export const reviewFuelRequestSchema = z
  .object({
    status: z.enum(['APPROVED', 'PARTIALLY_APPROVED', 'REJECTED', 'RETURNED', 'UNDER_REVIEW']),
    reviewRemarks: z.string().optional(),
    feedback: z.string().optional(),
    itemDecisions: z
      .array(
        z.object({
          itemId: z.string().min(1),
          approvedLiters: z.number().min(0),
          itemStatus: z.enum(['PENDING', 'APPROVED', 'PARTIALLY_APPROVED', 'REJECTED']),
          remarks: z.string().optional(),
        })
      )
      .optional(),
  })
  .refine(
    (data) => {
      if (data.status === 'REJECTED' || data.status === 'RETURNED') {
        const comment = (data.reviewRemarks || data.feedback || '').trim();
        return comment.length >= 5;
      }
      return true;
    },
    {
      message: 'Mandatory feedback (at least 5 characters) is required when rejecting or returning a request for correction',
      path: ['reviewRemarks'],
    }
  );

export const resubmitFuelRequestSchema = z.object({
  title: z.string().min(3).optional(),
  resubmissionNotes: z.string().optional(),
  items: z
    .array(
      z.object({
        id: z.string().optional(),
        farmerId: z.string().min(1),
        fuelTypeId: z.string().min(1),
        requestedLiters: z.number().positive(),
        remarks: z.string().optional(),
      })
    )
    .min(1, 'At least one farmer item is required')
    .optional(),
});
