# AVANI AI CRM — CP-26.2 GATE 3: PRODUCTION DATABASE INTEGRITY AUDIT (READ-ONLY)

**Milestone:** CP-26.2 Final Data-Integrity & Revenue Acceptance  
**Target Cluster / Database:** MongoDB Atlas `avani_ai_crm_prod`  
**Audit Execution Method:** Read-only forensic aggregation (`node scratch/run_gate3_and_gate6_readonly.cjs` & `node scratch/inspect_telemetry_details.cjs` -> Exit Code 0)  
**PII & Write Constraint:** Strictly read-only (`find` / `countDocuments` only). Zero customer phones, names, emails, or credentials are reproduced in this report.

---

## 1. Collection Inventory & Document Counts (`avani_ai_crm_prod`)

Verified collections present in `avani_ai_crm_prod`:
`providerledgers`, `schedules`, `leads`, `lenders`, `workflowtriggers`, `messages`, `templates`, `advisors`, `webhookinboxes`, `system_metadata`, `conversations`, `documentmodels`, `contacts`.

| Collection | Verified Count | Notes |
|---|---:|---|
| `leads` | **24** | Legacy pre-CP-26 lead records |
| `contacts` | **15** | Unique customer contact records |
| `conversations` | **13** | WhatsApp conversation threads |
| `documentmodels` | **0** | Note: Mongoose model `'DocumentModel'` maps to `documentmodels`; raw `documents` collection does not exist |
| `messages` | **53** | `45` Outbound (`ChatMitra` `CM-MOCK-*`) + `8` Inbound (`WhatsApp`) |
| `webhookinboxes` | **117** | `93` `COMPLETED`, `24` `FAILED` (historical Meta dead-letters) |
| `lenders` | **6** | Seeded AVANI bank/NBFC lender panel |
| `advisors` | **2** | Seeded advisor profiles |
| `providerledgers` | **45** | Matches the 45 mock outbound provider dispatch records |

---

## 2. Gate 3 Lead-to-Revenue Integrity Audit Results

| Check | Observed Value | Status | Interpretation |
|---|---:|---|---|
| Total Leads Evaluated | **24** | PASS | Matches `leads` collection count |
| Duplicate Phone Groups (`duplicatePhoneGroups`) | **0** | PASS | Zero duplicate mobile numbers across all 24 leads |
| Extra Duplicate Lead Records (`extraDuplicateLeadRecords`) | **0** | PASS | Unique phone invariant intact |
| Canonical `stage` Populated (`canonicalStagePopulatedCount`) | **0** *(24 missing)* | **GAP (Pre-Migration)** | All 24 existing leads pre-date CP-26 canonical 20-stage field |
| Invalid `stage` Values (`invalidStages`) | **0** (`[]`) | PASS | No corrupted canonical stage strings |
| Legacy `status` Distribution | `CUSTOMER_REPLIED_HUMAN_FOLLOWUP`: **12**, `New`: **12** | INFO | All 24 records rely on legacy `status` field; UI/API fallback maps `New` -> `NEW_ENQUIRY` and `CUSTOMER_REPLIED_HUMAN_FOLLOWUP` -> `CONTACTED` |
| `qualificationScore` Missing (`missingQualificationScoreCount`) | **24** *(0 invalid)* | **GAP (Pre-Migration)** | Scoring was not retroactively run on the 24 legacy leads |
| `followUpTasks` Empty/Missing (`missingFollowUpTasksCount`) | **24** | **GAP (Pre-Migration)** | D0–D30 follow-up sequences were not backfilled on the 24 legacy leads |
| Leads with `application` Subdocument (`withApplication`) | **0** | INFO | No live bank applications entered in prod yet |
| Leads with `sanction` Subdocument (`withSanction`) | **0** | INFO | No live loan sanctions entered in prod yet |
| Leads with `disbursement` Subdocument (`withDisbursement`) | **0** | INFO | No live disbursements entered in prod yet |
| Leads with `revenue` Subdocument (`withRevenue`) | **0** *(mismatch: 0)* | INFO | No commission/revenue entries recorded in prod yet |

---

## 3. Integrity Conclusions & Safe Recommendations

1. **Zero Corruption / Zero Phone Duplication:** `avani_ai_crm_prod` has clean index integrity (`0` duplicate phone groups across `24` leads) and all read-only production data remained untouched throughout CP-26.2.
2. **Legacy Schema Coverage Gap (Backfill Needed):** Because CP-26 (`stage`, `qualificationScore`, `followUpTasks`, `documentChecklist`, `application`, `sanction`, `disbursement`, `revenue`) was deployed at `cae0393` after the 24 historical records were ingested, those 24 rows do not yet have populated canonical `stage`, `qualificationScore`, or D0–D30 `followUpTasks`.
3. **Recommended Next Action (Separate Owner-Approved Migration):** Run an idempotent read-first/dry-run backfill migration mapping legacy `status` via `mapLegacyStatusToStage` (`src/config/pipeline.ts`), initializing `qualificationScore` and `documentChecklist` without deleting or overwriting any customer identifiers.
