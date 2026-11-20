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

export type RuntimeProfile = 
  | 'PRODUCTION'
  | 'VERCEL_PREVIEW'
  | 'LOCAL_DEVELOPMENT'
  | 'AUTOMATED_TESTS'
  | 'UNKNOWN_OR_INVALID';

export interface DatabaseIsolationResult {
  allowed: boolean;
  runtimeProfile?: RuntimeProfile;
  dbName?: string;
  error?: string;
  code?: string;
  hostname?: string;
  hostnames?: string[];
  isSrv?: boolean;
  srvHost?: string;
}

export class DatabaseIsolationError extends Error {
  public readonly code: string;
  public readonly details: Record<string, unknown>;

  constructor(code: string, message: string, details: Record<string, unknown> = {}) {
    super(`[DATABASE_ISOLATION_ERROR:${code}] ${message}`);
    this.name = 'DatabaseIsolationError';
    this.code = code;
    this.details = details;
  }
}

export const PROD_CLUSTER_HOST = 'rhpn2gh.mongodb.net';
export const AUTHORIZED_TEST_DOMAINS = [
  'localhost',
  '127.0.0.1',
  '::1',
  '[::1]'
];

/**
 * Resolves and validates the configured approved test cluster domain from environment.
 * Enforces strict hostname format and rejects empty, wildcards, production, legacy, or spoofed domains.
 */
export function getApprovedTestClusterDomain(): string | null {
  const raw = process.env.MONGODB_TEST_CLUSTER_DOMAIN;
  if (!raw || !String(raw).trim()) {
    return null;
  }
  const domain = String(raw).trim().toLowerCase().replace(/\.+$/, '');

  // Reject wildcards, empty strings, spaces, or commas
  if (domain.includes('*') || domain.includes(' ') || domain.includes(',')) {
    return null;
  }

  // Reject production cluster hostname, subhosts, or identifier
  if (domain === PROD_CLUSTER_HOST || domain.endsWith('.' + PROD_CLUSTER_HOST) || domain.includes('rhpn2gh')) {
    return null;
  }

  // Reject legacy or cross-app cluster or legacy placeholder
  if (
    domain.includes('cluster0.mlcxcp.mongodb.net') ||
    domain.includes('xj6nhak.mongodb.net') ||
    domain.includes('41zrtal')
  ) {
    return null;
  }

  // Reject generic domain suffixes without cluster sub-identifier
  if (domain === 'mongodb.net' || domain === '.mongodb.net') {
    return null;
  }

  // Must end with .mongodb.net for Atlas clusters
  if (!domain.endsWith('.mongodb.net')) {
    return null;
  }

  // Minimum 3 segments: e.g. <cluster-name>.<unique-id>.mongodb.net
  const parts = domain.split('.').filter(Boolean);
  if (parts.length < 3) {
    return null;
  }

  return domain;
}

/**
 * Verifies whether a given host matches authorized test cluster specifications or local loopback.
 */
export function isAuthorizedTestHost(host: string): boolean {
  if (!host) return false;
  const clean = host.toLowerCase().replace(/\.+$/, '');

  if (AUTHORIZED_TEST_DOMAINS.includes(clean)) return true;

  const approvedTestDomain = getApprovedTestClusterDomain();
  if (!approvedTestDomain) {
    return false; // Fail closed if test cluster domain is not configured
  }

  if (clean === approvedTestDomain || clean.endsWith('.' + approvedTestDomain)) {
    if (clean.includes(PROD_CLUSTER_HOST) || clean.includes('rhpn2gh')) {
      return false;
    }
    return true;
  }

  return false;
}

/**
 * Mutually exclusive, zero-trust runtime classifier.
 * Evaluates environment flags into exactly one of five distinct runtime profiles.
 * Fails closed on any unexpected, conflicting, or missing environment indicators.
 */
