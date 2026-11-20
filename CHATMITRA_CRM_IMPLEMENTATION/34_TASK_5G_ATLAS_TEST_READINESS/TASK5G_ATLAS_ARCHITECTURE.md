# TASK 5G — ATLAS TEST ENVIRONMENT ARCHITECTURE DESIGN
**Project:** AVANI LOAN SERVICES — ChatMitra + AVANI AI CRM  
**Date:** 18 November 2026  
**Role:** Senior MongoDB Atlas Architect & Cloud Security Engineer  
**Status:** **AUTHORITATIVE CLOUD ARCHITECTURE BLUEPRINT**

---

## 1. Project-Level Isolation: Separate Project vs Same Project

### Comparative Evaluation:
- **Option A (Separate Atlas Project `AVANI-AI-CRM-TESTING`):** [RECOMMENDED]
  - *IAM Boundaries:* Completely independent Organization Project Access Lists. API keys, programmatic service accounts, and alert channels are strictly isolated.
  - *Network Access Lists:* Project-level IP allowlists for testing do not touch the production cluster's allowlist.
  - *Audit Segregation:* Project audit logs for testing remain independent of production compliance audits.
  - *Blast Radius:* Any accidental cluster deletion, user alteration, or billing interruption in the test project has zero impact on the production cluster.
- **Option B (Separate Cluster within Existing Production Project):** [REJECTED]
  - *Risk:* Shared Project Owner/Editor IAM roles; shared programmatic API keys; shared IP access lists. A rogue IP added for testing would instantly gain network reachability to the production cluster.

**Architectural Decision:** Deploy test resources into a dedicated, separate Atlas project: **`AVANI-AI-CRM-TESTING`**.

---

## 2. Atlas Tier Selection Matrix

| Tier Type | Tier Name | vCPU / RAM | Storage Capacity | Max Concurrent Connections | Backup Support | Estimated Monthly Cost | Recommendation |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **Sandbox Free** | **M0** | Shared | 512 MB | 500 connections | Manual / mongodump only | **$0.00 / month** | **RECOMMENDED FOR S45–S50 PHASE** |
| **Shared Paid** | **M2** | Shared | 2 GB | 1,500 connections | Basic daily snapshots | ~$9.00 / month | *Alternative if automated snapshots required* |
| **Shared Paid** | **M5** | Shared | 5 GB | 1,500 connections | Basic daily snapshots | ~$25.00 / month | *Overkill for current test scope* |
| **Dedicated** | **M10** | 2 vCPU / 2GB RAM | 10 GB+ | 1,500 connections | Continuous cloud backups & PITR | ~$57.00 / month | *Recommended only for pre-production load testing* |

### Tier Decision Rationale:
For executing integration scenarios S45 through S50 (synthetic payload ingestion, idempotency locks, worker leases, unique index verification), the **M0 Free Tier** is more than sufficient:
- Maximum synthetic dataset volume across S45–S50 will not exceed **5 MB** (well within the 512 MB storage limit).
- Connection requirement for test suites is **10 to 20 connections** (well within M0's 500 connection limit).
- **Cost is $0.00**, incurring zero financial liability during validation.

---

## 3. Geographic Region: AWS Mumbai (`ap-south-1`)

- **Cloud Provider:** Amazon Web Services (AWS)
- **Region Code:** `ap-south-1` (Mumbai, India)
- **Suitability Rationale:**
  - Production cluster (`rhpn2gh.mongodb.net`) is deployed in AWS Mumbai.
  - Hosting test infrastructure in `ap-south-1` guarantees identical latency (~10–18 ms from Indian client endpoints and Vercel edge functions), realistic round-trip times for lock acquisition, and identical underlying AWS VPC network behavior.

---

## 4. Connection Pooling & Limits

In `src/lib/db.ts` (lines 767–774), the Mongoose connection options define:
```typescript
const opts = {
  bufferCommands: false,
  autoIndex: !isProd,
  serverSelectionTimeoutMS: 10000,
  connectTimeoutMS: 10000,
  socketTimeoutMS: 45000,
  tls: useTls,
  maxPoolSize: 10,
};
```
- **Pool Size:** `maxPoolSize: 10` per Node.js worker process.
- **Concurrency Headroom:** Running up to 5 concurrent local test workers uses at most 50 sockets, leaving 450 free connection slots on an M0 cluster.

---

## 5. Network Security & IP Access Lists

- **Principle:** Atlas clusters are firewalled by default. No connection is permitted without an explicit IP entry.
- **Policy for `AVANI-AI-CRM-TESTING`:**
  - **NEVER** use `0.0.0.0/0` (allow access from anywhere).
  - Explicitly allowlist only the specific developer's outbound public IPv4 IP address.
  - If testing from Vercel Preview deployments, configure a temporary time-bound IP entry or Vercel secure integration.

---

## 6. TLS Encryption & Wire Security

- **Enforcement:** MongoDB Atlas mandates TLS 1.2+ on all endpoints. Unencrypted plaintext connections are rejected at the edge.
- **Application Alignment:** In `src/lib/db.ts`, `useTls` is automatically enabled whenever the URI uses `mongodb+srv://` or contains `mongodb.net`.
- **Certificate Verification:** Native system CA root certificates validate the Atlas Let's Encrypt / DigiCert authority certificates.

---

## 7. Database User Permissions (Least Privilege)

- **Username:** `als_crm_test_worker`
- **Authentication Database:** `admin` (SCRAM-SHA-256)
- **Assigned Roles (Strictly Scoped):**
  - **Database:** `avani_ai_crm_test` (Exclusively)
  - **Role:** `readWrite` on `avani_ai_crm_test`
- **Strict Prohibitions:**
  - **NO** `clusterAdmin`, `hostManager`, or `dbAdminAnyDatabase` roles.
  - **NO** access to `avani_ai_crm_prod`.
  - **NO** access to `admin`, `config`, or `local` system databases.

---

## 8. Backup & Operational Capabilities

- **On M0 Tier:** Cloud automated snapshots are not available on M0. Disaster recovery for the test database is achieved via automated synthetic seeding scripts (`npm run seed:test`) and client-side `mongodump` snapshots if needed.
- **On M2 Tier (Alternative):** Atlas provides automated daily snapshots with a 1-day retention window.
- **Monitoring:** Atlas Cloud Console provides real-time telemetry:
  - Operations per second (Oplog throughput).
  - Active connections vs available connections.
  - Network throughput and query execution latencies.
  - Slow query profiler (queries exceeding 100 ms).
