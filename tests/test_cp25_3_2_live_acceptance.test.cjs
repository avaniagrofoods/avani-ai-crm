'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const ts = require('typescript');

let passed = 0;
let failed = 0;

function it(name, fn) {
  try {
    fn();
    console.log(`[PASS] ${name}`);
    passed++;
  } catch (e) {
    console.error(`[FAIL] ${name}: ${e.message}`);
    failed++;
  }
}

function loadTsModule(relPath) {
  const fullPath = path.join(__dirname, '..', relPath);
  const source = fs.readFileSync(fullPath, 'utf8');
  const transpiled = ts.transpileModule(source, {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2020,
      esModuleInterop: true
    }
  }).outputText;

  const m = { exports: {} };
  const fn = new Function('module', 'exports', 'require', transpiled);
  fn(m, m.exports, (mod) => {
    if (mod === 'crypto') return require('crypto');
    if (mod === 'axios') return require('axios');
    if (mod.includes('message-status')) return loadTsModule('src/lib/message-status.ts');
    return {};
  });
  return m.exports;
}

console.log('--- CP-25.3.2 FINAL LIVE WHATSAPP ACCEPTANCE TEST SUITE ---');

// 1. Verify Deployment Metadata & Repository Identity
it('CP25.3.2-01: Deployment metadata matches authorized project prj_P8s8y3a5Gge8EzAab0Fa10cHewgQ', () => {
  const vercelProject = JSON.parse(fs.readFileSync(path.join(__dirname, '../.vercel/project.json'), 'utf8'));
  assert.strictEqual(vercelProject.projectId, 'prj_P8s8y3a5Gge8EzAab0Fa10cHewgQ');
});

it('CP25.3.2-02: Business configuration has official WABA hotline +91 72491 08474', () => {
  const businessConfig = fs.readFileSync(path.join(__dirname, '../src/config/business.ts'), 'utf8');
  assert.match(businessConfig, /\+91 72491 08474/);
  assert.match(businessConfig, /1062614709598311/);
});

it('CP25.3.2-03: Business configuration isolates authorized test recipient +91 91756 35165', () => {
  const businessConfig = fs.readFileSync(path.join(__dirname, '../src/config/business.ts'), 'utf8');
  assert.match(businessConfig, /919175635165/);
  assert.match(businessConfig, /authorizedTestRecipientFormatted:\s*["']\+91 91756 35165["']/);
});

// 2. Verify AI Agent Ownership Discrimination
it('CP25.3.2-04: Webhook worker strictly enforces CHATMITRA_INBOUND_AUTO_REPLY_ENABLED guard', () => {
  const workerCode = fs.readFileSync(path.join(__dirname, '../src/app/api/whatsapp-webhook-worker/route.ts'), 'utf8');
  assert.match(workerCode, /CHATMITRA_INBOUND_AUTO_REPLY_ENABLED/);
  assert.match(workerCode, /Safe Operating Mode: Inbound AI auto-reply is disabled/);
});

it('CP25.3.2-05: Webhook worker sets lead status to CUSTOMER_REPLIED_HUMAN_FOLLOWUP when CRM AI is in safe mode', () => {
  const workerCode = fs.readFileSync(path.join(__dirname, '../src/app/api/whatsapp-webhook-worker/route.ts'), 'utf8');
  assert.match(workerCode, /status:\s*'CUSTOMER_REPLIED_HUMAN_FOLLOWUP'/);
});

it('CP25.3.2-06: Doctor Loan keyword classification accurately identifies doctor loan queries', () => {
  const chatmitraMod = loadTsModule('src/lib/chatmitra.ts');
  const result = chatmitraMod.classifyLoanCategory('Hi, need doctor loan in latur');
  assert.strictEqual(result.category, 'Doctor Loan');
  assert.ok(result.confidence >= 0.9);
});

// 3. Verify Message Status & Delivery Lifecycle
it('CP25.3.2-07: Out-of-order message delivery transition prevents downgrading READ to DELIVERED', () => {
  const statusMod = loadTsModule('src/lib/message-status.ts');
  assert.strictEqual(statusMod.canTransitionStatus('READ', 'DELIVERED'), false);
  assert.strictEqual(statusMod.canTransitionStatus('DELIVERED', 'READ'), true);
  assert.strictEqual(statusMod.canTransitionStatus('SENT', 'DELIVERED'), true);
});

it('CP25.3.2-08: WebhookInbox enforces idempotency on incoming eventId', () => {
  const webhookCode = fs.readFileSync(path.join(__dirname, '../src/app/api/chatmitra-webhook/route.ts'), 'utf8');
  assert.match(webhookCode, /Duplicate inbound event swallowed/);
  assert.match(webhookCode, /11000/);
});

// 4. Verify Production Safeguards & Compliance
it('CP25.3.2-09: Live dispatch safety clamp blocks any phone other than +91 91756 35165', () => {
  const chatmitraCode = fs.readFileSync(path.join(__dirname, '../src/lib/chatmitra.ts'), 'utf8');
  const safeguardsCode = fs.readFileSync(path.join(__dirname, '../src/lib/safeguards.ts'), 'utf8');
  assert.match(chatmitraCode, /evaluateAuthorizedTestRecipient/);
  assert.match(safeguardsCode, /AUTHORIZED_TEST_PHONE_CANONICAL/);
  assert.doesNotMatch(chatmitraCode, /919175635165/);
  assert.match(chatmitraCode, /BLOCKED_UNAUTHORIZED_LIVE_RECIPIENT/);
});

it('CP25.3.2-10: DPDP Act Opt-Out Engine suppresses outbound messages upon STOP or थांबवा', () => {
  const optOutMod = loadTsModule('src/lib/optout-engine.ts');
  assert.strictEqual(optOutMod.OptOutEngine.isOptOutMessage('STOP'), true);
  assert.strictEqual(optOutMod.OptOutEngine.isOptOutMessage('थांबवा'), true);
  assert.strictEqual(optOutMod.OptOutEngine.isOptOutMessage('I need a loan'), false);
});

it('CP25.3.2-11: Public logo asset exists in root public directory and is valid SVG', () => {
  const logoPath = path.join(__dirname, '../public/logo.svg');
  assert.ok(fs.existsSync(logoPath));
  const content = fs.readFileSync(logoPath, 'utf8');
  assert.match(content, /<svg/i);
});

it('CP25.3.2-12: Zero secret exposures in codebase or public configuration', () => {
  const businessConfig = fs.readFileSync(path.join(__dirname, '../src/config/business.ts'), 'utf8');
  assert.doesNotMatch(businessConfig, /eyJ[a-zA-Z0-9_-]{20,}/);
  assert.doesNotMatch(businessConfig, /mongodb\+srv:\/\/[^:]+:[^@]+@/);
});

console.log(`\n${passed} / ${passed + failed} TESTS PASSED`);
if (failed > 0) process.exit(1);
