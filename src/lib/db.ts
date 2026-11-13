import mongoose from "mongoose";
import { sendSlackAlert } from "./alerts";

let cached = (global as any).mongoose;

if (!cached) {
  cached = (global as any).mongoose = {
    conn: null,
    promise: null,
    lastError: null,
    uri: null,
    targetDb: null
  };
}

export interface DatabaseIsolationResult {
  allowed: boolean;
  dbName?: string;
  error?: string;
  code?: string;
  hostname?: string;
}

/**
 * Deterministically evaluates database isolation boundaries across all execution profiles.
 * Safe for in-memory unit testing with zero external network contact.
 */
export function evaluateDatabaseIsolation(
  rawUri?: string | null,
  appModeInput?: string | null,
  providerModeInput?: string | null,
  vercelEnvInput?: string | null,
  liveTestAuthInput?: string | null
): DatabaseIsolationResult {
  if (!rawUri || !String(rawUri).trim()) {
    return {
      allowed: false,
      error: "MONGODB_URI is not defined or is empty in environment.",
      code: "URI_MISSING"
    };
  }

  const uri = String(rawUri).trim();

  // Normalize modes and environment flags (case & whitespace insensitive)
  let appMode = String(appModeInput ?? process.env.APP_MODE ?? '').trim().toLowerCase();
  const providerMode = String(providerModeInput ?? process.env.PROVIDER_MODE ?? 'mock').trim().toLowerCase();
  const vercelEnv = String(vercelEnvInput ?? process.env.VERCEL_ENV ?? '').trim().toLowerCase();
  const liveTestAuth = String(liveTestAuthInput ?? process.env.LIVE_TEST_AUTHORIZATION ?? 'false').trim().toLowerCase();

  if (!appMode) {
    appMode = (process.env.NODE_ENV === 'production' && vercelEnv === 'production') ? 'production' : 'development';
  }

  // Parse connection string using URL parser
  let parsed: URL;
  try {
    parsed = new URL(uri);
  } catch {
    return {
      allowed: false,
      error: "Malformed MONGODB_URI: Unable to parse database connection string.",
      code: "URI_MALFORMED"
    };
  }

  const hostname = (parsed.hostname || '').toLowerCase();

  // 1. REJECT DECOMMISSIONED/LEGACY CLUSTER
  if (hostname.includes('cluster0.mlcxcp.mongodb.net')) {
    return {
      allowed: false,
      hostname,
      error: "LEGACY_CLUSTER_REJECTED: cluster0.mlcxcp.mongodb.net is decommissioned. Update Vercel environment variables to use active rhpn2gh cluster.",
      code: "LEGACY_CLUSTER_REJECTED"
    };
  }

  // 2. REJECT CROSS-APPLICATION CLUSTER (LOAN SERVICES CLUSTER)
  if (hostname.includes('xj6nhak.mongodb.net')) {
    return {
      allowed: false,
      hostname,
      error: "CROSS_APPLICATION_CLUSTER_REJECTED: xj6nhak belongs to AVANI Loan Services. AI CRM must use rhpn2gh.",
      code: "CROSS_APPLICATION_CLUSTER_REJECTED"
    };
  }

  // 3. EXTRACT AND VALIDATE DATABASE PATHNAME
  const rawPath = (parsed.pathname || '').replace(/^\//, '').trim();
  const dbName = rawPath ? decodeURIComponent(rawPath.split('/')[0]) : '';

  if (!dbName) {
    return {
      allowed: false,
      hostname,
      error: "MONGODB_URI missing database name in pathname.",
      code: "MISSING_DATABASE_NAME"
    };
  }

  const lowerDbName = dbName.toLowerCase();
  const isProdTarget = lowerDbName === 'avani_ai_crm_prod' || lowerDbName.includes('prod');

  // Any non-production execution profile must NEVER connect to a production database target.
  // Local execution (vercelEnv === '') and Preview deployments are strictly non-production even if APP_MODE=production.
  // Safe-mode Vercel Production (vercelEnv === 'production' && appMode === 'production', with PROVIDER_MODE=mock or live)
  // is an authorized production runtime.
  const isAuthorizedProductionRuntime = (vercelEnv === 'production' && appMode === 'production');

  if (isAuthorizedProductionRuntime && lowerDbName.includes('test')) {
    return {
      allowed: false,
      dbName,
      hostname,
      error: `TEST DATABASE DETECTED IN PRODUCTION — Production runtime cannot target test database '${dbName}'.`,
      code: "TEST_DATABASE_FORBIDDEN_IN_PROD"
    };
  }

  if (!isAuthorizedProductionRuntime) {
    // Non-production execution (development, test, staging, preview, or local production mode)
    if (isProdTarget) {
      const modeLabel = vercelEnv ? `${appMode}/${vercelEnv}` : `${appMode}/local`;
      return {
        allowed: false,
        dbName,
        hostname,
        error: `PRODUCTION DATABASE DETECTED — Execution profile (${modeLabel}) is strictly forbidden from targeting production database.`,
        code: "PRODUCTION_TARGET_FORBIDDEN_IN_NON_PROD"
      };
    }

    if (dbName !== 'avani_ai_crm_test') {
      return {
        allowed: false,
        dbName,
        hostname,
        error: `FATAL SECURITY BOUNDARY VIOLATION: Non-production execution must exclusively target avani_ai_crm_test, got '${dbName}'.`,
        code: "TARGET_DATABASE_NOT_TEST"
      };
    }

    if (providerMode === 'live' && liveTestAuth !== 'true') {
      return {
        allowed: false,
        dbName,
        hostname,
        error: "LIVE PROVIDER DETECTED IN TEST MODE WITHOUT AUTHORIZATION — Non-production mode requires explicit LIVE_TEST_AUTHORIZATION=true.",
        code: "LIVE_PROVIDER_UNAUTHORIZED"
      };
    }
  }

  return {
    allowed: true,
    dbName,
    hostname
  };
}

export async function connectToDatabase() {
  const MONGODB_URI = process.env.MONGODB_URI;
  const guard = evaluateDatabaseIsolation(MONGODB_URI);

  if (!guard.allowed) {
    console.error(`[DB Isolation Guard] ${guard.error} (${guard.code})`);
    cached.lastError = guard.error || 'Database isolation violation';
    cached.conn = null;
    cached.promise = null;
    return null;
  }

  // Validate cache before returning existing connection
  if (cached.conn) {
    if (cached.uri !== MONGODB_URI || cached.targetDb !== guard.dbName) {
      console.warn("[DB Isolation Guard] Target URI changed since cached connection established. Resetting connection cache.");
      cached.conn = null;
      cached.promise = null;
    } else if (mongoose.connection.readyState === 1) {
      return cached.conn;
    } else {
      cached.conn = null;
    }
  }

  if (!cached.promise) {
    const useTls =
      MONGODB_URI!.startsWith('mongodb+srv://') ||
      MONGODB_URI!.includes('mongodb.net') ||
      MONGODB_URI!.includes('tls=true') ||
      MONGODB_URI!.includes('ssl=true');
    const opts = {
      bufferCommands: false,
      serverSelectionTimeoutMS: 10000,
      connectTimeoutMS: 10000,
      socketTimeoutMS: 45000,
      tls: useTls,
      maxPoolSize: 10,
    };

    cached.uri = MONGODB_URI;
    cached.targetDb = guard.dbName;

    cached.promise = mongoose.connect(MONGODB_URI!, opts).then((m) => {
      console.log(`Connected to MongoDB successfully: db=${guard.dbName}`);
      cached.lastError = null;
      return m;
    }).catch((err) => {
      cached.promise = null;
      cached.conn = null;
      cached.uri = null;
      cached.targetDb = null;
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
    cached.uri = null;
    cached.targetDb = null;
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
    cached.uri = null;
    cached.targetDb = null;

    // Instantly alert operations via Slack webhook pipe
    await sendSlackAlert(dbError.message, componentStr, targetClientPhone);
    
    throw dbError;
  }
}
