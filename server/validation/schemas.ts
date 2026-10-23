import { z } from 'zod';
import { address, idString, moneyAmount, requiredText, text, wholeNumber } from './common.ts';

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

// --- auth -----------------------------------------------------------------

/** Types and size caps only. Username/email rules and normalisation stay in the signup handler. */
export const signupBody = z.object({
  role: z.enum(['customer', 'seller', 'rider'], { error: 'Choose a customer, seller, or rider account.' }),
  username: z.string({ error: 'Enter a valid username.' }).max(120, 'Username must be 3 to 50 letters, numbers, or underscores.').optional(),
  email: z.string({ error: 'Enter a valid email address.' }).max(255, 'Enter a valid email address.').optional(),
  password: z
    .string({ error: 'Password must be at least 8 characters.' })
    .min(8, 'Password must be at least 8 characters.')
    .max(128, 'Password must be 128 characters or fewer.'),
});

/** The login field is named `email` but accepts a username too. */
export const loginBody = z.object({
  email: z.string({ error: 'Username/Email and Password are required' }).trim().min(1, 'Username/Email and Password are required').max(255, 'Username/Email and Password are required'),
  password: z.string({ error: 'Username/Email and Password are required' }).min(1, 'Username/Email and Password are required').max(1000, 'Username/Email and Password are required'),
});

// --- payments and payouts -------------------------------------------------

/** `.loose()` on purpose: the handler rejects server-controlled fields (amount, customerId, ...) by name. */
export const paymentInitBody = z
  .object({
    orderId: idString('A valid orderId is required.'),
    customerName: text(160).optional(),
    customerEmail: text(255).optional(),
    customerPhone: text(40).optional(),
    address: z.unknown().optional(),
    paymentMethod: z.enum(['bkash', 'nagad', 'rocket', 'visa_mastercard'], { error: 'Unsupported payment method.' }).optional().default('bkash'),
    productName: text(200).optional().default('ShopNiro Marketplace Order'),
  })
  .loose();

export const sslcommerzValidateBody = z.object({
  tran_id: z.string({ error: 'A valid SSLCommerz transaction ID is required' }).regex(/^SSLCZ-[A-Z0-9-]+$/, 'A valid SSLCommerz transaction ID is required').max(80, 'A valid SSLCommerz transaction ID is required'),
  val_id: z.string({ error: 'A payment validation ID is required' }).trim().min(1, 'A payment validation ID is required').max(120, 'A payment validation ID is required'),
  order_id: idString('A valid order ID is required.').optional(),
});

export const sellerPayoutRequestBody = z.object({ amount: moneyAmount('Payout amount must be greater than zero.') });

export const payoutPayBody = z.object({
  externalReference: requiredText(100, 'An external payout reference is required.'),
});

export const riderWithdrawalBody = z.object({
  amount: moneyAmount('Enter a valid amount and payout account.'),
  payoutMethod: z.enum(['bkash', 'bank', 'nagad'], { error: 'Enter a valid amount and payout account.' }),
  payoutAccount: requiredText(120, 'Enter a valid amount and payout account.'),
});

export const withdrawalStatusBody = z.object({
  status: z.enum(['paid', 'rejected'], { error: 'Choose paid or rejected.' }),
});

export const riderLocationBody = z.object({
  latitude: z.preprocess((v) => (typeof v === 'string' && v.trim() !== '' ? Number(v) : v), z.number({ error: 'Choose a valid location on the map.' }).min(-90, 'Choose a valid location on the map.').max(90, 'Choose a valid location on the map.')),
  longitude: z.preprocess((v) => (typeof v === 'string' && v.trim() !== '' ? Number(v) : v), z.number({ error: 'Choose a valid location on the map.' }).min(-180, 'Choose a valid location on the map.').max(180, 'Choose a valid location on the map.')),
});
