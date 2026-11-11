# AVANI AI CRM — CP-26.2 GATE 4: SYNTHETIC WRITE & READ-BACK ACCEPTANCE REPORT

**Milestone:** CP-26.2 Final Data-Integrity & Revenue Acceptance  
**Execution Environment:** Compiled local Next.js production build (`next start -p 3099`, `APP_MODE=staging`, `PROVIDER_MODE=mock`) connected to isolated MongoDB Atlas database **`avani_ai_crm_test`**  
**Verification Script:** `node scratch/run_gate4_gate5_http_e2e.cjs` -> **Exit Code 0** (run after all CP-26.2 code fixes & `npm run build`)  
**Production Safety Guarantee:** `avani_ai_crm_prod` was NEVER targeted or written; `src/lib/db.ts` staging guard rejects any production DB target when `APP_MODE=staging`. All synthetic test records were deleted after verification (**0 synthetic residue** in `avani_ai_crm_test`).

---

## 1. Real Bugs Uncovered & Repaired During Gate 4 HTTP E2E Testing

Running real HTTP requests against the compiled Next.js API routes and real MongoDB Atlas uncovered **5 genuine production code defects** that all 335 existing unit/mock tests missed:

1. **`PATCH /api/leads/[id]` (`src/app/api/leads/[id]/route.ts`):** Duplicate `$set` property in the `findByIdAndUpdate` query caused `$set: { stageHistory }` to overwrite `$set: body`, silently dropping canonical `stage` transitions and returning HTTP 200 without persisting invalid/valid stage updates. Fixed with explicit single `$set` merge, `CANONICAL_LEAD_STAGES` validation (HTTP 400 on invalid stage), and `addChecklistItem` / `updateChecklistItem` persistence.
2. **`Lead` Mongoose Schema (`src/models/Lead.ts`):** `documentChecklist` sub-schema was missing from `LeadSchema`, causing Mongoose strict mode to strip checklist updates sent to the API instead of persisting per-lead document verification status.
3. **`POST /api/leads/[id]/application` (`src/app/api/leads/[id]/application/route.ts`):** `RECORD_REVENUE` unconditionally overwrote `expectedRevenue`, `agreedCommissionPct`, and `invoiceNumber` on subsequent payment receipts (wiping expected commission when recording partial/final commission settlement), used `0 || ...` falsy logic when `outstandingAmount` reached `0`, and lacked duplicate UTR idempotency / positive-amount validation.
4. **`FollowUpTaskEngine.evaluateTaskStatuses` (`src/lib/followup-task-engine.ts`):** Spreading a Mongoose subdocument (`{ ...task, status: 'OVERDUE' }`) stripped getter fields (`taskId`, `title`, `timingStage`) because Mongoose stores schema attributes behind `_doc` getters. Fixed by calling `typeof task?.toObject === 'function' ? task.toObject() : task` before cloning.
5. **`GET /api/leads` (`src/app/api/leads/route.ts`) & `GET /api/dashboard/metrics` (`src/app/api/dashboard/metrics/route.ts`):** `GET /api/leads` overwrote `query.$or` when `search` and `stage` filters were combined (fixed using `$and`); `POST /api/leads` now initializes `documentChecklist` and `requiredLoanAmount`; `/api/dashboard/metrics` now excludes `CONTACT_PENDING` from `funnelContacted`, adds `qualifiedLeads` / `unqualifiedLeads` / `followUpTasksDueCount` / `overdueFollowUpsCount`, and fixes falsy `0` fallback on `outstandingAmount`.

---

## 2. Complete 14-Step Write -> Read-Back Persistence Evidence Matrix

Primary synthetic Doctor Loan record created & deleted cleanly:  
`leadId`: **`AVL-20261111-457790`** | `_id`: **`6af3ec1698a88aeba28416c1`** | `phone`: **`+919999900001`** (synthetic)

