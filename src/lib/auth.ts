import { NextResponse } from 'next/server';
import { CANONICAL_LEAD_STAGES, CanonicalLeadStage } from '@/config/pipeline';
import {
  isSessionActiveInDb,
  registerSessionInDb,
  revokeSessionInDb
} from '@/lib/auth-store';
import {
  getOrDeriveEnvScryptHash,
  verifyStoredPasswordHash
} from '@/lib/password';

export const SESSION_COOKIE_NAME = 'avani_crm_session';
export const SESSION_MAX_AGE_SECONDS = 60 * 60 * 8; // 8 hours

export type CrmRole = 'ADMIN' | 'ADVISOR';

export interface CrmSession {
  jti: string;
  sub: string;
  name: string;
  email: string;
  role: CrmRole;
  iat: number;
  exp: number;
}

export interface CrmAccountConfig {
  id: string;
  name: string;
  email: string;
  role: CrmRole;
  passwordPlain?: string;
  passwordHash?: string;
}

const textEncoder = new TextEncoder();

function base64UrlEncode(bytes: Uint8Array): string {
  let binary = '';
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
}

function base64UrlDecode(input: string): Uint8Array | null {
  try {
    const padded = input.replace(/-/g, '+').replace(/_/g, '/') + '==='.slice((input.length + 3) % 4);
    const binary = atob(padded);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
      bytes[i] = binary.charCodeAt(i);
    }
    return bytes;
  } catch {
    return null;
  }
}

function getSessionSecret(): string | null {
  const secret = process.env.SESSION_SECRET?.trim();
  if (!secret || secret.length < 32) {
    return null;
  }
  return secret;
}

async function getHmacKey(secret: string, usage: 'sign' | 'verify'): Promise<CryptoKey> {
  return globalThis.crypto.subtle.importKey(
    'raw',
    textEncoder.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    [usage]
  );
}

export function constantTimeEqualStrings(a: string, b: string): boolean {
  const aBytes = textEncoder.encode(a);
  const bBytes = textEncoder.encode(b);
  const maxLen = Math.max(aBytes.length, bBytes.length);
  let diff = aBytes.length ^ bBytes.length;
  for (let i = 0; i < maxLen; i++) {
    diff |= (aBytes[i] ?? 0) ^ (bBytes[i] ?? 0);
  }
  return diff === 0;
}

export async function signSessionTokenWithDetails(
  payload: Omit<CrmSession, 'jti' | 'iat' | 'exp'> & { jti?: string },
  ttlSeconds = SESSION_MAX_AGE_SECONDS
): Promise<{ token: string; session: CrmSession }> {
  const secret = getSessionSecret();
  if (!secret) {
    throw new Error('SESSION_SECRET is not configured or is shorter than 32 characters');
  }
  const now = Math.floor(Date.now() / 1000);
  const jti = payload.jti || globalThis.crypto.randomUUID();
  const session: CrmSession = {
    jti,
    sub: payload.sub,
    name: payload.name,
    email: payload.email,
    role: payload.role,
    iat: now,
    exp: now + ttlSeconds
  };
  const payloadB64 = base64UrlEncode(textEncoder.encode(JSON.stringify(session)));
  const key = await getHmacKey(secret, 'sign');
  const sigBuffer = await globalThis.crypto.subtle.sign('HMAC', key, textEncoder.encode(payloadB64));
  const sigB64 = base64UrlEncode(new Uint8Array(sigBuffer));
  return { token: `${payloadB64}.${sigB64}`, session };
}

export async function signSessionToken(
  payload: Omit<CrmSession, 'jti' | 'iat' | 'exp'> & { jti?: string },
  ttlSeconds = SESSION_MAX_AGE_SECONDS
): Promise<string> {
  const { token } = await signSessionTokenWithDetails(payload, ttlSeconds);
  return token;
}

export async function verifySessionToken(token: string | undefined | null): Promise<CrmSession | null> {
  if (!token || typeof token !== 'string') return null;
  const secret = getSessionSecret();
  if (!secret) return null;

  const parts = token.split('.');
  if (parts.length !== 2) return null;
  const [payloadB64, sigB64] = parts;
  if (!payloadB64 || !sigB64) return null;

  const sigBytes = base64UrlDecode(sigB64);
  const payloadBytes = base64UrlDecode(payloadB64);
  if (!sigBytes || !payloadBytes) return null;

  try {
    const key = await getHmacKey(secret, 'verify');
    const sigCopy = new Uint8Array(sigBytes.length);
    sigCopy.set(sigBytes);
    const valid = await globalThis.crypto.subtle.verify(
      'HMAC',
      key,
      sigCopy.buffer as ArrayBuffer,
      textEncoder.encode(payloadB64)
    );
    if (!valid) return null;

    const decoded = JSON.parse(new TextDecoder().decode(payloadBytes)) as CrmSession;
    if (!decoded || !decoded.jti || !decoded.sub || !decoded.email || !decoded.role) return null;
    if (decoded.role !== 'ADMIN' && decoded.role !== 'ADVISOR') return null;
    if (typeof decoded.exp !== 'number' || decoded.exp <= Math.floor(Date.now() / 1000)) {
      return null;
    }
    return decoded;
  } catch {
    return null;
  }
}

