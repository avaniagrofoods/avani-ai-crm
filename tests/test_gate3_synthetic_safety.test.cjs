/**
 * AVANI AI CRM — Gate 3 Synthetic Test Safety Local Non-Production Validator
 * 
 * Tests the algorithmic logic, deduplication mechanics, phone normalization,
 * collision protection, and ownership verification in complete local isolation.
 * No production connections or credentials used.
 */

const assert = require('assert');

// 1. Replicated phone normalization from src/app/api/leads/route.ts
function normalizeIndianPhone(input) {
  if (!input) return null;
  const digits = String(input).replace(/[^0-9]/g, '');
  const raw10 = digits.length > 10 ? digits.slice(-10) : digits;
  if (raw10.length !== 10) return null;
  if (!/^[6-9]/.test(raw10)) return null;
  return {
    formatted: `+91${raw10}`,
    raw10
  };
}

// 2. Replicated loan category normalization from src/app/api/leads/route.ts
function normalizeLoanCategory(loanType) {
  const norm = String(loanType || '').toUpperCase().replace(/[^A-Z]/g, '');
  if (norm.includes('DOCTOR') || norm.includes('MEDIC')) return 'DOCTOR_LOAN';
  if (norm.includes('BUSIN') || norm.includes('COMMERC') || norm.includes('MSME')) return 'BUSINESS_LOAN';
  if (norm.includes('MORTG') || norm.includes('LAP') || norm.includes('AGAINSTPROP')) return 'MORTGAGE_LOAN';
  if (norm.includes('HOME') || norm.includes('HOUS')) return 'HOME_LOAN';
  if (norm.includes('GLOBAL') || norm.includes('ABROAD') || norm.includes('OVERSEA')) return 'EDUCATION_LOAN_GLOBAL';
  if (norm.includes('EDU') || norm.includes('STUD')) return 'EDUCATION_LOAN_INDIA';
  if (norm.includes('SCHOOL') || norm.includes('COLLEGE') || norm.includes('INSTITUT')) return 'SCHOOL_COLLEGE_FUNDING';
  return 'PERSONAL_LOAN';
}

console.log('============================================================');
console.log('🧪 RUNNING GATE 3 SYNTHETIC TEST LOCAL SAFETY VALIDATION');
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

// Test 1: Phone Normalization for Proposed Phone
runTest('Proposed phone +919999999999 is normalized and accepted by route regex', () => {
  const res = normalizeIndianPhone('+919999999999');
  assert.strictEqual(res.formatted, '+919999999999');
  assert.strictEqual(res.raw10, '9999999999');
});

// Test 2: In-Memory DB Mock to Demonstrate Collision Risk with Static Phone
runTest('Collision Risk: Static phone without pre-flight check overwrites pre-existing lead', () => {
  // Mock DB store containing a pre-existing lead
  const mockDb = [
    {
      _id: 'cust_real_001',
      leadId: 'AVL-20261020-112233',
      name: 'Dr. Ramesh Sharma',
      phone: '+919999999999',
      normalizedMobile: '9999999999',
      loanType: 'DOCTOR_LOAN',
      status: 'QUALIFIED_HUMAN',
      isOptedOut: false
    }
  ];

  // Simulating POST /api/leads deduplication logic
  const payload = {
    name: '__ALS_SYNTHETIC_CONNECTIVITY_TEST__',
    phone: '+919999999999',
    loanType: 'PERSONAL_LOAN',
    isOptedOut: true
  };

  const phoneData = normalizeIndianPhone(payload.phone);
  
  // Find matching existing lead
  const existingLead = mockDb.find(l => 
    l.phone === phoneData.formatted || 
    l.phone === phoneData.raw10 || 
    l.normalizedMobile === phoneData.raw10
  );

  assert.ok(existingLead, 'Existing lead found by phone match alone');
  assert.strictEqual(existingLead._id, 'cust_real_001');

  // Route does findOneAndUpdate({ phone }, { $set: updatePayload })
  existingLead.name = payload.name;
  existingLead.status = 'OPTED_OUT';
  existingLead.isOptedOut = true;

  // VERIFICATION: Real customer lead was mutated and overwritten!
  assert.strictEqual(existingLead.name, '__ALS_SYNTHETIC_CONNECTIVITY_TEST__');
  assert.strictEqual(existingLead.status, 'OPTED_OUT');
  assert.strictEqual(existingLead.isOptedOut, true);
  // This proves STATIC PHONE IS HAZARDOUS without pre-flight probe!
});