| Step | Route & Method | HTTP | Before Value | After Write | Database / API Read-Back Verified | Result |
|---|---|---:|---|---|---|---|
| **1. Create Lead** | `POST /api/leads` | **200** | `null` | `leadId: AVL-20261111-457790`, `stage: NEW_ENQUIRY` | Stored in `avani_ai_crm_test.leads` (`_id: 6af3ec1698a88aeba28416c1`) | **PASS** |
| **2. Read Lead by ID** | `GET /api/leads/[id]` | **200** | Created | `stage: NEW_ENQUIRY`, `7` tasks, `6` checklist items | Read-back confirmed `stage: NEW_ENQUIRY`, `phone: +919999900001` | **PASS** |
| **3. Assign Advisor** | `POST /api/leads/[id]/assign` | **200** | `Sachin Shinde` | `Advisor Priya Kulkarni` | Read-back `assignedAdvisor.name: Advisor Priya Kulkarni` | **PASS** |
| **4 & 5. Stage Transition + Audit Trail** | `PATCH /api/leads/[id]` | **200** | `NEW_ENQUIRY` | `QUALIFIED` | Read-back `stage: QUALIFIED`, `stageHistory.length: 2` (`QUALIFIED`) | **PASS** |
| **6. Follow-up Tasks (Overdue + Completed)** | `POST` + `PATCH` + `GET /api/leads/[id]/tasks` | **200** | `PENDING` | D0 `COMPLETED`; custom past-due `OVERDUE` | Read-back `d0.status: COMPLETED`, `custom.status: OVERDUE` | **PASS** |
| **7. Document Checklist Add & Verify** | `PATCH /api/leads/[id]` | **200** | `6 PENDING` | `7` items; `DOC_MED_DEGREE: VERIFIED` | Read-back `count: 7`, `DOC_MED_DEGREE: VERIFIED`, `DOC_CUSTOM_AFFIDAVIT: RECEIVED` | **PASS** |
| **8. Submit Application** | `POST /api/leads/[id]/application` (`SUBMIT_APPLICATION`) | **200** | `QUALIFIED` | `APPLICATION_SUBMITTED` | Read-back `applicationNumber: APP-SYNTH-2026-01` | **PASS** |
| **9. Record Sanction** | `POST /api/leads/[id]/application` (`RECORD_SANCTION`) | **200** | `APPLICATION_SUBMITTED` | `stage: SANCTIONED`, `2,500,000` | Read-back `sanctionLetterNumber: SL-HDFC-9910`, `sanctionedAmount: 2500000` | **PASS** |
| **10. Record Disbursement** | `POST /api/leads/[id]/application` (`RECORD_DISBURSEMENT`) | **200** | `SANCTIONED` | `stage: DISBURSED`, `2,500,000` | Read-back `utrReference: UTR-SYNTH-998877`, `disbursedAmount: 2500000` | **PASS** |
| **11. Record Expected Commission** | `POST /api/leads/[id]/application` (`RECORD_REVENUE`) | **200** | `expected: 0` | `expected: 31,250`, `outstanding: 31,250` (`INVOICED`) | Read-back `agreedCommissionPct: 1.25`, `expectedRevenue: 31250`, `actualRevenueReceived: 0`, `paymentStatus: INVOICED`, `invoiceNumber: INV-SYNTH-001`, `outstandingAmount: 31250` | **PASS** |
| **12. Partial Commission + Recalc** | `POST /api/leads/[id]/application` (`RECORD_REVENUE`) | **200** | `received: 0`, `outstanding: 31,250` | `received: 20,000`, `outstanding: 11,250` (`PARTIAL`) | Read-back `expectedRevenue: 31250`, `actualRevenueReceived: 20000`, `paymentStatus: PARTIAL`, `outstandingAmount: 11250` | **PASS** |
| **13 & 14. Full Settlement + Final Read-Back** | `POST` + `GET /api/leads/[id]` | **200** | `received: 20,000`, `outstanding: 11,250` | `received: 31,250`, `outstanding: 0` (`RECEIVED`) | Read-back `expectedRevenue: 31250`, `actualRevenueReceived: 31250`, `paymentStatus: RECEIVED`, `invoiceNumber: INV-SYNTH-001`, `outstandingAmount: 0`, `paymentDate` recorded | **PASS** |

---

## 3. Post-Fix Regression & Cleanup Verification

- `npx tsc --noEmit`: **Exit Code 0**
- `npm run build`: **Exit Code 0** (52 Next.js routes compiled)
- `node scratch/reconcile_tests.cjs`: **Exit Code 0** (22 suites, **335/335 passed**, **0 failed**)
- `avani_ai_crm_test` cleanup check: **0 synthetic residue remaining** after Gate 4 & Gate 5 completion.
- **Note on Live Production Deployment:** As of this writing, production alias `https://avani-ai-crm.vercel.app` runs baseline deployment `dpl_DpHj8tnxpYx6neiaRXYbvTU8k3CA` (`cae0393`). Therefore the 5 API/engine fixes verified locally on `avani_ai_crm_test` require deployment & post-deploy check before they are active on production.
