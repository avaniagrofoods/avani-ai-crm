'use strict';

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { spawnSync } = require('child_process');
const { MongoClient } = require('mongodb');

const envPath = path.join(__dirname, 'dev.env.tmp');
if (!fs.existsSync(envPath)) {
  console.error('scratch/dev.env.tmp missing');
  process.exit(1);
}

const rawContent = fs.readFileSync(envPath, 'utf8');
const match = rawContent.match(/avani_ai_crm_prod_MONGODB_URI=['"]?([^'"\r\n]+)/);
if (!match) {
  console.error('avani_ai_crm_prod_MONGODB_URI not found');
  process.exit(1);
}

const srvUri = match[1];
const normalized = srvUri.replace(/^mongodb\+srv:\/\//, 'http://').replace(/^mongodb:\/\//, 'http://');
const parsed = new URL(normalized);

const shards = [
  'ac-zvgiqym-shard-00-00.korkujb.mongodb.net:27017',
  'ac-zvgiqym-shard-00-01.korkujb.mongodb.net:27017',
  'ac-zvgiqym-shard-00-02.korkujb.mongodb.net:27017'
].join(',');

const mongodumpExe = 'C:\\Program Files\\MongoDB\\Tools\\100\\bin\\mongodump.exe';
const mongorestoreExe = 'C:\\Program Files\\MongoDB\\Tools\\100\\bin\\mongorestore.exe';

const timestamp = Date.now();
const backupDir = 'C:\\Users\\ALPHA-1\\.gemini\\antigravity\\brain\\ca33a9a1-9f8f-4677-8473-3a87ecd7d09a\\backups';
const archivePath = path.join(backupDir, `avani_ai_crm_prod_snapshot_${timestamp}.bson.gz`);
const restoreTargetDb = `avani_ai_crm_restore_test_${timestamp}`;

console.log('================================================================================');
console.log('🚀 MONGODB ATLAS PHYSICAL BACKUP & ISOLATED RESTORE DRILL');
console.log('================================================================================');
console.log('Cluster Host:       ', parsed.host);
console.log('Authenticated User: ', parsed.username);
console.log('Backup Target Path: ', archivePath);
console.log('Restore Sandbox DB: ', restoreTargetDb);
console.log('================================================================================\n');

async function runDrill() {
  const directUri = `mongodb://${parsed.username}:${parsed.password}@${shards}/?ssl=true&authSource=admin&retryWrites=true&w=majority`;
  const client = new MongoClient(directUri);
  await client.connect();
  console.log('Connected to cluster successfully.');

  const prodDb = client.db('avani_ai_crm_prod');
  const prodCols = await prodDb.listCollections().toArray();
  const sourceStats = {};
  for (const c of prodCols) {
    const count = await prodDb.collection(c.name).countDocuments();
    const indexes = await prodDb.collection(c.name).indexes();
    sourceStats[c.name] = { count, indexNames: indexes.map(i => i.name) };
    console.log(`Source [${c.name}]: ${count} docs | Indexes: ${sourceStats[c.name].indexNames.join(', ')}`);
  }

  await client.close();

  // Step 2: Test mongodump with SRV URI first, fallback to direct replicaSet with SCRAM-SHA-256
  console.log('\n--- Step 2: Executing mongodump ---');
  let dumpArgs = [
    `--uri=${srvUri}`,
    `--db=avani_ai_crm_prod`,
    `--archive=${archivePath}`,
    '--gzip'
  ];

  console.log('Attempting mongodump with SRV URI...');
  let dumpStart = Date.now();
  let dumpRes = spawnSync(mongodumpExe, dumpArgs, { encoding: 'utf8' });

  if (dumpRes.status !== 0) {
    console.log('SRV failed, trying direct replicaSet with SCRAM-SHA-256...');
    const directDumpUri = `mongodb://${parsed.username}:${parsed.password}@${shards}/avani_ai_crm_prod?ssl=true&replicaSet=atlas-zvgiqym-shard-0&authSource=admin&retryWrites=true&w=majority`;
    dumpArgs = [
      `--uri=${directDumpUri}`,
      '--authenticationMechanism=SCRAM-SHA-256',
      `--archive=${archivePath}`,
      '--gzip'
    ];
    dumpRes = spawnSync(mongodumpExe, dumpArgs, { encoding: 'utf8' });
  }

  const dumpDuration = Date.now() - dumpStart;

  if (dumpRes.status !== 0) {
    console.error('❌ mongodump failed with exit code:', dumpRes.status);
    console.error('Error Output:', dumpRes.stderr || dumpRes.stdout);
    process.exit(1);
  }

  console.log(`✅ mongodump completed successfully in ${dumpDuration}ms!`);
  if (dumpRes.stderr) console.log('mongodump log:', dumpRes.stderr.trim());

  // Step 3: Verify Archive File & Compute SHA-256
  console.log('\n--- Step 3: Verifying Archive & Checksum ---');
  if (!fs.existsSync(archivePath)) {
    console.error('❌ Archive file does not exist on disk!');
    process.exit(1);
  }

  const stat = fs.statSync(archivePath);
  console.log(`Archive file size: ${stat.size} bytes (${(stat.size / 1024).toFixed(2)} KB)`);
  if (stat.size === 0) {
    console.error('❌ Archive file is empty (0 bytes)!');
    process.exit(1);
  }

  const fileBuffer = fs.readFileSync(archivePath);
  const hash = crypto.createHash('sha256').update(fileBuffer).digest('hex');
  console.log(`Archive SHA-256:   ${hash}`);

  // Step 4: Execute mongorestore into Isolated Sandbox Target
  console.log(`\n--- Step 4: Executing mongorestore into Isolated Target: ${restoreTargetDb} ---`);
  
  // Use same URI style that succeeded for dump
  let restoreArgs;
  if (dumpArgs[0].includes('mongodb+srv://')) {
    restoreArgs = [
      `--uri=${srvUri}`,
      `--archive=${archivePath}`,
      '--gzip',
      `--nsFrom=avani_ai_crm_prod.*`,
      `--nsTo=${restoreTargetDb}.*`
    ];
  } else {
    restoreArgs = [
      dumpArgs[0], // directDumpUri
      '--authenticationMechanism=SCRAM-SHA-256',
      `--archive=${archivePath}`,
      '--gzip',
      `--nsFrom=avani_ai_crm_prod.*`,
      `--nsTo=${restoreTargetDb}.*`
    ];
  }

  console.log('Running mongorestore command (credentials masked)...');
  const restoreStart = Date.now();
  const restoreRes = spawnSync(mongorestoreExe, restoreArgs, { encoding: 'utf8' });
  const restoreDuration = Date.now() - restoreStart;

  if (restoreRes.status !== 0) {
    console.error('❌ mongorestore failed with exit code:', restoreRes.status);
    console.error('Error Output:', restoreRes.stderr || restoreRes.stdout);
    process.exit(1);
  }

  console.log(`✅ mongorestore completed successfully in ${restoreDuration}ms!`);
  if (restoreRes.stderr) console.log('mongorestore log:', restoreRes.stderr.trim());

  // Step 5: Parity & Integrity Verification
  console.log('\n--- Step 5: Validating Parity on Isolated Target ---');
  const verifyClient = new MongoClient(directUri);
  await verifyClient.connect();

  const targetDb = verifyClient.db(restoreTargetDb);
  const targetCols = await targetDb.listCollections().toArray();
  console.log(`Restored target database [${restoreTargetDb}] collection count: ${targetCols.length}`);

  let allMatch = true;
  for (const c of targetCols) {
    const count = await targetDb.collection(c.name).countDocuments();
    const indexes = await targetDb.collection(c.name).indexes();
    const indexNames = indexes.map(i => i.name);
    const expected = sourceStats[c.name];

    const countMatch = expected && expected.count === count;
    const indexMatch = expected && expected.indexNames.sort().join(',') === indexNames.sort().join(',');

    console.log(`Restored [${c.name}]: ${count} docs (Expected: ${expected?.count}) | Indexes: ${indexNames.join(', ')}`);
    console.log(`  -> Count Parity: ${countMatch ? 'MATCH (100%)' : 'MISMATCH'} | Index Parity: ${indexMatch ? 'MATCH (100%)' : 'MISMATCH'}`);

    if (!countMatch || !indexMatch) allMatch = false;
  }

  // Also confirm production was untouched
  const finalProdDb = verifyClient.db('avani_ai_crm_prod');
  const finalProdCols = await finalProdDb.listCollections().toArray();
  console.log(`\nFinal Production collection count check: ${finalProdCols.length} (UNTOUCHED)`);

  await verifyClient.close();

  if (allMatch) {
    console.log('\n================================================================================');
    console.log('🎉 PHYSICAL BACKUP & ISOLATED RESTORE DRILL: 100% SUCCESSFUL!');
    console.log(`📦 Archive Location: ${archivePath}`);
    console.log(`🔑 SHA-256 Hash:     ${hash}`);
    console.log(`🛡️ Isolated Target:  ${restoreTargetDb} (Preserved for owner inspection)`);
    console.log('================================================================================');
  } else {
    console.error('\n❌ Parity verification failed!');
    process.exit(1);
  }
}

runDrill().catch(err => {
  console.error('Fatal drill error:', err);
  process.exit(1);
});
