import {
  Admin,
  Category,
  Seller,
  Customer,
  Product,
  Review,
  Order,
  CartItem,
  Address,
  SellerStatus,
  ProductStatus,
  OrderStatus,
  UserRole,
  Rider,
  RiderDelivery,
  RiderStatus,
  ProductBundle,
  OrderCancellationRequest,
  StorefrontSort,
  SupportRequest,
} from '../types';
import { apiUrl } from '../apiConfig';

const ANALYTICS_SESSION_KEY = 'shopniro_analytics_session';
const PUBLIC_CATALOG_CACHE_TTL = 30_000;
const publicCatalogCache = new Map<string, { expiresAt: number; value: unknown }>();
let hasValidatedSession = false;

if (typeof window !== 'undefined') {
  window.localStorage.removeItem('marketpulse_jwt_token');
}

function getAnalyticsSessionId(): string {
  if (typeof window === 'undefined') return 'server-render-session';
  let sessionId = window.sessionStorage.getItem(ANALYTICS_SESSION_KEY);
  if (!sessionId) {
    sessionId = window.crypto.randomUUID();
    window.sessionStorage.setItem(ANALYTICS_SESSION_KEY, sessionId);
  }
  return sessionId;
}

/**
 * Validates whether an endpoint is public/auth-related or requires authentication.
 */
function isPublicEndpoint(url: string, method: string = 'GET'): boolean {
  const cleanUrl = url.split('?')[0];
  const upperMethod = method.toUpperCase();
  if (upperMethod === 'GET') {
    return cleanUrl === '/api/auth/me' ||
      /^\/api\/(categories|reviews|sellers|bundles)$/.test(cleanUrl) ||
      /^\/api\/products(?:\/[^/]+)?$/.test(cleanUrl) ||
      /^\/api\/analytics\/(trending-products|top-rated-products|top-rated-sellers|related-products)$/.test(cleanUrl) ||
      cleanUrl === '/api/maps/reverse' ||
      /^\/api\/payment\/(methods|bkash\/direct|simulator)$/.test(cleanUrl) ||
      /^\/api\/payment\/sslcommerz\/(success|fail|cancel)$/.test(cleanUrl) ||
      cleanUrl === '/api/riders/payroll/settle';
  }
  if (upperMethod === 'POST') {
    return /^\/api\/auth\/(login|logout)$/.test(cleanUrl) ||
      /^\/api\/(customers|sellers)$/.test(cleanUrl) ||
      /^\/api\/riders\/(apply|cv\/parse|cv\/format)$/.test(cleanUrl) ||
      cleanUrl === '/api/analytics/events' ||
      cleanUrl === '/api/ai/chat' ||
      cleanUrl === '/api/payment/simulator/complete' ||
      /^\/api\/payment\/sslcommerz\/(success|fail|cancel|ipn)$/.test(cleanUrl) ||
      cleanUrl === '/api/support/requests' ||
      /^\/api\/cron\/(expire-orders|refunds)$/.test(cleanUrl);
  }
  return false;
}

async function fetchJson<T>(url: string, options?: RequestInit, handleAuthErrors = true): Promise<T> {
  const method = (options?.method || 'GET').toUpperCase();
  const isPublic = isPublicEndpoint(url, method);
  const shouldCache = method === 'GET' && [
    '/api/categories', '/api/products', '/api/reviews', '/api/bundles',
  ].some((prefix) => url.split('?')[0] === prefix || url.split('?')[0].startsWith(`${prefix}/`));
  const cacheKey = url;

  if (shouldCache) {
    const cached = publicCatalogCache.get(cacheKey);
    if (cached && cached.expiresAt > Date.now()) {
      return JSON.parse(JSON.stringify(cached.value)) as T;
    }
    if (cached) publicCatalogCache.delete(cacheKey);
  }

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options?.headers as Record<string, string> || {}),
  };

  const res = await fetch(apiUrl(url), {
    ...options,
    credentials: 'include',
    headers,
  });

  if (!res.ok) {
    // If server responds with 401 Unauthorized, automatically invalidate session and alert application
    if (res.status === 401 && handleAuthErrors) {
      hasValidatedSession = false;
      void fetch(apiUrl('/api/auth/logout'), { method: 'POST', credentials: 'include' }).catch(() => {});
      if (typeof window !== 'undefined' && !isPublic) {
        window.dispatchEvent(
          new CustomEvent('auth:unauthorized', {
            detail: {
              url,
              status: 401,
              message: 'Your session has expired or is invalid. Please sign in again.',
            },
          })
        );
      }
    }

    let errorMsg = `HTTP Error ${res.status}`;
    try {
      const errorData = await res.json();
      if (errorData?.error) errorMsg = errorData.error;
      else if (errorData?.message) errorMsg = errorData.message;
    } catch {
      // ignore json parse error
    }
    throw new Error(errorMsg);
  }
  const data = await res.json() as T;
  if (shouldCache) {
    publicCatalogCache.set(cacheKey, { expiresAt: Date.now() + PUBLIC_CATALOG_CACHE_TTL, value: data });
  } else if (method !== 'GET') {
    publicCatalogCache.clear();
  }
  return data;
}

