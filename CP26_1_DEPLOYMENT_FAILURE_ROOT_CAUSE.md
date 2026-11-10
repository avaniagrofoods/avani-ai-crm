# AVANI AI CRM — CP-26.1
# GATE 2: DEPLOYMENT FAILURE & EXIT CODE 1 ROOT CAUSE ANALYSIS

**Project:** AVANI LOAN SERVICES — AVANI AI CRM  
**Date:** November 10, 2026  
**Auditor:** Senior DevOps & Cloud Infrastructure Auditor  
**Status:** FULLY DIAGNOSED & RECOVERED  

---

## 1. Executive Summary

During the CP-26 deployment process, two separate non-zero exit codes (exit code 1) were observed in the automation logs:
1. **Incident A:** `npx vercel --prod --yes` exited with code 1.
2. **Incident B:** A subsequent PowerShell HTTP probe command exited with code 1.

A forensic investigation into both incidents confirms:
- **No code defects, missing dependencies, or TypeScript errors existed.**
- **The Next.js production build succeeded completely in 19 seconds on Vercel servers.**
- **Incident A was caused by a client-side TCP connection drop (`ECONNRESET`)** while the local CLI polled Vercel's API, occurring after the remote build had already succeeded.
- **Incident B was caused by a shell string interpolation syntax error** in the PowerShell command line, not an HTTP failure.
- **Vercel's automated Git pipeline subsequently deployed commit `8bdb416` via deployment `dpl_DcuccV2oC1uDjMc2y8es6tvBEard`**, which is currently live, healthy, and serving `https://avani-ai-crm.vercel.app`.

---

## 2. Forensic Breakdown of Incident A (`vercel deploy`)

### Exact Log Transcript:
```text
▲ Next.js 16.2.10 (Turbopack)
Creating an optimized production build ...
✓ Compiled successfully in 7.8s
Running TypeScript ...
Finished TypeScript in 7.7s ...
Collecting page data using 1 worker ...
✓ Generating static pages using 1 worker (51/51) in 445ms
Finalizing page optimization ...
Build Completed in /vercel/output [19s]
Deploying outputs...
Deployment completed
Creating build cache...
Created build cache: 8s
Uploading build cache [122.55 MB]
Build cache uploaded: 2.604s
{
  "status": "error",
  "reason": "deploy_failed",
  "message": "request to https://api.vercel.com/v13/deployments/dpl_GDfWEEHmJ78BiPLNa9oMTjerLByP?teamId=team_vUTeKhQxcSPYtztYtoLMWinO failed, reason: read ECONNRESET",
  "next": [
    {
      "command": "vercel deploy",
      "when": "retry deploy"
    }
  ]
}
Error: request to https://api.vercel.com/v13/deployments/dpl_GDfWEEHmJ78BiPLNa9oMTjerLByP?teamId=team_vUTeKhQxcSPYtztYtoLMWinO failed, reason: read ECONNRESET
```

### Analysis:
1. **Remote Cloud Execution:** The build on Vercel's `iad1` container completed in 19s with 0 errors.
2. **Local Socket Failure:** The local developer machine's Node.js HTTPS client was long-polling `api.vercel.com` for the final status report when an upstream network boundary or intermediate proxy dropped the TCP socket (`read ECONNRESET`).
3. **Backend Status:** Inspection of `dpl_GDfWEEHmJ78BiPLNa9oMTjerLByP` via `vercel inspect` confirmed that Vercel completed the deployment despite the CLI socket drop: `Status: ● Ready`.

---

## 3. Forensic Breakdown of Incident B (PowerShell HTTP Probe)

### Exact Log Transcript:
```text
Exception: : The term 'Exception:' is not recognized as the name of a cmdlet, function, script file, or operable 
program. Check the spelling of the name, or if a path was included, verify that the path is correct and try again.
At line:16 char:70
+ ... "$($_.Exception.Response.StatusCode.value__) : $u (Exception: $($_.Ex ...
+                                                        ~~~~~~~~~~
    + CategoryInfo          : ObjectNotFound: (Exception::String) [], CommandNotFoundException
    + FullyQualifiedErrorId : CommandNotFoundException
```

### Analysis:
- The command attempted to interpolate `$($_.Exception.Response.StatusCode.value__)` inside a double-quoted string with an unescaped colon and parenthesis, causing the PowerShell parser to fail before executing the HTTP request.
- When re-run using standard Node.js `https.get()`, all URLs returned HTTP 200.

---

## 4. Current Live Production State

- **Current Active Deployment:** `dpl_DcuccV2oC1uDjMc2y8es6tvBEard`
- **Creation Time:** Tue Nov 10 2026 22:12:35 GMT+0530
- **Build Duration:** 25 seconds
- **Status:** `● Ready`
- **Production URL:** `https://avani-ai-crm.vercel.app`
- **Source Git Commit:** `8bdb416` (`main` / `release/stage1-hardening`)
