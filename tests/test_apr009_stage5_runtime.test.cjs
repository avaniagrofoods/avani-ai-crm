/**
 * APR-009 STAGE 5 RUNTIME EXECUTION TESTS (Synthetic Offline Only)
 * Compiles TypeScript modules in-memory with local `typescript` compiler and executes:
 *  - ZapierIntegration: HMAC signing/verification, minimal-PII field mapping, standby clamp,
 *    opt-out suppression, idempotent duplicate suppression, exponential retry (503 -> 200), no-retry on 400
 *  - AVANI AI Agent Compliance: approved KB retrieval, enquiry classification, prohibited claims blocker,
 *    consent-suppressed turn, follow-up recommendation (autoContactAllowed === false), human escalation
 */

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const ts = require('typescript');

const ROOT = path.resolve(__dirname, '..');

function loadTsModule(relPath, customMocks = {}) {
  const fullPath = path.join(ROOT, relPath);
  const src = fs.readFileSync(fullPath, 'utf8');
  const transpiled = ts.transpileModule(src, {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2022,
      esModuleInterop: true
    }
  }).outputText;

  const mod = { exports: {} };
  const localRequire = (spec) => {
    if (customMocks[spec]) return customMocks[spec];
    if (spec.startsWith('./') || spec.startsWith('../')) {
      const resolvedBase = path.resolve(path.dirname(fullPath), spec);
      if (fs.existsSync(resolvedBase + '.ts')) {
        return loadTsModule(path.relative(ROOT, resolvedBase + '.ts'), customMocks);
      }
      if (fs.existsSync(resolvedBase)) {
        return require(resolvedBase);
      }
    }
    return require(spec);
  };
  const fn = new Function('exports', 'require', 'module', '__filename', '__dirname', transpiled);
  fn(mod.exports, localRequire, mod, fullPath, path.dirname(fullPath));
  return mod.exports;
}

const tests = [];
function test(name, fn) { tests.push({ name, fn }); }

const zapier = loadTsModule('src/lib/zapier-integration.ts', {
  './safeguards': { maskPhoneForLog: (p) => `******${String(p || '').slice(-4)}` }
});

const aiCompliance = loadTsModule('src/lib/ai-agent-compliance.ts', {
  './ai-agent': {
    ADVISOR_CONTACT: { name: 'Sachin Shinde', role: 'Founder & Chief Loan Advisor', phone: '+91 72491 08474', website: 'https://www.avanifinserv.com/' },
    ADVISORY_DISCLAIMER: 'AVANI LOAN SERVICES is an authorized loan advisory and consultancy firm and does NOT act as a direct lender or bank.',
    CANONICAL_LOAN_PRODUCTS: ['Personal Loan', 'Business Loan', 'Doctor Loan', 'Home Loan', 'Mortgage Loan / LAP', 'Education Loan — India', 'Education Loan — Global Studies', 'School Funding', 'College Funding'],
    AgentEngine: {
      processMessage: async (_conv, text) => ({
        nextQuestion: text.includes('guarantee')
          ? 'You are guaranteed approval with a fixed interest rate of 7.5%.' // deliberate unsafe draft to test guardrail!
          : 'Thank you for sharing your enquiry with AVANI LOAN SERVICES.',
        updatedState: 'COLLECT_FULL_NAME'
      }),
      createAuditRecord: (p) => ({ ...p, timestamp: new Date().toISOString() }),
      prepareAdvisorHandoffNotes: (ctx) => ({ assignedAdvisor: 'Sachin Shinde', contextKeys: Object.keys(ctx || {}) })
    }
  }
});

test('RT01 [Zapier] HMAC-SHA256 signing & timing-safe verification pass valid and reject tampered', () => {
  const secret = 'synthetic_test_secret_32_chars_min_ok';
  const body = JSON.stringify({ hello: 'avani' });
  const sig = zapier.signZapierPayload(body, secret);
  assert.strictEqual(zapier.verifyZapierSignature(body, `sha256=${sig}`, secret), true);
  assert.strictEqual(zapier.verifyZapierSignature(body + 'x', `sha256=${sig}`, secret), false);
  assert.strictEqual(zapier.verifyZapierSignature(body, 'invalid', secret), false);
});

test('RT02 [Zapier] Minimal-PII payload mapping masks phone to last 4 digits only', () => {
  const mapped = zapier.mapLeadToZapierTriggerPayload({
    eventId: 'EVT-SYN-001',
    eventType: 'LEAD_CREATED',
    leadId: 'LEAD-SYN-001',
    data: { fullName: 'Test Applicant', phone: '+919999912345', city: 'Latur', loanProduct: 'Home Loan', requestedAmount: 2500000 }
  });
  assert.strictEqual(mapped.lead.mobileLast4, '2345');
  assert.strictEqual(JSON.stringify(mapped).includes('9999912345'), false, 'Full phone must not leak in trigger payload');
  assert.ok(mapped.idempotencyKey.startsWith('zap_lead_created_'));
});

test('RT03 [Zapier] Fail-closed standby clamp blocks outbound HTTP when ZAPIER_ENABLED not true', async () => {
  zapier.ZapierIntegration.clearLocalIdempotencyCacheForTests();
  let calls = 0;
  const res = await zapier.ZapierIntegration.dispatchTrigger(
    { eventId: 'EVT-STANDBY', eventType: 'LEAD_CREATED', leadId: 'LEAD-1', data: { name: 'Synthetic', phone: '9999900001' } },
    { fetchImpl: async () => { calls++; return { ok: true, status: 200 }; } }
  );
  assert.strictEqual(res.dispatched, false);
  assert.strictEqual(res.status, 'STANDBY_NOT_ACTIVATED');
  assert.strictEqual(calls, 0);
});

