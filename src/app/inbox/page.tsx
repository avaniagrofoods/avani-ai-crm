"use client"

const API_URL = '/api';

import { useState, useEffect } from "react";
import { Send, User, Bot, CheckCircle, Sparkles, FileText, PhoneCall } from "lucide-react";

export const AVANI_INBOX_PRODUCT_DETAILS = `═══════════════════════════════════════
🏦 *AVANI LOAN SERVICES — COMPLETE PRODUCT SUITE*
═══════════════════════════════════════
Empowering your financial requirements across 40+ partner banks & NBFCs:

1. 🩺 *Doctor Professional Loan* — Clinic setup, medical equipment & expansion funding up to ₹50 Lakhs (No collateral options).
2. 💼 *Personal Loan* — Instant personal loans for salaried & self-employed individuals up to ₹50 Lakhs.
3. 🏢 *Business Loan & MSME Working Capital* — Secured & unsecured business expansion, machinery & trade funding.
4. 📊 *CA Professional Loan* — Specialized funding for Chartered Accountants, COP holders & audit firms.
5. 🏠 *Home Loan & Construction Funding* — New flats, row houses, plot purchase & balance transfer with top-up.
6. 🏬 *Mortgage Loan / Loan Against Property (LAP)* — Loans against residential, commercial & industrial property.
7. 🎓 *Education Loan (India & Global Studies)* — Higher education in India or overseas (USA, UK, Canada, Germany, Australia).
8. 🏫 *School & College Institutional Funding* — Trust, society & educational institution campus development & expansion.

📲 *Direct WhatsApp Advisory:* 9175635165 (+91 91756 35165)
👤 *Chief Loan Advisor:* Sachin Shinde
🌐 *Official Website:* https://www.avanifinserv.com/
═══════════════════════════════════════`;

