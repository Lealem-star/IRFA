import { z } from 'zod';

export const createFarmerSchema = z.object({
  fullName: z.string().min(2, 'Full name is required'),
  phone: z.string().min(9, 'Valid phone number is required'),
  nationalId: z.string().optional(),
  photoUrl: z.string().optional().nullable(),
  kebeleId: z.string().min(1, 'Kebele selection is required'),
  landSizeHectares: z.coerce.number().positive('Land size must be greater than 0'),
  waterSource: z.enum(['LAKE_TANA', 'BLUE_NILE', 'BOREHOLE', 'RIVER_DIVERSION', 'OTHER']).default('LAKE_TANA'),
  waterSourceDetail: z.string().optional(),
  pumpFuelType: z.enum(['Diesel', 'Benzene']),
  pumpHorsepower: z.string().optional(),
  pumpModel: z.string().optional(),
  primaryCrops: z.string().optional(),
  irrigationSeason: z.string().optional(),
});

export const updateFarmerSchema = z.object({
  fullName: z.string().min(2, 'Full name is required'),
  phone: z.string().min(9, 'Valid phone number is required'),
  nationalId: z.string().optional().nullable(),
  photoUrl: z.string().optional().nullable(),
  kebeleId: z.string().min(1, 'Kebele selection is required'),
  eligibilityStatus: z.enum(['ELIGIBLE', 'UNDER_REVIEW', 'SUSPENDED', 'INELIGIBLE']).optional(),
  isActive: z.boolean().optional(),
  suspensionReason: z.string().optional().nullable(),
  landSizeHectares: z.coerce.number().positive().optional(),
  waterSource: z.enum(['LAKE_TANA', 'BLUE_NILE', 'BOREHOLE', 'RIVER_DIVERSION', 'OTHER']).optional(),
  waterSourceDetail: z.string().optional().nullable(),
  pumpFuelType: z.enum(['Diesel', 'Benzene']).optional(),
  pumpHorsepower: z.string().optional().nullable(),
  pumpModel: z.string().optional().nullable(),
  primaryCrops: z.string().optional().nullable(),
  irrigationSeason: z.string().optional().nullable(),
});
