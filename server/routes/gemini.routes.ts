import { Router } from 'express';
import { GoogleGenAI } from '@google/genai';
import { query } from '../db/index.ts';

const router = Router();

const geminiApiKey = process.env.GEMINI_API_KEY?.trim();

// Initialize the shared server-side Gemini client only when a key is configured.
// This avoids noisy startup warnings and surfaces a clear API error when the feature is not enabled.
const ai = geminiApiKey
  ? new GoogleGenAI({
      apiKey: geminiApiKey,
      httpOptions: {
        headers: {
          'User-Agent': 'aistudio-build',
        },
      },
    })
  : null;

function requireGeminiClient() {
  if (!ai) {
    const error = new Error('Gemini API key is not configured. Add GEMINI_API_KEY to your environment or .env file to enable the AI assistant.');
    (error as Error & { statusCode?: number }).statusCode = 503;
    throw error;
  }
}

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
 * Validates and maps requested model name to authorized Gemini models
 * Supported by user brief:
 * - gemini-3.1-pro-preview (complex tasks)
 * - gemini-3.5-flash (general tasks, default)
 * - gemini-3.1-flash-lite (fast tasks)
 */
function resolveModel(requestedModel?: string, taskComplexity?: string): string {
  if (taskComplexity === 'fast' || requestedModel === 'gemini-3.1-flash-lite') {
    return 'gemini-3.1-flash-lite';
  }
  if (taskComplexity === 'complex' || requestedModel === 'gemini-3.1-pro-preview') {
    return 'gemini-3.1-pro-preview';
  }
  // General default
  return 'gemini-3.5-flash';
}

/**
 * POST /api/gemini/chat
 * Multi-turn chat endpoint using server-side @google/genai SDK
 */
router.post('/chat', async (req, res) => {
  try {
    requireGeminiClient();

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
    const targetModel = resolveModel(requestedModel, taskComplexity);

    // Fetch active products to ground the assistant with live catalog context
    let liveProducts: any[] = [];
    try {
      const prodRes = await query(`SELECT id, name, price, stock, voucher, category_id, seller_id FROM gocart_products_list() WHERE product_status = 'active' LIMIT 20`);
      liveProducts = prodRes.rows;
    } catch (e) {
      // Ignore database context error, continue with default prompt
    }

    const systemInstruction = getSystemInstruction(role, { products: liveProducts });

    // Format previous turns into @google/genai contents structure
    const formattedHistory: any[] = [];
    if (Array.isArray(history)) {
      for (const turn of history) {
        if (turn && (turn.role === 'user' || turn.role === 'model') && Array.isArray(turn.parts)) {
          const validParts = turn.parts
            .filter((p: any) => p && typeof p.text === 'string' && p.text.trim())
            .map((p: any) => ({ text: p.text.trim() }));

          if (validParts.length > 0) {
            formattedHistory.push({
              role: turn.role,
              parts: validParts,
            });
          }
        }
      }
    }

    // Append the latest user message
    formattedHistory.push({
      role: 'user',
      parts: [{ text: message.trim() }],
    });

    let responseText = '';
    let usedModel = targetModel;

    try {
      const response = await ai.models.generateContent({
        model: targetModel,
        contents: formattedHistory,
        config: {
          systemInstruction,
          temperature: targetModel === 'gemini-3.1-pro-preview' ? 0.7 : 0.8,
        },
      });

      responseText = response.text || '';
    } catch (primaryError: any) {
      console.warn(`Primary Gemini call with model ${targetModel} encountered an issue:`, primaryError?.message || primaryError);

      // If pro model fails (e.g. due to tier/quota or availability), gracefully fall back to general model
      if (targetModel !== 'gemini-3.5-flash') {
        console.log('Falling back to gemini-3.5-flash for reliability...');
        usedModel = 'gemini-3.5-flash';
        const fallbackResponse = await ai.models.generateContent({
          model: 'gemini-3.5-flash',
          contents: formattedHistory,
          config: {
            systemInstruction,
          },
        });
        responseText = fallbackResponse.text || '';
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
    console.error('Gemini Chat Server Error:', error);
    const errorMessage = error?.message || 'Failed to generate response from Gemini';
    const statusCode = error?.statusCode || 500;
    return res.status(statusCode).json({
      error: errorMessage,
      message:
        statusCode === 503
          ? 'Gemini AI is not configured on this server. Add GEMINI_API_KEY to enable the assistant.'
          : 'The AI assistant is temporarily unavailable. Please try again in a moment.',
    });
  }
});

export default router;
