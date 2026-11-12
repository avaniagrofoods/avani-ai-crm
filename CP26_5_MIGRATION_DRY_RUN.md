# AVANI AI CRM — CP-26.5 Historical Migration & Dead-Letter Dry-Run Plan

**Execution Mode:** **STRICTLY DRY-RUN (READ-ONLY)** — `0` production records were modified, backfilled, deleted, or replayed.  
**Pre-Condition:** Do **NOT** execute any write step in this plan until a verified current-state `mongodump` + isolated restore drill succeeds covering all `15` collections in `avani_ai_crm_prod`.

---

## 1. Historical Leads Dry-Run Classification (`24` Total Leads) — **Verified directly**

Dry-run evaluation across all `24` leads in `avani_ai_crm_prod.leads`:

| Category | Count | Criteria & Details (Zero PII / Phone Prefixes Only) | Proposed Safe Action |
|---|---:|---|---|
| **`ELIGIBLE_MIGRATION`** | **7** | Valid 10-digit `[6-9]\d{9}` mobile + populated `loanType` + `consentStatus: 'GRANTED'` | Deterministic backfill (`$set` only if missing): set CP-26 `stage` via `mapLegacyStatusToStage(status)` (`New` -> `NEW_ENQUIRY`, `CUSTOMER_REPLIED_HUMAN_FOLLOWUP` -> `CONTACTED`), initialize empty `stageHistory` baseline entry and `revenueTracking` zeros (`$setOnInsert`-style guard) |
| **`REQUIRES_MANUAL_REVIEW`** | **15** | Missing `loanType` (`15` leads, including `4` leads from `2026-11-01` also missing `consentStatus`) | Hold from automatic funnel qualification / automated outreach; advisor reviews inquiry context, sets canonical `loanType`, and documents DPDP consent basis (`consentStatus`) for the 4 Nov 1 records |
| **`INVALID_OR_INCOMPLETE`** | **2** | `#18` (`idSuffix: ...8a9fb7`): 10 digits starting with `'4'`; `#24` (`idSuffix: ...839cd5`): 11 digits starting with `'3'` | Quarantine / mark `DISQUALIFIED_INVALID_CONTACT` after human review; never send WhatsApp or voice calls to malformed numbers |

**Dry-Run Safety Guarantees:**
- Backfill script must NEVER overwrite existing non-empty `name`, `phone`, `loanType`, `consentStatus`, `financialProfile`, or `notes`.
- Backfill script must NEVER trigger AI calls, WhatsApp messages, HubSpot, Zapier, or Make webhooks.

---

## 2. Historical Webhook Dead-Letter Dry-Run (`24 FAILED` Records) — **Verified directly**

Evaluation across all `24` `FAILED` documents in `avani_ai_crm_prod.webhookinboxes`:

| Cluster / Records | Count | Root Cause | Message Type Breakdown | Dry-Run Disposition & Safety Risk |
|---|---:|---|---|---|
| **`#1–#6`** (`2026-11-01`) | **6** | Legacy `Cast to ObjectId failed ... _id` | `6` `unsupported` (`hasText: false`) | **Archive / Mark `ARCHIVED_INVALID_LEGACY` (`INVALID_OR_INCOMPLETE`)**: no recoverable text or business content |
| **`#7–#24` (Non-text subset)** (`2026-11-03` to `2026-11-09`) | **12** | `E11000` on `messages.idempotencyKey_1` (`sparse: false` vs `null`) | `11` `unsupported`, `1` `image` (`#23`) | **Archive / Mark `ARCHIVED_UNSUPPORTED_OR_MEDIA_REVIEW`**: do not auto-replay; human operator may inspect `#23` media link manually if still valid |
| **`#7–#24` (Inbound Text subset: `#9, #10, #13, #20, #22, #24`)** | **6** | `E11000` on `messages.idempotencyKey_1` (`sparse: false` vs `null`) | `6` inbound `text` messages (`3–8` days old) | **PASSIVE ARCHIVE ONLY (`archiveOnly: true`) AFTER Atlas index fix**: insert inbound history into `messages` with non-null `idempotencyKey` and `suppressAutoReply: true` so CRM Inbox shows full customer context **without triggering delayed/unsolicited WhatsApp replies** |

---

## 3. Mandatory Execution Order (When Approved by Operator)

1. **Step 1 — Current Backup & Isolated Restore Verification:** Run `mongodump` on `avani_ai_crm_prod` (`24` leads, `61` messages, `121` webhookinboxes) and restore/verify counts in an isolated staging DB.
2. **Step 2 — Atlas Index Fix (`messages.idempotencyKey_1`):** Drop and recreate `idempotencyKey_1` with `{ unique: true, sparse: true }` (and/or assign a deterministic `idempotencyKey` to the 1 legacy `null` document).
3. **Step 3 — Idempotent Dead-Letter Resolution (Archive-Only):** Process `#1–#24` strictly in offline/archive mode (`suppressOutbound: true`, `suppressAutoReply: true`) while preserving audit timestamps and tagging `archivedFromDeadLetter: true`.
4. **Step 4 — Idempotent Lead Backfill (`7` Eligible Leads) & Manual Queue (`15 + 2` Leads):** Run idempotent dry-run -> apply script for the `7` verified leads; export masked ID list of the `15` manual-review + `2` invalid-phone leads to CRM ADMIN queue.
5. **Step 5 — Post-Migration Integrity Reconciliation:** Confirm `0` `FAILED` unresolved inbox records, `0` duplicate phones, `totalDisbursed === 0`, and unchanged `PROVIDER_MODE=mock`.
