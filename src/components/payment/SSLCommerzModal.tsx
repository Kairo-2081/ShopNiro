import React from 'react';
import { Customer, Address } from '../../types';
import { formatBDT } from '../../lib/api';
import { apiUrl } from '../../apiConfig';
import {
  X,
  ShieldCheck,
  CheckCircle2,
  Lock,
  ArrowRight,
  Smartphone,
  CreditCard,
  Building2,
  RefreshCw,
  AlertCircle,
  HelpCircle,
} from 'lucide-react';

export interface SSLCommerzPaymentSuccessData {
  tran_id: string;
  val_id: string;
  bank_tran_id: string;
  payment_method: string;
  amountBDT: number;
  customer_phone: string;
  card_brand: string;
}

interface SSLCommerzModalProps {
  isOpen: boolean;
  onClose: () => void;
  orderTotal: number;
  customer: Customer;
  shippingAddress: Address;
  initialMethod?: 'bkash' | 'nagad' | 'rocket' | 'visa_mastercard';
  onSuccess: (paymentData: SSLCommerzPaymentSuccessData) => void;
}

export const SSLCommerzModal: React.FC<SSLCommerzModalProps> = ({
  isOpen,
  onClose,
  orderTotal,
  customer,
  shippingAddress,
  initialMethod = 'bkash',
  onSuccess,
}) => {
  const [selectedChannel, setSelectedChannel] = React.useState<'bkash' | 'nagad' | 'rocket' | 'cards'>(
    initialMethod === 'visa_mastercard' ? 'cards' : initialMethod
  );

  // bKash Flow State
  const [step, setStep] = React.useState<'number' | 'otp' | 'pin' | 'processing' | 'success'>('number');
  const [phone, setPhone] = React.useState(customer.Number || '01700000000');
  const [otp, setOtp] = React.useState('');
  const [pin, setPin] = React.useState('');
  const [agreedTerms, setAgreedTerms] = React.useState(true);
  const [timer, setTimer] = React.useState(60);
  const [errorMsg, setErrorMsg] = React.useState<string | null>(null);

  // Cards Flow State
  const [cardNumber, setCardNumber] = React.useState('4242 •••• •••• 4242');
  const [cardExpiry, setCardExpiry] = React.useState('12/28');
  const [cardCvv, setCardCvv] = React.useState('888');
  const [cardHolder, setCardHolder] = React.useState(customer.Name);

  const amountBDT = orderTotal;

  // Reset or initialize state
  React.useEffect(() => {
    if (isOpen) {
      setSelectedChannel(initialMethod === 'visa_mastercard' ? 'cards' : initialMethod);
      setStep('number');
      setPhone(customer.Number || '01700000000');
      setOtp('');
      setPin('');
      setErrorMsg(null);
      setTimer(60);
    }
  }, [isOpen, initialMethod, customer]);

  // Countdown timer for OTP
  React.useEffect(() => {
    let interval: any = null;
    if (step === 'otp' && timer > 0) {
      interval = setInterval(() => setTimer((t) => t - 1), 1000);
    }
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [step, timer]);

  if (!isOpen) return null;

  // Handle bKash Step 1: Submit Phone Number
  const handlePhoneSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!phone || phone.length < 11) {
      setErrorMsg('Please enter a valid 11-digit mobile number (e.g. 017XXXXXXXX)');
      return;
    }
    setErrorMsg(null);
    setStep('otp');
    setTimer(60);
  };

  // Handle bKash Step 2: Submit OTP
  const handleOtpSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!otp || otp.length < 4) {
      setErrorMsg('Please enter the 6-digit verification code sent to your phone');
      return;
    }
    setErrorMsg(null);
    setStep('pin');
  };

  // Handle bKash Step 3: Submit PIN & Finalize SSLCommerz Authorization
  const handlePinSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!pin || pin.length < 4) {
      setErrorMsg('Please enter your 5-digit account PIN');
      return;
    }

    setErrorMsg(null);
    setStep('processing');

    try {
      // Step 1: Initialize payment on backend
      const initRes = await fetch(apiUrl('/api/payment/init'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          customerId: customer.Customer_ID,
          amount: amountBDT,
          currency: 'BDT',
          customerName: customer.Name,
          customerEmail: customer.Email,
          customerPhone: phone,
          address: shippingAddress,
          paymentMethod: selectedChannel === 'cards' ? 'visa_mastercard' : selectedChannel,
          productName: `ShopNiro Order (${selectedChannel.toUpperCase()})`,
        }),
      });

      const initData = await initRes.json();
      if (!initRes.ok || !initData.tran_id) {
        throw new Error(initData.error || 'Failed to initialize payment');
      }

      // Step 2: Validate payment with SSLCommerz gateway
      const valRes = await fetch(apiUrl('/api/payment/sslcommerz/validate'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tran_id: initData.tran_id,
          payment_method: selectedChannel === 'cards' ? 'visa_mastercard' : selectedChannel,
          customer_phone: phone,
          card_brand: selectedChannel === 'bkash' ? 'bKash' : selectedChannel === 'nagad' ? 'Nagad' : selectedChannel === 'rocket' ? 'Rocket' : 'Visa',
        }),
      });

      const valData = await valRes.json();
      if (!valRes.ok) {
        throw new Error(valData.error || 'Transaction verification declined');
      }

      // Short delay for visual polish
      await new Promise((r) => setTimeout(r, 900));

      setStep('success');

      // Notify caller after celebration
      setTimeout(() => {
        onSuccess({
          tran_id: valData.tran_id,
          val_id: valData.val_id,
          bank_tran_id: valData.bank_tran_id,
          payment_method: selectedChannel === 'cards' ? 'visa_mastercard' : selectedChannel,
          amountBDT,
          customer_phone: phone,
          card_brand: valData.card_brand || selectedChannel.toUpperCase(),
        });
      }, 700);
    } catch (err: any) {
      console.error('SSLCommerz gateway error:', err);
      setErrorMsg(err.message || 'Payment processing failed. Please try again.');
      setStep('pin');
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4 overflow-y-auto animate-in fade-in duration-150">
      <div className="bg-white dark:bg-[#12161D] w-full max-w-xl rounded-3xl shadow-2xl border border-sky-100 dark:border-zinc-800 overflow-hidden flex flex-col my-4">
        {/* SSLCommerz Security Banner */}
        <div className="bg-gradient-to-r from-slate-900 via-[#0F1D2B] to-slate-900 px-6 py-3 border-b border-sky-500/20 flex items-center justify-between text-white">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-sky-500/20 border border-sky-400/40 flex items-center justify-center text-sky-400">
              <Lock className="w-3.5 h-3.5" />
            </div>
            <div>
              <div className="flex items-center gap-1.5">
                <span className="text-xs font-black tracking-wider text-white">SSLCOMMERZ</span>
                <span className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                  SANDBOX 256-BIT SECURE
                </span>
              </div>
              <p className="text-[10px] text-slate-400">Official Payment Gateway Partner of ShopNiro</p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1 rounded-full text-slate-400 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Order Price & Merchant Summary */}
        <div className="bg-slate-50 dark:bg-[#181F2A] px-6 py-4 border-b border-slate-200 dark:border-zinc-800 flex items-center justify-between">
          <div>
            <span className="text-[10px] uppercase tracking-wider font-bold text-slate-400 dark:text-zinc-500 block">
              Payable Amount
            </span>
            <div className="flex items-baseline gap-2">
              <span className="text-2xl font-black text-slate-900 dark:text-white">
                {formatBDT(amountBDT)}
              </span>
            </div>
          </div>

          <div className="text-right">
            <span className="text-[10px] uppercase tracking-wider font-bold text-slate-400 dark:text-zinc-500 block">
              Merchant
            </span>
            <span className="text-xs font-bold text-slate-800 dark:text-zinc-200">
              ShopNiro Marketplace BD
            </span>
            <span className="text-[10px] text-slate-400 block font-mono">Invoice: ORD-{Date.now().toString().slice(-6)}</span>
          </div>
        </div>

        {/* Payment Channels Navigation */}
        <div className="px-6 pt-4 pb-1 flex gap-2 border-b border-slate-100 dark:border-zinc-800/80 bg-white dark:bg-[#12161D] overflow-x-auto">
          <button
            type="button"
            onClick={() => {
              setSelectedChannel('bkash');
              setStep('number');
              setErrorMsg(null);
            }}
            className={`px-4 py-2.5 rounded-2xl text-xs font-bold transition-all flex items-center gap-2 cursor-pointer shrink-0 ${
              selectedChannel === 'bkash'
                ? 'bg-[#E2136E] text-white shadow-md shadow-[#E2136E]/30'
                : 'bg-slate-100 dark:bg-[#181F2A] text-slate-600 dark:text-zinc-400 hover:bg-slate-200'
            }`}
          >
            <div className="w-2.5 h-2.5 rounded-full bg-white animate-pulse"></div>
            <span>bKash</span>
            <span className="text-[10px] opacity-80 font-normal">MFS</span>
          </button>

          <button
            type="button"
            onClick={() => {
              setSelectedChannel('nagad');
              setStep('number');
              setErrorMsg(null);
            }}
            className={`px-4 py-2.5 rounded-2xl text-xs font-bold transition-all flex items-center gap-2 cursor-pointer shrink-0 ${
              selectedChannel === 'nagad'
                ? 'bg-[#F7941D] text-white shadow-md shadow-[#F7941D]/30'
                : 'bg-slate-100 dark:bg-[#181F2A] text-slate-600 dark:text-zinc-400 hover:bg-slate-200'
            }`}
          >
            <span>Nagad</span>
          </button>

          <button
            type="button"
            onClick={() => {
              setSelectedChannel('rocket');
              setStep('number');
              setErrorMsg(null);
            }}
            className={`px-4 py-2.5 rounded-2xl text-xs font-bold transition-all flex items-center gap-2 cursor-pointer shrink-0 ${
              selectedChannel === 'rocket'
                ? 'bg-[#8C3494] text-white shadow-md shadow-[#8C3494]/30'
                : 'bg-slate-100 dark:bg-[#181F2A] text-slate-600 dark:text-zinc-400 hover:bg-slate-200'
            }`}
          >
            <span>Rocket</span>
          </button>

          <button
            type="button"
            onClick={() => {
              setSelectedChannel('cards');
              setStep('number');
              setErrorMsg(null);
            }}
            className={`px-4 py-2.5 rounded-2xl text-xs font-bold transition-all flex items-center gap-2 cursor-pointer shrink-0 ${
              selectedChannel === 'cards'
                ? 'bg-blue-600 text-white shadow-md shadow-blue-600/30'
                : 'bg-slate-100 dark:bg-[#181F2A] text-slate-600 dark:text-zinc-400 hover:bg-slate-200'
            }`}
          >
            <CreditCard className="w-3.5 h-3.5" />
            <span>Cards</span>
          </button>
        </div>

        {/* Modal Dynamic Body */}
        <div className="p-6">
          {errorMsg && (
            <div className="mb-4 p-3 rounded-2xl bg-rose-500/10 border border-rose-500/30 text-rose-500 text-xs flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}

          {/* ================= BKASH GATEWAY ================= */}
          {selectedChannel === 'bkash' && (
            <div>
              {/* bKash Header Badge */}
              <div className="mb-5 p-4 rounded-2xl bg-gradient-to-r from-[#E2136E] to-[#B80F57] text-white flex items-center justify-between shadow-lg shadow-[#E2136E]/20">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-white text-[#E2136E] font-black text-lg flex items-center justify-center shadow-xs">
                    ব
                  </div>
                  <div>
                    <h3 className="font-black text-sm tracking-wide">bKash Payment Gateway</h3>
                    <p className="text-[11px] text-pink-100">Powered by SSLCOMMERZ</p>
                  </div>
                </div>

                <div className="text-right">
                  <span className="text-[10px] font-bold text-pink-200 uppercase block">Amount</span>
                  <span className="text-base font-black">{formatBDT(amountBDT)}</span>
                </div>
              </div>

              {/* Step 1: Phone Number Input */}
              {step === 'number' && (
                <form onSubmit={handlePhoneSubmit} className="space-y-4">
                  <div>
                    <label className="block text-xs font-bold text-slate-700 dark:text-zinc-300 mb-1.5">
                      Your bKash Account Number
                    </label>
                    <div className="relative">
                      <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400 text-xs font-bold">
                        🇧🇩 +88
                      </div>
                      <input
                        type="tel"
                        required
                        value={phone}
                        onChange={(e) => setPhone(e.target.value.replace(/[^0-9]/g, ''))}
                        placeholder="017XXXXXXXX"
                        maxLength={11}
                        className="w-full pl-16 pr-4 py-3 bg-white dark:bg-[#181F2A] border border-slate-200 dark:border-zinc-700 rounded-2xl text-slate-900 dark:text-white font-mono font-bold text-sm tracking-wider focus:outline-none focus:ring-2 focus:ring-[#E2136E]"
                      />
                    </div>
                  </div>

                  {/* Sandbox helper */}
                  <div className="flex items-center justify-between p-3 rounded-2xl bg-slate-50 dark:bg-[#181F2A] border border-slate-200 dark:border-zinc-800 text-xs">
                    <div className="flex items-center gap-2 text-slate-600 dark:text-zinc-400">
                      <HelpCircle className="w-3.5 h-3.5 text-[#E2136E]" />
                      <span>Sandbox Demo Wallet:</span>
                    </div>
                    <button
                      type="button"
                      onClick={() => setPhone('01700000000')}
                      className="text-xs font-bold text-[#E2136E] hover:underline cursor-pointer"
                    >
                      Fill 01700000000
                    </button>
                  </div>

                  <div className="pt-1">
                    <label className="flex items-start gap-2 cursor-pointer text-[11px] text-slate-600 dark:text-zinc-400">
                      <input
                        type="checkbox"
                        checked={agreedTerms}
                        onChange={(e) => setAgreedTerms(e.target.checked)}
                        className="mt-0.5 rounded text-[#E2136E] focus:ring-[#E2136E]"
                      />
                      <span>
                        I agree to the <strong className="text-slate-800 dark:text-zinc-200">bKash Merchant terms &amp; conditions</strong> and authorize SSLCommerz to charge {formatBDT(amountBDT)}.
                      </span>
                    </label>
                  </div>

                  <div className="pt-2 flex gap-3">
                    <button
                      type="button"
                      onClick={onClose}
                      className="w-1/3 py-3 rounded-full text-xs font-bold text-slate-600 dark:text-zinc-400 hover:bg-slate-100 dark:hover:bg-zinc-800 transition-colors cursor-pointer"
                    >
                      Close
                    </button>
                    <button
                      type="submit"
                      disabled={!agreedTerms || phone.length < 11}
                      className="w-2/3 py-3 bg-[#E2136E] hover:bg-[#c20f5e] disabled:opacity-50 text-white font-bold rounded-full text-xs shadow-lg shadow-[#E2136E]/30 flex items-center justify-center gap-2 transition-all cursor-pointer"
                    >
                      <span>Proceed to Verification</span>
                      <ArrowRight className="w-4 h-4" />
                    </button>
                  </div>
                </form>
              )}

              {/* Step 2: OTP Verification */}
              {step === 'otp' && (
                <form onSubmit={handleOtpSubmit} className="space-y-4">
                  <div className="p-3.5 rounded-2xl bg-pink-50 dark:bg-pink-950/20 border border-pink-200 dark:border-pink-900/40 text-xs text-pink-900 dark:text-pink-300">
                    <p className="font-semibold">
                      A 6-digit verification code was simulated for <span className="font-mono font-bold">{phone}</span>.
                    </p>
                    <p className="text-[11px] opacity-80 mt-0.5">SSLCommerz Sandbox Test OTP: <strong className="font-mono">123456</strong></p>
                  </div>

                  <div>
                    <div className="flex justify-between items-center mb-1.5">
                      <label className="text-xs font-bold text-slate-700 dark:text-zinc-300">
                        Enter bKash Verification Code (OTP)
                      </label>
                      <button
                        type="button"
                        onClick={() => setOtp('123456')}
                        className="text-xs font-bold text-[#E2136E] hover:underline cursor-pointer"
                      >
                        Auto-fill 123456
                      </button>
                    </div>

                    <input
                      type="text"
                      required
                      value={otp}
                      onChange={(e) => setOtp(e.target.value.replace(/[^0-9]/g, ''))}
                      placeholder="e.g. 123456"
                      maxLength={6}
                      autoFocus
                      className="w-full text-center tracking-widest text-xl font-mono font-black py-3 bg-white dark:bg-[#181F2A] border border-slate-200 dark:border-zinc-700 rounded-2xl text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-[#E2136E]"
                    />
                  </div>

                  <div className="flex items-center justify-between text-xs text-slate-500 dark:text-zinc-400">
                    <span>Didn't receive code?</span>
                    {timer > 0 ? (
                      <span className="font-mono text-slate-400">Resend in {timer}s</span>
                    ) : (
                      <button
                        type="button"
                        onClick={() => setTimer(60)}
                        className="font-bold text-[#E2136E] hover:underline cursor-pointer flex items-center gap-1"
                      >
                        <RefreshCw className="w-3 h-3" /> Resend OTP
                      </button>
                    )}
                  </div>

                  <div className="pt-2 flex gap-3">
                    <button
                      type="button"
                      onClick={() => setStep('number')}
                      className="w-1/3 py-3 rounded-full text-xs font-bold text-slate-600 dark:text-zinc-400 hover:bg-slate-100 dark:hover:bg-zinc-800 transition-colors cursor-pointer"
                    >
                      Back
                    </button>
                    <button
                      type="submit"
                      disabled={otp.length < 4}
                      className="w-2/3 py-3 bg-[#E2136E] hover:bg-[#c20f5e] disabled:opacity-50 text-white font-bold rounded-full text-xs shadow-lg shadow-[#E2136E]/30 flex items-center justify-center gap-2 transition-all cursor-pointer"
                    >
                      <span>Confirm OTP</span>
                      <ArrowRight className="w-4 h-4" />
                    </button>
                  </div>
                </form>
              )}

              {/* Step 3: PIN Input */}
              {step === 'pin' && (
                <form onSubmit={handlePinSubmit} className="space-y-4">
                  <div>
                    <div className="flex justify-between items-center mb-1.5">
                      <label className="text-xs font-bold text-slate-700 dark:text-zinc-300">
                        Enter bKash Account PIN
                      </label>
                      <button
                        type="button"
                        onClick={() => setPin('12345')}
                        className="text-xs font-bold text-[#E2136E] hover:underline cursor-pointer"
                      >
                        Auto-fill 12345
                      </button>
                    </div>

                    <input
                      type="password"
                      required
                      value={pin}
                      onChange={(e) => setPin(e.target.value.replace(/[^0-9]/g, ''))}
                      placeholder="•••••"
                      maxLength={5}
                      autoFocus
                      className="w-full text-center tracking-widest text-2xl font-mono font-black py-3 bg-white dark:bg-[#181F2A] border border-slate-200 dark:border-zinc-700 rounded-2xl text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-[#E2136E]"
                    />
                  </div>

                  <div className="p-3.5 rounded-2xl bg-slate-50 dark:bg-[#181F2A] border border-slate-200 dark:border-zinc-800 text-[11px] text-slate-500 dark:text-zinc-400 flex items-center gap-2">
                    <ShieldCheck className="w-4 h-4 text-emerald-500 shrink-0" />
                    <span>Your PIN is encrypted with 256-bit SSLCommerz vault security. Never disclosed to merchants.</span>
                  </div>

                  <div className="pt-2 flex gap-3">
                    <button
                      type="button"
                      onClick={() => setStep('otp')}
                      className="w-1/3 py-3 rounded-full text-xs font-bold text-slate-600 dark:text-zinc-400 hover:bg-slate-100 dark:hover:bg-zinc-800 transition-colors cursor-pointer"
                    >
                      Back
                    </button>
                    <button
                      type="submit"
                      disabled={pin.length < 4}
                      className="w-2/3 py-3 bg-[#E2136E] hover:bg-[#c20f5e] disabled:opacity-50 text-white font-bold rounded-full text-xs shadow-lg shadow-[#E2136E]/30 flex items-center justify-center gap-2 transition-all cursor-pointer"
                    >
                      <Lock className="w-4 h-4" />
                      <span>Confirm &amp; Pay {formatBDT(amountBDT)}</span>
                    </button>
                  </div>
                </form>
              )}
            </div>
          )}

          {/* ================= NAGAD & ROCKET GATEWAYS ================= */}
          {(selectedChannel === 'nagad' || selectedChannel === 'rocket') && (
            <div className="space-y-4">
              <div
                className={`p-4 rounded-2xl text-white flex items-center justify-between shadow-lg ${
                  selectedChannel === 'nagad' ? 'bg-[#F7941D]' : 'bg-[#8C3494]'
                }`}
              >
                <div>
                  <h3 className="font-black text-sm">{selectedChannel.toUpperCase()} Mobile Banking</h3>
                  <p className="text-[11px] opacity-80">SSLCommerz Digital MFS Integration</p>
                </div>
                <div className="text-right font-black text-base">{formatBDT(amountBDT)}</div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-zinc-300 mb-1.5">
                  {selectedChannel.toUpperCase()} Account Number
                </label>
                <input
                  type="tel"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="01XXXXXXXXX"
                  className="w-full px-4 py-3 bg-white dark:bg-[#181F2A] border border-slate-200 dark:border-zinc-700 rounded-2xl text-slate-900 dark:text-white font-mono text-sm"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-zinc-300 mb-1.5">
                  Account PIN
                </label>
                <input
                  type="password"
                  value={pin}
                  onChange={(e) => setPin(e.target.value)}
                  placeholder="••••"
                  className="w-full px-4 py-3 bg-white dark:bg-[#181F2A] border border-slate-200 dark:border-zinc-700 rounded-2xl text-slate-900 dark:text-white font-mono text-sm"
                />
              </div>

              <button
                type="button"
                onClick={handlePinSubmit}
                className={`w-full py-3.5 text-white font-bold rounded-full text-xs shadow-lg transition-all cursor-pointer flex items-center justify-center gap-2 ${
                  selectedChannel === 'nagad' ? 'bg-[#F7941D] hover:bg-[#df8213]' : 'bg-[#8C3494] hover:bg-[#77287e]'
                }`}
              >
                <Lock className="w-4 h-4" />
                <span>Authorize {formatBDT(amountBDT)} via {selectedChannel.toUpperCase()}</span>
              </button>
            </div>
          )}

          {/* ================= CARDS GATEWAY ================= */}
          {selectedChannel === 'cards' && (
            <div className="space-y-4">
              <div className="p-4 rounded-2xl bg-gradient-to-r from-blue-700 to-indigo-800 text-white flex items-center justify-between shadow-lg">
                <div className="flex items-center gap-3">
                  <CreditCard className="w-8 h-8 opacity-80" />
                  <div>
                    <h3 className="font-bold text-sm">Credit / Debit Card (SSLCommerz)</h3>
                    <p className="text-[11px] opacity-80">Visa, Mastercard, Amex, UnionPay</p>
                  </div>
                </div>
                <span className="font-black text-base">{formatBDT(amountBDT)}</span>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-zinc-300 mb-1">Card Number</label>
                <input
                  type="text"
                  value={cardNumber}
                  onChange={(e) => setCardNumber(e.target.value)}
                  className="w-full px-4 py-2.5 bg-white dark:bg-[#181F2A] border border-slate-200 dark:border-zinc-700 rounded-xl text-xs font-mono text-slate-900 dark:text-white"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-zinc-300 mb-1">Expiry Date</label>
                  <input
                    type="text"
                    value={cardExpiry}
                    onChange={(e) => setCardExpiry(e.target.value)}
                    className="w-full px-4 py-2.5 bg-white dark:bg-[#181F2A] border border-slate-200 dark:border-zinc-700 rounded-xl text-xs font-mono text-slate-900 dark:text-white"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-zinc-300 mb-1">CVV / CVC</label>
                  <input
                    type="password"
                    value={cardCvv}
                    onChange={(e) => setCardCvv(e.target.value)}
                    className="w-full px-4 py-2.5 bg-white dark:bg-[#181F2A] border border-slate-200 dark:border-zinc-700 rounded-xl text-xs font-mono text-slate-900 dark:text-white"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-zinc-300 mb-1">Cardholder Name</label>
                <input
                  type="text"
                  value={cardHolder}
                  onChange={(e) => setCardHolder(e.target.value)}
                  className="w-full px-4 py-2.5 bg-white dark:bg-[#181F2A] border border-slate-200 dark:border-zinc-700 rounded-xl text-xs text-slate-900 dark:text-white"
                />
              </div>

              <button
                type="button"
                onClick={handlePinSubmit}
                className="w-full py-3.5 bg-blue-600 hover:bg-blue-500 text-white font-bold rounded-full text-xs shadow-lg shadow-blue-600/30 transition-all cursor-pointer flex items-center justify-center gap-2"
              >
                <Lock className="w-4 h-4" />
                <span>Pay {formatBDT(amountBDT)} via SSLCommerz Card Gateway</span>
              </button>
            </div>
          )}

          {/* ================= PROCESSING OVERLAY ================= */}
          {step === 'processing' && (
            <div className="absolute inset-0 bg-white/95 dark:bg-[#12161D]/95 backdrop-blur-sm flex flex-col items-center justify-center p-6 text-center space-y-4 animate-in fade-in">
              <div className="w-16 h-16 rounded-full border-4 border-slate-200 border-t-[#E2136E] animate-spin flex items-center justify-center">
                <Lock className="w-6 h-6 text-[#E2136E]" />
              </div>
              <div>
                <h4 className="font-black text-lg text-slate-900 dark:text-white">Connecting with SSLCommerz</h4>
                <p className="text-xs text-slate-500 dark:text-zinc-400 mt-1">
                  Verifying transaction token &amp; bKash authorization with server...
                </p>
              </div>
            </div>
          )}

          {/* ================= SUCCESS OVERLAY ================= */}
          {step === 'success' && (
            <div className="absolute inset-0 bg-white dark:bg-[#12161D] flex flex-col items-center justify-center p-6 text-center space-y-4 animate-in zoom-in-95">
              <div className="w-16 h-16 rounded-full bg-emerald-100 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 border border-emerald-300 flex items-center justify-center shadow-lg">
                <CheckCircle2 className="w-9 h-9" />
              </div>
              <div>
                <h4 className="font-black text-xl text-slate-900 dark:text-white">Payment Authorized!</h4>
                <p className="text-xs text-slate-500 dark:text-zinc-400 mt-1">
                  Transaction verified by SSLCommerz. Generating your order waybill...
                </p>
              </div>
            </div>
          )}
        </div>

        {/* Footer Security Badges */}
        <div className="px-6 py-3 bg-slate-50 dark:bg-[#161C24] border-t border-slate-200 dark:border-zinc-800 flex items-center justify-between text-[11px] text-slate-400">
          <div className="flex items-center gap-1.5 text-slate-500 dark:text-zinc-400">
            <ShieldCheck className="w-4 h-4 text-emerald-500" />
            <span>SSLCommerz PCI-DSS Compliant</span>
          </div>
          <div className="font-mono text-[10px]">Bangladesh Central Bank Regulated</div>
        </div>
      </div>
    </div>
  );
};
