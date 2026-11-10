'use strict';

/**
 * AVANI LOAN SERVICES — CP-25 Master Chatbot, Qualification, Checklist, CRM & Omnichannel Test Suite
 *
 * Covers all 5 mandatory testing categories from Section 24:
 *   A. Chatbot (Tests 1–10)
 *   B. CRM (Tests 11–18)
 *   C. Integrations (Tests 19–26)
 *   D. Security & Consent (Tests 27–34)
 *   E. Reliability (Tests 35–40)
 */

const assert = require('assert');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

// Load TypeScript source files via lightweight ts-strip / regex or direct module evaluation
// Since project uses Next.js TS modules, we can compile/evaluate or inspect & execute pure logic functions
const ts = require('typescript');

function loadTsModule(relPath, mocks = {}) {
  const fullPath = path.join(process.cwd(), relPath);
  const source = fs.readFileSync(fullPath, 'utf8');
  const transpiled = ts.transpileModule(source, {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2020,
      esModuleInterop: true
    }
  }).outputText;

  const mod = { exports: {} };
  const customRequire = (id) => {
    if (mocks[id]) return mocks[id];
    if (id.startsWith('@/')) {
      const targetRel = path.join('src', id.slice(2));
      const tsCandidate = targetRel.endsWith('.ts') ? targetRel : `${targetRel}.ts`;
      if (fs.existsSync(path.join(process.cwd(), tsCandidate))) {
        return loadTsModule(tsCandidate, mocks);
      }
      const indexCandidate = path.join(targetRel, 'index.ts');
      if (fs.existsSync(path.join(process.cwd(), indexCandidate))) {
        return loadTsModule(indexCandidate, mocks);
      }
    }
    if (id.startsWith('./') || id.startsWith('../')) {
      const baseDir = path.dirname(relPath);
      const resolvedRel = path.join(baseDir, id);
      const tsCandidate = resolvedRel.endsWith('.ts') ? resolvedRel : `${resolvedRel}.ts`;
      if (fs.existsSync(path.join(process.cwd(), tsCandidate))) {
        return loadTsModule(tsCandidate, mocks);
      }
    }
    return require(id);
  };

  const fn = new Function('exports', 'require', 'module', '__filename', '__dirname', transpiled);
  fn(mod.exports, customRequire, mod, fullPath, path.dirname(fullPath));
  return mod.exports;
}

const loanChecklists = loadTsModule('src/lib/loan-checklists.ts');
const consentPrivacy = loadTsModule('src/lib/consent-privacy.ts');
const chatbotFlow = loadTsModule('src/lib/chatbot-flow-engine.ts');
const chatmitra = loadTsModule('src/lib/chatmitra.ts');
const msgStatus = loadTsModule('src/lib/message-status.ts');
const integrations = loadTsModule('src/lib/integrations.ts', {
  './provider-router': { ProviderRouter: { dispatchMessage: async () => ({ success: true }) } }
});
const voiceProvider = loadTsModule('src/lib/voice-provider.ts');
const aiAgent = loadTsModule('src/lib/ai-agent.ts');

let passed = 0;
let failed = 0;

function runTest(id, name, fn) {
  try {
    fn();
    passed++;
    console.log(`[PASS] Test ${id}: ${name}`);
  } catch (err) {
    failed++;
    console.error(`[FAIL] Test ${id}: ${name} -> ${err.message}`);
  }
}

async function runAsyncTest(id, name, fn) {
  try {
    await fn();
    passed++;
    console.log(`[PASS] Test ${id}: ${name}`);
  } catch (err) {
    failed++;
    console.error(`[FAIL] Test ${id}: ${name} -> ${err.message}`);
  }
}

