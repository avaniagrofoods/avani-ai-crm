# AVANI AI CRM — CP-26.2 GATE 2: TEST SUITE CLASSIFICATION REPORT

**Milestone:** CP-26.2 Final Data-Integrity & Revenue Acceptance  
**Baseline Commit:** `cae0393`  
**Command Verified:** `node scratch/reconcile_tests.cjs` -> **Exit Code 0** (22 suites, **335/335 passed**, **0 failed**)  
**Classification Scope:** All 335 active tests executed by `scratch/reconcile_tests.cjs`, plus 2 standalone staging scripts not wired into the 22-suite runner.

---

## 1. Executive Summary & Honest Gap Disclosure

**Do the 335 passing baseline tests prove live production MongoDB writes?**  
**No.** None of the 335 tests connect to the production MongoDB database (`avani_ai_crm_prod`) or even to the isolated staging MongoDB database (`avani_ai_crm_test`). Of the 335 tests:
- **89 tests (26.6%)** are static AST/regex source-file contract checks reading local `.ts`/`.tsx` files.
- **159 tests (47.5%)** are pure in-memory JavaScript/TypeScript unit assertions.
- **42 tests (12.5%)** are hybrid unit + static source-file checks.
- **45 tests (13.4%)** invoke Next.js API route handlers directly in-process against mocked Mongoose models/in-memory stubs—never hitting an actual MongoDB server or running Next.js HTTP server.
- **0 of 335 tests** verify true database write -> read-back persistence against MongoDB Atlas (`avani_ai_crm_test` or `avani_ai_crm_prod`).

To close that exact evidence gap without touching production data, CP-26.2 Gate 4 & Gate 5 executed a separate **14-step live HTTP end-to-end persistence harness** against a real compiled `next start` server wired strictly to isolated Atlas staging DB `avani_ai_crm_test` (documented in `CP26_2_SYNTHETIC_WRITE_READBACK.md` and `CP26_2_DASHBOARD_METRICS_AUDIT.md`).

---

## 2. Classification Counts Across All 335 Baseline Tests

### A. By Requested Test Discipline
| Discipline | Baseline (`reconcile_tests.cjs`) Count | % of 335 | CP-26.2 Added Verification |
|---|---:|---:|---|
| **Unit tests** (Pure In-Memory + Static Source Contracts) | **248** (159 Pure Unit + 89 Static Contracts) | 74.0% | Re-run after fixes (248/248 PASS) |
| **Hybrid unit + static contract tests** | **42** | 12.5% | Re-run after fixes (42/42 PASS) |
| **Mocked API / Integration tests** (In-process route handler + mocked Mongoose) | **45** | 13.4% | Re-run after fixes (45/45 PASS) |
| **Real Database persistence tests (against MongoDB)** | **0** *(of 335)* | 0.0% | **+14 HTTP E2E steps** on `avani_ai_crm_test` (Gate 4/5 PASS) |
| **Real HTTP API tests (against running Next.js server)** | **0** *(of 335)* | 0.0% | **+14 HTTP E2E steps + Dashboard Metrics check** (PASS) |
| **Browser UI E2E tests (Playwright/Chrome)** | **0** *(of 335)* | 0.0% | Browser UI E2E automation NOT RUN in CP-26.2 |
| **Total Active Runner Tests** | **335** | **100.0%** | **335/335 PASS post-fix** |

### B. By Storage / Database Target
| Storage / Mock Mode | Test Count | Suites |
|---|---:|---:|
| `None (Static AST/Regex file inspection)` | 89 | 5 |
| `In-Memory / Pure JS/TS` | 159 | 11 |
| `In-Memory / Pure TS Logic + Static file inspection` | 42 | 2 |
| `Mocked Mongoose Models (In-Memory)` | 45 | 4 |
| `Isolated Test MongoDB (avani_ai_crm_test)` *(Baseline runner)* | **0** | 0 |
| `Production MongoDB (avani_ai_crm_prod)` | **0** | 0 |

### C. By Authorization / Validation Coverage
- Suites containing at least one authorization, signature, safety-clamp, or validation-failure assertion: **19 of 22 suites** (300 tests in those suites).
- Individual test cases specifically asserting authorization, HMAC/token validation, DPDP/opt-out blocking, payload/phone rejection, or isolation failure: **136 of 335 tests**.
- Note: **0 of the 335 tests** test user-session RBAC on CRM API endpoints (`/api/leads*`, `/api/dashboard/metrics`, `/api/lenders`, `/api/advisors`) because Next.js route-level user authentication is not implemented on those routes (see `CP26_2_SECURITY_ACCEPTANCE.md`).

### D. Standalone Files Not Included in `scratch/reconcile_tests.cjs`
Two standalone staging verification scripts exist under `tests/` and were NOT counted among the 335 baseline tests:
1. `tests/test_staging_acceptance.test.cjs` — connects directly via Mongoose to `avani_ai_crm_test` (model-level CRUD, zero API routes).
2. `tests/test_staging_workflow_acceptance.test.cjs` — connects directly via Mongoose to `avani_ai_crm_test` (model-level workflow/cleanup, zero API routes).

---

## 3. Suite-Level Matrix (All 22 Active Suites = 335 Tests)

| # | Test File | Passed | Category | Storage / Mocks | Calls API Routes | Verifies Persisted After Update | Verifies Auth / Validation |
|---:|---|---:|---|---|---|---|---|
| 1 | `test_audit_evidence_integrity.test.cjs` | 23 | Static Source / Contract Verification Test | None (Static AST/Regex file inspection) | No | No | Yes |
| 2 | `test_authorized_test_contact_validation.test.cjs` | 7 | Unit Test | In-Memory / Pure JS/TS | No (Imports/Inspects source directly) | No (In-memory assertion only) | Yes |
| 3 | `test_chatmantra_integration.test.cjs` | 23 | Unit Test | In-Memory / Pure JS/TS | No (Imports/Inspects source directly) | No (In-memory assertion only) | Yes |
| 4 | `test_chatmitra_migration.test.cjs` | 12 | Static Source / Contract Verification Test | None (Static AST/Regex file inspection) | No | No | Yes |
| 5 | `test_chatmitra_webhook_live_contract.test.cjs` | 7 | Unit Test | In-Memory / Pure JS/TS | No (Imports/Inspects source directly) | No (In-memory assertion only) | Yes |
| 6 | `test_cp21_automation_and_entitlements.test.cjs` | 15 | Unit Test | In-Memory / Pure JS/TS | No (Imports/Inspects source directly) | No (In-memory assertion only) | Yes |
| 7 | `test_cp22_pre_pro_automation_readiness.test.cjs` | 16 | Unit Test | In-Memory / Pure JS/TS | No (Imports/Inspects source directly) | No (In-memory assertion only) | Yes |
| 8 | `test_cp23_master_automation_readiness.test.cjs` | 30 | Unit Test | In-Memory / Pure JS/TS | No (Imports/Inspects source directly) | No (In-memory assertion only) | Yes |
| 9 | `test_cp25_2_inbox_send_pipeline.test.cjs` | 20 | Static Source / Contract Verification Test | None (Static AST/Regex file inspection) | No | No | Yes |
| 10 | `test_cp25_3_1_production_audit_and_branding.test.cjs` | 22 | Static Source / Contract Verification Test | None (Static AST/Regex file inspection) | No | No | Yes |
| 11 | `test_cp25_3_2_live_acceptance.test.cjs` | 12 | Hybrid Unit + Static Contract Test | In-Memory / Pure TS Logic + Static file inspection | Yes (Direct handler import with mocks) | No (In-memory object state only) | Yes |
| 12 | `test_cp25_master_chatbot_and_integrations.test.cjs` | 40 | Mocked API Route Integration Test | Mocked Mongoose Models (In-Memory) | Yes (Invokes route handler functions with mock Request & mocked DB) | Mocked only (Verifies args passed to mock save/update) | Yes |
| 13 | `test_cp26_1_synthetic_workflows.test.cjs` | 10 | Hybrid Unit + Static Contract Test | In-Memory / Pure TS Logic + Static file inspection | No | No (In-memory object state only) | No |
| 14 | `test_cp26_lead_to_revenue_operations.test.cjs` | 20 | Hybrid Unit + Static Contract Test | In-Memory / Pure TS Logic + Static file inspection | Yes (Direct handler import with mocks) | No (In-memory object state only) | No |
| 15 | `test_drip_workflow_and_api_endpoints.test.cjs` | 8 | Unit Test | In-Memory / Pure JS/TS | No (Imports/Inspects source directly) | No (In-memory assertion only) | Yes |
| 16 | `test_gate3_synthetic_safety.test.cjs` | 5 | Mocked API Route Integration Test | Mocked Mongoose Models (In-Memory) | Yes (Invokes route handler functions with mock Request & mocked DB) | Mocked only (Verifies args passed to mock save/update) | No |
| 17 | `test_gate4_isolated_staging_safety.test.cjs` | 8 | Unit Test | In-Memory / Pure JS/TS | No (Imports/Inspects source directly) | No (In-memory assertion only) | Yes |
| 18 | `test_gate5_staging_configuration.test.cjs` | 12 | Static Source / Contract Verification Test | None (Static AST/Regex file inspection) | No | No | Yes |
| 19 | `test_inbound_message_persistence_and_crm_inbox.test.cjs` | 12 | Unit Test | In-Memory / Pure JS/TS | No (Imports/Inspects source directly) | No (In-memory assertion only) | Yes |
| 20 | `test_master_automation_workflows.test.cjs` | 14 | Unit Test | In-Memory / Pure JS/TS | No (Imports/Inspects source directly) | No (In-memory assertion only) | Yes |
| 21 | `test_stage4_mongodb_application_integration.test.cjs` | 8 | Unit Test | In-Memory / Pure JS/TS | No (Imports/Inspects source directly) | No (In-memory assertion only) | Yes |
| 22 | `test_webhook_signature_forensics.test.cjs` | 11 | Unit Test | In-Memory / Pure JS/TS | No (Imports/Inspects source directly) | No (In-memory assertion only) | Yes |

---

## 4. Complete Classification of All 335 Individual Tests

### Suite: `test_audit_evidence_integrity.test.cjs` (23 tests — Static Source / Contract Verification Test)

| # | File | Test Name | Storage / Mocks | Calls API Routes | Verifies DB Read-Back After Update | Auth / Validation Check |
|---:|---|---|---|---|---|---|
| 1 | `test_audit_evidence_integrity.test.cjs` | Freshness Guard: Stale evidence (>1hr) cannot be reported as fresh live observation | None (Static AST/Regex file inspection) | No | No | Yes |
| 2 | `test_audit_evidence_integrity.test.cjs` | Taxonomy Guard: Missing telemetry strictly evaluates to UNVERIFIED (never assumed) | None (Static AST/Regex file inspection) | No | No | Yes |
| 3 | `test_audit_evidence_integrity.test.cjs` | Environment Isolation Guard: Test runtime never exposes production MONGODB_URI or production Supabase | None (Static AST/Regex file inspection) | No | No | Yes |
| 4 | `test_audit_evidence_integrity.test.cjs` | Decoupling Guard: MONGODB_URI and DATABASE_URL protocol integrity | None (Static AST/Regex file inspection) | No | No | Yes |
| 5 | `test_audit_evidence_integrity.test.cjs` | Credential Masking Guard: Token regex intercepts raw GitHub tokens in strings | None (Static AST/Regex file inspection) | No | No | Yes |
| 6 | `test_audit_evidence_integrity.test.cjs` | Paused Cluster Guard: Prevents live connection test when cluster state is PAUSED or UNVERIFIED | None (Static AST/Regex file inspection) | No | No | Yes |
| 7 | `test_audit_evidence_integrity.test.cjs` | Repository Ambiguity Guard: Flags discrepancy between configured and claimed repositories | None (Static AST/Regex file inspection) | No | No | Yes |
| 8 | `test_audit_evidence_integrity.test.cjs` | .env.test Sanitization Guard: Verifies .env.test does not point to live Supabase or production cluster | None (Static AST/Regex file inspection) | No | No | Yes |
| 9 | `test_audit_evidence_integrity.test.cjs` | Health Route Contract: Process health (liveness) is decoupled from database readiness | None (Static AST/Regex file inspection) | No | No | No |
| 10 | `test_audit_evidence_integrity.test.cjs` | Browser Automation Guard: Inaccessible browser evaluates to BLOCKED — OWNER AUTHENTICATION REQUIRED | None (Static AST/Regex file inspection) | No | No | Yes |
| 11 | `test_audit_evidence_integrity.test.cjs` | Separation Guard: Local test suite pass does not imply live production connectivity | None (Static AST/Regex file inspection) | No | No | Yes |
| 12 | `test_audit_evidence_integrity.test.cjs` | Cluster Reconciliation Guard: Reconciles owner-observed avani-prod-cluster and marks cluster0 as stale | None (Static AST/Regex file inspection) | No | No | Yes |
| 13 | `test_audit_evidence_integrity.test.cjs` | Target Safety Guard: Strictly blocks pointing production avani_ai_crm_prod to avani-dev-cluster | None (Static AST/Regex file inspection) | No | No | Yes |
| 14 | `test_audit_evidence_integrity.test.cjs` | Suspended Cluster Guard: Blocks live connection attempts and marks hostname as UNAVAILABLE WHILE SUSPENDED | None (Static AST/Regex file inspection) | No | No | Yes |
| 15 | `test_audit_evidence_integrity.test.cjs` | Billing Blocker Guard: Categorizes Atlas billing alert + suspension as BLOCKED — OWNER BILLING ACTION REQUIRED | None (Static AST/Regex file inspection) | No | No | Yes |
| 16 | `test_audit_evidence_integrity.test.cjs` | Database Presence Guard: Classifies database on suspended cluster as UNVERIFIED — CLUSTER SUSPENDED (never assumed deleted or lost) | None (Static AST/Regex file inspection) | No | No | Yes |
| 17 | `test_audit_evidence_integrity.test.cjs` | Free Tier Quota Guard: Validates that MongoDB Atlas permits at most 1 Free M0 cluster per project | None (Static AST/Regex file inspection) | No | No | Yes |
| 18 | `test_audit_evidence_integrity.test.cjs` | Account Billing Restriction Guard: Organization-level billing hold blocks cluster creation across all projects | None (Static AST/Regex file inspection) | No | No | Yes |
| 19 | `test_audit_evidence_integrity.test.cjs` | Two-Cluster Isolation Guard: Enforces strict resource and database isolation between Loan Services and AI CRM | None (Static AST/Regex file inspection) | No | No | Yes |
| 20 | `test_audit_evidence_integrity.test.cjs` | Model API Key Guard: Identifies ai.mongodb.com Model API keys and prevents improper use as Admin API keys | None (Static AST/Regex file inspection) | No | No | Yes |
| 21 | `test_audit_evidence_integrity.test.cjs` | Project Mapping Guard: Enforces strict mapping of AVANI LOAN SERVICES and AVANI AI CRM to their respective databases | None (Static AST/Regex file inspection) | No | No | Yes |
| 22 | `test_audit_evidence_integrity.test.cjs` | Cross-Project Credential Guard: Prohibits reusing database credentials or connection strings between applications | None (Static AST/Regex file inspection) | No | No | Yes |
| 23 | `test_audit_evidence_integrity.test.cjs` | Live Cluster Isolation Guard: Validates that live provisioned cluster endpoints belong to distinct replica sets | None (Static AST/Regex file inspection) | No | No | Yes |

