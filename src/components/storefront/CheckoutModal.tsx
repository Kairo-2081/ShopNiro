import React from 'react';
import { Customer, CartItem, Address, Order, PaymentMethod, ProductBundle } from '../../types';
import { api, formatCurrency, formatBDT } from '../../lib/api';
import { calculateBundlePrices } from '../../lib/bundles';
import { describeVoucher, discountedPriceForVoucher, discountedUnitPrice, getVoucherRule, isVoucherExpired, normalizeVoucherCode } from '../../lib/vouchers';
import { useFocusTrap } from '../../hooks/useFocusTrap';
import { SSLCommerzModal, SSLCommerzPaymentSuccessData } from '../payment/SSLCommerzModal';
import { BkashGatewayPage, BkashPaymentSuccessData } from '../payment/BkashGatewayPage';
import {
  X,
  CheckCircle2,
  Truck,
  ShieldCheck,
  MapPin,
  CreditCard,
  ArrowRight,
  Package,
  Smartphone,
  Banknote,
  Lock,
  Printer,
  Sparkles,
} from 'lucide-react';

interface CheckoutModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentCustomer: Customer;
  previousOrderCount: number;
  cartItems: CartItem[];
  isLoadingCart?: boolean;
  onNotify: (message: string, tone?: 'success' | 'error' | 'info') => void;
  onPlaceOrder: (orderData: {
    Customer_ID: string;
    Items: any[];
    Applied_Voucher?: string;
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
  }) => Promise<Order>;
  onOrderSuccess: (order: Order) => void;
}

