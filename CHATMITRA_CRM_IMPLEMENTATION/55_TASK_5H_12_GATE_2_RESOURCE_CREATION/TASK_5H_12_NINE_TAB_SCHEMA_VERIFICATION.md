# TASK 5H.12 — REPORT 4
## Nine-Tab Canonical Google Sheets Schema Offline Validation

- **Task:** 5H.12 — Section 5 Schema Audit
- **Canonical Definition:** `Project 2\src\lib\google-sheets\sheet-schema.ts`
- **Validation Scope:** Offline Parity, Strict Column Typings & Header Hygiene
- **Offline Parity Status:** **100% CANONICAL PARITY CONFIRMED**

---

### 1. Canonical Schema Inventory

The live schema definitions in `src/lib/google-sheets/sheet-schema.ts` were audited against the Task 5H.12 specifications:

| # | Canonical Tab Name | Column Count | Primary Key | Key Business Columns |
| :--- | :--- | :--- | :--- | :--- |
| 1 | `CUSTOMERS` | 8 | `customer_id` | `customer_name`, `mobile_number`, `city`, `enquiry_source`, `created_at`, `updated_at`, `record_status` |
| 2 | `LEADS` | 10 | `lead_id` | `customer_id`, `loan_category`, `requested_amount`, `lead_status`, `lead_source`, `assigned_advisor_id`, `priority`, `created_at`, `updated_at` |
| 3 | `APPLICATIONS` | 10 | `application_id` | `lead_id`, `customer_id`, `loan_category`, `requested_amount`, `application_status`, `lender_status`, `assigned_advisor_id`, `created_at`, `updated_at` |
| 4 | `FOLLOWUPS` | 10 | `followup_id` | `lead_id`, `customer_id`, `advisor_id`, `followup_date`, `followup_type`, `followup_status`, `short_notes`, `created_at`, `updated_at` |
| 5 | `CONSENTS` | 8 | `consent_id` | `customer_id`, `channel`, `consent_status`, `consent_source`, `consent_timestamp`, `optout_status`, `updated_at` |
| 6 | `MESSAGE_EVENTS` | 8 | `event_id` | `customer_id`, `provider`, `message_type`, `direction`, `delivery_status`, `provider_message_id`, `event_timestamp` |
| 7 | `WEBHOOK_EVENTS` | 8 | `event_id` | `provider`, `event_type`, `processing_status`, `payload_hash`, `received_at`, `processed_at`, `error_code` |
| 8 | `ADVISORS` | 6 | `advisor_id` | `advisor_name`, `active_status`, `role`, `created_at`, `updated_at` |
| 9 | `SYSTEM_CONFIG` | 3 | `config_key` | `config_value`, `updated_at` |

---

### 2. Header Hygiene & Data Security Invariants

1. **Exact Header Matching:** `validateSheetHeaderRow()` strictly enforces column order and column count. No column may be added, omitted, or reordered.
2. **Formula Injection Sanitization:** Every cell write passes through `sanitizeFormula()`, prepending a single quote `'` to any value starting with `=`, `+`, `-`, `@`, `\t`, or `\r`.
3. **PII Minimization:** No government IDs (Aadhaar, PAN), passwords, bank account numbers, or raw KYC document links are included in the schema.
4. **Zero Media Storage:** All media and binary documents remain outside the spreadsheet.
5. **Zero MongoDB Dependency:** All customer and business records operate purely with Google Sheets.