### Suite: `test_authorized_test_contact_validation.test.cjs` (7 tests — Unit Test)

| # | File | Test Name | Storage / Mocks | Calls API Routes | Verifies DB Read-Back After Update | Auth / Validation Check |
|---:|---|---|---|---|---|---|
| 24 | `test_authorized_test_contact_validation.test.cjs` | Test 6.1: Validates phone normalization to E.164 (+919175635165) | In-Memory / Pure JS/TS | No (Imports/Inspects source directly) | No (In-memory assertion only) | No |
| 25 | `test_authorized_test_contact_validation.test.cjs` | Test 6.2: Day 0 Welcome message incorporates loan consultancy disclaimer & advisor contact | In-Memory / Pure JS/TS | No (Imports/Inspects source directly) | No (In-memory assertion only) | No |
| 26 | `test_authorized_test_contact_validation.test.cjs` | Test 6.3: Stop Condition 1 — Customer reply triggers immediate drip suppression | In-Memory / Pure JS/TS | No (Imports/Inspects source directly) | No (In-memory assertion only) | No |
| 27 | `test_authorized_test_contact_validation.test.cjs` | Test 6.4: Stop Condition 2 — Multilingual Opt-Out ("थांबवा" / "STOP") immediately halts follow-up | In-Memory / Pure JS/TS | No (Imports/Inspects source directly) | No (In-memory assertion only) | Yes |
| 28 | `test_authorized_test_contact_validation.test.cjs` | Test 6.5: Idempotency protection prevents duplicate dispatch to authorized test number | In-Memory / Pure JS/TS | No (Imports/Inspects source directly) | No (In-memory assertion only) | Yes |
| 29 | `test_authorized_test_contact_validation.test.cjs` | Test 6.6: Human Escalation Routes to Sachin Shinde (+91 72491 08474) | In-Memory / Pure JS/TS | No (Imports/Inspects source directly) | No (In-memory assertion only) | No |
| 30 | `test_authorized_test_contact_validation.test.cjs` | Test 6.7: Single-Recipient Safety Clamp strictly blocks live dispatch to any unauthorized phone | In-Memory / Pure JS/TS | No (Imports/Inspects source directly) | No (In-memory assertion only) | Yes |

### Suite: `test_chatmantra_integration.test.cjs` (23 tests — Unit Test)

| # | File | Test Name | Storage / Mocks | Calls API Routes | Verifies DB Read-Back After Update | Auth / Validation Check |
|---:|---|---|---|---|---|---|
| 31 | `test_chatmantra_integration.test.cjs` | Signature Verification: Accepts valid plain hex HMAC-SHA256 signature | In-Memory / Pure JS/TS | No (Imports/Inspects source directly) | No (In-memory assertion only) | Yes |
| 32 | `test_chatmantra_integration.test.cjs` | Signature Verification: Accepts valid signature with sha256= prefix | In-Memory / Pure JS/TS | No (Imports/Inspects source directly) | No (In-memory assertion only) | Yes |
| 33 | `test_chatmantra_integration.test.cjs` | Signature Security: Rejects forged or tampered webhook signatures | In-Memory / Pure JS/TS | No (Imports/Inspects source directly) | No (In-memory assertion only) | Yes |
| 34 | `test_chatmantra_integration.test.cjs` | Signature Security: Safely returns false if signature or secret is missing | In-Memory / Pure JS/TS | No (Imports/Inspects source directly) | No (In-memory assertion only) | Yes |
| 35 | `test_chatmantra_integration.test.cjs` | Phone Normalization: Normalizes 10-digit, 0-prefix, and 91-prefix numbers to 91XXXXXXXXXX | In-Memory / Pure JS/TS | No (Imports/Inspects source directly) | No (In-memory assertion only) | No |
| 36 | `test_chatmantra_integration.test.cjs` | Loan Qualification: Classifies doctor/clinic inquiries to Doctor Loan | In-Memory / Pure JS/TS | No (Imports/Inspects source directly) | No (In-memory assertion only) | No |
| 37 | `test_chatmantra_integration.test.cjs` | Loan Qualification: Classifies overseas university inquiries to Education Loan — Global Studies | In-Memory / Pure JS/TS | No (Imports/Inspects source directly) | No (In-memory assertion only) | No |
| 38 | `test_chatmantra_integration.test.cjs` | Loan Qualification: Classifies institutional funding inquiries to School and College Owners Funding | In-Memory / Pure JS/TS | No (Imports/Inspects source directly) | No (In-memory assertion only) | No |
| 39 | `test_chatmantra_integration.test.cjs` | Loan Qualification: Classifies residential purchase to Home Loan | In-Memory / Pure JS/TS | No (Imports/Inspects source directly) | No (In-memory assertion only) | No |
| 40 | `test_chatmantra_integration.test.cjs` | Loan Qualification: Classifies MSME working capital to Business Loan | In-Memory / Pure JS/TS | No (Imports/Inspects source directly) | No (In-memory assertion only) | No |
| 41 | `test_chatmantra_integration.test.cjs` | Idempotency Guard: Generates consistent event keys and detects duplicate events | In-Memory / Pure JS/TS | No (Imports/Inspects source directly) | No (In-memory assertion only) | Yes |
| 42 | `test_chatmantra_integration.test.cjs` | Provider Safety Gate: Ensures zero live messages are dispatched when PROVIDER_MODE=mock | In-Memory / Pure JS/TS | No (Imports/Inspects source directly) | No (In-memory assertion only) | No |
| 43 | `test_chatmantra_integration.test.cjs` | Database Readiness Guard: Returns HTTP 503 instead of false HTTP 200 when database is offline | In-Memory / Pure JS/TS | No (Imports/Inspects source directly) | No (In-memory assertion only) | Yes |
| 44 | `test_chatmantra_integration.test.cjs` | Secret Masking: Ensures API keys and webhook secrets are redacted from diagnostic logs | In-Memory / Pure JS/TS | No (Imports/Inspects source directly) | No (In-memory assertion only) | Yes |
| 45 | `test_chatmantra_integration.test.cjs` | Two-Project Isolation: Strictly prohibits shared database targets between Loan Services and CRM | In-Memory / Pure JS/TS | No (Imports/Inspects source directly) | No (In-memory assertion only) | Yes |
| 46 | `test_chatmantra_integration.test.cjs` | Signature Security: Detects payload body mutation (body A signed, body B submitted) | In-Memory / Pure JS/TS | No (Imports/Inspects source directly) | No (In-memory assertion only) | Yes |
| 47 | `test_chatmantra_integration.test.cjs` | Malformed Payload Guard: Rejects non-JSON strings or truncated payloads with HTTP 400 | In-Memory / Pure JS/TS | No (Imports/Inspects source directly) | No (In-memory assertion only) | Yes |
| 48 | `test_chatmantra_integration.test.cjs` | Missing Identifier Guard: Inbound payload without message ID is rejected with HTTP 400 | In-Memory / Pure JS/TS | No (Imports/Inspects source directly) | No (In-memory assertion only) | Yes |
| 49 | `test_chatmantra_integration.test.cjs` | Unsupported Event Guard: Rejects unknown webhook events with HTTP 400 | In-Memory / Pure JS/TS | No (Imports/Inspects source directly) | No (In-memory assertion only) | Yes |
| 50 | `test_chatmantra_integration.test.cjs` | Timeout Handling Guard: Maps provider timeouts to TIMEOUT status cleanly | In-Memory / Pure JS/TS | No (Imports/Inspects source directly) | No (In-memory assertion only) | Yes |
| 51 | `test_chatmantra_integration.test.cjs` | Provider Rejection Guard: Maps HTTP 4xx/5xx provider errors cleanly | In-Memory / Pure JS/TS | No (Imports/Inspects source directly) | No (In-memory assertion only) | Yes |
| 52 | `test_chatmantra_integration.test.cjs` | Retry Safety Guard: Retrying unacknowledged event is idempotent and does not duplicate state | In-Memory / Pure JS/TS | No (Imports/Inspects source directly) | No (In-memory assertion only) | Yes |
| 53 | `test_chatmantra_integration.test.cjs` | Customer Safety Guard: Prohibits outbound network dispatch to real numbers during testing | In-Memory / Pure JS/TS | No (Imports/Inspects source directly) | No (In-memory assertion only) | Yes |

### Suite: `test_chatmitra_migration.test.cjs` (12 tests — Static Source / Contract Verification Test)

| # | File | Test Name | Storage / Mocks | Calls API Routes | Verifies DB Read-Back After Update | Auth / Validation Check |
|---:|---|---|---|---|---|---|
| 54 | `test_chatmitra_migration.test.cjs` | Phone Normalization: Normalizes 10-digit phone to 91XXXXXXXXXX | None (Static AST/Regex file inspection) | No | No | No |
| 55 | `test_chatmitra_migration.test.cjs` | Signature Verification: Accepts valid plain hex and sha256= prefix signatures | None (Static AST/Regex file inspection) | No | No | Yes |
| 56 | `test_chatmitra_migration.test.cjs` | Signature Security: Detects body tampering between signing and arrival | None (Static AST/Regex file inspection) | No | No | Yes |
| 57 | `test_chatmitra_migration.test.cjs` | Loan Qualification: Classifies all 8 canonical AVANI loan categories accurately | None (Static AST/Regex file inspection) | No | No | No |
| 58 | `test_chatmitra_migration.test.cjs` | Payload Validation: Enforces required fields and rejects malformed structures | None (Static AST/Regex file inspection) | No | No | Yes |
| 59 | `test_chatmitra_migration.test.cjs` | Provider Selection: Routes to CHATMITRA by default, preserves AISENSY for rollback | None (Static AST/Regex file inspection) | No | No | No |
| 60 | `test_chatmitra_migration.test.cjs` | Mock Safety Gate: Intercepts all dispatches in mock mode without external network calls | None (Static AST/Regex file inspection) | No | No | No |
| 61 | `test_chatmitra_migration.test.cjs` | Idempotency Lock: Generates consistent keys preventing duplicate sends | None (Static AST/Regex file inspection) | No | No | No |
| 62 | `test_chatmitra_migration.test.cjs` | Fail-Closed Database Contract: Returns HTTP 503 instead of 200 when database is offline | None (Static AST/Regex file inspection) | No | No | Yes |
| 63 | `test_chatmitra_migration.test.cjs` | Single-Active Provider Isolation: Only one live messaging provider active at any time | None (Static AST/Regex file inspection) | No | No | Yes |
| 64 | `test_chatmitra_migration.test.cjs` | Backwards Compatibility: ChatMantra functions and aliases resolve identically to ChatMitra | None (Static AST/Regex file inspection) | No | No | No |
| 65 | `test_chatmitra_migration.test.cjs` | Config Validator: Correctly detects present vs missing configuration | None (Static AST/Regex file inspection) | No | No | Yes |

