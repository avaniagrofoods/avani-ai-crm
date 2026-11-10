'use strict';

const { execSync } = require('child_process');
const path = require('path');

const testFiles = [
  { name: 'test_audit_evidence_integrity.test.cjs', type: 'Unit / Guard Integrity' },
  { name: 'test_gate3_synthetic_safety.test.cjs', type: 'Unit / Synthetic Safety' },
  { name: 'test_chatmitra_migration.test.cjs', type: 'Mock Integration / Provider Adapter' },
  { name: 'test_chatmantra_integration.test.cjs', type: 'Mock Integration / Webhook & Safety' },
  { name: 'test_gate4_isolated_staging_safety.test.cjs', type: 'Mock Integration / State Lifecycle' },
  { name: 'test_gate5_staging_configuration.test.cjs', type: 'Staging Integration / Config Guards' },
  { name: 'test_stage4_mongodb_application_integration.test.cjs', type: 'Staging Integration / DB Guards' },
  { name: 'test_master_automation_workflows.test.cjs', type: 'End-to-End Master Workflow Automation' },
  { name: 'test_authorized_test_contact_validation.test.cjs', type: 'Phase 6 Test Contact Validation (+91 91756 35165)' },
  { name: 'test_drip_workflow_and_api_endpoints.test.cjs', type: 'Drip Workflow & Sidebar Endpoints Integration' },
  { name: 'test_webhook_signature_forensics.test.cjs', type: 'Webhook Signature Forensics & Provider Discrimination' },
  { name: 'test_chatmitra_webhook_live_contract.test.cjs', type: 'ChatMitra Webhook Live Contract & Deduplication' },
  { name: 'test_inbound_message_persistence_and_crm_inbox.test.cjs', type: 'Inbound Message Persistence & CRM Inbox' },
  { name: 'test_cp21_automation_and_entitlements.test.cjs', type: 'CP-21 ChatMitra Pro Automation & Entitlements' },
  { name: 'test_cp22_pre_pro_automation_readiness.test.cjs', type: 'CP-22 Pre-Pro Automation Readiness & Defect Repair' },
  { name: 'test_cp23_master_automation_readiness.test.cjs', type: 'CP-23 Master Automation Readiness & Regression' },
  { name: 'test_cp25_master_chatbot_and_integrations.test.cjs', type: 'CP-25 Master Chatbot, Checklists, Privacy & Omnichannel Integrations' },
];

console.log('================================================================================');
console.log('🧪 FORENSIC TEST SUITE EXECUTION & RECONCILIATION RUNNER');
console.log('================================================================================\n');

const results = [];

for (const t of testFiles) {
  const filePath = path.join('tests', t.name);
  const cmd = `node ${filePath}`;
  console.log(`Running: ${cmd}...`);
  let exitCode = 0;
  let stdout = '';
  let stderr = '';
  
  try {
    stdout = execSync(cmd, { encoding: 'utf8', timeout: 30000, stdio: ['pipe', 'pipe', 'pipe'] });
  } catch (err) {
    exitCode = err.status || 1;
    stdout = err.stdout ? err.stdout.toString() : '';
    stderr = err.stderr ? err.stderr.toString() : err.message;
  }

  // Count passes and fails
  const passMatches = stdout.match(/\[PASS[^\]]*\]/g) || [];
  const failMatches = stdout.match(/\[FAIL[^\]]*\]/g) || [];
  
  // Also check summary line if present
  let summaryTests = passMatches.length + failMatches.length;
  const summaryMatch = stdout.match(/(\d+)\s*\/\s*(\d+)\s*(?:TESTS\s+PASSED|tests passed)/i);
  let reportedPassed = passMatches.length;
  let reportedTotal = summaryTests;
  if (summaryMatch) {
    reportedPassed = parseInt(summaryMatch[1], 10);
    reportedTotal = parseInt(summaryMatch[2], 10);
  }

  results.push({
    file: t.name,
    cmd,
    type: t.type,
    exitCode,
    passed: reportedPassed,
    failed: failMatches.length,
    total: reportedTotal,
    status: exitCode === 0 ? 'PASS' : 'FAIL/BLOCKED'
  });
  console.log(`  -> Exit Code: ${exitCode} | Passed: ${reportedPassed} | Failed: ${failMatches.length} | Total: ${reportedTotal}\n`);
}

console.log('================================================================================');
console.log('📊 TEST RECONCILIATION SUMMARY TABLE:');
console.log('================================================================================');
console.table(results);
