/**
 * APR-006 Phase 2 — AVANI AI CRM Core Verification & Fail-Closed Guard Suite
 * Verifies:
 *  - All 6 legacy MongoDB customer routes fail closed (HTTP 410) unless LEGACY_MONGODB_ROUTES_ENABLED=true
 *  - Guard execution order preserves auth (401/403) and bulk broadcast safeguard (403) BEFORE 410 and BEFORE connectToDatabase()
 *  - All 8 canonical Google Sheets routes sanitize unexpected 500 errors while preserving structured SheetsCrmError messages
 *  - Zero MongoDB imports in canonical Sheets repositories & public enquiry intake
 *  - Zero customer document upload enforcement (HTTP 410 DOCUMENT_UPLOAD_DISABLED)
 */
'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
let passed = 0;
let failed = 0;

function runTest(name, fn) {
  try {
    fn();
    passed++;
    console.log(`[PASS] ${name}`);
  } catch (err) {
    failed++;
    console.error(`[FAIL] ${name}: ${err.message}`);
  }
}

function readRel(relPath) {
  return fs.readFileSync(path.join(ROOT, relPath), 'utf8');
}

function assertLegacyGuardBeforeDb(relPath, expectedHandlersCount) {
  const src = readRel(relPath);
  const guardMatches = src.match(/process\.env\.LEGACY_MONGODB_ROUTES_ENABLED\s*!==\s*['"]true['"]/g) || [];
  assert.ok(
    guardMatches.length >= expectedHandlersCount,
    `${relPath}: expected >= ${expectedHandlersCount} LEGACY_MONGODB_ROUTES_ENABLED guards, found ${guardMatches.length}`
  );
  assert.ok(src.includes("'LEGACY_MONGODB_ROUTE_DISABLED'"), `${relPath}: missing LEGACY_MONGODB_ROUTE_DISABLED code`);
  assert.ok(src.includes('status: 410'), `${relPath}: missing HTTP 410 status`);

  const firstGuardIdx = src.indexOf("process.env.LEGACY_MONGODB_ROUTES_ENABLED !== 'true'");
  const firstDbCallIdx = src.indexOf('await connectToDatabase()');
  assert.ok(firstGuardIdx !== -1 && firstDbCallIdx !== -1, `${relPath}: guard or connectToDatabase call not found`);
  assert.ok(
    firstGuardIdx < firstDbCallIdx,
    `${relPath}: LEGACY_MONGODB_ROUTES_ENABLED guard must appear before connectToDatabase()`
  );
}

runTest('T01: contacts/[id]/route.ts enforces fail-closed 410 guard on GET & PATCH before DB', () => {
  assertLegacyGuardBeforeDb('src/app/api/contacts/[id]/route.ts', 2);
});

runTest('T02: contacts/bulk-message/route.ts enforces auth -> bulk policy -> 410 guard before DB', () => {
  const rel = 'src/app/api/contacts/bulk-message/route.ts';
  assertLegacyGuardBeforeDb(rel, 1);
  const src = readRel(rel);
  const authIdx = src.indexOf('requireRole');
  const bulkIdx = src.indexOf('evaluateBulkBroadcastPolicy()');
  const guardIdx = src.indexOf("process.env.LEGACY_MONGODB_ROUTES_ENABLED !== 'true'");
  const dbIdx = src.indexOf('await connectToDatabase()');
  assert.ok(authIdx < bulkIdx && bulkIdx < guardIdx && guardIdx < dbIdx, 'Unexpected guard ordering in contacts/bulk-message');
});

runTest('T03: leads/[id]/assign/route.ts enforces fail-closed 410 guard on POST before DB', () => {
  assertLegacyGuardBeforeDb('src/app/api/leads/[id]/assign/route.ts', 1);
});

runTest('T04: leads/[id]/tasks/route.ts enforces fail-closed 410 guard on GET/POST/PATCH before DB', () => {
  assertLegacyGuardBeforeDb('src/app/api/leads/[id]/tasks/route.ts', 3);
});

runTest('T05: leads/trigger/route.ts enforces fail-closed 410 guard on POST before DB', () => {
  assertLegacyGuardBeforeDb('src/app/api/leads/trigger/route.ts', 1);
});

runTest('T06: broadcasts/create/route.ts enforces auth -> bulk policy -> 410 guard before DB', () => {
  const rel = 'src/app/api/broadcasts/create/route.ts';
  assertLegacyGuardBeforeDb(rel, 1);
  const src = readRel(rel);
  const bulkIdx = src.indexOf('evaluateBulkBroadcastPolicy()');
  const guardIdx = src.indexOf("process.env.LEGACY_MONGODB_ROUTES_ENABLED !== 'true'");
  const dbIdx = src.indexOf('await connectToDatabase()');
  assert.ok(bulkIdx < guardIdx && guardIdx < dbIdx, 'Unexpected guard ordering in broadcasts/create');
});

runTest('T07: All 8 canonical Google Sheets API routes sanitize unexpected 500 errors and have zero MongoDB imports', () => {
  const canonicalRoutes = [
    'src/app/api/advisors/route.ts',
    'src/app/api/contacts/route.ts',
    'src/app/api/leads/route.ts',
    'src/app/api/leads/[id]/route.ts',
    'src/app/api/leads/[id]/application/route.ts',
    'src/app/api/leads/[id]/qualify/route.ts',
    'src/app/api/opts/route.ts',
    'src/app/api/schedule/route.ts'
  ];

  for (const rel of canonicalRoutes) {
    const src = readRel(rel);
    assert.ok(!src.includes("@/lib/db"), `${rel}: must not import MongoDB @/lib/db`);
    assert.ok(!src.includes("from 'mongoose'"), `${rel}: must not import mongoose`);
    assert.ok(
      !src.includes('message: error.message'),
      `${rel}: must not pass raw error.message unconditionally on HTTP 500`
    );
    assert.ok(
      src.includes("error instanceof SheetsCrmError ? error.message : 'Internal server error'"),
      `${rel}: missing structured SheetsCrmError vs sanitized 500 message handling`
    );
  }
});

runTest('T08: documents/secure-upload/route.ts enforces zero document storage (HTTP 410 DOCUMENT_UPLOAD_DISABLED)', () => {
  const src = readRel('src/app/api/documents/secure-upload/route.ts');
  assert.ok(src.includes('DOCUMENT_UPLOAD_DISABLED'), 'Missing DOCUMENT_UPLOAD_DISABLED code');
  assert.ok(src.includes('status: 410'), 'Missing HTTP 410 on document upload');
});

runTest('T09: Canonical src/lib/google-sheets/ directory has zero MongoDB/mongoose fallback imports', () => {
  const gsDir = path.join(ROOT, 'src', 'lib', 'google-sheets');
  assert.ok(fs.existsSync(gsDir), 'src/lib/google-sheets directory missing');
  const walk = (dir) => {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) walk(full);
      else if (/\.(ts|tsx|js|cjs|mjs)$/.test(entry.name)) {
        const content = fs.readFileSync(full, 'utf8');
        assert.ok(!/from\s+['"]mongoose['"]/.test(content), `${full}: unexpected mongoose import`);
        assert.ok(!/@\/lib\/db/.test(content), `${full}: unexpected @/lib/db import`);
      }
    }
  };
  walk(gsDir);
});

runTest('T10: Public enquiry intake uses canonical Google Sheets CrmSheetsService with zero MongoDB imports', () => {
  const src = readRel('src/app/api/public/enquiry/route.ts');
  assert.ok(src.includes('CrmSheetsService'), 'public/enquiry must use CrmSheetsService');
  assert.ok(!src.includes("@/lib/db"), 'public/enquiry must not import @/lib/db');
  assert.ok(!src.includes("from 'mongoose'"), 'public/enquiry must not import mongoose');
});

console.log(`\nAPR-006 Phase 2 CRM Core Summary: ${passed} passed, ${failed} failed`);
process.exit(failed > 0 ? 1 : 0);
