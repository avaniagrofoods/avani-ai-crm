# TASK 5G.2 — CORRECTED ATLAS AUTHENTICATION MATRIX
## OFFICIAL ATLAS AUTHENTICATION CAPABILITIES ACROSS CLUSTER TIERS

**Project:** AVANI LOAN SERVICES — ChatMitra + AVANI AI CRM  
**Date:** 18 November 2026  
**Execution Mode:** STRICTLY READ-ONLY AUDIT  
**Authority:** Task 5G.2 Architectural Specification  
**Official References:**  
- MongoDB Manual Core Authentication: https://www.mongodb.com/docs/manual/core/authentication/  
- Atlas Free & Shared Tier Limitations: https://www.mongodb.com/docs/atlas/reference/free-shared-limitations/  

---

### 1. OFFICIAL AUTHENTICATION CAPABILITIES MATRIX

Based on current official MongoDB Atlas technical documentation, the authentication capabilities across cluster tiers are correctly established as follows:

| Authentication Mechanism | Atlas Free Tier (M0) | Dedicated Tiers (M10+) | Official Documentation Source |
| :--- | :---: | :---: | :--- |
| **SCRAM-SHA-1** | **SUPPORTED** (Default) | **SUPPORTED** | Standard password-based authentication across all Atlas tiers. |
| **SCRAM-SHA-256** | **NOT SUPPORTED** | **SUPPORTED** | Free clusters disallow SCRAM-SHA-256. Dedicated clusters support it natively. |
| **X.509 Certificates** | **SUPPORTED** (Atlas-Managed) | **SUPPORTED** (Atlas & Customer CA) | Free clusters support Atlas-managed user certificates. Dedicated tiers also support custom CAs. |
| **AWS IAM (`MONGODB-AWS`)**| **SUPPORTED** | **SUPPORTED** | Free clusters support AWS IAM roles and users. Dedicated tiers add PrivateLink/VPC integration. |

> [!IMPORTANT]
> **Task 5G.1 Correction:** Task 5G.1 incorrectly stated that M0 disables X.509 and AWS IAM. Official documentation explicitly confirms that Atlas Free/M0 clusters **do support** both **X.509 Certificates** and **AWS IAM** authentication. However, M0 clusters **do not support SCRAM-SHA-256**.

---

### 2. DETAILED BREAKDOWN OF THE FOUR AUTHENTICATION MECHANISMS

```
               ┌─────────────────────────────────────────────────────────────┐
               │             MONGODB ATLAS AUTHENTICATION METHODS            │
               └──────────────────────────────┬──────────────────────────────┘
                                              │
         ┌──────────────────┬─────────────────┴────────────────┬──────────────────┐
         ▼                  ▼                                  ▼                  ▼
    SCRAM-SHA-1        SCRAM-SHA-256                         X.509             AWS IAM
  (M0 & M10+)            (M10+ Only)                      (M0 & M10+)        (M0 & M10+)
  • Password-based   • Password-based                   • Certificate      • Role/User IAM
  • 0 Code Changes   • 0 Code Changes                   • Requires .pem    • Needs AWS Auth
  • Ready in db.ts   • Ready in db.ts                   • Code Changes     • High Complexity
```

---

#### METHOD 1: SCRAM-SHA-1 (Password-Based Authentication)
1. **Atlas Tier Compatibility:** Supported on **both M0 (Free Tier)** and **M10+ (Dedicated)**.
2. **Required Driver Configuration:** In `MONGODB_URI`, include `?authMechanism=SCRAM-SHA-1` to avoid the driver default `SCRAM-SHA-256` trial attempt.
3. **Credential Requirements:** Standard username and password created in Atlas Database Access (e.g., `als_crm_test_worker`).
4. **TLS Requirements:** Strictly requires **TLS 1.2+** for all connections to Atlas.
5. **Application Code Changes:** **ZERO code changes.** The existing `src/lib/db.ts` passes the URI directly to Mongoose, which transparently parses `authMechanism`.
6. **Operational Complexity:** **Very Low.** Generated in the Atlas Console in 30 seconds; easily stored in `.env.local`.
7. **Security Trade-Offs:** Uses PBKDF2 with HMAC-SHA-1 and 10,000+ iterations. While SHA-1 has collision weaknesses in digital signatures, its use in HMAC (HMAC-SHA-1) is not subject to collision attacks. In transit, all credentials and challenges are fully encapsulated inside TLS 1.2+ encryption.
8. **Task 5F.2 Isolation Compatibility:** **100% Supported.** Works seamlessly with `src/lib/db.ts` connection guards and topology checks.

---

#### METHOD 2: SCRAM-SHA-256 (Modern Password-Based Authentication)
1. **Atlas Tier Compatibility:** **NOT supported on Free/M0 clusters.** Supported **only on M10+ (Dedicated)** and Flex tiers where enabled.
2. **Required Driver Configuration:** Default driver behavior or explicit `?authMechanism=SCRAM-SHA-256`.
3. **Credential Requirements:** Standard username and password created on an M10 cluster.
4. **TLS Requirements:** Strictly requires **TLS 1.2+**.
5. **Application Code Changes:** **ZERO code changes.** Supported by existing `src/lib/db.ts`.
6. **Operational Complexity:** **Very Low.** Identical to SCRAM-SHA-1 management.
7. **Security Trade-Offs:** Cryptographically modern 256-bit hashing; completely resistant to brute-force dictionary attacks even if salted password hashes are exfiltrated from the database engine.
8. **Task 5F.2 Isolation Compatibility:** **100% Supported.** Works with existing `src/lib/db.ts`.

