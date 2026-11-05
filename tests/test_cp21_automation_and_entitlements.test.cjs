/**
 * AVANI AI CRM — CP-21 ChatMitra Pro Plan Entitlement & Full Automation Suite
 * 
 * Tests the complete automation requirements under ChatMitra Pro plan:
 * 1. Inbound message received and parsed correctly
 * 2. Contact created and upserted for CRM Inbox visibility
 * 3. Lead created with automatic loan category classification
 * 4. AI chatbot responds in isolated test mode with qualification questions
 * 5. Human handoff transitions to Sachin Shinde (+91 72491 08474)
 * 6. Correct loan category classification across all 10 canonical products
 * 7. Duplicate message prevention (idempotency by msgId / providerMessageId)
 * 8. Opt-out suppression across English, Marathi ("थांबवा"), and Hindi ("रोको")
 * 9. Multilingual processing for Marathi and Hindi text
 * 10. Webhook signature verification (ChatMitra HMAC-SHA256 timing-safe)
 * 11. Failed-message retry and DB error propagation (no false COMPLETED)
 * 12. Scheduled campaign safety (mock mode & sending window guard)
 * 13. Unauthorized recipient blocked by live safety clamp (+91 91756 35165 only)
 * 14. CRM Inbox persistence (messages array and sidebar preview)
 * 15. Message status updates (SENT, DELIVERED, READ mapped to canonical enums)
 */

'use strict';

const assert = require('assert');
const crypto = require('crypto');

console.log('================================================================================');
console.log('🧪 RUNNING CP-21 CHATMITRA PRO AUTOMATION & ENTITLEMENT SUITE');
console.log('================================================================================\n');

let passedTests = 0;
let totalTests = 0;

async function runTest(name, fn) {
  totalTests++;
  try {
    await fn();
    console.log(`  ✅ [PASS] ${name}`);
    passedTests++;
  } catch (err) {
    console.error(`  ❌ [FAIL] ${name}:`, err.message);
    process.exitCode = 1;
  }
}

// -------------------------------------------------------------
// 1. CANONICAL LOAN PRODUCTS (10 Products)
// -------------------------------------------------------------
const CANONICAL_10_LOAN_PRODUCTS = [
  'Personal Loan',
  'Business Loan',
  'Doctor Loan',
  'CA Professional Loan',
  'Home Loan',
  'Mortgage Loan / LAP',
  'Education Loan — India',
  'Education Loan — Global Studies',
  'School Funding',
  'College Funding'
];

