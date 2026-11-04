'use strict';

const fs = require('fs');
const path = require('path');

const ws1 = 'C:\\Users\\ALPHA-1\\Downloads\\21MAY2026\\SACHIN SHINDE DOCUMENTS\\DEVELOPEMENT TOOLS\\1-AVANI LOAN SERVICE FY 26-27';
const ws2 = 'C:\\Users\\ALPHA-1\\Downloads\\21MAY2026\\SACHIN SHINDE DOCUMENTS\\DEVELOPEMENT TOOLS\\3-AVANI AI CRM';

function parseEnvFile(filePath) {
  if (!fs.existsSync(filePath)) return null;
  const content = fs.readFileSync(filePath, 'utf8');
  const vars = {};
  const lines = content.split(/\r?\n/);
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eqIdx = trimmed.indexOf('=');
    if (eqIdx !== -1) {
      const key = trimmed.slice(0, eqIdx).trim();
      const val = trimmed.slice(eqIdx + 1).trim();
      vars[key] = val.length > 0 ? 'SET' : 'EMPTY';
    }
  }
  return vars;
}

const ws1Files = ['.env', '.env.example', '.env.local', '.env.prod.13sept26.txt', '.env.production'];
const ws2Files = ['.env.local', '.env.local.backup', '.env.prod.tmp', '.env.production', '.env.production.tmp', '.env.staging.example', '.env.test'];

const report = { ws1: {}, ws2: {} };

for (const f of ws1Files) {
  const p = path.join(ws1, f);
  const res = parseEnvFile(p);
  if (res) report.ws1[f] = res;
}

for (const f of ws2Files) {
  const p = path.join(ws2, f);
  const res = parseEnvFile(p);
  if (res) report.ws2[f] = res;
}

console.log('=== WORKSPACE 1 ENV FILES & KEYS ===');
for (const [file, keys] of Object.entries(report.ws1)) {
  console.log(`\nFile: ${file} (${Object.keys(keys).length} vars)`);
  for (const [k, status] of Object.entries(keys)) {
    console.log(`  - ${k}: ${status}`);
  }
}

console.log('\n=== WORKSPACE 2 ENV FILES & KEYS ===');
for (const [file, keys] of Object.entries(report.ws2)) {
  console.log(`\nFile: ${file} (${Object.keys(keys).length} vars)`);
  for (const [k, status] of Object.entries(keys)) {
    console.log(`  - ${k}: ${status}`);
  }
}
