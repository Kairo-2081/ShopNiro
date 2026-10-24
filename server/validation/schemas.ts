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

// --- catalogue: products, categories, bundles ------------------------------

const decimalInput = (message: string) =>
  z.preprocess((v) => (typeof v === 'string' && v.trim() !== '' ? Number(v) : v), z.number({ error: message }).finite(message));

const imageRef = z.string({ error: 'Product images must be text.' }).max(4_000_000, 'A product image is too large.');

/**
 * Types and size caps for a product write. Business rules (required fields, price range, word counts,
 * seller approval) stay in the handler; `.loose()` keeps fields this schema does not know about.
 */
const productFields = {
  Name: z.string({ error: 'Product name must be text.' }).trim().max(80, 'Product titles must be 80 characters or fewer.'),
  Image: imageRef.nullable(),
  Video_URL: z.string().max(2048, 'Product video must use a valid HTTP or HTTPS URL under 2048 characters.').nullable(),
  Images: z.array(imageRef).max(30, 'A product can have up to 7 images.'),
  Highlights: z.array(z.string().max(300, 'Each highlight must be 300 characters or fewer.')).max(30, 'Too many highlights.'),
  Description: z.string({ error: 'Description must be text.' }).max(6000, 'Product descriptions must be 300 words or fewer.').nullable(),
  Warranty_Information: z.string().max(2000, 'Warranty information is too long.').nullable(),
  Return_Policy: z.string().max(2000, 'Return policy is too long.').nullable(),
  Price: decimalInput('Price must be between 0.01 and 99,999,999.99.'),
  Voucher: z.string().max(100, 'Voucher is too long.').nullable(),
  Voucher_Expires_At: z.union([z.string().max(64, 'Enter a valid voucher end date.'), z.null()]),
  Stock: wholeNumber(0, 10_000_000, 'Stock must be a whole number.'),
  Category_ID: idString('Choose a valid category.'),
  Seller_ID: idString('Choose a valid seller.'),
  Product_Status: z.string().max(40, 'Invalid product status.'),
  Size_Gender: z.string().max(20, 'Invalid size category.').nullable(),
  Sizes: z.array(z.string().max(40, 'Each size must be 40 characters or fewer.')).max(40, 'Too many sizes.'),
  Size_Chart: z.array(z.object({}).loose()).max(60, 'Size chart is too large.'),
};

export const createProductBody = z.object({ ...productFields }).partial().loose();
export const updateProductBody = z.object({ ...productFields }).partial().loose();

export const productStatusBody = z.object({
  status: z.enum(['active', 'inactive', 'deactivated'], { error: 'Valid status is required' }),
});

export const categoryBody = z.object({ Name: requiredText(80, 'Category Name is required') });

export const createBundleBody = z.object({
  Name: requiredText(120, 'Bundle name is required and must be 120 characters or fewer.'),
  Product_IDs: z.array(z.string().max(80), { error: 'Choose between 2 and 5 products for a bundle.' }).max(20, 'Choose between 2 and 5 products for a bundle.'),
  Discount_Percent: decimalInput('Bundle discount must be between 0 and 50 percent.'),
  Ends_At: z.union([z.string().max(64, 'Bundle end date must be in the future.'), z.null()]).optional(),
});

export const bundleActiveBody = z.object({ Active: z.boolean({ error: 'Active must be a boolean.' }) });

// --- wishlist, analytics ---------------------------------------------------

export const productIdParam = z.object({ productId: idString('Invalid product ID.') });

export const analyticsEventBody = z.object({
  Product_ID: idString('A valid product event is required.'),
  Event_Type: z.enum(['impression', 'click'], { error: 'A valid product event is required.' }),
  Session_ID: z.string({ error: 'A valid product event is required.' }).regex(/^[a-zA-Z0-9_-]{16,64}$/, 'A valid product event is required.'),
});

// --- AI assistant ----------------------------------------------------------

