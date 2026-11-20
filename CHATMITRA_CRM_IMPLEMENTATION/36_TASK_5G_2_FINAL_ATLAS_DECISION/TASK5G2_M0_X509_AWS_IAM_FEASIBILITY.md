# TASK 5G.2 — FEASIBILITY OF X.509 AND AWS IAM ON ATLAS M0
## DETAILED FEASIBILITY, DRIVER REQUIREMENTS & OPERATIONAL FRICTION AUDIT

**Project:** AVANI LOAN SERVICES — ChatMitra + AVANI AI CRM  
**Date:** 18 November 2026  
**Execution Mode:** STRICTLY READ-ONLY FEASIBILITY STUDY  
**Authority:** Task 5G.2 Security Specification  

---

### 1. EXECUTIVE ASSESSMENT

While official MongoDB Atlas documentation confirms that **Free/M0 clusters support both X.509 Certificates and AWS IAM**, an engineering feasibility study must examine what is required on the **client and driver side** to actually utilize these mechanisms within the AVANI AI CRM project.

This report evaluates whether X.509 or AWS IAM can be implemented within the strict scope of the project without violating:
1. The **prohibition against modifying application source code** during read-only audits.
2. The **prohibition against installing new npm packages** without authorization.
3. The operational simplicity required for reproducible local integration testing.

---

### 2. FEASIBILITY ANALYSIS: OPTION B (M0 + X.509 CERTIFICATES)

#### A. HOW X.509 WORKS ON ATLAS M0
1. Atlas M0 provides an **Atlas-Managed Certificate Authority (CA)**.
2. The user navigates to **Database Access -> Add New Database User -> Certificate**.
3. Atlas generates a user certificate and a private key (or signs a CSR submitted by the user).
4. The user downloads a combined `.pem` file containing the client certificate and private key.
5. In MongoDB, the username is the **Distinguished Name (DN)** from the certificate (e.g., `CN=als_crm_test_worker,OU=Testing,O=AvaniLoanServices`).

#### B. CLIENT-SIDE & DRIVER REQUIREMENTS
To use X.509 with Mongoose 9.7 / MongoDB Driver 7.2:
- The driver cannot authenticate via URI parameters alone.
- The Node.js MongoDB driver requires passing the certificate path in options:
  ```typescript
  const opts = {
    tls: true,
    tlsCertificateKeyFile: '/absolute/path/to/X509-cert.pem',
    authMechanism: 'MONGODB-X509',
    // ... other opts
  };
  ```
- If the `.pem` file has a passphrase, `tlsCertificateKeyFilePassword` must also be supplied.

#### C. APPLICATION CODE AUDIT (`src/lib/db.ts`)
Inspection of `src/lib/db.ts` lines 766–775 reveals the current connection options:
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
- There is **no mechanism** in `src/lib/db.ts` to read an environment variable for `tlsCertificateKeyFile` or forward it to Mongoose.
- Implementing X.509 **strictly requires modifying `src/lib/db.ts`** to support certificate path configuration.

#### D. OPERATIONAL OVERHEAD & DRAWBACKS
1. **Certificate Expiration:** Atlas-generated client certificates expire (typically within 90 days to 1 year). An expired certificate causes instant connection failure and test pipeline breakage.
2. **Key Security on Workstation:** Storing private key `.pem` files on a developer laptop creates risks of accidental file leakage or exposure in Git commits if not added to `.gitignore`.
3. **Cross-Platform Portability:** Absolute file paths to the `.pem` file on Windows (`C:\...`) break if tests are run in CI/CD (Linux).

**Feasibility Verdict for M0 + X.509:** **TECHNICALLY SUPPORTED BY ATLAS, BUT INFEASIBLE WITHOUT CODE MODIFICATION AND ADDS HIGH OPERATIONAL FRICTION.**

---

### 3. FEASIBILITY ANALYSIS: OPTION C (M0 + AWS IAM)

