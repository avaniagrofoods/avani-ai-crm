/**
 * APR-005E — Focused Security Remediation & Zero-Defect Regression Suite (Project B)
 * Uses synthetic test fixtures ONLY. Zero live network egress. Zero raw secrets.
 */
'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
let passed = 0;
let failed = 0;

async function runTest(name, fn) {
  try {
    await fn();
    passed++;
    console.log(`[PASS] ${name}`);
  } catch (err) {
    failed++;
    console.error(`[FAIL] ${name}: ${err.message}`);
  }
}

function walkFiles(dir, out = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (['node_modules', '.git', '.next'].includes(entry.name)) continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walkFiles(full, out);
    else if (/\.(ts|tsx|js|jsx|cjs|mjs)$/.test(entry.name)) out.push(full);
  }
  return out;
}

async function main() {
  const integrationsSrc = fs.readFileSync(path.join(ROOT, 'src', 'lib', 'integrations.ts'), 'utf8');

  await runTest('T01: integrations.ts removes hardcoded Zapier Catch Hook fallback URL (APR005-F-034)', () => {
    assert.strictEqual(/hooks\.zapier\.com\/hooks\/catch\//i.test(integrationsSrc), false);
    assert.strictEqual(/ZAPIER_WEBHOOK_NOT_CONFIGURED/.test(integrationsSrc), true);
  });

  await runTest('T02: integrations.ts removes hardcoded Pabbly webhook URL literal', () => {
    assert.strictEqual(/hook\.pabbly\.com\/api\/webhook/i.test(integrationsSrc), false);
    assert.strictEqual(/process\.env\.PABBLY_WEBHOOK_URL/.test(integrationsSrc), true);
  });

  await runTest('T03: integrations.ts preserves opt-out suppression, circular-sync prevention & mock_gate', () => {
    assert.strictEqual(/CONTACT_OPTED_OUT/.test(integrationsSrc), true);
    assert.strictEqual(/CIRCULAR_SYNC_PREVENTED/.test(integrationsSrc), true);
    assert.strictEqual(/mode:\s*'mock_gate'/.test(integrationsSrc), true);
  });

  await runTest('T04: leads/trigger/route.ts masks customer phone PII in logs', () => {
    const src = fs.readFileSync(path.join(ROOT, 'src', 'app', 'api', 'leads', 'trigger', 'route.ts'), 'utf8');
    assert.strictEqual(/maskPhoneForLog\(formattedPhone\)/.test(src), true);
    assert.strictEqual(/qualification message for \$\{formattedPhone\}/.test(src), false);
  });

  await runTest('T05: whatsapp-webhook/workflow-handler.ts masks phone PII & omits raw button text in logs', () => {
    const src = fs.readFileSync(path.join(ROOT, 'src', 'app', 'api', 'whatsapp-webhook', 'workflow-handler.ts'), 'utf8');
    assert.strictEqual(/maskPhoneForLog\(phone\)/.test(src), true);
    assert.strictEqual(/normalized phone key: \$\{phone\}/.test(src), false);
    assert.strictEqual(/Unmapped text\/button received: \$\{buttonTitle\}/.test(src), false);
  });

  await runTest('T06: followup-engine.ts masks lead.phone in suppression and idempotency logs', () => {
    const src = fs.readFileSync(path.join(ROOT, 'src', 'lib', 'followup-engine.ts'), 'utf8');
    assert.strictEqual(/maskPhoneForLog\(lead\.phone\)/.test(src), true);
    assert.strictEqual(/\(\$\{lead\.phone\}\)/.test(src), false);
    assert.strictEqual(/already dispatched for \$\{lead\.phone\}/.test(src), false);
  });

  await runTest('T07: .github/workflows/postman-ci.yml enforces least-privilege permissions: contents: read (APR005-F-004)', () => {
    const yml = fs.readFileSync(path.join(ROOT, '.github', 'workflows', 'postman-ci.yml'), 'utf8');
    assert.strictEqual(/permissions:\s*\r?\n\s*contents:\s*read/.test(yml), true);
  });

  await runTest('T08: Zero hardcoded secret/webhook literals across ALL active src/ files', () => {
    const secretPatterns = [
      /\bAIza[0-9A-Za-z_-]{25,}\b/,
      /\bEAA[A-Za-z0-9]{30,}\b/,
      /script\.google\.com\/macros\/s\/AKfycb/i,
      /hooks\.zapier\.com\/hooks\/catch\/\d+\/[A-Za-z0-9]+/i,
      /hook\.pabbly\.com\/api\/webhook/i,
      /hook\.eu\d\.make\.com\/[A-Za-z0-9]{10,}/i,
      /(?:mongodb(?:\+srv)?|postgresql):\/\/[^:\s'"`]+:[^@\s'"`{<$]{4,}@/i,
      /\borg_[A-Za-z0-9_-]{18,}\b/,
      /\bpat-[a-z0-9-]+-[A-Za-z0-9-]{15,}\b/i,
      /\bna2-[A-Za-z0-9-]{15,}\b/i,
      /\beyJ[A-Za-z0-9_-]{12,}\.eyJ[A-Za-z0-9_-]{12,}\.[A-Za-z0-9_-]{10,}/
    ];
    const files = walkFiles(path.join(ROOT, 'src'));
    const hits = [];
    for (const f of files) {
      const txt = fs.readFileSync(f, 'utf8');
      for (const rx of secretPatterns) {
        if (rx.test(txt)) hits.push(`${path.relative(ROOT, f)} matched ${rx}`);
      }
    }
    assert.deepStrictEqual(hits, [], `Unexpected secret/webhook literals found: ${hits.join('; ')}`);
  });

  await runTest('T09: Vapi AI remains permanently RETIRED with zero outbound HTTP calls', () => {
    const src = fs.readFileSync(path.join(ROOT, 'src', 'lib', 'vapi.ts'), 'utf8');
    assert.strictEqual(/VAPI_STATUS\s*=\s*'RETIRED'/.test(src), true);
    assert.strictEqual(/axios|fetch\(/.test(src), false);
  });

  await runTest('T10: OmniDimension calling adapter remains disabled-by-default standby', () => {
    const src = fs.readFileSync(path.join(ROOT, 'src', 'lib', 'calling', 'omnidimension-adapter.ts'), 'utf8');
    assert.strictEqual(/process\.env\.OMNIDIMENSION_LIVE_ENABLED\s*===\s*'true'/.test(src), true);
    assert.strictEqual(/DISABLED_STANDBY/.test(src), true);
  });

  await runTest('T11: Google Sheets CRM client retains zero-MongoDB-fallback architecture', () => {
    const src = fs.readFileSync(path.join(ROOT, 'src', 'lib', 'google-sheets', 'google-sheets-client.ts'), 'utf8');
    assert.strictEqual(/APPS_SCRIPT_GATEWAY/.test(src), true);
    assert.strictEqual(/mongoose|connectToDatabase/.test(src), false);
  });

  await runTest('T12: ChatMitra & Meta webhooks retain fail-closed HMAC timingSafeEqual verification guards', () => {
    const cmRoute = fs.readFileSync(path.join(ROOT, 'src', 'app', 'api', 'chatmitra-webhook', 'route.ts'), 'utf8');
    const cmLib = fs.readFileSync(path.join(ROOT, 'src', 'lib', 'chatmitra.ts'), 'utf8');
    const wa = fs.readFileSync(path.join(ROOT, 'src', 'app', 'api', 'whatsapp-webhook', 'route.ts'), 'utf8');
    assert.strictEqual(/verifyChatMitraSignature/.test(cmRoute), true);
    assert.strictEqual(/timingSafeEqual/.test(cmLib), true);
    assert.strictEqual(/zero hardcoded fallbacks/i.test(wa), true);
  });

  console.log(`\nAPR-005E PROJECT B SECURITY SUITE: ${passed} passed, ${failed} failed`);
  if (failed > 0) process.exit(1);
}

main();
