import mongoose from "mongoose";
import { sendSlackAlert } from "./alerts";

let cached = (global as any).mongoose;

if (!cached) {
  cached = (global as any).mongoose = { conn: null, promise: null };
}

export async function connectToDatabase() {
  const MONGODB_URI = process.env.MONGODB_URI;
  if (!MONGODB_URI) {
    console.warn("MONGODB_URI is not defined in environment.");
    return null;
  }

  const APP_MODE = process.env.APP_MODE || 'production';
  const PROVIDER_MODE = process.env.PROVIDER_MODE || 'mock';

  // FORENSIC SAFETY GUARD
  if (APP_MODE === 'test' || APP_MODE === 'staging') {
    if (!MONGODB_URI.includes('avani_ai_crm_test')) {
      console.error("PRODUCTION DATABASE DETECTED — TEST ABORTED");
      return null;
    }
    if (PROVIDER_MODE === 'live' && process.env.LIVE_TEST_AUTHORIZATION !== 'true') {
      console.error("LIVE PROVIDER DETECTED IN TEST MODE WITHOUT AUTHORIZATION — TEST ABORTED");
      return null;
    }
  }

  if (cached.conn) {
    if (mongoose.connection.readyState === 1) {
      return cached.conn;
    }
  }

  if (!cached.promise) {
    const opts = {
      bufferCommands: false,
      serverSelectionTimeoutMS: 5000,
      socketTimeoutMS: 45000,
    };

    cached.promise = mongoose.connect(MONGODB_URI, opts).then((m) => {
      console.log("Connected to MongoDB successfully");
      return m;
    });
  }

  try {
    cached.conn = await cached.promise;
  } catch (e: any) {
    cached.promise = null;
    console.warn("MongoDB connection failed:", e.message);
    return null;
  }

  return cached.conn;
}

export default connectToDatabase;

export async function getDatabase(targetClientPhone = "N/A") {
  try {
    const conn = await connectToDatabase();
    if (!conn || mongoose.connection.readyState !== 1) {
      throw new Error("Database offline");
    }
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
