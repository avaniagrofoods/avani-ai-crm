'use strict';

const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');
const { MongoClient } = require('mongodb');

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

const replicaSetName = 'atlas-14awhq-shard-0';
const mongorestoreExe = 'C:\\Program Files\\MongoDB\\Tools\\100\\bin\\mongorestore.exe';
const backupDir = 'C:\\Users\\ALPHA-1\\.gemini\\antigravity\\brain\\ca33a9a1-9f8f-4677-8473-3a87ecd7d09a\\backups';
const testArchive = path.join(backupDir, 'test_mongodump.bson.gz');

const username = decodeURIComponent(parsed.username);
const password = decodeURIComponent(parsed.password);

// Target database name <= 38 bytes
const restoreTargetDb = 'crm_restore_drill';

console.log('Testing mongorestore into isolated sandbox:', restoreTargetDb);
console.log('Archive: ', testArchive);

const restoreArgs = [
  `--host=${replicaSetName}/${shards}`,
  '--ssl',
  `--username=${username}`,
  `--password=${password}`,
  '--authenticationDatabase=admin',
  `--archive=${testArchive}`,
  '--gzip',
  '--nsFrom=avani_ai_crm_prod.*',
  `--nsTo=${restoreTargetDb}.*`
];

const res = spawnSync(mongorestoreExe, restoreArgs, { encoding: 'utf8' });
console.log('Exit code:', res.status);
if (res.stderr) console.log('Stderr/Log:\n', res.stderr);
if (res.stdout) console.log('Stdout:\n', res.stdout);

async function verify() {
  const directUri = `mongodb://${parsed.username}:${parsed.password}@${shards}/?ssl=true&authSource=admin&retryWrites=true&w=majority`;
  const client = new MongoClient(directUri);
  await client.connect();

  const targetDb = client.db(restoreTargetDb);
  const targetCols = await targetDb.listCollections().toArray();
  console.log(`\nRestored Target Database: ${restoreTargetDb}`);
  console.log(`Collections found: ${targetCols.length}`);
  for (const c of targetCols) {
    const count = await targetDb.collection(c.name).countDocuments();
    const indexes = await targetDb.collection(c.name).indexes();
    console.log(`  * ${c.name}: ${count} docs | Indexes: ${indexes.map(i => i.name).join(', ')}`);
  }

  await client.close();
  console.log('\n✅ Restore verification complete. Target preserved for inspection.');
}

verify().catch(e => console.error(e));
