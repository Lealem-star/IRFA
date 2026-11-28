import { z } from 'zod';

export const verifyQrSchema = z.object({
  qrTokenOrCode: z.string().min(1, 'QR Token or Farmer ID is required'),
  fuelTypeId: z.string().optional(),
});

export const dispenseFuelSchema = z.object({
  authorizationId: z.string().min(1, 'Authorization ID is required'),
  quantityLiters: z.number().positive('Quantity dispensed must be greater than 0'),
  notes: z.string().optional(),
  idempotencyKey: z.string().optional(),
});