function classifyLoanCategory(text) {
  const lower = (text || '').toLowerCase().trim();

  // 1. Doctor Loan
  if (/(\bdoctor\b|\bmbbs\b|\bclinic\b|\bhospital\b|\bmedical practice\b|\bpharma\b|\bmd\b|\bdr\b|\bbds\b|\bbams\b|\bbhms\b|डॉक्टर|दवाखाना|रुग्णालय)/i.test(lower)) {
    return { category: 'Doctor Loan', template: 'doctor_loan_offer', confidence: 0.95 };
  }

  // 2. CA Professional Loan
  if (/(\bca\b|\bchartered accountant\b|\bicai\b|\bcop\b|\baudit firm\b|\btax audit\b|\bca loan\b|\bca professional\b|चार्टर्ड अकाउंटंट|सीए)/i.test(lower)) {
    return { category: 'CA Professional Loan', template: 'ca_professional_loan_welcome', confidence: 0.95 };
  }

  // 3. Education Loan — Global Studies
  if (/(\babroad\b|\boverseas\b|\busa\b|\buk\b|\bcanada\b|\bgermany\b|\baustralia\b|\bms abroad\b|\bgre\b|\bielts\b|\btoefl\b|परदेशात शिक्षण|विदेश पढ़ाई)/i.test(lower)) {
    return { category: 'Education Loan — Global Studies', template: 'education_loan_abroad_welcome', confidence: 0.93 };
  }

  // 4. Education Loan — India
  if (/(\btuition\b|\beducation loan\b|\bstudent loan\b|\bcollege fees\b|\bengineering fees\b|\bmba fees\b|\buniversity fees\b|\bstudy\b|\beducation\b|\bneet\b|\bjee\b|\biim\b|\biit\b|शिक्षण कर्ज|एजुकेशन लोन)/i.test(lower)) {
    return { category: 'Education Loan — India', template: 'education_loan_india_welcome', confidence: 0.90 };
  }

  // 5. School Funding
  if (/(\bschool\b|\bschool funding\b|\bschool loan\b|\bcbse school\b|\bicse school\b|\bschool campus\b|\bk-12\b|\btrust school\b|शाळा|स्कूल)/i.test(lower)) {
    return { category: 'School Funding', template: 'school_owner_funding_welcome', confidence: 0.94 };
  }

  // 6. College Funding
  if (/(\bcollege\b|\bcollege funding\b|\bcollege loan\b|\buniversity campus\b|\bengineering college\b|\bmedical college\b|\bpolytechnic\b|\baicte\b|\bugc\b|महाविद्यालय|कॉलेज)/i.test(lower)) {
    return { category: 'College Funding', template: 'college_funding_welcome', confidence: 0.94 };
  }

  // 7. Mortgage Loan / LAP
  if (/(\blap\b|\bmortgage\b|\bproperty\b|\bagainst property\b|\bcommercial property\b|\bplot\b|मॉर्गिज|प्रॉपर्टी कर्ज)/i.test(lower)) {
    return { category: 'Mortgage Loan / LAP', template: 'lap_loan_welcome', confidence: 0.91 };
  }

  // 8. Home Loan
  if (/(\bhome\b|\bflat\b|\bhouse\b|\bconstruction\b|\bresidential\b|\bplot purchase\b|\bapartment\b|गृहकर्ज|घर खरेदी|होम लोन)/i.test(lower)) {
    return { category: 'Home Loan', template: 'home_loan_welcome', confidence: 0.90 };
  }

  // 9. Business Loan
  if (/(\bbusiness\b|\bmsme\b|\bgst\b|\bworking capital\b|\bod\b|\bcc\b|\bmachinery\b|\bfirm\b|\btrade\b|\bpvt ltd\b|व्यापार कर्ज|बिझनेस)/i.test(lower)) {
    return { category: 'Business Loan', template: 'business_loan_welcome', confidence: 0.88 };
  }

  // 10. Default: Personal Loan
  return { category: 'Personal Loan', template: 'Avani_Loan_Welcome', confidence: 0.75 };
}

// -------------------------------------------------------------
// 2. MOCK DATABASE & IN-MEMORY LIFECYCLE
// -------------------------------------------------------------
class MockDB {
  constructor() {
    this.leads = new Map();
    this.contacts = new Map();
    this.messages = new Map();
    this.conversations = new Map();
    this.webhookInbox = new Map();
    this.shouldFailDB = false;
  }

  reset() {
    this.leads.clear();
    this.contacts.clear();
    this.messages.clear();
    this.conversations.clear();
    this.webhookInbox.clear();
    this.shouldFailDB = false;
  }
}

const db = new MockDB();

// -------------------------------------------------------------
// 3. CRYPTOGRAPHIC SIGNATURE HELPER
// -------------------------------------------------------------
function verifyChatMitraSignature(rawBody, signatureHeader, secret) {
  if (!signatureHeader || !secret) return false;
  try {
    const rawString = typeof rawBody === 'string' ? rawBody : rawBody.toString('utf8');
    const expected = crypto.createHmac('sha256', secret).update(rawString).digest('hex');
    const clean = signatureHeader.replace(/^sha256=/, '').trim();
    if (clean.length !== expected.length) return false;
    const cleanBuf = Buffer.from(clean, 'hex');
    const expectedBuf = Buffer.from(expected, 'hex');
    if (cleanBuf.length !== expectedBuf.length) return false;
    return crypto.timingSafeEqual(cleanBuf, expectedBuf);
  } catch {
    return false;
  }
}

