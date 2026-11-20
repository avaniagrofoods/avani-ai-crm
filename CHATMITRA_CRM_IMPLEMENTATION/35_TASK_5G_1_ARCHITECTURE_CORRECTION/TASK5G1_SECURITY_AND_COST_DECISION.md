# TASK 5G.1 — SECURITY AND COST DECISION REPORT
## STRATEGIC SYNTHESIS: M0 FREE TIER VS. PAID DEDICATED TIER

**Project:** AVANI LOAN SERVICES — ChatMitra + AVANI AI CRM  
**Date:** 18 November 2026  
**Status:** Architecture Decision Framework  
**Authority:** Task 5G.1 Decision Evaluation  

---

### 1. STRATEGIC EVALUATION CRITERIA

The decision between **Option A (Atlas M0 Free Tier)** and **Option B (Atlas M10 Dedicated Tier)** is governed by six key engineering and business criteria:
1. **Security & Production Isolation:** Does the architecture guarantee zero cross-contamination with `rhpn2gh.mongodb.net` and `avani_ai_crm_prod`?
2. **Authentication Compatibility:** Does the cluster tier cleanly support the authentication protocol without runtime errors or false-positive security alerts?
3. **Hardware Constraints:** Does the architecture respect workstation limits (~268 MB free RAM, Drive D: exhausted)?
4. **Workload Sizing:** Does the resource allocation accommodate the 18 Mongoose models and the S45–S50 test suite?
5. **Total Operating Cost:** What is the recurring monthly financial commitment?
6. **Operational Overhead:** What maintenance or intervention is required to keep the test environment healthy?

---

### 2. DETAILED COMPARATIVE ANALYSIS

```
                                  SECURITY & ISOLATION
                                           ▲
                                           │
                        Option B (M10)     │     Option A (M0)
                  ┌────────────────────────┴────────────────────────┐
                  │ • Full SCRAM-SHA-256   │ • SCRAM-SHA-1          │
                  │ • AWS IAM & X.509      │ • TLS 1.2+ Enforced    │
                  │ • Dedicated Replica Set│ • Shared Replica Set   │
                  │ • Zero Blast Radius    │ • Zero Blast Radius    │
                  └────────────────────────┬────────────────────────┘
                                           │
  RECURRING COST                           │                         OPERATIONAL OVERHEAD
  ◄────────────────────────────────────────┼────────────────────────────────────────────►
  Option B: ~$185 – $210 / month           │ Option A: $0.00 / month
  ($2,200 – $2,500 annually)               │ (30-day idle auto-pause managed via ping)
```

#### CRITERION 1: SECURITY & PRODUCTION ISOLATION
- **Option A (M0):** Created in a separate Atlas Project (`AVANI-AI-CRM-TESTING`). Dedicated user `als_crm_test_worker` scoped exclusively to `avani_ai_crm_test`. All communication encrypted via TLS 1.2+. Hardcoded guards in `src/lib/db.ts` reject any production hostname. **Isolation is absolute.**
- **Option B (M10):** Same project isolation, with additional capabilities for AWS PrivateLink and custom X.509 certs.
- **Verdict:** Both options achieve 100% production isolation.

#### CRITERION 2: AUTHENTICATION COMPATIBILITY
- **Option A (M0):** Uses `SCRAM-SHA-1` username/password authentication. While `SCRAM-SHA-256` is disabled on M0, `SCRAM-SHA-1` over TLS 1.2+ is fully secure for non-production testing. Setting `authMechanism=SCRAM-SHA-1` in `MONGODB_URI` completely prevents handshake warnings.
- **Option B (M10):** Natively supports `SCRAM-SHA-256`, AWS IAM, and X.509.
- **Verdict:** Option B is strictly superior if `SCRAM-SHA-256` is non-negotiable. Option A is fully sufficient if `SCRAM-SHA-1` is accepted for test environments.

#### CRITERION 3: HARDWARE CONSTRAINTS
- **Option A (M0):** Cloud-hosted. Zero RAM consumption on local workstation. Zero disk space consumed on Drive C: or Drive D:.
- **Option B (M10):** Cloud-hosted. Zero RAM and disk impact on local workstation.
- **Verdict:** Both completely solve the local hardware bottleneck.

#### CRITERION 4: WORKLOAD SIZING
- **Option A (M0):** 512 MB storage limit. S45–S50 requires < 5.0 MB (less than 1.0% capacity). 500 max connections easily supports test runner (~15 connections).
- **Option B (M10):** 10 GB storage and 1,500 connections.
- **Verdict:** Option A easily accommodates the entire test workload.

#### CRITERION 5: TOTAL OPERATING COST
- **Option A (M0):** **$0.00 / month.** Zero financial liability.
- **Option B (M10):** **~$185 – $210 / month** ($2,220 – $2,520 / year) in AWS Mumbai (`ap-south-1`).
- **Verdict:** Option A provides immense financial savings for an early-stage test environment.

#### CRITERION 6: OPERATIONAL OVERHEAD
- **Option A (M0):** Auto-pauses if completely inactive for 30 consecutive days. Resuming takes 1 click in the Atlas console.
- **Option B (M10):** Never auto-pauses, but incurs continuous hourly billing.
- **Verdict:** Option A's 30-day auto-pause is trivial to manage or prevent.

---

### 3. THE ARCHITECTURAL DECISION MATRIX

| Decision Factor | Choice A: M0 Free Tier | Choice B: M10 Dedicated Tier |
| :--- | :--- | :--- |
| **Primary Driver** | Cost efficiency & zero procurement overhead | Strict regulatory requirement for SCRAM-SHA-256 / PrivateLink |
| **Recommended Environment** | Isolated Local Developer Testing & CI | High-load Staging / Pre-Production Performance Benchmarking |
| **Financial Impact** | $0.00 recurring | ~$2,400.00 recurring annually |
| **Application Changes** | None (URI param only) | None |

---

### 4. STRATEGIC RECOMMENDATION

**Option A (Atlas M0 Free Tier in AWS Mumbai `ap-south-1`) is strongly recommended for Task 5H live integration testing**, subject to Owner sign-off on the following condition:
- The Owner explicitly approves using **`SCRAM-SHA-1`** (over TLS 1.2+) as the authentication mechanism for the isolated non-production test cluster.

If the Owner requires **`SCRAM-SHA-256`** without exception, **Option B (Atlas M10 Dedicated Tier)** is the mandatory fallback.
