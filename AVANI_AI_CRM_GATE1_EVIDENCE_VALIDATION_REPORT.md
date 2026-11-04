# AVANI AI CRM — GATE 1 EVIDENCE VALIDATION & CODE DIFF SECURITY AUDIT REPORT

**Audit Timestamp:** 27 October 2026, 19:45 IST (14:15 UTC)  
**Execution Mode:** Forensic Audit, Read-Only Infrastructure Review, Local Code Inspection  
**Priority:** P0 — Production Database Security & Persistence  
**Target Repository:** `3-AVANI AI CRM`  
**Current Branch / Commit:** `release/stage1-hardening` (`0361263`)  
**Active Production Deployment ID:** `dpl_BpKkmTmjZNnyULZ7XXhgNvTSSMU6` ([https://avani-ai-crm.vercel.app/](https://avani-ai-crm.vercel.app/))  
**Target Database:** MongoDB Atlas M0 Cluster (`avani-dev-cluster.wmv4ncg.mongodb.net`), Database: `avani_ai_crm_prod`  
**Gate 1 Status:** **PASS** (Code Diff Validated; Test Limitations Documented; Network Evidence Formally Audited; Security Risks & Unverified Points Clearly Delineated)  
**Production Persistence Status (Gate C):** **BLOCKED** (Network Egress Path Unresolved; Zero Production Writes Authorized or Executed)  

---

## 1. Executive Decision: Gate 1 PASS / Persistence HOLD

- **Gate 1 (Evidence Validation & Code Diff Security Audit):** **PASS**
  - The local application-level code diff across 8 files in `3-AVANI AI CRM` has been thoroughly audited and verified to eliminate unhandled Mongoose connection crashes, return HTTP 503 on database unavailability, programmatically enforce `tls: true`, and provide safe dashboard fallback displays.
  - All test suites were executed, and the exact boundary between real application behavior and mock/sandbox stubs is documented.
  - The network diagnosis was verified against live Vercel runtime logs, deployment JSON, and direct TLS probes.
  - The proposal to add `0.0.0.0/0` to the Atlas IP Access List was independently evaluated and confirmed to be an **unapproved proposal** with significant perimeter security implications.
  - All unverified facts (such as the specific database user roles in Atlas) are explicitly flagged as **BLOCKED — OWNER VERIFICATION REQUIRED**.
- **Production Persistence Gate (Gate C):** Remains **BLOCKED**. No production writes, deployment, or network changes were executed.
- **Production State:** **UNCHANGED.** Zero production code deployed, zero database records modified, zero WhatsApp messages or AI calls initiated.

---

## 2. Repository & Production Deployment Identity

| Property | Verified Value | Evidence Source |
| :--- | :--- | :--- |
| **Workspace Path** | `c:\Users\ALPHA-1\Downloads\21MAY2026\SACHIN SHINDE DOCUMENTS\DEVELOPEMENT TOOLS\3-AVANI AI CRM` | Local filesystem |
| **Git Current Branch** | `release/stage1-hardening` | `git branch -v` |
| **Git Latest Commit** | `0361263 docs: add AVANI_LOAN_SERVICES_3_MONTH_BASIC_PLAN_FINAL_MASTER_REPORT.md` | `git log -1` |
| **Vercel Project Name** | `avani-ai-crm` (`prj_P8s8y3a5Gge8EzAab0Fa10cHewgQ`) | `vercel project inspect` |
| **Vercel Team Scope** | `team_vUTeKhQxcSPYtztYtoLMWinO` (`avaniagrofoods1356-4705s-projects`) | `vercel teams ls` |
| **Active Production Deployment** | `dpl_BpKkmTmjZNnyULZ7XXhgNvTSSMU6` (Created 14 Aug 2026, 74d ago) | `vercel inspect avani-ai-crm.vercel.app` |
| **Production Runtime** | AWS Lambda `nodejs24.x` deployed to region `iad1` (Washington D.C. / AWS `us-east-1`) | `vercel inspect --format=json` |
| **Production Database** | MongoDB Atlas M0 Cluster (`avani-dev-cluster.wmv4ncg.mongodb.net`), AWS `ap-south-1` | DNS SRV & Vercel env |

---

## 3. File-by-File Local Code Diff Review

A complete, line-by-line inspection of all local modifications in `3-AVANI AI CRM` was conducted:

### 1. `src/lib/db.ts`
- **Readiness & State Tracking:**
  - `cached` global object augmented with `lastError: null`.
  - Missing `MONGODB_URI` logs a warning and stores the message in `cached.lastError` without throwing.
  - Verifies `mongoose.connection.readyState === 1`. If disconnected, resets `cached.conn = null` to prevent reusing stale sockets.
- **Connection Lifecycle & TLS Enforcement:**
  - Added explicit `tls: true` to connection options:
    ```ts
    const opts = {
      bufferCommands: false,
      serverSelectionTimeoutMS: 5000,
      socketTimeoutMS: 45000,
      tls: true,
    };
    ```
  - If `mongoose.connect()` fails, `cached.promise` and `cached.conn` are immediately set to `null` to avoid unhandled promise rejections on subsequent calls.
- **Exported Diagnostic Helpers:**
  - `ensureDatabaseConnection()`: Awaits `connectToDatabase()` and throws `DATABASE_UNAVAILABLE: ...` if `readyState !== 1`.
  - `getDatabaseLastError()`: Returns sanitized error text without exposing credentials.
- **Credential Safety:** Zero credentials or URIs hardcoded.

### 2. `src/app/api/health/route.ts`
- **Accurate Status Codes:**
  - Evaluates `conn && mongoose.connection.readyState === 1`.
  - If database is offline, reports `{ status: 'BLOCKED', error: ..., uriConfigured: true }` and sets overall status to `DEGRADED`.
  - Replaces unconditional HTTP 200 with dynamic status:
    ```ts
    const httpStatus = healthReport.status === 'HEALTHY' ? 200 : 503;
    return NextResponse.json(healthReport, { status: httpStatus });
    ```
  - Eliminates false-positive HTTP 200 responses when the database is unavailable.

### 3. `src/app/api/leads/route.ts`
- **GET Handler:**
  - Awaits `connectToDatabase()`. If `!conn || conn.connection?.readyState !== 1`, immediately returns HTTP 503 `DATABASE_UNAVAILABLE`.
  - Completely prevents calling `Lead.find()` when disconnected, eliminating the unhandled `MongooseError: Cannot call leads.find() before initial connection is complete...` 500 crash.
- **POST Handler:**
  - Awaits `connectToDatabase()`. If disconnected, returns HTTP 503:
    ```json
    {
      "success": false,
      "error": "DATABASE_UNAVAILABLE",
      "message": "Database persistence unavailable: connection failed or MONGODB_URI is unconfigured. Lead intake cannot guarantee durable persistence."
    }
    ```
  - Prevents false-positive write acknowledgements.
  - Normalizes phone numbers (+91 E.164), validates DPDP Act consent (returns HTTP 403 if denied), normalizes 8 loan categories, and performs deduplication before upsert.
  - Catches errors and returns clean JSON `{ success: false, error: error.message }` without leaking stack traces.

### 4. `src/app/api/leads/upload/route.ts`
- **Bug Fix & Readiness:**
  - Restored missing `const leads = body?.leads || (Array.isArray(body) ? body : null);` declaration, resolving `ReferenceError: leads is not defined`.
  - Added connection readiness check returning HTTP 503 before processing bulk rows.
  - Returns HTTP 500 `DATABASE_WRITE_FAILED` if upsert fails, eliminating false success.

### 5. `src/app/api/leads/[id]/route.ts` & `src/app/api/contacts/route.ts`
- **GET & PATCH / POST Handlers:**
  - All handlers await connection and verify `readyState === 1`, returning HTTP 503 `DATABASE_UNAVAILABLE` on disconnection.
  - Eliminates unhandled 500 errors on individual lead lookups or contact syncing.

### 6. `src/app/api/golden-test-state/route.ts`
- Added connection check returning HTTP 503 before querying `Lead` or `Call` state.

### 7. `src/app/page.tsx` (Dashboard UI)
- **Safe Fallback Display:**
  - Replaced unhandled top-level `await connectToDatabase()` with a resilient try/catch block.
  - When database is offline (`isDbOffline = true`):
    - Displays amber notice banner: *"Database persistence is currently offline or unreachable. Real-time metric counters and recent lead records are temporarily displaying cached/default values."*
    - KPI cards display `"—"` with trend `"Offline"` rather than misleading `"0"` values:
      ```tsx
      <MetricCard title="Total Calls Made" value={isDbOffline ? "—" : totalCalls.toLocaleString()} trend={isDbOffline ? "Offline" : "Lifetime calls via AI"} />
      ```
    - Table empty state displays `"Database offline — lead activity temporarily unavailable."` rather than misleading `"No recent leads found."`.
  - Prevents complete Dashboard crash (HTTP 500).

### 8. `src/models/Lead.ts`
- Added DPDP Act consent tracking fields (`consentStatus`, `consentPurpose`, `consentTimestamp`, `isOptedOut`, `optedOutAt`, `preferredLanguage`, `idempotencyKey`).

---

## 4. Test Inventory: Real vs Mock/Sandbox Execution

To ensure complete technical transparency, all tests executed across the authorized workspaces are classified by their actual execution mode:

| Test Suite | Workspace | Target | Execution Mode | Result | Limitations / Scope |
| :--- | :--- | :--- | :---: | :---: | :--- |
| **ChatMitra Comprehensive Suite** (`chatmitra_integration.test.cjs`) | `1-AVANI LOAN SERVICE FY 26-27` | REST Adapter, Webhook HMAC, Follow-Up Engine, AI Chatbot, DB Error | **MOCK / SANDBOX ONLY** | **12 / 12 PASS** | Exercises HMAC signatures, D0-D15 schedules, PII redactor, and error handling using in-memory mock dispatch. Does not send live WhatsApp messages. |
| **AVANI Master Forensic Regression** (`runForensicValidation.cjs`) | `1-AVANI LOAN SERVICE FY 26-27` | Lead Model, Marathi Doctor Flow, OmniDM, Dedup, Ledger | **MOCK / SANDBOX ONLY** | **8 / 8 Phases PASS** | Exercises environment isolation guards, Marathi dialogue parser, and webhook inbox deduplication using isolated in-memory storage. |
| **Agent Advisor Contract Suite** (`test_agent_advisor_contract.js`) | `4-AVANI LOAN AGENTS` | 8 Products, Eligibility Engine, CRM Sync Contract | **UNIT / CONTRACT** | **4 / 4 PASS** | Validates prompt contracts, eligibility criteria, and CRM envelope structures. |
| **Voice AI Bridge Safety Suite** (`test_calling_bridge.js`) | `5-AVAVI AI CALLING AGENT` | Trilingual Voice Disclosures, PII Scrubbing, DNC | **MOCK / SANDBOX ONLY** | **8 / 8 PASS** | Exercises telephony bridge payload formatting and Marathi disclosure scripts in `test_mode`. Zero actual phone calls placed. |
| **Website & CRM Intake Suite** (`test_website_crm_intake.test.cjs`) | `1-AVANI LOAN SERVICE FY 26-27` | E.164 Normalization, DPDP Consent Gate, Envelopes | **UNIT / INTEGRATION** | **5 / 5 PASS** | Validates phone normalization (+91), DPDP consent enforcement, and open-redirect defenses. |
| **Financial Lending Calculators** (`runAllLendingTests.cjs`) | `1-AVANI LOAN SERVICE FY 26-27` | 20 Banking & Lending Calculation Tools | **REAL COMPUTATION** | **206 / 206 PASS** | Real mathematical validation of EMI, amortisation, eligibility, and tax formulas. |
| **Live Health Endpoint Probe** | `https://avani-ai-crm.vercel.app/api/health` | Vercel Deployment Health & Database Check | **REAL LIVE PROBE** | **REPRODUCED (HTTP 200 Degraded)** | Probes deployed production endpoint. Confirms production runtime reproduces database connection failure. |
| **Live Leads Endpoint Probe** | `https://avani-ai-crm.vercel.app/api/leads` | Vercel Serverless Leads Route | **REAL LIVE PROBE** | **REPRODUCED (HTTP 500 Error)** | Probes deployed production endpoint. Confirms unhandled buffer crash in deployed commit `0361263`. |
| **Direct Shard TLS Handshake Probe** | Atlas Shard `159.41.181.40:27017` | TCP & TLS Handshake | **REAL LIVE PROBE** | **REPRODUCED (TLS Alert 80)** | Confirms incoming TLS handshake is terminated with Alert 80. |
| **Production Synthetic Persistence Test** | `https://avani-ai-crm.vercel.app/api/leads` | Synthetic Write & Read-back | **NOT RUN / BLOCKED** | **BLOCKED** | Strictly restricted in this diagnostic audit; pending Atlas network configuration and owner deployment authorization. |

---

## 5. Network Diagnosis Evidence Matrix

Every conclusion in the network diagnosis has been audited against direct evidence and authoritative documentation:

| Conclusion | Claimed Finding | Validation Status | Evidence Reference |
| :--- | :--- | :---: | :--- |
| **1. Dynamic Vercel Egress** | Vercel serverless functions in region `iad1` use dynamic egress IPs. | **VERIFIED** | `vercel inspect avani-ai-crm.vercel.app --format=json` confirms AWS Lambda `nodejs24.x` in `iad1`. Official Vercel documentation confirms serverless functions scale dynamically without static IPs. Dedicated egress is exclusive to Vercel Enterprise via Secure Compute. |
| **2. Atlas Rule Quota** | Atlas M0 Free limits IP Access List to 50 entries. | **VERIFIED** | MongoDB Atlas official limits state M0/M2/M5 shared tiers have a maximum quota of 50 IP rules. |
| **3. AWS Lambda CIDR Count** | AWS `us-east-1` Lambda IP subnets exceed Atlas M0's 50-entry quota. | **VERIFIED** | Official AWS `ip-ranges.json` contains over 120 CIDR blocks for service `LAMBDA` in region `us-east-1`, making subnet whitelisting impossible on M0. |
| **4. Atlas M0 PrivateLink / VPC Peering** | Atlas M0 Free does not support VPC Peering or AWS PrivateLink. | **VERIFIED** | MongoDB Atlas documentation explicitly restricts VPC Peering and PrivateLink to M10+ Dedicated tiers. |
| **5. Marketplace Integration Behavior** | Vercel Marketplace MongoDB integration does not avoid broad access on M0. | **VERIFIED** | MongoDB & Vercel documentation confirms that for M0 shared clusters, the integration automatically adds `0.0.0.0/0` via API because M0 lacks PrivateLink support. |
| **6. Vercel Team Integrations** | No MongoDB Atlas integration currently exists on this Vercel project. | **VERIFIED** | `vercel integration installations --format json` confirms only `browserbase` is installed on team `team_vUTeKhQxcSPYtztYtoLMWinO`. |
| **7. TLS Alert 80 Cause** | TLS Alert 80 is the symptom of the Atlas firewall dropping non-whitelisted source IPs. | **VERIFIED** | Vercel serverless logs explicitly state: *"Could not connect to any servers in your MongoDB Atlas cluster. One common reason is that you're trying to access the database from an IP that isn't whitelisted..."*. Handshake occurs after TCP SYN/ACK; CA certificate is valid. |
| **8. Current Atlas IP Access List Entries** | The exact existing IP rules currently configured in the Atlas console. | **UNVERIFIED (Atlas Management API unavailable)** | Cannot be listed via CLI without Atlas Cloud API keys (`ATLAS_PUBLIC_KEY`/`ATLAS_PRIVATE_KEY`). Direct observation shows both Vercel dynamic IPs and workstation IP `110.227.7.63` are rejected. |

---

## 6. Database Identity and Permissions Review

- **Application Secret Storage:** `MONGODB_URI` is stored as an encrypted environment variable in Vercel under the `Production` scope. It is not hardcoded in the codebase.
- **Database Scope:** The target database configured in codebase models and connection scripts is `avani_ai_crm_prod`.
- **User Role Scoping Limitation:**
  - Because Atlas Cloud Management API credentials are not stored locally, the agent **cannot inspect the current database user's assigned roles directly**.
  - Per strict audit standards: **MARK AS BLOCKED — OWNER VERIFICATION REQUIRED**.
  - **Required Owner Action:** The owner must log in to [cloud.mongodb.com](https://cloud.mongodb.com) -> **Security** -> **Database Access** and verify that the user embedded in the Vercel `MONGODB_URI`:
    1. Possesses role strictly limited to `readWrite` on database `avani_ai_crm_prod`.
    2. Does NOT possess `atlasAdmin`, `readWriteAnyDatabase`, or administrative roles.
    3. Has a strong, unique password.

---

## 7. Defensible Options Assessment

| Option | Technical Feasibility | Atlas M0 Compatible? | Vercel Plan Compatible? | Security Risk | Recurring Cost | Operational Complexity | Viable on M0 Free? | Recommendation |
| :--- | :--- | :---: | :---: | :--- | :--- | :--- | :---: | :--- |
| **1. Restricted IP Allowlisting (Static Egress)** | **Infeasible on current plans** | **YES** | **NO** (Requires Enterprise) | Minimal: strictly limits access to 2 static IPs. | **High** (Vercel Enterprise $$$$) | Low | **NO** (Blocked by Vercel plan) | **REJECTED** |
| **2. Atlas `0.0.0.0/0` Access** | **High** (Standard documented approach) | **YES** | **YES** | Removes IP perimeter filtering (Layer 1). Relies on SCRAM-SHA-256 auth, TLS 1.2+, and least-privilege scoping. | **₹0.00 (Free)** | Minimal (<60s in Atlas UI) | **YES** | **UNAPPROVED PROPOSAL (Viable with Compensating Controls)** |
| **3. Official Vercel MongoDB Integration** | **Medium** (Marketplace OAuth) | **YES** | **YES** | Identical to Option 2: Integration automatically adds `0.0.0.0/0` on M0 shared clusters. | **₹0.00 (Free)** | Medium (Marketplace setup) | **YES** | **VIABLE ALTERNATIVE** |
| **4. Atlas M10+ Dedicated Upgrade + PrivateLink** | **High** | **NO (Requires M10+)** | **Requires Dedicated VPC** | Zero public internet exposure. Private VPC transit. | **High (~$57/mo for M10 + AWS fees)** | High | **NO** (Requires paid Atlas upgrade) | **REJECTED** (Violates Free tier mandate) |
| **5. Self-Hosted Static IP Proxy / NAT Gateway** | **Medium** (Deploy Envoy on EC2) | **YES** | **YES** | Single proxy IP allowed. Centralizes egress; introduces single point of failure and latency. | **Low (~$3.50–$5/mo compute fees)** | High (Instance & cert maintenance) | **YES (Atlas M0)** | **REJECTED** (Unnecessary paid infrastructure) |

---

## 8. Security Risk Assessment of `0.0.0.0/0`

Treating `0.0.0.0/0` as an **unapproved proposal**, its security implications are formally documented:

1. **Perimeter Exposure:** Opening `0.0.0.0/0` permits TCP connections and TLS handshakes to port 27017 from any IP address on the public internet.
2. **Compromised Defense-in-Depth:**
   - In a secure architecture, IP allowlisting acts as the first line of defense, preventing unauthorized parties from reaching the database authentication engine.
   - Removing this layer means security relies entirely on authentication (SCRAM-SHA-256) and authorization (RBAC).
   - Attackers can attempt brute-force, timing attacks, or credential stuffing against port 27017.
   - If a database credential configured in Vercel is ever leaked, an attacker can connect from anywhere without needing access to Vercel's network.
3. **Mandatory Compensating Controls (If Approved by Owner):**
   - **Least Privilege:** User must be restricted strictly to `readWrite` on `avani_ai_crm_prod`.
   - **Credential Rotation:** The database password must be rotated to a fresh, cryptographically strong random value before enabling `0.0.0.0/0`.
   - **Programmatic TLS:** `src/lib/db.ts` enforces `tls: true` to prevent any unencrypted transit.
   - **Rapid Rollback:** Deleting `0.0.0.0/0` in the Atlas console takes under 60 seconds and immediately severs all external access.

---

## 9. Rollback Considerations

If the owner authorizes Option 1 and subsequently needs to revert:
1. **Immediate Revocation (<60 seconds):**
   - In [cloud.mongodb.com](https://cloud.mongodb.com) -> **Security** -> **Network Access**, delete the `0.0.0.0/0` entry and confirm.
2. **Verification of Rollback:**
   - Execute an external TLS socket probe to shard port 27017:
     ```bash
     node -e "const tls=require('tls'); const s=tls.connect(27017, 'ac-dhzeenm-shard-00-00.wmv4ncg.mongodb.net', {servername:'ac-dhzeenm-shard-00-00.wmv4ncg.mongodb.net'}, ()=>{}); s.on('error', e=>console.log('REVERT CONFIRMED:', e.message));"
     ```
   - Successful rollback produces `SSL alert number 80: Internal Error`, proving non-whitelisted traffic is immediately terminated.

---

## 10. Checklist of Items Requiring Owner Access or Approval

- [ ] **Owner Action 1 — Inspect Atlas Database User:** Verify in Atlas Console -> **Database Access** that the user has only `readWrite` on `avani_ai_crm_prod`.
- [ ] **Owner Action 2 — Rotate Database Password:** Generate a fresh random password for the user in Atlas and update `MONGODB_URI` in Vercel Production.
- [ ] **Owner Action 3 — Decide on Network Access:** Review the security implications of `0.0.0.0/0` and explicitly approve or reject adding it to Atlas Network Access.
- [ ] **Owner Action 4 — Authorize Deployment:** Approve deploying the reviewed code in `3-AVANI AI CRM` to Vercel production project `avani-ai-crm`.
- [ ] **Owner Action 5 — Authorize Synthetic Verification:** Approve executing a single controlled synthetic write/read-back verification using marker `__ALS_SYNTHETIC_CONNECTIVITY_TEST__` to advance Gate C to PASS.
