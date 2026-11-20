# TASK 5H.13 — REPORT 4
## Gateway Security Architecture & Cryptographic Verification

- **Task:** 5H.13 — Section 4 Security Controls
- **Audit Target:** `AVANI_AI_CRM_TEST_GATEWAY` (`gateway.gs`)

---

### 1. Verification of Mandatory Security Controls

The remediated source code in `src/lib/google-sheets/gateway.gs` strictly enforces all 14 mandatory security invariants:

| # | Security Control | Implementation Mechanism | Status |
| :--- | :--- | :--- | :--- |
| 1 | **HMAC-SHA256 Signing** | Computed using `Utilities.computeHmacSha256Signature(canonical, secret)`. | **VERIFIED** |
| 2 | **Canonical String Parity** | Format: `${timestampMs}.${requestId}.${payloadJson}`. Exact parity with `google-auth.ts`. | **VERIFIED** |
| 3 | **Constant-Time Comparison** | `constantTimeEqualHex_()` bitwise XOR loop prevents timing side-channel attacks. | **VERIFIED** |
| 4 | **Timestamp Skew Limit** | `MAX_CLOCK_SKEW_MS = 300000` (5 minutes). Rejects expired or future-dated calls. | **VERIFIED** |
| 5 | **Replay Protection** | `CacheService.getScriptCache()` checks `nonce_${requestId}` with 600s TTL. | **VERIFIED** |
| 6 | **Fixed Spreadsheet Allowlist** | `ALLOWED_SPREADSHEET_ID` read from Script Properties; compared against `ss.getId()`. | **VERIFIED** |
| 7 | **Rejection of Caller Sheet ID** | Fails with HTTP 400 if `cmd.spreadsheetId` is provided by caller. | **VERIFIED** |
| 8 | **Payload Size Ceiling** | `MAX_BODY_BYTES = 65536` (64 KB). Rejects oversized requests immediately. | **VERIFIED** |
| 9 | **Server-Side Formula Sanitization** | `isUnsafeFormulaCell_()` blocks leading `=`, `+`, `-`, `@`, `\t`, `\r` and `=IMPORTXML`. | **VERIFIED** |
| 10 | **Action Allowlist** | Only 6 actions permitted (`HEALTH_CHECK`, `GET_ALL`, `GET_SNAPSHOT`, `UPSERT_ROW`, `INSERT_IF_ABSENT`, `DELETE_ROW`). | **VERIFIED** |
| 11 | **Exact Tab Schema Validation** | `EXPECTED_TABS` defines exact column names and counts across all 9 tabs. | **VERIFIED** |
| 12 | **Concurrency Protection** | `LockService.getScriptLock().waitLock(10000)` serializes writes; released in `finally`. | **VERIFIED** |
| 13 | **Structured Error Output** | Standardized JSON output `{ ok: false, status, code, requestId, error }`. | **VERIFIED** |
| 14 | **Zero Hardcoded Secrets** | Reads `GATEWAY_HMAC_SECRET` from Script Properties; throws error if unconfigured. | **VERIFIED** |

---

### 2. Node.js VM Sandbox Test Results

The gateway was tested inside an offline Node.js VM sandbox (`tests/test_task5h11c_gateway_security.test.cjs`):
- Health check verification: **PASS**
- Invalid signature rejection: **PASS** (HTTP 401)
- Replayed request rejection: **PASS** (HTTP 401)
- Wrong spreadsheet ID rejection: **PASS** (HTTP 403)
- Formula injection rejection: **PASS** (HTTP 400)
- Request size limit enforcement: **PASS** (HTTP 400)
- **Result:** **6/6 passed (100% success)**.
