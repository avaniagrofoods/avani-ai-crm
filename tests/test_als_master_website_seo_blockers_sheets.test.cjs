/**
 * ALS-MASTER-2026-11-21 — MASTER WEBSITE, SEO, SEVEN CRM BLOCKERS & MINIMAL SHEETS TEST SUITE
 *
 * 100% Offline, Non-Production, Adversarial Real-Source Verification:
 * - Executes REAL transpiled TypeScript modules from Project 2 (`3-AVANI AI CRM`)
 * - Executes REAL unmodified `gateway.gs` inside an isolated Node `vm` harness
 * - Poisons `mongoose`, `@/lib/db`, and `@/lib/postgres` so ANY accidental MongoDB/PostgreSQL call throws immediately
 * - Simulates TWO completely independent serverless Node module instances for Blocker 4 cross-instance tests
 * - Sends ZERO live network calls, ZERO live Google Sheets writes, and ZERO real WhatsApp messages
 */

const { describe, it, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const fs = require('node:fs');
const Module = require('node:module');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');

const ROOT_DIR = path.resolve(__dirname, '..');
const SRC_DIR = path.join(ROOT_DIR, 'src');
const GATEWAY_GS_PATH = path.join(SRC_DIR, 'lib', 'google-sheets', 'gateway.gs');

// ---------------------------------------------------------------------------
// 1. TypeScript + Path Alias Transpiler & Poisoned Legacy DB Guard
// ---------------------------------------------------------------------------
let mongoConnectCalls = 0;
let postgresCalls = 0;

const origResolveFilename = Module._resolveFilename;
Module._resolveFilename = function (request, parent, isMain, options) {
  if (request.startsWith('@/')) {
    const rel = request.slice(2);
    const base = path.join(SRC_DIR, rel);
    for (const c of [base, `${base}.ts`, `${base}.tsx`, path.join(base, 'index.ts'), path.join(base, 'index.tsx')]) {
      if (fs.existsSync(c) && fs.statSync(c).isFile()) return c;
    }
  }
  return origResolveFilename.call(this, request, parent, isMain, options);
};

require.extensions['.ts'] = function (mod, filename) {
  const source = fs.readFileSync(filename, 'utf8');
  const compiled = ts.transpileModule(source, {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2022,
      esModuleInterop: true,
      allowJs: true
    },
    fileName: filename
  });
  mod._compile(compiled.outputText, filename);
};

require.extensions['.tsx'] = function (mod, filename) {
  const source = fs.readFileSync(filename, 'utf8');
  const compiled = ts.transpileModule(source, {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2022,
      jsx: ts.JsxEmit.ReactJSX,
      esModuleInterop: true,
      allowJs: true
    },
    fileName: filename
  });
  mod._compile(compiled.outputText, filename);
};

class MockNextResponse {
  constructor(body, init = {}) {
    this._body = body;
    this.status = init.status || 200;
    this.headers = new Headers(init.headers || {});
    this._cookies = [];
    this.cookies = {
      set: (cookieObj) => {
        this._cookies.push(cookieObj);
      }
    };
  }
  async json() {
    return typeof this._body === 'string' ? JSON.parse(this._body) : this._body;
  }
  async text() {
    return typeof this._body === 'string' ? this._body : JSON.stringify(this._body);
  }
  static json(data, init = {}) {
    return new MockNextResponse(data, init);
  }
  static next() {
    const r = new MockNextResponse(null, { status: 200 });
    r._isNext = true;
    return r;
  }
  static redirect(url, status = 307) {
    const loc = typeof url === 'string' ? url : url.toString();
    const r = new MockNextResponse(null, { status, headers: { location: loc } });
    r._isRedirect = true;
    r._redirectLocation = loc;
    return r;
  }
}

const nextServerMock = { NextResponse: MockNextResponse };

const dbPath = path.join(SRC_DIR, 'lib', 'db.ts');
const pgPath = path.join(SRC_DIR, 'lib', 'postgres.ts');
const waitUntilPromises = [];

const originalLoad = Module._load;
Module._load = function (request, parent, isMain) {
  if (request === 'next/server') return nextServerMock;
  if (request === '@vercel/functions') {
    return {
      waitUntil: (p) => {
        const wrapped = Promise.resolve(p).catch(() => {});
        waitUntilPromises.push(wrapped);
      }
    };
  }
  if (request === '@/lib/db' || request === './db') {
    return {
      __esModule: true,
      default: async () => {
        mongoConnectCalls++;
        throw new Error('POISONED_MONGODB_CONNECT_SHOULD_NOT_BE_CALLED');
      }
    };
  }
  if (request === '@/lib/postgres') {
    return {
      logCallToPostgres: async () => {
        postgresCalls++;
        throw new Error('POISONED_POSTGRES_SHOULD_NOT_BE_CALLED');
      }
    };
  }
  if (request === 'mongoose') {
    class FakeSchema {
      constructor() {}
      index() { return this; }
      pre() { return this; }
      virtual() { return { get: () => {} }; }
    }
    FakeSchema.Types = { ObjectId: function ObjectId() {}, Mixed: Object };
    const fakeMongoose = {
      connection: { readyState: 0 },
      models: {},
      Schema: FakeSchema,
      Types: { ObjectId: function ObjectId() {} },
      connect: async () => {
        mongoConnectCalls++;
        throw new Error('POISONED_MONGOOSE_CONNECT_SHOULD_NOT_BE_CALLED');
      },
      model: () => ({})
    };
    return { __esModule: true, default: fakeMongoose, ...fakeMongoose };
  }
  return originalLoad.call(this, request, parent, isMain);
};

// Also poison resolved db.ts directly if loaded
require.cache[dbPath] = {
  id: dbPath,
  filename: dbPath,
  loaded: true,
  exports: {
    __esModule: true,
    default: async () => {
      mongoConnectCalls++;
      throw new Error('POISONED_MONGODB_CONNECT_SHOULD_NOT_BE_CALLED');
    }
  }
};
require.cache[pgPath] = {
  id: pgPath,
  filename: pgPath,
  loaded: true,
  exports: {
    logCallToPostgres: async () => {
      postgresCalls++;
      throw new Error('POISONED_POSTGRES_SHOULD_NOT_BE_CALLED');
    }
  }
};

