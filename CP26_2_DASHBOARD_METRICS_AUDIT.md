# AVANI AI CRM — CP-26.2 GATE 5 & GATE 6: DASHBOARD METRICS RECONCILIATION AUDIT

**Milestone:** CP-26.2 Final Data-Integrity & Revenue Acceptance  
**Verification Method:** Live HTTP `GET /api/dashboard/metrics` against compiled local Next.js server (`avani_ai_crm_test`) + forensic inspection of `src/app/page.tsx` & `src/app/crm/page.tsx`

---

## 1. Gate 5 Executive Dashboard Reconciliation (`/api/dashboard/metrics` on `avani_ai_crm_test`)

Using 4 known synthetic leads (2 `DISBURSED`, 1 `QUALIFIED`, 1 `CLOSED_LOST`), every KPI, stage bucket, funnel step, conversion ratio, and revenue breakdown returned by `GET /api/dashboard/metrics` matched exact hand calculations (**100% PASS**):

| Category | Metric Key | Expected (Hand Calculation) | Returned by `/api/dashboard/metrics` | Status |
|---|---|---:|---:|---|
| **KPIs** | `kpis.totalLeads` | 4 | **4** | PASS |
| | `kpis.newLeadsToday` | 4 | **4** | PASS |
| | `kpis.qualifiedLeads` | 3 | **3** | PASS |
| | `kpis.unqualifiedLeads` | 1 | **1** | PASS |
| | `kpis.pendingFollowUpsCount` | 4 | **4** | PASS |
| | `kpis.followUpTasksDueCount` | 29 *(7×4 + 1 custom task)* | **29** | PASS |
| | `kpis.overdueFollowUpsCount` | 5 *(overdue task evaluation)* | **5** | PASS |
| **Product Split** | `kpis.leadsByLoanCategory` | Doctor: 1, Business: 1, Home: 1, Personal: 1 | Doctor: **1**, Business: **1**, Home: **1**, Personal: **1** | PASS |
| **City Split** | `kpis.leadsByCity` | Latur: 2, Pune: 1, Mumbai: 1 | Latur: **2**, Pune: **1**, Mumbai: **1** | PASS |
| **Stage Counts** | `kpis.stageCounts` | `QUALIFIED: 1`, `DISBURSED: 2`, `CLOSED_LOST: 1`, 17 others `0` | `QUALIFIED: 1`, `DISBURSED: 2`, `CLOSED_LOST: 1`, others `0` | PASS |
| **Funnel** | `funnel.enquiries` | 4 | **4** | PASS |
| | `funnel.contacted` | 4 | **4** | PASS |
| | `funnel.qualified` | 3 | **3** | PASS |
| | `funnel.documentsReceived` | 2 | **2** | PASS |
| | `funnel.applicationsSubmitted` | 2 | **2** | PASS |
| | `funnel.sanctioned` | 2 | **2** | PASS |
| | `funnel.disbursed` | 2 | **2** | PASS |
| | `funnel.closedLost` | 1 | **1** | PASS |
| **Conversions** | `conversions.leadToAppPct` | 50% (2/4) | **50** | PASS |
| | `conversions.appToSanctionPct` | 100% (2/2) | **100** | PASS |
| | `conversions.sanctionToDisbursedPct` | 100% (2/2) | **100** | PASS |
| **Revenue** | `revenue.totalDisbursedAmount` | ₹75,00,000 | **7,500,000** | PASS |
| | `revenue.totalExpectedRevenue` | ₹71,250 | **71,250** | PASS |
| | `revenue.totalActualRevenueReceived` | ₹46,250 | **46,250** | PASS |
| | `revenue.totalOutstandingAmount` | ₹25,000 | **25,000** | PASS |

### CP-26.2 Fix Applied in `src/app/api/dashboard/metrics/route.ts`
- Excluded `CONTACT_PENDING` from `funnelContacted` (only `CONTACTED` and later active stages count as contacted).
- Added explicit `qualifiedLeads`, `unqualifiedLeads`, `followUpTasksDueCount`, and `overdueFollowUpsCount` metrics aligned with `/crm` and Gate 5 expectations.
- Fixed `outstandingAmount` calculation so settled zero-balance revenue (`0`) is never overwritten via truthy `||` fallback (`!== undefined` check used).

---

## 2. Gate 6 Public Dashboard (`/`) Live Anomalies — Root-Cause Proof

Audit of `src/app/page.tsx` against `avani_ai_crm_prod`:

1. **`WhatsApp Sent / Failed: 45 / 0` Anomaly:**
   - **Code Location:** `src/app/page.tsx` lines 130–132 queries `Message.countDocuments({ direction: { $in: ['OUTBOUND', 'outbound'] } })` without filtering by mock IDs or live delivery status.
   - **Production DB Fact:** All `45` `OUTBOUND` documents in `avani_ai_crm_prod.messages` have `provider: 'ChatMitra'`, `status: 'API_ACCEPTED'`, and `providerMessageId` beginning with **`CM-MOCK-`** (simulated sandbox dispatches matching `45` rows in `providerledgers`). Actual live provider-accepted messages = **0**; real delivered messages = **0**.
   - **Audit Finding:** **FAIL (Misleading Telemetry Labeling)** — simulated `CM-MOCK-*` dispatches are presented on `/` as live `"WhatsApp Sent"`.

2. **`Opt-Outs / Sync Errors: 0 / 24` Anomaly:**
   - **Code Location:** `src/app/page.tsx` lines 138–140 queries `WebhookInbox.countDocuments({ status: 'FAILED' })` and renders the raw lifetime failure count as `"Sync Errors"`.
   - **Production DB Fact:** Of `117` `webhookinboxes` records, `93` are `COMPLETED` and all `24` `FAILED` rows are historical `source: 'Meta'`, `eventType: 'INBOUND_MESSAGE'` ingestion failures (6 `Cast to ObjectId failed` for string `"META-..."` IDs + 18 `E11000 duplicate key error` on `messages.idempotencyKey_1`).
   - **Audit Finding:** Accurate count of historical `FAILED` rows in `webhookinboxes`, but mixes archived/historical Meta webhook dead-letters with active operational sync health.

---

## 3. UI Scope Limitation

- API/data accuracy for `/api/dashboard/metrics` was verified via compiled Next.js HTTP responses (`avani_ai_crm_test`).
- **Browser UI E2E rendering** (interactive clicks/DOM checks on `/leads` and `/crm`) was **NOT executed** in CP-26.2; additionally, `src/app/leads/page.tsx` Checklist tab (`L665–705`) still renders static `"UNDER REVIEW"` display badges rather than live per-lead `documentChecklist` persistence unless wired in a follow-up UI patch.
