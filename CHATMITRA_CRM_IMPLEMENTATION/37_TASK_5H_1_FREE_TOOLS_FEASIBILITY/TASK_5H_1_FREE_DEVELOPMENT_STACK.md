# TASK 5H.1C — FREE TESTING AND DEVELOPMENT STACK
## VERIFIED ₹0 / $0 DEVELOPMENT, TESTING & VERIFICATION STACK FOR AVANI PROJECTS
### AVANI LOAN SERVICES — ChatMitra + AVANI AI CRM

**Date:** 18 November 2026  
**Execution Mode:** Strictly Read-Only Audit  
**Hard Cost Ceiling:** **₹0.00 INR / $0.00 USD**  
**Zero-Install Rule:** All tools listed below are **already available** on the workstation or within authorized project `node_modules` (except the future Owner-gated Atlas M0 cluster).

---

### 1. COMPLETE 15-CATEGORY FREE DEVELOPMENT & TESTING STACK MATRIX

| # | Requirement Category | Preferred Free Option | Current Workstation Availability & Installed Version | License / Cost Status | Exact Invocation / Verification Method | Hardware Footprint (on 3.90 GB RAM Host) |
| :-: | :--- | :--- | :--- | :--- | :--- | :--- |
| **1** | **Code Editor / IDE** | Antigravity IDE / VS Code Environment | **AVAILABLE & ACTIVE** (Current Antigravity workspace environment) | **₹0 / $0** | Active workspace editor & file tools (`read_file`, `edit_file`, `write_file`). | Already running in active session; 0 incremental RAM. |
| **2** | **JavaScript / TypeScript Runtime** | Existing Node.js Installation | **INSTALLED:** `Node.js v26.13.1` (`C:\Program Files\nodejs\node.exe`) | **MIT License (₹0 / $0)** | `node -v` | Very Low (~35–65 MB per CLI test process). |
| **3** | **Package Management** | Existing npm CLI | **INSTALLED:** `npm v11.20.0` & `npx v11.20.0` (`C:\Program Files\nodejs\npm.cmd`) | **Artistic-2.0 (₹0 / $0)** | `& "C:\Program Files\nodejs\npm.cmd" -v` *(Use `npm.cmd` to bypass PowerShell `.ps1` execution policy)* | Very Low (~40 MB when inspecting lockfiles). |
| **4** | **Unit & Lifecycle Testing** | Existing Node.js Native Test Runner (`node:test` + `node:assert`) | **INSTALLED:** Built into `Node.js v26.13.1` (Zero external Jest/Vitest dependencies required) | **MIT License (₹0 / $0)** | `node --test tests/test_database_isolation_hardening.test.cjs` | Ultra-Lightweight (~55 MB RAM; executes 59 tests in < 2 seconds). |
| **5** | **Type Checking & Transpilation** | Existing TypeScript Compiler (`tsc`) | **INSTALLED:** `typescript@5.9.3` (`3-AVANI AI CRM\node_modules\typescript`) | **Apache-2.0 (₹0 / $0)** | `node node_modules/typescript/bin/tsc --project tsconfig.json --noEmit` | Moderate (~180–250 MB RAM during single-pass `--noEmit`). |
| **6** | **API & HTTP Endpoint Testing** | Existing `curl.exe`, Node native `fetch`/`http`, and `axios` | **INSTALLED:** `curl.exe v8.13.0` (`C:\WINDOWS\system32\curl.exe`), Node `fetch`, `axios@1.18.1` (P2) / `1.21.1` (P1) | **MIT / curl License (₹0 / $0)** | `curl.exe --version` or offline Node HTTP test harnesses | Negligible (< 15 MB RAM for `curl.exe`). |
| **7** | **Browser & UI Acceptance Testing** | Existing Puppeteer Installation | **INSTALLED:** `puppeteer@25.4.0` (`3-AVANI AI CRM\node_modules\puppeteer`) | **Apache-2.0 (₹0 / $0)** | Local Node scripts importing `puppeteer` in headless mode | Moderate (~250–400 MB RAM; run 1 headless tab at a time and close immediately). |
| **8** | **Database Testing** | Local Mock Dependency Injection + Approved Isolated Free Atlas M0 | **LOCAL MOCKS INSTALLED** (`mongoose@9.7.3`, `mongodb@7.2.0`, `ioredis-mock@5.9.1`). **CLOUD M0:** Permanent Free Tier (Owner approval required for 5H.2) | **MIT / Apache-2.0 / Atlas M0 Free Tier (₹0 / $0)** | Offline: `node --test` (175/175 passing). Live (future): `MONGODB_URI` with `?authMechanism=SCRAM-SHA-1` | **0 MB local DB daemon RAM** (Cloud M0 offloads storage & compute from workstation). |
| **9** | **Source Control** | Existing Git CLI | **INSTALLED:** `git version 2.56.1.windows.1` (`MinGit\cmd\git.exe`) | **GPL-2.0 (₹0 / $0)** | `git status --short`, `git diff --stat`, `git log -n 5` | Negligible (< 20 MB RAM). |
| **10** | **Repository Hosting** | Existing GitHub Free Account & GitHub CLI | **INSTALLED & CONFIGURED:** `gh version 2.104.0` + Remote `https://github.com/avaniagrofoods/avani-ai-crm.git` | **GitHub Free Tier & MIT CLI (₹0 / $0)** | `git remote -v` *(Run tests locally to consume 0 paid GitHub Actions minutes)* | Negligible (< 25 MB RAM). |
| **11** | **Documentation & Spreadsheet Reporting** | Native Markdown + Existing `exceljs` + `jspdf` + Python Standard Library | **INSTALLED:** Markdown, `exceljs@4.4.0` (P1 `node_modules`), `jspdf@4.2.1` (P1 `node_modules`), `Python 3.14.5` | **MIT / PSF License (₹0 / $0)** | Node `exceljs` scripts & Python `zipfile`/`xml` spreadsheet formula auditors | Very Low (~50 MB RAM). |
| **12** | **JSON & CSV Validation** | Python 3.14.5 Standard Library (`json`, `csv`) & Installed `papaparse` / `zod` | **INSTALLED:** `C:\Python314\python.exe` (`3.14.5`), `papaparse@5.5.4` (P2), `zod@4.4.3` (P2) / `4.6.7` (P1) | **PSF / MIT License (₹0 / $0)** | `& "C:\Python314\python.exe" -c "import json, csv"` | Negligible (< 30 MB RAM). |
| **13** | **Security & Static Code Checks** | Existing ESLint + TypeScript + Custom Node AST/Regex Security Auditors | **INSTALLED:** `eslint@9.39.4`, `eslint-config-next@16.4.6`, `helmet@8.2.0`, `express-validator@7.3.2` | **MIT License (₹0 / $0)** | Offline security test suites (`test_database_isolation_hardening.test.cjs`, etc.) | Low (~80–150 MB RAM). |
| **14** | **Local Automation** | PowerShell 5.1, Windows Task Scheduler (`schtasks`), `node-cron`, Python Scripts | **INSTALLED:** `powershell.exe v5.1`, `schtasks.exe`, `node-cron@4.2.1` (P1) | **Built-in OS / ISC / PSF (₹0 / $0)** | Local `.ps1`, `.cjs`, and `.py` automation scripts | Very Low (< 40 MB RAM). |
| **15** | **Health & Runtime Monitoring** | Application Health Endpoints (`/api/health`, `/api/admin/diagnostics`) + Local Check Scripts | **INSTALLED & BUILT INTO APP:** Next.js route handlers + offline diagnostic verification scripts | **First-Party Open Code (₹0 / $0)** | Offline route handler invocation or local `curl.exe` against dev server | Low (Zero external paid APM agent overhead). |

