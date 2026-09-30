import React from 'react';
import { Order, Customer } from '../../types';
import { formatCurrency, formatBDT, formatDate } from '../../lib/api';
import { shopNiroLogo } from '../../lib/branding';
import {
  X,
  Printer,
  ShieldCheck,
  CheckCircle2,
  Smartphone,
} from 'lucide-react';

const escapeHtml = (value: unknown): string => {
  const entities: Record<string, string> = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;',
  };
  return String(value ?? '').replace(/[&<>"']/g, (character) => entities[character]);
};

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
    const shippingAddress = order.Shipping_Address;
    const addressLines = [
      shippingAddress.House_Name,
      shippingAddress.Street,
      [shippingAddress.City, shippingAddress.Postal_Code].filter(Boolean).join(' '),
    ].filter(Boolean);
    const itemRows = order.Items.map((item) => `
      <tr>
        <td>
          <strong>${escapeHtml(item.Name)}</strong>
          <span class="item-detail">${item.Quantity} × ${escapeHtml(formatCurrency(item.Price))} each</span>
        </td>
        <td class="number">${escapeHtml(formatBDT(item.Price * item.Quantity))}</td>
      </tr>`).join('');
    const total = order.Subtotal + order.Shipping_Fee;
    const statusLabel = isPaid ? 'Payment received' : 'Payment pending';
    const logoUrl = escapeHtml(new URL(shopNiroLogo, window.location.href).href);
    const customerName = escapeHtml(customer?.Name || 'Customer');
    const contactNumber = customer?.Number ? escapeHtml(customer.Number) : '';
    const addressHtml = addressLines.map((line) => `<div>${escapeHtml(line)}</div>`).join('');
    const orderDate = escapeHtml(formatDate(order.Order_Placed_At));
    const orderId = escapeHtml(order.Order_ID);
    const trackingId = escapeHtml(order.Tracking_ID || 'Not assigned');
    const transactionId = escapeHtml(order.Transaction_ID || 'Not available');
    const paymentMethod = escapeHtml(method.replaceAll('_', ' '));

    const printFrame = document.createElement('iframe');
    printFrame.title = 'ShopNiro receipt print view';
    printFrame.setAttribute('aria-hidden', 'true');
    printFrame.style.position = 'fixed';
    printFrame.style.width = '0';
    printFrame.style.height = '0';
    printFrame.style.border = '0';
    printFrame.onload = () => {
      const printWindow = printFrame.contentWindow;
      if (!printWindow) {
        printFrame.remove();
        return;
      }
      printWindow.addEventListener('afterprint', () => printFrame.remove(), { once: true });
      printWindow.focus();
      printWindow.print();
    };
    printFrame.srcdoc = `<!doctype html>
      <html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>ShopNiro receipt ${orderId}</title>
      <style>
        @page { size: A4; margin: 16mm; }
        * { box-sizing: border-box; }
        body { margin: 0; color: #25251f; background: #f3f2ed; font: 13px/1.5 Arial, Helvetica, sans-serif; }
        .receipt { max-width: 760px; margin: 28px auto; padding: 42px 46px; background: #fff; border: 1px solid #e6e4dc; box-shadow: 0 18px 48px rgba(28, 27, 22, .1); }
        .topline { display: flex; align-items: center; justify-content: space-between; padding-bottom: 24px; border-bottom: 1px solid #e8e6df; }
        .brand { display: flex; align-items: center; gap: 15px; }
        .logo { display: block; width: 72px; height: 72px; object-fit: contain; }
        .brand-name { margin: 0; color: #24241f; font: 24px/1.1 Georgia, 'Times New Roman', serif; }
        .brand-caption { margin-top: 5px; color: #777568; font-size: 11px; }
        .document-label { color: #807653; font-size: 10px; font-weight: 700; letter-spacing: 1.6px; text-align: right; text-transform: uppercase; }
        .document-number { margin-top: 6px; color: #37362e; font: 700 12px/1.3 Arial, sans-serif; text-align: right; }
        .title-row { display: flex; align-items: flex-end; justify-content: space-between; gap: 24px; padding: 25px 0 20px; }
        h1 { margin: 0; color: #24241f; font: 30px/1.1 Georgia, 'Times New Roman', serif; }
        .date { margin-top: 7px; color: #777568; font-size: 12px; }
        .status { flex: 0 0 auto; padding: 7px 12px; border: 1px solid ${isPaid ? '#d5e3d8' : '#eadbbd'}; border-radius: 999px; color: ${isPaid ? '#3c664a' : '#8a6425'}; background: ${isPaid ? '#f1f7f2' : '#fbf6eb'}; font-size: 11px; font-weight: 700; }
        .meta { display: grid; grid-template-columns: 1fr 1fr; gap: 0; margin: 0 0 24px; border: 1px solid #e8e6df; }
        .meta-item { min-width: 0; padding: 13px 15px; border-bottom: 1px solid #e8e6df; }
        .meta-item:nth-child(odd) { border-right: 1px solid #e8e6df; }
        .meta-item:nth-last-child(-n+2) { border-bottom: 0; }
        .label { display: block; margin-bottom: 4px; color: #858275; font-size: 9px; font-weight: 700; letter-spacing: 1px; text-transform: uppercase; }
        .value { color: #2d2c26; font-size: 12px; font-weight: 600; overflow-wrap: anywhere; }
        .section-title { margin: 24px 0 10px; color: #807653; font-size: 10px; font-weight: 700; letter-spacing: 1.3px; text-transform: uppercase; }
        .recipient { padding: 15px 16px; background: #f7f6f2; border-left: 3px solid #aaa17e; }
        .recipient-name { margin-bottom: 5px; color: #282720; font-size: 13px; font-weight: 700; }
        .recipient-address, .recipient-contact { color: #666458; font-size: 12px; }
        table { width: 100%; border-collapse: collapse; }
        thead { display: table-header-group; }
        th { padding: 10px 8px; color: #777568; background: #f7f6f2; font-size: 9px; font-weight: 700; letter-spacing: .8px; text-align: left; text-transform: uppercase; }
        th.number, td.number { text-align: right; white-space: nowrap; }
        td { padding: 13px 8px; border-bottom: 1px solid #eceae4; color: #37362e; vertical-align: top; }
        td strong { display: block; color: #2c2b25; font-size: 12px; font-weight: 600; }
        .item-detail { display: block; margin-top: 3px; color: #828073; font-size: 10px; }
        tr { break-inside: avoid; }
        .totals { width: min(100%, 310px); margin: 18px 0 0 auto; }
        .total-row { display: flex; justify-content: space-between; gap: 18px; padding: 5px 0; color: #68675d; font-size: 12px; }
        .grand-total { margin-top: 7px; padding-top: 12px; border-top: 1px solid #dedbd1; color: #24241f; font-size: 15px; font-weight: 700; }
        .footer { margin-top: 32px; padding-top: 16px; border-top: 1px solid #e8e6df; display: flex; justify-content: space-between; gap: 20px; color: #858275; font-size: 10px; }
        @media print { body { background: #fff; } .receipt { max-width: none; margin: 0; padding: 0; border: 0; box-shadow: none; } }
        @media (max-width: 600px) { .receipt { margin: 0; padding: 24px; } .logo { width: 58px; height: 58px; } h1 { font-size: 25px; } }
      </style></head><body>
        <main class="receipt">
          <header class="topline">
            <div class="brand">
              <img class="logo" src="${logoUrl}" alt="ShopNiro logo">
              <div><p class="brand-name">ShopNiro</p><div class="brand-caption">Shop smart. Ship fast.</div></div>
            </div>
            <div><div class="document-label">Payment receipt</div><div class="document-number">Order ${orderId}</div></div>
          </header>
          <section class="title-row">
            <div><h1>Order receipt</h1><div class="date">Placed ${orderDate}</div></div>
            <div class="status">${statusLabel}</div>
          </section>
          <section class="meta" aria-label="Payment details">
            <div class="meta-item"><span class="label">Payment method</span><span class="value">${paymentMethod}</span></div>
            <div class="meta-item"><span class="label">Transaction ID</span><span class="value">${transactionId}</span></div>
            <div class="meta-item"><span class="label">Order ID</span><span class="value">${orderId}</span></div>
            <div class="meta-item"><span class="label">Tracking ID</span><span class="value">${trackingId}</span></div>
          </section>
          <section>
            <h2 class="section-title">Deliver to</h2>
            <div class="recipient"><div class="recipient-name">${customerName}</div><div class="recipient-address">${addressHtml}</div>${contactNumber ? `<div class="recipient-contact">${contactNumber}</div>` : ''}</div>
          </section>
          <section>
            <h2 class="section-title">Items · ${order.Items.length}</h2>
            <table><thead><tr><th>Product</th><th class="number">Amount</th></tr></thead><tbody>${itemRows}</tbody></table>
          </section>
          <section class="totals" aria-label="Order total">
            <div class="total-row"><span>Subtotal</span><span>${escapeHtml(formatBDT(order.Subtotal))}</span></div>
            <div class="total-row"><span>Delivery</span><span>${order.Shipping_Fee === 0 ? 'Free' : escapeHtml(formatBDT(order.Shipping_Fee))}</span></div>
            <div class="total-row grand-total"><span>Total</span><span>${escapeHtml(formatBDT(total))}</span></div>
          </section>
          <footer class="footer"><span>Thank you for shopping with ShopNiro.</span><span>Questions? Contact ShopNiro support.</span></footer>
        </main>
      </body></html>`;
    document.body.appendChild(printFrame);
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4 overflow-y-auto animate-in fade-in duration-150">
      <div className="bg-white dark:bg-[#12161D] w-full max-w-lg rounded-3xl shadow-2xl border border-sky-100 dark:border-zinc-800 overflow-hidden flex flex-col my-4">
        {/* Receipt Header Banner */}
        <div className="bg-gradient-to-r from-[#0C1014] via-[#12161D] to-[#0C1014] p-6 text-white border-b border-sky-500/20 relative">
          <button
            onClick={onClose}
            className="receipt-screen-only absolute top-4 right-4 p-1.5 rounded-full text-slate-400 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>

          <div className="flex items-center gap-3 mb-3">
            <img src={shopNiroLogo} alt="ShopNiro" className="w-10 h-10 rounded-full object-cover border border-white/20" />
            <div>
              <span className="text-[11px] font-black tracking-widest text-sky-400 uppercase">
                PAYMENT RECEIPT
              </span>
              <div className="text-xs font-semibold text-slate-300">SSLCOMMERZ</div>
            </div>
          </div>

          <h2 className="text-xl font-black text-white">ShopNiro Marketplace BD</h2>
          <p className="text-xs text-slate-400 mt-0.5">
            Order payment and delivery details
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
        <div className="payment-receipt-details p-6 space-y-5 text-xs">
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
            <div className="payment-receipt-items divide-y divide-slate-100 dark:divide-zinc-800 max-h-36 overflow-y-auto pr-1">
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
        <div className="receipt-screen-only px-6 py-4 bg-slate-50 dark:bg-[#161C24] border-t border-slate-200 dark:border-zinc-800 flex items-center justify-between">
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
              <span>Print / Save PDF</span>
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
