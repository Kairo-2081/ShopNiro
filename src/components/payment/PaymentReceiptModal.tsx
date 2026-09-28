import React from 'react';
import { Order, Customer } from '../../types';
import { formatCurrency, formatBDT, formatDate } from '../../lib/api';
import {
  X,
  Printer,
  ShieldCheck,
  CheckCircle2,
  Lock,
  Package,
  MapPin,
  Smartphone,
  ExternalLink,
} from 'lucide-react';

interface PaymentReceiptModalProps {
  isOpen: boolean;
  onClose: () => void;
  order: Order;
  customer?: Customer;
}

export const PaymentReceiptModal: React.FC<PaymentReceiptModalProps> = ({
  isOpen,
  onClose,
  order,
  customer,
}) => {
  if (!isOpen) return null;

  const isPaid = order.Payment_Status === 'paid';
  const method = order.Payment_Method || 'cash_on_delivery';

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4 overflow-y-auto animate-in fade-in duration-150">
      <div className="bg-white dark:bg-[#12161D] w-full max-w-lg rounded-3xl shadow-2xl border border-sky-100 dark:border-zinc-800 overflow-hidden flex flex-col my-4">
        {/* Receipt Header Banner */}
        <div className="bg-gradient-to-r from-[#0C1014] via-[#12161D] to-[#0C1014] p-6 text-white border-b border-sky-500/20 relative">
          <button
            onClick={onClose}
            className="absolute top-4 right-4 p-1.5 rounded-full text-slate-400 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>

          <div className="flex items-center gap-2 mb-2">
            <div className="w-7 h-7 rounded-lg bg-sky-500/20 border border-sky-400/40 flex items-center justify-center text-sky-400">
              <Lock className="w-3.5 h-3.5" />
            </div>
            <span className="text-[11px] font-black tracking-widest text-sky-400 uppercase">
              SSLCOMMERZ OFFICIAL PAYMENT RECEIPT
            </span>
          </div>

          <h2 className="text-xl font-black text-white">GoCart Marketplace BD</h2>
          <p className="text-xs text-slate-400 mt-0.5">
            Verified Electronic Merchant Waybill &amp; Transaction Voucher
          </p>
        </div>

        {/* Status Strip */}
        <div
          className={`px-6 py-3 flex items-center justify-between text-xs font-bold ${
            isPaid
              ? 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border-b border-emerald-200 dark:border-emerald-800'
              : 'bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300 border-b border-amber-200 dark:border-amber-800'
          }`}
        >
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4" />
            <span>
              {isPaid
                ? `PAYMENT VERIFIED VIA ${method.toUpperCase()} (SSLCOMMERZ)`
                : 'PENDING CASH ON DELIVERY'}
            </span>
          </div>
          <span className="font-mono text-[11px]">BDT ৳</span>
        </div>

        {/* Receipt Body */}
        <div className="p-6 space-y-5 text-xs">
          {/* Metadata Grid */}
          <div className="grid grid-cols-2 gap-3 p-4 rounded-2xl bg-slate-50 dark:bg-[#181F2A] border border-slate-200 dark:border-zinc-800">
            <div>
              <span className="text-[10px] text-slate-400 dark:text-zinc-500 uppercase font-bold block">
                Transaction ID
              </span>
              <span className="font-mono font-bold text-slate-900 dark:text-white break-all text-[11px]">
                {order.Transaction_ID || 'N/A (COD)'}
              </span>
            </div>

            <div>
              <span className="text-[10px] text-slate-400 dark:text-zinc-500 uppercase font-bold block">
                Waybill Radar ID
              </span>
              <span className="font-mono font-bold text-blue-600 dark:text-sky-400 text-[11px]">
                {order.Tracking_ID}
              </span>
            </div>

            <div>
              <span className="text-[10px] text-slate-400 dark:text-zinc-500 uppercase font-bold block">
                Timestamp
              </span>
              <span className="text-slate-700 dark:text-zinc-300 font-medium">
                {formatDate(order.Order_Placed_At)}
              </span>
            </div>

            <div>
              <span className="text-[10px] text-slate-400 dark:text-zinc-500 uppercase font-bold block">
                Payment Channel
              </span>
              <span className="font-bold text-slate-900 dark:text-white uppercase">
                {method}
              </span>
            </div>
          </div>

          {/* Customer & Destination */}
          <div className="p-4 rounded-2xl bg-slate-50 dark:bg-[#181F2A] border border-slate-200 dark:border-zinc-800 space-y-1">
            <span className="text-[10px] text-slate-400 dark:text-zinc-500 uppercase font-bold block">
              Recipient &amp; Delivery Destination
            </span>
            <p className="font-bold text-slate-900 dark:text-white">{customer?.Name || 'Marketplace Customer'}</p>
            <p className="text-slate-600 dark:text-zinc-300">
              {order.Shipping_Address.House_Name}, {order.Shipping_Address.Street}, {order.Shipping_Address.City} ({order.Shipping_Address.Postal_Code})
            </p>
            {customer?.Number && (
              <p className="text-slate-500 dark:text-zinc-400 flex items-center gap-1.5 pt-1">
                <Smartphone className="w-3.5 h-3.5 text-[#E2136E]" />
                <span>Contact: {customer.Number}</span>
              </p>
            )}
          </div>

          {/* Purchased Items */}
          <div className="space-y-2">
            <span className="text-[10px] text-slate-400 dark:text-zinc-500 uppercase font-bold block">
              Purchased Items ({order.Items.length})
            </span>
            <div className="divide-y divide-slate-100 dark:divide-zinc-800 max-h-36 overflow-y-auto pr-1">
              {order.Items.map((item, idx) => (
                <div key={idx} className="py-2 flex justify-between items-center text-xs">
                  <div className="truncate max-w-[260px]">
                    <span className="font-medium text-slate-800 dark:text-zinc-200 block truncate">
                      {item.Quantity}x {item.Name}
                    </span>
                    <span className="text-[10px] text-slate-400">
                      {formatCurrency(item.Price)} each
                    </span>
                  </div>
                  <span className="font-bold text-slate-900 dark:text-white">
                    {formatBDT(item.Price * item.Quantity)}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* Amount Calculation */}
          <div className="p-4 rounded-2xl bg-blue-50/50 dark:bg-[#161C24] border border-blue-100 dark:border-blue-900/40 space-y-1.5">
            <div className="flex justify-between text-slate-600 dark:text-zinc-400">
              <span>Subtotal</span>
              <span>{formatCurrency(order.Subtotal)}</span>
            </div>
            <div className="flex justify-between text-slate-600 dark:text-zinc-400">
              <span>Delivery Fee</span>
              <span>{order.Shipping_Fee === 0 ? 'FREE' : formatBDT(order.Shipping_Fee)}</span>
            </div>
            <div className="pt-2 border-t border-blue-200 dark:border-zinc-800 flex justify-between items-baseline font-black">
              <span className="text-slate-900 dark:text-white text-sm">Total Paid</span>
              <div className="text-right">
                <span className="text-blue-600 dark:text-sky-400 text-lg block font-black">
                  {formatCurrency(order.Subtotal + order.Shipping_Fee)}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Modal Actions */}
        <div className="px-6 py-4 bg-slate-50 dark:bg-[#161C24] border-t border-slate-200 dark:border-zinc-800 flex items-center justify-between">
          <div className="flex items-center gap-1.5 text-slate-500 dark:text-zinc-400 text-[11px]">
            <ShieldCheck className="w-4 h-4 text-emerald-500" />
            <span>SSLCOMMERZ Digitally Signed</span>
          </div>

          <div className="flex gap-2">
            <button
              onClick={handlePrint}
              className="px-4 py-2 rounded-full border border-slate-300 dark:border-zinc-700 text-xs font-bold text-slate-700 dark:text-zinc-300 hover:bg-slate-100 dark:hover:bg-zinc-800 flex items-center gap-1.5 transition-colors cursor-pointer"
            >
              <Printer className="w-3.5 h-3.5" />
              <span>Print</span>
            </button>
            <button
              onClick={onClose}
              className="px-5 py-2 rounded-full bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold shadow-md shadow-blue-600/30 transition-all cursor-pointer"
            >
              Done
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
