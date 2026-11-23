import crypto from 'node:crypto';
import { BaseSheetsRepository } from '@/lib/google-sheets/sheets-repository';
import { SystemConfigRow } from '@/lib/google-sheets/sheet-schema';

/**
 * DURABLE CROSS-INSTANCE SESSION REVOCATION & SHARED LOGIN RATE-LIMIT STORE
 * (Blocker 4 Remediation — Zero Paid Services, Zero New Sheet Tabs, Zero Raw Secrets/PII)
 *
 * Architecture:
 * - Preserves HMAC-SHA256 signed HttpOnly/SameSite/Secure session verification in src/lib/auth.ts.
 * - Persists ONLY one-way SHA-256 keyed revocation markers and rate-limit counters in the existing
 *   `SYSTEM_CONFIG` tab of Google Sheets via `BaseSheetsRepository<SystemConfigRow>`:
 *     - `AUTH_REV_<sha256(jti).slice(0,16)>`    -> `{"r":1,"exp":<epochSec>}`
 *     - `AUTH_CUTOFF_<sha256(sub).slice(0,16)>` -> `{"t":<epochSec>}`
 *     - `AUTH_RL_A_<sha256(ip:email).slice(0,16)>` -> `{"n":<cnt>,"lu":<lockSec>,"exp":<expSec>}`
 *     - `AUTH_RL_I_<sha256(ip).slice(0,16)>`       -> `{"n":<cnt>,"lu":<lockSec>,"exp":<expSec>}`
 * - NEVER stores passwords, session tokens, raw JTIs, raw emails, or raw client IP addresses in Google Sheets.
 * - NEVER connects to MongoDB.
 * - Maintains a fast process-local cache alongside durable `SYSTEM_CONFIG` persistence so logout
 *   revocation, global session cutoffs, and brute-force lockouts immediately propagate across
 *   separate serverless instances.
 * - Temporary Google Sheets outage fallback: falls back to local registry unless
 *   `STRICT_SESSION_REVOCATION_FAIL_CLOSED=true`, in which case session verification fails closed.
 */

const RATE_WINDOW_MS = 15 * 60 * 1000; // 15 minutes
const ACCOUNT_MAX_FAILED_ATTEMPTS = 5;
const IP_MAX_FAILED_ATTEMPTS = 20;
const DEFAULT_REVOCATION_TTL_SEC = 24 * 60 * 60;

interface SessionRecord {
  jti: string;
  sub: string;
  email: string;
  role: 'ADMIN' | 'ADVISOR';
  revoked: boolean;
  revokedAt?: Date;
  issuedAt: Date;
  expireAt: Date;
}

interface RateLimitEntry {
  key: string;
  attempts: number;
  lockedUntil: Date | null;
  expireAt: Date;
}

interface DurableRevocationPayload {
  r: 1;
  exp: number;
}

interface DurableCutoffPayload {
  t: number;
}

interface DurableRateLimitPayload {
  n: number;
  lu: number;
  exp: number;
}

class AuthStateConfigRepository extends BaseSheetsRepository<SystemConfigRow> {
  constructor() {
    super('SYSTEM_CONFIG');
  }
}

class AuthStoreSerializeLock {
  private queue: Promise<void> = Promise.resolve();
  public async withLock<T>(fn: () => Promise<T>): Promise<T> {
    let release!: () => void;
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    const prev = this.queue;
    this.queue = prev.then(() => gate).catch(() => gate);
    await prev;
    try {
      return await fn();
    } finally {
      release();
    }
  }
}

const authStateRepo = new AuthStateConfigRepository();
const rateLimitWriteLock = new AuthStoreSerializeLock();

const sessionRegistry = new Map<string, SessionRecord>();
const userCutoffRegistry = new Map<string, number>(); // sub -> epochSec
const rateLimitRegistry = new Map<string, RateLimitEntry>();

function sha256Prefix16(domain: string, value: string): string {
  return crypto
    .createHash('sha256')
    .update(`${domain}:${value}`, 'utf8')
    .digest('hex')
    .slice(0, 16);
}

