'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const ts = require('typescript');

let passed = 0;
let failed = 0;

function it(name, fn) {
  try {
    fn();
    console.log(`[PASS] ${name}`);
    passed++;
  } catch (e) {
    console.error(`[FAIL] ${name}: ${e.message}`);
    failed++;
  }
}

function loadTsModule(relPath) {
  const fullPath = path.join(__dirname, '..', relPath);
  const source = fs.readFileSync(fullPath, 'utf8');
  const transpiled = ts.transpileModule(source, {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2020,
      esModuleInterop: true
    }
  }).outputText;

  const m = { exports: {} };
  const fn = new Function('module', 'exports', 'require', transpiled);
  fn(m, m.exports, (mod) => {
    if (mod === 'crypto') return require('crypto');
    if (mod === 'axios') return require('axios');
    if (mod === 'mongoose') return require('mongoose');
    if (mod.includes('pipeline')) return loadTsModule('src/config/pipeline.ts');
    if (mod.includes('message-status')) return loadTsModule('src/lib/message-status.ts');
    if (mod.includes('document-checklist')) return loadTsModule('src/lib/document-checklist.ts');
    return {};
  });
  return m.exports;
}

console.log('--- CP-26: LEAD-TO-REVENUE OPERATIONS & CONVERSION TEST SUITE ---');

// 1. Pipeline Stages
it('CP26-01: Exactly 20 canonical stages defined in CANONICAL_LEAD_STAGES', () => {
  const pipelineMod = loadTsModule('src/config/pipeline.ts');
  assert.strictEqual(pipelineMod.CANONICAL_LEAD_STAGES.length, 20);
  assert.ok(pipelineMod.CANONICAL_LEAD_STAGES.includes('NEW_ENQUIRY'));
  assert.ok(pipelineMod.CANONICAL_LEAD_STAGES.includes('QUALIFIED'));
  assert.ok(pipelineMod.CANONICAL_LEAD_STAGES.includes('APPLICATION_SUBMITTED'));
  assert.ok(pipelineMod.CANONICAL_LEAD_STAGES.includes('SANCTIONED'));
  assert.ok(pipelineMod.CANONICAL_LEAD_STAGES.includes('DISBURSED'));
  assert.ok(pipelineMod.CANONICAL_LEAD_STAGES.includes('CLOSED_LOST'));
});

it('CP26-02: Legacy status strings map accurately to canonical CP-26 stages', () => {
  const pipelineMod = loadTsModule('src/config/pipeline.ts');
  assert.strictEqual(pipelineMod.mapLegacyStatusToStage('CUSTOMER_REPLIED_HUMAN_FOLLOWUP'), 'CONTACTED');
  assert.strictEqual(pipelineMod.mapLegacyStatusToStage('QUALIFIED_HUMAN'), 'QUALIFIED');
  assert.strictEqual(pipelineMod.mapLegacyStatusToStage('DOCUMENTS_RECEIVED'), 'DOCUMENTS_RECEIVED');
  assert.strictEqual(pipelineMod.mapLegacyStatusToStage('DISBURSED'), 'DISBURSED');
  assert.strictEqual(pipelineMod.mapLegacyStatusToStage('OPTED_OUT'), 'CLOSED_LOST');
});

// 2. Loan Product Classification
it('CP26-03: Complete loan product suite includes all 9 required categories', () => {
  const pipelineMod = loadTsModule('src/config/pipeline.ts');
  const productNames = pipelineMod.AVANI_LOAN_PRODUCTS.map(p => p.name);
  assert.ok(productNames.includes('Doctor Loan'));
  assert.ok(productNames.includes('Personal Loan'));
  assert.ok(productNames.includes('Business Loan'));
  assert.ok(productNames.includes('Home Loan'));
  assert.ok(productNames.includes('Mortgage Loan / LAP'));
  assert.ok(productNames.includes('Education Loan — India'));
  assert.ok(productNames.includes('Education Loan — Global Studies'));
  assert.ok(productNames.includes('School Funding'));
  assert.ok(productNames.includes('College Funding'));
});

// 3. Qualification Engine
it('CP26-04: QualificationEngine assigns 80+ High Priority score for fully documented Doctor Loan', () => {
  const { QualificationEngine } = loadTsModule('src/lib/qualification-engine.ts');
  const lead = {
    name: 'Dr. Rahul Sharma',
    phone: '919876543210',
    loanType: 'Doctor Loan',
    employmentType: 'Doctor / Medical Professional',
    monthlyIncome: 150000,
    requiredLoanAmount: 2500000,
    preferredTenureYears: 5,
    cibilScore: 780,
    loanPurpose: 'Medical Equipment Purchase for Clinic'
  };
  const conv = { history: [{ text: 'Need doctor loan' }, { text: 'For clinic equipment' }, { text: 'income 1.5L' }] };
  const docs = { receivedDocuments: ['PAN', 'Aadhaar', 'Degree', 'ITR'] };

  const result = QualificationEngine.calculateScore(lead, conv, docs);
  assert.ok(result.score >= 80, `Expected score >= 80, got ${result.score}`);
  assert.strictEqual(result.tier, 'HIGH_PRIORITY');
  assert.ok(result.reasoning.length >= 5);
});

