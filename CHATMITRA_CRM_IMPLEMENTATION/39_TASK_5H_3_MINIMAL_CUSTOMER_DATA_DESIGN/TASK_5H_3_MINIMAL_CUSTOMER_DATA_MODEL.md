# TASK 5H.3 — MINIMAL CUSTOMER-DATA MODEL SPECIFICATION
## RECOMMENDED LEAN BSON DATA MODEL FOR MONGODB ATLAS M0 (512 MB FREE TIER)
### AVANI LOAN SERVICES — ChatMitra + AVANI AI CRM

**Date:** 18 November 2026 (`2026-11-18`)  
**Execution Mode:** Read-Only Architectural Design Recommendation  
**Governance Note:** *These are design recommendations for operating safely within MongoDB Atlas M0 Free constraints, NOT authorization or permission to alter the existing production schema during Task 5H.3.*

---

### 1. DESIGN PRINCIPLES FOR M0 MINIMAL CUSTOMER-DATA STORAGE

1. **Structured BSON Scalar Fields Only:** Store compact strings, numbers, booleans, dates, and fixed enums.
2. **Zero File, Attachment, or Raw Payload Storage:** Never store PDFs, images, audio recordings, Aadhaar/PAN scans, salary slips, property documents, Base64 blobs, GridFS chunks, or raw provider webhook JSON (`Mixed`) in MongoDB.
3. **Single Source of Truth per Entity:** Eliminate duplicate storage of the same customer profile across `Lead`, `Contact`, `Conversation`, and `Message`.
4. **Bounded / Fixed-Size Documents:** Avoid unbounded embedded arrays (`stageHistory[]`, `interactions[]`, `webhookPayloads[]`, `auditLog[]`). Keep per-customer BSON document size predictable and compact.

---

### 2. RECOMMENDED MINIMAL ENTITY SCHEMAS (SECTION D)

#### ENTITY 1: CUSTOMER / LEAD (`leads` — ~420 Bytes / Record)
Replaces the current 110+ field (~6.5 KB) `Lead` document and redundant `Contact` duplication with **11 essential fields**:

| Field Name | BSON Type | Required | Index | Purpose & Constraint |
| :--- | :--- | :---: | :---: | :--- |
| `customerId` (`leadId`) | `String` (18B) | **Yes** | **Unique** | Canonical business ID (`AVL-YYYYMMDD-XXXXXX`). |
| `name` | `String` ($\le 80$B) | **Yes** | None | Customer full name (single normalized field; drop duplicate `firstName`/`lastName`). |
| `mobileNumber` (`phone`) | `String` (13B) | **Yes** | **Unique** | E.164 normalized mobile (`+91XXXXXXXXXX`; drop duplicate `normalizedMobile`). |
| `city` | `String` ($\le 40$B) | No | None | Customer city/district in Maharashtra/India. |
| `enquirySource` (`leadSource`) | `String` ($\le 24$B) | **Yes** | None | Single source enum (`WHATSAPP_INBOUND`, `WEBSITE_FORM`, `META_LEAD_AD`, `MANUAL`). |
| `loanCategory` (`loanType`) | `String` ($\le 32$B) | **Yes** | None | Canonical loan product (`Home Loan`, `Doctor Loan`, `Business Loan`, `Personal Loan`, `LAP`, `Education Loan`, `Institutional Funding`). |
| `requestedLoanAmount` | `Number` (8B) | No | None | Numeric requested amount in INR (drop duplicate string `requestedAmount` & `financialProfile`). |
| `leadStatus` (`stage`) | `String` ($\le 28$B) | **Yes** | **Indexed** | Current canonical pipeline stage/status. |
| `assignedAdvisor` | `String` (16B) | **Yes** | **Indexed** | Assigned `advisorId` reference (e.g., `'ADV-SACHIN-01'`; drop embedded advisor email/phone repetition on every lead). |
| `createdAt` | `Date` (8B) | **Yes** | None | Initial enquiry timestamp. |
| `updatedAt` | `Date` (8B) | **Yes** | **Indexed** | Last activity timestamp for dashboard sorting. |

---

#### ENTITY 2: LOAN APPLICATION (`applications` or Embedded `Lead.application` — ~280 Bytes / Record)
Stores only structured qualification and lender coordination progress (zero uploaded documents or bank account numbers):

