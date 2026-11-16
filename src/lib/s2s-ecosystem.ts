import crypto from 'node:crypto';
import connectToDatabase from '@/lib/db';
import { Lead } from '@/models/Lead';

export const CRM_SERVICE_ID = 'svc-ai-crm';
const ALLOWED_ISSUERS = new Set(['svc-loan-api', 'svc-loan-agents', 'svc-ai-calling']);
const MAX_CLOCK_SKEW_SECONDS = 300;
const replayCache = new Map<string, number>();
const idempotencyRecords = new Map<string, any>();

function b64urlEncode(buf: Buffer | string): string {
  const b = Buffer.isBuffer(buf) ? buf : Buffer.from(buf, 'utf8');
  return b.toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
}

function b64urlDecode(str: string): Buffer {
  const padded = str.replace(/-/g, '+').replace(/_/g, '/') + '==='.slice((str.length + 3) % 4);
  return Buffer.from(padded, 'base64');
}

function timingSafeEqualStr(a: string, b: string): boolean {
  const ba = Buffer.from(String(a || ''), 'utf8');
  const bb = Buffer.from(String(b || ''), 'utf8');
  if (!ba.length || ba.length !== bb.length) return false;
  return crypto.timingSafeEqual(ba, bb);
}

function getSigningKey(kid?: string): { kid: string; key: string } {
  const activeKid = process.env.ECOSYSTEM_KEY_ID || 'v1-2026-11';
  const keys: Record<string, string> = {};
  if (process.env.ECOSYSTEM_SERVICE_SECRETS_JSON) {
    try {
      Object.assign(keys, JSON.parse(process.env.ECOSYSTEM_SERVICE_SECRETS_JSON));
    } catch {}
  }
  const primary = process.env.ECOSYSTEM_SERVICE_SECRET || process.env.INTERNAL_WORKER_SECRET || '';
  if (primary && !keys[activeKid]) keys[activeKid] = primary;
  const targetKid = kid && keys[kid] ? kid : activeKid;
  return { kid: targetKid, key: keys[targetKid] || '' };
}

export function verifyIncomingCrmS2S(headers: Headers, rawBody: string) {
  const authHeader = headers.get('x-service-auth') || '';
  const serviceIdHeader = headers.get('x-service-id') || '';
  const tsHeader = headers.get('x-service-timestamp') || '';
  const sigHeader = headers.get('x-service-signature') || '';

  const token = authHeader.replace(/^Bearer\s+/i, '').trim();
  if (!token) return { ok: false, status: 401, code: 'MISSING_S2S_TOKEN', error: 'Missing X-Service-Auth' };
  const parts = token.split('.');
  if (parts.length !== 3) return { ok: false, status: 401, code: 'MALFORMED_S2S_TOKEN', error: 'Invalid JWT structure' };

  let header: any;
  let claims: any;
  try {
    header = JSON.parse(b64urlDecode(parts[0]).toString('utf8'));
    claims = JSON.parse(b64urlDecode(parts[1]).toString('utf8'));
  } catch {
    return { ok: false, status: 401, code: 'INVALID_S2S_TOKEN', error: 'Unable to parse JWT' };
  }

  const { key } = getSigningKey(header.kid);
  if (!key || key.length < 16) return { ok: false, status: 401, code: 'S2S_SECRET_NOT_CONFIGURED', error: 'S2S secret unavailable' };

  const expectedJwtSig = b64urlEncode(crypto.createHmac('sha256', key).update(`${parts[0]}.${parts[1]}`).digest());
  if (!timingSafeEqualStr(parts[2], expectedJwtSig)) {
    return { ok: false, status: 401, code: 'INVALID_S2S_SIGNATURE', error: 'JWT signature mismatch' };
  }

  const now = Math.floor(Date.now() / 1000);
  if (!claims.exp || claims.exp < now) return { ok: false, status: 401, code: 'EXPIRED_S2S_TOKEN', error: 'Token expired' };
  if (!ALLOWED_ISSUERS.has(claims.iss)) return { ok: false, status: 403, code: 'FORBIDDEN_ISSUER', error: 'Unauthorized issuer' };
  if (serviceIdHeader && serviceIdHeader !== claims.iss) return { ok: false, status: 403, code: 'SERVICE_ID_MISMATCH', error: 'Header mismatch' };
  if (claims.aud !== CRM_SERVICE_ID) return { ok: false, status: 403, code: 'INVALID_AUDIENCE', error: 'Invalid token audience' };

  const tsNum = Number(tsHeader);
  if (!tsHeader || !sigHeader || !Number.isFinite(tsNum) || Math.abs(now - tsNum) > MAX_CLOCK_SKEW_SECONDS) {
    return { ok: false, status: 409, code: 'STALE_TIMESTAMP', error: 'Invalid or stale timestamp' };
  }

  const expectedBodyHmac = crypto.createHmac('sha256', key).update(`${tsHeader}.${rawBody}`).digest('hex');
  if (!timingSafeEqualStr(sigHeader.toLowerCase(), expectedBodyHmac.toLowerCase())) {
    return { ok: false, status: 401, code: 'BODY_HMAC_MISMATCH', error: 'HMAC verification failed' };
  }

  if (!claims.jti || replayCache.has(claims.jti)) {
    return { ok: false, status: 409, code: 'REPLAY_DETECTED', error: 'Replay JTI detected' };
  }
  replayCache.set(claims.jti, claims.exp);
  return { ok: true, claims, serviceId: claims.iss };
}

