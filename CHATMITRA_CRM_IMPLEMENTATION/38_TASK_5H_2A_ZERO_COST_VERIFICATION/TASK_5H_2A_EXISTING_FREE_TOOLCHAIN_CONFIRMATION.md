# TASK 5H.2A — EXISTING LOCAL FREE-TOOLCHAIN CONFIRMATION
## RECONFIRMATION & 5-CATEGORY CLASSIFICATION OF ALL EVALUATED TOOLS (ZERO NEW INSTALLS)
### AVANI LOAN SERVICES — ChatMitra + AVANI AI CRM

**Date:** 18 November 2026  
**Execution Mode:** Strictly Read-Only Local Toolchain Reconfirmation  
**Packages Installed During Audit:** **0**

---

### 1. SUMMARY BY MANDATORY TASK D CLASSIFICATION CATEGORY

Every tool evaluated in Task 5H.1 has been reconfirmed read-only and classified into one of the five mandatory Task D categories:

| Task D Classification Category | Tool Count | Cost Status | Operational Summary |
| :--- | :---: | :---: | :--- |
| **1. Already installed and usable** | **20 Tools** | **`VERIFIED` (₹0 / $0)** | Immediately executable offline with zero configuration changes. |
| **2. Already installed but requires configuration / invocation flags** | **4 Tools** | **`VERIFIED` (₹0 / $0)** | Physically installed on disk; requires specific binary path (`C:\Python314\python.exe`, `npm.cmd`) or headless memory flags. |
| **3. Free but not installed** | **3 Tools** | **`VERIFIED` (₹0 / $0)** | Not installed (`jest`/`vitest`, `playwright`, `rclone`); unnecessary because installed equivalents (`node:test`, `puppeteer`, `git`/PowerShell) already cover all use cases. |
| **4. Paid or unsuitable** | **8 Tools / Tiers** | **`VERIFIED` (Excluded)** | Paid cloud tiers (`M10+`, `Flex`, Paid SaaS/Telecom) or hardware-unsuitable engines (`mongod.exe`, `Docker`, `mongodb-memory-server` on 3.90 GB RAM host). |
| **5. Not verified** | **1 Cloud Option** | **`NOT VERIFIED` / `REQUIRES OWNER CONFIRMATION`** | **MongoDB Atlas M0 Free Cluster in AWS Mumbai (`ap-south-1`)** — requires live Owner confirmation in the Atlas UI without credit card entry. |

---

### 2. COMPLETE 36-ITEM TOOL RECONFIRMATION REGISTER

#### CATEGORY 1: ALREADY INSTALLED AND USABLE (20 TOOLS — `VERIFIED` AT ₹0)

