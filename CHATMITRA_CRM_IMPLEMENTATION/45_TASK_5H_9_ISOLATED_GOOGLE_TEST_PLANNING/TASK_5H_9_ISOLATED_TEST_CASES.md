# TASK 5H.9 — ISOLATED TEST CASES
**Execution Boundary:** Offline/Mock tests are already passing; Live Google Test Cases require Gate 4 Owner approval against `AVANI_AI_CRM_ISOLATED_TEST`.

| Category | Test IDs | Key Scenarios Covered | Offline vs Live Google |
|----------|----------|-----------------------|------------------------|
| **A. Connection & Auth** | `IT-A01`–`IT-A10` | Valid HMAC, invalid HMAC (`401`), missing sig (`401`), expired ts >300s (`401`), future ts >300s (`401`), duplicate nonce (`401`), duplicate requestId (`401`), wrong spreadsheet ID (`403`), invalid tab (`500`), invalid action (`400`). | Contract offline; Apps Script enforcement requires **Live Google Test**. |
| **B. CRUD Operations** | `IT-B01`–`IT-B07` | `HEALTH_CHECK`, `GET_ALL`, `UPSERT_ROW` insert & update (`TEST_*`), `INSERT_IF_ABSENT`, `DELETE_ROW`, `GET_SNAPSHOT`. | `MOCK_IN_MEMORY` offline; HTTP round-trip requires **Live Google Test**. |
| **C. Data Validation** | `IT-C01`–`IT-C08` | Missing PK (`400`), invalid types, invalid status, formula injection (`=`, `+`, `-`, `@`, `IMPORTXML` -> `400`), >64 KB payload (`400`), Unicode Marathi/Hindi (`रोकें`, `थांबवा`), empty values, duplicate IDs. | `MOCK_IN_MEMORY` offline; >64 KB & Apps Script formula guard require **Live Google Test**. |
| **D. Reliability** | `IT-D01`–`IT-D09` | Offline `503`, `429` quota, `500` schema invalid, 10s timeout, `LockService` contention, concurrent inserts, duplicate webhook delivery, partial multi-tab write, retry convergence. | `MOCK_IN_MEMORY` offline; real `LockService`/latency require **Live Google Test**. |
| **E. Privacy & Security** | `IT-E01`–`IT-E06` | Zero real customer records, zero PAN/Aadhaar, zero documents/recordings, zero secrets in logs, zero prod spreadsheet access, zero unauthenticated public writes. | Verified offline + confirmed in **Gate 5 Live Audit**. |
