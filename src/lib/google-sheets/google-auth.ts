/**
 * TASK 5H.7 (Remediated from 5H.4/5H.5 A-01) — SERVER-SIDE GOOGLE SHEETS AUTHENTICATION ENGINE
 * Supports:
 * 1. Google Apps Script Web App Gateway (Canonical JSON-Body Envelope + HMAC-SHA256 + TimestampMs + Nonce Anti-Replay) — PRIMARY
 * 2. Google Service Account OAuth2 RS256 JWT Assertion (Native Node.js crypto, 0 external packages) — OPTIONAL
 *
 * Strictly server-side only. Never exposes secrets, private keys, or tokens to client browser code.
 * Zero dependence on custom HTTP headers (Apps Script doPost(e) only reads e.postData.contents).
 */

import crypto from 'node:crypto';
import { SheetsCrmError } from './sheet-error-handler';
import { verifyAndRecordRequestNonce } from './sheet-idempotency';

export interface SignedGatewayEnvelope {
  requestId: string;
  timestampMs: number;
  payloadJson: string;
  signature: string;
  bodyString: string;
}

/**
 * Signs an outbound request payload for the Google Apps Script Web App Gateway using HMAC-SHA256.
 * Canonical signing string: `${timestampMs}.${requestId}.${payloadJson}`
 * Entire envelope `{ requestId, timestampMs, payloadJson, signature }` is sent in the JSON POST body.
 */
export function signAppsScriptGatewayRequest(
  payload: Record<string, any>,
  secretInput?: string,
  options?: { requestId?: string; timestampMs?: number }
): SignedGatewayEnvelope {
  const secret = String(secretInput ?? process.env.GOOGLE_SHEETS_GATEWAY_SECRET ?? '').trim();
  if (!secret || secret.length < 16) {
    throw new SheetsCrmError({
      code: 'GOOGLE_SHEETS_AUTH_FAILED',
      message: 'GOOGLE_SHEETS_GATEWAY_SECRET is unconfigured or shorter than 16 characters.',
      httpStatus: 401,
      retryable: false
    });
  }

  const timestampMs = options?.timestampMs ?? Date.now();
  const requestId = options?.requestId || `REQ-${timestampMs}-${crypto.randomBytes(6).toString('hex')}`;
  const payloadJson = JSON.stringify(payload ?? {});

  const canonical = `${timestampMs}.${requestId}.${payloadJson}`;
  const signature = crypto.createHmac('sha256', secret).update(canonical, 'utf8').digest('hex');

  const bodyString = JSON.stringify({
    requestId,
    timestampMs,
    payloadJson,
    signature
  });

  return {
    requestId,
    timestampMs,
    payloadJson,
    signature,
    bodyString
  };
}

/**
 * Verifies an Apps Script Gateway canonical JSON-body HMAC-SHA256 request.
 */
export function verifyAppsScriptGatewaySignature(params: {
  payloadJson: string;
  requestId: string;
  timestampMs: number;
  signature: string;
  secret: string;
  nowMs?: number;
}): { valid: boolean; error?: string } {
  const { payloadJson, requestId, timestampMs, signature, secret, nowMs } = params;
  if (!secret || secret.length < 16) {
    return { valid: false, error: 'Gateway secret unconfigured' };
  }
  if (!signature || typeof signature !== 'string') {
    return { valid: false, error: 'Missing gateway signature' };
  }

  const nonceCheck = verifyAndRecordRequestNonce(requestId, timestampMs, nowMs);
  if (!nonceCheck.valid) {
    return nonceCheck;
  }

  const canonical = `${timestampMs}.${requestId}.${payloadJson}`;
  const expected = crypto.createHmac('sha256', secret).update(canonical, 'utf8').digest('hex');

  try {
    const a = Buffer.from(signature.trim().toLowerCase(), 'hex');
    const b = Buffer.from(expected, 'hex');
    if (a.length !== 32 || a.length !== b.length || !crypto.timingSafeEqual(a, b)) {
      return { valid: false, error: 'Invalid HMAC-SHA256 gateway signature' };
    }
    return { valid: true };
  } catch {
    return { valid: false, error: 'Malformed signature hex encoding' };
  }
}

/**
 * Creates a signed RS256 JWT assertion for a Google Cloud Service Account using built-in Node.js crypto.
 * Requires zero external npm packages.
 */
export function createServiceAccountJwtAssertion(params: {
  clientEmail: string;
  privateKeyPem: string;
  scopes?: string[];
  nowSeconds?: number;
}): string {
  const now = params.nowSeconds ?? Math.floor(Date.now() / 1000);
  const scopes = params.scopes ?? ['https://www.googleapis.com/auth/spreadsheets'];

  const header = { alg: 'RS256', typ: 'JWT' };
  const claimSet = {
    iss: params.clientEmail,
    scope: scopes.join(' '),
    aud: 'https://oauth2.googleapis.com/token',
    iat: now,
    exp: now + 3600
  };

  const b64Header = Buffer.from(JSON.stringify(header)).toString('base64url');
  const b64Claims = Buffer.from(JSON.stringify(claimSet)).toString('base64url');
  const unsignedToken = `${b64Header}.${b64Claims}`;

  const normalizedKey = params.privateKeyPem.replace(/\\n/g, '\n');
  const signer = crypto.createSign('RSA-SHA256');
  signer.update(unsignedToken);
  signer.end();
  const signature = signer.sign(normalizedKey, 'base64url');

  return `${unsignedToken}.${signature}`;
}
