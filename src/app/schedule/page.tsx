"use client";

import React, { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Calendar, Plus, Clock, CheckCircle, X, Send } from "lucide-react";

export default function SchedulePage() {
  const [scheduledItems, setScheduledItems] = useState([
    { id: 1, title: "Diwali Loan Offer Broadcast", date: "2026-10-15", time: "10:00 AM", status: "SCHEDULED", type: "Broadcast" },
    { id: 2, title: "Follow-up Call - John Doe", date: "2026-08-02", time: "14:30 PM", status: "SCHEDULED", type: "Call" },
    { id: 3, title: "Monsoon Offer Campaign", date: "2026-07-28", time: "09:00 AM", status: "COMPLETED", type: "Broadcast" }
  ]);

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [date, setDate] = useState("");
  const [time, setTime] = useState("");
  const [type, setType] = useState("Broadcast");

  const handleAddSchedule = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title || !date || !time) {
      alert("Please fill in all schedule details.");
      return;
    }

    const newItem = {
      id: Date.now(),
      title,
      date,
      time,
      status: "SCHEDULED",
      type
    };

    setScheduledItems([newItem, ...scheduledItems]);
    setTitle("");
    setDate("");
    setTime("");
    setIsModalOpen(false);
  };

  return (
    <div className="space-y-8 text-zinc-200 max-w-[1200px] mx-auto pb-12">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-zinc-900 border border-zinc-800 p-6 rounded-2xl shadow-md">
        <div>
          <h2 className="text-3xl font-extrabold tracking-tight text-white flex items-center gap-3">
            <Calendar className="w-8 h-8 text-indigo-400" />
            Schedule
          </h2>
          <p className="text-sm text-zinc-400 mt-1">
            Manage your upcoming broadcasts, follow-up calls, and task reminders.
          </p>
        </div>
        <button 
          onClick={() => setIsModalOpen(true)}
          className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2.5 rounded-lg text-sm font-semibold transition-all shadow-lg hover:shadow-indigo-500/20"
        >
          <Plus className="w-4 h-4" />
          New Schedule
        </button>
      </div>

      {/* Schedule Items Grid */}
      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        {scheduledItems.map((item) => (
          <Card key={item.id} className="bg-zinc-900 border-zinc-800 hover:border-zinc-700 transition-colors">
            <CardHeader className="pb-3">
              <div className="flex justify-between items-start">
                <div className="text-xs font-semibold uppercase tracking-wider text-indigo-400 bg-indigo-500/10 px-2 py-0.5 rounded border border-indigo-500/20">
                  {item.type}
                </div>
                {item.status === "SCHEDULED" ? (
                  <Clock className="w-4 h-4 text-amber-400" />
                ) : (
                  <CheckCircle className="w-4 h-4 text-emerald-400" />
                )}
              </div>
              <CardTitle className="text-lg text-white mt-2">{item.title}</CardTitle>
              <CardDescription className="text-zinc-400">
                {item.date} at {item.time}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className={`text-xs font-medium inline-flex px-2.5 py-1 rounded-full ${item.status === 'SCHEDULED' ? 'bg-amber-500/10 text-amber-400 border border-amber-500/20' : 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'}`}>
                {item.status}
              </div>
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
              <button 
                onClick={() => setIsModalOpen(false)}
                className="text-zinc-400 hover:text-white p-1 rounded-lg hover:bg-zinc-800 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleAddSchedule} className="space-y-4">
              <div>
                <label className="text-xs font-medium text-zinc-400 block mb-1">Campaign / Event Title</label>
                <input 
                  type="text" 
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="e.g. Festival Loan Offer Campaign"
                  className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-white placeholder-zinc-500 focus:outline-none focus:border-indigo-500"
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-medium text-zinc-400 block mb-1">Date</label>
                  <input 
                    type="date" 
                    value={date}
                    onChange={(e) => setDate(e.target.value)}
                    className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-indigo-500"
                    required
                  />
                </div>
                <div>
                  <label className="text-xs font-medium text-zinc-400 block mb-1">Time</label>
                  <input 
                    type="time" 
                    value={time}
                    onChange={(e) => setTime(e.target.value)}
                    className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-indigo-500"
                    required
                  />
                </div>
              </div>

              <div>
                <label className="text-xs font-medium text-zinc-400 block mb-1">Schedule Type</label>
                <select 
                  value={type}
                  onChange={(e) => setType(e.target.value)}
                  className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-indigo-500"
                >
                  <option value="Broadcast">WhatsApp Broadcast</option>
                  <option value="Call">AI Voice Call</option>
                  <option value="Reminder">Follow-up Reminder</option>
                </select>
              </div>

              <div className="flex justify-end gap-3 pt-3 border-t border-zinc-800">
                <button 
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 rounded-lg text-sm text-zinc-400 hover:bg-zinc-800 transition-colors"
                >
                  Cancel
                </button>
                <button 
                  type="submit"
                  className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors"
                >
                  <Send className="w-4 h-4" />
                  Save Schedule
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