// ---------------------------------------------------------------------------
// 2. Real Unmodified `gateway.gs` Isolated VM Harness
// ---------------------------------------------------------------------------
function createGatewayVmHarness(gatewaySecret, spreadsheetId = 'SPREADSHEET_SYNTHETIC_5H36') {
  const gsCode = fs.readFileSync(GATEWAY_GS_PATH, 'utf8');
  const scriptProps = {
    GATEWAY_HMAC_SECRET: gatewaySecret,
    ALLOWED_SPREADSHEET_ID: spreadsheetId
  };
  const cacheStore = new Map();
  const sheetsMap = new Map();

  function makeSheet(name, initialRows = []) {
    const data = initialRows.map((r) => [...r]);
    return {
      getName: () => name,
      getLastRow: () => data.length,
      getLastColumn: () => (data[0] ? data[0].length : 0),
      getRange: (row, col, numRows = 1, numCols = 1) => ({
        getValues: () => {
          const out = [];
          for (let r = row - 1; r < row - 1 + numRows; r++) {
            const src = data[r] || [];
            const slice = [];
            for (let c = col - 1; c < col - 1 + numCols; c++) {
              slice.push(src[c] !== undefined ? src[c] : '');
            }
            out.push(slice);
          }
          return out;
        },
        setValues: (vals) => {
          for (let i = 0; i < vals.length; i++) {
            const targetRow = row - 1 + i;
            while (data.length <= targetRow) data.push([]);
            for (let j = 0; j < vals[i].length; j++) {
              data[targetRow][col - 1 + j] = vals[i][j];
            }
          }
        },
        setFontWeight: () => {}
      }),
      appendRow: (rowArr) => {
        data.push([...rowArr]);
      },
      deleteRow: (rowNum) => {
        data.splice(rowNum - 1, 1);
      },
      setFrozenRows: () => {},
      _raw: () => data
    };
  }

  const expectedTabsMatch = gsCode.match(/const EXPECTED_TABS = (\{[\s\S]*?\n\});/);
  const expectedTabs = Function(`return (${expectedTabsMatch[1]});`)();
  for (const [tabName, cols] of Object.entries(expectedTabs)) {
    sheetsMap.set(tabName, makeSheet(tabName, [cols]));
  }

  const sandbox = {
    console,
    Date,
    JSON,
    Math,
    Object,
    Array,
    String,
    Number,
    Boolean,
    RegExp,
    Error,
    PropertiesService: {
      getScriptProperties: () => ({
        getProperty: (k) => scriptProps[k] ?? null
      })
    },
    CacheService: {
      getScriptCache: () => ({
        get: (k) => {
          const entry = cacheStore.get(k);
          if (!entry) return null;
          if (entry.exp <= Date.now()) {
            cacheStore.delete(k);
            return null;
          }
          return entry.val;
        },
        put: (k, v, ttlSec) => {
          cacheStore.set(k, { val: String(v), exp: Date.now() + Number(ttlSec || 600) * 1000 });
        }
      })
    },
    LockService: {
      getScriptLock: () => ({
        waitLock: () => {},
        tryLock: () => true,
        hasLock: () => true,
        releaseLock: () => {}
      })
    },
    SpreadsheetApp: {
      getActiveSpreadsheet: () => ({
        getId: () => spreadsheetId,
        getName: () => 'AVANI_LOAN_SERVICES_CRM_MASTER',
        getSheetByName: (name) => sheetsMap.get(name) || null,
        insertSheet: (name) => {
          const s = makeSheet(name, []);
          sheetsMap.set(name, s);
          return s;
        }
      }),
      openById: (id) => {
        if (id !== spreadsheetId) throw new Error('Invalid spreadsheet ID');
        return {
          getId: () => spreadsheetId,
          getName: () => 'AVANI_LOAN_SERVICES_CRM_MASTER',
          getSheetByName: (name) => sheetsMap.get(name) || null,
          insertSheet: (name) => {
            const s = makeSheet(name, []);
            sheetsMap.set(name, s);
            return s;
          }
        };
      }
    },
    Utilities: {
      MacAlgorithm: { HMAC_SHA_256: 'HMAC_SHA_256' },
      Charset: { UTF_8: 'UTF_8' },
      computeHmacSha256Signature: (msg, secret) => {
        const buf = crypto.createHmac('sha256', secret).update(msg, 'utf8').digest();
        return Array.from(buf).map((b) => (b > 127 ? b - 256 : b));
      }
    },
    ContentService: {
      MimeType: { JSON: 'application/json' },
      createTextOutput: (str) => ({
        _text: str,
        setMimeType() {
          return this;
        },
        getContent() {
          return this._text;
        }
      })
    }
  };

  vm.createContext(sandbox);
  vm.runInContext(gsCode, sandbox, { filename: 'gateway.gs' });

  return {
    invokeRawPost: (rawBody) => {
      const res = sandbox.doPost({ postData: { contents: rawBody } });
      return JSON.parse(res.getContent());
    },
    getTabObjects: (tabName) => {
      const s = sheetsMap.get(tabName);
      if (!s) return [];
      const rows = s._raw();
      if (rows.length <= 1) return [];
      const headers = rows[0];
      return rows.slice(1).map((r) => {
        const obj = {};
        headers.forEach((h, i) => {
          obj[h] = r[i] !== undefined ? String(r[i]) : '';
        });
        return obj;
      });
    },
    resetTabs: () => {
      cacheStore.clear();
      for (const [tabName, cols] of Object.entries(expectedTabs)) {
        sheetsMap.set(tabName, makeSheet(tabName, [cols]));
      }
    }
  };
}

// ---------------------------------------------------------------------------
// 3. Configure Synthetic Offline Environment & Load Real Modules
// ---------------------------------------------------------------------------
const TEST_GATEWAY_URL = 'https://script.google.com/macros/s/SYNTHETIC_MASTER_TEST/exec';
const TEST_GATEWAY_SECRET = 'synthetic_gateway_secret_master_5h36_0123456789abcdef';
const TEST_SESSION_SECRET = 'synthetic_session_secret_master_5h36_0123456789abcdef';
const TEST_WORKER_SECRET = 'synthetic_worker_primary_secret_5h36_abcdef123456';
const TEST_WORKER_PREV_SECRET = 'synthetic_worker_previous_secret_5h36_9876543210';
const TEST_CHATMITRA_SECRET = 'synthetic_chatmitra_hmac_secret_5h36_abcdef';
const TEST_META_SECRET = 'synthetic_meta_app_secret_5h36_abcdef123456';

const vmHarness = createGatewayVmHarness(TEST_GATEWAY_SECRET);

process.env.GOOGLE_SHEETS_TRANSPORT_MODE = 'APPS_SCRIPT_GATEWAY';
process.env.GOOGLE_SHEETS_GATEWAY_URL = TEST_GATEWAY_URL;
process.env.GOOGLE_SHEETS_GATEWAY_SECRET = TEST_GATEWAY_SECRET;
process.env.GOOGLE_SHEETS_SPREADSHEET_ID = 'SPREADSHEET_SYNTHETIC_5H36';
process.env.SESSION_SECRET = TEST_SESSION_SECRET;
process.env.CRM_ADMIN_EMAIL = 'owner@avanifinserv.test';
process.env.CRM_ADMIN_PASSWORD = 'SyntheticAdminPass!5H36#Secure';
process.env.CRM_ADMIN_NAME = 'Sachin Shinde';
process.env.INTERNAL_WORKER_SECRET = TEST_WORKER_SECRET;
process.env.CHATMITRA_WEBHOOK_SECRET = TEST_CHATMITRA_SECRET;
process.env.META_APP_SECRET = TEST_META_SECRET;
delete process.env.LEGACY_MONGODB_ROUTES_ENABLED;
delete process.env.BULK_BROADCAST_ENABLED;
delete process.env.STRICT_SESSION_REVOCATION_FAIL_CLOSED;

let forceGatewayOffline = false;
const origFetch = globalThis.fetch;

globalThis.fetch = async (url, init = {}) => {
  const urlStr = String(url);
  if (urlStr === TEST_GATEWAY_URL) {
    if (forceGatewayOffline) {
      throw new Error('Synthetic Google Sheets Gateway Offline');
    }
    const result = vmHarness.invokeRawPost(String(init.body || ''));
    return {
      ok: result.ok === true && (result.status || 200) < 400,
      status: result.status || (result.ok ? 200 : 500),
      async json() {
        return result;
      },
      async text() {
        return JSON.stringify(result);
      }
    };
  }
  throw new Error(`UNEXPECTED_OUTBOUND_FETCH_BLOCKED: ${urlStr}`);
};

// Load primary modules
const routingPolicy = require('../src/lib/routing-policy.ts');
const publicWebsite = require('../src/config/public-website.ts');
const proxyMod = require('../src/proxy.ts');
const robotsMod = require('../src/app/robots.ts');
const sitemapMod = require('../src/app/sitemap.ts');
const sheets = require('../src/lib/google-sheets/index.ts');
const auth = require('../src/lib/auth.ts');
const authStore = require('../src/lib/auth-store.ts');
const loginRoute = require('../src/app/api/auth/login/route.ts');
const logoutRoute = require('../src/app/api/auth/logout/route.ts');
const publicEnquiryRoute = require('../src/app/api/public/enquiry/route.ts');
const docsUploadRoute = require('../src/app/api/documents/secure-upload/route.ts');
const workerRoute = require('../src/app/api/whatsapp-webhook-worker/route.ts');
const chatmitraRoute = require('../src/app/api/chatmitra-webhook/route.ts');
const whatsappRoute = require('../src/app/api/whatsapp-webhook/route.ts');
const reconcileRoute = require('../src/app/api/internal/reconcile-identities/route.ts');
const webhooksRoute = require('../src/app/api/webhooks/route.ts');
const metaLegacyRoute = require('../src/app/api/meta-webhook/route.ts');
const directMsgLegacyRoute = require('../src/app/api/contacts/direct-message/route.ts');
const broadcastLegacyRoute = require('../src/app/api/broadcasts/send/route.ts');
const callkaroLegacyRoute = require('../src/app/api/callkaro-webhook/route.ts');
const vapiLegacyRoute = require('../src/app/api/vapi-webhook/route.ts');
const { ProviderRouter } = require('../src/lib/provider-router.ts');

// Helper: instantiate a genuinely isolated second serverless instance of auth + auth-store + login/logout
function loadIsolatedAuthInstance() {
  const keysToClear = [
    path.join(SRC_DIR, 'lib', 'auth-store.ts'),
    path.join(SRC_DIR, 'lib', 'auth.ts'),
    path.join(SRC_DIR, 'app', 'api', 'auth', 'login', 'route.ts'),
    path.join(SRC_DIR, 'app', 'api', 'auth', 'logout', 'route.ts')
  ];
  const saved = new Map();
  for (const k of keysToClear) {
    saved.set(k, require.cache[k]);
    delete require.cache[k];
  }
  const inst = {
    authStore: require('../src/lib/auth-store.ts'),
    auth: require('../src/lib/auth.ts'),
    loginRoute: require('../src/app/api/auth/login/route.ts'),
    logoutRoute: require('../src/app/api/auth/logout/route.ts')
  };
  for (const [k, v] of saved.entries()) {
    if (v) require.cache[k] = v;
    else delete require.cache[k];
  }
  return inst;
}

