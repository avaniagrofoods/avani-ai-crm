# TASK 5E.1E: UNIT AND INTEGRATION TEST MAPPING
**Project:** AVANI LOAN SERVICES — ChatMitra + AVANI AI CRM  
**Date:** 2026-11-17  
**Status:** APPROVED TEST ARCHITECTURE & REGRESSION SUITE  
**Coverage:** 50 Scenarios from Task 5E.1D Matrix

---

## 1. Test Suite Partitioning

To maintain extreme reliability, speed, and continuous integration compatibility, the 50 regression scenarios defined in Task 5E.1D are partitioned into two strictly isolated test suites:

```
┌─────────────────────────────────────────────────────────────────┐
│               TOTAL REGRESSION MATRIX (50 SCENARIOS)             │
└────────────────────────────────┬────────────────────────────────┘
                                 │
         ┌───────────────────────┴───────────────────────┐
         ▼                                               ▼
┌─────────────────────────────────┐   ┌─────────────────────────────────┐
│     OFFLINE UNIT TESTS          │   │    LIVE INTEGRATION TESTS       │
│     Scenarios S01 – S44         │   │     Scenarios S45 – S50         │
│     (100% Mocked / In-Memory)   │   │  (Requires Isolated Test Atlas) │
├─────────────────────────────────┤   ├─────────────────────────────────┤
│ • Zero network traffic          │   │ • Live TLS 1.3 socket to Atlas  │
│ • In-memory URI parsing         │   │ • Actual DB writes / reads      │
│ • Mocked DNS-SRV resolver       │   │ • Dynamic replica set discovery │
│ • Runtime matrix verification   │   │ • Failover & reconnection test  │
│ • Execution time: < 350ms       │   │ • Execution time: ~2-5 seconds  │
│ • File: tests/unit/isolation.ts │   │ • File: tests/int/topology.ts   │
└─────────────────────────────────┘   └─────────────────────────────────┘
```

---

## 2. Offline Unit Test Suite (Scenarios S01 – S44)

### 2.1 Scenario Breakdown
- **S01–S18 (Runtime Classification):** Validates all 42 environment permutations across `PRODUCTION`, `VERCEL_PREVIEW`, `LOCAL_DEVELOPMENT`, `AUTOMATED_TESTS`, and `UNKNOWN_OR_INVALID`.
- **S19–S25 (URI Parsing & Authority Sanitization):** Tests single `@`, multiple unencoded `@` (authority smuggling), URL encoding, missing credentials, IPv4/IPv6 hosts.
- **S26–S32 (Multi-Host Replica Set Seed Lists):** Tests comma-separated seed lists, mixed port definitions, invalid syntax handling via MongoClient parser.
- **S33–S38 (Database Whitelist & Denylist):** Tests production DB name, test DB name, preview DB name, system DBs (`admin`, `config`, `local`), and malformed DB names.
- **S39–S44 (Pre-Connection DNS-SRV Resolution):** Tests mock SRV resolution returning valid test cluster nodes, rogue external nodes, empty records, and DNS timeout/network errors.

### 2.2 Mocking Strategy for Offline Tests
```typescript
// Injected mock DNS resolver for offline deterministic testing
const mockResolveSrvValid = async (host: string) => [
  { name: 'ac-v6pln7g-shard-00-00.41zrtal.mongodb.net', port: 27017, priority: 0, weight: 0 },
  { name: 'ac-v6pln7g-shard-00-01.41zrtal.mongodb.net', port: 27017, priority: 0, weight: 0 },
  { name: 'ac-v6pln7g-shard-00-02.41zrtal.mongodb.net', port: 27017, priority: 0, weight: 0 },
];

const mockResolveSrvRogue = async (host: string) => [
  { name: 'evil-host.attacker-controlled.com', port: 27017, priority: 0, weight: 0 }
];
```

---

## 3. Live Integration Test Suite (Scenarios S45 – S50)

### 3.1 Pre-Conditions & Authorization
- **Status:** **BLOCKED** until owner explicitly approves and provisions the dedicated MongoDB Atlas Test Cluster (M0 Free Tier).
- **Required Secret:** `MONGODB_TEST_URI` pointing to the isolated test cluster (`*.mongodb.net`) with database `avani_ai_crm_test`.
- **Zero Production Access:** The integration suite asserts that `process.env.MONGODB_URI` (production) is neither accessed nor present during test runs.

### 3.2 Scenario Breakdown
- **S45:** Successful live TLS handshake and authentication to test cluster.
- **S46:** Verification of live replica set topology members via `client.topology.description.servers`.
- **S47:** CRUD operation isolation (insert test lead in `avani_ai_crm_test`, verify absence from prod).
- **S48:** Intentional misconfiguration test (attempting connection with prod hostname in test environment fails closed).
- **S49:** Connection recovery after simulated socket interruption.
- **S50:** Deep index non-destructive verification on test collections.