export function buildDurableRevocationKey(jti: string): string {
  return `AUTH_REV_${sha256Prefix16('AVANI_AUTH_REV_V1', String(jti || '').trim())}`;
}

export function buildDurableUserCutoffKey(sub: string): string {
  return `AUTH_CUTOFF_${sha256Prefix16('AVANI_AUTH_SUB_V1', String(sub || '').trim())}`;
}

export function buildDurableRateLimitKeys(ip: string, email: string): {
  acctConfigKey: string;
  ipConfigKey: string;
} {
  const normIp = String(ip || 'unknown').trim().slice(0, 64);
  const normEmail = String(email || '').trim().toLowerCase();
  return {
    acctConfigKey: `AUTH_RL_A_${sha256Prefix16('AVANI_RL_A_V1', `${normIp}:${normEmail}`)}`,
    ipConfigKey: `AUTH_RL_I_${sha256Prefix16('AVANI_RL_I_V1', normIp)}`
  };
}

function parseDurableRevocation(raw?: string | null): DurableRevocationPayload | null {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw);
    if (parsed && parsed.r === 1 && Number.isFinite(Number(parsed.exp))) {
      return { r: 1, exp: Number(parsed.exp) };
    }
    return null;
  } catch {
    return null;
  }
}

function parseDurableCutoff(raw?: string | null): DurableCutoffPayload | null {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw);
    if (parsed && Number.isFinite(Number(parsed.t)) && Number(parsed.t) > 0) {
      return { t: Number(parsed.t) };
    }
    return null;
  } catch {
    return null;
  }
}

function parseDurableRateLimit(raw?: string | null): DurableRateLimitPayload | null {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw);
    if (
      parsed &&
      Number.isFinite(Number(parsed.n)) &&
      Number.isFinite(Number(parsed.lu)) &&
      Number.isFinite(Number(parsed.exp))
    ) {
      return {
        n: Math.max(0, Math.floor(Number(parsed.n))),
        lu: Math.max(0, Math.floor(Number(parsed.lu))),
        exp: Math.max(0, Math.floor(Number(parsed.exp)))
      };
    }
    return null;
  } catch {
    return null;
  }
}

export function resetLocalAuthStoreCachesForTesting(): void {
  sessionRegistry.clear();
  userCutoffRegistry.clear();
  rateLimitRegistry.clear();
}

export async function ensureDbReady(): Promise<boolean> {
  return true;
}

export async function registerSessionInDb(session: {
  jti: string;
  sub: string;
  email: string;
  role: 'ADMIN' | 'ADVISOR';
  iat: number;
  exp: number;
}): Promise<void> {
  sessionRegistry.set(session.jti, {
    jti: session.jti,
    sub: session.sub,
    email: session.email,
    role: session.role,
    revoked: false,
    issuedAt: new Date(session.iat * 1000),
    expireAt: new Date(session.exp * 1000)
  });
}

export async function revokeSessionInDb(jti: string, expireAtEpochSec?: number): Promise<void> {
  if (!jti) return;
  const existing = sessionRegistry.get(jti);
  const nowMs = Date.now();
  const expSec =
    typeof expireAtEpochSec === 'number' && Number.isFinite(expireAtEpochSec) && expireAtEpochSec > 0
      ? Math.floor(expireAtEpochSec)
      : existing?.expireAt
        ? Math.floor(existing.expireAt.getTime() / 1000)
        : Math.floor(nowMs / 1000) + DEFAULT_REVOCATION_TTL_SEC;

  sessionRegistry.set(jti, {
    jti,
    sub: existing?.sub || 'REVOKED',
    email: existing?.email || 'revoked@local',
    role: existing?.role || 'ADVISOR',
    revoked: true,
    revokedAt: new Date(nowMs),
    issuedAt: existing?.issuedAt || new Date(nowMs),
    expireAt: new Date(expSec * 1000)
  });

  // Persist hashed revocation marker durably in SYSTEM_CONFIG for cross-instance invalidation
  try {
    const revKey = buildDurableRevocationKey(jti);
    const payload: DurableRevocationPayload = { r: 1, exp: expSec };
    await authStateRepo.upsert({
      config_key: revKey,
      config_value: JSON.stringify(payload),
      updated_at: new Date(nowMs).toISOString()
    });
  } catch (err: any) {
    console.warn('[AuthStore] Durable revocation write deferred (Sheets unavailable):', err?.code || err?.message);
  }
}