export async function processInboundCrmEvent(envelope: any) {
  const corrId = envelope.correlationId || `CORR-CRM-${Date.now()}`;
  const idempKey = envelope.idempotencyKey || `${envelope.eventType}:${corrId}`;
  if (idempotencyRecords.has(idempKey)) {
    return {
      success: true,
      service: CRM_SERVICE_ID,
      duplicateSuppressed: true,
      correlationId: corrId,
      record: idempotencyRecords.get(idempKey)
    };
  }

  const payload = envelope.payload || {};
  let persistenceMode = 'in_memory_cache';
  let leadId = payload.leadId || envelope.centralCustomerId || `CRM-${Date.now()}`;

  try {
    const conn = await connectToDatabase();
    if (conn && conn.connection?.readyState === 1 && payload.phone) {
      const existing = await Lead.findOne({ $or: [{ idempotencyKey: idempKey }, { phone: payload.phone }] });
      if (existing) {
        leadId = existing.leadId || String(existing._id);
        if (payload.disposition === 'OPTED_OUT') {
          existing.isOptedOut = true;
          existing.status = 'OPTED_OUT';
          await existing.save();
        }
        persistenceMode = 'mongodb_updated';
      }
    }
  } catch {
    persistenceMode = 'memory_fallback';
  }

  const record = {
    leadId,
    centralCustomerId: envelope.centralCustomerId || null,
    eventType: envelope.eventType,
    correlationId: corrId,
    persistenceMode,
    processedAt: new Date().toISOString()
  };
  idempotencyRecords.set(idempKey, record);
  return { success: true, service: CRM_SERVICE_ID, duplicateSuppressed: false, correlationId: corrId, record };
}

export async function sendEventToCentralLoanApi(eventType: string, payload: Record<string, any>, correlationId?: string) {
  const centralBase = (process.env.CENTRAL_LOAN_API_URL || 'https://api.avanifinserv.com').replace(/\/$/, '');
  const { kid, key } = getSigningKey();
  if (!key || key.length < 16) {
    return { success: false, status: 500, error: 'ECOSYSTEM_SERVICE_SECRET not configured' };
  }
  const now = Math.floor(Date.now() / 1000);
  const jti = crypto.randomUUID();
  const headerB64 = b64urlEncode(JSON.stringify({ alg: 'HS256', typ: 'JWT', kid }));
  const claimsB64 = b64urlEncode(JSON.stringify({
    iss: CRM_SERVICE_ID,
    aud: 'svc-loan-api',
    sub: CRM_SERVICE_ID,
    iat: now,
    exp: now + 300,
    jti,
    scopes: ['ecosystem:sync']
  }));
  const jwtSig = b64urlEncode(crypto.createHmac('sha256', key).update(`${headerB64}.${claimsB64}`).digest());
  const token = `${headerB64}.${claimsB64}.${jwtSig}`;
  const corrId = correlationId || `CORR-P2-${Date.now()}`;
  const wireBody = JSON.stringify({ eventType, correlationId: corrId, payload: { ...payload, sourceProject: 'Project 2 (svc-ai-crm)' } });
  const ts = String(now);
  const hmac = crypto.createHmac('sha256', key).update(`${ts}.${wireBody}`).digest('hex');

  const res = await fetch(`${centralBase}/api/portal/integrations/cross-project/event`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Service-Auth': `Bearer ${token}`,
      'X-Service-Id': CRM_SERVICE_ID,
      'X-Service-Timestamp': ts,
      'X-Service-Signature': hmac,
      'X-Key-Id': kid,
      'X-Correlation-Id': corrId
    },
    body: wireBody,
    signal: AbortSignal.timeout(Number(process.env.S2S_TIMEOUT_MS || 5000))
  });
  const text = await res.text();
  let json: any = null;
  try { json = JSON.parse(text); } catch {}
  return { success: res.ok, status: res.status, correlationId: corrId, data: json || text.slice(0, 200) };
}
