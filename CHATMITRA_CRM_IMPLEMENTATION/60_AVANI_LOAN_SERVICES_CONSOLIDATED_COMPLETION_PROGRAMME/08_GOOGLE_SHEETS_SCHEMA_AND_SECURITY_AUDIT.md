# 08 — GOOGLE SHEETS SCHEMA AND SECURITY AUDIT REPORT
## SPREADSHEET ARCHITECTURE, GATEWAY SECURITY & CANONICAL SCHEMAS

**Document Version:** 1.0.0  
**Date:** 2026-11-19T17:15:00+05:30  
**Classification:** STRICT AUDIT EVIDENCE — INTERNAL OPERATIONAL CONTROL  
**Author:** Google Apps Script Administrator & Application Security Engineer  

---

### 1. SPREADSHEET RESOURCE IDENTIFICATION

| Attribute | Forensic Value |
|---|---|
| **Spreadsheet Title** | `AVANI_AI_CRM_ISOLATED_TEST` |
| **Spreadsheet ID** | `1onRvXrdwiEYwLxCMYnHjRiJ4FtOri1Hs74LC...` |
| **Owner Google Account** | Authenticated Owner Session (`sachin.shinde...`) |
| **Apps Script Project** | `AVANI_AI_CRM_TEST_GATEWAY` (Container-Bound) |
| **Active Deployment** | Web App v2 (`AKfycbwadPvvLiVgLOUbIcnQm7Ze...`) |
| **Archived Deployment** | Version 1 (Verified Archived in User Screenshot) |
| **Authorization Model** | Execute as: Me / Who has access: Anyone (Restricted by HMAC) |

---

### 2. NINE CANONICAL WORKSHEETS & COLUMN SCHEMAS

Forensic snapshot confirms exact row 1 header structures across all 9 tabs:

```
1. CUSTOMERS (8 columns)
   [customer_id, customer_name, mobile_number, city, enquiry_source, created_at, updated_at, record_status]

2. LEADS (10 columns)
   [lead_id, customer_id, loan_category, requested_amount, lead_status, lead_source, assigned_advisor_id, priority, created_at, updated_at]

3. APPLICATIONS (10 columns)
   [application_id, lead_id, customer_id, loan_category, requested_amount, application_status, lender_status, assigned_advisor_id, created_at, updated_at]

4. FOLLOWUPS (10 columns)
   [followup_id, lead_id, customer_id, advisor_id, followup_date, followup_type, followup_status, short_notes, created_at, updated_at]

5. CONSENTS (8 columns)
   [consent_id, customer_id, channel, consent_status, consent_source, consent_timestamp, optout_status, updated_at]

6. MESSAGE_EVENTS (8 columns)
   [event_id, customer_id, provider, message_type, direction, delivery_status, provider_message_id, event_timestamp]

7. WEBHOOK_EVENTS (8 columns)
   [event_id, provider, event_type, processing_status, payload_hash, received_at, processed_at, error_code]

8. ADVISORS (6 columns)
   [advisor_id, advisor_name, active_status, role, created_at, updated_at]

9. SYSTEM_CONFIG (3 columns)
   [config_key, config_value, updated_at]
```

---

### 3. APPS SCRIPT GATEWAY SECURITY HARDENING AUDIT

The container-bound Apps Script source (`Code.gs` / `gateway.gs`) implements 6 layers of security:

1. **Spreadsheet Allowlisting:** Script property `ALLOWED_SPREADSHEET_ID` verifies that the gateway only manipulates `AVANI_AI_CRM_ISOLATED_TEST`.
2. **Cryptographic HMAC-SHA256:** Script property `GATEWAY_HMAC_SECRET` is used with `Utilities.computeHmacSha256Signature`. Signatures are validated before any data processing.
3. **Replay Window Enforcement:** Incoming `timestampMs` must be within $\pm 300$ seconds of Google server time (`Math.abs(now - timestampMs) <= 300000`).
4. **Formula Injection Sanitization:** Cells starting with `=`, `+`, `-`, or `@` are automatically escaped with a leading single quote (`'`), neutralizing spreadsheet formula exploits.
5. **Concurrency Control:** `LockService.getDocumentLock()` acquires document lock up to 10 seconds, preventing race conditions during batch row operations.
6. **Zero Sensitive PII Storage:** Script enforces tabular isolation; media attachments and sensitive identity scans are rejected at the gateway.

**Audit Verdict:** **STAGES C1, C2, C3, C4, AND C5 COMPLETED AND VERIFIED.**
