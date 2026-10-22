import React from 'react';
import { Customer, Address } from '../../types';
import { formatBDT } from '../../lib/api';
import { api } from '../../lib/api';
import { apiUrl } from '../../apiConfig';
import { X, ShieldCheck, CheckCircle2, Lock, ArrowRight, CreditCard, RefreshCw, AlertCircle, HelpCircle } from 'lucide-react';
import { useFocusTrap } from '../../hooks/useFocusTrap';
import { useLocale } from '../../lib/i18n';

interface SSLCommerzModalProps {
  isOpen: boolean;
  onClose: () => void;
  orderId: string;
  orderTotal: number;
  customer: Customer;
  shippingAddress: Address;
  initialMethod?: 'bkash' | 'nagad' | 'rocket' | 'visa_mastercard';
  onPaymentFailure: () => Promise<boolean>;
}

export const SSLCommerzModal: React.FC<SSLCommerzModalProps> = ({
  isOpen,
  onClose,
  orderId,
  orderTotal,
  customer,
  shippingAddress,
  initialMethod = 'bkash',
  onPaymentFailure,
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
  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const [failureStatus, setFailureStatus] = React.useState<'restoring' | 'restored' | 'restore-failed' | null>(null);
  const [paymentAmountBDT, setPaymentAmountBDT] = React.useState(orderTotal);
  const [isSandbox, setIsSandbox] = React.useState(false);
  const dialogRef = useFocusTrap<HTMLDivElement>(isOpen);
  const { t } = useLocale();

  React.useEffect(() => {
    if (!isOpen) return;
    api.getPaymentMethods().then((settings) => {
      setIsSandbox(Boolean(settings.isSandbox));
    }).catch((error: unknown) => {
      console.error(t('paymentEnvironmentSettingsFailed'), error);
      setIsSandbox(false);
    });
  }, [isOpen]);

  // Reset or initialize state
  React.useEffect(() => {
    if (isOpen) {
      setPaymentAmountBDT(orderTotal);
      setSelectedChannel(initialMethod === 'visa_mastercard' ? 'cards' : initialMethod);
      setStep('number');
      setPhone(customer.Number || '01700000000');
      setOtp('');
      setPin('');
      setErrorMsg(null);
      setTimer(60);
      setIsSubmitting(false);
      setFailureStatus(null);
    }
  }, [isOpen, initialMethod, customer, orderTotal]);

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

  const startPayment = async () => {
    setErrorMsg(null);
    setStep('processing');
    setIsSubmitting(true);

    try {
      // Step 1: Initialize payment on backend
      const initRes = await fetch(apiUrl('/api/payment/init'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          orderId,
          customerName: customer.Name,
          customerEmail: customer.Email,
          customerPhone: phone,
          address: shippingAddress,
          paymentMethod: selectedChannel === 'cards' ? 'visa_mastercard' : selectedChannel,
          productName: `ShopNiro Order (${selectedChannel.toUpperCase()})`,
        }),
      });

      const initData = await initRes.json();
      const gatewayUrl = initData.session?.GatewayPageURL
        || initData.session?.redirectGatewayURL
        || initData.session?.DirectPaymentURLbKash;
      if (!initRes.ok || !initData.tran_id || initData.session?.status !== 'SUCCESS' || typeof gatewayUrl !== 'string') {
        throw new Error(initData.error || 'Failed to initialize payment');
      }
      const authoritativeAmount = Number(initData.amountBDT);
      if (!Number.isFinite(authoritativeAmount) || authoritativeAmount <= 0) {
        throw new Error('The server returned an invalid payment amount.');
      }
      setPaymentAmountBDT(authoritativeAmount);
      const destination = new URL(gatewayUrl, window.location.href);
      if (destination.protocol !== 'https:' && destination.origin !== window.location.origin) {
        throw new Error('SSLCommerz returned an insecure checkout URL.');
      }
      window.location.assign(destination.toString());
    } catch (err: any) {
      console.error('SSLCommerz gateway error:', err);
      const errorMessage = err.message === 'The server returned an invalid payment amount.'
        ? t('invalidPaymentAmount')
        : err.message === 'SSLCommerz returned an insecure checkout URL.'
          ? t('insecureCheckoutUrl')
          : err.message === 'Failed to initialize payment'
            ? t('checkoutStartFailed')
            : err.message || t('checkoutStartFailed');
      setErrorMsg(errorMessage);
      setStep('number');
      setFailureStatus('restoring');
      const restored = await onPaymentFailure().catch(() => false);
      setFailureStatus(restored ? 'restored' : 'restore-failed');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handlePhoneSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    if (selectedChannel !== 'cards' && !/^01\d{9}$/.test(phone)) {
      setErrorMsg(t('invalidMobileNumber'));
      return;
    }
    void startPayment();
  };

  const handleOtpSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    setStep('pin');
  };

  const handlePinSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    void startPayment();
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4 overflow-y-auto animate-in fade-in duration-150">
      <div ref={dialogRef} role="dialog" aria-modal="true" aria-labelledby="sslcommerz-dialog-title" tabIndex={-1} className="bg-white dark:bg-[#12161D] w-full max-w-xl rounded-3xl shadow-2xl border border-brand-100 dark:border-surface-800 overflow-hidden flex flex-col my-4">
        {/* SSLCommerz Security Banner */}
        <div className="bg-gradient-to-r from-surface-900 via-[#0F1D2B] to-surface-900 px-6 py-3 border-b border-brand-500/20 flex items-center justify-between text-white">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-brand-500/20 border border-brand-400/40 flex items-center justify-center text-brand-400">
              <Lock className="w-3.5 h-3.5" />
            </div>
            <div>
              <div className="flex items-center gap-1.5">
                <span id="sslcommerz-dialog-title" className="text-xs font-black tracking-wider text-white">SSLCOMMERZ</span>
                {isSandbox && (
                  <span className="px-1.5 py-0.5 rounded text-micro font-bold bg-success-500/20 text-success-400 border border-success-500/30">
                    {t('sandbox')}
                  </span>
                )}
              </div>
              <p className="text-micro text-surface-400">{t('officialGatewayPartner')}</p>
            </div>
          </div>

          <button
            onClick={onClose}
            aria-label={t('secureCheckoutClose')}
            className="grid h-11 w-11 place-items-center rounded-full text-surface-400 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Order Price & Merchant Summary */}
        <div className="bg-surface-50 dark:bg-[#181F2A] px-6 py-4 border-b border-surface-200 dark:border-surface-800 flex items-center justify-between">
          <div>
            <span className="text-micro uppercase tracking-wider font-bold text-surface-500 dark:text-surface-500 block">
              {t('payableAmount')}
            </span>
            <div className="flex items-baseline gap-2">
              <span className="text-2xl font-black text-surface-900 dark:text-white">
                {formatBDT(paymentAmountBDT)}
              </span>
            </div>
          </div>

          <div className="text-right">
            <span className="text-micro uppercase tracking-wider font-bold text-surface-500 dark:text-surface-500 block">
              {t('merchant')}
            </span>
            <span className="text-xs font-bold text-surface-800 dark:text-surface-200">
              ShopNiro Marketplace BD
            </span>
            <span className="text-micro text-surface-400 block font-mono">{t('invoice')}: ORD-{Date.now().toString().slice(-6)}</span>
          </div>
        </div>

        {/* Payment Channels Navigation */}
        <div className="px-6 pt-4 pb-1 flex gap-2 border-b border-surface-100 dark:border-surface-800/80 bg-white dark:bg-[#12161D] overflow-x-auto">
          <button
            type="button"
            onClick={() => {
              setSelectedChannel('bkash');
              setStep('number');
              setErrorMsg(null);
            }}
            className={`min-h-11 px-4 py-2.5 rounded-2xl text-xs font-bold transition-all flex items-center gap-2 cursor-pointer shrink-0 ${
              selectedChannel === 'bkash'
                ? 'bg-[#E2136E] text-white shadow-md shadow-[#E2136E]/30'
                : 'bg-surface-100 dark:bg-[#181F2A] text-surface-600 dark:text-surface-400 hover:bg-surface-200'
            }`}
          >
            <div className="w-2.5 h-2.5 rounded-full bg-white animate-pulse"></div>
            <span>bKash</span>
            <span className="text-micro opacity-80 font-normal">MFS</span>
          </button>

          <button
            type="button"
            onClick={() => {
              setSelectedChannel('nagad');
              setStep('number');
              setErrorMsg(null);
            }}
            className={`min-h-11 px-4 py-2.5 rounded-2xl text-xs font-bold transition-all flex items-center gap-2 cursor-pointer shrink-0 ${
              selectedChannel === 'nagad'
                ? 'bg-[#F7941D] text-white shadow-md shadow-[#F7941D]/30'
                : 'bg-surface-100 dark:bg-[#181F2A] text-surface-600 dark:text-surface-400 hover:bg-surface-200'
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
            className={`min-h-11 px-4 py-2.5 rounded-2xl text-xs font-bold transition-all flex items-center gap-2 cursor-pointer shrink-0 ${
              selectedChannel === 'rocket'
                ? 'bg-[#8C3494] text-white shadow-md shadow-[#8C3494]/30'
                : 'bg-surface-100 dark:bg-[#181F2A] text-surface-600 dark:text-surface-400 hover:bg-surface-200'
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
            className={`min-h-11 px-4 py-2.5 rounded-2xl text-xs font-bold transition-all flex items-center gap-2 cursor-pointer shrink-0 ${
              selectedChannel === 'cards'
                ? 'bg-brand-600 text-white shadow-md shadow-brand-600/30'
                : 'bg-surface-100 dark:bg-[#181F2A] text-surface-600 dark:text-surface-400 hover:bg-surface-200'
            }`}
          >
            <CreditCard className="w-3.5 h-3.5" />
            <span>{t('cards')}</span>
          </button>
        </div>

        {/* Modal Dynamic Body */}
        <div className="p-6">
          {failureStatus && (
            <div
              role="status"
              className={`mb-4 flex items-center gap-2 rounded-2xl border p-3 text-xs ${
                failureStatus === 'restored'
                  ? 'border-success-500/30 bg-success-500/10 text-success-700 dark:text-success-400'
                  : failureStatus === 'restore-failed'
                  ? 'border-danger-500/30 bg-danger-500/10 text-danger-600 dark:text-danger-400'
                  : 'border-brand-500/30 bg-brand-500/10 text-brand-700 dark:text-brand-400'
              }`}
            >
              {failureStatus === 'restored' ? (
                <CheckCircle2 className="h-4 w-4 shrink-0" />
              ) : (
                <AlertCircle className="h-4 w-4 shrink-0" />
              )}
              <span>
                {failureStatus === 'restoring'
                  ? t('paymentRestoringCart')
                  : failureStatus === 'restored'
                  ? t('paymentCartRestored')
                  : t('paymentCartRestoreFailed')}
              </span>
            </div>
          )}
          {failureStatus === 'restored' && (
            <button type="button" onClick={onClose} className="mb-4 min-h-11 w-full rounded-xl bg-surface-900 px-4 py-3 text-sm font-bold text-white hover:bg-surface-700 dark:bg-surface-100 dark:text-surface-900 dark:hover:bg-white">
              {t('tryAgain')}
            </button>
          )}
          {errorMsg && (
            <div className="mb-4 p-3 rounded-2xl bg-danger-500/10 border border-danger-500/30 text-danger-500 text-xs flex items-center gap-2">
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
                    <h3 className="font-black text-sm tracking-wide">{t('bkashPaymentGateway')}</h3>
                    <p className="text-micro text-pink-100">{t('poweredBySslcommerz')}</p>
                  </div>
                </div>

                <div className="text-right">
                  <span className="text-micro font-bold text-pink-200 uppercase block">{t('amount')}</span>
                  <span className="text-base font-black">{formatBDT(paymentAmountBDT)}</span>
                </div>
              </div>

              {/* Step 1: Phone Number Input */}
              {step === 'number' && (
                <form onSubmit={handlePhoneSubmit} className="space-y-4">
                  <div>
                    <label htmlFor="payment-phone" className="block text-xs font-bold text-surface-700 dark:text-surface-300 mb-1.5">
                      {t('yourBkashAccountNumber')}
                    </label>
                    <div className="relative">
                      <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-surface-400 text-xs font-bold">
                        🇧🇩 +88
                      </div>
                      <input
                        id="payment-phone"
                        type="tel"
                        required
                        inputMode="tel"
                        autoComplete="tel"
                        value={phone}
                        onChange={(e) => setPhone(e.target.value.replace(/[^0-9]/g, ''))}
                        placeholder="017XXXXXXXX"
                        maxLength={11}
                        className="w-full pl-16 pr-4 py-3 bg-white dark:bg-[#181F2A] border border-surface-200 dark:border-surface-700 rounded-2xl text-surface-900 dark:text-white font-mono font-bold text-sm tracking-wider focus:outline-none focus:ring-2 focus:ring-[#E2136E]"
                      />
                    </div>
                  </div>

                  {/* Sandbox helper */}
                  {isSandbox && (
                    <div className="flex items-center justify-between p-3 rounded-2xl bg-surface-50 dark:bg-[#181F2A] border border-surface-200 dark:border-surface-800 text-xs">
                      <div className="flex items-center gap-2 text-surface-600 dark:text-surface-400">
                        <HelpCircle className="w-3.5 h-3.5 text-[#E2136E]" />
                        <span>{t('sandboxDemoWallet')}</span>
                      </div>
                      <button
                        type="button"
                        onClick={() => setPhone('01700000000')}
                        className="text-xs font-bold text-[#E2136E] hover:underline cursor-pointer"
                      >
                        {t('fillSandboxPhone')}
                      </button>
                    </div>
                  )}

                  <div className="pt-1">
                    <label className="flex items-start gap-2 cursor-pointer text-micro text-surface-600 dark:text-surface-400">
                      <input
                        type="checkbox"
                        checked={agreedTerms}
                        onChange={(e) => setAgreedTerms(e.target.checked)}
                        className="mt-0.5 rounded text-[#E2136E] focus:ring-[#E2136E]"
                      />
                      <span>
                        {t('iAgreeTo')} <strong className="text-surface-800 dark:text-surface-200">{t('bkashMerchantTerms')}</strong> {t('authorizePayment', { amount: formatBDT(paymentAmountBDT) })}
                      </span>
                    </label>
                  </div>

                  <div className="pt-2 flex gap-3">
                    <button
                      type="button"
                      onClick={onClose}
                      className="w-1/3 py-3 rounded-full text-xs font-bold text-surface-600 dark:text-surface-400 hover:bg-surface-100 dark:hover:bg-surface-800 transition-colors cursor-pointer"
                    >
                      {t('close')}
                    </button>
                    <button
                      type="submit"
                      disabled={!agreedTerms || phone.length < 11 || isSubmitting || failureStatus === 'restored'}
                      className="w-2/3 py-3 bg-[#E2136E] hover:bg-[#c20f5e] disabled:opacity-50 text-white font-bold rounded-full text-xs shadow-lg shadow-[#E2136E]/30 flex items-center justify-center gap-2 transition-all cursor-pointer"
                    >
                      <span>{t('continueToSslcommerz')}</span>
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
                      {t('simulatedOtpForPhone', { phone })}
                    </p>
                    {isSandbox && <p className="text-micro opacity-80 mt-0.5">{t('sandboxTestOtp')} <strong className="font-mono">123456</strong></p>}
                  </div>

                  <div>
                    <div className="flex justify-between items-center mb-1.5">
                      <label htmlFor="payment-otp" className="text-xs font-bold text-surface-700 dark:text-surface-300">
                        {t('enterBkashOtp')}
                      </label>
                      {isSandbox && <button
                        type="button"
                        onClick={() => setOtp('123456')}
                        className="min-h-11 px-2 text-xs font-bold text-[#E2136E] hover:underline cursor-pointer"
                      >
                        {t('autoFillOtp')}
                      </button>}
                    </div>

                    <input
                      id="payment-otp"
                      type="text"
                      required
                      inputMode="numeric"
                      autoComplete="one-time-code"
                      value={otp}
                      onChange={(e) => setOtp(e.target.value.replace(/[^0-9]/g, ''))}
                      placeholder={t('exampleOtp')}
                      maxLength={6}
                      autoFocus
                      className="min-h-11 w-full text-center tracking-widest text-xl font-mono font-black py-3 bg-white dark:bg-[#181F2A] border border-surface-200 dark:border-surface-700 rounded-2xl text-surface-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-[#E2136E]"
                    />
                  </div>

                  <div className="flex items-center justify-between text-xs text-surface-500 dark:text-surface-400">
                    <span>{t('didNotReceiveCode')}</span>
                    {timer > 0 ? (
                      <span className="font-mono text-surface-400">{t('resendIn', { seconds: timer })}</span>
                    ) : (
                      <button
                        type="button"
                        onClick={() => setTimer(60)}
                        className="min-h-11 font-bold text-[#E2136E] hover:underline cursor-pointer flex items-center gap-1"
                      >
                        <RefreshCw className="w-3 h-3" /> {t('resendOtp')}
                      </button>
                    )}
                  </div>

                  <div className="pt-2 flex gap-3">
                    <button
                      type="button"
                      onClick={() => setStep('number')}
                      className="min-h-11 w-1/3 py-3 rounded-full text-xs font-bold text-surface-600 dark:text-surface-400 hover:bg-surface-100 dark:hover:bg-surface-800 transition-colors cursor-pointer"
                    >
                      {t('back')}
                    </button>
                    <button
                      type="submit"
                      disabled={otp.length < 4}
                      className="min-h-11 w-2/3 py-3 bg-[#E2136E] hover:bg-[#c20f5e] disabled:opacity-50 text-white font-bold rounded-full text-xs shadow-lg shadow-[#E2136E]/30 flex items-center justify-center gap-2 transition-all cursor-pointer"
                    >
                      <span>{t('confirmOtp')}</span>
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
                      <label htmlFor="payment-pin" className="text-xs font-bold text-surface-700 dark:text-surface-300">
                        {t('enterBkashPin')}
                      </label>
                      {isSandbox && <button
                        type="button"
                        onClick={() => setPin('12345')}
                        className="min-h-11 px-2 text-xs font-bold text-[#E2136E] hover:underline cursor-pointer"
                      >
                        {t('autoFillPin')}
                      </button>}
                    </div>

                    <input
                      id="payment-pin"
                      type="password"
                      required
                      value={pin}
                      onChange={(e) => setPin(e.target.value.replace(/[^0-9]/g, ''))}
                      placeholder="•••••"
                      maxLength={5}
                      autoFocus
                      className="min-h-11 w-full text-center tracking-widest text-2xl font-mono font-black py-3 bg-white dark:bg-[#181F2A] border border-surface-200 dark:border-surface-700 rounded-2xl text-surface-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-[#E2136E]"
                    />
                  </div>

                  <div className="p-3.5 rounded-2xl bg-surface-50 dark:bg-[#181F2A] border border-surface-200 dark:border-surface-800 text-micro text-surface-500 dark:text-surface-400 flex items-center gap-2">
                    <ShieldCheck className="w-4 h-4 text-success-500 shrink-0" />
                    <span>{t('pinSecurityNote')}</span>
                  </div>

                  <div className="pt-2 flex gap-3">
                    <button
                      type="button"
                      onClick={() => setStep('otp')}
                      className="min-h-11 w-1/3 py-3 rounded-full text-xs font-bold text-surface-600 dark:text-surface-400 hover:bg-surface-100 dark:hover:bg-surface-800 transition-colors cursor-pointer"
                    >
                      {t('back')}
                    </button>
                    <button
                      type="submit"
                      disabled={pin.length < 4 || isSubmitting}
                      className="min-h-11 w-2/3 py-3 bg-[#E2136E] hover:bg-[#c20f5e] disabled:opacity-50 text-white font-bold rounded-full text-xs shadow-lg shadow-[#E2136E]/30 flex items-center justify-center gap-2 transition-all cursor-pointer"
                    >
                      <Lock className="w-4 h-4" />
                      <span>{t('confirmAndPay', { amount: formatBDT(paymentAmountBDT) })}</span>
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
                  <h3 className="font-black text-sm">{t('mobileBanking', { provider: selectedChannel.toUpperCase() })}</h3>
                  <p className="text-micro opacity-80">{t('sslcommerzDigitalMfs')}</p>
                </div>
                <div className="text-right font-black text-base">{formatBDT(paymentAmountBDT)}</div>
              </div>

              <div>
                <label htmlFor="alternate-payment-phone" className="block text-xs font-bold text-surface-700 dark:text-surface-300 mb-1.5">
                  {t('providerAccountNumber', { provider: selectedChannel.toUpperCase() })}
                </label>
                <input
                  id="alternate-payment-phone"
                  type="tel"
                  inputMode="tel"
                  autoComplete="tel"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="01XXXXXXXXX"
                  className="min-h-11 w-full px-4 py-3 bg-white dark:bg-[#181F2A] border border-surface-200 dark:border-surface-700 rounded-2xl text-surface-900 dark:text-white font-mono text-sm"
                />
              </div>

              <button
                type="button"
                    onClick={() => void startPayment()}
                disabled={isSubmitting || failureStatus === 'restored'}
                className={`min-h-11 w-full py-3.5 text-white font-bold rounded-full text-xs shadow-lg transition-all cursor-pointer flex items-center justify-center gap-2 disabled:opacity-50 ${
                  selectedChannel === 'nagad' ? 'bg-[#F7941D] hover:bg-[#df8213]' : 'bg-[#8C3494] hover:bg-[#77287e]'
                }`}
              >
                <Lock className="w-4 h-4" />
                <span>{t('authorizeAmountViaProvider', { amount: formatBDT(paymentAmountBDT), provider: selectedChannel.toUpperCase() })}</span>
              </button>
            </div>
          )}

          {/* ================= CARDS GATEWAY ================= */}
          {selectedChannel === 'cards' && (
            <div className="space-y-4">
              <div className="p-4 rounded-2xl bg-gradient-to-r from-brand-700 to-indigo-800 text-white flex items-center justify-between shadow-lg">
                <div className="flex items-center gap-3">
                  <CreditCard className="w-8 h-8 opacity-80" />
                  <div>
                    <h3 className="font-bold text-sm">{t('cardTitle')}</h3>
                    <p className="text-micro opacity-80">{t('supportedCardNetworks')}</p>
                  </div>
                </div>
                <span className="font-black text-base">{formatBDT(paymentAmountBDT)}</span>
                </div>

              <p className="rounded-xl border border-surface-200 bg-surface-50 p-3 text-xs text-surface-600 dark:border-surface-800 dark:bg-[#181F2A] dark:text-surface-300">
                {t('cardDetailsOnGateway')}
              </p>

              <button
                type="button"
                onClick={() => void startPayment()}
                disabled={isSubmitting || failureStatus === 'restored'}
                className="min-h-11 w-full py-3.5 bg-brand-600 hover:bg-brand-500 text-white font-bold rounded-full text-xs shadow-lg shadow-brand-600/30 transition-all cursor-pointer flex items-center justify-center gap-2 disabled:opacity-50"
              >
                <Lock className="w-4 h-4" />
                <span>{t('payAmountViaCard', { amount: formatBDT(paymentAmountBDT) })}</span>
              </button>
            </div>
          )}

          {/* ================= PROCESSING OVERLAY ================= */}
          {step === 'processing' && (
            <div className="absolute inset-0 bg-white/95 dark:bg-[#12161D]/95 backdrop-blur-sm flex flex-col items-center justify-center p-6 text-center space-y-4 animate-in fade-in">
              <div className="w-16 h-16 rounded-full border-4 border-surface-200 border-t-[#E2136E] animate-spin flex items-center justify-center">
                <Lock className="w-6 h-6 text-[#E2136E]" />
              </div>
              <div>
                <h4 className="font-black text-lg text-surface-900 dark:text-white">{t('openingSecureCheckout')}</h4>
                <p className="text-xs text-surface-500 dark:text-surface-400 mt-1">
                  {t('sslcommerzReturnForReceipt')}
                </p>
              </div>
            </div>
          )}

          {/* ================= SUCCESS OVERLAY ================= */}
          {step === 'success' && (
            <div className="absolute inset-0 bg-white dark:bg-[#12161D] flex flex-col items-center justify-center p-6 text-center space-y-4 animate-in zoom-in-95">
              <div className="w-16 h-16 rounded-full bg-success-100 dark:bg-success-950/60 text-success-600 dark:text-success-400 border border-success-300 flex items-center justify-center shadow-lg">
                <CheckCircle2 className="w-9 h-9" />
              </div>
              <div>
                <h4 className="font-black text-xl text-surface-900 dark:text-white">{t('paymentAuthorized')}</h4>
                <p className="text-xs text-surface-500 dark:text-surface-400 mt-1">
                  {t('transactionVerifiedWaybill')}
                </p>
              </div>
            </div>
          )}
        </div>

        {/* Footer Security Badges */}
        <div className="px-6 py-3 bg-surface-50 dark:bg-[#161C24] border-t border-surface-200 dark:border-surface-800 flex items-center justify-between text-micro text-surface-400">
          <div className="flex items-center gap-1.5 text-surface-500 dark:text-surface-400">
            <ShieldCheck className="w-4 h-4 text-success-500" />
            <span>{t('sslcommerzPciCompliant')}</span>
          </div>
          <div className="font-mono text-micro">{t('bangladeshCentralBankRegulated')}</div>
        </div>
      </div>
    </div>
  );
};
