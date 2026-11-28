# IRFA / Digital Fuel Coupon System
## Priority 1, Task 4: Comprehensive Role-Based Access Control (RBAC) & Authorization Audit Report

**Date:** November 27, 2026  
**Status:** COMPLETE & VERIFIED  
**Test Suite:** `server/test_priority1_task4_rbac_authorization.ts` (61 / 61 assertions passed — 100%)  
**Regression Suites:** 210 / 210 total assertions passed across Priority 0 and Priority 1 Tasks 1–4  

---

## 1. Executive Summary

This report documents the completion of **Priority 1, Task 4: Comprehensive Role-Based Access Control (RBAC) & Authorization Audit** for the Digital Fuel Coupon System (IRFA).

Prior to this task, the application relied on coarse-grained role guards on some operational endpoints, while operational read routes (`/farmers`, `/allocations`, `/fuel-requests`, `/trade/authorizations`, `/reports/*`) only checked `disallowAdminOperational`. This left critical access gaps where:
1. `STATION_ADMIN` users could browse the entire farmer registry, monthly allocations, city-wide trade authorizations, and fuel requests between Agriculture and Trade Offices.
2. Station operators could query or export transaction ledgers belonging to other fuel stations by tampering with the `stationId` query parameter (cross-station IDOR).
3. The React frontend (`client/src/routes/AppRoutes.tsx`) rendered all route components without role gates inside `<MainLayout />`, allowing UI routes to be opened directly in the URL bar.
4. Administrative user management endpoints allowed administrators to deactivate or demote themselves, creating a risk of accidental administrator lockout.

All identified vulnerabilities have been remediated with strict backend authorization middlewares, cross-station data-scoping guards, privilege escalation defenses, and frontend route protection, verified by a comprehensive 61-assertion automated test suite and regression across all prior milestones.

---

## 2. Identified Application Roles

The system uses four canonical operational roles defined in the Prisma schema `enum UserRole`:

| Role Name | Scope & Authority | Primary Responsibilities |
|---|---|---|
| `SYSTEM_ADMIN` | Technical & Administrative | User provisioning, audit log inspection, system health, platform settings. **Strictly prohibited** from operational workflows (cannot view farmers, cannot approve requests, cannot dispense fuel). |
| `AGRICULTURE_OFFICE` | Agricultural Operational Authority | Farmer registration, photo management, monthly allocation management, fuel request initiation & resubmission, card lifecycle management. |
| `TRADE_OFFICE` | Regulatory & Approval Authority | Fuel request review & quota approval, fuel authorization management & revocation, station-subcity quota assignment, station representative oversight, shortage incident management. |
| `STATION_ADMIN` | Dispensing & Station Operational | Station-scoped farmer QR validation, fuel dispensing, station-scoped transaction history, station-scoped shortage reporting, station-scoped operational reports. |

---

## 3. Comprehensive Role-Permission Matrix

The table below details the enforced permissions across all application modules:

| Functional Module | Endpoint / Operation | `SYSTEM_ADMIN` | `AGRICULTURE_OFFICE` | `TRADE_OFFICE` | `STATION_ADMIN` | Enforcement Mechanism |
|---|---|:---:|:---:|:---:|:---:|---|
| **Authentication** | `POST /auth/login` | Permitted | Permitted | Permitted | Permitted | Public (valid credentials) |
| | `GET /auth/me` | Permitted | Permitted | Permitted | Permitted | `authenticateJWT` |
| | `PUT /auth/profile` | Permitted | Permitted | Permitted | Permitted | `authenticateJWT` (role/id immutable) |
| **User Administration** | `GET /system/users` | Permitted | Denied (403) | Denied (403) | Denied (403) | `requireRole('SYSTEM_ADMIN')` |
| | `POST /system/users` | Permitted | Denied (403) | Denied (403) | Denied (403) | `requireRole('SYSTEM_ADMIN')` |
| | `PUT /system/users/:id` | Permitted | Denied (403) | Denied (403) | Denied (403) | `requireRole('SYSTEM_ADMIN')` + self-lockout guard |
| | `GET /system/audit-logs` | Permitted | Denied (403) | Denied (403) | Denied (403) | `requireRole('SYSTEM_ADMIN')` |
| | `GET /system/settings` | Permitted | Denied (403) | Denied (403) | Denied (403) | `requireRole('SYSTEM_ADMIN')` |
| **Farmer Management** | `GET /farmers` | Denied (403) | Permitted | Permitted | Denied (403) | `requireRole('AGRICULTURE_OFFICE', 'TRADE_OFFICE')` |
| | `POST /farmers` | Denied (403) | Permitted | Denied (403) | Denied (403) | `requireRole('AGRICULTURE_OFFICE')` |
| | `GET /farmers/:id` | Denied (403) | Permitted | Permitted | Denied (403) | `requireRole('AGRICULTURE_OFFICE', 'TRADE_OFFICE')` |
| | `PUT /farmers/:id` | Denied (403) | Permitted | Denied (403) | Denied (403) | `requireRole('AGRICULTURE_OFFICE')` |
| | `GET /farmers/:id/photo` | Denied (403) | Permitted | Permitted | Permitted* | `authenticateJWT` + operational guard (*station dispensing) |
| | `POST /farmers/:id/photo` | Denied (403) | Permitted | Denied (403) | Denied (403) | `requireRole('AGRICULTURE_OFFICE')` |
| **Allocations** | `GET /allocations` | Denied (403) | Permitted | Permitted | Denied (403) | `requireRole('AGRICULTURE_OFFICE', 'TRADE_OFFICE')` |
| | `POST /allocations` | Denied (403) | Permitted | Denied (403) | Denied (403) | `requireRole('AGRICULTURE_OFFICE')` |
| | `GET /allocations/summary`| Denied (403) | Permitted | Permitted | Denied (403) | `requireRole('AGRICULTURE_OFFICE', 'TRADE_OFFICE')` |
| **Fuel Requests** | `GET /fuel-requests` | Denied (403) | Permitted | Permitted | Denied (403) | `requireRole('AGRICULTURE_OFFICE', 'TRADE_OFFICE')` |
| | `POST /fuel-requests` | Denied (403) | Permitted | Denied (403) | Denied (403) | `requireRole('AGRICULTURE_OFFICE')` |
| | `POST /fuel-requests/:id/review` (Agri) | Denied (403) | Permitted | Denied (403) | Denied (403) | `requireRole('AGRICULTURE_OFFICE')` |
| | `POST /trade/requests/:id/review` (Trade) | Denied (403) | Denied (403) | Permitted | Denied (403) | `requireRole('TRADE_OFFICE')` |
| **Authorizations** | `GET /trade/authorizations`| Denied (403) | Permitted | Permitted | Denied (403) | `requireRole('TRADE_OFFICE', 'AGRICULTURE_OFFICE')` |
| | `PATCH /trade/authorizations/:id/revoke` | Denied (403) | Denied (403) | Permitted | Denied (403) | `requireRole('TRADE_OFFICE')` |
| **Station Representatives** | `GET /trade/representatives` | Denied (403) | Denied (403) | Permitted | Denied (403) | `requireRole('TRADE_OFFICE')` |
| | `POST /trade/representatives` | Denied (403) | Denied (403) | Permitted | Denied (403) | `requireRole('TRADE_OFFICE')` |
| **Station Allocations** | `GET /trade/station-allocations` | Denied (403) | Denied (403) | Permitted | Denied (403) | `requireRole('TRADE_OFFICE')` |
| | `PUT /trade/station-allocations/station/:id` | Denied (403) | Denied (403) | Permitted | Denied (403) | `requireRole('TRADE_OFFICE')` |
| **Dispensing & Verification** | `POST /verify` | Denied (403) | Denied (403) | Denied (403) | Permitted | `requireRole('STATION_ADMIN')` + `requireStationScope` |
| | `POST /dispense` | Denied (403) | Denied (403) | Denied (403) | Permitted | `requireRole('STATION_ADMIN')` + `requireStationScope` |
| | `GET /transactions` | Denied (403) | Permitted (All) | Permitted (All) | Scoped (Own Only) | Station check (`CROSS_STATION_ACCESS_DENIED`) |
| **Shortage Management** | `POST /shortages` | Denied (403) | Denied (403) | Permitted (All) | Scoped (Own Only) | Station ID match enforced in controller |
| | `PATCH /shortages/:id/review` | Denied (403) | Denied (403) | Permitted | Denied (403) | `requireRole('TRADE_OFFICE')` |
| **Reports** | `GET /reports/overview` | Denied (403) | Permitted | Permitted | Denied (403) | `requireRole('AGRICULTURE_OFFICE', 'TRADE_OFFICE')` |
| | `GET /reports/agriculture` | Denied (403) | Permitted | Permitted | Denied (403) | `requireRole('AGRICULTURE_OFFICE', 'TRADE_OFFICE')` |
| | `GET /reports/trade` | Denied (403) | Denied (403) | Permitted | Denied (403) | `requireRole('TRADE_OFFICE')` |
| | `GET /reports/station` | Denied (403) | Denied (403) | Permitted (All) | Scoped (Own Only) | Station check (403 if `stationId !== user.fuelStationId`) |
| | `GET /reports/export` | Denied (403) | Permitted (Agri) | Permitted (Trade/Agri) | Scoped (Station CSV Only) | Role & Station scope check in controller |

---

## 4. Key Security Defenses Implemented

