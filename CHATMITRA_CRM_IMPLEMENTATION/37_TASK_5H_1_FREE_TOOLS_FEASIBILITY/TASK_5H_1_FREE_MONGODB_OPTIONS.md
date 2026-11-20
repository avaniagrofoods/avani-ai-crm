# TASK 5H.1B — FREE MONGODB TESTING OPTIONS EVALUATION
## COMPREHENSIVE 10-DIMENSION TECHNICAL & COST AUDIT OF SIX MONGODB TESTING OPTIONS
### AVANI LOAN SERVICES — ChatMitra + AVANI AI CRM

**Date:** 18 November 2026  
**Execution Mode:** Strictly Read-Only Evaluation  
**Hard Cost Ceiling:** **₹0.00 INR / $0.00 USD**

---

### 1. EXECUTIVE COMPARISON MATRIX Across All 6 Options

| Evaluation Dimension | Option 1: MongoDB Atlas M0 Free Cluster | Option 2: Local MongoDB Community Server (`mongod`) | Option 3: MongoDB Docker Container | Option 4: In-Memory MongoDB (`mongodb-memory-server`) | Option 5: Mock-Based & Offline Mongoose Schema Testing | Option 6: Hybrid Free Architecture (Option 5 + Option 1) |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **1. Free-Tier Eligibility** | **Permanent Free Tier** (1 M0 cluster per Atlas project at ₹0 / $0). | **Open-Source / Free** (SSPL v1 license; ₹0 / $0). | **Free Image, But Host Infeasible** (`docker` not installed; Docker Desktop commercial license rules). | **Open-Source Package, But Not Installed** (MIT license; spawns real `mongod` binary). | **100% Free & Already Installed** (`node:test` + `mongoose@9.7.3`). | **100% Free (₹0 / $0)** combining installed local mocks + 1 Atlas M0 cluster. |
| **2. Credit Card / Billing Required** | **NO** credit card required to sign up or deploy an M0 Free cluster. | **NO** (Local software download, though downloading is prohibited in 5H.1). | **NO** for engine, but not installed on host. | **NO**, but not installed in `node_modules`. | **NO** (Runs entirely offline on local machine). | **NO** credit card required. |
| **3. Storage & Connection Limits** | **512 MB** storage (data + indexes); **500** max connections; **~100 ops/sec**. | Bounded by host disk & RAM (**Host Fails:** only ~268–426 MB free RAM & Drive D: 3.25 MB free). | Bounded by host WSL2 RAM (**Host Fails:** requires ≥2 GB RAM on 3.90 GB host). | Bounded by host RAM (**Host Fails:** requires ~500 MB download + ~500 MB RAM). | Bounded only by Node process heap (~60 MB RAM); zero disk storage overhead. | Local mocks: ~60 MB RAM; Cloud M0: 512 MB storage & 500 connections (<5 MB & ~15 conns needed). |
| **4. Authentication Compatibility** | Supports **`SCRAM-SHA-1`**, **X.509**, and **AWS IAM** (`SCRAM-SHA-256` disabled on M0). | Supports `SCRAM-SHA-1` & `SCRAM-SHA-256` locally. | Supports `SCRAM-SHA-1` & `SCRAM-SHA-256` locally. | Typically runs without auth or mocked SCRAM. | Tests URI auth parsing & connection lifecycle via dependency injection. | Tests offline isolation logic locally + live `SCRAM-SHA-1` over TLS 1.2+ on M0. |
| **5. Region Availability** | Cloud multi-region; AWS Mumbai (`ap-south-1`) **REQUIRES ATLAS UI CONFIRMATION** at ₹0. | Localhost (`127.0.0.1:27017`). | Localhost (`127.0.0.1:27017`). | Localhost ephemeral port. | Local in-process execution (`N/A`). | Local + Atlas M0 (Mumbai `ap-south-1` if verified ₹0 in UI). |
| **6. Network Requirements** | Outbound HTTPS / TCP port `27017` + DNS-SRV resolution + IP Access List (`/32`). | Local loopback only (`127.0.0.1`). | Local loopback + container bridge. | Local loopback (after ~500 MB binary download). | **Zero network required** (100% air-gapped offline). | Offline for daily runs; outbound TLS 1.2+ (`27017`) only for S45–S50. |
| **7. Data Retention & Inactivity** | Persistent until deleted; **auto-pauses after 30 days of zero connections** (manual resume in UI); no automated backups. | Persistent on local disk (if disk space existed). | Ephemeral unless volume-mounted. | Ephemeral (wiped when process exits). | Ephemeral per test run (`node --test`). | Ephemeral synthetic data cleaned up in S50 teardown. |
| **8. Driver (`7.2.0`) & Mongoose (`9.7.3`) Compatibility** | **100% Compatible** with zero code changes via `?authMechanism=SCRAM-SHA-1`. | Compatible in theory, **infeasible on host hardware**. | Compatible in theory, **not installed & infeasible on host**. | Compatible in theory, **not installed & infeasible on host**. | **100% Compatible & Verified** (175/175 tests passing today). | **100% Compatible** with zero code modifications to `src/lib/db.ts`. |
| **9. Tests Real DB Indexes & Persistence?** | **YES** (Real 3-node replica set, real WiredTiger indexes, real CRUD persistence). | Yes in theory, **cannot run on host**. | Yes in theory, **not installed**. | Yes in theory, **not installed**. | **NO** for server-side WiredTiger B-tree execution (validates schema index definitions & mocks only). | **YES** (Offline schema inventory in Phase A + live server index inspection/CRUD on M0 in S45–S50). |
| **10. Risk of Accidental Billing** | **ZERO (₹0 / $0)** as long as no credit card is entered and paid tiers (Flex/M10+) are never selected. | **ZERO (₹0)** financial cost, but **HIGH system crash risk**. | **ZERO (₹0)** if not installed, **HIGH crash risk** if attempted. | **ZERO (₹0)** financial cost, **HIGH crash risk** if attempted. | **ABSOLUTE ZERO (₹0 / $0)** financial and hardware risk. | **ABSOLUTE ZERO (₹0 / $0)** with strict M0-only provisioning guardrail. |

