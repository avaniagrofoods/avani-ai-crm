# TASK 5G — SECURITY CONFIGURATION SPECIFICATION
**Project:** AVANI LOAN SERVICES — ChatMitra + AVANI AI CRM  
**Date:** 18 November 2026  
**Role:** Senior Application Security Engineer & DevSecOps Consultant  
**Status:** **AUTHORITATIVE SECURITY SPECIFICATION**

---

## 1. Environment Variable Architecture

To guarantee absolute separation between development, preview, and production environments, the test environment relies on the following explicit environment variables:

| Variable Name | Required Format / Value | Description & Security Enforcement |
| :--- | :--- | :--- |
| **`MONGODB_TEST_URI`** | `mongodb+srv://als_crm_test_worker:<STRONG_SECRET>@<CLUSTER_ID>.mongodb.net/avani_ai_crm_test?retryWrites=true&w=majority` | Fully qualified Atlas connection string targeting the dedicated test cluster and database. |
| **`MONGODB_TEST_CLUSTER_DOMAIN`** | `<cluster-name>.<unique-id>.mongodb.net` | Exact fully qualified domain name (FQDN) of the provisioned test cluster. Must be >=3 segments and end with `.mongodb.net`. |
| **`APP_MODE`** | `test` (or `preview`) | Must match approved non-production profiles. Any claim of `production` triggers immediate fail-closed shutdown. |
| **`NODE_ENV`** | `test` (or `development`) | Standard Node.js runtime environment flag. |
| **`PROVIDER_MODE`** | `mock` (or `sandbox`) | Mandates that outbound dispatches to WhatsApp/SMS providers remain simulated during testing. |
| **`LIVE_TEST_AUTHORIZATION`** | `false` | Strictly disables live outbound customer communications. |

---

## 2. Strict Host & Identity Validation Rules

In `src/lib/db.ts`, the application enforces the following mathematical isolation constraints:

### Rule 1: Production Host Exclusion
Under no circumstances may `MONGODB_TEST_CLUSTER_DOMAIN` or `MONGODB_TEST_URI` target `rhpn2gh.mongodb.net` or any subdomain containing `rhpn2gh`.
- If detected in preflight -> Immediate rejection (`PRODUCTION_CLUSTER_FORBIDDEN_IN_NON_PROD`).
- If detected during DNS-SRV resolution -> Immediate abort (`PRODUCTION_CLUSTER_FORBIDDEN_IN_NON_PROD`).
- If detected in post-connect driver topology -> Socket closed immediately, cache purged, throws `DatabaseIsolationError`.

### Rule 2: Fail-Closed Unset Domain Protection
If `MONGODB_TEST_CLUSTER_DOMAIN` is not set in the environment, any connection attempt to an Atlas cluster (`mongodb+srv://`) in a non-production profile immediately fails closed with `UNAUTHORIZED_TEST_CLUSTER_HOSTNAME`. Local loopback (`localhost`, `127.0.0.1`) remains permitted for offline testing.

### Rule 3: Zero-Wildcard Rule
`MONGODB_TEST_CLUSTER_DOMAIN` cannot contain wildcards (`*`, `*.mongodb.net`), commas, or spaces. It must specify an exact, single cluster domain.

### Rule 4: Suffix / Prefix Spoofing Neutralization
Subdomain tricks (e.g. `attacker-rhpn2gh.mongodb.net` or `rhpn2gh.mongodb.net.attacker.com`) are mathematically blocked by parsing FQDN labels from right to left.

---

## 3. Database Identity & Naming Governance

1. **Sole Approved Database Name:** `avani_ai_crm_test`
2. **Rejection of Preview Databases:** Per Owner Decision F-04, no preview-specific database names (such as `avani_ai_crm_preview`) are permitted. All non-production environments must bind to `avani_ai_crm_test`.
3. **Database Name Mismatch Trap:** If the driver connects to the cluster but binds to a database other than `avani_ai_crm_test`, `verifySameConnectionIdentity()` throws `LIVE_DB_NAME_MISMATCH`, closes the connection socket, and purges the connection cache.

---

## 4. Secret Storage & Credential Hygiene

- **No Secrets in Source Control:** Connection URIs, database passwords, and Atlas API keys must never be committed to Git.
- **Local Development Secrets:** Stored exclusively in local, untracked `.env.test.local` (verified present in `.gitignore`).
- **CI / Preview Secrets:** Injected via encrypted Vercel Preview Environment Variables or encrypted GitHub Actions Secrets.
- **Zero Production Credential Sharing:** The password for `als_crm_test_worker` must be a high-entropy string generated independently from production credentials.
- **Credential Rotation Policy:** Test database credentials should be rotated every 90 days or immediately following team personnel changes.

---

## 5. Synthetic Data Policy (Zero PII Risk)

- **Mandatory Policy:** Under no circumstances will production customer data, contact records, messages, or advisor details be cloned or imported into `avani_ai_crm_test`.
- **Synthetic Datasets Only:** All integration tests (S45–S50) must generate and utilize synthetic mock leads with clearly identifiable test markers:
  - Phone numbers: `+919999900001` through `+919999900099`.
  - Names: `Test User Alpha`, `Test Borrower Beta`.
  - Lead IDs: `ALS-TEST-000001`.
- **Automated Cleanup:** All synthetic test data must be cleaned up post-test execution using test teardown hooks.