export const CheckoutModal: React.FC<CheckoutModalProps> = ({
  isOpen,
  onClose,
  currentCustomer,
  previousOrderCount,
  cartItems,
  isLoadingCart = false,
  onNotify,
  onPlaceOrder,
  onOrderSuccess,
}) => {
  const [shippingAddress, setShippingAddress] = React.useState<Address>({
    Street: currentCustomer.Address?.Street || '',
    House_Name: currentCustomer.Address?.House_Name || '',
    City: currentCustomer.Address?.City || '',
    Postal_Code: currentCustomer.Address?.Postal_Code || '',
    Additional_Info: currentCustomer.Address?.Additional_Info || '',
    Latitude: currentCustomer.Address?.Latitude,
    Longitude: currentCustomer.Address?.Longitude,
  });

  const [useSameBilling, setUseSameBilling] = React.useState(true);
  const [billingAddress, setBillingAddress] = React.useState<Address>({
    Street: currentCustomer.Address?.Street || '',
    House_Name: currentCustomer.Address?.House_Name || '',
    City: currentCustomer.Address?.City || '',
    Postal_Code: currentCustomer.Address?.Postal_Code || '',
    Additional_Info: '',
    Latitude: currentCustomer.Address?.Latitude,
    Longitude: currentCustomer.Address?.Longitude,
  });

  const [paymentMethod, setPaymentMethod] = React.useState<
    'bkash' | 'nagad' | 'rocket' | 'visa_mastercard' | 'cash_on_delivery'
  >('bkash');
  const [isSSLModalOpen, setIsSSLModalOpen] = React.useState(false);
  const [isRedirectingToBkash, setIsRedirectingToBkash] = React.useState(false);
  const [isBkashGatewayOpen, setIsBkashGatewayOpen] = React.useState(false);
  const [additionalNotes, setAdditionalNotes] = React.useState(currentCustomer.Address?.Additional_Info || '');
  const [isSuggestingInstructions, setIsSuggestingInstructions] = React.useState(false);
  const [instructionError, setInstructionError] = React.useState('');
  const [voucherInput, setVoucherInput] = React.useState('');
  const [appliedVoucher, setAppliedVoucher] = React.useState('');
  const [voucherError, setVoucherError] = React.useState('');
  const [bundles, setBundles] = React.useState<ProductBundle[]>([]);
  const [isLoadingBundles, setIsLoadingBundles] = React.useState(false);
  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const [createdOrder, setCreatedOrder] = React.useState<Order | null>(null);
  const [verifiedPayment, setVerifiedPayment] = React.useState<SSLCommerzPaymentSuccessData | BkashPaymentSuccessData | null>(null);
  const submissionInProgressRef = React.useRef(false);
  const toCents = (amount: number) => Math.round((Number(amount) || 0) * 100);
  const fromCents = (amount: number) => amount / 100;
  const dialogRef = useFocusTrap<HTMLDivElement>(isOpen);

  React.useEffect(() => {
    if (!isOpen) return;
    let isMounted = true;
    setIsLoadingBundles(true);
    api.getBundles().then((result) => {
      if (isMounted) setBundles(result);
    }).catch(() => {
      if (isMounted) setBundles([]);
    }).finally(() => {
      if (isMounted) setIsLoadingBundles(false);
    });
    return () => { isMounted = false; };
  }, [isOpen]);

  React.useEffect(() => {
    if (!isOpen) {
      setCreatedOrder(null);
      setVerifiedPayment(null);
      setIsSubmitting(false);
      setVoucherInput('');
      setAppliedVoucher('');
      setVoucherError('');
      submissionInProgressRef.current = false;
    }
  }, [isOpen]);

  React.useEffect(() => {
    if (currentCustomer.Address) {
      setShippingAddress({
        Street: currentCustomer.Address.Street || '',
        House_Name: currentCustomer.Address.House_Name || '',
        City: currentCustomer.Address.City || '',
        Postal_Code: currentCustomer.Address.Postal_Code || '',
        Additional_Info: currentCustomer.Address.Additional_Info || '',
        Latitude: currentCustomer.Address.Latitude,
        Longitude: currentCustomer.Address.Longitude,
      });
      setAdditionalNotes(currentCustomer.Address.Additional_Info || '');
    }
  }, [currentCustomer]);

  React.useEffect(() => {
    if (!isOpen || previousOrderCount > 0 || appliedVoucher) return;
    const hasNewCustomerVoucher = cartItems.some((item) => normalizeVoucherCode(item.Product?.Voucher || '') === 'NEW20' && !isVoucherExpired(item.Product?.Voucher_Expires_At));
    if (hasNewCustomerVoucher) {
      setVoucherInput('NEW20');
      setAppliedVoucher('NEW20');
      setVoucherError('');
    }
  }, [appliedVoucher, cartItems, isOpen, previousOrderCount]);

  if (!isOpen) return null;

  const subtotalCents = cartItems.reduce((total, item) =>
    total + toCents(Number(item.Product?.Price) || 0) * item.Quantity, 0);
  const subtotal = fromCents(subtotalCents);

  const voucherAdjustedSubtotalCents = cartItems.reduce((total, item) => {
    const product = item.Product;
    const matchesVoucher = Boolean(
      appliedVoucher && product?.Voucher &&
      normalizeVoucherCode(product.Voucher) === appliedVoucher &&
      !isVoucherExpired(product.Voucher_Expires_At)
    );
    const price = Number(product?.Price) || 0;
    const unitPrice = matchesVoucher ? discountedPriceForVoucher(price, appliedVoucher) : price;
    return total + toCents(unitPrice) * item.Quantity;
  }, 0);
  const voucherAdjustedSubtotal = fromCents(voucherAdjustedSubtotalCents);
  const voucherSavings = fromCents(Math.max(0, subtotalCents - voucherAdjustedSubtotalCents));
  const bundlePricing = calculateBundlePrices(cartItems.map((item) => {
    const product = item.Product;
    const matchesVoucher = Boolean(product?.Voucher && appliedVoucher && normalizeVoucherCode(product.Voucher) === appliedVoucher && !isVoucherExpired(product.Voucher_Expires_At));
    const price = Number(product?.Price) || 0;
    return {
      Product_ID: item.Product_ID,
      Price: matchesVoucher ? discountedPriceForVoucher(price, appliedVoucher) : price,
      Quantity: item.Quantity,
    };
  }), bundles);
  const bundleAdjustedSubtotalCents = cartItems.reduce((total, item) =>
    total + toCents(bundlePricing.unitPrices.get(item.Product_ID) ?? Number(item.Product?.Price) ?? 0) * item.Quantity, 0);
  const bundleAdjustedSubtotal = fromCents(bundleAdjustedSubtotalCents);
  const bundleSavings = fromCents(Math.max(0, voucherAdjustedSubtotalCents - bundleAdjustedSubtotalCents));
  const cartDiscountEligible = subtotalCents >= 50000;
  const discountedSubtotalCents = cartItems.reduce((total, item) => {
    const bundleUnitPrice = bundlePricing.unitPrices.get(item.Product_ID) ?? Number(item.Product?.Price) ?? 0;
    const finalUnitPrice = cartDiscountEligible ? discountedUnitPrice(bundleUnitPrice, 5) : bundleUnitPrice;
    return total + toCents(finalUnitPrice) * item.Quantity;
  }, 0);
  const discountedSubtotal = fromCents(discountedSubtotalCents);
  const cartSavings = fromCents(Math.max(0, bundleAdjustedSubtotalCents - discountedSubtotalCents));
  const shippingFee = subtotal >= 400 ? 0 : 5.0;
  const grandTotal = fromCents(discountedSubtotalCents + toCents(shippingFee));
  const grandTotalBDT = grandTotal;
  const getCartItemFinalUnitPrice = (item: CartItem) => {
    const bundleUnitPrice = bundlePricing.unitPrices.get(item.Product_ID) ?? Number(item.Product?.Price) ?? 0;
    return cartDiscountEligible ? discountedUnitPrice(bundleUnitPrice, 5) : bundleUnitPrice;
  };

  const applyVoucher = () => {
    const code = normalizeVoucherCode(voucherInput);
    const matchingProducts = cartItems.filter((item) =>
      item.Product?.Voucher && normalizeVoucherCode(item.Product.Voucher) === code
    );
    const activeMatchingProducts = matchingProducts.filter((item) => !isVoucherExpired(item.Product?.Voucher_Expires_At));
    if (!matchingProducts.length) {
      setVoucherError('That code does not match a voucher on any product in your cart.');
      setAppliedVoucher('');
      return;
    }
    if (!activeMatchingProducts.length) {
      setVoucherError('This offer has expired.');
      setAppliedVoucher('');
      return;
    }
    const voucherRule = getVoucherRule(activeMatchingProducts[0].Product!.Voucher);
    if (!voucherRule) {
      setVoucherError('This voucher code is not valid.');
      setAppliedVoucher('');
      return;
    }
    if (voucherRule.firstOrderOnly && previousOrderCount > 0) {
      setVoucherError('NEW20 is available on your first ShopNiro order only.');
      setAppliedVoucher('');
      return;
    }
    setAppliedVoucher(code);
    setVoucherError('');
  };

  const validateAddress = () => {
    if (!shippingAddress.Street || !shippingAddress.City || !shippingAddress.Postal_Code) {
      onNotify('Please complete all required shipping address fields.', 'error');
      return false;
    }
    return true;
  };

  const handleOpenPaymentOrSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!validateAddress()) return;

    if (paymentMethod === 'cash_on_delivery') {
      // Direct Cash on Delivery submission
      handleDirectOrderSubmission({
        Payment_Status: 'pending',
        Payment_Method: 'cash_on_delivery',
        Transaction_ID: `COD-${Date.now()}`,
      });
    } else if (paymentMethod === 'bkash') {
      // Direct bKash Gateway Redirection
      setIsRedirectingToBkash(true);
      setTimeout(() => {
        setIsRedirectingToBkash(false);
        setIsBkashGatewayOpen(true);
      }, 1000);
    } else {
      // Open SSLCommerz Gateway Modal for Nagad, Rocket, or Cards
      setIsSSLModalOpen(true);
    }
  };

  const handleBkashSuccess = async (paymentData: BkashPaymentSuccessData) => {
    setIsBkashGatewayOpen(false);
    setVerifiedPayment(paymentData);

    await handleDirectOrderSubmission({
      Payment_Status: 'paid',
      Payment_Method: 'bkash',
      Transaction_ID: paymentData.tran_id,
      Payment_ID: paymentData.val_id,
    });
  };

  const handleSSLPaymentSuccess = async (paymentData: SSLCommerzPaymentSuccessData) => {
    setIsSSLModalOpen(false);
    setVerifiedPayment(paymentData);

    await handleDirectOrderSubmission({
      Payment_Status: 'paid',
      Payment_Method: paymentData.payment_method,
      Transaction_ID: paymentData.tran_id,
      Payment_ID: paymentData.val_id,
    });
  };

  const handleDirectOrderSubmission = async (paymentOverrides: {
    Payment_Status: string;
    Payment_Method: string;
    Transaction_ID: string;
    Payment_ID?: string;
  }) => {
    if (submissionInProgressRef.current || createdOrder) return;
    if (!currentCustomer.Customer_ID || cartItems.length === 0) {
      onNotify('Your cart is empty or customer session is unavailable. Reopen the cart and try again.', 'error');
      return;
    }
    if (!shippingAddress.Street.trim() || !shippingAddress.City.trim()) {
      onNotify('Complete the shipping street and city before placing your order.', 'error');
      return;
    }

    submissionInProgressRef.current = true;
    setIsSubmitting(true);
    try {
      const orderItems = cartItems.map((item) => ({
        Product_ID: item.Product_ID,
        Name: item.Product?.Name || 'Product',
        Price: getCartItemFinalUnitPrice(item),
        Quantity: item.Quantity,
        Image: item.Product?.Image || '',
        Seller_ID: item.Product?.Seller_ID || '',
        Size: item.Size,
      }));

      const order = await onPlaceOrder({
        Customer_ID: currentCustomer.Customer_ID,
        Items: orderItems,
        Applied_Voucher: [appliedVoucher, ...bundlePricing.appliedBundleIds.map((bundleId) => `BUNDLE:${bundleId}`), cartSavings > 0 ? 'CART5' : ''].filter(Boolean).join('+') || undefined,
        Shipping_Address: shippingAddress,
        Billing_Address: useSameBilling ? shippingAddress : billingAddress,
        Subtotal: discountedSubtotal,
        Shipping_Fee: shippingFee,
        Additional_Info: additionalNotes,
        Payment_Status: paymentOverrides.Payment_Status,
        Payment_Method: paymentOverrides.Payment_Method,
        Transaction_ID: paymentOverrides.Transaction_ID,
        Payment_ID: paymentOverrides.Payment_ID || '',
        Currency: 'BDT',
      });

      setCreatedOrder(order);
    } catch (err: any) {
      onNotify(err.message || 'Failed to place order', 'error');
    } finally {
      submissionInProgressRef.current = false;
      setIsSubmitting(false);
    }
  };

  const suggestDeliveryInstructions = async () => {
    setIsSuggestingInstructions(true);
    setInstructionError('');
    try {
      const result = await api.generateDeliveryInstructions({
        products: cartItems.map((item) => ({
          name: item.Product?.Name || 'Product',
          description: item.Product?.Description || '',
          quantity: item.Quantity,
        })),
        shippingAddress,
        preferences: additionalNotes,
      });
      if (result.instruction) setAdditionalNotes(result.instruction);
    } catch (error: any) {
      setInstructionError(error.message || 'Could not suggest delivery instructions.');
    } finally {
      setIsSuggestingInstructions(false);
    }
  };

  return (
    <>
      <div className="fixed inset-0 z-40 flex items-start justify-center overflow-y-auto bg-black/75 p-2 backdrop-blur-xs animate-in fade-in duration-150 sm:items-center sm:p-4">
        <div ref={dialogRef} role="dialog" aria-modal="true" aria-labelledby="checkout-modal-title" tabIndex={-1} className="premium-surface my-2 flex max-h-[calc(100dvh-1rem)] w-full max-w-3xl flex-col overflow-hidden rounded-xl shadow-2xl sm:my-6 sm:max-h-[92vh]">
          {/* Header */}
          <div className="flex shrink-0 items-center justify-between gap-3 border-b border-slate-100 bg-slate-50/50 px-4 py-3 dark:border-zinc-800 dark:bg-[#161C24]/80 sm:px-6 sm:py-4">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-full bg-blue-600/10 dark:bg-blue-950 flex items-center justify-center text-blue-600 dark:text-sky-400">
                <Truck className="w-4 h-4" />
              </div>
              <div>
                <h2 id="checkout-modal-title" className="font-bold text-slate-900 dark:text-white text-base">Direct Checkout &amp; Payment</h2>
                <p className="text-[10px] text-slate-400">SSLCOMMERZ Secured Gateway • bKash • COD</p>
              </div>
            </div>
            <button
              onClick={onClose}
              aria-label="Close checkout"
              className="p-1.5 rounded-full text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-zinc-800 transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#d0c8a5]"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Modal Body */}
          <div className="min-h-0 flex-1 overflow-y-auto p-4 sm:p-6">
            {createdOrder ? (
              /* Order Success State matching the live waypoint card with SSLCommerz bKash badge */
              <div className="text-center py-8 space-y-6 max-w-lg mx-auto animate-in zoom-in-95 duration-200">
                <div className="w-20 h-20 bg-emerald-100 dark:bg-emerald-950/60 rounded-full flex items-center justify-center mx-auto text-emerald-600 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800 shadow-lg">
                  <CheckCircle2 className="w-10 h-10" />
                </div>

                <div>
                  <h3 className="text-2xl font-black text-slate-900 dark:text-white">Order Registered &amp; Confirmed!</h3>
                  <p className="text-xs text-slate-500 dark:text-zinc-400 mt-1">
                    Thank you, <strong className="text-slate-800 dark:text-zinc-200">{currentCustomer.Name}</strong>. Your payment and package dispatch have been logged.
                  </p>
                </div>

                {/* Payment Verification Card */}
                <div className="p-4 rounded-3xl bg-slate-50 dark:bg-[#161C24] border border-slate-200 dark:border-zinc-800 text-left text-xs space-y-2.5">
                  <div className="flex items-center justify-between pb-2 border-b border-slate-200 dark:border-zinc-800">
                    <span className="font-bold text-slate-700 dark:text-zinc-300 flex items-center gap-1.5">
                      <ShieldCheck className="w-4 h-4 text-emerald-500" />
                      Payment Status:
                    </span>
                    <span
                      className={`px-3 py-1 rounded-full text-[11px] font-bold uppercase ${
                        createdOrder.Payment_Status === 'paid'
                          ? 'bg-emerald-100 dark:bg-emerald-950/80 text-emerald-700 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-800'
                          : 'bg-amber-100 dark:bg-amber-950/80 text-amber-700 dark:text-amber-300 border border-amber-300 dark:border-amber-800'
                      }`}
                    >
                      {createdOrder.Payment_Status === 'paid' ? 'PAID & VERIFIED' : 'CASH ON DELIVERY (PENDING)'}
                    </span>
                  </div>

                  <div className="flex justify-between">
                    <span className="text-slate-500 dark:text-zinc-400">Channel / Gateway:</span>
                    <span className="font-bold text-slate-800 dark:text-zinc-200">
                      {createdOrder.Payment_Method?.toUpperCase()} (SSLCommerz)
                    </span>
                  </div>

                  {createdOrder.Transaction_ID && (
                    <div className="flex justify-between">
                      <span className="text-slate-500 dark:text-zinc-400">Transaction ID:</span>
                      <span className="font-mono font-bold text-blue-600 dark:text-sky-400">
                        {createdOrder.Transaction_ID}
                      </span>
                    </div>
                  )}

                  <div className="flex justify-between">
                    <span className="text-slate-500 dark:text-zinc-400">Total BDT Paid:</span>
                    <span className="font-black text-slate-900 dark:text-white text-sm">
                      {formatCurrency(createdOrder.Subtotal + createdOrder.Shipping_Fee)}
                    </span>
                  </div>
                </div>

                {/* Tracking ID is assigned at placement; live tracking starts after shipment. */}
                <div className="p-5 rounded-3xl bg-[#0F1D2B] border border-blue-900/60 text-center space-y-2 shadow-xl">
                  <span className="text-[10px] uppercase tracking-widest font-extrabold text-sky-400 block">
                    ORDER TRACKING ID
                  </span>
                  <div className="text-2xl font-black font-mono text-white tracking-widest">
                    {createdOrder.Tracking_ID}
                  </div>
                  <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-blue-600 text-white text-[10px] font-bold">
                    <span className="w-1.5 h-1.5 rounded-full bg-white animate-ping"></span>
                    <span>AWAITING VENDOR DISPATCH</span>
                  </div>
                </div>

                <div className="flex flex-col sm:flex-row gap-3 pt-2">
                  <button
                    type="button"
                    onClick={() => {
                      onOrderSuccess(createdOrder);
                      onClose();
                    }}
                    className="premium-button flex-1 rounded-full py-3.5 text-xs font-bold text-white transition-all flex items-center justify-center gap-2 cursor-pointer"
                  >
                    <Package className="w-4 h-4 text-amber-300" />
                    <span>View Order Status</span>
                  </button>
                </div>
              </div>
            ) : (
              /* Checkout Form */
              <form onSubmit={handleOpenPaymentOrSubmit} className="space-y-6">
                {/* Customer Info */}
                                  <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-slate-50 p-4 text-xs dark:border-zinc-800 dark:bg-[#161C24]">
                  <div>
                    <span className="text-slate-400 dark:text-zinc-500 block font-bold text-[10px] uppercase tracking-wider">
                      Purchasing Customer
                    </span>
                    <span className="font-bold text-slate-900 dark:text-white text-sm">{currentCustomer.Name}</span>
                    <span className="text-slate-500 dark:text-zinc-400 block">
                      {currentCustomer.Email} • {currentCustomer.Number}
                    </span>
                  </div>
                  <span className="bg-blue-100 dark:bg-blue-950 text-blue-700 dark:text-sky-300 font-mono text-[11px] font-bold px-3 py-1 rounded-full border border-blue-200 dark:border-blue-900">
                    {currentCustomer.Customer_ID}
                  </span>
                </div>

                {/* Shipping Address Form */}
                <div className="space-y-4">
                  <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
                    <MapPin className="w-4 h-4 text-blue-600 dark:text-sky-400" />
                    Shipping Destination Address
                  </h3>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                    <div>
                      <label className="block text-slate-600 dark:text-zinc-400 mb-1 font-medium">House / Apartment / Unit</label>
                      <input
                        type="text"
                        required
                        value={shippingAddress.House_Name}
                        onChange={(e) => setShippingAddress({ ...shippingAddress, House_Name: e.target.value })}
                        placeholder="e.g. Apt 4B or Road 11, Block D"
                        className="luxury-input w-full p-2.5 bg-white dark:bg-[#181F2A] border border-slate-200 dark:border-zinc-700 rounded-xl focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-500/40 text-slate-900 dark:text-white"
                      />
                    </div>

                    <div>
                      <label className="block text-slate-600 dark:text-zinc-400 mb-1 font-medium">Street Address</label>
                      <input
                        type="text"
                        required
                        value={shippingAddress.Street}
                        onChange={(e) => setShippingAddress({ ...shippingAddress, Street: e.target.value, Latitude: undefined, Longitude: undefined })}
                        placeholder="e.g. Banani, Gulshan, or Dhanmondi"
                        className="luxury-input w-full p-2.5 bg-white dark:bg-[#181F2A] border border-slate-200 dark:border-zinc-700 rounded-xl focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-500/40 text-slate-900 dark:text-white"
                      />
                    </div>

                    <div>
                      <label className="block text-slate-600 dark:text-zinc-400 mb-1 font-medium">City</label>
                      <input
                        type="text"
                        required
                        value={shippingAddress.City}
                        onChange={(e) => setShippingAddress({ ...shippingAddress, City: e.target.value, Latitude: undefined, Longitude: undefined })}
                        placeholder="e.g. Dhaka or Chittagong"
                        className="luxury-input w-full p-2.5 bg-white dark:bg-[#181F2A] border border-slate-200 dark:border-zinc-700 rounded-xl focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-500/40 text-slate-900 dark:text-white"
                      />
                    </div>

                    <div>
                      <label className="block text-slate-600 dark:text-zinc-400 mb-1 font-medium">Postal / ZIP Code</label>
                      <input
                        type="text"
                        required
                        value={shippingAddress.Postal_Code}
                        onChange={(e) => setShippingAddress({ ...shippingAddress, Postal_Code: e.target.value })}
                        placeholder="e.g. 1213"
                        className="luxury-input w-full p-2.5 bg-white dark:bg-[#181F2A] border border-slate-200 dark:border-zinc-700 rounded-xl focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-500/40 text-slate-900 dark:text-white"
                      />
                    </div>
                  </div>

                  <div>
                                          <div className="flex flex-wrap items-center justify-between gap-2">
                      <label htmlFor="delivery-instructions" className="block text-slate-600 dark:text-zinc-400 font-medium text-xs">Delivery Instructions</label>
                      <button type="button" onClick={() => void suggestDeliveryInstructions()} disabled={isSuggestingInstructions} className="inline-flex items-center gap-1.5 rounded-lg border border-blue-300 px-3 py-2 text-xs font-bold text-blue-700 disabled:opacity-50 dark:border-blue-900 dark:text-sky-300"><Sparkles className="h-3.5 w-3.5" />{isSuggestingInstructions ? 'Suggesting...' : 'Suggest with AI'}</button>
                    </div>
                    <textarea
                      id="delivery-instructions"
                      rows={2}
                      value={additionalNotes}
                      onChange={(e) => setAdditionalNotes(e.target.value)}
                      placeholder="Add access details or preferences for your rider"
                      className="luxury-input w-full p-2.5 bg-white dark:bg-[#181F2A] border border-slate-200 dark:border-zinc-700 rounded-xl focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-500/40 text-xs text-slate-900 dark:text-white"
                    />
                    {instructionError && <p role="alert" className="text-xs text-rose-600 dark:text-rose-300">{instructionError}</p>}
                  </div>
                </div>

                {/* Payment Method Selector */}
                <div className="space-y-3 pt-2">
                  <div className="flex flex-col items-start gap-2 sm:flex-row sm:items-center sm:justify-between">
                    <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
                      <Lock className="w-4 h-4 text-emerald-500" />
                      Select Payment Method (SSLCOMMERZ Gateway)
                    </h3>
                    <span className="max-w-full whitespace-normal rounded-full border border-sky-800 bg-sky-950/80 px-2 py-1 text-[10px] font-bold uppercase leading-tight text-sky-400">
                      All prices shown in Bangladeshi Taka
                    </span>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {/* bKash Radio Card */}
                    <div
                      onClick={() => setPaymentMethod('bkash')}
                      className={`p-4 rounded-2xl border-2 transition-all cursor-pointer relative overflow-hidden flex flex-col justify-between ${
                        paymentMethod === 'bkash'
                          ? 'border-[#E2136E] bg-pink-50/40 dark:bg-pink-950/20 shadow-md shadow-[#E2136E]/10'
                          : 'border-slate-200 dark:border-zinc-800 bg-white dark:bg-[#161C24] hover:border-pink-300'
                      }`}
                    >
                      <div className="flex flex-wrap items-start justify-between gap-2">
                        <div className="flex min-w-0 items-center gap-2.5">
                          <div className="w-9 h-9 rounded-xl bg-[#E2136E] text-white font-black text-sm flex items-center justify-center shadow-xs">
                            ব
                          </div>
                          <div className="min-w-0">
                            <span className="font-black text-xs text-slate-900 dark:text-white block">
                              bKash Mobile Banking
                            </span>
                            <span className="text-[10px] text-pink-600 dark:text-pink-400 font-bold block">
                              via SSLCOMMERZ
                            </span>
                          </div>
                        </div>

                        <span className="px-2 py-0.5 rounded-full bg-[#E2136E] text-white text-[9px] font-black uppercase tracking-wider">
                          Recommended
                        </span>
                      </div>

                      <div className="mt-3 pt-2 border-t border-slate-100 dark:border-zinc-800/80 flex items-center justify-between text-[11px]">
                        <span className="text-slate-500 dark:text-zinc-400">Pay Instant via PIN &amp; OTP</span>
                        <span className="font-black text-[#E2136E]">{formatBDT(grandTotalBDT)}</span>
                      </div>
                    </div>

                    {/* Nagad Radio Card */}
                    <div
                      onClick={() => setPaymentMethod('nagad')}
                      className={`p-4 rounded-2xl border-2 transition-all cursor-pointer flex flex-col justify-between ${
                        paymentMethod === 'nagad'
                          ? 'border-[#F7941D] bg-orange-50/40 dark:bg-orange-950/20 shadow-md shadow-[#F7941D]/10'
                          : 'border-slate-200 dark:border-zinc-800 bg-white dark:bg-[#161C24] hover:border-orange-300'
                      }`}
                    >
                      <div className="flex flex-wrap items-start justify-between gap-2">
                        <div className="flex min-w-0 items-center gap-2.5">
                          <div className="w-9 h-9 rounded-xl bg-[#F7941D] text-white font-black text-sm flex items-center justify-center shadow-xs">
                            না
                          </div>
                          <div className="min-w-0">
                            <span className="font-bold text-xs text-slate-900 dark:text-white block">
                              Nagad Digital Payment
                            </span>
                            <span className="text-[10px] text-orange-600 dark:text-orange-400 font-bold block">
                              Post Office Digital Banking
                            </span>
                          </div>
                        </div>
                      </div>

                      <div className="mt-3 pt-2 border-t border-slate-100 dark:border-zinc-800/80 flex items-center justify-between text-[11px]">
                        <span className="text-slate-500 dark:text-zinc-400">Nagad MFS via SSLCommerz</span>
                        <span className="font-black text-[#F7941D]">{formatBDT(grandTotalBDT)}</span>
                      </div>
                    </div>

                    {/* Rocket Radio Card */}
                    <div
                      onClick={() => setPaymentMethod('rocket')}
                      className={`p-4 rounded-2xl border-2 transition-all cursor-pointer flex flex-col justify-between ${
                        paymentMethod === 'rocket'
                          ? 'border-[#8C3494] bg-purple-50/40 dark:bg-purple-950/20'
                          : 'border-slate-200 dark:border-zinc-800 bg-white dark:bg-[#161C24] hover:border-purple-300'
                      }`}
                    >
                      <div className="flex min-w-0 items-center gap-2.5">
                        <div className="w-9 h-9 rounded-xl bg-[#8C3494] text-white font-black text-xs flex items-center justify-center shadow-xs">
                          DBBL
                        </div>
                        <div className="min-w-0">
                          <span className="font-bold text-xs text-slate-900 dark:text-white block">
                            Rocket (DBBL MFS)
                          </span>
                          <span className="text-[10px] text-purple-600 dark:text-purple-400 font-medium block">
                            Dutch-Bangla Bank Gateway
                          </span>
                        </div>
                      </div>

                      <div className="mt-3 pt-2 border-t border-slate-100 dark:border-zinc-800/80 flex items-center justify-between text-[11px]">
                        <span className="text-slate-500 dark:text-zinc-400">Rocket Account PIN</span>
                        <span className="font-black text-[#8C3494]">{formatBDT(grandTotalBDT)}</span>
                      </div>
                    </div>

                    {/* Credit/Debit Cards Radio Card */}
                    <div
                      onClick={() => setPaymentMethod('visa_mastercard')}
                      className={`p-4 rounded-2xl border-2 transition-all cursor-pointer flex flex-col justify-between ${
                        paymentMethod === 'visa_mastercard'
                          ? 'border-blue-600 bg-blue-50/40 dark:bg-blue-950/20 shadow-md shadow-blue-600/10'
                          : 'border-slate-200 dark:border-zinc-800 bg-white dark:bg-[#161C24] hover:border-blue-300'
                      }`}
                    >
                      <div className="flex items-center gap-2.5">
                        <div className="w-9 h-9 rounded-xl bg-[#a99b72] text-white flex items-center justify-center shadow-xs">
                          <CreditCard className="w-4 h-4" />
                        </div>
                        <div>
                          <span className="font-bold text-xs text-slate-900 dark:text-white block">
                            Cards / Net Banking
                          </span>
                          <span className="text-[10px] text-blue-600 dark:text-sky-400 font-medium block">
                            Visa • Mastercard • Amex
                          </span>
                        </div>
                      </div>

                      <div className="mt-3 pt-2 border-t border-slate-100 dark:border-zinc-800/80 flex items-center justify-between text-[11px]">
                        <span className="text-slate-500 dark:text-zinc-400">SSLCommerz 3D Secure</span>
                        <span className="font-black text-blue-600 dark:text-sky-400">{formatCurrency(grandTotal)}</span>
                      </div>
                    </div>

                    {/* Cash on Delivery Card */}
                    <div
                      onClick={() => setPaymentMethod('cash_on_delivery')}
                      className={`sm:col-span-2 p-4 rounded-2xl border-2 transition-all cursor-pointer flex flex-wrap items-center justify-between gap-3 ${
                        paymentMethod === 'cash_on_delivery'
                          ? 'border-emerald-500 bg-emerald-50/40 dark:bg-emerald-950/20 shadow-md shadow-emerald-500/10'
                          : 'border-slate-200 dark:border-zinc-800 bg-white dark:bg-[#161C24] hover:border-emerald-300'
                      }`}
                    >
                      <div className="flex min-w-0 items-center gap-2.5">
                        <div className="w-9 h-9 rounded-xl bg-emerald-600 text-white flex items-center justify-center shadow-xs">
                          <Banknote className="w-4 h-4" />
                        </div>
                        <div className="min-w-0">
                          <span className="font-bold text-xs text-slate-900 dark:text-white block">
                            Cash on Delivery (COD)
                          </span>
                          <span className="text-[10px] text-emerald-600 dark:text-emerald-400 font-medium block">
                            Pay in cash when dispatch courier delivers the package
                          </span>
                        </div>
                      </div>

                      <span className="font-black text-xs text-slate-900 dark:text-white">
                        {formatBDT(grandTotalBDT)}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Order Items & Fee Summary */}
                <div className="p-4 rounded-3xl bg-[#a99b72]/[0.07] dark:bg-[#161C24] border border-[#a99b72]/25 dark:border-[#a99b72]/20 space-y-3">
                  <h4 className="font-bold text-xs uppercase tracking-wider text-[#80734f] dark:text-[#d0c8a5]">
                    Order Summary ({isLoadingCart ? 'Loading cart' : `${cartItems.length} Products`})
                  </h4>

                  <div className="space-y-2 rounded-xl border border-[#a99b72]/20 bg-white/70 p-3 dark:border-zinc-700 dark:bg-[#12161D]">
                    <label htmlFor="checkout-voucher" className="block text-xs font-semibold text-slate-700 dark:text-zinc-300">Product voucher code</label>
                    {isLoadingBundles && <div role="status" className="flex items-center gap-2 text-[10px] text-slate-500 dark:text-zinc-400"><span className="premium-skeleton h-3 w-28 rounded-full" /><span className="sr-only">Checking bundle offers</span></div>}
                    <div className="flex flex-wrap gap-2">
                      <input
                        id="checkout-voucher"
                        value={voucherInput}
                        onChange={(event) => { setVoucherInput(event.target.value); setVoucherError(''); }}
                        onKeyDown={(event) => { if (event.key === 'Enter') { event.preventDefault(); applyVoucher(); } }}
                        placeholder="e.g. SAVE20"
                        aria-invalid={Boolean(voucherError)}
                        className="luxury-input min-w-0 flex-[1_1_8rem] rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs uppercase text-slate-900 placeholder:normal-case placeholder:text-slate-400 focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-500/40 dark:border-zinc-700 dark:bg-[#181F2A] dark:text-white"
                      />
                      <button type="button" onClick={applyVoucher} className="premium-button rounded-lg px-4 py-2 text-xs font-bold text-white">Apply</button>
                      {appliedVoucher && <button type="button" onClick={() => { setAppliedVoucher(''); setVoucherInput(''); setVoucherError(''); }} className="shrink-0 rounded-lg border border-slate-300 px-3 py-2 text-xs font-semibold text-slate-700 dark:border-zinc-700 dark:text-zinc-200">Remove</button>}
                    </div>
                    {voucherError && <p role="alert" className="text-xs text-rose-700 dark:text-rose-300">{voucherError}</p>}
                    {appliedVoucher && <p role="status" className="text-xs font-semibold text-emerald-700 dark:text-emerald-300">{appliedVoucher} applied: {describeVoucher(appliedVoucher)}</p>}
                    {bundlePricing.appliedBundleIds.map((bundleId) => {
                      const bundle = bundles.find((item) => item.Bundle_ID === bundleId);
                      return <p key={bundleId} role="status" className="text-xs font-semibold text-emerald-700 dark:text-emerald-300">{bundle?.Name || 'Bundle offer'} applied: {bundle?.Discount_Percent}% off together.</p>;
                    })}
                    {cartDiscountEligible ? (
                      <p role="status" className="text-xs font-semibold text-emerald-700 dark:text-emerald-300">CART5 applied: 5% off your ৳500+ cart.</p>
                    ) : (
                      <p className="text-[10px] text-slate-500 dark:text-zinc-400">Add {formatCurrency(Math.max(0, 500 - subtotal))} more for 5% off your cart.</p>
                    )}
                  </div>

                  <div className="space-y-2 max-h-40 overflow-y-auto pr-1">
                    {isLoadingCart ? (
                      <div role="status" aria-label="Loading checkout items" aria-busy="true" className="space-y-2 py-1">
                        {Array.from({ length: 2 }, (_, index) => <div key={index} className="premium-skeleton h-4 w-full rounded-full" />)}
                      </div>
                    ) : cartItems.map((item) => {
                      const originalLinePrice = (Number(item.Product?.Price) || 0) * item.Quantity;
                      const finalLinePrice = getCartItemFinalUnitPrice(item) * item.Quantity;
                      return (
                      <div key={item.Cart_ID} className="flex justify-between items-center text-xs">
                        <span className="min-w-0 truncate max-w-[240px] text-slate-700 dark:text-zinc-300">
                          {item.Quantity}x {item.Product?.Name}
                          {item.Product?.Voucher && !isVoucherExpired(item.Product.Voucher_Expires_At) && <span className="ml-1 text-[10px] text-blue-600 dark:text-sky-400">Code {item.Product.Voucher}</span>}
                        </span>
                        <span className="flex shrink-0 items-center gap-1.5 font-bold text-slate-900 dark:text-white">
                          {finalLinePrice < originalLinePrice && <span className="text-[10px] font-medium text-slate-500 line-through dark:text-zinc-500">{formatCurrency(originalLinePrice)}</span>}
                          {formatCurrency(finalLinePrice)}
                        </span>
                      </div>
                    );})}
                  </div>

                  <div className="pt-2 border-t border-blue-200/60 dark:border-zinc-800 text-xs space-y-1">
                    <div className="flex justify-between text-slate-600 dark:text-zinc-400">
                      <span>Product subtotal</span>
                      <span>{formatCurrency(subtotal)}</span>
                    </div>
                    {voucherSavings > 0 && <>
                      <div className="flex justify-between font-semibold text-emerald-700 dark:text-emerald-300">
                        <span>Coupon savings</span>
                        <span>-{formatCurrency(voucherSavings)}</span>
                      </div>
                    </>}
                    {bundleSavings > 0 && (
                      <div className="flex justify-between font-semibold text-emerald-700 dark:text-emerald-300">
                        <span>Bundle savings</span>
                        <span>-{formatCurrency(bundleSavings)}</span>
                      </div>
                    )}
                    {cartSavings > 0 && (
                      <div className="flex justify-between font-semibold text-emerald-700 dark:text-emerald-300">
                        <span>Cart savings (CART5)</span>
                        <span>-{formatCurrency(cartSavings)}</span>
                      </div>
                    )}
                    {(voucherSavings > 0 || bundleSavings > 0 || cartSavings > 0) && (
                      <div className="flex justify-between text-slate-600 dark:text-zinc-400">
                        <span>Subtotal after promotions</span>
                        <span>{formatCurrency(discountedSubtotal)}</span>
                      </div>
                    )}
                    <div className="flex justify-between text-slate-600 dark:text-zinc-400">
                      <span>Shipping Fee</span>
                      <span>{shippingFee === 0 ? 'FREE' : formatCurrency(shippingFee)}</span>
                    </div>
                    <p className="text-[10px] text-slate-500 dark:text-zinc-400">Free shipping on product subtotals of ৳400 or more.</p>
                    <div className="flex justify-between font-black text-sm text-slate-900 dark:text-white pt-1">
                      <span>Total Amount Payable</span>
                      <div className="text-right">
                        <span className="text-blue-600 dark:text-sky-400 text-base block font-black">
                          {formatBDT(grandTotalBDT)}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="flex flex-col-reverse items-stretch gap-2 border-t border-slate-200 pt-3 dark:border-zinc-800 sm:flex-row sm:items-center sm:justify-end sm:gap-3 sm:border-0 sm:pt-2">
                  <button
                    type="button"
                    onClick={onClose}
                    className="w-full rounded-full px-5 py-3 text-center text-sm font-semibold text-slate-600 transition-colors hover:bg-slate-100 dark:text-zinc-400 dark:hover:bg-zinc-800 sm:w-auto sm:py-2.5 sm:text-xs"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={isSubmitting || isLoadingCart || isLoadingBundles}
                    className={`flex w-full min-w-0 items-center justify-center gap-2 rounded-full px-3 py-3.5 text-center text-xs font-bold leading-tight text-white shadow-lg transition-all active:scale-98 sm:w-auto sm:px-6 ${
                      paymentMethod === 'bkash'
                        ? 'bg-[#E2136E] hover:bg-[#c20f5e] shadow-[#E2136E]/30'
                        : paymentMethod === 'nagad'
                        ? 'bg-[#F7941D] hover:bg-[#df8213] shadow-[#F7941D]/30'
                        : paymentMethod === 'rocket'
                        ? 'bg-[#8C3494] hover:bg-[#77287e] shadow-[#8C3494]/30'
                        : paymentMethod === 'cash_on_delivery'
                        ? 'bg-emerald-600 hover:bg-emerald-500 shadow-emerald-600/30'
                          : 'premium-button'
                    }`}
                  >
                    {isSubmitting ? (
                      'Processing Order...'
                    ) : isLoadingCart || isLoadingBundles ? (
                      'Calculating order total...'
                    ) : paymentMethod === 'cash_on_delivery' ? (
                      <>
                        <span className="min-w-0 break-words">Confirm Order (Cash on Delivery)</span>
                        <ArrowRight className="w-4 h-4" />
                      </>
                    ) : (
                      <>
                        <Lock className="w-4 h-4" />
                        <span className="min-w-0 break-words">
                          Pay with {paymentMethod === 'bkash' ? 'bKash' : paymentMethod.toUpperCase()} (SSLCommerz) • {formatBDT(grandTotalBDT)}
                        </span>
                        <ArrowRight className="w-4 h-4" />
                      </>
                    )}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      </div>

      {/* bKash Gateway Direct Redirection Modal */}
      <BkashGatewayPage
        isOpen={isBkashGatewayOpen}
        onClose={() => setIsBkashGatewayOpen(false)}
        orderTotal={grandTotal}
        customer={currentCustomer}
        shippingAddress={shippingAddress}
        onSuccess={handleBkashSuccess}
      />

      {/* bKash Redirection Transition Overlay */}
      {isRedirectingToBkash && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-fadeIn">
          <div className="w-full max-w-sm bg-white dark:bg-[#12161D] rounded-3xl p-6 text-center space-y-4 border border-pink-200 dark:border-pink-900/60 shadow-2xl">
            <div className="w-16 h-16 rounded-3xl bg-[#E2136E] text-white flex items-center justify-center mx-auto shadow-lg shadow-pink-600/30 text-3xl font-black">
              b
            </div>
            <div>
              <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-pink-50 dark:bg-pink-950/60 text-[#E2136E] text-[10px] font-bold tracking-wider uppercase mb-1">
                <Lock className="w-3 h-3" /> Secure Redirect
              </div>
              <h3 className="text-lg font-black text-slate-900 dark:text-white">Redirecting to bKash...</h3>
              <p className="text-xs text-slate-500 dark:text-zinc-400 mt-1">
                Transferring you securely to the official bKash Payment Gateway for{' '}
                <strong className="text-slate-800 dark:text-white">{formatBDT(grandTotalBDT)}</strong>.
              </p>
            </div>
            <div className="flex items-center justify-center gap-2 text-xs text-[#E2136E] font-semibold py-2">
              <span className="w-4 h-4 rounded-full border-2 border-[#E2136E] border-t-transparent animate-spin" />
              <span>Initiating SSLCommerz bKash Session...</span>
            </div>
          </div>
        </div>
      )}

      {/* SSLCommerz Gateway Modal */}
      <SSLCommerzModal
        isOpen={isSSLModalOpen}
        onClose={() => setIsSSLModalOpen(false)}
        orderTotal={grandTotal}
        customer={currentCustomer}
        shippingAddress={shippingAddress}
        initialMethod={paymentMethod === 'cash_on_delivery' ? 'bkash' : paymentMethod}
        onSuccess={handleSSLPaymentSuccess}
      />
    </>
  );
};

