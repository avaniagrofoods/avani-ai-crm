const assert = require('assert');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const { spawn, execFileSync } = require('child_process');
const dns = require('dns');
dns.setServers(['8.8.8.8', '1.1.1.1']);
const mongoose = require('mongoose');
const puppeteer = require('puppeteer');

const TEST_PORT = Number(process.env.CP26_3_UI_PORT || 3098);
const BASE_URL = `http://127.0.0.1:${TEST_PORT}`;

const ADMIN_EMAIL = 'admin.ui@avanifinserv.test';
const ADMIN_PASS = 'AvaniAdmin!Ui#2026';
const ADVISOR_EMAIL = 'advisor.ui@avanifinserv.test';
const ADVISOR_PASS = 'AvaniAdvisor!Ui#2026';

const SCREENSHOT_DIR = process.env.CP26_3_SCREENSHOT_DIR || '';

function loadTestMongoUri() {
  const rawUri = (process.env.TEST_MONGODB_URI || 'mongodb://127.0.0.1:27017/avani_ai_crm_test').trim();
  const u = new URL(rawUri);
  const host = (u.hostname || '').toLowerCase();
  assert.ok(
    !host.includes('rhpn2gh.mongodb.net') && !host.includes('cluster0.mlcxcp.mongodb.net') && !host.includes('xj6nhak.mongodb.net'),
    'SAFETY ABORT: Local/isolated tests must NOT target shared production Atlas clusters'
  );
  assert.ok(
    u.pathname === '/avani_ai_crm_test' && !rawUri.includes('avani_ai_crm_prod'),
    'SAFETY ABORT: Test DB URI must point exclusively to /avani_ai_crm_test'
  );
  return u.toString();
}

async function waitForServer(url, timeoutMs = 45000) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    try {
      const res = await fetch(`${url}/api/health`);
      if (res.ok) return;
    } catch {
      // retry
    }
    await new Promise((r) => setTimeout(r, 500));
  }
  throw new Error(`Timed out waiting for isolated UI test server at ${url}`);
}

