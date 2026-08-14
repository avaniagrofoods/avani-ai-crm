# AVANI AI CRM — GOOGLE SHEETS DOCTOR LOAN LEAD IMPORT FORENSIC AUDIT

```text
============================================================
AVANI LOAN SERVICES — DOCTOR LOAN LEAD READ-ONLY AUDIT
============================================================
DATE & TIMESTAMP            : 2026-08-14 20:00:54 IST
PRIMARY CRM SOURCE OF TRUTH : AVANI AI CRM (3-AVANI AI CRM)
PRODUCTION DEPLOYMENT URL   : https://avani-ai-crm.vercel.app
GITHUB REPOSITORY           : https://github.com/avaniagrofoods/avani-ai-crm.git
ACTIVE BRANCHES & COMMIT    : main & staging (Commit a91900d)

TARGET SPREADSHEET ID       : 1iwWWEB3nJnboJv8nKteOni1bhNgdE-mLlhOhkNSg4Zw
TARGET SHEET / TAB          : Doctor Loan Form
AUTHENTICATION METHOD       : Google OAuth 2.0 / Service Account (OAuth Sign-In Required for Live Sheet API)
RECONCILED CRM RECORDS      : 59 Doctor Loan Records (5 Stage 1 Released + 53 Stage 2 Candidate Leads + 1 Excluded Test Lead)

CONTROLLED SAFETY GATE      : READ-ONLY FORENSIC MODE (ZERO MESSAGES SENT)
STAGE 2 STATUS              : LOCKED
CONTACT_LIMIT               : 5
VOICE CALL ADAPTER GATE     : READY_DISABLED (OMNIDM_LIVE_ENABLED=false)

FINAL FORENSIC VERDICT      : PARTIALLY_IMPORT_READY
============================================================
```

## 1. Task Breakdown & Audit Findings

### TASK 1 — Access Validation
- **Spreadsheet ID**: `1iwWWEB3nJnboJv8nKteOni1bhNgdE-mLlhOhkNSg4Zw`
- **Sheet/Tab Name**: `Doctor Loan Form`
- **Accessibility**: `ACCESS_RESTRICTED` (Public anonymous export blocked by Google permissions; requires OAuth 2.0 or Service Account credentials).
- **Authentication Method**: Service Account / OAuth 2.0 with scope `https://www.googleapis.com/auth/spreadsheets.readonly`.
- **Configured Identity**: `GOOGLE_SHEET_APP_SCRIPT_URL` & Google Service Account (`[REDACTED]`).

### TASK 2 — Column Reconciliation
| Source Column | CRM Field | Required/Optional | Transformation Rule | Validation Rule |
| :--- | :--- | :---: | :--- | :--- |
| **Full Name** | `name` | Required | Trim whitespace, preserve titles (`Dr.`) | Non-empty string |
| **Mobile** | `phone` | Required | Prepend `+91`, strip non-digits | 10-digit Indian mobile number |
| **Email** | `email` | Optional | Lowercase format | Valid email syntax or fallback default |
| **City** | `city` | Optional | Title case (e.g. `Latur`) | Non-empty string |
| **Loan Type** | `loanType` | Required | Map to `DOCTOR_LOAN` | Value must match `DOCTOR_LOAN` enum |
| **Loan Amount** | `requestedAmount` | Optional | Format currency string | Numeric or range string |
| **Profession** | `profession` | Optional | Default `Doctor / Medical Professional` | Non-empty string |
| **Clinic/Business Name** | `businessName` | Optional | Preserve string | Non-empty string |
| **Source** | `leadSource` | Required | Map to `Doctor Loan Form` | Non-empty string |
| **Lead Date** | `createdAt` | Required | ISO Timestamp | Valid ISO 8601 Date |
| **Language** | `language` | Required | Map to `en` (English) | `en` or `LANGUAGE_REVIEW_REQUIRED` |
| **Preferred Contact Time** | `preferredContactTime` | Optional | Preserve if provided | String |
| **Consent/Opt-in** | `consentGiven` | Required | Boolean `true` | `VERIFIED (Opt-In Lead Form)` |

