import React from 'react';
import { CartItem } from '../../types';
import { formatCurrency } from '../../lib/api';
import { calculateLineItemsSubtotal, calculateOrderTotal, fromPaisa, shippingFeeCentsFor, toPaisa, FREE_SHIPPING_THRESHOLD_CENTS } from '../../lib/checkoutPricing';
import { X, Trash2, Plus, Minus, ShoppingCart, ArrowRight, ShieldCheck } from 'lucide-react';
import { useFocusTrap } from '../../hooks/useFocusTrap';
import { useLocale } from '../../lib/i18n';

interface CartDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  isLoading?: boolean;
  cartItems: CartItem[];
  onUpdateQuantity: (cartId: string, quantity: number) => void;
  onRemoveItem: (cartId: string) => void;
  onCheckout: () => void;
}

export const CartDrawer: React.FC<CartDrawerProps> = ({
  isOpen,
  onClose,
  isLoading = false,
  cartItems,
  onUpdateQuantity,
  onRemoveItem,
  onCheckout,
}) => {
  const { t } = useLocale();
  const [shouldRender, setShouldRender] = React.useState(isOpen);
  const [visible, setVisible] = React.useState(isOpen);
  const drawerRef = useFocusTrap<HTMLElement>(isOpen);

  React.useEffect(() => {
    if (isOpen) {
      setShouldRender(true);
      const frame = requestAnimationFrame(() => setVisible(true));
      return () => cancelAnimationFrame(frame);
    }

    setVisible(false);
    const timer = window.setTimeout(() => setShouldRender(false), 250);
    return () => window.clearTimeout(timer);
  }, [isOpen]);

  if (!shouldRender) return null;

  const subtotal = calculateLineItemsSubtotal(cartItems.map((item) => ({
    unitPrice: Number(item.Product?.Price) || 0,
    quantity: item.Quantity,
  })));
  const shippingFee = fromPaisa(shippingFeeCentsFor(toPaisa(subtotal)));
  const freeShippingThreshold = fromPaisa(FREE_SHIPPING_THRESHOLD_CENTS);
  const total = calculateOrderTotal(subtotal, shippingFee);

  return (
    <div
      className={`fixed inset-0 z-50 flex justify-end bg-black/65 transition-opacity duration-250 ${visible ? 'opacity-100' : 'opacity-0'}`}
      onClick={onClose}
    >
      <aside
        ref={drawerRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="cart-drawer-title"
        tabIndex={-1}
        onKeyDown={(event) => { if (event.key === 'Escape') onClose(); }}
        className={`w-full max-w-md h-full shadow-2xl flex flex-col border-l border-surface-200 dark:border-surface-800 bg-white dark:bg-[#12161D] transition-transform duration-300 ease-[cubic-bezier(.22,1,.36,1)] ${visible ? 'translate-x-0' : 'translate-x-full'}`}
        onClick={(event) => event.stopPropagation()}
      >
        <div className="px-4 pt-4 pb-3 border-b border-surface-100 dark:border-surface-800 bg-surface-50/50 dark:bg-[#161C24]/80">
          <div className="flex gap-2 mb-3">
            {['Apple Pay', 'Google Pay'].map((pay) => (
              <button
                key={pay}
                type="button"
                aria-label={pay}
                className="pay-pill flex-1 py-2 px-2 rounded-full border border-surface-200 dark:border-surface-700 bg-white dark:bg-[#1C2430] text-micro font-bold text-surface-700 dark:text-surface-200 hover:border-surface-300 dark:hover:border-surface-600 transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500/20"
              >
                {pay}
              </button>
            ))}
          </div>
        </div>

        {/* Header */}
        <div className="px-6 py-4 border-b border-surface-100 dark:border-surface-800 flex items-center justify-between bg-surface-50/50 dark:bg-[#161C24]/80">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-full bg-brand-600/10 dark:bg-brand-950 flex items-center justify-center text-brand-600 dark:text-brand-400">
              <ShoppingCart className="w-4 h-4" />
            </div>
            <h2 id="cart-drawer-title" className="font-bold text-surface-900 dark:text-white text-base">{t('cartTitle')}</h2>
            <span className="bg-brand-100 dark:bg-brand-950 text-brand-700 dark:text-brand-300 text-xs font-bold px-2.5 py-0.5 rounded-full border border-brand-200 dark:border-brand-900">
              {cartItems.length}
            </span>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label={t('closeCart')}
            className="grid h-11 w-11 place-items-center rounded-full text-surface-600 hover:text-surface-900 dark:text-surface-300 dark:hover:text-white hover:bg-surface-100 dark:hover:bg-surface-800 transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500/20"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Item list */}
        <div className="flex-1 overflow-y-auto p-6 space-y-4">
          {isLoading ? (
            <div role="status" aria-label={t('loadingCartItems')} aria-busy="true" className="space-y-4">
              {Array.from({ length: 3 }, (_, index) => (
                <div key={index} className="flex items-center gap-3 rounded-xl border border-[#a99b72]/15 p-3.5">
                  <div className="premium-skeleton h-16 w-16 shrink-0 rounded-xl" />
                  <div className="min-w-0 flex-1 space-y-2">
                    <div className="premium-skeleton h-3 w-4/5 rounded-full" />
                    <div className="premium-skeleton h-3 w-2/5 rounded-full" />
                    <div className="premium-skeleton h-7 w-24 rounded-full" />
                  </div>
                </div>
              ))}
            </div>
          ) : cartItems.length === 0 ? (
            <div className="text-center py-16 space-y-3">
              <div className="w-16 h-16 bg-surface-100 dark:bg-[#181F2A] rounded-2xl flex items-center justify-center mx-auto text-surface-500 dark:text-surface-500">
                <ShoppingCart className="w-8 h-8" />
              </div>
              <p className="font-bold text-surface-700 dark:text-surface-300">{t('emptyCart')}</p>
              <p className="text-sm text-surface-700 dark:text-surface-300">{t('emptyCartPrompt')}</p>
              <button type="button" onClick={onClose} className="min-h-11 rounded-full bg-brand-700 px-5 font-bold text-white">{t('browseProducts')}</button>
            </div>
          ) : (
            cartItems.map((item) => {
              const product = item.Product;
              if (!product) return null;

              return (
                <div
                  key={item.Cart_ID}
                  className="p-3.5 rounded-2xl bg-surface-50 dark:bg-[#161C24] border border-surface-200 dark:border-surface-800 flex gap-3 items-center"
                >
                  {product.Image ? (
                    <img
                      src={product.Image}
                      alt={product.Name}
                      referrerPolicy="no-referrer"
                      className="w-16 h-16 rounded-xl object-cover bg-white dark:bg-[#0C1014] border border-surface-200 dark:border-surface-700 shrink-0"
                    />
                  ) : (
                    <div className="flex h-16 w-16 items-center justify-center rounded-xl border border-surface-200 bg-gradient-to-br from-surface-200 to-surface-100 text-surface-500 dark:border-surface-700 dark:from-surface-700 dark:to-surface-800 dark:text-surface-300">
                      <ShoppingCart className="h-5 w-5" />
                    </div>
                  )}
                  <div className="flex-1 min-w-0">
                    <h4 className="font-bold text-xs text-surface-900 dark:text-white truncate">
                      {product.Name}
                    </h4>
                    {item.Size && <span className="mt-0.5 block text-micro font-semibold text-surface-500 dark:text-surface-400">{t('sizeLabel')}: {item.Size}</span>}
                    <span className="text-xs font-black text-brand-600 dark:text-brand-400 block mt-0.5">
                      {formatCurrency(Number(product.Price) || 0)}
                    </span>

                    {/* Quantity Controls */}
                    <div className="flex items-center gap-3 mt-2">
                      <div className="flex items-center border border-surface-200 dark:border-surface-700 rounded-full bg-white dark:bg-[#181F2A] overflow-hidden text-xs">
                        <button
                          type="button"
                          onClick={() => onUpdateQuantity(item.Cart_ID, item.Quantity - 1)}
                          aria-label={`${t('decreaseQuantity')} ${product.Name}`}
                          className="px-2.5 py-0.5 hover:bg-surface-100 dark:hover:bg-surface-800 text-surface-600 dark:text-surface-300 font-bold cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500/20"
                        >
                          <Minus className="w-3 h-3" />
                        </button>
                        <span className="px-2 font-bold text-surface-900 dark:text-white">
                          {item.Quantity}
                        </span>
                        <button
                          type="button"
                          onClick={() => onUpdateQuantity(item.Cart_ID, item.Quantity + 1)}
                          aria-label={`${t('increaseQuantity')} ${product.Name}`}
                          disabled={item.Quantity >= Number(product.Stock)}
                          className="px-2.5 py-0.5 hover:bg-surface-100 dark:hover:bg-surface-800 disabled:opacity-40 disabled:cursor-not-allowed text-surface-600 dark:text-surface-300 font-bold cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500/20"
                        >
                          <Plus className="w-3 h-3" />
                        </button>
                      </div>

                      <button
                        type="button"
                        onClick={() => onRemoveItem(item.Cart_ID)}
                        aria-label={`${t('removeFromCart')}: ${product.Name}`}
                        className="text-surface-400 hover:text-danger-500 transition-colors p-1 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500/20"
                        title={t('remove')}
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>

                  <div className="text-right font-black text-xs text-surface-900 dark:text-white">
                    {formatCurrency((Number(product.Price) || 0) * item.Quantity)}
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Footer summary & Checkout */}
        {cartItems.length > 0 && (
          <div className="p-6 border-t border-surface-100 dark:border-surface-800 bg-surface-50/50 dark:bg-[#161C24]/80 space-y-4">
            <div className="space-y-2 text-xs">
              <div className="flex justify-between text-surface-600 dark:text-surface-400">
                <span>{t('subtotal')}</span>
                <span className="font-semibold text-surface-900 dark:text-white">
                  {formatCurrency(subtotal)}
                </span>
              </div>
              <div className="flex justify-between text-surface-600 dark:text-surface-400">
                <span>{t('shippingFee')}</span>
                <span className="font-semibold text-surface-900 dark:text-white">
                  {shippingFee === 0 ? (
                    <strong className="text-success-500 font-bold">{t('free')}</strong>
                  ) : (
                    formatCurrency(shippingFee)
                  )}
                </span>
              </div>
              {subtotal > 0 && subtotal < freeShippingThreshold && (
                <div className="space-y-2 pt-1">
                  <div className="flex items-center justify-between text-micro text-surface-500 dark:text-surface-400">
                    <span>{t('freeShippingProgress')}</span>
                    <span>{Math.min(100, Math.round((subtotal / freeShippingThreshold) * 100))}%</span>
                  </div>
                  <div className="h-2 w-full rounded-full bg-surface-200 dark:bg-surface-800 overflow-hidden">
                    <div
                      className="h-full rounded-full bg-gradient-to-r from-success-500 to-brand-500 transition-all duration-500"
                      style={{ width: `${Math.min(100, (subtotal / freeShippingThreshold) * 100)}%` }}
                    />
                  </div>
                  <p className="text-micro text-surface-500 dark:text-surface-400 italic">
                    {formatCurrency(freeShippingThreshold - subtotal)} {t('addForFreeShipping')}!
                  </p>
                </div>
              )}
              <div className="pt-2 border-t border-surface-200 dark:border-surface-700 flex justify-between text-sm font-bold text-surface-900 dark:text-white">
                <span>{t('total')}</span>
                <span className="text-brand-600 dark:text-brand-400 text-base font-black">
                  {formatCurrency(total)}
                </span>
              </div>
            </div>

            <button
              type="button"
              onClick={() => {
                onClose();
                onCheckout();
              }}
              className="w-full py-3.5 px-4 bg-brand-600 hover:bg-brand-500 text-white font-bold rounded-full shadow-lg shadow-brand-600/30 flex items-center justify-center gap-2 transition-all active:scale-98 text-sm cursor-pointer"
            >
              <span>{t('proceedToCheckout')}</span>
              <ArrowRight className="w-4 h-4" />
            </button>

            <div className="flex items-center justify-center gap-1.5 text-micro text-surface-500 dark:text-surface-500">
              <ShieldCheck className="w-3.5 h-3.5 text-success-500" />
              <span>{t('secureCheckout')}</span>
            </div>
          </div>
        )}
      </aside>
    </div>
  );
};