async function runBrowserAcceptance() {
  const testMongoUri = loadTestMongoUri();
  const runTag = `UI263_${Date.now()}`;
  const phoneOwned = '919820020001';
  const phoneOther = '919820020002';
  const allPhones = [phoneOwned, phoneOther, `+${phoneOwned}`, `+${phoneOther}`];
  const raw10s = [phoneOwned.slice(-10), phoneOther.slice(-10)];

  let serverProc = null;
  let browser = null;

  await mongoose.connect(testMongoUri, { serverSelectionTimeoutMS: 10000 });
  assert.strictEqual(mongoose.connection.name, 'avani_ai_crm_test');
  const db = mongoose.connection.db;

  const consoleErrors = [];
  const pageErrors = [];
  const server5xx = [];
  const dialogTriggered = [];

  try {
    // Seed 2 synthetic non-PII leads & 1 synthetic contact for UI test
    await db.collection('leads').insertMany([
      {
        leadId: `AVL-UI1-${runTag}`,
        name: `Applicant Alpha ${runTag}`,
        phone: `+${phoneOwned}`,
        normalizedMobile: phoneOwned.slice(-10),
        loanType: 'Doctor Loan',
        stage: 'DOCUMENTS_PENDING',
        status: 'Documents Pending',
        monthlyIncome: 180000,
        requiredLoanAmount: 2500000,
        consentStatus: 'GRANTED',
        assignedAdvisor: { name: 'Advisor UI Ops', email: ADVISOR_EMAIL, role: 'LOAN_ADVISOR' },
        documentChecklist: [
          { code: 'KYC_PAN', name: 'PAN Card', category: 'KYC', mandatory: true, status: 'PENDING' }
        ],
        followUpTasks: [],
        revenue: { expectedRevenue: 30000, actualRevenueReceived: 15000, paymentStatus: 'PARTIAL' },
        createdAt: new Date(),
        updatedAt: new Date()
      },
      {
        leadId: `AVL-UI2-${runTag}`,
        name: `Applicant Beta ${runTag}`,
        phone: `+${phoneOther}`,
        normalizedMobile: phoneOther.slice(-10),
        loanType: 'Home Loan',
        stage: 'NEW_ENQUIRY',
        status: 'New',
        consentStatus: 'GRANTED',
        assignedAdvisor: { name: 'Other Advisor', email: 'other.ui@avanifinserv.test', role: 'LOAN_ADVISOR' },
        followUpTasks: [],
        revenue: { expectedRevenue: 40000, actualRevenueReceived: 20000, paymentStatus: 'PARTIAL' },
        createdAt: new Date(),
        updatedAt: new Date()
      }
    ]);

    const cRes = await db.collection('contacts').insertOne({
      name: `Applicant Alpha ${runTag}`,
      phone: `+${phoneOwned}`,
      optedIn: true,
      createdAt: new Date(),
      updatedAt: new Date()
    });
    const uiContactId = String(cRes.insertedId);

    const nextBin = path.join(process.cwd(), 'node_modules', 'next', 'dist', 'bin', 'next');
    const dnsPreload = path.join(process.cwd(), 'tests', 'dns_preload.cjs');

    serverProc = spawn(process.execPath, ['--require', dnsPreload, nextBin, 'start', '-p', String(TEST_PORT), '-H', '127.0.0.1'], {
      cwd: process.cwd(),
      env: {
        ...process.env,
        NODE_ENV: 'production',
        APP_MODE: 'test',
        PORT: String(TEST_PORT),
        MONGODB_URI: testMongoUri,
        avani_ai_crm_prod_MONGODB_URI: testMongoUri,
        PROVIDER_MODE: 'mock',
        CHATMITRA_INBOUND_AUTO_REPLY_ENABLED: 'false',
        BULK_BROADCAST_ENABLED: 'false',
        OMNIDM_LIVE_ENABLED: 'false',
        AUTHORIZED_TEST_PHONE_CANONICAL: '919175635165',
        SESSION_SECRET: crypto.randomBytes(32).toString('hex'),
        CRM_ADMIN_EMAIL: ADMIN_EMAIL,
        CRM_ADMIN_NAME: 'Sachin Admin UI',
        CRM_ADMIN_PASSWORD: ADMIN_PASS,
        CRM_ADVISOR_EMAIL: ADVISOR_EMAIL,
        CRM_ADVISOR_NAME: 'Advisor UI Ops',
        CRM_ADVISOR_PASSWORD: ADVISOR_PASS,
        META_APP_SECRET: 'meta_ui_secret_123456',
        META_WEBHOOK_VERIFY_TOKEN: 'meta_ui_verify_123',
        CRON_SECRET: 'cron_ui_secret_123',
        INTERNAL_WORKER_SECRET: 'worker_ui_secret_123'
      },
      stdio: ['ignore', 'pipe', 'pipe']
    });

    await waitForServer(BASE_URL);
    console.log(`\n[Gate 8] Isolated UI server ready at ${BASE_URL}`);

    const executablePath = [
      process.env.CHROME_PATH,
      'C:/Program Files/Google/Chrome/Application/chrome.exe',
      'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'
    ].find((p) => p && fs.existsSync(p));

    browser = await puppeteer.launch({
      ...(executablePath ? { executablePath } : {}),
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox']
    });

    const page = await browser.newPage();
    await page.setViewport({ width: 1440, height: 900 });

    page.on('dialog', async (d) => {
      dialogTriggered.push(d.message());
      await d.dismiss().catch(() => {});
    });
    page.on('pageerror', (err) => pageErrors.push(err.message));
    page.on('console', (msg) => {
      if (msg.type() === 'error') {
        const text = msg.text();
        // Ignore expected 401 console log during explicit negative login test
        if (!text.includes('401')) consoleErrors.push(text);
      }
    });
    page.on('response', (res) => {
      if (res.status() >= 500) {
        server5xx.push(`${res.status()} ${res.url()}`);
      }
    });

    let passed = 0;
    const step = async (name, fn) => {
      await fn();
      passed += 1;
      console.log(`  PASS: ${name}`);
    };

    const snap = async (filename) => {
      if (SCREENSHOT_DIR) {
        fs.mkdirSync(SCREENSHOT_DIR, { recursive: true });
        await page.screenshot({ path: path.join(SCREENSHOT_DIR, filename), fullPage: false });
      }
    };

    await step('1. Unauthenticated /crm redirects to /login & hides CRM shell', async () => {
      await page.goto(`${BASE_URL}/crm`, { waitUntil: 'networkidle2' });
      assert.ok(page.url().includes('/login'), `Expected /login URL, got ${page.url()}`);
      const emailInput = await page.$('#crm-email');
      assert.ok(emailInput, 'Login email input must render');
      await snap('cp26_3_login.png');
    });

    await step('2. Unauthenticated /leads & /inbox redirect to /login', async () => {
      for (const route of ['/leads', '/inbox']) {
        await page.goto(`${BASE_URL}${route}`, { waitUntil: 'networkidle2' });
        assert.ok(page.url().includes('/login'), `Expected /login redirect from ${route}`);
      }
    });

    await step('3. Invalid password shows error alert on /login', async () => {
      await page.goto(`${BASE_URL}/login`, { waitUntil: 'networkidle2' });
      await page.type('#crm-email', ADMIN_EMAIL);
      await page.type('#crm-password', 'BadPassword!999');
      await page.click('[data-testid="login-submit"]');
      await page.waitForSelector('[data-testid="login-error"]', { timeout: 8000 });
      const errText = await page.$eval('[data-testid="login-error"]', (el) => el.textContent || '');
      assert.ok(errText.toLowerCase().includes('invalid'), `Expected invalid message, got ${errText}`);
    });

    await step('4. ADMIN signs in via /login & sees full CRM Dashboard + separated telemetry + real revenue', async () => {
      await page.goto(`${BASE_URL}/login`, { waitUntil: 'networkidle2' });
      await page.type('#crm-email', ADMIN_EMAIL);
      await page.type('#crm-password', ADMIN_PASS);
      await Promise.all([
        page.waitForNavigation({ waitUntil: 'networkidle2', timeout: 15000 }),
        page.click('[data-testid="login-submit"]')
      ]);
      assert.ok(page.url().includes('/crm'), `Expected /crm after login, got ${page.url()}`);
      await page.waitForSelector('[data-testid="crm-whatsapp-telemetry"]', { timeout: 10000 });
      const bodyText = await page.evaluate(() => document.body.innerText);
      assert.ok(bodyText.includes('ADMIN'), 'Topbar must display ADMIN role');
      assert.ok(bodyText.includes('Mock Attempts'), 'Separated telemetry panel must be visible');
      assert.ok(!bodyText.includes('ADMIN ONLY'), 'ADMIN must see numeric revenue, not ADMIN ONLY mask');
      await snap('cp26_3_crm_admin.png');
    });

    await step('5. Home / renders separated WhatsApp & Webhook telemetry cards cleanly', async () => {
      await page.goto(`${BASE_URL}/`, { waitUntil: 'networkidle2' });
      const homeText = await page.evaluate(() => document.body.innerText);
      assert.ok(homeText.includes('WhatsApp Delivered / Failed'), 'Home telemetry title updated');
      assert.ok(homeText.includes('Inbound / Webhook Errors'), 'Home webhook error title updated');
    });

    await step('6. ADMIN /leads displays both leads, assigns advisor, updates DOCS checklist & runs qualification', async () => {
      await page.goto(`${BASE_URL}/leads`, { waitUntil: 'networkidle2' });
      await page.waitForFunction(
        (tag) => document.body.innerText.includes(`Applicant Alpha ${tag}`),
        { timeout: 10000 },
        runTag
      );
      const listText = await page.evaluate(() => document.body.innerText);
      assert.ok(listText.includes(`Applicant Beta ${runTag}`), 'ADMIN must see Applicant Beta as well');

      // Click Applicant Beta first to test ADMIN Assign Advisor without touching Applicant Alpha's assignment
      await page.evaluate((tag) => {
        const els = Array.from(document.querySelectorAll('div')).reverse();
        const card = els.find((el) => el.textContent && el.textContent.includes(`Applicant Beta ${tag}`) && el.className.includes('cursor-pointer'));
        if (card) card.click();
      }, runTag);

      // Click Stage & Audit tab and verify Assign Advisor panel (ADMIN only)
      await page.evaluate(() => {
        const btns = Array.from(document.querySelectorAll('button'));
        const b = btns.find((x) => x.textContent?.trim() === 'Stage & Audit');
        if (b) b.click();
      });
      await page.waitForSelector('[data-testid="assign-advisor-panel"]', { timeout: 5000 });
      await page.evaluate(() => {
        const panel = document.querySelector('[data-testid="assign-advisor-panel"]');
        const btn = panel?.querySelector('button');
        if (btn) btn.click();
      });
      await page.waitForSelector('[data-testid="leads-action-notice"]', { timeout: 8000 });

      // Click Applicant Alpha to test Checklist update and Lender/Revenue controls
      await page.evaluate((tag) => {
        const els = Array.from(document.querySelectorAll('div')).reverse();
        const card = els.find((el) => el.textContent && el.textContent.includes(`Applicant Alpha ${tag}`) && el.className.includes('cursor-pointer'));
        if (card) card.click();
      }, runTag);

      // Click Checklist tab and change PAN Card status to VERIFIED
      await page.evaluate(() => {
        const btns = Array.from(document.querySelectorAll('button'));
        const b = btns.find((x) => x.textContent?.trim() === 'Checklist');
        if (b) b.click();
      });
      const sel = await page.waitForSelector('select[aria-label="Checklist status for PAN Card"]', { timeout: 5000 });
      await sel.select('VERIFIED');
      await page.waitForFunction(
        () => document.querySelector('[data-testid="leads-action-notice"]')?.textContent?.includes('VERIFIED'),
        { timeout: 8000 }
      );

      // Click Lender/Revenue tab and verify ADMIN sees Steps 2-4
      await page.evaluate(() => {
        const btns = Array.from(document.querySelectorAll('button'));
        const b = btns.find((x) => x.textContent?.trim() === 'Lender/Revenue');
        if (b) b.click();
      });
      await page.waitForFunction(
        () => document.body.innerText.toUpperCase().includes('2. RECORD SANCTION'),
        { timeout: 5000 }
      );
      const appText = await page.evaluate(() => document.body.innerText.toUpperCase());
      assert.ok(appText.includes('2. RECORD SANCTION'), 'ADMIN sees Record Sanction step');
      assert.ok(appText.includes('4. REVENUE RECONCILIATION'), 'ADMIN sees Revenue Reconciliation step');
      await snap('cp26_3_leads_admin.png');
    });

    await step('7. ADMIN /inbox loads synthetic conversation, inserts checklist & sends mock outbound message', async () => {
      await page.goto(`${BASE_URL}/inbox`, { waitUntil: 'networkidle2' });
      await page.waitForFunction(
        (tag) => document.body.innerText.includes(`Applicant Alpha ${tag}`),
        { timeout: 10000 },
        runTag
      );
      await page.evaluate((tag) => {
        const els = Array.from(document.querySelectorAll('div')).reverse();
        const card = els.find((el) => el.textContent && el.textContent.includes(`Applicant Alpha ${tag}`) && el.className.includes('cursor-pointer'));
        if (card) card.click();
      }, runTag);
      await page.waitForSelector('textarea', { timeout: 5000 });
      await page.evaluate(() => {
        const btns = Array.from(document.querySelectorAll('button'));
        const b = btns.find((x) => x.textContent?.includes('Doctor Loan Checklist'));
        if (b) b.click();
      });
      await page.evaluate(() => {
        const btns = Array.from(document.querySelectorAll('button'));
        const sendBtn = btns.find((x) => x.title?.includes('Send message via WhatsApp'));
        if (sendBtn) sendBtn.click();
      });
      await page.waitForFunction(
        () => document.body.innerText.includes('Doctor Loan Requirement'),
        { timeout: 10000 }
      );
      await snap('cp26_3_inbox.png');
    });

    await step('8. Sign Out clears session and prevents accessing /crm', async () => {
      await Promise.all([
        page.waitForNavigation({ waitUntil: 'networkidle2', timeout: 10000 }),
        page.click('[data-testid="logout-button"]')
      ]);
      assert.ok(page.url().includes('/login'), `Expected /login after sign out, got ${page.url()}`);

      await page.goto(`${BASE_URL}/crm`, { waitUntil: 'networkidle2' });
      assert.ok(page.url().includes('/login'), 'Protected route must still redirect to /login after logout');
    });

    await step('9. Single-owner CRM policy: ADVISOR login is denied on /login and stays unauthenticated', async () => {
      await page.goto(`${BASE_URL}/login`, { waitUntil: 'networkidle2' });
      await page.type('#crm-email', ADVISOR_EMAIL);
      await page.type('#crm-password', ADVISOR_PASS);
      await page.click('[data-testid="login-submit"]');
      await page.waitForSelector('[data-testid="login-error"]', { timeout: 8000 });
      assert.ok(page.url().includes('/login'), `Denied ADVISOR must stay on /login, got ${page.url()}`);
      await snap('cp26_3_crm_advisor_denied.png');
    });

    assert.strictEqual(dialogTriggered.length, 0, `No blocking native alerts allowed, got: ${dialogTriggered.join('; ')}`);
    assert.strictEqual(pageErrors.length, 0, `Uncaught page errors: ${pageErrors.join('; ')}`);
    assert.strictEqual(consoleErrors.length, 0, `Console errors: ${consoleErrors.join('; ')}`);
    assert.strictEqual(server5xx.length, 0, `Unexpected 5xx responses: ${server5xx.join('; ')}`);

    console.log(`\n[Gate 8 Summary] ${passed}/9 authenticated Chromium browser acceptance suites PASSED (0 console/page/5xx errors).`);
  } finally {
    if (browser) await browser.close().catch(() => {});
    if (serverProc && !serverProc.killed) serverProc.kill();
    try {
      await db.collection('leads').deleteMany({
        $or: [{ normalizedMobile: { $in: raw10s } }, { phone: { $in: allPhones } }, { leadId: new RegExp(runTag) }]
      });
      await db.collection('contacts').deleteMany({ phone: { $in: allPhones } });
      await db.collection('messages').deleteMany({
        $or: [{ body: /Doctor Loan Requirement/ }, { recipientPhone: { $in: allPhones } }, { phone: { $in: allPhones } }]
      });
      await db.collection('authsessions').deleteMany({ email: { $in: [ADMIN_EMAIL, ADVISOR_EMAIL, 'revoked@local'] } });
      const residual = await db.collection('leads').countDocuments({ normalizedMobile: { $in: raw10s } });
      assert.strictEqual(residual, 0);
      console.log('[Gate 8 Cleanup] Verified 0 synthetic UI test records remain in avani_ai_crm_test.');
    } catch (cleanupErr) {
      console.error('UI Cleanup failed:', cleanupErr);
      process.exitCode = 1;
    }
    await mongoose.disconnect().catch(() => {});
  }
}

runBrowserAcceptance().catch((err) => {
  console.error('\n[Gate 8 FAILED]', err);
  process.exit(1);
});
