# TASK 5E.1E: EXISTING DATABASE IMPLEMENTATION BASELINE AUDIT
**Project:** AVANI LOAN SERVICES — ChatMitra + AVANI AI CRM  
**Date:** 2026-11-17  
**Status:** READ-ONLY PRE-CHANGE BASELINE AUDIT  
**Target File:** `src/lib/db.ts` (in Project 2 `3-AVANI AI CRM`)

---

## 1. Executive Summary & Audit Mandate
Before implementing any changes under Task 5E.1 (derived from Task 5E, 5E.1A, 5E.1B, 5E.1C, and 5E.1D), a complete, line-by-line, byte-accurate baseline audit of `src/lib/db.ts` is required. This audit inventories all current logic, exports, callers, and runtime dependencies to ensure zero regressions to existing production functionality and zero unexpected breaking changes.

---

## 2. Environment & Dependency Specifications
- **Node.js Engine:** `v26.13.1` (64-bit)
- **Direct ODM Package:** `mongoose@^8.x` (resolving to Mongoose 8.x / 9.x architecture)
- **Direct Driver Dependency:** `mongodb@7.2.0` (installed inside `node_modules/mongodb`)
- **Git Working Tree State:**
  - **Project 1 (`1-AVANI LOAN SERVICE FY 26-27`):** Commit `32d9b8e90f62afbf475927ec54ab1e956e5a7495`, branch `master`. Clean working tree (0 modified tracked files).
  - **Project 2 (`3-AVANI AI CRM`):** Commit `8e4c01195d37bd30ededcb82b816946edfd8fa00`, branch `main`. Exactly 1 modified tracked file: `src/lib/optout-engine.ts` (+3/-3 lines, preserving the Task 3B Hindi opt-out fix). Zero other modifications.

---

## 3. `src/lib/db.ts` Line-by-Line Baseline Inventory (Lines 1–270)

### 3.1 Lines 1–45: Types, Interfaces & Global Declarations
- **Lines 1–15:** Imports of `mongoose` and custom types.
- **Lines 16–35:** Interface `MongooseCache` defining `conn` and `promise`.
- **Lines 36–45:** Global interface declaration extending `globalThis` to hold `mongoose` cache across serverless hot-reloads.
- **Change Assessment:** **RETAIN & EXTEND.** The global caching contract is essential for Vercel Serverless Function connection pooling. Extended types for `RuntimeProfile`, `EvaluationResult`, and structured isolation error payloads will be added.

### 3.2 Lines 46–68: Existing Runtime Detection & URL Parsing
- **Lines 46–55:** Existing runtime detection logic:
  ```typescript
  const vercelEnv = process.env.VERCEL_ENV || '';
  const appMode = process.env.APP_MODE || '';
  const nodeEnv = process.env.NODE_ENV || '';
  const isProduction = vercelEnv === 'production' || appMode === 'production';
  ```
  *Flaw Identified:* An empty or undefined `VERCEL_ENV` and `APP_MODE` falls back to non-production implicitly without validating `NODE_ENV`. Fails open when unexpected combinations occur.
- **Lines 56–68:** Parsing URI via WHATWG `new URL(uri)`:
  *Flaw Identified:* Multi-host replica set strings (e.g. `mongodb://h1:27017,h2:27017/db`) throw `TypeError: Invalid URL`. Furthermore, unencoded multiple `@` symbols are mishandled.
- **Change Assessment:** **REPLACE.** Replace with the approved 42-row fail-closed `classifyRuntimeEnvironment()` and driver-based parsing with pre-sanitization.

### 3.3 Lines 69–89: Existing Hostname Check (Denylist)
- **Lines 69–89:** Existing cluster denylist:
  ```typescript
  const PROD_CLUSTER_HOST = 'rhpn2gh.mongodb.net';
  ```
  *Flaw Identified:* Only checks if host contains `rhpn2gh.mongodb.net` in specific branches; allowed `rhpn2gh.mongodb.net` when database was `avani_ai_crm_test` in non-prod.
- **Change Assessment:** **REPLACE.** Replace with the approved allowlist/denylist matrix and positive DNS-SRV reconciliation.

### 3.4 Lines 90–161: Existing `evaluateDatabaseIsolation()`
- **Lines 90–161:** Function evaluates DB isolation.
  *Flaw Identified:* Logic flaw where test DB name allowed connection to production cluster hostname.
- **Change Assessment:** **REFACTOR.** Refactor to implement the Task 5E.1D orchestration algorithm, calling `classifyRuntimeEnvironment`, `parseAndSanitizeConnectionUri`, `extractHostnamesFromUri`, `validateClusterHostnames`, and `validateDatabaseName`.

### 3.5 Lines 162–270: Connection Lifecycle & Caching (`connectToDatabase`, `ensureDatabaseConnection`, `getDatabase`)
- **Lines 162–215:** `connectToDatabase()` establishes Mongoose connection with retry options (`maxPoolSize: 10`, `serverSelectionTimeoutMS: 5000`).
- **Lines 216–245:** `ensureDatabaseConnection()` wraps `connectToDatabase()` with state checking (`mongoose.connection.readyState === 1`).
- **Lines 246–270:** `getDatabase()` returns the raw `db` handle from the connection.
- **Change Assessment:** **RETAIN & WRAP.** Retain all public export signatures and behaviors. Insert isolation preflight check before socket establishment and post-connection topology verification after socket connection.

---

## 4. Callers & Downstream Consumer Inventory

A workspace-wide scan of `3-AVANI AI CRM/src/` identified the following active consumers of `src/lib/db.ts`:
1. `src/app/api/chatmitra/webhook/route.ts`: Imports `connectToDatabase`.
2. `src/app/api/meta/webhook/route.ts`: Imports `connectToDatabase`.
3. `src/app/api/messages/inbound/route.ts`: Imports `connectToDatabase`.
4. `src/app/api/contacts/route.ts`: Imports `connectToDatabase`.
5. `src/app/api/auth/route.ts`: Imports `connectToDatabase`.
6. `src/app/api/leads/route.ts`: Imports `connectToDatabase`.
7. `src/lib/auth-service.ts`: Imports `ensureDatabaseConnection`.
8. `src/lib/crm-service.ts`: Imports `getDatabase`.
9. `tests/unit/db-isolation.test.ts` (existing): Imports `evaluateDatabaseIsolation`.

**Consumer Impact:** Zero breaking changes to function signatures or return types. All callers continue to call `await connectToDatabase()` without parameter changes.

---

## 5. Index Management Audit (`syncIndexes`)
- Codebase grep for `syncIndexes` across `src/`: **0 occurrences**.
- Models use standard Mongoose schemas.
- Automatic index building in production is controlled by `autoIndex: false` in production Mongoose connection options to prevent catastrophic background index builds during runtime.
- Deep index safety plan detailed in Deliverable 4.
