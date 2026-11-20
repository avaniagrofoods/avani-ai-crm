# 09 — LIVE LEAD SOURCE MAPPING REPORT
## LIVE LEAD GENERATION INGESTION & CANONICAL LOAN CATEGORY MAPPING

**Document Version:** 1.0.0  
**Date:** 2026-11-19T17:15:00+05:30  
**Classification:** STRICT AUDIT EVIDENCE — INTERNAL OPERATIONAL CONTROL  
**Author:** Senior CRM Data Migration Architect & Lead Integration Engineer  

---

### 1. LIVE LEAD DATA SOURCES INVENTORIED

The AVANI LOAN SERVICES lead ecosystem reconciles 417 candidate records across three data repositories:
1. **Meta Lead Ads & Website Portal:** `uploads/central_leads.json` (257 records).
2. **Institutional Education Funding Database:** `Secured_Funding_Prospects_Database.csv` (80 records).
3. **Builder & Housing Referral Database:** `Maharashtra_Builder_Master_Database_V3_1.csv` (80 records).

---

### 2. NINE CANONICAL LOAN CATEGORIES TAXONOMY

All raw incoming lead products map strictly into one of the 9 authorized loan categories:

| # | Canonical Category Code | Business Product Name | Source Mapping Rule | Example Ticket Size |
|---|---|---|---|---|
| 1 | `PERSONAL_LOAN` | Personal / Salary Loan | `Personal / Salary Loan`, `Personal Loan` | ₹50,000 – ₹15,00,000 |
| 2 | `BUSINESS_LOAN` | Business / MSME Loan | `Business Loan`, `MSME Working Capital` | ₹5,00,000 – ₹50,00,000 |
| 3 | `DOCTOR_MEDICAL_LOAN` | Doctor / Medical Professional | `Medical_Loan_Leads`, Doctor Database | ₹10,00,000 – ₹1,00,00,000 |
| 4 | `HOME_LOAN` | Home Loan / Housing Finance | `Home Loan`, Builder Project Referrals | ₹20,00,000 – ₹5,00,00,000 |
| 5 | `MORTGAGE_LAP` | Mortgage / Loan Against Property | `Loan Against Property`, Commercial LAP | ₹25,00,000 – ₹10,00,00,000 |
| 6 | `EDUCATION_LOAN_INDIA` | Student Education Loan (India) | Domestic Higher Education Queries | ₹2,00,000 – ₹20,00,000 |
| 7 | `EDUCATION_LOAN_ABROAD` | Student Education Loan (Abroad) | Overseas Study Queries (US/UK/EU) | ₹15,00,000 – ₹75,00,000 |
| 8 | `SCHOOL_OWNER_FUNDING` | School Infrastructure Funding | K-12 School Owner Database | ₹50,00,000 – ₹5,00,00,000 |
| 9 | `INSTITUTIONAL_COLLEGE_FUNDING` | College & University Funding | Private University Campus Expansion | ₹2,00,00,000 – ₹25,00,00,000 |

---

### 3. CROSS-SYSTEM SOURCE-TO-CRM MAPPING RULES

```
Source Record
    │
    ├── Customer ID:       Deterministic Hash `CUST_<SHA256(E.164)>`
    ├── Customer Name:     Trimmed string, title case
    ├── Mobile Number:     E.164 normalized (`+91XXXXXXXXXX`)
    ├── City:              Cleaned alphanumeric city name
    ├── Enquiry Source:    Normalized source enum (`META_LEAD_AD`, `WEBSITE`, `PARTNER`)
    ├── Loan Category:     Mapped to 1 of 9 Canonical Category Codes
    ├── Requested Amount:  Cleaned numeric integer string
    ├── Lead Status:       `NEW` or `QUALIFIED`
    └── Assigned Advisor:  Default `ADV_SACHIN_01` (Chief Loan Advisor)
```

**Audit Verdict:** **STAGE C7 AND X1 COMPLETED AND VERIFIED.**
