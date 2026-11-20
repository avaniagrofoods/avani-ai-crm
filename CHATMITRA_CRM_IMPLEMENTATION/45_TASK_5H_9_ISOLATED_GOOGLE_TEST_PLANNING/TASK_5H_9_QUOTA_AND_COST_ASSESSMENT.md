# TASK 5H.9 — QUOTA AND COST ASSESSMENT
**Access Date:** 18 November 2026 | **Cost Target:** ₹0 INR / $0 USD

---

## 1. Official Google Quotas & Limits
1. **Google Apps Script (Consumer Free Account):**
   - **Per-execution runtime:** **6 minutes** max (`https://developers.google.com/apps-script/guides/services/quotas`, accessed 2026-11-18).
   - **Trigger daily runtime:** **90 min/day** (consumer) / **6 hr/day** (Workspace).
   - **Simultaneous executions:** Concurrency-throttled per user account (`LockService.waitLock(10000)` serializes writes).
   - **`CacheService`:** **100 KB/key**, **250-char key**, **1,000 items max** (evicts 900 furthest from expiry), **600s max TTL** (`https://developers.google.com/apps-script/reference/cache/cache`, accessed 2026-11-18).
2. **Google Sheets Limits & Sheets API v4 Reference:**
   - **Spreadsheet capacity:** **20,000,000 cells** max per workbook (`https://support.google.com/drive/answer/37603`, accessed 2026-11-18).
   - **Sheets API v4 (if used later):** **300 req/min/project**, **60 req/min/user/project** (`https://developers.google.com/workspace/sheets/api/limits`, accessed 2026-11-18).

## 2. Estimated Gateway Call Budget (Assuming Batched `GET_SNAPSHOT` + `UPSERT_ROW`)

| Scenario | Workload | Est. Gateway HTTP Calls | Est. Elapsed Time / Rate | Free-Tier Verdict |
|----------|----------|-------------------------|--------------------------|-------------------|
| **A – Small Test** | 10 leads, 20 reads, 10 writes, 5 webhooks | ~35 calls | < 1 min | **₹0** (well within limits) |
| **B – Moderate Test** | 100 leads, 200 reads, 100 writes, 50 webhooks | ~350 calls | ~10–15 min paced | **₹0** (pace <= 30 req/min) |
| **C – Larger Test** | 500 leads, 1,000 reads, 500 writes, 250 webhooks | ~1,750 calls | ~60 min paced | **₹0** (requires pacing <= 30 req/min + `429` backoff; **not unlimited**) |

**Safety Thresholds:** Keep sustained traffic <= 30 req/min, `maxRetries = 2` with exponential backoff + jitter on `429`/`503`. All three test scenarios can operate at **₹0** without paid Google services under paced execution.
