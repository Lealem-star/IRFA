import { z } from 'zod';

export const ETH_PHONE_REGEX = /^(?:\+251|251|0)?([97]\d{8}|58\d{7})$/;

export const normalizeEthiopianPhone = (input: string): string => {
  const cleaned = input.trim().replace(/[\s\-\(\)\.]/g, '');
  const match = cleaned.match(ETH_PHONE_REGEX);
  if (!match) return input.trim();
  const nat = match[1];
  return `+251 ${nat.slice(0, 3)} ${nat.slice(3, 6)} ${nat.slice(6)}`;
};

export const phoneValidator = z
  .string({ required_error: 'Valid phone number is required / ትክክለኛ ስልክ ቁጥር ያስፈልጋል' })
  .trim()
  .min(1, 'Valid phone number is required / ትክክለኛ ስልክ ቁጥር ያስፈልጋል')
  .refine(
    (val) => {
      const cleaned = val.replace(/[\s\-\(\)\.]/g, '');
      const match = cleaned.match(ETH_PHONE_REGEX);
      if (!match) return false;
      const nat = match[1];
      // Reject dummy numbers where all digits are identical (e.g., 999999999, 000000000)
      const allSame = nat.split('').every((c) => c === nat[0]);
      return !allSame;
    },
    {
      message:
        'Invalid Ethiopian phone number. Must be a valid mobile (+251 9/7... or 09/07...) or regional line / ትክክለኛ የኢትዮጵያ ስልክ ቁጥር ያስገቡ',
    }
  );

export const nationalIdValidator = z
  .string()
  .optional()
  .nullable()
  .transform((val) => {
    if (!val) return null;
    const trimmed = val.trim();
    return trimmed.length === 0 ? null : trimmed.toUpperCase();
  })
  .refine(
    (val) => {
      if (val === null) return true;
      return val.length >= 4 && val.length <= 40 && /^[A-Z0-9\-_/]+$/.test(val);
    },
    {
      message:
        'National/Kebele ID must be 4-40 alphanumeric characters, dashes, or slashes / የመታወቂያ ቁጥር ከ 4 እስከ 40 ፊደላትና ቁጥሮች መሆን አለበት',
    }
  );

export const createFarmerSchema = z.object({
  fullName: z.string().trim().min(2, 'Full name is required / ሙሉ ስም ማስገባት ግዴታ ነው'),
  gender: z.enum(['ወንድ', 'ሴት', 'MALE', 'FEMALE', 'Male', 'Female'], {
    errorMap: () => ({ message: 'Gender is required / ጾታ መምረጥ ግዴታ ነው' }),
  }),
  subCityId: z.string().trim().min(1, 'Sub-City selection is required / ክፍለ ከተማ መምረጥ ግዴታ ነው'),
  kebeleId: z.string().trim().min(1, 'Kebele selection is required / ቀበሌ መምረጥ ግዴታ ነው'),
  landSizeHectares: z.coerce.number().positive('Farm size must be greater than 0 / የማሳ ስፋት ከ 0 በላይ መሆን አለበት'),
  primaryCrops: z.string().trim().min(1, 'Crop type is required / የሰብል አይነት ማስገባት ግዴታ ነው'),
  pumpFuelType: z.enum(['Diesel', 'Benzene', 'ናፍጣ', 'ቤንዚል', 'ቤንዚን'], {
    errorMap: () => ({ message: 'Fuel type must be Diesel (ናፍጣ) or Benzene (ቤንዚል)' }),
  }),
  declaredFuelLiters: z.coerce.number().positive('Required fuel quantity must be greater than 0 / የሚያስፈልግ ነዳጅ መጠን ከ 0 በላይ መሆን አለበት'),
  phone: phoneValidator,
  nationalId: nationalIdValidator,
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
  subCityId: z.string().trim().min(1).optional(),
  kebeleId: z.string().trim().min(1).optional(),
  phone: phoneValidator.optional(),
  nationalId: nationalIdValidator.optional(),
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
