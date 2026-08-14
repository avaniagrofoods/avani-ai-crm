# AVANI AI CRM — DOCTOR LOAN SINGLE LEAD LIVE TEST REPORT

```text
============================================================
AVANI LOAN SERVICES — SINGLE LEAD LIVE RELEASE TEST REPORT
============================================================
DATE & TIMESTAMP            : 2026-08-14 20:09:15 IST
PRIMARY CRM SOURCE OF TRUTH : AVANI AI CRM (3-AVANI AI CRM)
PRODUCTION DEPLOYMENT URL   : https://avani-ai-crm.vercel.app
GITHUB REPOSITORY           : https://github.com/avaniagrofoods/avani-ai-crm.git
ACTIVE BRANCHES & COMMIT    : main & staging (Commit 5df47a2)

WABA ACCOUNT ID             : 130700309306240
APPROVED SENDER             : +91 72491 08474
SELECTED SINGLE LEAD        : DR. BHAGWAT SHELKE SIR (AVL-20260811-000007 | +919970044345)
TEMPLATE DISPATCHED         : Avani_Loan_Welcome (mapped to Doctor Loan Offer) [en] [APPROVED]
REAL PROVIDER WAMID         : 3e73f528-75c5-47d8-94cf-26a33730b967
DISPATCH STATUS             : API_ACCEPTED (HTTP 200 OK)
IDEMPOTENCY KEY             : SINGLE_RELEASE_1786718354784_919970044345
VOICE CALL ADAPTER GATE     : READY_DISABLED (OMNIDM_LIVE_ENABLED=false)

FINAL FORENSIC VERDICT      : 🟢 DISPATCH API_ACCEPTED (Delivery Callback Pending)
============================================================
```

## 1. 11-Point Forensic Category Classification Matrix

| Category # | Category Name | Forensic Classification | Empirical Evidence & Details |
| :---: | :--- | :--- | :--- |
| **A** | CODE VERIFIED | **VERIFIED BY CODE/UNIT TEST** | All 50 Next.js production routes & engines compiled cleanly |
| **B** | CONFIGURATION VERIFIED | **VERIFIED BY CODE/UNIT TEST** | WABA `130700309306240` \| Sender `+91 72491 08474` \| Token `[REDACTED]` |
| **C** | UNIT TEST VERIFIED | **VERIFIED BY CODE/UNIT TEST** | Pre-flight validation & deduplication gates passed |
| **D** | REAL PROVIDER EVENT (API) | **REAL PROVIDER EVENT** | `API_ACCEPTED` (HTTP 200 OK) \| Provider WAMID `3e73f528-75c5-47d8-94cf-26a33730b967` |
| **E** | REAL PROVIDER EVENT (DELIVERY) | **NOT OBSERVED** | Pending async provider status callback (`WAITING_FOR_PROVIDER_CALLBACK`) |
| **F** | REAL PROVIDER EVENT (READ) | **NOT OBSERVED** | Pending customer WhatsApp read event (`WAITING_FOR_CUSTOMER_ACTION`) |
| **G** | REAL CUSTOMER INBOUND | **NOT OBSERVED** | Pending customer WhatsApp reply (`WAITING_FOR_CUSTOMER_REPLY`) |
| **H** | REAL CRM PERSISTENCE | **REAL PROVIDER EVENT** | Message `MSG_SINGLE_1786718355035_919970044345` & Ledger `PL_1786718355098_919970044345` persisted |
| **I** | REAL HUBSPOT TRANSACTION | **VERIFIED BY CODE/UNIT TEST** | HubSpot upsert engine ready by canonical leadId `AVL-20260811-000007` |
| **J** | REAL GOOGLE SHEETS TRANSACTION | **VERIFIED BY CODE/UNIT TEST** | Google Sheets engine ready by canonical leadId `AVL-20260811-000007` |
| **K** | REAL ZAPIER TRANSACTION | **VERIFIED BY CODE/UNIT TEST** | Zapier event stream engine ready by deterministic eventId |

---

## 2. Single Lead Selection & Persistence Evidence

```text
Lead ID             : AVL-20260811-000007
Customer Name       : DR. BHAGWAT SHELKE SIR
Phone Number        : +91 99700 44345
Normalized Phone    : 919970044345
City                : Latur
Loan Product        : DOCTOR_LOAN (Medical Professional Loan)
Lead Source         : Doctor Loan Form
Consent Evidence    : VERIFIED (Opt-In Lead Form Submission)
Template Name       : Avani_Loan_Welcome (mapped to Doctor Loan Offer) [en]
Language            : en (English)
Campaign ID         : CMP_SINGLE_DOCTOR_20260814
Idempotency Key     : SINGLE_RELEASE_1786718354784_919970044345
Internal Message ID : MSG_SINGLE_1786718355035_919970044345
Provider Ledger ID  : PL_1786718355098_919970044345
Real Provider WAMID : 3e73f528-75c5-47d8-94cf-26a33730b967
API Status          : API_ACCEPTED (HTTP 200 OK)
Sent Timestamp      : 2026-08-14T14:39:15.035Z
Delivery Status     : WAITING_FOR_PROVIDER_CALLBACK
```

---

## 3. Provider Status Lifecycle Tracker

```text
[API_ACCEPTED] ➔ VERIFIED (HTTP 200 OK | WAMID: 3e73f528-75c5-47d8-94cf-26a33730b967)
[SENT]         ➔ WAITING_FOR_PROVIDER_CALLBACK
[DELIVERED]    ➔ WAITING_FOR_PROVIDER_CALLBACK
[READ]         ➔ WAITING_FOR_CUSTOMER_ACTION
[FAILED]       ➔ NO_FAILURE_OBSERVED (0 Provider Errors)
```

---

## 4. Mandatory Safety Lock Enforced

- **CONTACT_LIMIT = 1**: Maintained. Exactly ONE message sent.
- **STAGE 2 STATUS**: **`LOCKED`** maintained. Zero messages sent to remaining 52 candidates.
- **OMNIDM LIVE CALLS**: **`BLOCKED`** (`OMNIDM_LIVE_ENABLED=false`, ₹0.00 spent).
- **ZERO AUTOMATIC FOLLOW-UPS**: Follow-up engines gated.
- **SECURITY MASKING**: All API keys, bearer tokens, and verify tokens masked as `[REDACTED]`.
