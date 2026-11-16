'use strict';

const crypto = require('crypto');

const CRM_SERVICE_ID = 'svc-ai-crm';
const ALLOWED_ISSUERS = new Set(['svc-loan-api', 'svc-loan-agents', 'svc-ai-calling']);
const replayCache = new Map();
const idempotencyRecords = new Map();

function b64u(buf) {
  return (Buffer.isBuffer(buf) ? buf : Buffer.from(String(buf), 'utf8'))
    .toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
}

function unb64u(str) {
  return Buffer.from(str.replace(/-/g, '+').replace(/_/g, '/') + '==='.slice((str.length + 3) % 4), 'base64');
}

function eqSafe(a, b) {
  const ba = Buffer.from(String(a || ''), 'utf8');
  const bb = Buffer.from(String(b || ''), 'utf8');
  return ba.length > 0 && ba.length === bb.length && crypto.timingSafeEqual(ba, bb);
}

function signS2S({ audience = 'svc-loan-api', body = {}, secret, kid = 'v1-2026-11', correlationId = null }) {
  const now = Math.floor(Date.now() / 1000);
  const h = b64u(JSON.stringify({ alg: 'HS256', typ: 'JWT', kid }));
  const p = b64u(JSON.stringify({ iss: CRM_SERVICE_ID, aud: audience, sub: CRM_SERVICE_ID, iat: now, exp: now + 300, jti: crypto.randomUUID(), scopes: ['ecosystem:sync'] }));
  const s = b64u(crypto.createHmac('sha256', secret).update(`${h}.${p}`).digest());
  const rawBody = typeof body === 'string' ? body : JSON.stringify(body);
  const ts = String(now);
  const hmac = crypto.createHmac('sha256', secret).update(`${ts}.${rawBody}`).digest('hex');
  return {
    rawBody,
    headers: {
      'Content-Type': 'application/json',
      'X-Service-Auth': `Bearer ${h}.${p}.${s}`,
      'X-Service-Id': CRM_SERVICE_ID,
      'X-Service-Timestamp': ts,
      'X-Service-Signature': hmac,
      'X-Key-Id': kid,
      'X-Correlation-Id': correlationId || `CORR-P2-${Date.now()}`
    }
  };
}

function verifyS2S(headers, rawBody, secret) {
  const auth = String(headers['x-service-auth'] || '').replace(/^Bearer\s+/i, '').trim();
  if (!auth) return { ok: false, status: 401, code: 'MISSING_S2S_TOKEN' };
  const parts = auth.split('.');
  if (parts.length !== 3) return { ok: false, status: 401, code: 'MALFORMED_S2S_TOKEN' };
  let claims;
  try {
    claims = JSON.parse(unb64u(parts[1]).toString('utf8'));
  } catch {
    return { ok: false, status: 401, code: 'INVALID_S2S_TOKEN' };
  }
  const expSig = b64u(crypto.createHmac('sha256', secret).update(`${parts[0]}.${parts[1]}`).digest());
  if (!eqSafe(parts[2], expSig)) return { ok: false, status: 401, code: 'INVALID_S2S_SIGNATURE' };
  const now = Math.floor(Date.now() / 1000);
  if (!claims.exp || claims.exp < now) return { ok: false, status: 401, code: 'EXPIRED_S2S_TOKEN' };
  if (!ALLOWED_ISSUERS.has(claims.iss) || claims.aud !== CRM_SERVICE_ID) return { ok: false, status: 403, code: 'FORBIDDEN_AUDIENCE_OR_ISSUER' };
  const ts = headers['x-service-timestamp'];
  const hmac = headers['x-service-signature'];
  if (!ts || !hmac || Math.abs(now - Number(ts)) > 300) return { ok: false, status: 409, code: 'STALE_TIMESTAMP' };
  const expHmac = crypto.createHmac('sha256', secret).update(`${ts}.${rawBody}`).digest('hex');
  if (!eqSafe(String(hmac).toLowerCase(), expHmac.toLowerCase())) return { ok: false, status: 401, code: 'BODY_HMAC_MISMATCH' };
  if (!claims.jti || replayCache.has(claims.jti)) return { ok: false, status: 409, code: 'REPLAY_DETECTED' };
  replayCache.set(claims.jti, claims.exp);
  return { ok: true, claims };
}

async function handleS2SRequest(headers, rawBody, secret) {
  const v = verifyS2S(headers, rawBody, secret);
  if (!v.ok) return { status: v.status, body: { success: false, code: v.code } };
  const envelope = JSON.parse(rawBody || '{}');
  const corrId = envelope.correlationId || headers['x-correlation-id'] || `CORR-P2-${Date.now()}`;
  const key = envelope.idempotencyKey || `${envelope.eventType}:${corrId}`;
  if (idempotencyRecords.has(key)) {
    return { status: 200, body: { success: true, service: CRM_SERVICE_ID, duplicateSuppressed: true, correlationId: corrId, record: idempotencyRecords.get(key) } };
  }
  const record = {
    centralCustomerId: envelope.centralCustomerId || null,
    eventType: envelope.eventType,
    leadId: (envelope.payload && envelope.payload.leadId) || `CRM-${Date.now()}`,
    consentStatus: (envelope.payload && envelope.payload.consent_status) || 'Approved',
    processedAt: new Date().toISOString()
  };
  idempotencyRecords.set(key, record);
  return { status: 200, body: { success: true, service: CRM_SERVICE_ID, duplicateSuppressed: false, correlationId: corrId, record } };
}

async function sendToCentralLoanApi({ centralUrl, eventType, payload, correlationId, secret }) {
  const signed = signS2S({
    audience: 'svc-loan-api',
    body: { eventType, correlationId, payload: { ...payload, sourceProject: 'Project 2 (svc-ai-crm)' } },
    secret,
    correlationId
  });
  const res = await fetch(`${centralUrl.replace(/\/$/, '')}/api/portal/integrations/cross-project/event`, {
    method: 'POST',
    headers: signed.headers,
    body: signed.rawBody
  });
  const json = await res.json().catch(() => null);
  return { status: res.status, body: json };
}

module.exports = { CRM_SERVICE_ID, handleS2SRequest, sendToCentralLoanApi, verifyS2S, signS2S };
