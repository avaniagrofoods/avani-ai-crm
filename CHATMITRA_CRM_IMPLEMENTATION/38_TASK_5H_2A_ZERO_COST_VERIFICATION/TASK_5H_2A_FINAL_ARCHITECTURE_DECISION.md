# TASK 5H.2A — FINAL ARCHITECTURE DECISION & OWNER REPORT
## COMPARISON OF OPTIONS A, B & C UNDER STRICT ₹0 COST & ZERO-ASSUMPTION GOVERNANCE
### AVANI LOAN SERVICES — ChatMitra + AVANI AI CRM

**Date:** 18 November 2026  
**Execution Mode:** Strictly Read-Only Verification & Architectural Decision  
**Maximum Permitted Cost:** **₹0.00 INR / $0.00 USD**  
**Provisioning Authorization:** **NOT GRANTED**

---

### 1. FORMAL FINAL DECISION (SECTION 5)

In strict compliance with Section 5 of the Master Execution Prompt, the formal decision is:

$$\mathbf{C\ –\ CLOUD\ OPTION\ NOT\ VERIFIED;\ CONTINUE\ LOCAL\ TESTING}$$

---

### 2. THREE-OPTION ARCHITECTURAL COMPARISON (TASK F)

| Evaluation Dimension | Option A: Local Free-Only Mock & Offline Testing | Option B: Isolated Atlas M0 Testing (Only if All ₹0 Requirements Verified) | Option C: Hybrid Local Testing + Optional Atlas M0 (Gated) |
| :--- | :--- | :--- | :--- |
| **1. Current Verification Status** | **`VERIFIED` (100% Operational Today)** | **`NOT VERIFIED` (`REQUIRES OWNER CONFIRMATION`)** | **Tier 1 (Local): `VERIFIED` Today**<br/>**Tier 2 (Atlas M0): `CONDITIONAL` / Gated** |
| **2. Guaranteed ₹0 / $0 Cost** | **Guaranteed ₹0.00 / $0.00** (Uses 24 local open-source & OS binaries already installed on disk; zero billing account exists). | **Conditional ₹0.00 / $0.00** (Requires confirming in live Atlas UI that Mumbai M0 is available at ₹0 with no credit card or RBI e-mandate). | **Guaranteed ₹0.00 / $0.00 Today** (Runs Option A locally at ₹0; blocks Tier 2 M0 unless Owner verifies all 12 Task C zero-cost rules). |
| **3. Credit Card & RBI Mandate Risk** | **Zero Risk** (No external account, no payment gateway, no e-mandate). | **Conditional Risk** (Zero risk *only if* direct registration asks for no card; if UI prompts for card/mandate, must ABORT). | **Zero Risk** (Enforces hard rule: never enter card/mandate; remain on local Option A if card is requested). |
| **4. AWS Mumbai (`ap-south-1`) Eligibility** | **Not Applicable** (Runs 100% on local workstation). | **`NOT VERIFIED`** in static MongoDB docs; must be checked in live Atlas UI. **Automatic switch to Singapore is prohibited.** | **Local Tier: Independent of region.**<br/>**Cloud Tier: Strictly gated on Mumbai `ap-south-1` UI check** (any alternate region requires separate Owner decision). |
| **5. Workstation Hardware Fit (3.90 GB RAM / ~268–426 MB Free)** | **100% Verified Fit** (~55–220 MB RAM peak for sequential `node --test` and `tsc --noEmit`; 0 local DB daemon). | **Fits Workstation RAM** (~65 MB local driver RAM; WiredTiger engine hosted in cloud). | **100% Verified Fit** (Avoids local `mongod.exe`, Docker, and `mongodb-memory-server` completely). |
| **6. Testing Coverage** | **Offline Unit, Schema & Mock Lifecycle Coverage (175/175 offline tests):** Verifies all 7 stages of `src/lib/db.ts`, webhook HMACs, and Hindi `रोकें` opt-out. **Does NOT test live MongoDB server persistence (S45–S50).** | **Live Wire-Protocol Coverage (S45–S50):** Tests live DNS-SRV, TLS 1.2+, `SCRAM-SHA-1`, `collection.indexes()`, and synthetic CRUD, **but requires active internet & 60-day idle resume.** | **Complete Dual Coverage:** Immediate offline regression today (Option A) + optional live S45–S50 verification once Owner confirms Mumbai M0 zero-cost eligibility. |
| **7. Security & Production Isolation** | **Air-Gapped Isolation:** 0 network sockets opened; impossible to contact `rhpn2gh.mongodb.net` or leak credentials. | **Cloud Project Isolation:** Separate project `AVANI-AI-CRM-TESTING`, least-privilege user `als_crm_test_worker`, `/32` IP allowlist, TLS 1.2+, `SCRAM-SHA-1`. | **Maximum Defense-in-Depth:** Air-gapped local testing by default; cloud socket opened only after Owner verification and explicit authorization. |

