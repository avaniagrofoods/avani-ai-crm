# TASK 5G.1 — M0 FREE TIER VS. PAID DEDICATED TIER ARCHITECTURAL COMPARISON
## COMPREHENSIVE 16-DIMENSION EVALUATION MATRIX

**Project:** AVANI LOAN SERVICES — ChatMitra + AVANI AI CRM  
**Date:** 18 November 2026  
**Status:** Read-Only Architectural Comparison  
**Authority:** Task 5G.1 Decision Framework  

---

### 1. ARCHITECTURAL COMPARISON MATRIX

| Dimension | Option A: Atlas M0 (Free Sandbox) | Option B: Atlas M10 (Dedicated Cluster) | Operational Impact on AVANI CRM Testing |
| :--- | :--- | :--- | :--- |
| **1. Monthly Recurring Cost** | **$0.00 / month** | **~$175 – $210 / month** | Option A saves ~$2,100 – $2,500 annually in testing overhead. |
| **2. Target Deployment Region**| AWS Mumbai (`ap-south-1`) | AWS Mumbai (`ap-south-1`) | Identical geographical proximity and low network latency (< 25 ms). |
| **3. High Availability** | 3-node managed replica set | 3 dedicated data-bearing nodes | Both provide replica set topology required for Mongoose transactions. |
| **4. Auth: SCRAM-SHA-1** | **Supported (Default)** | **Supported** | Option A natively supports SCRAM-SHA-1 over TLS 1.2+. |
| **5. Auth: SCRAM-SHA-256** | **Disabled / Restricted** | **Fully Supported** | Option B required if SCRAM-SHA-256 is strictly mandatory. |
| **6. Auth: AWS IAM / X.509** | **Not Supported** | **Fully Supported** | Not required for local CRM test runner. |
| **7. Storage Allocation** | 512 MB (Data + Indexes) | 10 GB to 128 GB dedicated | Test suite S45–S50 requires < 5.0 MB (< 1% of M0 cap). |
| **8. Memory & Compute** | Shared vCPU & Shared RAM | 2 vCPUs & 2.0 GB RAM / node | Test suite executes ~15 connections; M0 handles up to 500. |
| **9. Throughput Limits** | Throttled at ~100 ops/sec | Dedicated IOPS (3,000 baseline)| Test suite generates ~5 ops/sec; M0 throttle is never reached. |
| **10. Backup & Restore** | None (No automated snapshots) | Continuous Cloud Backups + PITR | Test database holds only ephemeral synthetic data; zero backup need. |
| **11. Inactivity Auto-Pause** | **Auto-pauses after 30 days idle**| **No auto-pause** | On M0, requires 1 manual click to resume if left idle for 30 days. |
| **12. Network Isolation** | IP Access List (Public Egress) | IP Access List + VPC Peering / PrivateLink | Local development connects via public IP allowlisting on both. |
| **13. Database Isolation** | **Total Isolation** (Separate Project)| **Total Isolation** (Separate Project)| Both achieve 100% physical and logical isolation from production. |
| **14. Crash/Failure Blast Radius**| **Zero** (Isolated project) | **Zero** (Isolated project) | Neither tier can affect `rhpn2gh.mongodb.net` or `avani_ai_crm_prod`. |
| **15. Mongoose 9.7 Compatibility**| **Full Compatibility** | **Full Compatibility** | Both run MongoDB 7.0/8.0 wire protocol supported by Mongoose 9. |
| **16. Provisioning Complexity** | Single-click web UI (No billing)| Requires credit card & billing profile | Option A avoids corporate procurement hurdles. |

---

### 2. TRADE-OFF EVALUATION

#### OPTION A: ATLAS M0 FREE TIER
- **Strengths:**
  - Zero financial cost ($0/month).
  - Perfect replica set topology for Mongoose transaction testing.
  - Generous 500 connection limit and 512 MB storage easily accommodates test suite S45–S50.
  - Complete logical and infrastructure isolation from the production Atlas project.
- **Compromises:**
  - Authentication must use `SCRAM-SHA-1` instead of `SCRAM-SHA-256`.
  - Cluster automatically pauses if left completely unused for 30 consecutive days.
  - No automated snapshots or point-in-time recovery.
  - No private networking (AWS VPC Peering / PrivateLink).

#### OPTION B: ATLAS M10 DEDICATED TIER
- **Strengths:**
  - Natively supports `SCRAM-SHA-256`, AWS IAM, and X.509 certificate authentication.
  - Enterprise reliability with continuous cloud backups and automated snapshots.
  - Private networking support (AWS VPC Peering and AWS PrivateLink).
  - Never auto-pauses due to inactivity.
- **Compromises:**
  - High recurring expense: **~$175 – $210 / month** ($2,100 – $2,500/year) dedicated purely to running test suites.
  - Requires corporate billing account and monthly invoice tracking.
  - Massive overkill for a 5 MB synthetic test dataset and ~15 connection test runner.

---

### 3. TECHNICAL RISK MATRIX

| Risk Factor | Option A (M0) Severity | Option B (M10) Severity | Mitigation / Safeguard |
| :--- | :---: | :---: | :--- |
| **Cross-Contamination with Prod**| **NONE** | **NONE** | Hardcoded fail-closed validation in `src/lib/db.ts` rejects production hostname. |
| **Cryptographic Eavesdropping** | **NONE** | **NONE** | TLS 1.2+ encryption in transit enforced for all connections. |
| **30-Day Inactivity Auto-Pause** | **LOW** | **NONE** | Resume button in Atlas UI or periodic scheduled test execution. |
| **Unexpected Cloud Costs** | **ZERO** | **MODERATE** | Option A is completely free. Option B incurs monthly credit card charges. |
| **Auth Handshake Disruption** | **LOW** | **NONE** | Configure `authMechanism=SCRAM-SHA-1` in test connection string. |
