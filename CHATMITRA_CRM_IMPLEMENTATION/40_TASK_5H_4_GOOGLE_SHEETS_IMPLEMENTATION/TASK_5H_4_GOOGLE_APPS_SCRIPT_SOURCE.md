# TASK 5H.4 / 5H.7 — GOOGLE APPS SCRIPT GATEWAY SOURCE (REMEDIATED)
**Deployment Target:** Bound to Google Spreadsheet `AVANI_LOAN_SERVICES_CRM_MASTER` (Future Owner-Authorized Setup Only — NOT Deployed in Task 5H.7)

> **Security Note (A-05):** `CacheService.getScriptCache()` provides strong best-effort nonce replay protection within the 300s timestamp window, but Apps Script's shared cache may evict entries under heavy memory pressure and therefore does not provide cryptographically absolute replay immunity.

```javascript
/**
 * AVANI LOAN SERVICES — Google Apps Script CRM Gateway (Free Tier, Remediated Task 5H.7)
 * Enforces:
 * - Canonical JSON-body envelope: { requestId, timestampMs, payloadJson, signature }
 * - Constant-time HMAC-SHA256 verification over `${timestampMs}.${requestId}.${payloadJson}`
 * - 300,000 ms clock-skew check + CacheService best-effort nonce deduplication (600s TTL)
 * - 64 KB payload size limit + ALLOWED_SPREADSHEET_ID allowlist
 * - Exact 9-tab schema parity with src/lib/google-sheets/sheet-schema.ts
 * - Server-side formula-injection rejection
 * - LockService.getScriptLock().waitLock(10000) for serialized mutations
 */

const MAX_BODY_BYTES = 65536;
const MAX_CLOCK_SKEW_MS = 300000;
const NONCE_TTL_SECONDS = 600;
const ALLOWED_ACTIONS = {
  HEALTH_CHECK: true,
  GET_ALL: true,
  GET_SNAPSHOT: true,
  UPSERT_ROW: true,
  INSERT_IF_ABSENT: true,
  DELETE_ROW: true
};

const EXPECTED_TABS = {
  CUSTOMERS: ['customer_id', 'customer_name', 'mobile_number', 'city', 'enquiry_source', 'created_at', 'updated_at', 'record_status'],
  LEADS: ['lead_id', 'customer_id', 'loan_category', 'requested_amount', 'lead_status', 'lead_source', 'assigned_advisor_id', 'priority', 'created_at', 'updated_at'],
  APPLICATIONS: ['application_id', 'lead_id', 'customer_id', 'loan_category', 'requested_amount', 'application_status', 'lender_status', 'assigned_advisor_id', 'created_at', 'updated_at'],
  FOLLOWUPS: ['followup_id', 'lead_id', 'customer_id', 'advisor_id', 'followup_date', 'followup_type', 'followup_status', 'short_notes', 'created_at', 'updated_at'],
  CONSENTS: ['consent_id', 'customer_id', 'channel', 'consent_status', 'consent_source', 'consent_timestamp', 'optout_status', 'updated_at'],
  MESSAGE_EVENTS: ['event_id', 'customer_id', 'provider', 'message_type', 'direction', 'delivery_status', 'provider_message_id', 'event_timestamp'],
  WEBHOOK_EVENTS: ['event_id', 'provider', 'event_type', 'processing_status', 'payload_hash', 'received_at', 'processed_at', 'error_code'],
  ADVISORS: ['advisor_id', 'advisor_name', 'active_status', 'role', 'created_at', 'updated_at'],
  SYSTEM_CONFIG: ['config_key', 'config_value', 'updated_at']
};

function doPost(e) {
  const lock = LockService.getScriptLock();
  let reqId = '';
  try {
    const rawBody = e && e.postData && e.postData.contents ? String(e.postData.contents) : '';
    if (!rawBody || rawBody.length > MAX_BODY_BYTES) {
      return jsonOut_({ ok: false, status: 400, code: 'GOOGLE_SHEETS_VALIDATION_FAILED', requestId: '', error: 'Request body missing or exceeds 64 KB limit' });
    }

    const req = JSON.parse(rawBody);
    reqId = String(req.requestId || '');
    const tsMs = Number(req.timestampMs);
    const payloadJson = String(req.payloadJson || '');
    const signature = String(req.signature || '');

    const authResult = verifyGatewayRequest_(reqId, tsMs, payloadJson, signature);
    if (!authResult.valid) {
      return jsonOut_({ ok: false, status: 401, code: 'GOOGLE_SHEETS_AUTH_FAILED', requestId: reqId, error: authResult.error });
    }

    const cmd = JSON.parse(payloadJson || '{}');
    if (cmd.spreadsheetId !== undefined) {
      return jsonOut_({ ok: false, status: 400, code: 'GOOGLE_SHEETS_VALIDATION_FAILED', requestId: reqId, error: 'Caller-supplied spreadsheetId is prohibited' });
    }
    const action = String(cmd.action || '');
    if (!ALLOWED_ACTIONS[action]) {
      return jsonOut_({ ok: false, status: 400, code: 'GOOGLE_SHEETS_VALIDATION_FAILED', requestId: reqId, error: 'Unsupported gateway action' });
    }

    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const allowedSpreadsheetId = String(PropertiesService.getScriptProperties().getProperty('ALLOWED_SPREADSHEET_ID') || '').trim();
    if (!allowedSpreadsheetId || ss.getId() !== allowedSpreadsheetId) {
      return jsonOut_({ ok: false, status: 403, code: 'GOOGLE_SHEETS_AUTH_FAILED', requestId: reqId, error: 'Spreadsheet ID unconfigured or mismatch' });
    }

    if (action === 'HEALTH_CHECK') {
      return jsonOut_({ ok: true, status: 200, code: 'OK', requestId: reqId, data: { spreadsheetName: ss.getName(), tabs: Object.keys(EXPECTED_TABS) } });
    }

    if (action === 'GET_ALL') {
      const data = readValidatedTab_(ss, cmd.tab);
      if (data.error) return jsonOut_({ ok: false, status: 500, code: 'GOOGLE_SHEETS_SCHEMA_INVALID', requestId: reqId, error: data.error });
      return jsonOut_({ ok: true, status: 200, code: 'OK', requestId: reqId, data: data });
    }

    if (action === 'GET_SNAPSHOT') {
      const requestedTabs = Array.isArray(cmd.tabs) ? cmd.tabs : [];
      const tabData = {};
      for (var i = 0; i < requestedTabs.length; i++) {
        var tName = String(requestedTabs[i]);
        var snap = readValidatedTab_(ss, tName);
        if (snap.error) return jsonOut_({ ok: false, status: 500, code: 'GOOGLE_SHEETS_SCHEMA_INVALID', requestId: reqId, error: snap.error });
        tabData[tName] = snap;
      }
      return jsonOut_({ ok: true, status: 200, code: 'OK', requestId: reqId, data: { tabs: tabData } });
    }

    lock.waitLock(10000);
    const tab = String(cmd.tab || '');
    const expectedCols = EXPECTED_TABS[tab];
    if (!expectedCols) {
      return jsonOut_({ ok: false, status: 500, code: 'GOOGLE_SHEETS_SCHEMA_INVALID', requestId: reqId, error: 'Unknown tab' });
    }
    const sheet = ss.getSheetByName(tab);
    if (!sheet) {
      return jsonOut_({ ok: false, status: 500, code: 'GOOGLE_SHEETS_SCHEMA_INVALID', requestId: reqId, error: 'Missing tab' });
    }
    const headerCheck = validateTabHeaders_(sheet, expectedCols);
    if (!headerCheck.valid) {
      return jsonOut_({ ok: false, status: 500, code: 'GOOGLE_SHEETS_SCHEMA_INVALID', requestId: reqId, error: headerCheck.error });
    }

    if (action === 'DELETE_ROW') {
      const keyVal = String(cmd.primaryKeyValue || '');
      const lastRow = sheet.getLastRow();
      const existingIds = lastRow > 1 ? sheet.getRange(2, 1, lastRow - 1, 1).getValues().map(function (r) { return String(r[0]); }) : [];
      const idx = existingIds.indexOf(keyVal);
      if (idx === -1) return jsonOut_({ ok: true, status: 200, code: 'OK', requestId: reqId, data: { deleted: false } });
      sheet.deleteRow(idx + 2);
      return jsonOut_({ ok: true, status: 200, code: 'OK', requestId: reqId, data: { deleted: true } });
    }

    const rowValues = Array.isArray(cmd.rowValues) ? cmd.rowValues : [];
    if (rowValues.length !== expectedCols.length) {
      return jsonOut_({ ok: false, status: 400, code: 'GOOGLE_SHEETS_VALIDATION_FAILED', requestId: reqId, error: 'Column count mismatch' });
    }
    for (var c = 0; c < rowValues.length; c++) {
      if (isUnsafeFormulaCell_(rowValues[c], expectedCols[c])) {
        return jsonOut_({ ok: false, status: 400, code: 'GOOGLE_SHEETS_FORMULA_INJECTION_BLOCKED', requestId: reqId, error: 'Formula injection blocked' });
      }
    }

    const pkVal = String(rowValues[0] || '');
    const lastRowMut = sheet.getLastRow();
    const existingKeys = lastRowMut > 1 ? sheet.getRange(2, 1, lastRowMut - 1, 1).getValues().map(function (r) { return String(r[0]); }) : [];
    const matchIdx = existingKeys.indexOf(pkVal);

    if (action === 'INSERT_IF_ABSENT') {
      if (matchIdx !== -1) {
        return jsonOut_({ ok: true, status: 200, code: 'OK', requestId: reqId, data: { inserted: false, existingRow: sheet.getRange(matchIdx + 2, 1, 1, expectedCols.length).getValues()[0] } });
      }
      sheet.appendRow(rowValues);
      return jsonOut_({ ok: true, status: 200, code: 'OK', requestId: reqId, data: { inserted: true } });
    }

    if (action === 'UPSERT_ROW') {
      if (matchIdx !== -1) {
        sheet.getRange(matchIdx + 2, 1, 1, expectedCols.length).setValues([rowValues]);
        return jsonOut_({ ok: true, status: 200, code: 'OK', requestId: reqId, data: { created: false } });
      }
      sheet.appendRow(rowValues);
      return jsonOut_({ ok: true, status: 200, code: 'OK', requestId: reqId, data: { created: true } });
    }

    return jsonOut_({ ok: false, status: 400, code: 'GOOGLE_SHEETS_VALIDATION_FAILED', requestId: reqId, error: 'Unsupported action' });
  } catch (err) {
    return jsonOut_({ ok: false, status: 503, code: 'GOOGLE_SHEETS_UNAVAILABLE', requestId: reqId, error: 'Gateway execution unavailable' });
  } finally {
    if (lock.hasLock()) lock.releaseLock();
  }
}

function readValidatedTab_(ss, tabName) {
  const tab = String(tabName || '');
  const expectedCols = EXPECTED_TABS[tab];
  if (!expectedCols) return { error: 'Unknown tab: ' + tab };
  const sheet = ss.getSheetByName(tab);
  if (!sheet) return { error: 'Missing tab: ' + tab };
  const headerCheck = validateTabHeaders_(sheet, expectedCols);
  if (!headerCheck.valid) return { error: headerCheck.error };
  const lastRow = sheet.getLastRow();
  const rows = lastRow > 1 ? sheet.getRange(2, 1, lastRow - 1, expectedCols.length).getValues() : [];
  return { headers: headerCheck.headers, rows: rows };
}

function validateTabHeaders_(sheet, expectedCols) {
  const lastCol = sheet.getLastColumn();
  const headerRow = lastCol > 0 ? sheet.getRange(1, 1, 1, lastCol).getValues()[0].map(function (v) { return String(v || '').trim(); }) : [];
  if (JSON.stringify(headerRow) !== JSON.stringify(expectedCols)) {
    return { valid: false, error: 'Header mismatch on ' + sheet.getName() };
  }
  return { valid: true, headers: headerRow };
}

function isUnsafeFormulaCell_(val, colName) {
  var s = String(val === undefined || val === null ? '' : val).trim();
  if (!s) return false;
  if (colName === 'mobile_number' && /^\+91[6-9]\d{9}$/.test(s)) return false;
  return /^[=+\-@\t\r]/.test(s) || /=\s*(IMPORTXML|IMPORTHTML|IMPORTRANGE|IMPORTFEED|IMPORTDATA|QUERY|WEBSERVICE)|cmd\|/i.test(s);
}

function verifyGatewayRequest_(requestId, timestampMs, payloadJson, sigHex) {
  const secret = PropertiesService.getScriptProperties().getProperty('GATEWAY_HMAC_SECRET');
  if (!secret || secret.length < 16) return { valid: false, error: 'Gateway secret unconfigured' };
  if (!requestId || requestId.length < 16) return { valid: false, error: 'Invalid requestId' };
  if (!isFinite(timestampMs) || Math.abs(Date.now() - timestampMs) > MAX_CLOCK_SKEW_MS) {
    return { valid: false, error: 'Expired or skewed timestampMs' };
  }
  const cache = CacheService.getScriptCache();
  const cacheKey = 'nonce_' + requestId;
  if (cache.get(cacheKey) !== null) {
    return { valid: false, error: 'Replayed requestId rejected' };
  }
  const canonical = timestampMs + '.' + requestId + '.' + payloadJson;
  const bytes = Utilities.computeHmacSha256Signature(canonical, secret, Utilities.Charset.UTF_8);
  const computed = bytes.map(function (b) { return ('0' + (b & 0xff).toString(16)).slice(-2); }).join('');
  if (!constantTimeEqualHex_(computed, String(sigHex || '').toLowerCase())) {
    return { valid: false, error: 'Invalid HMAC signature' };
  }
  cache.put(cacheKey, '1', NONCE_TTL_SECONDS);
  return { valid: true };
}

function constantTimeEqualHex_(a, b) {
  if (a.length !== 64 || a.length !== b.length) return false;
  var diff = 0;
  for (var i = 0; i < a.length; i++) {
    diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return diff === 0;
}

function jsonOut_(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}
```
