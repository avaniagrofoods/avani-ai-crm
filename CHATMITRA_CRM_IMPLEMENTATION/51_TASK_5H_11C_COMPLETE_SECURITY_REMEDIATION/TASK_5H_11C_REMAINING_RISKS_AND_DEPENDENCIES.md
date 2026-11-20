# TASK 5H.11C — REMAINING RISKS AND DEPENDENCIES
1. **Owner Action 1 (REM-01 / REM-03 / REM-11):** Archive active Version 1 deployment (`AVANI_AI_CRM_TEST_GATEWAY`, `19 Nov 2026, 07:56`), rotate `GATEWAY_HMAC_SECRET`, and remove plaintext `/exec` URL from `AVANI_AI_CRM_ISOLATED_TEST.txt`.
2. **Owner Action 2 (REM-02):** Authenticate dedicated test `@gmail.com` account via Google's official interface.
3. **Production-Only Open Risk (REM-12 / A-04):** Durable cross-instance session revocation and distributed rate limiting remain unimplemented under ₹0 in-memory storage.
4. **Live Google Verification Pending:** Real `LockService`, `CacheService`, and `SpreadsheetApp` runtime behavior can only be verified during authorized Gate 4/5 live isolated testing.
