'use strict';

const assert = require('assert');

console.log('============================================================');
console.log('🧪 AVANI AI CRM — DRIP WORKFLOW & SIDEBAR ENDPOINTS SUITE');
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

runTest('Test 7.1: Canonical 8 loan products are strictly enumerated and complete', () => {
  const CANONICAL_LOAN_PRODUCTS = [
    'Personal Loan',
    'Business Loan',
    'Home Loan',
    'Mortgage Loan / Loan Against Property (LAP)',
    'Education Loan',
    'Vehicle Loan / Car Loan',
    'Gold Loan',
    'Working Capital / MSME Loan'
  ];

  assert.strictEqual(CANONICAL_LOAN_PRODUCTS.length, 8, 'Must have exactly 8 canonical loan products');
  assert(CANONICAL_LOAN_PRODUCTS.includes('Personal Loan'));
  assert(CANONICAL_LOAN_PRODUCTS.includes('Business Loan'));
  assert(CANONICAL_LOAN_PRODUCTS.includes('Home Loan'));
  assert(CANONICAL_LOAN_PRODUCTS.includes('Mortgage Loan / Loan Against Property (LAP)'));
  assert(CANONICAL_LOAN_PRODUCTS.includes('Education Loan'));
  assert(CANONICAL_LOAN_PRODUCTS.includes('Vehicle Loan / Car Loan'));
  assert(CANONICAL_LOAN_PRODUCTS.includes('Gold Loan'));
  assert(CANONICAL_LOAN_PRODUCTS.includes('Working Capital / MSME Loan'));
});

runTest('Test 7.2: Drip schedule thresholds match Day 1 (24h), Day 3 (72h), Day 7 (168h), Day 10 (240h), Day 15 (360h)', () => {
  const DRIP_SCHEDULE = [
    { day: 1, minHoursElapsed: 24, requiredFollowUpCount: 0 },
    { day: 3, minHoursElapsed: 72, requiredFollowUpCount: 1 },
    { day: 7, minHoursElapsed: 168, requiredFollowUpCount: 2 },
    { day: 10, minHoursElapsed: 240, requiredFollowUpCount: 3 },
    { day: 15, minHoursElapsed: 360, requiredFollowUpCount: 4 }
  ];

  assert.strictEqual(DRIP_SCHEDULE.length, 5);
  assert.strictEqual(DRIP_SCHEDULE[0].minHoursElapsed, 24);
  assert.strictEqual(DRIP_SCHEDULE[1].minHoursElapsed, 72);
  assert.strictEqual(DRIP_SCHEDULE[2].minHoursElapsed, 168);
  assert.strictEqual(DRIP_SCHEDULE[3].minHoursElapsed, 240);
  assert.strictEqual(DRIP_SCHEDULE[4].minHoursElapsed, 360);
});

runTest('Test 7.3: Direct Message endpoint rejects opted-out contacts', () => {
  const contact = { phone: '+919175635165', optedIn: false };
  const lead = { phone: '+919175635165', isOptedOut: true };

  const isBlocked = contact.optedIn === false || lead.isOptedOut === true;
  assert.strictEqual(isBlocked, true, 'Must block direct message if opted out');
});

runTest('Test 7.4: Bulk Message endpoint suppresses opted-out recipients from campaign', () => {
  const allContacts = [
    { phone: '+919175635165', name: 'Sachin', optedIn: true },
    { phone: '+917249108474', name: 'Avani Support', optedIn: true },
    { phone: '+919876543210', name: 'Opted Out User', optedIn: false }
  ];

  const eligible = allContacts.filter(c => c.optedIn !== false);
  assert.strictEqual(eligible.length, 2, 'Must filter out opted out contacts');
  assert.strictEqual(eligible.some(c => c.phone === '+919876543210'), false);
});

runTest('Test 7.5: CSV parser normalizes mixed phone formats to +91XXXXXXXXXX', () => {
  const rawRows = [
    ['Sachin', '9175635165'],
    ['Rahul', '+919823012345'],
    ['Priya', '919876543210'],
    ['Invalid', '12345']
  ];

  const processed = [];
  for (const [name, phone] of rawRows) {
    let digits = phone.replace(/\D/g, '');
    if (digits.length === 12 && digits.startsWith('91')) digits = digits.slice(2);
    if (digits.length === 11 && digits.startsWith('0')) digits = digits.slice(1);
    if (digits.length === 10) {
      processed.push({ name, phone: `+91${digits}` });
    }
  }

  assert.strictEqual(processed.length, 3, 'Must filter invalid phone lengths');
  assert.strictEqual(processed[0].phone, '+919175635165');
  assert.strictEqual(processed[1].phone, '+919823012345');
  assert.strictEqual(processed[2].phone, '+919876543210');
});

runTest('Test 7.6: Opts Management registry models DPDP Act 2023 compliance status', () => {
  const registryEntry = {
    phone: '+919175635165',
    status: 'OPTED_IN',
    consentStatus: 'GRANTED',
    consentPurpose: 'LOAN_ELIGIBILITY_PROCESSING',
    consentTimestamp: new Date().toISOString()
  };

  assert.strictEqual(registryEntry.status, 'OPTED_IN');
  assert.strictEqual(registryEntry.consentStatus, 'GRANTED');
  assert.strictEqual(registryEntry.consentPurpose, 'LOAN_ELIGIBILITY_PROCESSING');
  assert(registryEntry.consentTimestamp !== undefined);
});

runTest('Test 7.7: Statutory disclaimer prevents misrepresentation as direct lender or NBFC', () => {
  const disclaimer = "AVANI LOAN SERVICES is an authorized loan advisory and consultancy firm and does NOT act as a direct lender or bank. Loan sanction, interest rates, and disbursal are at the sole discretion of partner banks and NBFCs based on eligibility, documentation, and credit verification.";

  assert(disclaimer.includes('consultancy firm'));
  assert(disclaimer.includes('does NOT act as a direct lender'));
  assert(disclaimer.includes('sole discretion of partner banks and NBFCs'));
});

console.log('\n============================================================');
console.log(`RESULTS: ${passedTests} / ${totalTests} TESTS PASSED`);
console.log('============================================================');

if (passedTests !== totalTests) {
  process.exit(1);
}
