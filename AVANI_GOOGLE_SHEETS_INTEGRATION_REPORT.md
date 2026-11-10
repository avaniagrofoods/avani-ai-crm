# AVANI LOAN SERVICES — GOOGLE SHEETS INTEGRATION REPORT (SECTION 18)

- **Business Entity:** AVANI LOAN SERVICES (`https://www.avanifinserv.com/`)
- **Implementation Module:** [`src/lib/integrations.ts`](file:///c:/Users/ALPHA-1/Downloads/21MAY2026/SACHIN%20SHINDE%20DOCUMENTS/DEVELOPEMENT%20TOOLS/3-AVANI%20AI%20CRM/src/lib/integrations.ts) (`GOOGLE_SHEETS_RECOMMENDED_TABS`, `GOOGLE_SHEETS_STANDARD_FIELDS`, `resolveGoogleSheetTabsForLead`, `formatGoogleSheetsRow`, `syncToGoogleSheets`)
- **Automated Test Verification:** [`tests/test_cp25_master_chatbot_and_integrations.test.cjs`](file:///c:/Users/ALPHA-1/Downloads/21MAY2026/SACHIN%20SHINDE%20DOCUMENTS/DEVELOPEMENT%20TOOLS/3-AVANI%20AI%20CRM/tests/test_cp25_master_chatbot_and_integrations.test.cjs) (Test 23 — PASS)

---

## 1. Recommended 14-Tab Architecture (`GOOGLE_SHEETS_RECOMMENDED_TABS`)

[`resolveGoogleSheetTabsForLead`](file:///c:/Users/ALPHA-1/Downloads/21MAY2026/SACHIN%20SHINDE%20DOCUMENTS/DEVELOPEMENT%20TOOLS/3-AVANI%20AI%20CRM/src/lib/integrations.ts#L44-L67) routes every lead to `Master Leads` plus its specialized product/status sheet tab:

1. `Master Leads` (All leads with idempotent upsert by `Lead_ID`)
2. `Personal Loan`
3. `Business Loan`
4. `Doctor Loan`
5. `CA Loan`
6. `Education Loan`
7. `Home Loan`
8. `Mortgage Loan`
9. `School Funding`
10. `College Funding`
11. `Pending Documents`
12. `Follow-up Tracker`
13. `Opt-out Suppression`
14. `Conversion Summary`

---

## 2. Standardized 19-Column Schema (`GOOGLE_SHEETS_STANDARD_FIELDS`)

[`formatGoogleSheetsRow`](file:///c:/Users/ALPHA-1/Downloads/21MAY2026/SACHIN%20SHINDE%20DOCUMENTS/DEVELOPEMENT%20TOOLS/3-AVANI%20AI%20CRM/src/lib/integrations.ts#L69-L99) generates a strictly ordered, sanitized 19-column row:

| Col # | Column Header | Source Mapping | Security / Deduplication Rule |
|---|---|---|---|
| 1 | `Lead_ID` | `lead.leadId` (`AVL-YYYYMMDD-XXXXXX`) | Primary idempotent upsert key (prevents duplicate rows on update) |
| 2 | `Created_At` | `lead.createdAt` (ISO-8601) | Immutable creation timestamp |
| 3 | `Updated_At` | Current ISO-8601 timestamp | Updated on every stage transition |
| 4 | `Full_Name` | `sanitizeForLog(lead.name)` | Redacts accidental PAN/Aadhaar strings |
| 5 | `Mobile` | `lead.phone` / `lead.mobile_number` | Normalized E.164 (`+91XXXXXXXXXX`) |
| 6 | `Email` | `lead.email` | Lowercase validated email |
| 7 | `City` | `lead.city` | Applicant city/location |
| 8 | `Language` | `lead.preferredLanguage` | `English` \| `मराठी` \| `हिंदी` |
| 9 | `Applicant_Type` | `lead.employmentType` | `Salaried` \| `Self Employed` \| `Business Owner` \| `Professional` |
| 10 | `Loan_Category` | `lead.loanType` | Canonical 10-product category |
| 11 | `Required_Amount` | `lead.requestedAmount` | Numeric string in INR |
| 12 | `Monthly_Income_Range` | `lead.monthlyIncomeRange` | Selected income bracket |
| 13 | `Lead_Source` | `lead.leadSource` | `ChatMitra WhatsApp` \| `Website` \| `Meta WABA` |
| 14 | `Consent_Status` | `lead.consentStatus` | `GRANTED` \| `WITHDRAWN` |
| 15 | `Qualification_Status` | `lead.status` | `New` \| `Qualified` \| `OPTED_OUT` |
| 16 | `Document_Checklist_Status` | `lead.documentStatus` | `PENDING` \| `PARTIAL` \| `COMPLETE` |
| 17 | `Assigned_Advisor` | `lead.assignedAgent.name` | `Sachin Shinde` |
| 18 | `Next_Follow_Up` | `lead.nextFollowUp` | Scheduled follow-up date |
| 19 | `CRM_Record_ID` & `HubSpot_Record_ID` | `String(lead._id)` / `lead.hubspotRecordId` | Cross-system traceability |

---

## 3. Data Minimization & Security Rules
- Full KYC document binaries, unmasked Aadhaar/PAN numbers, and raw bank statements are **never** written to Google Sheets (`sanitizeForLog` enforced).
- Opted-out contacts are automatically routed to `['Master Leads', 'Opt-out Suppression']` so advisors never manually call suppressed numbers from spreadsheets.
