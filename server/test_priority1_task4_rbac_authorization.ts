/**
 * =============================================================================
 * IRFA / DIGITAL FUEL COUPON SYSTEM — PRIORITY 1, TASK 4 TEST SUITE
 * Comprehensive Role-Based Access Control (RBAC) & Authorization Audit Suite
 * =============================================================================
 */

import 'dotenv/config';
import http from 'http';
import path from 'path';
import fs from 'fs';
import jwt from 'jsonwebtoken';
import { UserRole, CardStatus, EligibilityStatus, ShortageCategory } from '@prisma/client';
import app from './src/app.js';
import prisma from './src/config/db.js';

const JWT_SECRET = process.env.JWT_SECRET || 'irfa_bahir_dar_super_secret_jwt_key_2026_secured';

function makeToken(payload: { userId: string; username: string; role: string; fuelStationId?: string | null }, expiresIn = '1h') {
  return jwt.sign(payload, JWT_SECRET, { expiresIn });
}

let passedCount = 0;
let totalCount = 0;

function assert(condition: boolean, testName: string, details?: any) {
  totalCount++;
  if (condition) {
    passedCount++;
    console.log(`  [PASS] #${totalCount}: ${testName}`);
  } else {
    console.error(`  [FAIL] #${totalCount}: ${testName}`);
    if (details) {
      console.error('         Details:', JSON.stringify(details, null, 2));
    }
  }
}

