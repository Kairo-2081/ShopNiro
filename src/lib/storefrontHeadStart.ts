import { api } from './api';
import { loadStorefront } from './storefrontChunk';

// The first screen needs the same public data every time: categories, sellers, the first page of products, reviews and
// the sign-in check. They used to be requested from an effect, after the landing page had rendered, which on a slow
// phone is hundreds of milliseconds after the code that could have asked for them was already running. Starting them
// here, as soon as the entry code runs, puts those round trips alongside the rest of the page load. The app takes the
// promises once, when it would have made the same calls; a retry or a later reload asks normally.
type HeadStart = {
  auth: ReturnType<typeof api.validateAuth>;
  categories: ReturnType<typeof api.getCategories>;
  sellers: ReturnType<typeof api.getSellers>;
  products: ReturnType<typeof api.getProductsPage>;
  reviews: ReturnType<typeof api.getReviews>;
};

let headStart: HeadStart | null = null;

export const STORE_PRODUCT_PAGE_SIZE = 24;

export function beginStorefrontHeadStart(): void {
  if (headStart) return;
  headStart = {
    auth: api.validateAuth(),
    categories: api.getCategories(),
    sellers: api.getSellers(),
    products: api.getProductsPage({ limit: STORE_PRODUCT_PAGE_SIZE, offset: 0 }),
    reviews: api.getReviews(),
  };
  // A request nobody takes (the visitor opened a policy page, say) must not raise an unhandled rejection.
  for (const request of Object.values(headStart)) request.catch(() => undefined);
  void loadStorefront().catch(() => undefined);
}

// Hands over the early requests once. After that the app makes its own.
export function takeStorefrontHeadStart(): HeadStart | null {
  const taken = headStart;
  headStart = null;
  return taken;
}