export async function verifyActiveSession(token: string | undefined | null): Promise<CrmSession | null> {
  const session = await verifySessionToken(token);
  if (!session) return null;
  const active = await isSessionActiveInDb(session.jti);
  if (!active) return null;
  return session;
}

export async function issueRotatedSession(
  account: Pick<CrmAccountConfig, 'id' | 'name' | 'email' | 'role'>,
  previousToken?: string | null
): Promise<{ token: string; session: CrmSession }> {
  if (previousToken) {
    const oldSession = await verifySessionToken(previousToken);
    if (oldSession?.jti) {
      await revokeSessionInDb(oldSession.jti);
    }
  }
  const result = await signSessionTokenWithDetails({
    sub: account.id,
    name: account.name,
    email: account.email,
    role: account.role
  });
  await registerSessionInDb(result.session);
  return result;
}

export async function revokeSessionToken(token: string | undefined | null): Promise<void> {
  if (!token) return;
  const session = await verifySessionToken(token);
  if (session?.jti) {
    await revokeSessionInDb(session.jti);
  }
}

export function parseCookieHeader(cookieHeader: string | null, name: string): string | null {
  if (!cookieHeader) return null;
  const pairs = cookieHeader.split(';');
  for (const pair of pairs) {
    const idx = pair.indexOf('=');
    if (idx === -1) continue;
    const key = pair.slice(0, idx).trim();
    if (key === name) {
      return decodeURIComponent(pair.slice(idx + 1).trim());
    }
  }
  return null;
}

export async function getSessionFromRequest(req: Request): Promise<CrmSession | null> {
  const token = parseCookieHeader(req.headers.get('cookie'), SESSION_COOKIE_NAME);
  return verifyActiveSession(token);
}

export function buildSessionCookieOptions(req: Request, maxAgeSeconds: number) {
  const forwardedProto = req.headers.get('x-forwarded-proto');
  const isHttps =
    forwardedProto === 'https' ||
    req.url.startsWith('https://') ||
    process.env.VERCEL === '1';
  return {
    name: SESSION_COOKIE_NAME,
    httpOnly: true,
    sameSite: 'lax' as const,
    secure: isHttps,
    path: '/',
    maxAge: maxAgeSeconds
  };
}

const STATE_CHANGING_METHODS = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);

export function verifyCsrfRequest(
  req: Request
): { ok: true } | { ok: false; status: number; error: string } {
  const method = (req.method || 'GET').toUpperCase();
  if (!STATE_CHANGING_METHODS.has(method)) {
    return { ok: true };
  }

  const secFetchSite = req.headers.get('sec-fetch-site')?.trim().toLowerCase();
  if (secFetchSite === 'cross-site') {
    return { ok: false, status: 403, error: 'CSRF_FORBIDDEN' };
  }

  const expectedHosts = new Set<string>();
  const reqHost = req.headers.get('x-forwarded-host') || req.headers.get('host');
  if (reqHost) expectedHosts.add(reqHost.split(',')[0].trim().toLowerCase());
  try {
    expectedHosts.add(new URL(req.url).host.toLowerCase());
  } catch {
    // ignore malformed internal URL
  }
  if (process.env.NEXT_PUBLIC_APP_URL) {
    try {
      expectedHosts.add(new URL(process.env.NEXT_PUBLIC_APP_URL).host.toLowerCase());
    } catch {
      // ignore invalid app URL
    }
  }

  const origin = req.headers.get('origin');
  if (origin) {
    try {
      const originHost = new URL(origin).host.toLowerCase();
      if (expectedHosts.size > 0 && !expectedHosts.has(originHost)) {
        return { ok: false, status: 403, error: 'CSRF_ORIGIN_MISMATCH' };
      }
    } catch {
      return { ok: false, status: 403, error: 'CSRF_INVALID_ORIGIN' };
    }
  } else {
    const referer = req.headers.get('referer');
    if (referer) {
      try {
        const refHost = new URL(referer).host.toLowerCase();
        if (expectedHosts.size > 0 && !expectedHosts.has(refHost)) {
          return { ok: false, status: 403, error: 'CSRF_REFERER_MISMATCH' };
        }
      } catch {
        return { ok: false, status: 403, error: 'CSRF_INVALID_REFERER' };
      }
    }
  }

  return { ok: true };
}

