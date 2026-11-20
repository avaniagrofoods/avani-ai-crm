# TASK 5G: EXECUTIVE READINESS & ARCHITECTURAL PLANNING REPORT
**Project:** AVANI LOAN SERVICES — ChatMitra + AVANI AI CRM  
**Date:** 18 November 2026  
**Role:** Senior MongoDB Atlas Architect, Application Security Engineer & DevSecOps Consultant  
**Execution Mode:** STRICTLY READ-ONLY PLANNING (Zero Network Requests, Zero Cloud Provisioning, Zero DB Sockets)  
**Deliverables Directory:** `CHATMITRA_CRM_IMPLEMENTATION/34_TASK_5G_ATLAS_TEST_READINESS/`

---

## 1. Executive Summary

Following the formal approval of Task 5F.3 for isolated test environment planning, **Task 5G** establishes the complete architectural, operational, security, model/index, and economic blueprint for provisioning and integrating a separate, dedicated MongoDB test environment for AVANI AI CRM.

This plan guarantees that:
1. **Zero Production Contamination:** The production MongoDB cluster (`rhpn2gh.mongodb.net`, database `avani_ai_crm_prod`) remains 100% isolated, unreferenced, and physically unreachable from any non-production execution context.
2. **Dedicated Cloud Infrastructure:** The test environment is designed to reside in a completely separate MongoDB Atlas project (`AVANI-AI-CRM-TESTING`) hosted in the same cloud region (AWS Mumbai `ap-south-1`) to eliminate cross-project permission leakage and network latency.
3. **Hardware Constraint Awareness:** The local workstation host (RAM ~3.90 GB, available RAM ~268 MB, Drive D: nearly exhausted) cannot host a local `mongod` instance without risking OS crash or swapping. A lightweight cloud Atlas cluster or in-memory mock harness is mandatory.
4. **Complete Schema Parity:** All 18 Mongoose models and 42 custom declared secondary/unique indexes are fully mapped to ensure that live integration testing (scenarios S45–S50) tests true production database behavior (unique constraints, idempotency, atomic leasing, and TTL eviction).

---

## 2. High-Level Architectural Recommendations

```
┌────────────────────────────────────────────────────────────────────────────────────────┐
│ MONGODB ATLAS ORGANIZATION: AVANI LOAN SERVICES                                        │
├──────────────────────────────────────────┬─────────────────────────────────────────────┤
│ PRODUCTION ENVIRONMENT (EXISTING)       │ TEST ENVIRONMENT (PROPOSED - TASK 5G)       │
├──────────────────────────────────────────┼─────────────────────────────────────────────┤
│ Project: Production Core                 │ Project: AVANI-AI-CRM-TESTING               │
│ Cluster: Cluster0 (rhpn2gh.mongodb.net)  │ Cluster: avani-ai-crm-test-cluster          │
│ Cloud / Region: AWS ap-south-1 (Mumbai)  │ Cloud / Region: AWS ap-south-1 (Mumbai)     │
│ Tier: Production Dedicated               │ Tier: M0 (Sandbox Free) or M2/M5 (Shared)   │
│ Database: avani_ai_crm_prod              │ Database: avani_ai_crm_test (EXCLUSIVELY)   │
│ DB User: prod_app_user                   │ DB User: als_crm_test_worker                │
│ Access: Production Vercel only           │ Access: Specific Developer / Preview IPs    │
└──────────────────────────────────────────┴─────────────────────────────────────────────┘
```

---

## 3. Key Readiness Dimensions Assessed

| Planning Dimension | Recommended Specification | Security & Operational Rationale | Status |
| :--- | :--- | :--- | :--- |
| **Project Boundary** | Separate Atlas Project (`AVANI-AI-CRM-TESTING`) | Project-level IAM isolation prevents accidental cross-cluster access or key reuse | **ARCHITECTED** |
| **Cluster Tier** | M0 (Sandbox) or M2 (Shared) | M0 provides 512 MB storage and 500 connections at $0 cost; M2 provides backups at ~$9/mo | **EVALUATED** |
| **Region** | AWS `ap-south-1` (Mumbai) | Minimal network round-trip latency (<15 ms) from Indian hosting endpoints | **RECOMMENDED** |
| **Database Identity** | `avani_ai_crm_test` exclusively | Conforms to strict Task 5F.2 runtime isolation policy; preview DBs rejected | **ENFORCED** |
| **Host Domain Validation**| `MONGODB_TEST_CLUSTER_DOMAIN` set to exact test hostname | Prevents rogue/spoofed domains; fails closed if unset or containing `rhpn2gh` | **ENFORCED** |
| **Data Policy** | 100% Synthetic Test Data Only | Zero production customer records copied; zero PII leakage risk | **MANDATORY** |
| **Model & Index Parity** | 18 Models, 42 Declared Indexes | Full parity with production schemas for rigorous idempotency & uniqueness testing | **MAPPED** |
| **Local Host Safety** | No local `mongod` daemon | Conserves critical workstation memory (~268 MB free physical RAM) | **PROTECTED** |

---

## 4. Master Stop Condition & Boundaries

> [!CAUTION]
> **READ-ONLY PLANNING RESTRICTION:**  
> Task 5G is strictly an architectural, security, and test design task.  
> **NO Atlas resources have been created.**  
> **NO database connections have been made.**  
> **NO application code has been modified.**  
> Explicit written owner authorization is required before any cloud provisioning or live integration testing occurs.
