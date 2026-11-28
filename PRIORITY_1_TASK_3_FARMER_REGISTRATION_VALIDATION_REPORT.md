# IRFA / DIGITAL FUEL COUPON SYSTEM
## Priority 1, Task 3: Farmer Registration Validation & Duplicate Handling Completion Report

**Project:** Digital Fuel Coupon System (IRFA / DFCS)  
**Authority:** Bahir Dar City Administration Office of Agriculture (የባሕር ዳር ከተማ አስተዳደር ግብርና መምሪያ) & Trade and Market Development Office (የንግድ እና ገበያ ልማት መምሪያ)  
**Task:** Priority 1, Task 3 — Farmer Registration Validation & Duplicate Handling  
**Status:** IMPLEMENTED, FULLY VERIFIED, AND REGRESSION TESTED  
**Date:** November 2026  

---

## 1. Executive Summary

As part of the functionality-first, production-readiness roadmap for the Digital Fuel Coupon System (IRFA), **Priority 1, Task 3: Farmer Registration Validation & Duplicate Handling** has been successfully designed, implemented, and verified.

Previously, farmer registration suffered from critical validation vulnerabilities and raw error exposure:
1. **Duplicate National ID Crash:** Attempting to register a farmer with an already registered National ID violated the MySQL unique index, resulting in an unhandled Prisma `P2002` exception that cascaded into an HTTP 500 Internal Server Error, exposing internal database error structures and query metadata to the client.
2. **Missing Ethiopian Phone Validation & Uniqueness Enforcement:** Phone numbers were only checked for `min(9)` without format validation for Ethiopian numbering conventions (`+251 9...`, `09...`, `+251 7...`, `07...`, `058...`), and duplicate phone numbers were not properly prevented.
3. **Empty String vs. NULL Mismatch:** Empty string National IDs (`""`) were saved as non-null strings rather than normalized `NULL` values, causing subsequent registrations with empty National IDs to collide and fail.
4. **Sub-City and Kebele Boundary Inconsistency:** Registrations could submit a Kebele ID that did not belong to the selected Sub-City.
5. **Frontend Form Error Attribution:** The frontend registration modal in `FarmersPage.tsx` displayed a single top banner for all errors without highlighting which input field was invalid or duplicate.

All issues have been resolved without requiring database migrations or disrupting existing valid records. The implementation delivers robust Zod schema validation, Ethiopian phone canonicalization, application-level duplicate pre-checks, race-condition-safe Prisma `P2002` error mapping to HTTP 409 Conflict, complete sanitization against database detail leakage, and inline field-level validation feedback on the frontend.

All **14 test scenarios (62 assertions)** in `server/test_priority1_task3_farmer_registration_validation.ts` passed completely (100%), and full non-regression was confirmed across Priority 0 (25/25 passed), Priority 1 Task 1 (27/27 passed), Priority 1 Task 2 (35/35 passed), and client/server compilation builds.

---

## 2. Farmer Registration Validation Architecture

### 2.1 Ethiopian Phone Number Convention Validation & Canonicalization
In `server/src/validators/farmer.validator.ts`:
- **Format Recognition:** Uses regular expression `ETH_PHONE_REGEX = /^(?:\+251|251|0)?([97]\d{8}|58\d{7})$/` to accept:
  - Mobile numbers: Ethio Telecom (`+251 9...`, `09...`, `9...`) and Safaricom Ethiopia (`+251 7...`, `07...`, `7...`)
  - Regional fixed lines: Bahir Dar regional code (`+251 58...`, `058...`, `58...`)
- **Dummy Number Rejection:** Rejects phone numbers where all national digits are identical (e.g. `0999999999`, `0000000000`).
- **Canonical Storage:** Helper function `normalizeEthiopianPhone` strips delimiters (spaces, hyphens, parentheses, dots) and normalizes numbers to the standard national display format matching seed data: `+251 ${nat.slice(0, 3)} ${nat.slice(3, 6)} ${nat.slice(6)}` (e.g. `+251 918 112 233`).
- **Uniqueness Check:** Before creating or updating a farmer, the system queries whether another farmer already holds the normalized phone number, the compact phone number, or the raw phone number.