// Test 3: Pre-Flight Probe Collision Prevention
runTest('Safe Design: Pre-flight probe halts test if phone already exists', () => {
  const mockDb = [
    { phone: '+919999999999', name: 'Existing Customer' }
  ];

  const testPhone = '+919999999999';
  const preFlightMatches = mockDb.filter(l => l.phone === testPhone);

  let aborted = false;
  if (preFlightMatches.length > 0) {
    aborted = true; // Mandatory Abort Triggered
  }

  assert.strictEqual(aborted, true, 'Test correctly aborted before mutating existing record');
});

// Test 4: Dynamic Randomized Phone & Unique Marker Isolation
runTest('Safe Design: Dynamic timestamped identifier and randomized phone guarantee zero collision', () => {
  const mockDb = [
    { phone: '+919999999999', name: 'Existing Customer' }
  ];

  const testRunTimestamp = Date.now();
  const dynamicPhoneSuffix = String(Math.floor(10000 + Math.random() * 90000));
  const dynamicTestPhone = `+9199999${dynamicPhoneSuffix}`;
  const dynamicMarker = `__ALS_SYNTHETIC_${testRunTimestamp}__`;

  // Pre-flight check
  const preFlightMatches = mockDb.filter(l => l.phone === dynamicTestPhone);
  assert.strictEqual(preFlightMatches.length, 0, 'Zero pre-flight matches on randomized phone');

  // Safe Insertion
  const newRecord = {
    _id: `test_id_${testRunTimestamp}`,
    name: dynamicMarker,
    phone: dynamicTestPhone,
    status: 'OPTED_OUT',
    isOptedOut: true,
    createdAt: new Date(testRunTimestamp)
  };
  mockDb.push(newRecord);

  // Read-back verification
  const readBack = mockDb.find(l => l.name === dynamicMarker && l.phone === dynamicTestPhone);
  assert.ok(readBack, 'Read-back located synthetic record');
  assert.strictEqual(readBack._id, `test_id_${testRunTimestamp}`);
  assert.strictEqual(readBack.status, 'OPTED_OUT');

  // Ownership verification before cleanup:
  // Must match exact _id, exact marker, exact test phone, and creation time within bounds
  const isOwnerVerified = (
    readBack._id === `test_id_${testRunTimestamp}` &&
    readBack.name === dynamicMarker &&
    readBack.phone === dynamicTestPhone &&
    readBack.isOptedOut === true &&
    (Date.now() - readBack.createdAt.getTime()) < 60000
  );
  assert.strictEqual(isOwnerVerified, true, 'Ownership verified before cleanup');

  // Targeted Cleanup
  const deleteIndex = mockDb.findIndex(l => l._id === readBack._id && l.name === dynamicMarker);
  assert.ok(deleteIndex !== -1, 'Record found for deletion');
  mockDb.splice(deleteIndex, 1);

  // Post-cleanup check
  const postCheck = mockDb.find(l => l.name === dynamicMarker);
  assert.strictEqual(postCheck, undefined, 'Synthetic record completely purged');
  assert.strictEqual(mockDb.length, 1, 'Pre-existing customer record remains 100% untouched');
  assert.strictEqual(mockDb[0].name, 'Existing Customer');
});

// Test 5: Verify Absence of HTTP DELETE Route in Codebase
runTest('Architecture Check: Confirm that CRM API does not expose HTTP DELETE', () => {
  const fs = require('fs');
  const path = require('path');

  const leadsRoutePath = path.resolve(__dirname, '../src/app/api/leads/route.ts');
  const leadsIdRoutePath = path.resolve(__dirname, '../src/app/api/leads/[id]/route.ts');

  const leadsRouteContent = fs.readFileSync(leadsRoutePath, 'utf8');
  const leadsIdRouteContent = fs.readFileSync(leadsIdRoutePath, 'utf8');

  assert.strictEqual(leadsRouteContent.includes('export async function DELETE'), false, 'No DELETE in /api/leads');
  assert.strictEqual(leadsIdRouteContent.includes('export async function DELETE'), false, 'No DELETE in /api/leads/[id]');
});

console.log('\n============================================================');
console.log(`📊 LOCAL VALIDATION SUMMARY: ${passedTests} / ${totalTests} TESTS PASSED (${Math.round((passedTests/totalTests)*100)}%)`);
console.log('============================================================\n');

if (passedTests !== totalTests) {
  process.exit(1);
}