| # | Tool / Package | Verified Version | Verified Path / Location | License | Preferred Task D Usage |
| :-: | :--- | :--- | :--- | :--- | :--- |
| **1** | **Node.js Runtime** | `v26.13.1` | `C:\Program Files\nodejs\node.exe` | MIT | Core execution engine for Project 1, Project 2, and offline test scripts. |
| **2** | **Node Built-in Test Runner (`node:test` + `node:assert`)** | `v26.13.1` | Built into `node.exe` | MIT | Primary unit and dependency-injected lifecycle test runner (175 offline tests). |
| **3** | **Node Built-in Crypto, HTTP & DNS (`node:crypto`, `node:http`, `node:dns`)** | `v26.13.1` | Built into `node.exe` | MIT | Offline HMAC-SHA256 webhook signature testing and DNS-SRV mock verification. |
| **4** | **TypeScript Compiler (`tsc`)** | `5.9.3` | `3-AVANI AI CRM\node_modules\typescript` | Apache-2.0 | Static type checking (`node node_modules/typescript/bin/tsc --noEmit`) & `ts.transpileModule`. |
| **5** | **ESLint (`eslint` + `eslint-config-next`)** | `9.39.4` | Project 1 & Project 2 `node_modules\eslint` | MIT | Offline static code quality and security rule verification. |
| **6** | **Next.js Framework (`next`)** | `16.2.10` | `3-AVANI AI CRM\node_modules\next` | MIT | AVANI AI CRM application framework and route handler definitions. |
| **7** | **Vite Build Tool (`vite`)** | `6.4.6` | `1-AVANI LOAN SERVICE...\node_modules\vite` | MIT | Project 1 frontend bundler and local development tool. |
| **8** | **Mongoose ODM (`mongoose`)** | `9.7.3` (P2) / `9.12.1` (P1) | Project 2 & Project 1 `node_modules\mongoose` | MIT | Schema definitions (18 CRM models), offline document validation, and `schema.indexes()` inventory. |
| **9** | **MongoDB Native Node Driver (`mongodb`)** | `7.2.0` | `3-AVANI AI CRM\node_modules\mongodb` | Apache-2.0 | Wire protocol driver and connection/topology inspection in `src/lib/db.ts`. |
| **10** | **Zod (`zod`)** | `4.4.3` (P2) / `4.6.7` (P1) | Project 2 & Project 1 `node_modules\zod` | MIT | Runtime payload and schema validation. |
| **11** | **PapaParse (`papaparse`)** | `5.5.4` | `3-AVANI AI CRM\node_modules\papaparse` | MIT | Offline CSV parsing and validation. |
| **12** | **ExcelJS (`exceljs`)** | `4.4.0` | `1-AVANI LOAN SERVICE...\node_modules\exceljs` | MIT | Programmatic `.xlsx` generation and formula verification (`TASK_5H_2A_CORRECTIONS_REGISTER.xlsx`). |
| **13** | **Axios (`axios`)** | `1.18.1` (P2) / `1.21.1` (P1) | Project 2 & Project 1 `node_modules\axios` | MIT | Local HTTP client library (external calls mocked in offline tests). |
| **14** | **ioredis-mock (`ioredis-mock`)** | `5.9.1` | `1-AVANI LOAN SERVICE...\node_modules\ioredis-mock` | MIT | In-memory Redis mock for offline rate-limit/queue testing. |
| **15** | **node-cron (`node-cron`)** | `4.2.1` | `1-AVANI LOAN SERVICE...\node_modules\node-cron` | ISC | In-process cron scheduling utility. |
| **16** | **Helmet & Express-Validator** | `8.2.0` / `7.3.2` | `1-AVANI LOAN SERVICE...\node_modules` | MIT | HTTP security headers and request sanitization middleware. |
| **17** | **jsPDF & pdf-parse** | `4.2.1` / `2.4.5` | `1-AVANI LOAN SERVICE...\node_modules` | MIT | Local PDF generation and text inspection utilities. |
| **18** | **Git CLI (`git.exe`)** | `2.56.1.windows.1` | `...\Git.MinGit...\cmd\git.exe` | GPL-2.0 | Local source control, `git status`, `git diff`, and baseline preservation. |
| **19** | **cURL (`curl.exe`)** | `8.13.0` | `C:\WINDOWS\system32\curl.exe` | curl/MIT | Local command-line HTTP/REST testing (`curl.exe`). |
| **20** | **Windows PowerShell 5.1 & OS Utilities (`Get-FileHash`, `tar.exe`, `ssh.exe`, `schtasks.exe`)** | `5.1.19041.5486` | `C:\WINDOWS\System32\...` | Windows OS | Cryptographic SHA-256 checksums, file auditing, and local task automation. |

---

#### CATEGORY 2: ALREADY INSTALLED BUT REQUIRES CONFIGURATION / INVOCATION FLAGS (4 TOOLS — `VERIFIED` AT ₹0)