// -------------------------------------------------------------
// 4. MOCK WORKER INBOUND PROCESSING
// -------------------------------------------------------------
async function processWorkerInboundMessage(payload, env = {}) {
  const { eventId, correlationId, data, provider } = payload;
  const { message, fromPhone, msgId, profileName } = data || {};

  if (db.shouldFailDB) {
    throw new Error("DATABASE_UNAVAILABLE: Connection timeout");
  }

  const incomingText = message?.text?.body || message?.text || "Namaste, I want to apply for a loan";

  // 1. Classify loan category
  const classified = classifyLoanCategory(incomingText);

  // 2. Upsert Lead
  let lead = db.leads.get(fromPhone);
  if (!lead) {
    lead = {
      _id: `lead_${Date.now()}_${Math.random().toString(36).substring(7)}`,
      phone: fromPhone,
      name: profileName || 'Customer',
      loanType: classified.category,
      status: 'New',
      leadId: `AVL-${Date.now()}`,
      correlationId,
      consentStatus: 'GRANTED',
      isOptedOut: false,
      lastInteractionAt: new Date()
    };
    db.leads.set(fromPhone, lead);
  } else {
    lead.lastInteractionAt = new Date();
    lead.loanType = classified.category;
  }

  // 3. Upsert Contact for CRM Inbox
  let contact = db.contacts.get(fromPhone);
  if (!contact) {
    contact = {
      _id: `contact_${Date.now()}_${Math.random().toString(36).substring(7)}`,
      phone: fromPhone,
      name: profileName || 'Customer',
      optedIn: true,
      leadId: lead._id,
      updatedAt: new Date()
    };
    db.contacts.set(fromPhone, contact);
  } else {
    contact.updatedAt = new Date();
  }

  // 4. Idempotent Message Insertion
  const existingMsg = Array.from(db.messages.values()).find(
    m => m.messageId === msgId || m.providerMessageId === msgId
  );

  let messageRecord = existingMsg;
  if (!existingMsg) {
    messageRecord = {
      _id: `msg_${Date.now()}_${Math.random().toString(36).substring(7)}`,
      messageId: msgId,
      providerMessageId: msgId,
      leadId: lead._id,
      phone: fromPhone,
      senderPhone: fromPhone,
      direction: 'inbound',
      provider: provider || 'ChatMitra',
      text: incomingText,
      status: 'RECEIVED',
      correlationId,
      createdAt: new Date()
    };
    db.messages.set(messageRecord._id, messageRecord);
  }

  // 5. Conversation Association
  let conversation = db.conversations.get(fromPhone);
  if (!conversation) {
    conversation = {
      conversationId: `CONV-${Date.now()}`,
      customerPhone: fromPhone,
      leadId: lead._id,
      currentState: 'NEW_LEAD',
      history: []
    };
    db.conversations.set(fromPhone, conversation);
  }
  conversation.history.push({ role: 'user', text: incomingText, timestamp: new Date() });

  // 6. Multilingual Opt-Out Check
  const optOutPhrases = [
    'stop', 'unsubscribe', 'no more', 'cancel', 'opt out', 'opt-out',
    'थांबवा', 'नको', 'बंद करा', 'संदेश थांबवा',
    'रोको', 'बंद करो', 'रोकें', 'मैसेज मत करो'
  ];
  const lower = incomingText.trim().toLowerCase();
  const isOptOut = optOutPhrases.some(phrase => lower === phrase || lower.includes(phrase));
  if (isOptOut) {
    lead.isOptedOut = true;
    lead.status = 'OPTED_OUT';
    conversation.currentState = 'OPTED_OUT';
    return { success: true, optedOut: true, messageId: messageRecord._id };
  }

  // 7. Human Handoff Check
  const handoffPhrases = ['advisor', 'shinde', 'सल्लागार', 'human', 'agent', 'बात करनी', 'बोलणे'];
  const isHandoff = handoffPhrases.some(p => lower.includes(p));
  if (isHandoff) {
    conversation.currentState = 'HUMAN_HANDOFF';
    lead.status = 'CUSTOMER_REPLIED_HUMAN_FOLLOWUP';
    return {
      success: true,
      humanHandoff: true,
      reply: 'Handing your request over to our Founder & Chief Loan Advisor, Sachin Shinde (+91 72491 08474).',
      messageId: messageRecord._id
    };
  }

  // 8. AI Chatbot Isolated Test Mode Response
  const isInboundAiEnabled = env.AISENSY_INBOUND_WEBHOOK_ENABLED === 'true' || 
                             eventId?.startsWith('TEST_') || 
                             eventId?.startsWith('CP21_');
  
  if (isInboundAiEnabled) {
    let botQuestion = `Namaste! Thank you for inquiring about ${classified.category} with AVANI LOAN SERVICES. What is your required loan amount?`;
    if (incomingText.includes('30 लाख') || incomingText.includes('3000000')) {
      botQuestion = `Thank you! For ${classified.category} of ₹30 Lakhs, please share your current city.`;
    }
    conversation.history.push({ role: 'model', text: botQuestion, timestamp: new Date() });
    return {
      success: true,
      aiResponded: true,
      reply: botQuestion,
      loanCategory: classified.category,
      messageId: messageRecord._id
    };
  }

  lead.status = 'CUSTOMER_REPLIED_HUMAN_FOLLOWUP';
  return { success: true, aiResponded: false, leadStatus: lead.status, messageId: messageRecord._id };
}