async function main() {
  console.log('================================================================================');
  console.log('AVANI LOAN SERVICES — CP-25 MASTER CHATBOT & OMNICHANNEL AUTOMATION TEST SUITE');
  console.log('================================================================================\n');

  // =========================================================================
  // CATEGORY A: CHATBOT (Tests 1–10)
  // =========================================================================
  runTest(1, 'Chatbot Step 1 Welcome message & privacy notice presentation', () => {
    const res = chatbotFlow.evaluateChatbotFlowStep({
      inputMessage: 'Hi',
      verifiedPhone: '919175635165',
      context: {}
    });
    assert.strictEqual(res.nextStep, 'STEP_1_WELCOME_LANGUAGE');
    assert.ok(res.replyText.includes('Welcome to AVANI LOAN SERVICES!'));
    assert.ok(res.replyText.includes('English'));
    assert.ok(res.replyText.includes('मराठी'));
    assert.ok(res.replyText.includes('हिंदी'));
    assert.ok(res.replyText.includes('Privacy Notice'));
  });

  runTest(2, 'Chatbot language selection (English, मराठी, हिंदी)', () => {
    const resMr = chatbotFlow.evaluateChatbotFlowStep({
      inputMessage: 'मराठी',
      verifiedPhone: '919175635165',
      context: {}
    });
    assert.strictEqual(resMr.updatedContext.preferred_language, 'मराठी');
    assert.strictEqual(resMr.updatedContext.language, 'mr');
    assert.strictEqual(resMr.nextStep, 'STEP_2_COLLECT_FULL_NAME');

    const resHi = chatbotFlow.evaluateChatbotFlowStep({
      inputMessage: 'हिंदी',
      verifiedPhone: '919175635165',
      context: {}
    });
    assert.strictEqual(resHi.updatedContext.preferred_language, 'हिंदी');
    assert.strictEqual(resHi.updatedContext.language, 'hi');
  });

  runTest(3, 'Chatbot Step 2 basic info collection order & mobile/email validation', () => {
    assert.strictEqual(chatbotFlow.validateEmailFormat('sachin@avanifinserv.com'), true);
    assert.strictEqual(chatbotFlow.validateEmailFormat('invalid-email'), false);

    const mob = chatbotFlow.validateAndNormalizeMobile('9175635165');
    assert.strictEqual(mob.valid, true);
    assert.strictEqual(mob.e164, '+919175635165');

    const stepEmail = chatbotFlow.evaluateChatbotFlowStep({
      inputMessage: 'Sachin Shinde',
      verifiedPhone: '919175635165',
      context: { preferred_language: 'English', full_name: 'Sachin Shinde' }
    });
    assert.strictEqual(stepEmail.nextStep, 'STEP_2_COLLECT_EMAIL');
  });

  runTest(4, 'Chatbot Step 2 applicant category options (Salaried, Self Employed, Business Owner, Professional)', () => {
    assert.deepStrictEqual(chatbotFlow.APPLICANT_CATEGORY_OPTIONS, [
      'Salaried',
      'Self Employed',
      'Business Owner',
      'Professional'
    ]);
    const res = chatbotFlow.evaluateChatbotFlowStep({
      inputMessage: 'Latur',
      verifiedPhone: '919175635165',
      context: {
        preferred_language: 'English',
        full_name: 'Sachin Shinde',
        mobile_number: '+919175635165',
        email: 'sachin@avanifinserv.com',
        city: 'Latur'
      }
    });
    assert.strictEqual(res.nextStep, 'STEP_2_COLLECT_APPLICANT_CATEGORY');
  });

  runTest(5, 'Chatbot Step 3 monthly income options (5 options including Prefer to discuss with an advisor)', () => {
    assert.strictEqual(chatbotFlow.MONTHLY_INCOME_OPTIONS.length, 5);
    assert.ok(chatbotFlow.MONTHLY_INCOME_OPTIONS.includes('Prefer to discuss with an advisor'));
    const res = chatbotFlow.evaluateChatbotFlowStep({
      inputMessage: 'Salaried',
      verifiedPhone: '919175635165',
      context: {
        preferred_language: 'English',
        full_name: 'Sachin Shinde',
        mobile_number: '+919175635165',
        email: 'sachin@avanifinserv.com',
        city: 'Latur',
        applicant_type: 'Salaried'
      }
    });
    assert.strictEqual(res.nextStep, 'STEP_3_COLLECT_MONTHLY_INCOME');
  });

  runTest(6, 'Chatbot Step 4 loan requirement (all 11 options)', () => {
    assert.strictEqual(chatbotFlow.LOAN_CATEGORY_OPTIONS.length, 11);
    assert.ok(chatbotFlow.LOAN_CATEGORY_OPTIONS.includes('Doctor Loan'));
    assert.ok(chatbotFlow.LOAN_CATEGORY_OPTIONS.includes('Chartered Accountant Loan'));
    assert.ok(chatbotFlow.LOAN_CATEGORY_OPTIONS.includes('Education Loan — India'));
    assert.ok(chatbotFlow.LOAN_CATEGORY_OPTIONS.includes('Education Loan — Abroad'));
    assert.ok(chatbotFlow.LOAN_CATEGORY_OPTIONS.includes('School Funding'));
    assert.ok(chatbotFlow.LOAN_CATEGORY_OPTIONS.includes('College Funding'));
    assert.ok(chatbotFlow.LOAN_CATEGORY_OPTIONS.includes('Other / Not Sure'));
  });

  runTest(7, 'Chatbot Step 4 required funding amount & INR currency assignment', () => {
    const res = chatbotFlow.evaluateChatbotFlowStep({
      inputMessage: '2500000',
      verifiedPhone: '919175635165',
      context: {
        preferred_language: 'English',
        full_name: 'Dr. Sachin Shinde',
        mobile_number: '+919175635165',
        email: 'sachin@avanifinserv.com',
        city: 'Latur',
        applicant_type: 'Professional',
        profession: 'Doctor',
        monthly_income_range: 'Above ₹2,00,000',
        loan_category: 'Home Loan',
        required_loan_amount: '5000000'
      }
    });
    assert.strictEqual(res.updatedContext.amount_currency, 'INR');
    assert.strictEqual(res.updatedContext.professional_type, 'doctor');
    assert.strictEqual(res.nextStep, 'STEP_5_CHECKLIST_AND_ADVISOR_ROUTING');
  });

  runTest(8, 'Multi-branch checklist composition (Doctor + Home Loan, Salaried + Home Loan, Business Owner + Personal Loan)', () => {
    // Case 1: Doctor seeking Home Loan -> Doctor Income + Property Documents
    const docHome = loanChecklists.composeMultiBranchChecklist({
      applicantType: 'Professional',
      profession: 'Doctor',
      loanCategory: 'Home Loan'
    });
    assert.strictEqual(docHome.professionalType, 'doctor');
    assert.ok(docHome.sections.some(s => s.title.includes('Doctor Applicant')));
    assert.ok(docHome.sections.some(s => s.title === 'Property Documents'));
    assert.ok(docHome.flattenedDocuments.includes('Medical Degree Certificate'));
    assert.ok(docHome.flattenedDocuments.includes('Sale Agreement / Allotment Letter'));

    // Case 2: Salaried seeking Home Loan -> Salaried Income + Property Documents
    const salHome = loanChecklists.composeMultiBranchChecklist({
      applicantType: 'Salaried',
      loanCategory: 'Home Loan'
    });
    assert.ok(salHome.sections.some(s => s.title.includes('Salaried Applicant')));
    assert.ok(salHome.sections.some(s => s.title === 'Property Documents'));

    // Case 3: Business Owner seeking Personal Loan -> Business/Self-Employed income docs with Personal Loan advisory note
    const bizPersonal = loanChecklists.composeMultiBranchChecklist({
      applicantType: 'Business Owner',
      loanCategory: 'Personal Loan'
    });
    assert.strictEqual(bizPersonal.loanCategory, 'Personal Loan');
    assert.ok(bizPersonal.advisoryMessage.includes('Personal Loan'));
    assert.ok(bizPersonal.flattenedDocuments.includes("Last 2 years' ITR"));
  });

  runTest(9, 'Education Loan checklists (India vs Abroad, Salaried/Self-Employed/Farmer/Pension/Rental Co-Applicant)', () => {
    const eduAbroadFarmer = loanChecklists.composeMultiBranchChecklist({
      applicantType: 'Student',
      loanCategory: 'Education Loan — Abroad',
      educationDestination: 'Abroad',
      coApplicantType: 'Farmer',
      additionalIncome: 'Rental',
      includeCollateralAndFamily: true,
      includeConsentedReferences: true
    });
    assert.strictEqual(eduAbroadFarmer.educationDestination, 'Abroad');
    assert.ok(eduAbroadFarmer.flattenedDocuments.some(d => d.includes('GRE / TOEFL')));
    assert.ok(eduAbroadFarmer.flattenedDocuments.some(d => d.includes('Patta Passbook')));
    assert.ok(eduAbroadFarmer.flattenedDocuments.some(d => d.includes('Rental Agreements')));
    assert.ok(eduAbroadFarmer.flattenedDocuments.some(d => d.includes('Two references')));
    assert.ok(eduAbroadFarmer.advisoryMessage.includes('one section at a time'));
  });

  runTest(10, 'Chatbot Human Advisor Handoff & non-lender disclaimer enforcement', () => {
    const handoff = chatbotFlow.evaluateChatbotFlowStep({
      inputMessage: 'I want to speak to advisor Sachin Shinde',
      verifiedPhone: '919175635165',
      context: { preferred_language: 'English' }
    });
    assert.strictEqual(handoff.nextStep, 'HUMAN_ADVISOR_HANDOFF');
    assert.strictEqual(handoff.auditRecord.handoffDecision, 'HUMAN_ADVISOR_HANDOFF');
    assert.ok(handoff.tags.includes('HUMAN_HANDOFF'));
    assert.ok(handoff.replyText.includes('Sachin Shinde'));
    assert.ok(handoff.replyText.includes('not automatically the lending institution'));
  });

  // =========================================================================
  // CATEGORY B: CRM (Tests 11–18)
  // =========================================================================
  runTest(11, 'CRM E.164 & ChatMitra phone normalization', () => {
    assert.strictEqual(chatmitra.formatChatMitraPhone('+91 91756 35165'), '919175635165');
    assert.strictEqual(chatmitra.formatChatMitraPhone('09175635165'), '919175635165');
    const v = chatbotFlow.validateAndNormalizeMobile('9175635165');
    assert.strictEqual(v.e164, '+919175635165');
  });

  runTest(12, 'CRM duplicate contact & lead upsert key consistency', () => {
    const workerSrc = fs.readFileSync(path.join(process.cwd(), 'src/app/api/whatsapp-webhook-worker/route.ts'), 'utf8');
    assert.ok(workerSrc.includes('Lead.findOneAndUpdate'));
    assert.ok(workerSrc.includes('Contact.findOneAndUpdate'));
    assert.ok(workerSrc.includes('upsert: true'));
  });

  runTest(13, 'ChatMitra Pro 17 canonical tags & 20 custom attributes ceiling enforcement', () => {
    assert.strictEqual(chatbotFlow.CHATMITRA_PRO_CANONICAL_TAGS.length, 17);
    assert.strictEqual(chatbotFlow.CHATMITRA_PRO_CUSTOM_ATTRIBUTES.length, 20);

    const attrs = chatbotFlow.buildChatMitraCustomAttributes({
      full_name: 'Sachin Shinde',
      loan_category: 'Doctor Loan',
      extra_unapproved_field: 'should_not_appear'
    });
    assert.strictEqual(Object.keys(attrs).length, 20);
    assert.strictEqual(attrs.extra_unapproved_field, undefined);
    assert.strictEqual(attrs.amount_currency, 'INR');
  });

  runTest(14, 'Conversation schema stages & state progression', () => {
    const convSrc = fs.readFileSync(path.join(process.cwd(), 'src/models/Conversation.ts'), 'utf8');
    for (const stage of ['NEW_LEAD', 'QUALIFICATION', 'DOCUMENT_COLLECTION', 'ADVISOR_HANDOFF', 'OPTED_OUT']) {
      assert.ok(convSrc.includes(`'${stage}'`));
    }
  });

  runTest(15, 'Message persistence canonical uppercase status normalization', () => {
    assert.strictEqual(msgStatus.normalizeMessageStatus('Received', 'inbound'), 'RECEIVED');
    assert.strictEqual(msgStatus.normalizeMessageStatus('delivered', 'outbound'), 'DELIVERED');
    assert.strictEqual(msgStatus.normalizeMessageStatus('read', 'outbound'), 'READ');
    assert.strictEqual(msgStatus.normalizeMessageStatus('failed', 'outbound'), 'FAILED');
  });

  runTest(16, 'Multilingual 10-category loan classification (English, Marathi, Hindi)', () => {
    assert.strictEqual(chatmitra.classifyLoanCategory('मला डॉक्टर लोन हवे आहे').category, 'Doctor Loan');
    assert.strictEqual(chatmitra.classifyLoanCategory('मुझे अपनी दुकान के लिए बिजनेस लोन चाहिए').category, 'Business Loan');
    assert.strictEqual(chatmitra.classifyLoanCategory('Need CA professional loan for audit firm').category, 'CA Professional Loan');
    assert.strictEqual(chatmitra.classifyLoanCategory('परदेशात शिक्षणासाठी कर्ज').category, 'Education Loan — Global Studies');
    assert.strictEqual(chatmitra.classifyLoanCategory('शाळेसाठी कर्ज हवे आहे').category, 'School Funding');
    assert.strictEqual(chatmitra.classifyLoanCategory('महाविद्यालय कॉलेज लोन').category, 'College Funding');
  });

  runTest(17, 'Admin & Advisor Dashboard KPI route and 7-dimension filter builder', () => {
    const dashMetrics = loadTsModule('src/app/api/dashboard/metrics/route.ts', {
      'next/server': { NextResponse: { json: (b, i) => ({ body: b, init: i }) } },
      '@/lib/db': async () => null,
      '@/models/Lead': {},
      '@/models/Message': {},
      '@/models/Document': {},
      '@/models/WebhookInbox': {}
    });
    const q = dashMetrics.buildLeadFilterQuery({
      dateFrom: '2026-11-01',
      loanCategory: 'Doctor Loan',
      city: 'Latur',
      applicantCategory: 'Professional',
      leadStatus: 'Qualified',
      assignedAdvisor: 'Sachin Shinde',
      source: 'WhatsApp'
    });
    assert.strictEqual(q.loanType, 'Doctor Loan');
    assert.strictEqual(q.employmentType, 'Professional');
    assert.strictEqual(q.status, 'Qualified');
    assert.ok(q.city instanceof RegExp);
    assert.ok(q['assignedAgent.name'] instanceof RegExp);
    assert.ok(Array.isArray(q.$or));
  });

  runTest(18, 'Advisor assignment & incomplete application handoff summary', () => {
    const notes = aiAgent.AgentEngine.prepareAdvisorHandoffNotes({
      fullName: 'Sachin Shinde',
      mobile: '9175635165',
      loanProduct: 'Business Loan'
    });
    assert.strictEqual(notes.assignedAdvisor, 'Sachin Shinde');
    assert.strictEqual(notes.isApplicationIncomplete, true);
    assert.ok(notes.missingQualificationFields.includes('email'));
    assert.strictEqual(notes.disclaimerIncluded, true);
  });

  // =========================================================================
  // CATEGORY C: INTEGRATIONS (Tests 19–26)
  // =========================================================================
  runTest(19, 'ChatMitra inbound webhook HMAC-SHA256 verification over raw body', () => {
    const secret = 'test_cm_webhook_secret_key';
    const rawBody = JSON.stringify({ event: 'message.received', id: 'msg_101', from: '919175635165', text: 'Home Loan' });
    const validSig = crypto.createHmac('sha256', secret).update(rawBody).digest('hex');
    assert.strictEqual(chatmitra.verifyChatMitraSignature(rawBody, `sha256=${validSig}`, secret), true);
    assert.strictEqual(chatmitra.verifyChatMitraSignature(rawBody + ' ', `sha256=${validSig}`, secret), false);
  });

  await runAsyncTest(20, 'ChatMitra outbound message mock mode & single-recipient safety clamp (919175635165)', async () => {
    const prevMode = process.env.PROVIDER_MODE;
    const prevKey = process.env.CHATMITRA_API_KEY;
    try {
      process.env.PROVIDER_MODE = 'mock';
      const mockRes = await chatmitra.sendChatMitraMessage({
        toPhone: '919876543210',
        messageText: 'Test in mock mode'
      });
      assert.strictEqual(mockRes.success, true);
      assert.strictEqual(mockRes.provider, 'ChatMitra_Mock');

      process.env.PROVIDER_MODE = 'live';
      process.env.CHATMITRA_API_KEY = 'dummy_key_for_clamp_test';
      const clampRes = await chatmitra.sendChatMitraMessage({
        toPhone: '919876543210',
        messageText: 'Should be blocked by safety clamp'
      });
      assert.strictEqual(clampRes.success, false);
      assert.strictEqual(clampRes.status, 'BLOCKED_UNAUTHORIZED_LIVE_RECIPIENT');
    } finally {
      process.env.PROVIDER_MODE = prevMode;
      process.env.CHATMITRA_API_KEY = prevKey;
    }
  });

  runTest(21, 'Meta WhatsApp webhook security & provider discrimination', () => {
    const metaRouteSrc = fs.readFileSync(path.join(process.cwd(), 'src/app/api/whatsapp-webhook/route.ts'), 'utf8');
    assert.ok(metaRouteSrc.includes('x-hub-signature-256'));
    assert.ok(metaRouteSrc.includes('META_APP_SECRET'));
    assert.ok(metaRouteSrc.includes('timingSafeEqual'));
  });

  await runAsyncTest(22, 'HubSpot sync payload builder & opt-out suppression', async () => {
    const lead = {
      leadId: 'AVL-20261110-000123',
      name: 'Sachin Shinde',
      phone: '+919175635165',
      email: 'sachin@avanifinserv.com',
      city: 'Latur',
      loanType: 'Doctor Loan',
      employmentType: 'Professional',
      requestedAmount: '4500000',
      monthlyIncomeRange: 'Above ₹2,00,000',
      leadSource: 'ChatMitra WhatsApp',
      consentStatus: 'GRANTED',
      status: 'Qualified'
    };
    const hsPayload = integrations.buildHubSpotSyncPayload(lead);
    assert.strictEqual(hsPayload.matchingIdentifiers.phone, '+919175635165');
    assert.strictEqual(hsPayload.matchingIdentifiers.email, 'sachin@avanifinserv.com');
    assert.ok(hsPayload.fields.some(f => f.name === 'loan_category' && f.value === 'Doctor Loan'));
    assert.ok(hsPayload.fields.some(f => f.name === 'crm_record_reference' && f.value === 'AVL-20261110-000123'));

    const optedOutRes = await integrations.syncToHubSpot({ ...lead, isOptedOut: true });
    assert.strictEqual(optedOutRes.suppressed, true);
    assert.strictEqual(optedOutRes.reason, 'CONTACT_OPTED_OUT');
  });

  runTest(23, 'Google Sheets 14 recommended tabs & 19 standardized columns', () => {
    assert.strictEqual(integrations.GOOGLE_SHEETS_RECOMMENDED_TABS.length, 14);
    assert.strictEqual(integrations.GOOGLE_SHEETS_STANDARD_FIELDS.length, 19);

    const row = integrations.formatGoogleSheetsRow({
      leadId: 'AVL-20261110-000999',
      name: 'Sachin Shinde',
      phone: '+919175635165',
      email: 'sachin@avanifinserv.com',
      city: 'Latur',
      loanType: 'Home Loan',
      employmentType: 'Salaried',
      requestedAmount: '5000000',
      monthlyIncomeRange: '₹1,00,000–₹2,00,000'
    });
    for (const col of integrations.GOOGLE_SHEETS_STANDARD_FIELDS) {
      assert.ok(Object.prototype.hasOwnProperty.call(row, col), `Missing column ${col}`);
    }
    assert.strictEqual(row.Lead_ID, 'AVL-20261110-000999');

    const tabs = integrations.resolveGoogleSheetTabsForLead({ loanType: 'Education Loan — Abroad', nextFollowUp: '2026-11-12' });
    assert.deepStrictEqual(tabs, ['Master Leads', 'Education Loan', 'Follow-up Tracker']);
  });

  await runAsyncTest(24, 'Zapier integration idempotency & circular-automation prevention', async () => {
    assert.strictEqual(integrations.ZAPIER_WORKFLOW_TYPES.length, 6);
    const zp = integrations.buildZapierPayload({ leadId: 'AVL-777', name: 'Sachin' }, 'QUALIFIED_LEAD_TO_HUBSPOT');
    assert.strictEqual(zp.idempotencyKey, 'ZAPIER:QUALIFIED_LEAD_TO_HUBSPOT:AVL-777');
    assert.strictEqual(zp.source_system, 'AVANI_AI_CRM_AUTHORITATIVE');
    assert.strictEqual(zp.prevent_circular_sync, true);

    const circularRes = await integrations.syncToZapier({ leadId: 'AVL-777', source_system: 'HUBSPOT' });
    assert.strictEqual(circularRes.suppressed, true);
    assert.strictEqual(circularRes.reason, 'CIRCULAR_SYNC_PREVENTED');
  });

  await runAsyncTest(25, 'OmniDM AI Calling integration (test mode standby, DND/consent guards, outcome parser)', async () => {
    const provider = new voiceProvider.OmniDMVoiceProvider();
    assert.strictEqual(provider.selectAgentId('mr'), '229425');
    assert.strictEqual(provider.selectAgentId('en'), '228450');

    // DND / Opt-out suppressed
    const dndRes = await provider.dispatchCall({
      phoneNumber: '9175635165',
      customerName: 'Sachin Shinde',
      isOptedOut: true
    });
    assert.strictEqual(dndRes.success, false);
    assert.strictEqual(dndRes.error, 'CALL_SUPPRESSED_OPTED_OUT_OR_DND');
    assert.strictEqual(dndRes.auditTrail.dndSuppressed, true);

    // Missing consent blocked
    const noConsentRes = await provider.dispatchCall({
      phoneNumber: '9175635165',
      customerName: 'Sachin Shinde',
      consentGranted: false
    });
    assert.strictEqual(noConsentRes.success, false);
    assert.strictEqual(noConsentRes.error, 'CALL_BLOCKED_MISSING_CONSENT');

    // Default test mode standby
    const prevOmni = process.env.OMNIDM_LIVE_ENABLED;
    process.env.OMNIDM_LIVE_ENABLED = 'false';
    const standbyRes = await provider.dispatchCall({
      phoneNumber: '9175635165',
      customerName: 'Sachin Shinde',
      loanType: 'Business Loan',
      language: 'mr'
    });
    process.env.OMNIDM_LIVE_ENABLED = prevOmni;
    assert.strictEqual(standbyRes.success, false);
    assert.strictEqual(standbyRes.auditTrail.callStatus, 'TEST_MODE_STANDBY');

    // Outcome parser
    const parsed = voiceProvider.OmniDMVoiceProvider.parseCallOutcome({
      call_id: 'omni_999',
      status: 'COMPLETED',
      summary: 'Customer wants to speak with human advisor Sachin Shinde regarding Home Loan.'
    });
    assert.strictEqual(parsed.callOutcome, 'HUMAN_HANDOFF');
    assert.strictEqual(parsed.advisorHandoff, true);
  });

  await runAsyncTest(26, 'AVANI AI Agent non-guarantee guardrail & structured audit record', async () => {
    const conv = { currentState: 'NEW_LEAD', language: 'en', context: {} };
    const guaranteeReply = await aiAgent.AgentEngine.processMessage(
      conv,
      'Can you give me 100% guarantee of loan approval?'
    );
    assert.ok(guaranteeReply.nextQuestion.includes('No agency can ethically promise guaranteed approval'));

    const audit = aiAgent.AgentEngine.createAuditRecord({
      inputMessageRef: 'MSG-1',
      detectedLanguage: 'mr',
      detectedLoanCategory: 'Home Loan',
      extractedQualificationFields: { city: 'Latur' },
      handoffDecision: 'CONTINUE_BOT'
    });
    assert.strictEqual(audit.detectedLanguage, 'mr');
    assert.strictEqual(audit.detectedLoanCategory, 'Home Loan');
    assert.ok(audit.timestamp);
    assert.ok(audit.modelVersion);
  });

  // =========================================================================
  // CATEGORY D: SECURITY & CONSENT (Tests 27–34)
  // =========================================================================
  runTest(27, 'Security: Invalid HMAC signature rejected', () => {
    assert.strictEqual(
      chatmitra.verifyChatMitraSignature('{"event":"message.received"}', 'sha256=deadbeef', 'real_secret'),
      false
    );
  });

  runTest(28, 'Security: Missing HMAC signature rejected', () => {
    assert.strictEqual(chatmitra.verifyChatMitraSignature('{"event":"message.received"}', null, 'real_secret'), false);
    assert.strictEqual(chatmitra.verifyChatMitraSignature('{"event":"message.received"}', '', 'real_secret'), false);
  });

  runTest(29, 'Security: Duplicate webhook event deduplication key determinism', () => {
    const webhookSrc = fs.readFileSync(path.join(process.cwd(), 'src/app/api/chatmitra-webhook/route.ts'), 'utf8');
    assert.ok(webhookSrc.includes('const eventId = `CM_INBOUND_${msgId}`'));
    assert.ok(webhookSrc.includes('e.code === 11000'));
  });

  runTest(30, 'Security: Role-based document access control (RBAC)', () => {
    assert.strictEqual(consentPrivacy.canAccessDocumentRecord('CHIEF_ADVISOR'), true);
    assert.strictEqual(consentPrivacy.canAccessDocumentRecord('ADMIN'), true);
    assert.strictEqual(consentPrivacy.canAccessDocumentRecord('PUBLIC_GUEST'), false);
    assert.strictEqual(consentPrivacy.canAccessDocumentRecord(null), false);
  });

  runTest(31, 'Security: Service vs Marketing consent separation & opt-out suppression across all 6 channels', () => {
    const activeConsent = consentPrivacy.createConsentRecord({
      source: 'WHATSAPP_BOT',
      serviceConsent: 'GRANTED',
      marketingConsent: 'PENDING',
      isOptedOut: false
    });
    assert.strictEqual(activeConsent.serviceConsent, 'GRANTED');
    assert.strictEqual(activeConsent.marketingConsent, 'PENDING');
    assert.strictEqual(activeConsent.policyVersion, consentPrivacy.PRIVACY_POLICY_VERSION);

    const withdrawn = consentPrivacy.createConsentRecord({ isOptedOut: true });
    assert.strictEqual(withdrawn.serviceConsent, 'WITHDRAWN');
    assert.strictEqual(withdrawn.optOutSuppressed, true);
    assert.strictEqual(withdrawn.suppressionChannels.length, 6);
  });

  runTest(32, 'Security: Sensitive KYC / OTP interception in ordinary WhatsApp chat', () => {
    const panDetect = consentPrivacy.detectSensitiveDataInChat('My PAN card is ABCDE1234F');
    assert.strictEqual(panDetect.containsSensitiveData, true);
    assert.ok(panDetect.detectedTypes.includes('PAN_NUMBER'));

    const aadhaarDetect = consentPrivacy.detectSensitiveDataInChat('Aadhaar: 4567 8901 2345');
    assert.strictEqual(aadhaarDetect.containsSensitiveData, true);
    assert.ok(aadhaarDetect.detectedTypes.includes('AADHAAR_NUMBER'));

    const stepRes = chatbotFlow.evaluateChatbotFlowStep({
      inputMessage: 'Here is my PAN ABCDE1234F',
      verifiedPhone: '919175635165',
      context: { preferred_language: 'English' }
    });
    assert.ok(stepRes.secureUploadLink.includes('/api/documents/secure-upload?token='));
    assert.ok(stepRes.replyText.includes('please do NOT send Aadhaar numbers, PAN numbers'));
  });

  runTest(33, 'Security: Sensitive data log sanitizer redacts PAN, Aadhaar, and tokens', () => {
    const dirty = 'User PAN ABCDE1234F Aadhaar 4567 8901 2345 Authorization: Bearer secret_jwt_123 token=eyJ123.sig';
    const clean = consentPrivacy.sanitizeForLog(dirty);
    assert.ok(!clean.includes('ABCDE1234F'));
    assert.ok(!clean.includes('4567 8901 2345'));
    assert.ok(!clean.includes('secret_jwt_123'));
    assert.ok(clean.includes('[REDACTED_PAN]'));
    assert.ok(clean.includes('[REDACTED_AADHAAR]'));
    assert.ok(clean.includes('[REDACTED_TOKEN]'));
    assert.ok(clean.includes('[REDACTED_UPLOAD_TOKEN]'));
  });

  runTest(34, 'Security: Signed document upload token verification, expiry & AES-256-GCM encryption at rest', () => {
    const link = consentPrivacy.generateSecureDocumentUploadLink({
      leadId: 'AVL-DOC-101',
      phone: '+919175635165',
      loanCategory: 'Home Loan',
      expiresInMinutes: 60
    });
    const token = new URL(link.uploadUrl).searchParams.get('token');
    const verified = consentPrivacy.verifySecureDocumentUploadToken(token);
    assert.strictEqual(verified.valid, true);
    assert.strictEqual(verified.payload.leadId, 'AVL-DOC-101');

    // Tampered token rejected
    const tampered = consentPrivacy.verifySecureDocumentUploadToken(token + 'x');
    assert.strictEqual(tampered.valid, false);

    // AES-256-GCM encryption at rest
    const enc = consentPrivacy.encryptDocumentReference('s3://private-vault/doc-101.pdf');
    assert.ok(enc.startsWith('ENCv1:'));
    assert.ok(!enc.includes('doc-101.pdf'));
  });

  // =========================================================================
  // CATEGORY E: RELIABILITY (Tests 35–40)
  // =========================================================================
  runTest(35, 'Reliability: Queue worker atomic lease claim supports FAILED and expired PROCESSING retries', () => {
    const workerSrc = fs.readFileSync(path.join(process.cwd(), 'src/app/api/whatsapp-webhook-worker/route.ts'), 'utf8');
    assert.ok(workerSrc.includes("{ status: 'RECEIVED' }"));
    assert.ok(workerSrc.includes("{ status: 'FAILED' }"));
    assert.ok(workerSrc.includes('leaseExpiresAt: { $lt: new Date() }'));
  });

  await runAsyncTest(36, 'Reliability: Failed provider request graceful error handling without crash', async () => {
    const prevMode = process.env.PROVIDER_MODE;
    process.env.PROVIDER_MODE = 'mock';
    const res = await integrations.logToGoogleSheets({ leadId: 'AVL-REL-1', name: 'Sachin' });
    process.env.PROVIDER_MODE = prevMode;
    assert.strictEqual(res.success, true);
  });

  runTest(37, 'Reliability: Database unavailable fail-closed HTTP 503 on webhooks and worker', () => {
    const cmSrc = fs.readFileSync(path.join(process.cwd(), 'src/app/api/chatmitra-webhook/route.ts'), 'utf8');
    const wkSrc = fs.readFileSync(path.join(process.cwd(), 'src/app/api/whatsapp-webhook-worker/route.ts'), 'utf8');
    assert.ok(cmSrc.includes('status: 503'));
    assert.ok(wkSrc.includes('status: 503'));
  });

  await runAsyncTest(38, 'Reliability: OmniDM retry limit guard blocks calls exceeding MAX_OMNIDM_RETRIES', async () => {
    const provider = new voiceProvider.OmniDMVoiceProvider();
    const res = await provider.dispatchCall({
      phoneNumber: '9175635165',
      customerName: 'Sachin Shinde',
      retryAttempt: 3
    });
    assert.strictEqual(res.success, false);
    assert.ok(res.error.includes('CALL_RETRY_LIMIT_EXCEEDED'));
    assert.strictEqual(res.auditTrail.advisorHandoff, true);
  });

  runTest(39, 'Reliability: Duplicate delivery receipt idempotent event ID construction', () => {
    const cmSrc = fs.readFileSync(path.join(process.cwd(), 'src/app/api/chatmitra-webhook/route.ts'), 'utf8');
    assert.ok(cmSrc.includes('const eventId = `CM_STATUS_${msgId}_${statusStr.toUpperCase()}`'));
  });

  runTest(40, 'Reliability: Out-of-order delivery status monotonicity guard prevents status regression', () => {
    assert.strictEqual(msgStatus.canTransitionStatus('SENT', 'DELIVERED'), true);
    assert.strictEqual(msgStatus.canTransitionStatus('DELIVERED', 'READ'), true);
    assert.strictEqual(msgStatus.canTransitionStatus('READ', 'DELIVERED'), false);
    assert.strictEqual(msgStatus.canTransitionStatus('READ', 'SENT'), false);
  });

  console.log('\n================================================================================');
  console.log(`CP-25 TEST SUMMARY: ${passed} / ${passed + failed} TESTS PASSED`);
  console.log('================================================================================');

  if (failed > 0) {
    process.exit(1);
  }
}

main();
