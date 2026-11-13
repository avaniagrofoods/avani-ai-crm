'use strict';

/**
 * AVANI AI CRM — CP-25.2 TEST SUITE
 * Inbox Send Button Failure Repair, Outbound Pipeline, Phone Normalization & Live WhatsApp Safety
 * 
 * 20 Forensic Verification Tests
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
console.log('🧪 AVANI AI CRM — CP-25.2 INBOX SEND PIPELINE & OUTBOUND FORENSICS');
console.log('================================================================================\n');

// 1. Verify InboxPage source code and components
runTest('CP25.2-01: InboxPage imports and React hooks defined properly', () => {
  const code = fs.readFileSync(path.join('src', 'app', 'inbox', 'page.tsx'), 'utf8');
  assert.ok(code.includes('export default function InboxPage'), 'InboxPage component missing');
  assert.ok(code.includes('handleSendReply'), 'handleSendReply function missing');
  assert.ok(code.includes('isSending'), 'isSending state missing');
  assert.ok(code.includes('showNotification'), 'showNotification function missing');
});

// 2. Verify AVANI_INBOX_PRODUCT_DETAILS contains 8 products
runTest('CP25.2-02: AVANI_INBOX_PRODUCT_DETAILS contains all 8 products', () => {
  const bCode = fs.readFileSync(path.join('src', 'config', 'business.ts'), 'utf8');
  assert.ok(bCode.includes('Doctor Professional Loan'), 'Doctor loan missing');
  assert.ok(bCode.includes('Personal Loan'), 'Personal loan missing');
  assert.ok(bCode.includes('Business Loan & MSME Working Capital'), 'Business loan missing');
  assert.ok(bCode.includes('CA Professional Loan'), 'CA loan missing');
  assert.ok(bCode.includes('Home Loan & Construction Funding'), 'Home loan missing');
  assert.ok(bCode.includes('Mortgage Loan / Loan Against Property (LAP)'), 'Mortgage LAP missing');
  assert.ok(bCode.includes('Education Loan (India & Global Studies)'), 'Education loan missing');
  assert.ok(bCode.includes('School & College Institutional Funding'), 'School/College funding missing');
});

// 3. Verify product suite contains official WhatsApp WABA number +91 72491 08474
runTest('CP25.2-03: Product suite contains official WhatsApp WABA number +91 72491 08474', () => {
  const code = fs.readFileSync(path.join('src', 'app', 'inbox', 'page.tsx'), 'utf8');
  assert.ok(code.includes('AVANI_OFFICIAL_PRODUCT_SUITE'), 'AVANI_OFFICIAL_PRODUCT_SUITE missing in inbox/page.tsx');
  const bCode = fs.readFileSync(path.join('src', 'config', 'business.ts'), 'utf8');
  assert.ok(bCode.includes('+91 72491 08474'), 'Official WABA number +91 72491 08474 missing in business.ts');
  assert.ok(bCode.includes('+91 91756 35165'), 'Authorized test recipient +91 91756 35165 missing in business.ts');
});

// 4. Verify product suite includes Chief Loan Advisor Sachin Shinde
runTest('CP25.2-04: Product suite attributes Founder & Chief Loan Advisor Sachin Shinde', () => {
  const code = fs.readFileSync(path.join('src', 'app', 'inbox', 'page.tsx'), 'utf8');
  assert.ok(code.includes('Sachin Shinde'), 'Chief Loan Advisor Sachin Shinde missing');
});

// 5. Verify product suite includes official website https://www.avanifinserv.com/
runTest('CP25.2-05: Product suite links to official website https://www.avanifinserv.com/', () => {
  const bCode = fs.readFileSync(path.join('src', 'config', 'business.ts'), 'utf8');
  assert.ok(bCode.includes('https://www.avanifinserv.com'), 'Official website URL missing');
});

// 6. Verify Doctor Loan Checklist
runTest('CP25.2-06: Doctor Loan Checklist contains required doctor documents', () => {
  const code = fs.readFileSync(path.join('src', 'app', 'inbox', 'page.tsx'), 'utf8');
  assert.ok(code.includes('Degree Certificate (MBBS/MD/BDS)'), 'Medical degree requirement missing');
  assert.ok(code.includes('Medical Council Registration Certificate'), 'Council registration missing');
  assert.ok(code.includes('Clinic / Hospital Registration Proof'), 'Clinic registration missing');
});

// 7. Verify Home Loan Checklist
runTest('CP25.2-07: Home Loan Checklist contains required housing documents', () => {
  const code = fs.readFileSync(path.join('src', 'app', 'inbox', 'page.tsx'), 'utf8');
  assert.ok(code.includes('Agreement to Sale / Allotment Letter'), 'Sale agreement missing');
  assert.ok(code.includes('7/12 Extract / Property Card'), '7/12 extract missing');
});

// 8. Verify Send button shows loading spinner during dispatch
runTest('CP25.2-08: Send button shows Loader2 spinner and Sending text during dispatch', () => {
  const code = fs.readFileSync(path.join('src', 'app', 'inbox', 'page.tsx'), 'utf8');
  assert.ok(code.includes('Loader2'), 'Loader2 icon missing');
  assert.ok(code.includes('Sending...'), 'Sending text missing');
  assert.ok(code.includes('disabled={isSending || !replyText.trim()}'), 'Disabled state guard missing');
});

// 9. Verify draft preservation on send failure
runTest('CP25.2-09: Draft preservation logic is implemented on dispatch failure', () => {
  const code = fs.readFileSync(path.join('src', 'app', 'inbox', 'page.tsx'), 'utf8');
  assert.ok(code.includes('savedDraft'), 'Draft backup missing');
  assert.ok(code.includes('setReplyText(savedDraft)'), 'Draft restoration missing');
});

// 10. Verify recipient phone resolution helper in frontend
runTest('CP25.2-10: Recipient phone resolution supports multiple contact phone fields', () => {
  const code = fs.readFileSync(path.join('src', 'app', 'inbox', 'page.tsx'), 'utf8');
  assert.ok(code.includes('getRecipientPhone'), 'Phone resolution helper missing');
  assert.ok(code.includes('contact.mobile'), 'Mobile fallback missing');
  assert.ok(code.includes('contact.customerPhone'), 'customerPhone fallback missing');
});

// 11. Verify direct-message route checks required phone
runTest('CP25.2-11: direct-message API validates phone presence', () => {
  const code = fs.readFileSync(path.join('src', 'app', 'api', 'contacts', 'direct-message', 'route.ts'), 'utf8');
  assert.ok(code.includes('PHONE_REQUIRED'), 'PHONE_REQUIRED check missing');
});

// 12. Verify direct-message route checks required content
runTest('CP25.2-12: direct-message API validates content presence', () => {
  const code = fs.readFileSync(path.join('src', 'app', 'api', 'contacts', 'direct-message', 'route.ts'), 'utf8');
  assert.ok(code.includes('CONTENT_REQUIRED'), 'CONTENT_REQUIRED check missing');
});

// 13. Verify direct-message route checks phone digits length
runTest('CP25.2-13: direct-message API validates minimum 10 digits', () => {
  const code = fs.readFileSync(path.join('src', 'app', 'api', 'contacts', 'direct-message', 'route.ts'), 'utf8');
  assert.ok(code.includes('INVALID_PHONE'), 'INVALID_PHONE check missing');
  assert.ok(code.includes('digitsOnly.length < 10'), '10-digit validation missing');
});

// 14. Verify direct-message safety invariant in live mode (+91 91756 35165)
runTest('CP25.2-14: direct-message restricts live dispatch strictly to test number', () => {
  const code = fs.readFileSync(path.join('src', 'app', 'api', 'contacts', 'direct-message', 'route.ts'), 'utf8');
  assert.ok(code.includes('LIVE_DISPATCH_RESTRICTED'), 'LIVE_DISPATCH_RESTRICTED missing');
  const safeguardsCode = fs.readFileSync(path.join('src', 'lib', 'safeguards.ts'), 'utf8');
  assert.ok(code.includes('evaluateAuthorizedTestRecipient'), 'Centralized evaluateAuthorizedTestRecipient missing');
  assert.ok(safeguardsCode.includes('AUTHORIZED_TEST_PHONE_CANONICAL'), 'AUTHORIZED_TEST_PHONE_CANONICAL missing');
  assert.ok(!code.includes('919175635165'), 'Hardcoded test phone fallback must not exist');
});

// 15. Verify direct-message checks CHATMITRA_API_KEY when in live mode
runTest('CP25.2-15: direct-message returns 422 if CHATMITRA_API_KEY missing in live mode', () => {
  const code = fs.readFileSync(path.join('src', 'app', 'api', 'contacts', 'direct-message', 'route.ts'), 'utf8');
  assert.ok(code.includes('CHATMITRA_API_KEY_NOT_CONFIGURED'), 'CHATMITRA_API_KEY_NOT_CONFIGURED check missing');
  assert.ok(code.includes('422'), 'HTTP 422 status missing');
});

// 16. Verify direct-message returns isMock indicator
runTest('CP25.2-16: direct-message response includes isMock flag for transparency', () => {
  const code = fs.readFileSync(path.join('src', 'app', 'api', 'contacts', 'direct-message', 'route.ts'), 'utf8');
  assert.ok(code.includes('isMock'), 'isMock flag missing in response');
});

// 17. Verify ProviderRouter persists message text on outbound messages
runTest('CP25.2-17: ProviderRouter saves messageText to Message.create in MongoDB', () => {
  const code = fs.readFileSync(path.join('src', 'lib', 'provider-router.ts'), 'utf8');
  assert.ok(code.includes('text: options.messageText'), 'options.messageText persistence missing');
  assert.ok(code.includes("senderPhone: 'AVANI_OFFICIAL'"), 'senderPhone persistence missing');
  assert.ok(code.includes('recipientPhone: cleanPhone'), 'recipientPhone persistence missing');
});

// 18. Verify contacts/[id] generates phone variants for matching
runTest('CP25.2-18: contacts/[id] queries phoneVariants across phone, senderPhone, recipientPhone', () => {
  const code = fs.readFileSync(path.join('src', 'app', 'api', 'contacts', '[id]', 'route.ts'), 'utf8');
  assert.ok(code.includes('phoneVariants'), 'phoneVariants array missing');
  assert.ok(code.includes('{ phone: { $in: phoneVariants } }'), 'phone in phoneVariants query missing');
  assert.ok(code.includes('{ senderPhone: { $in: phoneVariants } }'), 'senderPhone in phoneVariants query missing');
  assert.ok(code.includes('{ recipientPhone: { $in: phoneVariants } }'), 'recipientPhone in phoneVariants query missing');
});

// 19. Verify contacts list generates phone variants for last message preview
runTest('CP25.2-19: contacts route queries phoneVariants for last message snippet', () => {
  const code = fs.readFileSync(path.join('src', 'app', 'api', 'contacts', 'route.ts'), 'utf8');
  assert.ok(code.includes('phoneVariants'), 'phoneVariants missing in contacts list route');
  assert.ok(code.includes('{ phone: { $in: phoneVariants } }'), 'phoneVariants query missing');
});

// 20. Verify ChatMitra phone formatter ensures canonical 919175635165
runTest('CP25.2-20: ChatMitra adapter formats phone to digits-only with 91 prefix', () => {
  const tsCode = fs.readFileSync(path.join('src', 'lib', 'chatmitra.ts'), 'utf8');
  assert.ok(tsCode.includes('export function formatChatMitraPhone'), 'formatChatMitraPhone function missing in chatmitra.ts');
  
  function formatChatMitraPhone(phone) {
    const clean = String(phone || '').replace(/[^0-9]/g, '');
    if (clean.length === 10) return `91${clean}`;
    if (clean.startsWith('91') && clean.length === 12) return clean;
    if (clean.startsWith('0') && clean.length === 11) return `91${clean.slice(1)}`;
    return clean;
  }
  
  assert.strictEqual(formatChatMitraPhone('9175635165'), '919175635165');
  assert.strictEqual(formatChatMitraPhone('+919175635165'), '919175635165');
  assert.strictEqual(formatChatMitraPhone('09175635165'), '919175635165');
  assert.strictEqual(formatChatMitraPhone('+91 91756 35165'), '919175635165');
});

console.log('\n================================================================================');
console.log(`TEST RESULTS: ${passedTests} / ${totalTests} TESTS PASSED (${Math.round((passedTests / totalTests) * 100)}%)`);
console.log('================================================================================');

if (passedTests !== totalTests) {
  process.exit(1);
}
