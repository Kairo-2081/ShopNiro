import { Router } from 'express';
import Groq from 'groq-sdk';
import { query } from '../db/index.ts';
import { AuthRequest, requireAuth, requireRole } from '../middleware/auth.ts';

const router = Router();

const groqApiKey = process.env.GROQ_API_KEY?.trim();

const groq = groqApiKey ? new Groq({ apiKey: groqApiKey }) : null;

function requireGroqClient() {
  if (!groq) {
    const error = new Error('ShopNiro AI is not configured. Add GROQ_API_KEY to the server environment and restart the server.');
    (error as Error & { statusCode?: number }).statusCode = 503;
    throw error;
  }
}

router.get('/status', (_req, res) => {
  res.json({ configured: Boolean(groq) });
});

router.post('/description', async (req, res) => {
  try {
    requireGroqClient();

    const { kind, shopName, productName, categoryName } = req.body ?? {};
    if (
      (kind !== 'shop' && kind !== 'product') ||
      typeof shopName !== 'string' ||
      !shopName.trim() ||
      (kind === 'product' && (typeof productName !== 'string' || !productName.trim()))
    ) {
      return res.status(400).json({ error: 'A shop name and valid description type are required.' });
    }

    const prompt = kind === 'shop'
      ? `Write a concise, welcoming 2-3 sentence shop description for the business named "${shopName.trim()}". The name is the only confirmed fact: do not claim specific products, credentials, guarantees, or services unless they are explicit in the name. Keep the wording flexible if the shop's specialty is unclear.`
      : `Write a concise, appealing 2-3 sentence product description for "${productName.trim()}" in the "${typeof categoryName === 'string' ? categoryName.trim() : ''}" category, sold by the shop "${shopName.trim()}". Do not invent specifications, materials, certifications, warranties, discounts, or other factual claims not present in those details.`;

    const target = resolveModel('flash-lite', 'fast');
    const response = await groq!.chat.completions.create({
      model: target.model,
      messages: [
        {
          role: 'system',
          content: 'You write clear, trustworthy marketplace copy. Return only the description, with no heading, quotation marks, or markdown.',
        },
        { role: 'user', content: prompt },
      ],
      temperature: 0.6,
    });
    const description = response.choices[0]?.message?.content?.trim();

    if (!description) {
      return res.status(502).json({ error: 'AI could not create a description. Please try again.' });
    }

    return res.json({ description });
  } catch (error: any) {
    console.error('ShopNiro AI description error:', error);
    const statusCode = error?.statusCode || error?.status || 500;
    const errorMessage = statusCode === 503
      ? 'ShopNiro AI is not configured. Add GROQ_API_KEY to the server environment and restart the server.'
      : statusCode === 429
      ? 'ShopNiro AI reached its current usage limit. Please try again later.'
      : 'ShopNiro AI is temporarily unavailable. Please try again in a moment.';
    return res.status(statusCode).json({ error: errorMessage });
  }
});

router.post('/review-draft', requireAuth, requireRole(['customer']), async (req: AuthRequest, res) => {
  const { productName, productDescription, sentiment, notes } = req.body ?? {};
  if (
    typeof productName !== 'string' || !productName.trim() ||
    !['good', 'bad'].includes(sentiment) ||
    (notes !== undefined && typeof notes !== 'string')
  ) {
    return res.status(400).json({ error: 'Choose whether your experience was good or bad.' });
  }
  try {
    requireGroqClient();
    const target = resolveModel('flash-lite', 'fast');
    const response = await groq!.chat.completions.create({
      model: target.model,
      temperature: 0.4,
      messages: [
        { role: 'system', content: 'Draft a concise first-person product review based only on the customer-provided sentiment and notes plus the supplied product description. Do not invent usage, specifications, or outcomes. Return only the review text.' },
        { role: 'user', content: JSON.stringify({ productName: productName.trim().slice(0, 160), productDescription: String(productDescription || '').slice(0, 1200), sentiment, notes: String(notes || '').slice(0, 500) }) },
      ],
    });
    const draft = response.choices[0]?.message?.content?.trim();
    if (!draft) return res.status(502).json({ error: 'AI could not draft this review. Please write it manually.' });
    return res.json({ draft });
  } catch (error: any) {
    const statusCode = error?.statusCode || error?.status || 500;
    return res.status(statusCode).json({ error: statusCode === 503 ? error.message : 'AI review suggestions are temporarily unavailable.' });
  }
});