### 2.2 National / Kebele ID Validation & Normalization
- **Optional Field with NULL Transformation:** If `nationalId` is omitted, `null`, empty string `""`, or whitespace only `"   "`, Zod automatically transforms it to `null`. This ensures MySQL/TiDB treats omitted IDs as `NULL` (which allows multiple occurrences without violating unique constraints).
- **Format Validation:** If provided, `nationalId` is trimmed and converted to uppercase. It must be between 4 and 40 characters and match `/^[A-Z0-9\-_/]+$/i`. Special characters, HTML tags, and injection payloads (`<script>`, SQL fragments) are strictly rejected with HTTP 400.
- **Uniqueness Pre-Check:** Before creating or updating, the system checks if any existing farmer already uses the normalized uppercase National ID.

### 2.3 Required Fields & Boundary Integrity
- `fullName`: Minimum 2 characters, trimmed. Empty or whitespace-only names are rejected.
- `gender`: Strictly validated against Amharic/English options (`ወንድ`, `ሴት`, `Male`, `Female`).
- `subCityId` & `kebeleId`: Both are strictly required.
- **Sub-City / Kebele Relational Boundary:** `farmer.controller.ts` verifies that the chosen `kebeleId` exists and that `kebele.subCityId === data.subCityId`. Any mismatch triggers an HTTP 400 with code `SUB_CITY_MISMATCH`.
- `landSizeHectares`: Strictly coerced positive number (`> 0`).
- `declaredFuelLiters`: Strictly coerced positive number (`> 0`).
- `primaryCrops`: Trimmed non-empty string.
- `pumpFuelType`: Enum validated (`Diesel`, `Benzene`, `ናፍጣ`, `ቤንዚል`).

---

## 3. Duplicate Handling & Concurrency Defense

### 3.1 Two-Tier Defense Architecture
To guarantee absolute uniqueness without relying solely on application-level checks or letting database exceptions leak:
1. **Tier 1 (Application Pre-Check):**
   - Directly checks database for duplicate `phone` or `nationalId`.
   - If found, immediately returns HTTP 409 Conflict with dedicated error codes (`DUPLICATE_PHONE`, `DUPLICATE_NATIONAL_ID`) and field attribution.
2. **Tier 2 (Prisma P2002 Safe Exception Handler):**
   - Protects against concurrent race conditions where two requests arrive within milliseconds and pass Tier 1 simultaneously.
   - When the database unique constraint triggers Prisma error code `P2002`, the controller catches it and maps `error.meta?.target`:
     - `nationalId` $\rightarrow$ HTTP 409 with `code: 'DUPLICATE_NATIONAL_ID'`, `field: 'nationalId'`.
     - `phone` $\rightarrow$ HTTP 409 with `code: 'DUPLICATE_PHONE'`, `field: 'phone'`.
     - `farmerCode` $\rightarrow$ HTTP 409 with `code: 'DUPLICATE_FARMER_CODE'`, `field: 'farmerCode'`.
   - Never exposes internal database driver objects, table names, SQL queries, or stack traces.

### 3.2 Resilient Farmer Code Generation
The previous `generateFarmerCode` simply counted existing records, which could collide if farmers were deleted or seeded non-consecutively. The updated implementation checks candidate codes in a loop:
```typescript
const generateFarmerCode = async (): Promise<string> => {
  let nextNum = (await prisma.farmer.count()) + 125;
  let code = `FR-${nextNum.toString().padStart(5, '0')}`;
  while (await prisma.farmer.findUnique({ where: { farmerCode: code } })) {
    nextNum++;
    code = `FR-${nextNum.toString().padStart(5, '0')}`;
  }
  return code;
};
```

---

## 4. Frontend Registration UI Enhancements

