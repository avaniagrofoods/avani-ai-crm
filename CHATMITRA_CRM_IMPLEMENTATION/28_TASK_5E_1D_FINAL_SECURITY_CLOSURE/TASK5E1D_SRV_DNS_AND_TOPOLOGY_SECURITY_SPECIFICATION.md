# TASK 5E.1D — SRV DNS & LIVE TOPOLOGY SECURITY SPECIFICATION
## POSITIVE TOPOLOGY PROOF VIA NATIVE DNS RESOLUTION (CLOSING THE GAP)

**Date:** 17 November 2026  
**Auditor:** Principal Security Engineer & Database Architect

---

## 1. THE FLAW OF NEGATIVE SUBSTRING CHECKS

In previous drafts, the topology check relied on a negative check:
`assert.strictEqual(address.includes('rhpn2gh'), false)`
This was identified as a critical security gap:
- Merely checking that a node does NOT contain `rhpn2gh` does not prove that it DOES belong to the authorized test cluster.
- A rogue cluster, misconfigured third-party Atlas host, or DNS spoofing could pass the check.

---

## 2. THE POSITIVE TOPOLOGY ALLOWLIST PROTOCOL

To establish mathematically that every connected replica set member belongs to the authorized test cluster without hardcoding dynamic shard hashes, the test runner must execute **Positive DNS-SRV Topology Reconciliation**:

```
                               [Authorized Test SRV Domain]
                       ('avani-ai-crm-test-cluster.xxxx.mongodb.net')
                                            │
                                            ▼
                    Query Official DNS: dns.resolveSrv('_mongodb._tcp.' + srvHost)
                                            │
                                            ▼
                  [Construct Authorized Discovered Node Set]
                 {'cluster-shard-00-00.xxxx.mongodb.net:27017',
                  'cluster-shard-00-01.xxxx.mongodb.net:27017',
                  'cluster-shard-00-02.xxxx.mongodb.net:27017'}
                                            │
                                            ▼
                         [Initiate Mongoose Test Connection]
                                            │
                                            ▼
                  [Inspect Live client.topology.description.servers]
                                            │
                                            ▼
          For EVERY active connected server address in live topology:
         assert.strictEqual(authorizedDiscoveredNodes.has(address), true)
```

### Invariants:
1. **Pre-Connection SRV Verification:** The parent SRV hostname must exist in `AUTHORIZED_TEST_SRV_HOSTS`.
2. **Native DNS Resolution:** Node.js native `dns.promises.resolveSrv('_mongodb._tcp.' + srvHost)` retrieves the authoritative SRV records for that parent domain.
3. **Positive Member Matching:** Every node reported by the live driver topology (`client.topology.description.servers`) must exist in the set returned by DNS for the authorized parent.
4. **Zero Tolerance:** If any connected server in the topology is NOT in the authorized DNS record set, the connection is **immediately aborted with a fatal security violation**.
