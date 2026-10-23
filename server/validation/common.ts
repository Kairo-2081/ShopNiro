import { z } from 'zod';

/** A trimmed string with a hard length cap. Use for free text so nothing unbounded reaches the database. */
export const text = (max: number, message?: string) => z.string({ error: message }).trim().max(max, message ?? `Must be ${max} characters or fewer.`);

/** Non-empty variant of `text`. */
export const requiredText = (max: number, message: string) => text(max, message).min(1, message);

/** Identifiers we generate (PROD-…, ORD-…, UUID based) or that clients echo back. */
export const idString = (message = 'A valid ID is required.') =>
  z.string({ error: message }).trim().min(1, message).max(80, message).regex(/^[A-Za-z0-9._:-]+$/, message);

/** Accepts 3 or "3" (the clients send both) and always yields a whole number. */
export const wholeNumber = (min: number, max: number, message: string) =>
  z.preprocess(
    (value) => (typeof value === 'string' && value.trim() !== '' ? Number(value) : value),
    z.number({ error: message }).int(message).min(min, message).max(max, message)
  );

export const address = z.object({
  Street: requiredText(200, 'Street is required.'),
  House_Name: text(120).optional().default(''),
  City: requiredText(100, 'City is required.'),
  Postal_Code: text(20).optional().default(''),
  Additional_Info: text(500).optional(),
  Latitude: z.number().min(-90).max(90).nullable().optional(),
  Longitude: z.number().min(-180).max(180).nullable().optional(),
});