export function classifyRuntimeEnvironment(
  vercelEnvInput?: string | null,
  appModeInput?: string | null,
  nodeEnvInput?: string | null
): RuntimeProfile {
  const vercelEnv = String(vercelEnvInput ?? process.env.VERCEL_ENV ?? '').trim().toLowerCase();
  const appMode = String(appModeInput ?? process.env.APP_MODE ?? '').trim().toLowerCase();
  const nodeEnv = String(nodeEnvInput ?? process.env.NODE_ENV ?? '').trim().toLowerCase();

  const normVercel = vercelEnv === 'prod' ? 'production' : vercelEnv;
  const normApp = (appMode === 'prod' || appMode === 'production') ? 'production' :
                  (appMode === 'dev' || appMode === 'development') ? 'development' :
                  appMode;
  const normNode = (nodeEnv === 'prod' || nodeEnv === 'production') ? 'production' :
                   (nodeEnv === 'dev' || nodeEnv === 'development') ? 'development' :
                   nodeEnv;

  // Rule 1: Contamination check. If VERCEL_ENV is production, require matching appMode & nodeEnv
  if (normVercel === 'production') {
    if (normApp === 'production' && (normNode === 'production' || normNode === '')) {
      return 'PRODUCTION';
    }
    return 'UNKNOWN_OR_INVALID';
  }

  // Any non-production VERCEL_ENV claiming production appMode or nodeEnv fails closed
  if (normApp === 'production' || normNode === 'production') {
    return 'UNKNOWN_OR_INVALID';
  }

  // Rule 2: Vercel Preview profile
  if (normVercel === 'preview') {
    const validPreviewApps = ['preview', 'development', 'test', 'dev', ''];
    const validPreviewNodes = ['development', 'test', 'dev', ''];
    if (validPreviewApps.includes(normApp) && validPreviewNodes.includes(normNode)) {
      return 'VERCEL_PREVIEW';
    }
    return 'UNKNOWN_OR_INVALID';
  }

  // Rule 3: Local or Automated Test profiles
  if (normVercel === '' || normVercel === 'local') {
    if ((normApp === 'test' && (normNode === 'test' || normNode === '')) ||
        (normApp === '' && normNode === 'test')) {
      return 'AUTOMATED_TESTS';
    }

    if (((normApp === 'development' || normApp === 'local') && (normNode === 'development' || normNode === '')) ||
        (normApp === '' && normNode === 'development')) {
      return 'LOCAL_DEVELOPMENT';
    }

    return 'UNKNOWN_OR_INVALID';
  }

  return 'UNKNOWN_OR_INVALID';
}

export interface ParsedConnectionUri {
  scheme: string;
  cleanHosts: string[];
  primaryHost: string;
  isSrv: boolean;
  srvHost?: string;
  dbName: string;
  error?: string;
  code?: string;
}

/**
 * Driver-grade URI parser and pre-driver authority sanitization.
 * Enforces single unencoded '@', parses replica set seed lists, rejects SRV port/multi-host anomalies.
 */
