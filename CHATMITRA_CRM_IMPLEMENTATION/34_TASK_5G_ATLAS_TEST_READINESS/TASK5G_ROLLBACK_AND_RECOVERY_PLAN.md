# TASK 5G — ROLLBACK AND DISASTER RECOVERY RUNBOOK
**Project:** AVANI LOAN SERVICES — ChatMitra + AVANI AI CRM  
**Date:** 18 November 2026  
**Role:** Database Reliability Engineer & Systems Architect  
**Status:** **AUTHORITATIVE RECOVERY & ROLLBACK SPECIFICATION**

---

## 1. Executive Summary

This runbook defines the emergency response procedures, automated test data purge mechanisms, and code rollback instructions for AVANI AI CRM test operations.

Because Task 5G is strictly read-only planning:
1. **Production Impact is Zero:** The production cluster (`rhpn2gh.mongodb.net`, database `avani_ai_crm_prod`) is completely disconnected from test operations.
2. **Local Repository Stability:** Zero code modifications were introduced during Task 5G.

---

## 2. Test Database State Purge & Reset Procedure

When live integration testing (S45–S50) is authorized and executed in future phases, the test database (`avani_ai_crm_test`) can be completely reset to a clean state using the following automated procedures:

### Automated Synthetic Data Purge Script:
```javascript
// scripts/purge_test_database.cjs
const mongoose = require('mongoose');
const { connectToDatabase } = require('../src/lib/db.ts');

async function purgeTestDatabase() {
  if (process.env.APP_MODE === 'production' || process.env.VERCEL_ENV === 'production') {
    throw new Error("FATAL: Refusing to purge database under production environment flags!");
  }

  const conn = await connectToDatabase();
  if (!conn || conn.connection.name !== 'avani_ai_crm_test') {
    throw new Error(`FATAL: Target database '${conn?.connection?.name}' is NOT avani_ai_crm_test! Purge aborted.`);
  }

  console.log("Purging all synthetic collections in avani_ai_crm_test...");
  const collections = await conn.connection.db.collections();
  for (const col of collections) {
    if (!col.collectionName.startsWith('system.')) {
      await col.deleteMany({});
      console.log(`Cleared collection: ${col.collectionName}`);
    }
  }
  console.log("Test database reset successfully. Disconnecting.");
  await mongoose.disconnect();
}
```

---

## 3. Application Code Rollback Procedure

If at any point during planning or future phases, `src/lib/db.ts` requires rollback to an earlier verified state:

### Level 1: Rollback to Task 5F.2 Verified Baseline
- **Target Hash:** `A98D4B8AFFE7FD6414D7E42781FE72FA9ACC9A3462C40CA80FB9AAF96BB69904`
- **Verification:** Current working copy matches this hash with 100% precision.

### Level 2: Rollback to Pre-Task 5F.2 State (`db.ts.bak.pre_task5f2`)
- **Target Hash:** `E5F4292E8DB528167BC4AE0130B747C7958CD19F0852A2C7920ADCA8E1FE6F0F`
- **Command:**
  ```powershell
  cd "C:\Users\ALPHA-1\Downloads\21MAY2026\SACHIN SHINDE DOCUMENTS\DEVELOPEMENT TOOLS\3-AVANI AI CRM"
  Copy-Item "src\lib\db.ts.bak.pre_task5f2" "src\lib\db.ts" -Force
  ```

### Level 3: Full Rollback to Pristine Git Baseline (`8e4c011`)
- **Target Hash:** `15491D1DD5221CB96CA30C7A11DC2203C56847CDF53F3EDD966B20369BBDCA9D`
- **Command:**
  ```powershell
  cd "C:\Users\ALPHA-1\Downloads\21MAY2026\SACHIN SHINDE DOCUMENTS\DEVELOPEMENT TOOLS\3-AVANI AI CRM"
  Copy-Item "src\lib\db.ts.bak.pre_task5f" "src\lib\db.ts" -Force
  ```

---

## 4. Preservation of Unrelated Assets

- **Task 3B Opt-Out Fix:** The modification in `src/lib/optout-engine.ts` (`रोकें`, +3/-3 lines) is cryptographically pinned (`6856EA2815CF61262A37986AA5A246855A2DBBDFA9D986E5343301FCF6BFB804`) and must never be reverted during any database rollback.
- **Git Commit Cleanliness:** Because all operations executed in local working copies with zero commits, the git commit tree remains pristine.