function makeMockNextRequest(url, options = {}) {
  const parsed = new URL(url);
  const headers = new Headers(options.headers || {});
  const cookieMap = new Map();
  const rawCookie = headers.get('cookie') || '';
  for (const pair of rawCookie.split(';')) {
    const idx = pair.indexOf('=');
    if (idx > 0) {
      cookieMap.set(pair.slice(0, idx).trim(), decodeURIComponent(pair.slice(idx + 1).trim()));
    }
  }
  return {
    url: parsed.toString(),
    method: options.method || 'GET',
    headers,
    nextUrl: {
      pathname: parsed.pathname,
      hostname: parsed.hostname,
      searchParams: parsed.searchParams
    },
    cookies: {
      get: (name) => (cookieMap.has(name) ? { name, value: cookieMap.get(name) } : undefined)
    }
  };
}

async function makeAdminCookieHeader(authMod = auth) {
  const { token } = await authMod.issueRotatedSession({
    id: 'ADV-SACHIN-01',
    name: 'Sachin Shinde',
    email: 'owner@avanifinserv.test',
    role: 'ADMIN'
  });
  return { token, cookieHeader: `${authMod.SESSION_COOKIE_NAME}=${token}` };
}

beforeEach(() => {
  forceGatewayOffline = false;
  mongoConnectCalls = 0;
  postgresCalls = 0;
  vmHarness.resetTabs();
  authStore.resetLocalAuthStoreCachesForTesting();
  publicEnquiryRoute.resetPublicEnquiryRateLimitForTesting();
  process.env.INTERNAL_WORKER_SECRET = TEST_WORKER_SECRET;
  delete process.env.INTERNAL_WORKER_SECRET_PREVIOUS;
  delete process.env.LEGACY_MONGODB_ROUTES_ENABLED;
  delete process.env.BULK_BROADCAST_ENABLED;
  delete process.env.STRICT_SESSION_REVOCATION_FAIL_CLOSED;
  delete process.env.RECONCILIATION_CRON_SECRET;
  delete process.env.APP_SURFACE_MODE;
});

afterEach(() => {
  forceGatewayOffline = false;
});

