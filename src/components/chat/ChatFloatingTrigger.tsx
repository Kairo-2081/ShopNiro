import React from 'react';
import { Bot, Sparkles } from 'lucide-react';

interface ChatFloatingTriggerProps {
  isOpen: boolean;
  onClick: () => void;
}

export const ChatFloatingTrigger: React.FC<ChatFloatingTriggerProps> = ({ isOpen, onClick }) => {
  if (isOpen) return null;

  return (
    <div className="fixed bottom-6 right-6 z-40 flex items-center gap-2.5 group">
      {/* Floating tooltip banner */}
      <div className="hidden sm:flex items-center gap-1.5 px-3.5 py-1.5 rounded-full bg-[#12161D]/90 text-white text-xs font-medium shadow-xl border border-sky-500/25 backdrop-blur-md transition-all duration-300 group-hover:scale-105">
        <Sparkles className="w-3.5 h-3.5 text-sky-400 animate-spin" />
        <span>Ask ShopNiro AI</span>
      </div>

      {/* Circular floating button */}
      <button
        onClick={onClick}
        className="w-13 h-13 rounded-2xl bg-gradient-to-tr from-blue-600 via-blue-500 to-sky-500 hover:from-blue-500 hover:to-sky-400 text-white flex items-center justify-center shadow-xl shadow-blue-500/30 hover:shadow-blue-500/50 border border-sky-400/30 transition-all duration-300 hover:scale-105 cursor-pointer relative"
        aria-label="Open ShopNiro AI Assistant"
      >
        <Bot className="w-6 h-6" />
        <span className="absolute -top-1 -right-1 w-3.5 h-3.5 bg-emerald-500 rounded-full border-2 border-white dark:border-[#0C1014] flex items-center justify-center">
          <span className="w-1.5 h-1.5 rounded-full bg-white animate-ping"></span>
        </span>
      </button>
    </div>
  );
};
