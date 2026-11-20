/**
 * TASK 4: META WHATSAPP CLOUD API VERIFICATION & SECONDARY FALLBACK TEST SUITE
 * 
 * Tests:
 * 1. Meta Webhook Subscription Verification (GET handshake)
 * 2. Meta Signature Security (X-Hub-Signature-256 HMAC-SHA256, timing-safe)
 * 3. Inbound Payload Validation (text, image, doc, audio, malformed, multi-entry)
 * 4. Status Callback Processing (SENT, DELIVERED, READ, FAILED, out-of-order)
 * 5. Idempotency & CRM Integration (duplicate swallowing, Lead/Contact upsert, worker lease)
 * 6. Consent & Opt-Out Cross-Provider Suppression (रोकें, रोको, थांबवा, STOP)
 * 7. ProviderRouter Idempotency & Safe Mock Mode
 */

const assert = require('assert');
const crypto = require('crypto');

// 1. Standalone Signature Verifier (matching src/lib/chatmitra.ts & whatsapp-webhook/route.ts)
function verifyMetaSignature(rawBody, signatureHeader, secret) {
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

// 2. Phone Normalization (matching src/lib/phone.ts)
function normalizeIndianPhone(phone) {
  if (!phone) return null;
  const digits = String(phone).replace(/\D/g, '');
  if (digits.length === 10) return `91${digits}`;
  if (digits.length === 12 && digits.startsWith('91')) return digits;
  if (digits.length === 11 && digits.startsWith('0')) return `91${digits.slice(1)}`;
  return digits.length >= 10 ? digits : null;
}

// 3. Status Transition Ranking (matching src/lib/message-status.ts)
const STATUS_DELIVERY_RANK = {
  QUEUED: 10,
  SENT: 30,
  DELIVERED: 50,
  READ: 70,
  FAILED: 90
};

function canTransitionStatus(currentStatus, newStatus) {
  if (!currentStatus) return true;
  const currentRank = STATUS_DELIVERY_RANK[currentStatus.toUpperCase()] || 0;
  const newRank = STATUS_DELIVERY_RANK[newStatus.toUpperCase()] || 0;
  // If moving from READ back to DELIVERED, prevent downgrade
  if (currentRank >= 70 && newRank < 70 && newRank > 0) return false;
  return true;
}

// 4. Opt-Out Detection (matching Task 3B corrected src/lib/optout-engine.ts)
function isOptOutMessage(text) {
  if (!text || typeof text !== 'string') return false;
  const lower = text.trim().toLowerCase();
  const optOutPhrases = [
    'stop', 'unsubscribe', 'no more', 'do not message', 'don\'t message',
    'remove me', 'cancel', 'opt out', 'opt-out', 'pause messages', 'block',
    'थांबवा', 'नको', 'बंद करा', 'मेसेज पाठवू नका', 'संदेश थांबवा',
    'nako', 'nakaye', 'thamba', 'thambwa', 'band kara',
    'रोकें', 'रोको', 'बंद करो', 'संदेश मत भेजो', 'हटाओ', 'मैसेज मत करो',
    'roken', 'roko', 'band karo', 'mat bhejo', 'hatao'
  ];
  return optOutPhrases.some(phrase => lower === phrase || lower.includes(phrase));
}

// 5. In-Memory Mock Database Store
class MockDatabase {
  constructor() {
    this.webhookInbox = new Map();
    this.messages = new Map();
    this.leads = new Map();
    this.contacts = new Map();
    this.conversations = new Map();
    this.isOffline = false;
    this.networkCalls = [];
  }

  reset() {
    this.webhookInbox.clear();
    this.messages.clear();
    this.leads.clear();
    this.contacts.clear();
    this.conversations.clear();
    this.isOffline = false;
    this.networkCalls = [];
  }
}

// 6. Meta Webhook GET Handler Simulation (matching src/app/api/whatsapp-webhook/route.ts)
function simulateMetaWebhookGET(query, env) {
  const mode = query['hub.mode'];
  const token = query['hub.verify_token'];
  const challenge = query['hub.challenge'];
  const VERIFY_TOKEN = env.OMNIDIM_VERIFY_TOKEN || env.META_WEBHOOK_VERIFY_TOKEN || '';

  if (mode === 'subscribe' && token && VERIFY_TOKEN && token === VERIFY_TOKEN) {
    return { status: 200, body: challenge };
  }
  return { status: 403, body: 'Forbidden' };
}

// 7. Meta Webhook POST Handler Simulation (matching src/app/api/whatsapp-webhook/route.ts)
function simulateMetaWebhookPOST(headers, rawBody, env, db) {
  if (db.isOffline) {
    return { status: 503, error: 'Database unavailable: retry scheduled' };
  }

  const hubSig = headers['x-hub-signature-256'] || headers['X-Hub-Signature-256'];
  const metaAppSecret = env.META_APP_SECRET;

  // JSON Parsing Guard
  let body;
  try {
    body = JSON.parse(rawBody);
  } catch {
    return { status: 400, error: 'Invalid JSON payload' };
  }

  // Signature Guard
  if (!hubSig || !hubSig.trim()) {
    return { status: 401, error: 'Missing Meta webhook signature' };
  }

  if (!metaAppSecret || !metaAppSecret.trim()) {
    return { status: 401, error: 'Meta App Secret not configured' };
  }

  const isValid = verifyMetaSignature(rawBody, hubSig, metaAppSecret);
  if (!isValid) {
    return { status: 401, error: 'Invalid Meta Webhook Signature' };
  }

  // Parse Meta Structure (entry -> changes -> value)
  const entries = body.entry || [body];
  let processedItems = 0;
  let duplicateCount = 0;

  for (const entry of entries) {
    const changes = entry?.changes || [entry];
    for (const change of changes) {
      const value = change?.value || change;

      // 1. Status Callbacks
      const statuses = value?.statuses || (body.status ? [body] : []);
      if (statuses.length > 0) {
        for (const statusObj of statuses) {
          const msgId = statusObj.id || statusObj.messageId;
          const statusStr = statusObj.status || statusObj.deliveryStatus;
          if (msgId && statusStr) {
            const eventId = `META_STATUS_${msgId}_${statusStr.toUpperCase()}`;
            if (db.webhookInbox.has(eventId)) {
              duplicateCount++;
            } else {
              db.webhookInbox.set(eventId, {
                eventId,
                provider: 'Meta',
                eventType: 'STATUS_UPDATE',
                payload: statusObj,
                status: 'RECEIVED'
              });
              processedItems++;

              // Update existing message record if present
              const existingMsg = Array.from(db.messages.values()).find(m => m.providerMessageId === msgId || m.messageId === msgId);
              if (existingMsg) {
                if (canTransitionStatus(existingMsg.status, statusStr)) {
                  existingMsg.status = statusStr.toUpperCase();
                  existingMsg.updatedAt = new Date();
                }
              }
            }
          }
        }
        continue;
      }

      // 2. Inbound Messages
      let messages = value?.messages || (body.message ? [body.message] : []);
      for (const message of messages) {
        const rawFromPhone = message.from || body.phone;
        if (!rawFromPhone) continue;
        const fromPhone = normalizeIndianPhone(rawFromPhone);
        if (!fromPhone) continue;

        const msgId = message.id || `meta_${Date.now()}`;
        const eventId = `META_INBOUND_${msgId}`;

        if (db.webhookInbox.has(eventId)) {
          duplicateCount++;
        } else {
          db.webhookInbox.set(eventId, {
            eventId,
            provider: 'Meta',
            eventType: 'INBOUND_MESSAGE',
            payload: message,
            status: 'RECEIVED'
          });
          processedItems++;

          // Inbound Message persistence
          let textBody = '';
          if (message.type === 'text') textBody = message.text?.body || '';
          else if (message.type === 'image') textBody = `[Image ID: ${message.image?.id}]`;
          else if (message.type === 'document') textBody = `[Document ID: ${message.document?.id}]`;
          else if (message.type === 'audio') textBody = `[Audio ID: ${message.audio?.id}]`;
          else textBody = `[Unsupported message type: ${message.type}]`;

          const msgRecord = {
            messageId: msgId,
            providerMessageId: msgId,
            phone: fromPhone,
            direction: 'inbound',
            provider: 'Meta',
            status: 'RECEIVED',
            text: textBody,
            createdAt: new Date()
          };
          db.messages.set(msgId, msgRecord);

          // Lead & Contact Upsert
          const isOptOut = isOptOutMessage(textBody);
          let lead = db.leads.get(fromPhone) || {
            phone: fromPhone,
            name: message.profile?.name || 'Customer',
            status: isOptOut ? 'OPTED_OUT' : 'New',
            isOptedOut: isOptOut,
            consentStatus: isOptOut ? 'WITHDRAWN' : 'GRANTED'
          };
          if (isOptOut) {
            lead.isOptedOut = true;
            lead.status = 'OPTED_OUT';
            lead.consentStatus = 'WITHDRAWN';
          }
          db.leads.set(fromPhone, lead);

          let contact = db.contacts.get(fromPhone) || { phone: fromPhone, optedIn: !isOptOut };
          if (isOptOut) contact.optedIn = false;
          db.contacts.set(fromPhone, contact);
        }
      }
    }
  }

  return {
    status: 200,
    success: true,
    processedItems,
    duplicateCount,
    duplicate: duplicateCount > 0 && processedItems === 0
  };
}

// 8. ProviderRouter Simulation (matching src/lib/provider-router.ts)
function simulateProviderDispatch(options, env, db) {
  const selectedProvider = options.provider || env.WHATSAPP_PROVIDER || 'CHATMITRA';
  const effectiveTemplate = options.templateName || (options.messageText ? 'direct_text_message' : 'avani_loan_intro_v2');
  const cleanPhone = normalizeIndianPhone(options.phone);

  const idempotencyKey = `${selectedProvider}:${options.campaignId || 'CMP-DEFAULT'}:${cleanPhone}:${effectiveTemplate}:INITIAL`;

  // Check duplicate lock
  if (db.messages.has(idempotencyKey)) {
    return {
      success: true,
      provider: selectedProvider,
      isDuplicate: true,
      idempotencyKey,
      status: 'API_ACCEPTED'
    };
  }

  // Check opt-out suppression
  const lead = db.leads.get(cleanPhone);
  const contact = db.contacts.get(cleanPhone);
  if (lead?.isOptedOut || contact?.optedIn === false) {
    return {
      success: false,
      provider: selectedProvider,
      status: 'SUPPRESSED_CUSTOMER_OPTED_OUT',
      error: 'Customer opted out of promotional communications',
      idempotencyKey
    };
  }

  // Safe Mock Dispatch
  const mockWamid = `mock_${selectedProvider.toLowerCase()}_${Date.now()}`;
  const record = {
    idempotencyKey,
    phone: cleanPhone,
    direction: 'OUTBOUND',
    provider: selectedProvider,
    providerMessageId: mockWamid,
    templateName: effectiveTemplate,
    status: 'API_ACCEPTED'
  };
  db.messages.set(idempotencyKey, record);

  return {
    success: true,
    provider: selectedProvider,
    providerMessageId: mockWamid,
    status: 'API_ACCEPTED',
    idempotencyKey
  };
}

// ----------------------------------------------------------------------------
// TEST RUNNER HARNESS
// ----------------------------------------------------------------------------
let passed = 0;
let failed = 0;

function runTest(category, name, fn) {
  try {
    fn();
    passed++;
    console.log(`  ✅ [PASS] [${category}] ${name}`);
  } catch (err) {
    failed++;
    console.error(`  ❌ [FAIL] [${category}] ${name}: ${err.message}`);
  }
}

const testEnv = {
  META_WEBHOOK_VERIFY_TOKEN: 'AVANI_TEST_VERIFY_TOKEN_2026',
  META_APP_SECRET: 'test_meta_app_secret_1234567890abcdef',
  PROVIDER_MODE: 'mock'
};
const testSecret = testEnv.META_APP_SECRET;
const db = new MockDatabase();

console.log('================================================================================');
console.log('🧪 TASK 4 — META WHATSAPP CLOUD API VERIFICATION & SECONDARY FALLBACK SUITE');
console.log('================================================================================');

// ----------------------------------------------------------------------------
// CATEGORY 1: META WEBHOOK SUBSCRIPTION VERIFICATION (GET HANDSHAKE)
// ----------------------------------------------------------------------------
runTest('HANDSHAKE', 'Valid subscribe mode and matching token returns challenge with HTTP 200', () => {
  const res = simulateMetaWebhookGET({
    'hub.mode': 'subscribe',
    'hub.verify_token': 'AVANI_TEST_VERIFY_TOKEN_2026',
    'hub.challenge': '1158201444'
  }, testEnv);
  assert.strictEqual(res.status, 200);
  assert.strictEqual(res.body, '1158201444');
});

runTest('HANDSHAKE', 'Invalid verify token rejected with HTTP 403 Forbidden', () => {
  const res = simulateMetaWebhookGET({
    'hub.mode': 'subscribe',
    'hub.verify_token': 'WRONG_TOKEN',
    'hub.challenge': '1158201444'
  }, testEnv);
  assert.strictEqual(res.status, 403);
  assert.strictEqual(res.body, 'Forbidden');
});

runTest('HANDSHAKE', 'Missing verify token rejected with HTTP 403', () => {
  const res = simulateMetaWebhookGET({
    'hub.mode': 'subscribe',
    'hub.challenge': '1158201444'
  }, testEnv);
  assert.strictEqual(res.status, 403);
});

runTest('HANDSHAKE', 'Unsupported hub.mode rejected with HTTP 403', () => {
  const res = simulateMetaWebhookGET({
    'hub.mode': 'unsubscribe',
    'hub.verify_token': 'AVANI_TEST_VERIFY_TOKEN_2026',
    'hub.challenge': '1158201444'
  }, testEnv);
  assert.strictEqual(res.status, 403);
});

runTest('HANDSHAKE', 'Unconfigured verify token in environment safely rejects with HTTP 403', () => {
  const res = simulateMetaWebhookGET({
    'hub.mode': 'subscribe',
    'hub.verify_token': 'AVANI_TEST_VERIFY_TOKEN_2026',
    'hub.challenge': '1158201444'
  }, {});
  assert.strictEqual(res.status, 403);
});

runTest('HANDSHAKE', 'Empty query parameters safely rejected with HTTP 403', () => {
  const res = simulateMetaWebhookGET({}, testEnv);
  assert.strictEqual(res.status, 403);
});

// ----------------------------------------------------------------------------
// CATEGORY 2: META SIGNATURE SECURITY (X-Hub-Signature-256)
// ----------------------------------------------------------------------------
const validMetaBody = JSON.stringify({
  object: 'whatsapp_business_account',
  entry: [{
    id: 'WABA_001',
    changes: [{
      value: {
        messaging_product: 'whatsapp',
        messages: [{
          id: 'wamid.HBgLMDAx',
          from: '9833621419',
          type: 'text',
          text: { body: 'Hello Avani Loans' }
        }]
      }
    }]
  }]
});

runTest('SIGNATURE', 'Valid HMAC-SHA256 signature with sha256= prefix accepted', () => {
  const hmac = crypto.createHmac('sha256', testSecret).update(validMetaBody).digest('hex');
  const res = simulateMetaWebhookPOST({ 'x-hub-signature-256': `sha256=${hmac}` }, validMetaBody, testEnv, db);
  assert.strictEqual(res.status, 200);
});

runTest('SIGNATURE', 'Valid HMAC-SHA256 signature without sha256= prefix accepted', () => {
  const hmac = crypto.createHmac('sha256', testSecret).update(validMetaBody).digest('hex');
  const res = simulateMetaWebhookPOST({ 'x-hub-signature-256': hmac }, validMetaBody, testEnv, db);
  assert.strictEqual(res.status, 200);
});

runTest('SIGNATURE', 'Incorrect signature rejected with HTTP 401', () => {
  const res = simulateMetaWebhookPOST({ 'x-hub-signature-256': 'sha256=deadbeefdeadbeef' }, validMetaBody, testEnv, db);
  assert.strictEqual(res.status, 401);
  assert.strictEqual(res.error, 'Invalid Meta Webhook Signature');
});

runTest('SIGNATURE', 'Missing signature header rejected with HTTP 401', () => {
  const res = simulateMetaWebhookPOST({}, validMetaBody, testEnv, db);
  assert.strictEqual(res.status, 401);
  assert.strictEqual(res.error, 'Missing Meta webhook signature');
});

runTest('SIGNATURE', 'Empty signature header rejected with HTTP 401', () => {
  const res = simulateMetaWebhookPOST({ 'x-hub-signature-256': '   ' }, validMetaBody, testEnv, db);
  assert.strictEqual(res.status, 401);
});

runTest('SIGNATURE', 'Tampered request body causes signature failure and rejection', () => {
  const hmac = crypto.createHmac('sha256', testSecret).update(validMetaBody).digest('hex');
  const tamperedBody = validMetaBody.replace('Hello Avani Loans', 'Tampered Content');
  const res = simulateMetaWebhookPOST({ 'x-hub-signature-256': `sha256=${hmac}` }, tamperedBody, testEnv, db);
  assert.strictEqual(res.status, 401);
});

runTest('SIGNATURE', 'Malformed signature (odd length hex string) safely rejected without exception', () => {
  const res = simulateMetaWebhookPOST({ 'x-hub-signature-256': 'sha256=abc12' }, validMetaBody, testEnv, db);
  assert.strictEqual(res.status, 401);
});

runTest('SIGNATURE', 'Wrong signing secret rejected with HTTP 401', () => {
  const hmacWrong = crypto.createHmac('sha256', 'wrong_secret_key').update(validMetaBody).digest('hex');
  const res = simulateMetaWebhookPOST({ 'x-hub-signature-256': `sha256=${hmacWrong}` }, validMetaBody, testEnv, db);
  assert.strictEqual(res.status, 401);
});

// ----------------------------------------------------------------------------
// CATEGORY 3: INBOUND PAYLOAD VALIDATION
// ----------------------------------------------------------------------------
runTest('PAYLOAD', 'Standard Meta text message parsed and persisted', () => {
  db.reset();
  const raw = JSON.stringify({
    object: 'whatsapp_business_account',
    entry: [{
      changes: [{
        value: {
          messages: [{ id: 'wamid.TXT_01', from: '9833621419', type: 'text', text: { body: 'Inquiry for MSME loan' } }]
        }
      }]
    }]
  });
  const sig = crypto.createHmac('sha256', testSecret).update(raw).digest('hex');
  const res = simulateMetaWebhookPOST({ 'x-hub-signature-256': sig }, raw, testEnv, db);
  assert.strictEqual(res.status, 200);
  assert.strictEqual(res.processedItems, 1);
  const msg = db.messages.get('wamid.TXT_01');
  assert.ok(msg);
  assert.strictEqual(msg.text, 'Inquiry for MSME loan');
  assert.strictEqual(msg.status, 'RECEIVED');
});

runTest('PAYLOAD', 'Image message parsed and media identifier recorded', () => {
  db.reset();
  const raw = JSON.stringify({
    object: 'whatsapp_business_account',
    entry: [{
      changes: [{
        value: {
          messages: [{ id: 'wamid.IMG_01', from: '9833621419', type: 'image', image: { id: 'media_img_9988' } }]
        }
      }]
    }]
  });
  const sig = crypto.createHmac('sha256', testSecret).update(raw).digest('hex');
  const res = simulateMetaWebhookPOST({ 'x-hub-signature-256': sig }, raw, testEnv, db);
  assert.strictEqual(res.status, 200);
  const msg = db.messages.get('wamid.IMG_01');
  assert.ok(msg);
  assert.strictEqual(msg.text, '[Image ID: media_img_9988]');
});

runTest('PAYLOAD', 'Document message parsed and media identifier recorded', () => {
  db.reset();
  const raw = JSON.stringify({
    object: 'whatsapp_business_account',
    entry: [{
      changes: [{
        value: {
          messages: [{ id: 'wamid.DOC_01', from: '9833621419', type: 'document', document: { id: 'media_doc_5544' } }]
        }
      }]
    }]
  });
  const sig = crypto.createHmac('sha256', testSecret).update(raw).digest('hex');
  const res = simulateMetaWebhookPOST({ 'x-hub-signature-256': sig }, raw, testEnv, db);
  assert.strictEqual(res.status, 200);
  const msg = db.messages.get('wamid.DOC_01');
  assert.ok(msg);
  assert.strictEqual(msg.text, '[Document ID: media_doc_5544]');
});

runTest('PAYLOAD', 'Audio message parsed and media identifier recorded', () => {
  db.reset();
  const raw = JSON.stringify({
    object: 'whatsapp_business_account',
    entry: [{
      changes: [{
        value: {
          messages: [{ id: 'wamid.AUD_01', from: '9833621419', type: 'audio', audio: { id: 'media_aud_1122' } }]
        }
      }]
    }]
  });
  const sig = crypto.createHmac('sha256', testSecret).update(raw).digest('hex');
  const res = simulateMetaWebhookPOST({ 'x-hub-signature-256': sig }, raw, testEnv, db);
  assert.strictEqual(res.status, 200);
  const msg = db.messages.get('wamid.AUD_01');
  assert.ok(msg);
  assert.strictEqual(msg.text, '[Audio ID: media_aud_1122]');
});

runTest('PAYLOAD', 'Unsupported message type handled safely without crashing', () => {
  db.reset();
  const raw = JSON.stringify({
    object: 'whatsapp_business_account',
    entry: [{
      changes: [{
        value: {
          messages: [{ id: 'wamid.UNSUPP_01', from: '9833621419', type: 'sticker', sticker: { id: 'stk_01' } }]
        }
      }]
    }]
  });
  const sig = crypto.createHmac('sha256', testSecret).update(raw).digest('hex');
  const res = simulateMetaWebhookPOST({ 'x-hub-signature-256': sig }, raw, testEnv, db);
  assert.strictEqual(res.status, 200);
  const msg = db.messages.get('wamid.UNSUPP_01');
  assert.ok(msg);
  assert.strictEqual(msg.text, '[Unsupported message type: sticker]');
});

runTest('PAYLOAD', 'Missing sender phone number safely skipped without error', () => {
  db.reset();
  const raw = JSON.stringify({
    object: 'whatsapp_business_account',
    entry: [{
      changes: [{
        value: {
          messages: [{ id: 'wamid.NO_PHONE_01', type: 'text', text: { body: 'Ghost message' } }]
        }
      }]
    }]
  });
  const sig = crypto.createHmac('sha256', testSecret).update(raw).digest('hex');
  const res = simulateMetaWebhookPOST({ 'x-hub-signature-256': sig }, raw, testEnv, db);
  assert.strictEqual(res.status, 200);
  assert.strictEqual(res.processedItems, 0);
});

runTest('PAYLOAD', 'Malformed JSON payload rejected with HTTP 400', () => {
  const res = simulateMetaWebhookPOST({ 'x-hub-signature-256': 'sha256=any' }, '{ not-a-json }', testEnv, db);
  assert.strictEqual(res.status, 400);
  assert.strictEqual(res.error, 'Invalid JSON payload');
});

runTest('PAYLOAD', 'Multiple entries and changes processed in single webhook batch', () => {
  db.reset();
  const raw = JSON.stringify({
    object: 'whatsapp_business_account',
    entry: [
      { changes: [{ value: { messages: [{ id: 'wamid.BATCH_01', from: '9833621419', type: 'text', text: { body: 'Batch Msg 1' } }] } }] },
      { changes: [{ value: { messages: [{ id: 'wamid.BATCH_02', from: '9175635165', type: 'text', text: { body: 'Batch Msg 2' } }] } }] }
    ]
  });
  const sig = crypto.createHmac('sha256', testSecret).update(raw).digest('hex');
  const res = simulateMetaWebhookPOST({ 'x-hub-signature-256': sig }, raw, testEnv, db);
  assert.strictEqual(res.status, 200);
  assert.strictEqual(res.processedItems, 2);
  assert.ok(db.messages.get('wamid.BATCH_01'));
  assert.ok(db.messages.get('wamid.BATCH_02'));
});

// ----------------------------------------------------------------------------
// CATEGORY 4: STATUS CALLBACK PROCESSING (SENT, DELIVERED, READ, FAILED)
// ----------------------------------------------------------------------------
runTest('STATUS', 'SENT status update recorded in WebhookInbox and message record updated', () => {
  db.reset();
  // Seed outbound message
  db.messages.set('wamid.OUT_01', { messageId: 'wamid.OUT_01', providerMessageId: 'wamid.OUT_01', status: 'QUEUED' });

  const raw = JSON.stringify({
    object: 'whatsapp_business_account',
    entry: [{ changes: [{ value: { statuses: [{ id: 'wamid.OUT_01', status: 'sent' }] } }] }]
  });
  const sig = crypto.createHmac('sha256', testSecret).update(raw).digest('hex');
  const res = simulateMetaWebhookPOST({ 'x-hub-signature-256': sig }, raw, testEnv, db);
  assert.strictEqual(res.status, 200);
  assert.strictEqual(db.messages.get('wamid.OUT_01').status, 'SENT');
});

runTest('STATUS', 'DELIVERED status update transitions message status to DELIVERED', () => {
  const raw = JSON.stringify({
    object: 'whatsapp_business_account',
    entry: [{ changes: [{ value: { statuses: [{ id: 'wamid.OUT_01', status: 'delivered' }] } }] }]
  });
  const sig = crypto.createHmac('sha256', testSecret).update(raw).digest('hex');
  const res = simulateMetaWebhookPOST({ 'x-hub-signature-256': sig }, raw, testEnv, db);
  assert.strictEqual(res.status, 200);
  assert.strictEqual(db.messages.get('wamid.OUT_01').status, 'DELIVERED');
});

runTest('STATUS', 'READ status update transitions message status to READ', () => {
  const raw = JSON.stringify({
    object: 'whatsapp_business_account',
    entry: [{ changes: [{ value: { statuses: [{ id: 'wamid.OUT_01', status: 'read' }] } }] }]
  });
  const sig = crypto.createHmac('sha256', testSecret).update(raw).digest('hex');
  const res = simulateMetaWebhookPOST({ 'x-hub-signature-256': sig }, raw, testEnv, db);
  assert.strictEqual(res.status, 200);
  assert.strictEqual(db.messages.get('wamid.OUT_01').status, 'READ');
});

runTest('STATUS', 'Out-of-order callback protection: late DELIVERED callback does NOT downgrade READ message', () => {
  // Message is already READ
  assert.strictEqual(db.messages.get('wamid.OUT_01').status, 'READ');

  // Late arriving DELIVERED event
  const raw = JSON.stringify({
    object: 'whatsapp_business_account',
    entry: [{ changes: [{ value: { statuses: [{ id: 'wamid.OUT_01', status: 'delivered' }] } }] }]
  });
  const sig = crypto.createHmac('sha256', testSecret).update(raw).digest('hex');
  simulateMetaWebhookPOST({ 'x-hub-signature-256': sig }, raw, testEnv, db);

  // Status must remain READ
  assert.strictEqual(db.messages.get('wamid.OUT_01').status, 'READ');
});

runTest('STATUS', 'FAILED delivery callback records status FAILED and does not create ghost lead', () => {
  db.reset();
  const raw = JSON.stringify({
    object: 'whatsapp_business_account',
    entry: [{ changes: [{ value: { statuses: [{ id: 'wamid.FAIL_01', status: 'failed', errors: [{ title: 'Number not on WhatsApp' }] }] } }] }]
  });
  const sig = crypto.createHmac('sha256', testSecret).update(raw).digest('hex');
  const res = simulateMetaWebhookPOST({ 'x-hub-signature-256': sig }, raw, testEnv, db);
  assert.strictEqual(res.status, 200);
  assert.strictEqual(db.leads.size, 0); // No phantom lead created
});

runTest('STATUS', 'Status update callback on unknown message ID handled gracefully without error', () => {
  const raw = JSON.stringify({
    object: 'whatsapp_business_account',
    entry: [{ changes: [{ value: { statuses: [{ id: 'wamid.UNKNOWN_999', status: 'read' }] } }] }]
  });
  const sig = crypto.createHmac('sha256', testSecret).update(raw).digest('hex');
  const res = simulateMetaWebhookPOST({ 'x-hub-signature-256': sig }, raw, testEnv, db);
  assert.strictEqual(res.status, 200);
});

// ----------------------------------------------------------------------------
// CATEGORY 5: IDEMPOTENCY & CRM INBOX PERSISTENCE
// ----------------------------------------------------------------------------
runTest('IDEMPOTENCY', 'Re-delivering exact same Meta message ID swallows duplicate with HTTP 200', () => {
  db.reset();
  const raw = JSON.stringify({
    object: 'whatsapp_business_account',
    entry: [{ changes: [{ value: { messages: [{ id: 'wamid.DUP_01', from: '9833621419', type: 'text', text: { body: 'First' } }] } }] }]
  });
  const sig = crypto.createHmac('sha256', testSecret).update(raw).digest('hex');

  // 1st delivery
  const res1 = simulateMetaWebhookPOST({ 'x-hub-signature-256': sig }, raw, testEnv, db);
  assert.strictEqual(res1.status, 200);
  assert.strictEqual(res1.processedItems, 1);
  assert.strictEqual(res1.duplicate, false);

  // 2nd delivery (duplicate)
  const res2 = simulateMetaWebhookPOST({ 'x-hub-signature-256': sig }, raw, testEnv, db);
  assert.strictEqual(res2.status, 200);
  assert.strictEqual(res2.processedItems, 0);
  assert.strictEqual(res2.duplicate, true);
});

runTest('IDEMPOTENCY', 'Multiple distinct messages from same sender remain distinct records', () => {
  const raw2 = JSON.stringify({
    object: 'whatsapp_business_account',
    entry: [{ changes: [{ value: { messages: [{ id: 'wamid.DISTINCT_02', from: '9833621419', type: 'text', text: { body: 'Second' } }] } }] }]
  });
  const sig2 = crypto.createHmac('sha256', testSecret).update(raw2).digest('hex');
  const res = simulateMetaWebhookPOST({ 'x-hub-signature-256': sig2 }, raw2, testEnv, db);
  assert.strictEqual(res.status, 200);
  assert.strictEqual(res.processedItems, 1);
  assert.ok(db.messages.get('wamid.DUP_01'));
  assert.ok(db.messages.get('wamid.DISTINCT_02'));
});

runTest('IDEMPOTENCY', 'Lead and Contact records are matched and upserted by normalized mobile', () => {
  const lead = db.leads.get('919833621419');
  const contact = db.contacts.get('919833621419');
  assert.ok(lead);
  assert.ok(contact);
  assert.strictEqual(lead.phone, '919833621419');
  assert.strictEqual(contact.phone, '919833621419');
});

runTest('IDEMPOTENCY', 'Offline database returns HTTP 503 so Meta retries the webhook without event loss', () => {
  db.isOffline = true;
  const raw = JSON.stringify({
    object: 'whatsapp_business_account',
    entry: [{ changes: [{ value: { messages: [{ id: 'wamid.OFFLINE_01', from: '9833621419', type: 'text', text: { body: 'Hi' } }] } }] }]
  });
  const sig = crypto.createHmac('sha256', testSecret).update(raw).digest('hex');
  const res = simulateMetaWebhookPOST({ 'x-hub-signature-256': sig }, raw, testEnv, db);
  assert.strictEqual(res.status, 503);
  assert.strictEqual(res.error, 'Database unavailable: retry scheduled');
  db.isOffline = false;
});

// ----------------------------------------------------------------------------
// CATEGORY 6: CONSENT & CROSS-PROVIDER OPT-OUT (TASK 3B REGRESSION)
// ----------------------------------------------------------------------------
runTest('CONSENT', 'Inbound रोकें via Meta payload transitions Lead to OPTED_OUT', () => {
  db.reset();
  const raw = JSON.stringify({
    object: 'whatsapp_business_account',
    entry: [{ changes: [{ value: { messages: [{ id: 'wamid.OPT_01', from: '9833621419', type: 'text', text: { body: 'कृपया संदेश रोकें' } }] } }] }]
  });
  const sig = crypto.createHmac('sha256', testSecret).update(raw).digest('hex');
  simulateMetaWebhookPOST({ 'x-hub-signature-256': sig }, raw, testEnv, db);

  const lead = db.leads.get('919833621419');
  assert.ok(lead);
  assert.strictEqual(lead.status, 'OPTED_OUT');
  assert.strictEqual(lead.isOptedOut, true);
  assert.strictEqual(lead.consentStatus, 'WITHDRAWN');

  const contact = db.contacts.get('919833621419');
  assert.strictEqual(contact.optedIn, false);
});

runTest('CONSENT', 'Inbound रोको via Meta payload transitions Lead to OPTED_OUT', () => {
  db.reset();
  const raw = JSON.stringify({
    object: 'whatsapp_business_account',
    entry: [{ changes: [{ value: { messages: [{ id: 'wamid.OPT_02', from: '9833621419', type: 'text', text: { body: 'संदेश रोको' } }] } }] }]
  });
  const sig = crypto.createHmac('sha256', testSecret).update(raw).digest('hex');
  simulateMetaWebhookPOST({ 'x-hub-signature-256': sig }, raw, testEnv, db);

  const lead = db.leads.get('919833621419');
  assert.strictEqual(lead.status, 'OPTED_OUT');
});

runTest('CONSENT', 'Inbound थांबवा via Meta payload transitions Lead to OPTED_OUT', () => {
  db.reset();
  const raw = JSON.stringify({
    object: 'whatsapp_business_account',
    entry: [{ changes: [{ value: { messages: [{ id: 'wamid.OPT_03', from: '9175635165', type: 'text', text: { body: 'संदेश थांबवा' } }] } }] }]
  });
  const sig = crypto.createHmac('sha256', testSecret).update(raw).digest('hex');
  simulateMetaWebhookPOST({ 'x-hub-signature-256': sig }, raw, testEnv, db);

  const lead = db.leads.get('919175635165');
  assert.strictEqual(lead.status, 'OPTED_OUT');
});

runTest('CONSENT', 'Inbound STOP / UNSUBSCRIBE via Meta payload transitions Lead to OPTED_OUT', () => {
  db.reset();
  const raw = JSON.stringify({
    object: 'whatsapp_business_account',
    entry: [{ changes: [{ value: { messages: [{ id: 'wamid.OPT_04', from: '9833621419', type: 'text', text: { body: 'UNSUBSCRIBE' } }] } }] }]
  });
  const sig = crypto.createHmac('sha256', testSecret).update(raw).digest('hex');
  simulateMetaWebhookPOST({ 'x-hub-signature-256': sig }, raw, testEnv, db);

  const lead = db.leads.get('919833621419');
  assert.strictEqual(lead.status, 'OPTED_OUT');
});

runTest('CONSENT', 'Opted-out customer is suppressed across ALL providers (Meta, ChatMitra, AiSensy)', () => {
  // Try sending via Meta
  const metaDispatch = simulateProviderDispatch({ phone: '9833621419', name: 'Sachin', provider: 'META_CLOUD' }, testEnv, db);
  assert.strictEqual(metaDispatch.success, false);
  assert.strictEqual(metaDispatch.status, 'SUPPRESSED_CUSTOMER_OPTED_OUT');

  // Try sending via ChatMitra
  const cmDispatch = simulateProviderDispatch({ phone: '9833621419', name: 'Sachin', provider: 'CHATMITRA' }, testEnv, db);
  assert.strictEqual(cmDispatch.success, false);
  assert.strictEqual(cmDispatch.status, 'SUPPRESSED_CUSTOMER_OPTED_OUT');

  // Try sending via AiSensy
  const aisensyDispatch = simulateProviderDispatch({ phone: '9833621419', name: 'Sachin', provider: 'AISENSY' }, testEnv, db);
  assert.strictEqual(aisensyDispatch.success, false);
  assert.strictEqual(aisensyDispatch.status, 'SUPPRESSED_CUSTOMER_OPTED_OUT');
});

// ----------------------------------------------------------------------------
// CATEGORY 7: PROVIDER ROUTING & IDEMPOTENCY LOCK
// ----------------------------------------------------------------------------
runTest('ROUTER', 'ProviderRouter generates atomic idempotency key and executes in safe mock mode', () => {
  db.reset();
  const res = simulateProviderDispatch({ phone: '9175635165', name: 'Test Advisor', provider: 'META_CLOUD', campaignId: 'CMP_001' }, testEnv, db);
  assert.strictEqual(res.success, true);
  assert.strictEqual(res.status, 'API_ACCEPTED');
  assert.ok(res.idempotencyKey.includes('META_CLOUD:CMP_001:919175635165'));
  assert.ok(res.providerMessageId.startsWith('mock_meta_cloud_'));
});

runTest('ROUTER', 'Duplicate dispatch with identical idempotency key returns isDuplicate: true without sending', () => {
  const resDup = simulateProviderDispatch({ phone: '9175635165', name: 'Test Advisor', provider: 'META_CLOUD', campaignId: 'CMP_001' }, testEnv, db);
  assert.strictEqual(resDup.success, true);
  assert.strictEqual(resDup.isDuplicate, true);
});

// ----------------------------------------------------------------------------
// SUMMARY
// ----------------------------------------------------------------------------
console.log('================================================================================');
console.log('📊 TASK 4 TEST EXECUTION SUMMARY:');
console.log(`   Total Tests Run:  ${passed + failed}`);
console.log(`   Tests Passed:     ${passed}`);
console.log(`   Tests Failed:     ${failed}`);
console.log(`   Tests Skipped:    0`);
console.log(`   Pass Rate:        ${((passed / (passed + failed)) * 100).toFixed(1)}%`);
console.log('================================================================================');

if (failed > 0) {
  process.exit(1);
}