const aiText = (max: number) => z.string().max(max, `Keep this under ${max} characters.`);

/** One loose schema for the single-shot AI helpers: every named field is type- and size-capped. */
export const aiHelperBody = z
  .object({
    kind: aiText(40),
    field: aiText(40),
    shopName: aiText(200),
    productName: aiText(300),
    categoryName: aiText(200),
    productFacts: z.union([aiText(4000), z.array(aiText(500)).max(40), z.object({}).loose()]),
    sourceText: aiText(8000),
    styleIndex: z.union([wholeNumber(0, 100, 'Invalid style.'), z.null()]),
    productDescription: aiText(4000),
    sentiment: aiText(40),
    notes: aiText(2000),
    riderName: aiText(200),
    rating: wholeNumber(1, 5, 'Rating must be a whole number from 1 to 5'),
    wasTimely: z.boolean(),
    products: z.array(z.unknown()).max(50, 'Too many products.'),
    shippingAddress: z.union([aiText(1000), z.object({}).loose()]),
    preferences: z.union([aiText(2000), z.object({}).loose()]),
    gender: aiText(40),
    imageUrl: aiText(2048),
  })
  .partial()
  .loose();

export const aiChatBody = z
  .object({
    message: z.string({ error: 'Message text is required' }).trim().min(1, 'Message text is required').max(4000, 'Messages can be at most 4000 characters.'),
    history: z.array(z.object({}).loose()).max(60, 'Conversation history is too long.').optional(),
    role: aiText(60).optional(),
    taskComplexity: aiText(40).nullable().optional(),
    requestedModel: aiText(80).nullable().optional(),
  })
  .loose();
export const cartIdParam = z.object({ cartId: idString('Invalid cart item ID.') });

// --- admin review actions, delivery steps, uploads --------------------------

const reviewReason = z.string({ error: 'Enter a valid reason.' }).max(1000, 'Reasons must be 1000 characters or fewer.').nullable().optional();

export const sellerStatusBody = z.object({
  status: z.enum(['pending', 'approved', 'rejected', 'suspended'], { error: 'Valid status is required' }),
  reason: reviewReason,
  identityVerified: z.boolean().optional(),
  documentsReviewed: z.boolean().optional(),
  payoutVerified: z.boolean().optional(),
});

export const riderApplicationStatusBody = z.object({
  status: z.enum(['approved', 'rejected', 'suspended'], { error: 'Choose approved, rejected, or suspended.' }),
  reason: reviewReason,
});

export const deliveryReviewBody = z.object({
  rating: wholeNumber(1, 5, 'Choose a 1\u20135 rating and whether delivery was timely.'),
  reviewText: z.string().max(2000, 'Reviews must be 2000 characters or fewer.').optional(),
  wasTimely: z.boolean({ error: 'Choose a 1\u20135 rating and whether delivery was timely.' }),
});

export const productImageUploadBody = z.object({
  Image: z
    .string({ error: 'Choose a JPG, PNG or WebP image to upload.' })
    .startsWith('data:image/', 'Choose a JPG, PNG or WebP image to upload.')
    .max(4_000_000, 'That image is too large. Choose one under 2 MB.'),
});

const cvList = z.array(z.string().max(1000, 'Each entry must be 1000 characters or fewer.')).max(40, 'Too many entries.');
export const cvFormatBody = z.object({ experience: cvList.optional(), previousJobs: cvList.optional(), education: cvList.optional() });
export const cvParseBody = z.object({ cvBase64: z.string({ error: 'Upload a PDF CV.' }).min(1, 'Upload a PDF CV.').max(8_000_000, 'That CV is too large.') });

/** Types and caps only; the handler keeps its required-field and duplicate checks. */
export const createAdminBody = z
  .object({
    Name: text(160),
    Email: text(255),
    Username: text(60),
    Password: z.string().max(128, 'Password must be 128 characters or fewer.'),
    Number: text(40),
    Address: z.object({}).loose(),
  })
  .partial()
  .loose();
