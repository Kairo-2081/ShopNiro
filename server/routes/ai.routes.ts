import { Router } from 'express';
import Groq from 'groq-sdk';
import { query } from '../db/index.ts';

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
