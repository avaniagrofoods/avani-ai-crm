# TASK 5H.11B — HMAC AND SPREADSHEET ISOLATION REVIEW
**Audit Date:** 19 November 2026

| Control | Local Codebase / Docs | Live Version 1 Deployment |
|---------|-----------------------|---------------------------|
| **`GATEWAY_HMAC_SECRET` Configured in `ScriptProperties`** | Documented in setup guide | **NOT VERIFIED** |
| **`ALLOWED_SPREADSHEET_ID` Configured in `ScriptProperties`** | Documented in setup guide | **NOT VERIFIED** |
| **Bound Spreadsheet Is Isolated `AVANI_AI_CRM_ISOLATED_TEST`** | Planned in Gate 1 | **NOT VERIFIED** |
| **Production Data Isolation Verified** | Verified locally (CRM not connected, `MOCK_IN_MEMORY` only) | **NOT VERIFIED** on live Google deployment |
| **Plaintext Endpoint Hygiene** | `AVANI_AI_CRM_ISOLATED_TEST.txt` holds plaintext `/exec` & Library URLs | **EXPOSED IN LOCAL DOC** (should be removed/archived) |