---

### 2. KEY OPERATIONAL SAFEGUARDS FOR THIS STACK ON WINDOWS

1. **PowerShell Script Execution Policy Workaround (Zero Configuration Change Required):**
   - Because Windows PowerShell has script execution restricted for `.ps1` wrappers (`npm.ps1`), always invoke **`npm.cmd`** or **`npx.cmd`** (or invoke `node.exe` directly on `.js`/`.cjs` entrypoints such as `node node_modules/typescript/bin/tsc`).
2. **Python Executable Path Resolution:**
   - Because `C:\Users\ALPHA-1\AppData\Local\Microsoft\WindowsApps\python.exe` is a Microsoft Store alias stub, always invoke the installed Python 3.14.5 binary directly at **`C:\Python314\python.exe`**.
3. **cURL Invocation in PowerShell:**
   - In Windows PowerShell 5.1, `curl` is aliased to `Invoke-WebRequest`. Always invoke the native binary explicitly as **`curl.exe`** (`C:\WINDOWS\system32\curl.exe`, version `8.13.0`).
4. **Memory Budget Discipline (3.90 GB RAM Host):**
   - Run verification steps **sequentially** (e.g., run `tsc --noEmit` first, let it exit and free memory, then run `node --test`). Never launch parallel heavy processes simultaneously.