// ===========================================================================
// GROUP A — PUBLIC WEBSITE ROUTING, BUSINESS PROFILE, DESIGN SYSTEM & SEO
// ===========================================================================
describe('Group A — Public Website Restoration, Business Profile, Design System & SEO', () => {
  it('W-01: Hostname surface routing separates public domains from CRM domains and fails closed on unknown hosts', () => {
    assert.equal(routingPolicy.resolveAppSurface('www.avanifinserv.com'), 'public');
    assert.equal(routingPolicy.resolveAppSurface('avanifinserv.com'), 'public');
    assert.equal(routingPolicy.resolveAppSurface('localhost:3000'), 'public');
    assert.equal(routingPolicy.resolveAppSurface('avani-ai-crm.vercel.app'), 'crm');
    assert.equal(routingPolicy.resolveAppSurface('crm.avanifinserv.com'), 'crm');
    assert.equal(routingPolicy.resolveAppSurface('preview-xyz.vercel.app'), 'crm');
    assert.equal(routingPolicy.resolveAppSurface('evil-host.example.com'), 'crm');
  });

  it('W-02: Real src/proxy.ts serves all public pages without auth or redirect loops on avanifinserv.com & www.avanifinserv.com', async () => {
    const publicRoutes = [
      '/',
      '/about',
      '/services',
      '/services/personal-loan',
      '/services/home-loan',
      '/services/school-and-college-funding',
      '/blog',
      '/blog/education-loan-planning-india-and-global-studies',
      '/contact',
      '/enquiry',
      '/privacy',
      '/terms',
      '/disclaimer'
    ];
    for (const host of ['www.avanifinserv.com', 'avanifinserv.com']) {
      for (const route of publicRoutes) {
        const res = await proxyMod.proxy(
          makeMockNextRequest(`https://${host}${route}`, { headers: { host } })
        );
        assert.equal(res._isNext, true, `Expected public passthrough for https://${host}${route}`);
        assert.notEqual(res._isRedirect, true, `Must not redirect public page https://${host}${route}`);
      }
    }
  });

  it('W-03: Real src/proxy.ts protects CRM host "/" and ALL CRM pages (/crm, /leads, /inbox, /webhooks) on EVERY host', async () => {
    for (const crmHost of ['avani-ai-crm.vercel.app', 'crm.avanifinserv.com']) {
      const rootRes = await proxyMod.proxy(
        makeMockNextRequest(`https://${crmHost}/`, { headers: { host: crmHost } })
      );
      assert.equal(rootRes._isRedirect, true);
      assert.equal(new URL(rootRes._redirectLocation).pathname, '/login');
    }

    for (const host of ['www.avanifinserv.com', 'avani-ai-crm.vercel.app']) {
      for (const crmPath of ['/crm', '/leads', '/contacts', '/inbox', '/webhooks', '/settings']) {
        const res = await proxyMod.proxy(
          makeMockNextRequest(`https://${host}${crmPath}`, { headers: { host } })
        );
        assert.equal(res._isRedirect, true, `${host}${crmPath} must redirect unauthenticated users`);
        const loc = new URL(res._redirectLocation);
        assert.equal(loc.pathname, '/login');
        assert.equal(loc.searchParams.get('next'), crmPath);
      }
    }
  });

  it('W-04: Real src/proxy.ts returns 401 for unauthenticated private APIs while allowing /robots.txt and /sitemap.xml', async () => {
    for (const apiPath of ['/api/leads', '/api/dashboard/metrics', '/api/webhooks']) {
      const res = await proxyMod.proxy(
        makeMockNextRequest(`https://www.avanifinserv.com${apiPath}`, {
          headers: { host: 'www.avanifinserv.com' }
        })
      );
      assert.equal(res.status, 401);
      assert.equal((await res.json()).error, 'UNAUTHORIZED');
    }

    for (const seoPath of ['/robots.txt', '/sitemap.xml']) {
      const res = await proxyMod.proxy(
        makeMockNextRequest(`https://www.avanifinserv.com${seoPath}`, {
          headers: { host: 'www.avanifinserv.com' }
        })
      );
      assert.equal(res._isNext, true);
    }
  });

  it('W-05: Authoritative business profile matches owner specification (Sachin Shinde, +91 91756 35165, Latur 413512, 8 services, 12 audiences)', () => {
    const b = publicWebsite.OFFICIAL_BUSINESS;
    assert.equal(b.name, 'AVANI LOAN SERVICES');
    assert.equal(b.ownerFounder, 'Sachin Shinde');
    assert.equal(b.industry, 'Financial Services | Loan Consultancy | Loan Advisory');
    assert.equal(b.email, 'enquiry@avanifinserv.com');
    assert.equal(b.mailtoHref, 'mailto:enquiry@avanifinserv.com');
    assert.equal(b.whatsappDisplay, '+91 91756 35165');
    assert.equal(b.whatsappBaseUrl, 'https://wa.me/919175635165');
    assert.equal(
      b.officeAddressFull,
      'OLD BARSHI ROAD, 5NO CHAUK, KULSWAMINI NAGAR, NEXT TO SAI SCHOOL, LATUR – 413512, MAHARASHTRA, INDIA'
    );
    assert.ok(publicWebsite.buildOfficialWhatsAppUrl().startsWith('https://wa.me/919175635165?text='));
    assert.equal(publicWebsite.CORE_OFFICIAL_SERVICES.length, 8);
    assert.equal(publicWebsite.TARGET_AUDIENCES.length, 12);

    const coreNames = publicWebsite.CORE_OFFICIAL_SERVICES.map((s) => s.name);
    for (const required of [
      'Personal Loan',
      'Business Loan',
      'Doctor Loan',
      'Home Loan',
      'Mortgage Loan',
      'Education Loan — India',
      'Education Loan — Global Studies',
      'School and College Funding'
    ]) {
      assert.ok(coreNames.some((n) => n.includes(required)), `Missing official service: ${required}`);
    }
  });

  it('W-06: Public website files have ZERO outdated +91 72491 08474, ZERO wrong PIN 413531, ZERO fabricated claims, and ZERO extra NEXT_PUBLIC_ vars', () => {
    const publicSourceFiles = [
      'src/config/public-website.ts',
      'src/components/public/public-shell.tsx',
      'src/components/public/public-home.tsx',
      'src/components/public/enquiry-form.tsx',
      'src/app/about/page.tsx',
      'src/app/services/page.tsx',
      'src/app/services/[slug]/page.tsx',
      'src/app/blog/page.tsx',
      'src/app/blog/[slug]/page.tsx',
      'src/app/contact/page.tsx',
      'src/app/enquiry/page.tsx',
      'src/app/privacy/page.tsx',
      'src/app/terms/page.tsx',
      'src/app/disclaimer/page.tsx',
      'src/app/robots.ts',
      'src/app/sitemap.ts'
    ];
    for (const rel of publicSourceFiles) {
      const content = fs.readFileSync(path.join(ROOT_DIR, rel), 'utf8');
      assert.equal(/72491\s*08474|7249108474/.test(content), false, `Outdated 72491 number found in ${rel}`);
      assert.equal(/413531/.test(content), false, `Wrong PIN 413531 found in ${rel}`);
      assert.equal(/STAR POWERZ|same-day approval|100% approval|guaranteed approval|40\+ partner/i.test(content), false, `Unverified/prohibited claim in ${rel}`);
      const nextPub = content.match(/NEXT_PUBLIC_[A-Z0-9_]+/g) || [];
      for (const v of nextPub) {
        assert.equal(v, 'NEXT_PUBLIC_APP_URL', `Unauthorized NEXT_PUBLIC var ${v} in ${rel}`);
      }
    }
  });

  it('W-07: Sky-blue & light-golden design system tokens and vector brand/hero/OG SVG assets are present and valid', () => {
    const shellSrc = fs.readFileSync(path.join(SRC_DIR, 'components/public/public-shell.tsx'), 'utf8');
    const homeSrc = fs.readFileSync(path.join(SRC_DIR, 'components/public/public-home.tsx'), 'utf8');
    for (const color of ['#38A9E8', '#176B9A', '#EFF8FE', '#E8CF91', '#FBF6E9', '#FFFFFF', '#253447', '#64748B', '#E2EAF0']) {
      assert.ok(shellSrc.includes(color) || homeSrc.includes(color), `Design token ${color} missing`);
    }

    for (const asset of ['avani-brand-mark.svg', 'hero-advisory-illustration.svg', 'og-avani-loan-services.svg']) {
      const full = path.join(ROOT_DIR, 'public', 'images', asset);
      assert.ok(fs.existsSync(full), `Missing asset ${asset}`);
      const svg = fs.readFileSync(full, 'utf8');
      assert.ok(svg.includes('<svg') && svg.includes('width=') && svg.includes('height='), `Invalid SVG ${asset}`);
    }
  });

  it('W-08: Technical SEO — robots.ts disallows CRM/login/api, sitemap.ts includes ONLY canonical public URLs, /login has noindex', () => {
    const robotsObj = robotsMod.default();
    const rule = Array.isArray(robotsObj.rules) ? robotsObj.rules[0] : robotsObj.rules;
    assert.ok(rule.disallow.includes('/login'));
    assert.ok(rule.disallow.includes('/crm'));
    assert.ok(rule.disallow.includes('/leads'));
    assert.ok(rule.disallow.includes('/api/'));
    assert.equal(robotsObj.sitemap, 'https://www.avanifinserv.com/sitemap.xml');

    const entries = sitemapMod.default();
    assert.equal(entries.length, 9 + publicWebsite.PUBLIC_LOAN_SERVICES.length + publicWebsite.PUBLIC_BLOG_ARTICLES.length);
    for (const e of entries) {
      assert.ok(e.url.startsWith('https://www.avanifinserv.com/'), `Non-canonical sitemap URL: ${e.url}`);
      assert.equal(/\/(login|crm|leads|contacts|inbox|webhooks|settings|api|admin)/.test(e.url), false, `Private route leaked to sitemap: ${e.url}`);
    }

    const loginLayoutSrc = fs.readFileSync(path.join(SRC_DIR, 'app/login/layout.tsx'), 'utf8');
    assert.ok(loginLayoutSrc.includes('index: false') && loginLayoutSrc.includes('follow: false'));
  });

  it('W-09: Structured Data JSON-LD schemas are valid JSON with verified facts only (zero fabricated ratings/reviews/awards)', () => {
    const org = publicWebsite.buildOrganizationJsonLd();
    const site = publicWebsite.buildWebSiteJsonLd();
    const bc = publicWebsite.buildBreadcrumbJsonLd([{ name: 'Home', path: '/' }, { name: 'About Us', path: '/about' }]);

    assert.equal(org['@type'], 'FinancialService');
    assert.equal(org.name, 'AVANI LOAN SERVICES');
    assert.equal(org.founder.name, 'Sachin Shinde');
    assert.equal(org.address.postalCode, '413512');
    assert.equal('aggregateRating' in org, false);
    assert.equal('review' in org, false);
    assert.equal(site['@type'], 'WebSite');
    assert.equal(bc.itemListElement.length, 2);

    for (const svc of publicWebsite.PUBLIC_LOAN_SERVICES) {
      const ld = publicWebsite.buildServiceJsonLd(svc);
      const parsed = JSON.parse(JSON.stringify(ld));
      assert.equal(parsed['@type'], 'Service');
      assert.equal(parsed.url, `https://www.avanifinserv.com/services/${svc.slug}`);
    }
    for (const post of publicWebsite.PUBLIC_BLOG_ARTICLES) {
      const ld = publicWebsite.buildArticleJsonLd(post);
      const parsed = JSON.parse(JSON.stringify(ld));
      assert.equal(parsed['@type'], 'Article');
      assert.equal(parsed.author.name, 'Sachin Shinde');
    }
  });

  it('W-10: All header/footer internal links correspond to real App Router pages (zero broken links)', () => {
    const shellSrc = fs.readFileSync(path.join(SRC_DIR, 'components/public/public-shell.tsx'), 'utf8');
    const hrefs = [...shellSrc.matchAll(/href="(\/[^"#?]*)/g)].map((m) => m[1]);
    const validStatic = new Set(['/', '/about', '/services', '/blog', '/contact', '/enquiry', '/privacy', '/terms', '/disclaimer']);
    const validServiceSlugs = new Set(publicWebsite.PUBLIC_LOAN_SERVICES.map((s) => `/services/${s.slug}`));
    const validBlogSlugs = new Set(publicWebsite.PUBLIC_BLOG_ARTICLES.map((b) => `/blog/${b.slug}`));
    for (const h of hrefs) {
      assert.ok(
        validStatic.has(h) || validServiceSlugs.has(h) || validBlogSlugs.has(h),
        `Broken internal link detected in PublicShell: ${h}`
      );
    }
  });
});

// ===========================================================================
// GROUP B — PUBLIC ENQUIRY FORM & WORKSTREAM C DATA MINIMISATION
// ===========================================================================
describe('Group B — Public Enquiry Form & Google Sheets Data Minimisation', () => {
  it('DM-01: Valid minimal enquiry persists cleanly via gateway.gs VM and ignores mass-assigned privileged keys', async () => {
    const req = new Request('https://www.avanifinserv.com/api/public/enquiry', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-forwarded-for': '203.0.113.10' },
      body: JSON.stringify({
        name: 'Prashant Kulkarni',
        phone: '9822112233',
        city: 'Latur',
        loanType: 'Home Loan',
        requestedAmount: '2500000',
        consent: true,
        role: 'ADMIN',
        leadStatus: 'DISBURSED',
        assignedAdvisorId: 'ADV-HACKER-99'
      })
    });
    const res = await publicEnquiryRoute.POST(req);
    const body = await res.json();
    assert.equal(res.status, 201);
    assert.equal(body.success, true);
    assert.equal(body.persisted, true);
    assert.ok(body.leadId);

    const leads = vmHarness.getTabObjects('LEADS');
    assert.equal(leads.length, 1);
    assert.equal(leads[0].lead_status, 'NEW_ENQUIRY');
    assert.equal(leads[0].assigned_advisor_id, 'ADV-SACHIN-01');
    assert.equal(leads[0].loan_category, 'Home Loan');
    assert.equal(mongoConnectCalls, 0);
  });

  it('DM-02: Duplicate public enquiry submission with same idempotencyKey converges on single row', async () => {
    const payload = {
      name: 'Snehal Deshmukh',
      phone: '+91 9822445566',
      city: 'Latur',
      loanType: 'Education Loan — Global Studies',
      consent: true,
      idempotencyKey: 'WEB-IDEMP-001'
    };
    const r1 = await publicEnquiryRoute.POST(
      new Request('https://www.avanifinserv.com/api/public/enquiry', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-forwarded-for': '203.0.113.11' },
        body: JSON.stringify(payload)
      })
    );
    const r2 = await publicEnquiryRoute.POST(
      new Request('https://www.avanifinserv.com/api/public/enquiry', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-forwarded-for': '203.0.113.11' },
        body: JSON.stringify(payload)
      })
    );
    const b1 = await r1.json();
    const b2 = await r2.json();
    assert.equal(r1.status, 201);
    assert.equal(r2.status, 201);
    assert.equal(b1.leadId, b2.leadId);
    assert.equal(vmHarness.getTabObjects('CUSTOMERS').length, 1);
    assert.equal(vmHarness.getTabObjects('LEADS').length, 1);
  });

  it('DM-03: Public enquiry rejects prohibited KYC/document/base64 payloads with 400 PROHIBITED_SENSITIVE_DATA and ZERO Sheets writes', async () => {
    const prohibitedPayloads = [
      { name: 'Test User', phone: '9822112234', loanType: 'Personal Loan', consent: true, aadhaar: '234567891234' },
      { name: 'Test User', phone: '9822112234', loanType: 'Personal Loan', consent: true, panNumber: 'ABCDE1234F' },
      { name: 'Test User', phone: '9822112234', loanType: 'Personal Loan', consent: true, salarySlip: 'slip.pdf' },
      { name: 'Test User', phone: '9822112234', loanType: 'Personal Loan', consent: true, bankAccount: '1234567890123456' },
      { name: 'Test User', phone: '9822112234', loanType: 'Personal Loan', consent: true, notes: 'data:application/pdf;base64,JVBERi0xLjQK' }
    ];
    for (const p of prohibitedPayloads) {
      const res = await publicEnquiryRoute.POST(
        new Request('https://www.avanifinserv.com/api/public/enquiry', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'x-forwarded-for': '203.0.113.12' },
          body: JSON.stringify(p)
        })
      );
      assert.equal(res.status, 400);
      assert.equal((await res.json()).error, 'PROHIBITED_SENSITIVE_DATA');
    }
    assert.equal(vmHarness.getTabObjects('CUSTOMERS').length, 0);
    assert.equal(vmHarness.getTabObjects('LEADS').length, 0);
  });

  it('DM-04: Honeypot bot submission is rejected with 400 and writes zero rows', async () => {
    const res = await publicEnquiryRoute.POST(
      new Request('https://www.avanifinserv.com/api/public/enquiry', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-forwarded-for': '203.0.113.13' },
        body: JSON.stringify({
          name: 'Bot Spammer',
          phone: '9822112235',
          loanType: 'Personal Loan',
          consent: true,
          website: 'https://spam-bot.invalid'
        })
      })
    );
    assert.equal(res.status, 400);
    assert.equal((await res.json()).error, 'INVALID_REQUEST');
    assert.equal(vmHarness.getTabObjects('CUSTOMERS').length, 0);
  });

  it('DM-05: Enforces explicit DPDP consent, per-IP rate limiting (429), and fail-closed 503 when Sheets is offline', async () => {
    const deniedRes = await publicEnquiryRoute.POST(
      new Request('https://www.avanifinserv.com/api/public/enquiry', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-forwarded-for': '203.0.113.14' },
        body: JSON.stringify({ name: 'No Consent', phone: '9822112236', loanType: 'Home Loan', consent: false })
      })
    );
    assert.equal(deniedRes.status, 403);

    const missingRes = await publicEnquiryRoute.POST(
      new Request('https://www.avanifinserv.com/api/public/enquiry', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-forwarded-for': '203.0.113.15' },
        body: JSON.stringify({ name: 'Missing Consent', phone: '9822112237', loanType: 'Home Loan' })
      })
    );
    assert.equal(missingRes.status, 400);

    // Offline Sheets -> 503 (never false success!)
    forceGatewayOffline = true;
    const offlineRes = await publicEnquiryRoute.POST(
      new Request('https://www.avanifinserv.com/api/public/enquiry', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-forwarded-for': '203.0.113.16' },
        body: JSON.stringify({ name: 'Offline Test', phone: '9822112238', loanType: 'Home Loan', consent: true })
      })
    );
    assert.equal(offlineRes.status, 503);
    assert.equal((await offlineRes.json()).persisted, false);
    forceGatewayOffline = false;

    // Rate limit (10 allowed, 11th returns 429)
    for (let i = 0; i < 10; i++) {
      const r = await publicEnquiryRoute.POST(
        new Request('https://www.avanifinserv.com/api/public/enquiry', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'x-forwarded-for': '203.0.113.99' },
          body: JSON.stringify({ name: `Rate User ${i}`, phone: `982211224${i}`, loanType: 'Personal Loan', consent: true })
        })
      );
      assert.equal(r.status, 201);
    }
    const blocked = await publicEnquiryRoute.POST(
      new Request('https://www.avanifinserv.com/api/public/enquiry', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-forwarded-for': '203.0.113.99' },
        body: JSON.stringify({ name: 'Rate User 11', phone: '9822112299', loanType: 'Personal Loan', consent: true })
      })
    );
    assert.equal(blocked.status, 429);
    assert.ok(blocked.headers.get('retry-after'));
  });

  it('DM-06: Sheet sanitizer blocks base64/data-URI/PEM/formula payloads and redacts PAN, Aadhaar, IFSC & 16-digit bank numbers', () => {
    assert.throws(() => sheets.sanitizeCellForSheets('short_notes', 'data:image/png;base64,iVBORw0KGgo='));
    assert.throws(() => sheets.sanitizeCellForSheets('short_notes', 'A'.repeat(130)));
    assert.throws(() => sheets.sanitizeCellForSheets('customer_name', '=IMPORTXML("http://evil")'));

    const redacted = sheets.sanitizeCellForSheets(
      'short_notes',
      'PAN ABCDE1234F Aadhaar 2345 6789 0123 IFSC SBIN0001234 Acct 1234567890123456'
    );
    assert.ok(redacted.includes('[REDACTED_PAN]'));
    assert.ok(redacted.includes('[REDACTED_AADHAAR]'));
    assert.ok(redacted.includes('[REDACTED_IFSC]'));
    assert.ok(redacted.includes('[REDACTED_FINANCIAL_NUM]'));
    assert.equal(sheets.sanitizeCellForSheets('mobile_number', '+919822112233', { allowE164Phone: true }), '+919822112233');
  });

  it('DM-07: validateLoanCategory accurately normalizes all official and extended categories', () => {
    assert.equal(sheets.validateLoanCategory('Doctor Loan'), 'Doctor Loan');
    assert.equal(sheets.validateLoanCategory('MSME & Working Capital Loans'), 'Business Loan');
    assert.equal(sheets.validateLoanCategory('Mortgage Loan / LAP'), 'Mortgage Loan / LAP');
    assert.equal(sheets.validateLoanCategory('Education Loan — India'), 'Education Loan — India');
    assert.equal(sheets.validateLoanCategory('Education Loan — Global Studies'), 'Education Loan — Global Studies');
    assert.equal(sheets.validateLoanCategory('School Funding'), 'School Funding');
    assert.equal(sheets.validateLoanCategory('College Funding'), 'College Funding');
    assert.equal(sheets.validateLoanCategory('Vehicle / Commercial Equipment Loan'), 'Vehicle / Commercial Equipment Loan');
    assert.equal(sheets.validateLoanCategory('Loan Transfer / Balance Transfer'), 'Loan Transfer / Balance Transfer');
  });

  it('DM-08: /api/documents/secure-upload remains disabled with HTTP 410', async () => {
    const res = await docsUploadRoute.POST();
    assert.equal(res.status, 410);
    assert.equal((await res.json()).error, 'DOCUMENT_UPLOAD_DISABLED');
  });
});

