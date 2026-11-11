# AVANI AI CRM — CP-26.4 Password Security Audit & Upgrade

**Scope:** Gate 2 — Password Storage, Salted KDF Verification, Error Normalization & Environment Hygiene

---

## 1. Vulnerability Remediated

In CP-26.3 (`src/lib/auth.ts`), credential verification used unsalted plain SHA-256 (`sha256Hex`) directly. Several webhook endpoints (`chatmitra-webhook`, `whatsapp-webhook`, `chatmantra-webhook`, `omnidim-webhook`) also retained hardcoded verify-token fallback literals (`'avani_secure_token'` or static string fallback).

---

## 2. Cryptographic Upgrade Implemented (`src/lib/password.ts`, `src/lib/auth.ts`)

1. **Salted `scrypt` Primary KDF (`src/lib/password.ts`):**
   - `hashPasswordScrypt()` derives 64-byte keys using `crypto.scrypt` (`N=16384, r=8, p=1`) with CSPRNG 16-byte random salts (`scrypt$<saltHex>$<derivedHex>`).
   - `verifyStoredPasswordHash()` supports:
     - `scrypt$<saltHex>$<derivedHex>` (primary).
     - `pbkdf2_sha256$<iterations>$<saltHex>$<derivedHex>` (`>= 100,000` iterations).
     - Legacy 64-hex SHA-256 digest compatibility (`^[a-f0-9]{64}$` / `sha256$`) strictly as a non-breaking transition bridge for pre-existing `CRM_*_PASSWORD_HASH` env values in Vercel Production until rotated to `scrypt$`.
   - All digest comparisons use constant-time `crypto.timingSafeEqual`.
2. **Server-Side Env Protection & No Plaintext Leakage:**
   - Credential configuration (`CRM_ADMIN_EMAIL`, `CRM_ADMIN_PASSWORD` / `CRM_ADMIN_PASSWORD_HASH`, `CRM_ADVISOR_EMAIL`, `CRM_ADVISOR_PASSWORD` / `CRM_ADVISOR_PASSWORD_HASH`, `CRM_AUTH_ACCOUNTS_JSON`) is read strictly server-side inside Node API routes.
   - If plaintext `CRM_*_PASSWORD` is configured in Vercel env, `getOrDeriveEnvScryptHash()` hashes it immediately into memory via salted `scrypt` before verification; plaintext passwords are never stored in MongoDB, logged, or returned via any API.
   - Zero hardcoded default passwords exist (`getConfiguredAccounts()` returns `[]` and fails closed with `401` if env credentials are omitted).
3. **Zero Account Enumeration on Login (`src/app/api/auth/login/route.ts`):**
   - Wrong passwords for valid emails and nonexistent emails both return identical `HTTP 401 { success: false, error: 'Invalid credentials.' }` responses with `Cache-Control: no-store`.
4. **Hardcoded Fallback Token Removal:**
   - Removed fallback verification tokens from `chatmitra-webhook/route.ts`, `whatsapp-webhook/route.ts`, `chatmantra-webhook/route.ts`, and `omnidim-webhook/route.ts`.

---

## 3. Vercel Production Environment Presence Check (No Values Printed)

Verified via `vercel env ls production`:
- `CRM_ADMIN_EMAIL`: Configured (`Encrypted`, Production)
- `CRM_ADMIN_PASSWORD`: Not set directly (hash-based auth active)
- `CRM_ADMIN_PASSWORD_HASH`: Configured (`Encrypted`, Production)
- `CRM_ADVISOR_EMAIL`: Configured (`Encrypted`, Production)
- `CRM_ADVISOR_PASSWORD`: Not set directly (hash-based auth active)
- `CRM_ADVISOR_PASSWORD_HASH`: Configured (`Encrypted`, Production)

*(Owner reminder: whenever setting or rotating operator passwords in Vercel Production, generate a `scrypt$` hash or set `CRM_ADMIN_PASSWORD` / `CRM_ADVISOR_PASSWORD` inside Vercel Production Environment Variables.)*

---

## 4. Test Verification (`tests/test_cp26_4_security_closure.test.cjs` — G2.1)

- **G2.1 PASS:** Salted `scrypt$` hashes verified cleanly for `ADMIN` and `ADVISOR`, identical `401 Invalid credentials.` returned across valid-unknown vs wrong-password probes, zero `password` / `passwordHash` fields in response JSON.