---

### 2. DETAILED EVALUATION OF EACH OPTION

#### OPTION 1: MONGODB ATLAS M0 FREE CLUSTER
- **Eligibility & Zero-Cost Status:** MongoDB Atlas officially offers one permanent **M0 Free Cluster** per Atlas project at **₹0.00 / $0.00 per month**. No credit card or payment method is required to create an Atlas account or provision an M0 cluster.
- **Technical Specs:** 3-node replica set, 512 MB total storage (data + indexes combined), 500 concurrent connections, ~100 operations/second ceiling, mandatory TLS 1.2+ encryption.
- **Compatibility with AVANI AI CRM:**
  - The 18 Mongoose models and 42 custom secondary indexes require **< 5.0 MB** for synthetic test suite S45–S50 (< 1% of the 512 MB cap) and ~15 connections (3% of the 500 connection cap).
  - Supports **`SCRAM-SHA-1`** authentication natively via `?authMechanism=SCRAM-SHA-1` in `MONGODB_URI`, requiring **0 lines of code change** in `src/lib/db.ts`.
  - Compatible with Task 5F.2's `MONGODB_TEST_CLUSTER_DOMAIN` allowlist and 7-stage connection security pipeline.
- **Strict Mumbai Region Stop Rule:**
  > [!IMPORTANT]
  > As established in Task 5G.2, AWS Mumbai (`ap-south-1`) M0 availability is marked **`REQUIRES ATLAS UI CONFIRMATION`**. When the Owner inspects the Atlas UI during a future authorized provisioning step, if Mumbai M0 is available at **₹0**, it is the preferred deployment. **If Mumbai M0 is unavailable without payment, STOP that option immediately and report it. Never create an M10, Flex, or any paid cluster.**

#### OPTION 2: LOCAL MONGODB COMMUNITY SERVER (`mongod.exe`)
- **Current Availability:** `NOT_FOUND` (not installed on the workstation).
- **Hardware Feasibility Verdict:** **INFEASIBLE.** Even though MongoDB Community Server is free software, the local workstation has only **3.90 GB total physical RAM** with **~268–426 MB free RAM**, and Drive D: has only **3.25 MB free space**. A local `mongod` instance allocates a WiredTiger storage cache of `max(256 MB, 50% of (RAM - 1 GB))` plus journal files (300+ MB) and diagnostic data. Starting `mongod.exe` locally would immediately exhaust physical memory and cause severe Windows pagefile thrashing or system freeze.

#### OPTION 3: MONGODB DOCKER IMAGE
- **Current Availability:** `NOT_FOUND` (`docker.exe` is not installed on the workstation).
- **Hardware & Rule Verdict:** **INFEASIBLE & EXCLUDED.** The prompt explicitly states: *"MongoDB Docker image, only if Docker is already installed and operational."* Since Docker is neither installed nor operational—and running a Linux VM/WSL2 daemon requires 2–4 GB of RAM on a 3.90 GB machine—this option is strictly excluded.

#### OPTION 4: IN-MEMORY MONGODB TESTING (`mongodb-memory-server`)
- **Current Availability:** `NOT_FOUND` (not installed in Project 1 or Project 2 `node_modules`).
- **Technical Verdict:** **INFEASIBLE & EXCLUDED.** `mongodb-memory-server` works by downloading a ~300–600 MB precompiled `mongod` binary and spawning a real `mongod` process using an in-memory or temp-directory storage engine. Installing packages and downloading binaries are strictly prohibited in Task 5H.1, and spawning an in-memory `mongod` on a machine with ~268–426 MB free RAM would trigger an immediate Out-Of-Memory (OOM) crash.

#### OPTION 5: MOCK-BASED & OFFLINE DATABASE TESTING (EXISTING STACK)
- **Current Availability:** **INSTALLED & OPERATIONAL AT ₹0.**
- **How It Works Today:**
  - Uses Node.js `v26.13.1` built-in test runner (`node --test`), TypeScript `5.9.3` in-memory transpilation (`ts.transpileModule`), Mongoose `9.7.3` offline schema/model inspection (`model.schema.indexes()`, `doc.validateSync()`), and dependency-injected mock Mongoose/DNS objects in `connectToDatabase(options)`.
  - Currently executes **175/175 offline regression tests** across 5 test suites in Project 2 with **0 network sockets, 0 cloud calls, and ~60 MB RAM usage**.
- **Limitation:** While mock-based testing verifies 100% of the 7-stage isolation guard logic, runtime classification, DNS-SRV validation, and Mongoose schema rules, it cannot verify live server-side WiredTiger unique index constraint enforcement or live Atlas TLS/SCRAM handshakes.

#### OPTION 6: HYBRID FREE COMPATIBLE ALTERNATIVE (OPTION 5 + OPTION 1)
- **Architecture:** Combines **Option 5 (Existing Local Mock/Offline Testing)** for all daily development, security guard verification (S01–S44 + TEST_01–TEST_15), and webhook/opt-out regression testing, with **Option 1 (Atlas M0 Free Cluster at ₹0)** used *exclusively* for owner-authorized live integration testing (S45–S50).
- **Why It Is Optimal:** Imposes **0 MB RAM overhead** for the database engine on the 3.90 GB workstation, requires **0 package installations**, maintains **₹0.00 / $0.00 cost**, and tests both offline isolation guards and real server-side MongoDB replica-set persistence.
