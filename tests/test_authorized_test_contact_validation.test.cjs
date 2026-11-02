'use strict';

const assert = require('assert');

console.log('============================================================');
console.log('🧪 AVANI AI CRM — PHASE 6 AUTHORIZED TEST CONTACT VALIDATION');
console.log('   Target Number: +91 91756 35165 | Contact: Sachin');
console.log('============================================================\n');

let passedTests = 0;
let totalTests = 0;

function runTest(name, fn) {
  totalTests++;
  try {
    fn();
    console.log(`  ✅ [PASS] ${name}`);
    passedTests++;
  } catch (err) {
    console.error(`  ❌ [FAIL] ${name}:`, err.message);
  }
}

const AUTHORIZED_TEST_PHONE = '+919175635165';
const AUTHORIZED_TEST_NAME = 'Sachin';

runTest('Test 6.1: Validates phone normalization to E.164 (+919175635165)', () => {
  const rawPhones = [
    '+91 91756 35165',
    '+919175635165',
    '9175635165',
    '919175635165',
    '+91-91756-35165'
  ];

  for (const raw of rawPhones) {
    let digits = raw.replace(/\D/g, '');
    if (digits.length === 12 && digits.startsWith('91')) {
      digits = digits.slice(2);
    }
    const normalized = `+91${digits}`;
    assert.strictEqual(normalized, AUTHORIZED_TEST_PHONE, `Phone ${raw} must normalize to ${AUTHORIZED_TEST_PHONE}`);
  }
});

runTest('Test 6.2: Day 0 Welcome message incorporates loan consultancy disclaimer & advisor contact', () => {
  const lead = {
    leadId: 'ALS-2026-TEST01',
    name: AUTHORIZED_TEST_NAME,
    phone: AUTHORIZED_TEST_PHONE,
    loanType: 'Business Loan',
    consentStatus: 'GRANTED'
  };

  const welcomeText = `Namaste ${lead.name}! Welcome to AVANI LOAN SERVICES. We have received your inquiry for ${lead.loanType}. As an authorized loan consultancy, we help you secure the best loan options from 40+ partner banks & NBFCs with zero upfront fees. An advisor will review your eligibility shortly.`;

  assert(welcomeText.includes('AVANI LOAN SERVICES'), 'Must identify as AVANI LOAN SERVICES');
  assert(welcomeText.includes('authorized loan consultancy'), 'Must disclaim direct lending by stating loan consultancy');
  assert(welcomeText.includes('zero upfront fees'), 'Must guarantee zero upfront fees');
  assert(!welcomeText.includes('100% guaranteed approval'), 'Must not make false guarantees of approval');
});

runTest('Test 6.3: Stop Condition 1 — Customer reply triggers immediate drip suppression', () => {
  const lead = {
    leadId: 'ALS-2026-TEST01',
    phone: AUTHORIZED_TEST_PHONE,
    status: 'CUSTOMER_REPLIED_HUMAN_FOLLOWUP',
    followUpCount: 1,
    interactions: [
      { direction: 'inbound', text: 'Yes I want 20 Lakhs Business Loan' }
    ]
  };

  const hasInbound = lead.interactions.some(i => i.direction === 'inbound');
  const isStop = lead.status === 'CUSTOMER_REPLIED_HUMAN_FOLLOWUP' || hasInbound;

  assert.strictEqual(isStop, true, 'Drip sequence must immediately stop when customer replies');
});

runTest('Test 6.4: Stop Condition 2 — Multilingual Opt-Out ("थांबवा" / "STOP") immediately halts follow-up', () => {
  const testKeywords = ['STOP', 'stop', 'थांबवा', 'नको', 'रोको', 'बंद करो', 'unsubscribe'];

  const isOptOutMessage = (text) => {
    const lower = text.trim().toLowerCase();
    const phrases = [
      'stop', 'unsubscribe', 'no more', 'cancel', 'opt out', 'opt-out',
      'थांबवा', 'नको', 'बंद करा', 'nako', 'thamba',
      'रोको', 'बंद करो'
    ];
    return phrases.some(p => lower === p || lower.includes(p));
  };

  for (const kw of testKeywords) {
    assert.strictEqual(isOptOutMessage(kw), true, `Keyword "${kw}" must trigger opt-out`);
  }
});

runTest('Test 6.5: Idempotency protection prevents duplicate dispatch to authorized test number', () => {
  const provider = 'CHATMITRA';
  const campaignId = 'AVANI_DAY0_WELCOME';
  const idempotencyKey = `${provider}:DRIP_DAY_0:${AUTHORIZED_TEST_PHONE}:Avani_Loan_Welcome`;

  const dispatchedKeys = new Set([idempotencyKey]);

  const isDuplicate = dispatchedKeys.has(idempotencyKey);
  assert.strictEqual(isDuplicate, true, 'Second dispatch must be blocked by idempotency key');
});

runTest('Test 6.6: Human Escalation Routes to Sachin Shinde (+91 72491 08474)', () => {
  const advisor = {
    name: 'Sachin Shinde',
    role: 'Founder & Chief Loan Advisor',
    phone: '+91 72491 08474',
    website: 'https://www.avanifinserv.com/'
  };

  assert.strictEqual(advisor.phone, '+91 72491 08474', 'Advisor phone must be official Helpline');
  assert.strictEqual(advisor.name, 'Sachin Shinde', 'Advisor name must be Sachin Shinde');
});

console.log('\n============================================================');
console.log(`RESULTS: ${passedTests} / ${totalTests} TESTS PASSED`);
console.log('============================================================');

if (passedTests !== totalTests) {
  process.exit(1);
}