export function getConfiguredAccounts(): CrmAccountConfig[] {
  const accounts: CrmAccountConfig[] = [];

  const jsonRaw = process.env.CRM_AUTH_ACCOUNTS_JSON?.trim();
  if (jsonRaw) {
    try {
      const parsed = JSON.parse(jsonRaw);
      if (Array.isArray(parsed)) {
        for (const item of parsed) {
          const hashVal = item?.passwordHash || item?.passwordHashScrypt || item?.passwordHashSha256;
          if (item?.email && (item?.password || hashVal) && (item?.role === 'ADMIN' || item?.role === 'ADVISOR')) {
            accounts.push({
              id: String(item.id || item.email),
              name: String(item.name || item.email),
              email: String(item.email).trim().toLowerCase(),
              role: item.role,
              passwordPlain: item.password ? String(item.password) : undefined,
              passwordHash: hashVal ? String(hashVal).trim() : undefined
            });
          }
        }
      }
    } catch {
      // Malformed JSON fails closed
    }
  }

  const adminEmail = process.env.CRM_ADMIN_EMAIL?.trim().toLowerCase();
  const adminPassword = process.env.CRM_ADMIN_PASSWORD;
  const adminPasswordHash = process.env.CRM_ADMIN_PASSWORD_HASH?.trim();
  if (adminEmail && (adminPassword || adminPasswordHash)) {
    accounts.push({
      id: 'ADV-SACHIN-01',
      name: process.env.CRM_ADMIN_NAME?.trim() || 'Sachin Shinde',
      email: adminEmail,
      role: 'ADMIN',
      passwordPlain: adminPassword,
      passwordHash: adminPasswordHash
    });
  }

  const advisorEmail = process.env.CRM_ADVISOR_EMAIL?.trim().toLowerCase();
  const advisorPassword = process.env.CRM_ADVISOR_PASSWORD;
  const advisorPasswordHash = process.env.CRM_ADVISOR_PASSWORD_HASH?.trim();
  if (advisorEmail && (advisorPassword || advisorPasswordHash)) {
    accounts.push({
      id: 'ADV-OPS-02',
      name: process.env.CRM_ADVISOR_NAME?.trim() || 'Operations Desk',
      email: advisorEmail,
      role: 'ADVISOR',
      passwordPlain: advisorPassword,
      passwordHash: advisorPasswordHash
    });
  }

  return accounts;
}

export async function verifyCrmCredentials(emailInput: string, passwordInput: string): Promise<CrmAccountConfig | null> {
  const email = String(emailInput || '').trim().toLowerCase();
  const password = String(passwordInput || '');
  if (!email || !password) return null;

  const accounts = getConfiguredAccounts();
  if (accounts.length === 0) return null;

  for (const acct of accounts) {
    if (!constantTimeEqualStrings(acct.email, email)) continue;
    const targetHash = acct.passwordHash
      ? acct.passwordHash
      : acct.passwordPlain
        ? await getOrDeriveEnvScryptHash(acct.id, acct.passwordPlain)
        : '';
    if (targetHash && (await verifyStoredPasswordHash(password, targetHash))) {
      return acct;
    }
  }
  return null;
}

export async function requireAuth(
  req: Request
): Promise<{ ok: true; session: CrmSession } | { ok: false; response: NextResponse }> {
  const csrf = verifyCsrfRequest(req);
  if (!csrf.ok) {
    return {
      ok: false,
      response: NextResponse.json(
        { success: false, error: csrf.error, message: 'Cross-site state change blocked.' },
        { status: csrf.status }
      )
    };
  }

  const session = await getSessionFromRequest(req);
  if (!session) {
    return {
      ok: false,
      response: NextResponse.json(
        { success: false, error: 'UNAUTHORIZED', message: 'Authentication required.' },
        { status: 401 }
      )
    };
  }
  return { ok: true, session };
}

export async function requireRole(
  req: Request,
  allowedRoles: CrmRole[]
): Promise<{ ok: true; session: CrmSession } | { ok: false; response: NextResponse }> {
  const auth = await requireAuth(req);
  if (!auth.ok) return auth;
  if (!allowedRoles.includes(auth.session.role)) {
    return {
      ok: false,
      response: NextResponse.json(
        { success: false, error: 'FORBIDDEN', message: 'Insufficient role permissions.' },
        { status: 403 }
      )
    };
  }
  return auth;
}

export function escapeRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

export function isValidObjectId(id: string | undefined | null): boolean {
  return Boolean(id && /^[a-fA-F0-9]{24}$/.test(id));
}

