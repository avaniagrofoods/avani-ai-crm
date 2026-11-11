# AVANI AI CRM — CP-26.3 Legacy Lead Compatibility & Dry-Run Backfill Proposal

**Audit Mode:** Strictly Read-Only against `avani_ai_crm_prod` (Zero production lead documents mutated in CP-26.3)  
**Total Historical Leads Audited:** **24**  

---

## 1. Compatibility Fix Delivered in Application Layer (Zero DB Mutation Required)

All 24 historical leads in `avani_ai_crm_prod` are immediately compatible with CP-26 CRM APIs and UI without mutating historical customer fields:
- `src/app/api/leads/route.ts`, `src/app/api/dashboard/metrics/route.ts`, and `src/app/crm/page.tsx` derive `stage || mapLegacyStatusToStage(status)` on read.
- Unassigned legacy leads remain visible to `ADMIN` and assignable via `POST /api/leads/[id]/assign`.
- Leads lacking `documentChecklist` render the product's canonical checklist dynamically via `CATEGORY_DOCUMENT_CHECKLISTS[lead.loanType || 'Personal Loan']` and materialize `documentChecklist` safely on first checklist update (`PATCH /api/leads/[id]`).

---

## 2. Read-Only Classification of All 24 Historical Leads (No Customer PII Exposed)

Every record currently has: `canonicalStage: null`, `stageHistoryCount: 0`, `qualificationScore: null`, `followUpTasksCount: 0`, `documentChecklistCount: 0`, `hasAssignedAdvisor: false`, `hasApplication: false`, `hasSanction: false`, `hasDisbursement: false`, `hasRevenue: false`, `isOptedOut: false`, `source: "WhatsApp Inbound"`.

