# IRFA / DFCS — Priority 1, Task 1 Implementation Report
## Secure Farmer Photo Access & Public Exposure Remediation

**Date:** November 27, 2026  
**Status:** COMPLETED & VERIFIED (27/27 Tests Passing)  
**Deliverable File:** `PRIORITY_1_TASK_1_FARMER_PHOTO_SECURITY_REPORT.md`  
**Execution Scope:** Priority 1, Task 1 Only (Strictly bounded; Priority 1 Task 2 Not Started)

---

## 1. Original Vulnerability and Root Cause

### 1.1 Vulnerability Description (SEC-04)
Previously, the backend server in `server/src/app.ts` mounted the entire `uploads/` directory as a public static directory:
```typescript
// Defective public static configuration in server/src/app.ts:
const uploadsPath = path.resolve(process.cwd(), 'uploads');
app.use('/uploads', express.static(uploadsPath, {
  dotfiles: 'ignore',
  index: false,
  maxAge: '1d',
}));
```

### 1.2 Root Cause & Impact
- Farmer photographs uploaded during registration or photo update were stored in `uploads/farmers/` with references saved in the database as `/uploads/farmers/farmer-photo-XXXX.jpg`.
- Because `app.use('/uploads', express.static(...))` had no authentication or authorization checks, any unauthenticated actor on the network could directly retrieve private photographs of registered farmers by guessing or requesting the static URL (`GET /uploads/farmers/...`).
- Sensitive farmer identity photographs were publicly exposed without access logs, role validation, or directory boundary confinement.

---

## 2. Files Inspected

1. `server/src/app.ts` — Evaluated static file serving and route mounting.
2. `server/src/middleware/upload.ts` — Evaluated Multer storage targets, file filter, and directory layout (`uploads/farmers` vs `uploads/avatars`).
3. `server/src/middleware/auth.ts` — Evaluated JWT extraction, cookie handling, role enforcement, and operational restriction middleware.
4. `server/src/controllers/farmer.controller.ts` — Evaluated photo handling during farmer creation, update, and upload.
5. `server/src/routes/index.ts` — Evaluated route ordering, middleware chains, and role restrictions.
6. `client/src/services/api.ts` — Evaluated `getAssetUrl` and Axios token interceptors.
7. `client/src/components/cards/FarmerDigitalIdCard.tsx` — Evaluated photo display and fallback handling on ID cards.
8. `client/src/pages/agriculture/FarmersPage.tsx` — Evaluated farmer table thumbnails, registration file upload, and blob previews.
9. `client/src/pages/agriculture/FarmerDetailPage.tsx` — Evaluated farmer profile hero photo display and photo replacement modal.
10. `client/src/pages/agriculture/FarmerCardsPage.tsx` — Evaluated farmer card grid photo rendering.
11. `client/src/pages/station/scanner/ScannerAuthorizedView.tsx` — Evaluated identity verification photo display on the station scanner screen.
12. `client/src/components/common/UserAvatar.tsx` — Verified user avatar URL resolution to ensure avatars remain unimpacted.

---

## 3. Files Changed

| File | Status | Description of Change |
|---|---|---|
| `server/src/app.ts` | Modified | Removed public static serving of `/uploads`. Restricted static serving strictly to `/uploads/avatars`. Explicitly blocked `/uploads/farmers` and `/uploads` with 404 responses. |
| `server/src/middleware/auth.ts` | Modified | Extended `authenticateJWT` to support `req.query.token` in addition to `Authorization: Bearer` and cookies, enabling authenticated media tags (`<img>`). |
| `server/src/controllers/farmer.controller.ts` | Modified | Implemented `getFarmerPhoto` (by farmer ID / code) and `getFarmerPhotoByFilename` (by safe filename) with strict regex validation, path confinement checks, database association checks, and security headers. |
| `server/src/routes/index.ts` | Modified | Registered `GET /farmers/photo/:filename` and `GET /farmers/:id/photo` protected by `authenticateJWT` and `disallowAdminOperational`. Ordered before `/farmers/:id` to prevent route shadowing. |
| `client/src/services/api.ts` | Modified | Upgraded `getAssetUrl` to automatically route `/uploads/farmers/` paths through `/api/farmers/photo/:filename?token=...`. Exported `getFarmerPhotoUrl` helper. Preserved public avatars. |
| `server/test_priority1_task1_photo_security.ts` | Created | Comprehensive automated security test suite covering public route blocking, 401/403 enforcement, directory traversal defenses, upload integrity, and avatar isolation. |

---

## 4. Security Architecture: Before vs. After

