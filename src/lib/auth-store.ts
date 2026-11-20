import crypto from 'node:crypto';

/**
 * TASK 5H.4 — SERVER-SIDE STATELESS SESSION REVOCATION & RATE-LIMIT GUARD
 *
 * Security Rules (Section 6 & Section 10):
 * - Do NOT store passwords, authentication secrets, or session tokens in Google Sheets.
 * - Do NOT connect to MongoDB.
 * - Preserves HMAC-SHA256 stateless signed session verification in src/lib/auth.ts
 *   backed by an isolated server-side in-memory revocation and login rate-limit registry.
 *
 * RESIDUAL LIMITATION (Task 5H.7 A-04 — Partially Remediated):
 * - sessionRegistry and rateLimitRegistry are process-local in-memory Maps.
 * - Server restarts or secondary serverless instances do not share these Maps; therefore,
 *   logout revocation and failed-login rate limits are NOT durable across restarts/instances.
 * - Interim mitigation: SESSION_MAX_AGE_SECONDS is reduced to 1800s (30 min) in src/lib/auth.ts.
 */

const RATE_WINDOW_MS = 15 * 60 * 1000; // 15 minutes
const ACCOUNT_MAX_FAILED_ATTEMPTS = 5;
const IP_MAX_FAILED_ATTEMPTS = 20;

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

const sessionRegistry = new Map<string, SessionRecord>();
const rateLimitRegistry = new Map<string, RateLimitEntry>();

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

export async function revokeSessionInDb(jti: string): Promise<void> {
  if (!jti) return;
  const existing = sessionRegistry.get(jti);
  sessionRegistry.set(jti, {
    jti,
    sub: existing?.sub || 'REVOKED',
    email: existing?.email || 'revoked@local',
    role: existing?.role || 'ADVISOR',
    revoked: true,
    revokedAt: new Date(),
    issuedAt: existing?.issuedAt || new Date(),
    expireAt: existing?.expireAt || new Date(Date.now() + 24 * 60 * 60 * 1000)
  });
}

export async function isSessionActiveInDb(jti: string): Promise<boolean> {
  if (!jti) return false;
  const doc = sessionRegistry.get(jti);
  // Stateless HMAC-SHA256 tokens verified by verifySessionToken() remain active unless explicitly revoked
  if (!doc) return true;
  if (doc.revoked === true) return false;
  if (doc.expireAt && doc.expireAt.getTime() <= Date.now()) return false;
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

export async function checkLoginRateLimit(
  ip: string,
  email: string
): Promise<{ allowed: true } | { allowed: false; retryAfterSeconds: number }> {
  const { acctKey, ipKey } = buildRateKeys(ip, email);
  const now = Date.now();
  const keys = [acctKey, ipKey];

  for (const key of keys) {
    const rec = rateLimitRegistry.get(key);
    if (!rec) continue;
    if (rec.expireAt && rec.expireAt.getTime() <= now) {
      rateLimitRegistry.delete(key);
      continue;
    }
    const threshold = rec.key === ipKey ? IP_MAX_FAILED_ATTEMPTS : ACCOUNT_MAX_FAILED_ATTEMPTS;
    if (rec.lockedUntil && rec.lockedUntil.getTime() > now) {
      const retryAfterSeconds = Math.max(1, Math.ceil((rec.lockedUntil.getTime() - now) / 1000));
      return { allowed: false, retryAfterSeconds };
    }
    if (rec.attempts >= threshold) {
      const retryAfterSeconds = Math.max(1, Math.ceil((rec.expireAt.getTime() - now) / 1000));
      return { allowed: false, retryAfterSeconds };
    }
  }

  return { allowed: true };
}

export async function recordFailedLoginAttempt(ip: string, email: string): Promise<void> {
  const { acctKey, ipKey } = buildRateKeys(ip, email);
  const now = new Date();
  const nextExpiry = new Date(now.getTime() + RATE_WINDOW_MS);

  const pairs: Array<{ key: string; max: number }> = [
    { key: acctKey, max: ACCOUNT_MAX_FAILED_ATTEMPTS },
    { key: ipKey, max: IP_MAX_FAILED_ATTEMPTS }
  ];

  for (const item of pairs) {
    const existing = rateLimitRegistry.get(item.key);
    if (!existing || (existing.expireAt && existing.expireAt.getTime() <= now.getTime())) {
      rateLimitRegistry.set(item.key, {
        key: item.key,
        attempts: 1,
        lockedUntil: null,
        expireAt: nextExpiry
      });
    } else {
      const updatedAttempts = (existing.attempts || 0) + 1;
      const lockedUntil = updatedAttempts >= item.max ? nextExpiry : existing.lockedUntil;
      rateLimitRegistry.set(item.key, {
        key: item.key,
        attempts: updatedAttempts,
        lockedUntil,
        expireAt: nextExpiry
      });
    }
  }
}

export async function clearLoginRateLimit(ip: string, email: string): Promise<void> {
  const { acctKey } = buildRateKeys(ip, email);
  rateLimitRegistry.delete(acctKey);
}
