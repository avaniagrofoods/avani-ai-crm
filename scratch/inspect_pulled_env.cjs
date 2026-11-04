'use strict';

const fs = require('fs');
const path = require('path');
const { MongoClient } = require('mongodb');

const envPath = path.join(__dirname, 'dev.env.tmp');
if (!fs.existsSync(envPath)) {
  console.error('scratch/dev.env.tmp does not exist');
  process.exit(1);
}

const rawContent = fs.readFileSync(envPath, 'utf8');
const envConfig = {};
for (const line of rawContent.split('\n')) {
  const trimmed = line.trim();
  if (!trimmed || trimmed.startsWith('#')) continue;
  const eqIdx = trimmed.indexOf('=');
  if (eqIdx !== -1) {
    const key = trimmed.slice(0, eqIdx).trim();
    let val = trimmed.slice(eqIdx + 1).trim();
    if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
      val = val.slice(1, -1);
    }
    envConfig[key] = val;
  }
}

const targetKey = 'avani_ai_crm_prod_MONGODB_URI';
const uri = envConfig[targetKey];

if (!uri) {
  console.log('No URI found');
  process.exit(1);
}

const normalized = uri.replace(/^mongodb\+srv:\/\//, 'http://').replace(/^mongodb:\/\//, 'http://');
const parsed = new URL(normalized);

console.log('=== METADATA & CONNECTION PROBE ===');
console.log('Target Host:', parsed.host);
console.log('Username:   ', parsed.username);

// We construct a direct replicaSet connection string to bypass Windows c-ares SRV DNS lookup issues
const shards = [
  'ac-zvgiqym-shard-00-00.korkujb.mongodb.net:27017',
  'ac-zvgiqym-shard-00-01.korkujb.mongodb.net:27017',
  'ac-zvgiqym-shard-00-02.korkujb.mongodb.net:27017'
].join(',');

const directUri = `mongodb://${parsed.username}:${parsed.password}@${shards}/?ssl=true&authSource=admin&retryWrites=true&w=majority`;

async function run() {
  console.log('Connecting to MongoDB Atlas via replicaSet direct hosts...');
  const client = new MongoClient(directUri, {
    serverSelectionTimeoutMS: 10000,
    connectTimeoutMS: 10000,
  });

  try {
    await client.connect();
    console.log('✅ CONNECTED TO ATLAS SUCCESSFULLY!');

    // 1. Check connection status and user privileges
    const admin = client.db('admin');
    const hello = await admin.command({ hello: 1 });
    console.log('EXACT REPLICA SET NAME:', hello.setName);
    console.log('PRIMARY HOST:          ', hello.primary);
    console.log('HOSTS:                 ', JSON.stringify(hello.hosts));
    const connStatus = await admin.command({ connectionStatus: 1 });
    console.log('\n--- Authenticated Users & Roles ---');
    console.log('Users:', JSON.stringify(connStatus.authInfo?.authenticatedUsers));
    console.log('Roles:', JSON.stringify(connStatus.authInfo?.authenticatedUserRoles));

    // 2. List all databases
    console.log('\n--- Available Databases on Cluster ---');
    const dbs = await admin.admin().listDatabases();
    for (const d of dbs.databases) {
      console.log(`* Database: ${d.name} | Size: ${(d.sizeOnDisk / 1024).toFixed(1)} KB | Empty: ${d.empty}`);
    }

    // 3. Inspect default or specified databases
    const checkDbs = ['avani_ai_crm_prod', 'test', 'admin'];
    for (const name of checkDbs) {
      const db = client.db(name);
      const cols = await db.listCollections().toArray();
      if (cols.length > 0) {
        console.log(`\nCollections in ${name} (${cols.length}):`);
        for (const c of cols) {
          const count = await db.collection(c.name).countDocuments();
          const indexes = await db.collection(c.name).indexes();
          console.log(`  - ${c.name}: ${count} docs | Indexes: ${indexes.map(i => i.name).join(', ')}`);
        }
      } else {
        console.log(`\nDatabase ${name} has 0 collections or does not exist yet.`);
      }
    }

    await client.close();
    console.log('\n✅ Read-only connection probe succeeded completely.');
  } catch (err) {
    console.error('❌ Connection probe failed:', err.message);
  }
}

run();