In `client/src/pages/agriculture/FarmersPage.tsx`:
1. **Field-Level Error State:** Added `fieldErrors: Record<string, string>` state to track server-side field-specific validation failures.
2. **Inline Error Highlighting:**
   - When `fieldErrors.phone` is present, the Phone Number input renders a distinct red border (`border-red-500 bg-red-50/20`) and displays the error message directly below the input:
     ```tsx
     {fieldErrors.phone && (
       <p className="text-[11px] text-red-600 mt-1 font-medium">{fieldErrors.phone}</p>
     )}
     ```
   - When `fieldErrors.nationalId` is present, the National ID input renders identical inline error styling and feedback text.
3. **Form Value Preservation:** On validation or duplicate errors, the modal stays open and all previously entered form data (`fullName`, `phone`, `subCityId`, `kebeleId`, `landSizeHectares`, etc.) is fully preserved, allowing the operator to correct the specific field without re-entering the entire form.
4. **Immediate Field Clearance:** Modifying the contents of an invalid field immediately clears that field's error state.
5. **Debounce & Loading State:** The registration submit button shows a loading spinner (`Registering...`) and is disabled during request processing (`disabled={formLoading}`), preventing duplicate double-click submissions.
6. **Modal Reset Lifecycle:** Opening or closing the modal automatically clears all previous errors and resets field state.

---

## 5. Automated Test Suite Results

A dedicated automated test suite was constructed:
`server/test_priority1_task3_farmer_registration_validation.ts`

The test suite exercises all 14 required scenarios against the development database and ephemeral test HTTP server.