/**
 * Invalidates all sessions for a given user (`sub`) issued at or before `cutoffEpochSec`
 * across all serverless instances.
 */
export async function revokeAllUserSessionsInDb(
  sub: string,
  cutoffEpochSec = Math.floor(Date.now() / 1000)
): Promise<void> {
  if (!sub) return;
  const prev = userCutoffRegistry.get(sub) || 0;
  const effectiveCutoff = Math.max(prev, Math.floor(cutoffEpochSec));
  userCutoffRegistry.set(sub, effectiveCutoff);

  for (const [jti, rec] of sessionRegistry.entries()) {
    if (rec.sub === sub && Math.floor(rec.issuedAt.getTime() / 1000) <= effectiveCutoff) {
      sessionRegistry.set(jti, { ...rec, revoked: true, revokedAt: new Date() });
    }
  }

  try {
    const cutoffKey = buildDurableUserCutoffKey(sub);
    const payload: DurableCutoffPayload = { t: effectiveCutoff };
    await authStateRepo.upsert({
      config_key: cutoffKey,
      config_value: JSON.stringify(payload),
      updated_at: new Date().toISOString()
    });
  } catch (err: any) {
    console.warn('[AuthStore] Durable global cutoff write deferred (Sheets unavailable):', err?.code || err?.message);
  }
}

export async function isSessionActiveInDb(
  jti: string,
  sessionMeta?: { sub?: string; iat?: number }
): Promise<boolean> {
  if (!jti) return false;
  const nowMs = Date.now();
  const nowSec = Math.floor(nowMs / 1000);

  // 1. Fast local revocation / expiry / cutoff check
  const doc = sessionRegistry.get(jti);
  if (doc) {
    if (doc.revoked === true) return false;
    if (doc.expireAt && doc.expireAt.getTime() <= nowMs) return false;
  }

  if (sessionMeta?.sub && typeof sessionMeta.iat === 'number') {
    const localCutoff = userCutoffRegistry.get(sessionMeta.sub);
    if (localCutoff !== undefined && sessionMeta.iat <= localCutoff) {
      return false;
    }
  }

  // 2. Durable cross-instance revocation & global cutoff lookup in SYSTEM_CONFIG
  try {
    const revKey = buildDurableRevocationKey(jti);
    const revRow = await authStateRepo.findById(revKey);
    const durableRev = parseDurableRevocation(revRow?.config_value);
    if (durableRev && durableRev.exp > nowSec) {
      // Cache locally so repeat calls on this instance fail fast
      sessionRegistry.set(jti, {
        jti,
        sub: doc?.sub || sessionMeta?.sub || 'REVOKED',
        email: doc?.email || 'revoked@local',
        role: doc?.role || 'ADMIN',
        revoked: true,
        revokedAt: new Date(nowMs),
        issuedAt: doc?.issuedAt || new Date(nowMs),
        expireAt: new Date(durableRev.exp * 1000)
      });
      return false;
    }

    if (sessionMeta?.sub && typeof sessionMeta.iat === 'number') {
      const cutoffKey = buildDurableUserCutoffKey(sessionMeta.sub);
      const cutoffRow = await authStateRepo.findById(cutoffKey);
      const durableCutoff = parseDurableCutoff(cutoffRow?.config_value);
      if (durableCutoff && durableCutoff.t > 0) {
        const existingLocal = userCutoffRegistry.get(sessionMeta.sub) || 0;
        userCutoffRegistry.set(sessionMeta.sub, Math.max(existingLocal, durableCutoff.t));
        if (sessionMeta.iat <= durableCutoff.t) {
          return false;
        }
      }
    }
  } catch (err: any) {
    // If STRICT_SESSION_REVOCATION_FAIL_CLOSED=true, reject session when durable store is unreachable.
    // Otherwise fall back to local cache so CRM API handlers return accurate 503 storage-offline errors.
    if (process.env.STRICT_SESSION_REVOCATION_FAIL_CLOSED === 'true') {
      console.warn('[AuthStore] Durable revocation check failed closed:', err?.code || err?.message);
      return false;
    }
  }

  return true;
}

