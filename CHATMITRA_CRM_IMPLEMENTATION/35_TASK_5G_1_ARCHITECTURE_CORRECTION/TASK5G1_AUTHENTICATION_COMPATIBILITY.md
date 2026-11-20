# TASK 5G.1 — AUTHENTICATION COMPATIBILITY SPECIFICATION
## MONGODB ATLAS AUTHENTICATION MECHANISMS: M0 FREE TIER VS. DEDICATED TIERS

**Project:** AVANI LOAN SERVICES — ChatMitra + AVANI AI CRM  
**Date:** 18 November 2026  
**Status:** Read-Only Architectural Correction  
**Authority:** Task 5G.1 Security Specification  

---

### 1. EXECUTIVE OBJECTIVE

In Task 5G, the proposed test plan assumed that the MongoDB Atlas M0 (Free Tier) cluster would support and enforce `SCRAM-SHA-256` authentication out of the box. 

This technical investigation reviews the official authentication capabilities and limitations of MongoDB Atlas Free Tier (`M0`) and Shared Tiers compared to Dedicated Tiers (`M10+`), resolves driver-server handshake incompatibilities, and establishes two non-conflicting architecture alternatives.

---

### 2. OFFICIAL MONGODB ATLAS AUTHENTICATION CAPABILITIES MATRIX

Official MongoDB Atlas technical documentation and operational telemetry establish the following authentication mechanism support by cluster tier:

| Authentication Mechanism | M0 Free Tier | Flex / Shared (M2/M5 legacy) | Dedicated Tiers (M10+) | Compatibility Verdict |
| :--- | :---: | :---: | :---: | :--- |
| **SCRAM-SHA-1** | **SUPPORTED** (Default) | **SUPPORTED** (Default) | **SUPPORTED** | Universally supported across all Atlas tiers. Standard for username/password authentication. |
| **SCRAM-SHA-256** | **DISABLED / RESTRICTED** | **DISABLED / RESTRICTED** | **FULLY SUPPORTED** | Atlas shared/M0 clusters disallow or trigger `BadValue: SCRAM-SHA-256 authentication is disabled`. Dedicated M10+ natively enables SCRAM-SHA-256. |
| **X.509 Certificates** | **NOT SUPPORTED** | **NOT SUPPORTED** | **FULLY SUPPORTED** | Customer-managed or Atlas-managed X.509 user certificates require Dedicated Tier (M10+). |
| **AWS IAM (`MONGODB-AWS`)** | **NOT SUPPORTED** | **NOT SUPPORTED** | **FULLY SUPPORTED** | Passwordless AWS IAM role authentication is strictly restricted to Dedicated Tiers (M10+). |
| **LDAP Authentication** | **NOT SUPPORTED** | **NOT SUPPORTED** | **FULLY SUPPORTED** | Enterprise directory integration requires Dedicated Tier (M10+). |

---

### 3. DRIVER-TO-SERVER HANDSHAKE BEHAVIOR & THE "BADVALUE" ANOMALY

Modern MongoDB drivers (including `mongodb@7.2.0` and `mongoose@9.7.3` running on Node.js v26) implement the modern MongoDB specifications:
1. **Default Negotiation:** When no explicit `authMechanism` is specified, modern drivers send a connection handshake requesting `SCRAM-SHA-256` first.
2. **Atlas M0 Response:** On Atlas M0 Free Tiers, the authentication engine logs:
   ```text
   Authentication failed: BadValue: SCRAM-SHA-256 authentication is disabled
   ```
3. **Fallback Mechanism:** In standard driver negotiation, the driver receives this error and automatically falls back to `SCRAM-SHA-1`. While the connection eventually succeeds, the Atlas Project Access Logs record false-positive authentication failure alerts.
4. **Strict Mechanism Parameter:** If the application or connection string explicitly mandates `authMechanism=SCRAM-SHA-256` against an M0 cluster, the handshake aborts with a fatal connection error.
5. **Clean Handshake Resolution:** To eliminate the warning and avoid spurious failure logs on M0, the client connection string must explicitly declare:
   ```text
   mongodb+srv://<user>:<password>@<test-cluster>.mongodb.net/avani_ai_crm_test?retryWrites=true&w=majority&authMechanism=SCRAM-SHA-1
   ```

---

### 4. COMPARISON WITH APPLICATION SECURITY POLICY

The security policy of AVANI AI CRM establishes:
- **Zero Production Risk:** Test credentials and connection paths must never authenticate against or compromise the production database (`avani_ai_crm_prod` on `rhpn2gh.mongodb.net`).
- **Cryptographic Channel Security:** TLS 1.2+ is strictly mandatory for all in-transit traffic, regardless of cluster tier.
- **Credential Storage:** Test database credentials must reside solely in local development environments and never be committed to Git.
- **Authentication Strength:**
  - `SCRAM-SHA-256` provides 256-bit HMAC hashing resistant to dictionary attacks even if salted password hashes are intercepted.
  - `SCRAM-SHA-1` provides 160-bit HMAC hashing with PBKDF2 salt and iteration counts (Atlas enforces 10,000+ iterations). Over TLS 1.2+, credentials in transit are fully protected from eavesdropping and replay attacks.

---

### 5. ARCHITECTURAL ALTERNATIVES

To satisfy the requirement without weakening security or modifying application code, two distinct architectural alternatives are defined:

#### ALTERNATIVE A: ATLAS M0 FREE TIER WITH SCRAM-SHA-1 AUTHENTICATION
- **Cluster Tier:** Atlas M0 Free Tier (3-node replica set, 512 MB shared storage).
- **Authentication Mechanism:** `SCRAM-SHA-1` explicitly declared via URI parameter `authMechanism=SCRAM-SHA-1` or negotiated default fallback.
- **Network Security:** TLS 1.2+ encrypted tunnel + IP Access List allowlisting.
- **Application Impact:** **Zero code modifications.** Handled entirely via the `MONGODB_URI` environment variable configuration in `.env.local`.
- **Cost:** **$0.00 / month.**
- **Suitability:** Perfectly adequate for synthetic schema validation, index inspection, and functional CRUD testing (S45–S50).

#### ALTERNATIVE B: DEDICATED ATLAS TIER (M10+) WITH FULL SCRAM-SHA-256
- **Cluster Tier:** Atlas M10 Dedicated Tier (3 dedicated data nodes, 2 vCPUs, 2 GB RAM, 10 GB dedicated storage).
- **Authentication Mechanism:** Native `SCRAM-SHA-256`, with optional support for `MONGODB-AWS` (IAM) or `MONGODB-X509`.
- **Network Security:** TLS 1.2+ encrypted tunnel + IP Access List + Optional AWS VPC Peering / AWS PrivateLink.
- **Application Impact:** **Zero code modifications.**
- **Cost:** **~$170.00 – $180.00 / month** in AWS Mumbai (`ap-south-1`).
- **Suitability:** Enterprise-grade production mirroring; required only if the Owner strictly refuses `SCRAM-SHA-1` in non-production environments.

---

### 6. ARCHITECTURAL CONCLUSION & VERIFICATION

1. The assumption in Task 5G that M0 supports native, uninhibited `SCRAM-SHA-256` was **technically incorrect**.
2. Atlas M0 **does** support username/password authentication via `SCRAM-SHA-1`.
3. If the Owner authorizes `SCRAM-SHA-1` for the isolated test database, **Alternative A (M0 Free Tier)** remains completely viable and zero-cost.
4. If enterprise security mandates `SCRAM-SHA-256` or AWS IAM, **Alternative B (M10 Dedicated)** must be provisioned.
