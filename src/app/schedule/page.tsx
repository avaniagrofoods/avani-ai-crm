"use client";

import React, { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Calendar, Plus, Clock, CheckCircle, XCircle } from "lucide-react";

export default function SchedulePage() {
  const [scheduledItems, setScheduledItems] = useState([
    { id: 1, title: "Diwali Loan Offer Broadcast", date: "2026-10-15", time: "10:00 AM", status: "SCHEDULED", type: "Broadcast" },
    { id: 2, title: "Follow-up Call - John Doe", date: "2026-08-02", time: "14:30 PM", status: "SCHEDULED", type: "Call" },
    { id: 3, title: "Monsoon Offer Campaign", date: "2026-07-28", time: "09:00 AM", status: "COMPLETED", type: "Broadcast" }
  ]);

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
        <button className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-lg text-sm font-semibold transition-colors">
          <Plus className="w-4 h-4" />
          New Schedule
        </button>
      </div>

      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        {scheduledItems.map((item) => (
          <Card key={item.id} className="bg-zinc-900 border-zinc-800">
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
              <div className={`text-xs font-medium inline-flex px-2 py-1 rounded ${item.status === 'SCHEDULED' ? 'bg-amber-500/10 text-amber-500' : 'bg-emerald-500/10 text-emerald-500'}`}>
                {item.status}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