#### A. HOW AWS IAM WORKS ON ATLAS M0
1. In MongoDB Atlas, an IAM role or user is registered under **Database Access**.
2. Atlas configures trust with the AWS account ID.
3. The application connects using the `MONGODB-AWS` authentication mechanism.

#### B. CLIENT-SIDE & DRIVER REQUIREMENTS
In Node.js (`mongodb@7.2.0` / `mongoose@9.7.3`), there are two paths to authenticate via `MONGODB-AWS`:
1. **Static AWS Credentials in URI:**
   ```text
   mongodb+srv://<AWS_ACCESS_KEY_ID>:<AWS_SECRET_ACCESS_KEY>@cluster.mongodb.net/avani_ai_crm_test?authMechanism=MONGODB-AWS
   ```
   If using session tokens:
   `&authMechanismProperties=AWS_SESSION_TOKEN:<TOKEN>`
2. **Dynamic / Ambient Credentials (AWS SDK Provider Chain):**
   Requires the external npm package `@aws-sdk/credential-providers` to supply `fromNodeProviderChain()`.

#### C. APPLICATION & DEPENDENCY AUDIT
1. **Dependency Check:** Inspection of `package.json` confirms that `@aws-sdk/credential-providers` is **not installed**.
2. **Code Configuration:** `src/lib/db.ts` does not configure `authMechanismProperties.AWS_CREDENTIAL_PROVIDER`.
3. **Static Key Security Risk:** Embedding AWS Access Key IDs and Secret Access Keys into `.env.local` or connection strings violates credential hygiene and exposes AWS account credentials for a simple local test database.
4. **Cloud Infrastructure Requirement:** Requires active AWS IAM administrative permissions, creating IAM policies, and binding Atlas project trusts.

**Feasibility Verdict for M0 + AWS IAM:** **TECHNICALLY SUPPORTED BY ATLAS, BUT INFEASIBLE WITHOUT NEW NPM PACKAGES OR RISKY STATIC KEY EXPOSURE.**

---

### 4. COMPARISON OF FEASIBILITY ACROSS ALL OPTIONS

| Authentication Option | Atlas M0 Tier Support | Code Changes Needed in `src/lib/db.ts` | New Packages Needed | Key Lifecycle Overhead | Security Posture |
| :--- | :---: | :---: | :---: | :---: | :--- |
| **A. M0 + SCRAM-SHA-1** | **YES** | **NONE (0 lines)** | **NONE** | **Zero** (Static DB user) | **Strong** (TLS 1.2+ encrypted; isolated DB) |
| **B. M0 + X.509** | **YES** | **YES** (Add cert path) | **NONE** | **High** (Cert renewal & disk storage) | **Very Strong** (mTLS key-based) |
| **C. M0 + AWS IAM** | **YES** | **YES** (For role provider) | **YES** (`@aws-sdk/...`) | **High** (AWS IAM & STS token management) | **Very Strong** (Temporary STS tokens) |
| **D. M10 + SCRAM-SHA-256** | **NO (Paid M10 only)** | **NONE (0 lines)** | **NONE** | **Zero** (Static DB user) | **Maximum** (Modern 256-bit hash + TLS 1.2+) |

---

### 5. STRATEGIC CONCLUSION

While MongoDB Atlas M0 supports both X.509 and AWS IAM:
- **X.509** requires altering `src/lib/db.ts` to accept certificate paths and creates certificate lifecycle maintenance.
- **AWS IAM** requires adding new dependencies, AWS infrastructure setup, and complex STS token orchestration.
- **SCRAM-SHA-1** is natively supported by both Atlas M0 and the existing `src/lib/db.ts` without modifying a single file, package, or dependency.

Therefore, for an **isolated test environment exercising synthetic data**, **SCRAM-SHA-1 on M0** offers the ideal balance of security, zero code impact, zero cost, and zero operational friction.
