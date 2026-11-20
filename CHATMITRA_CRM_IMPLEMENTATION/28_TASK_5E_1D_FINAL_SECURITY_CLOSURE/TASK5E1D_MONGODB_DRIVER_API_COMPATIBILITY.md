# TASK 5E.1D — MONGODB DRIVER API COMPATIBILITY ASSESSMENT
## EVALUATION OF INSTALLED DRIVER CONTRACT (`mongodb` V7.2.0 / MONGOOSE V9.11.4)

**Audit Target:** Installed Driver Parser APIs  
**Dependency Reference:** `3-AVANI AI CRM/node_modules/mongodb` (Version 7.2.0)  
**Date:** 17 November 2026

---

## 1. EMPIRICAL API BEHAVIOR OF INSTALLED `MongoClient`

During forensic testing of `mongodb@7.2.0` in `3-AVANI AI CRM`, the driver contracts were verified without network access:

### Verified Driver Capabilities:
1. **In-Memory Instantiation:** Calling `new MongoClient(uri)` parses the connection string completely synchronously in-memory. Zero network, socket, or DNS activity occurs until `client.connect()` is invoked.
2. **SRV Discovery Hostname:** For `mongodb+srv://`, `client.options.srvHost` reliably exposes the parent domain (e.g. `rhpn2gh.mongodb.net`).
3. **Multi-Host Seed Array:** For `mongodb://`, `client.options.hosts` reliably exposes an array of `HostAddress` objects (`[{ host: 'host1', port: 27017 }, ...]`).
4. **Selected Database:** `client.options.dbName` exposes the parsed database pathname.
5. **SRV Port Rejection:** Instantiating `mongodb+srv://host:27017/db` throws native `MongoParseError: mongodb+srv URI cannot have port number`.
6. **Protocol Validation:** Invalid protocols throw native `MongoParseError: Invalid scheme...`.

---

## 2. CRITICAL DRIVER CONTRACT ANOMALY: MULTIPLE `@` IN AUTHORITY

### Empirical Discovery:
When tested with `mongodb://user@host1@host2/db`, the installed `MongoClient@7.2.0` did **NOT** throw an error!
- It parsed `user@host1` as the username.
- It parsed `host2` as the target host.

### Security Vulnerability:
If an attacker supplied:
`mongodb://user@rhpn2gh.mongodb.net@localhost:27017/avani_ai_crm_test`
A naive check inspecting credentials or loose string searches would see `rhpn2gh.mongodb.net` and become confused, or conversely, an attacker could smuggle credentials.

### Required Pre-Driver Sanitization Invariant:
Before invoking `new MongoClient(uri)`, `evaluateDatabaseIsolation()` must perform pre-parsing validation:
```typescript
// Extract authority section between '://' and the first '/' or '?'
const schemeEnd = uri.indexOf('://');
if (schemeEnd === -1) {
  return { allowed: false, error: "URI_MALFORMED", code: "URI_MALFORMED" };
}
const afterScheme = uri.slice(schemeEnd + 3);
const pathStart = afterScheme.search(/[/?]/);
const authority = pathStart !== -1 ? afterScheme.slice(0, pathStart) : afterScheme;

// Count unencoded '@' characters in authority
const atCount = (authority.match(/@/g) || []).length;
if (atCount > 1) {
  return {
    allowed: false,
    error: "URI_MALFORMED: Multiple @ characters detected in authority. Userinfo must be percent-encoded.",
    code: "URI_MALFORMED"
  };
}
```
This pre-check neutralizes userinfo smuggling before the driver parser executes.