export function canAccessLead(session: CrmSession, lead: any): boolean {
  if (session.role === 'ADMIN') return true;
  if (!lead) return false;
  const assignedEmail = String(lead?.assignedAdvisor?.email || '').trim().toLowerCase();
  if (assignedEmail && assignedEmail === session.email.toLowerCase()) return true;
  const assignedName = String(lead?.assignedAdvisor?.name || lead?.assignedAgent?.name || '').trim().toLowerCase();
  if (assignedName && assignedName === session.name.toLowerCase()) return true;
  return false;
}

export function buildLeadVisibilityFilter(session: CrmSession): Record<string, any> {
  if (session.role === 'ADMIN') return {};
  return {
    $or: [
      { 'assignedAdvisor.email': new RegExp(`^${escapeRegex(session.email)}$`, 'i') },
      { 'assignedAgent.name': new RegExp(`^${escapeRegex(session.name)}$`, 'i') }
    ]
  };
}

const ADMIN_ONLY_STAGES = new Set<CanonicalLeadStage>([
  'SANCTIONED',
  'DISBURSEMENT_PENDING',
  'DISBURSED',
  'CLOSED_LOST'
]);

const PRE_SANCTION_STAGES = new Set<CanonicalLeadStage>([
  'NEW_ENQUIRY',
  'CONTACT_PENDING',
  'CONTACTED',
  'QUALIFICATION_IN_PROGRESS',
  'QUALIFIED',
  'DOCUMENTS_PENDING',
  'DOCUMENTS_RECEIVED',
  'DOCUMENT_VERIFICATION',
  'LENDER_MATCHING',
  'APPLICATION_PREPARATION',
  'NOT_ELIGIBLE',
  'CUSTOMER_NOT_INTERESTED',
  'FOLLOW_UP_LATER'
]);

const APPLICATION_STAGE_SET = new Set<CanonicalLeadStage>([
  'DOCUMENTS_RECEIVED',
  'DOCUMENT_VERIFICATION',
  'LENDER_MATCHING',
  'APPLICATION_PREPARATION',
  'APPLICATION_SUBMITTED',
  'LENDER_PROCESSING',
  'ADDITIONAL_DOCUMENTS_REQUIRED'
]);

export function validateStageTransition(
  session: CrmSession,
  currentStageRaw: string | undefined | null,
  targetStageRaw: string
): { ok: true } | { ok: false; status: number; error: string } {
  if (!CANONICAL_LEAD_STAGES.includes(targetStageRaw as CanonicalLeadStage)) {
    return { ok: false, status: 400, error: `Invalid canonical stage: ${targetStageRaw}` };
  }

  const targetStage = targetStageRaw as CanonicalLeadStage;
  const currentStage = (currentStageRaw || 'NEW_ENQUIRY') as CanonicalLeadStage;

  if (targetStage === currentStage) {
    return { ok: true };
  }

  if (session.role !== 'ADMIN' && ADMIN_ONLY_STAGES.has(targetStage)) {
    return {
      ok: false,
      status: 403,
      error: `Stage transition to ${targetStage} requires ADMIN role.`
    };
  }

  if (targetStage === 'SANCTIONED') {
    if (!['APPLICATION_SUBMITTED', 'LENDER_PROCESSING', 'ADDITIONAL_DOCUMENTS_REQUIRED'].includes(currentStage)) {
      return {
        ok: false,
        status: 400,
        error: `Cannot transition directly from ${currentStage} to SANCTIONED without application submission.`
      };
    }
  }

  if (targetStage === 'DISBURSEMENT_PENDING' || targetStage === 'DISBURSED') {
    if (!['SANCTIONED', 'DISBURSEMENT_PENDING'].includes(currentStage)) {
      return {
        ok: false,
        status: 400,
        error: `Cannot transition directly from ${currentStage} to ${targetStage} without prior sanction.`
      };
    }
  }

  if (currentStage === 'DISBURSED' && targetStage !== 'DISBURSED') {
    return {
      ok: false,
      status: 400,
      error: 'Cannot transition backward out of DISBURSED stage.'
    };
  }

  if (targetStage === 'APPLICATION_SUBMITTED' && !APPLICATION_STAGE_SET.has(currentStage) && !PRE_SANCTION_STAGES.has(currentStage)) {
    return {
      ok: false,
      status: 400,
      error: `Invalid transition from ${currentStage} to ${targetStage}.`
    };
  }

  return { ok: true };
}

export function sanitizeLeadPayloadForClient(lead: any, session: CrmSession): any {
  if (!lead) return lead;
  const obj = typeof lead.toObject === 'function' ? lead.toObject() : { ...lead };
  if (session.role === 'ADMIN') return obj;
  if (obj.revenue) {
    obj.revenue = {
      paymentStatus: obj.revenue.paymentStatus || 'RESTRICTED',
      restricted: true
    };
  }
  if ('revenueTracking' in obj) {
    delete obj.revenueTracking;
  }
  return obj;
}
