# 04 — GOOGLE SHEETS CRM INDEPENDENT VERIFICATION
## INDEPENDENT AUDIT OF 9-TAB SCHEMA, GATEWAY HARDENING & LIMITATIONS

**Document Version:** 1.0.0  
**Audit Date:** 2026-11-19T21:45:00+05:30  
**Classification:** STRICT AUDIT EVIDENCE — INTERNAL OPERATIONAL CONTROL  
**Author:** Principal Software Architect & Application Security Auditor  

---

### 1. NINE-TAB CANONICAL SCHEMA VERIFICATION

The schema defined in `src/lib/google-sheets/sheet-schema.ts` was verified against live snapshot evidence from `AVANI_AI_CRM_ISOLATED_TEST`:

| Tab Name | Expected Columns | Actual Columns in Live Sheet | Verification Finding |
|---|---|---|---|
| `CUSTOMERS` | 8 columns (`customer_id`, `customer_name`, `mobile_number`, `city`, `enquiry_source`, `created_at`, `updated_at`, `record_status`) | 8 columns (exact lowercase) | **100% MATCH** |
| `LEADS` | 10 columns (`lead_id`, `customer_id`, `loan_category`, `requested_amount`, `lead_status`, `lead_source`, `assigned_advisor_id`, `priority`, `created_at`, `updated_at`) | 10 columns (exact lowercase) | **100% MATCH** |
| `APPLICATIONS` | 10 columns (`application_id`, `lead_id`, `customer_id`, `loan_category`, `requested_amount`, `application_status`, `lender_status`, `assigned_advisor_id`, `created_at`, `updated_at`) | 10 columns (exact lowercase) | **100% MATCH** |
| `FOLLOWUPS` | 10 columns (`followup_id`, `lead_id`, `customer_id`, `advisor_id`, `followup_date`, `followup_type`, `followup_status`, `short_notes`, `created_at`, `updated_at`) | 10 columns (exact lowercase) | **100% MATCH** |
| `CONSENTS` | 8 columns (`consent_id`, `customer_id`, `channel`, `consent_status`, `consent_source`, `consent_timestamp`, `optout_status`, `updated_at`) | 8 columns (exact lowercase) | **100% MATCH** |
| `MESSAGE_EVENTS` | 8 columns (`event_id`, `customer_id`, `provider`, `message_type`, `direction`, `delivery_status`, `provider_message_id`, `event_timestamp`) | 8 columns (exact lowercase) | **100% MATCH** |
| `WEBHOOK_EVENTS` | 8 columns (`event_id`, `provider`, `event_type`, `processing_status`, `payload_hash`, `received_at`, `processed_at`, `error_code`) | 8 columns (exact lowercase) | **100% MATCH** |
| `ADVISORS` | 6 columns (`advisor_id`, `advisor_name`, `active_status`, `role`, `created_at`, `updated_at`) | 6 columns (exact lowercase) | **100% MATCH** |
| `SYSTEM_CONFIG` | 3 columns (`config_key`, `config_value`, `updated_at`) | 3 columns (exact lowercase) | **100% MATCH** |

---

### 2. REASSESSMENT OF PREVIOUSLY IDENTIFIED ISSUES

The prompt mandated an independent re-investigation of historical findings:

1. **Live Apps Script HTTP Roundtrip:**
   - **Audit Finding:** VERIFIED LIVE in isolated test environment. Live calls executed via HMAC gateway (`scratch/run_live_e2e_tests.cjs`) returned HTTP 200 with healthy status and snapshot data.
2. **Apps Script Deployment Identity Reconciled:**
   - **Audit Finding:** The previous Version 1 deployment was verified **archived** via the owner's screenshot ("Deployment successfully archived"). The active Web App v2 (`AKfycbwadPvvLiVgLOUbIcnQm7ZeLEOsh1bamEYVJKi11ub8fZc-EAVugAv2WvgfTc5Izg7A4w`) is container-bound to `AVANI_AI_CRM_ISOLATED_TEST`.
3. **Cross-Tab Writes Atomicity:**
   - **Audit Finding:** Google Sheets API does not support multi-worksheet multi-phase 2-phase commit (2PC) transactions across disparate HTTP requests. To defend against partial failures, the CRM client executes sequential row appends with idempotency keys (`INSERT_IF_ABSENT`), logging atomic failures to `WEBHOOK_EVENTS` for retry.
4. **Formula Injection & PII Redaction:**
   - **Audit Finding:** VERIFIED. Gateway auto-prepends single-quotes (`'`) to strings starting with `=`, `+`, `-`, or `@`. `sheet-schema.ts` strictly excludes PAN, Aadhaar, DOB, and bank details.
5. **Zero MongoDB Customer Data Fallback:**
   - **Audit Finding:** VERIFIED. If Google Sheets gateway returns non-200 or times out, the CRM throws a typed error (`SheetsCrmError`) and fails closed with HTTP 503. Zero customer data is routed to MongoDB.

**Verification Status:** **ISOLATED TEST VERIFIED; PRODUCTION SPREADSHEET PENDING CREATION.**
