# AVANI LOAN SERVICES — CHATBOT FIELD MAPPING, TAGS & CUSTOM ATTRIBUTES

- **Business Entity:** AVANI LOAN SERVICES (`https://www.avanifinserv.com/`)
- **Implementation Module:** [`src/lib/chatbot-flow-engine.ts`](file:///c:/Users/ALPHA-1/Downloads/21MAY2026/SACHIN%20SHINDE%20DOCUMENTS/DEVELOPEMENT%20TOOLS/3-AVANI%20AI%20CRM/src/lib/chatbot-flow-engine.ts)
- **ChatMitra Pro Plan Quotas:** Up to **100 Tags** (17 used) | Up to **20 Custom Attributes** (20 used)

---

## 1. Canonical 17 ChatMitra Pro Tags (`CHATMITRA_PRO_CANONICAL_TAGS`)

| # | Tag Key | Category | Assignment Condition |
|---|---|---|---|
| 1 | `SALARIED_APPLICANT` | Applicant Profile | `applicant_type === "Salaried"` |
| 2 | `SELF_EMPLOYED_APPLICANT` | Applicant Profile | `applicant_type === "Self Employed"` |
| 3 | `BUSINESS_OWNER` | Applicant Profile | `applicant_type === "Business Owner"` |
| 4 | `DOCTOR_APPLICANT` | Professional Profile | `professional_subtype === "Doctor"` or `loan_category === "Doctor Loan"` |
| 5 | `CA_APPLICANT` | Professional Profile | `professional_subtype === "Chartered Accountant"` or `loan_category === "CA Loan"` |
| 6 | `PERSONAL_LOAN` | Loan Category | `loan_category === "Personal Loan"` |
| 7 | `BUSINESS_LOAN` | Loan Category | `loan_category === "Business Loan"` |
| 8 | `HOME_LOAN` | Loan Category | `loan_category === "Home Loan"` |
| 9 | `MORTGAGE_LOAN` | Loan Category | `loan_category === "Mortgage Loan / Loan Against Property"` |
| 10 | `EDUCATION_LOAN_INDIA` | Loan Category | `loan_category === "Education Loan — India"` |
| 11 | `EDUCATION_LOAN_ABROAD` | Loan Category | `loan_category === "Education Loan — Abroad"` |
| 12 | `SCHOOL_FUNDING` | Institutional Category | `loan_category === "School Funding"` |
| 13 | `COLLEGE_FUNDING` | Institutional Category | `loan_category === "College Funding"` |
| 14 | `DOCS_PENDING` | Workflow Stage | `document_checklist_sent === true` and `document_submission_status === "PENDING"` |
| 15 | `QUALIFIED_LEAD` | Workflow Stage | All 4 qualification steps completed (`lead_qualification_status === "QUALIFIED"`) |
| 16 | `HUMAN_HANDOFF` | Routing | Customer requested human advisor or chose "Prefer to discuss with an advisor" |
| 17 | `OPTED_OUT` | Compliance | Customer sent `STOP`, `UNSUBSCRIBE`, or `DND` (`consent_status === "WITHDRAWN"`) |

---

## 2. Canonical 20 ChatMitra Pro Custom Attributes (`CHATMITRA_PRO_CUSTOM_ATTRIBUTES`)

 Enforced by [`buildChatMitraCustomAttributes`](file:///c:/Users/ALPHA-1/Downloads/21MAY2026/SACHIN%20SHINDE%20DOCUMENTS/DEVELOPEMENT%20TOOLS/3-AVANI%20AI%20CRM/src/lib/chatbot-flow-engine.ts#L204-L229) to guarantee strict compliance with ChatMitra Pro's 20-attribute ceiling:

| # | ChatMitra Custom Attribute | CRM Model Field (`Lead` / `Contact`) | Data Type | Example / Default Value |
|---|---|---|---|---|
| 1 | `preferred_language` | `Lead.preferredLanguage` | String | `"English"` \| `"मराठी"` \| `"हिंदी"` |
| 2 | `full_name` | `Lead.name` / `Contact.name` | String | `"Sachin Shinde"` |
| 3 | `mobile_number` | `Lead.phone` / `Contact.phone` | String (E.164) | `"+919175635165"` |
| 4 | `email` | `Lead.email` / `Contact.email` | String | `"sachin@avanifinserv.com"` |
| 5 | `city` | `Lead.city` / `Contact.city` | String | `"Latur"` |
| 6 | `applicant_type` | `Lead.employmentType` | String | `"Salaried"` \| `"Business Owner"` \| `"Professional"` |
| 7 | `professional_subtype` | `Lead.profession` | String | `"Doctor"` \| `"Chartered Accountant"` \| `""` |
| 8 | `monthly_income_range` | `Lead.monthlyIncome` | String | `"Above ₹2,00,000"` |
| 9 | `loan_category` | `Lead.loanType` | String | `"Doctor Loan"` |
| 10 | `required_loan_amount` | `Lead.requestedAmount` | Numeric String | `"4500000"` |
| 11 | `amount_currency` | `Lead.currency` | String | `"INR"` |
| 12 | `education_destination` | `Conversation.context.education_destination` | String | `"India"` \| `"Abroad"` \| `""` |
| 13 | `co_applicant_type` | `Conversation.context.co_applicant_type` | String | `"Salaried"` \| `"Farmer"` \| `"Pensioner"` |
| 14 | `document_checklist_sent` | `Conversation.context.document_checklist_sent` | String (`"true"`/`"false"`) | `"true"` |
| 15 | `document_submission_status` | `Lead.documentStatus` | String | `"PENDING"` \| `"PARTIAL"` \| `"COMPLETE"` |
| 16 | `lead_qualification_status` | `Lead.status` | String | `"IN_PROGRESS"` \| `"QUALIFIED"` |
| 17 | `assigned_advisor` | `Lead.assignedAgent.name` | String | `"Sachin Shinde"` |
| 18 | `consent_status` | `Lead.consentStatus` / `Contact.consentStatus` | String | `"GRANTED"` \| `"WITHDRAWN"` |
| 19 | `consent_timestamp` | `Lead.consentTimestamp` | ISO-8601 String | `"2026-11-10T10:00:00.000Z"` |
| 20 | `crm_lead_id` | `Lead.leadId` / `Lead._id` | String | `"AVL-20261110-000123"` |