---

#### METHOD 3: X.509 CERTIFICATES (Certificate-Based Authentication)
1. **Atlas Tier Compatibility:** Supported on **M0 (Free)** via Atlas-managed CA certificates, and on **M10+** with customer-managed CAs.
2. **Required Driver Configuration:** Requires `authMechanism=MONGODB-X509` in the URI, and passing `tlsCertificateKeyFile: '<path-to-cert.pem>'` in the driver connection options. The username in the URI must either be omitted or set to the Subject Distinguished Name (DN) of the client certificate.
3. **Credential Requirements:** Client certificate and private key packaged in a `.pem` file generated via the Atlas UI or Atlas API.
4. **TLS Requirements:** **Mandatory mutual TLS (mTLS).**
5. **Application Code Changes:** **REQUIRED.** The current `src/lib/db.ts` does not accept or pass `tlsCertificateKeyFile` to `mongoose.connect()`. Code would need to be added to read a local `.pem` certificate path and pass it into connection options.
6. **Operational Complexity:** **High.** Requires provisioning, downloading, securely storing, and distributing local `.pem` files on developer machines. Certificates expire (typically 90 days or 1 year) and require periodic rotation.
7. **Security Trade-Offs:** Eliminates static passwords in connection strings; binds authentication to cryptographic key possession. However, local `.pem` file storage on developer workstations creates file-permission security risks.
8. **Task 5F.2 Isolation Compatibility:** **Partially Incompatible without code modification.** The connection options in `src/lib/db.ts` currently lack certificate path bindings.

---

#### METHOD 4: AWS IAM (`MONGODB-AWS`)
1. **Atlas Tier Compatibility:** Supported on **both M0 (Free)** and **M10+ (Dedicated)**.
2. **Required Driver Configuration:** Requires `authMechanism=MONGODB-AWS`. If using STS assume-role or ambient credentials, requires `@aws-sdk/credential-providers` or environment variables `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`, and `AWS_SESSION_TOKEN`.
3. **Credential Requirements:** AWS IAM User or Role with trusted policy linked to the Atlas Project.
4. **TLS Requirements:** Strictly requires **TLS 1.2+**.
5. **Application Code Changes:** **REQUIRED for role assumption.** To use role-based authentication without static keys in the URI, code must import `@aws-sdk/credential-providers` and pass `AWS_CREDENTIAL_PROVIDER` to `authMechanismProperties`. If static keys are encoded in the URI (`mongodb+srv://<KEY>:<SECRET>@...`), no code changes are required, but secret keys are exposed.
6. **Operational Complexity:** **Very High.** Requires AWS IAM console setup, Atlas Project cloud provider integration, STS session token handling, and local AWS CLI configuration.
7. **Security Trade-Offs:** Enables short-lived temporary credentials and centralized enterprise IAM governance. However, introduces external cloud identity dependencies for a local test runner.
8. **Task 5F.2 Isolation Compatibility:** **Incompatible without code modification or raw credential URI encoding.** Ambient role assumption requires peer package installation and driver options update.

---

### 3. EVALUATION OF THE FOUR ARCHITECTURAL COMBINATIONS

| Option | Architecture | Atlas Tier | Auth Mechanism | Code Changes in `db.ts` | Operational Complexity | Recommendation Status |
| :---: | :--- | :---: | :---: | :---: | :---: | :--- |
| **A** | **M0 + SCRAM-SHA-1** | Free ($0) | `SCRAM-SHA-1` | **NONE** | **Very Low** | **APPROVED FOR OWNER CONSIDERATION** |
| **B** | **M0 + X.509** | Free ($0) | `MONGODB-X509` | **REQUIRED** | **High** (Cert lifecycle) | Feasible on Atlas, but requires prohibited code edits |
| **C** | **M0 + AWS IAM** | Free ($0) | `MONGODB-AWS` | **REQUIRED** | **Very High** (AWS setup) | Feasible on Atlas, but introduces heavy AWS overhead |
| **D** | **M10 + SCRAM-SHA-256** | Paid (~$85–$105) | `SCRAM-SHA-256` | **NONE** | **Very Low** | **APPROVED AS FORMAL PAID ALTERNATIVE** |

---

### 4. CONCLUSION

- **Atlas M0 Free Tier officially supports SCRAM-SHA-1, X.509, and AWS IAM.**
- Of the three supported M0 mechanisms, **only SCRAM-SHA-1 works with zero application code changes** in `src/lib/db.ts`.
- **Option A (M0 + SCRAM-SHA-1)** is the simplest, safest, zero-cost architecture for running synthetic live tests S45–S50 without modifying application code.
- **Option D (M10 + SCRAM-SHA-256)** is the definitive paid architecture if the Owner requires SHA-256 without compromise.
