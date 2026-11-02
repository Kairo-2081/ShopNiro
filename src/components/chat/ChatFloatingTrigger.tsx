import React from 'react';
import { Bot } from 'lucide-react';

interface ChatFloatingTriggerProps {
  isOpen: boolean;
  onClick: () => void;
}

export const ChatFloatingTrigger: React.FC<ChatFloatingTriggerProps> = ({ isOpen, onClick }) => {
  if (isOpen) return null;

  return (
    <div className="fixed bottom-24 right-4 z-40 md:bottom-6 md:right-6">
      <button
        onClick={onClick}
        title="Ask ShopNiro AI"
        className="grid h-12 w-12 place-items-center rounded-2xl bg-gradient-to-tr from-brand-700 via-brand-600 to-brand-500 text-white shadow-xl shadow-brand-500/30 transition-transform duration-300 hover:scale-[1.04] hover:shadow-brand-500/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-400 focus-visible:ring-offset-2 cursor-pointer relative"
        aria-label="Open ShopNiro AI Assistant"
      >
        <Bot className="h-6 w-6" />
        <span className="absolute -top-1 -right-1 w-3.5 h-3.5 bg-success-500 rounded-full border-2 border-white dark:border-[#0C1014] flex items-center justify-center shadow-sm shadow-success-500/40">
          <span className="w-1.5 h-1.5 rounded-full bg-white animate-[pulse_3s_ease-in-out_infinite]"></span>
        </span>
      </button>
    </div>
  );
};