function buildRateKeys(ip: string, email: string): { acctKey: string; ipKey: string } {
  const normIp = String(ip || 'unknown').trim().slice(0, 64);
  const emailHash = crypto
    .createHash('sha256')
    .update(String(email || '').trim().toLowerCase())
    .digest('hex')
    .slice(0, 16);
  return {
    acctKey: `login_acct:${normIp}:${emailHash}`,
    ipKey: `login_ip:${normIp}`
  };
}

export function extractClientIp(req: Request): string {
  const xff = req.headers.get('x-forwarded-for');
  if (xff) {
    const first = xff.split(',')[0]?.trim();
    if (first) return first;
  }
  const realIp = req.headers.get('x-real-ip')?.trim();
  if (realIp) return realIp;
  return 'loopback';
}

function evaluateRateLimitRecord(
  rec: { attempts: number; lockedUntilMs: number | null; expireAtMs: number },
  threshold: number,
  nowMs: number
): { blocked: true; retryAfterSeconds: number } | { blocked: false } {
  if (rec.expireAtMs <= nowMs) return { blocked: false };
  if (rec.lockedUntilMs && rec.lockedUntilMs > nowMs) {
    return {
      blocked: true,
      retryAfterSeconds: Math.max(1, Math.ceil((rec.lockedUntilMs - nowMs) / 1000))
    };
  }
  if (rec.attempts >= threshold) {
    return {
      blocked: true,
      retryAfterSeconds: Math.max(1, Math.ceil((rec.expireAtMs - nowMs) / 1000))
    };
  }
  return { blocked: false };
}

export async function checkLoginRateLimit(
  ip: string,
  email: string
): Promise<{ allowed: true } | { allowed: false; retryAfterSeconds: number }> {
  const { acctKey, ipKey } = buildRateKeys(ip, email);
  const { acctConfigKey, ipConfigKey } = buildDurableRateLimitKeys(ip, email);
  const nowMs = Date.now();

  const pairs = [
    { localKey: acctKey, configKey: acctConfigKey, threshold: ACCOUNT_MAX_FAILED_ATTEMPTS },
    { localKey: ipKey, configKey: ipConfigKey, threshold: IP_MAX_FAILED_ATTEMPTS }
  ];

  // 1. Check local cache first
  for (const item of pairs) {
    const rec = rateLimitRegistry.get(item.localKey);
    if (!rec) continue;
    if (rec.expireAt && rec.expireAt.getTime() <= nowMs) {
      rateLimitRegistry.delete(item.localKey);
      continue;
    }
    const localVerdict = evaluateRateLimitRecord(
      {
        attempts: rec.attempts,
        lockedUntilMs: rec.lockedUntil ? rec.lockedUntil.getTime() : null,
        expireAtMs: rec.expireAt.getTime()
      },
      item.threshold,
      nowMs
    );
    if (localVerdict.blocked) {
      return { allowed: false, retryAfterSeconds: localVerdict.retryAfterSeconds };
    }
  }

  // 2. Check durable cross-instance counters in SYSTEM_CONFIG
  try {
    for (const item of pairs) {
      const row = await authStateRepo.findById(item.configKey);
      const durable = parseDurableRateLimit(row?.config_value);
      if (!durable || durable.exp * 1000 <= nowMs) continue;

      const durableVerdict = evaluateRateLimitRecord(
        {
          attempts: durable.n,
          lockedUntilMs: durable.lu > 0 ? durable.lu * 1000 : null,
          expireAtMs: durable.exp * 1000
        },
        item.threshold,
        nowMs
      );
      if (durableVerdict.blocked) {
        // Hydrate local cache so repeated blocked hits on this instance fast-fail
        rateLimitRegistry.set(item.localKey, {
          key: item.localKey,
          attempts: durable.n,
          lockedUntil: durable.lu > 0 ? new Date(durable.lu * 1000) : null,
          expireAt: new Date(durable.exp * 1000)
        });
        return { allowed: false, retryAfterSeconds: durableVerdict.retryAfterSeconds };
      }
    }
  } catch {
    // Graceful local-cache fallback if Sheets is transiently offline
  }

  return { allowed: true };
}