| # | `leadId` | Created (UTC) | `legacyStatus` | Dry-Run Stage Mapping | Existing `loanType` | Existing `consentStatus` | Dry-Run Recommendation |
| :-: | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| 1 | `AVL-20261101-802197` | `2026-11-01T16:41:10Z` | `CUSTOMER_REPLIED_HUMAN_FOLLOWUP` | `CONTACTED` | `null` | `null` | Set `stage='CONTACTED'` + append initial `stageHistory` entry (`LEGACY_BACKFILL_DRYRUN`). Preserve `loanType=null` & `consentStatus=null` until advisor/customer confirmation. |
| 2 | `AVL-20261101-563660` | `2026-11-01T16:55:04Z` | `CUSTOMER_REPLIED_HUMAN_FOLLOWUP` | `CONTACTED` | `null` | `null` | Set `stage='CONTACTED'` + initial `stageHistory`; preserve `consentStatus=null`. |
| 3 | `AVL-20261101-993047` | `2026-11-01T16:56:30Z` | `CUSTOMER_REPLIED_HUMAN_FOLLOWUP` | `CONTACTED` | `null` | `null` | Set `stage='CONTACTED'` + initial `stageHistory`; preserve `consentStatus=null`. |
| 4 | `AVL-20261101-059902` | `2026-11-01T17:14:52Z` | `New` | `NEW_ENQUIRY` | `null` | `null` | Set `stage='NEW_ENQUIRY'` + initial `stageHistory`; preserve `consentStatus=null`. |
| 5 | `AVL-20261103-571160` | `2026-11-03T08:20:31Z` | `CUSTOMER_REPLIED_HUMAN_FOLLOWUP` | `CONTACTED` | `null` | `GRANTED` | Set `stage='CONTACTED'` + initial `stageHistory`; triage `loanType`. |
| 6 | `AVL-20261103-828496` | `2026-11-03T08:20:32Z` | `CUSTOMER_REPLIED_HUMAN_FOLLOWUP` | `CONTACTED` | `null` | `GRANTED` | Set `stage='CONTACTED'` + initial `stageHistory`; triage `loanType`. |
| 7 | `AVL-20261103-317565` | `2026-11-03T09:48:28Z` | `CUSTOMER_REPLIED_HUMAN_FOLLOWUP` | `CONTACTED` | `null` | `GRANTED` | Set `stage='CONTACTED'` + initial `stageHistory`; triage `loanType`. |
| 8 | `AVL-20261103-823888` | `2026-11-03T10:36:44Z` | `CUSTOMER_REPLIED_HUMAN_FOLLOWUP` | `CONTACTED` | `null` | `GRANTED` | Set `stage='CONTACTED'` + initial `stageHistory`; triage `loanType`. |
| 9 | `AVL-20261103-792455` | `2026-11-03T10:59:00Z` | `CUSTOMER_REPLIED_HUMAN_FOLLOWUP` | `CONTACTED` | `null` | `GRANTED` | Set `stage='CONTACTED'` + initial `stageHistory`; triage `loanType`. |
| 10 | `AVL-20261103-693631` | `2026-11-03T12:40:13Z` | `CUSTOMER_REPLIED_HUMAN_FOLLOWUP` | `CONTACTED` | `null` | `GRANTED` | Set `stage='CONTACTED'` + initial `stageHistory`; triage `loanType`. |
| 11 | `AVL-20261103-791631` | `2026-11-03T15:32:19Z` | `CUSTOMER_REPLIED_HUMAN_FOLLOWUP` | `CONTACTED` | `Personal Loan` | `GRANTED` | Set `stage='CONTACTED'` + `documentChecklist` (`Personal Loan`) + initial `stageHistory`. |
| 12 | `AVL-20261103-809105` | `2026-11-03T20:01:59Z` | `New` | `NEW_ENQUIRY` | `null` | `GRANTED` | Set `stage='NEW_ENQUIRY'` + initial `stageHistory`; triage `loanType`. |
| 13 | `AVL-20261103-715413` | `2026-11-03T20:01:59Z` | `CUSTOMER_REPLIED_HUMAN_FOLLOWUP` | `CONTACTED` | `Personal Loan` | `GRANTED` | Set `stage='CONTACTED'` + `documentChecklist` (`Personal Loan`) + initial `stageHistory`. |
| 14 | `AVL-20261103-567672` | `2026-11-03T20:02:26Z` | `New` | `NEW_ENQUIRY` | `null` | `GRANTED` | Set `stage='NEW_ENQUIRY'` + initial `stageHistory`; triage `loanType`. |
| 15 | `AVL-20261103-090885` | `2026-11-03T20:07:26Z` | `New` | `NEW_ENQUIRY` | `null` | `GRANTED` | Set `stage='NEW_ENQUIRY'` + initial `stageHistory`; triage `loanType`. |
| 16 | `AVL-20261103-874168` | `2026-11-03T20:11:24Z` | `New` | `NEW_ENQUIRY` | `null` | `GRANTED` | Set `stage='NEW_ENQUIRY'` + initial `stageHistory`; triage `loanType`. |
| 17 | `AVL-20261104-113260` | `2026-11-04T12:17:06Z` | `New` | `NEW_ENQUIRY` | `null` | `GRANTED` | Set `stage='NEW_ENQUIRY'` + initial `stageHistory`; triage `loanType`. |
| 18 | `AVL-20261104-749417` | `2026-11-04T17:10:27Z` | `New` | `NEW_ENQUIRY` | `null` | `GRANTED` | Set `stage='NEW_ENQUIRY'` + initial `stageHistory`; triage `loanType`. |
| 19 | `AVL-20261106-144431` | `2026-11-06T09:06:05Z` | `New` | `NEW_ENQUIRY` | `Personal Loan` | `GRANTED` | Set `stage='NEW_ENQUIRY'` + `documentChecklist` (`Personal Loan`) + initial `stageHistory`. |
| 20 | `AVL-20261106-357454` | `2026-11-06T14:19:26Z` | `New` | `NEW_ENQUIRY` | `Personal Loan` | `GRANTED` | Set `stage='NEW_ENQUIRY'` + `documentChecklist` (`Personal Loan`) + initial `stageHistory`. |
| 21 | `AVL-20261107-481751` | `2026-11-07T07:58:51Z` | `New` | `NEW_ENQUIRY` | `Personal Loan` | `GRANTED` | Set `stage='NEW_ENQUIRY'` + `documentChecklist` (`Personal Loan`) + initial `stageHistory`. |
| 22 | `AVL-20261107-985400` | `2026-11-07T14:43:12Z` | `New` | `NEW_ENQUIRY` | `Personal Loan` | `GRANTED` | Set `stage='NEW_ENQUIRY'` + `documentChecklist` (`Personal Loan`) + initial `stageHistory`. |
| 23 | `AVL-20261108-591519` | `2026-11-08T04:11:06Z` | `New` | `NEW_ENQUIRY` | `Personal Loan` | `GRANTED` | Set `stage='NEW_ENQUIRY'` + `documentChecklist` (`Personal Loan`) + initial `stageHistory`. |
| 24 | `AVL-20261110-587876` | `2026-11-10T11:17:35Z` | `CUSTOMER_REPLIED_HUMAN_FOLLOWUP` | `CONTACTED` | `Business Loan` | `GRANTED` | Set `stage='CONTACTED'` + `documentChecklist` (`Business Loan`) + initial `stageHistory`. |

---

## 3. Summary & Rollback Plan

- **Stage Counts (Dry-Run):** `NEW_ENQUIRY` = **12**, `CONTACTED` = **12**.
- **Product Counts:** `Personal Loan` = **7**, `Business Loan` = **1**, `null` (needs human triage) = **16**.
- **Consent Integrity:** Never fabricate `consentStatus='GRANTED'` for the 4 pre-DPDP leads (`2026-11-01`).
- **Customer Data Preservation:** Zero modifications to `name`, `phone`, `email`, `city`, `loanType`, or `monthlyIncome`.
- **Rollback Plan (when executed later):** Snapshot `leads` via `mongodump` before running idempotent `$set` (`where stage: { $exists: false }`), storing `stageHistory` entry `{ changedBy: 'CP26_MIGRATION' }` so rollback is exact (`$unset` fields where `stageHistory[0].changedBy === 'CP26_MIGRATION'`).
