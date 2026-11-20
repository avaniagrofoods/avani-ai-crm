# TASK 5F: MONGODB URI AND HOSTNAME VALIDATION
**Project:** AVANI LOAN SERVICES — ChatMitra + AVANI AI CRM  
**Date:** 2026-11-18  
**Component:** `parseAndSanitizeConnectionUri()` & Isolation Engine in `src/lib/db.ts`

---

## 1. URI Parsing & Pre-Driver Authority Sanitization

To guard against URI parser exploits and authority smuggling, `parseAndSanitizeConnectionUri()` enforces strict syntax constraints before any driver interaction:

1. **Scheme Validation:** Must explicitly begin with `mongodb://` or `mongodb+srv://`. Schemes such as `http://` or `ftp://` are rejected with `URI_MALFORMED` (Scenario S03).
2. **Authority & Multiple `@` Check:** The authority segment (between scheme and the host specification) is analyzed. If more than one unencoded `@` symbol is present, the URI is rejected with `URI_MALFORMED` (Scenario S44). Percent-encoded `%40` credentials pass seamlessly (Scenario S43).
3. **SRV Port & Multi-Host Prevention:** In accordance with MongoDB Connection String specifications (RFC 2782), SRV URIs (`mongodb+srv://`) cannot define port numbers (Scenario S39) or comma-separated multiple hosts (Scenario S40). Both conditions fail closed with `URI_MALFORMED`.
4. **Pathname & Database Name Extraction:** The database name is extracted from the pathname prior to any query parameters. Empty or missing database paths reject with `MISSING_DATABASE_NAME` (Scenario S04).
5. **Host Normalization:** Hostnames are stripped of trailing dots (e.g. `rhpn2gh.mongodb.net.` $\rightarrow$ `rhpn2gh.mongodb.net`), converted to lowercase, and ports are stripped. IPv6 bracketed hosts (e.g. `[::1]:27017`) are safely parsed (Scenario S35).

---

## 2. Hostname Isolation & Security Matrix

### 2.1 Production Hostname Protection (The Task 5E Primary Defect Fix)
- **Production Cluster Identifier:** `rhpn2gh.mongodb.net`
- **Non-Production Policy:** In `VERCEL_PREVIEW`, `LOCAL_DEVELOPMENT`, and `AUTOMATED_TESTS`, any URI containing `rhpn2gh.mongodb.net` (or sub-domains) is **strictly rejected with `PRODUCTION_CLUSTER_FORBIDDEN_IN_NON_PROD`**, even when targeting `avani_ai_crm_test` (Scenario S31).
- **Mixed Seed List Protection:** If a multi-host seed list includes valid test hosts alongside a production host (e.g. `127.0.0.1:27017,rhpn2gh.mongodb.net:27017`), the entire URI is rejected with `PRODUCTION_CLUSTER_FORBIDDEN_IN_NON_PROD` (Scenario S37).

### 2.2 Hostname Spoofing & Unauthorized Host Rejection
- **Subdomain Prefix Spoofing:** URIs targeting `attacker-rhpn2gh.mongodb.net` fail authorization with `UNAUTHORIZED_TEST_CLUSTER_HOSTNAME` (Scenario S41).
- **Domain Suffix Spoofing:** URIs targeting `rhpn2gh.mongodb.net.attacker.com` fail authorization with `UNAUTHORIZED_TEST_CLUSTER_HOSTNAME` (Scenario S42).
- **Decommissioned & Cross-App Clusters:**
  - `cluster0.mlcxcp.mongodb.net` $\rightarrow$ Rejected with `LEGACY_CLUSTER_REJECTED` (Scenario S05).
  - `xj6nhak.mongodb.net` (Loan Services cluster) $\rightarrow$ Rejected with `CROSS_APPLICATION_CLUSTER_REJECTED` (Scenario S06).

---

## 3. Database Target Whitelisting & Denylisting

- **Production Runtime (`PRODUCTION`):**
  - Must target `avani_ai_crm_prod` (Scenario S24).
  - Targeting `avani_ai_crm_test` or any database containing `test` is rejected with `TEST_DATABASE_FORBIDDEN_IN_PROD` (Scenario S27).
  - Targeting any unrecognized database name is rejected with `INVALID_PRODUCTION_DATABASE_NAME` (Scenario S28).
- **Non-Production Runtimes:**
  - Targeting `avani_ai_crm_prod` or any database containing `prod` is rejected with `PRODUCTION_CLUSTER_FORBIDDEN_IN_NON_PROD` (Scenario S30).
  - Must exclusively target `avani_ai_crm_test` (or preview database). Any other database name is rejected with `TARGET_DATABASE_NOT_TEST`.
