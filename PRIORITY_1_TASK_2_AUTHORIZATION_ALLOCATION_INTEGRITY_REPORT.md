# IRFA / DFCS — Priority 1, Task 2 Completion Report
## Authorization & Monthly Allocation Integrity

**Date:** November 27, 2026  
**System:** Digital Fuel Coupon System (IRFA / DFCS)  
**Phase:** Priority 1 — Production Security & Workflow Hardening  
**Task:** Task 2 — Authorization & Monthly Allocation Integrity  
**Status:** COMPLETE & FULLY VERIFIED (All 17 Scenarios Passing, 100% Regression Integrity)

---

## 1. Executive Summary

In accordance with the Priority 1, Task 2 directive, we have addressed the disconnect between Agriculture's `MonthlyAllocation` lifecycle and the Trade Office's `FuelAuthorization` creation and lifecycle.

Prior to this remediation:
- The Trade Office request approval endpoint (`POST /api/trade/review-request/:id`) created `FuelAuthorization` coupons without checking whether the farmer had an active `MonthlyAllocation` for that period, fuel type, or whether previous active authorizations already reserved that farmer's quota ceiling.
- No authorization revocation/cancellation mechanism existed, leaving orphaned or cancelled authorizations unmanaged and unable to release unused quota back to the farmer's monthly quota.
- Dispensing logic lacked explicit active status enforcement on `MonthlyAllocation`.

This implementation bridges this gap with transactional accounting, row-level concurrency serialization, locking reads, and administrative coupon revocation.

---

## 2. Implemented Business Safeguards & Architectural Accounting Rules

### Rule 1: Mandatory Active Monthly Allocation Requirement
- Trade Office approvals (`POST /api/trade/review-request/:id`) now strictly require an existing `MonthlyAllocation` record for `(farmerId, fuelTypeId, periodMonth, periodYear)`.
- If no allocation exists, the review is atomically rejected with HTTP `400` and code `NO_MONTHLY_ALLOCATION`.
- If the allocation exists but `status !== 'ACTIVE'`, the review is rejected with HTTP `400` and code `ALLOCATION_INACTIVE`.

### Rule 2 & 3: Allocation Ceiling & Outstanding Reservation Enforcement
- The system enforces a zero-double-accounting mathematical model:
  $$\text{Alloc Remaining} = \text{Un-dispensed Quota}$$
  $$\text{Outstanding Reserved} = \sum_{\substack{\text{auth} \in \text{ACTIVE auths} \\\text{id} \neq \text{currentRequestItem}}} \text{auth.remainingLiters}$$
  $$\text{Available to Authorize} = \text{Alloc Remaining} - \text{Outstanding Reserved}$$
- If $\text{Approved Liters} > \text{Available to Authorize}$, the review fails atomically with HTTP `400` and code `ALLOCATION_LIMIT_EXCEEDED`.
- Multiple authorizations for the same farmer and period are collectively bounded by the monthly allocation ceiling.

### Rule 4: Strict Period Boundary Enforcement
- Approvals check that the `fuelRequest.periodMonth` and `periodYear` match the farmer's monthly allocation period and create `validFrom` (1st of month) and `validTo` (end of month) bounds. An allocation for Month 10 cannot authorize requests for Month 11.

### Rule 5: Dual-Ledger Dispensing Integrity
- Dispensing (`POST /api/transactions/dispense`) requires a valid, active `MonthlyAllocation` matching the authorization period.
- Dispensing atomically decrements both `fuel_authorizations.remainingLiters` and `monthly_allocations.remainingLiters` using conditional raw SQL updates with row-level locks, guaranteeing that overdraw is physically impossible even under heavy concurrent loads.

