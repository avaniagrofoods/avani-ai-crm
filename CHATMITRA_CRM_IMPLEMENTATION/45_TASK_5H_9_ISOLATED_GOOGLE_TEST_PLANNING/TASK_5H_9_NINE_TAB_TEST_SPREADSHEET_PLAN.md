# TASK 5H.9 — NINE-TAB TEST SPREADSHEET PLAN
**Target Spreadsheet:** `AVANI_AI_CRM_ISOLATED_TEST` (Synthetic `TEST_` Data Only)  
**Canonical Schema Source:** `SHEET_COLUMNS` in `src/lib/google-sheets/sheet-schema.ts`

---

## 1. Nine-Tab Plan & Synthetic Test Rules
All 9 tabs must use **exact headers** from `sheet-schema.ts`, zero document/media columns, formula-injection blocking (`=`, `+`, `-`, `@`, `\t`, `\r`), and **zero real customer mobiles, PAN, Aadhaar, bank details, or salary docs** (use `+919000000001`–`+919000000099` synthetic numbers only).

| # | Tab | PK | Exact Headers |
|---|-----|----|---------------|
| 1 | `CUSTOMERS` | `customer_id` | `customer_id`, `customer_name`, `mobile_number`, `city`, `enquiry_source`, `created_at`, `updated_at`, `record_status` |
| 2 | `LEADS` | `lead_id` | `lead_id`, `customer_id`, `loan_category`, `requested_amount`, `lead_status`, `lead_source`, `assigned_advisor_id`, `priority`, `created_at`, `updated_at` |
| 3 | `APPLICATIONS` | `application_id` | `application_id`, `lead_id`, `customer_id`, `loan_category`, `requested_amount`, `application_status`, `lender_status`, `assigned_advisor_id`, `created_at`, `updated_at` |
| 4 | `FOLLOWUPS` | `followup_id` | `followup_id`, `lead_id`, `customer_id`, `advisor_id`, `followup_date`, `followup_type`, `followup_status`, `short_notes`, `created_at`, `updated_at` |
| 5 | `CONSENTS` | `consent_id` | `consent_id`, `customer_id`, `channel`, `consent_status`, `consent_source`, `consent_timestamp`, `optout_status`, `updated_at` |
| 6 | `MESSAGE_EVENTS` | `event_id` | `event_id`, `customer_id`, `provider`, `message_type`, `direction`, `delivery_status`, `provider_message_id`, `event_timestamp` |
| 7 | `WEBHOOK_EVENTS` | `event_id` | `event_id`, `provider`, `event_type`, `processing_status`, `payload_hash`, `received_at`, `processed_at`, `error_code` |
| 8 | `ADVISORS` | `advisor_id` | `advisor_id`, `advisor_name`, `active_status`, `role`, `created_at`, `updated_at` |
| 9 | `SYSTEM_CONFIG` | `config_key` | `config_key`, `config_value`, `updated_at` |
