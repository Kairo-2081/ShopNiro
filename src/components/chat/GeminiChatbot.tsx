import React, { useState, useEffect, useRef } from 'react';
import {
  X,
  Send,
  Sparkles,
  Bot,
  User,
  RotateCcw,
  Zap,
  Brain,
  ShoppingBag,
  Store,
  ShieldCheck,
  ChevronDown,
  Copy,
  Check,
  Minimize2,
  Maximize2,
} from 'lucide-react';
import { api } from '../../lib/api';

export type ChatRole = 'shopping-assistant' | 'seller-advisor' | 'order-specialist' | 'complex-analyst';
export type GeminiModelChoice = 'gemini-3.5-flash' | 'gemini-3.1-flash-lite' | 'gemini-3.1-pro-preview';

interface Message {
  id: string;
  role: 'user' | 'model';
  content: string;
  timestamp: string;
  modelUsed?: string;
  roleUsed?: string;
}

interface GeminiChatbotProps {
  isOpen: boolean;
  onClose: () => void;
  initialQuery?: string;
}

const ROLE_CONFIGS: Record<
  ChatRole,
  {
    title: string;
    description: string;
    icon: React.ReactNode;
    color: string;
    starters: string[];
    recommendedModel: GeminiModelChoice;
  }
> = {
  'shopping-assistant': {
    title: 'Shopping Concierge',
    description: 'Find products, check real-time stock & apply discount vouchers',
    icon: <ShoppingBag className="w-4 h-4 text-blue-400" />,
    color: 'from-blue-500/20 to-sky-500/20 border-blue-500/30 text-sky-300',
    recommendedModel: 'gemini-3.5-flash',
    starters: [
      'What are the best wireless headphones available?',
      'Are there any active discount vouchers today?',
      'Recommend eco-friendly everyday products',
    ],
  },
  'seller-advisor': {
    title: 'Merchant Advisor',
    description: 'Catalog optimization, pricing strategies & fulfillment guidance',
    icon: <Store className="w-4 h-4 text-emerald-400" />,
    color: 'from-emerald-500/20 to-teal-500/20 border-emerald-500/30 text-emerald-300',
    recommendedModel: 'gemini-3.5-flash',
    starters: [
      'How should I price high-end audio hardware?',
      'Tips for improving my seller approval status',
      'How to optimize product descriptions for higher conversions',
    ],
  },
  'order-specialist': {
    title: 'Delivery Specialist',
    description: 'Order tracking, delivery logistics & dispute resolutions',
    icon: <Zap className="w-4 h-4 text-amber-400" />,
    color: 'from-amber-500/20 to-orange-500/20 border-amber-500/30 text-amber-300',
    recommendedModel: 'gemini-3.1-flash-lite',
    starters: [
      'Where is order #ORD-1001 right now?',
      'What are standard shipping fees on ShopNiro?',
      'How does package live tracking work?',
    ],
  },
  'complex-analyst': {
    title: 'Marketplace Intelligence',
    description: 'Deep market analysis, multi-item comparisons & business insights',
    icon: <Brain className="w-4 h-4 text-purple-400" />,
    color: 'from-purple-500/20 to-pink-500/20 border-purple-500/30 text-purple-300',
    recommendedModel: 'gemini-3.1-pro-preview',
    starters: [
      'Compare wireless vs over-ear headphones across battery life and audio fidelity',
      'Analyze customer sentiment trends on premium artisan brands',
      'Create a growth roadmap for an electronics merchant',
    ],
  },
};

const MODEL_OPTIONS: { id: GeminiModelChoice; label: string; tag: string; description: string; icon: React.ReactNode }[] = [
  {
    id: 'gemini-3.1-flash-lite',
    label: 'Gemini 3.1 Flash-Lite',
    tag: 'Ultra-Fast',
    description: 'Lowest latency for instant order tracking & quick queries',
    icon: <Zap className="w-3.5 h-3.5 text-amber-400" />,
  },
  {
    id: 'gemini-3.5-flash',
    label: 'Gemini 3.5 Flash',
    tag: 'Balanced',
    description: 'Default model for rich customer assistance and catalog searches',
    icon: <Sparkles className="w-3.5 h-3.5 text-blue-400" />,
  },
  {
    id: 'gemini-3.1-pro-preview',
    label: 'Gemini 3.1 Pro',
    tag: 'Deep Reasoning',
    description: 'Best for complex comparisons, business strategy & heavy reasoning',
    icon: <Brain className="w-3.5 h-3.5 text-purple-400" />,
  },
];

