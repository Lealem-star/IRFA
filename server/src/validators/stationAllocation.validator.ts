import { z } from 'zod';

export const createStationAllocationSchema = z.object({
  fuelStationId: z.string().uuid('Valid fuel station ID is required'),
  subCityId: z.string().uuid('Valid Sub-City ID is required'),
  notes: z.string().max(250, 'Notes cannot exceed 250 characters').optional().nullable(),
});

export const updateStationAllocationsSchema = z.object({
  subCityIds: z.array(z.string().uuid('Valid Sub-City ID is required')),
  notes: z.string().max(250, 'Notes cannot exceed 250 characters').optional().nullable(),
});

export const updateAllocationStatusSchema = z.object({
  status: z.enum(['ACTIVE', 'REVOKED'], {
    errorMap: () => ({ message: "Status must be either 'ACTIVE' or 'REVOKED'" }),
  }),
  notes: z.string().max(250).optional().nullable(),
});
