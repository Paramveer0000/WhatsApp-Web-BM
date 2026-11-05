# WhatsApp Campaign Engine Stability & Architecture Report

## 1. Executive Summary

During high-volume campaign execution, the campaign dispatch loop became unstable, showing rapid repeated retry storms (13–18 ms loops), false-positive circuit breaker trips, and sporadic timeouts. 

Through analysis of the **Evolution API v2.3.7** container logs and the background worker execution traces, the root cause was identified, isolated, and permanently resolved. Full test suites and simulation audits were constructed, achieving **82/82 passing automated tests**.

---

## 2. Root Cause Analysis (With Timeline Evidence)

### A. The 13–18 ms Retry Storm on HTTP 400 Bad Request
**Evidence from Evolution API v2.3.7 Container Logs:**
```log
13:58:22.606  (error body) status 400 'Bad Request', message:[{ jid:'918872045605@s.whatsapp.net', exists:false, number:'918872045605' }]
13:58:22.624  VERBOSE  Checking 1 numbers via Baileys (not found in cache)     <- immediate retry 18 ms later
13:58:22.778  ERROR 400 Bad Request ... exists:false
13:58:22.791  VERBOSE  Checking 1 numbers via Baileys                          <- immediate retry 13 ms later
13:58:22.945  ERROR 400 ... exists:false
13:58:24.457  VERBOSE  Checking 1 numbers ...                                  <- retrying over and over
```

**Underlying Causes:**
1. **Unrecognized Error Payload Shape:** Evolution API formats non-existent WhatsApp numbers as HTTP 400 with `message` as an array: `message: [{ exists: false, jid: '...', number: '...' }]`. The client previously expected string error messages and failed to parse this nested array, categorizing the response as an unclassified error.
2. **Missing Retry Policy in `campaign-runner.ts`:** In the worker dispatch loop, when checking `RETRY_WAIT` candidates, unclassified errors were requeued directly into `QUEUED` with zero backoff delay. The `findFirst({ status: { in: ['PENDING', 'QUEUED'] } })` immediately picked the same recipient on the next iteration (~13 ms later), flooding WhatsApp with lookup requests for an invalid number.
3. **Circuit Breaker Contamination:** The `CircuitBreaker.recordFailure()` method was being called on every error, including recipient-level errors. As a result, 3 to 5 invalid numbers in a campaign tripped the circuit breaker to `open`, halting the instance and halting healthy campaigns.
4. **Pacing Delay Consumption on Skipped Contacts:** When an invalid number failed, the worker was sleeping for the full human jitter delay (12–25s) before moving on.

---

## 3. Implemented Fixes

### A. Error Taxonomy & Mapping (`src/lib/evolution.ts`)
- Deep array inspection in `EvolutionClient.classifyError`:
  - Detects `data?.message` or `data?.response?.message` array items containing `exists === false`.
  - Extracts the recipient's `number` and `jid`.
  - Instantiates `InvalidRecipientError` with `code = 'NOT_ON_WHATSAPP'` and `isPermanent = true`.
- Clean error categorization:
  - `401 / 403` $\to$ `AuthError` (permanent)
  - `404` $\to$ `InstanceNotFoundError` (permanent)
  - `400 Connection Closed` $\to$ `SessionClosedError` (permanent)
  - `429` $\to$ `RateLimitedError` (retryable)
  - `5xx / timeout / fetch failed` $\to$ `TransientError` (retryable)
  - Unrecognized `400` errors are marked permanent by default to avoid infinite retry storms.
- Fast candidate host abort in `request()`: Permanent errors immediately throw without cycling through backup host endpoints.

### B. Retry Policy & Exponential Backoff (`src/lib/retry-policy.ts`)
- Added `calculateRetryBackoff(attempt)`:
  - Enforces exponential backoff: **30s** (attempt 1), **120s** (attempt 2), **480s** (attempt 3) with randomized jitter ($\pm 15\%$).
  - Hard constraint: Delay is **never less than 5,000 ms**.
- Added `isErrorRetryable(err)`:
  - Returns `false` for `InvalidRecipientError`, `AuthError`, `InstanceNotFoundError`, `SessionClosedError`, and any `isPermanent: true`.
  - Only `TransientError` and `RateLimitedError` may retry.