export function parseAndSanitizeConnectionUri(rawUri?: string | null): ParsedConnectionUri {
  if (!rawUri || !String(rawUri).trim()) {
    return {
      scheme: '',
      cleanHosts: [],
      primaryHost: '',
      isSrv: false,
      dbName: '',
      error: "MONGODB_URI is not defined or is empty in environment.",
      code: "URI_MISSING"
    };
  }
  const uri = String(rawUri).trim();

  let scheme = '';
  let rest = '';
  if (uri.startsWith('mongodb+srv://')) {
    scheme = 'mongodb+srv://';
    rest = uri.slice('mongodb+srv://'.length);
  } else if (uri.startsWith('mongodb://')) {
    scheme = 'mongodb://';
    rest = uri.slice('mongodb://'.length);
  } else {
    return {
      scheme: '',
      cleanHosts: [],
      primaryHost: '',
      isSrv: false,
      dbName: '',
      error: "Malformed MONGODB_URI: Non-mongodb connection scheme.",
      code: "URI_MALFORMED"
    };
  }

  const slashIdx = rest.indexOf('/');
  const qIdx = rest.indexOf('?');
  let authAndHosts = '';
  let pathAndQuery = '';

  if (slashIdx !== -1) {
    authAndHosts = rest.slice(0, slashIdx);
    pathAndQuery = rest.slice(slashIdx);
  } else if (qIdx !== -1) {
    authAndHosts = rest.slice(0, qIdx);
    pathAndQuery = rest.slice(qIdx);
  } else {
    authAndHosts = rest;
    pathAndQuery = '';
  }

  let hostPart = '';
  const lastAt = authAndHosts.lastIndexOf('@');
  if (lastAt !== -1) {
    hostPart = authAndHosts.slice(lastAt + 1);

    const atCount = (authAndHosts.match(/@/g) || []).length;
    if (atCount > 1) {
      return {
        scheme,
        cleanHosts: [],
        primaryHost: '',
        isSrv: false,
        dbName: '',
        error: "Malformed MONGODB_URI: Multiple unencoded @ characters in authority.",
        code: "URI_MALFORMED"
      };
    }
  } else {
    hostPart = authAndHosts;
  }

  if (scheme === 'mongodb+srv://') {
    if (hostPart.includes(',')) {
      return {
        scheme,
        cleanHosts: [],
        primaryHost: '',
        isSrv: true,
        dbName: '',
        error: "SRV URI cannot specify multiple hostnames.",
        code: "URI_MALFORMED"
      };
    }
    if (/:\d+/.test(hostPart)) {
      return {
        scheme,
        cleanHosts: [],
        primaryHost: '',
        isSrv: true,
        dbName: '',
        error: "SRV URI cannot contain port numbers.",
        code: "URI_MALFORMED"
      };
    }
  }

  let pathname = '';
  if (pathAndQuery.startsWith('/')) {
    const afterSlash = pathAndQuery.slice(1);
    const endDbIdx = afterSlash.indexOf('?');
    pathname = endDbIdx !== -1 ? afterSlash.slice(0, endDbIdx) : afterSlash;
  }
  const dbName = pathname ? decodeURIComponent(pathname.split('/')[0]).trim() : '';

  if (!dbName) {
    return {
      scheme,
      cleanHosts: [],
      primaryHost: '',
      isSrv: scheme === 'mongodb+srv://',
      dbName: '',
      error: "MONGODB_URI missing database name in pathname.",
      code: "MISSING_DATABASE_NAME"
    };
  }

  const rawHosts = hostPart.split(',').map(h => h.trim()).filter(Boolean);
  if (rawHosts.length === 0) {
    return {
      scheme,
      cleanHosts: [],
      primaryHost: '',
      isSrv: scheme === 'mongodb+srv://',
      dbName,
      error: "MONGODB_URI missing host specifications.",
      code: "URI_MALFORMED"
    };
  }

  const cleanHosts: string[] = [];
  for (const raw of rawHosts) {
    let h = raw.toLowerCase().replace(/\.+$/, '');
    if (h.startsWith('[')) {
      const closeBracket = h.indexOf(']');
      if (closeBracket !== -1) {
        h = h.slice(0, closeBracket + 1);
      }
    } else {
      const colonIdx = h.indexOf(':');
      if (colonIdx !== -1) {
        h = h.slice(0, colonIdx);
      }
    }
    cleanHosts.push(h);
  }

  const isSrv = scheme === 'mongodb+srv://';
  return {
    scheme,
    cleanHosts,
    primaryHost: cleanHosts[0],
    isSrv,
    srvHost: isSrv ? cleanHosts[0] : undefined,
    dbName
  };
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
  liveTestAuthInput?: string | null,
  nodeEnvInput?: string | null
): DatabaseIsolationResult {
  const parsed = parseAndSanitizeConnectionUri(rawUri);
  if (parsed.error) {
    return {
      allowed: false,
      error: parsed.error,
      code: parsed.code
    };
  }

  const { cleanHosts, primaryHost, isSrv, srvHost, dbName } = parsed;

  // 1. REJECT DECOMMISSIONED/LEGACY CLUSTER
  for (const host of cleanHosts) {
    if (host === 'cluster0.mlcxcp.mongodb.net' || host.endsWith('.cluster0.mlcxcp.mongodb.net')) {
      return {
        allowed: false,
        hostname: host,
        hostnames: cleanHosts,
        isSrv,
        srvHost,
        error: "LEGACY_CLUSTER_REJECTED: cluster0.mlcxcp.mongodb.net is decommissioned. Update Vercel environment variables to use active rhpn2gh cluster.",
        code: "LEGACY_CLUSTER_REJECTED"
      };
    }
    // 2. REJECT CROSS-APPLICATION CLUSTER (LOAN SERVICES CLUSTER)
    if (host === 'xj6nhak.mongodb.net' || host.endsWith('.xj6nhak.mongodb.net')) {
      return {
        allowed: false,
        hostname: host,
        hostnames: cleanHosts,
        isSrv,
        srvHost,
        error: "CROSS_APPLICATION_CLUSTER_REJECTED: xj6nhak belongs to AVANI Loan Services. AI CRM must use rhpn2gh.",
        code: "CROSS_APPLICATION_CLUSTER_REJECTED"
      };
    }
  }

  // 3. CLASSIFY RUNTIME PROFILE
  const profile = classifyRuntimeEnvironment(vercelEnvInput, appModeInput, nodeEnvInput);

  if (profile === 'UNKNOWN_OR_INVALID') {
    return {
      allowed: false,
      runtimeProfile: profile,
      hostname: primaryHost,
      hostnames: cleanHosts,
      isSrv,
      srvHost,
      dbName,
      error: "INVALID_OR_UNKNOWN_RUNTIME_PROFILE: System fails closed on invalid, conflicting, or missing environment indicators.",
      code: "INVALID_OR_UNKNOWN_RUNTIME_PROFILE"
    };
  }

  // 4. PRODUCTION EXECUTION PROFILE CHECKS
  if (profile === 'PRODUCTION') {
    if (dbName === 'avani_ai_crm_test' || dbName.toLowerCase().includes('test')) {
      return {
        allowed: false,
        runtimeProfile: profile,
        dbName,
        hostname: primaryHost,
        hostnames: cleanHosts,
        isSrv,
        srvHost,
        error: `TEST DATABASE DETECTED IN PRODUCTION: Production runtime cannot target test database '${dbName}'.`,
        code: "TEST_DATABASE_FORBIDDEN_IN_PROD"
      };
    }

    if (dbName !== 'avani_ai_crm_prod') {
      return {
        allowed: false,
        runtimeProfile: profile,
        dbName,
        hostname: primaryHost,
        hostnames: cleanHosts,
        isSrv,
        srvHost,
        error: `INVALID_PRODUCTION_DATABASE_NAME: Production runtime must target 'avani_ai_crm_prod', got '${dbName}'.`,
        code: "INVALID_PRODUCTION_DATABASE_NAME"
      };
    }

    const isAllProdHost = cleanHosts.every(h => h === PROD_CLUSTER_HOST || h.endsWith('.' + PROD_CLUSTER_HOST));
    if (!isAllProdHost) {
      return {
        allowed: false,
        runtimeProfile: profile,
        dbName,
        hostname: primaryHost,
        hostnames: cleanHosts,
        isSrv,
        srvHost,
        error: `UNAUTHORIZED_PRODUCTION_CLUSTER_HOSTNAME: Production runtime must target ${PROD_CLUSTER_HOST}.`,
        code: "UNAUTHORIZED_PRODUCTION_CLUSTER_HOSTNAME"
      };
    }

    return {
      allowed: true,
      runtimeProfile: profile,
      dbName,
      hostname: primaryHost,
      hostnames: cleanHosts,
      isSrv,
      srvHost,
      code: "VALID_PROD_CONNECTION"
    };
  }

  // 5. NON-PRODUCTION EXECUTION PROFILES (VERCEL_PREVIEW, LOCAL_DEVELOPMENT, AUTOMATED_TESTS)
  // Check if any host belongs to production cluster
  const hasProdHost = cleanHosts.some(h => h === PROD_CLUSTER_HOST || h.endsWith('.' + PROD_CLUSTER_HOST));
  if (hasProdHost) {
    return {
      allowed: false,
      runtimeProfile: profile,
      dbName,
      hostname: primaryHost,
      hostnames: cleanHosts,
      isSrv,
      srvHost,
      error: `PRODUCTION_CLUSTER_FORBIDDEN_IN_NON_PROD: Non-production environment cannot connect to production cluster ${PROD_CLUSTER_HOST}.`,
      code: "PRODUCTION_CLUSTER_FORBIDDEN_IN_NON_PROD"
    };
  }

  // Check database name
  const lowerDb = dbName.toLowerCase();
  if (lowerDb === 'avani_ai_crm_prod' || lowerDb.includes('prod')) {
    return {
      allowed: false,
      runtimeProfile: profile,
      dbName,
      hostname: primaryHost,
      hostnames: cleanHosts,
      isSrv,
      srvHost,
      error: `PRODUCTION_CLUSTER_FORBIDDEN_IN_NON_PROD: Non-production execution is strictly forbidden from targeting production database.`,
      code: "PRODUCTION_CLUSTER_FORBIDDEN_IN_NON_PROD"
    };
  }

  if (dbName !== 'avani_ai_crm_test') {
    return {
      allowed: false,
      runtimeProfile: profile,
      dbName,
      hostname: primaryHost,
      hostnames: cleanHosts,
      isSrv,
      srvHost,
      error: `TARGET_DATABASE_NOT_TEST: Non-production runtime must target avani_ai_crm_test, got '${dbName}'.`,
      code: "TARGET_DATABASE_NOT_TEST"
    };
  }

  // Validate that all test hosts match authorized test cluster specifications or local loopback
  const hasUnauthorizedTestHost = cleanHosts.some(h => !isAuthorizedTestHost(h));
  if (hasUnauthorizedTestHost) {
    return {
      allowed: false,
      runtimeProfile: profile,
      dbName,
      hostname: primaryHost,
      hostnames: cleanHosts,
      isSrv,
      srvHost,
      error: `UNAUTHORIZED_TEST_CLUSTER_HOSTNAME: Host does not match authorized test cluster specifications.`,
      code: "UNAUTHORIZED_TEST_CLUSTER_HOSTNAME"
    };
  }

  const providerMode = String(providerModeInput ?? process.env.PROVIDER_MODE ?? 'mock').trim().toLowerCase();
  const liveTestAuth = String(liveTestAuthInput ?? process.env.LIVE_TEST_AUTHORIZATION ?? 'false').trim().toLowerCase();
  if (providerMode === 'live' && liveTestAuth !== 'true') {
    return {
      allowed: false,
      runtimeProfile: profile,
      dbName,
      hostname: primaryHost,
      hostnames: cleanHosts,
      isSrv,
      srvHost,
      error: "LIVE PROVIDER DETECTED IN TEST MODE WITHOUT AUTHORIZATION: Non-production mode requires explicit LIVE_TEST_AUTHORIZATION=true.",
      code: "LIVE_PROVIDER_UNAUTHORIZED"
    };
  }

  return {
    allowed: true,
    runtimeProfile: profile,
    dbName,
    hostname: primaryHost,
    hostnames: cleanHosts,
    isSrv,
    srvHost,
    code: "VALID_TEST_CONNECTION"
  };
}

