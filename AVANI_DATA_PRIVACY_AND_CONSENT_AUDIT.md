# AVANI LOAN SERVICES — DATA PRIVACY, CONSENT & DOCUMENT SECURITY AUDIT (SECTION 22)

- **Business Entity:** AVANI LOAN SERVICES (`https://www.avanifinserv.com/`)
- **Implementation Modules:**
  - [`src/lib/consent-privacy.ts`](file:///c:/Users/ALPHA-1/Downloads/21MAY2026/SACHIN%20SHINDE%20DOCUMENTS/DEVELOPEMENT%20TOOLS/3-AVANI%20AI%20CRM/src/lib/consent-privacy.ts)
  - [`src/app/api/documents/secure-upload/route.ts`](file:///c:/Users/ALPHA-1/Downloads/21MAY2026/SACHIN%20SHINDE%20DOCUMENTS/DEVELOPEMENT%20TOOLS/3-AVANI%20AI%20CRM/src/app/api/documents/secure-upload/route.ts)
- **Automated Test Verification:** [`tests/test_cp25_master_chatbot_and_integrations.test.cjs`](file:///c:/Users/ALPHA-1/Downloads/21MAY2026/SACHIN%20SHINDE%20DOCUMENTS/DEVELOPEMENT%20TOOLS/3-AVANI%20AI%20CRM/tests/test_cp25_master_chatbot_and_integrations.test.cjs) (Tests 30, 31, 32, 33, 34 — PASS)

---

## 1. Consent Capture & Service vs. Marketing Separation (Sections 22.1 & 22.2)
- **Privacy Policy Version:** `AVANI-PRIVACY-2026.2` (`PRIVACY_POLICY_VERSION`).
- **Multilingual Privacy Notice:** Displayed at Step 1 of the chatbot in English, Marathi (`मराठी`), and Hindi (`हिंदी`).
- **Granular Consent Separation (`evaluateConsentAndOptOut`):**
  - `serviceConsent`: Required for loan eligibility assessment, document checklist guidance, and advisor callback.
  - `marketingConsent`: Strictly separate boolean; never assumed from service inquiry unless explicitly opted in.
- **Universal Opt-Out Keywords:** `STOP`, `UNSUBSCRIBE`, `DO NOT CONTACT`, `OPT OUT`, `REMOVE ME`, `DND`, `बंद करा`, `नको`, `बंद करें`.
- **6-Channel Suppression Matrix (`suppressedChannels`):**
  When opt-out is detected, `evaluateConsentAndOptOut` immediately suppresses all 6 channels:
  1. `WHATSAPP_CHATMITRA`
  2. `CRM_DRIP_FOLLOWUP`
  3. `HUBSPOT_MARKETING_SYNC`
  4. `GOOGLE_SHEETS_ACTIVE_QUEUE`
  5. `ZAPIER_OUTBOUND_WORKFLOW`
  6. `OMNIDM_AI_VOICE_CALL`

---

## 2. Sensitive Financial & KYC Document Protection (Section 22.3)

| Control Requirement | Implementation in [`src/lib/consent-privacy.ts`](file:///c:/Users/ALPHA-1/Downloads/21MAY2026/SACHIN%20SHINDE%20DOCUMENTS/DEVELOPEMENT%20TOOLS/3-AVANI%20AI%20CRM/src/lib/consent-privacy.ts) | Verification |
|---|---|---|
| **1. Sensitive Data Chat Interception** | [`detectSensitiveDataInChat`](file:///c:/Users/ALPHA-1/Downloads/21MAY2026/SACHIN%20SHINDE%20DOCUMENTS/DEVELOPEMENT%20TOOLS/3-AVANI%20AI%20CRM/src/lib/consent-privacy.ts#L106-L143) detects PAN (`[A-Z]{5}[0-9]{4}[A-Z]`), Aadhaar (12-digit), OTP, CVV, and password strings in plain chat and replies with a warning + signed upload portal URL. | **PASS (Test 32)** |
| **2. Signed & Expiring Upload Links** | [`generateSecureDocumentUploadLink`](file:///c:/Users/ALPHA-1/Downloads/21MAY2026/SACHIN%20SHINDE%20DOCUMENTS/DEVELOPEMENT%20TOOLS/3-AVANI%20AI%20CRM/src/lib/consent-privacy.ts#L145-L176) and [`verifySecureDocumentUploadToken`](file:///c:/Users/ALPHA-1/Downloads/21MAY2026/SACHIN%20SHINDE%20DOCUMENTS/DEVELOPEMENT%20TOOLS/3-AVANI%20AI%20CRM/src/lib/consent-privacy.ts#L178-L202) use HMAC-SHA256 (`timingSafeEqual`) with 72-hour expiration (`expiresInMinutes = 4320`). | **PASS (Test 34)** |
| **3. Encryption at Rest (AES-256-GCM)** | [`encryptDocumentReference`](file:///c:/Users/ALPHA-1/Downloads/21MAY2026/SACHIN%20SHINDE%20DOCUMENTS/DEVELOPEMENT%20TOOLS/3-AVANI%20AI%20CRM/src/lib/consent-privacy.ts#L228-L246) and [`decryptDocumentReference`](file:///c:/Users/ALPHA-1/Downloads/21MAY2026/SACHIN%20SHINDE%20DOCUMENTS/DEVELOPEMENT%20TOOLS/3-AVANI%20AI%20CRM/src/lib/consent-privacy.ts#L248-L266) encrypt document storage URIs using AES-256-GCM with random 96-bit IV and authentication tag (`enc:v1:...`). | **PASS (Test 34)** |
| **4. Role-Based Access Control (RBAC)** | [`canAccessDocumentRecord`](file:///c:/Users/ALPHA-1/Downloads/21MAY2026/SACHIN%20SHINDE%20DOCUMENTS/DEVELOPEMENT%20TOOLS/3-AVANI%20AI%20CRM/src/lib/consent-privacy.ts#L208-L226) restricts document access to `OWNER`, `CHIEF_ADVISOR`, `COMPLIANCE_AUDITOR`, or the specifically assigned `LOAN_ADVISOR`. `UNAUTHENTICATED` and `EXTERNAL_WEBHOOK` roles are strictly denied. | **PASS (Test 30)** |
| **5. Log & Export Redaction** | [`sanitizeForLog`](file:///c:/Users/ALPHA-1/Downloads/21MAY2026/SACHIN%20SHINDE%20DOCUMENTS/DEVELOPEMENT%20TOOLS/3-AVANI%20AI%20CRM/src/lib/consent-privacy.ts#L268-L277) redacts Bearer tokens (`Bearer [REDACTED]`), PAN (`[PAN_REDACTED]`), and Aadhaar (`[AADHAAR_REDACTED]`) from logs and Google Sheets exports. | **PASS (Test 33)** |
| **6. Consented Education Loan References** | Education Loan reference contacts (2 references) are explicitly marked *"Collected strictly with prior notice and consent of the applicant and reference persons"* in [`src/lib/loan-checklists.ts`](file:///c:/Users/ALPHA-1/Downloads/21MAY2026/SACHIN%20SHINDE%20DOCUMENTS/DEVELOPEMENT%20TOOLS/3-AVANI%20AI%20CRM/src/lib/loan-checklists.ts#L162-L169). | **PASS (Test 9)** |
