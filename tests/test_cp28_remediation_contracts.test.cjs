const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..');

function readRel(relPath) {
  return fs.readFileSync(path.join(ROOT, relPath), 'utf8');
}

function run() {
  let passed = 0;

  // 1. Public enquiry idempotency + attribution + consentPurpose
  const enquiryRoute = readRel('src/app/api/public/enquiry/route.ts');
  assert.ok(enquiryRoute.includes('idempotencyKey'), 'enquiry route must support idempotencyKey');
  assert.ok(enquiryRoute.includes('idempotencyHit: true'), 'enquiry route must return idempotencyHit: true on duplicate key');
  for (const field of ['utmSource', 'utmMedium', 'utmCampaign', 'utmContent', 'utmTerm', 'consentPurpose']) {
    assert.ok(enquiryRoute.includes(field), `enquiry route must persist ${field}`);
  }
  passed++;
  console.log('PASS [1/4]: /api/public/enquiry idempotencyKey & attribution contract verified');

  // 2. Lead model schema fields
  const leadModel = readRel('src/models/Lead.ts');
  for (const field of ['idempotencyKey', 'utmSource', 'utmMedium', 'utmCampaign', 'utmContent', 'utmTerm', 'consentPurpose']) {
    assert.ok(leadModel.includes(field), `Lead.ts must define ${field}`);
  }
  passed++;
  console.log('PASS [2/4]: Lead.ts schema fields verified');

  // 3. Login page owner-only wording (no staff/advisor copy)
  const loginPage = readRel('src/app/login/page.tsx');
  assert.ok(loginPage.includes('Secure Owner Access'), 'login page must display Secure Owner Access');
  assert.ok(loginPage.includes('Enter owner email'), 'login page must use owner email placeholder');
  assert.ok(!loginPage.includes('Authorized Staff Access'), 'login page must not say Authorized Staff Access');
  assert.ok(!loginPage.includes('advisor@avanifinserv.com'), 'login page must not use advisor@avanifinserv.com placeholder');
  passed++;
  console.log('PASS [3/4]: login/page.tsx owner-only copy verified');

  // 4. InboxPage purity helper
  const inboxPage = readRel('src/app/inbox/page.tsx');
  const helperIdx = inboxPage.indexOf('const nextTempId');
  const componentIdx = inboxPage.indexOf('export default function InboxPage');
  assert.ok(helperIdx !== -1 && componentIdx !== -1 && helperIdx < componentIdx, 'nextTempId helper must be defined outside InboxPage');
  passed++;
  console.log('PASS [4/4]: inbox/page.tsx react-hooks/purity fix verified');

  console.log(`\nPASS: CP-28 remediation contract tests (${passed}/4 passed)`);
}

run();
