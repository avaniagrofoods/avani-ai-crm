import mongoose from "mongoose";
import { sendSlackAlert } from "./alerts";

let cached = (global as any).mongoose;

if (!cached) {
  cached = (global as any).mongoose = { conn: null, promise: null, lastError: null };
}

export async function connectToDatabase() {
  const MONGODB_URI = process.env.MONGODB_URI;
  if (!MONGODB_URI || !MONGODB_URI.trim()) {
    console.warn("MONGODB_URI is not defined or is empty in environment.");
    cached.lastError = "MONGODB_URI is not defined or is empty in environment.";
    return null;
  }

  const APP_MODE = process.env.APP_MODE || 'production';
  const PROVIDER_MODE = process.env.PROVIDER_MODE || 'mock';
  const VERCEL_ENV = process.env.VERCEL_ENV || '';

  // 1. REJECT DECOMMISSIONED/LEGACY CLUSTER
  if (MONGODB_URI.includes('cluster0.mlcxcp.mongodb.net')) {
    const errMsg = "LEGACY_CLUSTER_REJECTED: cluster0.mlcxcp.mongodb.net is decommissioned. Update Vercel environment variables to use active rhpn2gh cluster.";
    console.error(errMsg);
    cached.lastError = errMsg;
    return null;
  }

  // 2. REJECT CROSS-APPLICATION CLUSTER (LOAN SERVICES CLUSTER)
  if (MONGODB_URI.includes('xj6nhak.mongodb.net')) {
    const errMsg = "CROSS_APPLICATION_CLUSTER_REJECTED: xj6nhak belongs to AVANI Loan Services. AI CRM must use rhpn2gh.";
    console.error(errMsg);
    cached.lastError = errMsg;
    return null;
  }

  // 3. FORENSIC SAFETY GUARD (TEST / STAGING / PREVIEW)
  const isStagingOrPreview = APP_MODE === 'test' || APP_MODE === 'staging' || VERCEL_ENV === 'preview';
  if (isStagingOrPreview) {
    if (MONGODB_URI.includes('avani_ai_crm_prod')) {
      console.error("PRODUCTION DATABASE DETECTED — TEST ABORTED");
      cached.lastError = "PRODUCTION DATABASE DETECTED — TEST ABORTED";
      return null;
    }
    if (!MONGODB_URI.includes('avani_ai_crm_test')) {
      console.error("TARGET DATABASE IS NOT avani_ai_crm_test IN PREVIEW/STAGING — TEST ABORTED");
      cached.lastError = "TARGET DATABASE IS NOT avani_ai_crm_test IN PREVIEW/STAGING — TEST ABORTED";
      return null;
    }
    if (PROVIDER_MODE === 'live' && process.env.LIVE_TEST_AUTHORIZATION !== 'true') {
      console.error("LIVE PROVIDER DETECTED IN TEST MODE WITHOUT AUTHORIZATION — TEST ABORTED");
      cached.lastError = "LIVE PROVIDER DETECTED IN TEST MODE WITHOUT AUTHORIZATION";
      return null;
    }
  }

  if (cached.conn) {
    if (mongoose.connection.readyState === 1) {
      return cached.conn;
    } else {
      cached.conn = null;
    }
  }

  if (!cached.promise) {
    const opts = {
      bufferCommands: false,
      serverSelectionTimeoutMS: 10000,
      connectTimeoutMS: 10000,
      socketTimeoutMS: 45000,
      tls: true,
      maxPoolSize: 10,
    };

    cached.promise = mongoose.connect(MONGODB_URI, opts).then((m) => {
      console.log("Connected to MongoDB successfully");
      cached.lastError = null;
      return m;
    }).catch((err) => {
      cached.promise = null;
      cached.conn = null;
      cached.lastError = err?.message || 'Connection failed';
      throw err;
    });
  }

  try {
    cached.conn = await cached.promise;
    if (mongoose.connection.readyState !== 1) {
      cached.conn = null;
      return null;
    }
  } catch (e: any) {
    cached.promise = null;
    cached.conn = null;
    cached.lastError = e?.message || 'Connection failed';
    console.warn("MongoDB connection failed:", e.message);
    return null;
  }

  return cached.conn;
}

export default connectToDatabase;

export async function ensureDatabaseConnection() {
  const conn = await connectToDatabase();
  if (!conn || mongoose.connection.readyState !== 1) {
    const errMsg = cached?.lastError || "Database offline: connection readyState != 1";
    throw new Error(`DATABASE_UNAVAILABLE: ${errMsg}`);
  }
  return conn;
}

export function getDatabaseLastError(): string | null {
  return cached?.lastError || null;
}

export async function getDatabase(targetClientPhone = "N/A") {
  try {
    const conn = await ensureDatabaseConnection();
    return conn.connection.db; 
  } catch (dbError: any) {
    const componentStr = "Core Database Connection";
    
    cached.conn = null;
    cached.promise = null;

    // Instantly alert operations via Slack webhook pipe
    await sendSlackAlert(dbError.message, componentStr, targetClientPhone);
    
    throw dbError;
  }
}
