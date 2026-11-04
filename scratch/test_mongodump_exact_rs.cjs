'use strict';

const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

const envPath = path.join(__dirname, 'dev.env.tmp');
const rawContent = fs.readFileSync(envPath, 'utf8');
const match = rawContent.match(/avani_ai_crm_prod_MONGODB_URI=['"]?([^'"\r\n]+)/);
if (!match) process.exit(1);

const rawUri = match[1];
const normalized = rawUri.replace(/^mongodb\+srv:\/\//, 'http://').replace(/^mongodb:\/\//, 'http://');
const parsed = new URL(normalized);

const shards = [
  'ac-zvgiqym-shard-00-00.korkujb.mongodb.net:27017',
  'ac-zvgiqym-shard-00-01.korkujb.mongodb.net:27017',
  'ac-zvgiqym-shard-00-02.korkujb.mongodb.net:27017'
].join(',');

const mongodumpExe = 'C:\\Program Files\\MongoDB\\Tools\\100\\bin\\mongodump.exe';
const backupDir = 'C:\\Users\\ALPHA-1\\.gemini\\antigravity\\brain\\ca33a9a1-9f8f-4677-8473-3a87ecd7d09a\\backups';
const testArchive = path.join(backupDir, 'test_mongodump.bson.gz');

const username = decodeURIComponent(parsed.username);
const password = decodeURIComponent(parsed.password);

console.log('Testing mongodump with explicit flags...');
console.log('User:', username);
console.log('Host:', shards);

const args = [
  `--host=atlas-14awhq-shard-0/${shards}`,
  '--ssl',
  `--username=${username}`,
  `--password=${password}`,
  '--authenticationDatabase=admin',
  '--db=avani_ai_crm_prod',
  `--archive=${testArchive}`,
  '--gzip'
];

const res = spawnSync(mongodumpExe, args, { encoding: 'utf8' });
console.log('Exit code:', res.status);
if (res.stderr) console.log('Stderr/Log:\n', res.stderr);
if (res.stdout) console.log('Stdout:\n', res.stdout);

if (fs.existsSync(testArchive)) {
  const stat = fs.statSync(testArchive);
  console.log(`\n✅ Archive successfully created! Size: ${stat.size} bytes`);
} else {
  console.log('\n❌ Archive was not created.');
}
