# 01 — CANONICAL PROJECT BASELINE
## AUTHORITATIVE FORENSIC BASELINE & ASSET RECONCILIATION

**Document Version:** 1.0.0  
**Date:** 2026-11-19T17:15:00+05:30  
**Classification:** STRICT AUDIT EVIDENCE — INTERNAL OPERATIONAL CONTROL  
**Author:** Lead Technical Architect & Systems Auditor  

---

### 1. FORENSIC WORKSPACE SCOPE & DIRECTORY BOUNDARIES

The operational scope of the AVANI LOAN SERVICES ecosystem is strictly restricted to two directories:

```
[PROJECT 1 — Business Documents & Forensic Records]
Path: C:\Users\ALPHA-1\Downloads\21MAY2026\SACHIN SHINDE DOCUMENTS\DEVELOPEMENT TOOLS\1-AVANI LOAN SERVICE FY 26-27
Role: Documentation, Business Requirements, SOPs, Historical Research, Backups, Forensic Reports.
Rule: Zero application source code modifications.

[PROJECT 2 — Application Source Code & Test Engine]
Path: C:\Users\ALPHA-1\Downloads\21MAY2026\SACHIN SHINDE DOCUMENTS\DEVELOPEMENT TOOLS\3-AVANI AI CRM
Role: Full-stack application codebase (Next.js 16 + React 19 + TypeScript + Google Sheets CRM client).
Git:  https://github.com/avaniagrofoods/avani-ai-crm.git (main branch)
Rule: Zero general business documentation dumping; technical docs only.
```

---

### 2. BASELINE INVENTORY ACROSS HISTORICAL WORKSTREAMS

Forensic analysis of the workspaces confirms the following asset baseline:

#### A. Maharashtra Builder Database & Partnership System (Project A)
- **Primary Source Files:**
  - `AVANI_LOAN_SERVICES_UNIFIED_PORTAL/02_Backups/V3_1_Deliverables/Maharashtra_Builder_Master_Database_V3_1.csv`
  - `AVANI_LOAN_SERVICES_UNIFIED_PORTAL/02_Backups/V3_1_Deliverables/CRM_Accounts_V3_1.xlsx`
  - `AVANI_LOAN_SERVICES_UNIFIED_PORTAL/02_Backups/V3_1_Deliverables/CRM_Contacts_V3_1.xlsx`
  - `v3_1_records_processed.json` (80 records)
- **Verified Entities:** 80 active developers/promoters across Mumbai, Pune, Thane, Navi Mumbai, Nashik, Nagpur, Aurangabad, Kolhapur, Solapur, and Latur.
- **RERA Parity:** 70 verified MahaRERA matches with official registration numbers.
- **Decision-Maker Coverage:** 52 verified high-priority decision-makers (MDs, CEOs, Promoter Partners).
- **CRM Pipeline:** 19-stage Builder Partnership pipeline implemented in historical modules.

#### B. Education Institutional Funding System (Project B)
- **Primary Source Files:**
  - `AVANI_LOAN_SERVICES_UNIFIED_PORTAL/02_Backups/Education_Original/04_Funding_Prospect_Database/Secured_Funding_Prospects_Database.csv` (79 rows)
  - `AVANI_LOAN_SERVICES_UNIFIED_PORTAL/02_Backups/Education_Original/04_Funding_Prospect_Database/Unsecured_Funding_Prospects_Database.csv` (80 rows)
  - `AVANI_LOAN_SERVICES_UNIFIED_PORTAL/02_Backups/Education_Original/05_CRM_Import_Files/CRM_Ready_Import_Contacts.csv` (80 rows)
  - `AVANI_LOAN_SERVICES_UNIFIED_PORTAL/02_Backups/Education_Original/02_Maharashtra_Database/Maharashtra_Education_Institutional_Funding_Database.csv` (40 rows)
- **Verified Entities:** 80 unique educational institutions (Schools, Colleges, Universities, Trusts).
- **Prospecting Pipeline:** Estimated ₹661.50 Cr potential funding requirement (qualified as prospecting potential, not sanctioned loans).
- **Decision-Maker Coverage:** 54 verified managing trustees, chairpersons, and finance heads.
- **Pipeline Structure:** Reconciled from 16-stage tracker into canonical 24-stage institutional lifecycle.

#### C. AVANI Loan Services Unified Business Portal (Project C)
- **Domain:** `https://www.avanifinserv.com`
- **Application Stack:** Next.js frontend & backend API, document parsing OCR (`pdf-parse`, `tesseract.js`), Excel export engine (`exceljs`), HubSpot CRM sync, Google Sheets synchronization.
- **RBAC Matrix:** 6 operational user roles (`CHIEF_LOAN_ADVISOR`, `LOAN_ADVISOR`, `OPERATIONS_EXECUTIVE`, `BUILDER_PARTNER_DESK`, `INSTITUTIONAL_DESK`, `SUPER_ADMIN`).
- **Core Endpoints:** `/eligibility`, `/api/eligibility/process`, `/api/leads`, `/api/health`.

#### D. Google Sheets CRM Architecture (Project D)
- **Master Spreadsheet (Isolated Test):** `AVANI_AI_CRM_ISOLATED_TEST` (ID: `1onRvXrdwiEYwLxCMYnHjRiJ4FtOri1Hs74LC...`)
- **Apps Script Gateway Project:** `AVANI_AI_CRM_TEST_GATEWAY` (v2 Web App deployed)
- **Gateway Script URL:** `https://script.google.com/macros/s/AKfycbwadPvvLiVgLOUbIcnQm7ZeLEOsh1bamEYVJKi11ub8fZc-EAVugAv2WvgfTc5Izg7A4w/exec`
- **Schema Parity:** 9 canonical tabs (`CUSTOMERS`, `LEADS`, `APPLICATIONS`, `FOLLOWUPS`, `CONSENTS`, `MESSAGE_EVENTS`, `WEBHOOK_EVENTS`, `ADVISORS`, `SYSTEM_CONFIG`).
- **Database Isolation:** Zero fallback to MongoDB for customer data.

#### E. Live Lead Source Reconciliation (Project E)
- **Live Lead Source Sheet:** `AVANI LOAN SERVICE FY26-27` (`1iwWWEB3nJnboJv8nKteOni1bhNgdE-mLlhOhkNSg4Zw`)
- **Source Lead Master File:** `uploads/central_leads.json` (257 Meta/Web leads)
- **Deduplication Engine:** Deterministic E.164 phone hashing + category cross-referencing.
- **Synthetic Test Quarantine:** 9 synthetic records imported idempotently into the isolated test sheet. Zero live PII ingested.
