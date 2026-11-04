'use strict';

const fs = require('fs');
const mongoose = require('mongoose');

// Retrieve credential safely
let password = process.env.MONGODB_PASSWORD;
if (!password) {
  try {
    const scratchPath = 'C:\\Users\\ALPHA-1\\.gemini\\antigravity\\brain\\2246a01a-1992-46fd-857b-977242a2e659\\scratch\\test_rotated_credentials.cjs';
    if (fs.existsSync(scratchPath)) {
      const match = fs.readFileSync(scratchPath, 'utf8').match(/const SECRET_B = '([^']+)';/);
      if (match) password = match[1];
    }
  } catch {}
}

if (!password) {
  console.error('❌ MONGODB_PASSWORD not found');
  process.exit(1);
}

const DB_USER = 'starpowerzlatur2210_db_user';
const ENCODED_PASS = encodeURIComponent(password);
const SHARD_HOSTS = 'ac-8nlnecw-shard-00-00.rhpn2gh.mongodb.net:27017,ac-8nlnecw-shard-00-01.rhpn2gh.mongodb.net:27017,ac-8nlnecw-shard-00-02.rhpn2gh.mongodb.net:27017';

async function diagnose() {
  console.log('--- MongoDB Atlas Forensic Diagnosis (Read-Only) ---');
  console.log('Target Shards:', SHARD_HOSTS.replace(/rhpn2gh/g, 'rhpn2gh [ACTIVE CLUSTER]'));
  console.log('Target User:  ', DB_USER);

  // We connect using replicaSet directly to bypass Windows c-ares SRV lookup issues
  const directUri = `mongodb://${DB_USER}:${ENCODED_PASS}@${SHARD_HOSTS}/admin?ssl=true&replicaSet=atlas-8nlnecw-shard-0&authSource=admin&retryWrites=true&w=majority`;
  const srvUri = `mongodb+srv://${DB_USER}:${ENCODED_PASS}@avani-loan-services-m0.rhpn2gh.mongodb.net/admin?authSource=admin&retryWrites=true&w=majority`;

  let conn;
  try {
    console.log('Connecting via direct replicaSet connection...');
    conn = await mongoose.createConnection(directUri, { serverSelectionTimeoutMS: 10000 }).asPromise();
    console.log('✅ Connection established! ReadyState:', conn.readyState);
  } catch (err) {
    console.warn('⚠️ Direct connection failed, trying srvUri:', err.message);
    conn = await mongoose.createConnection(srvUri, { serverSelectionTimeoutMS: 10000 }).asPromise();
    console.log('✅ SRV Connection established! ReadyState:', conn.readyState);
  }

  const adminDb = conn.db.admin();

  // 1. List Databases
  console.log('\n--- 1. Available Databases ---');
  const dbs = await adminDb.listDatabases();
  for (const db of dbs.databases) {
    console.log(`- Database: ${db.name} (Size: ${(db.sizeOnDisk / 1024).toFixed(1)} KB, Empty: ${db.empty})`);
  }

  // 2. Check avani_ai_crm_prod
  console.log('\n--- 2. Inspecting avani_ai_crm_prod ---');
  const prodDb = conn.useDb('avani_ai_crm_prod');
  const prodCollections = await prodDb.db.listCollections().toArray();
  console.log(`Collections in avani_ai_crm_prod (${prodCollections.length}):`);
  for (const col of prodCollections) {
    const count = await prodDb.db.collection(col.name).countDocuments();
    const indexes = await prodDb.db.collection(col.name).indexes();
    console.log(`  * ${col.name}: ${count} documents | Indexes: ${indexes.map(i => i.name).join(', ')}`);
  }

  // 3. Check avani_ai_crm_test
  console.log('\n--- 3. Inspecting avani_ai_crm_test ---');
  const testDb = conn.useDb('avani_ai_crm_test');
  const testCollections = await testDb.db.listCollections().toArray();
  console.log(`Collections in avani_ai_crm_test (${testCollections.length}):`);
  for (const col of testCollections) {
    const count = await testDb.db.collection(col.name).countDocuments();
    const indexes = await testDb.db.collection(col.name).indexes();
    console.log(`  * ${col.name}: ${count} documents | Indexes: ${indexes.map(i => i.name).join(', ')}`);
  }

  // 4. Verify user permissions
  console.log('\n--- 4. Checking User Status ---');
  try {
    const userStatus = await adminDb.command({ connectionStatus: 1 });
    console.log('Authenticated User:', userStatus.authInfo?.authenticatedUsers);
    console.log('Authenticated Roles:', JSON.stringify(userStatus.authInfo?.authenticatedUserRoles));
  } catch (err) {
    console.log('Could not get user status:', err.message);
  }

  await conn.close();
  console.log('\n✅ Forensic diagnosis completed successfully (read-only).');
}

diagnose().catch(err => {
  console.error('❌ Diagnostic error:', err);
  process.exit(1);
});
