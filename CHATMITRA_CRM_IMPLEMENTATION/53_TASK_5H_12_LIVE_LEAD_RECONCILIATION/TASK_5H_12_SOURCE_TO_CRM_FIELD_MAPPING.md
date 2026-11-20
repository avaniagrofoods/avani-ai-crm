# TASK 5H.12 — SOURCE-TO-CRM FIELD MAPPING SPECIFICATION
## CANONICAL TRANSFORMATION & VALIDATION RULES

**Document Version:** 1.0.0  
**Date:** 2026-11-19T16:55:00+05:30  
**Classification:** STRICT AUDIT EVIDENCE — INTERNAL OPERATIONAL CONTROL  
**Author:** Senior CRM Data Migration Architect & Lead Engineer  

---

### 1. FIELD-BY-FIELD MAPPING SPECIFICATION TABLE

| Source Worksheet / Stream | Source Field | Destination Worksheet | Destination Field | Transformation Rule | Validation Criteria |
|---|---|---|---|---|---|
| `central_leads.json` | `leadId` | `LEADS` | `lead_id` | Direct mapping or format prefix `LEAD_<ID>` | String non-empty, unique |
| `central_leads.json` | `mobile` | `CUSTOMERS` | `customer_id` | Deterministic SHA256/hash: `CUST_<HASH(E164)>` | Unique deterministic identifier |
| `central_leads.json` | `fullName` | `CUSTOMERS` | `customer_name` | Trim whitespace; title case | String length 2-100 chars |
| `central_leads.json` | `mobile` | `CUSTOMERS` | `mobile_number` | Normalize to E.164 (`+91` + 10 digits) | Valid Indian mobile (+91[6-9]\d{9}) |
| `central_leads.json` | `city` | `CUSTOMERS` | `city` | Trim whitespace; default to "Latur" if blank | Valid alphanumeric city name |
| `central_leads.json` | `leadSource` | `CUSTOMERS` | `enquiry_source` | Uppercase normalized (`META_LEAD_AD`, `WEBSITE`) | Must be known source enum |
| `central_leads.json` | `firstTouchDate` | `CUSTOMERS` | `created_at` | Parse to ISO-8601 UTC string | Valid ISO-8601 timestamp |
| `central_leads.json` | `lastTouchDate` | `CUSTOMERS` | `updated_at` | Parse to ISO-8601 UTC string | Valid ISO-8601 timestamp |
| *(System Rule)* | *(Derived)* | `CUSTOMERS` | `record_status` | Default to `ACTIVE` | Enum: `ACTIVE`, `OPTED_OUT`, `INACTIVE` |
| `central_leads.json` | `loanProduct` | `LEADS` | `loan_category` | Map to canonical 9 categories (see taxonomy) | Must match canonical category |
| `central_leads.json` | `loanAmount` | `LEADS` | `requested_amount` | Strip `₹`, commas, spaces; parse integer string | Numeric string ≥ 0 |
| `central_leads.json` | `status` | `LEADS` | `lead_status` | Map `NEW` -> `NEW`, `DUPLICATE` -> `DUPLICATE` | Canonical lead status enum |
| `central_leads.json` | `campaign` | `LEADS` | `lead_source` | Concatenate source + campaign name | String ≤ 100 chars |
| `central_leads.json` | `assignedTo` | `LEADS` | `assigned_advisor_id` | If "Unassigned", assign default `ADV_SACHIN_01` | Must exist in `ADVISORS` tab |
| `central_leads.json` | `priority` | `LEADS` | `priority` | Map `HOT` -> `HIGH`, `WARM` -> `MEDIUM`, `COLD` -> `LOW` | Enum: `LOW`, `MEDIUM`, `HIGH`, `URGENT` |
| `central_leads.json` | `firstTouchDate` | `LEADS` | `created_at` | Parse to ISO-8601 UTC string | Valid ISO-8601 timestamp |
| `central_leads.json` | `lastTouchDate` | `LEADS` | `updated_at` | Parse to ISO-8601 UTC string | Valid ISO-8601 timestamp |
| `Education_DB` | `Lead ID` | `LEADS` | `lead_id` | Direct mapping `ALS-EDU-...` | Unique string |
| `Education_DB` | `Owner / Founder Name` | `CUSTOMERS` | `customer_name` | Trim whitespace | String non-empty |
| `Education_DB` | `Professional Mobile` | `CUSTOMERS` | `mobile_number` | E.164 normalization | Valid mobile |
| `Education_DB` | `City` | `CUSTOMERS` | `city` | Trim whitespace | Alphanumeric |
| `Education_DB` | `Funding Category` | `LEADS` | `loan_category` | Map to `SCHOOL_OWNER_FUNDING` or `INSTITUTIONAL_COLLEGE_FUNDING` | Canonical category |
| `Education_DB` | `Potential Funding Requirement` | `LEADS` | `requested_amount` | Clean numeric amount string | Numeric string |
| `Builder_DB` | `Lead ID` | `LEADS` | `lead_id` | Direct mapping `ALS-MH-...` | Unique string |
| `Builder_DB` | `Decision-Maker Name` | `CUSTOMERS` | `customer_name` | Trim whitespace | String non-empty |
| `Builder_DB` | `Business Mobile` | `CUSTOMERS` | `mobile_number` | E.164 normalization | Valid mobile |
| `Builder_DB` | `Primary City` | `CUSTOMERS` | `city` | Trim whitespace | Alphanumeric |
| `Builder_DB` | `Residential Segment` | `LEADS` | `loan_category` | Map to `HOME_LOAN` | Canonical category |

---

### 2. SENSITIVE FIELDS STRICTLY EXCLUDED FROM MAPPING

The following source fields are explicitly dropped and will NEVER be stored in the Google Sheets CRM:
- `cibilStatus` / Credit Score Information
- `monthlyIncome` / Salary Slips / Bank Records
- `employmentType`
- `PAN` / `Aadhaar`
- `propertyDetails` (unverified documents)
- Personal identity documents, bank accounts, or financial statements.
