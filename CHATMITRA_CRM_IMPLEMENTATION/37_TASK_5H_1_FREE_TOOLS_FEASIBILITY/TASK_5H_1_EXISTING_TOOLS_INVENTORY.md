# TASK 5H.1A — EXISTING FREE TOOLS INVENTORY
## READ-ONLY AUDIT OF INSTALLED RUNTIMES, PACKAGES & SYSTEM UTILITIES
### AVANI LOAN SERVICES — ChatMitra + AVANI AI CRM

**Date:** 18 November 2026  
**Execution Mode:** Strictly Read-Only Local Environment Inspection  
**Zero-Install Compliance:** 0 packages installed; 0 binaries downloaded.

---

### 1. WORKSTATION HARDWARE & OPERATING SYSTEM BASELINE

Before evaluating local tool execution, the workstation's hardware limits were verified read-only via WMI/CIM (`Win32_OperatingSystem` and `Get-PSDrive`):

| Resource | Measured Value | Technical Impact on Free Tooling |
| :--- | :--- | :--- |
| **Operating System** | Microsoft Windows 10 Pro (`10.0.19045`, 64-bit) | Native support for Node.js, Python, Git, PowerShell, OpenSSH, cURL, Task Scheduler. |
| **Total Physical RAM** | `4,088,640 KB` (~3.90 GB) | Constrained memory ceiling; favors lightweight CLI runners (`node:test`, `tsc`, `curl.exe`) over heavy containers/VMs. |
| **Free Physical RAM** | `268,000 KB – 426,212 KB` (~268–416 MB) | Prevents running memory-intensive local database daemons (`mongod.exe` or Docker WSL2). |
| **Drive C: Free Space** | `14,617,538,560 bytes` (~13.61 GB free) | Sufficient for code, documentation, logs, and lightweight artifacts. |
| **Drive D: Free Space** | `3,407,872 bytes` (~3.25 MB free) | **Exhausted.** Cannot host database files, container images, or binary caches. |

---

### 2. COMPLETE INVENTORY OF 24 INSTALLED FREE & OPEN-SOURCE TOOLS

All 24 tools below are **already installed and operational** across the system or within the authorized `node_modules` directories of Project 1 (`1-AVANI LOAN SERVICE FY 26-27`) and Project 2 (`3-AVANI AI CRM`) at **₹0.00 / $0.00 cost**:

| # | Tool / Package Name | Installed Version | Location / Scope | License | Intended Use in Authorized Projects | Limitations |
| :-: | :--- | :--- | :--- | :--- | :--- | :--- |
| **1** | **Node.js Runtime** | `v26.13.1` | `C:\Program Files\nodejs\node.exe` | MIT (Open Source) | Primary JS/TS execution runtime for Next.js CRM, Express backend, and test suites. | Shares host RAM; limit concurrency on 3.90 GB machine. |
| **2** | **Node Built-in Test Runner (`node:test` + `node:assert`)** | `v26.13.1` | Built into `node.exe` | MIT (Open Source) | Zero-dependency unit & lifecycle integration testing (executes all 175 Project 2 tests). | Does not include browser DOM rendering (handled by Puppeteer). |
| **3** | **Node Built-in Crypto, HTTP & DNS (`node:crypto`, `node:http`, `node:dns`)** | `v26.13.1` | Built into `node.exe` | MIT (Open Source) | Synthetic WhatsApp/Meta HMAC-SHA256 webhook signing, mock HTTP servers, DNS-SRV verification. | Standard library primitives; no external UI. |
| **4** | **npm & npx CLI** | `11.20.0` | `C:\Program Files\nodejs\npm.cmd` | Artistic-2.0 (Open Source) | Script execution and dependency lockfile auditing. | PowerShell execution policy blocks `npm.ps1`; must invoke `npm.cmd` or `node` directly. |
| **5** | **TypeScript Compiler (`typescript` / `tsc`)** | `5.9.3` | Project 2 `node_modules\typescript` | Apache-2.0 (Open Source) | Static type verification (`tsc --noEmit`) & in-memory transpilation (`ts.transpileModule`) for F-01 source testing. | Local to Project 2 `node_modules`. |
| **6** | **ESLint (`eslint` + `eslint-config-next`)** | `9.39.4` | Project 1 & Project 2 `node_modules\eslint` | MIT (Open Source) | Static code quality and security rule analysis. | Static AST checks only; does not execute runtime tests. |
| **7** | **Next.js Framework (`next`)** | `16.2.10` (declared `16.4.6`) | Project 2 `node_modules\next` | MIT (Open Source) | Full-stack React 19.2.4 & App Router API framework for AVANI AI CRM. | Build step (`next build`) is memory-intensive on 3.90 GB RAM. |
| **8** | **Vite Build Tool (`vite`)** | `6.4.6` | Project 1 `node_modules\vite` | MIT (Open Source) | Frontend bundler and development server for Project 1 unified portal. | Scoped to Project 1 frontend. |
| **9** | **Mongoose ODM (`mongoose`)** | `9.7.3` (P2) / `9.12.1` (P1) | Project 2 & Project 1 `node_modules\mongoose` | MIT (Open Source) | Schema modeling (18 CRM models), validation, and offline index inventory (`schema.indexes()`). | Requires live MongoDB connection for server-side index build verification. |
| **10** | **MongoDB Native Node Driver (`mongodb`)** | `7.2.0` | Project 2 `node_modules\mongodb` | Apache-2.0 (Open Source) | Wire protocol client, topology inspection (`topology.description.servers`), SCRAM-SHA-1 / SHA-256 auth. | Does not include `@aws-sdk/credential-providers` peer package for ambient AWS IAM. |
| **11** | **Puppeteer (`puppeteer`)** | `25.4.0` | Project 2 `node_modules\puppeteer` | Apache-2.0 (Open Source) | Headless browser automation and UI acceptance verification. | Launching headless Chromium uses ~250–400 MB RAM; run single instance only. |
| **12** | **Zod (`zod`)** | `4.4.3` (P2) / `4.6.7` (P1) | Project 1 & Project 2 `node_modules\zod` | MIT (Open Source) | Strict schema validation for API inputs, webhook payloads, and environment config. | In-process schema validation only. |
| **13** | **PapaParse (`papaparse`)** | `5.5.4` | Project 2 `node_modules\papaparse` | MIT (Open Source) | Fast RFC-4180 CSV parsing and export validation in CRM. | In-memory CSV stream parser. |
| **14** | **ExcelJS (`exceljs`)** | `4.4.0` | Project 1 `node_modules\exceljs` | MIT (Open Source) | Programmatic `.xlsx` workbook creation, formula generation, and spreadsheet auditing. | Installed in Project 1 `node_modules`; callable via Node.js. |
| **15** | **Axios (`axios`)** | `1.18.1` (P2) / `1.21.1` (P1) | Project 1 & Project 2 `node_modules\axios` | MIT (Open Source) | Promise-based HTTP client for API integration and local webhook simulation. | External calls must remain disabled/mocked during offline testing. |
| **16** | **ioredis-mock (`ioredis-mock`)** | `5.9.1` | Project 1 `node_modules\ioredis-mock` | MIT (Open Source) | Zero-cost in-memory Redis mock for offline queue and rate-limit testing. | Ephemeral in-process memory only. |
| **17** | **node-cron (`node-cron`)** | `4.2.1` | Project 1 `node_modules\node-cron` | ISC (Open Source) | In-process cron job scheduling for automated local tasks. | Runs only while Node process is active. |
| **18** | **Helmet & Express-Validator** | `8.2.0` / `7.3.2` | Project 1 `node_modules` | MIT (Open Source) | HTTP response security headers and request validation middleware. | Express middleware scope. |
| **19** | **jsPDF & pdf-parse** | `4.2.1` / `2.4.5` | Project 1 `node_modules` | MIT (Open Source) | Free local PDF report generation and PDF text inspection. | Local document utilities. |
| **20** | **Python 3 Runtime & Standard Library** | `3.14.5` | `C:\Python314\python.exe` | PSF License (Open Source) | Data auditing, JSON/CSV validation, SHA-256 verification, SQLite, XML/ZIP inspection, `unittest`. | Invoke via explicit path `C:\Python314\python.exe` (WindowsApps alias points to Store stub). |
| **21** | **Git CLI** | `2.56.1.windows.1` | `...\Git.MinGit...\cmd\git.exe` | GPL-2.0 (Open Source) | Version control, worktree integrity checks (`git status`, `git diff`), and rollback safety. | Local CLI; requires network for remote push/fetch. |
| **22** | **GitHub CLI (`gh`)** | `2.104.0` | `C:\Program Files\GitHub CLI\gh.exe` | MIT (Open Source) | Repository status checks and GitHub Free workflow management. | Subject to strict project scope rules (only authorized repo allowed). |
| **23** | **cURL (`curl.exe`)** | `8.13.0` (Schannel) | `C:\WINDOWS\system32\curl.exe` | curl/MIT License | Command-line HTTP/REST endpoint and synthetic webhook testing. | Invoke as `curl.exe` in PowerShell to avoid `Invoke-WebRequest` alias. |
| **24** | **Windows PowerShell 5.1 & OS Utilities (`schtasks`, `tar`, `ssh`, `Get-FileHash`)** | `5.1.19041.5486` | `C:\WINDOWS\System32\...` | Included with Windows OS (₹0 incremental) | Cryptographic SHA-256 file hashing, local backup scripts, archive extraction, scheduled tasks. | Built into host OS at zero additional cost. |

---

### 3. TOOLS VERIFIED AS NOT INSTALLED (ZERO-INSTALL AUDIT)

The following tools were checked read-only and confirmed **not installed** on the workstation:

| Tool Checked | Status | Impact & Free Alternative Already Available |
| :--- | :---: | :--- |
| **Docker Desktop (`docker.exe`)** | `NOT_FOUND` | Cannot run MongoDB Docker containers; hardware (3.90 GB RAM) cannot support Docker WSL2 anyway. |
| **Local MongoDB Server (`mongod.exe` / `mongosh.exe`)** | `NOT_FOUND` | Cannot run local MongoDB daemon; hardware (~268–426 MB free RAM) cannot support WiredTiger cache. |
| **`mongodb-memory-server`** | `NOT_FOUND` | Not in `node_modules`; downloads ~500 MB `mongod` binary and consumes >500 MB RAM (infeasible on host). |
| **Jest / Vitest / Mocha** | `NOT_FOUND` | Unnecessary; Node.js v26.13.1 built-in `node:test` + `node:assert` already runs all 175 tests natively. |
| **Playwright** | `NOT_FOUND` | Unnecessary; `puppeteer@25.4.0` is already installed in Project 2 `node_modules`. |
| **Rclone (`rclone.exe`) / Vercel CLI (`vercel`)** | `NOT_FOUND` | Not installed on global PATH; Git and PowerShell handle local backups and verification. |
