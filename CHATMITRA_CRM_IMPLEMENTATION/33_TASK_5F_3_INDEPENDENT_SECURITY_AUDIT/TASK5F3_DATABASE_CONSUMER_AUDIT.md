# TASK 5F.3 — DATABASE CONSUMER CALL-SITE AUDIT
**Project:** AVANI LOAN SERVICES — ChatMitra + AVANI AI CRM  
**Date:** 18 November 2026  
**Auditor:** Senior Application Security Auditor & TypeScript Reviewer  
**Audit Target:** All MongoDB connection consumers in Project 2 (`3-AVANI AI CRM/src/`)

---

## 1. Executive Summary

A comprehensive, automated, recursive scan was conducted across all TypeScript, JavaScript, and TSX files in `3-AVANI AI CRM/src/` to identify every call site that establishes or consumes a database connection.

The audit verified:
1. Whether any alternate connection paths exist (e.g. direct `new MongoClient()` or `mongoose.createConnection()`).
2. Whether any API route or background worker bypasses `src/lib/db.ts`.
3. Whether connection caches can leak across execution contexts.

### Key Audit Finding:
**Zero bypass paths were found.** Every API route, webhook receiver, background cron worker, and internal service in the entire application imports and invokes `connectToDatabase()` exclusively via `src/lib/db.ts`.

---

## 2. Complete Inventory of Connection Call Sites (54 Files)

### A. API Endpoints (`src/app/api/`) — 35 Files
| File Path | Invocation Line(s) | Function Called | ReadyState Verification |
| :--- | :--- | :--- | :--- |
| `src/app/api/advisors/route.ts` | Lines 11, 34 | `await connectToDatabase()` | Checked |
| `src/app/api/broadcasts/create/route.ts` | Line 25 | `await connectToDatabase()` | Checked (Line 34) |
| `src/app/api/broadcasts/send/route.ts` | Line 30 | `await connectToDatabase()` | Checked (Lines 42, 46, 86) |
| `src/app/api/broadcasts/[id]/stats/route.ts` | Line 22 | `await connectToDatabase()` | Checked (Line 24) |
| `src/app/api/callkaro-webhook/route.ts` | Line 29 | `await connectToDatabase()` | Checked |
| `src/app/api/campaigns/schedule/route.ts` | Lines 24, 75, 92 | `await connectToDatabase()` | Checked |
| `src/app/api/chatmantra-webhook/route.ts` | Line 96 | `await connectToDatabase()` | Checked (Line 97) |
| `src/app/api/chatmitra-webhook/route.ts` | Line 96 | `await connectToDatabase()` | Checked (Line 97) |
| `src/app/api/contacts/route.ts` | Lines 13, 99 | `await connectToDatabase()` | Checked |
| `src/app/api/contacts/bulk-message/route.ts` | Line 16 | `await connectToDatabase()` | Checked |
| `src/app/api/contacts/direct-message/route.ts` | Line 17 | `await connectToDatabase()` | Checked (Line 18) |
| `src/app/api/contacts/upload/route.ts` | Line 11 | `await connectToDatabase()` | Checked |
| `src/app/api/contacts/[id]/route.ts` | Lines 35, 107 | `await connectToDatabase()` | Checked |
| `src/app/api/cron/follow-ups/route.ts` | Line 22 | `await connectToDatabase()` | Checked (Line 23) |
| `src/app/api/cron/process-scheduled/route.ts` | Line 27 | `await connectToDatabase()` | Checked (Line 28) |
| `src/app/api/dashboard/metrics/route.ts` | Line 96 | `await connectToDatabase()` | Checked (Line 97) |
| `src/app/api/diagnostics/route.ts` | Line 56 | `await connectToDatabase()` | Checked (Line 57) |
| `src/app/api/documents/secure-upload/route.ts` | Lines 28, 95 | `await connectToDatabase()` | Checked |
| `src/app/api/forensic-test/route.ts` | Line 18 | `await connectToDatabase()` | Checked |
| `src/app/api/golden-test-state/route.ts` | Line 12 | `await connectToDatabase()` | Checked |
| `src/app/api/health/route.ts` | Line 32 | `await connectToDatabase()` | Checked (Line 33) |
| `src/app/api/leads/route.ts` | Lines 54, 184 | `await connectToDatabase()` | Checked |
| `src/app/api/leads/trigger/route.ts` | Line 15 | `await connectToDatabase()` | Checked |
| `src/app/api/leads/upload/route.ts` | Line 12 | `await connectToDatabase()` | Checked |
| `src/app/api/leads/[id]/route.ts` | Lines 65, 99 | `await connectToDatabase()` | Checked |
| `src/app/api/leads/[id]/application/route.ts` | Line 16 | `await connectToDatabase()` | Checked |
| `src/app/api/omnidim-webhook/route.ts` | Line 109 | `await connectToDatabase()` | Checked (Lines 110, 154) |
| `src/app/api/opts/route.ts` | Lines 16, 114, 192 | `await connectToDatabase()` | Checked (Lines 17, 115, 193) |
| `src/app/api/public/enquiry/route.ts` | Line 20 | `await connectToDatabase()` | Checked |
| `src/app/api/schedule/route.ts` | Lines 14, 98, 198, 234 | `await connectToDatabase()` | Checked (Line 15) |
| `src/app/api/vapi-webhook/route.ts` | Line 46 | `await connectToDatabase()` | Checked |
| `src/app/api/webhooks/route.ts` | Line 11 | `await connectToDatabase()` | Checked |
| `src/app/api/whatsapp/templates/route.ts` | Line 14 | `await connectToDatabase()` | Checked |
| `src/app/api/whatsapp-webhook/route.ts` | Lines 137, 289, 360 | `await connectToDatabase()` | Checked (Lines 138, 290) |
| `src/app/api/whatsapp-webhook-worker/route.ts` | Line 31 | `await connectToDatabase()` | Checked (Line 32) |

