# TASK 5H.10 — GOOGLE SHEETS CELL LIMIT CORRECTION
**Official Source:** Google Drive Help — *Files you can store in Google Drive* (`https://support.google.com/drive/answer/37603`, accessed 2026-11-18)

---

## 1. Discrepancy Resolution
- **Earlier Reference:** 10 million cells (legacy Google Sheets cap).
- **Current Official Limit:** **20 million cells** (or **100 MB** for imported/converted spreadsheets; max 18,278 columns ending at `ZZZ`; max 50,000 characters per cell on Excel conversion).
- **Scope:** Applies to the **entire spreadsheet workbook** across all tabs combined, not per individual tab.
- **Practical Impact on 9-Tab CRM Design:** With 9 tabs totaling 71 columns across all headers (~7.9 columns average), 20 million cells comfortably holds >250,000+ rows across the workbook; however, `MESSAGE_EVENTS` and `WEBHOOK_EVENTS` should still be archived/pruned periodically to keep `GET_SNAPSHOT` latency well below the 6-minute Apps Script limit.
