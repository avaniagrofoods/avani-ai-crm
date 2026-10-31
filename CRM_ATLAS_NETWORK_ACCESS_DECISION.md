# AVANI AI CRM — ATLAS NETWORK ACCESS & SECURITY DECISION RECORD

**Document ID:** ADR-SEC-2026-10-31  
**Target Cluster:** `avani-loan-services-m0.rhpn2gh.mongodb.net` (Free M0, AWS Mumbai `ap-south-1`)  
**Atlas Organization:** `sachin's Org - 2026-10-30` (ID: `6ae41e6bb12851a5ac6576d2`)  
**Atlas Project:** `AVANI AI CRM`  
**Current Ingress Configuration:** `0.0.0.0/0` (Global Ingress — Active) & `117.99.250.46/32` (Owner Workstation)  
**Security Status:** **`BLOCKED / UNRESOLVED RISK (OWNER ACTION REQUIRED)`**  
**Action Taken by Antigravity:** **`ZERO NETWORK RULES MODIFIED`** (Strict read-only compliance)

---

## 1. CONTEXT & PROBLEM STATEMENT

During the security audit of AVANI AI CRM, an active Network Access rule in MongoDB Atlas was identified:
`0.0.0.0/0` (Includes all IPv4 addresses globally).

### Why Was This Rule Applied?
- Vercel Serverless Functions execute in AWS region `iad1` (Washington, D.C.).
- On standard Vercel plans (Hobby and Pro), outgoing traffic from serverless functions originates from dynamic pools of AWS IP addresses that change unpredictably.
- Because Vercel does not assign static outbound IPs to standard serverless runtimes, connecting to MongoDB Atlas directly requires allowing ingress from dynamic ranges.
- To enable the Vercel Preview deployment (`https://avani-ai-a05i56ixj-avaniagrofoods1356-4705s-projects.vercel.app`) to access the staging database (`avani_ai_crm_test`), the `0.0.0.0/0` rule was enabled.

### The Security Exposure:
- Port 27017 on the cluster is exposed to the public internet.
- While MongoDB Atlas requires SCRAM authentication and TLS encryption, allowing public ingress removes the network perimeter security layer, exposing the cluster to automated IP port scanners, connection saturation attacks (denial of service), and credential brute-force attempts.
- **Immediate Risk of Rule Deletion:** If `0.0.0.0/0` is immediately removed without an alternative connection layer, the Preview deployment's database connectivity will immediately fail with connection timeout errors (`ECONNREFUSED` / Server Selection Timeout).

---

## 2. VIABLE ARCHITECTURAL OPTIONS COMPARISON

A technical analysis of the four primary connectivity options for Vercel + MongoDB Atlas was conducted:

