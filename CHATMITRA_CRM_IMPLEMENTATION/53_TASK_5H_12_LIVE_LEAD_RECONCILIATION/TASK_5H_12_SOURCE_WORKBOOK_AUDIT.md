# TASK 5H.12 — SOURCE WORKBOOK AUDIT REPORT
## FORENSIC AUDIT OF AVANI LOAN SERVICES LEAD SOURCES & ARTIFACTS

**Document Version:** 1.0.0  
**Date:** 2026-11-19T16:55:00+05:30  
**Classification:** STRICT AUDIT EVIDENCE — INTERNAL OPERATIONAL CONTROL  
**Author:** Senior CRM Data Migration Architect & Google Sheets Integration Engineer  

---

### 1. AUDIT TARGET IDENTIFICATION

| Attribute | Forensic Value |
|---|---|
| **Live Lead Source Spreadsheet** | `AVANI LOAN SERVICE FY26-27` |
| **Google Drive Account** | `avaniloanservicelatur@gmail.com` |
| **Live Sheet URL** | `https://docs.google.com/spreadsheets/d/1iwWWEB3nJnboJv8nKteOni1bhNgdE-mLlhOhkNSg4Zw/edit?gid=911092140#gid=911092140` |
| **Associated Apps Script Endpoint** | `https://script.google.com/macros/s/AKfycbyoAmAabpO9PUDH-AXatZm5Td7pO9n5W00Eoh6TNIkPtjbQZiYrhAv27XgyMtJdBxchEg/exec` |
| **Local Lead Master Artifacts** | `uploads/central_leads.json`, `AVANI_LOAN_SERVICES_UNIFIED_PORTAL/02_Backups/...` |
| **Lead Format Ingestion Engine** | `backend/routes/leads.js` & `api/save-lead.js` |

---

### 2. SOURCE STRUCTURE & INVENTORY AUDIT

Forensic analysis of the lead generation infrastructure reveals three distinct data sources feeding into the AVANI LOAN SERVICES ecosystem:

#### Source Stream A: Meta Lead Ads & Central Ingestion Engine (`central_leads.json`)
- **Total Records:** 257 leads.
- **Channels:** Meta Lead Ads (`META_LEAD_AD`: 1), Website Direct Enquiries (`WEBSITE`: 256).
- **Core Schema Fields:** `leadId`, `secureToken`, `fullName`, `mobile`, `whatsapp`, `email`, `city`, `state`, `preferredLanguage`, `leadSource`, `platform`, `campaign`, `adSet`, `ad`, `form`, `landingPage`, `utmSource`, `utmMedium`, `utmCampaign`, `firstTouchDate`, `lastTouchDate`, `loanProduct`, `loanAmount`, `employmentType`, `monthlyIncome`, `businessTurnover`, `existingEmi`, `cibilStatus`, `status`, `priority`, `assignedTo`, `documentStatus`, `duplicateEvents`, `duplicateCount`.
- **Loan Products Captured:**
  - `Personal / Salary Loan`: 251 records
  - `Home Loan`: 3 records
  - `Business Loan`: 2 records
  - `Personal Loan`: 1 record
- **Primary Geographies:** Latur (131 records), Mumbai (125 records), Pune (1 record).
- **Quality Indicators:** Phone populated on 257/257 (100%), Email populated on 7/257 (2.7%), Names populated on 257/257 (100%).

#### Source Stream B: Institutional Education Funding Database (`Secured_Funding_Prospects_Database.csv` & `Unsecured_Funding_Prospects_Database.csv`)
- **Total Records:** 80 unique educational institutions.
- **Channels:** Institutional Research, Education Outreach.
- **Core Schema Fields:** `Lead ID`, `Institution Name`, `Institution Category`, `Subcategory`, `Board / Affiliation`, `Institution Ownership Type`, `Registration Details`, `Year Established`, `Student Capacity`, `Enrolment`, `Website`, `Official Email`, `Official Telephone`, `Complete Address`, `City`, `District`, `State`, `PIN Code`, `Owner / Founder Name`, `Primary Decision-Maker Designation`, `Professional Mobile`, `Public WhatsApp Number`, `Potential Funding Requirement`, `Funding Category`, `Secured Funding Potential`, `Unsecured Funding Potential`, `Collateral Category`, `Urgency`, `Quality Score`.
- **Target Categories:** School Owner Funding, College / University Infrastructure Funding, Student Education Loan Tie-ups.

#### Source Stream C: Builder & Real Estate Partnership Database (`Maharashtra_Builder_Master_Database_V3_1.csv`)
- **Total Records:** 80 verified developer/builder entities.
- **Channels:** MahaRERA verified registry, Builder Partnership Portal.
- **Core Schema Fields:** `Lead ID`, `Company Name`, `Brand Name`, `Primary City`, `Locality`, `Residential Segment`, `Website`, `Address`, `PIN Code`, `MahaRERA Registration`, `Projects`, `Legal Promoter Name`, `Decision-Maker Name`, `Designation`, `Telephone`, `Business Mobile`, `WhatsApp Number`, `Commercial Suitability`, `Score`, `Grade`.
- **Target Categories:** Home Loan Referrals, Project Financing, Mortgage / Loan Against Property (LAP).

---

### 3. DATA INTEGRITY & AUDIT FINDINGS

1. **Zero Source Modification:** All source files, live sheets, and local repositories remain completely untouched. Read-only audit principles were strictly maintained.
2. **PII and Over-Collection Risks:** The source Meta leads and eligibility engines captured sensitive financial attributes (e.g. `cibilStatus`, `monthlyIncome`, `employmentType`). These must NOT enter the CRM master sheets under the approved minimal data architecture.
3. **Traceability:** Original lead identifiers (`leadId`, `lid`, `ALS-2026-XXXX`, `ALS-MH-MUM-XXX`) provide 100% forensic traceability for upstream attribution.
