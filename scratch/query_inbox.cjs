'use strict';

const fs = require('fs');
const { MongoClient } = require('mongodb');

async function checkInbox() {
  const envContent = fs.readFileSync('scratch/dev.env.tmp', 'utf8');
  const match = envContent.match(/avani_ai_crm_prod_MONGODB_URI=['"]?([^'"\r\n]+)/);
  if (!match) {
    console.error('No URI found');
    return;
  }

  const rawUri = match[1];
  const normalized = rawUri.replace(/^mongodb\+srv:\/\//, 'http://').replace(/^mongodb:\/\//, 'http://');
  const parsed = new URL(normalized);

  const shards = [
    'ac-zvgiqym-shard-00-00.korkujb.mongodb.net:27017',
    'ac-zvgiqym-shard-00-01.korkujb.mongodb.net:27017',
    'ac-zvgiqym-shard-00-02.korkujb.mongodb.net:27017'
  ].join(',');

  const username = encodeURIComponent(decodeURIComponent(parsed.username));
  const password = encodeURIComponent(decodeURIComponent(parsed.password));

  const directUri = `mongodb://${username}:${password}@${shards}/avani_ai_crm_prod?ssl=true&replicaSet=atlas-zvgiqym-shard-0&authSource=admin&retryWrites=true&w=majority`;

  const client = new MongoClient(directUri, { serverSelectionTimeoutMS: 8000 });
  await client.connect();
  const db = client.db('avani_ai_crm_prod');
  const collection = db.collection('webhookinboxes');

  const count = await collection.countDocuments();
  console.log('Total WebhookInbox documents in avani_ai_crm_prod:', count);

  const docs = await collection.find().sort({ createdAt: -1 }).limit(10).toArray();
  for (const d of docs) {
    console.log({
      eventId: d.eventId,
      provider: d.provider,
      eventType: d.eventType,
      status: d.status,
      correlationId: d.correlationId,
      createdAt: d.createdAt,
      payloadKeys: d.payload ? Object.keys(d.payload) : null
    });
  }

  await client.close();
}

checkInbox().catch(console.error);