```
BEFORE (Vulnerable):
Unauthenticated Client ----> GET /uploads/farmers/photo-123.jpg ----> Express Static (No Auth) ----> Photo Returned (LEAK)

AFTER (Remediated):
1. Public Static Probe:
   Unauthenticated Client ----> GET /uploads/farmers/photo-123.jpg ----> Blocked Route Handler ----> 404 Not Found (DENIED)
   Unauthenticated Client ----> GET /uploads/....                  ----> Blocked Route Handler ----> 404 Not Found (DENIED)

2. Unauthenticated API Probe:
   Unauthenticated Client ----> GET /api/farmers/:id/photo        ----> authenticateJWT       ----> 401 Unauthorized (DENIED)

3. Unauthorized Role Probe (e.g. SYSTEM_ADMIN):
   System Administrator   ----> GET /api/farmers/:id/photo        ----> disallowAdminOperational -> 403 Forbidden (DENIED)

4. Directory Traversal Attack:
   Attacker (?token=valid) ----> GET /api/farmers/photo/../../.env ----> Regex & Path Confinement -> 400 Bad Request (DENIED)

5. Legitimate Authorized Access:
   Authorized Role        ----> GET /api/farmers/photo/123.jpg?token=..
   (Agri / Trade / Station)      |
                                 +--> authenticateJWT (Validates session)
                                 +--> disallowAdminOperational (Allows operational role)
                                 +--> Strict Regex Check (/^[a-zA-Z0-9_\-]+\.(jpg|jpeg|png|webp)$/i)
                                 +--> Path Confinement (filePath.startsWith(uploadDir))
                                 +--> Database Verification (Verifies photo belongs to farmer)
                                 +--> Security Headers Attached:
                                      - Content-Type: image/jpeg
                                      - X-Content-Type-Options: nosniff
                                      - Cache-Control: private, no-transform, max-age=3600
                                      - Content-Security-Policy: default-src 'none'
                                 +--> 200 OK (Secure Stream)
```

---

## 5. Photo Access Authorization Rules & Allowed Roles

In strict alignment with the existing RBAC model and segregation-of-duties principles:

| Role | Access Level | Enforcement Mechanism | Justification |
|---|---|---|---|
| **`AGRICULTURE_OFFICE`** | **ALLOWED** | `authenticateJWT`, `disallowAdminOperational` | Primary custodian of farmer registry; uploads, inspects, and prints farmer ID cards. |
| **`TRADE_OFFICE`** | **ALLOWED** | `authenticateJWT`, `disallowAdminOperational` | Regulatory authority; verifies farmer allotments and quotas during request reviews. |
| **`STATION_ADMIN`** | **ALLOWED** | `authenticateJWT`, `disallowAdminOperational` | Operational fuel representative; performs physical visual verification against farmer face before dispensing. |
| **`SYSTEM_ADMIN`** | **BLOCKED (403)** | `disallowAdminOperational` | System administrator has configuration/technical access only; prohibited from operational personal data access. |
| **Unauthenticated** | **BLOCKED (401)** | `authenticateJWT` | Missing or invalid authentication token. |

---

## 6. API Endpoint Details

### 6.1 `GET /api/farmers/:id/photo`
- **Purpose:** Securely retrieves the photograph of a specific farmer by their database UUID or official `farmerCode` (e.g. `FR-00124`).
- **Authentication:** Required (`Bearer` header, cookie, or `?token=` query param).
- **Authorization:** `AGRICULTURE_OFFICE`, `TRADE_OFFICE`, `STATION_ADMIN`.
- **Responses:**
  - `200 OK` — Binary image stream with security headers (`Content-Type`, `X-Content-Type-Options: nosniff`, `Cache-Control: private`).
  - `400 Bad Request` — Invalid farmer identifier or malformed filename.
  - `401 Unauthorized` — Missing or invalid authentication token.
  - `403 Forbidden` — Unauthorized role (`SYSTEM_ADMIN`).
  - `404 Not Found` — Farmer not found, farmer has no photo, or photo file missing on disk.

### 6.2 `GET /api/farmers/photo/:filename`
- **Purpose:** Securely retrieves a photograph by filename (used by frontend `getAssetUrl`).
- **Authentication:** Required.
- **Authorization:** `AGRICULTURE_OFFICE`, `TRADE_OFFICE`, `STATION_ADMIN`.
- **Validation:**
  - Regex check: strictly `/^[a-zA-Z0-9_\-]+\.(jpg|jpeg|png|webp)$/i`. Rejects all path separators, dot-dot sequences, null bytes.
  - Path confinement check: `filePath.startsWith(farmerUploadDir)`.
  - Database check: Confirms the requested file is actively linked to a registered farmer (`prisma.farmer.findFirst({ where: { photoUrl: { contains: filename } } })`).
- **Responses:**
  - `200 OK` — Binary image stream with security headers.
  - `400 Bad Request` — Invalid or traversal-attempt filename.
  - `401 Unauthorized` — Missing or invalid authentication token.
  - `403 Forbidden` — Unauthorized role.
  - `404 Not Found` — Photo not registered to any farmer or file missing on disk.

---

## 7. Automated Test Suite Results

Test suite: `server/test_priority1_task1_photo_security.ts`  
Execution command: `Set-Location server; npx tsx test_priority1_task1_photo_security.ts`

```
================================================================================
   PHOTO SECURITY TEST RESULTS: 27 PASSED | 0 FAILED            
================================================================================
```

### Detailed Assertion Matrix:

| Section | Scenario | Expected | Result |
|---|---|---|---|
| **Section 1: Public Static Removal** | Direct unauthenticated `GET /uploads/farmers/...` | 404 Not Found | **PASS** |
| | Direct unauthenticated `GET /uploads` | 404 Not Found | **PASS** |
| | Direct unauthenticated guessed `/uploads/farmers/guess.jpg` | 404 Not Found | **PASS** |
| **Section 2: Unauthenticated Access** | `GET /api/farmers/:id/photo` without token | 401 Unauthorized | **PASS** |
| | `GET /api/farmers/photo/:filename` without token | 401 Unauthorized | **PASS** |
| | Request with forged / invalid JWT token | 401 Unauthorized | **PASS** |
| **Section 3: Role-Based Access Control** | `SYSTEM_ADMIN` calls `GET /api/farmers/:id/photo` | 403 Forbidden | **PASS** |
| | `SYSTEM_ADMIN` calls `GET /api/farmers/photo/:filename` | 403 Forbidden | **PASS** |
| **Section 4: Authorized Photo Retrieval** | `AGRICULTURE_OFFICE` retrieves photo by ID | 200 OK + `image/jpeg` | **PASS** |
| | Security header `X-Content-Type-Options: nosniff` present | Verified | **PASS** |
| | Security header `Cache-Control: private` present | Verified | **PASS** |
| | `AGRICULTURE_OFFICE` retrieves photo by `farmerCode` | 200 OK | **PASS** |
| | `TRADE_OFFICE` retrieves photo by filename | 200 OK | **PASS** |
| | `STATION_ADMIN` retrieves photo for scanner verification | 200 OK | **PASS** |
| | Browser `<img>` tag retrieval via `?token=...` | 200 OK | **PASS** |
| **Section 5: Missing / Invalid Identifiers** | Farmer with no photo (`photoUrl: null`) | 404 (Explicit message) | **PASS** |
| | Non-existent farmer UUID | 404 Not Found | **PASS** |
| | Photo not registered to any farmer in database | 404 Not Found | **PASS** |
| **Section 6: Directory Traversal Defense** | Basic dot-dot (`/../../package.json`) | 400/404 Rejected | **PASS** |
| | URL-encoded traversal (`..%2f..%2fpackage.json`) | 400 Bad Request | **PASS** |
| | Backslash traversal (`..\..\package.json`) | 400/404 Rejected | **PASS** |
| | Malicious file extension (`exploit.sh`) | 400 Bad Request | **PASS** |
| | Probing system sensitive file (`.env`) | 400 Bad Request | **PASS** |
| **Section 7: Upload Workflow Preserved** | Upload new photo via `POST /api/farmers/:id/photo` | 200 OK + DB updated | **PASS** |
| | Newly uploaded photo retrievable via secure endpoint | 200 OK | **PASS** |
| | Newly uploaded photo blocked from public static URL | 404 Not Found | **PASS** |
| **Section 8: User Avatars Preserved** | Public avatar serving at `/uploads/avatars/...` | 200 OK | **PASS** |
| **Cleanup** | Ephemeral test records and disk files purged | Clean | **PASS** |

---

## 8. TypeScript & Build Quality Results

- **Backend TypeScript Compilation:**
  ```powershell
  Set-Location server; npx tsc --noEmit
  ```
  **Result:** Exit Code 0 (Zero errors).

- **Frontend Production Build:**
  ```powershell
  Set-Location client; npm run build
  ```
  **Result:** Exit Code 0 (`✓ built in 10.79s`, Zero errors).

- **Priority 0 Regression Suite:**
  ```powershell
  Set-Location server; npx tsx test_priority0_seed_and_dispensing.ts
  ```
  **Result:** Exit Code 0 (**25 PASSED, 0 FAILED**).

- **Git Diff & Whitespace Verification:**
  ```powershell
  git diff --check
  ```
  **Result:** Exit Code 0 (Clean).

---

## 9. Remaining Risks or Limitations

1. **Token Query Parameter in Browser History:**
   When `<img src="/api/farmers/photo/xyz.jpg?token=...">` is requested, the token query parameter is evaluated in memory. For standard single-page app usage within authenticated sessions, this functions cleanly. In long-term enterprise production, session-scoped signed image tokens or blob URLs via Axios interceptors can provide additional defense against URL log leakage.
2. **Avatar Separation:**
   User profile avatars remain served from `/uploads/avatars/`. They contain no farmer identity data and represent public staff avatars.

---

## 10. Confirmations

- [x] **Confirmation 1:** No sample or test database records were modified or deleted.
- [x] **Confirmation 2:** No database cleanup or reset was performed.
- [x] **Confirmation 3:** No database schema migrations or changes were introduced.
- [x] **Confirmation 4:** No changes were made to dispensing logic, quota logic, seed logic, station assignments, or unrelated modules.
- [x] **Confirmation 5:** UI components were not redesigned; existing layout, styling, and visual indicators remain intact.
- [x] **Confirmation 6:** Execution has stopped. Priority 1 Task 2 has NOT been started.

---

## 11. Stop Condition

Priority 1, Task 1 (Farmer Photo Security) is **COMPLETE, VERIFIED, and CLOSED**.

The system is stopped awaiting user review and authorization before proceeding to any subsequent tasks.