test('RT04 [Zapier] Suppresses opted-out leads & duplicates idempotently, retries 503->200, never retries 400', async () => {
  zapier.ZapierIntegration.clearLocalIdempotencyCacheForTests();

  // Opted-out suppression
  const optRes = await zapier.ZapierIntegration.dispatchTrigger(
    { eventId: 'EVT-OPT', eventType: 'LEAD_CREATED', leadId: 'LEAD-OPT', isOptedOut: true, data: { phone: '9999900002' } },
    { forceLiveForTest: true, webhookUrlOverride: 'https://synthetic.local/hook', baseDelayMs: 0 }
  );
  assert.strictEqual(optRes.status, 'OPTED_OUT_SUPPRESSED');

  // 503 -> 200 retry success + duplicate suppression on replay
  let attempts = 0;
  const retryFetch = async () => {
    attempts++;
    return attempts === 1 ? { ok: false, status: 503 } : { ok: true, status: 200 };
  };
  const okRes = await zapier.ZapierIntegration.dispatchTrigger(
    { eventId: 'EVT-RETRY', eventType: 'LEAD_QUALIFIED', leadId: 'LEAD-R1', data: { phone: '9999900003' } },
    { forceLiveForTest: true, webhookUrlOverride: 'https://synthetic.local/hook', fetchImpl: retryFetch, baseDelayMs: 1 }
  );
  assert.strictEqual(okRes.dispatched, true);
  assert.strictEqual(okRes.attempts, 2);

  const dupRes = await zapier.ZapierIntegration.dispatchTrigger(
    { eventId: 'EVT-RETRY', eventType: 'LEAD_QUALIFIED', leadId: 'LEAD-R1', data: { phone: '9999900003' } },
    { forceLiveForTest: true, webhookUrlOverride: 'https://synthetic.local/hook', fetchImpl: retryFetch, baseDelayMs: 1 }
  );
  assert.strictEqual(dupRes.status, 'DUPLICATE_SUPPRESSED');
  assert.strictEqual(attempts, 2);

  // 400 non-retryable
  let badCalls = 0;
  const badRes = await zapier.ZapierIntegration.dispatchTrigger(
    { eventId: 'EVT-400', eventType: 'ADVISOR_HANDOFF', leadId: 'LEAD-400', data: { phone: '9999900004' } },
    { forceLiveForTest: true, webhookUrlOverride: 'https://synthetic.local/hook', fetchImpl: async () => { badCalls++; return { ok: false, status: 400 }; }, baseDelayMs: 1 }
  );
  assert.strictEqual(badRes.status, 'FAILED');
  assert.strictEqual(badCalls, 1, '400 client errors must NOT be retried');
});

test('RT05 [AI Agent] Guardrails block guaranteed approval & invented interest rate and append advisory disclaimer', () => {
  const checked = aiCompliance.enforceComplianceGuardrails(
    'Congratulations! You are guaranteed approval with a fixed interest rate of 7.25% and we commit to sanction today.'
  );
  assert.ok(checked.violationsBlocked.includes('PROHIBITED_APPROVAL_GUARANTEE'));
  assert.ok(checked.violationsBlocked.includes('PROHIBITED_INVENTED_INTEREST_RATE'));
  assert.ok(checked.violationsBlocked.includes('PROHIBITED_FINANCIAL_COMMITMENT'));
  assert.strictEqual(checked.disclaimerAppended, true);
  assert.ok(checked.safeResponse.includes('NOT act as a direct lender'));
});

test('RT06 [AI Agent] Knowledge retrieval, enquiry classification, consent suppression & autoContactAllowed=false', async () => {
  const kb = aiCompliance.retrieveApprovedKnowledge('I need a doctor loan for my clinic');
  assert.strictEqual(kb[0].id, 'KB-DOCTOR');

  assert.strictEqual(aiCompliance.classifyCustomerEnquiry('Please connect me to advisor Sachin Shinde'), 'HUMAN_ESCALATION');
  assert.strictEqual(aiCompliance.classifyCustomerEnquiry('Can you guarantee 100% approval?'), 'PROHIBITED_COMMITMENT_QUERY');
  assert.strictEqual(aiCompliance.classifyCustomerEnquiry('STOP do not contact me'), 'OPT_OUT_OR_DECLINE');

  // Opted-out / withdrawn consent suppresses reply
  const suppressed = await aiCompliance.handleCrmAssistedTurn({
    text: 'I want a home loan',
    consentStatus: 'WITHDRAWN'
  });
  assert.strictEqual(suppressed.consentSuppressed, true);
  assert.strictEqual(suppressed.autoContactAllowed, false);

  // Guaranteed-approval query gets scrubbed & escalated to human advisor without auto-contact
  const guarded = await aiCompliance.handleCrmAssistedTurn({
    text: 'Can you guarantee approval for my business loan?',
    consentStatus: 'GRANTED'
  });
  assert.strictEqual(guarded.autoContactAllowed, false);
  assert.strictEqual(guarded.followupRecommendation.requiresHumanEscalation, true);
  assert.ok(guarded.compliance.violationsBlocked.length >= 1, 'Unsafe draft must be scrubbed by guardrail');
  assert.ok(guarded.replyText.includes('NOT act as a direct lender'));
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
  console.log(`\nAPR-009 STAGE 5 RUNTIME SUITE SUMMARY: ${passed}/${tests.length} PASS, ${failed} FAIL`);
  process.exit(failed > 0 ? 1 : 0);
})();
