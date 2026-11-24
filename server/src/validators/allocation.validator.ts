import { z } from 'zod';

export const createAllocationSchema = z.object({
  farmerId: z.string().min(1, 'Farmer ID is required'),
  fuelTypeId: z.string().min(1, 'Fuel Type ID is required'),
  month: z.number().int().min(1).max(12),
  year: z.number().int().min(2025).max(2035),
  allocatedLiters: z.number().positive('Allocated quantity must be greater than 0'),
  notes: z.string().optional(),
});

export const bulkAllocationSchema = z.object({
  month: z.number().int().min(1).max(12),
  year: z.number().int().min(2025).max(2035),
  items: z.array(
    z.object({
      farmerId: z.string().min(1),
      fuelTypeId: z.string().min(1),
      allocatedLiters: z.number().positive(),
      notes: z.string().optional(),
    })
  ).min(1, 'At least one farmer allocation is required'),
});
