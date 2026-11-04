'use strict';

const fs = require('fs');
const path = require('path');

// Read secret safely from scratch file without printing
const scratchPath = 'C:\\Users\\ALPHA-1\\.gemini\\antigravity\\brain\\2246a01a-1992-46fd-857b-977242a2e659\\scratch\\test_rotated_credentials.cjs';
let secret = null;
if (fs.existsSync(scratchPath)) {
  const match = fs.readFileSync(scratchPath, 'utf8').match(/const SECRET_B = '([^']+)';/);
  if (match) secret = match[1];
}

if (!secret) {
  console.log('No secret identified in reference file.');
  process.exit(0);
}

const rootDir = process.cwd();
const exposedLocations = [];

function scanDir(dir) {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    if (entry.name === 'node_modules' || entry.name === '.git' || entry.name === '.next' || entry.name === 'scratch') continue;
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      scanDir(fullPath);
    } else if (entry.isFile()) {
      try {
        const content = fs.readFileSync(fullPath, 'utf8');
        if (content.includes(secret)) {
          const lines = content.split('\n');
          const matchedLines = [];
          lines.forEach((line, idx) => {
            if (line.includes(secret)) matchedLines.push(idx + 1);
          });
          exposedLocations.push({
            file: path.relative(rootDir, fullPath),
            lines: matchedLines
          });
        }
      } catch {}
    }
  }
}

scanDir(rootDir);

console.log('=== SECRET EXPOSURE SCAN RESULTS (SAFE SCAN) ===');
console.log(`Total files scanned. Exposures found: ${exposedLocations.length}`);
for (const loc of exposedLocations) {
  console.log(`- File: ${loc.file} | Lines: ${loc.lines.join(', ')}`);
}