```
=============================================================================
IRFA PRIORITY 1, TASK 3: FARMER REGISTRATION VALIDATION & DUPLICATE TESTS
=============================================================================

[Setup] Connected to database.
[Setup] Ephemeral test server listening on http://127.0.0.1:54072

Using Sub-City A: በላይ ዘለቀ ክፍለ ከተማ (Kebele: ማጂ ቀበሌ)
Using Sub-City B: አፄ ቴዎድሮስ ክፍለ ከተማ (Kebele: የሞሽት ቀበሌ)

--- SCENARIO 1: Valid Farmer Registration ---
  [PASS] #1: Scenario 1: Returns HTTP 201 Created
  [PASS] #2: Scenario 1: success is true
  [PASS] #3: Scenario 1: FarmerCode generated with FR- prefix
  [PASS] #4: Scenario 1: National ID normalized to uppercase
  [PASS] #5: Scenario 1: FarmerCard automatically created
  [PASS] #6: Scenario 1: IrrigationProfile automatically created

--- SCENARIO 2: Duplicate National ID Rejection ---
  [PASS] #7: Scenario 2: Returns HTTP 409 Conflict
  [PASS] #8: Scenario 2: Error code is DUPLICATE_NATIONAL_ID
  [PASS] #9: Scenario 2: Error field is nationalId
  [PASS] #10: Scenario 2: Returns descriptive message
  [PASS] #11: Scenario 2: No raw database error or stack trace leaked

--- SCENARIO 3: Duplicate Phone Rejection ---
  [PASS] #12: Scenario 3: Returns HTTP 409 Conflict for duplicate phone
  [PASS] #13: Scenario 3: Error code is DUPLICATE_PHONE
  [PASS] #14: Scenario 3: Error field is phone
  [PASS] #15: Scenario 3: Returns descriptive phone duplicate message

--- SCENARIO 4: Invalid National ID Format Rejection ---
  [PASS] #16: Scenario 4a: Rejects script injection in National ID with HTTP 400
  [PASS] #17: Scenario 4a: Points error to nationalId field
  [PASS] #18: Scenario 4b: Rejects too short National ID with HTTP 400
  [PASS] #19: Scenario 4b: Points error to nationalId field
  [PASS] #20: Scenario 4c: Rejects too long National ID with HTTP 400
  [PASS] #21: Scenario 4c: Points error to nationalId field

--- SCENARIO 5: Invalid Phone Format Rejection ---
  [PASS] #22: Scenario 5a: Rejects all-identical digits dummy phone with HTTP 400
  [PASS] #23: Scenario 5a: Points error to phone field
  [PASS] #24: Scenario 5b: Rejects short phone number with HTTP 400
  [PASS] #25: Scenario 5c: Rejects non-Ethiopian international number with HTTP 400
  [PASS] #26: Scenario 5d: Rejects alphanumeric phone with HTTP 400

--- SCENARIO 6: Missing Required Fields Rejection ---
  [PASS] #27: Scenario 6a: Missing fullName returns 400
  [PASS] #28: Scenario 6a: Field indicates fullName
  [PASS] #29: Scenario 6b: Missing gender returns 400
  [PASS] #30: Scenario 6b: Field indicates gender
  [PASS] #31: Scenario 6c: Missing subCityId returns 400
  [PASS] #32: Scenario 6c: Field indicates subCityId
  [PASS] #33: Scenario 6d: Missing kebeleId returns 400
  [PASS] #34: Scenario 6d: Field indicates kebeleId

--- SCENARIO 7: Empty Strings Handling ---
  [PASS] #35: Scenario 7a: Registration with empty string nationalId succeeds (201)
  [PASS] #36: Scenario 7a: Empty string nationalId converted to null in DB
  [PASS] #37: Scenario 7b: Second registration with whitespace nationalId coexists without P2002 (201)
  [PASS] #38: Scenario 7b: Whitespace nationalId converted to null in DB
  [PASS] #39: Scenario 7c: Whitespace-only fullName rejected with 400
  [PASS] #40: Scenario 7c: Points error to fullName field

--- SCENARIO 8: Kebele & SubCity Mismatch Rejection ---
  [PASS] #41: Scenario 8: Sub-City / Kebele mismatch returns HTTP 400
  [PASS] #42: Scenario 8: Error code is SUB_CITY_MISMATCH
  [PASS] #43: Scenario 8: Field points to kebeleId

--- SCENARIO 9: Safe P2002 Error Mapping ---
  [PASS] #44: Scenario 9: Updating to existing National ID returns 409 Conflict
  [PASS] #45: Scenario 9: Code is DUPLICATE_NATIONAL_ID
  [PASS] #46: Scenario 9: Field is nationalId
  [PASS] #47: Scenario 9: Error object is not leaked in update 409 response

--- SCENARIO 10: Database Error Information Hiding ---
  [PASS] #48: Scenario 10: Zero stack traces leaked in error responses
  [PASS] #49: Scenario 10: Zero raw Prisma internal driver messages leaked

--- SCENARIO 11: Concurrent Duplicate Registration Defense ---
  [PASS] #50: Scenario 11: Exactly one concurrent registration succeeds with 201
  [PASS] #51: Scenario 11: Concurrent duplicate is safely rejected with 409
  [PASS] #52: Scenario 11: Race condition never causes HTTP 500 server error
  [PASS] #53: Scenario 11: Exactly 1 record exists in the database for the concurrent submission

--- SCENARIO 12: Registration with Farmer Photo ---
  [PASS] #54: Scenario 12: Farmer registration with photo succeeds (201)
  [PASS] #55: Scenario 12: Photo URL persisted accurately

--- SCENARIO 13: Atomicity and Clean State on Validation Failure ---
  [PASS] #56: Scenario 13: Mismatched kebele fails as expected
  [PASS] #57: Scenario 13: No partial farmer record created

--- SCENARIO 14: System Compatibility & Audit Verification ---
  [PASS] #58: Scenario 14: Created farmer exists with complete relations
  [PASS] #59: Scenario 14: EligibilityStatus is ELIGIBLE
  [PASS] #60: Scenario 14: Card status is ACTIVE
  [PASS] #61: Scenario 14: QR token formatted with QR-FR- prefix
  [PASS] #62: Scenario 14: Audit log CREATE_FARMER recorded with operator user ID

=============================================================================
TEST SUMMARY: 62 / 62 ASSERTIONS PASSED
=============================================================================
[Teardown] Successfully cleaned up 5 ephemeral farmers.
[Teardown] Successfully cleaned up 1 ephemeral users.
[Teardown] Ephemeral test server closed.
[Teardown] Database disconnected.
```

