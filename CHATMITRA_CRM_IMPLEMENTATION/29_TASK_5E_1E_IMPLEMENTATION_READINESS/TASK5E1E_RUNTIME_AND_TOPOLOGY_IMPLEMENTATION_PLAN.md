# TASK 5E.1E: RUNTIME AND TOPOLOGY IMPLEMENTATION PLAN
**Project:** AVANI LOAN SERVICES — ChatMitra + AVANI AI CRM  
**Date:** 2026-11-17  
**Status:** APPROVED IMPLEMENTATION ALGORITHM  
**Components:** Runtime Classifier, DNS-SRV Resolver, Topology Validator

---

## 1. Runtime Classification Algorithm (`classifyRuntimeEnvironment`)

### 1.1 Decision Precedence Rules
The function inspects environment variables in strict order without fuzzy matching:
1. **Rule 1 (Missing / Empty / Conflicting):** If any required variable is invalid, or if an undefined combination is encountered, return `UNKNOWN_OR_INVALID`.
2. **Rule 2 (Production Precedence):**
   - `VERCEL_ENV === 'production'` AND `APP_MODE === 'production'` AND `NODE_ENV === 'production'` $\rightarrow$ `PRODUCTION`.
   - Any other combination with `production` that doesn't match the exact approved rows $\rightarrow$ `UNKNOWN_OR_INVALID`.
3. **Rule 3 (Vercel Preview):**
   - `VERCEL_ENV === 'preview'` AND `APP_MODE === 'preview'` AND `NODE_ENV === 'production'` $\rightarrow$ `VERCEL_PREVIEW`.
4. **Rule 4 (Local Development):**
   - `VERCEL_ENV === ''` AND `APP_MODE === 'development'` AND `NODE_ENV === 'development'` $\rightarrow$ `LOCAL_DEVELOPMENT`.
5. **Rule 5 (Automated Tests):**
   - `VERCEL_ENV === ''` AND `APP_MODE === 'test'` AND `NODE_ENV === 'test'` $\rightarrow$ `AUTOMATED_TESTS`.
6. **Fallback:** All other permutations fail closed to `UNKNOWN_OR_INVALID`.

---

## 2. DNS-SRV and Topology Verification Algorithms

### 2.1 Pre-Connection DNS-SRV Resolution (`verifySrvDnsTopology`)
```typescript
import * as dns from 'node:dns/promises';

export async function verifySrvDnsTopology(
  srvHost: string, 
  profile: RuntimeProfile,
  dnsResolver: (name: string) => Promise<dns.SrvRecord[]> = dns.resolveSrv
): Promise<string[]> {
  const srvRecordName = `_mongodb._tcp.${srvHost}`;
  let records: dns.SrvRecord[];

  try {
    records = await dnsResolver(srvRecordName);
  } catch (err: any) {
    throw new DatabaseIsolationError(
      'DNS_RESOLUTION_FAILED',
      `Failed to resolve SRV records for ${srvHost}: ${err.message}`,
      { srvHost, error: err.code || err.message }
    );
  }

  if (!records || records.length === 0) {
    throw new DatabaseIsolationError(
      'DNS_EMPTY_RECORDS',
      `No SRV records returned for ${srvHost}`,
      { srvHost }
    );
  }

  // Validate all target node domains against authorized cluster parent domain
  const nodeHosts = records.map(r => r.name.toLowerCase());
  for (const node of nodeHosts) {
    if (!node.endsWith(APPROVED_TEST_PARENT_DOMAIN) && !node.endsWith(APPROVED_PROD_PARENT_DOMAIN)) {
      throw new DatabaseIsolationError(
        'DNS_ROGUE_NODE_DETECTED',
        `SRV record points to unauthorized node hostname: ${node}`,
        { node, srvHost }
      );
    }
  }

  return nodeHosts;
}
```

### 2.2 Post-Connection Live Topology Reconciliation (`verifyPostConnectionTopology`)
Once the connection is established via Mongoose/MongoClient:
1. Inspect `client.topology.description.servers`.
2. Extract all server addresses currently known to the driver pool.
3. Validate each server address against the approved cluster domain.
4. If in `AUTOMATED_TESTS` or `LOCAL_DEVELOPMENT` or `VERCEL_PREVIEW`, ensure NO server address matches or contains the production cluster identifier (`rhpn2gh`).
5. In the event of a mismatch, immediately invoke `client.close(true)` (force close) and throw `DB_ISOLATION_ERROR:TOPOLOGY_MISMATCH`.

---

## 3. Network Resilience & Error Handling
- **DNS Timeouts / Transient Errors:** In production and preview, DNS resolution is subject to a 2000ms timeout. In offline unit testing, the injected `dnsResolver` mock executes synchronously in-memory.
- **Replica Set Elections & Failover:** Because the topology check validates the parent domain (`*.mongodb.net` with cluster prefix), primary/secondary elections and node step-downs within the authorized cluster pass without issue.
