import mongoose from "mongoose";
import { sendSlackAlert } from "./alerts";

const MONGODB_URI = process.env.MONGODB_URI;

if (!MONGODB_URI) {
  throw new Error("Please define the MONGODB_URI environment variable inside .env.local");
}

let cached = (global as any).mongoose;

if (!cached) {
  cached = (global as any).mongoose = { conn: null, promise: null };
}

export async function connectToDatabase() {
  if (cached.conn) {
    // Check if the connection dropped
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

    cached.promise = mongoose.connect(MONGODB_URI as string, opts).then((mongoose) => {
      console.log("Connected to MongoDB successfully");
      return mongoose;
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
