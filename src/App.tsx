import React from 'react';
import {
  UserRole,
  Customer,
  Seller,
  Admin,
  Category,
  Product,
  Order,
  CartItem,
  Review,
  SellerStatus,
  ProductStatus,
  AppTab,
  Rider,
} from './types';
import { api } from './lib/api';
import { shopNiroLogo } from './lib/branding';
import { MarketplaceClosing, MarketplaceStat } from './components/MarketplaceClosing';
import { Navbar } from './components/Navbar';
import { RoleSwitcher } from './components/RoleSwitcher';
import { AuthenticationGuard } from './components/AuthenticationGuard';
import { ChatFloatingTrigger } from './components/chat/ChatFloatingTrigger';
import { rememberFocusTarget } from './hooks/useFocusTrap';
import { AlertCircle, CheckCircle2, Info, LayoutGrid, Radio, X } from 'lucide-react';

type ToastTone = 'success' | 'error' | 'info';

interface AppToast {
  id: number;
  message: string;
  tone: ToastTone;
}

const LandingPage = React.lazy(() => import('./components/LandingPage').then((module) => ({ default: module.LandingPage })));
const Storefront = React.lazy(() => import('./components/storefront/Storefront').then((module) => ({ default: module.Storefront })));
const MarketplaceTrendsTopCharts = React.lazy(() => import('./components/storefront/MarketplaceTrendsTopCharts').then((module) => ({ default: module.MarketplaceTrendsTopCharts })));
const ProductDetailModal = React.lazy(() => import('./components/storefront/ProductDetailModal').then((module) => ({ default: module.ProductDetailModal })));
const CartDrawer = React.lazy(() => import('./components/storefront/CartDrawer').then((module) => ({ default: module.CartDrawer })));
const CheckoutModal = React.lazy(() => import('./components/storefront/CheckoutModal').then((module) => ({ default: module.CheckoutModal })));
const CustomerOrders = React.lazy(() => import('./components/customer/CustomerOrders').then((module) => ({ default: module.CustomerOrders })));
const CustomerProfile = React.lazy(() => import('./components/customer/CustomerProfile').then((module) => ({ default: module.CustomerProfile })));
const AdminDashboard = React.lazy(() => import('./components/admin/AdminDashboard').then((module) => ({ default: module.AdminDashboard })));
const SellerDashboard = React.lazy(() => import('./components/seller/SellerDashboard').then((module) => ({ default: module.SellerDashboard })));
const LiveProductTrackingMap = React.lazy(() => import('./components/tracking/LiveProductTrackingMap').then((module) => ({ default: module.LiveProductTrackingMap })));
const RiderDashboard = React.lazy(() => import('./components/rider/RiderDashboard').then((module) => ({ default: module.RiderDashboard })));
const SellerSignupModal = React.lazy(() => import('./components/seller/SellerSignupModal').then((module) => ({ default: module.SellerSignupModal })));
const CustomerSignupModal = React.lazy(() => import('./components/customer/CustomerSignupModal').then((module) => ({ default: module.CustomerSignupModal })));
const AdminSignupModal = React.lazy(() => import('./components/admin/AdminSignupModal').then((module) => ({ default: module.AdminSignupModal })));
const LoginModal = React.lazy(() => import('./components/LoginModal').then((module) => ({ default: module.LoginModal })));
const GeminiChatbot = React.lazy(() => import('./components/chat/GeminiChatbot').then((module) => ({ default: module.GeminiChatbot })));
const RiderSignupModal = React.lazy(() => import('./components/rider/RiderSignupModal').then((module) => ({ default: module.RiderSignupModal })));
const STORE_PRODUCT_PAGE_SIZE = 24;

const scrollViewportToTop = () => {
  const options: ScrollToOptions = { top: 0, behavior: 'smooth' };
  if (window.matchMedia('(min-width: 768px)').matches) {
    document.getElementById('root')?.scrollTo(options);
  } else {
    window.scrollTo(options);
  }
};

