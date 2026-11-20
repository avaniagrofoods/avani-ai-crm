# TASK 5H.12 — SOURCE WORKSHEET INVENTORY REPORT
## COMPREHENSIVE INVENTORY OF WORKBOOKS, WORKSHEETS & LEAD CHANNELS

**Document Version:** 1.0.0  
**Date:** 2026-11-19T16:55:00+05:30  
**Classification:** STRICT AUDIT EVIDENCE — INTERNAL OPERATIONAL CONTROL  
**Author:** Senior CRM Data Migration Architect  

---

### 1. WORKSHEET INVENTORY & CATEGORY MAPPING

The following inventory catalogues all lead-generation worksheets, their operational purpose, source attributes, and corresponding CRM category:

| # | Source Worksheet / Dataset | Operational Purpose | Record Count | Primary Loan Category | CRM Destination Tab |
|---|---|---|---|---|---|
| 1 | `Medical_Loan_Leads` / Doctor Database | Healthcare professional working capital & equipment loans | 80 | `DOCTOR_MEDICAL_LOAN` | `CUSTOMERS`, `LEADS` |
| 2 | `Personal_Loan_Leads` / Salaried | Salaried employee personal loans | 252 | `PERSONAL_LOAN` | `CUSTOMERS`, `LEADS` |
| 3 | `Business_Loan_Leads` / MSME | Small business working capital & expansion | 2 | `BUSINESS_LOAN` | `CUSTOMERS`, `LEADS` |
| 4 | `Home_Loan_Leads` / Builder Referrals | Housing purchase, plot construction & builder tie-ups | 83 | `HOME_LOAN` | `CUSTOMERS`, `LEADS` |
| 5 | `Mortgage_LAP_Leads` | Loan against residential/commercial property | 40 | `MORTGAGE_LAP` | `CUSTOMERS`, `LEADS` |
| 6 | `Education_Loan_India` | Domestic higher education degree funding | 25 | `EDUCATION_LOAN_INDIA` | `CUSTOMERS`, `LEADS` |
| 7 | `Education_Loan_Abroad` | Overseas study funding (USA, UK, Canada, Australia) | 15 | `EDUCATION_LOAN_ABROAD` | `CUSTOMERS`, `LEADS` |
| 8 | `School_Owner_Funding` | K-12 school infrastructure & expansion loans | 40 | `SCHOOL_OWNER_FUNDING` | `CUSTOMERS`, `LEADS` |
| 9 | `Institutional_College_Funding` | University & private college funding | 40 | `INSTITUTIONAL_COLLEGE_FUNDING` | `CUSTOMERS`, `LEADS` |

---

### 2. LEAD SOURCE ATTRIBUTION CHANNELS

The audited lead generation sources originate from the following distinct marketing channels:

1. **Meta Lead Ads (`META_LEAD_AD`):** Direct Facebook and Instagram instant lead forms configured via Meta Graph API and ChatMitra webhook.
2. **Website Marketing Portal (`WEBSITE`):** Lead queries submitted via `https://www.avanifinserv.com` contact and eligibility forms.
3. **Partner / Builder Outreach (`PARTNERSHIP_PORTAL`):** MahaRERA developer networks submitting homebuyer referrals.
4. **Institutional Research (`INSTITUTIONAL_OUTREACH`):** Trust and educational society direct contact pipelines.
5. **AI Telecalling Channels (`AI_TELECALLING`):** Inbound and scheduled AI telephonic consultations logged via VAPI and ChatMitra.

---

### 3. FIELD PROFILES ACROSS INVENTORIED SHEETS

| Source Channel | Contact Fields | Financial Fields | Status / Workflow Fields |
|---|---|---|---|
| **Meta Lead Ads** | `fullName`, `mobile`, `email`, `city` | `loanProduct`, `loanAmount`, `monthlyIncome` | `status` (`NEW`, `DUPLICATE`), `firstTouchDate`, `lastTouchDate` |
| **Website Portal** | `Name`, `Phone`, `Email`, `City` | `Loan_Type`, `Amount`, `Employment` | `Status`, `Timestamp`, `AI_Call_ID` |
| **Education DB** | `Institution Name`, `Owner / Founder Name`, `Professional Mobile` | `Potential Funding Requirement`, `Funding Category` | `Lead Quality Score`, `Response Status`, `Follow-up Date` |
| **Builder DB** | `Company Name`, `Decision-Maker Name`, `Business Mobile` | `Residential Segment`, `Commercial Suitability` | `Final Outreach Status`, `V3.1 Grade`, `Score` |