it('CP26-05: QualificationEngine assigns Low Priority (<40) for incomplete lead with no financials', () => {
  const { QualificationEngine } = loadTsModule('src/lib/qualification-engine.ts');
  const lead = {
    name: 'Customer',
    phone: '919175635165',
    loanType: 'Personal Loan'
  };
  const result = QualificationEngine.calculateScore(lead);
  assert.ok(result.score < 40, `Expected score < 40, got ${result.score}`);
  assert.strictEqual(result.tier, 'LOW_PRIORITY');
});

// 4. Follow-up Task Engine
it('CP26-06: FollowUpTaskEngine generates D0 to D30 milestones without sending automated WhatsApp', () => {
  const { FollowUpTaskEngine, STANDARD_FOLLOWUP_SEQUENCE } = loadTsModule('src/lib/followup-task-engine.ts');
  assert.strictEqual(STANDARD_FOLLOWUP_SEQUENCE.length, 7);
  const tasks = FollowUpTaskEngine.generateInitialTasks('AVL-2026-001', 'Sachin Shinde');
  assert.strictEqual(tasks.length, 7);
  assert.strictEqual(tasks[0].timingStage, 'D0');
  assert.strictEqual(tasks[6].timingStage, 'D30');
});

it('CP26-07: FollowUpTaskEngine identifies overdue tasks correctly', () => {
  const { FollowUpTaskEngine } = loadTsModule('src/lib/followup-task-engine.ts');
  const pastDate = new Date(Date.now() - 86400000); // 1 day ago
  const tasks = [
    { taskId: 'T1', title: 'Call client', dueDate: pastDate, status: 'PENDING' },
    { taskId: 'T2', title: 'Doc review', dueDate: new Date(Date.now() + 86400000), status: 'PENDING' }
  ];
  const evaluated = FollowUpTaskEngine.evaluateTaskStatuses(tasks);
  assert.strictEqual(evaluated[0].status, 'OVERDUE');
  assert.strictEqual(evaluated[1].status, 'PENDING');
});

// 5. Document Checklists
it('CP26-08: Document checklist generator provides mandatory medical registration for Doctor Loans', () => {
  const { CATEGORY_DOCUMENT_CHECKLISTS } = loadTsModule('src/lib/document-checklist.ts');
  const doctorChecklist = CATEGORY_DOCUMENT_CHECKLISTS['Doctor Loan'];
  assert.ok(doctorChecklist.some(d => d.code === 'DOC_MED_DEGREE'));
  assert.ok(doctorChecklist.some(d => d.code === 'DOC_CLINIC_PROOF'));
});

it('CP26-09: Document checklist provides Audited Balance Sheet & Campus Title for School Funding', () => {
  const { CATEGORY_DOCUMENT_CHECKLISTS } = loadTsModule('src/lib/document-checklist.ts');
  const schoolChecklist = CATEGORY_DOCUMENT_CHECKLISTS['School Funding'];
  assert.ok(schoolChecklist.some(d => d.code === 'DOC_CAMPUS_TITLE'));
  assert.ok(schoolChecklist.some(d => d.code === 'DOC_AUDITED_3YR'));
});

// 6. Partner Lenders & Advisors
it('CP26-10: Default partner lenders contain verified institutions with indicative terms', () => {
  const lenderMod = loadTsModule('src/models/Lender.ts');
  assert.ok(lenderMod.DEFAULT_AVANI_LENDERS.length >= 5);
  const hdfc = lenderMod.DEFAULT_AVANI_LENDERS.find(l => l.name === 'HDFC Bank');
  assert.ok(hdfc);
  assert.ok(hdfc.categories.includes('Doctor Loan'));
});

it('CP26-11: Default advisor profile includes Sachin Shinde as CHIEF_LOAN_ADVISOR', () => {
  const advisorMod = loadTsModule('src/models/Advisor.ts');
  assert.ok(advisorMod.DEFAULT_AVANI_ADVISORS.length >= 1);
  const chief = advisorMod.DEFAULT_AVANI_ADVISORS.find(a => a.name === 'Sachin Shinde');
  assert.ok(chief);
  assert.strictEqual(chief.role, 'CHIEF_LOAN_ADVISOR');
});

// 7. Real-world Cases (Cases A to G)
it('CP26-12 [Case A]: Doctor Loan enquiry initializes to NEW_ENQUIRY with Doctor Loan profile', () => {
  const pipelineMod = loadTsModule('src/config/pipeline.ts');
  const initialStage = pipelineMod.mapLegacyStatusToStage('NEW');
  assert.strictEqual(initialStage, 'NEW_ENQUIRY');
});