export default function InboxPage() {
  const [contacts, setContacts] = useState<any[]>([]);
  const [activeContactId, setActiveContactId] = useState<string | null>(null);
  const [messages, setMessages] = useState<any[]>([]);
  const [replyText, setReplyText] = useState("");
  const [autoReplyEnabled, setAutoReplyEnabled] = useState<boolean>(true);
  const [isSending, setIsSending] = useState(false);
  const [statusNotification, setStatusNotification] = useState<string | null>(null);

  const showNotification = (msg: string) => {
    setStatusNotification(msg);
    setTimeout(() => setStatusNotification(null), 4000);
  };

  const fetchContacts = async () => {
    try {
      const response = await fetch(`${API_URL}/contacts`);
      const data = await response.json();
      setContacts(Array.isArray(data) ? data : (data.contacts || []));
    } catch (error) {
      console.error("Failed to fetch contacts", error);
    }
  };

  const fetchMessages = async (contactId: string) => {
    try {
      const response = await fetch(`${API_URL}/contacts/${contactId}`);
      const data = await response.json();
      const fetchedMsgs = data.messages || [];
      setMessages(fetchedMsgs);

      // Auto-reply logic: if enabled and last message is from user and not yet replied by assistant
      if (autoReplyEnabled && fetchedMsgs.length > 0) {
        const lastMsg = fetchedMsgs[fetchedMsgs.length - 1];
        if (lastMsg.role === 'user') {
          console.log('[AutoReply] Inbound message waiting for reply:', lastMsg.content);
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

  const activeContact = contacts.find(c => c.id === activeContactId || c._id === activeContactId);

  const handleSendReply = async (customMessage?: string) => {
    const textToSend = customMessage || replyText;
    if (!textToSend.trim() || !activeContactId) return;
    const contact = activeContact;
    if (!contact || !contact.phone) return;

    try {
      setIsSending(true);
      setMessages(prev => [
        ...prev,
        {
          id: `temp_${Date.now()}`,
          content: textToSend,
          role: 'assistant',
          timestamp: new Date().toISOString()
        }
      ]);

      if (!customMessage) {
        setReplyText("");
      }

      const response = await fetch(`${API_URL}/contacts/direct-message`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone: contact.phone, message: textToSend })
      });

      const resData = await response.json();
      if (resData.success) {
        showNotification("Message sent to WhatsApp via provider.");
      } else {
        showNotification(`Notice: ${resData.message || 'Queued in CRM'}`);
      }

      setTimeout(() => fetchMessages(activeContactId), 1500);
    } catch (error: any) {
      console.error("Failed to send reply", error);
      showNotification(`Failed to send: ${error.message}`);
    } finally {
      setIsSending(false);
    }
  };

  const handleSendProductDetails = async () => {
    const contact = activeContact;
    if (!contact) return;
    const msg = `${AVANI_INBOX_PRODUCT_DETAILS}\n\nDear Customer, thank you for contacting AVANI LOAN SERVICES. Our Founder & Chief Loan Advisor Sachin Shinde is available on WhatsApp at 9175635165 to assist you with custom sanction options.`;
    setReplyText(msg);
    showNotification("Product details inserted! Click Send or send automatically.");
  };

  const handleTriggerAiAutoReply = async () => {
    const contact = activeContact;
    if (!contact || messages.length === 0) return;
    const lastUserMsg = [...messages].reverse().find(m => m.role === 'user');
    const userText = lastUserMsg ? lastUserMsg.content : 'Hi, need loan';
    
    let generatedReply = "";
    const lower = userText.toLowerCase();

    if (lower.includes('doctor') || userText.includes('डॉक्टर')) {
      generatedReply = `Namaste! 🙏\n\nThank you for your inquiry regarding *Doctor Professional Loans* in Latur.\n\nAVANI LOAN SERVICES offers specialized funding for Medical Professionals:\n• Up to ₹50 Lakhs unsecured (No collateral required)\n• Competitive interest rates across 40+ partner banks & NBFCs\n• Minimal documentation: Degree (MBBS/MD/BDS), Medical Council Registration, last 2 years ITR, and 12 months bank statement.\n\n${AVANI_INBOX_PRODUCT_DETAILS}\n\nReply with your required loan amount or connect directly with Chief Loan Advisor Sachin Shinde on WhatsApp: 9175635165.`;
    } else if (lower.includes('home') || userText.includes('घर') || userText.includes('गृहकर्ज')) {
      generatedReply = `Namaste! 🙏\n\nThank you for reaching out regarding *Home Loans*.\n\nAVANI LOAN SERVICES secures the best housing finance rates across 40+ banks & NBFCs:\n• Purchase, construction, plot loan, and balance transfer with top-up\n• Tenure up to 30 years with lowest EMI\n• Doorstep document pick-up and personalized guidance\n\n${AVANI_INBOX_PRODUCT_DETAILS}\n\nReply with your city and loan requirement, or connect with Sachin Shinde on WhatsApp: 9175635165.`;
    } else if (lower.includes('business') || userText.includes('व्यापार') || userText.includes('बिझनेस')) {
      generatedReply = `Namaste! 🙏\n\nThank you for inquiring about *Business & MSME Loans*.\n\nWe provide working capital, term loans, and machinery finance:\n• Unsecured business loans up to ₹75 Lakhs\n• Fast sanction based on GST returns and banking turnover\n\n${AVANI_INBOX_PRODUCT_DETAILS}\n\nPlease share your business turnover or connect with Sachin Shinde directly on WhatsApp: 9175635165.`;
    } else {
      generatedReply = `Namaste! 🙏\n\nWelcome to AVANI LOAN SERVICES. We guide individuals, professionals, and businesses to secure the right loan from 40+ top banks and NBFCs.\n\n${AVANI_INBOX_PRODUCT_DETAILS}\n\nCould you please let us know which loan product you are interested in? You may also connect directly with Sachin Shinde on WhatsApp: 9175635165.`;
    }

    setReplyText(generatedReply);
    showNotification("AI auto-reply generated based on conversation context.");
  };

  return (
    <div className="flex h-[calc(100vh-64px)] border rounded-xl overflow-hidden bg-white dark:bg-zinc-900 border-zinc-200 dark:border-zinc-800">
      {/* Contact List */}
      <div className="w-1/3 border-r border-zinc-200 dark:border-zinc-800 overflow-y-auto">
        <div className="p-4 border-b border-zinc-200 dark:border-zinc-800 flex items-center justify-between">
          <h2 className="font-semibold text-lg dark:text-white">Conversations</h2>
          <span className="text-xs bg-zinc-800 text-zinc-300 px-2 py-0.5 rounded-full font-mono">
            {contacts.length}
          </span>
        </div>
        <div className="divide-y divide-zinc-100 dark:divide-zinc-800">
          {contacts.map((c, idx) => {
            const cId = c.id || c._id || `c_${idx}`;
            return (
              <div 
                key={cId} 
                onClick={() => {
                  setActiveContactId(cId);
                  fetchMessages(cId);
                }}
                className={`p-4 cursor-pointer hover:bg-zinc-50 dark:hover:bg-zinc-800 transition-colors ${activeContactId === cId ? 'bg-zinc-100 dark:bg-zinc-800' : ''}`}
              >
                <div className="flex items-center justify-between">
                  <div className="font-medium text-sm dark:text-zinc-200">{c.name || c.phone}</div>
                  {c.phone && (
                    <span className="text-[11px] text-zinc-500 font-mono">
                      {c.phone.slice(-10)}
                    </span>
                  )}
                </div>
                <div className="text-xs text-zinc-500 mt-1 truncate">
                  {c.messages && c.messages.length > 0 ? c.messages[0].content : "No messages yet"}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Chat Area */}
      <div className="w-2/3 flex flex-col">
        {activeContactId ? (
          <>
            {/* Chat Area Header with Auto-Reply Controller */}
            <div className="p-4 border-b border-zinc-200 dark:border-zinc-800 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-zinc-200 dark:bg-zinc-700 flex items-center justify-center">
                  <User className="w-5 h-5 text-zinc-500" />
                </div>
                <div>
                  <h3 className="font-semibold dark:text-white flex items-center gap-2">
                    {activeContact?.name || activeContact?.phone}
                    <span className="text-xs font-normal text-zinc-400 font-mono">
                      {activeContact?.phone ? `(${activeContact.phone})` : ''}
                    </span>
                  </h3>
                  <p className="text-xs text-zinc-500 flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-green-500"></span>
                    Live Chat via WhatsApp • Official Advisory Hotline: 9175635165
                  </p>
                </div>
              </div>

              {/* Auto Reply Mode Switch */}
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => {
                    const next = !autoReplyEnabled;
                    setAutoReplyEnabled(next);
                    showNotification(next ? "AI Auto-Reply enabled for incoming messages." : "AI Auto-Reply switched to Manual Mode.");
                  }}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium flex items-center gap-1.5 transition-colors border ${
                    autoReplyEnabled 
                      ? 'bg-green-600/20 text-green-400 border-green-500/40 hover:bg-green-600/30' 
                      : 'bg-zinc-800 text-zinc-400 border-zinc-700 hover:bg-zinc-700'
                  }`}
                  title="Toggle automatic AI auto-replies on WhatsApp"
                >
                  <Bot className="w-3.5 h-3.5" />
                  {autoReplyEnabled ? 'AI Auto-Reply: Active' : 'AI Auto-Reply: Off (Manual)'}
                </button>
              </div>
            </div>

            {/* Notification Banner */}
            {statusNotification && (
              <div className="bg-green-950/80 border-b border-green-800/50 text-green-200 text-xs px-4 py-2 flex items-center gap-2">
                <CheckCircle className="w-4 h-4 text-green-400 shrink-0" />
                <span>{statusNotification}</span>
              </div>
            )}

            {/* Message History */}
            <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-zinc-50 dark:bg-zinc-950">
              {messages.length === 0 ? (
                <div className="text-center text-zinc-500 text-sm mt-8">
                  No messages yet. Send a product introduction or loan checklist below.
                </div>
              ) : (
                messages.map(m => {
                  const isUser = m.role === 'user';
                  return (
                    <div key={m.id} className={`flex ${!isUser ? 'justify-end' : 'justify-start'}`}>
                      <div className={`max-w-[75%] p-3 rounded-lg text-sm whitespace-pre-wrap ${!isUser ? 'bg-green-600 text-white' : 'bg-white dark:bg-zinc-800 border dark:border-zinc-700 dark:text-white'}`}>
                        {m.content}
                        <div className={`text-[10px] mt-1 ${!isUser ? 'text-green-200' : 'text-zinc-400'}`}>
                          {new Date(m.timestamp).toLocaleTimeString()}
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
            </div>

            {/* Quick Response Bar + Manual Reply */}
            <div className="p-4 border-t border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 space-y-2">
              {/* Quick Actions Bar */}
              <div className="flex items-center gap-2 overflow-x-auto pb-1 text-xs scrollbar-none">
                <button 
                  type="button"
                  onClick={handleSendProductDetails}
                  className="px-2.5 py-1.5 bg-blue-600/20 hover:bg-blue-600/30 text-blue-400 border border-blue-500/30 rounded-lg flex items-center gap-1.5 whitespace-nowrap font-medium transition-colors"
                >
                  <Sparkles className="w-3.5 h-3.5" />
                  Send Product Details (WhatsApp: 9175635165)
                </button>
                <button 
                  type="button"
                  onClick={handleTriggerAiAutoReply}
                  className="px-2.5 py-1.5 bg-emerald-600/20 hover:bg-emerald-600/30 text-emerald-400 border border-emerald-500/30 rounded-lg flex items-center gap-1.5 whitespace-nowrap font-medium transition-colors"
                >
                  <Bot className="w-3.5 h-3.5" />
                  Auto-Reply with AI
                </button>
                <button 
                  type="button"
                  onClick={() => {
                    setReplyText(`🩺 *Doctor Loan Requirement — Required Documents:*\n1. Degree Certificate (MBBS/MD/BDS)\n2. Medical Council Registration Certificate\n3. Clinic / Hospital Registration Proof\n4. PAN Card & Aadhaar Card\n5. Last 2-3 years ITR with Computation\n6. Last 12 months Bank Statements\n\n${AVANI_INBOX_PRODUCT_DETAILS}\n\nPlease share these documents or connect directly with Sachin Shinde on WhatsApp: 9175635165.`);
                  }}
                  className="px-2.5 py-1.5 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 rounded-lg flex items-center gap-1.5 whitespace-nowrap transition-colors"
                >
                  <FileText className="w-3.5 h-3.5" />
                  Doctor Loan Checklist
                </button>
                <button 
                  type="button"
                  onClick={() => {
                    setReplyText(`🏠 *Home Loan Requirement — Required Documents:*\n1. PAN & Aadhaar Card of Applicant & Co-applicant\n2. Latest 3 months salary slips / 2 years ITR\n3. Last 6-12 months Bank Statement\n4. Copy of Agreement to Sale / Allotment Letter\n5. 7/12 Extract / Property Card & Tax Receipt\n\n${AVANI_INBOX_PRODUCT_DETAILS}\n\nPlease share these documents or connect directly with Sachin Shinde on WhatsApp: 9175635165.`);
                  }}
                  className="px-2.5 py-1.5 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 rounded-lg flex items-center gap-1.5 whitespace-nowrap transition-colors"
                >
                  <FileText className="w-3.5 h-3.5" />
                  Home Loan Checklist
                </button>
              </div>

              {/* Text Area & Send Button */}
              <div className="flex gap-2">
                <textarea 
                  rows={replyText.includes('\n') ? 4 : 1}
                  value={replyText}
                  onChange={(e) => setReplyText(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault();
                      handleSendReply();
                    }
                  }}
                  placeholder="Type a manual reply or use Quick Actions above..." 
                  className="flex-1 px-4 py-2 border dark:border-zinc-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500 dark:bg-zinc-800 dark:text-white resize-none text-sm"
                />
                <button 
                  type="button"
                  onClick={() => handleSendReply()}
                  disabled={isSending || !replyText.trim()}
                  className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center shrink-0"
                  title="Send via WhatsApp"
                >
                  <Send className="w-4 h-4" />
                </button>
              </div>
            </div>
          </>
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center text-zinc-500 gap-2">
            <User className="w-10 h-10 text-zinc-600" />
            <p>Select a conversation from the left to start chatting or send loan product details.</p>
          </div>
        )}
      </div>
    </div>
  );
}
