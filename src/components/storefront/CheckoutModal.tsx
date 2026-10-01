import React from 'react';
import { Customer, CartItem, Address, Order, PaymentMethod } from '../../types';
import { api, formatCurrency, formatBDT } from '../../lib/api';
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
  cartItems: CartItem[];
  onPlaceOrder: (orderData: {
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
  }) => Promise<Order>;
  onOrderSuccess: (order: Order) => void;
}

export const CheckoutModal: React.FC<CheckoutModalProps> = ({
  isOpen,
  onClose,
  currentCustomer,
  cartItems,
  onPlaceOrder,
  onOrderSuccess,
}) => {
  const [shippingAddress, setShippingAddress] = React.useState<Address>({
    Street: currentCustomer.Address?.Street || '',
    House_Name: currentCustomer.Address?.House_Name || '',
    City: currentCustomer.Address?.City || '',
    Postal_Code: currentCustomer.Address?.Postal_Code || '',
    Additional_Info: currentCustomer.Address?.Additional_Info || '',
  });

  const [useSameBilling, setUseSameBilling] = React.useState(true);
  const [billingAddress, setBillingAddress] = React.useState<Address>({
    Street: currentCustomer.Address?.Street || '',
    House_Name: currentCustomer.Address?.House_Name || '',
    City: currentCustomer.Address?.City || '',
    Postal_Code: currentCustomer.Address?.Postal_Code || '',
    Additional_Info: '',
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
  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const [createdOrder, setCreatedOrder] = React.useState<Order | null>(null);
  const [verifiedPayment, setVerifiedPayment] = React.useState<SSLCommerzPaymentSuccessData | BkashPaymentSuccessData | null>(null);
  const submissionInProgressRef = React.useRef(false);

  React.useEffect(() => {
    if (!isOpen) {
      setCreatedOrder(null);
      setVerifiedPayment(null);
      setIsSubmitting(false);
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
      });
      setAdditionalNotes(currentCustomer.Address.Additional_Info || '');
    }
  }, [currentCustomer]);

  if (!isOpen) return null;

  const subtotal = cartItems.reduce((acc, item) => {
    const price = item.Product?.Price || 0;
    return acc + price * item.Quantity;
  }, 0);

  const shippingFee = subtotal > 150 ? 0 : 5.0;
  const grandTotal = subtotal + shippingFee;
  const grandTotalBDT = grandTotal;

  const validateAddress = () => {
    if (!shippingAddress.Street || !shippingAddress.City || !shippingAddress.Postal_Code) {
      alert('Please complete all required shipping address fields.');
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
      alert('Your cart is empty or customer session is unavailable. Reopen the cart and try again.');
      return;
    }
    if (!shippingAddress.Street.trim() || !shippingAddress.City.trim()) {
      alert('Complete the shipping street and city before placing your order.');
      return;
    }

    submissionInProgressRef.current = true;
    setIsSubmitting(true);
    try {
      const orderItems = cartItems.map((item) => ({
        Product_ID: item.Product_ID,
        Name: item.Product?.Name || 'Product',
        Price: item.Product?.Price || 0,
        Quantity: item.Quantity,
        Image: item.Product?.Image || '',
        Seller_ID: item.Product?.Seller_ID || '',
        Size: item.Size,
      }));

      const order = await onPlaceOrder({
        Customer_ID: currentCustomer.Customer_ID,
        Items: orderItems,
        Shipping_Address: shippingAddress,
        Billing_Address: useSameBilling ? shippingAddress : billingAddress,
        Subtotal: subtotal,
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
      alert(err.message || 'Failed to place order');
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
      <div className="fixed inset-0 z-40 bg-black/75 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto animate-in fade-in duration-150">
        <div className="bg-white dark:bg-[#12161D] w-full max-w-3xl rounded-3xl shadow-2xl border border-sky-100 dark:border-zinc-800 overflow-hidden max-h-[92vh] flex flex-col my-6">
          {/* Header */}
          <div className="px-6 py-4 border-b border-slate-100 dark:border-zinc-800 bg-slate-50/50 dark:bg-[#161C24]/80 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-full bg-blue-600/10 dark:bg-blue-950 flex items-center justify-center text-blue-600 dark:text-sky-400">
                <Truck className="w-4 h-4" />
              </div>
              <div>
                <h2 className="font-bold text-slate-900 dark:text-white text-base">Direct Checkout &amp; Payment</h2>
                <p className="text-[10px] text-slate-400">SSLCOMMERZ Secured Gateway • bKash • COD</p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="p-1.5 rounded-full text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-zinc-800 transition-colors cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Modal Body */}
          <div className="p-6 overflow-y-auto flex-1">
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
                    className="flex-1 py-3.5 bg-blue-600 hover:bg-blue-500 text-white font-bold rounded-full text-xs shadow-lg shadow-blue-600/30 transition-all flex items-center justify-center gap-2 cursor-pointer"
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
                <div className="p-4 rounded-2xl bg-slate-50 dark:bg-[#161C24] border border-slate-200 dark:border-zinc-800 flex items-center justify-between text-xs">
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
                        className="w-full p-2.5 bg-white dark:bg-[#181F2A] border border-slate-200 dark:border-zinc-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 text-slate-900 dark:text-white"
                      />
                    </div>

                    <div>
                      <label className="block text-slate-600 dark:text-zinc-400 mb-1 font-medium">Street Address</label>
                      <input
                        type="text"
                        required
                        value={shippingAddress.Street}
                        onChange={(e) => setShippingAddress({ ...shippingAddress, Street: e.target.value })}
                        placeholder="e.g. Banani, Gulshan, or Dhanmondi"
                        className="w-full p-2.5 bg-white dark:bg-[#181F2A] border border-slate-200 dark:border-zinc-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 text-slate-900 dark:text-white"
                      />
                    </div>

                    <div>
                      <label className="block text-slate-600 dark:text-zinc-400 mb-1 font-medium">City</label>
                      <input
                        type="text"
                        required
                        value={shippingAddress.City}
                        onChange={(e) => setShippingAddress({ ...shippingAddress, City: e.target.value })}
                        placeholder="e.g. Dhaka or Chittagong"
                        className="w-full p-2.5 bg-white dark:bg-[#181F2A] border border-slate-200 dark:border-zinc-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 text-slate-900 dark:text-white"
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
                        className="w-full p-2.5 bg-white dark:bg-[#181F2A] border border-slate-200 dark:border-zinc-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 text-slate-900 dark:text-white"
                      />
                    </div>
                  </div>

                  <div>
                    <div className="flex items-center justify-between gap-3">
                      <label htmlFor="delivery-instructions" className="block text-slate-600 dark:text-zinc-400 font-medium text-xs">Delivery Instructions</label>
                      <button type="button" onClick={() => void suggestDeliveryInstructions()} disabled={isSuggestingInstructions} className="inline-flex items-center gap-1.5 rounded-lg border border-blue-300 px-3 py-2 text-xs font-bold text-blue-700 disabled:opacity-50 dark:border-blue-900 dark:text-sky-300"><Sparkles className="h-3.5 w-3.5" />{isSuggestingInstructions ? 'Suggesting...' : 'Suggest with AI'}</button>
                    </div>
                    <textarea
                      id="delivery-instructions"
                      rows={2}
                      value={additionalNotes}
                      onChange={(e) => setAdditionalNotes(e.target.value)}
                      placeholder="Add access details or preferences for your rider"
                      className="w-full p-2.5 bg-white dark:bg-[#181F2A] border border-slate-200 dark:border-zinc-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 text-xs text-slate-900 dark:text-white"
                    />
                    {instructionError && <p role="alert" className="text-xs text-rose-600 dark:text-rose-300">{instructionError}</p>}
                  </div>
                </div>

                {/* Payment Method Selector */}
                <div className="space-y-3 pt-2">
                  <div className="flex items-center justify-between">
                    <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
                      <Lock className="w-4 h-4 text-emerald-500" />
                      Select Payment Method (SSLCOMMERZ Gateway)
                    </h3>
                    <span className="text-[10px] font-bold text-sky-400 uppercase tracking-wider bg-sky-950/80 px-2 py-0.5 rounded-full border border-sky-800">
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
                      <div className="flex items-start justify-between">
                        <div className="flex items-center gap-2.5">
                          <div className="w-9 h-9 rounded-xl bg-[#E2136E] text-white font-black text-sm flex items-center justify-center shadow-xs">
                            ব
                          </div>
                          <div>
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
                      <div className="flex items-start justify-between">
                        <div className="flex items-center gap-2.5">
                          <div className="w-9 h-9 rounded-xl bg-[#F7941D] text-white font-black text-sm flex items-center justify-center shadow-xs">
                            না
                          </div>
                          <div>
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
                      <div className="flex items-center gap-2.5">
                        <div className="w-9 h-9 rounded-xl bg-[#8C3494] text-white font-black text-xs flex items-center justify-center shadow-xs">
                          DBBL
                        </div>
                        <div>
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
                        <div className="w-9 h-9 rounded-xl bg-blue-600 text-white flex items-center justify-center shadow-xs">
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
                      className={`sm:col-span-2 p-4 rounded-2xl border-2 transition-all cursor-pointer flex items-center justify-between ${
                        paymentMethod === 'cash_on_delivery'
                          ? 'border-emerald-500 bg-emerald-50/40 dark:bg-emerald-950/20 shadow-md shadow-emerald-500/10'
                          : 'border-slate-200 dark:border-zinc-800 bg-white dark:bg-[#161C24] hover:border-emerald-300'
                      }`}
                    >
                      <div className="flex items-center gap-2.5">
                        <div className="w-9 h-9 rounded-xl bg-emerald-600 text-white flex items-center justify-center shadow-xs">
                          <Banknote className="w-4 h-4" />
                        </div>
                        <div>
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
                <div className="p-4 rounded-3xl bg-blue-50/50 dark:bg-[#161C24] border border-blue-100 dark:border-blue-900/40 space-y-3">
                  <h4 className="font-bold text-xs uppercase tracking-wider text-blue-700 dark:text-sky-300">
                    Order Summary ({cartItems.length} Products)
                  </h4>

                  <div className="space-y-2 max-h-40 overflow-y-auto pr-1">
                    {cartItems.map((item) => (
                      <div key={item.Cart_ID} className="flex justify-between items-center text-xs">
                        <span className="truncate max-w-[240px] text-slate-700 dark:text-zinc-300">
                          {item.Quantity}x {item.Product?.Name}
                        </span>
                        <span className="font-bold text-slate-900 dark:text-white">
                          {formatCurrency((item.Product?.Price || 0) * item.Quantity)}
                        </span>
                      </div>
                    ))}
                  </div>

                  <div className="pt-2 border-t border-blue-200/60 dark:border-zinc-800 text-xs space-y-1">
                    <div className="flex justify-between text-slate-600 dark:text-zinc-400">
                      <span>Subtotal</span>
                      <span>{formatCurrency(subtotal)}</span>
                    </div>
                    <div className="flex justify-between text-slate-600 dark:text-zinc-400">
                      <span>Shipping Fee</span>
                      <span>{shippingFee === 0 ? 'FREE' : formatCurrency(shippingFee)}</span>
                    </div>
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

                <div className="flex items-center justify-end gap-3 pt-2">
                  <button
                    type="button"
                    onClick={onClose}
                    className="px-5 py-2.5 rounded-full text-xs font-semibold text-slate-600 hover:bg-slate-100 dark:text-zinc-400 dark:hover:bg-zinc-800 transition-colors cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={isSubmitting}
                    className={`px-6 py-3.5 text-white font-bold rounded-full text-xs shadow-lg flex items-center gap-2 transition-all active:scale-98 cursor-pointer ${
                      paymentMethod === 'bkash'
                        ? 'bg-[#E2136E] hover:bg-[#c20f5e] shadow-[#E2136E]/30'
                        : paymentMethod === 'nagad'
                        ? 'bg-[#F7941D] hover:bg-[#df8213] shadow-[#F7941D]/30'
                        : paymentMethod === 'rocket'
                        ? 'bg-[#8C3494] hover:bg-[#77287e] shadow-[#8C3494]/30'
                        : paymentMethod === 'cash_on_delivery'
                        ? 'bg-emerald-600 hover:bg-emerald-500 shadow-emerald-600/30'
                        : 'bg-blue-600 hover:bg-blue-500 shadow-blue-600/30'
                    }`}
                  >
                    {isSubmitting ? (
                      'Processing Order...'
                    ) : paymentMethod === 'cash_on_delivery' ? (
                      <>
                        <span>Confirm Order (Cash on Delivery)</span>
                        <ArrowRight className="w-4 h-4" />
                      </>
                    ) : (
                      <>
                        <Lock className="w-4 h-4" />
                        <span>
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