### Suite: `test_chatmitra_webhook_live_contract.test.cjs` (7 tests — Unit Test)

| # | File | Test Name | Storage / Mocks | Calls API Routes | Verifies DB Read-Back After Update | Auth / Validation Check |
|---:|---|---|---|---|---|---|
| 66 | `test_chatmitra_webhook_live_contract.test.cjs` | Signing Contract: Exact HMAC-SHA256 against raw body matches ChatMitra specification | In-Memory / Pure JS/TS | No (Imports/Inspects source directly) | No (In-memory assertion only) | No |
| 67 | `test_chatmitra_webhook_live_contract.test.cjs` | Handler Acceptance: Valid message.received event returns HTTP 200 and records CM_INBOUND eventId | In-Memory / Pure JS/TS | No (Imports/Inspects source directly) | No (In-memory assertion only) | No |
| 68 | `test_chatmitra_webhook_live_contract.test.cjs` | Idempotency Guard: Re-delivering exact same messageId returns HTTP 200 with duplicate: true | In-Memory / Pure JS/TS | No (Imports/Inspects source directly) | No (In-memory assertion only) | Yes |
| 69 | `test_chatmitra_webhook_live_contract.test.cjs` | Tampering Rejection: Forged or modified body rejected with HTTP 401 | In-Memory / Pure JS/TS | No (Imports/Inspects source directly) | No (In-memory assertion only) | Yes |
| 70 | `test_chatmitra_webhook_live_contract.test.cjs` | Missing Header Guard: Unsigned request when secret configured rejected with HTTP 401 | In-Memory / Pure JS/TS | No (Imports/Inspects source directly) | No (In-memory assertion only) | Yes |
| 71 | `test_chatmitra_webhook_live_contract.test.cjs` | Fail-Closed DB Guard: Offline database returns HTTP 503 to ensure provider retry | In-Memory / Pure JS/TS | No (Imports/Inspects source directly) | No (In-memory assertion only) | Yes |
| 72 | `test_chatmitra_webhook_live_contract.test.cjs` | Secret Masking: Webhook secret name confirmed as CHATMITRA_WEBHOOK_SECRET; value remains unprinted | In-Memory / Pure JS/TS | No (Imports/Inspects source directly) | No (In-memory assertion only) | Yes |

### Suite: `test_cp21_automation_and_entitlements.test.cjs` (15 tests — Unit Test)

| # | File | Test Name | Storage / Mocks | Calls API Routes | Verifies DB Read-Back After Update | Auth / Validation Check |
|---:|---|---|---|---|---|---|
| 73 | `test_cp21_automation_and_entitlements.test.cjs` | Test 1: Inbound WhatsApp message received and parsed correctly | In-Memory / Pure JS/TS | No (Imports/Inspects source directly) | No (In-memory assertion only) | No |
| 74 | `test_cp21_automation_and_entitlements.test.cjs` | Test 2: Contact created and upserted for CRM Inbox visibility | In-Memory / Pure JS/TS | No (Imports/Inspects source directly) | No (In-memory assertion only) | No |
| 75 | `test_cp21_automation_and_entitlements.test.cjs` | Test 3: Lead created with automatic loan category classification | In-Memory / Pure JS/TS | No (Imports/Inspects source directly) | No (In-memory assertion only) | No |
| 76 | `test_cp21_automation_and_entitlements.test.cjs` | Test 4: AI chatbot responds in isolated test mode with qualification questions | In-Memory / Pure JS/TS | No (Imports/Inspects source directly) | No (In-memory assertion only) | No |
| 77 | `test_cp21_automation_and_entitlements.test.cjs` | Test 5: Human handoff transitions to Sachin Shinde (+91 72491 08474) | In-Memory / Pure JS/TS | No (Imports/Inspects source directly) | No (In-memory assertion only) | No |
| 78 | `test_cp21_automation_and_entitlements.test.cjs` | Test 6: Correct loan category classification across all 10 canonical products | In-Memory / Pure JS/TS | No (Imports/Inspects source directly) | No (In-memory assertion only) | No |
| 79 | `test_cp21_automation_and_entitlements.test.cjs` | Test 7: Duplicate message prevention enforces idempotency on msgId | In-Memory / Pure JS/TS | No (Imports/Inspects source directly) | No (In-memory assertion only) | No |
| 80 | `test_cp21_automation_and_entitlements.test.cjs` | Test 8: Opt-out suppression across English, Marathi ("थांबवा"), and Hindi ("रोको") | In-Memory / Pure JS/TS | No (Imports/Inspects source directly) | No (In-memory assertion only) | Yes |
| 81 | `test_cp21_automation_and_entitlements.test.cjs` | Test 9: Multilingual processing for Marathi and Hindi text | In-Memory / Pure JS/TS | No (Imports/Inspects source directly) | No (In-memory assertion only) | No |
| 82 | `test_cp21_automation_and_entitlements.test.cjs` | Test 10: Webhook signature verification (ChatMitra HMAC-SHA256 timing-safe) | In-Memory / Pure JS/TS | No (Imports/Inspects source directly) | No (In-memory assertion only) | Yes |
| 83 | `test_cp21_automation_and_entitlements.test.cjs` | Test 11: Failed-message retry and DB error propagation (no false COMPLETED) | In-Memory / Pure JS/TS | No (Imports/Inspects source directly) | No (In-memory assertion only) | No |
| 84 | `test_cp21_automation_and_entitlements.test.cjs` | Test 12: Scheduled campaign safety enforces mock mode and approved sending window | In-Memory / Pure JS/TS | No (Imports/Inspects source directly) | No (In-memory assertion only) | No |
| 85 | `test_cp21_automation_and_entitlements.test.cjs` | Test 13: Unauthorized recipient blocked by live safety clamp (+91 91756 35165 only) | In-Memory / Pure JS/TS | No (Imports/Inspects source directly) | No (In-memory assertion only) | Yes |
| 86 | `test_cp21_automation_and_entitlements.test.cjs` | Test 14: CRM Inbox persistence formats conversation history and preview snippets | In-Memory / Pure JS/TS | No (Imports/Inspects source directly) | No (In-memory assertion only) | No |
| 87 | `test_cp21_automation_and_entitlements.test.cjs` | Test 15: Message status updates (SENT, DELIVERED, READ) mapped to canonical enums | In-Memory / Pure JS/TS | No (Imports/Inspects source directly) | No (In-memory assertion only) | No |

### Suite: `test_cp22_pre_pro_automation_readiness.test.cjs` (16 tests — Unit Test)

| # | File | Test Name | Storage / Mocks | Calls API Routes | Verifies DB Read-Back After Update | Auth / Validation Check |
|---:|---|---|---|---|---|---|
| 88 | `test_cp22_pre_pro_automation_readiness.test.cjs` | Test 1: Message status enum consistency across read/write operations | In-Memory / Pure JS/TS | No (Imports/Inspects source directly) | No (In-memory assertion only) | No |
| 89 | `test_cp22_pre_pro_automation_readiness.test.cjs` | Test 2: Inbound message persistence with messageId, phone, and status RECEIVED | In-Memory / Pure JS/TS | No (Imports/Inspects source directly) | No (In-memory assertion only) | No |
| 90 | `test_cp22_pre_pro_automation_readiness.test.cjs` | Test 3: Contact & Lead dual upsert with normalized phone and default consent GRANTED | In-Memory / Pure JS/TS | No (Imports/Inspects source directly) | No (In-memory assertion only) | No |
| 91 | `test_cp22_pre_pro_automation_readiness.test.cjs` | Test 4: Conversation association sets both currentStage and currentState consistently | In-Memory / Pure JS/TS | No (Imports/Inspects source directly) | No (In-memory assertion only) | No |
| 92 | `test_cp22_pre_pro_automation_readiness.test.cjs` | Test 5: CRM Inbox payload formats message preview and conversation threads | In-Memory / Pure JS/TS | No (Imports/Inspects source directly) | No (In-memory assertion only) | No |
| 93 | `test_cp22_pre_pro_automation_readiness.test.cjs` | Test 6: Worker authentication rejects requests with invalid x-worker-auth (HTTP 401) | In-Memory / Pure JS/TS | No (Imports/Inspects source directly) | No (In-memory assertion only) | Yes |
| 94 | `test_cp22_pre_pro_automation_readiness.test.cjs` | Test 7: Worker fail-closed DB error handling returns HTTP 503 when database is offline | In-Memory / Pure JS/TS | No (Imports/Inspects source directly) | No (In-memory assertion only) | Yes |
| 95 | `test_cp22_pre_pro_automation_readiness.test.cjs` | Test 8: Database write errors mark WebhookInbox as FAILED and return HTTP 500 | In-Memory / Pure JS/TS | No (Imports/Inspects source directly) | No (In-memory assertion only) | No |
| 96 | `test_cp22_pre_pro_automation_readiness.test.cjs` | Test 9: ChatMitra HMAC-SHA256 signature verification protects against tampering | In-Memory / Pure JS/TS | No (Imports/Inspects source directly) | No (In-memory assertion only) | Yes |
| 97 | `test_cp22_pre_pro_automation_readiness.test.cjs` | Test 10: Provider event discrimination routes Meta and ChatMitra payloads accurately | In-Memory / Pure JS/TS | No (Imports/Inspects source directly) | No (In-memory assertion only) | No |
| 98 | `test_cp22_pre_pro_automation_readiness.test.cjs` | Test 11: Trilingual opt-out detection (STOP, थांबवा, रोको) updates Lead and Contact | In-Memory / Pure JS/TS | No (Imports/Inspects source directly) | No (In-memory assertion only) | Yes |
| 99 | `test_cp22_pre_pro_automation_readiness.test.cjs` | Test 12: Accurate classification across all 10 canonical loan categories | In-Memory / Pure JS/TS | No (Imports/Inspects source directly) | No (In-memory assertion only) | No |
| 100 | `test_cp22_pre_pro_automation_readiness.test.cjs` | Test 13: AI chatbot isolated test mode responds with qualification questions | In-Memory / Pure JS/TS | No (Imports/Inspects source directly) | No (In-memory assertion only) | No |
| 101 | `test_cp22_pre_pro_automation_readiness.test.cjs` | Test 14: Human advisor handoff routes to Sachin Shinde (+91 72491 08474) | In-Memory / Pure JS/TS | No (Imports/Inspects source directly) | No (In-memory assertion only) | No |
| 102 | `test_cp22_pre_pro_automation_readiness.test.cjs` | Test 15: Scheduled campaign safety enforces recipient clamp (+91 91756 35165 only) | In-Memory / Pure JS/TS | No (Imports/Inspects source directly) | No (In-memory assertion only) | Yes |
| 103 | `test_cp22_pre_pro_automation_readiness.test.cjs` | Test 16: Safe historical recovery drill verifies idempotent replay of uncompleted events | In-Memory / Pure JS/TS | No (Imports/Inspects source directly) | No (In-memory assertion only) | No |

### Suite: `test_cp23_master_automation_readiness.test.cjs` (30 tests — Unit Test)

