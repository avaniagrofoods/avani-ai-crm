# AVANI AI CRM — CP-26.5 Production Data Integrity Report

**Database Inspected:** `avani_ai_crm_prod` (strictly read-only, `readPreference: 'secondaryPreferred'`)  
**Mutations Executed on Production:** `0` (Zero writes, zero deletes, zero index modifications)  
**Test Database (Isolated Only):** `avani_ai_crm_test` (`0` synthetic residue confirmed after every test suite)  

---

## 1. Collection Inventory & TTL / Index Audit — **Verified directly**

Read-only inspection of `avani_ai_crm_prod` identified **15 collections**:

| Collection | Document Count | Notable Indexes & Findings |
|---|---:|---|
| `advisors` | 2 | Active advisor directory present |
| `authsessions` | 0 | `expireAt_1` TTL index live (`expireAfterSeconds: 0`) |
| `authratelimits` | 0 | `expireAt_1` TTL index live (`expireAfterSeconds: 0`) |
| `contacts` | 15 | `phone_1` unique index; digit lengths: `10 digits: 14`, `11 digits: 1` |
| `conversations` | 14 | Active conversation threads |
| `documentmodels` | 0 | No live stored document metadata rows |
| `leads` | 24 | `phone_1` unique, `leadId_1` unique, `stage_1` index; `0` duplicate phone groups |
| `lenders` | 6 | Configured lender catalog |
| `messages` | 61 | **CRITICAL INDEX DEFECT:** `idempotencyKey_1` is `{ unique: true, sparse: false }` with `1` doc having `idempotencyKey: null` |
| `providerledgers` | 52 | All `52` entries `CHATMITRA` with `mock=true` |
| `schedules` | 3 | All `3` `COMPLETED`; `0` pending `SCHEDULED` jobs |
| `system_metadata` | 1 | `schemaVersion: 1.0.1`, `status: PRE_CUTOVER_BASELINE` (`2026-11-01`) |
| `templates` | 34 | Synced WhatsApp template catalog |
| `webhookinboxes` | 121 | `eventId_1` unique; `COMPLETED: 97`, `FAILED: 24` |
| `workflowtriggers` | 34 | Configured workflow trigger definitions |

---

## 2. Lead Pipeline & Financial Data Integrity — **Verified directly**

Inspection across all `24` documents in `avani_ai_crm_prod.leads`:
- **Duplicate Detection:** `0` duplicate phone/mobile groups found (`duplicateLeadGroupsCount: 0`).
- **Legacy Status Breakdown:**
  - `CUSTOMER_REPLIED_HUMAN_FOLLOWUP`: `13` (maps via `mapLegacyStatusToStage()` in `src/config/pipeline.ts` to `'CONTACTED'`)
  - `New`: `11` (maps via `mapLegacyStatusToStage()` to `'NEW_ENQUIRY'`)
- **CP-26 Pipeline Field Presence:**
  - `stage`: `<MISSING>` on all `24/24` leads (`0` CP-26 normalized stage values populated yet)
  - `stageHistory`: `0/24`
  - `tasks`: `0/24`
  - `qualificationScore` / score: `0/24`
  - `assignedAdvisor`: `0/24`
  - `revenue` / `revenueTracking` subdocument: `0/24`
- **DPDP Consent Breakdown:**
  - `consentStatus: 'GRANTED'`: `20` leads
  - `consentStatus: <MISSING>`: `4` leads (originated `2026-11-01`)
  - `optedOutCount`: `0`
- **Cross-Collection Linkage:** `15` leads match existing `contacts` records (`matchedContactCount: 15`).
- **Financial Totals & Anomaly Scan:**
  - `totalSanctioned: 0`, `totalDisbursed: 0`, `totalEstRevenue: 0`, `totalActualRevenue: 0`
  - `financialAnomalies: []` (zero orphaned disbursements, negative figures, or stage/revenue mismatches)

---

## 3. WhatsApp Telemetry & Ledger Reconciliation — **Verified directly**

Direct cross-collection reconciliation between `messages` (`61`), `providerledgers` (`52`), and `webhookinboxes` (`121`) matches `computeWhatsappTelemetry()` (`src/lib/telemetry.ts`) with **zero discrepancy**:

| Metric / Group | Observed Count | Underlying Production Records |
|---|---:|---|
| `mockAttempts` | 52 | `messages`: `OUTBOUND \| API_ACCEPTED \| ChatMitra \| mock=true` (`52`); `providerledgers`: `52` (`mock=true`) |
| `providerAccepted` (Real WA) | 0 | `0` real outbound sends |
| `delivered` (Real WA) | 0 | `0` real outbound deliveries |
| `failed` (Real WA) | 0 | `0` real outbound failures |
| `inboundReceived` | 9 | `messages`: `inbound \| RECEIVED \| WhatsApp \| mock=false` (`9`) |
| `pendingConfirm` | 0 | `0` unresolved outbound WA messages |
| `webhookProcessingErrors` | 24 | `webhookinboxes`: `FAILED` (`24`); `COMPLETED`: `97` |

**Audit Conclusion on Telemetry:** Mock test attempts (`52`) are completely segregated from real WhatsApp deliveries (`0` false deliveries reported).

---

## 4. Root-Cause Forensic Analysis of the 24 Dead-Letter Webhooks (`webhookinboxes.FAILED`) — **Verified directly**

Inspection of all `24` `FAILED` documents in `avani_ai_crm_prod.webhookinboxes`:

1. **Cluster A — Records `#1–#6` (`2026-11-01`, 6 records):**
   - Provider/Type: Meta `INBOUND_MESSAGE`, payload type `unsupported`, `hasText: false`, `alreadyInMessages: false`.
   - Failure Reason: `Cast to ObjectId failed ... _id` (pre-CP-26.3 string ID handling bug against unsupported media/system events).
   - Classification: **`INVALID_OR_INCOMPLETE`** (`6` records — contain no recoverable text message payload).

2. **Cluster B — Records `#7–#24` (`2026-11-03` through `2026-11-09`, 18 records):**
   - Provider/Type: Meta `INBOUND_MESSAGE`, `alreadyInMessages: false`.
   - Payload breakdown: `11` `unsupported`, `1` `image` (`#23`), `6` `text` (`#9, #10, #13, #20, #22, #24`, ages `3–8 days`).
   - Exact Root Cause: `E11000 duplicate key error ... idempotencyKey_1 dup key: { idempotencyKey: null }`.
   - Why it occurred:
     - Live Atlas `messages.idempotencyKey_1` index was created with **`unique: true, sparse: false`** while `1` existing document carries `idempotencyKey: null`.
     - Pre-CP-26.3 worker writes allowed `idempotencyKey: null`, colliding on every subsequent insert with `null`.
   - Remediation Status:
     - **Application code fixed in CP-26.5 (`680c270`):** `src/app/api/whatsapp-webhook-worker/route.ts` now enforces non-null fallback `idempotencyKey: msgId || eventId || correlationId || ...`.
     - **Database index STILL REQUIRES manual Atlas fix:** Rebuild `messages.idempotencyKey_1` as `{ unique: true, sparse: true }` (or assign a non-null key to the 1 legacy `null` document) before re-processing or archiving inbound records.