### 4.1. Cross-Station Data Isolation (Anti-IDOR)
- **Problem:** In `GET /transactions`, if a station representative supplied a query parameter `?stationId=<otherStationId>`, the endpoint previously returned another station's ledger.
- **Fix:** In `transaction.controller.ts`, if `req.user.role === 'STATION_ADMIN'`, the backend asserts:
  ```typescript
  if (req.query.stationId && req.query.stationId !== req.user.fuelStationId) {
    return res.status(403).json({
      success: false,
      error: 'Access denied: Station operators may only access transactions for their assigned station.',
      code: 'CROSS_STATION_ACCESS_DENIED',
    });
  }
  ```
  Similarly, `getStationReport` and `exportReportCsv` in `report.controller.ts` reject cross-station queries with HTTP 403.

### 4.2. Station Representative Shortage Isolation
- In `shortage.controller.ts`, when a `STATION_ADMIN` reports a shortage, `fuelStationId` is strictly forced to `req.user.fuelStationId`. Attempting to query another station's shortage incident returns HTTP 403.

### 4.3. Privilege Escalation Defenses
- **Self-Deactivation Guard:** In `system.controller.ts`, `updateUser` prevents a `SYSTEM_ADMIN` from setting `isActive: false` on their own account:
  ```typescript
  if (id === req.user.id && req.body.isActive === false) {
    return res.status(400).json({
      success: false,
      error: 'You cannot deactivate your own administrative account.',
      code: 'SELF_DEACTIVATION_PREVENTED',
    });
  }
  ```
- **Self-Demotion Guard:** An administrator cannot change their own role to non-admin, preventing accidental lockout.
- **Profile Immutability:** `PUT /auth/profile` strictly whitelists `fullName`, `email`, and `phone`. The user's `role`, `id`, and `fuelStationId` are completely ignored and cannot be overwritten.

### 4.4. Frontend Route Guards (`RoleRoute`)
- In `client/src/routes/AppRoutes.tsx`, introduced `<RoleRoute allowedRoles={[...]}>`:
  - `/farmers`, `/farmers/:id`: restricted to `AGRICULTURE_OFFICE`, `TRADE_OFFICE`.
  - `/allocations`, `/requests`, `/cards`: restricted to `AGRICULTURE_OFFICE`.
  - `/trade/*`: restricted to `TRADE_OFFICE`.
  - `/scanner`, `/station/transactions`: restricted to `STATION_ADMIN`.
  - `/system/*`: restricted to `SYSTEM_ADMIN`.
  - Unauthorized direct URL navigation redirects cleanly to `/dashboard`.

---

## 5. Verification Test Suite Results

The dedicated test suite `server/test_priority1_task4_rbac_authorization.ts` executed **29 distinct scenarios** with **61 individual assertions**:

```
=============================================================================
IRFA PRIORITY 1, TASK 4: RBAC & AUTHORIZATION AUDIT TEST SUITE
=============================================================================
--- SECTION 1: Authentication Enforcement ---
  ✓ PASS #1: Unauthenticated request to /auth/me rejected with HTTP 401
  ✓ PASS #2: Unauthenticated request to /farmers rejected with HTTP 401
  ✓ PASS #3: Invalid JWT token rejected with HTTP 401
  ✓ PASS #4: Expired JWT token rejected with HTTP 401
  ✓ PASS #5: Valid JWT token permitted with HTTP 200
  ✓ PASS #6: Resolves correct authenticated user profile

--- SECTION 2: Role Authorization & Boundary Integrity ---
  ✓ PASS #7: System Admin blocked from viewing farmers (403)
  ✓ PASS #8: System Admin blocked from dispensing fuel (403)
  ✓ PASS #9: System Admin blocked from Trade request approval (403)
  ✓ PASS #10: Agriculture blocked from Trade review request (403)
  ✓ PASS #11: Agriculture blocked from revoking Trade authorization (403)
  ✓ PASS #12: Agriculture blocked from Trade station assignment (403)
  ✓ PASS #13: Agriculture blocked from QR verification scanner (403)
  ✓ PASS #14: Agriculture blocked from fuel dispensing (403)
  ✓ PASS #15: Trade blocked from registering farmers (403)
  ✓ PASS #16: Trade blocked from creating monthly allocations (403)
  ✓ PASS #17: Trade blocked from creating fuel requests to Trade (403)
  ✓ PASS #18: Trade blocked from QR verification (403)
  ✓ PASS #19: Trade blocked from fuel dispensing (403)
  ✓ PASS #20: Station Admin blocked from registering farmers (403)
  ✓ PASS #21: Station Admin blocked from browsing full farmer registry (403)
  ✓ PASS #22: Station Admin blocked from browsing monthly allocations (403)
  ✓ PASS #23: Station Admin blocked from browsing fuel requests (403)
  ✓ PASS #24: Station Admin blocked from Trade review request (403)
  ✓ PASS #25: Station Admin blocked from revoking Trade authorization (403)
  ✓ PASS #26: Station Admin blocked from browsing Trade authorizations (403)
  ✓ PASS #27: Station Admin blocked from representative management (403)
  ✓ PASS #28: Agriculture blocked from /system/users (403)
  ✓ PASS #29: Trade blocked from /system/users (403)
  ✓ PASS #30: Station Admin blocked from /system/users (403)
  ✓ PASS #31: Non-admin blocked from /system/settings (403)
  ✓ PASS #32: Non-admin blocked from /system/audit-logs (403)

--- SECTION 3: Data Scope & Cross-Station Isolation ---
  ✓ PASS #33: Station Admin A requesting Station B transactions rejected with 403
  ✓ PASS #34: Error code is CROSS_STATION_ACCESS_DENIED
  ✓ PASS #35: Station Admin A requesting Station B report rejected with 403
  ✓ PASS #36: Station Admin A exporting Station B CSV rejected with 403
  ✓ PASS #37: Station Admin attempting Trade CSV export rejected with 403
  ✓ PASS #38: Station Admin A reporting shortage for Station B rejected with 403
  ✓ PASS #39: Station Admin A viewing Station B shortage incident rejected with 403
  ✓ PASS #40: Trade Office permitted to inspect station shortage incident

--- SECTION 4: Privilege Escalation Defense ---
  ✓ PASS #41: /auth/profile accepts valid profile fields
  ✓ PASS #42: User role remains strictly unchanged (AGRICULTURE_OFFICE)
  ✓ PASS #43: System Admin self-deactivation rejected with 400
  ✓ PASS #44: Informative self-deactivation prevention message
  ✓ PASS #45: System Admin self-role demotion rejected with 400
  ✓ PASS #46: Non-admin user creation attempt rejected with 403

--- SECTION 5: Legitimate Operational Workflows Preserved ---
  ✓ PASS #47: Agriculture legitimately retrieves farmers (200)
  ✓ PASS #48: Farmers list returned in expected structure
  ✓ PASS #49: Agriculture legitimately retrieves allocations (200)
  ✓ PASS #50: Agriculture legitimately retrieves fuel requests (200)
  ✓ PASS #51: Trade legitimately retrieves fuel requests (200)
  ✓ PASS #52: Trade legitimately retrieves authorizations (200)
  ✓ PASS #53: Station Admin legitimately retrieves own station transactions (200)
  ✓ PASS #54: Own station transactions returned in expected structure
  ✓ PASS #55: Station Admin legitimately retrieves own station report (200)
  ✓ PASS #56: System Admin legitimately retrieves users list (200)
  ✓ PASS #57: Users array returned to System Admin
  ✓ PASS #58: Agriculture can view farmer photo (200)
  ✓ PASS #59: Trade can view farmer photo (200)
  ✓ PASS #60: Station Admin can view farmer photo for dispensing verification (200)
  ✓ PASS #61: System Admin is blocked from viewing farmer photo (403)

=============================================================================
TEST SUMMARY: 61 / 61 ASSERTIONS PASSED (100%)
=============================================================================
```

---

## 6. Complete Milestone Regression Results

All regression suites across Priority 0 and Priority 1 Tasks 1–4 passed with zero regressions:

| Milestone Test Suite | Total Assertions | Passed | Failed | Status |
|---|:---:|:---:|:---:|:---:|
| `test_priority0_seed_and_dispensing.ts` | 25 | 25 | 0 | **PASS** |
| `test_priority1_task1_photo_security.ts` | 27 | 27 | 0 | **PASS** |
| `test_priority1_task2_allocation_authorization_integrity.ts` | 35 | 35 | 0 | **PASS** |
| `test_priority1_task3_farmer_registration_validation.ts` | 62 | 62 | 0 | **PASS** |
| `test_priority1_task4_rbac_authorization.ts` | 61 | 61 | 0 | **PASS** |
| **Total Test Suite Assertions** | **210** | **210** | **0** | **100% PASS** |

### Build & Type Verification
- `server`: `npx tsc --noEmit` exited with code 0 (zero TypeScript errors).
- `client`: `npm run build` compiled 1,753 modules into production bundle in 9.64s with zero errors.

---

## 7. Safety & Integrity Confirmation
- **Zero Schema Changes:** No migrations were run and `prisma/schema.prisma` was not altered.
- **Zero Sample Data Modifications:** No test data was reconciled, deleted, or altered in the database.
- **Atomic Ephemeral Test Execution:** All automated tests create isolated, uniquely-prefixed test records (`_p1t4_...`) and clean them up deterministically upon test completion.