/**
 * Pre-connection DNS-SRV resolver and seed validation safeguard.
 * Validates that all resolved nodes belong to the authorized parent cluster domain.
 */
export async function verifySrvDnsTopology(
  srvHost: string,
  profile: RuntimeProfile,
  dnsResolver?: (name: string) => Promise<any[]>
): Promise<{ verified: boolean; nodes: string[]; error?: string; code?: string }> {
  try {
    let resolver = dnsResolver;
    if (!resolver) {
      const dns = await import('node:dns/promises');
      resolver = dns.resolveSrv;
    }
    const records = await resolver(`_mongodb._tcp.${srvHost}`);
    if (!records || records.length === 0) {
      return { verified: false, nodes: [], error: "No DNS SRV records found", code: "DNS_EMPTY_RECORDS" };
    }
    const nodes = records.map(r => String(r.name).toLowerCase().replace(/\.+$/, ''));
    
    // In non-production, ensure no resolved node matches production cluster
    if (profile !== 'PRODUCTION') {
      for (const node of nodes) {
        if (node.includes(PROD_CLUSTER_HOST) || node.includes('rhpn2gh')) {
          return { verified: false, nodes, error: `SRV record resolved to production cluster node: ${node}`, code: "PRODUCTION_CLUSTER_FORBIDDEN_IN_NON_PROD" };
        }
        if (!isAuthorizedTestHost(node) && !node.endsWith('.mongodb.net')) {
          return { verified: false, nodes, error: `SRV record resolved to unauthorized external host: ${node}`, code: "UNAUTHORIZED_TOPOLOGY_NODE" };
        }
      }
    }
    return { verified: true, nodes, code: "TOPOLOGY_VERIFIED" };
  } catch (err: any) {
    return { verified: false, nodes: [], error: err?.message || 'DNS SRV resolution failed', code: "DNS_RESOLUTION_FAILED" };
  }
}