```
+----------------------------------------------------------------------------------------------------+
| OPTION 1: Vercel-Atlas Marketplace Integration (RECOMMENDED)                                        |
+----------------------------------------------------------------------------------------------------+
| Mechanism: Official Vercel Marketplace Integration manages credentials and access securely.        |
| Security Impact: High security; eliminates manual 0.0.0.0/0 dependency.                            |
| Preview Compatibility: 100% Compatible.                                                            |
| Production Compatibility: 100% Compatible.                                                         |
| Cost / Plan Dependency: 100% Free; fully supported on Vercel Hobby/Pro & Atlas Free M0.           |
| Operational Risk: Low. Seamless native synchronization.                                            |
| Required Owner Action: Install MongoDB Atlas integration from Vercel Marketplace.                  |
| Rollback Approach: Disconnect integration; revert to manual environment variables.                |
| Approval Evidence Needed: Successful deployment build with native integration credentials.         |
+----------------------------------------------------------------------------------------------------+

+----------------------------------------------------------------------------------------------------+
| OPTION 2: Auto-Expiring Temporary Ingress Rule (RECOMMENDED FOR TEST SESSIONS)                     |
+----------------------------------------------------------------------------------------------------+
| Mechanism: Atlas console allows configuring 0.0.0.0/0 with a Time-To-Live (e.g. 6h or 24h).        |
| Security Impact: Moderate security; port automatically closes when TTL expires.                   |
| Preview Compatibility: 100% Compatible during active window.                                       |
| Production Compatibility: NOT RECOMMENDED FOR PRODUCTION (Production requires 24/7 availability).   |
| Cost / Plan Dependency: 100% Free. Native feature in Atlas UI.                                     |
| Operational Risk: Medium. Preview will stop connecting after TTL expires unless renewed.           |
| Required Owner Action: In Atlas Network Access, edit 0.0.0.0/0 and set an expiration window.       |
| Rollback Approach: Extend or remove expiration in Atlas console.                                   |
| Approval Evidence Needed: Atlas console screenshot confirming expiration countdown active.        |
+----------------------------------------------------------------------------------------------------+

+----------------------------------------------------------------------------------------------------+
| OPTION 3: Dedicated Static Outbound Egress Proxy                                                   |
+----------------------------------------------------------------------------------------------------+
| Mechanism: Route all Vercel outbound database calls through a fixed IP proxy (e.g. AWS t4g.nano).  |
| Security Impact: High security; Atlas allows only the proxy's single static Elastic IP (/32).      |
| Preview Compatibility: Compatible if proxy connection pooling is maintained.                       |
| Production Compatibility: Compatible.                                                              |
| Cost / Plan Dependency: ~$3–$5/month AWS hosting cost; maintenance overhead.                       |
| Operational Risk: High. Single point of failure; introduces inter-continental latency (iad1->proxy)|
| Required Owner Action: Provision EC2 instance, allocate Elastic IP, configure HAProxy/Nginx.       |
| Rollback Approach: Point MONGODB_URI back to direct cluster SRV URI.                              |
| Approval Evidence Needed: Proxy uptime monitoring and latency benchmarks.                          |
+----------------------------------------------------------------------------------------------------+

+----------------------------------------------------------------------------------------------------+
| OPTION 4: AWS VPC Peering / AWS PrivateLink                                                        |
+----------------------------------------------------------------------------------------------------+
| Mechanism: Direct private network tunnel between Vercel VPC and Atlas VPC.                         |
| Security Impact: Maximum enterprise security; completely unroutable from public internet.         |
| Preview Compatibility: Not applicable to Free M0.                                                  |
| Production Compatibility: Supported only on dedicated tiers.                                       |
| Cost / Plan Dependency: REQUIRES ATLAS M10+ ($57+/month) + VERCEL ENTERPRISE SECURE COMPUTE ($$$).  |
| Operational Risk: High plan cost barrier; violates ₹0 budget requirement.                          |
| Required Owner Action: Upgrade Atlas cluster to M10+ and add billing credit card.                 |
| Rollback Approach: Downgrade cluster back to M0 (requires cluster re-creation).                     |
| Approval Evidence Needed: Owner budget approval for paid enterprise tiers.                         |
+----------------------------------------------------------------------------------------------------+
```

---

## 3. DECISION & OWNER ACTION PROTOCOL

### 3.1 Recommended Decision
1. **For Production Readiness (Permanent Solution):**  
   Adopt **Option 1 (Official Vercel-MongoDB Atlas Marketplace Integration)**. This provides native, secure, managed connectivity without incurring any monthly fees or requiring public IP allowlists.
2. **For Immediate Staging Hardening (Interim Solution):**  
   If Option 1 cannot be installed immediately, configure **Option 2 (Auto-Expiring Ingress Window)** in the MongoDB Atlas console with a 24-hour expiration window during testing periods.

### 3.2 Owner Actions Required
To resolve this security blocker, the project owner should:
1. Log in to [Vercel Integrations](https://vercel.com/integrations/mongodbatlas).
2. Install the **MongoDB Atlas Integration** and link it to the `avani-ai-crm` project.
3. Select Atlas Organization `sachin's Org - 2026-10-30` and Project `AVANI AI CRM`.
4. Once verified, delete the standalone `0.0.0.0/0` rule in MongoDB Atlas (`Security → Network Access`).

### 3.3 Strict Adherence to Boundaries
Antigravity has executed **zero changes** to Atlas network rules or access lists. The security gate will remain classified as **`BLOCKED / CONDITIONAL`** until the owner completes the integration.