router.post('/delivery-instructions', requireAuth, requireRole(['customer']), async (req: AuthRequest, res) => {
  const { products, shippingAddress, preferences } = req.body ?? {};
  if (!Array.isArray(products) || !shippingAddress || typeof shippingAddress !== 'object') {
    return res.status(400).json({ error: 'Order items and a delivery address are required.' });
  }
  try {
    requireGroqClient();
    const target = resolveModel('flash-lite', 'fast');
    const response = await groq!.chat.completions.create({
      model: target.model,
      temperature: 0.3,
      messages: [
        { role: 'system', content: 'Write one short, practical delivery instruction the customer can edit. Use only explicit customer preferences, address context, and product names/descriptions. Do not invent access details, contact preferences, or delivery arrangements. If no preference is supplied, return an empty string.' },
        { role: 'user', content: JSON.stringify({ products: products.slice(0, 20).map((item: any) => ({ name: String(item?.name || '').slice(0, 160), description: String(item?.description || '').slice(0, 600), quantity: Number(item?.quantity) || 1 })), shippingAddress: { street: String(shippingAddress.Street || '').slice(0, 160), city: String(shippingAddress.City || '').slice(0, 100), additionalInfo: String(shippingAddress.Additional_Info || '').slice(0, 300) }, preferences: String(preferences || '').slice(0, 500) }) },
      ],
    });
    const instruction = response.choices[0]?.message?.content?.trim();
    if (instruction === undefined) return res.status(502).json({ error: 'AI could not suggest delivery instructions.' });
    return res.json({ instruction });
  } catch (error: any) {
    const statusCode = error?.statusCode || error?.status || 500;
    return res.status(statusCode).json({ error: statusCode === 503 ? error.message : 'AI delivery suggestions are temporarily unavailable.' });
  }
});

router.post('/size-chart', requireAuth, requireRole(['seller', 'admin']), async (req: AuthRequest, res) => {
  try {
    requireGroqClient();
    const { productName, categoryName, gender, imageUrl } = req.body ?? {};
    if (
      typeof productName !== 'string' || !productName.trim() ||
      typeof imageUrl !== 'string' ||
      !['men', 'women', 'unisex'].includes(gender)
    ) {
      return res.status(400).json({ error: 'Product title, image URL, and apparel size category are required.' });
    }
    let parsedImageUrl: URL;
    try {
      parsedImageUrl = new URL(imageUrl);
    } catch {
      return res.status(400).json({ error: 'Enter a valid public product image URL first.' });
    }
    if (!['http:', 'https:'].includes(parsedImageUrl.protocol) || ['localhost', '127.0.0.1', '::1'].includes(parsedImageUrl.hostname)) {
      return res.status(400).json({ error: 'Use a public HTTP or HTTPS product image URL.' });
    }

    const response = await groq!.chat.completions.create({
      model: process.env.GROQ_MODEL_VISION?.trim() || 'meta-llama/llama-4-scout-17b-16e-instruct',
      temperature: 0.1,
      messages: [
        {
          role: 'system',
          content: 'Inspect the apparel image and produce a conservative DRAFT size chart. Image-only measurements are estimates and cannot be exact. Return JSON only with sizes (string array, use standard XS,S,M,L,XL,XXL labels) and sizeChart (array of objects with Size and estimated Chest_CM, Waist_CM, Hip_CM, Length_CM numbers). Use null for measurements the image cannot reasonably inform. Never present estimates as measured facts.',
        },
        {
          role: 'user',
          content: [
            { type: 'text', text: `Product: ${productName.trim()}\nCategory: ${String(categoryName || '').slice(0, 100)}\nSizing group: ${gender}. Return a draft range appropriate for this group.` },
            { type: 'image_url', image_url: { url: parsedImageUrl.href } },
          ],
        },
      ],
    });
    const content: unknown = response.choices[0]?.message?.content;
    const responseText = typeof content === 'string'
      ? content
      : Array.isArray(content)
      ? content.map((part: any) => part.text || '').join('\n')
      : '';
    const parsed = JSON.parse(responseText.slice(responseText.indexOf('{'), responseText.lastIndexOf('}') + 1));
    const sizes = Array.isArray(parsed.sizes) ? parsed.sizes.filter((size: unknown) => typeof size === 'string').slice(0, 12) : [];
    const sizeChart = Array.isArray(parsed.sizeChart) ? parsed.sizeChart.filter((row: any) => row && typeof row.Size === 'string').slice(0, 12) : [];
    if (!sizes.length || !sizeChart.length) return res.status(502).json({ error: 'AI could not create a usable size chart. Enter sizes manually.' });
    return res.json({ sizes, sizeChart, isEstimate: true });
  } catch (error: any) {
    console.error('AI size chart generation failed:', error);
    const statusCode = error?.statusCode || 502;
    return res.status(statusCode).json({ error: 'Could not generate a size chart. You can enter sizes and measurements manually.' });
  }
});