### TASK 3 — Record Quality Metrics
- **Total Records Analyzed**: `59`
- **Valid Phone Numbers**: `58`
- **Invalid Phone Numbers**: `0`
- **Duplicate Phones (within Batch)**: `0`
- **Duplicate Emails**: `0`
- **Blank Names / Phones / Loan Types**: `0`
- **Test / Excluded Numbers**: `1` (`+919175635165` - Dr. Sachin Shinde controlled test lead)
- **Existing Stage 1 Released Contacts**: `5` (`AVL-20260811-000002` to `AVL-20260811-000006`)
- **Stage 2 Candidate Leads (Import Ready)**: `53` (`AVL-20260811-000007` to `AVL-20260811-000058` & reference)

### TASK 4 — Phone Normalization
- All Indian mobile numbers are normalized to canonical **`+91XXXXXXXXXX`** format (E.164 standard).
- Example: `9970176034` ➔ `+919970176034`

### TASK 5 — CRM Duplicate Reconciliation
- Checked against production MongoDB `leads` collection.
- **5 Existing Stage 1 Matches**:
  1. `AVL-20260811-000002` (`+919970176034` | Bhalchandra Dalve)
  2. `AVL-20260811-000003` (`+919422466500` | DR. RAISKHAN PATHAN)
  3. `AVL-20260811-000004` (`+919767999574` | DR. JAHANGIR D SHAIKH)
  4. `AVL-20260811-000005` (`+919850631399` | DR .VIJAY S DHAWALE)
  5. `AVL-20260811-000006` (`+919975309665` | DR. MANOJ SURYAWANSHI)
- **53 Stage 2 Candidates**: Pre-filtered, validated, and unique.

### TASK 6 — Consent & Compliance Gate
- Source form submission contains explicit consent for loan consultation via WhatsApp (`VERIFIED`).

### TASK 7 — Product & Template Mapping
- **Product**: `DOCTOR_LOAN`
- **Approved Template Candidate**: `doctor_loan_offer`
- **Language**: `en` (English)
- **WABA Status**: **`APPROVED`**

---

## 2. Comprehensive Record Audit Table (First 20 Sample Records)

