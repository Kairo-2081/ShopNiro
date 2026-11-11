import React from 'react';
import { Customer, CartItem, Address, Order, ProductBundle } from '../../types';
import { api, formatCurrency, formatBDT } from '../../lib/api';
import { PolicyLinks } from '../legal/PolicyLinks';
import { calculateCheckoutPricing, calculateOrderTotal, fromPaisa } from '../../lib/checkoutPricing';
import { describeVoucher, getVoucherRule, isVoucherExpired, normalizeVoucherCode } from '../../lib/vouchers';
import { useFocusTrap } from '../../hooks/useFocusTrap';
import { SSLCommerzModal } from '../payment/SSLCommerzModal';
import { X, CheckCircle2, MapPin, CreditCard, ArrowRight, Package, Banknote, Lock, Sparkles, LoaderCircle, Truck } from 'lucide-react';
import { money } from '../../lib/format';
import { useLocale } from '../../lib/i18n';

interface CheckoutModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentCustomer: Customer;
  previousOrderCount: number;
  initialPaymentMethod?: 'bkash' | 'nagad' | 'rocket' | 'visa_mastercard' | 'cash_on_delivery';
  cartItems: CartItem[];
  isLoadingCart?: boolean;
  onRefreshCart: () => Promise<void>;
  onNotify: (message: string, tone?: 'success' | 'error' | 'info') => void;
  onPlaceOrder: (orderData: CheckoutOrderData, idempotencyKey: string) => Promise<Order>;
  onOrderSuccess: (order: Order) => void;
}

interface CheckoutOrderData {
  Customer_ID: string;
  acceptedTerms: boolean;
  Items: any[];
  Applied_Voucher?: string;
  Shipping_Address: Address;
  Billing_Address: Address;
  Subtotal: number;
  Shipping_Fee: number;
  Additional_Info?: string;
  paymentMethod: 'cash_on_delivery' | 'online';
  Currency?: string;
}

