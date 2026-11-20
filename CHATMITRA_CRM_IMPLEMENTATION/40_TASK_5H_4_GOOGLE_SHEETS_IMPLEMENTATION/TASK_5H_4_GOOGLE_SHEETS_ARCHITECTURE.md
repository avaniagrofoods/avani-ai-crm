# TASK 5H.4 — GOOGLE SHEETS ARCHITECTURE
**Master Spreadsheet:** `AVANI_LOAN_SERVICES_CRM_MASTER`  
**Transport Modes:** `APPS_SCRIPT_GATEWAY` (live) | `MOCK_IN_MEMORY` (offline testing)

---

## 1. 9-Tab Master Schema

| # | Tab Name | Primary Key | Repository | Purpose |
|---|----------|-------------|------------|---------|
| 1 | `CUSTOMERS` | `customer_id` | `CustomerRepository` | Normalized `+91XXXXXXXXXX` mobile, name, city, enquiry source, `ACTIVE`/`OPTED_OUT` status |
| 2 | `LEADS` | `lead_id` | `LeadRepository` | Loan category, requested amount, lead stage/status, advisor assignment, priority |
| 3 | `APPLICATIONS` | `application_id` | `ApplicationRepository` | Structured lender/application status, requested & sanctioned amounts (zero file URLs) |
| 4 | `FOLLOWUPS` | `followup_id` | `FollowupRepository` | D0–D15 advisor follow-up schedule, status (`PENDING`/`COMPLETED`/`CANCELLED`), short notes |
| 5 | `CONSENTS` | `consent_id` | `ConsentRepository` | DPDP Act WhatsApp consent (`GRANTED`/`WITHDRAWN`/`DENIED`) and `optout_status` |
| 6 | `MESSAGE_EVENTS` | `event_id` | `MessageEventRepository` | Direction, type, delivery status metadata only (no transcripts or media) |
| 7 | `WEBHOOK_EVENTS` | `event_id` | `WebhookEventRepository` | Idempotent event registry storing SHA-256 `payload_hash` only (no raw payload) |
| 8 | `ADVISORS` | `advisor_id` | `AdvisorRepository` | Advisor roster & roles (zero passwords or tokens) |
| 9 | `SYSTEM_CONFIG` | `config_key` | `SystemConfigRepository` | Non-secret operational flags only |

---

## 2. Foundation Modules (`src/lib/google-sheets/`)

- `sheet-schema.ts`: Canonical column definitions, primary keys, and `validateSheetHeaderRow()`.
- `sheet-error-handler.ts`: Typed `SheetsCrmError` (`503 GOOGLE_SHEETS_UNAVAILABLE`, `429 GOOGLE_SHEETS_QUOTA_EXCEEDED`, `500 GOOGLE_SHEETS_SCHEMA_INVALID`, `400 GOOGLE_SHEETS_FORMULA_INJECTION_BLOCKED`, `400 GOOGLE_SHEETS_VALIDATION_FAILED`, `409 GOOGLE_SHEETS_DUPLICATE_EVENT`, `401 GOOGLE_SHEETS_AUTH_FAILED`, `410 DOCUMENT_UPLOAD_DISABLED`) and `executeWithControlledBackoff()`.
- `sheet-validation.ts`: E.164 Indian phone normalization, formula-injection blocking, Aadhaar/PAN pattern redaction, field length caps.
- `sheet-idempotency.ts`: `computePayloadSha256()`, `buildDeterministicEventId()`, `sheetsWriteMutex`, `verifyAndRecordRequestNonce()`.
- `google-auth.ts`: HMAC-SHA256 gateway request signing (`signAppsScriptGatewayRequest`, `verifyAppsScriptGatewaySignature` with 300s timestamp window + nonce) and native Node `crypto` RS256 JWT assertion helper (`createServiceAccountJwtAssertion`).
- `google-sheets-client.ts`: Unified `GoogleSheetsClient` with `APPS_SCRIPT_GATEWAY` and `MOCK_IN_MEMORY` fault-injection (`forceUnavailable`, `forceQuotaExceeded`, `corruptHeaderOnTab`). Zero MongoDB fallback.
- `index.ts`: `CrmSheetsService` composite operations (`assertHealthy`, `registerOrUpdateCustomerLead`, `hydrateLeadView`, `listHydratedLeads`, `findHydratedLeadByIdOrPhone`).