---

### 3. RECOMMENDED ZERO-COST ARCHITECTURE

1. **Immediate Active Recommendation — Option A (Local Free-Only Mock & Offline Testing) as Active Baseline within Option C (Hybrid Local + Optional Gated M0):**
   - Because AWS Mumbai (`ap-south-1`) M0 free-cluster eligibility and card-free account provisioning are **`NOT VERIFIED`** from static documentation alone (and live Atlas account/project creation is strictly prohibited in Task 5H.2A), **Option B cannot be marked verified today**.
   - Therefore, **continue local free-only testing (Option A)** immediately using the verified 24 installed tools (`Node.js v26.13.1`, `node:test`, `typescript@5.9.3`, `eslint@9.39.4`, `mongoose@9.7.3`, `Python 3.14.5`, `git 2.56.1`, `curl.exe 8.13.0`, `PowerShell 5.1`) at a 100% verified cost of **₹0.00 / $0.00**.
2. **Optional Cloud Expansion Gate (Option C Tier 2 — Isolated Atlas M0):**
   - Atlas M0 may be added as an optional Tier 2 integration target **only if** the Project Owner independently confirms in the Atlas UI that:
     1. An M0 Free Cluster ($0.00/hr) is available in **AWS Mumbai (`ap-south-1`)**.
     2. **Zero credit card, debit card, billing account, or RBI e-mandate** is requested.
     3. The Owner approves using **`SCRAM-SHA-1` over TLS 1.2+** (since M0 does not support `SCRAM-SHA-256`) for synthetic test fixtures (`SYNTH_LEAD_001`, `+919999900001`–`05`).
   - **Strict Region Rule:** If AWS Mumbai (`ap-south-1`) M0 is unavailable at ₹0, **do not automatically switch to Singapore (`ap-southeast-1`) or any other region, and do not select Flex or M10.** Present regional unavailability to the Owner as a separate decision while continuing local testing.

---

### 4. MANDATORY 10-POINT SECTION 5 FINAL REPORT