export const CheckoutModal: React.FC<CheckoutModalProps> = ({
  isOpen,
  onClose,
  currentCustomer,
  previousOrderCount,
  initialPaymentMethod = 'bkash',
  cartItems,
  isLoadingCart = false,
  onRefreshCart,
  onNotify,
  onPlaceOrder,
  onOrderSuccess,
}) => {
  const { t } = useLocale();
  const [shippingAddress, setShippingAddress] = React.useState<Address>({
    Street: currentCustomer.Address?.Street || '',
    House_Name: currentCustomer.Address?.House_Name || '',
    City: currentCustomer.Address?.City || '',
    Postal_Code: currentCustomer.Address?.Postal_Code || '',
    Additional_Info: currentCustomer.Address?.Additional_Info || '',
    Latitude: currentCustomer.Address?.Latitude,
    Longitude: currentCustomer.Address?.Longitude,
  });

  const [useSameBilling] = React.useState(true);
  const [acceptedPolicies, setAcceptedPolicies] = React.useState(false);
  const [billingAddress] = React.useState<Address>({
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
  >(initialPaymentMethod);
  const paymentMethodLabel = paymentMethod === 'bkash'
    ? t('bkashMobileBanking')
    : paymentMethod === 'nagad'
      ? t('nagadDigitalPayment')
      : paymentMethod === 'rocket'
        ? t('rocketDbblMfs')
        : t('cardsNetBanking');
  const [isSSLModalOpen, setIsSSLModalOpen] = React.useState(false);
  const [additionalNotes, setAdditionalNotes] = React.useState(currentCustomer.Address?.Additional_Info || '');
  const [isSuggestingInstructions, setIsSuggestingInstructions] = React.useState(false);
  const [instructionError, setInstructionError] = React.useState('');
  const [voucherInput, setVoucherInput] = React.useState('');
  const [appliedVoucher, setAppliedVoucher] = React.useState('');
  const [voucherError, setVoucherError] = React.useState('');
  const [bundles, setBundles] = React.useState<ProductBundle[]>([]);
  const [isLoadingBundles, setIsLoadingBundles] = React.useState(false);
  const [onlinePaymentsEnabled, setOnlinePaymentsEnabled] = React.useState(false);
  const [isLoadingPaymentConfig, setIsLoadingPaymentConfig] = React.useState(false);
  const [paymentAvailabilityMessage, setPaymentAvailabilityMessage] = React.useState('');
  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const [createdOrder, setCreatedOrder] = React.useState<Order | null>(null);
  const [pendingOrderId, setPendingOrderId] = React.useState('');
  const [pendingOrderTotal, setPendingOrderTotal] = React.useState(0);
  const submissionInProgressRef = React.useRef(false);
  const idempotencyRequestRef = React.useRef<{ fingerprint: string; key: string } | null>(null);
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
    if (!isOpen) return;
    let isMounted = true;
    setOnlinePaymentsEnabled(false);
    setIsLoadingPaymentConfig(true);
    setPaymentMethod('cash_on_delivery');
    setPaymentAvailabilityMessage(t('checkingPaymentAvailability'));
    api.getPaymentMethods().then((settings: { onlinePaymentsEnabled?: boolean }) => {
      if (!isMounted) return;
      const enabled = settings.onlinePaymentsEnabled === true;
      setOnlinePaymentsEnabled(enabled);
      setPaymentMethod(enabled ? initialPaymentMethod : 'cash_on_delivery');
      setPaymentAvailabilityMessage(enabled ? '' : t('paymentUnavailableCod'));
    }).catch(() => {
      if (!isMounted) return;
      setOnlinePaymentsEnabled(false);
      setPaymentMethod('cash_on_delivery');
      setPaymentAvailabilityMessage(t('paymentAvailabilityUnknown'));
    }).finally(() => {
      if (isMounted) setIsLoadingPaymentConfig(false);
    });
    return () => { isMounted = false; };
  }, [initialPaymentMethod, isOpen, t]);

  React.useEffect(() => {
    if (!isOpen) {
      setCreatedOrder(null);
      setPendingOrderId('');
      setPendingOrderTotal(0);
      setIsSubmitting(false);
      setVoucherInput('');
      setAppliedVoucher('');
      setVoucherError('');
      submissionInProgressRef.current = false;
      idempotencyRequestRef.current = null;
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

  const eligibleVoucherProductIds = new Set(cartItems
    .filter((item) => Boolean(
      appliedVoucher && item.Product?.Voucher &&
      normalizeVoucherCode(item.Product.Voucher) === appliedVoucher &&
      !isVoucherExpired(item.Product.Voucher_Expires_At)
    ))
    .map((item) => item.Product_ID));
  const pricing = calculateCheckoutPricing(
    cartItems.map((item) => ({
      Product_ID: item.Product_ID,
      Price: Number(item.Product?.Price) || 0,
      Quantity: item.Quantity,
    })),
    eligibleVoucherProductIds,
    appliedVoucher,
    bundles
  );
  const bundlePricing = { appliedBundleIds: pricing.appliedBundleIds };
  const subtotal = fromPaisa(pricing.originalSubtotalCents);
  const voucherSavings = fromPaisa(Math.max(0, pricing.originalSubtotalCents - pricing.voucherSubtotalCents));
  const bundleSavings = fromPaisa(Math.max(0, pricing.voucherSubtotalCents - pricing.bundleSubtotalCents));
  const cartDiscountEligible = pricing.cartDiscountEligible;
  const discountedSubtotal = pricing.subtotal;
  const cartSavings = fromPaisa(Math.max(0, pricing.bundleSubtotalCents - pricing.subtotalCents));
  const shippingFee = pricing.shippingFee;
  const grandTotal = calculateOrderTotal(pricing.subtotal, pricing.shippingFee);
  const grandTotalBDT = grandTotal;
  const getCartItemFinalUnitPrice = (item: CartItem) =>
    pricing.unitPrices.get(item.Product_ID) ?? (Number(item.Product?.Price) || 0);

  const applyVoucher = () => {
    const code = normalizeVoucherCode(voucherInput);
    const matchingProducts = cartItems.filter((item) =>
      item.Product?.Voucher && normalizeVoucherCode(item.Product.Voucher) === code
    );
    const activeMatchingProducts = matchingProducts.filter((item) => !isVoucherExpired(item.Product?.Voucher_Expires_At));
    if (!matchingProducts.length) {
      setVoucherError(t('voucherNotFoundInCart'));
      setAppliedVoucher('');
      return;
    }
    if (!activeMatchingProducts.length) {
      setVoucherError(t('offerExpired'));
      setAppliedVoucher('');
      return;
    }
    const voucherRule = getVoucherRule(activeMatchingProducts[0].Product!.Voucher);
    if (!voucherRule) {
      setVoucherError(t('voucherInvalid'));
      setAppliedVoucher('');
      return;
    }
    if (voucherRule.firstOrderOnly && previousOrderCount > 0) {
      setVoucherError(t('new20FirstOrder'));
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

  const handleOpenPaymentOrSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!acceptedPolicies) {
      onNotify('Please accept the Terms of Service, Refund Policy and Delivery Policy to place your order.', 'error');
      return;
    }
    if (!validateAddress()) return;

    const order = await createPendingOrder();
    if (!order) return;
    setPendingOrderId(order.Order_ID);
    setPendingOrderTotal(Number(order.Subtotal) + Number(order.Shipping_Fee));

    if (paymentMethod === 'cash_on_delivery') {
      setCreatedOrder(order);
      onOrderSuccess(order);
      return;
    }

    setIsSSLModalOpen(true);
  };

  const handlePaymentFailure = async (): Promise<boolean> => {
    if (!pendingOrderId) return false;
    try {
      await api.revertFailedOnlinePayment(pendingOrderId);
      idempotencyRequestRef.current = null;
      try {
        await onRefreshCart();
      } catch (refreshError) {
        console.error('Failed to refresh cart after payment rollback:', refreshError);
        onNotify('Payment was not completed and your items were restored. Refresh your cart before trying again.', 'info');
      }
      return true;
    } catch (err: any) {
      console.error('Failed payment rollback failed:', err);
      return false;
    }
  };

  const createPendingOrder = async () => {
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

      const orderData: CheckoutOrderData = {
        Customer_ID: currentCustomer.Customer_ID,
        acceptedTerms: acceptedPolicies,
        Items: orderItems,
        Applied_Voucher: [appliedVoucher, ...bundlePricing.appliedBundleIds.map((bundleId) => `BUNDLE:${bundleId}`), cartSavings > 0 ? 'CART5' : ''].filter(Boolean).join('+') || undefined,
        Shipping_Address: shippingAddress,
        Billing_Address: useSameBilling ? shippingAddress : billingAddress,
        Subtotal: discountedSubtotal,
        Shipping_Fee: shippingFee,
        Additional_Info: additionalNotes,
        paymentMethod: paymentMethod === 'cash_on_delivery' ? 'cash_on_delivery' : 'online',
        Currency: 'BDT',
      };
      const fingerprint = JSON.stringify(orderData);
      if (!idempotencyRequestRef.current || idempotencyRequestRef.current.fingerprint !== fingerprint) {
        idempotencyRequestRef.current = { fingerprint, key: window.crypto.randomUUID() };
      }
      return await onPlaceOrder(orderData, idempotencyRequestRef.current.key);
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
      setInstructionError(error.message || t('couldNotSuggestDelivery'));
    } finally {
      setIsSuggestingInstructions(false);
    }
  };

  return (
    <>
      <div className="fixed inset-0 z-40 flex items-start justify-center overflow-y-auto bg-black/75 p-2 backdrop-blur-xs animate-in fade-in duration-150 sm:items-center sm:p-4">
        <div ref={dialogRef} role="dialog" aria-modal="true" aria-labelledby="checkout-modal-title" tabIndex={-1} onKeyDown={(event) => { if (event.key === 'Escape') onClose(); }} className="premium-surface my-2 flex max-h-[calc(100dvh-1rem)] w-full max-w-3xl flex-col overflow-hidden rounded-xl shadow-2xl sm:my-6 sm:max-h-[92vh]">
          {/* Header */}
          <div className="flex shrink-0 items-center justify-between gap-3 border-b border-surface-100 bg-surface-50/50 px-4 py-3 dark:border-surface-800 dark:bg-[#161C24]/80 sm:px-6 sm:py-4">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-full bg-brand-600/10 dark:bg-brand-950 flex items-center justify-center text-brand-600 dark:text-brand-400">
                <Truck className="w-4 h-4" />
              </div>
              <div>
                <h2 id="checkout-modal-title" className="font-bold text-surface-900 dark:text-white text-base">{t('directCheckoutPayment')}</h2>
                <p className="text-micro text-surface-400">{t('securedGateway')}</p>
              </div>
            </div>
            <button
              onClick={onClose}
              aria-label={t('closeCheckout')}
              className="grid h-11 w-11 shrink-0 place-items-center rounded-full text-surface-600 hover:text-surface-900 dark:text-surface-300 dark:hover:text-white hover:bg-surface-100 dark:hover:bg-surface-800 transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#d0c8a5]"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Modal Body */}
          <div className="min-h-0 flex-1 overflow-y-auto p-4 sm:p-6">
            {createdOrder ? (
              <div className="mx-auto max-w-md py-8 text-center">
                <div className="mx-auto grid h-14 w-14 place-items-center rounded-full border border-success-200 bg-success-100 text-success-700 dark:border-success-800 dark:bg-success-950/60 dark:text-success-300">
                  <CheckCircle2 aria-hidden="true" className="h-7 w-7" />
                </div>
                <h3 className="mt-4 text-2xl font-bold text-surface-900 dark:text-white">{t('orderPlaced')}</h3>
                <p className="mt-2 text-sm text-surface-600 dark:text-surface-300">
                  {createdOrder.Payment_Status === 'paid' ? t('paymentConfirmed') : t('payCourierOnArrival')}
                </p>
                <dl className="mt-6 space-y-3 rounded-xl border border-surface-200 bg-surface-50 p-4 text-left text-sm dark:border-surface-800 dark:bg-[#181F2A]">
                  <div className="flex justify-between gap-4">
                    <dt className="text-surface-500 dark:text-surface-400">{t('orderNumber')}</dt>
                    <dd className="break-all text-right font-mono font-semibold text-surface-900 dark:text-white">{createdOrder.Order_ID}</dd>
                  </div>
                  <div className="flex justify-between gap-4">
                    <dt className="text-surface-500 dark:text-surface-400">{t('total')}</dt>
                    <dd className="font-bold tabular-nums text-surface-900 dark:text-white">{formatBDT(createdOrder.Subtotal + createdOrder.Shipping_Fee)}</dd>
                  </div>
                </dl>
                <button
                  type="button"
                  onClick={() => {
                    onOrderSuccess(createdOrder);
                    onClose();
                  }}
                  className="premium-button mt-6 inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-full px-5 py-3 text-sm font-bold text-white"
                >
                  <Package aria-hidden="true" className="h-4 w-4" />
                  {t('viewOrder')}
                </button>
              </div>
            ) : (
              /* Checkout Form */
              <form onSubmit={handleOpenPaymentOrSubmit} className="space-y-6">
                <nav aria-label={t('checkoutSteps')}>
                  <ol className="grid grid-cols-3 gap-2 text-center text-xs font-bold">
                    {[['1', t('address')], ['2', t('payment')], ['3', t('review')]].map(([number, label]) => (
                      <li key={number} className="rounded-full border border-brand-200 bg-brand-50 px-2 py-2 text-brand-800 dark:border-brand-800 dark:bg-brand-950/50 dark:text-brand-200">
                        <span className="mr-1">{number}.</span>{label}
                      </li>
                    ))}
                  </ol>
                </nav>
                {/* Customer Info */}
                                  <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-surface-200 bg-surface-50 p-4 text-xs dark:border-surface-800 dark:bg-[#161C24]">
                  <div>
                    <span className="text-surface-500 dark:text-surface-500 block font-bold text-micro uppercase tracking-wider">
                      {t('purchasingCustomer')}
                    </span>
                    <span className="font-bold text-surface-900 dark:text-white text-sm">{currentCustomer.Name}</span>
                    <span className="text-surface-500 dark:text-surface-400 block">
                      {currentCustomer.Email} • {currentCustomer.Number}
                    </span>
                  </div>
                  <span className="bg-brand-100 dark:bg-brand-950 text-brand-700 dark:text-brand-300 font-mono text-micro font-bold px-3 py-1 rounded-full border border-brand-200 dark:border-brand-900">
                    {currentCustomer.Customer_ID}
                  </span>
                </div>

                {/* Shipping Address Form */}
                <div className="space-y-4">
                  <h3 className="text-sm font-bold text-surface-900 dark:text-white flex items-center gap-2">
                    <MapPin className="w-4 h-4 text-brand-600 dark:text-brand-400" />
                    1. {t('shippingAddress')}
                  </h3>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                    <div>
                      <label htmlFor="checkout-house" className="block text-surface-700 dark:text-surface-300 mb-1 font-medium">{t('houseApartmentUnit')}</label>
                      <input
                        id="checkout-house"
                        type="text"
                        required
                        autoComplete="address-line2"
                        value={shippingAddress.House_Name}
                        onChange={(e) => setShippingAddress({ ...shippingAddress, House_Name: e.target.value })}
                        placeholder={t('housePlaceholder')}
                        className="luxury-input min-h-11 w-full px-3 py-2.5 bg-white dark:bg-[#181F2A] border border-surface-200 dark:border-surface-700 rounded-xl focus:outline-none focus-visible:ring-2 focus-visible:ring-warning-500/40 text-surface-900 dark:text-white"
                      />
                    </div>

                    <div>
                      <label htmlFor="checkout-street" className="block text-surface-700 dark:text-surface-300 mb-1 font-medium">{t('streetAddress')}</label>
                      <input
                        id="checkout-street"
                        type="text"
                        required
                        autoComplete="street-address"
                        value={shippingAddress.Street}
                        onChange={(e) => setShippingAddress({ ...shippingAddress, Street: e.target.value, Latitude: undefined, Longitude: undefined })}
                        placeholder={t('streetPlaceholder')}
                        className="luxury-input min-h-11 w-full px-3 py-2.5 bg-white dark:bg-[#181F2A] border border-surface-200 dark:border-surface-700 rounded-xl focus:outline-none focus-visible:ring-2 focus-visible:ring-warning-500/40 text-surface-900 dark:text-white"
                      />
                    </div>

                    <div>
                      <label htmlFor="checkout-city" className="block text-surface-700 dark:text-surface-300 mb-1 font-medium">{t('city')}</label>
                      <input
                        id="checkout-city"
                        type="text"
                        required
                        autoComplete="address-level2"
                        value={shippingAddress.City}
                        onChange={(e) => setShippingAddress({ ...shippingAddress, City: e.target.value, Latitude: undefined, Longitude: undefined })}
                        placeholder={t('cityPlaceholder')}
                        className="luxury-input min-h-11 w-full px-3 py-2.5 bg-white dark:bg-[#181F2A] border border-surface-200 dark:border-surface-700 rounded-xl focus:outline-none focus-visible:ring-2 focus-visible:ring-warning-500/40 text-surface-900 dark:text-white"
                      />
                    </div>

                    <div>
                      <label htmlFor="checkout-postal" className="block text-surface-700 dark:text-surface-300 mb-1 font-medium">{t('postalZipCode')}</label>
                      <input
                        id="checkout-postal"
                        type="text"
                        required
                        autoComplete="postal-code"
                        value={shippingAddress.Postal_Code}
                        onChange={(e) => setShippingAddress({ ...shippingAddress, Postal_Code: e.target.value })}
                        placeholder="e.g. 1213"
                        className="luxury-input min-h-11 w-full px-3 py-2.5 bg-white dark:bg-[#181F2A] border border-surface-200 dark:border-surface-700 rounded-xl focus:outline-none focus-visible:ring-2 focus-visible:ring-warning-500/40 text-surface-900 dark:text-white"
                      />
                    </div>
                  </div>

                  <div>
                                          <div className="flex flex-wrap items-center justify-between gap-2">
                      <label htmlFor="delivery-instructions" className="block text-surface-600 dark:text-surface-400 font-medium text-xs">{t('deliveryInstructions')}</label>
                      <button type="button" onClick={() => void suggestDeliveryInstructions()} disabled={isSuggestingInstructions} className="inline-flex min-h-11 items-center gap-1.5 rounded-lg border border-brand-300 px-3 py-2 text-xs font-bold text-brand-700 disabled:opacity-50 dark:border-brand-900 dark:text-brand-300"><Sparkles className="h-3.5 w-3.5" />{isSuggestingInstructions ? t('suggesting') : t('suggestWithAi')}</button>
                    </div>
                    <textarea
                      id="delivery-instructions"
                      rows={2}
                      value={additionalNotes}
                      onChange={(e) => setAdditionalNotes(e.target.value)}
                      placeholder={t('riderAccessDetails')}
                      className="luxury-input min-h-11 w-full px-3 py-2.5 bg-white dark:bg-[#181F2A] border border-surface-200 dark:border-surface-700 rounded-xl focus:outline-none focus-visible:ring-2 focus-visible:ring-warning-500/40 text-xs text-surface-900 dark:text-white"
                    />
                    {instructionError && <p role="alert" className="text-xs text-danger-600 dark:text-danger-300">{instructionError}</p>}
                  </div>
                </div>

                {/* Payment Method Selector */}
                <div className="space-y-3 pt-2">
                  <div className="flex flex-col items-start gap-2 sm:flex-row sm:items-center sm:justify-between">
                    <h3 className="text-sm font-bold text-surface-900 dark:text-white flex items-center gap-2">
                      <Lock className="w-4 h-4 text-success-500" />
                      2. {t('paymentMethod')}
                    </h3>
                    <span className="max-w-full whitespace-normal rounded-full border border-brand-800 bg-brand-950/80 px-2 py-1 text-micro font-bold uppercase leading-tight text-brand-400">
                      {t('pricesInBdt')}
                    </span>
                  </div>
                  {paymentAvailabilityMessage && (
                    <p role="status" className="text-xs text-surface-600 dark:text-surface-300">
                      {paymentAvailabilityMessage}
                    </p>
                  )}

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {onlinePaymentsEnabled && (
                      <>
                    {/* bKash Radio Card */}
                    <button
                      type="button"
                      aria-pressed={paymentMethod === 'bkash'}
                      aria-label={t('selectPaymentMethod', { method: 'bKash' })}
                      onClick={() => setPaymentMethod('bkash')}
                      className={`w-full text-left p-4 rounded-2xl border-2 transition-all cursor-pointer relative overflow-hidden flex flex-col justify-between ${
                        paymentMethod === 'bkash'
                          ? 'border-[#E2136E] bg-pink-50/40 dark:bg-pink-950/20 shadow-md shadow-[#E2136E]/10'
                          : 'border-surface-200 dark:border-surface-800 bg-white dark:bg-[#161C24] hover:border-pink-300'
                      }`}
                    >
                      <div className="flex flex-wrap items-start justify-between gap-2">
                        <div className="flex min-w-0 items-center gap-2.5">
                          <div className="w-9 h-9 rounded-xl bg-[#E2136E] text-white font-black text-sm flex items-center justify-center shadow-xs">
                            ব
                          </div>
                          <div className="min-w-0">
                            <span className="font-black text-xs text-surface-900 dark:text-white block">
                              {t('bkashMobileBanking')}
                            </span>
                            <span className="text-micro text-pink-600 dark:text-pink-400 font-bold block">
                              {t('viaSslcommerz')}
                            </span>
                          </div>
                        </div>

                        <span className="px-2 py-0.5 rounded-full bg-[#E2136E] text-white text-micro font-black uppercase tracking-wider">
                          {t('recommended')}
                        </span>
                      </div>

                      <div className="mt-3 pt-2 border-t border-surface-100 dark:border-surface-800/80 flex items-center justify-between text-micro">
                        <span className="text-surface-500 dark:text-surface-400">{t('payInstantWithPinOtp')}</span>
                        <span className="font-black text-[#E2136E]">{formatBDT(grandTotalBDT)}</span>
                      </div>
                    </button>

                    {/* Nagad Radio Card */}
                    <button
                      type="button"
                      aria-pressed={paymentMethod === 'nagad'}
                      aria-label={t('selectPaymentMethod', { method: 'Nagad' })}
                      onClick={() => setPaymentMethod('nagad')}
                      className={`w-full text-left p-4 rounded-2xl border-2 transition-all cursor-pointer flex flex-col justify-between ${
                        paymentMethod === 'nagad'
                          ? 'border-[#F7941D] bg-warning-50/40 dark:bg-warning-950/20 shadow-md shadow-[#F7941D]/10'
                          : 'border-surface-200 dark:border-surface-800 bg-white dark:bg-[#161C24] hover:border-warning-300'
                      }`}
                    >
                      <div className="flex flex-wrap items-start justify-between gap-2">
                        <div className="flex min-w-0 items-center gap-2.5">
                          <div className="w-9 h-9 rounded-xl bg-[#F7941D] text-white font-black text-sm flex items-center justify-center shadow-xs">
                            না
                          </div>
                          <div className="min-w-0">
                            <span className="font-bold text-xs text-surface-900 dark:text-white block">
                              {t('nagadDigitalPayment')}
                            </span>
                            <span className="text-micro text-warning-600 dark:text-warning-400 font-bold block">
                              {t('postOfficeDigitalBanking')}
                            </span>
                          </div>
                        </div>
                      </div>

                      <div className="mt-3 pt-2 border-t border-surface-100 dark:border-surface-800/80 flex items-center justify-between text-micro">
                        <span className="text-surface-500 dark:text-surface-400">{t('nagadMfsSslcommerz')}</span>
                        <span className="font-black text-[#F7941D]">{formatBDT(grandTotalBDT)}</span>
                      </div>
                    </button>

                    {/* Rocket Radio Card */}
                    <button
                      type="button"
                      aria-pressed={paymentMethod === 'rocket'}
                      aria-label={t('selectPaymentMethod', { method: 'Rocket' })}
                      onClick={() => setPaymentMethod('rocket')}
                      className={`w-full text-left p-4 rounded-2xl border-2 transition-all cursor-pointer flex flex-col justify-between ${
                        paymentMethod === 'rocket'
                          ? 'border-[#8C3494] bg-brand-50/40 dark:bg-brand-950/20'
                          : 'border-surface-200 dark:border-surface-800 bg-white dark:bg-[#161C24] hover:border-brand-300'
                      }`}
                    >
                      <div className="flex min-w-0 items-center gap-2.5">
                        <div className="w-9 h-9 rounded-xl bg-[#8C3494] text-white font-black text-xs flex items-center justify-center shadow-xs">
                          DBBL
                        </div>
                        <div className="min-w-0">
                          <span className="font-bold text-xs text-surface-900 dark:text-white block">
                            {t('rocketDbblMfs')}
                          </span>
                          <span className="text-micro text-brand-600 dark:text-brand-400 font-medium block">
                            {t('dutchBanglaGateway')}
                          </span>
                        </div>
                      </div>

                      <div className="mt-3 pt-2 border-t border-surface-100 dark:border-surface-800/80 flex items-center justify-between text-micro">
                        <span className="text-surface-500 dark:text-surface-400">{t('rocketAccountPin')}</span>
                        <span className="font-black text-[#8C3494]">{formatBDT(grandTotalBDT)}</span>
                      </div>
                    </button>

                    {/* Credit/Debit Cards Radio Card */}
                    <button
                      type="button"
                      aria-pressed={paymentMethod === 'visa_mastercard'}
                      aria-label={t('selectPaymentMethod', { method: t('cardsNetBanking') })}
                      onClick={() => setPaymentMethod('visa_mastercard')}
                      className={`w-full text-left p-4 rounded-2xl border-2 transition-all cursor-pointer flex flex-col justify-between ${
                        paymentMethod === 'visa_mastercard'
                          ? 'border-brand-600 bg-brand-50/40 dark:bg-brand-950/20 shadow-md shadow-brand-600/10'
                          : 'border-surface-200 dark:border-surface-800 bg-white dark:bg-[#161C24] hover:border-brand-300'
                      }`}
                    >
                      <div className="flex items-center gap-2.5">
                        <div className="w-9 h-9 rounded-xl bg-[#a99b72] text-white flex items-center justify-center shadow-xs">
                          <CreditCard className="w-4 h-4" />
                        </div>
                        <div>
                          <span className="font-bold text-xs text-surface-900 dark:text-white block">
                            {t('cardsNetBanking')}
                          </span>
                          <span className="text-micro text-brand-600 dark:text-brand-400 font-medium block">
                            {t('cardBrands')}
                          </span>
                        </div>
                      </div>

                      <div className="mt-3 pt-2 border-t border-surface-100 dark:border-surface-800/80 flex items-center justify-between text-micro">
                        <span className="text-surface-500 dark:text-surface-400">{t('sslcommerz3dSecure')}</span>
                        <span className="font-black text-brand-600 dark:text-brand-400">{formatCurrency(grandTotal)}</span>
                      </div>
                    </button>
                      </>
                    )}

                    {/* Cash on Delivery Card */}
                    <button
                      type="button"
                      aria-pressed={paymentMethod === 'cash_on_delivery'}
                      aria-label={t('selectPaymentMethod', { method: t('cashOnDeliveryCod') })}
                      onClick={() => setPaymentMethod('cash_on_delivery')}
                      className={`sm:col-span-2 w-full text-left p-4 rounded-2xl border-2 transition-all cursor-pointer flex flex-wrap items-center justify-between gap-3 ${
                        paymentMethod === 'cash_on_delivery'
                          ? 'border-success-500 bg-success-50/40 dark:bg-success-950/20 shadow-md shadow-success-500/10'
                          : 'border-surface-200 dark:border-surface-800 bg-white dark:bg-[#161C24] hover:border-success-300'
                      }`}
                    >
                      <div className="flex min-w-0 items-center gap-2.5">
                        <div className="w-9 h-9 rounded-xl bg-success-600 text-white flex items-center justify-center shadow-xs">
                          <Banknote className="w-4 h-4" />
                        </div>
                        <div className="min-w-0">
                          <span className="font-bold text-xs text-surface-900 dark:text-white block">
                            {t('cashOnDeliveryCod')}
                          </span>
                          <span className="text-micro text-success-600 dark:text-success-400 font-medium block">
                            {t('payCashWhenDelivered')}
                          </span>
                        </div>
                      </div>

                      <span className="font-black text-xs text-surface-900 dark:text-white">
                        {formatBDT(grandTotalBDT)}
                      </span>
                    </button>
                  </div>
                </div>

                {/* Order Items & Fee Summary */}
                <div className="p-4 rounded-3xl bg-[#a99b72]/[0.07] dark:bg-[#161C24] border border-[#a99b72]/25 dark:border-[#a99b72]/20 space-y-3">
                  <h4 className="font-bold text-xs uppercase tracking-wider text-[#80734f] dark:text-[#d0c8a5]">
                    3. {t('reviewOrder')} ({isLoadingCart ? t('loadingCart') : t('productsCount', { count: cartItems.length })})
                  </h4>

                  <div className="space-y-2 rounded-xl border border-[#a99b72]/20 bg-white/70 p-3 dark:border-surface-700 dark:bg-[#12161D]">
                    <label htmlFor="checkout-voucher" className="block text-xs font-semibold text-surface-700 dark:text-surface-300">{t('productVoucherCode')}</label>
                    {isLoadingBundles && <div role="status" className="flex items-center gap-2 text-micro text-surface-500 dark:text-surface-400"><span className="premium-skeleton h-3 w-28 rounded-full" /><span className="sr-only">{t('checkingBundleOffers')}</span></div>}
                    <div className="flex flex-wrap gap-2">
                      <input
                        id="checkout-voucher"
                        value={voucherInput}
                        onChange={(event) => { setVoucherInput(event.target.value); setVoucherError(''); }}
                        onKeyDown={(event) => { if (event.key === 'Enter') { event.preventDefault(); applyVoucher(); } }}
                        placeholder={t('voucherPlaceholder')}
                        aria-invalid={Boolean(voucherError)}
                        className="luxury-input min-h-11 min-w-0 flex-[1_1_8rem] rounded-lg border border-surface-300 bg-white px-3 py-2 text-xs uppercase text-surface-900 placeholder:normal-case placeholder:text-surface-400 focus:outline-none focus-visible:ring-2 focus-visible:ring-warning-500/40 dark:border-surface-700 dark:bg-[#181F2A] dark:text-white"
                      />
                      <button type="button" onClick={applyVoucher} className="premium-button min-h-11 rounded-lg px-4 py-2 text-xs font-bold text-white">{t('apply')}</button>
                      {appliedVoucher && <button type="button" onClick={() => { setAppliedVoucher(''); setVoucherInput(''); setVoucherError(''); }} className="min-h-11 shrink-0 rounded-lg border border-surface-300 px-3 py-2 text-xs font-semibold text-surface-700 dark:border-surface-700 dark:text-surface-200">{t('remove')}</button>}
                    </div>
                    {voucherError && <p role="alert" className="text-xs text-danger-700 dark:text-danger-300">{voucherError}</p>}
                    {appliedVoucher && <p role="status" className="text-xs font-semibold text-success-700 dark:text-success-300">{t('voucherApplied', { code: appliedVoucher, description: describeVoucher(appliedVoucher) })}</p>}
                    {bundlePricing.appliedBundleIds.map((bundleId) => {
                      const bundle = bundles.find((item) => item.Bundle_ID === bundleId);
                      return <p key={bundleId} role="status" className="text-xs font-semibold text-success-700 dark:text-success-300">{bundle?.Name || t('bundleOffer')} · {t('bundleDiscountTogether', { percent: bundle?.Discount_Percent ?? 0 })}</p>;
                    })}
                    {cartDiscountEligible ? (
                      <p role="status" className="text-xs font-semibold text-success-700 dark:text-success-300">{t('cartDiscountApplied', { amount: money(500) })}</p>
                    ) : (
                      <p className="text-micro text-surface-500 dark:text-surface-400">{t('addForCartDiscount', { amount: formatCurrency(Math.max(0, 500 - subtotal)) })}</p>
                    )}
                  </div>

                  <div className="space-y-2 max-h-40 overflow-y-auto pr-1">
                    {isLoadingCart ? (
                      <div role="status" aria-label={t('loadingCheckoutItems')} aria-busy="true" className="space-y-2 py-1">
                        {Array.from({ length: 2 }, (_, index) => <div key={index} className="premium-skeleton h-4 w-full rounded-full" />)}
                      </div>
                    ) : cartItems.map((item) => {
                      const originalLinePrice = (Number(item.Product?.Price) || 0) * item.Quantity;
                      const finalLinePrice = getCartItemFinalUnitPrice(item) * item.Quantity;
                      return (
                      <div key={item.Cart_ID} className="flex justify-between items-center text-xs">
                        <span className="min-w-0 truncate max-w-[240px] text-surface-700 dark:text-surface-300">
                          {item.Quantity}x {item.Product?.Name}
                          {item.Product?.Voucher && !isVoucherExpired(item.Product.Voucher_Expires_At) && <span className="ml-1 text-micro text-brand-600 dark:text-brand-400">{t('code')} {item.Product.Voucher}</span>}
                        </span>
                        <span className="flex shrink-0 items-center gap-1.5 font-bold text-surface-900 dark:text-white">
                          {finalLinePrice < originalLinePrice && <span className="text-micro font-medium text-surface-500 line-through dark:text-surface-500">{formatCurrency(originalLinePrice)}</span>}
                          {formatCurrency(finalLinePrice)}
                        </span>
                      </div>
                    );})}
                  </div>

                  <div className="pt-2 border-t border-brand-200/60 dark:border-surface-800 text-xs space-y-1">
                    <div className="flex justify-between text-surface-600 dark:text-surface-400">
                      <span>{t('productSubtotal')}</span>
                      <span>{formatCurrency(subtotal)}</span>
                    </div>
                    {voucherSavings > 0 && <>
                      <div className="flex justify-between font-semibold text-success-700 dark:text-success-300">
                        <span>{t('couponSavings')}</span>
                        <span>-{formatCurrency(voucherSavings)}</span>
                      </div>
                    </>}
                    {bundleSavings > 0 && (
                      <div className="flex justify-between font-semibold text-success-700 dark:text-success-300">
                        <span>{t('bundleSavings')}</span>
                        <span>-{formatCurrency(bundleSavings)}</span>
                      </div>
                    )}
                    {cartSavings > 0 && (
                      <div className="flex justify-between font-semibold text-success-700 dark:text-success-300">
                        <span>{t('cartSavings')}</span>
                        <span>-{formatCurrency(cartSavings)}</span>
                      </div>
                    )}
                    {(voucherSavings > 0 || bundleSavings > 0 || cartSavings > 0) && (
                      <div className="flex justify-between text-surface-600 dark:text-surface-400">
                        <span>{t('subtotalAfterPromotions')}</span>
                        <span>{formatCurrency(discountedSubtotal)}</span>
                      </div>
                    )}
                    <div className="flex justify-between text-surface-600 dark:text-surface-400">
                      <span>{t('shippingFee')}</span>
                      <span>{shippingFee === 0 ? t('free') : formatCurrency(shippingFee)}</span>
                    </div>
                    <p className="text-micro text-surface-700 dark:text-surface-300">{t('freeShippingAt', { amount: money(400) })}</p>
                    <div className="flex justify-between font-black text-sm text-surface-900 dark:text-white pt-1">
                      <span>{t('totalPayable')}</span>
                      <div className="text-right">
                        <span data-testid="checkout-total" className="text-brand-600 dark:text-brand-400 text-base block font-black">
                          {formatBDT(grandTotalBDT)}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>

                <label className="flex min-h-11 items-center gap-2 text-micro text-surface-600 dark:text-surface-400 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={acceptedPolicies}
                    onChange={(e) => setAcceptedPolicies(e.target.checked)}
                    className="h-4 w-4 shrink-0 cursor-pointer"
                  />
                  <span>
                    {t('agreeToPolicies')} <PolicyLinks ids={['terms', 'refunds', 'delivery']} />.
                  </span>
                </label>

                <div data-testid="checkout-action-footer" className="sticky bottom-0 -mx-4 -mb-4 grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 border-t border-surface-200 bg-white/95 p-3 shadow-[0_-8px_24px_rgba(20,20,16,0.08)] backdrop-blur-md dark:border-surface-800 dark:bg-[#12161D]/95 sm:-mx-6 sm:-mb-6 sm:p-5">
                  <p className="min-w-0 text-xs font-semibold text-surface-600 dark:text-surface-300">
                    <span className="block text-micro text-surface-500 dark:text-surface-400">{t('total')}</span>
                    <span data-testid="checkout-footer-total" className="block truncate text-base font-black tabular-nums text-surface-900 dark:text-white">{money(grandTotalBDT)}</span>
                  </p>
                  <button
                    data-testid="checkout-submit"
                    type="submit"
                    disabled={isSubmitting || isLoadingCart || isLoadingBundles || isLoadingPaymentConfig || cartItems.length === 0}
                    className={`flex min-h-12 min-w-0 max-w-[190px] items-center justify-center gap-2 rounded-full px-4 py-2 text-center text-xs font-bold leading-tight text-white shadow-lg transition-all active:scale-98 disabled:cursor-wait disabled:opacity-70 sm:max-w-none sm:px-6 ${
                      paymentMethod === 'bkash'
                        ? 'bg-[#E2136E] hover:bg-[#c20f5e] shadow-[#E2136E]/30'
                        : paymentMethod === 'nagad'
                        ? 'bg-[#F7941D] hover:bg-[#df8213] shadow-[#F7941D]/30'
                        : paymentMethod === 'rocket'
                        ? 'bg-[#8C3494] hover:bg-[#77287e] shadow-[#8C3494]/30'
                        : paymentMethod === 'cash_on_delivery'
                        ? 'bg-success-600 hover:bg-success-500 shadow-success-600/30'
                          : 'premium-button'
                    }`}
                  >
                    {isSubmitting ? (
                      <>
                        <LoaderCircle aria-hidden="true" className="h-4 w-4 animate-spin" />
                        <span>{t('processing')}</span>
                      </>
                    ) : isLoadingCart || isLoadingBundles || isLoadingPaymentConfig ? (
                      t('calculatingOrderTotal')
                    ) : cartItems.length === 0 ? (
                      t('cartIsEmpty')
                    ) : paymentMethod === 'cash_on_delivery' ? (
                      <>
                        <span className="min-w-0 break-words">{t('placeOrder')}</span>
                        <ArrowRight aria-hidden="true" className="h-4 w-4 shrink-0" />
                      </>
                    ) : (
                      <>
                        <Lock aria-hidden="true" className="h-4 w-4 shrink-0" />
                        <span className="min-w-0 break-words">
                          {t('payWith', { method: paymentMethodLabel })}
                        </span>
                        <ArrowRight aria-hidden="true" className="h-4 w-4 shrink-0" />
                      </>
                    )}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      </div>

      {/* SSLCommerz Gateway Modal */}
      <SSLCommerzModal
        isOpen={isSSLModalOpen}
        orderId={pendingOrderId}
        orderTotal={pendingOrderTotal}
        customer={currentCustomer}
        shippingAddress={shippingAddress}
        initialMethod={paymentMethod === 'cash_on_delivery' ? 'bkash' : paymentMethod}
        onPaymentFailure={handlePaymentFailure}
        onClose={() => setIsSSLModalOpen(false)}
      />
    </>
  );
};
