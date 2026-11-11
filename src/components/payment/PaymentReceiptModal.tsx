import React from 'react';
import { Order, Customer } from '../../types';
import { formatCurrency, formatBDT, formatDate } from '../../lib/api';
import { money } from '../../lib/format';
import { shopNiroLogo } from '../../lib/branding';
import { useFocusTrap } from '../../hooks/useFocusTrap';
import { useLocale } from '../../lib/i18n';
import {
  X,
  Printer,
  Download,
  ShieldCheck,
  CheckCircle2,
  Smartphone,
  Package,
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
  onViewOrder?: () => void;
}

export const PaymentReceiptModal: React.FC<PaymentReceiptModalProps> = ({
  isOpen,
  onClose,
  order,
  customer,
  onViewOrder,
}) => {
  const dialogRef = useFocusTrap<HTMLDivElement>(isOpen);
  const { t, locale } = useLocale();
  if (!isOpen) return null;

  const isPaid = order.Payment_Status === 'paid';
  const method = order.Payment_Method || 'cash_on_delivery';
  const paymentBrand = ({
    bkash: 'bKash',
    nagad: 'Nagad',
    rocket: 'Rocket',
    visa_mastercard: 'Visa / Mastercard',
    cash_on_delivery: t('cashOnDelivery'),
  } as Record<string, string>)[method] || method.replaceAll('_', ' ');

  const createReceiptMarkup = () => {
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
          <span class="item-detail">${item.Quantity} × ${escapeHtml(formatCurrency(item.Price))} ${escapeHtml(t('each'))}</span>
        </td>
        <td class="number">${escapeHtml(formatBDT(item.Price * item.Quantity))}</td>
      </tr>`).join('');
    const total = order.Subtotal + order.Shipping_Fee;
    const statusLabel = isPaid ? t('paymentReceived') : t('paymentPending');
    const logoUrl = escapeHtml(new URL(shopNiroLogo, window.location.href).href);
    const customerName = escapeHtml(customer?.Name || t('customerFallback'));
    const contactNumber = customer?.Number ? escapeHtml(customer.Number) : '';
    const addressHtml = addressLines.map((line) => `<div>${escapeHtml(line)}</div>`).join('');
    const orderDate = escapeHtml(formatDate(order.Order_Placed_At));
    const orderId = escapeHtml(order.Order_ID);
    const trackingId = escapeHtml(order.Tracking_ID || t('trackingUnassigned'));
    const transactionId = escapeHtml(order.Transaction_ID || t('valueNotAvailable'));
    const paymentMethod = escapeHtml(paymentBrand);
    const printText = (key: Parameters<typeof t>[0], values?: Parameters<typeof t>[1]) => escapeHtml(t(key, values));
    const receiptMarkup = `<!doctype html>
      <html lang="${locale}"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>${printText('receiptPageTitle', { orderId })}</title>
      <style>
        @page { size: A4; margin: 16mm; }
        * { box-sizing: border-box; }
        body { margin: 0; color: #25251f; background: #f3f2ed; font: 13px/1.5 Arial, Helvetica, sans-serif; }
        .receipt { max-width: 760px; margin: 28px auto; padding: 42px 46px; background: #fff; border: 1px solid #e6e4dc; box-shadow: 0 18px 48px rgba(28, 27, 22, .1); }
        .topline { display: flex; align-items: center; justify-content: space-between; padding-bottom: 24px; border-bottom: 1px solid #e8e6df; }
        .brand { display: flex; align-items: center; gap: 15px; }
        .logo { display: block; width: 72px; height: 72px; object-fit: contain; }
        .brand-name { margin: 0; color: #24241f; font: 24px/1.1 Georgia, 'Times New Roman', serif; }
        .brand-caption { margin-top: 5px; color: #777568; font-size: 12px; }
        .document-label { color: #807653; font-size: 12px; font-weight: 700; letter-spacing: 1.6px; text-align: right; text-transform: uppercase; }
        .document-number { margin-top: 6px; color: #37362e; font: 700 12px/1.3 Arial, sans-serif; text-align: right; }
        .title-row { display: flex; align-items: flex-end; justify-content: space-between; gap: 24px; padding: 25px 0 20px; }
        h1 { margin: 0; color: #24241f; font: 30px/1.1 Georgia, 'Times New Roman', serif; }
        .date { margin-top: 7px; color: #777568; font-size: 12px; }
        .status { flex: 0 0 auto; padding: 7px 12px; border: 1px solid ${isPaid ? '#d5e3d8' : '#eadbbd'}; border-radius: 999px; color: ${isPaid ? '#3c664a' : '#8a6425'}; background: ${isPaid ? '#f1f7f2' : '#fbf6eb'}; font-size: 12px; font-weight: 700; }
        .meta { display: grid; grid-template-columns: 1fr 1fr; gap: 0; margin: 0 0 24px; border: 1px solid #e8e6df; }
        .meta-item { min-width: 0; padding: 13px 15px; border-bottom: 1px solid #e8e6df; }
        .meta-item:nth-child(odd) { border-right: 1px solid #e8e6df; }
        .meta-item:nth-last-child(-n+2) { border-bottom: 0; }
        .label { display: block; margin-bottom: 4px; color: #68675d; font-size: 12px; font-weight: 700; letter-spacing: 1px; text-transform: uppercase; }
        .value { color: #2d2c26; font-size: 12px; font-weight: 600; overflow-wrap: anywhere; }
        .section-title { margin: 24px 0 10px; color: #807653; font-size: 12px; font-weight: 700; letter-spacing: 1.3px; text-transform: uppercase; }
        .recipient { padding: 15px 16px; background: #f7f6f2; border-left: 3px solid #aaa17e; }
        .recipient-name { margin-bottom: 5px; color: #282720; font-size: 13px; font-weight: 700; }
        .recipient-address, .recipient-contact { color: #666458; font-size: 12px; }
        table { width: 100%; border-collapse: collapse; }
        thead { display: table-header-group; }
        th { padding: 10px 8px; color: #666458; background: #f7f6f2; font-size: 12px; font-weight: 700; letter-spacing: .8px; text-align: left; text-transform: uppercase; }
        th.number, td.number { text-align: right; white-space: nowrap; }
        td { padding: 13px 8px; border-bottom: 1px solid #eceae4; color: #37362e; vertical-align: top; }
        td strong { display: block; color: #2c2b25; font-size: 12px; font-weight: 600; }
        .item-detail { display: block; margin-top: 3px; color: #666458; font-size: 12px; }
        tr { break-inside: avoid; }
        .totals { width: min(100%, 310px); margin: 18px 0 0 auto; }
        .total-row { display: flex; justify-content: space-between; gap: 18px; padding: 5px 0; color: #68675d; font-size: 12px; }
        .grand-total { margin-top: 7px; padding-top: 12px; border-top: 1px solid #dedbd1; color: #24241f; font-size: 15px; font-weight: 700; }
        .footer { margin-top: 32px; padding-top: 16px; border-top: 1px solid #e8e6df; display: flex; justify-content: space-between; gap: 20px; color: #68675d; font-size: 12px; }
        @media print { body { background: #fff; } .receipt { max-width: none; margin: 0; padding: 0; border: 0; box-shadow: none; } }
        @media (max-width: 600px) { .receipt { margin: 0; padding: 24px; } .logo { width: 58px; height: 58px; } h1 { font-size: 25px; } }
      </style></head><body>
        <main class="receipt">
          <header class="topline">
            <div class="brand">
              <img class="logo" src="${logoUrl}" alt="ShopNiro">
              <div><p class="brand-name">ShopNiro</p><div class="brand-caption">${printText('shopSmartShipFast')}</div></div>
            </div>
            <div><div class="document-label">${printText('paymentReceiptTitle')}</div><div class="document-number">${printText('orderLabel')} ${orderId}</div></div>
          </header>
          <section class="title-row">
            <div><h1>${printText('orderReceiptTitle')}</h1><div class="date">${printText('placedOn')} ${orderDate}</div></div>
            <div class="status">${statusLabel}</div>
          </section>
          <section class="meta" aria-label="${printText('paymentDetailsTitle')}">
            <div class="meta-item"><span class="label">${printText('receiptPaymentMethod')}</span><span class="value">${paymentMethod}</span></div>
            <div class="meta-item"><span class="label">${printText('transactionId')}</span><span class="value">${transactionId}</span></div>
            <div class="meta-item"><span class="label">${printText('orderId')}</span><span class="value">${orderId}</span></div>
            <div class="meta-item"><span class="label">${printText('trackingId')}</span><span class="value">${trackingId}</span></div>
          </section>
          <section>
            <h2 class="section-title">${printText('deliverTo')}</h2>
            <div class="recipient"><div class="recipient-name">${customerName}</div><div class="recipient-address">${addressHtml}</div>${contactNumber ? `<div class="recipient-contact">${contactNumber}</div>` : ''}</div>
          </section>
          <section>
            <h2 class="section-title">${printText('receiptItemsCount', { count: order.Items.length })}</h2>
            <table><thead><tr><th>${printText('product')}</th><th class="number">${printText('amount')}</th></tr></thead><tbody>${itemRows}</tbody></table>
          </section>
          <section class="totals" aria-label="${printText('total')}">
            <div class="total-row"><span>${printText('subtotal')}</span><span>${escapeHtml(formatBDT(order.Subtotal))}</span></div>
            <div class="total-row"><span>${printText('delivery')}</span><span>${order.Shipping_Fee === 0 ? printText('free') : escapeHtml(formatBDT(order.Shipping_Fee))}</span></div>
            <div class="total-row grand-total"><span>${printText('total')}</span><span>${escapeHtml(formatBDT(total))}</span></div>
          </section>
          <footer class="footer"><span>${printText('receiptThankYou')}</span><span>${printText('receiptQuestions')}</span></footer>
        </main>
      </body></html>`;

    return receiptMarkup;
  };

  const handlePrint = () => {
    const receiptMarkup = createReceiptMarkup();
    const printWindow = window.open('', '_blank', 'noopener,noreferrer');
    if (!printWindow) {
      if (typeof window.print === 'function') {
        window.print();
      }
      return;
    }

    printWindow.document.open();
    printWindow.document.write(receiptMarkup);
    printWindow.document.close();

    window.setTimeout(() => {
      try {
        printWindow.focus();
        if (typeof printWindow.print === 'function') {
          printWindow.print();
        }
      } catch {
        if (typeof window.print === 'function') {
          window.print();
        }
      }
    }, 300);
  };

  const handleDownload = () => {
    const receiptBlob = new Blob([createReceiptMarkup()], { type: 'text/html;charset=utf-8' });
    const receiptUrl = URL.createObjectURL(receiptBlob);
    const link = document.createElement('a');
    link.href = receiptUrl;
    link.download = `ShopNiro-receipt-${order.Order_ID}.html`;
    link.click();
    window.setTimeout(() => URL.revokeObjectURL(receiptUrl), 0);
  };

  const total = order.Subtotal + order.Shipping_Fee;

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4 overflow-y-auto animate-in fade-in duration-150">
      <div ref={dialogRef} role="dialog" aria-modal="true" aria-labelledby="payment-receipt-title" tabIndex={-1} onKeyDown={(event) => { if (event.key === 'Escape') onClose(); }} className="bg-white dark:bg-[#12161D] w-full max-w-lg rounded-3xl shadow-2xl border border-brand-100 dark:border-surface-800 overflow-hidden flex flex-col my-4">
        {/* Receipt Header Banner */}
        <div className="bg-gradient-to-r from-[#0C1014] via-[#12161D] to-[#0C1014] p-6 text-white border-b border-brand-500/20 relative">
          <button
            onClick={onClose}
            aria-label={t('closeReceipt')}
            className="receipt-screen-only absolute right-4 top-4 grid h-11 w-11 place-items-center rounded-full text-surface-300 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>

          <div className="flex items-center gap-3 mb-3">
            <img src={shopNiroLogo} alt="ShopNiro" className="w-10 h-10 rounded-full object-cover border border-white/20" />
            <div>
              <span className="text-micro font-black tracking-widest text-brand-400 uppercase">
                {t('paymentReceiptTitle')}
              </span>
              <div className="text-xs font-semibold text-surface-300">SSLCOMMERZ</div>
            </div>
          </div>

          <h2 id="payment-receipt-title" className="text-xl font-black text-white">ShopNiro Marketplace BD</h2>
          <p className="text-xs text-surface-400 mt-0.5">
            {t('orderLabel')} {order.Order_ID} · {paymentBrand} · {money(total)}
          </p>
        </div>

        {/* Status Strip */}
        <div
          className={`px-6 py-3 flex items-center justify-between text-xs font-bold ${
            isPaid
              ? 'bg-success-50 dark:bg-success-950/40 text-success-700 dark:text-success-300 border-b border-success-200 dark:border-success-800'
              : 'bg-warning-50 dark:bg-warning-950/40 text-warning-700 dark:text-warning-300 border-b border-warning-200 dark:border-warning-800'
          }`}
        >
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4" />
            <span>
              {isPaid
                ? t('paymentVerifiedVia', { method: paymentBrand })
                : t('pendingCashOnDelivery')}
            </span>
          </div>
          <span className="font-mono text-micro">{money(total)}</span>
        </div>

        {/* Receipt Body */}
        <div className="payment-receipt-details p-6 space-y-5 text-xs">
          {/* Metadata Grid */}
          <div className="grid grid-cols-2 gap-3 p-4 rounded-2xl bg-surface-50 dark:bg-[#181F2A] border border-surface-200 dark:border-surface-800">
            <div>
              <span className="text-micro text-surface-500 dark:text-surface-500 uppercase font-bold block">
                {t('transactionId')}
              </span>
              <span className="font-mono font-bold text-surface-900 dark:text-white break-all text-micro">
                {order.Transaction_ID || t('notApplicableCashOnDelivery')}
              </span>
            </div>

            <div>
              <span className="text-micro text-surface-500 dark:text-surface-500 uppercase font-bold block">
                {t('waybillRadarId')}
              </span>
              <span className="font-mono font-bold text-brand-600 dark:text-brand-400 text-micro">
                {order.Tracking_ID}
              </span>
            </div>

            <div>
              <span className="text-micro text-surface-500 dark:text-surface-500 uppercase font-bold block">
                {t('timestamp')}
              </span>
              <span className="text-surface-700 dark:text-surface-300 font-medium">
                {formatDate(order.Order_Placed_At)}
              </span>
            </div>

            <div>
              <span className="text-micro text-surface-500 dark:text-surface-500 uppercase font-bold block">
                {t('paymentChannel')}
              </span>
              <span className="font-bold text-surface-900 dark:text-white">
                  {paymentBrand}
              </span>
            </div>
          </div>

          {/* Customer & Destination */}
          <div className="p-4 rounded-2xl bg-surface-50 dark:bg-[#181F2A] border border-surface-200 dark:border-surface-800 space-y-1">
            <span className="text-micro text-surface-500 dark:text-surface-500 uppercase font-bold block">
              {t('recipientDeliveryDestination')}
            </span>
            <p className="font-bold text-surface-900 dark:text-white">{customer?.Name || t('marketplaceCustomer')}</p>
            <p className="text-surface-600 dark:text-surface-300">
              {order.Shipping_Address.House_Name}, {order.Shipping_Address.Street}, {order.Shipping_Address.City} ({order.Shipping_Address.Postal_Code})
            </p>
            {customer?.Number && (
              <p className="text-surface-500 dark:text-surface-400 flex items-center gap-1.5 pt-1">
                <Smartphone className="w-3.5 h-3.5 text-[#E2136E]" />
                <span>{t('contactLabel', { number: customer.Number })}</span>
              </p>
            )}
          </div>

          {/* Purchased Items */}
          <div className="space-y-2">
            <span className="text-micro text-surface-500 dark:text-surface-500 uppercase font-bold block">
              {t('purchasedItemsCount', { count: order.Items.length })}
            </span>
            <div className="payment-receipt-items divide-y divide-surface-100 dark:divide-surface-800 max-h-36 overflow-y-auto pr-1">
              {order.Items.map((item, idx) => (
                <div key={idx} className="py-2 flex justify-between items-center text-xs">
                  <div className="truncate max-w-[260px]">
                    <span className="font-medium text-surface-800 dark:text-surface-200 block truncate">
                      {item.Quantity}x {item.Name}
                    </span>
                    <span className="text-micro text-surface-400">
                      {formatCurrency(item.Price)} {t('each')}
                    </span>
                  </div>
                  <span className="font-bold text-surface-900 dark:text-white">
                    {formatBDT(item.Price * item.Quantity)}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* Amount Calculation */}
          <div className="p-4 rounded-2xl bg-brand-50/50 dark:bg-[#161C24] border border-brand-100 dark:border-brand-900/40 space-y-1.5">
            <div className="flex justify-between text-surface-600 dark:text-surface-400">
              <span>{t('subtotal')}</span>
              <span>{formatCurrency(order.Subtotal)}</span>
            </div>
            <div className="flex justify-between text-surface-600 dark:text-surface-400">
              <span>{t('deliveryFee')}</span>
              <span>{order.Shipping_Fee === 0 ? t('freeUpper') : formatBDT(order.Shipping_Fee)}</span>
            </div>
            <div className="pt-2 border-t border-brand-200 dark:border-surface-800 flex justify-between items-baseline font-black">
              <span className="text-surface-900 dark:text-white text-sm">{t('totalPaid')}</span>
              <div className="text-right">
                <span className="text-brand-600 dark:text-brand-400 text-lg block font-black">
                  {formatCurrency(order.Subtotal + order.Shipping_Fee)}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Modal Actions */}
        <div className="receipt-screen-only flex flex-wrap items-center justify-between gap-3 border-t border-surface-200 bg-surface-50 px-6 py-4 dark:border-surface-800 dark:bg-[#161C24]">
          <div className="flex items-center gap-1.5 text-surface-500 dark:text-surface-400 text-micro">
            <ShieldCheck className="w-4 h-4 text-success-500" />
            <span>{t('sslcommerzDigitallySigned')}</span>
          </div>

          <div className="flex gap-2">
            {onViewOrder && (
              <button
                type="button"
                onClick={onViewOrder}
                className="px-4 py-2 rounded-full border border-surface-300 dark:border-surface-700 text-xs font-bold text-surface-700 dark:text-surface-300 hover:bg-surface-100 dark:hover:bg-surface-800 flex items-center gap-1.5 transition-colors cursor-pointer"
              >
                <Package className="w-3.5 h-3.5" />
                <span>{t('trackOrder')}</span>
              </button>
            )}
            <button
              type="button"
              onClick={handleDownload}
              className="min-h-11 min-w-11 rounded-full border border-surface-300 px-3 text-xs font-bold text-surface-700 transition-colors hover:bg-surface-100 dark:border-surface-700 dark:text-surface-300 dark:hover:bg-surface-800"
              aria-label={t('downloadReceiptAsHtml')}
              title={t('downloadReceipt')}
            >
              <Download className="h-4 w-4" />
            </button>
            <button
              onClick={handlePrint}
              className="px-4 py-2 rounded-full border border-surface-300 dark:border-surface-700 text-xs font-bold text-surface-700 dark:text-surface-300 hover:bg-surface-100 dark:hover:bg-surface-800 flex items-center gap-1.5 transition-colors cursor-pointer"
            >
              <Printer className="w-3.5 h-3.5" />
              <span>{t('printSavePdf')}</span>
            </button>
            <button
              onClick={onClose}
              className="px-5 py-2 rounded-full bg-brand-600 hover:bg-brand-500 text-white text-xs font-bold shadow-md shadow-brand-600/30 transition-all cursor-pointer"
            >
              {t('done')}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
