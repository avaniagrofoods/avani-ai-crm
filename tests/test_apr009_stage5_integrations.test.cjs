/**
 * APR-009 STAGE 5 & STAGE 6 REGRESSION SUITE
 * Verifies:
 *  - Stage 5F: Zapier hardened adapter (mapping, HMAC-SHA256, standby clamp, consent/opt-out, dedupe, retries, inbound webhook)
 *  - Stage 5G: OmniDim canonical Google Sheets CRM handoff WITHOUT enabling legacy MongoDB
 *  - Stage 5H: AVANI AI Agent KB retrieval, classification, compliance guardrails, consent-awareness, human escalation, RBAC
 *  - Stage 5E: Canonical 9-tab Google Sheets schema + repo-wide 0 unguarded MongoDB routes invariant
 *
 * Strictly synthetic offline tests — ZERO production Sheets writes, ZERO live messages!
 */

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const ROOT = path.resolve(__dirname, '..');

function readRel(rel) {
  return fs.readFileSync(path.join(ROOT, rel), 'utf8');
}

function walkRoutes(dir) {
  let out = [];
  for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, ent.name);
    if (ent.isDirectory()) out = out.concat(walkRoutes(full));
    else if (ent.name === 'route.ts') out.push(full);
  }
  return out;
}

const tests = [];
function test(name, fn) { tests.push({ name, fn }); }

// ---- STAGE 5F: ZAPIER INTEGRATION TESTS ----
test('T01 [5F Zapier] Source verifies minimal-PII mapping, HMAC-SHA256 timing-safe verification & standby clamp', () => {
  const src = readRel('src/lib/zapier-integration.ts');
  assert.ok(src.includes('crypto.timingSafeEqual'), 'Must use timingSafeEqual for HMAC verification');
  assert.ok(src.includes("process.env.ZAPIER_ENABLED === 'true' && process.env.PROVIDER_MODE === 'live'"), 'Must clamp live dispatch behind ZAPIER_ENABLED + PROVIDER_MODE=live');
  assert.ok(src.includes('OPTED_OUT_SUPPRESSED'), 'Must suppress opted-out customers');
  assert.ok(src.includes('DUPLICATE_SUPPRESSED'), 'Must suppress duplicate idempotency keys');
  assert.ok(src.includes('mobileLast4'), 'Must minimize PII to last 4 digits on outbound trigger payload');
  assert.ok(src.includes('Math.pow(2, attempt - 1)'), 'Must implement exponential backoff retries');
  assert.ok(src.includes('res.status >= 400 && res.status < 500 && res.status !== 429'), 'Must NOT retry non-retryable 4xx errors');
});

test('T02 [5F Zapier] Inbound /api/zapier-webhook verifies shared secret, HMAC, idempotency & zero MongoDB', () => {
  const src = readRel('src/app/api/zapier-webhook/route.ts');
  assert.ok(src.includes('verifySharedWebhookSecret'), 'POST must require shared webhook secret');
  assert.ok(src.includes('verifyZapierSignature'), 'POST must verify optional HMAC signature');
  assert.ok(src.includes('requireAuth'), 'GET contract catalog must require authentication');
  assert.ok(src.includes('webhookEventRepository.registerWebhookEventIdempotent'), 'Must deduplicate inbound Zapier actions durably');
  assert.ok(src.includes('CrmSheetsService.registerOrUpdateCustomerLead'), 'Must hand off CREATE_ENQUIRY to canonical Google Sheets');
  assert.ok(src.includes('cancelPendingFollowupsForCustomerOrLead'), 'RECORD_CONSENT_OPTOUT must cancel pending follow-ups');
  assert.ok(!src.includes('connectToDatabase'), 'Zapier webhook must NEVER import or call MongoDB');
});

test('T03 [5F DownstreamOrchestrator] Removed unguarded connectToDatabase & wired ZapierIntegration', () => {
  const src = readRel('src/lib/downstream-orchestrator.ts');
  assert.ok(!src.includes('connectToDatabase'), 'DownstreamOrchestrator must NOT call connectToDatabase()');
  assert.ok(src.includes('ZapierIntegration.dispatchTrigger'), 'Must delegate Zapier dispatch to hardened ZapierIntegration');
  assert.ok(src.includes("if (process.env.PROVIDER_MODE !== 'live')"), 'Must gate HubSpot & legacy Sheets sync behind PROVIDER_MODE=live');
});

