# TASK 5F: RUNTIME CLASSIFICATION IMPLEMENTATION
**Project:** AVANI LOAN SERVICES — ChatMitra + AVANI AI CRM  
**Date:** 2026-11-18  
**Component:** `classifyRuntimeEnvironment()` in `src/lib/db.ts`

---

## 1. Architectural Design & Zero-Trust Precedence

The runtime classification system is designed on zero-trust principles. Previous implementations fell back to `development` or non-production when environment variables were absent or incomplete. The new engine eliminates all fallback guesswork: **any undefined, conflicting, or unrecognized combination immediately fails closed to `UNKNOWN_OR_INVALID`**.

### The Five Mutually Exclusive Runtime Profiles
1. **`PRODUCTION`**: Authorized live production Vercel runtime.
2. **`VERCEL_PREVIEW`**: Authorized Vercel preview deployment runtime.
3. **`LOCAL_DEVELOPMENT`**: Authorized local developer environment.
4. **`AUTOMATED_TESTS`**: Authorized automated local/CI test environment.
5. **`UNKNOWN_OR_INVALID`**: Any other state, conflicting flags, or missing variables (fails closed).

---

## 2. Normalization & Precedence Algorithm

Before evaluation, all input flags are trimmed and converted to lowercase. The function normalizes common aliases (`prod` $\rightarrow$ `production`, `dev` $\rightarrow$ `development`).

```typescript
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

  // Rule 1: Production Contamination Guard
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
```

---

## 3. Scenario Verification Summary

- **S07 & S16 (Total Missing Flags):** When `VERCEL_ENV`, `APP_MODE`, and `NODE_ENV` are empty, returns `UNKNOWN_OR_INVALID`.
- **S08–S11 (Conflicting Production Flags):** When `VERCEL_ENV=production` but `APP_MODE` or `NODE_ENV` are `dev` or `test`, returns `UNKNOWN_OR_INVALID`.
- **S12–S13 (Preview Claiming Production):** When `VERCEL_ENV=preview` is paired with `APP_MODE=production` or `NODE_ENV=production`, returns `UNKNOWN_OR_INVALID`.
- **S21–S23 (Unrecognized Environment Values):** `staging`, `qa`, or unmapped modes fail closed to `UNKNOWN_OR_INVALID`.
- **S24–S26 (Authorized Production):** Confirmed consistent production flags return `PRODUCTION`.