---

## 6. Non-Regression Verification

All previous milestone test suites and full compilation checks were executed to confirm zero regressions:

| Suite / Verification | Scope | Assertions / Result | Status |
|---|---|---|---|
| `test_priority1_task3_farmer_registration_validation.ts` | Priority 1, Task 3: Farmer Registration Validation | 62 / 62 Passed | **PASS** |
| `test_priority0_seed_and_dispensing.ts` | Priority 0: Clean Seed & Dispensing Integrity | 25 / 25 Passed | **PASS** |
| `test_priority1_task1_photo_security.ts` | Priority 1, Task 1: Farmer Photo Security & Access Control | 27 / 27 Passed | **PASS** |
| `test_priority1_task2_allocation_authorization_integrity.ts` | Priority 1, Task 2: Authorization & Monthly Allocation Integrity | 35 / 35 Passed | **PASS** |
| `server` TypeScript Build | `npx tsc --noEmit` | Clean exit (Code 0), 0 errors | **PASS** |
| `client` Production Build | `npm run build` (`tsc -b && vite build`) | Built in 11.76s, 0 errors | **PASS** |
| Git Formatting & Check | `git diff --check` | Clean, 0 whitespace errors | **PASS** |

---

## 7. Modified & Created Artifacts

### Modified Files:
- [server/src/validators/farmer.validator.ts](file:///c:/Users/1234/Desktop/IRFA/server/src/validators/farmer.validator.ts) — Added `ETH_PHONE_REGEX`, `normalizeEthiopianPhone`, refined `phoneValidator`, `nationalIdValidator` with uppercase/null normalization and regex validation.
- [server/src/controllers/farmer.controller.ts](file:///c:/Users/1234/Desktop/IRFA/server/src/controllers/farmer.controller.ts) — Added phone normalization, duplicate pre-checks for phone and nationalId, collision-safe `generateFarmerCode`, Sub-City/Kebele relational check, Prisma `P2002` exception mapping to HTTP 409, and complete error sanitization.
- [client/src/pages/agriculture/FarmersPage.tsx](file:///c:/Users/1234/Desktop/IRFA/client/src/pages/agriculture/FarmersPage.tsx) — Added `fieldErrors` state, inline red border and helper error display for phone and nationalId, form loading spinner/disable, and modal error lifecycle management.

### Created Test Suites & Documentation:
- [server/test_priority1_task3_farmer_registration_validation.ts](file:///c:/Users/1234/Desktop/IRFA/server/test_priority1_task3_farmer_registration_validation.ts) — Automated 14-scenario integration test suite.
- [PRIORITY_1_TASK_3_FARMER_REGISTRATION_VALIDATION_REPORT.md](file:///c:/Users/1234/Desktop/IRFA/PRIORITY_1_TASK_3_FARMER_REGISTRATION_VALIDATION_REPORT.md) — Comprehensive technical completion report.

---

## 8. Conclusion & Project Status

Priority 1, Task 3 is **100% complete and verified**.

### Current Roadmap Status:
- Priority 0: Clean Seed & Dispensing Integrity — **COMPLETED & VERIFIED**
- Priority 1, Task 1: Farmer Photo Security — **COMPLETED & VERIFIED**
- Priority 1, Task 2: Authorization & Monthly Allocation Integrity — **COMPLETED & VERIFIED**
- Priority 1, Task 3: Farmer Registration Validation & Duplicate Handling — **COMPLETED & VERIFIED**
- Priority 1, Task 4: NOT STARTED — Awaiting review and explicit authorization.

In accordance with strict execution safety rules:
- No database migrations or schema alterations were performed.
- No modifications to sample/test data fixtures were made.
- Execution is stopped. Awaiting user evaluation before proceeding to Task 4.
