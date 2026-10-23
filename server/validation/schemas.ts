import { z } from 'zod';
import { address, idString, requiredText, text, wholeNumber } from './common.ts';

const ORDER_STATUSES = ['placed', 'processing', 'shipped', 'delivered', 'cancelled'] as const;

// --- orders ---------------------------------------------------------------

/** `.loose()` keeps unknown keys on purpose: the handler rejects server-controlled payment fields by name. */
export const createOrderBody = z
  .object({
    Customer_ID: idString('Customer_ID is required.'),
    Items: z.array(z.object({}).loose()).min(1, 'Your order has no items.').max(100, 'An order can hold at most 100 items.'),
    Shipping_Address: address,
    Billing_Address: address.optional(),
    Applied_Voucher: text(300).optional(),
    Additional_Info: text(500).optional(),
    paymentMethod: z.enum(['cash_on_delivery', 'online']).optional(),
  })
  .loose();

export const cancellationRequestBody = z.object({ reason: text(500).optional() });

export const cancellationReviewBody = z.object({
  decision: z.enum(['approved', 'rejected'], { error: 'Choose approve or reject.' }),
  cashReturned: z.boolean().optional(),
});

/** Clients send `status` or the older `Status`; the handler reads one of them. */
export const orderStatusBody = z
  .object({
    status: z.enum(ORDER_STATUSES).optional(),
    Status: z.enum(ORDER_STATUSES).optional(),
  })
  .refine((body) => body.status || body.Status, { message: 'Valid order status is required', path: ['status'] });

// --- cart -----------------------------------------------------------------

const quantity = wholeNumber(1, 999, 'Quantity must be a positive whole number');

export const addToCartBody = z.object({
  Customer_ID: idString().optional(),
  Product_ID: idString('Customer_ID and Product_ID are required'),
  Quantity: quantity.optional().default(1),
  Size: text(40).optional().default(''),
});

export const updateCartBody = z.object({ Quantity: quantity });

// --- reviews and support --------------------------------------------------

export const createReviewBody = z.object({
  Product_ID: idString('Product_ID is required.'),
  Customer_ID: idString('Customer_ID is required.'),
  Customer_Name: text(120).optional(),
  Review_text: text(2000).optional(),
  Rating: wholeNumber(1, 5, 'Rating must be a whole number from 1 to 5'),
});

const email = z
  .string({ error: 'Provide a valid email.' })
  .trim()
  .max(255)
  .regex(/^[^\s@]+@[^\s@]+\.[^\s@]+$/, 'Provide a valid email.');

/** The form sends Name/Email/Subject/Message; lower-case keys are accepted too. */
export const supportRequestBody = z
  .object({
    Name: requiredText(160, 'Provide your name.').optional(),
    name: requiredText(160, 'Provide your name.').optional(),
    Email: email.optional(),
    email: email.optional(),
    Subject: requiredText(160, 'Provide a subject.').optional(),
    subject: requiredText(160, 'Provide a subject.').optional(),
    Message: z.string().trim().min(10, 'Write a message of at least 10 characters.').max(5000, 'Message must be 5000 characters or fewer.').optional(),
    message: z.string().trim().min(10, 'Write a message of at least 10 characters.').max(5000, 'Message must be 5000 characters or fewer.').optional(),
  })
  .refine((b) => b.Name || b.name, { message: 'Provide your name.', path: ['Name'] })
  .refine((b) => b.Email || b.email, { message: 'Provide a valid email.', path: ['Email'] })
  .refine((b) => b.Subject || b.subject, { message: 'Provide a subject.', path: ['Subject'] })
  .refine((b) => b.Message || b.message, { message: 'Write a message of at least 10 characters.', path: ['Message'] });

export const supportStatusBody = z.object({
  status: z.enum(['open', 'in_progress', 'resolved'], { error: 'Choose open, in progress, or resolved.' }),
  adminNotes: text(2000).optional(),
});

export const resourceIdParam = z.object({ id: idString('Invalid ID.') });