| # | File | Test Name | Storage / Mocks | Calls API Routes | Verifies DB Read-Back After Update | Auth / Validation Check |
|---:|---|---|---|---|---|---|
| 104 | `test_cp23_master_automation_readiness.test.cjs` | [PASS] Test 1: 1. Meta signed inbound event is accepted | In-Memory / Pure JS/TS | No (Imports/Inspects source directly) | No (In-memory assertion only) | No |
| 105 | `test_cp23_master_automation_readiness.test.cjs` | [PASS] Test 2: 2. Meta missing signature is rejected | In-Memory / Pure JS/TS | No (Imports/Inspects source directly) | No (In-memory assertion only) | Yes |
| 106 | `test_cp23_master_automation_readiness.test.cjs` | [PASS] Test 3: 3. Meta forged signature is rejected | In-Memory / Pure JS/TS | No (Imports/Inspects source directly) | No (In-memory assertion only) | Yes |
| 107 | `test_cp23_master_automation_readiness.test.cjs` | [PASS] Test 4: 4. ChatMitra valid signed event is accepted | In-Memory / Pure JS/TS | No (Imports/Inspects source directly) | No (In-memory assertion only) | No |
| 108 | `test_cp23_master_automation_readiness.test.cjs` | [PASS] Test 5: 5. ChatMitra missing signature is rejected | In-Memory / Pure JS/TS | No (Imports/Inspects source directly) | No (In-memory assertion only) | Yes |
| 109 | `test_cp23_master_automation_readiness.test.cjs` | [PASS] Test 6: 6. ChatMitra forged signature is rejected | In-Memory / Pure JS/TS | No (Imports/Inspects source directly) | No (In-memory assertion only) | Yes |
| 110 | `test_cp23_master_automation_readiness.test.cjs` | [PASS] Test 7: 7. Canonical RECEIVED message status mapping for inbound | In-Memory / Pure JS/TS | No (Imports/Inspects source directly) | No (In-memory assertion only) | No |
| 111 | `test_cp23_master_automation_readiness.test.cjs` | [PASS] Test 8: 8. Invalid status rejection / safe mapping to UNKNOWN | In-Memory / Pure JS/TS | No (Imports/Inspects source directly) | No (In-memory assertion only) | Yes |
| 112 | `test_cp23_master_automation_readiness.test.cjs` | [PASS] Test 9: 9. Contact upsert and deduplication by phone | In-Memory / Pure JS/TS | No (Imports/Inspects source directly) | No (In-memory assertion only) | No |
| 113 | `test_cp23_master_automation_readiness.test.cjs` | [PASS] Test 10: 10. Lead upsert and loan category assignment | In-Memory / Pure JS/TS | No (Imports/Inspects source directly) | No (In-memory assertion only) | No |
| 114 | `test_cp23_master_automation_readiness.test.cjs` | [PASS] Test 11: 11. Conversation upsert and state synchronization (currentStage/currentState) | In-Memory / Pure JS/TS | No (Imports/Inspects source directly) | No (In-memory assertion only) | No |
| 115 | `test_cp23_master_automation_readiness.test.cjs` | [PASS] Test 12: 12. Message persistence with providerMessageId and direction | In-Memory / Pure JS/TS | No (Imports/Inspects source directly) | No (In-memory assertion only) | No |
| 116 | `test_cp23_master_automation_readiness.test.cjs` | [PASS] Test 13: 13. Duplicate webhook retry (atomic lease and duplicate event swallowing) | In-Memory / Pure JS/TS | No (Imports/Inspects source directly) | No (In-memory assertion only) | No |
| 117 | `test_cp23_master_automation_readiness.test.cjs` | [PASS] Test 14: 14. Duplicate provider message ID idempotency guard | In-Memory / Pure JS/TS | No (Imports/Inspects source directly) | No (In-memory assertion only) | Yes |
| 118 | `test_cp23_master_automation_readiness.test.cjs` | [PASS] Test 15: 15. Database failure and retry returns HTTP 503 fail-closed | In-Memory / Pure JS/TS | No (Imports/Inspects source directly) | No (In-memory assertion only) | Yes |
| 119 | `test_cp23_master_automation_readiness.test.cjs` | [PASS] Test 16: 16. CRM Inbox visibility and message preview binding | In-Memory / Pure JS/TS | No (Imports/Inspects source directly) | No (In-memory assertion only) | No |
| 120 | `test_cp23_master_automation_readiness.test.cjs` | [PASS] Test 17: 17. English classification (Education Loan — Global Studies) | In-Memory / Pure JS/TS | No (Imports/Inspects source directly) | No (In-memory assertion only) | No |
| 121 | `test_cp23_master_automation_readiness.test.cjs` | [PASS] Test 18: 18. Marathi classification (गृहकर्ज / Home Loan) | In-Memory / Pure JS/TS | No (Imports/Inspects source directly) | No (In-memory assertion only) | No |
| 122 | `test_cp23_master_automation_readiness.test.cjs` | [PASS] Test 19: 19. Hindi classification (बिजनेस लोन / Business Loan) | In-Memory / Pure JS/TS | No (Imports/Inspects source directly) | No (In-memory assertion only) | No |
| 123 | `test_cp23_master_automation_readiness.test.cjs` | [PASS] Test 20: 20. Human advisor handoff to Sachin Shinde (+91 72491 08474) | In-Memory / Pure JS/TS | No (Imports/Inspects source directly) | No (In-memory assertion only) | No |
| 124 | `test_cp23_master_automation_readiness.test.cjs` | [PASS] Test 21: 21. AI timeout fallback provides controlled compliant message | In-Memory / Pure JS/TS | No (Imports/Inspects source directly) | No (In-memory assertion only) | No |
| 125 | `test_cp23_master_automation_readiness.test.cjs` | [PASS] Test 22: 22. Outbound dispatch entitlement check (mock vs live mode gating) | In-Memory / Pure JS/TS | No (Imports/Inspects source directly) | No (In-memory assertion only) | No |
| 126 | `test_cp23_master_automation_readiness.test.cjs` | [PASS] Test 23: 23. Unauthorized recipient rejection (safety clamp strictly to +91 91756 35165) | In-Memory / Pure JS/TS | No (Imports/Inspects source directly) | No (In-memory assertion only) | Yes |
| 127 | `test_cp23_master_automation_readiness.test.cjs` | [PASS] Test 24: 24. Opt-out suppression (multilingual STOP, थांबवा, रोको) | In-Memory / Pure JS/TS | No (Imports/Inspects source directly) | No (In-memory assertion only) | Yes |
| 128 | `test_cp23_master_automation_readiness.test.cjs` | [PASS] Test 25: 25. Customer reply stops scheduled follow-up drip campaign | In-Memory / Pure JS/TS | No (Imports/Inspects source directly) | No (In-memory assertion only) | No |
| 129 | `test_cp23_master_automation_readiness.test.cjs` | [PASS] Test 26: 26. Delivery status synchronization (SENT, DELIVERED, READ, FAILED) | In-Memory / Pure JS/TS | No (Imports/Inspects source directly) | No (In-memory assertion only) | No |
| 130 | `test_cp23_master_automation_readiness.test.cjs` | [PASS] Test 27: 27. Out-of-order delivery callbacks cannot downgrade higher states | In-Memory / Pure JS/TS | No (Imports/Inspects source directly) | No (In-memory assertion only) | No |
| 131 | `test_cp23_master_automation_readiness.test.cjs` | [PASS] Test 28: 28. Bulk broadcast disabled (BULK_BROADCAST_ENABLED=false) | In-Memory / Pure JS/TS | No (Imports/Inspects source directly) | No (In-memory assertion only) | No |
| 132 | `test_cp23_master_automation_readiness.test.cjs` | [PASS] Test 29: 29. Worker authentication enforces x-worker-auth guard | In-Memory / Pure JS/TS | No (Imports/Inspects source directly) | No (In-memory assertion only) | Yes |
| 133 | `test_cp23_master_automation_readiness.test.cjs` | [PASS] Test 30: 30. Production environment validation and secret exposure scan | In-Memory / Pure JS/TS | No (Imports/Inspects source directly) | No (In-memory assertion only) | Yes |

### Suite: `test_cp25_2_inbox_send_pipeline.test.cjs` (20 tests — Static Source / Contract Verification Test)

| # | File | Test Name | Storage / Mocks | Calls API Routes | Verifies DB Read-Back After Update | Auth / Validation Check |
|---:|---|---|---|---|---|---|
| 134 | `test_cp25_2_inbox_send_pipeline.test.cjs` | [PASS] CP25.2-01: InboxPage imports and React hooks defined properly | None (Static AST/Regex file inspection) | No | No | No |
| 135 | `test_cp25_2_inbox_send_pipeline.test.cjs` | [PASS] CP25.2-02: AVANI_INBOX_PRODUCT_DETAILS contains all 8 products | None (Static AST/Regex file inspection) | No | No | No |
| 136 | `test_cp25_2_inbox_send_pipeline.test.cjs` | [PASS] CP25.2-03: Product suite contains official WhatsApp WABA number +91 72491 08474 | None (Static AST/Regex file inspection) | No | No | No |
| 137 | `test_cp25_2_inbox_send_pipeline.test.cjs` | [PASS] CP25.2-04: Product suite attributes Founder & Chief Loan Advisor Sachin Shinde | None (Static AST/Regex file inspection) | No | No | No |
| 138 | `test_cp25_2_inbox_send_pipeline.test.cjs` | [PASS] CP25.2-05: Product suite links to official website https://www.avanifinserv.com/ | None (Static AST/Regex file inspection) | No | No | No |
| 139 | `test_cp25_2_inbox_send_pipeline.test.cjs` | [PASS] CP25.2-06: Doctor Loan Checklist contains required doctor documents | None (Static AST/Regex file inspection) | No | No | No |
| 140 | `test_cp25_2_inbox_send_pipeline.test.cjs` | [PASS] CP25.2-07: Home Loan Checklist contains required housing documents | None (Static AST/Regex file inspection) | No | No | No |
| 141 | `test_cp25_2_inbox_send_pipeline.test.cjs` | [PASS] CP25.2-08: Send button shows Loader2 spinner and Sending text during dispatch | None (Static AST/Regex file inspection) | No | No | No |
| 142 | `test_cp25_2_inbox_send_pipeline.test.cjs` | [PASS] CP25.2-09: Draft preservation logic is implemented on dispatch failure | None (Static AST/Regex file inspection) | No | No | No |
| 143 | `test_cp25_2_inbox_send_pipeline.test.cjs` | [PASS] CP25.2-10: Recipient phone resolution supports multiple contact phone fields | None (Static AST/Regex file inspection) | No | No | No |
| 144 | `test_cp25_2_inbox_send_pipeline.test.cjs` | [PASS] CP25.2-11: direct-message API validates phone presence | None (Static AST/Regex file inspection) | No | No | No |
| 145 | `test_cp25_2_inbox_send_pipeline.test.cjs` | [PASS] CP25.2-12: direct-message API validates content presence | None (Static AST/Regex file inspection) | No | No | No |
| 146 | `test_cp25_2_inbox_send_pipeline.test.cjs` | [PASS] CP25.2-13: direct-message API validates minimum 10 digits | None (Static AST/Regex file inspection) | No | No | No |
| 147 | `test_cp25_2_inbox_send_pipeline.test.cjs` | [PASS] CP25.2-14: direct-message restricts live dispatch strictly to test number | None (Static AST/Regex file inspection) | No | No | No |
| 148 | `test_cp25_2_inbox_send_pipeline.test.cjs` | [PASS] CP25.2-15: direct-message returns 422 if CHATMITRA_API_KEY missing in live mode | None (Static AST/Regex file inspection) | No | No | Yes |
| 149 | `test_cp25_2_inbox_send_pipeline.test.cjs` | [PASS] CP25.2-16: direct-message response includes isMock flag for transparency | None (Static AST/Regex file inspection) | No | No | No |
| 150 | `test_cp25_2_inbox_send_pipeline.test.cjs` | [PASS] CP25.2-17: ProviderRouter saves messageText to Message.create in MongoDB | None (Static AST/Regex file inspection) | No | No | No |
| 151 | `test_cp25_2_inbox_send_pipeline.test.cjs` | [PASS] CP25.2-18: contacts/[id] queries phoneVariants across phone, senderPhone, recipientPhone | None (Static AST/Regex file inspection) | No | No | No |
| 152 | `test_cp25_2_inbox_send_pipeline.test.cjs` | [PASS] CP25.2-19: contacts route queries phoneVariants for last message snippet | None (Static AST/Regex file inspection) | No | No | No |
| 153 | `test_cp25_2_inbox_send_pipeline.test.cjs` | [PASS] CP25.2-20: ChatMitra adapter formats phone to digits-only with 91 prefix | None (Static AST/Regex file inspection) | No | No | No |

### Suite: `test_cp25_3_1_production_audit_and_branding.test.cjs` (22 tests — Static Source / Contract Verification Test)