// ===========================================================================
// GROUP C — WORKSTREAM B SEVEN CRM PRODUCTION BLOCKERS (REAL SOURCE + VM)
// ===========================================================================
describe('Group C — Seven CRM Production Blockers Verification', () => {
  it('B1-01: INTERNAL_WORKER_SECRET fails closed when missing/wrong and supports zero-downtime rotation (>=16 chars only)', async () => {
    assert.equal(workerRoute.verifyInternalWorkerAuthHeader(TEST_WORKER_SECRET), true);
    assert.equal(workerRoute.verifyInternalWorkerAuthHeader('wrong-secret'), false);

    // Rotation with >=16 char previous secret works
    process.env.INTERNAL_WORKER_SECRET_PREVIOUS = TEST_WORKER_PREV_SECRET;
    assert.equal(workerRoute.verifyInternalWorkerAuthHeader(TEST_WORKER_PREV_SECRET), true);

    // Short (<16 char) previous secret is rejected fail-closed
    process.env.INTERNAL_WORKER_SECRET_PREVIOUS = 'too_short';
    assert.equal(workerRoute.verifyInternalWorkerAuthHeader('too_short'), false);

    // Unset primary fails closed even if previous is set
    delete process.env.INTERNAL_WORKER_SECRET;
    process.env.INTERNAL_WORKER_SECRET_PREVIOUS = TEST_WORKER_PREV_SECRET;
    assert.equal(workerRoute.verifyInternalWorkerAuthHeader(TEST_WORKER_PREV_SECRET), false);

    const res401 = await workerRoute.POST(
      new Request('https://avani-ai-crm.vercel.app/api/whatsapp-webhook-worker', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-worker-auth': TEST_WORKER_SECRET },
        body: JSON.stringify({})
      })
    );
    assert.equal(res401.status, 401);
    assert.equal(res401.headers.get('cache-control'), 'no-store');
  });

  it('B2-01: Unmodified gateway.gs VM verifies HMAC, blocks stale timestamps, nonce replays, and disallowed actions', () => {
    const payload = { action: 'HEALTH_CHECK' };
    const signed = sheets.signAppsScriptGatewayRequest(payload, TEST_GATEWAY_SECRET);
    const okRes = vmHarness.invokeRawPost(signed.bodyString);
    assert.equal(okRes.ok, true);

    // Replay of identical requestId nonce must fail closed
    const replayRes = vmHarness.invokeRawPost(signed.bodyString);
    assert.equal(replayRes.ok, false);
    assert.equal(replayRes.status, 401);

    // Tampered signature must fail closed
    const parsed = JSON.parse(signed.bodyString);
    parsed.requestId = `REQ-TAMPER-${Date.now()}`;
    parsed.signature = '0'.repeat(64);
    const tamperRes = vmHarness.invokeRawPost(JSON.stringify(parsed));
    assert.equal(tamperRes.ok, false);
    assert.equal(tamperRes.status, 401);

    // Stale timestamp (>300s skew) fails closed
    const oldTs = Date.now() - 400_000;
    const staleReqId = `REQ-STALE-${Date.now()}`;
    const pJson = JSON.stringify(payload);
    const staleSig = crypto
      .createHmac('sha256', TEST_GATEWAY_SECRET)
      .update(`${oldTs}.${staleReqId}.${pJson}`, 'utf8')
      .digest('hex');
    const staleRes = vmHarness.invokeRawPost(
      JSON.stringify({ requestId: staleReqId, timestampMs: oldTs, payloadJson: pJson, signature: staleSig })
    );
    assert.equal(staleRes.ok, false);
    assert.equal(staleRes.status, 401);

    // Disallowed action rejected
    const badAction = sheets.signAppsScriptGatewayRequest({ action: 'DROP_ALL_TABS' }, TEST_GATEWAY_SECRET);
    const badActionRes = vmHarness.invokeRawPost(badAction.bodyString);
    assert.equal(badActionRes.ok, false);
    assert.equal(badActionRes.status, 400);
  });

  it('B3-01: ChatMitra & Meta GET verify endpoints use constant-time env tokens with ZERO hardcoded fallback tokens', async () => {
    delete process.env.META_WEBHOOK_VERIFY_TOKEN;
    delete process.env.OMNIDIM_VERIFY_TOKEN;
    delete process.env.CHATMITRA_VERIFY_TOKEN;
    delete process.env.CHATMANTRA_VERIFY_TOKEN;

    // Legacy hardcoded tokens MUST be rejected with 403
    for (const legacyToken of ['avani_loan_verify_token_1356', 'PWiRWHRQxNcR-dkCofM5dL2CxbkRQnUu']) {
      const r = await whatsappRoute.GET(
        new Request(`https://avani-ai-crm.vercel.app/api/whatsapp-webhook?hub.mode=subscribe&hub.verify_token=${legacyToken}&hub.challenge=CHK1`)
      );
      assert.equal(r.status, 403, `Legacy hardcoded token ${legacyToken} must be rejected`);
    }

    // Configured env verify tokens succeed
    process.env.META_WEBHOOK_VERIFY_TOKEN = 'SYNTHETIC_META_VERIFY_5H36';
    process.env.CHATMITRA_VERIFY_TOKEN = 'SYNTHETIC_CM_VERIFY_5H36';

    const okMeta = await whatsappRoute.GET(
      new Request('https://avani-ai-crm.vercel.app/api/whatsapp-webhook?hub.mode=subscribe&hub.verify_token=SYNTHETIC_META_VERIFY_5H36&hub.challenge=META_OK')
    );
    assert.equal(okMeta.status, 200);
    assert.equal(await okMeta.text(), 'META_OK');

    const okCm = await chatmitraRoute.GET(
      new Request('https://avani-ai-crm.vercel.app/api/chatmitra-webhook?hub.mode=subscribe&hub.verify_token=SYNTHETIC_CM_VERIFY_5H36&hub.challenge=CM_OK')
    );
    assert.equal(okCm.status, 200);
    assert.equal(await okCm.text(), 'CM_OK');

    const badCm = await chatmitraRoute.GET(
      new Request('https://avani-ai-crm.vercel.app/api/chatmitra-webhook?hub.mode=subscribe&hub.verify_token=WRONG&hub.challenge=CM_NO')
    );
    assert.equal(badCm.status, 403);
  });

  it('B3-02: ChatMitra POST enforces HMAC signature and rejects missing messageId without fabricating IDs', async () => {
    const rawMissingId = JSON.stringify({ event: 'message.received', from: '9822112233', text: 'Need loan' });
    const unsignedRes = await chatmitraRoute.POST(
      new Request('https://avani-ai-crm.vercel.app/api/chatmitra-webhook', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: rawMissingId
      })
    );
    assert.equal(unsignedRes.status, 401);

    const sig = crypto.createHmac('sha256', TEST_CHATMITRA_SECRET).update(rawMissingId, 'utf8').digest('hex');
    const badPayloadRes = await chatmitraRoute.POST(
      new Request('https://avani-ai-crm.vercel.app/api/chatmitra-webhook', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-webhook-signature': `sha256=${sig}` },
        body: rawMissingId
      })
    );
    assert.equal(badPayloadRes.status, 400);
    assert.equal((await badPayloadRes.json()).persisted, false);
    assert.equal(vmHarness.getTabObjects('WEBHOOK_EVENTS').length, 0);
  });

  it('B4-01: Cross-instance session revocation — logout on Instance A IMMEDIATELY invalidates session on isolated Instance B via SYSTEM_CONFIG', async () => {
    const instanceB = loadIsolatedAuthInstance();

    const { token, session } = await auth.issueRotatedSession({
      id: 'ADV-SACHIN-01',
      name: 'Sachin Shinde',
      email: 'owner@avanifinserv.test',
      role: 'ADMIN'
    });
    assert.equal(session.exp - session.iat, 1800, '30-minute maximum session age preserved');

    // Both Instance A and isolated Instance B accept the valid session
    assert.ok(await auth.verifyActiveSession(token));
    assert.ok(await instanceB.auth.verifyActiveSession(token));

    // Logout on Instance A
    const logoutRes = await logoutRoute.POST(
      new Request('https://avani-ai-crm.vercel.app/api/auth/logout', {
        method: 'POST',
        headers: {
          host: 'avani-ai-crm.vercel.app',
          origin: 'https://avani-ai-crm.vercel.app',
          cookie: `${auth.SESSION_COOKIE_NAME}=${token}`
        }
      })
    );
    assert.equal(logoutRes.status, 200);

    // Instance A rejects immediately AND isolated Instance B (separate memory Map!) rejects immediately via durable SYSTEM_CONFIG
    assert.equal(await auth.verifyActiveSession(token), null);
    assert.equal(await instanceB.auth.verifyActiveSession(token), null);

    // Inspect SYSTEM_CONFIG: zero raw session token, raw jti, email, or password stored
    const sysRows = vmHarness.getTabObjects('SYSTEM_CONFIG');
    const revRow = sysRows.find((r) => r.config_key.startsWith('AUTH_REV_'));
    assert.ok(revRow, 'Durable AUTH_REV_ marker must exist in SYSTEM_CONFIG');
    const serializedAll = JSON.stringify(sysRows);
    assert.equal(serializedAll.includes(token), false, 'Raw session token must NEVER be stored in Sheets');
    assert.equal(serializedAll.includes(session.jti), false, 'Raw JTI must NEVER be stored in Sheets');
    assert.equal(serializedAll.includes('owner@avanifinserv.test'), false, 'Raw email must NEVER be stored in Sheets');
  });

  it('B4-02: Global session cutoff (revokeAll: true) on Instance A invalidates a separate active session on Instance B', async () => {
    const instanceB = loadIsolatedAuthInstance();

    const s1 = await auth.issueRotatedSession({
      id: 'ADV-SACHIN-01',
      name: 'Sachin Shinde',
      email: 'owner@avanifinserv.test',
      role: 'ADMIN'
    });
    const s2 = await instanceB.auth.issueRotatedSession({
      id: 'ADV-SACHIN-01',
      name: 'Sachin Shinde',
      email: 'owner@avanifinserv.test',
      role: 'ADMIN'
    });

    assert.ok(await instanceB.auth.verifyActiveSession(s2.token));

    const res = await logoutRoute.POST(
      new Request('https://avani-ai-crm.vercel.app/api/auth/logout', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          host: 'avani-ai-crm.vercel.app',
          origin: 'https://avani-ai-crm.vercel.app',
          cookie: `${auth.SESSION_COOKIE_NAME}=${s1.token}`
        },
        body: JSON.stringify({ revokeAll: true })
      })
    );
    assert.equal(res.status, 200);
    assert.equal((await res.json()).revokedAll, true);

    // Second independent session s2 on Instance B is now rejected via AUTH_CUTOFF_
    assert.equal(await instanceB.auth.verifyActiveSession(s2.token), null);
  });

  it('B4-03: Distributed login rate limiting locks out brute-force spread across Instance A (3 tries) + Instance B (2 tries) with ZERO raw IP/email in Sheets', async () => {
    const instanceB = loadIsolatedAuthInstance();
    const attackerIp = '198.51.100.77';
    const targetEmail = 'owner@avanifinserv.test';

    const tryWrongLogin = (routeMod) =>
      routeMod.POST(
        new Request('https://avani-ai-crm.vercel.app/api/auth/login', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            host: 'avani-ai-crm.vercel.app',
            origin: 'https://avani-ai-crm.vercel.app',
            'x-forwarded-for': attackerIp
          },
          body: JSON.stringify({ email: targetEmail, password: 'WrongPassword!' })
        })
      );

    // 3 failed logins hit Instance A
    for (let i = 0; i < 3; i++) {
      assert.equal((await tryWrongLogin(loginRoute)).status, 401);
    }
    // 2 failed logins hit isolated Instance B (total = 5 -> locked!)
    for (let i = 0; i < 2; i++) {
      assert.equal((await tryWrongLogin(instanceB.loginRoute)).status, 401);
    }

    // 6th attempt on EITHER Instance A OR Instance B returns HTTP 429 TOO_MANY_ATTEMPTS!
    const blockedA = await tryWrongLogin(loginRoute);
    const blockedB = await tryWrongLogin(instanceB.loginRoute);
    assert.equal(blockedA.status, 429);
    assert.equal(blockedB.status, 429);
    assert.ok(blockedA.headers.get('retry-after'));

    // Verify ZERO raw IP or raw email persisted in SYSTEM_CONFIG
    const sysJson = JSON.stringify(vmHarness.getTabObjects('SYSTEM_CONFIG'));
    assert.equal(sysJson.includes(attackerIp), false, 'Raw IP must NEVER be stored in SYSTEM_CONFIG');
    assert.equal(sysJson.includes(targetEmail), false, 'Raw email must NEVER be stored in SYSTEM_CONFIG');
    assert.equal(sysJson.includes('WrongPassword!'), false, 'Passwords must NEVER be stored in SYSTEM_CONFIG');
  });

  it('B4-04: STRICT_SESSION_REVOCATION_FAIL_CLOSED=true rejects sessions when Sheets is unreachable; default preserves offline telemetry', async () => {
    const { token } = await auth.issueRotatedSession({
      id: 'ADV-SACHIN-01',
      name: 'Sachin Shinde',
      email: 'owner@avanifinserv.test',
      role: 'ADMIN'
    });
    forceGatewayOffline = true;

    // Default preserves local-cache fallback (so CRM APIs return accurate 503 storage-offline)
    assert.ok(await auth.verifyActiveSession(token));

    // Strict mode fails closed when durable store cannot be verified
    process.env.STRICT_SESSION_REVOCATION_FAIL_CLOSED = 'true';
    assert.equal(await auth.verifyActiveSession(token), null);
  });

  it('B5-01: Authenticated POST /api/internal/reconcile-identities rejects unauth (401), reconciles pending unresolved identity with Bearer & ADMIN session, and sends zero outbound messages', async () => {
    // Seed an unresolved message + webhook + checkpoint, then create customer
    const msgId = 'wamid.RECON_5H36_001';
    const canonicalMsgId = sheets.buildCanonicalMessageEventId('Meta', msgId);
    const unresolvedId = sheets.buildScopedUnresolvedCustomerId('Meta', msgId, 'CORR-B5');
    await sheets.messageEventRepository.recordMessageEvent({
      event_id: canonicalMsgId,
      customer_id: unresolvedId,
      provider: 'Meta',
      message_type: 'TEXT',
      direction: 'outbound',
      delivery_status: 'DELIVERED',
      provider_message_id: msgId
    });
    await sheets.webhookEventRepository.registerWebhookEventIdempotent({
      event_id: `META_STATUS_${msgId}_DELIVERED`,
      provider: 'Meta',
      event_type: 'STATUS_UPDATE',
      rawPayloadForHashOnly: { id: msgId, status: 'delivered' }
    });
    await sheets.webhookEventRepository.markWebhookStatus({
      event_id: `META_STATUS_${msgId}_DELIVERED`,
      processing_status: 'FAILED',
      error_code: 'CUSTOMER_IDENTITY_UNRESOLVED'
    });
    await sheets.stagePendingIdentityReconciliation({
      messageEventId: canonicalMsgId,
      provider: 'Meta',
      providerMessageId: msgId,
      fromPhone: '+919822778899',
      eventType: 'STATUS_UPDATE',
      webhookEventId: `META_STATUS_${msgId}_DELIVERED`,
      correlationId: 'CORR-B5',
      nowMs: Date.now() - 60_000
    });

    // Customer arrives later
    const { customer } = await sheets.CrmSheetsService.registerOrUpdateCustomerLead({
      name: 'Reconciled Customer',
      phone: '+919822778899',
      loanCategory: 'Business Loan'
    });

    // 1. Unauthenticated -> 401
    const unauth = await reconcileRoute.POST(
      new Request('https://avani-ai-crm.vercel.app/api/internal/reconcile-identities', { method: 'POST' })
    );
    assert.equal(unauth.status, 401);

    // 2. Wrong Bearer -> 401
    const wrongBearer = await reconcileRoute.POST(
      new Request('https://avani-ai-crm.vercel.app/api/internal/reconcile-identities', {
        method: 'POST',
        headers: { Authorization: 'Bearer wrong_secret_1234567890' }
      })
    );
    assert.equal(wrongBearer.status, 401);

    // 3. Valid RECONCILIATION_CRON_SECRET Bearer -> 200 & reconciles!
    process.env.RECONCILIATION_CRON_SECRET = 'synthetic_recon_cron_secret_5h36_abcdef';
    const okBearer = await reconcileRoute.POST(
      new Request('https://avani-ai-crm.vercel.app/api/internal/reconcile-identities', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${process.env.RECONCILIATION_CRON_SECRET}`
        },
        body: JSON.stringify({ batchLimit: 999, maxAttempts: 99 })
      })
    );
    const body = await okBearer.json();
    assert.equal(okBearer.status, 200);
    assert.equal(body.success, true);
    assert.equal(body.scheduledCronActive, false);
    assert.equal(body.params.batchLimit, 50, 'batchLimit must clamp to max 50');
    assert.equal(body.params.maxAttempts, 10, 'maxAttempts must clamp to max 10');
    assert.equal(body.summary.reconciled, 1);
    assert.equal(body.summary.outboundResent, 0);

    const updatedMsg = await sheets.messageEventRepository.findById(canonicalMsgId);
    assert.equal(updatedMsg.customer_id, customer.customer_id);

    // 4. ADMIN session cookie trigger also succeeds
    const { cookieHeader } = await makeAdminCookieHeader();
    const okAdmin = await reconcileRoute.POST(
      new Request('https://avani-ai-crm.vercel.app/api/internal/reconcile-identities', {
        method: 'POST',
        headers: {
          host: 'avani-ai-crm.vercel.app',
          origin: 'https://avani-ai-crm.vercel.app',
          cookie: cookieHeader
        }
      })
    );
    assert.equal(okAdmin.status, 200);
    assert.equal((await okAdmin.json()).authMethod, 'ADMIN_SESSION');
  });

  it('B5-02: vercel.json does NOT schedule /api/internal/reconcile-identities (zero production cron activation)', () => {
    const vercelCfg = JSON.parse(fs.readFileSync(path.join(ROOT_DIR, 'vercel.json'), 'utf8'));
    const paths = (vercelCfg.crons || []).map((c) => c.path);
    assert.equal(paths.includes('/api/internal/reconcile-identities'), false);
  });

  it('B6-01: Migrated GET /api/webhooks requires ADMIN auth and reads canonical Google Sheets WEBHOOK_EVENTS with zero MongoDB calls', async () => {
    const unauth = await webhooksRoute.GET(new Request('https://avani-ai-crm.vercel.app/api/webhooks'));
    assert.equal(unauth.status, 401);

    await sheets.webhookEventRepository.registerWebhookEventIdempotent({
      event_id: 'CM_INBOUND_TEST_B6',
      provider: 'ChatMitra',
      event_type: 'INBOUND_MESSAGE',
      rawPayloadForHashOnly: { test: true }
    });

    const { cookieHeader } = await makeAdminCookieHeader();
    const res = await webhooksRoute.GET(
      new Request('https://avani-ai-crm.vercel.app/api/webhooks?limit=20', {
        headers: { cookie: cookieHeader }
      })
    );
    const body = await res.json();
    assert.equal(res.status, 200);
    assert.equal(body.success, true);
    assert.equal(body.storageBackend, 'GOOGLE_SHEETS');
    assert.equal(body.recentEvents.length, 1);
    assert.equal(body.recentEvents[0].eventId, 'CM_INBOUND_TEST_B6');
    assert.equal(mongoConnectCalls, 0);
  });

  it('B6-02: All 5 legacy MongoDB routes & ProviderRouter fail closed with ZERO MongoDB/PostgreSQL connection attempts', async () => {
    const { cookieHeader } = await makeAdminCookieHeader();

    // 1. /api/meta-webhook (signed -> 410; unsigned -> 401)
    const metaBody = JSON.stringify({ entry: [] });
    const metaUnauth = await metaLegacyRoute.POST(
      new Request('https://avani-ai-crm.vercel.app/api/meta-webhook', { method: 'POST', body: metaBody })
    );
    assert.equal(metaUnauth.status, 401);
    const metaSig = 'sha256=' + crypto.createHmac('sha256', TEST_META_SECRET).update(metaBody, 'utf8').digest('hex');
    const metaDisabled = await metaLegacyRoute.POST(
      new Request('https://avani-ai-crm.vercel.app/api/meta-webhook', {
        method: 'POST',
        headers: { 'x-hub-signature-256': metaSig },
        body: metaBody
      })
    );
    assert.equal(metaDisabled.status, 410);
    assert.equal((await metaDisabled.json()).error, 'LEGACY_MONGODB_ROUTE_DISABLED');

    // 2. /api/contacts/direct-message
    const dmRes = await directMsgLegacyRoute.POST(
      new Request('https://avani-ai-crm.vercel.app/api/contacts/direct-message', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          host: 'avani-ai-crm.vercel.app',
          origin: 'https://avani-ai-crm.vercel.app',
          cookie: cookieHeader
        },
        body: JSON.stringify({ phone: '+919822112233', message: 'Hi' })
      })
    );
    assert.equal(dmRes.status, 410);

    // 3. /api/broadcasts/send (403 when bulk disabled; 410 even if bulk enabled!)
    const bcast403 = await broadcastLegacyRoute.POST(
      new Request('https://avani-ai-crm.vercel.app/api/broadcasts/send', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          host: 'avani-ai-crm.vercel.app',
          origin: 'https://avani-ai-crm.vercel.app',
          cookie: cookieHeader
        },
        body: JSON.stringify({ phone: '+919822112233' })
      })
    );
    assert.equal(bcast403.status, 403);
    process.env.BULK_BROADCAST_ENABLED = 'true';
    const bcast410 = await broadcastLegacyRoute.POST(
      new Request('https://avani-ai-crm.vercel.app/api/broadcasts/send', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          host: 'avani-ai-crm.vercel.app',
          origin: 'https://avani-ai-crm.vercel.app',
          cookie: cookieHeader
        },
        body: JSON.stringify({ phone: '+919822112233' })
      })
    );
    assert.equal(bcast410.status, 410);

    // 4. /api/callkaro-webhook & 5. /api/vapi-webhook
    const ck410 = await callkaroLegacyRoute.POST(
      new Request('https://avani-ai-crm.vercel.app/api/callkaro-webhook', {
        method: 'POST',
        headers: { Authorization: `Bearer ${TEST_WORKER_SECRET}` },
        body: JSON.stringify({})
      })
    );
    assert.equal(ck410.status, 410);

    const vapi410 = await vapiLegacyRoute.POST(
      new Request('https://avani-ai-crm.vercel.app/api/vapi-webhook', {
        method: 'POST',
        headers: { Authorization: `Bearer ${TEST_WORKER_SECRET}` },
        body: JSON.stringify({})
      })
    );
    assert.equal(vapi410.status, 410);

    // 6. ProviderRouter library direct call fails closed
    const prRes = await ProviderRouter.dispatchMessage({ phone: '+919822112233', name: 'Test', messageText: 'Hi' });
    assert.equal(prRes.success, false);
    assert.equal(prRes.status, 'LEGACY_MONGODB_ROUTE_DISABLED');

    assert.equal(mongoConnectCalls, 0, 'ZERO MongoDB connect attempts permitted');
    assert.equal(postgresCalls, 0, 'ZERO PostgreSQL connect attempts permitted');
  });

  it('B7-01: Read-only buildLegacyMessageMigrationPlan classifies all legacy/canonical/duplicate/collision/manual-review cases without mutating input', () => {
    const snapshot = Object.freeze([
      Object.freeze({
        event_id: 'MSG_META_wamid.CANON_01',
        customer_id: 'CUST-9822000001',
        provider: 'Meta',
        message_type: 'TEXT',
        direction: 'inbound',
        delivery_status: 'RECEIVED',
        provider_message_id: 'wamid.CANON_01',
        event_timestamp: '2026-11-20T01:00:00.000Z'
      }),
      Object.freeze({
        event_id: 'MSG_wamid.LEGACY_CLEAN_01',
        customer_id: 'CUST-9822000001',
        provider: 'Meta',
        message_type: 'TEXT',
        direction: 'outbound',
        delivery_status: 'DELIVERED',
        provider_message_id: 'wamid.LEGACY_CLEAN_01',
        event_timestamp: '2026-11-18T01:00:00.000Z'
      }),
      Object.freeze({
        event_id: 'MSG_wamid.CANON_01',
        customer_id: 'CUST-9822000001',
        provider: 'Meta',
        message_type: 'TEXT',
        direction: 'inbound',
        delivery_status: 'RECEIVED',
        provider_message_id: 'wamid.CANON_01',
        event_timestamp: '2026-11-18T02:00:00.000Z'
      }),
      Object.freeze({
        event_id: 'MSG_shared_999',
        customer_id: 'CUST-9822000001',
        provider: 'Meta',
        message_type: 'TEXT',
        direction: 'inbound',
        delivery_status: 'RECEIVED',
        provider_message_id: 'shared_999',
        event_timestamp: '2026-11-18T03:00:00.000Z'
      }),
      Object.freeze({
        event_id: 'MSG_shared_999_cm',
        customer_id: 'CUST-9822000002',
        provider: 'ChatMitra',
        message_type: 'TEXT',
        direction: 'inbound',
        delivery_status: 'RECEIVED',
        provider_message_id: 'shared_999',
        event_timestamp: '2026-11-18T04:00:00.000Z'
      }),
      Object.freeze({
        event_id: 'MSG_orphan_blank_prov',
        customer_id: 'CUST-9822000003',
        provider: '',
        message_type: 'TEXT',
        direction: 'inbound',
        delivery_status: 'RECEIVED',
        provider_message_id: 'orphan_blank_prov',
        event_timestamp: '2026-11-18T05:00:00.000Z'
      }),
      Object.freeze({
        event_id: 'MSG_unresolved_01',
        customer_id: 'UNRESOLVED_CUSTOMER_META_abc123',
        provider: 'Meta',
        message_type: 'TEXT',
        direction: 'outbound',
        delivery_status: 'DELIVERED',
        provider_message_id: 'unresolved_01',
        event_timestamp: '2026-11-18T06:00:00.000Z'
      })
    ]);

    const plan = sheets.buildLegacyMessageMigrationPlan(snapshot, []);
    assert.equal(plan.dryRunOnly, true);
    assert.equal(plan.totalRowsScanned, 7);
    assert.equal(plan.counts.ALREADY_CANONICAL, 1);
    assert.equal(plan.counts.MIGRATABLE_LEGACY, 1);
    assert.equal(plan.counts.DUPLICATE_OF_CANONICAL, 1);
    assert.equal(plan.counts.CROSS_PROVIDER_COLLISION, 2);
    assert.equal(plan.counts.MANUAL_REVIEW_REQUIRED, 2);
    assert.equal(plan.safeToApplyAutomatically, false);

    assert.equal(plan.plannedRemaps[0].proposedEventId, 'MSG_META_wamid.LEGACY_CLEAN_01');
    assert.equal(plan.rollbackManifest.length, 1);
    assert.equal(plan.rollbackManifest[0].restoreLegacyEventId, 'MSG_wamid.LEGACY_CLEAN_01');

    // Verify ZERO customer IDs or mobile numbers appear in the migration/rollback plan
    const planJson = JSON.stringify(plan);
    assert.equal(planJson.includes('CUST-9822'), false);
    assert.equal(planJson.includes('9822000001'), false);
  });

  it('B7-02: Clean conflict-free snapshot reports deterministic snapshotSha256 and safeToApplyAutomatically=true', () => {
    const cleanRows = [
      {
        event_id: 'MSG_cm_clean_77',
        customer_id: 'CUST-9822000009',
        provider: 'ChatMitra',
        message_type: 'TEXT',
        direction: 'inbound',
        delivery_status: 'RECEIVED',
        provider_message_id: 'cm_clean_77',
        event_timestamp: '2026-11-19T01:00:00.000Z'
      }
    ];
    const p1 = sheets.buildLegacyMessageMigrationPlan(cleanRows);
    const p2 = sheets.buildLegacyMessageMigrationPlan(cleanRows);
    assert.equal(p1.safeToApplyAutomatically, true);
    assert.equal(p1.snapshotSha256.length, 64);
    assert.equal(p1.snapshotSha256, p2.snapshotSha256);
    assert.equal(p1.plannedRemaps[0].proposedEventId, 'MSG_CHATMITRA_cm_clean_77');
  });
});

// Restore global fetch cleanly after module loads (Node test runner exits cleanly)
process.on('beforeExit', () => {
  globalThis.fetch = origFetch;
});
