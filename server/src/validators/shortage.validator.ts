import { z } from 'zod';
import { ShortageCategory, ShortageStatus } from '@prisma/client';

export const createShortageSchema = z.object({
  fuelStationId: z.string().uuid().optional(),
  fuelTypeId: z.string().uuid({ message: 'Valid fuel type ID is required' }),
  category: z.nativeEnum(ShortageCategory, {
    errorMap: () => ({ message: 'Valid shortage category is required' }),
  }),
  description: z.string().trim().min(3, 'Description must be at least 3 characters'),
  estimatedAvailable: z.coerce.number().min(0, 'Estimated available must be non-negative').optional().nullable(),
  estimatedShortage: z.coerce.number().min(0, 'Estimated shortage must be non-negative').optional().nullable(),
  notes: z.string().trim().optional().nullable(),
});

export const reviewShortageSchema = z.object({
  status: z.enum(['UNDER_REVIEW', 'CONFIRMED', 'RESOLVED', 'REJECTED'], {
    errorMap: () => ({ message: 'Status must be UNDER_REVIEW, CONFIRMED, RESOLVED, or REJECTED' }),
  }),
  reviewRemarks: z.string().trim().optional().nullable(),
}).refine(
  (data) => {
    if (data.status === 'REJECTED') {
      return Boolean(data.reviewRemarks && data.reviewRemarks.trim().length >= 3);
    }
    return true;
  },
  {
    message: 'Mandatory explanation/remarks required when rejecting a shortage report',
    path: ['reviewRemarks'],
  }
);