export async function recordFailedLoginAttempt(ip: string, email: string): Promise<void> {
  const { acctKey, ipKey } = buildRateKeys(ip, email);
  const { acctConfigKey, ipConfigKey } = buildDurableRateLimitKeys(ip, email);

  await rateLimitWriteLock.withLock(async () => {
    const nowMs = Date.now();
    const nextExpiryMs = nowMs + RATE_WINDOW_MS;
    const nextExpirySec = Math.floor(nextExpiryMs / 1000);

    const pairs = [
      { localKey: acctKey, configKey: acctConfigKey, max: ACCOUNT_MAX_FAILED_ATTEMPTS },
      { localKey: ipKey, configKey: ipConfigKey, max: IP_MAX_FAILED_ATTEMPTS }
    ];

    for (const item of pairs) {
      const localExisting = rateLimitRegistry.get(item.localKey);
      const localActiveAttempts =
        localExisting && localExisting.expireAt.getTime() > nowMs ? localExisting.attempts || 0 : 0;
      const localLockedUntilSec =
        localExisting?.lockedUntil && localExisting.lockedUntil.getTime() > nowMs
          ? Math.floor(localExisting.lockedUntil.getTime() / 1000)
          : 0;

      let durableActiveAttempts = 0;
      let durableLockedUntilSec = 0;
      let durableAvailable = true;

      try {
        const row = await authStateRepo.findById(item.configKey);
        const parsed = parseDurableRateLimit(row?.config_value);
        if (parsed && parsed.exp * 1000 > nowMs) {
          durableActiveAttempts = parsed.n;
          durableLockedUntilSec = parsed.lu > Math.floor(nowMs / 1000) ? parsed.lu : 0;
        }
      } catch {
        durableAvailable = false;
      }

      const updatedAttempts = Math.max(localActiveAttempts, durableActiveAttempts) + 1;
      const lockedUntilSec =
        updatedAttempts >= item.max
          ? Math.max(nextExpirySec, localLockedUntilSec, durableLockedUntilSec)
          : Math.max(localLockedUntilSec, durableLockedUntilSec);

      rateLimitRegistry.set(item.localKey, {
        key: item.localKey,
        attempts: updatedAttempts,
        lockedUntil: lockedUntilSec > 0 ? new Date(lockedUntilSec * 1000) : null,
        expireAt: new Date(nextExpirySec * 1000)
      });

      if (durableAvailable) {
        try {
          const payload: DurableRateLimitPayload = {
            n: updatedAttempts,
            lu: lockedUntilSec,
            exp: nextExpirySec
          };
          await authStateRepo.upsert({
            config_key: item.configKey,
            config_value: JSON.stringify(payload),
            updated_at: new Date(nowMs).toISOString()
          });
        } catch (err: any) {
          console.warn('[AuthStore] Durable rate-limit write deferred:', err?.code || err?.message);
        }
      }
    }
  });
}

export async function clearLoginRateLimit(ip: string, email: string): Promise<void> {
  const { acctKey } = buildRateKeys(ip, email);
  const { acctConfigKey } = buildDurableRateLimitKeys(ip, email);
  rateLimitRegistry.delete(acctKey);
  try {
    await authStateRepo.deleteById(acctConfigKey);
  } catch {
    // Non-fatal if Sheets is unavailable or row does not exist
  }
}