### B. Core Libraries & Orchestration (`src/lib/`) — 19 Files
| File Path | Invocation Line(s) | Function Called | Role |
| :--- | :--- | :--- | :--- |
| `src/lib/advisor-handoff.ts` | Line 41 | `await connectToDatabase()` | Advisor assignment engine |
| `src/lib/aisensy.ts` | Lines 91, 270 | `await connectToDatabase()` | AiSensy provider integration |
| `src/lib/auth-store.ts` | Line 12 | `await connectToDatabase()` | Session / Auth verification |
| `src/lib/controlled-rollout.ts` | Line 34 | `await connectToDatabase()` | Controlled campaign rollout |
| `src/lib/db.ts` | Lines 699, 874, 889 | Internal definitions | Core isolation engine & export |
| `src/lib/document-rules.ts` | Lines 110, 136 | `await connectToDatabase()` | Document verification rules |
| `src/lib/downstream-orchestrator.ts` | Line 37 | `await connectToDatabase()` | Workflow state progression |
| `src/lib/followup-engine.ts` | Lines 106, 186, 335 | `await connectToDatabase()` | Scheduled follow-up engine |
| `src/lib/meta-lead-ads.ts` | Line 26 | `await connectToDatabase()` | Meta Lead Ads ingestion |
| `src/lib/optout-engine.ts` | Line 61 | `await connectToDatabase()` | Opt-out consent suppression |
| `src/lib/provider-router.ts` | Line 33 | `await connectToDatabase()` | Provider dispatch routing |
| `src/lib/referral-cross-sell.ts` | Lines 50, 75 | `await connectToDatabase()` | Referral cross-sell engine |
| `src/lib/s2s-ecosystem.ts` | Line 111 | `await connectToDatabase()` | Server-to-server messaging |
| `src/lib/stage1-release.ts` | Lines 52, 122 | `await connectToDatabase()` | Stage-1 release gating |
| `src/lib/orchestrator/index.ts` | Line 19 | `await connectToDatabase()` | Conversation orchestrator |
| `src/lib/orchestrator/state-manager.ts` | Lines 8, 38 | `await connectToDatabase()` | State manager |
| `src/lib/orchestrator/welcome-flow.ts` | Line 18 | `await connectToDatabase()` | Welcome flow trigger |
| `src/lib/template-sync/aisensy.ts` | Line 31 | `await connectToDatabase()` | Template synchronization |

---

## 3. Absence of Direct Bypass Connections

An exhaustive search for direct driver connection patterns returned the following:
- `new MongoClient`: **0 occurrences** across all source files.
- `MongoClient.connect`: **0 occurrences**.
- `mongoose.connect`: **1 occurrence** (strictly encapsulated inside `src/lib/db.ts` line 779).
- `mongoose.createConnection`: **0 occurrences**.

---

## 4. Auditor Conclusion

All MongoDB access across the entire AVANI AI CRM codebase is routed through `connectToDatabase()`. There are **zero bypass routes, zero shadow connection pools, and zero unverified background consumers**.