async function runPriority1Task4Tests() {
  console.log('=============================================================================');
  console.log('IRFA PRIORITY 1, TASK 4: RBAC & AUTHORIZATION AUDIT TEST SUITE');
  console.log('=============================================================================\n');

  let server: http.Server | null = null;
  const ephemeralUserIds: string[] = [];
  const ephemeralFarmerIds: string[] = [];
  const ephemeralShortageIds: string[] = [];
  const ephemeralFilePaths: string[] = [];

  try {
    // 1. Connect to DB
    let connected = false;
    for (let attempt = 1; attempt <= 4; attempt++) {
      try {
        await prisma.$connect();
        connected = true;
        break;
      } catch (e: any) {
        console.warn(`[Setup] DB connection attempt ${attempt} failed (${e.message}). Retrying in 3s...`);
        await new Promise((r) => setTimeout(r, 3000));
      }
    }
    if (!connected) throw new Error('Could not connect to database after 4 attempts.');
    console.log('[Setup] Connected to database.');

    // 2. Start ephemeral test server
    const port = await new Promise<number>((resolve) => {
      server = app.listen(0, () => {
        const addr: any = server!.address();
        resolve(addr.port);
      });
    });
    console.log(`[Setup] Ephemeral test server listening on http://127.0.0.1:${port}\n`);
    const baseUrl = `http://127.0.0.1:${port}/api`;

    async function apiRequest(method: string, path: string, token?: string, body?: any) {
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
      };
      if (token) {
        headers['Authorization'] = `Bearer ${token}`;
      }

      const res = await fetch(`${baseUrl}${path}`, {
        method,
        headers,
        body: body ? JSON.stringify(body) : undefined,
      });

      const contentType = res.headers.get('content-type') || '';
      let data: any = null;
      if (contentType.includes('application/json')) {
        data = await res.json();
      } else {
        data = await res.text();
      }

      return { status: res.status, data };
    }

    // 3. Resolve baseline fuel stations
    const stations = await prisma.fuelStation.findMany({
      where: { isActive: true },
      take: 2,
      orderBy: { code: 'asc' },
    });
    if (stations.length < 2) {
      throw new Error('Test requires at least 2 active fuel stations in database.');
    }
    const stationA = stations[0];
    const stationB = stations[1];

    const timestamp = Date.now().toString().slice(-6);

    // 4. Create 4 test actors covering all 4 roles
    // 4a. System Admin
    const sysAdminUser = await prisma.user.create({
      data: {
        username: `sysadmin_p1t4_${timestamp}`,
        passwordHash: '$2a$10$abcdefghijklmnopqrstuv',
        fullName: 'System Administrator P1T4',
        role: UserRole.SYSTEM_ADMIN,
        isActive: true,
      },
    });
    ephemeralUserIds.push(sysAdminUser.id);
    const sysAdminToken = makeToken({
      userId: sysAdminUser.id,
      username: sysAdminUser.username,
      role: sysAdminUser.role,
    });

    // 4b. Agriculture Office
    const agriUser = await prisma.user.create({
      data: {
        username: `agri_p1t4_${timestamp}`,
        passwordHash: '$2a$10$abcdefghijklmnopqrstuv',
        fullName: 'Agriculture Officer P1T4',
        role: UserRole.AGRICULTURE_OFFICE,
        isActive: true,
      },
    });
    ephemeralUserIds.push(agriUser.id);
    const agriToken = makeToken({
      userId: agriUser.id,
      username: agriUser.username,
      role: agriUser.role,
    });

    // 4c. Trade Office
    const tradeUser = await prisma.user.create({
      data: {
        username: `trade_p1t4_${timestamp}`,
        passwordHash: '$2a$10$abcdefghijklmnopqrstuv',
        fullName: 'Trade Officer P1T4',
        role: UserRole.TRADE_OFFICE,
        isActive: true,
      },
    });
    ephemeralUserIds.push(tradeUser.id);
    const tradeToken = makeToken({
      userId: tradeUser.id,
      username: tradeUser.username,
      role: tradeUser.role,
    });

    // 4d. Station Admin for Station A
    const stationAdminA = await prisma.user.create({
      data: {
        username: `station_a_p1t4_${timestamp}`,
        passwordHash: '$2a$10$abcdefghijklmnopqrstuv',
        fullName: 'Station Operator A P1T4',
        role: UserRole.STATION_ADMIN,
        fuelStationId: stationA.id,
        isActive: true,
      },
    });
    ephemeralUserIds.push(stationAdminA.id);
    const stationAdminTokenA = makeToken({
      userId: stationAdminA.id,
      username: stationAdminA.username,
      role: stationAdminA.role,
      fuelStationId: stationA.id,
    });

    // 4e. Station Admin for Station B
    const stationAdminB = await prisma.user.create({
      data: {
        username: `station_b_p1t4_${timestamp}`,
        passwordHash: '$2a$10$abcdefghijklmnopqrstuv',
        fullName: 'Station Operator B P1T4',
        role: UserRole.STATION_ADMIN,
        fuelStationId: stationB.id,
        isActive: true,
      },
    });
    ephemeralUserIds.push(stationAdminB.id);
    const stationAdminTokenB = makeToken({
      userId: stationAdminB.id,
      username: stationAdminB.username,
      role: stationAdminB.role,
      fuelStationId: stationB.id,
    });

    console.log(`[Actors] SysAdmin: ${sysAdminUser.username}`);
    console.log(`[Actors] Agriculture: ${agriUser.username}`);
    console.log(`[Actors] Trade: ${tradeUser.username}`);
    console.log(`[Actors] Station A (${stationA.code}): ${stationAdminA.username}`);
    console.log(`[Actors] Station B (${stationB.code}): ${stationAdminB.username}\n`);

    // =========================================================================
    // SECTION 1: AUTHENTICATION ENFORCEMENT
    // =========================================================================
    console.log('--- SECTION 1: Authentication Enforcement ---');

    // 1. Unauthenticated request to protected endpoint -> 401
    const resNoAuth = await apiRequest('GET', '/auth/me');
    assert(resNoAuth.status === 401, 'Test 1: Unauthenticated request to /auth/me rejected with HTTP 401', resNoAuth);

    const resNoAuthFarmers = await apiRequest('GET', '/farmers');
    assert(resNoAuthFarmers.status === 401, 'Test 1b: Unauthenticated request to /farmers rejected with HTTP 401', resNoAuthFarmers);

    // 2. Invalid token -> 401
    const resInvalidToken = await apiRequest('GET', '/auth/me', 'invalid-garbage-token-string');
    assert(resInvalidToken.status === 401, 'Test 2: Invalid JWT token rejected with HTTP 401', resInvalidToken);

    // 3. Expired token -> 401
    const expiredToken = makeToken({
      userId: agriUser.id,
      username: agriUser.username,
      role: agriUser.role,
    }, '-1s'); // expired 1 second ago
    const resExpired = await apiRequest('GET', '/auth/me', expiredToken);
    assert(resExpired.status === 401, 'Test 3: Expired JWT token rejected with HTTP 401', resExpired);

    // 4. Valid token -> 200 permitted
    const resValidAuth = await apiRequest('GET', '/auth/me', agriToken);
    assert(resValidAuth.status === 200, 'Test 4: Valid JWT token permitted with HTTP 200', resValidAuth);
    assert(resValidAuth.data.user?.username === agriUser.username, 'Test 4b: Resolves correct authenticated user profile');

    // =========================================================================
    // SECTION 2: ROLE AUTHORIZATION & BOUNDARY INTEGRITY
    // =========================================================================
    console.log('\n--- SECTION 2: Role Authorization & Boundary Integrity ---');

    // 5. System Admin blocked from operational workflows (disallowAdminOperational)
    const resSysAdminFarmers = await apiRequest('GET', '/farmers', sysAdminToken);
    assert(resSysAdminFarmers.status === 403, 'Test 5a: System Admin blocked from viewing farmers (403)', resSysAdminFarmers);

    const resSysAdminDispense = await apiRequest('POST', '/transactions/dispense', sysAdminToken, {
      authorizationId: 'dummy-id',
      quantityLiters: 50,
    });
    assert(resSysAdminDispense.status === 403, 'Test 5b: System Admin blocked from dispensing fuel (403)', resSysAdminDispense);

    const resSysAdminTradeReview = await apiRequest('POST', '/trade/review-request/dummy-id', sysAdminToken, {
      status: 'APPROVED',
    });
    assert(resSysAdminTradeReview.status === 403, 'Test 5c: System Admin blocked from Trade request approval (403)', resSysAdminTradeReview);

    // 6. Agriculture attempts Trade-only action -> rejected (403)
    const resAgriTradeReview = await apiRequest('POST', '/trade/review-request/dummy-id', agriToken, {
      status: 'APPROVED',
    });
    assert(resAgriTradeReview.status === 403, 'Test 6a: Agriculture blocked from Trade review request (403)', resAgriTradeReview);

    const resAgriRevokeAuth = await apiRequest('PATCH', '/trade/authorizations/dummy-id/revoke', agriToken);
    assert(resAgriRevokeAuth.status === 403, 'Test 6b: Agriculture blocked from revoking Trade authorization (403)', resAgriRevokeAuth);

    const resAgriAssignStation = await apiRequest('POST', '/trade/assign-station', agriToken, {
      authorizationId: 'dummy-id',
      fuelStationId: stationA.id,
    });
    assert(resAgriAssignStation.status === 403, 'Test 6c: Agriculture blocked from Trade station assignment (403)', resAgriAssignStation);

    // 7. Agriculture attempts Station-only action -> rejected (403)
    const resAgriVerify = await apiRequest('POST', '/verification/verify', agriToken, {
      qrTokenOrCode: 'QR-TEST',
    });
    assert(resAgriVerify.status === 403, 'Test 7a: Agriculture blocked from QR verification scanner (403)', resAgriVerify);

    const resAgriDispense = await apiRequest('POST', '/transactions/dispense', agriToken, {
      authorizationId: 'dummy-id',
      quantityLiters: 10,
    });
    assert(resAgriDispense.status === 403, 'Test 7b: Agriculture blocked from fuel dispensing (403)', resAgriDispense);

    // 8. Trade attempts Agriculture-only action -> rejected (403)
    const resTradeCreateFarmer = await apiRequest('POST', '/farmers', tradeToken, {
      fullName: 'Trade Unauthorized Farmer',
    });
    assert(resTradeCreateFarmer.status === 403, 'Test 8a: Trade blocked from registering farmers (403)', resTradeCreateFarmer);

    const resTradeCreateAlloc = await apiRequest('POST', '/allocations', tradeToken, {
      farmerId: 'dummy-id',
      allocatedLiters: 100,
    });
    assert(resTradeCreateAlloc.status === 403, 'Test 8b: Trade blocked from creating monthly allocations (403)', resTradeCreateAlloc);

    const resTradeCreateRequest = await apiRequest('POST', '/fuel-requests', tradeToken, {
      periodMonth: 11,
      periodYear: 2026,
    });
    assert(resTradeCreateRequest.status === 403, 'Test 8c: Trade blocked from creating fuel requests to Trade (403)', resTradeCreateRequest);

    // 9. Trade attempts Station-only action -> rejected (403)
    const resTradeVerify = await apiRequest('POST', '/verification/verify', tradeToken, {
      qrTokenOrCode: 'QR-TEST',
    });
    assert(resTradeVerify.status === 403, 'Test 9a: Trade blocked from QR verification (403)', resTradeVerify);

    const resTradeDispense = await apiRequest('POST', '/transactions/dispense', tradeToken, {
      authorizationId: 'dummy-id',
      quantityLiters: 10,
    });
    assert(resTradeDispense.status === 403, 'Test 9b: Trade blocked from fuel dispensing (403)', resTradeDispense);

    // 10. Station Admin attempts Agriculture-only action -> rejected (403)
    const resStationCreateFarmer = await apiRequest('POST', '/farmers', stationAdminTokenA, {
      fullName: 'Station Unauthorized Farmer',
    });
    assert(resStationCreateFarmer.status === 403, 'Test 10a: Station Admin blocked from registering farmers (403)', resStationCreateFarmer);

    const resStationViewFarmers = await apiRequest('GET', '/farmers', stationAdminTokenA);
    assert(resStationViewFarmers.status === 403, 'Test 10b: Station Admin blocked from browsing full farmer registry (403)', resStationViewFarmers);

    const resStationViewAllocations = await apiRequest('GET', '/allocations', stationAdminTokenA);
    assert(resStationViewAllocations.status === 403, 'Test 10c: Station Admin blocked from browsing monthly allocations (403)', resStationViewAllocations);

    const resStationViewRequests = await apiRequest('GET', '/fuel-requests', stationAdminTokenA);
    assert(resStationViewRequests.status === 403, 'Test 10d: Station Admin blocked from browsing fuel requests (403)', resStationViewRequests);

    // 11. Station Admin attempts Trade-only action -> rejected (403)
    const resStationReviewRequest = await apiRequest('POST', '/trade/review-request/dummy-id', stationAdminTokenA, {
      status: 'APPROVED',
    });
    assert(resStationReviewRequest.status === 403, 'Test 11a: Station Admin blocked from Trade review request (403)', resStationReviewRequest);

    const resStationRevokeAuth = await apiRequest('PATCH', '/trade/authorizations/dummy-id/revoke', stationAdminTokenA);
    assert(resStationRevokeAuth.status === 403, 'Test 11b: Station Admin blocked from revoking Trade authorization (403)', resStationRevokeAuth);

    const resStationViewAuths = await apiRequest('GET', '/trade/authorizations', stationAdminTokenA);
    assert(resStationViewAuths.status === 403, 'Test 11c: Station Admin blocked from browsing Trade authorizations (403)', resStationViewAuths);

    const resStationTradeRep = await apiRequest('GET', '/trade/representatives', stationAdminTokenA);
    assert(resStationTradeRep.status === 403, 'Test 11d: Station Admin blocked from representative management (403)', resStationTradeRep);

    // 12. Unauthorized user-management action -> rejected (403)
    const resAgriUsers = await apiRequest('GET', '/system/users', agriToken);
    assert(resAgriUsers.status === 403, 'Test 12a: Agriculture blocked from /system/users (403)', resAgriUsers);

    const resTradeUsers = await apiRequest('GET', '/system/users', tradeToken);
    assert(resTradeUsers.status === 403, 'Test 12b: Trade blocked from /system/users (403)', resTradeUsers);

    const resStationUsers = await apiRequest('GET', '/system/users', stationAdminTokenA);
    assert(resStationUsers.status === 403, 'Test 12c: Station Admin blocked from /system/users (403)', resStationUsers);

    const resAgriSettings = await apiRequest('GET', '/system/settings', agriToken);
    assert(resAgriSettings.status === 403, 'Test 12d: Non-admin blocked from /system/settings (403)', resAgriSettings);

    const resTradeAudit = await apiRequest('GET', '/system/audit-logs', tradeToken);
    assert(resTradeAudit.status === 403, 'Test 12e: Non-admin blocked from /system/audit-logs (403)', resTradeAudit);

    // =========================================================================
    // SECTION 3: DATA SCOPE & CROSS-STATION ISOLATION (IDOR DEFENSE)
    // =========================================================================
    console.log('\n--- SECTION 3: Data Scope & Cross-Station Isolation ---');

    // 13. Station user accesses another station's transactions -> rejected (403)
    const resCrossTx = await apiRequest('GET', `/transactions?stationId=${stationB.id}`, stationAdminTokenA);
    assert(resCrossTx.status === 403, 'Test 13a: Station Admin A requesting Station B transactions rejected with 403', resCrossTx);
    assert(resCrossTx.data.code === 'CROSS_STATION_ACCESS_DENIED', 'Test 13b: Error code is CROSS_STATION_ACCESS_DENIED');

    // 14. Station user accesses another station's report -> rejected (403)
    const resCrossReport = await apiRequest('GET', `/reports/station?stationId=${stationB.id}`, stationAdminTokenA);
    assert(resCrossReport.status === 403, 'Test 14: Station Admin A requesting Station B report rejected with 403', resCrossReport);

    // 15. Station user attempts CSV export of another station -> rejected (403)
    const resCrossCsv = await apiRequest('GET', `/reports/export?type=station&stationId=${stationB.id}`, stationAdminTokenA);
    assert(resCrossCsv.status === 403, 'Test 15a: Station Admin A exporting Station B CSV rejected with 403', resCrossCsv);

    const resStationNonStationCsv = await apiRequest('GET', '/reports/export?type=trade', stationAdminTokenA);
    assert(resStationNonStationCsv.status === 403, 'Test 15b: Station Admin attempting Trade CSV export rejected with 403', resStationNonStationCsv);

    // 16. Station user creates shortage for another station -> rejected (403)
    const fuelTypeDiesel = await prisma.fuelType.findFirst({ where: { code: 'DIESEL' } });
    if (!fuelTypeDiesel) throw new Error('Diesel fuel type record missing.');

    const resCrossShortageReport = await apiRequest('POST', '/shortages', stationAdminTokenA, {
      fuelStationId: stationB.id, // Station A rep submits for Station B!
      fuelTypeId: fuelTypeDiesel.id,
      category: ShortageCategory.FUEL_SUPPLY_SHORTAGE,
      description: 'Cross station attack attempt',
    });
    assert(resCrossShortageReport.status === 403, 'Test 16a: Station Admin A reporting shortage for Station B rejected with 403', resCrossShortageReport);

    // Create a legitimate shortage under Station B to test viewing IDOR
    const shortageB = await prisma.fuelShortage.create({
      data: {
        fuelStationId: stationB.id,
        fuelTypeId: fuelTypeDiesel.id,
        reportedById: stationAdminB.id,
        category: ShortageCategory.FUEL_SUPPLY_SHORTAGE,
        description: 'Station B authentic shortage',
        status: 'REPORTED',
      },
    });
    ephemeralShortageIds.push(shortageB.id);

    // Station Admin A tries to view Station B's shortage incident by ID -> 403
    const resCrossShortageView = await apiRequest('GET', `/shortages/${shortageB.id}`, stationAdminTokenA);
    assert(resCrossShortageView.status === 403, 'Test 16b: Station Admin A viewing Station B shortage incident rejected with 403', resCrossShortageView);

    // Trade Office viewing Station B's shortage incident -> 200 OK
    const resTradeShortageView = await apiRequest('GET', `/shortages/${shortageB.id}`, tradeToken);
    assert(resTradeShortageView.status === 200, 'Test 16c: Trade Office permitted to inspect station shortage incident', resTradeShortageView);

    // =========================================================================
    // SECTION 4: PRIVILEGE ESCALATION DEFENSE
    // =========================================================================
    console.log('\n--- SECTION 4: Privilege Escalation Defense ---');

    // 17. User cannot escalate own role via /auth/profile
    const resProfileEscalate = await apiRequest('PUT', '/auth/profile', agriToken, {
      fullName: 'Agri Officer Trying To Become Admin',
      role: 'SYSTEM_ADMIN', // Attempting privilege escalation
    });
    assert(resProfileEscalate.status === 200, 'Test 17a: /auth/profile accepts valid profile fields');
    assert(resProfileEscalate.data.user?.role === 'AGRICULTURE_OFFICE', 'Test 17b: User role remains strictly unchanged (AGRICULTURE_OFFICE)');

    // 18. Self-deactivation prevention for System Admin
    const resAdminSelfDeactivate = await apiRequest('PUT', `/system/users/${sysAdminUser.id}`, sysAdminToken, {
      fullName: sysAdminUser.fullName,
      role: 'SYSTEM_ADMIN',
      isActive: false, // Attempting self-deactivation
    });
    assert(resAdminSelfDeactivate.status === 400, 'Test 18a: System Admin self-deactivation rejected with 400', resAdminSelfDeactivate);
    assert(resAdminSelfDeactivate.data.message.includes('deactivate their own account'), 'Test 18b: Informative self-deactivation prevention message');

    // 19. Self-role demotion prevention for System Admin
    const resAdminSelfDemote = await apiRequest('PUT', `/system/users/${sysAdminUser.id}`, sysAdminToken, {
      fullName: sysAdminUser.fullName,
      role: 'AGRICULTURE_OFFICE', // Attempting self-demotion
      isActive: true,
    });
    assert(resAdminSelfDemote.status === 400, 'Test 19a: System Admin self-role demotion rejected with 400', resAdminSelfDemote);

    // 20. Non-admin attempting to create a user -> rejected (403)
    const resAgriCreateUser = await apiRequest('POST', '/system/users', agriToken, {
      username: `rogue_admin_${Date.now()}`,
      password: 'Password123!',
      fullName: 'Rogue Admin',
      role: 'SYSTEM_ADMIN',
    });
    assert(resAgriCreateUser.status === 403, 'Test 20: Non-admin user creation attempt rejected with 403', resAgriCreateUser);

    // =========================================================================
    // SECTION 5: LEGITIMATE OPERATIONAL WORKFLOWS PRESERVED
    // =========================================================================
    console.log('\n--- SECTION 5: Legitimate Operational Workflows Preserved ---');

    // 21. Agriculture legitimately views farmers
    const resAgriLegitFarmers = await apiRequest('GET', '/farmers', agriToken);
    assert(resAgriLegitFarmers.status === 200, 'Test 21a: Agriculture legitimately retrieves farmers (200)');
    assert(Array.isArray(resAgriLegitFarmers.data.data), 'Test 21b: Farmers list returned in expected structure');

    // 22. Agriculture legitimately views allocations
    const resAgriLegitAllocs = await apiRequest('GET', '/allocations', agriToken);
    assert(resAgriLegitAllocs.status === 200, 'Test 22: Agriculture legitimately retrieves allocations (200)');

    // 23. Agriculture legitimately views fuel requests
    const resAgriLegitRequests = await apiRequest('GET', '/fuel-requests', agriToken);
    assert(resAgriLegitRequests.status === 200, 'Test 23: Agriculture legitimately retrieves fuel requests (200)');

    // 24. Trade legitimately views incoming fuel requests
    const resTradeLegitRequests = await apiRequest('GET', '/fuel-requests', tradeToken);
    assert(resTradeLegitRequests.status === 200, 'Test 24a: Trade legitimately retrieves fuel requests (200)');

    // 25. Trade legitimately views authorizations
    const resTradeLegitAuths = await apiRequest('GET', '/trade/authorizations', tradeToken);
    assert(resTradeLegitAuths.status === 200, 'Test 25: Trade legitimately retrieves authorizations (200)');

    // 26. Station Admin legitimately views own station transactions
    const resStationLegitTx = await apiRequest('GET', `/transactions?stationId=${stationA.id}`, stationAdminTokenA);
    assert(resStationLegitTx.status === 200, 'Test 26a: Station Admin legitimately retrieves own station transactions (200)');
    assert(Array.isArray(resStationLegitTx.data.data), 'Test 26b: Own station transactions returned in expected structure');

    // 27. Station Admin legitimately views own station report
    const resStationLegitReport = await apiRequest('GET', `/reports/station?stationId=${stationA.id}`, stationAdminTokenA);
    assert(resStationLegitReport.status === 200, 'Test 27: Station Admin legitimately retrieves own station report (200)');

    // 28. System Admin legitimately retrieves users
    const resSysAdminLegitUsers = await apiRequest('GET', '/system/users', sysAdminToken);
    assert(resSysAdminLegitUsers.status === 200, 'Test 28: System Admin legitimately retrieves users list (200)');
    assert(Array.isArray(resSysAdminLegitUsers.data.users), 'Test 28b: Users array returned to System Admin');

    // 29. Farmer photo authorization remains intact (Agri, Trade, Station can view, Admin blocked)
    const uploadsFarmersDir = path.resolve(process.cwd(), 'uploads/farmers');
    if (!fs.existsSync(uploadsFarmersDir)) {
      fs.mkdirSync(uploadsFarmersDir, { recursive: true });
    }
    const photoFileName = `farmer-p1t4-${Date.now()}.jpg`;
    const photoFilePath = path.join(uploadsFarmersDir, photoFileName);
    fs.writeFileSync(photoFilePath, Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46]));
    ephemeralFilePaths.push(photoFilePath);

    const defaultKebele = await prisma.kebele.findFirst();
    if (!defaultKebele) throw new Error('No kebele found');

    const photoFarmer = await prisma.farmer.create({
      data: {
        farmerCode: `FR-RBAC-${Date.now().toString().slice(-5)}`,
        fullName: 'Photo RBAC Farmer',
        phone: `+251 918 ${Date.now().toString().slice(-6, -3)} ${Date.now().toString().slice(-3)}`,
        kebeleId: defaultKebele.id,
        photoUrl: `/uploads/farmers/${photoFileName}`,
        eligibilityStatus: EligibilityStatus.ELIGIBLE,
      },
    });
    ephemeralFarmerIds.push(photoFarmer.id);

    const resAgriPhoto = await apiRequest('GET', `/farmers/${photoFarmer.id}/photo`, agriToken);
    assert(resAgriPhoto.status === 200, 'Test 29a: Agriculture can view farmer photo (200)');

    const resTradePhoto = await apiRequest('GET', `/farmers/${photoFarmer.id}/photo`, tradeToken);
    assert(resTradePhoto.status === 200, 'Test 29b: Trade can view farmer photo (200)');

    const resStationPhoto = await apiRequest('GET', `/farmers/${photoFarmer.id}/photo`, stationAdminTokenA);
    assert(resStationPhoto.status === 200, 'Test 29c: Station Admin can view farmer photo for dispensing verification (200)');

    const resAdminPhoto = await apiRequest('GET', `/farmers/${photoFarmer.id}/photo`, sysAdminToken);
    assert(resAdminPhoto.status === 403, 'Test 29d: System Admin is blocked from viewing farmer photo (403)');

    console.log('\n=============================================================================');
    console.log(`TEST SUMMARY: ${passedCount} / ${totalCount} ASSERTIONS PASSED`);
    console.log('=============================================================================');

    if (passedCount !== totalCount) {
      throw new Error(`Priority 1 Task 4 test suite failed: ${totalCount - passedCount} assertions failed.`);
    }
  } finally {
    // Teardown
    console.log('\n[Teardown] Cleaning up ephemeral test records...');
    for (const f of ephemeralFilePaths) {
      if (fs.existsSync(f)) {
        try { fs.unlinkSync(f); } catch {}
      }
    }
    if (ephemeralShortageIds.length > 0) {
      try {
        await prisma.fuelShortage.deleteMany({
          where: { id: { in: ephemeralShortageIds } },
        });
      } catch (e: any) {
        console.warn(`[Teardown] Warning cleaning up shortages: ${e.message}`);
      }
    }

    if (ephemeralFarmerIds.length > 0) {
      try {
        await prisma.farmerCard.deleteMany({ where: { farmerId: { in: ephemeralFarmerIds } } });
        await prisma.farmerIrrigationProfile.deleteMany({ where: { farmerId: { in: ephemeralFarmerIds } } });
        await prisma.farmer.deleteMany({ where: { id: { in: ephemeralFarmerIds } } });
      } catch (e: any) {
        console.warn(`[Teardown] Warning cleaning up farmers: ${e.message}`);
      }
    }

    if (ephemeralUserIds.length > 0) {
      try {
        await prisma.auditLog.deleteMany({ where: { userId: { in: ephemeralUserIds } } });
        await prisma.user.deleteMany({ where: { id: { in: ephemeralUserIds } } });
        console.log(`[Teardown] Successfully purged ${ephemeralUserIds.length} ephemeral test users.`);
      } catch (e: any) {
        console.warn(`[Teardown] Warning cleaning up users: ${e.message}`);
      }
    }

    if (server) {
      server.close();
      console.log('[Teardown] Ephemeral test server stopped.');
    }
    await prisma.$disconnect();
    console.log('[Teardown] Database disconnected.');
  }
}

runPriority1Task4Tests().catch((err) => {
  console.error('\n[FATAL] Test runner threw uncaught error:', err);
  process.exit(1);
});