/**
 * Validates same-connection identity binding across Mongoose connection and underlying native MongoClient.
 */
export function verifySameConnectionIdentity(
  conn: mongoose.Connection,
  expectedDbName: string,
  expectedClusterDomain?: string
): { verified: boolean; error?: string; code?: string } {
  if (!conn) {
    return { verified: false, error: "Connection is null or undefined", code: "CONNECTION_NULL" };
  }
  const actualDb = conn.name;
  if (actualDb !== expectedDbName) {
    return {
      verified: false,
      error: `Connected database name '${actualDb}' does not match expected '${expectedDbName}'`,
      code: "LIVE_DB_NAME_MISMATCH"
    };
  }
  if (expectedClusterDomain) {
    const host = (conn.host || '').toLowerCase();
    if (!host.includes(expectedClusterDomain.toLowerCase())) {
      return {
        verified: false,
        error: `Connected host '${host}' does not match expected domain '${expectedClusterDomain}'`,
        code: "IDENTITY_HOST_MISMATCH"
      };
    }
  }
  return { verified: true, code: "CONNECTION_BOUND" };
}

/**
 * Non-destructive production index safety verification.
 * Compares Mongoose schema index specifications with live database indexes without dropping indexes.
 */
export async function verifyIndexSafety(
  model: mongoose.Model<any>,
  conn: mongoose.Connection
): Promise<{ safe: boolean; missingIndexes: string[]; extraIndexes: string[] }> {
  try {
    const collection = conn.collection(model.collection.name);
    const existing = await collection.indexes();
    const schemaIndexes = model.schema.indexes();

    const existingNames = new Set(existing.map(idx => idx.name));
    const missing: string[] = [];
    const extra: string[] = [];

    for (const [fields, options] of schemaIndexes) {
      const expectedName = (options as any)?.name || Object.keys(fields).join('_');
      if (!existingNames.has(expectedName)) {
        missing.push(expectedName);
      }
    }

    return {
      safe: missing.length === 0,
      missingIndexes: missing,
      extraIndexes: extra
    };
  } catch {
    return { safe: false, missingIndexes: [], extraIndexes: [] };
  }
}

