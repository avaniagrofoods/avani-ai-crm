# TASK 5G — RESOURCE AND COST ASSESSMENT
**Project:** AVANI LOAN SERVICES — ChatMitra + AVANI AI CRM  
**Date:** 18 November 2026  
**Role:** Database Reliability Engineer & Cloud FinOps Consultant  
**Status:** **AUTHORITATIVE FEASIBILITY & COST ANALYSIS**

---

## 1. Executive Summary & Local Workstation Telemetry

An independent inspection of the developer workstation host environment was conducted on 18 November 2026:

| Resource Dimension | Measured Capacity | Available / Free | Operational Assessment |
| :--- | :--- | :--- | :--- |
| **Total Physical RAM** | 4,088,640 KB (~3.90 GB) | ~275,172 KB (**~268 MB free**) | **CRITICAL:** High memory pressure. Zero headroom for local database daemons. |
| **Storage: Drive C:** | 113.09 GB | ~14.25 GB free | **MODERATE:** Adequate for source code and Node caches. |
| **Storage: Drive D:** | 31.89 GB | **~3.40 MB free** | **CRITICAL EXHAUSTION:** Drive D is 99.9% full. |
| **Storage: Drive E:** | 123.94 GB | ~70.48 GB free | **AMPLE:** Suitable for archives, backups, and reports. |

### Architectural Constraint Conclusion:
Running a local MongoDB daemon (`mongod.exe` or Docker Desktop) on this host is **strictly infeasible**:
- A running `mongod` instance requires a baseline working set of 500 MB to 1.5 GB of RAM (WiredTiger cache + engine).
- Running `mongod` locally would immediately trigger aggressive OS paging/swapping, severe system unresponsiveness, or an out-of-memory (OOM) crash.
- Docker Desktop requires WSL2 or Hyper-V, which demands a minimum of 2 GB dedicated RAM.

---

## 2. Comparison of Testing Architectural Alternatives

| Testing Strategy | Hardware Resource Impact | Setup Complexity | Production Parity | Financial Cost | Risk to Production | Verdict |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **Option A: Dedicated Cloud Atlas Project (`AVANI-AI-CRM-TESTING`)** | **Zero host RAM** (client TCP socket only, ~2 MB) | Low (Atlas UI / Cloud console setup) | **100% (Identical engine, TLS, SDAM, WiredTiger)** | **$0.00 / mo (M0)** or ~$9.00 / mo (M2) | **ZERO** (Separate Atlas project, isolated IAM) | **RECOMMENDED CHOICE** |
| **Option B: In-Memory Mock Testing (Existing Harness)** | Minimal host RAM (~30 MB for Node process) | Already implemented (`typescript.transpileModule`) | High for unit logic, but cannot test real network sockets, real TLS, or driver reconnections | **$0.00** | **ZERO** | **COMPLEMENTARY (Preserve for CI)** |
| **Option C: Local `mongod` / Docker Desktop Container** | **Fatal RAM exhaustion** (>1.5 GB RAM required) | High (Requires service installs & config) | High | $0.00 | High (System freeze risk, port conflicts) | **REJECTED (Host hardware limitation)** |
| **Option D: Ephemeral Remote Runner (GitHub Actions / Cloud CI)** | Zero host RAM | Moderate (Requires CI pipeline definition) | High | $0.00 within free tier minutes | Low | *Recommended for future automated CI stages* |

---

## 3. Financial & Cost Assessment: Atlas Tiers

MongoDB Atlas pricing for AWS Mumbai (`ap-south-1`):

### Tier 1: M0 Sandbox Free Tier [RECOMMENDED FOR TASK 5G & S45–S50]
- **Cost:** **$0.00 / month** ($0.00 / hour).
- **Storage:** 512 MB shared.
- **Connections:** 500 concurrent connections.
- **Suitability:** Completely adequate for the ~5 MB synthetic test dataset and ~15 concurrent test runner connections required for scenarios S45–S50.
- **Limitation:** Automated continuous backups are not included; requires client-side `mongodump` or synthetic seed scripts.

### Tier 2: M2 Shared Tier [ALTERNATIVE]
- **Cost:** ~$0.012 / hour (**~$9.00 / month**).
- **Storage:** 2 GB shared.
- **Connections:** 1,500 concurrent connections.
- **Features:** Includes automated daily cloud snapshots.

### Tier 3: M10 Dedicated Tier [PRE-PRODUCTION STAGING ONLY]
- **Cost:** ~$0.08 / hour (**~$57.00 / month**).
- **Storage:** 10 GB+ dedicated.
- **Features:** Dedicated vCPU, continuous point-in-time recovery (PITR), VPC peering.
- **Assessment:** Unnecessary cost for current unit/integration testing phase.

---

## 4. Recommended Cost Strategy

1. **Phase 1 (Validation S45–S50):** Provision an **M0 Free Tier** cluster in project `AVANI-AI-CRM-TESTING` at **$0.00 cost**.
2. **Phase 2 (Long-Term Preview / Staging):** If automated backups and higher storage limits are later required by operations, upgrade seamlessly to **M2 (~$9/mo)** via one click in the Atlas console without code changes.
