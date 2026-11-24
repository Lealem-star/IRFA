import { z } from 'zod';

export const loginSchema = z.object({
  username: z.string().min(1, 'Username is required'),
  password: z.string().min(1, 'Password is required'),
});

export const createUserSchema = z.object({
  username: z.string().min(3, 'Username must be at least 3 characters'),
  email: z.string().email('Invalid email address').optional().or(z.literal('')),
  password: z.string().min(6, 'Password must be at least 6 characters'),
  fullName: z.string().min(2, 'Full name is required'),
  role: z.enum(['AGRICULTURE_OFFICE', 'TRADE_OFFICE', 'STATION_ADMIN', 'SYSTEM_ADMIN']),
  officeId: z.string().optional().nullable(),
  fuelStationId: z.string().optional().nullable(),
});

export const updateUserSchema = z.object({
  email: z.string().email('Invalid email address').optional().or(z.literal('')),
  fullName: z.string().min(2, 'Full name is required'),
  role: z.enum(['AGRICULTURE_OFFICE', 'TRADE_OFFICE', 'STATION_ADMIN', 'SYSTEM_ADMIN']),
  officeId: z.string().optional().nullable(),
  fuelStationId: z.string().optional().nullable(),
  isActive: z.boolean().optional(),
});

export const changePasswordSchema = z.object({
  currentPassword: z.string().min(1, 'Current password is required'),
  newPassword: z.string().min(6, 'New password must be at least 6 characters'),
});