### Rule 6: Administrative Revocation & Quota Release
- Implemented `PATCH /api/trade/authorizations/:id/revoke` (and `POST /api/trade/authorizations/:id/revoke`) restricted to `TRADE_OFFICE`.
- When an active authorization is revoked:
  1. Its status transitions from `ACTIVE` to `REVOKED`.
  2. Any active station assignments are transitioned to `REVOKED`.
  3. The unused `remainingLiters` is immediately released back into the farmer's available quota because `REVOKED` authorizations are excluded from `Outstanding Reserved`.
  4. Physically dispensed fuel (`consumedLiters` / `usedLiters`) remains immutable and is not released.
  5. The action is logged to the immutable `audit_logs` table.

### Rule 7: Revocation Idempotency & Exhaustion Protection
- Attempting to revoke an already `REVOKED` authorization returns HTTP `400 AUTHORIZATION_ALREADY_REVOKED`.
- Attempting to revoke an `EXHAUSTED` coupon (`remainingLiters = 0`) returns HTTP `400 AUTHORIZATION_EXHAUSTED`.
- Revoked authorizations cannot be dispensed at fuel stations (rejected with HTTP `400 AUTHORIZATION_NOT_ACTIVE` or scanner rejection `AUTHORIZATION_REVOKED`).

### Rule 8: Race Condition Protection on Concurrent Approvals & Dispenses
- In `trade.controller.ts`, approvals acquire an exclusive write lock on `monthly_allocations` (`UPDATE monthly_allocations SET updatedAt = NOW() WHERE id = ...`) and perform locking reads (`SELECT SUM(remainingLiters) ... FOR UPDATE`) on `fuel_authorizations`.
- This serializes concurrent review requests against the same farmer and eliminates MVCC snapshot stale read races.

---

## 3. Code Modifications

| Component | File | Changes Implemented |
|---|---|---|
| **Trade Controller** | `server/src/controllers/trade.controller.ts` | 1. Added `AllocationValidationError` class.<br>2. Added period allocation validation and quota reservation calculation inside `reviewRequest`.<br>3. Added row-level lock serialization and locking reads (`FOR UPDATE`).<br>4. Added `revokeAuthorization` endpoint handler with status validation, station assignment cancellation, and audit trail.<br>5. Added `{ maxWait: 20000, timeout: 45000 }` to interactive `$transaction` calls for TiDB remote latency resilience. |
| **API Router** | `server/src/routes/index.ts` | Registered `PATCH /trade/authorizations/:id/revoke` and `POST /trade/authorizations/:id/revoke` protected by `authenticateJWT` and `requireRole('TRADE_OFFICE')`. |
| **Transaction Controller** | `server/src/controllers/transaction.controller.ts` | Added strict verification that `MonthlyAllocation` exists and is `ACTIVE` before dispensing fuel. |
| **Verification Controller** | `server/src/controllers/verification.controller.ts` | Added explicit `AUTHORIZATION_REVOKED` detection for scanner checks and reinforced `MonthlyAllocation` active status verification. |

*Zero schema changes or database migrations were required. Existing schema enums and relations fully supported all requirements.*

---

## 4. Test Suite Execution & Verification Results

### Dedicated Test Suite: `server/test_priority1_task2_allocation_authorization_integrity.ts`
All 17 required scenarios were tested end-to-end against the database:

| # | Scenario Description | Tested Condition | Result |
|---|---|---|---|
| **1** | Authorization with valid monthly allocation | Farmer has 200 L allocation; request for 80 L approved. Auth created with 80 L authorized/remaining, status `ACTIVE`. | **PASS** |
| **2** | Authorization without allocation | Farmer has no allocation; request review rejected with HTTP 400 `NO_MONTHLY_ALLOCATION`. No auth created. | **PASS** |
| **3** | Authorization exceeds available allocation | Farmer has 120 L available; request asks 150 L. Review rejected with HTTP 400 `ALLOCATION_LIMIT_EXCEEDED`. | **PASS** |
| **4** | Multiple active auths exceeding allocation | Request A approved for 60 L against 100 L allocation. Request B for 50 L rejected with `ALLOCATION_LIMIT_EXCEEDED`. | **PASS** |
| **5** | Authorization for incorrect month | Allocation exists for Month 10; request for Month 11 rejected with HTTP 400 `NO_MONTHLY_ALLOCATION`. | **PASS** |
| **6** | Dispensing decreases both ledgers | Dispensing 25 L decrements Auth (35 L remaining) and Allocation (75 L remaining) atomically. | **PASS** |
| **7** | Dispensing exceeds auth remaining | Requesting 40 L against 35 L auth remaining rejected with HTTP 400 `QUOTA_EXCEEDED`. Balances untouched. | **PASS** |
| **8** | Dispensing exceeds alloc remaining | Auth has 35 L, allocation has 15 L. Requesting 20 L rejected with HTTP 400 `MONTHLY_ALLOCATION_EXCEEDED`. | **PASS** |
| **9** | Concurrent authorization race protection | Two concurrent approval requests of 50 L each against 70 L allocation. Exactly 1 succeeded, 1 safely rejected. Total active auths = 50 L <= 70 L. | **PASS** |
| **10** | Concurrent dispensing race protection | 4 concurrent dispenses of 10 L against 30 L allocation. Exactly 3 succeeded, 1 rejected. Allocation reached exactly 0 L (`EXHAUSTED`). | **PASS** |
| **11** | Cancelled/revoked auth cannot be dispensed | Revoking auth via `PATCH /trade/authorizations/:id/revoke` blocks subsequent dispensing with HTTP 400 `AUTHORIZATION_NOT_ACTIVE`. | **PASS** |
| **12** | Cancellation releases unused reserved quantity | Revoking 50 L auth releases 50 L back to available quota. Subsequent 80 L request previously blocked now succeeds. | **PASS** |
| **13** | Revocation idempotency & double release defense | Revoking already revoked auth returns 400 `AUTHORIZATION_ALREADY_REVOKED`. Revoking exhausted auth returns 400 `AUTHORIZATION_EXHAUSTED`. | **PASS** |
| **14** | Expired authorization cannot be dispensed | Dispensing against auth with `validTo` in the past rejected with HTTP 400 `AUTHORIZATION_EXPIRED`. | **PASS** |
| **15** | Idempotent dispensing retry protection | First dispense returns 201; replayed request with identical idempotencyKey returns 200 with cached receipt. Balances decremented once. | **PASS** |
| **16** | Failed transaction atomic rollback | Invalid dispensing attempt rejected with 400; both ledgers remained completely consistent and untouched. | **PASS** |
| **17** | Scanner verification respects status | Station scanner rejects farmer whose authorization was revoked (`QUOTA_EXHAUSTED` / `AUTHORIZATION_REVOKED`). | **PASS** |

**Summary: 35 / 35 Passed (100%)**

---

## 5. Full Regression Verification

1. **Priority 0 Regression Suite (`test_priority0_seed_and_dispensing.ts`):**  
   - 25 / 25 Passed (100%).  
   - Deterministic official seed coverage (21 stations, 4 sub-cities, 45 kebeles), station-to-subcity enforcement, atomic dispensing, and concurrency burst protection remain completely intact.
2. **Priority 1, Task 1 Regression Suite (`test_priority1_task1_photo_security.ts`):**  
   - 27 / 27 Passed (100%).  
   - Public static `/uploads` removal, authenticated farmer photo streaming, role-based access control, and directory traversal defense remain completely intact.
3. **Type Safety & Build Integrity:**  
   - `npx tsc --noEmit` in `server`: 0 errors.  
   - `npm run build` in `client`: 0 errors (Vite production bundle built cleanly in 11.25s).  
   - `git diff --check`: 0 whitespace or formatting issues.

---

## 6. Next Steps & Scope Boundary Notice

Priority 1, Task 2 is formally completed and verified. In accordance with strict instructions:
- No database seed or sample data reconciliation was conducted.
- No schema migrations were executed.
- Task 3 is NOT started.
- Awaiting project owner review and authorization before proceeding.
