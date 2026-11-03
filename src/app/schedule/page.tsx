"use client";

import React, { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Calendar, Plus, Clock, CheckCircle, X, RefreshCw, Trash2, Ban } from "lucide-react";

export default function SchedulePage() {
  const [scheduledItems, setScheduledItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [date, setDate] = useState("");
  const [time, setTime] = useState("10:00 AM");
  const [type, setType] = useState("Broadcast");
  const [targetAudience, setTargetAudience] = useState("ALL_LEADS");
  const [templateName, setTemplateName] = useState("Avani_Loan_Welcome");
  const [submitting, setSubmitting] = useState(false);

  const fetchSchedules = async () => {
    try {
      setLoading(true);
      const res = await fetch('/api/schedule');
      const data = await res.json();
      if (data.success && Array.isArray(data.schedules)) {
        setScheduledItems(data.schedules);
      }
    } catch (e) {
      console.error("Failed to load schedules:", e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSchedules();
  }, []);

  const handleAddSchedule = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title || !date) {
      alert("Please fill in schedule title and date.");
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch('/api/schedule', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title,
          date,
          time,
          type,
          targetAudience,
          templateName
        })
      });
      const data = await res.json();
      if (data.success) {
        setTitle("");
        setDate("");
        setTime("10:00 AM");
        setIsModalOpen(false);
        fetchSchedules();
      } else {
        alert(data.message || data.error || "Failed to create schedule.");
      }
    } catch (err) {
      console.error("Error creating schedule:", err);
      alert("Error creating schedule.");
    } finally {
      setSubmitting(false);
    }
  };

  const handleCancelSchedule = async (scheduleId: string) => {
    if (!confirm("Are you sure you want to cancel this scheduled execution?")) return;
    try {
      const res = await fetch('/api/schedule', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ scheduleId, action: 'CANCEL' })
      });
      const data = await res.json();
      if (data.success) {
        fetchSchedules();
      }
    } catch (err) {
      console.error("Error cancelling schedule:", err);
    }
  };

  const handleDeleteSchedule = async (scheduleId: string) => {
    if (!confirm("Are you sure you want to permanently delete this schedule record?")) return;
    try {
      const res = await fetch(`/api/schedule?scheduleId=${encodeURIComponent(scheduleId)}`, {
        method: 'DELETE'
      });
      const data = await res.json();
      if (data.success) {
        setScheduledItems(prev => prev.filter(item => item.scheduleId !== scheduleId));
      }
    } catch (err) {
      console.error("Error deleting schedule:", err);
    }
  };

  return (
    <div className="space-y-8 text-zinc-200 max-w-[1200px] mx-auto pb-12 p-6">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-zinc-900 border border-zinc-800 p-6 rounded-2xl shadow-md">
        <div>
          <h2 className="text-3xl font-extrabold tracking-tight text-white flex items-center gap-3">
            <Calendar className="w-8 h-8 text-indigo-400" />
            Campaign & Task Schedule
          </h2>
          <p className="text-sm text-zinc-400 mt-1">
            Manage upcoming WhatsApp broadcasts, automated drip campaigns, and advisory follow-up schedules.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button 
            onClick={fetchSchedules}
            className="flex items-center gap-2 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 px-3 py-2.5 rounded-lg text-sm font-semibold transition-all border border-zinc-700"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </button>
          <button 
            onClick={() => setIsModalOpen(true)}
            className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2.5 rounded-lg text-sm font-semibold transition-all shadow-lg hover:shadow-indigo-500/20"
          >
            <Plus className="w-4 h-4" />
            New Schedule
          </button>
        </div>
      </div>

      {/* Loading & Empty State */}
      {loading && scheduledItems.length === 0 && (
        <div className="p-12 text-center text-zinc-500 bg-zinc-900/50 rounded-2xl border border-zinc-800">
          Loading schedules from MongoDB Atlas...
        </div>
      )}

      {!loading && scheduledItems.length === 0 && (
        <div className="p-12 text-center text-zinc-500 bg-zinc-900/50 rounded-2xl border border-zinc-800">
          No schedules found. Click "New Schedule" to create a campaign or follow-up reminder.
        </div>
      )}

      {/* Schedule Items Grid */}
      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        {scheduledItems.map((item) => (
          <Card key={item.scheduleId || item.id} className="bg-zinc-900 border-zinc-800 hover:border-zinc-700 transition-colors">
            <CardHeader className="pb-3">
              <div className="flex justify-between items-start">
                <div className="text-xs font-semibold uppercase tracking-wider text-indigo-400 bg-indigo-500/10 px-2 py-0.5 rounded border border-indigo-500/20">
                  {item.type}
                </div>
                {item.status === "SCHEDULED" ? (
                  <Clock className="w-4 h-4 text-amber-400" />
                ) : item.status === "COMPLETED" ? (
                  <CheckCircle className="w-4 h-4 text-emerald-400" />
                ) : (
                  <Ban className="w-4 h-4 text-rose-400" />
                )}
              </div>
              <CardTitle className="text-lg text-white mt-2 leading-snug">{item.title}</CardTitle>
              <CardDescription className="text-zinc-400 text-xs">
                {item.date} at {item.time} ({item.targetAudience || 'ALL_LEADS'})
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex justify-between items-center pt-1 border-t border-zinc-800/60">
                <span className={`text-xs font-semibold inline-flex px-2.5 py-0.5 rounded-full ${
                  item.status === 'SCHEDULED' ? 'bg-amber-500/10 text-amber-400 border border-amber-500/20' :
                  item.status === 'COMPLETED' ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' :
                  item.status === 'CANCELLED' ? 'bg-rose-500/10 text-rose-400 border border-rose-500/20' :
                  'bg-zinc-800 text-zinc-400'
                }`}>
                  {item.status}
                </span>

                <div className="flex items-center gap-1.5">
                  {item.status === 'SCHEDULED' && (
                    <button
                      onClick={() => handleCancelSchedule(item.scheduleId)}
                      className="text-xs text-amber-400 hover:text-amber-300 p-1 rounded hover:bg-amber-400/10"
                      title="Cancel schedule"
                    >
                      <Ban className="w-3.5 h-3.5" />
                    </button>
                  )}
                  <button
                    onClick={() => handleDeleteSchedule(item.scheduleId)}
                    className="text-xs text-rose-400 hover:text-rose-300 p-1 rounded hover:bg-rose-400/10"
                    title="Delete schedule"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>

              {item.executionResult && (
                <div className="bg-zinc-950/60 p-2.5 rounded-lg border border-zinc-800 text-[11px] text-zinc-400 font-mono">
                  <div>Dispatched: {item.executionResult.dispatched ?? 0} | Failed: {item.executionResult.failed ?? 0}</div>
                  <div className="text-zinc-500 text-[10px] mt-0.5">Executed: {new Date(item.executedAt).toLocaleString()}</div>
                </div>
              )}
            </CardContent>
          </Card>
        ))}
      </div>

      {/* New Schedule Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
          <div className="bg-zinc-900 border border-zinc-800 rounded-2xl w-full max-w-md p-6 shadow-2xl space-y-4">
            <div className="flex justify-between items-center border-b border-zinc-800 pb-3">
              <h3 className="text-lg font-bold text-white flex items-center gap-2">
                <Calendar className="w-5 h-5 text-indigo-400" />
                Create New Schedule
              </h3>
              <button onClick={() => setIsModalOpen(false)} className="text-zinc-400 hover:text-white p-1">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleAddSchedule} className="space-y-4">
              <div>
                <label className="text-xs font-semibold text-zinc-400 block mb-1 uppercase">Title / Campaign Name</label>
                <input 
                  type="text" 
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="e.g. MSME Working Capital Broadcast"
                  className="w-full bg-zinc-950 border border-zinc-800 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-indigo-500"
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-semibold text-zinc-400 block mb-1 uppercase">Date</label>
                  <input 
                    type="date" 
                    value={date}
                    onChange={(e) => setDate(e.target.value)}
                    className="w-full bg-zinc-950 border border-zinc-800 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-indigo-500"
                    required
                  />
                </div>
                <div>
                  <label className="text-xs font-semibold text-zinc-400 block mb-1 uppercase">Time</label>
                  <input 
                    type="text" 
                    value={time}
                    onChange={(e) => setTime(e.target.value)}
                    placeholder="10:00 AM"
                    className="w-full bg-zinc-950 border border-zinc-800 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-indigo-500"
                    required
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-semibold text-zinc-400 block mb-1 uppercase">Schedule Type</label>
                  <select 
                    value={type}
                    onChange={(e) => setType(e.target.value)}
                    className="w-full bg-zinc-950 border border-zinc-800 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-indigo-500"
                  >
                    <option value="Broadcast">Broadcast</option>
                    <option value="Follow-up Call">Follow-up Call</option>
                    <option value="Task Reminder">Task Reminder</option>
                    <option value="Custom">Custom</option>
                  </select>
                </div>
                <div>
                  <label className="text-xs font-semibold text-zinc-400 block mb-1 uppercase">Target Leads</label>
                  <select 
                    value={targetAudience}
                    onChange={(e) => setTargetAudience(e.target.value)}
                    className="w-full bg-zinc-950 border border-zinc-800 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-indigo-500"
                  >
                    <option value="ALL_LEADS">All Active Leads</option>
                    <option value="DOCTOR_LEADS">Doctor Loans</option>
                    <option value="DOCUMENTS_PENDING">Documents Pending</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="text-xs font-semibold text-zinc-400 block mb-1 uppercase">WhatsApp Template</label>
                <select 
                  value={templateName}
                  onChange={(e) => setTemplateName(e.target.value)}
                  className="w-full bg-zinc-950 border border-zinc-800 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-indigo-500 font-mono text-xs"
                >
                  <option value="Avani_Loan_Welcome">Avani_Loan_Welcome</option>
                  <option value="drip_day_1_eligibility">drip_day_1_eligibility</option>
                  <option value="drip_day_3_product_info">drip_day_3_product_info</option>
                  <option value="drip_day_7_assistance">drip_day_7_assistance</option>
                  <option value="drip_day_10_checklist">drip_day_10_checklist</option>
                  <option value="drip_day_15_advisor_status">drip_day_15_advisor_status</option>
                </select>
              </div>

              <div className="flex justify-end gap-3 pt-3 border-t border-zinc-800">
                <button type="button" onClick={() => setIsModalOpen(false)} className="px-4 py-2 text-sm text-zinc-400 hover:bg-zinc-800 rounded-lg">
                  Cancel
                </button>
                <button 
                  type="submit" 
                  disabled={submitting}
                  className="bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-lg text-sm font-medium disabled:opacity-50"
                >
                  {submitting ? 'Saving...' : 'Save Schedule'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