interface ChatMessagePart {
  text: string;
}

interface ChatMessage {
  role: 'user' | 'model';
  parts: ChatMessagePart[];
}

/**
 * System Instructions tailored by role
 */
function getSystemInstruction(
  role: string,
  contextData?: {
    products?: any[];
    categories?: any[];
    sellers?: any[];
    userRole?: string;
  }
): string {
  const productSummary = (contextData?.products || [])
    .slice(0, 15)
    .map((p) => {
      const price = Number(p.price ?? p.Price) || 0;
      return `- [${p.id || p.Product_ID}] ${p.name || p.Name}: ৳${price.toLocaleString('en-BD', { maximumFractionDigits: 2 })} (Stock: ${p.stock ?? p.Stock}, Category: ${p.category_id || p.Category_ID}, Seller: ${p.seller_id || p.Seller_ID}${p.voucher ? `, Voucher: ${p.voucher}` : ''})`;
    })
    .join('\n');

  const baseContext = `
You are the official AI Assistant for ShopNiro, a scalable, multi-vendor e-commerce marketplace platform.
ShopNiro features verified merchants, buyer protection, real-time inventory tracking, and vouchers.
Available promotional vouchers currently running:
- SAVE20 (20% off audio & headphones)
- TECH10 (৳10 off smart tech & wearables)
- BREW15 (15% off artisanal coffee & home living)
- NEW20 (20% off apparel for new customers)

Storefront Catalog Highlights:
${productSummary || 'Categories: Electronics & Gadgets, Home & Living, Fashion & Apparel, Books & Stationery'}

General Guidelines:
- Be polite, concise, professional, and genuinely helpful.
- Format responses clearly with markdown bullet points, bold key terms, and short paragraphs.
- If asked about products, recommend specific items from the catalog above with their prices and vouchers.
- Never make up fake tracking numbers or claim to modify database records directly without prompting the user to use the UI.
`;

  switch (role) {
    case 'seller-advisor':
      return `${baseContext}
SPECIFIC ROLE: Merchant & Seller Operations Advisor.
You assist ShopNiro marketplace merchants and prospective sellers.
Advise on:
- Best practices for product listings, high-converting titles, descriptions, and photography.
- Inventory restocking thresholds and pricing strategies.
- Seller approval process (ShopNiro requires Admin review before new merchants can publish products).
- Fulfilling orders and maintaining high merchant ratings.
Address the user as a valued ShopNiro merchant partner.`;

    case 'order-specialist':
      return `${baseContext}
SPECIFIC ROLE: Order Logistics & Dispute Resolution Specialist.
You help customers and merchants with order tracking, fulfillment updates, returns, and dispute mediation.
Advise on:
- Tracking IDs (formatted like TRK-...) and order status (Pending -> Processing -> Shipped -> Delivered).
- ShopNiro 30-day money-back guarantee and verified vendor inspection.
- Steps to contact merchants or request admin moderation for unfulfilled orders.`;

    case 'complex-analyst':
      return `${baseContext}
SPECIFIC ROLE: Marketplace Technical & Product Intelligence Analyst.
You provide deep, multi-factor analysis:
- In-depth product spec comparisons and value-for-money calculations.
- Vendor credibility evaluation based on catalog quality and reviews.
- Strategic purchasing recommendations and warranty assessments.
Provide comprehensive, well-structured, rigorous reasoning.`;

    case 'shopping-assistant':
    default:
      return `${baseContext}
SPECIFIC ROLE: Customer Concierge & Shopping Assistant.
You help shoppers discover the best products, check stock availability, apply the right discount vouchers, compare options, and navigate the ShopNiro marketplace.
Keep recommendations sharp, enthusiastic, and tailored to the shopper's needs.`;
  }
}

/**
 * Maps the selected ShopNiro mode to a Groq model.
 */
