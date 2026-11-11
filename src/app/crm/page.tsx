"use client";

import { useState, useEffect } from "react";
import { 
  Users, RefreshCw, Layers, TrendingUp, IndianRupee, 
  CheckCircle2, Clock, AlertTriangle, Building2, Landmark, 
  ShieldCheck, FileText, ArrowUpRight
} from "lucide-react";
import Link from "next/link";

export default function CRM() {
  const [metrics, setMetrics] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);

  const fetchMetrics = async () => {
    setIsLoading(true);
    try {
      const response = await fetch('/api/dashboard/metrics');
      const data = await response.json();
      if (data.success) {
        setMetrics(data);
      }
    } catch (error) {
      console.error("Failed to fetch metrics", error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchMetrics();
  }, []);

  const kpis = metrics?.kpis || {};
  const funnel = metrics?.funnel || {};
  const conversions = metrics?.conversions || {};
  const revenue = metrics?.revenue || {};

  return (
    <div className="flex flex-col gap-6 h-full p-6 max-w-7xl mx-auto text-zinc-100">
      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-zinc-900 border border-zinc-800 p-6 rounded-2xl">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold px-2 py-0.5 rounded bg-blue-500/10 border border-blue-500/20 text-blue-400">
              EXECUTIVE OPERATIONS DASHBOARD
            </span>
            <span className="text-xs font-bold px-2 py-0.5 rounded bg-emerald-500/10 border border-emerald-500/20 text-emerald-400">
              Live Conversion Metrics
            </span>
          </div>
          <h1 className="text-2xl font-black text-white mt-2 flex items-center gap-2">
            <TrendingUp className="w-6 h-6 text-emerald-500" />
            Lead-to-Revenue Performance Management
          </h1>
          <p className="text-xs text-zinc-400 mt-1">
            Real-time pipeline progression, qualification conversion, disbursement tracking, and revenue reconciliation.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <Link
            href="/leads"
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-xs font-bold transition-colors"
          >
            <Layers className="w-3.5 h-3.5" /> Open 20-Stage Pipeline
          </Link>
          <button 
            onClick={fetchMetrics}
            disabled={isLoading}
            className="flex items-center gap-2 px-3 py-2 bg-zinc-800 hover:bg-zinc-700 text-xs font-semibold rounded-lg transition-colors disabled:opacity-50"
          >
            <RefreshCw size={14} className={isLoading ? "animate-spin" : ""} /> 
            Refresh
          </button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-zinc-900 border border-zinc-800 p-4 rounded-xl">
          <span className="text-[11px] text-zinc-400 font-medium block">Total Enquiries</span>
          <div className="text-2xl font-black text-white mt-1">{funnel.enquiries || kpis.totalLeads || 0}</div>
          <span className="text-[10px] text-blue-400 mt-1 block">+{kpis.newLeadsToday || 0} new today</span>
        </div>

        <div className="bg-zinc-900 border border-zinc-800 p-4 rounded-xl">
          <span className="text-[11px] text-zinc-400 font-medium block">Qualified Opportunities</span>
          <div className="text-2xl font-black text-emerald-400 mt-1">{funnel.qualified || 0}</div>
          <span className="text-[10px] text-zinc-500 mt-1 block">Score ≥ 60 / 100</span>
        </div>

        <div className="bg-zinc-900 border border-zinc-800 p-4 rounded-xl">
          <span className="text-[11px] text-zinc-400 font-medium block">Loans Disbursed</span>
          <div className="text-2xl font-black text-teal-400 mt-1">{funnel.disbursed || 0}</div>
          <span className="text-[10px] text-teal-400 font-mono mt-1 block">₹{(revenue.totalDisbursedAmount || 0).toLocaleString('en-IN')} vol</span>
        </div>

        <div className="bg-zinc-900 border border-zinc-800 p-4 rounded-xl">
          <span className="text-[11px] text-zinc-400 font-medium block">Revenue Collected</span>
          <div className="text-2xl font-black text-amber-400 mt-1 font-mono">
            {revenue?.restricted ? 'ADMIN ONLY' : `₹${(revenue.totalActualRevenueReceived || 0).toLocaleString('en-IN')}`}
          </div>
          <span className="text-[10px] text-zinc-400 mt-1 block">
            {revenue?.restricted ? 'Financial details restricted to ADMIN' : `₹${(revenue.totalOutstandingAmount || 0).toLocaleString('en-IN')} outstanding`}
          </span>
        </div>
      </div>

      {/* Separated WhatsApp Delivery vs Sandbox Telemetry */}
      {metrics?.whatsappTelemetry && (
        <div className="bg-zinc-900 border border-zinc-800 p-5 rounded-2xl space-y-3" data-testid="crm-whatsapp-telemetry">
          <div className="flex justify-between items-center">
            <h3 className="text-xs font-bold text-zinc-300 uppercase tracking-wider">
              WhatsApp Telemetry (Mock Sandbox Separated from Live Delivery)
            </h3>
            <span className="text-[10px] text-zinc-400">Zero synthetic inflation</span>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-8 gap-2 text-center">
            <div className="bg-zinc-950 p-2.5 rounded-xl border border-zinc-800">
              <span className="text-[10px] text-zinc-400 block">Mock Attempts</span>
              <span className="text-lg font-black text-zinc-200">{metrics.whatsappTelemetry.mockAttempts}</span>
            </div>
            <div className="bg-zinc-950 p-2.5 rounded-xl border border-zinc-800">
              <span className="text-[10px] text-zinc-400 block">Real Accepted</span>
              <span className="text-lg font-black text-blue-400">{metrics.whatsappTelemetry.providerAccepted}</span>
            </div>
            <div className="bg-zinc-950 p-2.5 rounded-xl border border-zinc-800">
              <span className="text-[10px] text-zinc-400 block">Confirmed Delivered</span>
              <span className="text-lg font-black text-emerald-400">{metrics.whatsappTelemetry.delivered}</span>
            </div>
            <div className="bg-zinc-950 p-2.5 rounded-xl border border-zinc-800">
              <span className="text-[10px] text-zinc-400 block">Failed Deliveries</span>
              <span className="text-lg font-black text-red-400">{metrics.whatsappTelemetry.failed}</span>
            </div>
            <div className="bg-zinc-950 p-2.5 rounded-xl border border-zinc-800">
              <span className="text-[10px] text-zinc-400 block">Inbound Received</span>
              <span className="text-lg font-black text-cyan-400">{metrics.whatsappTelemetry.inboundReceived}</span>
            </div>
            <div className="bg-zinc-950 p-2.5 rounded-xl border border-zinc-800">
              <span className="text-[10px] text-zinc-400 block">Webhook Errors</span>
              <span className="text-lg font-black text-amber-400">{metrics.whatsappTelemetry.webhookProcessingErrors}</span>
            </div>
            <div className="bg-zinc-950 p-2.5 rounded-xl border border-zinc-800">
              <span className="text-[10px] text-zinc-400 block">Duplicate Events</span>
              <span className="text-lg font-black text-zinc-300">{metrics.whatsappTelemetry.duplicateWebhookEvents}</span>
            </div>
            <div className="bg-zinc-950 p-2.5 rounded-xl border border-zinc-800">
              <span className="text-[10px] text-zinc-400 block">Pending Confirm</span>
              <span className="text-lg font-black text-indigo-400">{metrics.whatsappTelemetry.pendingDeliveryConfirmations}</span>
            </div>
          </div>
        </div>
      )}

      {/* Funnel Progress Section */}
      <div className="bg-zinc-900 border border-zinc-800 p-6 rounded-2xl space-y-4">
        <div className="flex justify-between items-center pb-3 border-b border-zinc-800">
          <div>
            <h3 className="text-sm font-bold text-white flex items-center gap-2">
              <Layers className="w-4 h-4 text-blue-400" />
              Complete 7-Stage Lead-to-Disbursement Funnel
            </h3>
            <p className="text-[11px] text-zinc-400 mt-0.5">Every inquiry tracked with zero leakage</p>
          </div>
          <span className="text-xs text-zinc-500">Live MongoDB Aggregation</span>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-7 gap-3">
          {[
            { label: "1. Enquiries", val: funnel.enquiries || 0, color: "text-blue-400" },
            { label: "2. Contacted", val: funnel.contacted || 0, color: "text-cyan-400" },
            { label: "3. Qualified", val: funnel.qualified || 0, color: "text-emerald-400" },
            { label: "4. Docs Received", val: funnel.documentsReceived || 0, color: "text-purple-400" },
            { label: "5. Submitted", val: funnel.applicationsSubmitted || 0, color: "text-indigo-400" },
            { label: "6. Sanctioned", val: funnel.sanctioned || 0, color: "text-amber-400" },
            { label: "7. Disbursed", val: funnel.disbursed || 0, color: "text-emerald-500" },
          ].map((step, idx) => (
            <div key={idx} className="bg-zinc-950 p-3 rounded-xl border border-zinc-800/80 text-center space-y-1">
              <span className="text-[10px] font-bold text-zinc-400 block">{step.label}</span>
              <div className={`text-xl font-black ${step.color}`}>{step.val}</div>
            </div>
          ))}
        </div>

        {/* Conversion Rate Metrics */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 pt-2">
          <div className="bg-zinc-950 p-3.5 rounded-xl border border-zinc-800 flex justify-between items-center">
            <div>
              <span className="text-[10px] text-zinc-500 block uppercase font-bold">Lead-to-Application</span>
              <span className="text-sm font-bold text-zinc-200">Enquiry → Submitted</span>
            </div>
            <span className="text-lg font-black text-blue-400">{conversions.leadToAppPct || 0}%</span>
          </div>

          <div className="bg-zinc-950 p-3.5 rounded-xl border border-zinc-800 flex justify-between items-center">
            <div>
              <span className="text-[10px] text-zinc-500 block uppercase font-bold">Application-to-Sanction</span>
              <span className="text-sm font-bold text-zinc-200">Submitted → Sanctioned</span>
            </div>
            <span className="text-lg font-black text-amber-400">{conversions.appToSanctionPct || 0}%</span>
          </div>

          <div className="bg-zinc-950 p-3.5 rounded-xl border border-zinc-800 flex justify-between items-center">
            <div>
              <span className="text-[10px] text-zinc-500 block uppercase font-bold">Sanction-to-Disbursement</span>
              <span className="text-sm font-bold text-zinc-200">Sanctioned → Disbursed</span>
            </div>
            <span className="text-lg font-black text-emerald-400">{conversions.sanctionToDisbursedPct || 0}%</span>
          </div>
        </div>
      </div>

      {/* Product & Advisor Breakdown */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Product Category Distribution */}
        <div className="bg-zinc-900 border border-zinc-800 p-5 rounded-2xl space-y-3">
          <h4 className="text-xs font-bold text-zinc-300 uppercase tracking-wider flex items-center gap-2">
            <Building2 className="w-4 h-4 text-blue-400" /> Loan Product Inquiries
          </h4>
          <div className="space-y-2">
            {Object.entries(kpis.leadsByLoanCategory || {}).map(([prod, count]: [string, any]) => (
              <div key={prod} className="bg-zinc-950 p-2.5 rounded-lg border border-zinc-850 flex justify-between items-center text-xs">
                <span className="text-zinc-300 font-medium">{prod}</span>
                <span className="text-xs font-bold px-2 py-0.5 rounded bg-blue-950 text-blue-400 border border-blue-500/20">{count} leads</span>
              </div>
            ))}
          </div>
        </div>

        {/* Operating Safeguards & Health Summary */}
        <div className="bg-zinc-900 border border-zinc-800 p-5 rounded-2xl space-y-3">
          <h4 className="text-xs font-bold text-zinc-300 uppercase tracking-wider flex items-center gap-2">
            <ShieldCheck className="w-4 h-4 text-emerald-400" /> Active Operating Safeguards
          </h4>
          <div className="space-y-2 text-xs">
            <div className="bg-zinc-950 p-2.5 rounded-lg border border-zinc-850 flex justify-between items-center">
              <span className="text-zinc-300">Provider Operating Mode</span>
              <span className="px-2 py-0.5 rounded bg-emerald-950 text-emerald-400 font-bold border border-emerald-500/20 text-[10px]">MOCK SAFEGUARD</span>
            </div>
            <div className="bg-zinc-950 p-2.5 rounded-lg border border-zinc-850 flex justify-between items-center">
              <span className="text-zinc-300">CRM AI Autonomous Replies</span>
              <span className="px-2 py-0.5 rounded bg-blue-950 text-blue-400 font-bold border border-blue-500/20 text-[10px]">DISABLED (Human-Supervised)</span>
            </div>
            <div className="bg-zinc-950 p-2.5 rounded-lg border border-zinc-850 flex justify-between items-center">
              <span className="text-zinc-300">Bulk Broadcast Marketing</span>
              <span className="px-2 py-0.5 rounded bg-zinc-800 text-zinc-400 font-bold text-[10px]">DISABLED</span>
            </div>
            <div className="bg-zinc-950 p-2.5 rounded-lg border border-zinc-850 flex justify-between items-center">
              <span className="text-zinc-300">Authorized Test Recipient Clamp</span>
              <span className="px-2 py-0.5 rounded bg-zinc-800 text-zinc-400 font-mono text-[10px]">+91 91756 35165</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
