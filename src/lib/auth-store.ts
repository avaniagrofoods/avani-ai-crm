import crypto from 'node:crypto';
import connectToDatabase from '@/lib/db';
import mongoose from 'mongoose';
import { AuthSession } from '@/models/AuthSession';
import { AuthRateLimit } from '@/models/AuthRateLimit';

const RATE_WINDOW_MS = 15 * 60 * 1000; // 15 minutes
const ACCOUNT_MAX_FAILED_ATTEMPTS = 5;
const IP_MAX_FAILED_ATTEMPTS = 20;

export async function ensureDbReady(): Promise<boolean> {
  const conn = await connectToDatabase();
  return Boolean(conn && mongoose.connection.readyState === 1);
}

export async function registerSessionInDb(session: {
  jti: string;
  sub: string;
  email: string;
  role: 'ADMIN' | 'ADVISOR';
  iat: number;
  exp: number;
}): Promise<void> {
  const ready = await ensureDbReady();
  if (!ready) {
    throw new Error('Authentication session store unavailable.');
  }
  await AuthSession.create({
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
  const ready = await ensureDbReady();
  if (!ready) return;
  await AuthSession.findOneAndUpdate(
    { jti },
    {
      $set: { revoked: true, revokedAt: new Date() },
      $setOnInsert: {
        sub: 'REVOKED',
        email: 'revoked@local',
        role: 'ADVISOR',
        issuedAt: new Date(),
        expireAt: new Date(Date.now() + 24 * 60 * 60 * 1000)
      }
    },
    { upsert: true }
  );
}

export async function isSessionActiveInDb(jti: string): Promise<boolean> {
  if (!jti) return false;
  const ready = await ensureDbReady();
  if (!ready) return false;
  const doc = await AuthSession.findOne({ jti })
    .select({ revoked: 1, expireAt: 1 })
    .lean<{ revoked?: boolean; expireAt?: Date } | null>();
  if (!doc) return false;
  if (doc.revoked === true) return false;
  if (doc.expireAt && new Date(doc.expireAt).getTime() <= Date.now()) return false;
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
  const ready = await ensureDbReady();
  if (!ready) return { allowed: true };

  const { acctKey, ipKey } = buildRateKeys(ip, email);
  const now = Date.now();
  const records = await AuthRateLimit.find({ key: { $in: [acctKey, ipKey] } }).lean<
    Array<{ key: string; attempts: number; lockedUntil?: Date | null; expireAt?: Date }>
  >();

  for (const rec of records) {
    if (rec.expireAt && new Date(rec.expireAt).getTime() <= now) continue;
    const threshold = rec.key === ipKey ? IP_MAX_FAILED_ATTEMPTS : ACCOUNT_MAX_FAILED_ATTEMPTS;
    if (rec.lockedUntil && new Date(rec.lockedUntil).getTime() > now) {
      const retryAfterSeconds = Math.max(
        1,
        Math.ceil((new Date(rec.lockedUntil).getTime() - now) / 1000)
      );
      return { allowed: false, retryAfterSeconds };
    }
    if (rec.attempts >= threshold) {
      const retryAfterSeconds = Math.max(
        1,
        Math.ceil(((rec.expireAt ? new Date(rec.expireAt).getTime() : now + RATE_WINDOW_MS) - now) / 1000)
      );
      return { allowed: false, retryAfterSeconds };
    }
  }

  return { allowed: true };
}

export async function recordFailedLoginAttempt(ip: string, email: string): Promise<void> {
  const ready = await ensureDbReady();
  if (!ready) return;

  const { acctKey, ipKey } = buildRateKeys(ip, email);
  const now = new Date();
  const nextExpiry = new Date(now.getTime() + RATE_WINDOW_MS);

  const pairs: Array<{ key: string; max: number }> = [
    { key: acctKey, max: ACCOUNT_MAX_FAILED_ATTEMPTS },
    { key: ipKey, max: IP_MAX_FAILED_ATTEMPTS }
  ];

  for (const item of pairs) {
    const existing = await AuthRateLimit.findOne({ key: item.key });
    if (!existing || (existing.expireAt && existing.expireAt.getTime() <= now.getTime())) {
      await AuthRateLimit.findOneAndUpdate(
        { key: item.key },
        { $set: { attempts: 1, lockedUntil: null, expireAt: nextExpiry } },
        { upsert: true, new: true }
      );
    } else {
      const updatedAttempts = (existing.attempts || 0) + 1;
      const lockedUntil = updatedAttempts >= item.max ? nextExpiry : existing.lockedUntil;
      await AuthRateLimit.updateOne(
        { key: item.key },
        { $set: { attempts: updatedAttempts, lockedUntil, expireAt: nextExpiry } }
      );
    }
  }
}

export async function clearLoginRateLimit(ip: string, email: string): Promise<void> {
  const ready = await ensureDbReady();
  if (!ready) return;
  const { acctKey } = buildRateKeys(ip, email);
  await AuthRateLimit.deleteOne({ key: acctKey });
}
