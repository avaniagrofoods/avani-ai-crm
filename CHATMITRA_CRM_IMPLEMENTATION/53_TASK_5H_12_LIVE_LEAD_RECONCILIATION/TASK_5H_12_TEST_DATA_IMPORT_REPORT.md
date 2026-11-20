# TASK 5H.12 — TEST DATA IMPORT REPORT
## EVIDENCE OF CONTROLLED SYNTHETIC IMPORT INTO AVANI_AI_CRM_ISOLATED_TEST

**Document Version:** 1.0.0  
**Date:** 2026-11-19T16:55:00+05:30  
**Classification:** STRICT AUDIT EVIDENCE — INTERNAL OPERATIONAL CONTROL  
**Author:** Google Sheets Integration Engineer & QA Lead  
**Target Spreadsheet:** `AVANI_AI_CRM_ISOLATED_TEST`  
**Apps Script Gateway:** `AVANI_AI_CRM_TEST_GATEWAY` (v2 Web App)  
**Execution Script:** `scratch/import_synthetic_test_leads.cjs`  

---

### 1. SYNTHETIC IMPORT EXECUTION LOG

On 2026-11-19T16:49:13+05:30, a controlled synthetic import was executed via the secure HMAC-SHA256 authenticated Apps Script Gateway.

Exactly 9 synthetic customer records and 9 synthetic lead records representing all 9 canonical loan categories were generated and transmitted using idempotent `INSERT_IF_ABSENT` actions:

| Category Code | Canonical Category | Customer ID | Lead ID | Amount (INR) | Synthetic Phone | Gateway Status |
|---|---|---|---|---|---|---|
| `PERS` | `PERSONAL_LOAN` | `TEST_SYNTH_CUST_PERS_001` | `TEST_SYNTH_LEAD_PERS_001` | ₹5,00,000 | `+919999000101` | **INSERTED (OK 200)** |
| `BIZ` | `BUSINESS_LOAN` | `TEST_SYNTH_CUST_BIZ_001` | `TEST_SYNTH_LEAD_BIZ_001` | ₹15,00,000 | `+919999000102` | **INSERTED (OK 200)** |
| `DOC` | `DOCTOR_MEDICAL_LOAN` | `TEST_SYNTH_CUST_DOC_001` | `TEST_SYNTH_LEAD_DOC_001` | ₹30,00,000 | `+919999000103` | **INSERTED (OK 200)** |
| `HOME` | `HOME_LOAN` | `TEST_SYNTH_CUST_HOME_001` | `TEST_SYNTH_LEAD_HOME_001` | ₹50,00,000 | `+919999000104` | **INSERTED (OK 200)** |
| `LAP` | `MORTGAGE_LAP` | `TEST_SYNTH_CUST_LAP_001` | `TEST_SYNTH_LEAD_LAP_001` | ₹75,00,000 | `+919999000105` | **INSERTED (OK 200)** |
| `EDU_IN` | `EDUCATION_LOAN_INDIA` | `TEST_SYNTH_CUST_EDU_IN_001` | `TEST_SYNTH_LEAD_EDU_IN_001` | ₹12,00,000 | `+919999000106` | **INSERTED (OK 200)** |
| `EDU_AB` | `EDUCATION_LOAN_ABROAD` | `TEST_SYNTH_CUST_EDU_AB_001` | `TEST_SYNTH_LEAD_EDU_AB_001` | ₹40,00,000 | `+919999000107` | **INSERTED (OK 200)** |
| `SCH` | `SCHOOL_OWNER_FUNDING` | `TEST_SYNTH_CUST_SCH_001` | `TEST_SYNTH_LEAD_SCH_001` | ₹1,00,00,000 | `+919999000108` | **INSERTED (OK 200)** |
| `COL` | `INSTITUTIONAL_COLLEGE_FUNDING` | `TEST_SYNTH_CUST_COL_001` | `TEST_SYNTH_LEAD_COL_001` | ₹2,50,00,000 | `+919999000109` | **INSERTED (OK 200)** |

---

### 2. IDEMPOTENCY VERIFICATION RESULTS

To prove that rerunning the import process does NOT corrupt data or duplicate records, a second pass of `scratch/import_synthetic_test_leads.cjs` was immediately executed at 2026-11-19T16:51:05+05:30.

**Execution Metrics Comparison:**

```json
// PASS 1 (INITIAL IMPORT):
{
  "customersInserted": 9,
  "customersSkipped": 0,
  "leadsInserted": 9,
  "leadsSkipped": 0,
  "errors": []
}

// PASS 2 (RE-RUN IDEMPOTENCY TEST):
{
  "customersInserted": 0,
  "customersSkipped": 9,
  "leadsInserted": 0,
  "leadsSkipped": 9,
  "errors": []
}
```

**Verification Finding:**
- Customer Row Insertions on Pass 2: **0**
- Lead Row Insertions on Pass 2: **0**
- Duplicate Rows Created: **0**
- Errors Encountered: **0**
- Idempotency Verdict: **100% PASS**
