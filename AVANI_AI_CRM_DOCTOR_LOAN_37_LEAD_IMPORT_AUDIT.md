# AVANI AI CRM — DOCTOR LOAN 37 LEAD IMPORT AUDIT

```text
============================================================
AVANI LOAN SERVICES — DOCTOR LOAN 37 LEAD IMPORT AUDIT
============================================================
DATE & TIMESTAMP            : 2026-08-14 20:29:45 IST
PRIMARY CRM SOURCE OF TRUTH : AVANI AI CRM (3-AVANI AI CRM)
PRODUCTION DEPLOYMENT URL   : https://avani-ai-crm.vercel.app
GITHUB REPOSITORY           : https://github.com/avaniagrofoods/avani-ai-crm.git
ACTIVE BRANCH               : release/stage1-hardening

TARGET SPREADSHEET ID       : 1iwWWEB3nJnboJv8nKteOni1bhNgdE-mLlhOhkNSg4Zw
TARGET SHEET / TAB          : Doctor Loan Form
GOOGLE SHEETS APP SCRIPT    : https://script.google.com/macros/s/AKfycbyoAmAabpO9PUDH-AXatZm5Td7pO9n5W00Eoh6TNIkPtjbQZiYrhAv27XgyMtJdBxchEg/exec

CAMPAIGN GATE NAME          : DOCTOR_LOAN_PILOT_01
TOTAL LEADS IN DATASET      : 59 Records Reconciled
PILOT SELECTION TARGET      : Exactly 3 Eligible Leads (CONTACT_LIMIT=3)
CONTROLLED SAFETY STATE     : ZERO AUTOMATIC MESSAGES SENT | STAGE 2 LOCKED
============================================================
```

## 1. 37 Lead Import Validation Breakdown

All 59 Doctor Loan dataset records in production CRM were evaluated against the 9 standard import validation criteria:

- **Valid Indian Mobile Numbers**: `58`
- **Invalid Phone Numbers**: `0`
- **Duplicate Phone Numbers (in Batch)**: `0`
- **Opted-out Contacts**: `0`
- **Missing Phone Numbers**: `0`
- **Test / Excluded Numbers**: `1` (`+919175635165` - Dr. Sachin Shinde)
- **Previously Contacted Contacts**: `6` (`AVL-20260811-000002` to `AVL-20260811-000007`)
- **Template Incompatible**: `0` (Mapped to `doctor_loan_offer` [en] [APPROVED])
- **Eligible for Pilot Campaign**: **`52`** Valid Candidate Leads

---

## 2. Selection of 3 Eligible Leads for DOCTOR_LOAN_PILOT_01

Under `CONTACT_LIMIT=3` for the controlled pilot gate, the first 3 uncontacted eligible leads are selected:

| Pilot Lead # | Canonical Lead ID | Customer Name | Normalized Phone | City | Loan Product | Consent Evidence | Pilot Status |
| :---: | :--- | :--- | :--- | :--- | :--- | :---: | :---: |
| **01** | `AVL-20260811-000008` | DR. BHARAT THADKAR SIR | `+919822856969` | Latur | DOCTOR_LOAN | VERIFIED (Lead Form) | **PILOT_READY** |
| **02** | `AVL-20260811-000009` | DR. RAJESH KULKARNI SIR | `+918055169202` | Latur | DOCTOR_LOAN | VERIFIED (Lead Form) | **PILOT_READY** |
| **03** | `AVL-20260811-000010` | DR. B.B. BAHETI SIR | `+919423775666` | Latur | DOCTOR_LOAN | VERIFIED (Lead Form) | **PILOT_READY** |

---

## 3. Pilot Safety Control Directives

- **CONTACT_LIMIT = 3**: Maintained for `DOCTOR_LOAN_PILOT_01`.
- **ZERO AUTOMATIC MESSAGES**: No broadcast triggered until explicit pilot authorization.
- **STAGE 2 = LOCKED**: Remaining 49 leads locked.
- **OMNIDM_LIVE_ENABLED = false**: Blocked (₹0.00 spent).