| # | File | Test Name | Storage / Mocks | Calls API Routes | Verifies DB Read-Back After Update | Auth / Validation Check |
|---:|---|---|---|---|---|---|
| 154 | `test_cp25_3_1_production_audit_and_branding.test.cjs` | [PASS] CP25.3.1-01: Centralized business config exists and defines AVANI LOAN SERVICES | None (Static AST/Regex file inspection) | No | No | No |
| 155 | `test_cp25_3_1_production_audit_and_branding.test.cjs` | [PASS] CP25.3.1-02: Official WhatsApp Business / WABA number is +91 72491 08474 | None (Static AST/Regex file inspection) | No | No | No |
| 156 | `test_cp25_3_1_production_audit_and_branding.test.cjs` | [PASS] CP25.3.1-03: Authorized test recipient is isolated as +91 91756 35165 | None (Static AST/Regex file inspection) | No | No | Yes |
| 157 | `test_cp25_3_1_production_audit_and_branding.test.cjs` | [PASS] CP25.3.1-04: Official website is https://www.avanifinserv.com and email is enquiry@avanifinserv.com | None (Static AST/Regex file inspection) | No | No | No |
| 158 | `test_cp25_3_1_production_audit_and_branding.test.cjs` | [PASS] CP25.3.1-05: Founder & Chief Loan Advisor is attributed to Sachin Shinde | None (Static AST/Regex file inspection) | No | No | No |
| 159 | `test_cp25_3_1_production_audit_and_branding.test.cjs` | [PASS] CP25.3.1-06: Test recipient 9175635165 is excluded from public product suite copy | None (Static AST/Regex file inspection) | No | No | No |
| 160 | `test_cp25_3_1_production_audit_and_branding.test.cjs` | [PASS] CP25.3.1-07: public/logo.svg exists and is a valid SVG vector file | None (Static AST/Regex file inspection) | No | No | No |
| 161 | `test_cp25_3_1_production_audit_and_branding.test.cjs` | [PASS] CP25.3.1-08: Sidebar layout renders /logo.svg with text brand fallback | None (Static AST/Regex file inspection) | No | No | No |
| 162 | `test_cp25_3_1_production_audit_and_branding.test.cjs` | [PASS] CP25.3.1-09: Contacts page distinguishes Official WABA (+91 72491 08474) and Test Recipient (+91 91756 35165) | None (Static AST/Regex file inspection) | No | No | No |
| 163 | `test_cp25_3_1_production_audit_and_branding.test.cjs` | [PASS] CP25.3.1-10: Inbox UI displays accurate AI auto-reply status (MOCK MODE or DISABLED) | None (Static AST/Regex file inspection) | No | No | No |
| 164 | `test_cp25_3_1_production_audit_and_branding.test.cjs` | [PASS] CP25.3.1-11: Inbox UI header displays official advisory hotline (+91 72491 08474) | None (Static AST/Regex file inspection) | No | No | No |
| 165 | `test_cp25_3_1_production_audit_and_branding.test.cjs` | [PASS] CP25.3.1-12: Inbox UI badges test contacts with Authorized Test Recipient pill | None (Static AST/Regex file inspection) | No | No | Yes |
| 166 | `test_cp25_3_1_production_audit_and_branding.test.cjs` | [PASS] CP25.3.1-13: Chatbot flow engine directs inquiries to official WABA number (+91 72491 08474) | None (Static AST/Regex file inspection) | No | No | No |
| 167 | `test_cp25_3_1_production_audit_and_branding.test.cjs` | [PASS] CP25.3.1-14: AI agent human handoff directs inquiries to Sachin Shinde (+91 72491 08474) | None (Static AST/Regex file inspection) | No | No | No |
| 168 | `test_cp25_3_1_production_audit_and_branding.test.cjs` | [PASS] CP25.3.1-15: ChatMitra adapter clamps live dispatch strictly to test recipient 919175635165 | None (Static AST/Regex file inspection) | No | No | Yes |
| 169 | `test_cp25_3_1_production_audit_and_branding.test.cjs` | [PASS] CP25.3.1-16: direct-message API restricts live dispatch strictly to authorized test contact | None (Static AST/Regex file inspection) | No | No | Yes |
| 170 | `test_cp25_3_1_production_audit_and_branding.test.cjs` | [PASS] CP25.3.1-17: .vercel/project.json targets avani-ai-crm under team_vUTeKhQxcSPYtztYtoLMWinO | None (Static AST/Regex file inspection) | No | No | No |
| 171 | `test_cp25_3_1_production_audit_and_branding.test.cjs` | [PASS] CP25.3.1-18: Zero Agro Foods application code in src/ directory | None (Static AST/Regex file inspection) | No | No | No |
| 172 | `test_cp25_3_1_production_audit_and_branding.test.cjs` | [PASS] CP25.3.1-19: Inbox quick actions insert draft into composer without auto-dispatching | None (Static AST/Regex file inspection) | No | No | No |
| 173 | `test_cp25_3_1_production_audit_and_branding.test.cjs` | [PASS] CP25.3.1-20: ProviderRouter persists messageText to MongoDB Message.create | None (Static AST/Regex file inspection) | No | No | No |
| 174 | `test_cp25_3_1_production_audit_and_branding.test.cjs` | [PASS] CP25.3.1-21: contacts/[id] generates normalized phoneVariants for message matching | None (Static AST/Regex file inspection) | No | No | No |
| 175 | `test_cp25_3_1_production_audit_and_branding.test.cjs` | [PASS] CP25.3.1-22: Health endpoint reports database status and WhatsApp provider status without leaking secrets | None (Static AST/Regex file inspection) | No | No | Yes |

### Suite: `test_cp25_3_2_live_acceptance.test.cjs` (12 tests — Hybrid Unit + Static Contract Test)

| # | File | Test Name | Storage / Mocks | Calls API Routes | Verifies DB Read-Back After Update | Auth / Validation Check |
|---:|---|---|---|---|---|---|
| 176 | `test_cp25_3_2_live_acceptance.test.cjs` | [PASS] CP25.3.2-01: Deployment metadata matches authorized project prj_P8s8y3a5Gge8EzAab0Fa10cHewgQ | In-Memory / Pure TS Logic + Static file inspection | Yes (Direct handler import with mocks) | No (In-memory object state only) | Yes |
| 177 | `test_cp25_3_2_live_acceptance.test.cjs` | [PASS] CP25.3.2-02: Business configuration has official WABA hotline +91 72491 08474 | In-Memory / Pure TS Logic + Static file inspection | Yes (Direct handler import with mocks) | No (In-memory object state only) | No |
| 178 | `test_cp25_3_2_live_acceptance.test.cjs` | [PASS] CP25.3.2-03: Business configuration isolates authorized test recipient +91 91756 35165 | In-Memory / Pure TS Logic + Static file inspection | Yes (Direct handler import with mocks) | No (In-memory object state only) | Yes |
| 179 | `test_cp25_3_2_live_acceptance.test.cjs` | [PASS] CP25.3.2-04: Webhook worker strictly enforces CHATMITRA_INBOUND_AUTO_REPLY_ENABLED guard | In-Memory / Pure TS Logic + Static file inspection | Yes (Direct handler import with mocks) | No (In-memory object state only) | Yes |
| 180 | `test_cp25_3_2_live_acceptance.test.cjs` | [PASS] CP25.3.2-05: Webhook worker sets lead status to CUSTOMER_REPLIED_HUMAN_FOLLOWUP when CRM AI is in safe mode | In-Memory / Pure TS Logic + Static file inspection | Yes (Direct handler import with mocks) | No (In-memory object state only) | No |
| 181 | `test_cp25_3_2_live_acceptance.test.cjs` | [PASS] CP25.3.2-06: Doctor Loan keyword classification accurately identifies doctor loan queries | In-Memory / Pure TS Logic + Static file inspection | Yes (Direct handler import with mocks) | No (In-memory object state only) | No |
| 182 | `test_cp25_3_2_live_acceptance.test.cjs` | [PASS] CP25.3.2-07: Out-of-order message delivery transition prevents downgrading READ to DELIVERED | In-Memory / Pure TS Logic + Static file inspection | Yes (Direct handler import with mocks) | No (In-memory object state only) | No |
| 183 | `test_cp25_3_2_live_acceptance.test.cjs` | [PASS] CP25.3.2-08: WebhookInbox enforces idempotency on incoming eventId | In-Memory / Pure TS Logic + Static file inspection | Yes (Direct handler import with mocks) | No (In-memory object state only) | No |
| 184 | `test_cp25_3_2_live_acceptance.test.cjs` | [PASS] CP25.3.2-09: Live dispatch safety clamp blocks any phone other than +91 91756 35165 | In-Memory / Pure TS Logic + Static file inspection | Yes (Direct handler import with mocks) | No (In-memory object state only) | Yes |
| 185 | `test_cp25_3_2_live_acceptance.test.cjs` | [PASS] CP25.3.2-10: DPDP Act Opt-Out Engine suppresses outbound messages upon STOP or थांबवा | In-Memory / Pure TS Logic + Static file inspection | Yes (Direct handler import with mocks) | No (In-memory object state only) | Yes |
| 186 | `test_cp25_3_2_live_acceptance.test.cjs` | [PASS] CP25.3.2-11: Public logo asset exists in root public directory and is valid SVG | In-Memory / Pure TS Logic + Static file inspection | Yes (Direct handler import with mocks) | No (In-memory object state only) | No |
| 187 | `test_cp25_3_2_live_acceptance.test.cjs` | [PASS] CP25.3.2-12: Zero secret exposures in codebase or public configuration | In-Memory / Pure TS Logic + Static file inspection | Yes (Direct handler import with mocks) | No (In-memory object state only) | Yes |

### Suite: `test_cp25_master_chatbot_and_integrations.test.cjs` (40 tests — Mocked API Route Integration Test)

