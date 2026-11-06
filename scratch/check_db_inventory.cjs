const path = require('path');
const fs = require('fs');
const mongoose = require('mongoose');

function loadEnvFile(filePath) {
  if (!fs.existsSync(filePath)) return;
  const content = fs.readFileSync(filePath, 'utf8');
  content.split('\n').forEach(line => {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) return;
    const eqIdx = trimmed.indexOf('=');
    if (eqIdx === -1) return;
    const key = trimmed.slice(0, eqIdx).trim();
    let val = trimmed.slice(eqIdx + 1).trim();
    if (val.startsWith('"') && val.endsWith('"')) val = val.slice(1, -1);
    else if (val.startsWith("'") && val.endsWith("'")) val = val.slice(1, -1);
    process.env[key] = val;
  });
}

loadEnvFile(path.join(__dirname, '..', '.env.production'));
loadEnvFile(path.join(__dirname, '..', '.env.local'));

const uri = process.env.MONGODB_URI;
console.log('MongoDB URI Present:', Boolean(uri));

async function main() {
  if (!uri) {
    console.log('No URI configured in local environment.');
    return;
  }
  try {
    await mongoose.connect(uri, { serverSelectionTimeoutMS: 5000 });
    console.log('Connected to MongoDB Atlas successfully.');
    const db = mongoose.connection.db;

    const inboxesCount = await db.collection('webhookinboxes').countDocuments();
    const messagesCount = await db.collection('messages').countDocuments();
    const contactsCount = await db.collection('contacts').countDocuments();
    const leadsCount = await db.collection('leads').countDocuments();

    console.log(`Live Counts -> WebhookInbox: ${inboxesCount} | Messages: ${messagesCount} | Contacts: ${contactsCount} | Leads: ${leadsCount}`);

    const cmCount = await db.collection('webhookinboxes').countDocuments({ provider: 'ChatMitra' });
    const metaCount = await db.collection('webhookinboxes').countDocuments({ provider: { $in: ['Meta', 'WhatsApp'] } });
    console.log(`Provider Events in WebhookInbox -> ChatMitra: ${cmCount} | Meta/WhatsApp: ${metaCount}`);

    // Check last 5 messages in DB
    const recentMessages = await db.collection('messages').find({}).sort({ createdAt: -1 }).limit(5).toArray();
    console.log('Recent Messages:');
    recentMessages.forEach((m, idx) => {
      console.log(` [${idx + 1}] dir=${m.direction} status=${m.status} phone=${m.phone || m.senderPhone} text="${(m.text || '').slice(0, 35)}"`);
    });

    await mongoose.disconnect();
  } catch (err) {
    console.error('Database probe error:', err.message);
  }
}

main();
