# TASK 5H.13 — REPORT 12
## Operational Cost, Google Quota & Rate Limit Review

- **Task:** 5H.13 — Section 12 Quota & Cost Review
- **Audit Target:** Google Workspace / Free Tier Apps Script Limits

---

### 1. Financial Cost Analysis

- **Direct Platform Charges:** **₹0.00**.
- **Subscription Tier:** Google standard personal account free tier.
- **Paid Upgrades:** Zero paid Google Cloud Platform services, billing accounts, or Google Workspace enterprise tiers enabled.

---

### 2. Google Apps Script Quota Limits (Consumer / Free Tier)

| Resource Metric | Free Consumer Account Quota | Expected Test Peak | Status |
| :--- | :--- | :--- | :--- |
| **Simultaneous Executions** | 30 concurrent executions | $\le 2$ (serialized by Next.js client) | **SAFE** |
| **Daily Execution Time** | 90 minutes / day | $< 2$ minutes / day | **SAFE** |
| **Single Execution Limit** | 6 minutes / trigger | $\sim 200$ ms / call | **SAFE** |
| **URLFetch Calls** | 20,000 calls / day | $< 100$ calls / day | **SAFE** |
| **Spreadsheet Cell Limit** | 10,000,000 cells | $< 1,000$ cells in test | **SAFE** |

---

### 3. CRM Client-Side Optimizations

1. **Snapshot Read Batching (`GET_SNAPSHOT`):** Combines reads of multiple tabs into a single HTTP round-trip, conserving daily execution limits.
2. **Client-Side Mutex (`sheetsWriteMutex`):** Serializes outbound mutations to prevent race conditions and Apps Script lock contention.
3. **Controlled Backoff:** Implements exponential backoff with jitter on HTTP 429 and transient 5xx errors.