async function fetchAllPages<T>(path: string, filters = new URLSearchParams()): Promise<T[]> {
  const pageSize = 100;
  const items: T[] = [];
  let offset = 0;
  while (true) {
    const params = new URLSearchParams(filters);
    params.set('limit', String(pageSize));
    params.set('offset', String(offset));
    const page = await fetchJson<T[]>(`${path}?${params.toString()}`);
    items.push(...page.slice(0, pageSize));
    if (page.length <= pageSize) return items;
    offset += pageSize;
  }
}

// Full-stack API client using HttpOnly cookie-backed JWT sessions
export const api = {
  // Database Status
  getDbStatus: async () => fetchJson<{ connected: boolean; provider: string; database: string }>('/api/db/status'),
  reverseGeocode: async (lat: number, lon: number): Promise<Address> => {
    const params = new URLSearchParams({ lat: String(lat), lon: String(lon) });
    return fetchJson<Address>(`/api/maps/reverse?${params.toString()}`);
  },

  // Categories
  getCategories: async (): Promise<Category[]> => fetchJson<Category[]>('/api/categories'),
  createCategory: async (nameOrData: string | { Name: string }): Promise<Category> => {
    const data = typeof nameOrData === 'string' ? { Name: nameOrData } : nameOrData;
    return fetchJson<Category>('/api/categories', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },
  updateCategory: async (id: string, Name: string): Promise<Category> =>
    fetchJson<Category>(`/api/categories/${encodeURIComponent(id)}`, {
      method: 'PUT',
      body: JSON.stringify({ Name }),
    }),
  deleteCategory: async (id: string): Promise<{ success: boolean }> =>
    fetchJson<{ success: boolean }>(`/api/categories/${encodeURIComponent(id)}`, {
      method: 'DELETE',
    }),

  // Products
  getProductsPage: async (params?: {
    sellerId?: string;
    categoryId?: string;
    search?: string;
    status?: ProductStatus;
    sort?: StorefrontSort;
    limit?: number;
    offset?: number;
  }): Promise<{ items: Product[]; hasMore: boolean }> => {
    const limit = Math.min(100, Math.max(1, params?.limit || 24));
    const searchParams = new URLSearchParams({ limit: String(limit), offset: String(Math.max(0, params?.offset || 0)) });
    if (params?.sellerId) searchParams.set('sellerId', params.sellerId);
    if (params?.categoryId) searchParams.set('categoryId', params.categoryId);
    if (params?.search) searchParams.set('search', params.search);
    if (params?.status) searchParams.set('status', params.status);
    if (params?.sort) searchParams.set('sort', params.sort);
    const rows = await fetchJson<Product[]>(`/api/products?${searchParams.toString()}`);
    return { items: rows.slice(0, limit), hasMore: rows.length > limit };
  },
  getProducts: async (params?: {
    sellerId?: string;
    categoryId?: string;
    search?: string;
    status?: ProductStatus;
    sort?: StorefrontSort;
  }): Promise<Product[]> => {
    const pageSize = 100;
    const products: Product[] = [];
    let offset = 0;
    let hasMore = true;
    while (hasMore) {
      const page = await api.getProductsPage({ ...params, limit: pageSize, offset });
      products.push(...page.items);
      hasMore = page.hasMore;
      offset += page.items.length;
    }
    return products;
  },
  getWishlist: async (): Promise<string[]> => fetchJson<string[]>('/api/wishlist'),
  addToWishlist: async (productId: string): Promise<void> => {
    await fetchJson(`/api/wishlist/${encodeURIComponent(productId)}`, { method: 'POST' });
  },
  removeFromWishlist: async (productId: string): Promise<void> => {
    await fetchJson(`/api/wishlist/${encodeURIComponent(productId)}`, { method: 'DELETE' });
  },

  getProductById: async (id: string): Promise<Product> =>
    fetchJson<Product>(`/api/products/${encodeURIComponent(id)}`),

  createProduct: async (productData: Partial<Product> & {
    Name?: string;
    Price?: number;
    Stock?: number;
    Category_ID?: string;
    Seller_ID?: string;
  }): Promise<Product> =>
    fetchJson<Product>('/api/products', {
      method: 'POST',
      body: JSON.stringify(productData),
    }),

  updateProduct: async (id: string, updates: Partial<Product>): Promise<Product> =>
    fetchJson<Product>(`/api/products/${encodeURIComponent(id)}`, {
      method: 'PUT',
      body: JSON.stringify(updates),
    }),

  updateProductStatus: async (id: string, status: ProductStatus): Promise<void> => {
    await fetchJson(`/api/products/${encodeURIComponent(id)}/status`, {
      method: 'PUT',
      body: JSON.stringify({ Product_Status: status }),
    });
  },

  deleteProduct: async (id: string): Promise<{ success: boolean }> =>
    fetchJson<{ success: boolean }>(`/api/products/${encodeURIComponent(id)}`, {
      method: 'DELETE',
    }),

  // Customers
  getCustomers: async (): Promise<Customer[]> => fetchAllPages<Customer>('/api/customers'),
  createCustomer: async (customerData: Partial<Customer> & { Password?: string }): Promise<Customer> =>
    fetchJson<Customer>('/api/customers', {
      method: 'POST',
      body: JSON.stringify(customerData),
    }),
  updateCustomer: async (id: string, updates: Partial<Customer>): Promise<Customer> =>
    fetchJson<Customer>(`/api/customers/${encodeURIComponent(id)}`, {
      method: 'PUT',
      body: JSON.stringify(updates),
    }),

  // Sellers
  getSellers: async (): Promise<Seller[]> => fetchAllPages<Seller>('/api/sellers'),
  createSeller: async (sellerData: Partial<Seller> & { Password?: string }): Promise<Seller> =>
    fetchJson<Seller>('/api/sellers', {
      method: 'POST',
      body: JSON.stringify(sellerData),
    }),
  updateSellerStatus: async (
    id: string,
    status: SellerStatus,
    reason?: string,
    checklist?: { identityVerified: boolean; documentsReviewed: boolean; payoutVerified: boolean }
  ): Promise<Seller> =>
    fetchJson<Seller>(`/api/sellers/${encodeURIComponent(id)}/status`, {
      method: 'PATCH',
      body: JSON.stringify({ status, reason, ...checklist }),
    }),
  getSellerIdentityDocument: async (id: string): Promise<{ url: string; expiresInSeconds: number }> =>
    fetchJson(`/api/sellers/applications/${encodeURIComponent(id)}/identity-document`),
  updateSellerProfile: async (updates: Partial<Seller>): Promise<Seller> =>
    fetchJson<Seller>('/api/sellers/me/profile', {
      method: 'PUT',
      body: JSON.stringify(updates),
    }),
  getSellerWallet: async (): Promise<{ available: number; pending: number; payoutVerified: boolean; entries: any[] }> => fetchJson('/api/sellers/me/wallet'),
  requestSellerPayout: async (amount: number): Promise<{ success: boolean; payoutId: string; status: 'requested' }> =>
    fetchJson('/api/sellers/me/payouts', { method: 'POST', body: JSON.stringify({ amount }) }),
  getSellerPayoutRequests: async (): Promise<any[]> => fetchAllPages('/api/payouts'),
  paySellerPayout: async (id: string, externalReference: string): Promise<{ success: boolean; status: 'paid' }> =>
    fetchJson(`/api/payouts/${encodeURIComponent(id)}/pay`, {
      method: 'PATCH',
      body: JSON.stringify({ externalReference }),
    }),
  rejectSellerPayout: async (id: string): Promise<{ success: boolean; status: 'rejected' }> =>
    fetchJson(`/api/payouts/${encodeURIComponent(id)}/reject`, { method: 'PATCH', body: JSON.stringify({}) }),
  trackProductEvent: async (Product_ID: string, Event_Type: 'impression' | 'click'): Promise<{ success: boolean }> =>
    fetchJson('/api/analytics/events', {
      method: 'POST',
      body: JSON.stringify({ Product_ID, Event_Type, Session_ID: getAnalyticsSessionId() }),
    }),
  getSellerProductAnalytics: async (): Promise<Array<{
    Product_ID: string;
    Impressions_7d: number;
    Clicks_7d: number;
    CTR_7d: number | null;
    CTR_Previous_7d: number | null;
    Returned_Units_30d: number;
    Sold_Units_30d: number;
    Return_Rate_30d: number | null;
  }>> => fetchJson('/api/analytics/seller'),

  // Seller bundle offers
  getBundles: async (): Promise<ProductBundle[]> => fetchAllPages('/api/bundles'),
  getSellerBundles: async (): Promise<ProductBundle[]> => fetchAllPages('/api/bundles/seller'),
  createSellerBundle: async (data: Pick<ProductBundle, 'Name' | 'Product_IDs' | 'Discount_Percent' | 'Ends_At'>): Promise<ProductBundle> =>
    fetchJson('/api/bundles', { method: 'POST', body: JSON.stringify(data) }),
  setSellerBundleActive: async (id: string, Active: boolean): Promise<ProductBundle> =>
    fetchJson(`/api/bundles/${encodeURIComponent(id)}/active`, { method: 'PATCH', body: JSON.stringify({ Active }) }),
  deleteSellerBundle: async (id: string): Promise<{ success: boolean }> =>
    fetchJson(`/api/bundles/${encodeURIComponent(id)}`, { method: 'DELETE' }),

  applyRider: async (data: {
    Username: string;
    Name: string;
    Email: string;
    Password: string;
    Number: string;
    Present_Address: Address;
    Permanent_Address: Address;
    Has_CV: boolean;
    CV_Base64?: string;
    CV_File_Name?: string;
    Profile_Image?: string;
    Profile_Image_File_Name?: string;
    Experience: string[];
    Previous_Jobs: string[];
    Education: string[];
  }): Promise<{ success: boolean; status: 'pending'; message: string }> =>
    fetchJson('/api/riders/apply', { method: 'POST', body: JSON.stringify(data) }),
  parseRiderCv: async (cvBase64: string): Promise<{ extracted: { experience: string[]; previousJobs: string[]; education: string[] }; missingFields: string[] }> =>
    fetchJson('/api/riders/cv/parse', { method: 'POST', body: JSON.stringify({ cvBase64 }) }),
  formatRiderCv: async (data: { experience: string[]; previousJobs: string[]; education: string[] }): Promise<{ experience: string[]; previousJobs: string[]; education: string[] }> =>
    fetchJson('/api/riders/cv/format', { method: 'POST', body: JSON.stringify(data) }),
  getRiderLeaderboard: async (): Promise<Rider[]> => fetchJson<Rider[]>('/api/riders/leaderboard'),
  getRiderApplications: async (): Promise<Rider[]> => fetchAllPages<Rider>('/api/riders/applications'),
  setRiderApplicationStatus: async (id: string, status: RiderStatus, reason?: string): Promise<{ Rider_ID: string; Status: RiderStatus }> =>
    fetchJson(`/api/riders/applications/${encodeURIComponent(id)}/status`, {
      method: 'PATCH',
      body: JSON.stringify({ status, reason }),
    }),
  downloadRiderCv: async (id: string): Promise<Blob> => {
    const response = await fetch(apiUrl(`/api/riders/applications/${encodeURIComponent(id)}/cv`), {
      credentials: 'include',
    });
    if (!response.ok) throw new Error('Could not download rider CV.');
    return response.blob();
  },
  getRiderProfile: async (): Promise<Rider> => fetchJson<Rider>('/api/riders/me'),
  getMyRiderCv: async (): Promise<Blob> => {
    const response = await fetch(apiUrl('/api/riders/me/cv'), {
      credentials: 'include',
    });
    if (!response.ok) throw new Error('Could not open your current CV.');
    return response.blob();
  },
  updateRiderProfile: async (updates: Partial<Rider> & { Password?: string }): Promise<Rider> =>
    fetchJson<Rider>('/api/riders/me', {
      method: 'PUT',
      body: JSON.stringify(updates),
    }),
  updateRiderLocation: async (latitude: number, longitude: number): Promise<{ success: boolean }> =>
    fetchJson('/api/riders/location', {
      method: 'PATCH',
      body: JSON.stringify({ latitude, longitude }),
    }),
  getRiderDeliveries: async (latitude: number, longitude: number): Promise<RiderDelivery[]> => {
    const params = new URLSearchParams({ latitude: String(latitude), longitude: String(longitude) });
    return fetchJson(`/api/riders/deliveries?${params.toString()}`);
  },
  acceptRiderDelivery: async (deliveryId: string): Promise<{ success: boolean }> =>
    fetchJson(`/api/riders/deliveries/${encodeURIComponent(deliveryId)}/accept`, { method: 'POST' }),
  setRiderDeliveryOnWay: async (deliveryId: string): Promise<{ success: boolean }> =>
    fetchJson(`/api/riders/deliveries/${encodeURIComponent(deliveryId)}/on-way`, { method: 'POST' }),
  markRiderCodCollected: async (deliveryId: string): Promise<{ success: boolean }> =>
    fetchJson(`/api/riders/deliveries/${encodeURIComponent(deliveryId)}/cod-collected`, { method: 'POST' }),
  confirmCustomerDelivery: async (deliveryId: string, code: string): Promise<{ success: boolean }> =>
    fetchJson(`/api/riders/deliveries/${encodeURIComponent(deliveryId)}/complete`, {
      method: 'POST',
      body: JSON.stringify({ code }),
    }),
  getCustomerRiderDeliveries: async (): Promise<Array<RiderDelivery & { Rider_Name?: string; Rider_Number?: string; Review_ID?: string }>> =>
    fetchAllPages('/api/riders/customer-deliveries'),
  reviewRiderDelivery: async (deliveryId: string, rating: number, reviewText: string, wasTimely: boolean): Promise<{ success: boolean }> =>
    fetchJson(`/api/riders/customer-deliveries/${encodeURIComponent(deliveryId)}/review`, {
      method: 'POST',
      body: JSON.stringify({ rating, reviewText, wasTimely }),
    }),
  getRiderWallet: async (): Promise<{ balance: number; availableBalance: number; lockedBalance: number; lockedCod: number; lockedSalary: number; pendingSalary: number; entries: any[]; withdrawals: any[] }> =>
    fetchJson('/api/riders/wallet'),
  requestRiderWithdrawal: async (amount: number, payoutMethod: string, payoutAccount: string): Promise<{ success: boolean; withdrawalId: string }> =>
    fetchJson('/api/riders/wallet/withdrawals', {
      method: 'POST',
      body: JSON.stringify({ amount, payoutMethod, payoutAccount }),
    }),
  getRiderWithdrawals: async (): Promise<any[]> => fetchAllPages('/api/riders/wallet/withdrawals'),
  processRiderWithdrawal: async (id: string, status: 'paid' | 'rejected'): Promise<{ success: boolean; status: string }> =>
    fetchJson(`/api/riders/wallet/withdrawals/${encodeURIComponent(id)}`, {
      method: 'PATCH',
      body: JSON.stringify({ status }),
    }),

  // Admins
  getAdmins: async (): Promise<Admin[]> => fetchAllPages<Admin>('/api/admins'),
  createAdmin: async (data: Partial<Admin> & { Username?: string }): Promise<Admin> =>
    fetchJson<Admin>('/api/admins', {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  // Auth Login: establishes an HttpOnly cookie-backed JWT session
  login: async (
    usernameOrEmail: string,
    password: string,
    role?: UserRole
  ): Promise<{ success: boolean; role: UserRole; entity: any; message?: string }> => {
    const res = await fetchJson<{ success: boolean; role: UserRole; entity: any; message?: string }>('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email: usernameOrEmail, password, role }),
    }, false);
    hasValidatedSession = res.success;
    return res;
  },

  // Auth Current User from JWT Session
  getMe: async (): Promise<{ authenticated: boolean; user?: any; role?: UserRole; entity?: any }> => {
    return fetchJson<{ authenticated: boolean; user?: any; role?: UserRole; entity?: any }>('/api/auth/me');
  },

  // Validate Authentication for Page Navigation & HTTP Gatekeeping
  validateAuth: async (): Promise<{ authenticated: boolean; user?: any; role?: UserRole; entity?: any }> => {
    try {
      const res = await fetchJson<{ authenticated: boolean; user?: any; role?: UserRole; entity?: any }>('/api/auth/me', undefined, false);
      hasValidatedSession = res.authenticated;
      return res;
    } catch {
      hasValidatedSession = false;
      return { authenticated: false };
    }
  },

  // Check whether this page has validated a server session
  isAuthenticated: (): boolean => {
    return hasValidatedSession;
  },

  // Logout
  logout: (): void => {
    hasValidatedSession = false;
    void fetch(apiUrl('/api/auth/logout'), { method: 'POST', credentials: 'include' }).catch(() => {});
  },

  // Cart
  getCart: async (customerId: string): Promise<CartItem[]> =>
    fetchJson<CartItem[]>(`/api/cart?customerId=${encodeURIComponent(customerId)}`),
  addToCart: async (Customer_ID: string, Product_ID: string, Quantity: number = 1, Size?: string): Promise<CartItem> =>
    fetchJson<CartItem>('/api/cart', {
      method: 'POST',
      body: JSON.stringify({ Customer_ID, Product_ID, Quantity, Size }),
    }),
  updateCartQuantity: async (cartId: string, Quantity: number): Promise<void> => {
    await fetchJson(`/api/cart/${encodeURIComponent(cartId)}`, {
      method: 'PUT',
      body: JSON.stringify({ Quantity }),
    });
  },
  removeFromCart: async (cartId: string): Promise<{ success: boolean }> =>
    fetchJson<{ success: boolean }>(`/api/cart/${encodeURIComponent(cartId)}`, {
      method: 'DELETE',
    }),

  // Orders
  getOrdersPage: async (params?: { customerId?: string; sellerId?: string; limit?: number; offset?: number }): Promise<{ items: Order[]; hasMore: boolean }> => {
    const limit = Math.min(100, Math.max(1, params?.limit || 50));
    const searchParams = new URLSearchParams();
    searchParams.set('limit', String(limit));
    searchParams.set('offset', String(Math.max(0, params?.offset || 0)));
    if (params?.customerId) searchParams.set('customerId', params.customerId);
    if (params?.sellerId) searchParams.set('sellerId', params.sellerId);
    const rows = await fetchJson<Order[]>(`/api/orders?${searchParams.toString()}`);
    return { items: rows.slice(0, limit), hasMore: rows.length > limit };
  },
  getOrders: async (params?: { customerId?: string; sellerId?: string }): Promise<Order[]> => {
    const orders: Order[] = [];
    let offset = 0;
    let hasMore = true;
    while (hasMore) {
      const page = await api.getOrdersPage({ ...params, limit: 50, offset });
      orders.push(...page.items);
      hasMore = page.hasMore;
      offset += page.items.length;
    }
    return orders;
  },
  getOrderCancellationRequests: async (): Promise<OrderCancellationRequest[]> =>
    fetchAllPages<OrderCancellationRequest>('/api/orders/cancellation-requests'),
  submitSupportRequest: async (request: Pick<SupportRequest, 'Name' | 'Email' | 'Subject' | 'Message'>): Promise<{ success: boolean; Request_ID: string }> =>
    fetchJson('/api/support/requests', { method: 'POST', body: JSON.stringify(request) }),
  getSupportRequests: async (): Promise<SupportRequest[]> => fetchAllPages<SupportRequest>('/api/support/requests'),
  updateSupportRequestStatus: async (id: string, status: SupportRequest['Status'], adminNotes = ''): Promise<void> => {
    await fetchJson(`/api/support/requests/${encodeURIComponent(id)}/status`, {
      method: 'PATCH',
      body: JSON.stringify({ status, adminNotes }),
    });
  },
  requestOrderCancellation: async (orderId: string, reason = ''): Promise<void> => {
    await fetchJson(`/api/orders/${encodeURIComponent(orderId)}/cancellation-request`, {
      method: 'POST',
      body: JSON.stringify({ reason }),
    });
  },
  reviewOrderCancellation: async (requestId: string, decision: 'approved' | 'rejected', cashReturned = false): Promise<void> => {
    await fetchJson(`/api/orders/cancellation-requests/${encodeURIComponent(requestId)}/review`, {
      method: 'PATCH',
      body: JSON.stringify({ decision, cashReturned }),
    });
  },
  createOrder: async (orderData: {
    Customer_ID: string;
    Items: any[];
    Shipping_Address: Address;
    Billing_Address: Address;
    Subtotal: number;
    Shipping_Fee: number;
    Additional_Info?: string;
    Currency?: string;
  }): Promise<Order> =>
    fetchJson<Order>('/api/orders', {
      method: 'POST',
      body: JSON.stringify(orderData),
    }),
  getOrder: async (orderId: string): Promise<Order> =>
    fetchJson<Order>(`/api/orders/${encodeURIComponent(orderId)}`),
  revertFailedOnlinePayment: async (orderId: string): Promise<{ success: boolean; order_id: string; restored_to_cart: boolean }> =>
    fetchJson<{ success: boolean; order_id: string; restored_to_cart: boolean }>(`/api/orders/${encodeURIComponent(orderId)}/revert-failed-payment`, {
      method: 'PATCH',
    }),
  updateOrderStatus: async (orderId: string, Status: OrderStatus | string): Promise<Order> =>
    fetchJson<Order>(`/api/orders/${encodeURIComponent(orderId)}/status`, {
      method: 'PATCH',
      body: JSON.stringify({ status: Status }),
    }),

  // Reviews
  getReviewsPage: async (params?: { productId?: string; sellerId?: string; limit?: number; offset?: number }): Promise<{ items: Review[]; hasMore: boolean }> => {
    const limit = Math.min(100, Math.max(1, params?.limit || 50));
    const searchParams = new URLSearchParams({ limit: String(limit), offset: String(Math.max(0, params?.offset || 0)) });
    if (params?.productId) searchParams.set('productId', params.productId);
    if (params?.sellerId) searchParams.set('sellerId', params.sellerId);
    const rows = await fetchJson<Review[]>(`/api/reviews?${searchParams.toString()}`);
    return { items: rows.slice(0, limit), hasMore: rows.length > limit };
  },
  getReviews: async (productId?: string): Promise<Review[]> => {
    const reviews: Review[] = [];
    let offset = 0;
    let hasMore = true;
    while (hasMore) {
      const page = await api.getReviewsPage({ productId, limit: 50, offset });
      reviews.push(...page.items);
      hasMore = page.hasMore;
      offset += page.items.length;
    }
    return reviews;
  },
  createReview: async (data: {
    Product_ID: string;
    Customer_ID: string;
    Customer_Name: string;
    Review_text: string;
    Rating: number;
  }): Promise<Review> =>
    fetchJson<Review>('/api/reviews', {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  // Stats
  getStats: async (): Promise<any> => fetchJson<any>('/api/stats'),

  // ShopNiro AI Chat
  getAIStatus: async (): Promise<{ configured: boolean }> =>
    fetchJson<{ configured: boolean }>('/api/ai/status'),
  generateAIDescription: async (params: {
    kind: 'shop' | 'product';
    shopName: string;
    productName?: string;
    categoryName?: string;
  }): Promise<{ description: string }> =>
    fetchJson<{ description: string }>('/api/ai/description', {
      method: 'POST',
      body: JSON.stringify(params),
    }),
  generateAIProductCopy: async (params: {
    field: 'description' | 'warranty' | 'guarantee' | 'return-policy';
    shopName: string;
    productName: string;
    categoryName?: string;
    productFacts?: string[];
    sourceText: string;
    styleIndex: number;
  }): Promise<{ copy: string }> =>
    fetchJson('/api/ai/product-copy', { method: 'POST', body: JSON.stringify(params) }),
  generateAIReviewDraft: async (params: { productName: string; productDescription: string; sentiment: 'good' | 'bad'; notes?: string }): Promise<{ draft: string }> =>
    fetchJson('/api/ai/review-draft', { method: 'POST', body: JSON.stringify(params) }),
  generateAIRiderReviewDraft: async (params: { riderName: string; rating: number; wasTimely: boolean; notes?: string }): Promise<{ draft: string }> =>
    fetchJson('/api/ai/rider-review-draft', { method: 'POST', body: JSON.stringify(params) }),
  generateDeliveryInstructions: async (params: { products: Array<{ name: string; description: string; quantity: number }>; shippingAddress: Address; preferences?: string }): Promise<{ instruction: string }> =>
    fetchJson('/api/ai/delivery-instructions', { method: 'POST', body: JSON.stringify(params) }),
  generateAISizeChart: async (params: {
    productName: string;
    categoryName?: string;
    gender: 'men' | 'women' | 'unisex';
    imageUrl: string;
  }): Promise<{ sizes: string[]; sizeChart: Array<{ Size: string; Chest_CM?: number | null; Waist_CM?: number | null; Hip_CM?: number | null; Length_CM?: number | null }>; isEstimate: boolean }> =>
    fetchJson('/api/ai/size-chart', { method: 'POST', body: JSON.stringify(params) }),
  sendAIChatMessage: async (params: {
    message: string;
    history?: Array<{ role: 'user' | 'model'; parts: Array<{ text: string }> }>;
    role?: 'shopping-assistant' | 'seller-advisor' | 'order-specialist' | 'complex-analyst';
    requestedModel?: 'flash' | 'flash-lite' | 'pro';
    taskComplexity?: 'fast' | 'general' | 'complex';
  }): Promise<{ reply: string; modelUsed: string; roleUsed: string }> =>
    fetchJson<{ reply: string; modelUsed: string; roleUsed: string }>('/api/ai/chat', {
      method: 'POST',
      body: JSON.stringify(params),
    }),

  // Reset Seed
  resetSeed: async (): Promise<{ success: boolean; message: string }> =>
    fetchJson<{ success: boolean; message: string }>('/api/reset-seed', {
      method: 'POST',
    }),

  // Payment & SSLCommerz Gateway
  getPaymentMethods: async (): Promise<any> => fetchJson<any>('/api/payment/methods'),

  initPayment: async (data: {
    orderId?: string;
    customerId?: string;
    amount: number;
    currency?: string;
    customerName?: string;
    customerEmail?: string;
    customerPhone?: string;
    address?: any;
    paymentMethod?: string;
    productName?: string;
  }): Promise<{
    success: boolean;
    tran_id: string;
    paymentId: string;
    amountBDT: number;
    currency: string;
    session: any;
    gateway: string;
    paymentMethod: string;
  }> =>
    fetchJson('/api/payment/init', {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  validatePayment: async (data: {
    tran_id: string;
    val_id?: string;
    order_id?: string;
    payment_method?: string;
    customer_phone?: string;
    card_brand?: string;
  }): Promise<any> =>
    fetchJson('/api/payment/sslcommerz/validate', {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  getPaymentTransactions: async (params?: { customerId?: string; orderId?: string }): Promise<any[]> => {
    const filters = new URLSearchParams();
    if (params?.customerId) filters.set('customerId', params.customerId);
    if (params?.orderId) filters.set('orderId', params.orderId);
    return fetchAllPages<any>('/api/payment/transactions', filters);
  },
};


export function formatCurrency(amount: number): string {
  return formatBDT(amount);
}

export function formatBDT(amount: number): string {
  return `৳ ${new Intl.NumberFormat('en-BD', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(amount)}`;
}

export function formatDate(dateString?: string): string {
  if (!dateString) return 'N/A';
  return new Date(dateString).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

// ==========================================
// Schema-derived Analytics & Market Intelligence
// ==========================================

export interface TrendingProduct {
  product_id: string;
  product_name: string;
  image?: string;
  category_name: string;
  price: number;
  available_stock: number;
  total_units_sold: number;
}

export interface TopRatedProduct {
  product_id: string;
  product_name: string;
  image?: string;
  category_name: string;
  seller_name: string;
  price: number;
  average_rating: number;
  total_reviews: number;
}

export interface TopRatedSeller {
  seller_id: string;
  seller_name: string;
  logo?: string;
  average_rating: number;
  total_reviews: number;
}

export interface RelatedProduct {
  product_id: string;
  co_purchase_orders: number;
  units_together: number;
}

export async function fetchTrendingProducts(limit: number = 3): Promise<TrendingProduct[]> {
  return fetchJson<TrendingProduct[]>(`/api/analytics/trending-products?limit=${limit}`);
}

export async function fetchTopRatedProducts(limit: number = 12): Promise<TopRatedProduct[]> {
  return fetchJson<TopRatedProduct[]>(`/api/analytics/top-rated-products?limit=${limit}`);
}

export async function fetchTopRatedSellers(limit: number = 3): Promise<TopRatedSeller[]> {
  return fetchJson<TopRatedSeller[]>(`/api/analytics/top-rated-sellers?limit=${limit}`);
}

export async function fetchRelatedProducts(productId: string, limit: number = 3): Promise<RelatedProduct[]> {
  return fetchJson<RelatedProduct[]>(`/api/analytics/related-products?productId=${encodeURIComponent(productId)}&limit=${limit}`);
}

