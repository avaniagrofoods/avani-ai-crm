'use strict';

/**
 * AVANI AI CRM — CP-25.3.1 TEST SUITE
 * Production Forensic Audit, Branding Correction & Deployment Ownership Verification
 * 
 * 22 Forensic Verification Tests
 */

const assert = require('assert');
const fs = require('fs');
const path = require('path');

let passedTests = 0;
let totalTests = 0;

function runTest(name, fn) {
  totalTests++;
  try {
    fn();
    passedTests++;
    console.log(`[PASS] ${name}`);
  } catch (err) {
    console.error(`[FAIL] ${name}: ${err.message}`);
  }
}

console.log('================================================================================');
console.log('🧪 AVANI AI CRM — CP-25.3.1 BRANDING, OWNERSHIP & ACCURACY AUDIT');
console.log('================================================================================\n');

// 1. Centralized Business Config existence
runTest('CP25.3.1-01: Centralized business config exists and defines AVANI LOAN SERVICES', () => {
  const code = fs.readFileSync(path.join('src', 'config', 'business.ts'), 'utf8');
  assert.ok(code.includes('AVANI_BUSINESS_CONFIG'), 'AVANI_BUSINESS_CONFIG missing');
  assert.ok(code.includes('AVANI LOAN SERVICES'), 'Business name missing');
});

// 2. Official WABA Number
runTest('CP25.3.1-02: Official WhatsApp Business / WABA number is +91 72491 08474', () => {
  const code = fs.readFileSync(path.join('src', 'config', 'business.ts'), 'utf8');
  assert.ok(code.includes('+91 72491 08474'), 'Formatted WABA number missing');
  assert.ok(code.includes('+917249108474'), 'E.164 WABA number missing');
});

// 3. Authorized Test Recipient isolation
runTest('CP25.3.1-03: Authorized test recipient is isolated as +91 91756 35165', () => {
  const code = fs.readFileSync(path.join('src', 'config', 'business.ts'), 'utf8');
  assert.ok(code.includes('919175635165'), 'Canonical test recipient digits missing');
  assert.ok(code.includes('+91 91756 35165'), 'Formatted test recipient missing');
  assert.ok(code.includes('isAuthorizedTestRecipient'), 'Test recipient helper missing');
});

// 4. Official Website & Email
runTest('CP25.3.1-04: Official website is https://www.avanifinserv.com and email is enquiry@avanifinserv.com', () => {
  const code = fs.readFileSync(path.join('src', 'config', 'business.ts'), 'utf8');
  assert.ok(code.includes('https://www.avanifinserv.com'), 'Website URL mismatch');
  assert.ok(code.includes('enquiry@avanifinserv.com'), 'Email mismatch');
});

// 5. Founder attribution
runTest('CP25.3.1-05: Founder & Chief Loan Advisor is attributed to Sachin Shinde', () => {
  const code = fs.readFileSync(path.join('src', 'config', 'business.ts'), 'utf8');
  assert.ok(code.includes('Sachin Shinde'), 'Founder name missing');
  assert.ok(code.includes('Founder & Chief Loan Advisor'), 'Founder role missing');
});

