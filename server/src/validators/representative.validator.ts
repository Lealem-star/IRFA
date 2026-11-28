import { z } from 'zod';

export const createRepresentativeSchema = z.object({
  fullName: z.string().min(2, 'Full name must be at least 2 characters').max(100),
  username: z
    .string()
    .min(3, 'Username must be at least 3 characters')
    .max(50)
    .regex(/^[a-zA-Z0-9_.-]+$/, 'Username can only contain alphanumeric characters, underscores, hyphens, and dots'),
  password: z.string().min(6, 'Password must be at least 6 characters'),
  fuelStationId: z.string().uuid('Valid fuel station ID is required'),
  email: z.string().email('Invalid email address').optional().nullable(),
  forceReplace: z.boolean().optional().default(false),
});

export const updateRepresentativeStatusSchema = z.object({
  status: z.enum(['ACTIVE', 'INACTIVE'], {
    errorMap: () => ({ message: "Status must be either 'ACTIVE' or 'INACTIVE'" }),
  }),
  forceReplace: z.boolean().optional().default(false),
});

export const replaceRepresentativeSchema = z.object({
  fullName: z.string().min(2, 'Full name must be at least 2 characters').max(100),
  username: z
    .string()
    .min(3, 'Username must be at least 3 characters')
    .max(50)
    .regex(/^[a-zA-Z0-9_.-]+$/, 'Username can only contain alphanumeric characters, underscores, hyphens, and dots'),
  password: z.string().min(6, 'Password must be at least 6 characters'),
  email: z.string().email('Invalid email address').optional().nullable(),
  reason: z.string().max(250).optional(),
});

export const reassignRepresentativeSchema = z.object({
  newFuelStationId: z.string().uuid('Valid new fuel station ID is required'),
  forceReplace: z.boolean().optional().default(false),
  reason: z.string().max(250).optional(),
});

export const resetRepresentativePasswordSchema = z.object({
  newPassword: z.string().min(6, 'Password must be at least 6 characters'),
});
