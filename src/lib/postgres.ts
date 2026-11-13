import { Pool } from 'pg';

export interface PostgresIsolationResult {
  allowed: boolean;
  dbName?: string;
  hostname?: string;
  error?: string;
  code?: string;
}

let activePool: Pool | null = null;
let activePoolUri: string | null = null;

/**
 * Deterministically evaluates PostgreSQL database isolation boundaries.
 */
export function evaluatePostgresIsolation(
  rawUri?: string | null,
  appModeInput?: string | null,
  vercelEnvInput?: string | null
): PostgresIsolationResult {
  if (!rawUri || !String(rawUri).trim()) {
    return {
      allowed: false,
      error: "DATABASE_URL is not set or empty. Postgres operations will fail.",
      code: "DATABASE_URL_MISSING"
    };
  }

  const uri = String(rawUri).trim();

  // Normalize modes
  let appMode = String(appModeInput ?? process.env.APP_MODE ?? '').trim().toLowerCase();
  const vercelEnv = String(vercelEnvInput ?? process.env.VERCEL_ENV ?? '').trim().toLowerCase();

  if (!appMode) {
    appMode = (process.env.NODE_ENV === 'production' && vercelEnv === 'production') ? 'production' : 'development';
  }

  let parsed: URL;
  try {
    parsed = new URL(uri);
  } catch {
    return {
      allowed: false,
      error: "Malformed DATABASE_URL: Unable to parse Postgres connection string.",
      code: "DATABASE_URL_MALFORMED"
    };
  }

  const hostname = (parsed.hostname || '').toLowerCase();
  const rawPath = (parsed.pathname || '').replace(/^\//, '').trim();
  const dbName = rawPath ? decodeURIComponent(rawPath.split('/')[0]) : '';

  if (!dbName) {
    return {
      allowed: false,
      hostname,
      error: "DATABASE_URL missing database name in pathname.",
      code: "MISSING_DATABASE_NAME"
    };
  }

  const lowerDbName = dbName.toLowerCase();
  const isProdTarget =
    hostname.includes('supabase.co') ||
    lowerDbName === 'postgres' ||
    lowerDbName.includes('prod');

  const isLiveProductionRuntime = (vercelEnv === 'production' && appMode === 'production');

  if (!isLiveProductionRuntime) {
    if (isProdTarget) {
      const modeLabel = vercelEnv ? `${appMode}/${vercelEnv}` : `${appMode}/local`;
      return {
        allowed: false,
        dbName,
        hostname,
        error: `PRODUCTION_POSTGRES_TARGET_REJECTED: Execution profile (${modeLabel}) is strictly forbidden from targeting production PostgreSQL.`,
        code: "PRODUCTION_POSTGRES_TARGET_REJECTED"
      };
    }
  }

  return {
    allowed: true,
    dbName,
    hostname
  };
}

export function getPostgresPool(): Pool {
  const connectionString = process.env.DATABASE_URL;
  const guard = evaluatePostgresIsolation(connectionString);

  if (!guard.allowed) {
    console.error(`[Postgres Isolation Guard] ${guard.error} (${guard.code})`);
    if (activePool) {
      activePool.end().catch(() => {});
      activePool = null;
      activePoolUri = null;
    }
    throw new Error(`[Postgres Isolation Guard] ${guard.error} (${guard.code})`);
  }

  if (activePool && activePoolUri === connectionString) {
    return activePool;
  }

  if (activePool && activePoolUri !== connectionString) {
    activePool.end().catch(() => {});
    activePool = null;
  }

  activePoolUri = connectionString!;
  activePool = new Pool({
    connectionString,
    ssl: connectionString?.includes('supabase') ? { rejectUnauthorized: false } : false,
    max: 10,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 2000,
  });

  return activePool;
}

export async function query(text: string, params?: any[]) {
  const pool = getPostgresPool();
  const start = Date.now();
  try {
    const res = await pool.query(text, params);
    const duration = Date.now() - start;
    console.log('Executed query', { text, duration, rows: res.rowCount });
    return res;
  } catch (error) {
    console.error('Postgres Query Error:', error);
    throw error;
  }
}

export async function logCallToPostgres(
  callId: string,
  phone: string,
  startedAt: Date,
  endedAt: Date | null,
  transcript: string
) {
  const sql = `
    INSERT INTO "CallLog" (id, "callId", "phoneNumber", "startedAt", "endedAt", "transcript", "createdAt")
    VALUES (gen_random_uuid(), $1, $2, $3, $4, $5, NOW())
    ON CONFLICT ("callId") DO UPDATE
    SET "endedAt" = EXCLUDED."endedAt", "transcript" = EXCLUDED."transcript"
    RETURNING *;
  `;
  const cleanPhone = phone.replace(/\D/g, '');
  return query(sql, [callId, cleanPhone, startedAt, endedAt, transcript]);
}

export default {
  query,
  getPostgresPool,
  evaluatePostgresIsolation,
  logCallToPostgres
};