| # | File | Test Name | Storage / Mocks | Calls API Routes | Verifies DB Read-Back After Update | Auth / Validation Check |
|---:|---|---|---|---|---|---|
| 188 | `test_cp25_master_chatbot_and_integrations.test.cjs` | [PASS] Test 1: Chatbot Step 1 Welcome message & privacy notice presentation | Mocked Mongoose Models (In-Memory) | Yes (Invokes route handler functions with mock Request & mocked DB) | Mocked only (Verifies args passed to mock save/update) | No |
| 189 | `test_cp25_master_chatbot_and_integrations.test.cjs` | [PASS] Test 2: Chatbot language selection (English, मराठी, हिंदी) | Mocked Mongoose Models (In-Memory) | Yes (Invokes route handler functions with mock Request & mocked DB) | Mocked only (Verifies args passed to mock save/update) | No |
| 190 | `test_cp25_master_chatbot_and_integrations.test.cjs` | [PASS] Test 3: Chatbot Step 2 basic info collection order & mobile/email validation | Mocked Mongoose Models (In-Memory) | Yes (Invokes route handler functions with mock Request & mocked DB) | Mocked only (Verifies args passed to mock save/update) | No |
| 191 | `test_cp25_master_chatbot_and_integrations.test.cjs` | [PASS] Test 4: Chatbot Step 2 applicant category options (Salaried, Self Employed, Business Owner, Professional) | Mocked Mongoose Models (In-Memory) | Yes (Invokes route handler functions with mock Request & mocked DB) | Mocked only (Verifies args passed to mock save/update) | No |
| 192 | `test_cp25_master_chatbot_and_integrations.test.cjs` | [PASS] Test 5: Chatbot Step 3 monthly income options (5 options including Prefer to discuss with an advisor) | Mocked Mongoose Models (In-Memory) | Yes (Invokes route handler functions with mock Request & mocked DB) | Mocked only (Verifies args passed to mock save/update) | No |
| 193 | `test_cp25_master_chatbot_and_integrations.test.cjs` | [PASS] Test 6: Chatbot Step 4 loan requirement (all 11 options) | Mocked Mongoose Models (In-Memory) | Yes (Invokes route handler functions with mock Request & mocked DB) | Mocked only (Verifies args passed to mock save/update) | No |
| 194 | `test_cp25_master_chatbot_and_integrations.test.cjs` | [PASS] Test 7: Chatbot Step 4 required funding amount & INR currency assignment | Mocked Mongoose Models (In-Memory) | Yes (Invokes route handler functions with mock Request & mocked DB) | Mocked only (Verifies args passed to mock save/update) | No |
| 195 | `test_cp25_master_chatbot_and_integrations.test.cjs` | [PASS] Test 8: Multi-branch checklist composition (Doctor + Home Loan, Salaried + Home Loan, Business Owner + Personal Loan) | Mocked Mongoose Models (In-Memory) | Yes (Invokes route handler functions with mock Request & mocked DB) | Mocked only (Verifies args passed to mock save/update) | No |
| 196 | `test_cp25_master_chatbot_and_integrations.test.cjs` | [PASS] Test 9: Education Loan checklists (India vs Abroad, Salaried/Self-Employed/Farmer/Pension/Rental Co-Applicant) | Mocked Mongoose Models (In-Memory) | Yes (Invokes route handler functions with mock Request & mocked DB) | Mocked only (Verifies args passed to mock save/update) | No |
| 197 | `test_cp25_master_chatbot_and_integrations.test.cjs` | [PASS] Test 10: Chatbot Human Advisor Handoff & non-lender disclaimer enforcement | Mocked Mongoose Models (In-Memory) | Yes (Invokes route handler functions with mock Request & mocked DB) | Mocked only (Verifies args passed to mock save/update) | No |
| 198 | `test_cp25_master_chatbot_and_integrations.test.cjs` | [PASS] Test 11: CRM E.164 & ChatMitra phone normalization | Mocked Mongoose Models (In-Memory) | Yes (Invokes route handler functions with mock Request & mocked DB) | Mocked only (Verifies args passed to mock save/update) | No |
| 199 | `test_cp25_master_chatbot_and_integrations.test.cjs` | [PASS] Test 12: CRM duplicate contact & lead upsert key consistency | Mocked Mongoose Models (In-Memory) | Yes (Invokes route handler functions with mock Request & mocked DB) | Mocked only (Verifies args passed to mock save/update) | No |
| 200 | `test_cp25_master_chatbot_and_integrations.test.cjs` | [PASS] Test 13: ChatMitra Pro 17 canonical tags & 20 custom attributes ceiling enforcement | Mocked Mongoose Models (In-Memory) | Yes (Invokes route handler functions with mock Request & mocked DB) | Mocked only (Verifies args passed to mock save/update) | No |
| 201 | `test_cp25_master_chatbot_and_integrations.test.cjs` | [PASS] Test 14: Conversation schema stages & state progression | Mocked Mongoose Models (In-Memory) | Yes (Invokes route handler functions with mock Request & mocked DB) | Mocked only (Verifies args passed to mock save/update) | No |
| 202 | `test_cp25_master_chatbot_and_integrations.test.cjs` | [PASS] Test 15: Message persistence canonical uppercase status normalization | Mocked Mongoose Models (In-Memory) | Yes (Invokes route handler functions with mock Request & mocked DB) | Mocked only (Verifies args passed to mock save/update) | No |
| 203 | `test_cp25_master_chatbot_and_integrations.test.cjs` | [PASS] Test 16: Multilingual 10-category loan classification (English, Marathi, Hindi) | Mocked Mongoose Models (In-Memory) | Yes (Invokes route handler functions with mock Request & mocked DB) | Mocked only (Verifies args passed to mock save/update) | No |
| 204 | `test_cp25_master_chatbot_and_integrations.test.cjs` | [PASS] Test 17: Admin & Advisor Dashboard KPI route and 7-dimension filter builder | Mocked Mongoose Models (In-Memory) | Yes (Invokes route handler functions with mock Request & mocked DB) | Mocked only (Verifies args passed to mock save/update) | No |
| 205 | `test_cp25_master_chatbot_and_integrations.test.cjs` | [PASS] Test 18: Advisor assignment & incomplete application handoff summary | Mocked Mongoose Models (In-Memory) | Yes (Invokes route handler functions with mock Request & mocked DB) | Mocked only (Verifies args passed to mock save/update) | No |
| 206 | `test_cp25_master_chatbot_and_integrations.test.cjs` | [PASS] Test 19: ChatMitra inbound webhook HMAC-SHA256 verification over raw body | Mocked Mongoose Models (In-Memory) | Yes (Invokes route handler functions with mock Request & mocked DB) | Mocked only (Verifies args passed to mock save/update) | No |
| 207 | `test_cp25_master_chatbot_and_integrations.test.cjs` | [PASS] Test 20: ChatMitra outbound message mock mode & single-recipient safety clamp (919175635165) | Mocked Mongoose Models (In-Memory) | Yes (Invokes route handler functions with mock Request & mocked DB) | Mocked only (Verifies args passed to mock save/update) | Yes |
| 208 | `test_cp25_master_chatbot_and_integrations.test.cjs` | [PASS] Test 21: Meta WhatsApp webhook security & provider discrimination | Mocked Mongoose Models (In-Memory) | Yes (Invokes route handler functions with mock Request & mocked DB) | Mocked only (Verifies args passed to mock save/update) | No |
| 209 | `test_cp25_master_chatbot_and_integrations.test.cjs` | [PASS] Test 22: HubSpot sync payload builder & opt-out suppression | Mocked Mongoose Models (In-Memory) | Yes (Invokes route handler functions with mock Request & mocked DB) | Mocked only (Verifies args passed to mock save/update) | Yes |
| 210 | `test_cp25_master_chatbot_and_integrations.test.cjs` | [PASS] Test 23: Google Sheets 14 recommended tabs & 19 standardized columns | Mocked Mongoose Models (In-Memory) | Yes (Invokes route handler functions with mock Request & mocked DB) | Mocked only (Verifies args passed to mock save/update) | No |
| 211 | `test_cp25_master_chatbot_and_integrations.test.cjs` | [PASS] Test 24: Zapier integration idempotency & circular-automation prevention | Mocked Mongoose Models (In-Memory) | Yes (Invokes route handler functions with mock Request & mocked DB) | Mocked only (Verifies args passed to mock save/update) | No |
| 212 | `test_cp25_master_chatbot_and_integrations.test.cjs` | [PASS] Test 25: OmniDM AI Calling integration (test mode standby, DND/consent guards, outcome parser) | Mocked Mongoose Models (In-Memory) | Yes (Invokes route handler functions with mock Request & mocked DB) | Mocked only (Verifies args passed to mock save/update) | Yes |
| 213 | `test_cp25_master_chatbot_and_integrations.test.cjs` | [PASS] Test 26: AVANI AI Agent non-guarantee guardrail & structured audit record | Mocked Mongoose Models (In-Memory) | Yes (Invokes route handler functions with mock Request & mocked DB) | Mocked only (Verifies args passed to mock save/update) | Yes |
| 214 | `test_cp25_master_chatbot_and_integrations.test.cjs` | [PASS] Test 27: Security: Invalid HMAC signature rejected | Mocked Mongoose Models (In-Memory) | Yes (Invokes route handler functions with mock Request & mocked DB) | Mocked only (Verifies args passed to mock save/update) | Yes |
| 215 | `test_cp25_master_chatbot_and_integrations.test.cjs` | [PASS] Test 28: Security: Missing HMAC signature rejected | Mocked Mongoose Models (In-Memory) | Yes (Invokes route handler functions with mock Request & mocked DB) | Mocked only (Verifies args passed to mock save/update) | Yes |
| 216 | `test_cp25_master_chatbot_and_integrations.test.cjs` | [PASS] Test 29: Security: Duplicate webhook event deduplication key determinism | Mocked Mongoose Models (In-Memory) | Yes (Invokes route handler functions with mock Request & mocked DB) | Mocked only (Verifies args passed to mock save/update) | No |
| 217 | `test_cp25_master_chatbot_and_integrations.test.cjs` | [PASS] Test 30: Security: Role-based document access control (RBAC) | Mocked Mongoose Models (In-Memory) | Yes (Invokes route handler functions with mock Request & mocked DB) | Mocked only (Verifies args passed to mock save/update) | Yes |
| 218 | `test_cp25_master_chatbot_and_integrations.test.cjs` | [PASS] Test 31: Security: Service vs Marketing consent separation & opt-out suppression across all 6 channels | Mocked Mongoose Models (In-Memory) | Yes (Invokes route handler functions with mock Request & mocked DB) | Mocked only (Verifies args passed to mock save/update) | Yes |
| 219 | `test_cp25_master_chatbot_and_integrations.test.cjs` | [PASS] Test 32: Security: Sensitive KYC / OTP interception in ordinary WhatsApp chat | Mocked Mongoose Models (In-Memory) | Yes (Invokes route handler functions with mock Request & mocked DB) | Mocked only (Verifies args passed to mock save/update) | No |
| 220 | `test_cp25_master_chatbot_and_integrations.test.cjs` | [PASS] Test 33: Security: Sensitive data log sanitizer redacts PAN, Aadhaar, and tokens | Mocked Mongoose Models (In-Memory) | Yes (Invokes route handler functions with mock Request & mocked DB) | Mocked only (Verifies args passed to mock save/update) | Yes |
| 221 | `test_cp25_master_chatbot_and_integrations.test.cjs` | [PASS] Test 34: Security: Signed document upload token verification, expiry & AES-256-GCM encryption at rest | Mocked Mongoose Models (In-Memory) | Yes (Invokes route handler functions with mock Request & mocked DB) | Mocked only (Verifies args passed to mock save/update) | Yes |
| 222 | `test_cp25_master_chatbot_and_integrations.test.cjs` | [PASS] Test 35: Reliability: Queue worker atomic lease claim supports FAILED and expired PROCESSING retries | Mocked Mongoose Models (In-Memory) | Yes (Invokes route handler functions with mock Request & mocked DB) | Mocked only (Verifies args passed to mock save/update) | No |
| 223 | `test_cp25_master_chatbot_and_integrations.test.cjs` | [PASS] Test 36: Reliability: Failed provider request graceful error handling without crash | Mocked Mongoose Models (In-Memory) | Yes (Invokes route handler functions with mock Request & mocked DB) | Mocked only (Verifies args passed to mock save/update) | No |
| 224 | `test_cp25_master_chatbot_and_integrations.test.cjs` | [PASS] Test 37: Reliability: Database unavailable fail-closed HTTP 503 on webhooks and worker | Mocked Mongoose Models (In-Memory) | Yes (Invokes route handler functions with mock Request & mocked DB) | Mocked only (Verifies args passed to mock save/update) | Yes |
| 225 | `test_cp25_master_chatbot_and_integrations.test.cjs` | [PASS] Test 38: Reliability: OmniDM retry limit guard blocks calls exceeding MAX_OMNIDM_RETRIES | Mocked Mongoose Models (In-Memory) | Yes (Invokes route handler functions with mock Request & mocked DB) | Mocked only (Verifies args passed to mock save/update) | Yes |
| 226 | `test_cp25_master_chatbot_and_integrations.test.cjs` | [PASS] Test 39: Reliability: Duplicate delivery receipt idempotent event ID construction | Mocked Mongoose Models (In-Memory) | Yes (Invokes route handler functions with mock Request & mocked DB) | Mocked only (Verifies args passed to mock save/update) | No |
| 227 | `test_cp25_master_chatbot_and_integrations.test.cjs` | [PASS] Test 40: Reliability: Out-of-order delivery status monotonicity guard prevents status regression | Mocked Mongoose Models (In-Memory) | Yes (Invokes route handler functions with mock Request & mocked DB) | Mocked only (Verifies args passed to mock save/update) | Yes |

### Suite: `test_cp26_1_synthetic_workflows.test.cjs` (10 tests — Hybrid Unit + Static Contract Test)

| # | File | Test Name | Storage / Mocks | Calls API Routes | Verifies DB Read-Back After Update | Auth / Validation Check |
|---:|---|---|---|---|---|---|
| 228 | `test_cp26_1_synthetic_workflows.test.cjs` | [PASS] Test A: Synthetic Doctor Loan lead initialized with clinic details. | In-Memory / Pure TS Logic + Static file inspection | No | No (In-memory object state only) | No |
| 229 | `test_cp26_1_synthetic_workflows.test.cjs` | [PASS] Test B: Advisor Sachin Shinde successfully assigned with audit trail. | In-Memory / Pure TS Logic + Static file inspection | No | No (In-memory object state only) | No |
| 230 | `test_cp26_1_synthetic_workflows.test.cjs` | [PASS] Test C: Lead transitioned from NEW_ENQUIRY to QUALIFIED. | In-Memory / Pure TS Logic + Static file inspection | No | No (In-memory object state only) | No |
| 231 | `test_cp26_1_synthetic_workflows.test.cjs` | [PASS] Test D: D0 Follow-up task marked COMPLETED with outcome notes. | In-Memory / Pure TS Logic + Static file inspection | No | No (In-memory object state only) | No |
| 232 | `test_cp26_1_synthetic_workflows.test.cjs` | [PASS] Test E: Medical degree document checklist item verified. | In-Memory / Pure TS Logic + Static file inspection | No | No (In-memory object state only) | No |
| 233 | `test_cp26_1_synthetic_workflows.test.cjs` | [PASS] Test F: Application submitted to HDFC Bank. | In-Memory / Pure TS Logic + Static file inspection | No | No (In-memory object state only) | No |
| 234 | `test_cp26_1_synthetic_workflows.test.cjs` | [PASS] Test G: Sanction of ₹25,00,000 recorded with interest rate and letter URL. | In-Memory / Pure TS Logic + Static file inspection | No | No (In-memory object state only) | No |
| 235 | `test_cp26_1_synthetic_workflows.test.cjs` | [PASS] Test H: Full disbursement executed with UTR verification. | In-Memory / Pure TS Logic + Static file inspection | No | No (In-memory object state only) | No |
| 236 | `test_cp26_1_synthetic_workflows.test.cjs` | [PASS] Test I: Commission revenue of ₹31,250 fully reconciled. | In-Memory / Pure TS Logic + Static file inspection | No | No (In-memory object state only) | No |
| 237 | `test_cp26_1_synthetic_workflows.test.cjs` | [PASS] Test J: Dashboard conversion funnel and revenue aggregations accurately verified. | In-Memory / Pure TS Logic + Static file inspection | No | No (In-memory object state only) | No |

### Suite: `test_cp26_lead_to_revenue_operations.test.cjs` (20 tests — Hybrid Unit + Static Contract Test)