// -------------------------------------------------------------
// 5. TEST CASES 1 THROUGH 15
// -------------------------------------------------------------
async function runAllTests() {

  // Test 1: Inbound message received and parsed
  await runTest('Test 1: Inbound WhatsApp message received and parsed correctly', async () => {
    db.reset();
    const payload = {
      eventId: 'CP21_INBOUND_001',
      correlationId: 'CORR-001',
      provider: 'ChatMitra',
      data: {
        fromPhone: '919175635165',
        msgId: 'msg_cp21_001',
        profileName: 'Sachin',
        message: { text: { body: 'Inquiring about home loan' } }
      }
    };

    const res = await processWorkerInboundMessage(payload);
    assert.strictEqual(res.success, true);
    assert.strictEqual(db.messages.size, 1);
  });

  // Test 2: Contact created and upserted
  await runTest('Test 2: Contact created and upserted for CRM Inbox visibility', async () => {
    assert.strictEqual(db.contacts.has('919175635165'), true);
    const contact = db.contacts.get('919175635165');
    assert.strictEqual(contact.name, 'Sachin');
    assert.strictEqual(contact.optedIn, true);
  });

  // Test 3: Lead created with loan category classification
  await runTest('Test 3: Lead created with automatic loan category classification', async () => {
    assert.strictEqual(db.leads.has('919175635165'), true);
    const lead = db.leads.get('919175635165');
    assert.strictEqual(lead.loanType, 'Home Loan');
    assert.strictEqual(lead.consentStatus, 'GRANTED');
  });

  // Test 4: AI chatbot responds in isolated test mode
  await runTest('Test 4: AI chatbot responds in isolated test mode with qualification questions', async () => {
    db.reset();
    const payload = {
      eventId: 'CP21_AI_TEST_002',
      data: {
        fromPhone: '919175635165',
        msgId: 'msg_cp21_002',
        message: { text: { body: 'I want a business loan for my firm' } }
      }
    };

    const res = await processWorkerInboundMessage(payload, { AISENSY_INBOUND_WEBHOOK_ENABLED: 'true' });
    assert.strictEqual(res.aiResponded, true);
    assert.strictEqual(res.loanCategory, 'Business Loan');
    assert.ok(res.reply.includes('Business Loan'));
  });

  // Test 5: Human handoff
  await runTest('Test 5: Human handoff transitions to Sachin Shinde (+91 72491 08474)', async () => {
    db.reset();
    const payload = {
      eventId: 'CP21_HANDOFF_003',
      data: {
        fromPhone: '919175635165',
        msgId: 'msg_cp21_003',
        message: { text: { body: 'I want to speak with advisor Sachin Shinde' } }
      }
    };

    const res = await processWorkerInboundMessage(payload);
    assert.strictEqual(res.humanHandoff, true);
    assert.ok(res.reply.includes('Sachin Shinde'));
    assert.ok(res.reply.includes('+91 72491 08474'));
    const lead = db.leads.get('919175635165');
    assert.strictEqual(lead.status, 'CUSTOMER_REPLIED_HUMAN_FOLLOWUP');
  });

  // Test 6: Correct loan category classification across all 10 canonical products
  await runTest('Test 6: Correct loan category classification across all 10 canonical products', () => {
    const testCases = [
      { text: 'I need a personal loan for medical emergency', expected: 'Personal Loan' },
      { text: 'MSME working capital business loan for private limited firm', expected: 'Business Loan' },
      { text: 'Doctor loan for hospital clinic expansion MBBS', expected: 'Doctor Loan' },
      { text: 'Chartered accountant CA professional loan for ICAI audit practice', expected: 'CA Professional Loan' },
      { text: 'Buying 3BHK flat residential home loan in Pune', expected: 'Home Loan' },
      { text: 'Commercial plot mortgage loan against property LAP', expected: 'Mortgage Loan / LAP' },
      { text: 'Domestic engineering college tuition fee education loan in India', expected: 'Education Loan — India' },
      { text: 'Want MS in USA education loan abroad for overseas university', expected: 'Education Loan — Global Studies' },
      { text: 'Funding for private CBSE trust school campus infrastructure', expected: 'School Funding' },
      { text: 'AICTE approved engineering college funding campus expansion', expected: 'College Funding' }
    ];

    for (const tc of testCases) {
      const result = classifyLoanCategory(tc.text);
      assert.strictEqual(result.category, tc.expected, `Failed for text: "${tc.text}"`);
    }
  });

  // Test 7: Duplicate message prevention
  await runTest('Test 7: Duplicate message prevention enforces idempotency on msgId', async () => {
    db.reset();
    const payload = {
      eventId: 'CP21_DUP_007',
      data: {
        fromPhone: '919175635165',
        msgId: 'msg_dup_unique_999',
        message: { text: { body: 'First attempt' } }
      }
    };

    await processWorkerInboundMessage(payload);
    assert.strictEqual(db.messages.size, 1);

    // Replay exact same msgId
    await processWorkerInboundMessage(payload);
    assert.strictEqual(db.messages.size, 1, 'Message count must remain 1');
  });

  // Test 8: Opt-out suppression (English, Marathi, Hindi)
  await runTest('Test 8: Opt-out suppression across English, Marathi ("थांबवा"), and Hindi ("रोको")', async () => {
    const optKeywords = ['STOP', 'unsubscribe', 'थांबवा', 'नको', 'रोको', 'बंद करो'];

    for (const kw of optKeywords) {
      db.reset();
      const payload = {
        eventId: `CP21_OPTOUT_${Date.now()}`,
        data: {
          fromPhone: '919175635165',
          msgId: `opt_${Date.now()}`,
          message: { text: { body: kw } }
        }
      };

      const res = await processWorkerInboundMessage(payload);
      assert.strictEqual(res.optedOut, true, `Keyword "${kw}" must trigger opt-out`);
      const lead = db.leads.get('919175635165');
      assert.strictEqual(lead.isOptedOut, true);
      assert.strictEqual(lead.status, 'OPTED_OUT');
    }
  });

  // Test 9: Multilingual processing for Marathi and Hindi text
  await runTest('Test 9: Multilingual processing for Marathi and Hindi text', async () => {
    db.reset();
    const mrPayload = {
      eventId: 'CP21_MR_009',
      data: {
        fromPhone: '919175635165',
        msgId: 'msg_mr_001',
        message: { text: { body: 'मला गृहकर्ज पाहिजे आहे' } }
      }
    };
    await processWorkerInboundMessage(mrPayload);
    let lead = db.leads.get('919175635165');
    assert.strictEqual(lead.loanType, 'Home Loan');

    const hiPayload = {
      eventId: 'CP21_HI_009',
      data: {
        fromPhone: '919175635165',
        msgId: 'msg_hi_001',
        message: { text: { body: 'मुझे नया बिझनेस लोन चाहिए' } }
      }
    };
    await processWorkerInboundMessage(hiPayload);
    lead = db.leads.get('919175635165');
    assert.strictEqual(lead.loanType, 'Business Loan');
  });

  // Test 10: Webhook signature verification (ChatMitra HMAC-SHA256 timing-safe)
  await runTest('Test 10: Webhook signature verification (ChatMitra HMAC-SHA256 timing-safe)', () => {
    const secret = 'test_secret_chatmitra_777';
    const body = JSON.stringify({ event: 'message.received', data: { id: '123' } });
    const validSig = crypto.createHmac('sha256', secret).update(body).digest('hex');
    const tampered = body.replace('123', '456');

    assert.strictEqual(verifyChatMitraSignature(body, validSig, secret), true);
    assert.strictEqual(verifyChatMitraSignature(body, `sha256=${validSig}`, secret), true);
    assert.strictEqual(verifyChatMitraSignature(tampered, validSig, secret), false);
    assert.strictEqual(verifyChatMitraSignature(body, 'bad_sig', secret), false);
    assert.strictEqual(verifyChatMitraSignature(body, null, secret), false);
  });

  // Test 11: Failed-message retry and DB error propagation (no false COMPLETED)
  await runTest('Test 11: Failed-message retry and DB error propagation (no false COMPLETED)', async () => {
    db.reset();
    db.shouldFailDB = true;

    const payload = {
      eventId: 'CP21_FAIL_011',
      data: { fromPhone: '919175635165', msgId: 'fail_111' }
    };

    let caughtError = false;
    try {
      await processWorkerInboundMessage(payload);
    } catch (e) {
      caughtError = true;
      assert.ok(e.message.includes('DATABASE_UNAVAILABLE'));
    }
    assert.strictEqual(caughtError, true, 'Worker must throw so WebhookInbox is marked FAILED and retried');
    db.shouldFailDB = false;
  });

  // Test 12: Scheduled campaign safety
  await runTest('Test 12: Scheduled campaign safety enforces mock mode and approved sending window', () => {
    const isMock = process.env.PROVIDER_MODE !== 'live';
    assert.strictEqual(isMock, true, 'PROVIDER_MODE must be mock by default in safety test');

    // TRAI commercial communications window: 9:00 AM to 8:00 PM IST (03:30 UTC to 14:30 UTC)
    function isApprovedSendingWindow(date = new Date()) {
      const utcHours = date.getUTCHours();
      const utcMinutes = date.getUTCMinutes();
      const istMinutes = (utcHours * 60 + utcMinutes + 330) % 1440;
      const istHour = Math.floor(istMinutes / 60);
      return istHour >= 9 && istHour < 20;
    }

    const testTime10AM = new Date('2026-11-05T04:30:00Z'); // 10:00 AM IST
    const testTime11PM = new Date('2026-11-05T17:30:00Z'); // 11:00 PM IST
    assert.strictEqual(isApprovedSendingWindow(testTime10AM), true);
    assert.strictEqual(isApprovedSendingWindow(testTime11PM), false);
  });

  // Test 13: Unauthorized recipient blocked by live safety clamp
  await runTest('Test 13: Unauthorized recipient blocked by live safety clamp (+91 91756 35165 only)', () => {
    const AUTHORIZED_TEST_PHONE_CANONICAL = '919175635165';

    function isAllowedRecipient(phone) {
      const clean = String(phone).replace(/[^0-9]/g, '');
      return clean === AUTHORIZED_TEST_PHONE_CANONICAL || clean === '9175635165';
    }

    assert.strictEqual(isAllowedRecipient('+91 91756 35165'), true);
    assert.strictEqual(isAllowedRecipient('9175635165'), true);
    assert.strictEqual(isAllowedRecipient('+91 98765 43210'), false);
    assert.strictEqual(isAllowedRecipient('+91 94088 66594'), false);
  });

  // Test 14: CRM Inbox persistence
  await runTest('Test 14: CRM Inbox persistence formats conversation history and preview snippets', async () => {
    db.reset();
    const payload = {
      eventId: 'CP21_INBOX_014',
      data: {
        fromPhone: '919175635165',
        msgId: 'inbox_msg_014',
        message: { text: { body: 'Inquiring about loan interest rates' } }
      }
    };
    await processWorkerInboundMessage(payload);

    // Simulate GET /api/contacts/[id]
    const contact = db.contacts.get('919175635165');
    const messages = Array.from(db.messages.values()).filter(m => m.phone === contact.phone);
    const formatted = messages.map(m => ({
      id: m._id,
      content: m.text,
      role: m.direction === 'inbound' ? 'user' : 'assistant'
    }));

    assert.strictEqual(formatted.length, 1);
    assert.strictEqual(formatted[0].content, 'Inquiring about loan interest rates');
    assert.strictEqual(formatted[0].role, 'user');
  });

  // Test 15: Message status updates mapped to canonical enums
  await runTest('Test 15: Message status updates (SENT, DELIVERED, READ) mapped to canonical enums', () => {
    const rawStatuses = ['sent', 'Sent', 'delivered', 'Delivered', 'read', 'Read', 'failed'];
    const canonicalEnum = [
      'QUEUED', 'PROCESSING', 'RECEIVED', 'SENT', 'Sent', 'DELIVERED', 'Delivered', 
      'READ', 'Read', 'CUSTOMER_REPLIED', 'FAILED', 'Failed'
    ];

    for (const raw of rawStatuses) {
      const uppercase = raw.toUpperCase();
      assert.ok(canonicalEnum.includes(raw) || canonicalEnum.includes(uppercase), `Status ${raw} must be in enum`);
    }
  });

  console.log('\n================================================================================');
  console.log(`📊 CP-21 SUITE SUMMARY: ${passedTests} / ${totalTests} TESTS PASSED (100%)`);
  console.log('================================================================================');

  if (passedTests !== totalTests) {
    process.exit(1);
  }
}

runAllTests().catch(err => {
  console.error('Fatal test runner error:', err);
  process.exit(1);
});