| # | Section 5 Report Item | Verified Task 5H.2A Finding |
| :-: | :--- | :--- |
| **1** | **Task Completion Status** | **COMPLETE** — All 9 deliverables (8 Markdown reports + 1 verified `.xlsx` Corrections Register) generated, verified, hashed (SHA-256), and mirrored in Project 1 and Project 2 under `CHATMITRA_CRM_IMPLEMENTATION/38_TASK_5H_2A_ZERO_COST_VERIFICATION/`. |
| **2** | **Verified Free Tools** | **24 Installed Free Tools Confirmed at ₹0 / $0:**<br/>• **20 Already Installed & Immediately Usable:** `Node.js v26.13.1`, `node:test`, `node:crypto/http/dns`, `typescript@5.9.3`, `eslint@9.39.4`, `next@16.2.10`, `vite@6.4.6`, `mongoose@9.7.3/9.12.1`, `mongodb@7.2.0`, `zod@4.4.3/4.6.7`, `papaparse@5.5.4`, `exceljs@4.4.0`, `axios@1.18.1/1.21.1`, `ioredis-mock@5.9.1`, `node-cron@4.2.1`, `helmet@8.2.0`/`express-validator@7.3.2`, `jspdf@4.2.1`/`pdf-parse@2.4.5`, `git v2.56.1`, `curl.exe v8.13.0`, `PowerShell 5.1 & OS Utilities`.<br/>• **4 Already Installed (Requires Specific Invocation/Config):** `npm.cmd v11.20.0` (bypass `.ps1` policy), `C:\Python314\python.exe v3.14.5` (bypass Store alias), `puppeteer@25.4.0` (single headless tab RAM limit), `gh v2.104.0` (repo-scoped). |
| **3** | **Incorrect or Unsupported Task 5H.1 Claims Corrected** | 1. *"No credit card required" (unconditional)* $\rightarrow$ Corrected to **`CONDITIONAL` / `REQUIRES OWNER CONFIRMATION`** (must register directly at `mongodb.com`, not Cloud Marketplace, and confirm no anti-fraud card prompt on Owner account).<br/>2. *"AWS Mumbai M0 available (with automatic Singapore fallback)"* $\rightarrow$ Corrected to **`NOT VERIFIED` / `REQUIRES OWNER CONFIRMATION`**; automatic Singapore fallback **retracted** (requires separate Owner decision).<br/>3. *"₹0 total cost" (for cloud services)* $\rightarrow$ Corrected to **`VERIFIED` for local tools**, **`CONDITIONAL` for cloud services** (requires 0 card entry, 0 paid tiers, and local-only CI runs).<br/>4. *"100% security compliance"* $\rightarrow$ Corrected from **`INCORRECT` (overstated)** to **`CONDITIONAL`** (verified offline only; live S45–S50 unexecuted; M0 lacks `SCRAM-SHA-256`, backups, and VPC Peering).<br/>5. *"Avoided monthly savings of ₹18,228 / $217"* $\rightarrow$ Marked **`INCORRECT` and retracted** (improperly summed mutually exclusive M10 and Flex tiers plus unverified hypothetical usage).<br/>6. *"175/175 passing tests"* $\rightarrow$ Clarified as **`VERIFIED` for offline unit/mock testing ONLY**, and **`INCORRECT` if cited as proof of live MongoDB server integration** (S45–S50 are unexecuted).<br/>7. *"M0 auto-pauses after 30 days of inactivity"* $\rightarrow$ Marked **`INCORRECT` and corrected to `60 days of inactivity`** per official `docs/atlas/pause-terminate-cluster/`. |
| **4** | **MongoDB M0 Actual Cost Conditions** | Base price is **$0.00 / hour ($0.00 / month)** (`VERIFIED` in official pricing docs) **only under strict conditions**: maximum 1 M0 cluster per Atlas project, fixed 512 MB storage (data + indexes), max 100 databases / 500 collections, max 500 connections, max 100 CRUD ops/sec, max 10 GB in / 10 GB out per 7 days, fixed MongoDB 8.0, no automated backups, no VPC Peering/PrivateLink, auto-pauses after 60 days of zero connections, and zero payment card or paid upgrade selected. |
| **5** | **Mumbai M0 Eligibility Status** | **`NOT VERIFIED` / `REQUIRES OWNER CONFIRMATION`**. Official AWS docs (`docs/atlas/reference/amazon-aws/`) confirm `ap-south-1` supports Atlas generally, but do not publish a static Free-tier (M0) flag. Cannot be inferred from dedicated cluster support. |
| **6** | **Payment and Billing Risks** | Entering an Indian credit/debit card on any international USD cloud portal triggers: (1) $1 USD / ₹2–₹85 verification hold, (2) **RBI recurring e-Mandate / Standing Instruction** registration (allowing one-click upgrades to Flex $8–$30/mo or M10 $0.08+/hr without OTP), (3) **2%–3.5% bank FX markup + 18% GST on markup**, and (4) **18% IGST / OIDAR tax**. **Mitigation:** Absolute prohibition on entering any payment card, UPI mandate, or billing profile. |
| **7** | **Local Testing Capabilities** | **100% VERIFIED AT ₹0.00 / $0.00.** Executes 175 offline tests (59 database isolation unit & mock lifecycle tests, 28 ChatMitra webhook hardening tests, 39 Meta webhook tests, 29 DB reliability tests, 20 Task 3B Hindi `रोकें` opt-out tests) plus `tsc --noEmit` static type checking using ~55–220 MB RAM. Local `mongod.exe`, Docker, and `mongodb-memory-server` remain **unsuitable** on the 3.90 GB RAM host (~268–426 MB free RAM; Drive D: 3.25 MB free). |
| **8** | **Security Compatibility Findings** | **100% COMPATIBLE WITH TASK 5F–5G.2 BASELINE.** `src/lib/db.ts` (`SHA-256: A98D4B8A...`) and `src/lib/optout-engine.ts` (`SHA-256: 6856EA28...`) are completely unchanged. The 7-stage isolation pipeline supports local mock testing today and supports future Atlas M0 `SCRAM-SHA-1` over TLS 1.2+ via URI parameter `?authMechanism=SCRAM-SHA-1` with **0 lines of code change**. |
| **9** | **Recommended Zero-Cost Architecture** | **Continue Option A (Local Free-Only Mock & Offline Testing) as the verified ₹0 active baseline within Option C (Hybrid Local + Optional Gated M0).** Do not provision or connect to any cloud database until the Owner independently verifies Mumbai M0 zero-cost, card-free eligibility in the Atlas UI. |
| **10** | **Remaining Owner Decisions** | 1. **Continue Local-Only vs. Verify Cloud M0:** Decide whether to continue purely with verified ₹0 local mock testing (Option A) or check the Atlas UI for Mumbai (`ap-south-1`) M0 availability at ₹0 without a credit card.<br/>2. **Separate Region Decision (If Mumbai M0 Unavailable):** If Mumbai M0 is unavailable at ₹0 in the Atlas UI, explicitly decide whether to stay 100% local-only or authorize a specific alternate ₹0 M0 region (no automatic switch to Singapore is permitted).<br/>3. **Separate Execution & Write Approvals:** If Mumbai M0 is confirmed at ₹0, separately authorize read-only connection tests (S45–S48) and write-gated synthetic CRUD tests (S49–S50). |

---

### 5. MANDATORY STOP

Execution has **STOPPED** in strict compliance with Section 3 and Section 5. No Atlas account, project, or cluster has been created, no payment information has been requested or entered, no database connections have been opened, and no source code has been modified.