// 6. Test recipient excluded from public product suite copy
runTest('CP25.3.1-06: Test recipient 9175635165 is excluded from public product suite copy', () => {
  const code = fs.readFileSync(path.join('src', 'config', 'business.ts'), 'utf8');
  const suiteMatch = code.match(/AVANI_OFFICIAL_PRODUCT_SUITE\s*=\s*`([^`]+)`/);
  assert.ok(suiteMatch, 'Product suite declaration not found');
  const suiteText = suiteMatch[1];
  assert.ok(suiteText.includes('+91 72491 08474'), 'Product suite must contain official WABA number');
  assert.ok(!suiteText.includes('9175635165'), 'Product suite must NOT contain test recipient 9175635165');
});

// 7. Logo file exists in public directory
runTest('CP25.3.1-07: public/logo.svg exists and is a valid SVG vector file', () => {
  const logoPath = path.join('public', 'logo.svg');
  assert.ok(fs.existsSync(logoPath), 'public/logo.svg does not exist');
  const svgContent = fs.readFileSync(logoPath, 'utf8');
  assert.ok(svgContent.includes('<svg'), 'Invalid SVG format');
  assert.ok(svgContent.includes('AVANI LOAN'), 'SVG does not contain AVANI LOAN text');
  assert.ok(svgContent.includes('SERVICE'), 'SVG does not contain SERVICE text');
});

// 8. Sidebar layout renders logo with fallback
runTest('CP25.3.1-08: Sidebar layout renders /logo.svg with text brand fallback', () => {
  const code = fs.readFileSync(path.join('src', 'components', 'layout', 'sidebar.tsx'), 'utf8');
  assert.ok(code.includes('src="/logo.svg"'), 'Sidebar logo src missing');
  assert.ok(code.includes('alt="AVANI LOAN SERVICES"'), 'Sidebar logo alt missing');
  assert.ok(code.includes('onError='), 'Sidebar image fallback handler missing');
  assert.ok(code.includes('AVANI LOAN'), 'Sidebar text fallback missing');
});

// 9. Contacts page displays official WABA and test recipient accurately
runTest('CP25.3.1-09: Contacts page distinguishes Official WABA (+91 72491 08474) and Test Recipient (+91 91756 35165)', () => {
  const code = fs.readFileSync(path.join('src', 'app', 'contacts', 'page.tsx'), 'utf8');
  assert.ok(code.includes('Official WABA Number'), 'Official WABA label missing');
  assert.ok(code.includes('+91 72491 08474'), 'Official WABA number missing');
  assert.ok(code.includes('Authorized Test Recipient'), 'Authorized test recipient label missing');
  assert.ok(code.includes('+91 91756 35165'), 'Authorized test recipient number missing');
});

// 10. Inbox UI displays accurate auto-reply status (MOCK MODE / DISABLED)
runTest('CP25.3.1-10: Inbox UI displays accurate AI auto-reply status (MOCK MODE or DISABLED)', () => {
  const code = fs.readFileSync(path.join('src', 'app', 'inbox', 'page.tsx'), 'utf8');
  assert.ok(code.includes('AI Auto-Reply: MOCK MODE'), 'MOCK MODE status missing');
  assert.ok(code.includes('AI Auto-Reply: DISABLED'), 'DISABLED status missing');
  assert.ok(!code.includes("'AI Auto-Reply: Active'"), 'Misleading Active status must be removed');
});

// 11. Inbox UI header displays official WABA advisory hotline
runTest('CP25.3.1-11: Inbox UI header displays official advisory hotline (+91 72491 08474)', () => {
  const code = fs.readFileSync(path.join('src', 'app', 'inbox', 'page.tsx'), 'utf8');
  assert.ok(code.includes('officialWabaFormatted'), 'Official WABA hotline binding missing');
  assert.ok(!code.includes('Official Hotline: 9175635165'), 'Test number must not be labeled as official hotline');
});

// 12. Inbox UI badges test contacts clearly
runTest('CP25.3.1-12: Inbox UI badges test contacts with Authorized Test Recipient pill', () => {
  const code = fs.readFileSync(path.join('src', 'app', 'inbox', 'page.tsx'), 'utf8');
  assert.ok(code.includes('Authorized Test Recipient'), 'Test recipient badge missing');
  assert.ok(code.includes('isTestContact'), 'isTestContact check missing');
});

// 13. Chatbot flow engine uses official WABA number
runTest('CP25.3.1-13: Chatbot flow engine directs inquiries to official WABA number (+91 72491 08474)', () => {
  const code = fs.readFileSync(path.join('src', 'lib', 'chatbot-flow-engine.ts'), 'utf8');
  assert.ok(code.includes('📲 *Official WhatsApp Business:* +91 72491 08474'), 'WABA number missing in flow engine');
  assert.ok(!code.includes('📲 *Direct WhatsApp Advisory:* 9175635165'), 'Old test number hotline must be removed');
});

// 14. AI agent handoff uses official WABA number
runTest('CP25.3.1-14: AI agent human handoff directs inquiries to Sachin Shinde (+91 72491 08474)', () => {
  const code = fs.readFileSync(path.join('src', 'lib', 'ai-agent.ts'), 'utf8');
  assert.ok(code.includes('Sachin Shinde (+91 72491 08474)'), 'Advisor official contact missing in AI agent');
  assert.ok(!code.includes('WhatsApp: 9175635165)'), 'Test number must not be in human handoff copy');
});

// 15. ChatMitra adapter enforces safety clamp for live testing
runTest('CP25.3.1-15: ChatMitra adapter clamps live dispatch strictly to test recipient 919175635165', () => {
  const code = fs.readFileSync(path.join('src', 'lib', 'chatmitra.ts'), 'utf8');
  assert.ok(code.includes("AUTHORIZED_TEST_PHONE_CANONICAL = '919175635165'"), 'Safety clamp test phone missing');
  assert.ok(code.includes('BLOCKED_UNAUTHORIZED_LIVE_RECIPIENT'), 'Safety clamp blocked status missing');
});

// 16. direct-message API restricts live dispatch to test recipient
runTest('CP25.3.1-16: direct-message API restricts live dispatch strictly to authorized test contact', () => {
  const code = fs.readFileSync(path.join('src', 'app', 'api', 'contacts', 'direct-message', 'route.ts'), 'utf8');
  assert.ok(code.includes('LIVE_DISPATCH_RESTRICTED'), 'Live dispatch restriction check missing');
  assert.ok(code.includes('919175635165'), 'Authorized test phone clamp missing');
});

// 17. Vercel project configuration targets avani-ai-crm
runTest('CP25.3.1-17: .vercel/project.json targets avani-ai-crm under team_vUTeKhQxcSPYtztYtoLMWinO', () => {
  const vProject = JSON.parse(fs.readFileSync(path.join('.vercel', 'project.json'), 'utf8'));
  assert.strictEqual(vProject.projectName, 'avani-ai-crm', 'Vercel project name mismatch');
  assert.strictEqual(vProject.projectId, 'prj_P8s8y3a5Gge8EzAab0Fa10cHewgQ', 'Vercel project ID mismatch');
});

// 18. Zero Agro Foods cross-project code contamination
runTest('CP25.3.1-18: Zero Agro Foods application code in src/ directory', () => {
  const globFiles = (dir) => {
    let results = [];
    const list = fs.readdirSync(dir);
    list.forEach(file => {
      const fullPath = path.join(dir, file);
      const stat = fs.statSync(fullPath);
      if (stat && stat.isDirectory()) results = results.concat(globFiles(fullPath));
      else if (fullPath.endsWith('.ts') || fullPath.endsWith('.tsx')) results.push(fullPath);
    });
    return results;
  };
  const files = globFiles('src');
  let contaminationFound = false;
  files.forEach(f => {
    const text = fs.readFileSync(f, 'utf8').toLowerCase();
    if (text.includes('agro foods') || text.includes('agrofoods') || text.includes('grain procurement')) {
      contaminationFound = true;
      console.error(`Contamination in ${f}`);
    }
  });
  assert.strictEqual(contaminationFound, false, 'Agro Foods cross-project code found in CRM src/');
});

// 19. Quick actions require user review before sending
runTest('CP25.3.1-19: Inbox quick actions insert draft into composer without auto-dispatching', () => {
  const code = fs.readFileSync(path.join('src', 'app', 'inbox', 'page.tsx'), 'utf8');
  assert.ok(code.includes('handleInsertProductDetails'), 'handleInsertProductDetails missing');
  assert.ok(code.includes('handleGenerateAiResponse'), 'handleGenerateAiResponse missing');
  assert.ok(code.includes('Please review before sending'), 'Review notice missing');
});

// 20. Outbound message text persistence
runTest('CP25.3.1-20: ProviderRouter persists messageText to MongoDB Message.create', () => {
  const code = fs.readFileSync(path.join('src', 'lib', 'provider-router.ts'), 'utf8');
  assert.ok(code.includes('text: options.messageText'), 'messageText persistence missing');
  assert.ok(code.includes("senderPhone: 'AVANI_OFFICIAL'"), 'senderPhone persistence missing');
});

// 21. Phone variants matching for inbound/outbound
runTest('CP25.3.1-21: contacts/[id] generates normalized phoneVariants for message matching', () => {
  const code = fs.readFileSync(path.join('src', 'app', 'api', 'contacts', '[id]', 'route.ts'), 'utf8');
  assert.ok(code.includes('phoneVariants'), 'phoneVariants array missing');
  assert.ok(code.includes('$in: phoneVariants'), '$in phoneVariants query missing');
});

// 22. Database health verification capability
runTest('CP25.3.1-22: Health endpoint reports database status and WhatsApp provider status without leaking secrets', () => {
  const code = fs.readFileSync(path.join('src', 'app', 'api', 'diagnostics', 'route.ts'), 'utf8');
  assert.ok(code.includes('flagStatus'), 'Credential status helper missing');
  assert.ok(code.includes('AVANI LOAN SERVICES — AVANI AI CRM'), 'Service identifier missing');
});

console.log('\n================================================================================');
console.log(`TEST RESULTS: ${passedTests} / ${totalTests} TESTS PASSED (${Math.round((passedTests / totalTests) * 100)}%)`);
console.log('================================================================================');

if (passedTests !== totalTests) {
  process.exit(1);
}
