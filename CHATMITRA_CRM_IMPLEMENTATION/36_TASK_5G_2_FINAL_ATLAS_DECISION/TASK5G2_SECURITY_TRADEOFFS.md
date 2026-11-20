# TASK 5G.2 — SECURITY TRADE-OFFS & ARCHITECTURAL COMPARISON
## COMPREHENSIVE SECURITY, OPERATIONAL & ISOLATION EVALUATION

**Project:** AVANI LOAN SERVICES — ChatMitra + AVANI AI CRM  
**Date:** 18 November 2026  
**Execution Mode:** STRICTLY READ-ONLY ARCHITECTURAL EVALUATION  
**Authority:** Task 5G.2 Decision Analysis  

---

### 1. EVALUATION FRAMEWORK

To establish the final architecture recommendation, the four eligible configurations are evaluated across seven core dimensions:
1. **Cryptographic Strength of Authentication**
2. **Channel Encryption (TLS Enforcement)**
3. **Credential Management & Storage Safety**
4. **Least-Privilege Role Scoping**
5. **Zero-Code Application Compatibility**
6. **Financial Cost & Overhead**
7. **Testing Reproducibility & Pipeline Reliability**

---

### 2. DETAILED COMPARATIVE MATRIX

| Dimension | Option A: M0 + SCRAM-SHA-1 | Option B: M0 + X.509 | Option C: M0 + AWS IAM | Option D: M10 + SCRAM-SHA-256 |
| :--- | :--- | :--- | :--- | :--- |
| **1. Cryptographic Strength** | **Strong** (PBKDF2 HMAC-SHA-1, 10,000+ iterations) | **Very Strong** (mTLS RSA/ECDSA key pairs) | **Very Strong** (SigV4 HMAC-SHA-256 + STS) | **Maximum** (PBKDF2 HMAC-SHA-256, 15,000 iterations) |
| **2. Channel Encryption** | **TLS 1.2+ Mandatory** (Atlas enforced) | **TLS 1.2+ Mandatory** (mTLS enforced) | **TLS 1.2+ Mandatory** (Atlas enforced) | **TLS 1.2+ Mandatory** (Atlas enforced) |
| **3. Credential Storage** | Secret in `.env.local` | Private key file (`.pem`) on disk | IAM keys or local AWS profile | Secret in `.env.local` |
| **4. Least-Privilege Scoping**| `readWrite` on `avani_ai_crm_test` only | Scoped to Subject DN on `avani_ai_crm_test` | Scoped to IAM ARN on `avani_ai_crm_test` | `readWrite` on `avani_ai_crm_test` only |
| **5. Application Code Impact**| **0 lines modified** (Ready in `db.ts`) | **Code edits required** in `src/lib/db.ts` | **Code edits required** + new npm package | **0 lines modified** (Ready in `db.ts`) |
| **6. Total Monthly Cost** | **$0.00 / month** | **$0.00 / month** | **$0.00 / month** | **~$85.00 – $105.00 / month** |
| **7. Testing Reproducibility**| **Immediate & Seamless** | High friction (Cert expiry & disk paths) | High friction (STS tokens & AWS policies) | **Immediate & Seamless** |

---

### 3. DEEP-DIVE: IS SCRAM-SHA-1 SUFFICIENT FOR NON-PRODUCTION TESTING?

A critical security question is whether adopting **`SCRAM-SHA-1`** for the test cluster compromises the project's overall security posture.

#### FACT 1: ZERO EXPOSURE OF REAL PRODUCTION DATA
- The test database `avani_ai_crm_test` contains **only synthetic, fake fixtures** (`SYNTH_LEAD_001`, `+919999900001`–`05`).
- No production database dumps, customer PAN cards, loan amounts, or real phone numbers are ever loaded into the test database.
- Even in the catastrophic event of a test database compromise, zero customer PII exists to be breached.

#### FACT 2: TLS 1.2+ ENCAPSULATION ELIMINATES EAVESDROPPING
- All traffic between the CRM test runner and MongoDB Atlas travels through an encrypted TLS 1.2+ tunnel.
- Man-in-the-middle (MITM) eavesdroppers on the local network cannot view plaintext SCRAM handshakes, challenge salts, or authentication responses.
- The theoretical weaknesses of SHA-1 in collision generation do not apply to HMAC-SHA-1 in SCRAM, which remains cryptographically secure against message forgery.

#### FACT 3: ABSOLUTE ISOLATION FROM PRODUCTION CREDENTIALS
- The test user `als_crm_test_worker` exists exclusively in the test Atlas project (`AVANI-AI-CRM-TESTING`).
- It has **zero access, zero permissions, and zero awareness** of the production cluster (`rhpn2gh.mongodb.net`) or production database (`avani_ai_crm_prod`).
- Even if the test credentials were leaked, they have no mathematical or logical path to affect production.

#### FACT 4: THE OPERATIONAL REALITY OF X.509 AND AWS IAM
- While X.509 and AWS IAM provide elegant certificate-based and cloud-native IAM mechanisms, they require modifying `src/lib/db.ts` to add driver options and installing peer dependencies.
- Modifying `src/lib/db.ts` introduces regression risks to existing connection guards and violates the current read-only change freeze.

---

### 4. SUMMARY TRADE-OFF TABLE

| Option | Verdict | Why It Is / Is Not Recommended |
| :--- | :---: | :--- |
| **Option A (M0 + SCRAM-SHA-1)** | **STRONGLY RECOMMENDED** | **Zero cost ($0/mo), zero code modifications, 100% compatible today**, fully secured by TLS 1.2+, and completely isolated from production. |
| **Option B (M0 + X.509)** | **NOT RECOMMENDED** | Technically free, but requires modifying `src/lib/db.ts` to support `.pem` files and introduces certificate rotation overhead. |
| **Option C (M0 + AWS IAM)** | **NOT RECOMMENDED** | Technically free, but requires installing `@aws-sdk/credential-providers`, adding IAM infrastructure, and modifying `src/lib/db.ts`. |
| **Option D (M10 + SCRAM-SHA-256)**| **FORMAL PAID ALTERNATIVE** | Natively modern and requires zero code changes, but incurs a recurring cost of **~$85 – $105/month** (~₹7,100 – ₹8,800/month). |
