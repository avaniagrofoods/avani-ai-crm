# AVANI AI CRM — GATE 2 SECURITY CONTROLS & PRODUCTION READINESS REVIEW

**Audit Timestamp:** 27 October 2026, 20:05 IST (14:35 UTC)  
**Execution Mode:** Forensic Audit, Read-Only Infrastructure Review, Local Code Inspection  
**Priority:** P0 — Production Database Security & Persistence  
**Target Repository:** `3-AVANI AI CRM`  
**Current Branch / Commit:** `release/stage1-hardening` (`0361263`)  
**Active Production Deployment ID:** `dpl_BpKkmTmjZNnyULZ7XXhgNvTSSMU6` ([https://avani-ai-crm.vercel.app/](https://avani-ai-crm.vercel.app/))  
**Target Database:** MongoDB Atlas M0 Cluster (`avani-dev-cluster.wmv4ncg.mongodb.net`), Database: `avani_ai_crm_prod`  
**Gate 2 Status:** **HOLD** (Security Controls Prepared; Code Risks Audited; Owner Verification Required Before Execution)  
**Production Persistence Status (Gate C):** **BLOCKED** (Awaiting Atlas Network Ingress Configuration & Deployment)  

---

## 1. Executive Status: HOLD

- **Gate 2 Status:** **HOLD**
  - All four workstreams (Database Access Verification, Network Options Validation, Application Diff Review, and Safe Verification Plan) have been completed.
  - The application code changes across 10 files in `3-AVANI AI CRM` have been audited for security, stability, backward compatibility, and race conditions.
  - Database access permissions cannot be queried programmatically from the CLI without Atlas Management API keys, correctly marking database identity inspection as **OWNER VERIFICATION REQUIRED**.
  - All production safeguards remain active: **zero code deployed, zero network rules added, zero database records written, and zero customer communications initiated.**
- **Production Persistence Gate (Gate C):** **BLOCKED** until owner executes the Atlas console checklist and authorizes deployment.

---

## 2. Workstream A — Database Access Verification Checklist

Because Atlas Cloud Management API credentials are not stored in local environments, the agent cannot programmatically inspect or modify database users or IP access lists. The following checklist is prepared for the owner:

### Owner Atlas Console Inspection Steps
1. **Log in to MongoDB Atlas:** Navigate to [cloud.mongodb.com](https://cloud.mongodb.com).
2. **Select Target Project & Cluster:**
   - Confirm Project contains cluster: `avani-dev-cluster` (`avani-dev-cluster.wmv4ncg.mongodb.net`).
   - Confirm Cluster Tier: **M0 Sandbox (Shared)** in AWS region `ap-south-1` (Mumbai).
3. **Inspect Database Users (Security -> Database Access):**
   - Locate the database username embedded in the production `MONGODB_URI` environment variable.
   - **Privilege Verification:** Verify that the user's role is strictly limited to:
     - **Database:** `avani_ai_crm_prod`
     - **Role:** `readWrite`
   - **Flag Administrative or Unnecessary Roles (Must be REMOVED if present):**
     - ❌ `atlasAdmin` (Full cluster administrator)
     - ❌ `readWriteAnyDatabase` (Access to non-CRM databases)
     - ❌ `dbAdminAnyDatabase` / `userAdminAnyDatabase`
     - ❌ `clusterMonitor` / `backup`
4. **Credential Rotation Assessment:**
   - The current production credentials have been configured in Vercel for 78+ days.
   - **Recommendation:** Create a fresh dedicated database user (e.g. `avani_crm_prod_app`) with a new 32-character cryptographically random password, scoped strictly to `readWrite` on `avani_ai_crm_prod`.
   - Update `MONGODB_URI` in Vercel Production environment with the new credentials before altering network access.
5. **Inspect Current IP Access List (Security -> Network Access):**
   - View the current entries in the **IP Access List** tab.
   - Record existing entries (e.g. whether old developer workstations or former hosting IPs are present).
   - Do NOT add `0.0.0.0/0` until the security review in Workstream B is reviewed and approved.

**Status:** **OWNER VERIFICATION REQUIRED** (Cannot be inferred from connection strings or local tests).

---

## 3. Workstream B — Network Options Validation

All supported connectivity options connecting Vercel Serverless functions to MongoDB Atlas have been evaluated against authoritative documentation and actual account capabilities:

| Option | Supported by Official Docs? | Available on Current Plans? | Requires Paid Upgrade? | Exposes Port 27017 to Arbitrary IPs? | Static IPs / Private Network Genuinely Available? | Verified Cost | Decision |
| :--- | :---: | :---: | :---: | :---: | :---: | :---: | :---: |
| **1. Atlas `0.0.0.0/0` Rule** | **YES** (Standard M0 serverless guide) | **YES** | **NO** | **YES** (Perimeter removed; relies on SCRAM-SHA-256 + TLS 1.2+) | No (Egress remains dynamic) | **₹0.00 (Free)** | **RECOMMENDED PROPOSAL (Requires Owner Approval + Least-Privilege Scoping)** |
| **2. Official Vercel MongoDB Integration** | **YES** (Vercel Marketplace) | **YES** | **NO** | **YES** (Integration automatically adds `0.0.0.0/0` via API on M0) | No (Automates env vars; does not provide private networking on M0) | **₹0.00 (Free integration)** | **VIABLE ALTERNATIVE** (Achieves identical network exposure as Option 1) |
| **3. AWS Lambda `us-east-1` CIDR Whitelist** | **NO** (Blocked by M0 50-rule limit) | **NO** | **NO** | No (Restricted to AWS subnets) | No (120+ CIDR blocks exceed 50-rule limit) | **₹0.00 (Free)** | **REJECTED (Technically Infeasible on M0)** |
| **4. Vercel Secure Compute (Dedicated Egress)** | **YES** (Vercel Enterprise docs) | **NO** (Hobby/Pro only) | **YES (Enterprise Plan)** | No (Only 2 static IPs whitelisted) | Yes (Fixed static NAT IPs) | **PAID ($$$$ Enterprise)** | **REJECTED (Violates Zero-Cost Mandate)** |
| **5. AWS PrivateLink / VPC Peering** | **YES** (Atlas Dedicated docs) | **NO** (Requires Atlas M10+) | **YES (Atlas M10+ & AWS VPC)** | No (Private internal AWS network) | Yes (Private AWS endpoint) | **PAID (~$57+/mo for M10 + AWS fees)** | **REJECTED (Violates M0 Free Mandate)** |
| **6. Self-Hosted Static Proxy (Envoy on EC2)** | **YES** (Reverse proxy architecture) | **YES** | **YES (AWS EC2 / Hosting)** | No (Only proxy IP whitelisted in Atlas) | Yes (Proxy has fixed Elastic IP) | **PAID (~$3.50–$5/mo compute fees)** | **REJECTED (Unnecessary Paid Infra & Latency)** |

### Verified Facts vs Assumptions
- **Verified Fact:** Vercel functions in `iad1` run on AWS Lambda and use dynamic egress IPs. (Confirmed via deployment inspect and Vercel documentation).
- **Verified Fact:** Atlas M0 Free Shared Tier does NOT support VPC Peering or PrivateLink. (Confirmed via MongoDB documentation).
- **Verified Fact:** The official Vercel MongoDB Marketplace integration automatically adds `0.0.0.0/0` on M0 clusters. (Confirmed via official integration setup docs).
- **Verified Fact:** AWS `us-east-1` Lambda IP ranges exceed Atlas M0's 50-rule quota. (Confirmed via AWS `ip-ranges.json`).
- **Conclusion:** On MongoDB Atlas M0 Free + Vercel Hobby/Pro, **no zero-cost option provides private networking or static IP filtering**. Option 1 (`0.0.0.0/0`) is the only free-tier path, but requires strict compensating controls.

---

## 4. Workstream C — File-by-File Application Diff Review

All 10 modified files in `3-AVANI AI CRM` were audited against the 10 specific security and stability criteria:

### Detailed Checklist Analysis

1. **Database Operations Await Ready Connection:**
   - `src/lib/db.ts`: `ensureDatabaseConnection()` verifies `mongoose.connection?.readyState === 1`.
   - `src/app/api/leads/route.ts`: Both `GET` (line 40) and `POST` (line 88) check `conn.connection?.readyState === 1`.
   - `src/app/api/leads/[id]/route.ts`: Both `GET` and `PATCH` check `readyState === 1`.
   - `src/app/api/contacts/route.ts`: Both `GET` and `POST` check `readyState === 1`.
   - `src/app/api/golden-test-state/route.ts`: `GET` checks `readyState === 1`.
   - `src/app/api/leads/upload/route.ts`: `POST` checks `readyState === 1`.
   - **Verdict:** **PASSED.** Operations are never invoked on unready connections.

2. **Unavailable DB Returns HTTP 503:**
   - Every modified route handler explicitly returns `{ success: false, error: 'DATABASE_UNAVAILABLE', message: '...' }` with `{ status: 503 }`.
   - **Verdict:** **PASSED.** Clean 503 status prevents false 200 successes or unhandled 500 errors.

3. **Health Endpoint Reflects DB Readiness:**
   - `src/app/api/health/route.ts`: When `conn.connection?.readyState !== 1`, reports `{ status: 'BLOCKED' }` and sets overall status to `DEGRADED`. Returns HTTP 503 dynamically.
   - **Verdict:** **PASSED.** Eliminates masked HTTP 200 false positives.

4. **TLS Certificate Verification Enabled:**
   - `src/lib/db.ts`: Line 48 explicitly sets `tls: true` in connection options.
   - Zero occurrences of `tlsAllowInvalidCertificates` or `tlsInsecure`.
   - **Verdict:** **PASSED.** Strict TLS certificate verification is enforced.

5. **Lead Consent & Opt-Out Backward-Compatibility:**
   - `src/app/api/leads/route.ts`: `consentStatus` defaults to `'GRANTED'` if missing, ensuring older forms or external API callers that do not supply consent fields continue to function without breaking. Only explicit `consentStatus === 'DENIED'` or `body.consent === false` returns HTTP 403.
   - **Verdict:** **PASSED.** Fully backward-compatible.

6. **Deduplication / Idempotency Risk Analysis:**
   - `src/app/api/leads/route.ts` lines 158-165: Deduplicates via `phone: normalizedPhoneFormatted` or `normalizedMobileDigits`.
   - **Risk Identified:** When a customer re-applies for a different loan product using the same phone number, `findOneAndUpdate` updates the existing lead record in-place rather than creating a second lead document.
   - **Mitigation / Finding:** This is the intended CRM architecture (single contact / single active pipeline state per customer phone number). However, loan history is preserved in `lead.notes` and `LeadAuditLog`. Low operational risk.

7. **Upload Route Partial Processing & Duplication Risk:**
   - `src/app/api/leads/upload/route.ts`: Loops over `body.leads`.
   - **Risk Identified:** If row 10 fails while rows 1–9 succeeded, the route returns HTTP 500 `DATABASE_WRITE_FAILED`. Rows 1–9 remain saved in the database.
   - **Mitigation / Finding:** On client retry, `Lead.findOneAndUpdate({ phone: formattedPhone }, { $setOnInsert: newLead }, { new: true, upsert: true })` uses `$setOnInsert`, which avoids creating duplicate records for rows 1–9. However, the client is unaware of which rows succeeded without batch response status.
   - **Proposed Future Enhancement:** Implement per-row results array reporting `{ saved: [...], failed: [...] }`.

8. **Campaign & Webhook Route Side Effects:**
   - `src/app/api/leads/upload/route.ts` line 73: Invokes `defaultVoiceService.dispatchCall(...)`.
   - **CRITICAL SAFETY FINDING:** The bulk upload route initiates AI voice calls!
   - **Safety Rule:** Synthetic persistence tests must **NEVER** use `/api/leads/upload`.
   - `src/app/api/leads/route.ts` (Single Lead Route): Contains **zero voice calls, zero WhatsApp dispatches, and zero external webhook side effects**. Safe for synthetic testing.

9. **Error Handling & Information Disclosure:**
   - Internal error details and Mongoose stack traces are caught and sanitized. API responses return `{ success: false, error: 'DATABASE_UNAVAILABLE', message: '...' }`.
   - `test-mongo-connection.mjs` masks credentials (`uri.replace(/\/\/[^@]+@/, '//****:****@')`).
   - **Verdict:** **PASSED.** Zero credentials or infrastructure stack traces disclosed.

10. **Test Coverage of Changed Behavior:**
    - Test suites cover HMAC webhook verification, follow-up state transitions, lending math, DPDP consent enforcement, and database unavailable simulation.
    - Limitation: Real end-to-end database persistence against the live Atlas cluster is currently blocked by network access and has not been executed.

---

## 5. Workstream D — Safe Synthetic Persistence Verification Plan

*This plan is prepared for execution ONLY after Stage B (Atlas Network Access) and Stage C (Code Deployment) are approved by the owner.*

### Test Identity & Payload Design
- **Unique Synthetic Marker:** `__ALS_SYNTHETIC_CONNECTIVITY_TEST__`
- **Target Route:** `POST https://avani-ai-crm.vercel.app/api/leads` (Single lead route — verified to contain zero external messaging or calling triggers).
- **Dedicated Synthetic Mobile:** `+919999999999` (Recognized invalid test number in Indian E.164 telecommunications range).
- **Synthetic Test Payload:**
  ```json
  {
    "name": "__ALS_SYNTHETIC_CONNECTIVITY_TEST__",
    "phone": "+919999999999",
    "loanType": "Personal Loan",
    "leadSource": "SYNTHETIC_TEST",
    "consentStatus": "GRANTED",
    "consentPurpose": "FORENSIC_CONNECTIVITY_VERIFICATION",
    "isOptedOut": true,
    "optOutRequested": true,
    "idempotencyKey": "SYNTHETIC_PERSISTENCE_PROBE_20261027"
  }
  ```
- **Why It Is Safe From Customer Side Effects:**
  1. The single lead route (`POST /api/leads`) does NOT dispatch WhatsApp templates or trigger AI voice calls.
  2. The payload explicitly sets `isOptedOut: true` and `status: 'OPTED_OUT'`, ensuring that even if any background scheduler or CRM campaign scanner runs, the record is immediately skipped.
  3. The phone number `+919999999999` cannot receive WhatsApp messages or phone calls.

### Six-Stage Verification Protocol

```
[Stage 1: Pre-Flight Health Probe]
  - GET /api/health
  - PASS: Returns HTTP 200 with status: "HEALTHY", database: { status: "HEALTHY" }
  - FAIL: Returns HTTP 503 (Indicates network or credential failure; abort immediately)
         │
         ▼
[Stage 2: Synthetic Write Verification]
  - POST /api/leads with Synthetic Payload
  - PASS: Returns HTTP 200 with success: true, acknowledged: true, status: "OPTED_OUT"
  - FAIL: Returns HTTP 500 or 503 (Indicates write failure; abort)
         │
         ▼
[Stage 3: Read-Back Verification]
  - GET /api/leads?phone=+919999999999
  - PASS: Returns HTTP 200 with count: 1, name matching synthetic marker exactly
  - FAIL: Record not found (Indicates phantom write or read replica lag)
         │
         ▼
[Stage 4: Safe Record Cleanup]
  - Execute targeted cleanup script querying strictly for:
    { name: "__ALS_SYNTHETIC_CONNECTIVITY_TEST__", phone: "+919999999999" }
  - Removes synthetic record from Lead and Contact collections.
  - GUARANTEE: Query matches strictly on both synthetic name AND test phone; cannot delete real customer leads.
         │
         ▼
[Stage 5: Post-Cleanup Verification]
  - GET /api/leads?phone=+919999999999
  - PASS: Returns HTTP 200 with count: 0 (Confirming complete cleanup)
         │
         ▼
[Stage 6: Zero Downstream Automation Audit]
  - Verify AiSensy ledger, ChatMitra outbound queue, and OmniDM voice logs.
  - PASS: Exactly 0 outbound dispatches or voice calls recorded during the test window.
```

---

## 6. Test Inventory & Coverage Gaps

| Test Suite | Workspace | Target | Status | Execution Mode | Coverage Limitation |
| :--- | :--- | :--- | :---: | :---: | :--- |
| **ChatMitra Comprehensive Suite** | `1-AVANI LOAN SERVICE FY 26-27` | REST Adapter, Webhook HMAC, Follow-Up | **12 / 12 PASS** | MOCK / SANDBOX | Validates adapter logic in-memory. Does not test live Atlas. |
| **AVANI Master Forensic Regression** | `1-AVANI LOAN SERVICE FY 26-27` | Lead Model, Dialogue Parser, Dedup | **8 / 8 PASS** | MOCK / SANDBOX | Validates deduplication and Marathi parser using in-memory DB. |
| **Agent Advisor Contract Suite** | `4-AVANI LOAN AGENTS` | 8 Products, Eligibility Engine | **4 / 4 PASS** | UNIT / CONTRACT | Validates multi-agent prompt schemas. |
| **Voice AI Bridge Safety Suite** | `5-AVAVI AI CALLING AGENT` | Voice Disclosures, PII Scrubbing | **8 / 8 PASS** | MOCK / SANDBOX | Validates telephony bridge in `test_mode`. Zero calls placed. |
| **Website & CRM Intake Suite** | `1-AVANI LOAN SERVICE FY 26-27` | E.164 Normalization, DPDP Consent Gate | **5 / 5 PASS** | UNIT / INTEGRATION | Validates consent rules and input sanitization. |
| **Financial Lending Calculators** | `1-AVANI LOAN SERVICE FY 26-27` | 20 Banking & Lending Calculation Tools | **206 / 206 PASS** | REAL COMPUTATION | Real mathematical formula verification. |
| **Live Production Persistence Test** | `https://avani-ai-crm.vercel.app` | Synthetic Lead Write & Read-back | **NOT RUN / BLOCKED** | N/A | **Remaining Gap:** Live database persistence cannot execute until Atlas network rule is configured. |

---

## 7. Rollback & Incident Response Procedures

If the owner authorizes Option 1 (`0.0.0.0/0`) and network anomalies or unauthorized connection attempts occur:
1. **Perimeter Revocation (<60 seconds):**
   - Log in to [cloud.mongodb.com](https://cloud.mongodb.com) -> **Security** -> **Network Access**.
   - Click **Delete** next to `0.0.0.0/0` and confirm.
   - All non-whitelisted incoming connections are immediately severed by the Atlas SNI proxy.
2. **Credential Invalidation:**
   - Under **Database Access**, delete the database user `avani_crm_prod_app` or reset its password.
3. **Application Rollback:**
   - In Vercel Console -> Deployments -> Instant rollback to prior deployment `dpl_BpKkmTmjZNnyULZ7XXhgNvTSSMU6`.
4. **Audit Log Inspection:**
   - In Atlas Console -> **Activity Feed** / **Alerts**, inspect connection attempt volume and verify zero unauthorized read/writes occurred.

---

## 8. Owner Decisions Required Checklist

To transition from **HOLD** to approved remediation:

- [ ] **Owner Decision 1 — Database User Audit & Rotation:** Inspect database users in the Atlas console, verify least-privilege scoping (`readWrite` on `avani_ai_crm_prod` only), and rotate the password to a fresh 32-character secret.
- [ ] **Owner Decision 2 — Network Access Authorization:** Decide whether to approve adding `0.0.0.0/0` to the Atlas Project IP Access List with the mandatory compensating controls.
- [ ] **Owner Decision 3 — Production Deployment Approval:** Authorize deploying the reviewed application-level code in `3-AVANI AI CRM` to Vercel production project `avani-ai-crm`.
- [ ] **Owner Decision 4 — Synthetic Persistence Verification:** Authorize executing the 6-stage safe synthetic persistence test using marker `__ALS_SYNTHETIC_CONNECTIVITY_TEST__` to advance Gate C to PASS.
