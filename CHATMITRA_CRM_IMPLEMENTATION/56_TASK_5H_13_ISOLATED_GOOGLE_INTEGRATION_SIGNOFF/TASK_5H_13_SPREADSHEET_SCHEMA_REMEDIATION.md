# TASK 5H.13 — REPORT 5
## Google Sheets Data Schema & PII Remediation Report

- **Task:** 5H.13 — Section 5 Schema Remediation
- **Target Spreadsheet:** `AVANI_AI_CRM_ISOLATED_TEST`
- **Affected Tab:** `CUSTOMERS`

---

### 1. The Discrepancy & Privacy Exposure

In Evidence A, the `CUSTOMERS` tab header row currently has 16 columns:
```text
[Current Headers in Sheet]:
customer_id, customer_name, mobile_number, DATE_OF_BIRTH, GENDER, ADDRESS, PIN_CODE, PAN_NUMBER, EMPLOYMENT_TYPE, MONTHLY_INCOME, CREDIT_SCORE, city, enquiry_source, created_at, updated_at, record_status
```

#### Why this violates CRM specifications:
1. **PII Minimization Breach:** Collecting or storing `PAN_NUMBER`, `DATE_OF_BIRTH`, `MONTHLY_INCOME`, or `CREDIT_SCORE` inside a shared or operational Google Sheet violates the security charter of AVANI LOAN SERVICES. Operational sheets must only store minimal coordination attributes.
2. **Runtime Validation Failure:** In `src/lib/google-sheets/sheet-schema.ts`:
   ```typescript
   export const SHEET_COLUMNS = {
     CUSTOMERS: [
       'customer_id',
       'customer_name',
       'mobile_number',
       'city',
       'enquiry_source',
       'created_at',
       'updated_at',
       'record_status'
     ],
     ...
   }
   ```
   If the sheet contains 16 columns, `validateSheetHeaderRow()` immediately rejects all operations with:
   `Invalid schema on tab CUSTOMERS: expected 8 columns, got 16`.

---

### 2. Remediation Specification

Row 1 of the `CUSTOMERS` tab must be corrected to match the canonical 8 columns:

| Column Position | Column Name | Data Type / Format | Validation Constraint |
| :--- | :--- | :--- | :--- |
| **Col A (1)** | `customer_id` | String (`CUST-...` or `TEST_CUST_...`) | Primary Key, Non-Empty |
| **Col B (2)** | `customer_name` | String | Full Name, Formula Sanitized |
| **Col C (3)** | `mobile_number` | String (`+91XXXXXXXXXX`) | E.164 10-digit Indian Mobile |
| **Col D (4)** | `city` | String | City / Town |
| **Col E (5)** | `enquiry_source` | String | E.g. `CHATMITRA`, `WHATSAPP`, `DIRECT` |
| **Col F (6)** | `created_at` | ISO-8601 Timestamp | E.g. `2026-11-19T14:00:00.000Z` |
| **Col G (7)** | `updated_at` | ISO-8601 Timestamp | E.g. `2026-11-19T14:00:00.000Z` |
| **Col H (8)** | `record_status` | Enum (`ACTIVE` \| `OPTED_OUT` \| `INACTIVE`) | Status string |

**Columns I through P must be deleted.**

---

### 3. All Nine Canonical Tabs Inventory

Every tab in `AVANI_AI_CRM_ISOLATED_TEST` must have headers matching `src/lib/google-sheets/sheet-schema.ts`:

1. `CUSTOMERS` (8 cols): `customer_id`, `customer_name`, `mobile_number`, `city`, `enquiry_source`, `created_at`, `updated_at`, `record_status`
2. `LEADS` (10 cols): `lead_id`, `customer_id`, `loan_category`, `requested_amount`, `lead_status`, `lead_source`, `assigned_advisor_id`, `priority`, `created_at`, `updated_at`
3. `APPLICATIONS` (10 cols): `application_id`, `lead_id`, `customer_id`, `loan_category`, `requested_amount`, `application_status`, `lender_status`, `assigned_advisor_id`, `created_at`, `updated_at`
4. `FOLLOWUPS` (10 cols): `followup_id`, `lead_id`, `customer_id`, `advisor_id`, `followup_date`, `followup_type`, `followup_status`, `short_notes`, `created_at`, `updated_at`
5. `CONSENTS` (8 cols): `consent_id`, `customer_id`, `channel`, `consent_status`, `consent_source`, `consent_timestamp`, `optout_status`, `updated_at`
6. `MESSAGE_EVENTS` (8 cols): `event_id`, `customer_id`, `provider`, `message_type`, `direction`, `delivery_status`, `provider_message_id`, `event_timestamp`
7. `WEBHOOK_EVENTS` (8 cols): `event_id`, `provider`, `event_type`, `processing_status`, `payload_hash`, `received_at`, `processed_at`, `error_code`
8. `ADVISORS` (6 cols): `advisor_id`, `advisor_name`, `active_status`, `role`, `created_at`, `updated_at`
9. `SYSTEM_CONFIG` (3 cols): `config_key`, `config_value`, `updated_at`