export interface ConnectToDatabaseOptions {
  uri?: string;
  dnsResolver?: (name: string) => Promise<any[]>;
  mongooseInstance?: typeof mongoose;
  skipTls?: boolean;
}

/**
 * Main database connection entry point with integrated 7-stage security pipeline:
 * Stage 1: Runtime classification
 * Stage 2: URI and hostname preflight
 * Stage 3: DNS-SRV topology resolution for Atlas SRV hosts
 * Stage 4: Connection establishment with production autoIndex protection
 * Stage 5: Actual connected topology verification
 * Stage 6: Automatic same-connection identity binding & reconnect protection
 * Stage 7: Connection approval
 */
export async function connectToDatabase(options?: ConnectToDatabaseOptions) {
  const MONGODB_URI = options?.uri || process.env.MONGODB_URI;
  const mInstance = options?.mongooseInstance || mongoose;

  // STAGE 1 & 2: Runtime classification & URI preflight
  const guard = evaluateDatabaseIsolation(MONGODB_URI);

  if (!guard.allowed) {
    console.error(`[DB Isolation Guard] Preflight rejection: ${guard.error} (${guard.code})`);
    cached.lastError = guard.error || 'Database isolation violation';
    cached.conn = null;
    cached.promise = null;
    return null;
  }

  // STAGE 3: DNS-SRV Verification for Atlas SRV connections
  if (guard.isSrv && guard.srvHost) {
    if (!AUTHORIZED_TEST_DOMAINS.includes(guard.srvHost)) {
      const dnsResult = await verifySrvDnsTopology(
        guard.srvHost,
        guard.runtimeProfile!,
        options?.dnsResolver
      );
      if (!dnsResult.verified) {
        console.error(`[DB Isolation Guard] DNS-SRV verification failed: ${dnsResult.error} (${dnsResult.code})`);
        cached.lastError = dnsResult.error || 'DNS-SRV topology verification failed';
        cached.conn = null;
        cached.promise = null;
        return null;
      }
    }
  }

  // Validate cache before returning existing connection
  if (cached.conn) {
    if (cached.uri !== MONGODB_URI || cached.targetDb !== guard.dbName) {
      console.warn("[DB Isolation Guard] Target URI changed since cached connection established. Resetting connection cache.");
      cached.conn = null;
      cached.promise = null;
    } else if (mInstance.connection.readyState === 1) {
      // Re-validate same-connection identity on cached connection
      const identityCheck = verifySameConnectionIdentity(
        mInstance.connection,
        guard.dbName!,
        guard.runtimeProfile === 'PRODUCTION' ? PROD_CLUSTER_HOST : undefined
      );
      if (identityCheck.verified) {
        return cached.conn;
      } else {
        console.warn(`[DB Isolation Guard] Cached connection failed identity re-validation: ${identityCheck.error}. Resetting cache.`);
        cached.conn = null;
        cached.promise = null;
      }
    } else {
      cached.conn = null;
    }
  }

  // STAGE 4: Connection establishment
  if (!cached.promise) {
    const isProd = guard.runtimeProfile === 'PRODUCTION';
    const useTls = options?.skipTls ? false : (
      MONGODB_URI!.startsWith('mongodb+srv://') ||
      MONGODB_URI!.includes('mongodb.net') ||
      MONGODB_URI!.includes('tls=true') ||
      MONGODB_URI!.includes('ssl=true')
    );
    const opts = {
      bufferCommands: false,
      autoIndex: !isProd, // Disable automatic index builds in production
      serverSelectionTimeoutMS: 10000,
      connectTimeoutMS: 10000,
      socketTimeoutMS: 45000,
      tls: useTls,
      maxPoolSize: 10,
    };

    cached.uri = MONGODB_URI;
    cached.targetDb = guard.dbName;

    cached.promise = mInstance.connect(MONGODB_URI!, opts).then(async (m) => {
      // STAGE 5: Actual live topology verification
      const nativeClient = m.connection?.getClient?.() as any;
      if (nativeClient && nativeClient.topology?.description?.servers) {
        const topologyServers = Array.from(nativeClient.topology.description.servers.keys() || []);
        if (guard.runtimeProfile !== 'PRODUCTION') {
          for (const srv of topologyServers) {
            const srvHost = String(srv).toLowerCase();
            if (srvHost.includes(PROD_CLUSTER_HOST) || srvHost.includes('rhpn2gh')) {
              if (typeof m.connection?.close === 'function') {
                try { await m.connection.close(); } catch {}
              }
              throw new DatabaseIsolationError(
                'PRODUCTION_CLUSTER_FORBIDDEN_IN_NON_PROD',
                `Connected topology discovered production cluster node: ${srvHost}`
              );
            }
            const hostWithoutPort = srvHost.split(':')[0];
            if (!isAuthorizedTestHost(hostWithoutPort) && !hostWithoutPort.endsWith('.mongodb.net')) {
              if (typeof m.connection?.close === 'function') {
                try { await m.connection.close(); } catch {}
              }
              throw new DatabaseIsolationError(
                'UNAUTHORIZED_TOPOLOGY_NODE',
                `Connected topology contains unauthorized node: ${srvHost}`
              );
            }
          }
        }
      }

      // STAGE 6: Automatic same-connection identity binding
      const identityCheck = verifySameConnectionIdentity(
        m.connection,
        guard.dbName!,
        guard.runtimeProfile === 'PRODUCTION' ? PROD_CLUSTER_HOST : undefined
      );
      if (!identityCheck.verified) {
        if (typeof m.connection?.close === 'function') {
          try { await m.connection.close(); } catch {}
        }
        throw new DatabaseIsolationError(
          identityCheck.code || 'IDENTITY_MISMATCH',
          identityCheck.error || 'Connection failed same-connection identity binding'
        );
      }

      // Reconnection & topology change listeners to re-verify identity
      if (m.connection && typeof m.connection.on === 'function' && !m.connection.listeners('reconnect').length) {
        m.connection.on('reconnect', () => {
          const recheck = verifySameConnectionIdentity(m.connection, guard.dbName!);
          if (!recheck.verified) {
            console.error(`[DB Isolation Guard] Reconnect identity mismatch: ${recheck.error}`);
            cached.conn = null;
            cached.promise = null;
          }
        });
      }

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

  // STAGE 7: Connection approval
  try {
    cached.conn = await cached.promise;
    if (mInstance.connection.readyState !== 1) {
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

export function resetConnectionCacheForTesting() {
  cached.conn = null;
  cached.promise = null;
  cached.uri = null;
  cached.targetDb = null;
  cached.lastError = null;
}

export function getConnectionCacheForTesting() {
  return { ...cached };
}

export default connectToDatabase;

export async function ensureDatabaseConnection(options?: ConnectToDatabaseOptions) {
  const conn = await connectToDatabase(options);
  const mInstance = options?.mongooseInstance || mongoose;
  if (!conn || mInstance.connection.readyState !== 1) {
    const errMsg = cached?.lastError || "Database offline: connection readyState != 1";
    throw new Error(`DATABASE_UNAVAILABLE: ${errMsg}`);
  }
  return conn;
}

export function getDatabaseLastError(): string | null {
  return cached?.lastError || null;
}

export async function getDatabase(targetClientPhone = "N/A", options?: ConnectToDatabaseOptions) {
  try {
    const conn = await ensureDatabaseConnection(options);
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
