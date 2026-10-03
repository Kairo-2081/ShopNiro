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
} from '../types';

const TOKEN_KEY = 'marketpulse_jwt_token';
const ANALYTICS_SESSION_KEY = 'shopniro_analytics_session';

function getAnalyticsSessionId(): string {
  if (typeof window === 'undefined') return 'server-render-session';
  let sessionId = window.sessionStorage.getItem(ANALYTICS_SESSION_KEY);
  if (!sessionId) {
    sessionId = window.crypto.randomUUID();
    window.sessionStorage.setItem(ANALYTICS_SESSION_KEY, sessionId);
  }
  return sessionId;
}

export function getAuthToken(): string | null {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem(TOKEN_KEY);
}

export function setAuthToken(token: string): void {
  if (typeof window !== 'undefined') {
    localStorage.setItem(TOKEN_KEY, token);
  }
}

export function removeAuthToken(): void {
  if (typeof window !== 'undefined') {
    localStorage.removeItem(TOKEN_KEY);
  }
}

/**
 * Validates whether an endpoint is public/auth-related or requires authentication.
 */
function isPublicEndpoint(url: string, method: string = 'GET'): boolean {
  const cleanUrl = url.split('?')[0];
  const upperMethod = method.toUpperCase();

  // Auth login, token verification, role selection, db status, and analytics are public
  if (
    cleanUrl === '/api/auth/login' ||
    cleanUrl === '/api/auth/role' ||
    cleanUrl === '/api/auth/me' ||
    cleanUrl === '/api/db/status' ||
    cleanUrl === '/api/maps/reverse' ||
    cleanUrl.startsWith('/api/ai') ||
    cleanUrl === '/api/riders/apply' ||
    cleanUrl === '/api/riders/cv/parse' ||
    cleanUrl === '/api/riders/cv/format' ||
    cleanUrl.startsWith('/api/payment') ||
    cleanUrl.startsWith('/api/analytics') ||
    cleanUrl.startsWith('/api/stats')
  ) {
    return true;
  }
  // User registration is public
  if (
    upperMethod === 'POST' &&
    (cleanUrl === '/api/customers' || cleanUrl === '/api/sellers' || cleanUrl === '/api/admins')
  ) {
    return true;
  }
  // Storefront read catalog endpoints (categories, active products, reviews, sellers)
  if (upperMethod === 'GET') {
    if (cleanUrl === '/api/bundles') return true;
    if (
      cleanUrl.startsWith('/api/categories') ||
      cleanUrl.startsWith('/api/products') ||
      cleanUrl.startsWith('/api/reviews') ||
      cleanUrl.startsWith('/api/sellers')
    ) {
      return true;
    }
  }
  return false;
}

