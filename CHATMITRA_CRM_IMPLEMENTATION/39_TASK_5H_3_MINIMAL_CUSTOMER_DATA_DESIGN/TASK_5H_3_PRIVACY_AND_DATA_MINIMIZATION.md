# TASK 5H.3 — PRIVACY AND DATA MINIMIZATION SPECIFICATION
## DPDP ACT 2023 ALIGNMENT, ZERO-DOCUMENT STORAGE & ROLE-BASED ACCESS CONTROL
### AVANI LOAN SERVICES — ChatMitra + AVANI AI CRM

**Date:** 18 November 2026 (`2026-11-18`)  
**Execution Mode:** Strictly Read-Only Privacy & Security Specification  
**Maximum Cloud Cost:** **₹0.00 INR / $0.00 USD**

---

### 1. EIGHT MANDATORY PRIVACY & DATA MINIMIZATION CONTROLS (SECTION H)

| # | Section H Privacy Requirement | Technical Enforcement & Design Rule | Existing Code Reference (Untouched) | Audit Status |
| :-: | :--- | :--- | :--- | :---: |
| **1** | **No production customer data in tests** | All offline unit tests and future S45–S50 live M0 tests must use synthetic identifiers (`SYNTH_LEAD_001`–`005`, reserved telecom test block `+919999900001`–`+919999900005`, and `@example.invalid` domains). Importing `CP26_6` production backups into `avani_ai_crm_test` is prohibited. | `src/lib/db.ts` (`NON_PROD_DB_NAME = 'avani_ai_crm_test'`) | **ENFORCED** |
| **2** | **No real Aadhaar / PAN numbers in test records** | Sensitive KYC patterns (`\b[A-Z]{5}[0-9]{4}[A-Z]\b` for PAN; `\b[2-9]\d{3}\s?\d{4}\s?\d{4}\b` for Aadhaar) are intercepted by `detectSensitiveDataInChat()` and scrubbed by `sanitizeForLog()`. Neither production nor test MongoDB collections may store Aadhaar or PAN numbers. | `src/lib/consent-privacy.ts` (Lines 61–94, 217–226) | **ENFORCED** |
| **3** | **No real bank details** | Full bank account numbers, IFSC codes, credit/debit card numbers, netbanking PINs, UPI handles, and bank statement PDFs/CSVs are excluded from all MongoDB schemas. | Section D Minimal Customer-Data Model | **ENFORCED** |
| **4** | **No production database connection** | 7-Stage fail-closed pipeline in `src/lib/db.ts` blocks `rhpn2gh.mongodb.net` and `avani_ai_crm_prod` across URI, DNS-SRV seed hosts, post-connect driver topology, and reconnect listeners in all non-production profiles. | `src/lib/db.ts` (`SHA-256: A98D4B8A...`) | **ENFORCED** |
| **5** | **No customer data export** | No production customer records were queried, dumped, or exported during Task 5H.3. Read-only inspection was restricted strictly to static `.ts`/`.tsx` schema and route code. | Read-Only Execution Constraint (Section I) | **ENFORCED** |
| **6** | **No secrets in reports** | Zero passwords, JWT secrets, API keys, webhook secrets, or real MongoDB connection URIs appear in any Task 5H.3 deliverable. | Verified across all 9 deliverables in folder `39`. | **ENFORCED** |
| **7** | **Maintain existing consent and opt-out controls** | `src/lib/optout-engine.ts` (`SHA-256: 6856EA28...`, preserving Task 3B Hindi `रोकें` opt-out fix) and `consentStatus` / `isOptedOut` / `optedOutAt` fields are 100% preserved in the Minimal Customer-Data Model. | `src/lib/optout-engine.ts` & `src/lib/consent-privacy.ts` | **ENFORCED** |
| **8** | **Restrict customer data access according to business roles** | `requireAuth()`, `requireRole()`, and `canAccessLead()` in `src/lib/auth.ts` enforce server-side JWT session verification (`AuthSession` collection) so `ADMIN` sees all leads while `ADVISOR` sees only leads assigned to their email/ID. | `src/lib/auth.ts` & `src/models/AuthSession.ts` | **ENFORCED** |

---

### 2. FIELD-LEVEL PII CLASSIFICATION & MINIMIZATION POLICY

| Data Category | Permitted in Minimal M0 Model? | Minimization Rule |
| :--- | :---: | :--- |
| **Customer Name & E.164 Mobile (`name`, `phone`)** | **YES (Essential)** | Store once on `Lead` (`+91XXXXXXXXXX`); do not duplicate across `Message`, `Call`, and `Contact`. |
| **City, Loan Category & Requested Amount** | **YES (Essential)** | Store single scalar values (`city`, `loanType`, numeric `requiredLoanAmount`) for advisor qualification. |
| **Consent & Opt-Out Metadata** | **YES (Mandatory)** | Store `consentStatus`, `consentTimestamp`, `consentSource`, `isOptedOut`, `optedOutAt`. |
| **Aadhaar, PAN, Passport, Voter ID, Driving License** | **NO (Prohibited)** | Never store numbers or document scans in MongoDB. Redact automatically if sent in free-text chat. |
| **Bank Statements, Salary Slips, ITRs, Property Deeds** | **NO (Prohibited)** | Never upload or store files, Base64 blobs, or encrypted storage references in MongoDB. |
| **Full Raw Webhook Payloads (`WebhookInbox.payload`)** | **NO (Prohibited)** | Store only 64-byte SHA-256 `payloadHash` + `eventId` with a 7-day TTL index for deduplication. |