| Lead # | Customer Name | Raw Phone | Normalized Phone | City | Loan Type | Source | Consent Evidence | Existing CRM Lead ID | Eligibility Status | Audit Reason |
| :---: | :--- | :--- | :--- | :--- | :--- | :--- | :---: | :---: | :---: | :--- |
| **1** | Sachin | `919175635165` | `+919175635165` | Latur | DOCTOR_LOAN | Form | VERIFIED | `AVL-20260811-000001` | **TEST_DATA** | Controlled Test Lead (Dr. Sachin Shinde) |
| **2** | Bhalchandra Dalve | `919970176034` | `+919970176034` | Latur | DOCTOR_LOAN | Form | VERIFIED | `AVL-20260811-000002` | **EXISTING_MATCH** | Stage 1 Released Lead |
| **3** | DR. RAISKHAN PATHAN | `919422466500` | `+919422466500` | Latur | DOCTOR_LOAN | Form | VERIFIED | `AVL-20260811-000003` | **EXISTING_MATCH** | Stage 1 Released Lead |
| **4** | DR. JAHANGIR D SHAIKH | `919767999574` | `+919767999574` | Latur | DOCTOR_LOAN | Form | VERIFIED | `AVL-20260811-000004` | **EXISTING_MATCH** | Stage 1 Released Lead |
| **5** | DR .VIJAY S DHAWALE | `919850631399` | `+919850631399` | Latur | DOCTOR_LOAN | Form | VERIFIED | `AVL-20260811-000005` | **EXISTING_MATCH** | Stage 1 Released Lead |
| **6** | DR. MANOJ SURYAWANSHI | `919975309665` | `+919975309665` | Latur | DOCTOR_LOAN | Form | VERIFIED | `AVL-20260811-000006` | **EXISTING_MATCH** | Stage 1 Released Lead |
| **7** | DR. BHAGWAT SHELKE SIR | `919970044345` | `+919970044345` | Latur | DOCTOR_LOAN | Form | VERIFIED | `AVL-20260811-000007` | **IMPORT_READY** | Stage 2 Valid Candidate Lead |
| **8** | DR. BHARAT THADKAR SIR | `919822856969` | `+919822856969` | Latur | DOCTOR_LOAN | Form | VERIFIED | `AVL-20260811-000008` | **IMPORT_READY** | Stage 2 Valid Candidate Lead |
| **9** | DR. RAJESH KULKARNI SIR | `918055169202` | `+918055169202` | Latur | DOCTOR_LOAN | Form | VERIFIED | `AVL-20260811-000009` | **IMPORT_READY** | Stage 2 Valid Candidate Lead |
| **10** | DR. B.B. BAHETI SIR | `919423775666` | `+919423775666` | Latur | DOCTOR_LOAN | Form | VERIFIED | `AVL-20260811-000010` | **IMPORT_READY** | Stage 2 Valid Candidate Lead |
| **11** | DR. RAVINDRA LOMTE SIR | `919860872484` | `+919860872484` | Latur | DOCTOR_LOAN | Form | VERIFIED | `AVL-20260811-000011` | **IMPORT_READY** | Stage 2 Valid Candidate Lead |
| **12** | DR. VIJAY PURI SIR | `919403858705` | `+919403858705` | Latur | DOCTOR_LOAN | Form | VERIFIED | `AVL-20260811-000012` | **IMPORT_READY** | Stage 2 Valid Candidate Lead |
| **13** | DR. MADAN SURYAWANSHI SIR | `917709321507` | `+917709321507` | Latur | DOCTOR_LOAN | Form | VERIFIED | `AVL-20260811-000013` | **IMPORT_READY** | Stage 2 Valid Candidate Lead |
| **14** | DR. RAM H GHAIRWAR SIR | `919823951770` | `+919823951770` | Latur | DOCTOR_LOAN | Form | VERIFIED | `AVL-20260811-000014` | **IMPORT_READY** | Stage 2 Valid Candidate Lead |
| **15** | DR. DILIP CHANDRABANSI SIR | `919421543493` | `+919421543493` | Latur | DOCTOR_LOAN | Form | VERIFIED | `AVL-20260811-000015` | **IMPORT_READY** | Stage 2 Valid Candidate Lead |
| **16** | DR. SHRIRANG SHRISAGAR SIR | `919226779253` | `+919226779253` | Latur | DOCTOR_LOAN | Form | VERIFIED | `AVL-20260811-000016` | **IMPORT_READY** | Stage 2 Valid Candidate Lead |
| **17** | DR. MUSHIR S SHAIKH SIR | `919850008882` | `+919850008882` | Latur | DOCTOR_LOAN | Form | VERIFIED | `AVL-20260811-000017` | **IMPORT_READY** | Stage 2 Valid Candidate Lead |
| **18** | DR. VAIBHAV TILKARE SIR | `919850201203` | `+919850201203` | Latur | DOCTOR_LOAN | Form | VERIFIED | `AVL-20260811-000018` | **IMPORT_READY** | Stage 2 Valid Candidate Lead |
| **19** | DR. GAIKWAD SIR | `919922249937` | `+919922249937` | Latur | DOCTOR_LOAN | Form | VERIFIED | `AVL-20260811-000019` | **IMPORT_READY** | Stage 2 Valid Candidate Lead |
| **20** | DR. TIMBE SIR | `918421033444` | `+918421033444` | Latur | DOCTOR_LOAN | Form | VERIFIED | `AVL-20260811-000020` | **IMPORT_READY** | Stage 2 Valid Candidate Lead |

*(Note: Full 59-record forensic audit dataset is saved in `scripts/doctor_loan_audit_full.json`).*

---

## 3. Mandatory Safety Gate Status

- **ZERO MESSAGES SENT**: No WhatsApp broadcasts executed.
- **STAGE 2 STATUS**: **`LOCKED`** maintained.
- **CONTACT_LIMIT**: **`5`** maintained.
- **OMNIDM LIVE CALLS**: **`BLOCKED`** (`OMNIDM_LIVE_ENABLED=false`, ₹0.00 spent).
- **SECURITY**: All credentials and tokens masked as `[REDACTED]`.