async function fetchJson<T>(url: string, options?: RequestInit): Promise<T> {
  const method = (options?.method || 'GET').toUpperCase();
  const token = getAuthToken();
  const isPublic = isPublicEndpoint(url, method);

  // Validate authentication before processing HTTP requests that require authentication
  if (!isPublic && !token) {
    if (typeof window !== 'undefined') {
      window.dispatchEvent(
        new CustomEvent('auth:required', {
          detail: {
            url,
            message: 'Authentication required. Please sign in before processing this request.',
          },
        })
      );
    }
    throw new Error('Authentication Required: You must be logged in before processing this request.');
  }

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options?.headers as Record<string, string> || {}),
  };

  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const res = await fetch(url, {
    ...options,
    headers,
  });

  if (!res.ok) {
    // If server responds with 401 Unauthorized, automatically invalidate session and alert application
    if (res.status === 401) {
      removeAuthToken();
      if (typeof window !== 'undefined') {
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
  return res.json();
}

// Full-stack API Client connected directly to Cloud SQL (PostgreSQL) with JWT Auth
export const api = {
  // Token methods
  getAuthToken,
  setAuthToken,
  removeAuthToken,

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
  getProducts: async (params?: {
    sellerId?: string;
    categoryId?: string;
    search?: string;
    status?: ProductStatus;
  }): Promise<Product[]> => {
    const searchParams = new URLSearchParams();
    if (params?.sellerId) searchParams.set('sellerId', params.sellerId);
    if (params?.categoryId) searchParams.set('categoryId', params.categoryId);
    if (params?.search) searchParams.set('search', params.search);
    if (params?.status) searchParams.set('status', params.status);
    const queryString = searchParams.toString();
    return fetchJson<Product[]>(`/api/products${queryString ? `?${queryString}` : ''}`);
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
  getCustomers: async (): Promise<Customer[]> => fetchJson<Customer[]>('/api/customers'),
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
  getSellers: async (): Promise<Seller[]> => fetchJson<Seller[]>('/api/sellers'),
  createSeller: async (sellerData: Partial<Seller> & { Password?: string }): Promise<Seller> =>
    fetchJson<Seller>('/api/sellers', {
      method: 'POST',
      body: JSON.stringify(sellerData),
    }),
  updateSellerStatus: async (id: string, status: SellerStatus): Promise<Seller> =>
    fetchJson<Seller>(`/api/sellers/${encodeURIComponent(id)}/status`, {
      method: 'PATCH',
      body: JSON.stringify({ status }),
    }),
  updateSellerProfile: async (updates: Partial<Seller>): Promise<Seller> =>
    fetchJson<Seller>('/api/sellers/me/profile', {
      method: 'PUT',
      body: JSON.stringify(updates),
    }),
  getSellerWallet: async (): Promise<{ balance: number; entries: any[] }> => fetchJson('/api/sellers/me/wallet'),
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
  getBundles: async (): Promise<ProductBundle[]> => fetchJson('/api/bundles'),
  getSellerBundles: async (): Promise<ProductBundle[]> => fetchJson('/api/bundles/seller'),
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
    Experience: string[];
    Previous_Jobs: string[];
    Education: string[];
  }): Promise<{ success: boolean; status: 'pending'; message: string }> =>
    fetchJson('/api/riders/apply', { method: 'POST', body: JSON.stringify(data) }),
  parseRiderCv: async (cvBase64: string): Promise<{ extracted: { experience: string[]; previousJobs: string[]; education: string[] }; missingFields: string[] }> =>
    fetchJson('/api/riders/cv/parse', { method: 'POST', body: JSON.stringify({ cvBase64 }) }),
  formatRiderCv: async (data: { experience: string[]; previousJobs: string[]; education: string[] }): Promise<{ experience: string[]; previousJobs: string[]; education: string[] }> =>
    fetchJson('/api/riders/cv/format', { method: 'POST', body: JSON.stringify(data) }),
  getRiderApplications: async (): Promise<Rider[]> => fetchJson<Rider[]>('/api/riders/applications'),
  setRiderApplicationStatus: async (id: string, status: RiderStatus): Promise<{ Rider_ID: string; Status: RiderStatus }> =>
    fetchJson(`/api/riders/applications/${encodeURIComponent(id)}/status`, {
      method: 'PATCH',
      body: JSON.stringify({ status }),
    }),
  downloadRiderCv: async (id: string): Promise<Blob> => {
    const token = getAuthToken();
    const response = await fetch(`/api/riders/applications/${encodeURIComponent(id)}/cv`, {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    });
    if (!response.ok) throw new Error('Could not download rider CV.');
    return response.blob();
  },
  getRiderProfile: async (): Promise<Rider> => fetchJson<Rider>('/api/riders/me'),
  getMyRiderCv: async (): Promise<Blob> => {
    const token = getAuthToken();
    const response = await fetch('/api/riders/me/cv', {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
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
    fetchJson('/api/riders/customer-deliveries'),
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
  getRiderWithdrawals: async (): Promise<any[]> => fetchJson('/api/riders/wallet/withdrawals'),
  processRiderWithdrawal: async (id: string, status: 'paid' | 'rejected'): Promise<{ success: boolean; status: string }> =>
    fetchJson(`/api/riders/wallet/withdrawals/${encodeURIComponent(id)}`, {
      method: 'PATCH',
      body: JSON.stringify({ status }),
    }),

  // Admins
  getAdmins: async (): Promise<Admin[]> => fetchJson<Admin[]>('/api/admins'),
  createAdmin: async (data: Partial<Admin> & { Username?: string }): Promise<Admin> =>
    fetchJson<Admin>('/api/admins', {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  // Auth Login: Issues JWT session token
  login: async (
    usernameOrEmail: string,
    password: string,
    role?: UserRole
  ): Promise<{ success: boolean; token?: string; role: UserRole; entity: any; message?: string }> => {
    const res = await fetchJson<{ success: boolean; token?: string; role: UserRole; entity: any; message?: string }>('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email: usernameOrEmail, password, role }),
    });

    if (res.token) {
      setAuthToken(res.token);
    }
    return res;
  },

  // Auth Current User from JWT Session
  getMe: async (): Promise<{ authenticated: boolean; user?: any; role?: UserRole; entity?: any }> => {
    return fetchJson<{ authenticated: boolean; user?: any; role?: UserRole; entity?: any }>('/api/auth/me');
  },

  // Validate Authentication for Page Navigation & HTTP Gatekeeping
  validateAuth: async (): Promise<{ authenticated: boolean; user?: any; role?: UserRole; entity?: any }> => {
    const token = getAuthToken();
    if (!token) {
      return { authenticated: false };
    }
    try {
      const res = await fetchJson<{ authenticated: boolean; user?: any; role?: UserRole; entity?: any }>('/api/auth/me');
      return res;
    } catch {
      removeAuthToken();
      return { authenticated: false };
    }
  },

  // Check if currently holding token
  isAuthenticated: (): boolean => {
    return Boolean(getAuthToken());
  },

  // Logout
  logout: (): void => {
    removeAuthToken();
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
  getOrders: async (params?: { customerId?: string; sellerId?: string }): Promise<Order[]> => {
    const searchParams = new URLSearchParams();
    if (params?.customerId) searchParams.set('customerId', params.customerId);
    if (params?.sellerId) searchParams.set('sellerId', params.sellerId);
    const queryString = searchParams.toString();
    return fetchJson<Order[]>(`/api/orders${queryString ? `?${queryString}` : ''}`);
  },
  createOrder: async (orderData: {
    Customer_ID: string;
    Items: any[];
    Shipping_Address: Address;
    Billing_Address: Address;
    Subtotal: number;
    Shipping_Fee: number;
    Additional_Info?: string;
    Payment_Status?: string;
    Payment_Method?: string;
    Transaction_ID?: string;
    Payment_ID?: string;
    Currency?: string;
  }): Promise<Order> =>
    fetchJson<Order>('/api/orders', {
      method: 'POST',
      body: JSON.stringify(orderData),
    }),
  updateOrderStatus: async (orderId: string, Status: OrderStatus | string): Promise<Order> =>
    fetchJson<Order>(`/api/orders/${encodeURIComponent(orderId)}/status`, {
      method: 'PATCH',
      body: JSON.stringify({ status: Status }),
    }),

  // Reviews
  getReviews: async (productId?: string): Promise<Review[]> => {
    const url = productId ? `/api/reviews?productId=${encodeURIComponent(productId)}` : '/api/reviews';
    return fetchJson<Review[]>(url);
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
    const query = new URLSearchParams();
    if (params?.customerId) query.set('customerId', params.customerId);
    if (params?.orderId) query.set('orderId', params.orderId);
    const qs = query.toString() ? `?${query.toString()}` : '';
    return fetchJson<any[]>(`/api/payment/transactions${qs}`);
  },
};

export const db = api;

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

