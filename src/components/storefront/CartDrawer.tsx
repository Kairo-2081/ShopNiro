import React from 'react';
import { CartItem } from '../../types';
import { formatCurrency } from '../../lib/api';
import { X, Trash2, Plus, Minus, ShoppingCart, ArrowRight, ShieldCheck } from 'lucide-react';

interface CartDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  cartItems: CartItem[];
  onUpdateQuantity: (cartId: string, quantity: number) => void;
  onRemoveItem: (cartId: string) => void;
  onCheckout: () => void;
}

export const CartDrawer: React.FC<CartDrawerProps> = ({
  isOpen,
  onClose,
  cartItems,
  onUpdateQuantity,
  onRemoveItem,
  onCheckout,
}) => {
  if (!isOpen) return null;

  const defaultPlaceholder = 'https://images.unsplash.com/photo-1526170375885-4d8ecf77b99f?w=600&auto=format&fit=crop&q=80';

  const subtotal = cartItems.reduce((acc, item) => {
    const price = Number(item.Product?.Price) || 0;
    return acc + price * item.Quantity;
  }, 0);

  const shippingFee = subtotal > 150 ? 0 : subtotal > 0 ? 5.0 : 0;
  const total = subtotal + shippingFee;

  return (
    <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-xs flex justify-end animate-in fade-in duration-150">
      <div className="bg-white dark:bg-[#12161D] w-full max-w-md h-full shadow-2xl flex flex-col border-l border-slate-200 dark:border-zinc-800">
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-100 dark:border-zinc-800 flex items-center justify-between bg-slate-50/50 dark:bg-[#161C24]/80">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-full bg-blue-600/10 dark:bg-blue-950 flex items-center justify-center text-blue-600 dark:text-sky-400">
              <ShoppingCart className="w-4 h-4" />
            </div>
            <h2 className="font-bold text-slate-900 dark:text-white text-base">Your Cart</h2>
            <span className="bg-blue-100 dark:bg-blue-950 text-blue-700 dark:text-sky-300 text-xs font-bold px-2.5 py-0.5 rounded-full border border-blue-200 dark:border-blue-900">
              {cartItems.length}
            </span>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-full text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-zinc-800 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Item list */}
        <div className="flex-1 overflow-y-auto p-6 space-y-4">
          {cartItems.length === 0 ? (
            <div className="text-center py-16 space-y-3">
              <div className="w-16 h-16 bg-slate-100 dark:bg-[#181F2A] rounded-2xl flex items-center justify-center mx-auto text-slate-400 dark:text-zinc-500">
                <ShoppingCart className="w-8 h-8" />
              </div>
              <p className="font-bold text-slate-700 dark:text-zinc-300">Your shopping cart is empty</p>
              <p className="text-xs text-slate-500 dark:text-zinc-400">Explore products in the storefront catalog to add items.</p>
            </div>
          ) : (
            cartItems.map((item) => {
              const product = item.Product;
              if (!product) return null;

              return (
                <div
                  key={item.Cart_ID}
                  className="p-3.5 rounded-2xl bg-slate-50 dark:bg-[#161C24] border border-slate-200 dark:border-zinc-800 flex gap-3 items-center"
                >
                  <img
                    src={product.Image || defaultPlaceholder}
                    alt={product.Name}
                    onError={(e) => {
                      (e.target as HTMLImageElement).src = defaultPlaceholder;
                    }}
                    referrerPolicy="no-referrer"
                    className="w-16 h-16 rounded-xl object-cover bg-white dark:bg-[#0C1014] border border-slate-200 dark:border-zinc-700 shrink-0"
                  />
                  <div className="flex-1 min-w-0">
                    <h4 className="font-bold text-xs text-slate-900 dark:text-white truncate">
                      {product.Name}
                    </h4>
                    <span className="text-xs font-black text-blue-600 dark:text-sky-400 block mt-0.5">
                      {formatCurrency(Number(product.Price) || 0)}
                    </span>

                    {/* Quantity Controls */}
                    <div className="flex items-center gap-3 mt-2">
                      <div className="flex items-center border border-slate-200 dark:border-zinc-700 rounded-full bg-white dark:bg-[#181F2A] overflow-hidden text-xs">
                        <button
                          type="button"
                          onClick={() => onUpdateQuantity(item.Cart_ID, item.Quantity - 1)}
                          className="px-2.5 py-0.5 hover:bg-slate-100 dark:hover:bg-zinc-800 text-slate-600 dark:text-zinc-300 font-bold cursor-pointer"
                        >
                          <Minus className="w-3 h-3" />
                        </button>
                        <span className="px-2 font-bold text-slate-900 dark:text-white">
                          {item.Quantity}
                        </span>
                        <button
                          type="button"
                          onClick={() => onUpdateQuantity(item.Cart_ID, item.Quantity + 1)}
                          className="px-2.5 py-0.5 hover:bg-slate-100 dark:hover:bg-zinc-800 text-slate-600 dark:text-zinc-300 font-bold cursor-pointer"
                        >
                          <Plus className="w-3 h-3" />
                        </button>
                      </div>

                      <button
                        type="button"
                        onClick={() => onRemoveItem(item.Cart_ID)}
                        className="text-slate-400 hover:text-red-500 transition-colors p-1 cursor-pointer"
                        title="Remove Item"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>

                  <div className="text-right font-black text-xs text-slate-900 dark:text-white">
                    {formatCurrency((Number(product.Price) || 0) * item.Quantity)}
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Footer summary & Checkout */}
        {cartItems.length > 0 && (
          <div className="p-6 border-t border-slate-100 dark:border-zinc-800 bg-slate-50/50 dark:bg-[#161C24]/80 space-y-4">
            <div className="space-y-2 text-xs">
              <div className="flex justify-between text-slate-600 dark:text-zinc-400">
                <span>Subtotal</span>
                <span className="font-semibold text-slate-900 dark:text-white">
                  {formatCurrency(subtotal)}
                </span>
              </div>
              <div className="flex justify-between text-slate-600 dark:text-zinc-400">
                <span>Shipping Fee</span>
                <span className="font-semibold text-slate-900 dark:text-white">
                  {shippingFee === 0 ? (
                    <strong className="text-emerald-500 font-bold">FREE</strong>
                  ) : (
                    formatCurrency(shippingFee)
                  )}
                </span>
              </div>
              {subtotal > 0 && subtotal <= 150 && (
                <p className="text-[11px] text-slate-500 dark:text-zinc-400 italic">
                  Add {formatCurrency(150 - subtotal)} more for FREE express dispatch!
                </p>
              )}
              <div className="pt-2 border-t border-slate-200 dark:border-zinc-700 flex justify-between text-sm font-bold text-slate-900 dark:text-white">
                <span>Total Amount</span>
                <span className="text-blue-600 dark:text-sky-400 text-base font-black">
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
              className="w-full py-3.5 px-4 bg-blue-600 hover:bg-blue-500 text-white font-bold rounded-full shadow-lg shadow-blue-600/30 flex items-center justify-center gap-2 transition-all active:scale-98 text-sm cursor-pointer"
            >
              <span>Proceed to Checkout</span>
              <ArrowRight className="w-4 h-4" />
            </button>

            <div className="flex items-center justify-center gap-1.5 text-[11px] text-slate-400 dark:text-zinc-500">
              <ShieldCheck className="w-3.5 h-3.5 text-emerald-500" />
              <span>Encrypted Checkout &amp; Order Guarantee</span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
