# AVANI LOAN SERVICES — OMNIDM AI CALLING INTEGRATION REPORT (SECTION 20)

- **Business Entity:** AVANI LOAN SERVICES (`https://www.avanifinserv.com/`)
- **Implementation Module:** [`src/lib/voice-provider.ts`](file:///c:/Users/ALPHA-1/Downloads/21MAY2026/SACHIN%20SHINDE%20DOCUMENTS/DEVELOPEMENT%20TOOLS/3-AVANI%20AI%20CRM/src/lib/voice-provider.ts) (`OmniDMVoiceProvider`, `CallAuditTrail`, `MAX_OMNIDM_RETRIES`)
- **Webhook Endpoint:** [`src/app/api/omnidim-webhook/route.ts`](file:///c:/Users/ALPHA-1/Downloads/21MAY2026/SACHIN%20SHINDE%20DOCUMENTS/DEVELOPEMENT%20TOOLS/3-AVANI%20AI%20CRM/src/app/api/omnidim-webhook/route.ts)
- **Automated Test Verification:** [`tests/test_cp25_master_chatbot_and_integrations.test.cjs`](file:///c:/Users/ALPHA-1/Downloads/21MAY2026/SACHIN%20SHINDE%20DOCUMENTS/DEVELOPEMENT%20TOOLS/3-AVANI%20AI%20CRM/tests/test_cp25_master_chatbot_and_integrations.test.cjs) (Tests 25 & 38 — PASS)

---

## 1. Call Trigger Scenarios & Multilingual Voice Context
- **Supported Trigger Scenarios:**
  1. High-intent website or WhatsApp lead qualification callback
  2. Missed WhatsApp follow-up reminder (when customer requested a call)
  3. Pending document checklist assistance
  4. Appointment confirmation with Chief Loan Advisor Sachin Shinde (`+91 72491 08474`)
- **Multilingual Voice Support:** Passes `language` (`en`, `mr`, `hi`), `loan_type`, and `customer_name` in the OmniDM `variables` context.

---

## 2. Mandatory Safety Controls & Guardrails

| Safety Control | Implementation in [`OmniDMVoiceProvider`](file:///c:/Users/ALPHA-1/Downloads/21MAY2026/SACHIN%20SHINDE%20DOCUMENTS/DEVELOPEMENT%20TOOLS/3-AVANI%20AI%20CRM/src/lib/voice-provider.ts#L50-L202) | Status |
|---|---|---|
| **1. Opt-Out / DND Suppression** | Blocks immediately if `isOptedOut === true` or `dndActive === true` (`error: 'CALL_SUPPRESSED_OPTED_OUT_OR_DND'`) | **PASS (Test 25)** |
| **2. Consent Verification** | Blocks immediately if `consentGranted === false` (`error: 'CALL_BLOCKED_MISSING_CONSENT'`) | **PASS (Test 25)** |
| **3. Retry Ceiling (`MAX_OMNIDM_RETRIES = 2`)** | Blocks repeated call attempts when `retryCount >= 2` (`error: 'CALL_BLOCKED_RETRY_LIMIT_EXCEEDED'`) | **PASS (Test 38)** |
| **4. Test Mode Standby (`OMNIDM_LIVE_ENABLED`)** | Remains in `TEST_MODE_STANDBY` unless `OMNIDM_LIVE_ENABLED=true` is explicitly set (`error: 'OMNIDM_TEST_MODE_ACTIVE'`) | **PASS (Test 25)** |
| **5. Single-Recipient Live Clamp** | Even if `OMNIDM_LIVE_ENABLED=true` and `PROVIDER_MODE=live`, clamps outbound calls exclusively to `919175635165` (`BLOCKED_UNAUTHORIZED_LIVE_RECIPIENT`) | **PASS (Verified)** |
| **6. Call Outcome & Transcript Parser** | [`OmniDMVoiceProvider.parseCallOutcome`](file:///c:/Users/ALPHA-1/Downloads/21MAY2026/SACHIN%20SHINDE%20DOCUMENTS/DEVELOPEMENT%20TOOLS/3-AVANI%20AI%20CRM/src/lib/voice-provider.ts#L180-L201) extracts `callOutcome` (`HUMAN_HANDOFF`, `OPT_OUT_REQUESTED`, `CALLBACK_REQUESTED`, `QUALIFIED`), `recordingUrl`, `summary`, and `advisorHandoff` boolean | **PASS (Test 25)** |
