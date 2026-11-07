import React from 'react';
import { Banknote, CheckCircle2, Package, RotateCcw, X, XCircle } from 'lucide-react';
import { formatBDT } from '../../lib/api';
import type { Order } from '../../types';
import { useFocusTrap } from '../../hooks/useFocusTrap';

export type PaymentResultStatus = 'paid' | 'failed' | 'cancelled';

interface PaymentResultModalProps {
  status: PaymentResultStatus;
  orderId: string;
  order?: Order | null;
  onAction: () => void;
}

const presentations = {
  paid: {
    title: 'Payment complete',
    description: 'Your payment is confirmed. Your order is ready to track.',
    action: 'View order',
    Icon: CheckCircle2,
    ActionIcon: Package,
    tone: 'text-success-700 dark:text-success-300 bg-success-100 dark:bg-success-950/60 border-success-200 dark:border-success-800',
  },
  failed: {
    title: 'Payment failed',
    description: 'Your items are back in your cart. You can try another payment method.',
    action: 'Try again',
    Icon: XCircle,
    ActionIcon: RotateCcw,
    tone: 'text-danger-700 dark:text-danger-300 bg-danger-100 dark:bg-danger-950/60 border-danger-200 dark:border-danger-800',
  },
  cancelled: {
    title: 'Payment cancelled',
    description: 'Your items are back in your cart. You can place the order with cash on delivery.',
    action: 'Choose cash on delivery',
    Icon: X,
    ActionIcon: Banknote,
    tone: 'text-surface-700 dark:text-surface-200 bg-surface-100 dark:bg-surface-800 border-surface-300 dark:border-surface-700',
  },
} as const;

const paymentMethodLabels: Record<string, string> = {
  bkash: 'bKash',
  nagad: 'Nagad',
  rocket: 'Rocket',
  visa_mastercard: 'Visa / Mastercard',
  sslcommerz: 'SSLCOMMERZ',
  cash_on_delivery: 'Cash on delivery',
};

export const PaymentResultModal: React.FC<PaymentResultModalProps> = ({ status, orderId, order, onAction }) => {
  const dialogRef = useFocusTrap<HTMLDivElement>(true);
  const presentation = presentations[status];
  const Icon = presentation.Icon;
  const ActionIcon = presentation.ActionIcon;
  const paymentMethod = order?.Payment_Method || 'sslcommerz';
  const paymentMethodLabel = paymentMethodLabels[paymentMethod] || paymentMethod.replaceAll('_', ' ');
  const total = order ? Number(order.Subtotal) + Number(order.Shipping_Fee) : null;

  return (
    <div className="fixed inset-0 z-[60] grid place-items-center overflow-y-auto bg-black/75 p-4 backdrop-blur-xs">
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="payment-result-title"
        tabIndex={-1}
        className="w-full max-w-md rounded-2xl border border-surface-200 bg-white p-6 shadow-2xl dark:border-surface-800 dark:bg-[#12161D] sm:p-8"
      >
        <div className={`mx-auto grid h-14 w-14 place-items-center rounded-full border ${presentation.tone}`}>
          <Icon aria-hidden="true" className="h-7 w-7" />
        </div>
        <h1 id="payment-result-title" className="mt-4 text-center text-2xl font-bold text-surface-900 dark:text-white">
          {presentation.title}
        </h1>
        <p className="mx-auto mt-2 max-w-sm text-center text-sm leading-6 text-surface-600 dark:text-surface-300">
          {presentation.description}
        </p>

        <dl className="mt-6 space-y-3 rounded-xl border border-surface-200 bg-surface-50 p-4 text-sm dark:border-surface-800 dark:bg-[#181F2A]">
          <div className="flex items-start justify-between gap-4">
            <dt className="text-surface-500 dark:text-surface-400">Order number</dt>
            <dd className="break-all text-right font-mono font-semibold text-surface-900 dark:text-white">{orderId}</dd>
          </div>
          <div className="flex items-start justify-between gap-4">
            <dt className="text-surface-500 dark:text-surface-400">Payment method</dt>
            <dd className="text-right font-semibold text-surface-900 dark:text-white">{paymentMethodLabel}</dd>
          </div>
          {total !== null && (
            <div className="flex items-start justify-between gap-4 border-t border-surface-200 pt-3 dark:border-surface-700">
              <dt className="font-semibold text-surface-700 dark:text-surface-300">Amount</dt>
              <dd className="font-bold tabular-nums text-surface-900 dark:text-white">{formatBDT(total)}</dd>
            </div>
          )}
        </dl>

        <button
          type="button"
          onClick={onAction}
          className="mt-6 inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-full bg-brand-700 px-5 py-3 text-sm font-bold text-white transition-colors hover:bg-brand-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 focus-visible:ring-offset-2"
        >
          <ActionIcon aria-hidden="true" className="h-4 w-4" />
          {presentation.action}
        </button>
      </div>
    </div>
  );
};