| # | Tool / Package | Verified Version | Installed Path | Required Invocation / Configuration Note |
| :-: | :--- | :--- | :--- | :--- |
| **21** | **npm & npx CLI** | `11.20.0` | `C:\Program Files\nodejs\npm.cmd` | Windows PowerShell execution policy (`Restricted`) blocks `npm.ps1`. Must invoke explicitly as **`npm.cmd`** or **`npx.cmd`** (or invoke `node.exe` directly on package bin scripts). |
| **22** | **Python 3 Runtime & Standard Library** | `3.14.5` | `C:\Python314\python.exe` | Typing `python` on default `PATH` hits the Microsoft Store alias stub (`WindowsApps\python.exe`). Must invoke via full path **`C:\Python314\python.exe`**. Includes full standard library (`json`, `csv`, `sqlite3`, `unittest`, `hashlib`, `zipfile`, `xml`). |
| **23** | **Puppeteer (`puppeteer`)** | `25.4.0` | `3-AVANI AI CRM\node_modules\puppeteer` | Installed in Project 2 `node_modules`, but launching headless Chromium consumes ~250–400 MB RAM. On the 3.90 GB RAM workstation (~268–426 MB free RAM), requires single-instance sequential execution and immediate `browser.close()`. |
| **24** | **GitHub CLI (`gh`) & Remote Repo Config** | `2.104.0` | `C:\Program Files\GitHub CLI\gh.exe` | Installed binary; requires strict scoping to the single authorized repository (`https://github.com/avaniagrofoods/avani-ai-crm.git`) and keeping cloud GitHub Actions disabled/unused to avoid consuming CI quota. |

---

#### CATEGORY 3: FREE BUT NOT INSTALLED (3 TOOLS — NOT NEEDED)

| # | Tool Name | Status | Reason Not Needed |
| :-: | :--- | :---: | :--- |
| **25** | **Jest / Vitest / Mocha** | `NOT_FOUND` | Node.js `v26.13.1` built-in `node:test` and `node:assert/strict` already execute all 175 tests natively. |
| **26** | **Playwright** | `NOT_FOUND` | `puppeteer@25.4.0` is already installed in Project 2 `node_modules`. |
| **27** | **Rclone / Vercel CLI** | `NOT_FOUND` | Not on system `PATH`; local Git and PowerShell handle all read-only verification. |

---

#### CATEGORY 4: PAID OR UNSUITABLE (8 TOOLS / TIERS — STRICTLY EXCLUDED)

| # | Tool / Service | Classification | Reason Paid or Unsuitable |
| :-: | :--- | :---: | :--- |
| **28** | **MongoDB Atlas M10+ Dedicated Cluster** | **Paid** ($0.08+/hr) | Violates Task C strict ₹0 cost condition ("No M10 or higher"). |
| **29** | **MongoDB Atlas Flex / Legacy M2–M5** | **Paid** ($8–$30/mo) | Violates Task C strict ₹0 cost condition ("No Flex tier"). |
| **30** | **Local MongoDB Community Server (`mongod.exe`)** | **Unsuitable for Host** | Not installed; requires 1.0–1.5 GB RAM & disk space. Workstation has 3.90 GB total RAM (~268–426 MB free) and Drive D: has 3.25 MB free (causes OOM thrashing). |
| **31** | **Docker Desktop + MongoDB Container** | **Unsuitable for Host** | Not installed; WSL2 VM requires 2–4 GB RAM on a 3.90 GB RAM host (impossible without crashing host). |
| **32** | **`mongodb-memory-server`** | **Unsuitable for Host** | Not installed; downloads ~500 MB `mongod` binary and runs `mongod` in RAM (>500 MB RAM, crashes host). |
| **33** | **Paid Postman Team/Enterprise & Paid ngrok** | **Paid** ($8–$49/mo) | Violates ₹0 cost ceiling; replaced by installed `curl.exe` and Node `http`. |
| **34** | **Live Paid WhatsApp BSP / Vapi / Twilio Calls** | **Paid & Prohibited** | Usage-billed telecom/voice APIs; violates ₹0 cost ceiling and customer communication ban. |
| **35** | **Vercel Pro & Paid Cloud APM (Datadog/Sentry)** | **Paid** ($20+/mo) | Violates ₹0 cost ceiling. |

---

#### CATEGORY 5: NOT VERIFIED (1 CLOUD OPTION)

| # | Service | Classification | Verification Gap |
| :-: | :--- | :---: | :--- |
| **36** | **MongoDB Atlas M0 Free Cluster in AWS Mumbai (`ap-south-1`)** | **`NOT VERIFIED` (`REQUIRES OWNER CONFIRMATION`)** | Published base price is $0, but (1) AWS Mumbai `ap-south-1` M0 free-cluster availability is not confirmed in static docs, and (2) card-free provisioning without RBI e-mandate on the Owner's account has not been verified in the live Atlas UI. |
