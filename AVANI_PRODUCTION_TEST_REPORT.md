# AVANI LOAN SERVICES — CP-25 PRODUCTION TEST & REGRESSION REPORT (SECTION 25)

- **Business Entity:** AVANI LOAN SERVICES (`https://www.avanifinserv.com/`)
- **Reconciliation Runner:** [`scratch/reconcile_tests.cjs`](file:///c:/Users/ALPHA-1/Downloads/21MAY2026/SACHIN%20SHINDE%20DOCUMENTS/DEVELOPEMENT%20TOOLS/3-AVANI%20AI%20CRM/scratch/reconcile_tests.cjs)
- **CP-25 Master Test Suite:** [`tests/test_cp25_master_chatbot_and_integrations.test.cjs`](file:///c:/Users/ALPHA-1/Downloads/21MAY2026/SACHIN%20SHINDE%20DOCUMENTS/DEVELOPEMENT%20TOOLS/3-AVANI%20AI%20CRM/tests/test_cp25_master_chatbot_and_integrations.test.cjs)
- **Total Suites Executed:** `17`
- **Total Tests Executed:** `251`
- **Total Passed:** `251` (`100.0% PASS`)
- **Total Failed:** `0`

---

## 1. Master 17-Suite Regression Table

| # | Test Suite File | Scope / Category | Passed | Failed | Total | Status |
|---|---|---|---|---|---|---|
| 1 | `test_audit_evidence_integrity.test.cjs` | Unit / Guard Integrity | 23 | 0 | 23 | **PASS** |
| 2 | `test_gate3_synthetic_safety.test.cjs` | Unit / Synthetic Safety | 5 | 0 | 5 | **PASS** |
| 3 | `test_chatmitra_migration.test.cjs` | Mock Integration / Provider Adapter | 12 | 0 | 12 | **PASS** |
| 4 | `test_chatmantra_integration.test.cjs` | Mock Integration / Webhook & Safety | 23 | 0 | 23 | **PASS** |
| 5 | `test_gate4_isolated_staging_safety.test.cjs` | Mock Integration / State Lifecycle | 8 | 0 | 8 | **PASS** |
| 6 | `test_gate5_staging_configuration.test.cjs` | Staging Integration / Config Guards | 12 | 0 | 12 | **PASS** |
| 7 | `test_stage4_mongodb_application_integration.test.cjs` | Staging Integration / DB Guards | 8 | 0 | 8 | **PASS** |
| 8 | `test_master_automation_workflows.test.cjs` | End-to-End Master Workflow Automation | 14 | 0 | 14 | **PASS** |
| 9 | `test_authorized_test_contact_validation.test.cjs` | Phase 6 Test Contact Validation (`+91 91756 35165`) | 7 | 0 | 7 | **PASS** |
| 10 | `test_drip_workflow_and_api_endpoints.test.cjs` | Drip Workflow & Sidebar Endpoints Integration | 8 | 0 | 8 | **PASS** |
| 11 | `test_webhook_signature_forensics.test.cjs` | Webhook Signature Forensics & Provider Discrimination | 11 | 0 | 11 | **PASS** |
| 12 | `test_chatmitra_webhook_live_contract.test.cjs` | ChatMitra Webhook Live Contract & Deduplication | 7 | 0 | 7 | **PASS** |
| 13 | `test_inbound_message_persistence_and_crm_inbox.test.cjs` | Inbound Message Persistence & CRM Inbox | 12 | 0 | 12 | **PASS** |
| 14 | `test_cp21_automation_and_entitlements.test.cjs` | CP-21 ChatMitra Pro Automation & Entitlements | 15 | 0 | 15 | **PASS** |
| 15 | `test_cp22_pre_pro_automation_readiness.test.cjs` | CP-22 Pre-Pro Automation Readiness & Defect Repair | 16 | 0 | 16 | **PASS** |
| 16 | `test_cp23_master_automation_readiness.test.cjs` | CP-23 Master Automation Readiness & Regression | 30 | 0 | 30 | **PASS** |
| 17 | `test_cp25_master_chatbot_and_integrations.test.cjs` | CP-25 Master Chatbot, Checklists, Privacy & Omnichannel Integrations | 40 | 0 | 40 | **PASS** |
| **TOTAL** | **17 Suites** | **Full End-to-End Regression** | **251** | **0** | **251** | **100% PASS** |

---

## 2. CP-25 40-Test Breakdown (`test_cp25_master_chatbot_and_integrations.test.cjs`)

### Category A — Chatbot & Checklists (Tests 1–10)
- **Test 1:** Chatbot Step 1 Welcome message & privacy notice presentation — **PASS**
- **Test 2:** Chatbot language selection (`English`, `मराठी`, `हिंदी`) — **PASS**
- **Test 3:** Chatbot Step 2 basic info collection order & mobile/email validation — **PASS**
- **Test 4:** Chatbot Step 2 applicant category options (`Salaried`, `Self Employed`, `Business Owner`, `Professional`) — **PASS**
- **Test 5:** Chatbot Step 3 monthly income options (5 options including `Prefer to discuss with an advisor`) — **PASS**
- **Test 6:** Chatbot Step 4 loan requirement (all 11 options) — **PASS**
- **Test 7:** Chatbot Step 4 required funding amount & `INR` currency assignment — **PASS**
- **Test 8:** Multi-branch checklist composition (Doctor + Home Loan, Salaried + Home Loan, Business Owner + Personal Loan) — **PASS**
- **Test 9:** Education Loan checklists (India vs Abroad, Salaried/Self-Employed/Farmer/Pension/Rental Co-Applicant) — **PASS**
- **Test 10:** Chatbot Human Advisor Handoff & non-lender disclaimer enforcement — **PASS**

### Category B — CRM (Tests 11–18)
- **Test 11:** CRM E.164 & ChatMitra phone normalization — **PASS**
- **Test 12:** CRM duplicate contact & lead upsert key consistency — **PASS**
- **Test 13:** ChatMitra Pro 17 canonical tags & 20 custom attributes ceiling enforcement — **PASS**
- **Test 14:** Conversation schema stages & state progression — **PASS**
- **Test 15:** Message persistence canonical uppercase status normalization — **PASS**
- **Test 16:** Multilingual 10-category loan classification (English, Marathi, Hindi) — **PASS**
- **Test 17:** Admin & Advisor Dashboard KPI route and 7-dimension filter builder — **PASS**
- **Test 18:** Advisor assignment & incomplete application handoff summary — **PASS**

### Category C — Integrations (Tests 19–26)
- **Test 19:** ChatMitra inbound webhook HMAC-SHA256 verification over raw body — **PASS**
- **Test 20:** ChatMitra outbound message mock mode & single-recipient safety clamp (`919175635165`) — **PASS**
- **Test 21:** Meta WhatsApp webhook security & provider discrimination — **PASS**
- **Test 22:** HubSpot sync payload builder & opt-out suppression — **PASS**
- **Test 23:** Google Sheets 14 recommended tabs & 19 standardized columns — **PASS**
- **Test 24:** Zapier integration idempotency & circular-automation prevention — **PASS**
- **Test 25:** OmniDM AI Calling integration (test mode standby, DND/consent guards, outcome parser) — **PASS**
- **Test 26:** AVANI AI Agent non-guarantee guardrail & structured audit record — **PASS**

### Category D — Security & Consent (Tests 27–34)
- **Test 27:** Security: Invalid HMAC signature rejected — **PASS**
- **Test 28:** Security: Missing HMAC signature rejected — **PASS**
- **Test 29:** Security: Duplicate webhook event deduplication key determinism — **PASS**
- **Test 30:** Security: Role-based document access control (RBAC) — **PASS**
- **Test 31:** Security: Service vs Marketing consent separation & opt-out suppression across all 6 channels — **PASS**
- **Test 32:** Security: Sensitive KYC / OTP interception in ordinary WhatsApp chat — **PASS**
- **Test 33:** Security: Sensitive data log sanitizer redacts PAN, Aadhaar, and tokens — **PASS**
- **Test 34:** Security: Signed document upload token verification, expiry & AES-256-GCM encryption at rest — **PASS**

### Category E — Failure & Reliability (Tests 35–40)
- **Test 35:** Reliability: Queue worker atomic lease claim supports `FAILED` and expired `PROCESSING` retries — **PASS**
- **Test 36:** Reliability: Failed provider request graceful error handling without crash — **PASS**
- **Test 37:** Reliability: Database unavailable fail-closed `HTTP 503` on webhooks and worker — **PASS**
- **Test 38:** Reliability: OmniDM retry limit guard blocks calls exceeding `MAX_OMNIDM_RETRIES` — **PASS**
- **Test 39:** Reliability: Duplicate delivery receipt idempotent event ID construction — **PASS**
- **Test 40:** Reliability: Out-of-order delivery status monotonicity guard prevents status regression — **PASS**
