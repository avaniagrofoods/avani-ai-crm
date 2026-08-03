"use client"

const API_URL = typeof window !== 'undefined' ? ('https://avani-ai-crm.vercel.app/api') : 'https://avani-ai-crm.vercel.app/api';

import { useState, useEffect } from "react";
import { Send, User } from "lucide-react";

export default function InboxPage() {
  const [contacts, setContacts] = useState<any[]>([]);
  const [activeContactId, setActiveContactId] = useState<string | null>(null);
  const [messages, setMessages] = useState<any[]>([]);
  const [replyText, setReplyText] = useState("");

  const fetchContacts = async () => {
    try {
      const response = await fetch(`${API_URL}/contacts`);
      const data = await response.json();
      setContacts(data);
    } catch (error) {
      console.error("Failed to fetch contacts", error);
    }
  };

  const fetchMessages = async (contactId: string) => {
    try {
      const response = await fetch(`${API_URL}/contacts/${contactId}`);
      const data = await response.json();
      setMessages(data.messages || []);
    } catch (error) {
      console.error("Failed to fetch messages", error);
    }
  };

  useEffect(() => {
    fetchContacts();
    // Poll every 5 seconds for new messages
    const interval = setInterval(() => {
      fetchContacts();
      if (activeContactId) {
        fetchMessages(activeContactId);
      }
    }, 5000);
    return () => clearInterval(interval);
  }, [activeContactId]);

  const handleSendReply = async () => {
    if (!replyText.trim() || !activeContactId) return;
    const contact = contacts.find(c => c.id === activeContactId);
    if (!contact || !contact.phone) return;

    try {
      // Create a local optimistic message
      setMessages([...messages, { 
        id: 'temp', 
        content: replyText, 
        role: 'assistant', 
        timestamp: new Date().toISOString() 
      }]);
      
      const response = await fetch(`${API_URL}/contacts/direct-message`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone: contact.phone, message: replyText })
      });
      setReplyText("");
      setTimeout(() => fetchMessages(activeContactId), 2000);
    } catch (error) {
      console.error("Failed to send reply", error);
    }
  };

  const activeContact = contacts.find(c => c.id === activeContactId);

  return (
    <div className="flex h-[calc(100vh-64px)] border rounded-xl overflow-hidden bg-white dark:bg-zinc-900 border-zinc-200 dark:border-zinc-800">
      {/* Contact List */}
      <div className="w-1/3 border-r border-zinc-200 dark:border-zinc-800 overflow-y-auto">
        <div className="p-4 border-b border-zinc-200 dark:border-zinc-800">
          <h2 className="font-semibold text-lg dark:text-white">Conversations</h2>
        </div>
        <div className="divide-y divide-zinc-100 dark:divide-zinc-800">
          {contacts.map(c => (
            <div 
              key={c.id} 
              onClick={() => {
                setActiveContactId(c.id);
                fetchMessages(c.id);
              }}
              className={`p-4 cursor-pointer hover:bg-zinc-50 dark:hover:bg-zinc-800 transition-colors ${activeContactId === c.id ? 'bg-zinc-100 dark:bg-zinc-800' : ''}`}
            >
              <div className="font-medium text-sm dark:text-zinc-200">{c.name || c.phone}</div>
              <div className="text-xs text-zinc-500 mt-1 truncate">
                {c.messages && c.messages.length > 0 ? c.messages[0].content : "No messages yet"}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Chat Area */}
      <div className="w-2/3 flex flex-col">
        {activeContactId ? (
          <>
            <div className="p-4 border-b border-zinc-200 dark:border-zinc-800 flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-zinc-200 dark:bg-zinc-700 flex items-center justify-center">
                <User className="w-5 h-5 text-zinc-500" />
              </div>
              <div>
                <h3 className="font-semibold dark:text-white">{activeContact?.name || activeContact?.phone}</h3>
                <p className="text-xs text-zinc-500">Live Chat via WhatsApp</p>
              </div>
            </div>
            <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-zinc-50 dark:bg-zinc-950">
              {messages.map(m => {
                const isUser = m.role === 'user';
                return (
                  <div key={m.id} className={`flex ${!isUser ? 'justify-end' : 'justify-start'}`}>
                    <div className={`max-w-[70%] p-3 rounded-lg text-sm ${!isUser ? 'bg-green-600 text-white' : 'bg-white dark:bg-zinc-800 border dark:border-zinc-700 dark:text-white'}`}>
                      {m.content}
                      <div className={`text-[10px] mt-1 ${!isUser ? 'text-green-200' : 'text-zinc-400'}`}>
                        {new Date(m.timestamp).toLocaleTimeString()}
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
            <div className="p-4 border-t border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900">
              <div className="flex gap-2">
                <input 
                  type="text" 
                  value={replyText}
                  onChange={(e) => setReplyText(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleSendReply()}
                  placeholder="Type a manual reply..." 
                  className="flex-1 px-4 py-2 border dark:border-zinc-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500 dark:bg-zinc-800 dark:text-white"
                />
                <button 
                  onClick={handleSendReply}
                  className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 flex items-center gap-2"
                >
                  <Send className="w-4 h-4" />
                </button>
              </div>
            </div>
          </>
        ) : (
          <div className="flex-1 flex items-center justify-center text-zinc-500">
            Select a conversation to start chatting.
          </div>
        )}
      </div>
    </div>
  )
}
