"use client"

const API_URL = '/api';

import { useState, useEffect, useRef } from "react";
import { Send, User, Bot, CheckCircle, AlertTriangle, XCircle, Sparkles, FileText, Loader2, ShieldCheck, PhoneCall } from "lucide-react";
import { AVANI_BUSINESS_CONFIG, AVANI_OFFICIAL_PRODUCT_SUITE, isAuthorizedTestRecipient } from "@/config/business";

export const AVANI_INBOX_PRODUCT_DETAILS = AVANI_OFFICIAL_PRODUCT_SUITE;

interface NotificationState {
  type: 'success' | 'warning' | 'error';
  message: string;
}

export default function InboxPage() {
  const [contacts, setContacts] = useState<any[]>([]);
  const [activeContactId, setActiveContactId] = useState<string | null>(null);
  const [messages, setMessages] = useState<any[]>([]);
  const [replyText, setReplyText] = useState("");
  const [autoReplyEnabled, setAutoReplyEnabled] = useState<boolean>(true);
  const [isSending, setIsSending] = useState(false);
  const [notification, setNotification] = useState<NotificationState | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const showNotification = (message: string, type: 'success' | 'warning' | 'error' = 'success') => {
    setNotification({ message, type });
    setTimeout(() => {
      setNotification(prev => (prev?.message === message ? null : prev));
    }, 6000);
  };

  const fetchContacts = async () => {
    try {
      const response = await fetch(`${API_URL}/contacts`);
      if (!response.ok) return;
      const data = await response.json();
      const list = Array.isArray(data) ? data : (data.contacts || []);
      setContacts(list);
      // Auto-select first contact if none selected
      if (!activeContactId && list.length > 0) {
        const first = list[0];
        const firstId = first.id || first._id || first.phone;
        setActiveContactId(firstId);
        fetchMessages(firstId);
      }
    } catch (error) {
      console.error("Failed to fetch contacts", error);
    }
  };

  const fetchMessages = async (contactId: string) => {
    try {
      const response = await fetch(`${API_URL}/contacts/${contactId}`);
      if (!response.ok) return;
      const data = await response.json();
      const fetchedMsgs = data.messages || [];
      setMessages(fetchedMsgs);

      // Auto-reply simulation log note if enabled in mock mode
      if (autoReplyEnabled && fetchedMsgs.length > 0) {
        const lastMsg = fetchedMsgs[fetchedMsgs.length - 1];
        if (lastMsg.role === 'user') {
          console.log('[AutoReply:Mock] Inbound message waiting for review:', lastMsg.content);
        }
      }
    } catch (error) {
      console.error("Failed to fetch messages", error);
    }
  };

  useEffect(() => {
    fetchContacts();
    const interval = setInterval(() => {
      fetchContacts();
      if (activeContactId) {
        fetchMessages(activeContactId);
      }
    }, 4000);
    return () => clearInterval(interval);
  }, [activeContactId, autoReplyEnabled]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Robust contact resolution
  const activeContact = contacts.find(c => {
    const cid = c.id || c._id;
    return cid === activeContactId || String(cid) === String(activeContactId) || c.phone === activeContactId;
  });

  const getRecipientPhone = (contact?: any): string => {
    if (!contact) return '';
    return contact.phone || contact.mobile || contact.customerPhone || '';
  };

  const activePhone = getRecipientPhone(activeContact);
  const isTestContact = isAuthorizedTestRecipient(activePhone);

  const handleSendReply = async (customMessage?: string) => {
    const textToSend = (customMessage || replyText || '').trim();
    
    if (!activeContactId) {
      showNotification("Please select a conversation from the left to send a message.", 'warning');
      return;
    }

    if (!textToSend) {
      showNotification("Please type a message or choose a Quick Action before sending.", 'warning');
      return;
    }

    const recipientPhone = activePhone;
    if (!recipientPhone) {
      showNotification("Cannot send: No phone number associated with this contact.", 'error');
      return;
    }

    try {
      setIsSending(true);

      // Optimistic UI update
      const tempId = `temp_${Date.now()}`;
      setMessages(prev => [
        ...prev,
        {
          id: tempId,
          content: textToSend,
          role: 'assistant',
          status: 'PENDING',
          timestamp: new Date().toISOString()
        }
      ]);

      const savedDraft = replyText;
      if (!customMessage) {
        setReplyText("");
      }

      const response = await fetch(`${API_URL}/contacts/direct-message`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          phone: recipientPhone,
          message: textToSend,
          name: activeContact?.name || 'Customer'
        })
      });

      const resData = await response.json();

      if (response.ok && resData.success) {
        if (resData.isMock || (resData.provider && resData.provider.toLowerCase().includes('mock'))) {
          showNotification(
            `CRM Sandbox Notice: Message queued in Mock Sandbox (Provider mode is mock). To deliver to live WhatsApp, owner approval & live provider mode required.`,
            'warning'
          );
        } else {
          showNotification(
            `Delivered to WhatsApp (${recipientPhone}) via ${resData.provider || 'ChatMitra'}. ID: ${resData.providerMessageId || 'OK'}`,
            'success'
          );
        }
        // Refresh messages from server
        setTimeout(() => fetchMessages(activeContactId), 1200);
      } else {
        // Restore draft if failed
        if (!customMessage) {
          setReplyText(savedDraft);
        }
        const errorMsg = resData.message || resData.error || `HTTP ${response.status}: Failed to deliver message.`;
        showNotification(`Send Failed: ${errorMsg}. Your draft was preserved.`, 'error');
      }
    } catch (error: any) {
      console.error("Failed to send reply", error);
      showNotification(`Connection Error: ${error.message || 'Unable to connect to server'}. Draft preserved.`, 'error');
    } finally {
      setIsSending(false);
    }
  };

  const handleInsertProductDetails = () => {
    const msg = `${AVANI_OFFICIAL_PRODUCT_SUITE}\n\nDear Customer, thank you for contacting ${AVANI_BUSINESS_CONFIG.name}. Our Founder & Chief Loan Advisor Sachin Shinde is available on WhatsApp at ${AVANI_BUSINESS_CONFIG.whatsapp.officialWabaFormatted} to assist you with custom sanction options.`;
    setReplyText(msg);
    textareaRef.current?.focus();
    showNotification("Product details inserted! Please review message and click Send.", 'success');
  };

  const handleGenerateAiResponse = () => {
    if (!activeContact || messages.length === 0) {
      const defaultGreeting = `Namaste! 🙏\n\nWelcome to ${AVANI_BUSINESS_CONFIG.name}. We guide individuals, professionals, and businesses to secure the right loan from 40+ top banks and NBFCs.\n\n${AVANI_OFFICIAL_PRODUCT_SUITE}\n\nPlease share your loan requirement or connect directly with ${AVANI_BUSINESS_CONFIG.founder.name} on WhatsApp: ${AVANI_BUSINESS_CONFIG.whatsapp.officialWabaFormatted}.`;
      setReplyText(defaultGreeting);
      textareaRef.current?.focus();
      showNotification("AI welcome greeting prepared! Review and click Send.", 'success');
      return;
    }

    const lastUserMsg = [...messages].reverse().find(m => m.role === 'user');
    const userText = lastUserMsg ? lastUserMsg.content : 'Hi, need loan';
    
    let generatedReply = "";
    const lower = userText.toLowerCase();

    if (lower.includes('doctor') || userText.includes('डॉक्टर')) {
      generatedReply = `Namaste! 🙏\n\nThank you for your inquiry regarding *Doctor Professional Loans* in Latur.\n\n${AVANI_BUSINESS_CONFIG.name} offers specialized funding for Medical Professionals:\n• Up to ₹50 Lakhs unsecured (No collateral required)\n• Competitive interest rates across 40+ partner banks & NBFCs\n• Minimal documentation: Degree (MBBS/MD/BDS), Medical Council Registration, last 2 years ITR, and 12 months bank statement.\n\n${AVANI_OFFICIAL_PRODUCT_SUITE}\n\nReply with your required loan amount or connect directly with Chief Loan Advisor Sachin Shinde on WhatsApp: ${AVANI_BUSINESS_CONFIG.whatsapp.officialWabaFormatted}.`;
    } else if (lower.includes('home') || userText.includes('घर') || userText.includes('गृहकर्ज')) {
      generatedReply = `Namaste! 🙏\n\nThank you for reaching out regarding *Home Loans*.\n\n${AVANI_BUSINESS_CONFIG.name} secures the best housing finance rates across 40+ banks & NBFCs:\n• Purchase, construction, plot loan, and balance transfer with top-up\n• Tenure up to 30 years with lowest EMI\n• Doorstep document pick-up and personalized guidance\n\n${AVANI_OFFICIAL_PRODUCT_SUITE}\n\nReply with your city and loan requirement, or connect with Sachin Shinde on WhatsApp: ${AVANI_BUSINESS_CONFIG.whatsapp.officialWabaFormatted}.`;
    } else if (lower.includes('business') || userText.includes('व्यापार') || userText.includes('बिझनेस')) {
      generatedReply = `Namaste! 🙏\n\nThank you for inquiring about *Business & MSME Loans*.\n\nWe provide working capital, term loans, and machinery finance:\n• Unsecured business loans up to ₹75 Lakhs\n• Fast sanction based on GST returns and banking turnover\n\n${AVANI_OFFICIAL_PRODUCT_SUITE}\n\nPlease share your business turnover or connect with Sachin Shinde directly on WhatsApp: ${AVANI_BUSINESS_CONFIG.whatsapp.officialWabaFormatted}.`;
    } else {
      generatedReply = `Namaste! 🙏\n\nWelcome to ${AVANI_BUSINESS_CONFIG.name}. We guide individuals, professionals, and businesses to secure the right loan from 40+ top banks and NBFCs.\n\n${AVANI_OFFICIAL_PRODUCT_SUITE}\n\nCould you please let us know which loan product you are interested in? You may also connect directly with Sachin Shinde on WhatsApp: ${AVANI_BUSINESS_CONFIG.whatsapp.officialWabaFormatted}.`;
    }

    setReplyText(generatedReply);
    textareaRef.current?.focus();
    showNotification("Contextual AI response drafted! Review and click Send.", 'success');
  };

  return (
    <div className="flex h-[calc(100vh-64px)] border rounded-xl overflow-hidden bg-white dark:bg-zinc-900 border-zinc-200 dark:border-zinc-800 shadow-sm">
      {/* Contact List */}
      <div className="w-1/3 border-r border-zinc-200 dark:border-zinc-800 flex flex-col bg-zinc-50/50 dark:bg-zinc-950/50">
        <div className="p-4 border-b border-zinc-200 dark:border-zinc-800 flex items-center justify-between bg-white dark:bg-zinc-900">
          <div>
            <h2 className="font-semibold text-base dark:text-white">Conversations</h2>
            <p className="text-xs text-zinc-500">Live WhatsApp Inbound & Outbound</p>
          </div>
          <span className="text-xs bg-zinc-200 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 px-2 py-0.5 rounded-full font-mono font-semibold">
            {contacts.length}
          </span>
        </div>
        <div className="flex-1 overflow-y-auto divide-y divide-zinc-100 dark:divide-zinc-800/60">
          {contacts.length === 0 ? (
            <div className="p-6 text-center text-xs text-zinc-500">
              No active conversations found.
            </div>
          ) : (
            contacts.map((c, idx) => {
              const cId = c.id || c._id || c.phone || `c_${idx}`;
              const isSelected = activeContactId === cId || String(c._id) === String(activeContactId);
              const phoneDisplay = c.phone || c.mobile || '';
              const isContactTest = isAuthorizedTestRecipient(phoneDisplay);
              return (
                <div 
                  key={cId} 
                  onClick={() => {
                    setActiveContactId(cId);
                    fetchMessages(cId);
                  }}
                  className={`p-4 cursor-pointer transition-colors ${
                    isSelected 
                      ? 'bg-green-50/70 dark:bg-green-950/20 border-l-4 border-green-600' 
                      : 'hover:bg-zinc-100/60 dark:hover:bg-zinc-800/40'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <div className="font-medium text-sm dark:text-zinc-100 flex items-center gap-1.5">
                      <span>{c.name || 'Customer'}</span>
                      {isContactTest && (
                        <span className="text-[10px] px-1.5 py-0.2 rounded font-medium bg-amber-500/10 text-amber-500 border border-amber-500/20">
                          Test Contact
                        </span>
                      )}
                    </div>
                    {phoneDisplay && (
                      <span className="text-[11px] text-zinc-400 font-mono">
                        {phoneDisplay.slice(-10)}
                      </span>
                    )}
                  </div>
                  <div className="text-xs text-zinc-500 dark:text-zinc-400 mt-1 line-clamp-1 truncate">
                    {c.messages && c.messages.length > 0 ? c.messages[0].content : "No messages yet"}
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* Chat Area */}
      <div className="w-2/3 flex flex-col bg-white dark:bg-zinc-900">
        {activeContactId ? (
          <>
            {/* Chat Area Header with Auto-Reply Controller */}
            <div className="p-4 border-b border-zinc-200 dark:border-zinc-800 flex items-center justify-between bg-zinc-50/50 dark:bg-zinc-900/80">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-green-100 dark:bg-green-950/60 border border-green-200 dark:border-green-800/50 flex items-center justify-center text-green-700 dark:text-green-400 font-semibold">
                  <User className="w-5 h-5" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="font-semibold text-sm dark:text-white">
                      {activeContact?.name || 'Customer'}
                    </h3>
                    {activePhone && (
                      <span className="text-xs font-normal text-zinc-500 dark:text-zinc-400 font-mono">
                        ({activePhone.startsWith('+') ? activePhone : `+${activePhone}`})
                      </span>
                    )}
                    {isTestContact && (
                      <span className="text-[10px] px-2 py-0.5 rounded-full font-semibold bg-amber-500/15 text-amber-500 border border-amber-500/30 flex items-center gap-1">
                        <ShieldCheck className="w-3 h-3" />
                        Authorized Test Recipient
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-zinc-500 flex items-center gap-1.5 mt-0.5">
                    <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse"></span>
                    Live WhatsApp • Official Advisory Hotline: {AVANI_BUSINESS_CONFIG.whatsapp.officialWabaFormatted}
                  </p>
                </div>
              </div>

              {/* Auto Reply Mode Switch (Accurate Status: MOCK MODE or DISABLED) */}
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => {
                    const next = !autoReplyEnabled;
                    setAutoReplyEnabled(next);
                    showNotification(
                      next ? "AI Auto-Reply enabled in Sandbox Mock Mode." : "AI Auto-Reply switched to Manual Mode.",
                      'success'
                    );
                  }}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium flex items-center gap-1.5 transition-colors border ${
                    autoReplyEnabled 
                      ? 'bg-amber-600/15 text-amber-700 dark:text-amber-400 border-amber-500/30 hover:bg-amber-600/25' 
                      : 'bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 border-zinc-300 dark:border-zinc-700 hover:bg-zinc-200 dark:hover:bg-zinc-700'
                  }`}
                  title="Auto-reply operating in Mock Sandbox mode. Live WhatsApp execution requires owner activation."
                >
                  <Bot className="w-3.5 h-3.5" />
                  {autoReplyEnabled ? 'AI Auto-Reply: MOCK MODE' : 'AI Auto-Reply: DISABLED'}
                </button>
              </div>
            </div>

            {/* Notification Banner */}
            {notification && (
              <div className={`px-4 py-2.5 text-xs flex items-center justify-between border-b transition-all ${
                notification.type === 'success' 
                  ? 'bg-green-50 dark:bg-green-950/80 border-green-200 dark:border-green-800 text-green-800 dark:text-green-200'
                  : notification.type === 'warning'
                  ? 'bg-amber-50 dark:bg-amber-950/80 border-amber-200 dark:border-amber-800 text-amber-800 dark:text-amber-200'
                  : 'bg-red-50 dark:bg-red-950/80 border-red-200 dark:border-red-800 text-red-800 dark:text-red-200'
              }`}>
                <div className="flex items-center gap-2">
                  {notification.type === 'success' && <CheckCircle className="w-4 h-4 text-green-600 dark:text-green-400 shrink-0" />}
                  {notification.type === 'warning' && <AlertTriangle className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0" />}
                  {notification.type === 'error' && <XCircle className="w-4 h-4 text-red-600 dark:text-red-400 shrink-0" />}
                  <span>{notification.message}</span>
                </div>
                <button 
                  type="button" 
                  onClick={() => setNotification(null)}
                  className="text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200"
                >
                  &times;
                </button>
              </div>
            )}

            {/* Message History */}
            <div className="flex-1 overflow-y-auto p-4 space-y-3.5 bg-zinc-50/40 dark:bg-zinc-950/40">
              {messages.length === 0 ? (
                <div className="h-full flex flex-col items-center justify-center text-center text-zinc-400 text-xs gap-2 py-12">
                  <Bot className="w-8 h-8 text-zinc-400/80" />
                  <p>No messages in this conversation yet.</p>
                  <p className="text-zinc-500">Send a product introduction or loan checklist below.</p>
                </div>
              ) : (
                messages.map((m, idx) => {
                  const isUser = m.role === 'user';
                  return (
                    <div key={m.id || `m_${idx}`} className={`flex ${!isUser ? 'justify-end' : 'justify-start'}`}>
                      <div className={`max-w-[78%] p-3.5 rounded-2xl text-xs sm:text-sm whitespace-pre-wrap leading-relaxed shadow-sm ${
                        !isUser 
                          ? 'bg-green-600 text-white rounded-br-none' 
                          : 'bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700/80 text-zinc-900 dark:text-zinc-100 rounded-bl-none'
                      }`}>
                        {m.content}
                        <div className={`text-[10px] mt-1.5 flex items-center justify-end gap-1 ${
                          !isUser ? 'text-green-100' : 'text-zinc-400'
                        }`}>
                          <span>{m.timestamp ? new Date(m.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : ''}</span>
                          {!isUser && (
                            <span>{m.status === 'PENDING' ? '⏳' : '✓✓'}</span>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
              <div ref={messagesEndRef} />
            </div>

            {/* Quick Response Bar + Manual Reply */}
            <div className="p-3.5 border-t border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 space-y-2.5">
              {/* Quick Actions Bar (Inserts draft for advisor review before dispatch) */}
              <div className="flex items-center gap-1.5 overflow-x-auto pb-1 text-xs scrollbar-none">
                <button 
                  type="button"
                  onClick={handleInsertProductDetails}
                  className="px-2.5 py-1.5 bg-blue-50 dark:bg-blue-950/40 hover:bg-blue-100 dark:hover:bg-blue-900/40 text-blue-700 dark:text-blue-400 border border-blue-200 dark:border-blue-800/40 rounded-lg flex items-center gap-1.5 whitespace-nowrap font-medium transition-colors"
                  title="Insert AVANI Complete Product Suite into message composer"
                >
                  <Sparkles className="w-3.5 h-3.5 text-blue-500" />
                  Product Suite (+91 72491 08474)
                </button>
                <button 
                  type="button"
                  onClick={handleGenerateAiResponse}
                  className="px-2.5 py-1.5 bg-emerald-50 dark:bg-emerald-950/40 hover:bg-emerald-100 dark:hover:bg-emerald-900/40 text-emerald-700 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800/40 rounded-lg flex items-center gap-1.5 whitespace-nowrap font-medium transition-colors"
                  title="Draft an AI response based on customer requirements"
                >
                  <Bot className="w-3.5 h-3.5 text-emerald-500" />
                  Auto-Reply with AI
                </button>
                <button 
                  type="button"
                  onClick={() => {
                    setReplyText(`🩺 *Doctor Loan Requirement — Required Documents:*\n1. Degree Certificate (MBBS/MD/BDS)\n2. Medical Council Registration Certificate\n3. Clinic / Hospital Registration Proof\n4. PAN Card & Aadhaar Card\n5. Last 2-3 years ITR with Computation\n6. Last 12 months Bank Statements\n\n${AVANI_OFFICIAL_PRODUCT_SUITE}\n\nPlease share these documents or connect directly with ${AVANI_BUSINESS_CONFIG.founder.name} on WhatsApp: ${AVANI_BUSINESS_CONFIG.whatsapp.officialWabaFormatted}.`);
                    textareaRef.current?.focus();
                    showNotification("Doctor Loan Checklist inserted! Please review before sending.", 'success');
                  }}
                  className="px-2.5 py-1.5 bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-700 text-zinc-700 dark:text-zinc-300 rounded-lg flex items-center gap-1.5 whitespace-nowrap transition-colors"
                  title="Insert Doctor Loan document checklist"
                >
                  <FileText className="w-3.5 h-3.5" />
                  Doctor Loan Checklist
                </button>
                <button 
                  type="button"
                  onClick={() => {
                    setReplyText(`🏠 *Home Loan Requirement — Required Documents:*\n1. PAN & Aadhaar Card of Applicant & Co-applicant\n2. Latest 3 months salary slips / 2 years ITR\n3. Last 6-12 months Bank Statement\n4. Copy of Agreement to Sale / Allotment Letter\n5. 7/12 Extract / Property Card & Tax Receipt\n\n${AVANI_OFFICIAL_PRODUCT_SUITE}\n\nPlease share these documents or connect directly with ${AVANI_BUSINESS_CONFIG.founder.name} on WhatsApp: ${AVANI_BUSINESS_CONFIG.whatsapp.officialWabaFormatted}.`);
                    textareaRef.current?.focus();
                    showNotification("Home Loan Checklist inserted! Please review before sending.", 'success');
                  }}
                  className="px-2.5 py-1.5 bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-700 text-zinc-700 dark:text-zinc-300 rounded-lg flex items-center gap-1.5 whitespace-nowrap transition-colors"
                  title="Insert Home Loan document checklist"
                >
                  <FileText className="w-3.5 h-3.5" />
                  Home Loan Checklist
                </button>
              </div>

              {/* Text Area & Send Button */}
              <div className="flex gap-2 items-end">
                <textarea 
                  ref={textareaRef}
                  rows={replyText.includes('\n') ? 3 : 1}
                  value={replyText}
                  onChange={(e) => setReplyText(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault();
                      if (replyText.trim() && !isSending) {
                        handleSendReply();
                      }
                    }
                  }}
                  placeholder="Type a manual reply or use Quick Actions above..." 
                  className="flex-1 px-3.5 py-2.5 border dark:border-zinc-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-green-500 dark:bg-zinc-800/80 dark:text-white resize-none text-xs sm:text-sm leading-relaxed"
                />
                <button 
                  type="button"
                  onClick={() => handleSendReply()}
                  disabled={isSending || !replyText.trim()}
                  className={`h-10 px-4 rounded-xl flex items-center justify-center gap-1.5 font-medium text-xs sm:text-sm text-white shrink-0 transition-all ${
                    isSending 
                      ? 'bg-zinc-600 cursor-wait' 
                      : !replyText.trim() 
                      ? 'bg-green-600/50 cursor-not-allowed text-white/70' 
                      : 'bg-green-600 hover:bg-green-700 active:scale-95 shadow-sm'
                  }`}
                  title={!replyText.trim() ? "Type a message or select a Quick Action to enable sending" : "Send message via WhatsApp"}
                >
                  {isSending ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>Sending...</span>
                    </>
                  ) : (
                    <>
                      <Send className="w-4 h-4" />
                      <span>Send</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          </>
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center text-zinc-400 gap-3 p-8">
            <div className="w-16 h-16 rounded-full bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center">
              <User className="w-8 h-8 text-zinc-500" />
            </div>
            <p className="font-medium text-sm text-zinc-600 dark:text-zinc-300">No Conversation Selected</p>
            <p className="text-xs text-zinc-400 text-center max-w-sm">
              Select a customer conversation from the left to view message history, send loan product details, or run AI auto-replies.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
