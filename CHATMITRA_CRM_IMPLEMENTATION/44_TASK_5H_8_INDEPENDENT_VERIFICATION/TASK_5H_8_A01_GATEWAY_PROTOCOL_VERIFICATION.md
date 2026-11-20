# TASK 5H.8 — A-01 GATEWAY PROTOCOL VERIFICATION
**Status:** VERIFIED (Source-Level Contract + Offline Mocked Verification) | **Live Google HTTP:** NOT VERIFIED (Prohibited in 5H.8)

## 1. Canonical Signature & Envelope Verification
- **Client (`src/lib/google-sheets/google-auth.ts`):** `signAppsScriptGatewayRequest()` generates `timestampMs` (epoch ms), `requestId` (`REQ-<timestampMs>-<12hex>`), `payloadJson = JSON.stringify(payload ?? {})`, and signs `${timestampMs}.${requestId}.${payloadJson}` (UTF-8) with `GOOGLE_SHEETS_GATEWAY_SECRET`, sending `{ requestId, timestampMs, payloadJson, signature }` in the JSON POST body with only `Content-Type: application/json`.
- **Apps Script (`TASK_5H_4_GOOGLE_APPS_SCRIPT_SOURCE.md`):** `doPost(e)` parses `e.postData.contents`, extracts `{ requestId, timestampMs, payloadJson, signature }`, and computes `Utilities.computeHmacSha256Signature(timestampMs + '.' + requestId + '.' + payloadJson, secret, Utilities.Charset.UTF_8)`.
- **Byte-for-Byte Consistency:** Both sides sign exact UTF-8 bytes of `${timestampMs}.${requestId}.${payloadJson}` with zero dependence on custom HTTP headers.
- **Request ID / Nonce Note:** `requestId` serves as both the correlation identifier and the anti-replay nonce (`nonce_<requestId>`). This is safe because each request generates a fresh `REQ-<ms>-<12hex>` with 48 bits of randomness.
- **Actions Verified:** `HEALTH_CHECK`, `GET_ALL`, `GET_SNAPSHOT`, `UPSERT_ROW`, `INSERT_IF_ABSENT`, `DELETE_ROW`.