| # | File | Test Name | Storage / Mocks | Calls API Routes | Verifies DB Read-Back After Update | Auth / Validation Check |
|---:|---|---|---|---|---|---|
| 238 | `test_cp26_lead_to_revenue_operations.test.cjs` | [PASS] CP26-01: Exactly 20 canonical stages defined in CANONICAL_LEAD_STAGES | In-Memory / Pure TS Logic + Static file inspection | Yes (Direct handler import with mocks) | No (In-memory object state only) | No |
| 239 | `test_cp26_lead_to_revenue_operations.test.cjs` | [PASS] CP26-02: Legacy status strings map accurately to canonical CP-26 stages | In-Memory / Pure TS Logic + Static file inspection | Yes (Direct handler import with mocks) | No (In-memory object state only) | No |
| 240 | `test_cp26_lead_to_revenue_operations.test.cjs` | [PASS] CP26-03: Complete loan product suite includes all 9 required categories | In-Memory / Pure TS Logic + Static file inspection | Yes (Direct handler import with mocks) | No (In-memory object state only) | No |
| 241 | `test_cp26_lead_to_revenue_operations.test.cjs` | [PASS] CP26-04: QualificationEngine assigns 80+ High Priority score for fully documented Doctor Loan | In-Memory / Pure TS Logic + Static file inspection | Yes (Direct handler import with mocks) | No (In-memory object state only) | No |
| 242 | `test_cp26_lead_to_revenue_operations.test.cjs` | [PASS] CP26-05: QualificationEngine assigns Low Priority (<40) for incomplete lead with no financials | In-Memory / Pure TS Logic + Static file inspection | Yes (Direct handler import with mocks) | No (In-memory object state only) | No |
| 243 | `test_cp26_lead_to_revenue_operations.test.cjs` | [PASS] CP26-06: FollowUpTaskEngine generates D0 to D30 milestones without sending automated WhatsApp | In-Memory / Pure TS Logic + Static file inspection | Yes (Direct handler import with mocks) | No (In-memory object state only) | No |
| 244 | `test_cp26_lead_to_revenue_operations.test.cjs` | [PASS] CP26-07: FollowUpTaskEngine identifies overdue tasks correctly | In-Memory / Pure TS Logic + Static file inspection | Yes (Direct handler import with mocks) | No (In-memory object state only) | No |
| 245 | `test_cp26_lead_to_revenue_operations.test.cjs` | [PASS] CP26-08: Document checklist generator provides mandatory medical registration for Doctor Loans | In-Memory / Pure TS Logic + Static file inspection | Yes (Direct handler import with mocks) | No (In-memory object state only) | No |
| 246 | `test_cp26_lead_to_revenue_operations.test.cjs` | [PASS] CP26-09: Document checklist provides Audited Balance Sheet & Campus Title for School Funding | In-Memory / Pure TS Logic + Static file inspection | Yes (Direct handler import with mocks) | No (In-memory object state only) | No |
| 247 | `test_cp26_lead_to_revenue_operations.test.cjs` | [PASS] CP26-10: Default partner lenders contain verified institutions with indicative terms | In-Memory / Pure TS Logic + Static file inspection | Yes (Direct handler import with mocks) | No (In-memory object state only) | No |
| 248 | `test_cp26_lead_to_revenue_operations.test.cjs` | [PASS] CP26-11: Default advisor profile includes Sachin Shinde as CHIEF_LOAN_ADVISOR | In-Memory / Pure TS Logic + Static file inspection | Yes (Direct handler import with mocks) | No (In-memory object state only) | No |
| 249 | `test_cp26_lead_to_revenue_operations.test.cjs` | [PASS] CP26-12 [Case A]: Doctor Loan enquiry initializes to NEW_ENQUIRY with Doctor Loan profile | In-Memory / Pure TS Logic + Static file inspection | Yes (Direct handler import with mocks) | No (In-memory object state only) | No |
| 250 | `test_cp26_lead_to_revenue_operations.test.cjs` | [PASS] CP26-13 [Case B]: Business Loan lead with missing turnover reflects NEEDS_FURTHER_INFO tier | In-Memory / Pure TS Logic + Static file inspection | Yes (Direct handler import with mocks) | No (In-memory object state only) | Yes |
| 251 | `test_cp26_lead_to_revenue_operations.test.cjs` | [PASS] CP26-14 [Case C]: Home Loan lead with documents pending remains in DOCUMENTS_PENDING | In-Memory / Pure TS Logic + Static file inspection | Yes (Direct handler import with mocks) | No (In-memory object state only) | No |
| 252 | `test_cp26_lead_to_revenue_operations.test.cjs` | [PASS] CP26-15 [Case D]: School Funding lead requires campus land proof and audited balance sheet | In-Memory / Pure TS Logic + Static file inspection | Yes (Direct handler import with mocks) | No (In-memory object state only) | No |
| 253 | `test_cp26_lead_to_revenue_operations.test.cjs` | [PASS] CP26-16 [Case E]: Application submitted to lender tracks lender name and application number | In-Memory / Pure TS Logic + Static file inspection | Yes (Direct handler import with mocks) | No (In-memory object state only) | No |
| 254 | `test_cp26_lead_to_revenue_operations.test.cjs` | [PASS] CP26-17 [Case F]: Sanctioned loan distinguishes sanctioned amount from disbursed amount | In-Memory / Pure TS Logic + Static file inspection | Yes (Direct handler import with mocks) | No (In-memory object state only) | No |
| 255 | `test_cp26_lead_to_revenue_operations.test.cjs` | [PASS] CP26-18 [Case G]: Disbursed loan reconciles actual revenue collected against invoice number | In-Memory / Pure TS Logic + Static file inspection | Yes (Direct handler import with mocks) | No (In-memory object state only) | No |
| 256 | `test_cp26_lead_to_revenue_operations.test.cjs` | [PASS] CP26-19: Conversion rates compute correctly without division by zero | In-Memory / Pure TS Logic + Static file inspection | Yes (Direct handler import with mocks) | No (In-memory object state only) | No |
| 257 | `test_cp26_lead_to_revenue_operations.test.cjs` | [PASS] CP26-20: Production safeguards remain uncompromised | In-Memory / Pure TS Logic + Static file inspection | Yes (Direct handler import with mocks) | No (In-memory object state only) | Yes |

### Suite: `test_drip_workflow_and_api_endpoints.test.cjs` (8 tests — Unit Test)

| # | File | Test Name | Storage / Mocks | Calls API Routes | Verifies DB Read-Back After Update | Auth / Validation Check |
|---:|---|---|---|---|---|---|
| 258 | `test_drip_workflow_and_api_endpoints.test.cjs` | Test 7.1: Canonical 8 loan products are strictly enumerated and complete | In-Memory / Pure JS/TS | No (Imports/Inspects source directly) | No (In-memory assertion only) | No |
| 259 | `test_drip_workflow_and_api_endpoints.test.cjs` | Test 7.2: Drip schedule thresholds match Day 1 (24h), Day 3 (72h), Day 7 (168h), Day 10 (240h), Day 15 (360h) | In-Memory / Pure JS/TS | No (Imports/Inspects source directly) | No (In-memory assertion only) | No |
| 260 | `test_drip_workflow_and_api_endpoints.test.cjs` | Test 7.3: Direct Message endpoint rejects opted-out contacts | In-Memory / Pure JS/TS | No (Imports/Inspects source directly) | No (In-memory assertion only) | Yes |
| 261 | `test_drip_workflow_and_api_endpoints.test.cjs` | Test 7.4: Bulk Message endpoint suppresses opted-out recipients from campaign | In-Memory / Pure JS/TS | No (Imports/Inspects source directly) | No (In-memory assertion only) | No |
| 262 | `test_drip_workflow_and_api_endpoints.test.cjs` | Test 7.5: CSV parser normalizes mixed phone formats to +91XXXXXXXXXX | In-Memory / Pure JS/TS | No (Imports/Inspects source directly) | No (In-memory assertion only) | No |
| 263 | `test_drip_workflow_and_api_endpoints.test.cjs` | Test 7.6: Opts Management registry models DPDP Act 2023 compliance status | In-Memory / Pure JS/TS | No (Imports/Inspects source directly) | No (In-memory assertion only) | Yes |
| 264 | `test_drip_workflow_and_api_endpoints.test.cjs` | Test 7.7: Statutory disclaimer prevents misrepresentation as direct lender or NBFC | In-Memory / Pure JS/TS | No (Imports/Inspects source directly) | No (In-memory assertion only) | No |
| 265 | `test_drip_workflow_and_api_endpoints.test.cjs` | Test 7.8: Schedule model enforces persistence, duplicate prevention, and execution tracking | In-Memory / Pure JS/TS | No (Imports/Inspects source directly) | No (In-memory assertion only) | No |

### Suite: `test_gate3_synthetic_safety.test.cjs` (5 tests — Mocked API Route Integration Test)

| # | File | Test Name | Storage / Mocks | Calls API Routes | Verifies DB Read-Back After Update | Auth / Validation Check |
|---:|---|---|---|---|---|---|
| 266 | `test_gate3_synthetic_safety.test.cjs` | Proposed phone +919999999999 is normalized and accepted by route regex | Mocked Mongoose Models (In-Memory) | Yes (Invokes route handler functions with mock Request & mocked DB) | Mocked only (Verifies args passed to mock save/update) | No |
| 267 | `test_gate3_synthetic_safety.test.cjs` | Collision Risk: Static phone without pre-flight check overwrites pre-existing lead | Mocked Mongoose Models (In-Memory) | Yes (Invokes route handler functions with mock Request & mocked DB) | Mocked only (Verifies args passed to mock save/update) | No |
| 268 | `test_gate3_synthetic_safety.test.cjs` | Safe Design: Pre-flight probe halts test if phone already exists | Mocked Mongoose Models (In-Memory) | Yes (Invokes route handler functions with mock Request & mocked DB) | Mocked only (Verifies args passed to mock save/update) | No |
| 269 | `test_gate3_synthetic_safety.test.cjs` | Safe Design: Dynamic timestamped identifier and randomized phone guarantee zero collision | Mocked Mongoose Models (In-Memory) | Yes (Invokes route handler functions with mock Request & mocked DB) | Mocked only (Verifies args passed to mock save/update) | No |
| 270 | `test_gate3_synthetic_safety.test.cjs` | Architecture Check: Confirm that CRM API does not expose HTTP DELETE | Mocked Mongoose Models (In-Memory) | Yes (Invokes route handler functions with mock Request & mocked DB) | Mocked only (Verifies args passed to mock save/update) | No |

### Suite: `test_gate4_isolated_staging_safety.test.cjs` (8 tests — Unit Test)

| # | File | Test Name | Storage / Mocks | Calls API Routes | Verifies DB Read-Back After Update | Auth / Validation Check |
|---:|---|---|---|---|---|---|
| 271 | `test_gate4_isolated_staging_safety.test.cjs` | Coverage 1: Database connection readiness handles online (200) and offline (503) | In-Memory / Pure JS/TS | No (Imports/Inspects source directly) | No (In-memory assertion only) | No |
| 272 | `test_gate4_isolated_staging_safety.test.cjs` | Coverage 2: Synthetic lead creation creates new document with valid normalization | In-Memory / Pure JS/TS | No (Imports/Inspects source directly) | No (In-memory assertion only) | No |
| 273 | `test_gate4_isolated_staging_safety.test.cjs` | Coverage 3: Read-back verification locates created lead by phone and marker | In-Memory / Pure JS/TS | No (Imports/Inspects source directly) | No (In-memory assertion only) | No |
| 274 | `test_gate4_isolated_staging_safety.test.cjs` | Coverage 4: Duplicate submission updates existing lead in-place without creating second record | In-Memory / Pure JS/TS | No (Imports/Inspects source directly) | No (In-memory assertion only) | No |
| 275 | `test_gate4_isolated_staging_safety.test.cjs` | Coverage 5: Opt-out handling forces status to OPTED_OUT and records timestamp | In-Memory / Pure JS/TS | No (Imports/Inspects source directly) | No (In-memory assertion only) | Yes |
| 276 | `test_gate4_isolated_staging_safety.test.cjs` | Coverage 6: Contact and Lead consistency verifies dual upsert across both collections | In-Memory / Pure JS/TS | No (Imports/Inspects source directly) | No (In-memory assertion only) | No |
| 277 | `test_gate4_isolated_staging_safety.test.cjs` | Coverage 7: Targeted cleanup purges synthetic records from both collections using exact marker & id | In-Memory / Pure JS/TS | No (Imports/Inspects source directly) | No (In-memory assertion only) | No |
| 278 | `test_gate4_isolated_staging_safety.test.cjs` | Coverage 8: Zero external communications attempted during entire lifecycle | In-Memory / Pure JS/TS | No (Imports/Inspects source directly) | No (In-memory assertion only) | No |

### Suite: `test_gate5_staging_configuration.test.cjs` (12 tests — Static Source / Contract Verification Test)

| # | File | Test Name | Storage / Mocks | Calls API Routes | Verifies DB Read-Back After Update | Auth / Validation Check |
|---:|---|---|---|---|---|---|
| 279 | `test_gate5_staging_configuration.test.cjs` | Staging example configuration file exists on disk | None (Static AST/Regex file inspection) | No | No | No |
| 280 | `test_gate5_staging_configuration.test.cjs` | Staging example mandates APP_MODE=staging and PROVIDER_MODE=mock | None (Static AST/Regex file inspection) | No | No | No |
| 281 | `test_gate5_staging_configuration.test.cjs` | Staging example does NOT reference production database or production cluster | None (Static AST/Regex file inspection) | No | No | No |
| 282 | `test_gate5_staging_configuration.test.cjs` | Staging MongoDB URI database name contains avani_ai_crm_test | None (Static AST/Regex file inspection) | No | No | No |
| 283 | `test_gate5_staging_configuration.test.cjs` | src/lib/db.ts guard rejects avani_ai_crm_prod when APP_MODE=staging | None (Static AST/Regex file inspection) | No | No | Yes |
| 284 | `test_gate5_staging_configuration.test.cjs` | src/lib/db.ts guard rejects unapproved avani_ai_crm_staging when APP_MODE=staging | None (Static AST/Regex file inspection) | No | No | Yes |
| 285 | `test_gate5_staging_configuration.test.cjs` | src/lib/db.ts guard allows avani_ai_crm_test when APP_MODE=staging and PROVIDER_MODE=mock | None (Static AST/Regex file inspection) | No | No | Yes |
| 286 | `test_gate5_staging_configuration.test.cjs` | src/lib/db.ts guard blocks live provider in staging unless explicitly authorized | None (Static AST/Regex file inspection) | No | No | Yes |
| 287 | `test_gate5_staging_configuration.test.cjs` | Voice provider halts dispatch when OMNIDM_LIVE_ENABLED !== true | None (Static AST/Regex file inspection) | No | No | No |
| 288 | `test_gate5_staging_configuration.test.cjs` | Proposed Meta Cloud guard intercepts dispatch in mock mode even with live tokens | None (Static AST/Regex file inspection) | No | No | Yes |
| 289 | `test_gate5_staging_configuration.test.cjs` | Proposed Postgres guard rejects production Supabase URL when APP_MODE=staging | None (Static AST/Regex file inspection) | No | No | Yes |
| 290 | `test_gate5_staging_configuration.test.cjs` | Proposed Postgres guard allows isolated staging URL when APP_MODE=staging | None (Static AST/Regex file inspection) | No | No | Yes |

