# TASK 5H.11F — REPORT 7
## Google Apps Script Gateway Security Architecture Readiness

- **Task:** 5H.11F — Gateway Security & Threat Assessment
- **Component:** `AVANI_AI_CRM_TEST_GATEWAY` (Container-bound Apps Script Webhook)
- **Deployment Gate:** GATE 3 (Deployment prohibited during Gate 2)

---

### 1. Threat Model & Abuse Risk Assessment

Deploying a Google Apps Script Web App with access set to *"Anyone"* exposes an unauthenticated HTTP `/exec` endpoint to the public internet. This introduces specific security vulnerabilities:
1. **Public Endpoint Abuse:** Anonymous actors or internet scanners discovering the URL could execute arbitrary reads/writes if authentication is not enforced at the application layer.
2. **Denial of Service & Quota Exhaustion:** Google Apps Script imposes strict daily quotas (e.g., 20,000 URLFetch calls/day, 6 min execution time/trigger, concurrency caps). Malicious flooding could exhaust the script's quota, breaking CRM sync.
3. **Spreadsheet Pollution & Formula Injection:** Attackers submitting malicious CSV payloads with formula payloads (`=IMPORTXML()`, `=HYPERLINK()`) could execute data exfiltration or phishing.

### 2. Multi-Layered Remediation Controls in Code

The gateway implementation in `TASK_5H_4_GOOGLE_APPS_SCRIPT_SOURCE.md` incorporates the following hardened defenses:

1. **HMAC-SHA256 Signature Verification:**
   - Every request must include an `X-Signature` header computed as `HMAC_SHA256(secret, timestamp + "." + body)`.
   - Constant-time string comparison (`compareSignatures_()`) prevents timing attacks.
   - Requests without a valid signature are immediately rejected with HTTP 401.
2. **Replay Attack Prevention:**
   - The request envelope includes a Unix timestamp (`X-Timestamp`).
   - The gateway rejects requests where `|now - timestamp| > 300` seconds (5 minutes).
3. **Strict Spreadsheet ID Allowlisting:**
   - The gateway reads `ALLOWED_SPREADSHEET_ID` from script properties.
   - It only opens that exact spreadsheet; incoming requests cannot pass an arbitrary sheet ID to hijack permissions.
4. **Formula Sanitization:**
   - Cell contents starting with `=`, `+`, `-`, `@`, `\t`, or `\r` are automatically escaped with a leading single quote `'`.
5. **Payload Size & Rate Limits:**
   - Maximum body size is capped at 1 MB.
   - Maximum batch rows per request is capped at 500 rows.

### 3. Gateway Deployment Recommendation for Gate 3

When Gate 3 is reached:
- **Execute as:** `Me` (the test Google account).
- **Who has access:** `Anyone` (required for Next.js webhooks to call without complex GCP OAuth consent screens).
- **HMAC Secret:** Generated as a 64-character cryptographically secure hex string stored solely in Google Script Properties (`GATEWAY_HMAC_SECRET`) and Next.js `.env.local` (`GOOGLE_SHEETS_GATEWAY_SECRET`).
