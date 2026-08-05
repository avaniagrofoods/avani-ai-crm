import mongoose from "mongoose";
import { sendSlackAlert } from "./alerts";

const MONGODB_URI = process.env.MONGODB_URI || "mongodb://localhost:27017/avani_crm";

if (!MONGODB_URI) {
  throw new Error("Please define the MONGODB_URI environment variable inside .env.local");
}

let cached = (global as any).mongoose;

if (!cached) {
  cached = (global as any).mongoose = { conn: null, promise: null };
}

async function connectToDatabase() {
  if (cached.conn) {
    return cached.conn;
  }

  if (!cached.promise) {
    const opts = {
      bufferCommands: false,
    };

    cached.promise = mongoose.connect(MONGODB_URI, opts).then((mongoose) => {
      console.log("Connected to MongoDB successfully");
      return mongoose;
    });
  }
  
  try {
    cached.conn = await cached.promise;
  } catch (e) {
    cached.promise = null;
    console.warn("MongoDB connection failed (Likely because no cloud URI provided):", e);
    // Return null instead of throwing so the app doesn't completely crash
    return null;
  }

  return cached.conn;
}

export default connectToDatabase;

export async function getDatabase(targetClientPhone = "N/A") {
  try {
    const conn = await connectToDatabase();
    if (!conn) {
      throw new Error("Mongoose connection returned null");
    }
    // Quickly check connection health viability
    if (mongoose.connection.readyState !== 1) {
      throw new Error("Mongoose connection is not established");
    }
    return conn.connection.db; // Return native db instance if needed, or mongoose itself
  } catch (dbError: any) {
    const componentStr = "Inbound WhatsApp Button Routing Engine";
    
    // Clear dead initialization reference so the next API cycle can retry transparently
    cached.conn = null;
    cached.promise = null;

    // Instantly alert operations via Slack webhook pipe
    await sendSlackAlert(dbError.message, componentStr, targetClientPhone);
    
    // Bubble the error up to the root route router to notify the WhatsApp webhook gateway gracefully
    throw dbError;
  }
}