export default function App() {
  // Navigation & View Mode
  const [viewMode, setViewMode] = React.useState<'landing' | 'app'>('landing');

  // AI Chatbot State
  const [isChatOpen, setIsChatOpen] = React.useState<boolean>(false);
  const [chatInitialQuery, setChatInitialQuery] = React.useState<string | undefined>(undefined);

  // Authentication State
  const [isLoggedIn, setIsLoggedIn] = React.useState<boolean>(false);
  const [currentRole, setCurrentRole] = React.useState<UserRole>('customer');
  const [activeTab, setActiveTab] = React.useState<AppTab>('storefront');

  // Logged-in Entities
  const [selectedCustomer, setSelectedCustomer] = React.useState<Customer | null>(null);
  const [selectedSeller, setSelectedSeller] = React.useState<Seller | null>(null);
  const [selectedAdmin, setSelectedAdmin] = React.useState<Admin | null>(null);
  const [selectedRider, setSelectedRider] = React.useState<Rider | null>(null);

  // Theme State ('dark' | 'light')
  const [theme, setTheme] = React.useState<'dark' | 'light'>(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('marketpulse_theme');
      if (saved === 'light' || saved === 'dark') return saved;
    }
    return 'dark';
  });

  React.useEffect(() => {
    const root = document.documentElement;
    if (theme === 'dark') {
      root.classList.add('dark');
    } else {
      root.classList.remove('dark');
    }
    localStorage.setItem('marketpulse_theme', theme);
  }, [theme]);

  const toggleTheme = React.useCallback(() => {
    setTheme((prev) => (prev === 'dark' ? 'light' : 'dark'));
  }, []);

  // Core Entity States (Directly from Raw SQL Database)
  const [categories, setCategories] = React.useState<Category[]>([]);
  const [sellers, setSellers] = React.useState<Seller[]>([]);
  const [products, setProducts] = React.useState<Product[]>([]);
  const [customers, setCustomers] = React.useState<Customer[]>([]);
  const [cart, setCart] = React.useState<CartItem[]>([]);
  const [orders, setOrders] = React.useState<Order[]>([]);
  const [reviews, setReviews] = React.useState<Review[]>([]);
  const [admins, setAdmins] = React.useState<Admin[]>([]);
  const [isInitialDataLoading, setIsInitialDataLoading] = React.useState(true);
  const [hasMoreStoreProducts, setHasMoreStoreProducts] = React.useState(false);
  const [isLoadingMoreStoreProducts, setIsLoadingMoreStoreProducts] = React.useState(false);
  const [isCartLoading, setIsCartLoading] = React.useState(false);
  const [wishlistProductIds, setWishlistProductIds] = React.useState<string[]>([]);
  const [toastMessages, setToastMessages] = React.useState<AppToast[]>([]);
  const toastSequence = React.useRef(0);
  const catalogSearchSequence = React.useRef(0);

  const showToast = (message: string, tone: ToastTone = 'error') => {
    const id = ++toastSequence.current;
    setToastMessages((current) => [...current, { id, message, tone }]);
    window.setTimeout(() => {
      setToastMessages((current) => current.filter((toast) => toast.id !== id));
    }, 4200);
  };

  // UI Modals
  const [isCartOpen, setIsCartOpen] = React.useState(false);
  const [isCheckoutOpen, setIsCheckoutOpen] = React.useState(false);
  const [selectedProductForDetail, setSelectedProductForDetail] = React.useState<Product | null>(null);
  const [isCustomerRegistrationOpen, setIsCustomerRegistrationOpen] = React.useState(false);
  const [isSellerRegistrationOpen, setIsSellerRegistrationOpen] = React.useState(false);
  const [isAdminRegistrationOpen, setIsAdminRegistrationOpen] = React.useState(false);
  const [isRiderSignupOpen, setIsRiderSignupOpen] = React.useState(false);
  const [isLoginModalOpen, setIsLoginModalOpen] = React.useState(false);
  const [authNotice, setAuthNotice] = React.useState<string | null>(null);
  const [isValidatingAuth, setIsValidatingAuth] = React.useState<boolean>(false);

  // Authenticate and validate on every page before processing page requests
  const validateAuthForPage = React.useCallback(async (targetTab: string) => {
    setIsValidatingAuth(true);
    try {
      const auth = await api.validateAuth();
      if (auth.authenticated && auth.role && auth.entity) {
        setIsLoggedIn(true);
        setCurrentRole(auth.role);

        if (viewMode !== 'landing') {
          setViewMode('app');
        }

        if (auth.role === 'customer') {
          setSelectedCustomer(auth.entity as Customer);
          setSelectedSeller(null);
          setSelectedAdmin(null);
        } else if (auth.role === 'seller') {
          setSelectedSeller(auth.entity as Seller);
          setSelectedCustomer(null);
          setSelectedAdmin(null);
        } else if (auth.role === 'admin') {
          setSelectedAdmin(auth.entity as Admin);
          setSelectedCustomer(null);
          setSelectedSeller(null);
        } else if (auth.role === 'rider') {
          setSelectedRider(auth.entity as Rider);
          setSelectedCustomer(null);
          setSelectedSeller(null);
          setSelectedAdmin(null);
        }
        setAuthNotice(null);
        return true;
      } else {
        // Not authenticated
        setIsLoggedIn(false);
        setSelectedCustomer(null);
        setSelectedSeller(null);
        setSelectedAdmin(null);
        setSelectedRider(null);
        if (viewMode !== 'landing' && targetTab !== 'storefront') {
          const tabLabel = targetTab.replace('-', ' ');
          setAuthNotice(`Authentication Required: You must be authenticated before processing HTTP requests on the ${tabLabel} page.`);
          setIsLoginModalOpen(true);
        }
        return false;
      }
    } catch {
      setIsLoggedIn(false);
      return false;
    } finally {
      setIsValidatingAuth(false);
    }
  }, [viewMode]);

  // Listen for global authentication requirement/unauthorized events
  React.useEffect(() => {
    const handleAuthRequired = (e: any) => {
      setIsLoggedIn(false);
      setAuthNotice(e.detail?.message || 'Authentication required before processing this HTTP request.');
      setIsLoginModalOpen(true);
    };

    const handleAuthUnauthorized = (e: any) => {
      setIsLoggedIn(false);
      setSelectedCustomer(null);
      setSelectedSeller(null);
      setSelectedAdmin(null);
      setSelectedRider(null);
      setAuthNotice('Your session has expired or is invalid. Please sign in again.');
      setIsLoginModalOpen(true);
    };

    window.addEventListener('auth:required', handleAuthRequired);
    window.addEventListener('auth:unauthorized', handleAuthUnauthorized);

    return () => {
      window.removeEventListener('auth:required', handleAuthRequired);
      window.removeEventListener('auth:unauthorized', handleAuthUnauthorized);
    };
  }, []);

  React.useEffect(() => {
    const rememberOutsideFocus = (event: Event) => {
      if (!(event.target instanceof Element) || event.target.closest('[role="dialog"]')) return;
      const focusTarget = event.target.closest<HTMLElement>(
        'button, a[href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
      );
      if (focusTarget) rememberFocusTarget(focusTarget);
    };

    document.addEventListener('focusin', rememberOutsideFocus, true);
    document.addEventListener('pointerdown', rememberOutsideFocus, true);
    document.addEventListener('click', rememberOutsideFocus, true);
    return () => {
      document.removeEventListener('focusin', rememberOutsideFocus, true);
      document.removeEventListener('pointerdown', rememberOutsideFocus, true);
      document.removeEventListener('click', rememberOutsideFocus, true);
    };
  }, []);

  // Check authentication on every page change before processing HTTP requests
  React.useEffect(() => {
    validateAuthForPage(activeTab);
  }, [activeTab, viewMode, validateAuthForPage]);

  // Load public storefront data and conditionally load role-authenticated resources
  const loadInitialData = React.useCallback(async () => {
    setIsInitialDataLoading(true);
    try {
      // Public storefront data (categories, products, reviews, approved sellers)
      const [cats, sels, productPage, revs] = await Promise.all([
        api.getCategories().catch((err) => {
          console.error('Error fetching categories:', err);
          return [];
        }),
        api.getSellers().catch((err) => {
          console.error('Error fetching sellers:', err);
          return [];
        }),
        api.getProductsPage({ limit: STORE_PRODUCT_PAGE_SIZE, offset: 0 }).catch((err) => {
          console.error('Error fetching products:', err);
          return { items: [], hasMore: false };
        }),
        api.getReviews().catch((err) => {
          console.error('Error fetching reviews:', err);
          return [];
        }),
      ]);

      if (cats && cats.length > 0) setCategories(cats);
      if (sels && sels.length > 0) setSellers(sels);
      setProducts(productPage.items);
      setHasMoreStoreProducts(productPage.hasMore);
      if (revs && revs.length > 0) setReviews(revs);

      // Verify authentication before attempting to query protected user endpoints
      const auth = await api.validateAuth();
      if (auth.authenticated && auth.role && auth.entity) {
        setIsLoggedIn(true);
        setCurrentRole(auth.role);
        setViewMode('app');
        setActiveTab(auth.role === 'admin' ? 'admin-dashboard' : auth.role === 'seller' ? 'seller-dashboard' : auth.role === 'rider' ? 'rider-dashboard' : 'storefront');

        if (auth.role === 'admin' || auth.role === 'seller') {
          const allProducts = await api.getProducts();
          setProducts(allProducts);
          setHasMoreStoreProducts(false);
        }

        if (auth.role === 'admin') {
          setSelectedAdmin(auth.entity as Admin);
          try {
            const [custs, ords, fetchedAdmins] = await Promise.all([
              api.getCustomers().catch(() => []),
              api.getOrders().catch(() => []),
              api.getAdmins().catch(() => []),
            ]);
            setCustomers(custs);
            setOrders(ords);
            setAdmins(fetchedAdmins);
          } catch (err) {
            console.error('Error fetching admin datasets:', err);
          }
        } else if (auth.role === 'customer') {
          setSelectedCustomer(auth.entity as Customer);
          try {
            const [custOrders, cartItems] = await Promise.all([
              api.getOrders({ customerId: (auth.entity as Customer).Customer_ID }).catch(() => []),
              api.getCart((auth.entity as Customer).Customer_ID).catch(() => []),
            ]);
            setOrders(custOrders);
            setCart(cartItems);
          } catch (err) {
            console.error('Error fetching customer cart/orders:', err);
          }
        } else if (auth.role === 'seller') {
          setSelectedSeller(auth.entity as Seller);
          try {
            const sellerOrders = await api.getOrders({ sellerId: (auth.entity as Seller).Seller_ID }).catch(() => []);
            setOrders(sellerOrders);
          } catch (err) {
            console.error('Error fetching seller orders:', err);
          }
        } else if (auth.role === 'rider') {
          setSelectedRider(auth.entity as Rider);
        }
      } else {
        setIsLoggedIn(false);
        setOrders([]);
        setCart([]);
        setCustomers([]);
        setAdmins([]);
      }
    } catch (err) {
      console.error('Failed to load initial data:', err);
    } finally {
      setIsInitialDataLoading(false);
    }
  }, []);

  const loadMoreStoreProducts = async () => {
    if (isLoadingMoreStoreProducts || !hasMoreStoreProducts) return;
    setIsLoadingMoreStoreProducts(true);
    try {
      const page = await api.getProductsPage({ limit: STORE_PRODUCT_PAGE_SIZE, offset: products.length });
      setProducts((current) => {
        const knownIds = new Set(current.map((product) => product.Product_ID));
        return [...current, ...page.items.filter((product) => !knownIds.has(product.Product_ID))];
      });
      setHasMoreStoreProducts(page.hasMore);
    } catch (error: any) {
      showToast(error.message || 'Could not load more products.', 'error');
    } finally {
      setIsLoadingMoreStoreProducts(false);
    }
  };

  const searchStoreProducts = React.useCallback(async (search: string) => {
    const sequence = ++catalogSearchSequence.current;
    try {
      if (search) {
        const results = await api.getProducts({ search });
        if (sequence !== catalogSearchSequence.current) return;
        setProducts(results);
        setHasMoreStoreProducts(false);
      } else {
        const page = await api.getProductsPage({ limit: STORE_PRODUCT_PAGE_SIZE, offset: 0 });
        if (sequence !== catalogSearchSequence.current) return;
        setProducts(page.items);
        setHasMoreStoreProducts(page.hasMore);
      }
    } catch (error: any) {
      showToast(error.message || 'Could not search products.', 'error');
    }
  }, []);

  React.useEffect(() => {
    loadInitialData();
  }, [loadInitialData]);

  // Load customer cart when selectedCustomer changes and is authenticated
  React.useEffect(() => {
    if (selectedCustomer && isLoggedIn) {
      let isMounted = true;
      setIsCartLoading(true);
      api
        .getCart(selectedCustomer.Customer_ID)
        .then((items) => { if (isMounted) setCart(items); })
        .catch((err) => console.error('Error fetching cart:', err))
        .finally(() => { if (isMounted) setIsCartLoading(false); });
      return () => { isMounted = false; };
    } else {
      setCart([]);
      setIsCartLoading(false);
    }
  }, [selectedCustomer, isLoggedIn]);

  React.useEffect(() => {
    if (!selectedCustomer || !isLoggedIn) {
      setWishlistProductIds([]);
      return;
    }
    let isMounted = true;
    api.getWishlist().then((ids) => { if (isMounted) setWishlistProductIds(ids); }).catch(() => {});
    return () => { isMounted = false; };
  }, [selectedCustomer, isLoggedIn]);

  const handleToggleWishlist = async (product: Product) => {
    if (!selectedCustomer || !isLoggedIn) {
      setIsLoginModalOpen(true);
      return;
    }
    const isSaved = wishlistProductIds.includes(product.Product_ID);
    try {
      if (isSaved) await api.removeFromWishlist(product.Product_ID);
      else await api.addToWishlist(product.Product_ID);
      setWishlistProductIds((current) => isSaved
        ? current.filter((id) => id !== product.Product_ID)
        : [...current, product.Product_ID]);
      showToast(isSaved ? 'Removed from your wishlist.' : 'Saved to your wishlist.', 'success');
    } catch (error: any) {
      showToast(error.message || 'Could not update your wishlist.', 'error');
    }
  };

  // Handle Login: by Username & Password simply!
  const handleLoginSuccess = async (role: UserRole, entity: any) => {
    setIsLoggedIn(true);
    setCurrentRole(role);
    setAuthNotice(null);

    // Refresh public catalog and authenticated user dataset
    await loadInitialData();

    if (role === 'customer') {
      setSelectedCustomer(entity as Customer);
      setSelectedSeller(null);
      setSelectedAdmin(null);
      setActiveTab('storefront');
      try {
        const [userCart, userOrders] = await Promise.all([
          api.getCart(entity.Customer_ID).catch(() => []),
          api.getOrders({ customerId: entity.Customer_ID }).catch(() => []),
        ]);
        setCart(userCart);
        setOrders(userOrders);
      } catch (err) {
        console.error('Error loading customer data on login:', err);
      }
    } else if (role === 'seller') {
      setSelectedSeller(entity as Seller);
      setSelectedCustomer(null);
      setSelectedAdmin(null);
      setActiveTab('seller-dashboard');
      try {
        const sellerOrders = await api.getOrders({ sellerId: entity.Seller_ID }).catch(() => []);
        setOrders(sellerOrders);
      } catch (err) {
        console.error('Error loading seller data on login:', err);
      }
    } else if (role === 'admin') {
      setSelectedAdmin(entity as Admin);
      setSelectedCustomer(null);
      setSelectedSeller(null);
      setActiveTab('admin-dashboard');
      try {
        const [custs, ords, fetchedAdmins] = await Promise.all([
          api.getCustomers().catch(() => []),
          api.getOrders().catch(() => []),
          api.getAdmins().catch(() => []),
        ]);
        setCustomers(custs);
        setOrders(ords);
        setAdmins(fetchedAdmins);
      } catch (err) {
        console.error('Error loading admin data on login:', err);
      }
    } else if (role === 'rider') {
      setSelectedRider(entity as Rider);
      setSelectedCustomer(null);
      setSelectedSeller(null);
      setSelectedAdmin(null);
      setActiveTab('rider-dashboard');
    }

    setViewMode('app');
  };

  // Handle Log Out: Cleanly resets authentication state & JWT token
  const handleLogout = () => {
    api.logout();
    setIsLoggedIn(false);
    setViewMode('landing');
    setSelectedCustomer(null);
    setSelectedSeller(null);
    setSelectedAdmin(null);
    setSelectedRider(null);
    setCurrentRole('customer');
    setActiveTab('storefront');
    setCart([]);
    setOrders([]);
    setCustomers([]);
    setAdmins([]);
    setAuthNotice(null);
  };

  // Cart operations
  const handleAddToCart = async (product: Product, quantity: number = 1, size?: string) => {
    if (!isLoggedIn || !selectedCustomer) {
      setIsLoginModalOpen(true);
      return;
    }
    try {
      await api.addToCart(selectedCustomer.Customer_ID, product.Product_ID, quantity, size);
      const updatedCart = await api.getCart(selectedCustomer.Customer_ID);
      setCart(updatedCart);
      setIsCartOpen(true);
    } catch (err: any) {
      showToast(err.message || 'Failed to add item to cart', 'error');
    }
  };

  const handleBuyNow = async (product: Product, quantity: number, size?: string) => {
    if (!isLoggedIn || !selectedCustomer) {
      setIsLoginModalOpen(true);
      return;
    }
    try {
      await api.addToCart(selectedCustomer.Customer_ID, product.Product_ID, quantity, size);
      const updatedCart = await api.getCart(selectedCustomer.Customer_ID);
      setCart(updatedCart);
      setIsCartOpen(false);
      setSelectedProductForDetail(null);
      setIsCheckoutOpen(true);
    } catch (err: any) {
      showToast(err.message || 'Could not start checkout', 'error');
    }
  };

  const handleUpdateCartQuantity = async (cartId: string, quantity: number) => {
    if (!selectedCustomer) return;
    try {
      if (quantity <= 0) {
        await api.removeFromCart(cartId);
      } else {
        await api.updateCartQuantity(cartId, quantity);
      }
      const updatedCart = await api.getCart(selectedCustomer.Customer_ID);
      setCart(updatedCart);
    } catch (err: any) {
      console.error('Cart quantity update error:', err);
      showToast(err.message || 'Could not update cart quantity.', 'error');
    }
  };

  const handleRemoveFromCart = async (cartId: string) => {
    if (!selectedCustomer) return;
    try {
      await api.removeFromCart(cartId);
      const updatedCart = await api.getCart(selectedCustomer.Customer_ID);
      setCart(updatedCart);
    } catch (err: any) {
      console.error('Remove from cart error:', err);
      showToast(err.message || 'Could not remove this item from the cart.', 'error');
    }
  };

  // Order Placement
  const handlePlaceOrder = async (orderData: any) => {
    if (!selectedCustomer) {
      setIsLoginModalOpen(true);
      throw new Error('Please sign in to place order');
    }
    const newOrder = await api.createOrder(orderData);
    setOrders((prev) => [newOrder, ...prev]);
    const [updatedCart, updatedProds] = await Promise.all([
      api.getCart(selectedCustomer.Customer_ID),
      api.getProducts(),
    ]);
    setCart(updatedCart);
    setProducts(updatedProds);
    return newOrder;
  };

  // Review Submission
  const handleSubmitReview = async (productId: string, rating: number, reviewText: string) => {
    if (!isLoggedIn || !selectedCustomer) {
      setIsLoginModalOpen(true);
      return;
    }
    const newRev = await api.createReview({
      Product_ID: productId,
      Customer_ID: selectedCustomer.Customer_ID,
      Customer_Name: selectedCustomer.Name,
      Review_text: reviewText,
      Rating: rating,
    });
    setReviews((prev) => [newRev, ...prev]);
  };

  // Customer Profile update
  const handleUpdateCustomer = async (updated: Customer) => {
    try {
      const refreshed = await api.updateCustomer(updated.Customer_ID, updated);
      setSelectedCustomer(refreshed);
      setCustomers((prev) => prev.map((c) => (c.Customer_ID === refreshed.Customer_ID ? refreshed : c)));
      setOrders((prev) => prev.map((order) => {
        if (order.Customer_ID !== refreshed.Customer_ID || !['placed', 'processing'].includes(order.Status)) {
          return order;
        }

        const mergedShipping = {
          ...order.Shipping_Address,
          House_Name: refreshed.Address?.House_Name ?? order.Shipping_Address?.House_Name ?? '',
          Street: refreshed.Address?.Street ?? order.Shipping_Address?.Street ?? '',
          City: refreshed.Address?.City ?? order.Shipping_Address?.City ?? '',
          Postal_Code: refreshed.Address?.Postal_Code ?? order.Shipping_Address?.Postal_Code ?? '',
          Additional_Info: refreshed.Address?.Additional_Info ?? order.Shipping_Address?.Additional_Info ?? '',
          Latitude: refreshed.Address?.Latitude ?? order.Shipping_Address?.Latitude,
          Longitude: refreshed.Address?.Longitude ?? order.Shipping_Address?.Longitude,
        };

        const mergedBilling = !order.Billing_Address || !order.Billing_Address.Street || order.Billing_Address.Street === order.Shipping_Address?.Street
          ? { ...order.Billing_Address, ...mergedShipping }
          : order.Billing_Address;

        return {
          ...order,
          Shipping_Address: mergedShipping,
          Billing_Address: mergedBilling,
        };
      }));
    } catch (err: any) {
      showToast(err.message || 'Failed to update profile', 'error');
    }
  };

  const handleUpdateSellerProfile = async (updates: Partial<Seller>): Promise<Seller> => {
    const updated = await api.updateSellerProfile(updates);
    setSelectedSeller(updated);
    setSellers((prev) => prev.map((seller) => seller.Seller_ID === updated.Seller_ID ? updated : seller));
    return updated;
  };

  // Product CRUD (Seller)
  const handleSaveProduct = async (data: Partial<Product>) => {
    if (data.Product_ID) {
      await api.updateProduct(data.Product_ID, data);
      const updatedList = await api.getProducts();
      setProducts(updatedList);
    } else {
      const created = await api.createProduct(data);
      setProducts((prev) => [created, ...prev]);
    }
  };

  const handleDeleteProduct = async (productId: string) => {
    await api.deleteProduct(productId);
    setProducts((prev) => prev.filter((p) => p.Product_ID !== productId));
  };

  const handleUpdateProductStatus = async (productId: string, status: ProductStatus) => {
    await api.updateProductStatus(productId, status);
    const updatedList = await api.getProducts();
    setProducts(updatedList);
  };

  // Order Status update (Seller)
  const handleUpdateOrderStatus = async (orderId: string, status: string) => {
    await api.updateOrderStatus(orderId, status);
    const updatedOrders = await api.getOrders();
    setOrders(updatedOrders);
  };

  // Admin Seller Governance
  const handleUpdateSellerStatus = async (sellerId: string, status: SellerStatus) => {
    await api.updateSellerStatus(sellerId, status);
    const updatedSellers = await api.getSellers();
    setSellers(updatedSellers);
    if (selectedSeller && selectedSeller.Seller_ID === sellerId) {
      const refreshedSeller = updatedSellers.find((s) => s.Seller_ID === sellerId);
      if (refreshedSeller) setSelectedSeller(refreshedSeller);
    }
  };

  // Category CRUD (Admin)
  const handleCreateCategory = async (name: string) => {
    const created = await api.createCategory(name);
    setCategories((prev) => [...prev, created]);
  };

  const handleUpdateCategory = async (id: string, name: string) => {
    const updated = await api.updateCategory(id, name);
    setCategories((prev) => prev.map((c) => (c.Category_ID === updated.Category_ID ? updated : c)));
  };

  const handleDeleteCategory = async (id: string) => {
    await api.deleteCategory(id);
    setCategories((prev) => prev.filter((c) => c.Category_ID !== id));
  };

  const handleAccountCreated = () => {
    setAuthNotice('Account created successfully. Sign in with your new credentials.');
    setIsLoginModalOpen(true);
  };

  // New Customer Registration
  const handleRegisterCustomer = async (customerData: Partial<Customer> & { Username?: string }): Promise<Customer> => {
    return api.createCustomer(customerData);
  };

  // New Seller Registration
  const handleRegisterSeller = async (sellerData: Partial<Seller> & { Username?: string }): Promise<Seller> => {
    return api.createSeller(sellerData);
  };

  // New Admin Registration
  const handleRegisterAdmin = async (adminData: Partial<Admin> & { Username?: string }): Promise<Admin> => {
    return api.createAdmin(adminData);
  };

  // Get active user entity
  const currentUserEntity =
    currentRole === 'customer'
      ? selectedCustomer
      : currentRole === 'seller'
      ? selectedSeller
      : currentRole === 'admin'
      ? selectedAdmin
      : selectedRider;

  const marketplaceStats: MarketplaceStat[] = [
    {
      label: 'Live listings',
      value: products.filter((product) => product.Product_Status?.toLowerCase() !== 'deactivated').length,
    },
    { label: 'Categories', value: categories.length },
    {
      label: 'Approved sellers',
      value: sellers.filter((seller) => !seller.Status || seller.Status.toLowerCase() === 'approved').length,
    },
  ];

  const defaultAdmin = selectedAdmin || (admins.length > 0 ? admins[0] : {
    Admin_ID: 'ADM-1',
    Name: 'Sarah Jenkins (Admin)',
    Email: 'admin@marketplace.com',
    Number: '+1 (800) 555-0199',
    Address: {
      House_Name: 'HQ Tower Floor 15',
      Street: '1 Marketplace Way',
      City: 'San Jose',
      Postal_Code: '95113',
    },
  });

  // Render Landing Page
  if (viewMode === 'landing') {
    return (
      <React.Suspense fallback={<div className="flex min-h-screen items-center justify-center text-sm text-slate-500 dark:text-zinc-400">Loading ShopNiro...</div>}>
      <>
        <LandingPage
          customers={customers}
          sellers={sellers}
          stats={marketplaceStats}
          admin={defaultAdmin}
          admins={admins}
          dbStatus={{ connected: true, provider: 'Raw SQL Database Engine', database: 'marketpulse_db' }}
          onOpenLogin={() => setIsLoginModalOpen(true)}
          onEnterAsGuest={() => {
            setViewMode('app');
            setActiveTab('storefront');
          }}
          onOpenCustomerSignup={() => setIsCustomerRegistrationOpen(true)}
          onOpenSellerSignup={() => setIsSellerRegistrationOpen(true)}
          onOpenRiderSignup={() => setIsRiderSignupOpen(true)}
          onOpenAdminSignup={() => setIsAdminRegistrationOpen(true)}
          theme={theme}
          onToggleTheme={toggleTheme}
        />

        {isCustomerRegistrationOpen && (
          <CustomerSignupModal
            isOpen={isCustomerRegistrationOpen}
            onClose={() => setIsCustomerRegistrationOpen(false)}
            onRegisterCustomer={handleRegisterCustomer}
            onSuccessRegistered={handleAccountCreated}
          />
        )}

        {isSellerRegistrationOpen && (
          <SellerSignupModal
            isOpen={isSellerRegistrationOpen}
            onClose={() => setIsSellerRegistrationOpen(false)}
            onRegisterSeller={handleRegisterSeller}
            onSuccessRegistered={handleAccountCreated}
          />
        )}

        {isAdminRegistrationOpen && (
          <AdminSignupModal
            isOpen={isAdminRegistrationOpen}
            onClose={() => setIsAdminRegistrationOpen(false)}
            onRegisterAdmin={handleRegisterAdmin}
            onSuccessRegistered={handleAccountCreated}
          />
        )}

        {isRiderSignupOpen && (
          <RiderSignupModal
            isOpen={isRiderSignupOpen}
            onClose={() => setIsRiderSignupOpen(false)}
            onOpenLogin={() => setIsLoginModalOpen(true)}
            onSubmitted={(message) => { setAuthNotice(message); setIsLoginModalOpen(true); }}
          />
        )}

        {isLoginModalOpen && (
          <LoginModal
            isOpen={isLoginModalOpen}
            onClose={() => {
              setIsLoginModalOpen(false);
              setAuthNotice(null);
            }}
            onLoginSuccess={handleLoginSuccess}
            noticeMessage={authNotice}
          />
        )}
      </>
      </React.Suspense>
    );
  }

  return (
    <div className="min-h-screen overflow-x-hidden bg-transparent text-slate-900 dark:text-zinc-100 font-sans flex flex-col antialiased transition-colors duration-200 app-shell">
      <div className="fixed right-4 top-20 z-[70] flex w-[min(24rem,calc(100vw-2rem))] flex-col gap-2 sm:right-6" aria-live="polite">
        {toastMessages.map((toast) => {
          const toneClass = toast.tone === 'error'
            ? 'border-rose-500/25 bg-rose-500/10 text-rose-700 dark:text-rose-300'
            : toast.tone === 'success'
              ? 'border-emerald-500/25 bg-emerald-500/10 text-emerald-800 dark:text-emerald-300'
              : 'border-amber-500/25 bg-amber-500/10 text-amber-800 dark:text-amber-200';
          const Icon = toast.tone === 'error' ? AlertCircle : toast.tone === 'success' ? CheckCircle2 : Info;
          return (
            <div key={toast.id} role={toast.tone === 'error' ? 'alert' : 'status'} className={`premium-card flex items-start gap-3 rounded-xl border p-3.5 text-xs font-semibold shadow-xl backdrop-blur-md animate-in fade-in slide-in-from-top-2 duration-200 ${toneClass}`}>
              <Icon className="mt-0.5 h-4 w-4 shrink-0" />
              <span className="min-w-0 flex-1">{toast.message}</span>
              <button type="button" onClick={() => setToastMessages((current) => current.filter((item) => item.id !== toast.id))} aria-label="Dismiss notification" className="rounded-full p-1 opacity-70 transition-opacity hover:opacity-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#d0c8a5]">
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
          );
        })}
      </div>
      {/* Top Bar with Landing option */}
      <div className="bg-[#171713]/80 dark:bg-[#10100f]/75 border-b border-[#d0c8a5]/15 dark:border-white/10 px-3 py-1.5 flex items-center justify-between text-xs text-slate-700 dark:text-zinc-300 backdrop-blur-xl shadow-[0_10px_30px_rgba(7,7,5,0.25)] animate-fade-up sm:px-4">
        <button
          onClick={() => setViewMode('landing')}
          className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-slate-100 hover:bg-slate-200 dark:bg-[#161C24] dark:hover:bg-[#1E2633] text-blue-600 dark:text-sky-400 font-semibold border border-sky-100 dark:border-zinc-800 transition-colors cursor-pointer shadow-2xs"
        >
          <LayoutGrid className="w-3.5 h-3.5" />
          <span>Home / Marketplace Landing</span>
        </button>

      </div>

      {/* Role Switcher Bar - Notice: In-profile switching is REMOVED when logged in! */}
      <RoleSwitcher
        isLoggedIn={isLoggedIn}
        currentRole={currentRole}
        currentUserEntity={currentUserEntity}
        onOpenCustomerSignup={() => setIsCustomerRegistrationOpen(true)}
        onOpenSellerSignup={() => setIsSellerRegistrationOpen(true)}
        onOpenAdminSignup={() => setIsAdminRegistrationOpen(true)}
        onOpenRiderSignup={() => setIsRiderSignupOpen(true)}
        onOpenLogin={() => setIsLoginModalOpen(true)}
        onLogout={handleLogout}
      />

      {/* Main Header & Navbar */}
      <Navbar
        isLoggedIn={isLoggedIn}
        currentRole={currentRole}
        currentCustomer={selectedCustomer}
        currentSeller={selectedSeller}
        admin={selectedAdmin}
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        cartCount={cart.reduce((sum, item) => sum + item.Quantity, 0)}
        onOpenCart={() => {
          if (!isLoggedIn || !selectedCustomer) {
            setIsLoginModalOpen(true);
          } else {
            setIsCartOpen(true);
          }
        }}
        onOpenLogin={() => setIsLoginModalOpen(true)}
        onLogout={handleLogout}
        theme={theme}
        onToggleTheme={toggleTheme}
        onOpenChat={() => setIsChatOpen(true)}
      />

      {/* Main Content Area */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-3 pt-4 pb-16 app-panel animate-fade-up sm:px-6 lg:px-8 lg:pt-6">
        <React.Suspense fallback={<div className="flex min-h-[40vh] items-center justify-center text-sm text-slate-500 dark:text-zinc-400">Loading marketplace...</div>}>
        {/* Authentication Notice Banner if set */}
        {authNotice && !isLoginModalOpen && (
          <div className="mb-6 p-4 rounded-2xl bg-amber-500/10 border border-amber-500/30 text-amber-700 dark:text-amber-300 text-xs flex items-center justify-between gap-3 shadow-xs">
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-amber-500 animate-ping"></span>
              <strong>Security Protocol:</strong> {authNotice}
            </div>
            <button
              onClick={() => setIsLoginModalOpen(true)}
              className="px-3 py-1 bg-amber-600 hover:bg-amber-500 text-white font-bold rounded-lg shadow-xs cursor-pointer shrink-0"
            >
              Sign In Now
            </button>
          </div>
        )}

        {/* Storefront Tab */}
        {activeTab === 'storefront' && (
          <Storefront
            products={products}
            categories={categories}
            sellers={sellers}
            reviews={reviews}
            isLoading={isInitialDataLoading}
            hasMoreProducts={hasMoreStoreProducts}
            isLoadingMoreProducts={isLoadingMoreStoreProducts}
            onLoadMoreProducts={() => void loadMoreStoreProducts()}
            onSearchProducts={searchStoreProducts}
            wishlistProductIds={wishlistProductIds}
            onToggleWishlist={(product) => void handleToggleWishlist(product)}
            onSelectProduct={(p) => setSelectedProductForDetail(p)}
            onAddToCart={handleAddToCart}
          />
        )}

        {/* Marketplace Top Charts & Trends Tab */}
        {activeTab === 'charts' && (
          <div className="space-y-6 animate-in fade-in-50 duration-200">
            <MarketplaceTrendsTopCharts
              onSelectProduct={(p) => setSelectedProductForDetail(p)}
              onAddToCart={handleAddToCart}
              allProducts={products}
            />
          </div>
        )}

        {/* Customer Orders Tab - Authenticated Guard */}
        {activeTab === 'orders' && (
          isLoggedIn && selectedCustomer ? (
            <CustomerOrders
              currentCustomer={selectedCustomer}
              orders={orders}
              sellers={sellers}
              allProducts={products}
              onSelectProduct={(p) => setSelectedProductForDetail(p)}
              onAddToCart={handleAddToCart}
              onRefreshOrders={async () => setOrders(await api.getOrders({ customerId: selectedCustomer.Customer_ID }))}
            />
          ) : (
            <AuthenticationGuard
              pageName="Customer Orders"
              requiredRole="Customer"
              onOpenLogin={() => {
                setAuthNotice('Please sign in as a Customer to view and manage your orders.');
                setIsLoginModalOpen(true);
              }}
              onBackToStorefront={() => setActiveTab('storefront')}
            />
          )
        )}

        {/* OpenStreetMap delivery tracking tab */}
        {activeTab === 'live-tracking' && (
          <div className="space-y-6 animate-in fade-in-50 duration-200">
            <div className="flex flex-wrap items-center justify-between gap-4 bg-white dark:bg-[#12161D] p-6 rounded-3xl border border-sky-100 dark:border-zinc-800 shadow-xl">
              <div>
                <div className="inline-flex items-center gap-1.5 px-3 py-0.5 rounded-full bg-sky-950/80 text-sky-400 text-[10px] font-bold tracking-wider uppercase border border-sky-800/40 mb-2">
                  <Radio className="w-3 h-3 animate-pulse" />
                  <span>REAL-TIME SATELLITE &amp; ROADWAY GPS TELEMETRY</span>
                </div>
                <h1 className="text-2xl font-black text-slate-900 dark:text-white flex items-center gap-2">
                  Live Delivery Tracking
                </h1>
                <p className="text-xs text-slate-500 dark:text-zinc-400 mt-1">
                  Interactive telemetry tracking showing dispatch warehouses, in-flight parcel couriers, and product shipment coordinates.
                </p>
              </div>

              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={() => setActiveTab('storefront')}
                  className="px-4 py-2 rounded-full border border-slate-300 dark:border-zinc-700 text-xs font-semibold text-slate-700 dark:text-zinc-300 hover:bg-slate-100 dark:hover:bg-zinc-800 transition-colors cursor-pointer"
                >
                  Browse Storefront
                </button>
                <button
                  type="button"
                  onClick={() => setActiveTab('orders')}
                  className="px-4 py-2 rounded-full bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold shadow-md shadow-blue-600/30 transition-all cursor-pointer"
                >
                  My Orders History
                </button>
              </div>
            </div>

            {orders.some((order) => order.Status === 'shipped'
              && (order.Fulfillments || []).some((fulfillment) => ['accepted', 'on_the_way'].includes(fulfillment.Delivery_Status || ''))) ? (
              <LiveProductTrackingMap
                orders={orders.filter((order) => order.Status === 'shipped'
                  && (order.Fulfillments || []).some((fulfillment) => ['accepted', 'on_the_way'].includes(fulfillment.Delivery_Status || '')))}
                order={orders.find((order) => order.Status === 'shipped'
                  && (order.Fulfillments || []).some((fulfillment) => ['accepted', 'on_the_way'].includes(fulfillment.Delivery_Status || ''))) || null}
                sellers={sellers}
                customerAddress={selectedCustomer?.Address}
                onDeliveryComplete={(orderId) => handleUpdateOrderStatus(orderId, 'delivered')}
              />
            ) : (
              <div className="rounded-2xl border border-slate-200 dark:border-zinc-800 bg-white dark:bg-[#12161D] p-6 text-center">
                <p className="font-bold text-slate-900 dark:text-white">No shipments are in transit</p>
                <p className="text-xs text-slate-500 dark:text-zinc-400 mt-1">Live tracking appears after a vendor marks an order as shipped.</p>
              </div>
            )}
          </div>
        )}

        {/* Customer Profile Tab - Authenticated Guard */}
        {activeTab === 'profile' && (
          isLoggedIn && selectedCustomer ? (
            <CustomerProfile
              currentCustomer={selectedCustomer}
              onUpdateCustomer={handleUpdateCustomer}
            />
          ) : (
            <AuthenticationGuard
              pageName="Customer Profile"
              requiredRole="Customer"
              onOpenLogin={() => {
                setAuthNotice('Please sign in to view and update your customer profile.');
                setIsLoginModalOpen(true);
              }}
              onBackToStorefront={() => setActiveTab('storefront')}
            />
          )
        )}

        {/* Seller Dashboard Tab - Authenticated Guard */}
        {activeTab === 'seller-dashboard' && (
          isLoggedIn && selectedSeller ? (
            <SellerDashboard
              currentSeller={selectedSeller}
              products={products}
              categories={categories}
              orders={orders}
              reviews={reviews}
              isLoading={isInitialDataLoading}
              onSaveProduct={handleSaveProduct}
              onDeleteProduct={handleDeleteProduct}
              onUpdateProductStatus={handleUpdateProductStatus}
              onUpdateOrderStatus={handleUpdateOrderStatus}
              onUpdateSellerProfile={handleUpdateSellerProfile}
            />
          ) : (
            <AuthenticationGuard
              pageName="Merchant Dashboard"
              requiredRole="Seller"
              onOpenLogin={() => {
                setAuthNotice('Please sign in with a registered Seller account to access product and order management.');
                setIsLoginModalOpen(true);
              }}
              onBackToStorefront={() => setActiveTab('storefront')}
            />
          )
        )}

        {/* Admin Dashboard Tab - Authenticated Guard */}
        {activeTab === 'admin-dashboard' && (
          isLoggedIn && selectedAdmin ? (
            <AdminDashboard
              sellers={sellers}
              products={products}
              orders={orders}
              categories={categories}
              reviews={reviews}
              isLoading={isInitialDataLoading}
              onUpdateSellerStatus={handleUpdateSellerStatus}
              onUpdateProductStatus={handleUpdateProductStatus}
              onCreateCategory={handleCreateCategory}
              onUpdateCategory={handleUpdateCategory}
              onDeleteCategory={handleDeleteCategory}
              onOpenSellerSignup={() => setIsSellerRegistrationOpen(true)}
            />
          ) : (
            <AuthenticationGuard
              pageName="Platform Admin Dashboard"
              requiredRole="Admin"
              onOpenLogin={() => {
                setAuthNotice('Platform Administrator credentials required to access system governance and moderation.');
                setIsLoginModalOpen(true);
              }}
              onBackToStorefront={() => setActiveTab('storefront')}
            />
          )
        )}

        {activeTab === 'rider-dashboard' && (
          isLoggedIn && selectedRider ? (
            <RiderDashboard rider={selectedRider} />
          ) : (
            <AuthenticationGuard
              pageName="Delivery Rider Portal"
              requiredRole="Approved Delivery Rider"
              onOpenLogin={() => {
                setAuthNotice('Only approved rider applicants may sign in to the delivery portal.');
                setIsLoginModalOpen(true);
              }}
              onBackToStorefront={() => setActiveTab('storefront')}
            />
          )
        )}
        </React.Suspense>
      </main>

      {/* Unified Marketplace Footer */}
      <footer className="border-t border-white/10 bg-white/10 dark:bg-[#0C1014]/65 py-8 px-4 mt-auto space-y-7 backdrop-blur-xl shadow-[0_-10px_30px_rgba(8,17,20,0.18)]">
        <div className="max-w-7xl mx-auto">
          <MarketplaceClosing stats={marketplaceStats} />
        </div>
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-center justify-between gap-6 text-xs text-slate-500 dark:text-zinc-400">
          <div className="flex items-center gap-3">
            <img
              src={shopNiroLogo}
              alt="ShopNiro"
              className="w-8 h-8 rounded-full object-cover border border-sky-100 dark:border-zinc-700 shadow-md shadow-blue-500/20"
            />
            <div>
              <div className="font-extrabold text-slate-900 dark:text-white tracking-tight text-sm">
                ShopNiro
              </div>
              <p className="text-[11px] text-slate-400 dark:text-zinc-500">shop smart, ship fast</p>
            </div>
          </div>

          <div className="flex flex-wrap items-center justify-center gap-4 text-[11px] font-medium">
            <button
              onClick={() => {
                setActiveTab('storefront');
                scrollViewportToTop();
              }}
              className="hover:text-blue-500 dark:hover:text-sky-400 transition-colors cursor-pointer"
            >
              Catalog Storefront
            </button>
            <span>•</span>
            <button
              onClick={() => {
                setActiveTab('orders');
                scrollViewportToTop();
              }}
              className="hover:text-blue-500 dark:hover:text-sky-400 transition-colors cursor-pointer"
            >
              Order Tracking Radar
            </button>
            <span>•</span>
            <button
              onClick={() => {
                setActiveTab('live-tracking');
                scrollViewportToTop();
              }}
              className="hover:text-blue-500 dark:hover:text-sky-400 transition-colors cursor-pointer flex items-center gap-1 font-semibold text-blue-600 dark:text-sky-400"
            >
              <Radio className="w-3 h-3 text-sky-400 animate-pulse" />
              <span>Live Delivery Tracking</span>
            </button>
            <span>•</span>
            <button
              onClick={() => setViewMode('landing')}
              className="hover:text-blue-500 dark:hover:text-sky-400 transition-colors cursor-pointer"
            >
              Marketplace Landing
            </button>
            <span>•</span>
            <button
              onClick={() => setIsChatOpen(true)}
              className="hover:text-blue-500 dark:hover:text-sky-400 transition-colors cursor-pointer text-blue-600 dark:text-sky-400 font-bold"
            >
              AI Assistant
            </button>
          </div>

          <div className="text-[11px] text-slate-400 dark:text-zinc-500 font-mono text-center md:text-right">
            <span>© {new Date().getFullYear()} ShopNiro • Smart commerce network</span>
          </div>
        </div>
      </footer>

      <React.Suspense fallback={null}>
      {/* Product Detail Modal */}
      {selectedProductForDetail && (
        <ProductDetailModal
          product={selectedProductForDetail}
          category={categories.find((c) => c.Category_ID === selectedProductForDetail.Category_ID)}
          seller={sellers.find((s) => s.Seller_ID === selectedProductForDetail.Seller_ID)}
          reviews={reviews}
          allProducts={products}
          currentCustomer={selectedCustomer || null}
          onClose={() => setSelectedProductForDetail(null)}
          onAddToCart={handleAddToCart}
          onBuyNow={handleBuyNow}
          onSubmitReview={handleSubmitReview}
          onSelectProduct={(nextProduct) => setSelectedProductForDetail(nextProduct)}
          onOpenLogin={() => setIsLoginModalOpen(true)}
          onAskAI={(query) => {
            setChatInitialQuery(query);
            setIsChatOpen(true);
          }}
        />
      )}

      {/* Cart Drawer */}
      {selectedCustomer && isCartOpen && (
        <CartDrawer
          isOpen={isCartOpen}
          isLoading={isCartLoading}
          onClose={() => setIsCartOpen(false)}
          cartItems={cart}
          onUpdateQuantity={handleUpdateCartQuantity}
          onRemoveItem={handleRemoveFromCart}
          onCheckout={() => setIsCheckoutOpen(true)}
        />
      )}

      {/* Checkout Modal */}
      {selectedCustomer && isCheckoutOpen && (
        <CheckoutModal
          isOpen={isCheckoutOpen}
          onClose={() => setIsCheckoutOpen(false)}
          currentCustomer={selectedCustomer}
          previousOrderCount={orders.filter((order) => order.Customer_ID === selectedCustomer.Customer_ID).length}
          cartItems={cart}
          isLoadingCart={isCartLoading}
          onNotify={showToast}
          onPlaceOrder={handlePlaceOrder}
          onOrderSuccess={() => {
            setActiveTab('orders');
          }}
        />
      )}

      {/* Customer Signup Modal */}
      {isCustomerRegistrationOpen && (
        <CustomerSignupModal
          isOpen={isCustomerRegistrationOpen}
          onClose={() => setIsCustomerRegistrationOpen(false)}
          onRegisterCustomer={handleRegisterCustomer}
          onSuccessRegistered={handleAccountCreated}
        />
      )}

      {/* Seller Signup Modal */}
      {isSellerRegistrationOpen && (
        <SellerSignupModal
          isOpen={isSellerRegistrationOpen}
          onClose={() => setIsSellerRegistrationOpen(false)}
          onRegisterSeller={handleRegisterSeller}
          onSuccessRegistered={handleAccountCreated}
        />
      )}

      {/* Admin Signup Modal */}
      {isAdminRegistrationOpen && (
        <AdminSignupModal
          isOpen={isAdminRegistrationOpen}
          onClose={() => setIsAdminRegistrationOpen(false)}
          onRegisterAdmin={handleRegisterAdmin}
          onSuccessRegistered={handleAccountCreated}
        />
      )}

      {isRiderSignupOpen && (
        <RiderSignupModal
          isOpen={isRiderSignupOpen}
          onClose={() => setIsRiderSignupOpen(false)}
          onOpenLogin={() => setIsLoginModalOpen(true)}
          onSubmitted={(message) => { setAuthNotice(message); setIsLoginModalOpen(true); }}
        />
      )}

      {/* Login Modal with Username & Password */}
      {isLoginModalOpen && (
        <LoginModal
          isOpen={isLoginModalOpen}
          onClose={() => {
            setIsLoginModalOpen(false);
            setAuthNotice(null);
          }}
          onLoginSuccess={handleLoginSuccess}
          noticeMessage={authNotice}
        />
      )}

      {/* Gemini AI Multi-turn Chatbot Modal */}
      {isChatOpen && (
        <GeminiChatbot
          isOpen={isChatOpen}
          onClose={() => {
            setIsChatOpen(false);
            setChatInitialQuery(undefined);
          }}
          initialQuery={chatInitialQuery}
        />
      )}
      </React.Suspense>

      {/* Floating Chat Trigger */}
      <ChatFloatingTrigger
        isOpen={isChatOpen}
        onClick={() => setIsChatOpen(true)}
      />
    </div>
  );
}
