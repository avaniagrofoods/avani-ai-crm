import { Pool } from 'pg';

const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  console.warn("WARNING: DATABASE_URL not set. Postgres operations will fail.");
}

const pool = new Pool({
  connectionString,
  ssl: connectionString?.includes('supabase') ? { rejectUnauthorized: false } : false,
  max: 10,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 2000,
});

export async function query(text: string, params?: any[]) {
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

export async function logCallToPostgres(callId: string, phone: string, startedAt: Date, endedAt: Date | null, transcript: string) {
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

export default pool;