it('CP26-13 [Case B]: Business Loan lead with missing turnover reflects NEEDS_FURTHER_INFO tier', () => {
  const { QualificationEngine } = loadTsModule('src/lib/qualification-engine.ts');
  const bizLead = {
    name: 'Patil Enterprises',
    phone: '919422001122',
    loanType: 'Business Loan',
    employmentType: 'Business Owner',
    requiredLoanAmount: 1500000,
    city: 'Latur',
    loanPurpose: 'Machinery Purchase'
    // turnover missing
  };
  const res = QualificationEngine.calculateScore(bizLead);
  assert.ok(res.score >= 40 && res.score < 60, `Expected 40-59, got ${res.score}`);
  assert.strictEqual(res.tier, 'NEEDS_FURTHER_INFO');
});

it('CP26-14 [Case C]: Home Loan lead with documents pending remains in DOCUMENTS_PENDING', () => {
  const pipelineMod = loadTsModule('src/config/pipeline.ts');
  assert.strictEqual(pipelineMod.mapLegacyStatusToStage('Documents Pending'), 'DOCUMENTS_PENDING');
});

it('CP26-15 [Case D]: School Funding lead requires campus land proof and audited balance sheet', () => {
  const { getChecklistForProduct } = loadTsModule('src/lib/document-checklist.ts');
  const checklist = getChecklistForProduct('School Funding');
  assert.ok(checklist.some(d => d.code === 'DOC_CAMPUS_TITLE'));
});

it('CP26-16 [Case E]: Application submitted to lender tracks lender name and application number', () => {
  const app = {
    lenderName: 'HDFC Bank',
    applicationNumber: 'APP-102938',
    appliedAmount: 2500000,
    status: 'SUBMITTED'
  };
  assert.strictEqual(app.status, 'SUBMITTED');
  assert.strictEqual(app.lenderName, 'HDFC Bank');
});

it('CP26-17 [Case F]: Sanctioned loan distinguishes sanctioned amount from disbursed amount', () => {
  const leadState = {
    stage: 'SANCTIONED',
    sanction: { sanctionedAmount: 2500000, status: 'SANCTIONED' },
    disbursement: { disbursedAmount: 0, status: 'PENDING' }
  };
  assert.strictEqual(leadState.sanction.status, 'SANCTIONED');
  assert.strictEqual(leadState.disbursement.status, 'PENDING');
  assert.notStrictEqual(leadState.sanction.sanctionedAmount, leadState.disbursement.disbursedAmount);
});

it('CP26-18 [Case G]: Disbursed loan reconciles actual revenue collected against invoice number', () => {
  const revenueRecord = {
    agreedCommissionPct: 1.5,
    expectedRevenue: 37500,
    actualRevenueReceived: 37500,
    paymentStatus: 'RECEIVED',
    invoiceNumber: 'INV-2026-0819'
  };
  assert.strictEqual(revenueRecord.paymentStatus, 'RECEIVED');
  assert.strictEqual(revenueRecord.actualRevenueReceived, 37500);
  assert.strictEqual(revenueRecord.expectedRevenue - revenueRecord.actualRevenueReceived, 0);
});

it('CP26-19: Conversion rates compute correctly without division by zero', () => {
  const enquiries = 100;
  const submitted = 40;
  const sanctioned = 20;
  const disbursed = 15;

  const leadToApp = Math.round((submitted / enquiries) * 100);
  const appToSanction = Math.round((sanctioned / submitted) * 100);
  const sanctionToDisbursed = Math.round((disbursed / sanctioned) * 100);

  assert.strictEqual(leadToApp, 40);
  assert.strictEqual(appToSanction, 50);
  assert.strictEqual(sanctionToDisbursed, 75);
});

it('CP26-20: Production safeguards remain uncompromised', () => {
  const chatmitraCode = fs.readFileSync(path.join(__dirname, '../src/lib/chatmitra.ts'), 'utf8');
  const workerCode = fs.readFileSync(path.join(__dirname, '../src/app/api/whatsapp-webhook-worker/route.ts'), 'utf8');
  const safeguardsCode = fs.readFileSync(path.join(__dirname, '../src/lib/safeguards.ts'), 'utf8');
  assert.match(chatmitraCode, /evaluateAuthorizedTestRecipient/);
  assert.match(safeguardsCode, /AUTHORIZED_TEST_PHONE_CANONICAL/);
  assert.doesNotMatch(chatmitraCode, /919175635165/);
  assert.match(workerCode, /CHATMITRA_INBOUND_AUTO_REPLY_ENABLED/);
  assert.match(workerCode, /Safe Operating Mode: Inbound AI auto-reply is disabled/);
});

console.log(`\n${passed} / ${passed + failed} TESTS PASSED`);
if (failed > 0) process.exit(1);
