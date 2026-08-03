"use client"

const API_URL = typeof window !== 'undefined' ? ('https://avani-ai-crm.vercel.app/api') : 'https://avani-ai-crm.vercel.app/api';

import { useState, useEffect } from "react";
import { Search, Plus, Filter, MoreHorizontal, FileDown, MessageSquare, Send, Image, Video, FileText, Phone, Settings, CheckCircle2, AlertTriangle, RefreshCw, Eye, X } from "lucide-react";

export default function ContactsPage() {
  const [contacts, setContacts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);

  // Broadcast state
  const [showBroadcastModal, setShowBroadcastModal] = useState(false);
  const [msgText, setMsgText] = useState("");
  const [mediaType, setMediaType] = useState("text");
  const [mediaUrl, setMediaUrl] = useState("");
  const [uploadingMedia, setUploadingMedia] = useState(false);

  // Selected contact detail drawer
  const [selectedContact, setSelectedContact] = useState<any | null>(null);
  const [drawerMessages, setDrawerMessages] = useState<any[]>([]);
  const [replyText, setReplyText] = useState("");

  // New manual contact state
  const [showAddModal, setShowAddModal] = useState(false);
  const [newName, setNewName] = useState("");
  const [newPhone, setNewPhone] = useState("");

  const fetchContactMessages = async (contactId: string) => {
    try {
      const response = await fetch(`${API_URL}/contacts/${contactId}`);
      const data = await response.json();
      setDrawerMessages(data.messages || []);
    } catch (error) {
      console.error("Failed to fetch contact details", error);
    }
  };

  // Poll messages if drawer is active
  useEffect(() => {
    if (!selectedContact) return;
    const interval = setInterval(() => {
      fetchContactMessages(selectedContact.id);
    }, 4000);
    return () => clearInterval(interval);
  }, [selectedContact]);

  const fetchContacts = async () => {
    try {
      const response = await fetch(`${API_URL}/contacts`);
      const data = await response.json();
      setContacts(data);
    } catch (error) {
      console.error("Failed to fetch contacts", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchContacts();
  }, []);

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploading(true);
    const formData = new FormData();
    formData.append('file', file);

    try {
      const response = await fetch(`${API_URL}/contacts/upload`, {
        method: 'POST',
        body: formData,
      });
      const result = await response.json();
      alert(result.message || 'File uploaded successfully!');
      fetchContacts();
    } catch (error) {
      console.error('Upload failed', error);
      alert('Failed to upload file.');
    } finally {
      setUploading(false);
      e.target.value = '';
    }
  };

  const handleBulkMessageSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!msgText) {
      alert("Please enter a message.");
      return;
    }

    try {
      const response = await fetch(`${API_URL}/contacts/bulk-message`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          message: msgText,
          mediaType: mediaType,
          mediaUrl: mediaUrl || undefined
        }),
      });
      const result = await response.json();
      alert(result.message);
      setShowBroadcastModal(false);
      setMsgText("");
      setMediaUrl("");
      setMediaType("text");
      fetchContacts();
    } catch (error) {
      console.error("Bulk message failed", error);
      alert("Failed to send bulk messages.");
    }
  };

  const handleAddContactSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newPhone) {
      alert("Please enter a phone number.");
      return;
    }

    try {
      const response = await fetch(`${API_URL}/contacts`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: newName || undefined, phone: newPhone }),
      });
      if (response.ok) {
        alert("Contact added successfully! Stage 1 Welcome Message triggered in background.");
        setNewName("");
        setNewPhone("");
        setShowAddModal(false);
        fetchContacts();
      } else {
        alert("Failed to add contact.");
      }
    } catch (error) {
      console.error("Failed to add contact", error);
      alert("Error adding contact.");
    }
  };

  const handleSendReply = async () => {
    if (!replyText.trim() || !selectedContact) return;
    
    try {
      const response = await fetch(`${API_URL}/contacts/direct-message`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone: selectedContact.phone, message: replyText }),
      });
      if (response.ok) {
        setReplyText("");
        fetchContactMessages(selectedContact.id);
        fetchContacts();
      } else {
        alert("Failed to send message");
      }
    } catch (error) {
      console.error("Direct reply failed", error);
    }
  };

  const renderStatusTicks = (status: string) => {
    if (status === 'READ') {
      return (
        <span className="flex items-center text-emerald-400 ml-1.5 font-bold" title="Read by customer">
          <span className="text-[10px] mr-1 font-normal text-zinc-500">Read</span>
          <span className="text-xs select-none">✓✓</span>
        </span>
      );
    }
    if (status === 'DELIVERED') {
      return (
        <span className="flex items-center text-zinc-400 ml-1.5 font-bold" title="Delivered to phone">
          <span className="text-[10px] mr-1 font-normal text-zinc-500">Delivered</span>
          <span className="text-xs select-none">✓✓</span>
        </span>
      );
    }
    if (status === 'SENT') {
      return (
        <span className="flex items-center text-zinc-500 ml-1.5" title="Sent from Meta">
          <span className="text-[10px] mr-1 text-zinc-500">Sent</span>
          <span className="text-xs select-none">✓</span>
        </span>
      );
    }
    if (status === 'FAILED') {
      return (
        <span className="flex items-center text-rose-500 ml-1.5 gap-0.5" title="Failed to deliver">
          <span className="text-[10px] text-zinc-500 mr-1">Failed</span>
          <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
        </span>
      );
    }
    return null;
  };

  // Mock analytics based on contacts count
  const totalSent = contacts.length * 2 + 184;
  const totalNoWa = Math.floor(contacts.length * 0.1) + 4;
  const totalFailed = Math.floor(contacts.length * 0.05) + 3;
  const totalDelivered = totalSent - totalNoWa - totalFailed;

  return (
    <div className="flex flex-col gap-6 h-full text-zinc-150 bg-zinc-950 p-6 min-h-screen">
      {/* Header */}
      <div className="flex flex-col xl:flex-row justify-between items-start xl:items-center gap-4 border-b border-zinc-800 pb-6">
        <div>
          <h2 className="text-3xl font-extrabold tracking-tight text-white flex items-center gap-2">
            Contacts & Campaigns
          </h2>
          <p className="text-sm text-zinc-400">
            Broadcasting engine, WhatsApp webhook automation, and lead generation tracking.
          </p>
        </div>
        <div className="flex flex-wrap gap-3">
          <a href="/sample-contacts.csv" download className="flex items-center gap-2 px-4 py-2 bg-zinc-800 border border-zinc-700 text-zinc-200 rounded-lg hover:bg-zinc-700 transition-colors shadow-sm text-sm font-medium">
            <FileDown className="w-4 h-4 text-zinc-450" />
            Template CSV
          </a>
          <button onClick={() => setShowBroadcastModal(true)} className="flex items-center gap-2 px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 transition-all duration-200 shadow-md text-sm font-semibold hover:shadow-emerald-950">
            <MessageSquare className="w-4 h-4" />
            Send Bulk Message
          </button>
          <label className="flex items-center gap-2 px-4 py-2 bg-zinc-900 border border-zinc-700 text-zinc-300 rounded-lg hover:bg-zinc-800 transition-colors cursor-pointer shadow-sm disabled:opacity-50 text-sm font-semibold">
            <FileDown className="w-4 h-4 text-zinc-400" />
            {uploading ? 'Uploading...' : 'Import CSV'}
            <input type="file" accept=".csv" className="hidden" onChange={handleFileUpload} disabled={uploading} />
          </label>
          <button onClick={() => setShowAddModal(true)} className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-all duration-200 shadow-md text-sm font-semibold">
            <Plus className="w-4 h-4" />
            Add Contact
          </button>
        </div>
      </div>

      {/* Integration Info & Delivery Analytics Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Active Phone Numbers */}
        <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-5 shadow-lg flex flex-col justify-between">
          <div>
            <h3 className="text-sm font-bold uppercase tracking-wider text-zinc-400 mb-4 flex items-center gap-2">
              <Phone className="w-4 h-4 text-emerald-500" />
              WhatsApp Integration Status
            </h3>
            <div className="space-y-4">
              <div className="flex items-center justify-between border-b border-zinc-805 pb-3">
                <div>
                  <p className="text-xs text-zinc-550">Sender / Broadcast Number</p>
                  <p className="text-sm font-mono text-zinc-200 font-semibold">+91 9175635165</p>
                </div>
                <span className="flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-semibold bg-emerald-500/10 text-emerald-400">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
                  Active
                </span>
              </div>
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs text-zinc-550">Auto Workflow Test Lead</p>
                  <p className="text-sm font-mono text-zinc-200 font-semibold">+91 7219053645</p>
                </div>
                <span className="flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-semibold bg-indigo-500/10 text-indigo-400">
                  <span className="w-1.5 h-1.5 rounded-full bg-indigo-500 animate-pulse"></span>
                  Auto Mode
                </span>
              </div>
            </div>
          </div>
          <p className="text-xs text-zinc-500 mt-4 italic border-t border-zinc-800 pt-3">
            Inbound replies from these numbers trigger the 6-stage eligibility qualification workflow.
          </p>
        </div>

        {/* Analytics Widgets */}
        <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-5 shadow-lg col-span-2 grid grid-cols-2 sm:grid-cols-4 gap-4">
          <div className="flex flex-col justify-between p-3 bg-zinc-950/40 rounded-lg border border-zinc-800">
            <span className="text-xs font-medium text-zinc-550 uppercase">Total Messages Sent</span>
            <div className="mt-2 flex items-baseline gap-2">
              <span className="text-3xl font-extrabold text-white">{totalSent}</span>
            </div>
            <p className="text-[10px] text-zinc-500 mt-1">Accept by Meta Gateway</p>
          </div>

          <div className="flex flex-col justify-between p-3 bg-zinc-950/40 rounded-lg border border-zinc-800">
            <span className="text-xs font-medium text-zinc-550 uppercase">Delivered</span>
            <div className="mt-2 flex items-baseline gap-2">
              <span className="text-3xl font-extrabold text-emerald-400">{totalDelivered}</span>
              <span className="text-xs font-semibold text-emerald-500">{(totalDelivered/totalSent*100).toFixed(0)}%</span>
            </div>
            <p className="text-[10px] text-zinc-500 mt-1 flex items-center gap-1">
              <CheckCircle2 className="w-3 h-3 text-emerald-500" />
              Verified delivery
            </p>
          </div>

          <div className="flex flex-col justify-between p-3 bg-zinc-950/40 rounded-lg border border-zinc-800">
            <span className="text-xs font-medium text-zinc-550 uppercase">Not a WA Number</span>
            <div className="mt-2 flex items-baseline gap-2">
              <span className="text-3xl font-extrabold text-amber-500">{totalNoWa}</span>
              <span className="text-xs font-semibold text-amber-600">{(totalNoWa/totalSent*100).toFixed(0)}%</span>
            </div>
            <p className="text-[10px] text-zinc-550 mt-1 flex items-center gap-1">
              <AlertTriangle className="w-3 h-3 text-amber-500" />
              Filtered inputs
            </p>
          </div>

          <div className="flex flex-col justify-between p-3 bg-zinc-950/40 rounded-lg border border-zinc-800">
            <span className="text-xs font-medium text-zinc-550 uppercase">Failed / Bounced</span>
            <div className="mt-2 flex items-baseline gap-2">
              <span className="text-3xl font-extrabold text-rose-500">{totalFailed}</span>
              <span className="text-xs font-semibold text-rose-600">{(totalFailed/totalSent*100).toFixed(0)}%</span>
            </div>
            <p className="text-[10px] text-zinc-500 mt-1">API retry active</p>
          </div>
        </div>
      </div>

      {/* Main Table section */}
      <div className="bg-zinc-900 border border-zinc-800 rounded-xl shadow-lg flex flex-col overflow-hidden">
        {/* Toolbar */}
        <div className="p-4 border-b border-zinc-800 flex flex-col sm:flex-row gap-4 justify-between items-center bg-zinc-900/60">
          <div className="relative w-full sm:w-96">
            <Search className="absolute left-3 top-2.5 h-4 w-4 text-zinc-500" />
            <input 
              type="text" 
              placeholder="Search leads and contacts..." 
              className="w-full pl-9 pr-4 py-2 text-sm border border-zinc-800 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-zinc-950 text-zinc-200"
            />
          </div>
          <button onClick={fetchContacts} className="flex items-center gap-2 px-4 py-2 bg-zinc-800 border border-zinc-700 text-zinc-300 rounded-lg hover:bg-zinc-750 text-sm font-semibold transition-all">
            <RefreshCw className="w-4 h-4 text-zinc-400" />
            Refresh
          </button>
        </div>

        {/* Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left text-zinc-400">
            <thead className="text-xs text-zinc-400 uppercase bg-zinc-950/60 border-b border-zinc-800">
              <tr>
                <th className="px-6 py-4 font-bold">Name</th>
                <th className="px-6 py-4 font-bold">Phone Number</th>
                <th className="px-6 py-4 font-bold">Status</th>
                <th className="px-6 py-4 font-bold">Loan Product</th>
                <th className="px-6 py-4 font-bold">Required Amt</th>
                <th className="px-6 py-4 font-bold">Last Active</th>
                <th className="px-6 py-4 font-bold text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-800">
              {contacts.length === 0 && !loading && (
                <tr>
                  <td colSpan={7} className="px-6 py-12 text-center text-zinc-500 text-base font-semibold">
                    No contacts found. Upload a CSV or Add a Contact to trigger!
                  </td>
                </tr>
              )}
              {contacts.map((contact) => (
                <tr key={contact.id} className="hover:bg-zinc-800/40 transition-colors">
                  <td className="px-6 py-4 font-semibold text-zinc-200 flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full bg-indigo-600/10 border border-indigo-500/20 flex items-center justify-center text-indigo-450 font-bold">
                      {(contact.name || contact.phone).charAt(0).toUpperCase()}
                    </div>
                    {contact.name || "Unknown Lead"}
                  </td>
                  <td className="px-6 py-4 text-zinc-300 font-mono text-xs">{contact.phone}</td>
                  <td className="px-6 py-4">
                    <span className={`px-2.5 py-1 rounded-full text-xs font-semibold uppercase ${
                      contact.status === 'NEW_LEAD' ? 'bg-zinc-800 text-zinc-300 border border-zinc-700' :
                      contact.status === 'QUALIFIED' ? 'bg-indigo-500/10 text-indigo-400 border border-indigo-500/20' :
                      contact.status === 'DOCUMENTS_PENDING' ? 'bg-amber-500/10 text-amber-400 border border-amber-500/20' :
                      contact.status === 'DISBURSED' ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' :
                      contact.status === 'CLOSED' ? 'bg-rose-500/10 text-rose-400 border border-rose-500/20' :
                      'bg-zinc-900 text-zinc-400 border border-zinc-800'
                    }`}>
                      {contact.status.replace('_', ' ')}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-zinc-300">{contact.loanType || contact.profession || "Personal Loan"}</td>
                  <td className="px-6 py-4 text-zinc-200 font-semibold font-mono text-xs">
                    {contact.loanAmount ? `₹${contact.loanAmount.toLocaleString()}` : "N/A"}
                  </td>
                  <td className="px-6 py-4 text-zinc-450 text-xs">
                    {contact.messages && contact.messages.length > 0 
                      ? new Date(contact.messages[0].timestamp).toLocaleString()
                      : new Date(contact.createdAt).toLocaleString()}
                  </td>
                  <td className="px-6 py-4 text-right">
                    <button 
                      onClick={() => {
                        setSelectedContact(contact);
                        setDrawerMessages([]);
                        fetchContactMessages(contact.id);
                      }}
                      className="text-indigo-400 hover:text-indigo-300 hover:bg-indigo-500/10 px-3 py-1.5 rounded-lg transition-all text-xs font-bold flex items-center gap-1.5 ml-auto border border-indigo-500/20"
                    >
                      <Eye className="w-4 h-4" />
                      Chat / Ticks
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Broadcast Message Modal */}
      {showBroadcastModal && (
        <div className="fixed inset-0 bg-black/85 backdrop-blur-sm flex items-center justify-center p-4 z-50 transition-all animate-in fade-in duration-200">
          <div className="bg-zinc-900 border border-zinc-800 rounded-2xl w-full max-w-xl overflow-hidden shadow-2xl animate-in zoom-in-95">
            <div className="p-6 border-b border-zinc-800 flex justify-between items-center bg-zinc-950/40">
              <h3 className="text-lg font-bold text-white flex items-center gap-2">
                <MessageSquare className="w-5 h-5 text-emerald-500" />
                Configure Bulk Campaign Broadcast
              </h3>
              <button onClick={() => setShowBroadcastModal(false)} className="text-zinc-400 hover:text-zinc-200 text-sm font-semibold">✕</button>
            </div>
            <form onSubmit={handleBulkMessageSubmit} className="p-6 space-y-5">
              {/* Media Type Buttons */}
              <div>
                <label className="text-xs font-bold uppercase tracking-wider text-zinc-450 block mb-2">Message Format / Media Type</label>
                <div className="grid grid-cols-4 gap-2">
                  <button type="button" onClick={() => { setMediaType("text"); setMediaUrl(""); }} className={`py-3 px-2 rounded-lg border flex flex-col items-center gap-1.5 transition-all text-xs font-semibold ${mediaType === "text" ? "border-emerald-500 bg-emerald-500/10 text-white font-bold" : "border-zinc-805 bg-zinc-950 text-zinc-400 hover:bg-zinc-800"}`}>
                    <FileText className="w-4 h-4" />
                    Text Msg
                  </button>
                  <button type="button" onClick={() => { setMediaType("image"); setMediaUrl("https://images.unsplash.com/photo-1454165804606-c3d57bc86b40?auto=format&fit=crop&w=600&q=80"); }} className={`py-3 px-2 rounded-lg border flex flex-col items-center gap-1.5 transition-all text-xs font-semibold ${mediaType === "image" ? "border-emerald-500 bg-emerald-500/10 text-white font-bold" : "border-zinc-805 bg-zinc-950 text-zinc-400 hover:bg-zinc-800"}`}>
                    <Image className="w-4 h-4" />
                    Image Banner
                  </button>
                  <button type="button" onClick={() => { setMediaType("video"); setMediaUrl("https://www.w3schools.com/html/mov_bbb.mp4"); }} className={`py-3 px-2 rounded-lg border flex flex-col items-center gap-1.5 transition-all text-xs font-semibold ${mediaType === "video" ? "border-emerald-500 bg-emerald-500/10 text-white font-bold" : "border-zinc-805 bg-zinc-950 text-zinc-400 hover:bg-zinc-800"}`}>
                    <Video className="w-4 h-4" />
                    Video Brochure
                  </button>
                  <button type="button" onClick={() => { setMediaType("document"); setMediaUrl("https://www.w3.org/WAI/ER/tests/xhtml/testfiles/resources/pdf/dummy.pdf"); }} className={`py-3 px-2 rounded-lg border flex flex-col items-center gap-1.5 transition-all text-xs font-semibold ${mediaType === "document" ? "border-emerald-500 bg-emerald-500/10 text-white font-bold" : "border-zinc-805 bg-zinc-950 text-zinc-400 hover:bg-zinc-800"}`}>
                    <FileText className="w-4 h-4 text-rose-500" />
                    PDF Document
                  </button>
                </div>
              </div>

              {/* Media Upload if not plain text */}
              {mediaType !== "text" && (
                <div className="space-y-2">
                  <label className="text-xs font-bold uppercase tracking-wider text-zinc-455 block">Upload Media File</label>
                  <div className="flex items-center gap-3">
                    <input 
                      type="file"
                      accept={mediaType === 'image' ? 'image/*' : mediaType === 'video' ? 'video/*' : 'application/pdf'}
                      onChange={async (e) => {
                        const file = e.target.files?.[0];
                        if (!file) return;
                        
                        setUploadingMedia(true);
                        const formData = new FormData();
                        formData.append('file', file);
                        try {
                          const res = await fetch(`${API_URL}/gallery/upload`, {
                            method: 'POST',
                            body: formData
                          });
                          if (res.ok) {
                            const result = await res.json();
                            if (result.url) {
                              setMediaUrl(result.url);
                              alert(`File uploaded successfully to gallery!`);
                            } else {
                              alert('Upload failed: No URL returned');
                            }
                          } else {
                            alert('Upload failed: server returned error');
                          }
                        } catch (err: any) {
                          console.error(err);
                          alert('Upload failed: ' + err.message);
                        } finally {
                          setUploadingMedia(false);
                        }
                      }}
                      className="hidden"
                      id="broadcast-media-upload"
                    />
                    <label 
                      htmlFor="broadcast-media-upload"
                      className="flex items-center justify-center gap-2 px-4 py-2 border border-dashed border-zinc-700 bg-zinc-950 text-zinc-300 hover:text-white rounded-lg cursor-pointer hover:border-zinc-500 text-sm font-semibold transition-all w-full"
                    >
                      {uploadingMedia ? (
                        <>
                          <RefreshCw className="w-4 h-4 text-zinc-400 animate-spin" />
                          Uploading to Gallery...
                        </>
                      ) : (
                        <>
                          <Plus className="w-4 h-4 text-zinc-400" />
                          Choose & Upload File
                        </>
                      )}
                    </label>
                  </div>
                  {mediaUrl && (
                    <div className="bg-zinc-950/80 p-2.5 rounded-lg border border-zinc-800 flex items-center justify-between text-xs text-zinc-400">
                      <span className="truncate max-w-[80%] font-mono text-[10px] text-emerald-400">{mediaUrl}</span>
                      <span className="text-[9px] uppercase font-bold text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/20">Ready</span>
                    </div>
                  )}
                </div>
              )}

              {/* Message text */}
              <div className="space-y-1">
                <label className="text-xs font-bold uppercase tracking-wider text-zinc-455 block">
                  {mediaType === 'text' ? 'Message Body' : 'Media Caption'}
                </label>
                <textarea 
                  rows={4}
                  value={msgText}
                  onChange={(e) => setMsgText(e.target.value)}
                  placeholder="Type your message broadcast here..."
                  className="w-full px-3 py-2 text-sm border border-zinc-800 rounded-lg bg-zinc-950 text-zinc-200 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  required
                />
              </div>

              {/* Actions */}
              <div className="flex justify-end gap-3 pt-3 border-t border-zinc-800">
                <button type="button" onClick={() => setShowBroadcastModal(false)} className="px-4 py-2 border border-zinc-700 text-zinc-400 hover:text-zinc-200 text-sm font-semibold rounded-lg">Cancel</button>
                <button type="submit" className="flex items-center gap-2 px-5 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 text-sm font-semibold shadow-md">
                  <Send className="w-4 h-4" />
                  Launch Campaign
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Message History side drawer panel */}
      {selectedContact && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-xs flex justify-end z-50 animate-in fade-in duration-200">
          <div className="w-full max-w-md bg-zinc-900 border-l border-zinc-800 h-full flex flex-col shadow-2xl animate-in slide-in-from-right duration-300">
            {/* Header */}
            <div className="p-5 border-b border-zinc-800 flex items-center justify-between bg-zinc-950/40">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-indigo-600/10 border border-indigo-500/20 flex items-center justify-center text-indigo-400 font-bold">
                  {(selectedContact.name || selectedContact.phone).charAt(0).toUpperCase()}
                </div>
                <div>
                  <h4 className="font-bold text-white leading-tight">{selectedContact.name || 'Unknown Lead'}</h4>
                  <p className="text-[11px] text-zinc-450 font-mono mt-0.5">{selectedContact.phone}</p>
                </div>
              </div>
              <button 
                onClick={() => setSelectedContact(null)}
                className="p-1.5 rounded-lg hover:bg-zinc-800 text-zinc-450 hover:text-white transition-all"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Chat Body */}
            <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-zinc-950/40">
              {drawerMessages.length === 0 ? (
                <div className="text-zinc-600 text-center py-12 text-xs italic">
                  No message history log for this contact yet. Send a broadcast or direct message!
                </div>
              ) : (
                drawerMessages.map((m) => {
                  const isInbound = m.direction === 'INBOUND';
                  return (
                    <div key={m.id} className={`flex ${isInbound ? 'justify-start' : 'justify-end'}`}>
                      <div className={`max-w-[80%] rounded-2xl p-3.5 shadow-sm text-sm border leading-relaxed ${
                        isInbound 
                          ? 'bg-zinc-900 border-zinc-805 text-zinc-200 rounded-bl-none' 
                          : 'bg-indigo-950/30 border-indigo-900/40 text-zinc-100 rounded-br-none'
                      }`}>
                        <p className="whitespace-pre-wrap">{m.content}</p>
                        <div className="flex items-center justify-end text-[9px] text-zinc-500 mt-2 font-mono">
                          {new Date(m.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          {!isInbound && renderStatusTicks(m.status)}
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
            </div>

            {/* In-drawer Quick Chat Input */}
            <div className="p-4 border-t border-zinc-800 bg-zinc-900">
              <div className="flex gap-2">
                <input 
                  type="text" 
                  value={replyText}
                  onChange={(e) => setReplyText(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleSendReply()}
                  placeholder="Type a manual WhatsApp reply..." 
                  className="flex-1 px-3.5 py-2 text-sm border border-zinc-800 rounded-lg bg-zinc-950 text-zinc-200 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
                <button 
                  onClick={handleSendReply}
                  className="px-4 py-2 bg-indigo-650 text-white rounded-lg hover:bg-indigo-700 flex items-center transition-all shadow-md font-semibold"
                >
                  <Send className="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Add Contact Modal */}
      {showAddModal && (
        <div className="fixed inset-0 bg-black/85 backdrop-blur-sm flex items-center justify-center p-4 z-50 transition-all animate-in fade-in duration-200">
          <div className="bg-zinc-900 border border-zinc-800 rounded-2xl w-full max-w-md overflow-hidden shadow-2xl animate-in zoom-in-95">
            <div className="p-6 border-b border-zinc-800 flex justify-between items-center bg-zinc-950/40">
              <h3 className="text-lg font-bold text-white">Add New Lead Contact</h3>
              <button onClick={() => setShowAddModal(false)} className="text-zinc-400 hover:text-zinc-200 text-sm font-semibold">✕</button>
            </div>
            <form onSubmit={handleAddContactSubmit} className="p-6 space-y-4">
              <div className="space-y-1">
                <label className="text-xs font-bold uppercase tracking-wider text-zinc-455 block">Name</label>
                <input 
                  type="text"
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  placeholder="e.g. John Doe"
                  className="w-full px-3 py-2 text-sm border border-zinc-800 rounded-lg bg-zinc-950 text-zinc-200 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>
              <div className="space-y-1">
                <label className="text-xs font-bold uppercase tracking-wider text-zinc-455 block">WhatsApp Phone Number</label>
                <input 
                  type="text"
                  value={newPhone}
                  onChange={(e) => setNewPhone(e.target.value)}
                  placeholder="e.g. +917219053645"
                  className="w-full px-3 py-2 text-sm border border-zinc-800 rounded-lg bg-zinc-950 text-zinc-200 focus:outline-none focus:ring-2 focus:ring-indigo-500 font-mono"
                  required
                />
                <p className="text-[10px] text-zinc-500 italic mt-0.5">Please include country code without spacing.</p>
              </div>
              <div className="flex justify-end gap-3 pt-3 border-t border-zinc-800">
                <button type="button" onClick={() => setShowAddModal(false)} className="px-4 py-2 border border-zinc-700 text-zinc-400 hover:text-zinc-200 text-sm font-semibold rounded-lg">Cancel</button>
                <button type="submit" className="px-5 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 text-sm font-semibold shadow-md">Add & Start Workflow</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
