# TASK 5H.11A — NINE-TAB SCHEMA REFERENCE
**Source of Truth Verified:** `SHEET_COLUMNS` in `3-AVANI AI CRM/src/lib/google-sheets/sheet-schema.ts`  
**Target Test Spreadsheet:** `AVANI_AI_CRM_ISOLATED_TEST`

| # | Tab Name | Cols | Primary Key | Canonical Columns (`sheet-schema.ts`) |
|---|----------|------|-------------|---------------------------------------|
| 1 | `CUSTOMERS` | 8 | `customer_id` | `customer_id`, `customer_name`, `mobile_number`, `city`, `enquiry_source`, `created_at`, `updated_at`, `record_status` |
| 2 | `LEADS` | 10 | `lead_id` | `lead_id`, `customer_id`, `loan_category`, `requested_amount`, `lead_status`, `lead_source`, `assigned_advisor_id`, `priority`, `created_at`, `updated_at` |
| 3 | `APPLICATIONS` | 10 | `application_id` | `application_id`, `lead_id`, `customer_id`, `loan_category`, `requested_amount`, `application_status`, `lender_status`, `assigned_advisor_id`, `created_at`, `updated_at` |
| 4 | `FOLLOWUPS` | 10 | `followup_id` | `followup_id`, `lead_id`, `customer_id`, `advisor_id`, `followup_date`, `followup_type`, `followup_status`, `short_notes`, `created_at`, `updated_at` |
| 5 | `CONSENTS` | 8 | `consent_id` | `consent_id`, `customer_id`, `channel`, `consent_status`, `consent_source`, `consent_timestamp`, `optout_status`, `updated_at` |
| 6 | `MESSAGE_EVENTS` | 8 | `event_id` | `event_id`, `customer_id`, `provider`, `message_type`, `direction`, `delivery_status`, `provider_message_id`, `event_timestamp` |
| 7 | `WEBHOOK_EVENTS` | 8 | `event_id` | `event_id`, `provider`, `event_type`, `processing_status`, `payload_hash`, `received_at`, `processed_at`, `error_code` |
| 8 | `ADVISORS` | 6 | `advisor_id` | `advisor_id`, `advisor_name`, `active_status`, `role`, `created_at`, `updated_at` |
| 9 | `SYSTEM_CONFIG` | 3 | `config_key` | `config_key`, `config_value`, `updated_at` |

- **Schema Parity (Code vs Docs):** **VERIFIED (0 mismatches)** between `sheet-schema.ts`, `TASK_5H_4_GOOGLE_APPS_SCRIPT_SOURCE.md`, and `TASK_5H_4_GOOGLE_SHEETS_SCHEMA.xlsx`.
- **Live Spreadsheet Tabs in Google Drive:** **NOT VERIFIED** (no live Google connection permitted in Task 5H.11A).
- **Synthetic Data Rule Confirmed:** `TEST_*` prefix only; zero real customer records, documents, PAN, Aadhaar, or financial files.
