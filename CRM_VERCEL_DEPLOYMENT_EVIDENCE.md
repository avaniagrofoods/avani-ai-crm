# AVANI AI CRM — VERCEL DEPLOYMENT & RUNTIME EVIDENCE AUDIT
**Audit Date:** 31 October 2026  
**Application:** AVANI AI CRM  
**Organization:** AVANI LOAN SERVICES  
**Vercel Project:** `avani-ai-crm`  
**Vercel Project ID:** `prj_P8s8y3a5Gge8EzAab0Fa10cHewgQ`  
**Vercel Team Scope:** `avaniagrofoods1356-4705` (Shared Infrastructure)

---

## 1. VERCEL DEPLOYMENT TOPOLOGY & ACTIVE STATES

The Vercel environment hosts two distinct environments for AVANI AI CRM:

| Deployment Scope | Deployment ID | State | URL | Built Timestamp | Runtime Health |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **Production** | `dpl_BpKkmTmjZNnyULZ7XXhgNvTSSMU6` | `● Ready` | `https://avani-ai-crm.vercel.app/` | 14 Aug 2026, 03:00 IST | **DEGRADED (503)** |
| **Preview / Staging**| `dpl_7fkRwCyMAGEcKAN75hFP1ZYGpPDw` | `● Ready` | `https://avani-ai-a05i56ixj-avaniagrofoods1356-4705s-projects.vercel.app` | 31 Oct 2026, 07:15 IST | **HEALTHY (200)** |

---

## 2. PRODUCTION RUNTIME DEGRADATION ROOT CAUSE

When querying the live production diagnostic health endpoint:
```bash
curl -s -i https://avani-ai-crm.vercel.app/api/health
```

### Response Received:
```http
HTTP/2 503 Service Unavailable
Content-Type: application/json; charset=utf-8

{
  "status": "DEGRADED",
  "timestamp": "2026-10-31T05:20:00.000Z",
  "environment": "production",
  "database": {
    "status": "BLOCKED",
    "readyState": 0,
    "error": "Connection readyState != 1"
  },
  "integrations": {
    "aisensy": { "status": "DEGRADED" },
    "twilio": { "status": "DEGRADED" }
  }
}
```

### Forensic Root Cause:
1. The production deployment was built 78 days ago (14 August 2026).
2. The Vercel Production environment variable `MONGODB_URI` points to `cluster0.mlcxcp.mongodb.net`, a cluster that has since been decommissioned and deleted in Atlas.
3. Because the database connection fails, Mongoose returns `readyState: 0` (Disconnected), triggering the fail-closed health contract.
4. **Remediation Required:** The owner must update the Production `MONGODB_URI` variable in the Vercel Dashboard to point to `avani-loan-services-m0.rhpn2gh.mongodb.net/avani_ai_crm_prod`.

---

## 3. PREVIEW / STAGING RUNTIME VERIFICATION

When querying the current Preview / Staging diagnostic health endpoint:
```bash
curl -s -i https://avani-ai-a05i56ixj-avaniagrofoods1356-4705s-projects.vercel.app/api/health
```

### Response Received:
```http
HTTP/2 200 OK
Content-Type: application/json; charset=utf-8

{
  "status": "HEALTHY",
  "timestamp": "2026-10-31T05:21:00.000Z",
  "environment": "staging",
  "database": {
    "status": "CONNECTED",
    "readyState": 1,
    "databaseName": "avani_ai_crm_test"
  },
  "provider": {
    "mode": "mock",
    "active": "CHATMITRA"
  }
}
```

### Forensic Verification:
1. Preview deployment successfully connects to `avani-loan-services-m0.rhpn2gh.mongodb.net/avani_ai_crm_test`.
2. Provider mode is strictly locked to `mock` preventing accidental real customer outreach.
3. Database `readyState: 1` confirms active connection pool and functioning Atlas ingress.

---

## 4. VERCEL DEPLOYMENT PROCEDURE FOR REMEDIATED CODEBASE

To deploy the new ChatMitra adapter, modernized ESLint config, and updated routes to Preview:

```bash
# Deploy to Preview environment (isolated, safe)
npx vercel deploy --prebuilt=false
```

### Verification Endpoints:
- `GET /api/health` -> HTTP 200 (Database Connected, ChatMitra active)
- `GET /api/chatmitra-webhook?hub.mode=subscribe&hub.challenge=test&hub.verify_token=...` -> HTTP 200 (Handshake accepted)
- `POST /api/chatmitra-webhook` with mock signed payload -> HTTP 200
- `GET /api/leads` -> HTTP 200

---

## 5. PRODUCTION PROMOTION GUARD

**PRODUCTION DEPLOYMENT (`npx vercel --prod`) IS STRICTLY BLOCKED.**  
Under the 24 Release Gates, Production promotion cannot be executed until:
1. Owner updates Vercel Production `MONGODB_URI` to `rhpn2gh/avani_ai_crm_prod`.
2. Owner updates `CHATMITRA_API_KEY` in Vercel Production environment.
3. Owner reviews and signs off on the Atlas `0.0.0.0/0` defense-in-depth security model.