function resolveModel(requestedModel?: string, taskComplexity?: string) {
  const models = {
    fast: process.env.GROQ_MODEL_FAST?.trim() || 'openai/gpt-oss-20b',
    flash: process.env.GROQ_MODEL_FLASH?.trim() || 'openai/gpt-oss-20b',
    pro: process.env.GROQ_MODEL_PRO?.trim() || 'openai/gpt-oss-120b',
  };

  if (taskComplexity === 'fast' || requestedModel === 'flash-lite') {
    return { model: models.fast, mode: 'flash-lite' as const };
  }
  if (taskComplexity === 'complex' || requestedModel === 'pro') {
    return { model: models.pro, mode: 'pro' as const };
  }
  return { model: models.flash, mode: 'flash' as const };
}

/**
 * POST /api/ai/chat
 * Multi-turn chat endpoint using the server-side Groq SDK.
 */
router.post('/chat', async (req, res) => {
  try {
    requireGroqClient();

    const {
      message,
      history = [],
      role = 'shopping-assistant',
      taskComplexity,
      requestedModel,
    } = req.body;

    if (!message || typeof message !== 'string' || !message.trim()) {
      return res.status(400).json({ error: 'Message text is required' });
    }

    // Determine model
    const target = resolveModel(requestedModel, taskComplexity);

    // Fetch active products to ground the assistant with live catalog context
    let liveProducts: any[] = [];
    try {
      const prodRes = await query(`SELECT id, name, price, stock, voucher, category_id, seller_id FROM gocart_products_list() WHERE product_status = 'active' LIMIT 20`);
      liveProducts = prodRes.rows;
    } catch (e) {
      // Ignore database context error, continue with default prompt
    }

    const systemInstruction = getSystemInstruction(role, { products: liveProducts });

    // Convert client history into OpenAI-compatible chat messages.
    const formattedHistory: any[] = [];
    formattedHistory.push({ role: 'system', content: systemInstruction });
    if (Array.isArray(history)) {
      for (const turn of history) {
        if (turn && (turn.role === 'user' || turn.role === 'model') && Array.isArray(turn.parts)) {
          const validParts = turn.parts
            .filter((p: any) => p && typeof p.text === 'string' && p.text.trim())
            .map((p: any) => p.text.trim());

          if (validParts.length > 0) {
            formattedHistory.push({
              role: turn.role === 'model' ? 'assistant' : 'user',
              content: validParts.join('\n'),
            });
          }
        }
      }
    }

    // Append the latest user message
    formattedHistory.push({
      role: 'user',
      content: message.trim(),
    });

    let responseText = '';
    let usedModel = target.mode;

    try {
      const response = await groq!.chat.completions.create({
        model: target.model,
        messages: formattedHistory,
        temperature: target.mode === 'pro' ? 0.7 : 0.8,
      });

      responseText = response.choices[0]?.message?.content || '';
    } catch (primaryError: any) {
      console.warn(`Primary Groq call for ${target.mode} encountered an issue:`, primaryError?.message || primaryError);

      if (target.mode !== 'flash') {
        const fallbackModel = process.env.GROQ_MODEL_FLASH?.trim() || 'openai/gpt-oss-20b';
        console.log('Falling back to ShopNiro Flash mode.');
        usedModel = 'flash';
        const fallbackResponse = await groq!.chat.completions.create({
          model: fallbackModel,
          messages: formattedHistory,
          temperature: 0.8,
        });
        responseText = fallbackResponse.choices[0]?.message?.content || '';
      } else {
        throw primaryError;
      }
    }

    return res.json({
      reply: responseText,
      modelUsed: usedModel,
      roleUsed: role,
    });
  } catch (error: any) {
    console.error('ShopNiro AI server error:', error);
    const statusCode = error?.statusCode || error?.status || 500;
    const errorMessage = statusCode === 503
      ? 'ShopNiro AI is not configured. Add GROQ_API_KEY to the server environment and restart the server.'
      : statusCode === 401 || statusCode === 403
      ? 'ShopNiro AI could not authorize the configured Groq key. Check GROQ_API_KEY and account access.'
      : statusCode === 429
      ? 'ShopNiro AI reached its current usage limit. Check Groq account limits and try again later.'
      : 'ShopNiro AI is temporarily unavailable. Please try again in a moment.';
    return res.status(statusCode).json({
      error: errorMessage,
      message: errorMessage,
    });
  }
});

export default router;
