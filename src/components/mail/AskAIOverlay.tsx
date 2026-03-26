import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  X, 
  Sparkles, 
  Bot, 
  User, 
  Zap, 
  FileText, 
  MessageSquare,
  ArrowRight,
  Loader2
} from 'lucide-react';
import { cn } from '../../utils/cn';

interface Message {
  id: string;
  role: 'user' | 'ai';
  content: string;
  timestamp: Date;
}

const SUGGESTED_PROMPTS = [
  { id: '1', label: 'Summarize this thread', icon: FileText },
  { id: '2', label: 'Draft a reply', icon: MessageSquare },
  { id: '3', label: 'What is urgent today?', icon: Zap },
];

const TYPING_SPEED = 30; // ms per character

export const AskAIOverlay = ({ 
  isOpen, 
  onClose, 
  isDark 
}: { 
  isOpen: boolean; 
  onClose: () => void; 
  isDark: boolean;
}) => {
  const [messages, setMessages] = useState<Message[]>([
    {
      id: 'welcome',
      role: 'ai',
      content: "Hello. I'm ArcByte Intelligence. I can help you summarize threads, draft replies, or find information across your mailbox.",
      timestamp: new Date()
    }
  ]);
  const [input, setInput] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Auto-scroll to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isTyping]);

  // Focus input on open
  useEffect(() => {
    if (isOpen) {
      setTimeout(() => inputRef.current?.focus(), 300);
    }
  }, [isOpen]);

  const handleSend = async (text: string = input) => {
    if (!text.trim()) return;

    // Add user message
    const userMsg: Message = {
      id: Date.now().toString(),
      role: 'user',
      content: text,
      timestamp: new Date()
    };
    setMessages(prev => [...prev, userMsg]);
    setInput('');
    setIsTyping(true);

    // Simulate AI delay and streaming
    setTimeout(() => {
      const responseText = generateMockResponse(text);
      let currentText = '';
      let i = 0;
      
      // Create placeholder message
      const aiMsgId = (Date.now() + 1).toString();
      setMessages(prev => [...prev, {
        id: aiMsgId,
        role: 'ai',
        content: '',
        timestamp: new Date()
      }]);

      const interval = setInterval(() => {
        if (i < responseText.length) {
          currentText += responseText.charAt(i);
          setMessages(prev => prev.map(m => 
            m.id === aiMsgId ? { ...m, content: currentText } : m
          ));
          i++;
        } else {
          clearInterval(interval);
          setIsTyping(false);
        }
      }, TYPING_SPEED);
    }, 1000);
  };

  const generateMockResponse = (query: string): string => {
    const q = query.toLowerCase();
    if (q.includes('summarize')) return "This thread discusses the Q4 deployment strategy. Key points:\n• Deployment is scheduled for Nov 20.\n• The 'Design System' milestone is complete.\n• QA testing is currently pending.\n\nAction required: Review the attached checklist.";
    if (q.includes('draft') || q.includes('reply')) return "Here's a draft reply:\n\nHi Team,\n\nThanks for the update. I've reviewed the Q4 strategy notes and everything looks on track. I'll prioritize the QA testing phase this week.\n\nBest,\n[Your Name]";
    if (q.includes('urgent')) return "Based on your inbox, you have 3 unread messages marked as 'High Priority' from the Security Team regarding the recent audit logs. I recommend reviewing them first.";
    return "I understand. I'm analyzing your request against the current context. Could you provide more specific details so I can assist you better?";
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 z-[60] bg-black/20 backdrop-blur-sm"
          />

          {/* Drawer */}
          <motion.div
            initial={{ x: '100%' }}
            animate={{ x: 0 }}
            exit={{ x: '100%' }}
            transition={{ type: 'spring', damping: 30, stiffness: 300 }}
            className={cn(
              "fixed right-0 top-0 bottom-0 z-[70] w-full md:w-[450px] flex flex-col shadow-2xl",
              isDark ? "bg-[#0B0B0B] border-l border-[#1A1A1A]" : "bg-white border-l border-[#E5E5E5]"
            )}
          >
            {/* Header */}
            <div className={cn(
              "flex items-center justify-between px-6 py-5 border-b shrink-0",
              isDark ? "border-[#1A1A1A] bg-[#0B0B0B]" : "border-[#E5E5E5] bg-white"
            )}>
              <div className="flex items-center gap-3">
                <div className="relative">
                  <div className="absolute inset-0 bg-[#1DB954] blur-lg opacity-20" />
                  <Sparkles size={20} className="text-[#1DB954] relative z-10" />
                </div>
                <div>
                  <h2 className={cn("font-bold text-lg leading-none", isDark ? "text-white" : "text-black")}>ArcByte AI</h2>
                  <span className={cn("text-[11px] font-mono uppercase tracking-wider opacity-60", isDark ? "text-white" : "text-black")}>Intelligence v2.0</span>
                </div>
              </div>
              <button 
                onClick={onClose}
                className={cn(
                  "p-2 rounded-full transition-colors",
                  isDark ? "hover:bg-[#1A1A1A] text-[#787878] hover:text-white" : "hover:bg-[#F0F0F0] text-[#949494] hover:text-black"
                )}
              >
                <X size={20} />
              </button>
            </div>

            {/* Messages Area */}
            <div className={cn(
              "flex-1 overflow-y-auto custom-scrollbar p-6 space-y-6",
              isDark ? "bg-[#0B0B0B]" : "bg-[#F9F9F9]"
            )}>
              {messages.map((msg) => (
                <motion.div
                  key={msg.id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className={cn(
                    "flex gap-4 max-w-[90%]",
                    msg.role === 'user' ? "ml-auto flex-row-reverse" : ""
                  )}
                >
                  <div className={cn(
                    "w-8 h-8 rounded-full flex items-center justify-center shrink-0 border mt-1",
                    msg.role === 'ai' 
                      ? (isDark ? "bg-[#1A1A1A] border-[#282828] text-[#1DB954]" : "bg-white border-[#E5E5E5] text-[#1DB954]")
                      : (isDark ? "bg-[#282828] border-[#333] text-white" : "bg-black border-black text-white")
                  )}>
                    {msg.role === 'ai' ? <Bot size={16} /> : <User size={16} />}
                  </div>
                  
                  <div className="flex flex-col gap-1 min-w-0">
                    <div className={cn(
                      "p-4 rounded-2xl text-[14px] leading-relaxed whitespace-pre-wrap shadow-sm",
                      msg.role === 'ai'
                        ? (isDark ? "bg-[#1A1A1A] text-[#EAEAEA] rounded-tl-none border border-[#282828]" : "bg-white text-[#121212] rounded-tl-none border border-[#E5E5E5]")
                        : (isDark ? "bg-[#1DB954] text-black rounded-tr-none font-medium" : "bg-black text-white rounded-tr-none")
                    )}>
                      {msg.content}
                    </div>
                    <span className={cn("text-[10px] opacity-40 px-1", isDark ? "text-white" : "text-black")}>
                      {msg.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </span>
                  </div>
                </motion.div>
              ))}
              
              {isTyping && (
                <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex gap-4">
                  <div className={cn("w-8 h-8 rounded-full flex items-center justify-center shrink-0 border mt-1", isDark ? "bg-[#1A1A1A] border-[#282828] text-[#1DB954]" : "bg-white border-[#E5E5E5] text-[#1DB954]")}>
                    <Loader2 size={16} className="animate-spin" />
                  </div>
                  <div className={cn("flex items-center gap-1 p-4 rounded-2xl rounded-tl-none border", isDark ? "bg-[#1A1A1A] border-[#282828]" : "bg-white border-[#E5E5E5]")}>
                    <div className="w-1.5 h-1.5 rounded-full bg-[#1DB954] animate-bounce [animation-delay:-0.3s]" />
                    <div className="w-1.5 h-1.5 rounded-full bg-[#1DB954] animate-bounce [animation-delay:-0.15s]" />
                    <div className="w-1.5 h-1.5 rounded-full bg-[#1DB954] animate-bounce" />
                  </div>
                </motion.div>
              )}
              <div ref={messagesEndRef} />
            </div>

            {/* Input Area */}
            <div className={cn(
              "p-6 pt-2 shrink-0 z-10",
              isDark ? "bg-[#0B0B0B]" : "bg-[#F9F9F9]"
            )}>
              {/* Suggested Prompts */}
              {messages.length === 1 && (
                <div className="flex gap-2 mb-4 overflow-x-auto custom-scrollbar pb-2">
                  {SUGGESTED_PROMPTS.map(prompt => (
                    <button
                      key={prompt.id}
                      onClick={() => handleSend(prompt.label)}
                      className={cn(
                        "flex items-center gap-2 px-4 py-2 rounded-full text-xs font-medium whitespace-nowrap transition-all border",
                        isDark 
                          ? "bg-[#1A1A1A] border-[#282828] text-[#B3B3B3] hover:text-white hover:border-[#1DB954]/50" 
                          : "bg-white border-[#E5E5E5] text-[#5E5E5E] hover:text-black hover:border-[#1DB954]/50"
                      )}
                    >
                      <prompt.icon size={14} />
                      {prompt.label}
                    </button>
                  ))}
                </div>
              )}

              <div className="relative group">
                <div className="absolute -inset-0.5 bg-gradient-to-r from-[#1DB954] to-[#1ED760] rounded-2xl opacity-0 group-focus-within:opacity-20 transition-opacity duration-500 blur" />
                <div className={cn(
                  "relative flex items-center gap-2 p-2 rounded-2xl border transition-all",
                  isDark ? "bg-[#121212] border-[#282828]" : "bg-white border-[#E5E5E5]"
                )}>
                  <input
                    ref={inputRef}
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleSend()}
                    placeholder="Ask ArcByte Intelligence..."
                    className={cn(
                      "flex-1 bg-transparent border-none px-3 py-2 text-sm focus:outline-none",
                      isDark ? "text-white placeholder:text-[#5E5E5E]" : "text-black placeholder:text-[#949494]"
                    )}
                  />
                  <button
                    onClick={() => handleSend()}
                    disabled={!input.trim() || isTyping}
                    className={cn(
                      "p-2 rounded-xl transition-all",
                      input.trim() 
                        ? "bg-[#1DB954] text-black hover:scale-105 active:scale-95 shadow-[0_0_15px_rgba(29,185,84,0.3)]" 
                        : (isDark ? "bg-[#1A1A1A] text-[#5E5E5E]" : "bg-[#F0F0F0] text-[#949494]")
                    )}
                  >
                    {input.trim() ? <ArrowRight size={18} strokeWidth={2.5} /> : <Sparkles size={18} />}
                  </button>
                </div>
              </div>
              
              <div className="text-center mt-3">
                 <span className={cn("text-[10px] opacity-40", isDark ? "text-white" : "text-black")}>
                   AI can make mistakes. Verify important information.
                 </span>
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
};
