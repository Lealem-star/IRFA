import { z } from 'zod';

export const createFarmerSchema = z.object({
  fullName: z.string().trim().min(2, 'Full name is required / ሙሉ ስም ማስገባት ግዴታ ነው'),
  gender: z.enum(['ወንድ', 'ሴት', 'MALE', 'FEMALE', 'Male', 'Female'], {
    errorMap: () => ({ message: 'Gender is required / ጾታ መምረጥ ግዴታ ነው' }),
  }),
  subCityId: z.string().min(1, 'Sub-City selection is required / ክፍለ ከተማ መምረጥ ግዴታ ነው'),
  kebeleId: z.string().min(1, 'Kebele selection is required / ቀበሌ መምረጥ ግዴታ ነው'),
  landSizeHectares: z.coerce.number().positive('Farm size must be greater than 0 / የማሳ ስፋት ከ 0 በላይ መሆን አለበት'),
  primaryCrops: z.string().trim().min(1, 'Crop type is required / የሰብል አይነት ማስገባት ግዴታ ነው'),
  pumpFuelType: z.enum(['Diesel', 'Benzene', 'ናፍጣ', 'ቤንዚል', 'ቤንዚን'], {
    errorMap: () => ({ message: 'Fuel type must be Diesel (ናፍጣ) or Benzene (ቤንዚል)' }),
  }),
  declaredFuelLiters: z.coerce.number().positive('Required fuel quantity must be greater than 0 / የሚያስፈልግ ነዳጅ መጠን ከ 0 በላይ መሆን አለበት'),
  phone: z.string().trim().min(9, 'Valid phone number is required / ትክክለኛ ስልክ ቁጥር ያስፈልጋል'),
  nationalId: z.string().optional().nullable(),
  photoUrl: z.string().optional().nullable(),
  waterSource: z.enum(['LAKE_TANA', 'BLUE_NILE', 'BOREHOLE', 'RIVER_DIVERSION', 'OTHER']).default('LAKE_TANA'),
  waterSourceDetail: z.string().optional().nullable(),
  pumpHorsepower: z.string().optional().nullable(),
  pumpModel: z.string().optional().nullable(),
  irrigationSeason: z.string().optional().nullable(),
});

export const updateFarmerSchema = z.object({
  fullName: z.string().trim().min(2, 'Full name is required').optional(),
  gender: z.enum(['ወንድ', 'ሴት', 'MALE', 'FEMALE', 'Male', 'Female']).optional(),
  subCityId: z.string().min(1).optional(),
  kebeleId: z.string().min(1).optional(),
  phone: z.string().trim().min(9).optional(),
  nationalId: z.string().optional().nullable(),
  photoUrl: z.string().optional().nullable(),
  eligibilityStatus: z.enum(['ELIGIBLE', 'UNDER_REVIEW', 'SUSPENDED', 'INELIGIBLE']).optional(),
  isActive: z.boolean().optional(),
  suspensionReason: z.string().optional().nullable(),
  landSizeHectares: z.coerce.number().positive().optional(),
  primaryCrops: z.string().optional().nullable(),
  pumpFuelType: z.enum(['Diesel', 'Benzene', 'ናፍጣ', 'ቤንዚል', 'ቤንዚን']).optional(),
  declaredFuelLiters: z.coerce.number().positive().optional(),
  waterSource: z.enum(['LAKE_TANA', 'BLUE_NILE', 'BOREHOLE', 'RIVER_DIVERSION', 'OTHER']).optional(),
  waterSourceDetail: z.string().optional().nullable(),
  pumpHorsepower: z.string().optional().nullable(),
  pumpModel: z.string().optional().nullable(),
  irrigationSeason: z.string().optional().nullable(),
});