export const GeminiChatbot: React.FC<GeminiChatbotProps> = ({ isOpen, onClose, initialQuery }) => {
  const [selectedRole, setSelectedRole] = useState<ChatRole>('shopping-assistant');
  const [selectedModel, setSelectedModel] = useState<GeminiModelChoice>('gemini-3.5-flash');
  const [isModelDropdownOpen, setIsModelDropdownOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([
    {
      id: 'welcome',
      role: 'model',
      content:
        "Hello! I am your **ShopNiro AI Assistant**. How can I help you discover verified products, assist your merchant storefront, or track orders today?",
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      modelUsed: 'gemini-3.5-flash',
      roleUsed: 'shopping-assistant',
    },
  ]);
  const [inputMessage, setInputMessage] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const messagesEndRef = useRef<HTMLDivElement | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);

  // Auto-scroll on new message
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isLoading]);

  // Focus input on open
  useEffect(() => {
    if (isOpen) {
      setTimeout(() => {
        inputRef.current?.focus();
      }, 100);
    }
  }, [isOpen]);

  // Handle initial query if passed (e.g. from ProductDetail modal "Ask AI")
  useEffect(() => {
    if (initialQuery && isOpen) {
      handleSendMessage(initialQuery);
    }
  }, [initialQuery, isOpen]);

  const handleRoleChange = (newRole: ChatRole) => {
    setSelectedRole(newRole);
    const recommended = ROLE_CONFIGS[newRole].recommendedModel;
    setSelectedModel(recommended);

    const roleInfo = ROLE_CONFIGS[newRole];
    setMessages((prev) => [
      ...prev,
      {
        id: `switch-${Date.now()}`,
        role: 'model',
        content: `Switched mode to **${roleInfo.title}** (${roleInfo.description}). How may I assist you with this context?`,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        modelUsed: recommended,
        roleUsed: newRole,
      },
    ]);
  };

  const handleClearChat = () => {
    setMessages([
      {
        id: 'welcome-reset',
        role: 'model',
        content: `Conversation reset. I'm ready in **${ROLE_CONFIGS[selectedRole].title}** mode. What would you like to explore?`,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        modelUsed: selectedModel,
        roleUsed: selectedRole,
      },
    ]);
  };

  const handleCopy = (id: string, text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const handleSendMessage = async (customText?: string) => {
    const textToSend = (customText || inputMessage).trim();
    if (!textToSend || isLoading) return;

    const userMessageId = `user-${Date.now()}`;
    const userMsg: Message = {
      id: userMessageId,
      role: 'user',
      content: textToSend,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    };

    setMessages((prev) => [...prev, userMsg]);
    if (!customText) setInputMessage('');
    setIsLoading(true);

    try {
      const history = messages.map((m) => ({
        role: m.role,
        parts: [{ text: m.content }],
      }));

      const taskComplexity =
        selectedModel === 'gemini-3.1-pro-preview'
          ? 'complex'
          : selectedModel === 'gemini-3.1-flash-lite'
          ? 'fast'
          : 'general';

      const res = await api.sendGeminiChatMessage({
        message: textToSend,
        history,
        role: selectedRole,
        requestedModel: selectedModel,
        taskComplexity,
      });

      const botMessageId = `model-${Date.now()}`;
      const botMsg: Message = {
        id: botMessageId,
        role: 'model',
        content: res.reply || 'I processed your inquiry, but received an empty response. Please ask again.',
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        modelUsed: res.modelUsed || selectedModel,
        roleUsed: res.roleUsed || selectedRole,
      };

      setMessages((prev) => [...prev, botMsg]);
    } catch (err: any) {
      console.error('Chat error:', err);
      const errorMsg: Message = {
        id: `err-${Date.now()}`,
        role: 'model',
        content: `⚠️ Error contacting Gemini AI: ${err.message || 'Please check your connection and try again.'}`,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      };
      setMessages((prev) => [...prev, errorMsg]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  // Helper to format simple markdown-like text
  const renderFormattedContent = (content: string) => {
    const lines = content.split('\n');
    return (
      <div className="space-y-1.5 text-xs md:text-sm leading-relaxed">
        {lines.map((line, idx) => {
          if (!line.trim()) {
            return <div key={idx} className="h-1.5" />;
          }

          if (line.trim().startsWith('- ') || line.trim().startsWith('* ')) {
            const clean = line.trim().substring(2);
            return (
              <div key={idx} className="flex items-start gap-2 pl-1">
                <span className="text-blue-500 dark:text-sky-400 mt-1 font-bold">•</span>
                <span>{renderInlineStyles(clean)}</span>
              </div>
            );
          }

          const numMatch = line.trim().match(/^(\d+)\.\s+(.*)/);
          if (numMatch) {
            return (
              <div key={idx} className="flex items-start gap-2 pl-1">
                <span className="text-blue-500 dark:text-sky-400 font-bold shrink-0">{numMatch[1]}.</span>
                <span>{renderInlineStyles(numMatch[2])}</span>
              </div>
            );
          }

          return <p key={idx}>{renderInlineStyles(line)}</p>;
        })}
      </div>
    );
  };

  const renderInlineStyles = (text: string) => {
    const parts = text.split(/(\*\*.*?\*\*|`.*?`)/g);
    return parts.map((part, i) => {
      if (part.startsWith('**') && part.endsWith('**')) {
        return <strong key={i} className="font-semibold text-slate-900 dark:text-white">{part.slice(2, -2)}</strong>;
      }
      if (part.startsWith('`') && part.endsWith('`')) {
        return (
          <code key={i} className="px-1.5 py-0.5 rounded bg-blue-500/10 text-blue-600 dark:text-sky-300 font-mono text-xs">
            {part.slice(1, -1)}
          </code>
        );
      }
      return part;
    });
  };

  if (!isOpen) return null;

  const currentRoleConfig = ROLE_CONFIGS[selectedRole];
  const activeModelObj = MODEL_OPTIONS.find((m) => m.id === selectedModel) || MODEL_OPTIONS[1];

  return (
    <div
      className={`fixed z-50 transition-all duration-300 ease-in-out flex flex-col shadow-2xl bg-white dark:bg-[#12161D] border border-sky-100 dark:border-sky-500/20 overflow-hidden ${
        isExpanded
          ? 'inset-4 md:inset-10 rounded-3xl'
          : 'bottom-4 right-4 md:bottom-6 md:right-6 w-[94vw] sm:w-[480px] h-[640px] max-h-[88vh] rounded-3xl'
      }`}
    >
      {/* Header */}
      <div className="p-4 border-b border-sky-100 dark:border-zinc-800 flex items-center justify-between bg-gradient-to-r from-slate-900 via-[#0B1528] to-[#12161D] text-white">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-blue-500/20 border border-sky-400/40 flex items-center justify-center text-sky-400 shadow-inner">
            <Bot className="w-5 h-5 text-sky-400 animate-pulse" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-sm font-bold tracking-tight text-white flex items-center gap-1.5">
                ShopNiro AI Assistant
                <span className="inline-flex items-center px-1.5 py-0.5 rounded-full text-[10px] font-medium bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                  Online
                </span>
              </h2>
            </div>
            <p className="text-[11px] text-zinc-400 flex items-center gap-1">
              <span>Powered by Gemini Intelligence</span>
            </p>
          </div>
        </div>

        <div className="flex items-center gap-1.5">
          {/* Model Selector Pill Dropdown */}
          <div className="relative">
            <button
              onClick={() => setIsModelDropdownOpen(!isModelDropdownOpen)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-zinc-800/80 hover:bg-zinc-700/80 border border-zinc-700 text-zinc-200 text-xs font-medium transition-colors cursor-pointer"
              title="Change active Gemini model"
            >
              {activeModelObj.icon}
              <span className="hidden sm:inline">{activeModelObj.tag}</span>
              <ChevronDown className="w-3 h-3 text-zinc-400" />
            </button>

            {isModelDropdownOpen && (
              <div className="absolute right-0 mt-2 w-64 bg-[#12161D] border border-sky-500/25 rounded-2xl shadow-2xl p-2 z-50 text-xs space-y-1">
                <div className="px-2 py-1 text-[10px] font-bold text-zinc-400 uppercase tracking-wider">
                  Select Gemini Model
                </div>
                {MODEL_OPTIONS.map((m) => (
                  <button
                    key={m.id}
                    onClick={() => {
                      setSelectedModel(m.id);
                      setIsModelDropdownOpen(false);
                    }}
                    className={`w-full text-left p-2 rounded-xl flex items-start gap-2.5 transition-colors cursor-pointer ${
                      selectedModel === m.id
                        ? 'bg-blue-600/30 border border-sky-500/40 text-white'
                        : 'hover:bg-[#181F2A] text-zinc-300'
                    }`}
                  >
                    <div className="mt-0.5">{m.icon}</div>
                    <div>
                      <div className="font-semibold flex items-center gap-1.5">
                        {m.label}
                        {selectedModel === m.id && <Check className="w-3 h-3 text-sky-400" />}
                      </div>
                      <div className="text-[10px] text-zinc-400 leading-snug">{m.description}</div>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Clear Chat */}
          <button
            onClick={handleClearChat}
            className="p-2 rounded-full text-zinc-400 hover:text-white hover:bg-zinc-800 transition-colors cursor-pointer"
            title="Reset conversation"
          >
            <RotateCcw className="w-4 h-4" />
          </button>

          {/* Expand / Minimize */}
          <button
            onClick={() => setIsExpanded(!isExpanded)}
            className="p-2 rounded-full text-zinc-400 hover:text-white hover:bg-zinc-800 transition-colors cursor-pointer hidden md:block"
            title={isExpanded ? 'Minimize' : 'Expand'}
          >
            {isExpanded ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
          </button>

          {/* Close */}
          <button
            onClick={onClose}
            className="p-2 rounded-full text-zinc-400 hover:text-white hover:bg-zinc-800 transition-colors cursor-pointer"
            title="Close Assistant"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Role Tabs */}
      <div className="px-3 py-2 bg-slate-50 dark:bg-[#181F2A] border-b border-sky-100 dark:border-zinc-800 flex items-center gap-1.5 overflow-x-auto scrollbar-none text-xs">
        <span className="text-[11px] font-semibold text-slate-500 dark:text-zinc-400 px-1 shrink-0">
          Role:
        </span>
        {(Object.keys(ROLE_CONFIGS) as ChatRole[]).map((r) => {
          const cfg = ROLE_CONFIGS[r];
          const isSelected = selectedRole === r;
          return (
            <button
              key={r}
              onClick={() => handleRoleChange(r)}
              className={`flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold whitespace-nowrap transition-all cursor-pointer ${
                isSelected
                  ? 'bg-blue-600 text-white shadow-md shadow-blue-500/25'
                  : 'bg-white dark:bg-[#12161D] text-slate-700 dark:text-zinc-300 hover:bg-slate-100 dark:hover:bg-zinc-800 border border-slate-200 dark:border-zinc-700'
              }`}
            >
              {cfg.icon}
              <span>{cfg.title}</span>
            </button>
          );
        })}
      </div>

      {/* Scrollable Message Thread */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-slate-50/50 dark:bg-[#0C1014]/80">
        {messages.map((m) => {
          const isUser = m.role === 'user';
          return (
            <div
              key={m.id}
              className={`flex gap-3 ${isUser ? 'justify-end' : 'justify-start'}`}
            >
              {!isUser && (
                <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-blue-600 to-sky-500 text-white flex items-center justify-center shrink-0 shadow-sm mt-0.5">
                  <Bot className="w-4 h-4" />
                </div>
              )}

              <div
                className={`max-w-[85%] rounded-2xl p-3.5 shadow-xs relative group ${
                  isUser
                    ? 'bg-blue-600 text-white rounded-tr-xs'
                    : 'bg-white dark:bg-[#181F2A] text-slate-800 dark:text-zinc-200 border border-sky-100 dark:border-zinc-700/60 rounded-tl-xs'
                }`}
              >
                {/* Message Header info for model response */}
                {!isUser && (
                  <div className="flex items-center justify-between gap-2 mb-2 pb-1.5 border-b border-slate-100 dark:border-zinc-800 text-[10px] text-slate-500 dark:text-zinc-400">
                    <span className="font-semibold flex items-center gap-1 text-blue-600 dark:text-sky-400">
                      <Sparkles className="w-3 h-3" />
                      {m.roleUsed ? ROLE_CONFIGS[m.roleUsed as ChatRole]?.title || 'ShopNiro AI' : 'ShopNiro AI'}
                    </span>
                    <div className="flex items-center gap-1.5">
                      {m.modelUsed && (
                        <span className="px-1.5 py-0.5 rounded-full bg-slate-100 dark:bg-zinc-800 text-slate-600 dark:text-zinc-300 font-mono text-[9px]">
                          {m.modelUsed}
                        </span>
                      )}
                      <span>{m.timestamp}</span>
                    </div>
                  </div>
                )}

                {/* Content body */}
                {isUser ? (
                  <p className="text-xs md:text-sm whitespace-pre-wrap">{m.content}</p>
                ) : (
                  renderFormattedContent(m.content)
                )}

                {/* Timestamp & Copy button */}
                <div className={`mt-2 flex items-center gap-2 ${isUser ? 'justify-end text-blue-200' : 'justify-between text-slate-400 dark:text-zinc-500'} text-[10px]`}>
                  {isUser ? (
                    <span>{m.timestamp}</span>
                  ) : (
                    <>
                      <span>ShopNiro Assistant</span>
                      <button
                        onClick={() => handleCopy(m.id, m.content)}
                        className="opacity-0 group-hover:opacity-100 transition-opacity p-1 hover:text-slate-700 dark:hover:text-zinc-300 rounded cursor-pointer"
                        title="Copy answer"
                      >
                        {copiedId === m.id ? (
                          <span className="text-emerald-500 flex items-center gap-1">
                            <Check className="w-3 h-3" /> Copied
                          </span>
                        ) : (
                          <Copy className="w-3 h-3" />
                        )}
                      </button>
                    </>
                  )}
                </div>
              </div>

              {isUser && (
                <div className="w-8 h-8 rounded-xl bg-slate-200 dark:bg-[#181F2A] text-slate-700 dark:text-zinc-300 flex items-center justify-center shrink-0 mt-0.5">
                  <User className="w-4 h-4" />
                </div>
              )}
            </div>
          );
        })}

        {/* Loading Indicator */}
        {isLoading && (
          <div className="flex items-start gap-3 justify-start">
            <div className="w-8 h-8 rounded-xl bg-blue-600 text-white flex items-center justify-center shrink-0 shadow-sm animate-pulse">
              <Bot className="w-4 h-4" />
            </div>
            <div className="bg-white dark:bg-[#181F2A] border border-sky-100 dark:border-zinc-700/60 rounded-2xl rounded-tl-xs p-3.5 shadow-xs space-y-2">
              <div className="flex items-center gap-2 text-xs font-medium text-slate-500 dark:text-zinc-400">
                <Sparkles className="w-3.5 h-3.5 text-blue-500 animate-spin" />
                <span>Thinking with {selectedModel}...</span>
              </div>
              <div className="flex items-center gap-1.5 pl-1">
                <span className="w-2 h-2 rounded-full bg-blue-500 animate-bounce" style={{ animationDelay: '0ms' }}></span>
                <span className="w-2 h-2 rounded-full bg-blue-500 animate-bounce" style={{ animationDelay: '150ms' }}></span>
                <span className="w-2 h-2 rounded-full bg-blue-500 animate-bounce" style={{ animationDelay: '300ms' }}></span>
              </div>
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Suggested Starters */}
      {messages.length <= 2 && (
        <div className="px-4 py-2 border-t border-sky-100 dark:border-zinc-800 bg-slate-50 dark:bg-[#181F2A] overflow-x-auto scrollbar-none flex gap-2">
          {currentRoleConfig.starters.map((starter, i) => (
            <button
              key={i}
              onClick={() => handleSendMessage(starter)}
              className="px-3 py-1.5 rounded-full bg-white dark:bg-[#12161D] hover:bg-sky-50 dark:hover:bg-zinc-800 border border-slate-200 dark:border-zinc-700 text-slate-700 dark:text-zinc-300 hover:text-blue-600 dark:hover:text-white text-xs font-medium whitespace-nowrap transition-colors cursor-pointer shrink-0 shadow-2xs"
            >
              💡 {starter}
            </button>
          ))}
        </div>
      )}

      {/* Bottom Input Box */}
      <div className="p-3 border-t border-sky-100 dark:border-zinc-800 bg-white dark:bg-[#12161D]">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            handleSendMessage();
          }}
          className="flex items-center gap-2"
        >
          <div className="relative flex-1">
            <input
              ref={inputRef}
              type="text"
              value={inputMessage}
              onChange={(e) => setInputMessage(e.target.value)}
              onKeyDown={handleKeyDown}
              disabled={isLoading}
              placeholder={`Ask ${currentRoleConfig.title}...`}
              className="w-full pl-4 pr-10 py-2.5 bg-slate-100 dark:bg-[#181F2A] border border-slate-200 dark:border-zinc-700 rounded-full text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-blue-500 text-xs md:text-sm disabled:opacity-50"
            />
          </div>

          <button
            type="submit"
            disabled={!inputMessage.trim() || isLoading}
            className="p-3 rounded-full bg-blue-600 hover:bg-blue-500 text-white disabled:opacity-40 disabled:cursor-not-allowed transition-all shadow-md shadow-blue-500/25 cursor-pointer shrink-0"
            title="Send message"
          >
            <Send className="w-4 h-4" />
          </button>
        </form>

        <div className="mt-2 flex items-center justify-between text-[10px] text-slate-500 dark:text-zinc-400 px-2">
          <span className="flex items-center gap-1 font-medium">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
            Role: <strong>{currentRoleConfig.title}</strong>
          </span>
          <span className="font-mono">
            Model: <strong>{selectedModel}</strong>
          </span>
        </div>
      </div>
    </div>
  );
};
