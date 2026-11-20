# TASK 5H.6 — A-02 REMEDIATION BLUEPRINT: CANONICAL 9-TAB SCHEMA
**Severity:** CRITICAL | **Source of Truth:** `SHEET_COLUMNS` in `src/lib/google-sheets/sheet-schema.ts`

---

## 1. Canonical 9-Tab Schema Matrix (`AVANI_LOAN_SERVICES_CRM_MASTER`)

| # | Tab Name | Cols | Primary Key | Canonical Column Order (`sheet-schema.ts`) |
|---|----------|------|-------------|--------------------------------------------|
| 1 | `CUSTOMERS` | 8 | `customer_id` | `customer_id`, `customer_name`, `mobile_number`, `city`, `enquiry_source`, `created_at`, `updated_at`, `record_status` |
| 2 | `LEADS` | 10 | `lead_id` | `lead_id`, `customer_id`, `loan_category`, `requested_amount`, `lead_status`, `lead_source`, `assigned_advisor_id`, `priority`, `created_at`, `updated_at` |
| 3 | `APPLICATIONS` | 10 | `application_id` | `application_id`, `lead_id`, `customer_id`, `loan_category`, `requested_amount`, `application_status`, `lender_status`, `assigned_advisor_id`, `created_at`, `updated_at` |
| 4 | `FOLLOWUPS` | 10 | `followup_id` | `followup_id`, `lead_id`, `customer_id`, `advisor_id`, `followup_date`, `followup_type`, `followup_status`, `short_notes`, `created_at`, `updated_at` |
| 5 | `CONSENTS` | 8 | `consent_id` | `consent_id`, `customer_id`, `channel`, `consent_status`, `consent_source`, `consent_timestamp`, `optout_status`, `updated_at` |
| 6 | `MESSAGE_EVENTS` | 8 | `event_id` | `event_id`, `customer_id`, `provider`, `message_type`, `direction`, `delivery_status`, `provider_message_id`, `event_timestamp` |
| 7 | `WEBHOOK_EVENTS` | 8 | `event_id` | `event_id`, `provider`, `event_type`, `processing_status`, `payload_hash`, `received_at`, `processed_at`, `error_code` |
| 8 | `ADVISORS` | 6 | `advisor_id` | `advisor_id`, `advisor_name`, `active_status`, `role`, `created_at`, `updated_at` |
| 9 | `SYSTEM_CONFIG` | 3 | `config_key` | `config_key`, `config_value`, `updated_at` |

## 2. Column-by-Column Difference Report (`sheet-schema.ts` vs Apps Script / 5H.4 Schema XLSX)

| Tab | `sheet-schema.ts` (Canonical) | Apps Script / 5H.4 XLSX Mismatch | Remediation |
|-----|-------------------------------|----------------------------------|-------------|
| `CUSTOMERS` | 8 cols (`record_status` at pos 8, no `notes_summary`) | Had 9 cols (`record_status` at pos 6, added `notes_summary` at pos 9) | Update Apps Script & XLSX to exact 8 cols from `sheet-schema.ts`. |
| `APPLICATIONS` | 10 cols (`loan_category`, `assigned_advisor_id`, `created_at`, no `sanctioned_amount`) | Had 8 cols (omitted `loan_category`, `assigned_advisor_id`, `created_at`; added `sanctioned_amount`) | Update Apps Script & XLSX to exact 10 cols from `sheet-schema.ts` (if `sanctioned_amount` is needed later, add via explicit schema version bump). |
| `CONSENTS` | 8 cols (includes `updated_at` at pos 8) | Had 7 cols (omitted `updated_at`) | Update Apps Script & XLSX to exact 8 cols from `sheet-schema.ts`. |
| Other 6 Tabs | `LEADS` (10), `FOLLOWUPS` (10), `MESSAGE_EVENTS` (8), `WEBHOOK_EVENTS` (8), `ADVISORS` (6), `SYSTEM_CONFIG` (3) | Exact match | No change required; add parity unit test asserting `EXPECTED_TABS === SHEET_COLUMNS`. |

## 3. Sensitive-Data & Validation Rules
- All string cells pass `sanitizeCellForSheets()` (blocks `=`, `+`, `-`, `@`, `\t`, `\r`, `IMPORTXML`, etc.; redacts `[REDACTED_AADHAAR]` and `[REDACTED_PAN]`; max 240–500 chars).
- `mobile_number` normalized to `+91[6-9]\d{9}`.
- Zero passwords, tokens, raw webhook payloads, media IDs, or document URLs in any column.
