import mongoose from 'mongoose';
import fs from 'fs';
import path from 'path';
import dns from 'dns';

try {
  dns.setServers(['8.8.8.8', '1.1.1.1']);
} catch (e) {
  // Ignore
}

const envPath = path.resolve('.env.local');
let uri = process.env.MONGODB_URI;

if (!uri && fs.existsSync(envPath)) {
  const envContent = fs.readFileSync(envPath, 'utf8');
  const match = envContent.match(/MONGODB_URI=["']?([^"'\r\n]+)["']?/);
  if (match) uri = match[1];
}

if (!uri) {
  console.error("MONGODB_URI not found in .env.local");
  process.exit(1);
}

const sanitizedTarget = uri.replace(/\/\/[^@]+@/, '//****:****@');
console.log("Testing DIRECT connection to:", sanitizedTarget);

mongoose.connect(uri, { serverSelectionTimeoutMS: 5000 })
  .then(() => {
    console.log("Connected successfully!");
    process.exit(0);
  })
  .catch((err) => {
    console.error("Connection failed:", err.message);
    if (err.reason && err.reason.servers) {
      for (const [server, desc] of err.reason.servers) {
        console.error(`  Shard: ${server} | Error: ${desc.error ? desc.error.message : 'none'}`);
      }
    }
    process.exit(1);
  });
