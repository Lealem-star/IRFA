import { z } from 'zod';

export const createFuelRequestSchema = z.object({
  periodMonth: z.number().int().min(1).max(12),
  periodYear: z.number().int().min(2025).max(2035),
  title: z.string().min(3, 'Request title is required'),
  items: z.array(
    z.object({
      farmerId: z.string().min(1),
      fuelTypeId: z.string().min(1),
      requestedLiters: z.number().positive(),
      remarks: z.string().optional(),
    })
  ).min(1, 'At least one farmer item must be included in the request'),
});

export const reviewFuelRequestSchema = z.object({
  status: z.enum(['APPROVED', 'PARTIALLY_APPROVED', 'REJECTED', 'RETURNED']),
  reviewRemarks: z.string().optional(),
  itemDecisions: z.array(
    z.object({
      itemId: z.string().min(1),
      approvedLiters: z.number().min(0),
      itemStatus: z.enum(['PENDING', 'APPROVED', 'PARTIALLY_APPROVED', 'REJECTED']),
      remarks: z.string().optional(),
    })
  ).optional(),
});
