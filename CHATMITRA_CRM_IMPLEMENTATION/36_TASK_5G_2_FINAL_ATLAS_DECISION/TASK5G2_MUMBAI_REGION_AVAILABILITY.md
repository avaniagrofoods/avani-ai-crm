# TASK 5G.2 — AWS MUMBAI REGION FREE-TIER AVAILABILITY AUDIT
## RIGOROUS VERIFICATION OF AWS MUMBAI (`ap-south-1`) AGAINST OFFICIAL ATLAS DOCUMENTATION

**Project:** AVANI LOAN SERVICES — ChatMitra + AVANI AI CRM  
**Date:** 18 November 2026  
**Execution Mode:** STRICTLY READ-ONLY DOCUMENTATION AUDIT  
**Authority:** Task 5G.2 Regional Availability Review  
**Official Reference:** https://www.mongodb.com/docs/atlas/reference/amazon-aws/  

---

### 1. OBJECTIVE & STRICT AUDIT PROTOCOL

Section 4 of the Master Instruction mandates:
- Verify whether AWS Mumbai `ap-south-1` actually offers the Free/M0 cluster option based on official documentation.
- **Do not treat the existence of Mumbai as a supported AWS region as proof that M0 is available there.**
- If the documentation does not conclusively identify the Free-tier availability marker, **mark the result as `REQUIRES ATLAS UI CONFIRMATION`**.
- **Do not create an Atlas project or cluster to test availability.**

---

### 2. EXAMINATION OF OFFICIAL DOCUMENTATION: `amazon-aws` REFERENCE TABLE

The official MongoDB Atlas documentation page for AWS regions (`https://www.mongodb.com/docs/atlas/reference/amazon-aws/`) maintains the master registry of AWS regions supported by Atlas:

| Documentation Column | Documented Value for Mumbai | Notes & Analysis |
| :--- | :--- | :--- |
| **AWS Region Name** | Asia Pacific (Mumbai) | Confirms AWS infrastructure presence. |
| **AWS Region Code** | `ap-south-1` | Standard AWS region identifier. |
| **Atlas Region API Name**| `AP_SOUTH_1` | Identifier used in Atlas Admin API / Terraform. |
| **Default VPC CIDR** | `192.168.0.0/21` | Applicable to Dedicated clusters (M10+). |
| **Dedicated Cluster (M10+)**| **SUPPORTED** | Explicitly supported as a primary AWS region. |
| **Free-Tier Availability Marker**| **NOT CONCLUDED IN STATIC TABLE** | The static documentation table lists cloud regions and network blocks, but **does not publish a static column indicating M0 Free Tier availability per region**. |

---

### 3. WHY FREE-TIER AVAILABILITY IS DYNAMIC IN ATLAS

MongoDB Atlas documentation on Free/Shared clusters (`https://www.mongodb.com/docs/atlas/reference/free-shared-limitations/`) explains why Free-tier availability cannot be guaranteed from a static reference page:

1. **Capacity Management:** MongoDB dynamically allocates shared multi-tenant host clusters for M0 tiers based on real-time data center capacity across AWS regions.
2. **Selective Availability:** Not all AWS regions offer Free tiers at all times. While major hub regions (e.g., `us-east-1`, `eu-west-1`, `ap-south-1`) frequently host M0 shared clusters, capacity limits can temporarily restrict new M0 provisioning in specific regions.
3. **Official Verification Method:** MongoDB officially instructs users to verify real-time Free-tier availability through:
   - The interactive **Atlas Web UI** (under "Deploy a Database -> Shared / Free -> Region Dropdown").
   - The Atlas CLI command:
     ```bash
     atlas cluster availableRegions list --provider AWS --tier M0
     ```

---

### 4. FORMAL DETERMINATION

In strict compliance with the project instructions:

$$\mathbf{DETERMINATION:\ REQUIRES\ ATLAS\ UI\ CONFIRMATION}$$

#### DETAILED AUDIT FINDINGS:
1. **AWS Mumbai (`ap-south-1`) presence:** Conclusively verified for MongoDB Atlas general deployment.
2. **Dedicated Tier (M10+) in Mumbai:** Conclusively verified.
3. **Free/M0 Tier in Mumbai:** Highly probable based on historical deployment telemetry, but **lacks an explicit, permanent static marker in the official documentation**.
4. **Mandatory Action Before Provisioning:** When the Owner or administrator logs into the MongoDB Atlas Console to provision the test cluster, they must verify that **Mumbai (ap-south-1)** is selectable under the **Free / M0** tier.
5. **Fallback Region:** If Mumbai is temporarily at capacity for M0 in the Atlas UI, the Owner may select **Singapore (`ap-southeast-1`)** as an immediate, low-latency alternative in the Asia-Pacific geography.

---

### 5. PROHIBITED ACTION ADHERENCE

Antigravity **has not** created an Atlas account, project, or cluster to test regional availability. The finding remains documented as **REQUIRES ATLAS UI CONFIRMATION** pending Owner UI inspection.