// ---- STAGE 5G: OMNIDIM CANONICAL CRM HANDOFF TESTS ----
test('T04 [5G OmniDim] Preserves timing-safe GET, shared-secret POST, MongoDB guard & adds canonical Google Sheets handoff', () => {
  const src = readRel('src/app/api/omnidim-webhook/route.ts');
  assert.ok(src.includes('constantTimeEqualStrings(token, VERIFY_TOKEN)'), 'GET verify_token must remain timing-safe');
  assert.ok(src.includes('verifySharedWebhookSecret'), 'POST must verify shared webhook secret');
  assert.ok(src.includes("const legacyMongoEnabled = process.env.LEGACY_MONGODB_ROUTES_ENABLED === 'true'"), 'Must preserve legacy MongoDB gate');
  assert.ok(src.includes('webhookEventRepository.registerWebhookEventIdempotent'), 'Must deduplicate OmniDim webhook retries in Google Sheets');
  assert.ok(src.includes('consentRepository.findByCustomerId'), 'Must check canonical Google Sheets consent before integrations');
  assert.ok(src.includes('CrmSheetsService.registerOrUpdateCustomerLead'), 'Must hand off OmniDim call lead to canonical Google Sheets');
  assert.ok(src.includes("provider: 'OmniDM'"), 'Must log operational metadata under canonical OmniDM provider');
  assert.ok(src.includes('CANONICAL_SHEETS_UNAVAILABLE') && src.includes('status: 503'), 'Must fail retryably (503) without MongoDB fallback if Sheets offline');
  assert.ok(!/recordingUrl\s*=|updateData\.transcript\s*=/.test(src), 'Must preserve Zero-Media-Storage policy (no recordingUrl/transcript stored)');
  assert.ok(src.includes("process.env.OMNIDM_LIVE_ENABLED === 'true' && process.env.PROVIDER_MODE === 'live' && canonicalConsentGranted"), 'Post-call WhatsApp must require live flags AND verified consent');
});

test('T05 [5G OmniDimensionAdapter] Preserves standby-by-default, DND & DPDP consent guards', () => {
  const src = readRel('src/lib/calling/omnidimension-adapter.ts');
  assert.ok(src.includes('BLOCKED_DND'), 'Must block DND/opted-out leads');
  assert.ok(src.includes('BLOCKED_NO_CONSENT'), 'Must block calls without DPDP consent');
  assert.ok(src.includes('DISABLED_STANDBY'), 'Must default to disabled standby mode');
  assert.ok(src.includes('crypto.timingSafeEqual'), 'Must verify webhook HMAC timing-safely');
});

// ---- STAGE 5H: AVANI AI AGENT COMPLIANCE & CRM INTEGRATION TESTS ----
test('T06 [5H AI Agent] Compliance module covers approved KB, classification, prohibited claim filter & autoContactAllowed=false', () => {
  const src = readRel('src/lib/ai-agent-compliance.ts');
  assert.ok(src.includes('APPROVED_KNOWLEDGE_BASE'), 'Must define approved knowledge base');
  assert.ok(src.includes('413512') && src.includes('info@avanifinserv.com'), 'Must include official DEC-003B-06 business contact details');
  assert.ok(src.includes('PROHIBITED_APPROVAL_GUARANTEE'), 'Must block guaranteed approval claims');
  assert.ok(src.includes('PROHIBITED_INVENTED_INTEREST_RATE'), 'Must block invented/promised fixed interest rates');
  assert.ok(src.includes('PROHIBITED_INVENTED_ELIGIBILITY'), 'Must block invented pre-approved eligibility claims');
  assert.ok(src.includes('PROHIBITED_FINANCIAL_COMMITMENT'), 'Must block unauthorized financial commitments');
  assert.ok(src.includes('autoContactAllowed: false'), 'Agent must NEVER initiate customer contact autonomously');
  assert.ok(src.includes('OPT_OUT_OR_DECLINE') && src.includes('consentSuppressed: true'), 'Must suppress outbound communication on opt-out/withdrawn consent');
  assert.ok(src.includes('recoveredFromError: true'), 'Must provide safe error recovery');
});

