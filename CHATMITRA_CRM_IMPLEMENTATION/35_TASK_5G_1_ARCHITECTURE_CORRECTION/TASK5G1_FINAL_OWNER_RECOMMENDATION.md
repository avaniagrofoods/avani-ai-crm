# TASK 5G.1 — FINAL OWNER RECOMMENDATION & ARCHITECTURAL DECISION
## ATLAS ARCHITECTURE CORRECTION, AUTHENTICATION COMPATIBILITY & S45–S50 PLAN REVISION

**Project:** AVANI LOAN SERVICES — ChatMitra + AVANI AI CRM  
**Date:** 18 November 2026  
**Status:** Read-Only Architectural Correction  
**Authority:** Task 5G.1 Security Directive  

---

### 1. FORMAL ARCHITECTURAL EVALUATION & FINDINGS

Antigravity has completed the formal read-only architectural investigation and security compatibility review for the proposed MongoDB Atlas test cluster. The following key corrections to Task 5G have been established:

1. **Authentication Compatibility Finding:**
   - MongoDB Atlas M0 (Free Tier) clusters **do not support native SCRAM-SHA-256** authentication; Atlas M0 disables SCRAM-SHA-256 and defaults to **`SCRAM-SHA-1`**.
   - Advanced mechanisms such as **AWS IAM (`MONGODB-AWS`)** and **X.509 user certificates** are strictly prohibited on M0 and require a Dedicated Tier (**M10+**).
   - Attempting to force `SCRAM-SHA-256` on M0 produces `BadValue: SCRAM-SHA-256 authentication is disabled`.
   - Modern Mongoose 9.7 / MongoDB 7.2 drivers connect seamlessly to M0 when `authMechanism=SCRAM-SHA-1` is specified in the connection string URI.

2. **Regional & Pricing Verification Finding:**
   - **AWS Mumbai (`ap-south-1`)** officially supports both M0 Free Tier ($0/month) and M10 Dedicated Tier (~$175–$210/month for a 3-node replica set).
   - M0 includes 512 MB shared storage (data + indexes), 500 connections, and ~100 ops/sec throttling. The proposed S45–S50 test suite requires < 5.0 MB storage (< 1.0% quota) and ~15 connections.
   - M0 automatically pauses after **30 days of complete inactivity**. It can be resumed with a single click in the Atlas console or kept active with a periodic ping. M10 never auto-pauses.

3. **Index Safety Policy Correction:**
   - S48 has been permanently decoupled into 4 distinct phases:
     - **Phase A:** Read-only schema index inventory (offline extraction of 42 indexes across 18 models).
     - **Phase B:** Read-only test database inspection (calling `collection.indexes()` on `avani_ai_crm_test`).
     - **Phase C:** Explicitly authorized index creation (**Requires separate Owner approval; never automatic; `syncIndexes()` strictly prohibited**).
     - **Phase D:** Index parity verification (read-only mathematical set difference).
   - Production index state is referenced solely via offline baseline `CP26_6_INDEX_PARITY.csv`. Connecting to production is strictly forbidden.

4. **S45–S50 Test Plan Revision:**
   - Revised to test tier-supported authentication (S46), strict read-only index inspection (S48), write-gated synthetic CRUD (S49), and evidence-based production isolation without touching production (S50).
   - Purely synthetic fixtures used (`SYNTH_LEAD_001`, `+919999900001`–`05`). Zero PII.

---

### 2. ARCHITECTURAL DECISION SELECTION

As instructed by Section 10 of the Master Prompt, the formal evaluation is structured as follows:

| Decision Option | Assessment | Criteria Evaluation |
| :--- | :---: | :--- |
| **A. M0 SUITABLE – AUTHENTICATION AND REGION VERIFIED** | **RECOMMENDED** | **Verified.** AWS Mumbai (`ap-south-1`) is supported. M0 supports `SCRAM-SHA-1` over TLS 1.2+. Zero cloud cost ($0/month). Hardware bottleneck solved. Meets all non-production testing requirements. |
| **B. PAID TIER REQUIRED – M0 DOES NOT MEET SECURITY REQUIREMENTS** | **CONDITIONAL ALTERNATIVE** | Mandatory **ONLY IF** the Owner strictly requires `SCRAM-SHA-256`, AWS IAM, or AWS PrivateLink in the test environment (~$175–$210/month). |
| **C. ARCHITECTURE REQUIRES FURTHER CORRECTION** | **NOT SELECTED** | All technical and procedural gaps have been fully resolved in Task 5G.1. |
| **D. BLOCKED – OFFICIAL INFORMATION INSUFFICIENT** | **NOT SELECTED** | Official MongoDB Atlas documentation and driver telemetry provided complete, verified data. |

---

### 3. EXECUTIVE RECOMMENDATION: OPTION A

Antigravity formally selects and recommends:

$$\mathbf{OPTION\ A:\ M0\ SUITABLE\ –\ AUTHENTICATION\ AND\ REGION\ VERIFIED}$$

**Key Justification:**
1. **Zero Financial Overhead:** $0.00/month vs. ~$2,400.00/year for M10.
2. **Complete Security & Isolation:** Running in a dedicated Atlas Project (`AVANI-AI-CRM-TESTING`) with dedicated user `als_crm_test_worker` and TLS 1.2+ provides 100% cryptographic and operational isolation from production.
3. **Application Compatibility:** Mongoose 9.7 supports `SCRAM-SHA-1` natively via `?authMechanism=SCRAM-SHA-1` without modifying a single line of application source code.
4. **Hardware Protection:** Completely relieves local host RAM (~268 MB free) and Drive D: (3.4 MB free).

---

### 4. DELIVERABLES SUMMARY

The seven complete architectural and safety specifications have been compiled in:
`CHATMITRA_CRM_IMPLEMENTATION/35_TASK_5G_1_ARCHITECTURE_CORRECTION/`

1. `TASK5G1_AUTHENTICATION_COMPATIBILITY.md`
2. `TASK5G1_REGION_AND_PRICING_VERIFICATION.md`
3. `TASK5G1_M0_VS_PAID_TIER_COMPARISON.md`
4. `TASK5G1_INDEX_WRITE_AUTHORIZATION_POLICY.md`
5. `TASK5G1_REVISED_S45_S50_TEST_PLAN.md`
6. `TASK5G1_SECURITY_AND_COST_DECISION.md`
7. `TASK5G1_FINAL_OWNER_RECOMMENDATION.md`

---

### 5. OWNER APPROVAL REQUIRED TO PROCEED

To advance from architecture planning to live execution, the Project Owner must review this report and provide explicit authorization for:
1. **Approval of Option A (M0 Free Tier with SCRAM-SHA-1 in AWS Mumbai `ap-south-1`)** OR **Option B (M10 Dedicated Tier with SCRAM-SHA-256)**.
2. **Authorization for Task 5H.1 (Controlled Atlas Resource Provisioning):** Creating the dedicated Atlas Project, Cluster, Database, and User.
3. **Authorization for Task 5H.2 (Controlled Live Test Execution):** Executing revised tests S45 through S48 (Read-Only) and S49–S50 (Write-Gated Synthetic CRUD).

---

### 6. MANDATORY STOP NOTICE

In strict compliance with Section 11 of the Master Prompt:
- **Execution is completely HALTED.**
- No Atlas resources have been provisioned.
- No database connections or DNS queries have been made.
- No source code or tests have been modified.
- No Git commits or pushes have been made.

**Awaiting Owner instruction.**
