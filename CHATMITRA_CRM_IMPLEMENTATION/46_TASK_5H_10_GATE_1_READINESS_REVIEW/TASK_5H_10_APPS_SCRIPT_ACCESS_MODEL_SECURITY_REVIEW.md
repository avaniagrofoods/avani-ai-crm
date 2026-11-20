# TASK 5H.10 — APPS SCRIPT ACCESS MODEL SECURITY REVIEW
**Official Source:** `https://developers.google.com/apps-script/manifest/webapp` & `https://developers.google.com/apps-script/guides/web` (accessed 2026-11-18)

---

## 1. Official Manifest Enums Clarified
- **`executeAs`:** `USER_DEPLOYING` ("Me" — runs with owner's permissions) vs `USER_ACCESSING` ("User accessing the web app").
- **`access`:** `MYSELF` (deployer only), `DOMAIN` (Workspace domain users), `ANYONE` (any **logged-in** Google user), `ANYONE_ANONYMOUS` (**anyone**, even without a Google account — displayed as "Anyone" in the Apps Script deploy UI).

## 2. Options Comparison for Server-to-Server `GoogleSheetsClient`

| Dimension | Option A: `USER_DEPLOYING` + `MYSELF` | Option B: `USER_DEPLOYING` + `ANYONE` (Logged-in Google Users) | Option C: `USER_DEPLOYING` + `ANYONE_ANONYMOUS` + HMAC |
|-----------|---------------------------------------|----------------------------------------------------------------|----------------------------------------------------------|
| **Server-to-Server `fetch()` Compatible?** | **NO** (requires interactive Google login cookie / OAuth). | **NO** (requires interactive Google login cookie). | **YES** (accepts server `POST` without Google login). |
| **HMAC Security** | N/A | N/A | Rejects forged/unsigned data requests with `401`. |
| **Abuse / DoS / Quota Exhaustion Risk** | None (blocked by Google auth). | Low (requires Google login). | **HIGH if `/exec` URL leaks:** unauthenticated callers can invoke `doPost(e)`, consuming the 30-simultaneous-execution & `PropertiesService` quotas before HMAC rejects them. |
| **Owner Account Exposure** | Minimal | Minimal | Runs as owner; mitigated by `ALLOWED_SPREADSHEET_ID` + `EXPECTED_TABS` allowlist. |

## 3. Verdict on Access Model
- **For Isolated Testing (Gate 2–5):** **Option C (`USER_DEPLOYING` + `ANYONE_ANONYMOUS` + HMAC)** is **acceptable ONLY** because the `/exec` URL is kept confidential (never exposed in client browsers), `ALLOWED_SPREADSHEET_ID` restricts access to `AVANI_AI_CRM_ISOLATED_TEST`, and traffic is synthetic.
- **For Future Production:** Option C's public `/exec` quota-exhaustion exposure should be replaced with **Google Cloud Service Account + Sheets API v4 REST** (no public `/exec` URL).