test('T07 [5H AI Agent Route] /api/ai-agent/assist enforces requireAuth, input validation & zero MongoDB', () => {
  const src = readRel('src/app/api/ai-agent/assist/route.ts');
  assert.ok(src.includes('requireAuth(req)'), 'GET and POST must require authenticated CRM session');
  assert.ok(src.includes('handleCrmAssistedTurn'), 'Must delegate through compliance-guarded turn handler');
  assert.ok(src.includes('followupRepository.createOrUpdateFollowup'), 'Must log optional follow-up recommendations to canonical Google Sheets');
  assert.ok(!src.includes('connectToDatabase'), 'AI Agent route must NEVER touch MongoDB');
});

// ---- STAGE 5E & REPO-WIDE SECURITY INVARIANTS ----
test('T08 [5E Google Sheets] Canonical 9-tab schema completeness verified', () => {
  const schema = readRel('src/lib/google-sheets/sheet-schema.ts');
  const requiredTabs = [
    'CUSTOMERS',
    'LEADS',
    'APPLICATIONS',
    'FOLLOWUPS',
    'CONSENTS',
    'MESSAGE_EVENTS',
    'WEBHOOK_EVENTS',
    'ADVISORS',
    'SYSTEM_CONFIG'
  ];
  for (const tab of requiredTabs) {
    assert.ok(schema.includes(tab), `Canonical tab ${tab} must exist in sheet-schema.ts`);
  }
});

test('T09 [Repo-Wide Invariant] Zero unguarded connectToDatabase() routes across ALL Project B API routes', () => {
  const routes = walkRoutes(path.join(ROOT, 'src', 'app', 'api'));
  assert.ok(routes.length >= 50, `Expected >= 50 API routes (48 baseline + zapier-webhook + ai-agent/assist), found ${routes.length}`);
  const unguarded = [];
  for (const r of routes) {
    const content = fs.readFileSync(r, 'utf8');
    if (content.includes('connectToDatabase(') && !content.includes('LEGACY_MONGODB_ROUTES_ENABLED')) {
      unguarded.push(path.relative(ROOT, r));
    }
  }
  assert.deepStrictEqual(unguarded, [], `Unguarded MongoDB routes found: ${unguarded.join(', ')}`);
});

test('T10 [Zero-Secret Invariant] New Stage 5 files contain zero hardcoded credentials or raw webhooks', () => {
  const filesToScan = [
    'src/lib/zapier-integration.ts',
    'src/app/api/zapier-webhook/route.ts',
    'src/lib/downstream-orchestrator.ts',
    'src/app/api/omnidim-webhook/route.ts',
    'src/lib/ai-agent-compliance.ts',
    'src/app/api/ai-agent/assist/route.ts'
  ];
  const rx = [
    /mongodb\+srv:\/\/[^:\s'"]+:(?!REDACTED|<|\[|\$\{|process\.env)[^@\s'"]+@[a-z0-9.-]+\.mongodb\.net/i,
    /\bAIza[0-9A-Za-z_-]{35}\b/,
    /\bEAA[A-Za-z0-9]{40,}\b/,
    /\bhooks\.zapier\.com\/hooks\/catch\/\d+\/[a-z0-9]{5,}\b/i
  ];
  for (const rel of filesToScan) {
    const txt = readRel(rel);
    for (const p of rx) {
      assert.strictEqual(p.test(txt), false, `Potential secret pattern found in ${rel}`);
    }
  }
});

(async () => {
  let passed = 0;
  let failed = 0;
  for (const t of tests) {
    try {
      await t.fn();
      console.log(`PASS: ${t.name}`);
      passed++;
    } catch (err) {
      console.error(`FAIL: ${t.name}\n  ${err.message}`);
      failed++;
    }
  }
  console.log(`\nAPR-009 STAGE 5 SUITE SUMMARY: ${passed}/${tests.length} PASS, ${failed} FAIL`);
  process.exit(failed > 0 ? 1 : 0);
})();