### Suite: `test_inbound_message_persistence_and_crm_inbox.test.cjs` (12 tests — Unit Test)

| # | File | Test Name | Storage / Mocks | Calls API Routes | Verifies DB Read-Back After Update | Auth / Validation Check |
|---:|---|---|---|---|---|---|
| 291 | `test_inbound_message_persistence_and_crm_inbox.test.cjs` | Test 1: Valid inbound message persists successfully with status RECEIVED | In-Memory / Pure JS/TS | No (Imports/Inspects source directly) | No (In-memory assertion only) | No |
| 292 | `test_inbound_message_persistence_and_crm_inbox.test.cjs` | Test 2: Schema enum supports uppercase RECEIVED and title-case Received | In-Memory / Pure JS/TS | No (Imports/Inspects source directly) | No (In-memory assertion only) | No |
| 293 | `test_inbound_message_persistence_and_crm_inbox.test.cjs` | Test 3: Schema enum strictly rejects invalid statuses with Mongoose validation error | In-Memory / Pure JS/TS | No (Imports/Inspects source directly) | No (In-memory assertion only) | Yes |
| 294 | `test_inbound_message_persistence_and_crm_inbox.test.cjs` | Test 4: Inbound message upserts both Lead and Contact records with correct phone | In-Memory / Pure JS/TS | No (Imports/Inspects source directly) | No (In-memory assertion only) | No |
| 295 | `test_inbound_message_persistence_and_crm_inbox.test.cjs` | Test 5: Conversation history associates inbound user message text and timestamp | In-Memory / Pure JS/TS | No (Imports/Inspects source directly) | No (In-memory assertion only) | No |
| 296 | `test_inbound_message_persistence_and_crm_inbox.test.cjs` | Test 6: CRM Inbox API formats and returns messages for the active contact | In-Memory / Pure JS/TS | No (Imports/Inspects source directly) | No (In-memory assertion only) | No |
| 297 | `test_inbound_message_persistence_and_crm_inbox.test.cjs` | Test 7: Replaying exact same message ID does not create duplicate message | In-Memory / Pure JS/TS | No (Imports/Inspects source directly) | No (In-memory assertion only) | No |
| 298 | `test_inbound_message_persistence_and_crm_inbox.test.cjs` | Test 8: Database failure in worker throws exception for provider retry instead of swallowing | In-Memory / Pure JS/TS | No (Imports/Inspects source directly) | No (In-memory assertion only) | No |
| 299 | `test_inbound_message_persistence_and_crm_inbox.test.cjs` | Test 9: AISENSY_INBOUND_WEBHOOK_ENABLED=false saves message and updates Lead to CUSTOMER_REPLIED_HUMAN_FOLLOWUP | In-Memory / Pure JS/TS | No (Imports/Inspects source directly) | No (In-memory assertion only) | No |
| 300 | `test_inbound_message_persistence_and_crm_inbox.test.cjs` | Test 10: Inbound opt-out keyword (थांबवा / STOP) sets status OPTED_OUT and halts automated followups | In-Memory / Pure JS/TS | No (Imports/Inspects source directly) | No (In-memory assertion only) | Yes |
| 301 | `test_inbound_message_persistence_and_crm_inbox.test.cjs` | Test 11: Outbound clamp restricts live messaging to authorized test contact (+91 91756 35165) | In-Memory / Pure JS/TS | No (Imports/Inspects source directly) | No (In-memory assertion only) | Yes |
| 302 | `test_inbound_message_persistence_and_crm_inbox.test.cjs` | Test 12: Meta and ChatMitra routes maintain distinct signature headers and signing contracts | In-Memory / Pure JS/TS | No (Imports/Inspects source directly) | No (In-memory assertion only) | Yes |

### Suite: `test_master_automation_workflows.test.cjs` (14 tests — Unit Test)

| # | File | Test Name | Storage / Mocks | Calls API Routes | Verifies DB Read-Back After Update | Auth / Validation Check |
|---:|---|---|---|---|---|---|
| 303 | `test_master_automation_workflows.test.cjs` | Workflow A1: Validates and normalizes all 8 required loan products | In-Memory / Pure JS/TS | No (Imports/Inspects source directly) | No (In-memory assertion only) | No |
| 304 | `test_master_automation_workflows.test.cjs` | Workflow A2: Rejects invalid or incomplete phone numbers | In-Memory / Pure JS/TS | No (Imports/Inspects source directly) | No (In-memory assertion only) | Yes |
| 305 | `test_master_automation_workflows.test.cjs` | Workflow A3: Enforces DPDP Act Consent Gate (Rejects missing/denied consent) | In-Memory / Pure JS/TS | No (Imports/Inspects source directly) | No (In-memory assertion only) | Yes |
| 306 | `test_master_automation_workflows.test.cjs` | Workflow A4: Generates canonical Lead ID matching AVL-YYYYMMDD-XXXXXX format | In-Memory / Pure JS/TS | No (Imports/Inspects source directly) | No (In-memory assertion only) | No |
| 307 | `test_master_automation_workflows.test.cjs` | Workflow A5: Idempotency deduplication matches existing lead by phone or key | In-Memory / Pure JS/TS | No (Imports/Inspects source directly) | No (In-memory assertion only) | No |
| 308 | `test_master_automation_workflows.test.cjs` | Workflow B1: Inbound Webhook validates valid HMAC-SHA256 signature | In-Memory / Pure JS/TS | No (Imports/Inspects source directly) | No (In-memory assertion only) | Yes |
| 309 | `test_master_automation_workflows.test.cjs` | Workflow B2: Inbound Webhook rejects tampered body or invalid signature | In-Memory / Pure JS/TS | No (Imports/Inspects source directly) | No (In-memory assertion only) | Yes |
| 310 | `test_master_automation_workflows.test.cjs` | Workflow B3: Webhook deduplication rejects replayed messageId | In-Memory / Pure JS/TS | No (Imports/Inspects source directly) | No (In-memory assertion only) | Yes |
| 311 | `test_master_automation_workflows.test.cjs` | Workflow B4: Opt-out suppression suppresses messaging on STOP/UNSUBSCRIBE | In-Memory / Pure JS/TS | No (Imports/Inspects source directly) | No (In-memory assertion only) | Yes |
| 312 | `test_master_automation_workflows.test.cjs` | Workflow C1: Anti-hallucination guard rejects guaranteed loan approval claims | In-Memory / Pure JS/TS | No (Imports/Inspects source directly) | No (In-memory assertion only) | Yes |
| 313 | `test_master_automation_workflows.test.cjs` | Workflow C2: Triggers human advisor handoff on complex or non-loan requests | In-Memory / Pure JS/TS | No (Imports/Inspects source directly) | No (In-memory assertion only) | No |
| 314 | `test_master_automation_workflows.test.cjs` | Workflow D1: Follow-up sequence maps D0, D1, D3, D7, D10, D15 steps correctly | In-Memory / Pure JS/TS | No (Imports/Inspects source directly) | No (In-memory assertion only) | No |
| 315 | `test_master_automation_workflows.test.cjs` | Workflow D2: Campaign scheduler suppresses opted-out recipients | In-Memory / Pure JS/TS | No (Imports/Inspects source directly) | No (In-memory assertion only) | No |
| 316 | `test_master_automation_workflows.test.cjs` | Workflow E1: Voice AI Calling hard killswitch is strictly enforced (OMNIDM_LIVE_ENABLED=false) | In-Memory / Pure JS/TS | No (Imports/Inspects source directly) | No (In-memory assertion only) | No |

### Suite: `test_stage4_mongodb_application_integration.test.cjs` (8 tests — Unit Test)

| # | File | Test Name | Storage / Mocks | Calls API Routes | Verifies DB Read-Back After Update | Auth / Validation Check |
|---:|---|---|---|---|---|---|
| 317 | `test_stage4_mongodb_application_integration.test.cjs` | Configuration Guard: Enforces non-infinite connection and server selection timeouts | In-Memory / Pure JS/TS | No (Imports/Inspects source directly) | No (In-memory assertion only) | Yes |
| 318 | `test_stage4_mongodb_application_integration.test.cjs` | Database Selection Guard: Rejects production database in test or staging modes | In-Memory / Pure JS/TS | No (Imports/Inspects source directly) | No (In-memory assertion only) | Yes |
| 319 | `test_stage4_mongodb_application_integration.test.cjs` | Cross-Project Cluster Mapping: Rejects cross-project cluster hostnames | In-Memory / Pure JS/TS | No (Imports/Inspects source directly) | No (In-memory assertion only) | Yes |
| 320 | `test_stage4_mongodb_application_integration.test.cjs` | Synthetic Marker Guard: Enforces testRunId and marker on all test records | In-Memory / Pure JS/TS | No (Imports/Inspects source directly) | No (In-memory assertion only) | Yes |
| 321 | `test_stage4_mongodb_application_integration.test.cjs` | Idempotency & Duplicate Key: Simulates unique key collision and handles duplicate gracefully | In-Memory / Pure JS/TS | No (Imports/Inspects source directly) | No (In-memory assertion only) | No |
| 322 | `test_stage4_mongodb_application_integration.test.cjs` | Targeted Cleanup Guard: Purge queries MUST include both recordId and synthetic marker | In-Memory / Pure JS/TS | No (Imports/Inspects source directly) | No (In-memory assertion only) | Yes |
| 323 | `test_stage4_mongodb_application_integration.test.cjs` | Diagnostic Masking Guard: Database URIs never print plaintext credentials | In-Memory / Pure JS/TS | No (Imports/Inspects source directly) | No (In-memory assertion only) | Yes |
| 324 | `test_stage4_mongodb_application_integration.test.cjs` | Staging Provider Lockout Guard: Zero live dispatches permitted when APP_MODE=staging | In-Memory / Pure JS/TS | No (Imports/Inspects source directly) | No (In-memory assertion only) | Yes |

### Suite: `test_webhook_signature_forensics.test.cjs` (11 tests — Unit Test)

| # | File | Test Name | Storage / Mocks | Calls API Routes | Verifies DB Read-Back After Update | Auth / Validation Check |
|---:|---|---|---|---|---|---|
| 325 | `test_webhook_signature_forensics.test.cjs` | Signature Acceptance: Valid HMAC-SHA256 on x-webhook-signature returns HTTP 200 | In-Memory / Pure JS/TS | No (Imports/Inspects source directly) | No (In-memory assertion only) | Yes |
| 326 | `test_webhook_signature_forensics.test.cjs` | Prefix Handling: Valid signature with sha256= prefix on x-hub-signature-256 accepted | In-Memory / Pure JS/TS | No (Imports/Inspects source directly) | No (In-memory assertion only) | Yes |
| 327 | `test_webhook_signature_forensics.test.cjs` | Signature Rejection: Forged or invalid signature returns HTTP 401 | In-Memory / Pure JS/TS | No (Imports/Inspects source directly) | No (In-memory assertion only) | Yes |
| 328 | `test_webhook_signature_forensics.test.cjs` | Missing Signature Guard: ChatMitra payload with missing signature header returns HTTP 401 | In-Memory / Pure JS/TS | No (Imports/Inspects source directly) | No (In-memory assertion only) | Yes |
| 329 | `test_webhook_signature_forensics.test.cjs` | Tampering Detection: Modification of payload body after signing returns HTTP 401 | In-Memory / Pure JS/TS | No (Imports/Inspects source directly) | No (In-memory assertion only) | Yes |
| 330 | `test_webhook_signature_forensics.test.cjs` | Provider Discrimination: Meta WABA payload validated with META_APP_SECRET | In-Memory / Pure JS/TS | No (Imports/Inspects source directly) | No (In-memory assertion only) | Yes |
| 331 | `test_webhook_signature_forensics.test.cjs` | False 401 Prevention: Meta WABA payload with unset META_APP_SECRET does not produce false ChatMitra 401 | In-Memory / Pure JS/TS | No (Imports/Inspects source directly) | No (In-memory assertion only) | Yes |
| 332 | `test_webhook_signature_forensics.test.cjs` | Malformed Payload Guard: Invalid JSON syntax returns HTTP 400 before DB or processing | In-Memory / Pure JS/TS | No (Imports/Inspects source directly) | No (In-memory assertion only) | Yes |
| 333 | `test_webhook_signature_forensics.test.cjs` | Timing-Safe Comparison: Evaluates full buffer equality and rejects mismatched length safely | In-Memory / Pure JS/TS | No (Imports/Inspects source directly) | No (In-memory assertion only) | Yes |
| 334 | `test_webhook_signature_forensics.test.cjs` | Idempotent Ingestion: Duplicate eventId is safely swallowed without duplicate ledger entries | In-Memory / Pure JS/TS | No (Imports/Inspects source directly) | No (In-memory assertion only) | No |
| 335 | `test_webhook_signature_forensics.test.cjs` | Telemetry Hygiene: Log outputs mask secret values and contain zero plaintext credentials | In-Memory / Pure JS/TS | No (Imports/Inspects source directly) | No (In-memory assertion only) | Yes |