### C. Campaign Runner & State Machine Optimization (`src/lib/queue/campaign-runner.ts`)
- **Circuit Breaker Protection:** Recipient errors (`NOT_ON_WHATSAPP` / `InvalidRecipientError`) never increment instance consecutive failures and never call `CircuitBreaker.recordFailure()`.
- **Fast Pacing for Skipped Numbers:** Non-WhatsApp contacts trigger a short 1.5s gap instead of the 12–25s human pacing delay.
- **Auto-Reassignment of Message Variants:** When an invalid number is skipped, the exact variant assigned to that contact is automatically reassigned to the next pending contact so message variety and delivery balance are preserved.
- **Contact Database Synchronization:** On `NOT_ON_WHATSAPP`, the recipient status is set to `SKIPPED`, and the contact in `db.contact` is marked with `waExists = false` and `waCheckedAt = new Date()`.
- **Backoff Enforcement in RETRY_WAIT:** Transient errors must satisfy `elapsed >= calculateRetryBackoff(attempts)` before they can be requeued.

### D. Upstream Exclusion & Number Verification (`src/app/api/campaigns/route.ts` & `src/app/api/contacts/verify/route.ts`)
- **30-Day TTL Exclusion:** Any contact with `waExists === false` verified within the past 30 days is automatically filtered out when creating new campaigns across all audience modes (`ALL_CONTACTS`, `UNASSIGNED_CONTACTS`, contact lists, and manual imports).
- **Batch Pre-Verification Endpoint:** Created `POST /api/contacts/verify` allowing batch verification (50 numbers per batch) against Evolution API (`POST /chat/whatsappNumbers/:instance`) with database caching.

### E. Robustness & Webhook Enhancements (`src/app/api/webhooks/evolution/route.ts`)
- **`@lid` JID Resilience:** Handled WhatsApp Privacy LID JIDs (`...@lid`). The webhook now resolves `@lid` inbound replies to the original recipient via context info `stanzaId` and outbound mapping, eliminating crashes and bogus contact creation.
- **Media Optimization:** Base64 payloads resolved to direct URLs (`/api/media/[file]`) avoiding Evolution API internal base64 buffer parse timeouts (`fetch failed`).

---

## 4. Verification & Test Evidence

All 82 automated test cases pass in Vitest across 8 test suites:

| Test Suite | Tests Passed | Coverage Highlights |
|---|:---:|---|
| `test/stability-audit.test.ts` | **13/13** | Exact 400 `exists:false` array fixture parsing, retry policy monotonic delay, 100-contact simulation (80 sent, 20 skipped, 0 retries on invalid, circuit breaker untouched). |
| `test/app.test.ts` | **25/25** | State machine transitions, monotonic status guard (`SENT` $\to$ `DELIVERED` $\to$ `READ`), spintax engine, phone normalization. |
| `test/guardrails.test.ts` | **13/13** | Pacing calculations, batch break cooldowns, human jitter pauses. |
| `test/rotation.test.ts` | **13/13** | Multi-message distribution, weight allocations, duplicate detection. |
| `test/distribution.test.ts` | **7/7** | Two-layer instance/message allocation. |
| `test/advisor.test.ts` | **5/5** | AI variant evaluation & token metrics. |
| `test/audit-fixes.test.ts` | **4/4** | Webhook deduplication, secret verification. |
| `test/scheduled-campaigns.test.ts` | **2/2** | Scheduling engine, date calculations. |
| **Total** | **82/82** | **100% Pass Rate** |

---

## 5. Operational Guidelines & Evolution API Config

1. **Evolution API Environment Variables:**
   - Set `LOG_LEVEL=ERROR,WARN` in production instead of `DEBUG/VERBOSE` to cut container CPU usage.
   - Set `TZ=Asia/Kolkata` across containers to synchronize scheduling windows and logs.
   - Configure Webhook events: subscribe only to `CONNECTION_UPDATE`, `MESSAGES_UPDATE`, `MESSAGES_UPSERT`.
2. **Instance Concurrency:** Maintain concurrency of 1 in-flight message per instance lane to avoid Baileys rate-limiting.
3. **Pacing Rules:** Standard pacing: 12–25s random delay. Skipped invalid contacts: 1.5s gap.