| Field Name | BSON Type | Required | Index | Purpose & Constraint |
| :--- | :--- | :---: | :---: | :--- |
| `applicationId` | `String` (18B) | **Yes** | **Unique** | Canonical application reference (`APP-YYYYMMDD-XXXXXX`). |
| `customerId` (`leadId`) | `String` (18B) | **Yes** | **Indexed** | Foreign key reference to Customer/Lead. |
| `loanCategory` | `String` ($\le 32$B) | **Yes** | None | Product category being processed. |
| `requestedAmount` | `Number` (8B) | **Yes** | None | Requested loan amount in INR. |
| `employmentCategory` | `String` ($\le 28$B) | No | None | Enum (`Salaried`, `Self Employed`, `Business Owner`, `Doctor`, `CA`, `Other`). |
| `applicationStage` | `String` ($\le 24$B) | **Yes** | **Indexed** | Enum (`PREPARING`, `SUBMITTED`, `IN_REVIEW`, `SANCTIONED`, `DISBURSED`, `REJECTED`, `CLOSED`). |
| `lenderCoordinationStatus` | `String` ($\le 32$B) | No | None | Partner lender code & status (e.g., `LEN-HDFC-01: IN_REVIEW`). |
| `followUpDate` | `Date` (8B) | No | **Indexed** | Next scheduled advisor follow-up timestamp. |
| `updatedAt` | `Date` (8B) | **Yes** | None | Last stage update timestamp. |

---

#### ENTITY 3: CONSENT & OPT-OUT (`consents` or Embedded on `Lead` — ~160 Bytes / Record)
Maintains full DPDP Act 2023 and WhatsApp opt-out compliance (including Task 3B Hindi `रोकें` protection):

| Field Name | BSON Type | Required | Index | Purpose & Constraint |
| :--- | :--- | :---: | :---: | :--- |
| `customerId` (`leadId`) | `String` (18B) | **Yes** | **Unique** | Links 1:1 to Customer/Lead. |
| `consentStatus` | `String` (10B) | **Yes** | None | Enum (`GRANTED`, `DENIED`, `WITHDRAWN`, `PENDING`). |
| `consentTimestamp` | `Date` (8B) | **Yes** | None | Timestamp when consent or withdrawal occurred. |
| `consentSource` | `String` ($\le 28$B) | **Yes** | None | Source (`WHATSAPP_INBOUND`, `WEB_CHECKBOX`, `USER_OPTOUT_KEYWORD`). |
| `optOutStatus` (`isOptedOut`) | `Boolean` (1B) | **Yes** | **Indexed** | Hard suppression boolean (`true` blocks all outbound WhatsApp/Voice). |
| `optedOutAt` | `Date` (8B) | No | None | Timestamp of opt-out trigger. |

---

#### ENTITY 4: MESSAGE LOG (`messages` — ~320 Bytes / Record)
Replaces the current ~1.8 KB `Message` record by dropping `media: Mixed`, `providerResponse: Mixed`, `templateParams: Mixed`, and duplicate phone numbers:

| Field Name | BSON Type | Required | Index | Purpose & Constraint |
| :--- | :--- | :---: | :---: | :--- |
| `customerId` (`leadId`) | `String` (18B) | **Yes** | **Indexed** | Links message to Customer/Lead. |
| `providerMessageId` | `String` ($\le 48$B) | **Yes** | **Unique** | Single deduplication & provider tracking ID (replaces 3 duplicate ID fields). |
| `direction` | `String` (8B) | **Yes** | None | `'inbound'` or `'outbound'`. |
| `messageType` | `String` ($\le 24$B) | **Yes** | None | `'TEXT'`, `'TEMPLATE:<name>'`, or `'BUTTON_REPLY'`. |
| `deliveryStatus` (`status`) | `String` ($\le 16$B) | **Yes** | None | `'QUEUED'`, `'SENT'`, `'DELIVERED'`, `'READ'`, `'RECEIVED'`, `'FAILED'`. |
| `content` (`text`) | `String` ($\le 240$B) | No | None | Minimal sanitized message text ($\le 240$ chars; PAN/Aadhaar patterns redacted; zero attachments). |
| `timestamp` (`createdAt`) | `Date` (8B) | **Yes** | **Indexed** | Message creation/receipt timestamp. |

---

### 3. STRICTLY PROHIBITED FIELDS & DATA CATEGORIES (SECTION B & D)

The following items must **never** be stored in any MongoDB Atlas M0 collection:

| Prohibited Category | Specific Examples Blocked from MongoDB |
| :--- | :--- |
| **1. Identification Documents & KYC Numbers** | Full Aadhaar numbers (12 digits), PAN card scans/numbers, Passport numbers, Voter IDs, Driving Licenses, Medical Council certificates. |
| **2. Banking & Financial Instruments** | Full bank account numbers, IFSC codes, netbanking credentials, UPI PINs, credit/debit card numbers, raw bank statement PDFs/CSVs, ITR PDFs, salary slips. |
| **3. Property & Legal Deeds** | Sale agreements, Index-II copies, 7/12 extracts, title deeds, valuation report PDFs, construction blueprints. |
| **4. Binary, Media & File Payloads** | PDFs, JPEGs/PNGs, WhatsApp audio/video/document media blobs, call recording audio files, GridFS buckets (`fs.files`/`fs.chunks`), Base64-encoded strings. |
| **5. Raw Unbounded Provider Payloads** | Full raw webhook JSON bodies (`WebhookInbox.payload`), raw HTTP response dumps (`Message.providerResponse`, `Call.providerResponse`), and voice call webhook arrays (`Call.webhookPayloads[]`). |
