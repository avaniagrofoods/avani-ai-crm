# AVANI LOAN SERVICES — HUBSPOT INTEGRATION REPORT (SECTION 17)

- **Business Entity:** AVANI LOAN SERVICES (`https://www.avanifinserv.com/`)
- **Implementation Module:** [`src/lib/integrations.ts`](file:///c:/Users/ALPHA-1/Downloads/21MAY2026/SACHIN%20SHINDE%20DOCUMENTS/DEVELOPEMENT%20TOOLS/3-AVANI%20AI%20CRM/src/lib/integrations.ts) (`buildHubSpotSyncPayload`, `syncToHubSpot`)
- **Automated Test Verification:** [`tests/test_cp25_master_chatbot_and_integrations.test.cjs`](file:///c:/Users/ALPHA-1/Downloads/21MAY2026/SACHIN%20SHINDE%20DOCUMENTS/DEVELOPEMENT%20TOOLS/3-AVANI%20AI%20CRM/tests/test_cp25_master_chatbot_and_integrations.test.cjs) (Test 22 — PASS)

---

## 1. Environment & Credential Inspection

| Credential Key | Environment Status | Exposure Check | Notes |
|---|---|---|---|
| `HUBSPOT_PORTAL_ID` | Configured in `.env.local` & Vercel Production | Masked (0 exposures) | Used for HubSpot Forms API v3 submission (`api.hsforms.com`) |
| `HUBSPOT_FORM_ID` | Configured in `.env.local` & Vercel Production | Masked (0 exposures) | Binds CRM leads to the canonical AVANI Loan Inquiry Form |
| `HUBSPOT_ACCESS_TOKEN` | Optional Private App Token supported | Masked (0 exposures) | Supported for direct Contacts/Deals v3 upsert when enabled |

---

## 2. Synchronized Field Mapping & Deduplication Rules

[`buildHubSpotSyncPayload`](file:///c:/Users/ALPHA-1/Downloads/21MAY2026/SACHIN%20SHINDE%20DOCUMENTS/DEVELOPEMENT%20TOOLS/3-AVANI%20AI%20CRM/src/lib/integrations.ts#L101-L140) enforces all 15 required Section 17 fields and matches existing contacts via `phone` and `email` (`matchingIdentifiers`):

| # | HubSpot Property Name | AVANI CRM Source Field | Example Value |
|---|---|---|---|
| 1 | `firstname` | `lead.name` (first token) | `"Sachin"` |
| 2 | `lastname` | `lead.name` (remaining tokens) | `"Shinde"` |
| 3 | `phone` | `lead.phone` / `lead.mobile_number` | `"+919175635165"` |
| 4 | `email` | `lead.email` | `"sachin@avanifinserv.com"` |
| 5 | `city` | `lead.city` | `"Latur"` |
| 6 | `loan_category` | `lead.loanType` / `lead.loan_category` | `"Doctor Loan"` |
| 7 | `applicant_type` | `lead.employmentType` / `lead.applicant_type` | `"Professional"` |
| 8 | `required_loan_amount` | `lead.requestedAmount` | `"4500000"` |
| 9 | `monthly_income_range` | `lead.monthlyIncomeRange` | `"Above ₹2,00,000"` |
| 10 | `lead_source` | `lead.leadSource` | `"ChatMitra WhatsApp"` |
| 11 | `consent_status` | `lead.consentStatus` | `"GRANTED"` |
| 12 | `qualification_status` | `lead.status` | `"Qualified"` |
| 13 | `document_checklist_status` | `lead.documentStatus` | `"PENDING"` |
| 14 | `assigned_advisor` | `lead.assignedAgent.name` | `"Sachin Shinde"` |
| 15 | `crm_record_reference` | `lead.leadId` (`AVL-YYYYMMDD-XXXXXX`) | `"AVL-20261110-000123"` |

---

## 3. Safety & Opt-Out Enforcement
- **Opt-Out Suppression:** If `lead.isOptedOut === true` or `consentStatus === 'WITHDRAWN'`, `syncToHubSpot` immediately returns `{ success: true, suppressed: true, reason: 'CONTACT_OPTED_OUT' }` without dispatching marketing syncs.
- **Mock Mode Guard:** When `PROVIDER_MODE=mock`, `syncToHubSpot` logs a deterministic mock trace (`mock: true`) without mutating external production HubSpot portals during synthetic tests.
