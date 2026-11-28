/**
 * =============================================================================
 * IRFA / DIGITAL FUEL COUPON SYSTEM — PRIORITY 1, TASK 3 TEST SUITE
 * Farmer Registration Validation & Duplicate Handling Test Suite (14 Scenarios)
 * =============================================================================
 */

import 'dotenv/config';
import http from 'http';
import jwt from 'jsonwebtoken';
import { UserRole, CardStatus, EligibilityStatus } from '@prisma/client';
import app from './src/app.js';
import prisma from './src/config/db.js';

const JWT_SECRET = process.env.JWT_SECRET || 'irfa_bahir_dar_super_secret_jwt_key_2026_secured';

function makeToken(payload: { userId: string; username: string; role: string }) {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: '1h' });
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

async function runPriority1Task3Tests() {
  console.log('=============================================================================');
  console.log('IRFA PRIORITY 1, TASK 3: FARMER REGISTRATION VALIDATION & DUPLICATE TESTS');
  console.log('=============================================================================\n');

  let server: http.Server | null = null;
  const ephemeralFarmerIds: string[] = [];
  const ephemeralUserIds: string[] = [];

  try {
    // 1. Database connection check
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

    // 2. Start ephemeral HTTP server on random port
    const port = await new Promise<number>((resolve) => {
      server = app.listen(0, () => {
        const addr: any = server!.address();
        resolve(addr.port);
      });
    });
    console.log(`[Setup] Ephemeral test server listening on http://127.0.0.1:${port}\n`);
    const baseUrl = `http://127.0.0.1:${port}/api`;

    async function apiRequest(method: string, path: string, token?: string, body?: any, isMultipart = false) {
      const headers: Record<string, string> = {};
      if (!isMultipart) {
        headers['Content-Type'] = 'application/json';
      }
      if (token) {
        headers['Authorization'] = `Bearer ${token}`;
      }

      let reqBody: any = undefined;
      if (body) {
        if (isMultipart) {
          reqBody = body;
        } else {
          reqBody = JSON.stringify(body);
        }
      }

      const res = await fetch(`${baseUrl}${path}`, {
        method,
        headers,
        body: reqBody,
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

    // 3. Fetch valid Sub-Cities and Kebeles for test fixtures
    const subCities = await prisma.subCity.findMany({
      include: { kebeles: true },
      orderBy: { name: 'asc' },
    });
    if (subCities.length < 2 || subCities[0].kebeles.length === 0 || subCities[1].kebeles.length === 0) {
      throw new Error('Database must have at least 2 Sub-Cities with Kebeles for registration tests.');
    }

    const subCityA = subCities[0];
    const kebeleA1 = subCityA.kebeles[0];
    const subCityB = subCities[1];
    const kebeleB1 = subCityB.kebeles[0];

    const agriUser = await prisma.user.create({
      data: {
        username: `agri_p1t3_${Date.now().toString().slice(-6)}`,
        passwordHash: '$2a$10$abcdefghijklmnopqrstuv',
        fullName: 'Agriculture Officer P1T3',
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

    console.log(`Using Sub-City A: ${subCityA.name} (Kebele: ${kebeleA1.name})`);
    console.log(`Using Sub-City B: ${subCityB.name} (Kebele: ${kebeleB1.name})\n`);

    const timestamp = Date.now();
    const testPhone1 = `+251 918 ${String(timestamp).slice(-6, -3)} ${String(timestamp).slice(-3)}`;
    const testNationalId1 = `ETH-TEST-${timestamp.toString().slice(-6)}`;

    // =========================================================================
    // SCENARIO 1: Valid farmer registration succeeds (201)
    // =========================================================================
    console.log('--- SCENARIO 1: Valid Farmer Registration ---');
    const validPayload = {
      fullName: 'Abebe Bikila Test',
      gender: 'ወንድ',
      subCityId: subCityA.id,
      kebeleId: kebeleA1.id,
      landSizeHectares: 2.5,
      primaryCrops: 'Teff and Onion',
      pumpFuelType: 'Diesel',
      declaredFuelLiters: 120,
      phone: testPhone1,
      nationalId: testNationalId1.toLowerCase(), // test lowercase normalization
      waterSource: 'LAKE_TANA',
    };

    const res1 = await apiRequest('POST', '/farmers', agriToken, validPayload);
    assert(res1.status === 201, 'Scenario 1: Returns HTTP 201 Created', res1);
    assert(res1.data.success === true, 'Scenario 1: success is true');
    assert(res1.data.farmer && res1.data.farmer.farmerCode.startsWith('FR-'), 'Scenario 1: FarmerCode generated with FR- prefix');
    assert(res1.data.farmer.nationalId === testNationalId1.toUpperCase(), 'Scenario 1: National ID normalized to uppercase');
    assert(res1.data.farmer.cards && res1.data.farmer.cards.length === 1, 'Scenario 1: FarmerCard automatically created');
    assert(res1.data.farmer.irrigationProfile !== null, 'Scenario 1: IrrigationProfile automatically created');

    if (res1.data.farmer?.id) {
      ephemeralFarmerIds.push(res1.data.farmer.id);
    }

    // =========================================================================
    // SCENARIO 2: Duplicate National ID rejected cleanly (409 DUPLICATE_NATIONAL_ID)
    // =========================================================================
    console.log('\n--- SCENARIO 2: Duplicate National ID Rejection ---');
    const duplicateIdPayload = {
      ...validPayload,
      fullName: 'Different Farmer Name',
      phone: `+251 918 ${String(timestamp + 1).slice(-6, -3)} ${String(timestamp + 1).slice(-3)}`,
      nationalId: testNationalId1.toUpperCase(), // Same National ID
    };

    const res2 = await apiRequest('POST', '/farmers', agriToken, duplicateIdPayload);
    assert(res2.status === 409, 'Scenario 2: Returns HTTP 409 Conflict', res2);
    assert(res2.data.code === 'DUPLICATE_NATIONAL_ID', 'Scenario 2: Error code is DUPLICATE_NATIONAL_ID');
    assert(res2.data.field === 'nationalId', 'Scenario 2: Error field is nationalId');
    assert(typeof res2.data.message === 'string' && res2.data.message.includes('መታወቂያ'), 'Scenario 2: Returns descriptive message');
    assert(!res2.data.error && !res2.data.stack, 'Scenario 2: No raw database error or stack trace leaked');

    // =========================================================================
    // SCENARIO 3: Duplicate phone rejected cleanly (409 DUPLICATE_PHONE)
    // =========================================================================
    console.log('\n--- SCENARIO 3: Duplicate Phone Rejection ---');
    // Test with compact/local format of the same phone number
    const localPhone = '0' + testPhone1.replace('+251 ', '').replace(/\s/g, '');
    const duplicatePhonePayload = {
      ...validPayload,
      fullName: 'Another Farmer Name',
      phone: localPhone, // same phone in 09... format
      nationalId: `ETH-TEST-${(timestamp + 2).toString().slice(-6)}`,
    };

    const res3 = await apiRequest('POST', '/farmers', agriToken, duplicatePhonePayload);
    assert(res3.status === 409, 'Scenario 3: Returns HTTP 409 Conflict for duplicate phone', res3);
    assert(res3.data.code === 'DUPLICATE_PHONE', 'Scenario 3: Error code is DUPLICATE_PHONE');
    assert(res3.data.field === 'phone', 'Scenario 3: Error field is phone');
    assert(typeof res3.data.message === 'string' && res3.data.message.includes('ስልክ'), 'Scenario 3: Returns descriptive phone duplicate message');

    // =========================================================================
    // SCENARIO 4: Invalid National ID format rejected (400)
    // =========================================================================
    console.log('\n--- SCENARIO 4: Invalid National ID Format Rejection ---');
    // 4a. Special characters/HTML
    const res4a = await apiRequest('POST', '/farmers', agriToken, {
      ...validPayload,
      phone: `+251 918 ${String(timestamp + 3).slice(-6, -3)} ${String(timestamp + 3).slice(-3)}`,
      nationalId: '<script>alert(1)</script>',
    });
    assert(res4a.status === 400, 'Scenario 4a: Rejects script injection in National ID with HTTP 400', res4a);
    assert(res4a.data.field === 'nationalId', 'Scenario 4a: Points error to nationalId field');

    // 4b. Too short (<4 chars)
    const res4b = await apiRequest('POST', '/farmers', agriToken, {
      ...validPayload,
      phone: `+251 918 ${String(timestamp + 4).slice(-6, -3)} ${String(timestamp + 4).slice(-3)}`,
      nationalId: 'ID1',
    });
    assert(res4b.status === 400, 'Scenario 4b: Rejects too short National ID with HTTP 400', res4b);
    assert(res4b.data.field === 'nationalId', 'Scenario 4b: Points error to nationalId field');

    // 4c. Too long (>40 chars)
    const res4c = await apiRequest('POST', '/farmers', agriToken, {
      ...validPayload,
      phone: `+251 918 ${String(timestamp + 5).slice(-6, -3)} ${String(timestamp + 5).slice(-3)}`,
      nationalId: 'A'.repeat(45),
    });
    assert(res4c.status === 400, 'Scenario 4c: Rejects too long National ID with HTTP 400', res4c);
    assert(res4c.data.field === 'nationalId', 'Scenario 4c: Points error to nationalId field');

    // =========================================================================
    // SCENARIO 5: Invalid phone format rejected (400)
    // =========================================================================
    console.log('\n--- SCENARIO 5: Invalid Phone Format Rejection ---');
    // 5a. Identical digits (dummy number 0999999999)
    const res5a = await apiRequest('POST', '/farmers', agriToken, {
      ...validPayload,
      phone: '0999999999',
      nationalId: `ETH-TEST-${(timestamp + 6).toString().slice(-6)}`,
    });
    assert(res5a.status === 400, 'Scenario 5a: Rejects all-identical digits dummy phone with HTTP 400', res5a);
    assert(res5a.data.field === 'phone', 'Scenario 5a: Points error to phone field');

    // 5b. Too short
    const res5b = await apiRequest('POST', '/farmers', agriToken, {
      ...validPayload,
      phone: '091234',
      nationalId: `ETH-TEST-${(timestamp + 7).toString().slice(-6)}`,
    });
    assert(res5b.status === 400, 'Scenario 5b: Rejects short phone number with HTTP 400', res5b);

    // 5c. Foreign phone number (+1 555 123 4567)
    const res5c = await apiRequest('POST', '/farmers', agriToken, {
      ...validPayload,
      phone: '+1 555 123 4567',
      nationalId: `ETH-TEST-${(timestamp + 8).toString().slice(-6)}`,
    });
    assert(res5c.status === 400, 'Scenario 5c: Rejects non-Ethiopian international number with HTTP 400', res5c);

    // 5d. Non-numeric / letters
    const res5d = await apiRequest('POST', '/farmers', agriToken, {
      ...validPayload,
      phone: '0911abcdef',
      nationalId: `ETH-TEST-${(timestamp + 9).toString().slice(-6)}`,
    });
    assert(res5d.status === 400, 'Scenario 5d: Rejects alphanumeric phone with HTTP 400', res5d);

    // =========================================================================
    // SCENARIO 6: Missing required fields rejected (400)
    // =========================================================================
    console.log('\n--- SCENARIO 6: Missing Required Fields Rejection ---');
    // 6a. Missing fullName
    const { fullName, ...missingName } = validPayload;
    const res6a = await apiRequest('POST', '/farmers', agriToken, {
      ...missingName,
      phone: `+251 918 ${String(timestamp + 10).slice(-6, -3)} ${String(timestamp + 10).slice(-3)}`,
    });
    assert(res6a.status === 400, 'Scenario 6a: Missing fullName returns 400', res6a);
    assert(res6a.data.field === 'fullName', 'Scenario 6a: Field indicates fullName');

    // 6b. Missing gender
    const { gender, ...missingGender } = validPayload;
    const res6b = await apiRequest('POST', '/farmers', agriToken, {
      ...missingGender,
      phone: `+251 918 ${String(timestamp + 11).slice(-6, -3)} ${String(timestamp + 11).slice(-3)}`,
    });
    assert(res6b.status === 400, 'Scenario 6b: Missing gender returns 400', res6b);
    assert(res6b.data.field === 'gender', 'Scenario 6b: Field indicates gender');

    // 6c. Missing subCityId
    const { subCityId, ...missingSubCity } = validPayload;
    const res6c = await apiRequest('POST', '/farmers', agriToken, {
      ...missingSubCity,
      phone: `+251 918 ${String(timestamp + 12).slice(-6, -3)} ${String(timestamp + 12).slice(-3)}`,
    });
    assert(res6c.status === 400, 'Scenario 6c: Missing subCityId returns 400', res6c);
    assert(res6c.data.field === 'subCityId', 'Scenario 6c: Field indicates subCityId');

    // 6d. Missing kebeleId
    const { kebeleId, ...missingKebele } = validPayload;
    const res6d = await apiRequest('POST', '/farmers', agriToken, {
      ...missingKebele,
      phone: `+251 918 ${String(timestamp + 13).slice(-6, -3)} ${String(timestamp + 13).slice(-3)}`,
    });
    assert(res6d.status === 400, 'Scenario 6d: Missing kebeleId returns 400', res6d);
    assert(res6d.data.field === 'kebeleId', 'Scenario 6d: Field indicates kebeleId');

    // =========================================================================
    // SCENARIO 7: Empty strings handled correctly
    // =========================================================================
    console.log('\n--- SCENARIO 7: Empty Strings Handling ---');
    // 7a. Empty string nationalId normalized to null and multiple can coexist
    const phone7a = `+251 918 ${String(timestamp + 14).slice(-6, -3)} ${String(timestamp + 14).slice(-3)}`;
    const res7a = await apiRequest('POST', '/farmers', agriToken, {
      ...validPayload,
      fullName: 'Farmer Empty ID 1',
      phone: phone7a,
      nationalId: '', // Empty string
    });
    assert(res7a.status === 201, 'Scenario 7a: Registration with empty string nationalId succeeds (201)', res7a);
    assert(res7a.data.farmer?.nationalId === null, 'Scenario 7a: Empty string nationalId converted to null in DB');
    if (res7a.data.farmer?.id) ephemeralFarmerIds.push(res7a.data.farmer.id);

    // 7b. Whitespace-only nationalId normalized to null and coexists without collision
    const phone7b = `+251 918 ${String(timestamp + 15).slice(-6, -3)} ${String(timestamp + 15).slice(-3)}`;
    const res7b = await apiRequest('POST', '/farmers', agriToken, {
      ...validPayload,
      fullName: 'Farmer Empty ID 2',
      phone: phone7b,
      nationalId: '   ', // Whitespace only
    });
    assert(res7b.status === 201, 'Scenario 7b: Second registration with whitespace nationalId coexists without P2002 (201)', res7b);
    assert(res7b.data.farmer?.nationalId === null, 'Scenario 7b: Whitespace nationalId converted to null in DB');
    if (res7b.data.farmer?.id) ephemeralFarmerIds.push(res7b.data.farmer.id);

    // 7c. Empty string required field rejected
    const res7c = await apiRequest('POST', '/farmers', agriToken, {
      ...validPayload,
      fullName: '   ',
      phone: `+251 918 ${String(timestamp + 16).slice(-6, -3)} ${String(timestamp + 16).slice(-3)}`,
    });
    assert(res7c.status === 400, 'Scenario 7c: Whitespace-only fullName rejected with 400', res7c);
    assert(res7c.data.field === 'fullName', 'Scenario 7c: Points error to fullName field');

    // =========================================================================
    // SCENARIO 8: Invalid kebele/subcity relationship rejected
    // =========================================================================
    console.log('\n--- SCENARIO 8: Kebele & SubCity Mismatch Rejection ---');
    const res8 = await apiRequest('POST', '/farmers', agriToken, {
      ...validPayload,
      subCityId: subCityA.id,
      kebeleId: kebeleB1.id, // Belongs to Sub-City B, not A!
      phone: `+251 918 ${String(timestamp + 17).slice(-6, -3)} ${String(timestamp + 17).slice(-3)}`,
    });
    assert(res8.status === 400, 'Scenario 8: Sub-City / Kebele mismatch returns HTTP 400', res8);
    assert(res8.data.code === 'SUB_CITY_MISMATCH', 'Scenario 8: Error code is SUB_CITY_MISMATCH');
    assert(res8.data.field === 'kebeleId', 'Scenario 8: Field points to kebeleId');

    // =========================================================================
    // SCENARIO 9: Duplicate Prisma P2002 returns clean 409 response, not 500
    // =========================================================================
    console.log('\n--- SCENARIO 9: Safe P2002 Error Mapping ---');
    // We already verified duplicate nationalId triggers clean 409. Let's verify updating an existing
    // farmer to an already existing nationalId triggers clean 409 and not 500.
    const farmerToUpdate = res7a.data.farmer.id;
    const res9 = await apiRequest('PUT', `/farmers/${farmerToUpdate}`, agriToken, {
      nationalId: testNationalId1.toUpperCase(), // belongs to farmer 1!
    });
    assert(res9.status === 409, 'Scenario 9: Updating to existing National ID returns 409 Conflict', res9);
    assert(res9.data.code === 'DUPLICATE_NATIONAL_ID', 'Scenario 9: Code is DUPLICATE_NATIONAL_ID');
    assert(res9.data.field === 'nationalId', 'Scenario 9: Field is nationalId');
    assert(!res9.data.error, 'Scenario 9: Error object is not leaked in update 409 response');

    // =========================================================================
    // SCENARIO 10: Raw database error details & stack traces NEVER exposed
    // =========================================================================
    console.log('\n--- SCENARIO 10: Database Error Information Hiding ---');
    // Check all previous error responses
    const allResponses = [res2, res3, res4a, res5a, res6a, res8, res9];
    let anyStackLeaked = false;
    let anyPrismaLeaked = false;
    for (const r of allResponses) {
      const str = JSON.stringify(r.data);
      if (str.includes('PrismaClientKnownRequestError') || str.includes('prisma.') || str.includes('ClientVersion')) {
        anyPrismaLeaked = true;
      }
      if (str.includes('stack') || str.includes('node_modules')) {
        anyStackLeaked = true;
      }
    }
    assert(!anyStackLeaked, 'Scenario 10: Zero stack traces leaked in error responses');
    assert(!anyPrismaLeaked, 'Scenario 10: Zero raw Prisma internal driver messages leaked');

    // =========================================================================
    // SCENARIO 11: Concurrent duplicate registrations cannot create duplicates
    // =========================================================================
    console.log('\n--- SCENARIO 11: Concurrent Duplicate Registration Defense ---');
    const concurrentPhone = `+251 918 ${String(timestamp + 20).slice(-6, -3)} ${String(timestamp + 20).slice(-3)}`;
    const concurrentNationalId = `ETH-RACE-${timestamp.toString().slice(-6)}`;

    const req1Promise = apiRequest('POST', '/farmers', agriToken, {
      ...validPayload,
      fullName: 'Race Farmer Alpha',
      phone: concurrentPhone,
      nationalId: concurrentNationalId,
    });

    const req2Promise = apiRequest('POST', '/farmers', agriToken, {
      ...validPayload,
      fullName: 'Race Farmer Beta',
      phone: concurrentPhone,
      nationalId: concurrentNationalId,
    });

    const [resRace1, resRace2] = await Promise.all([req1Promise, req2Promise]);
    const statuses = [resRace1.status, resRace2.status].sort();

    assert(statuses[0] === 201, 'Scenario 11: Exactly one concurrent registration succeeds with 201', { resRace1, resRace2 });
    assert(statuses[1] === 409, 'Scenario 11: Concurrent duplicate is safely rejected with 409', { resRace1, resRace2 });
    assert(statuses[1] !== 500, 'Scenario 11: Race condition never causes HTTP 500 server error');

    if (resRace1.data.farmer?.id) ephemeralFarmerIds.push(resRace1.data.farmer.id);
    if (resRace2.data.farmer?.id) ephemeralFarmerIds.push(resRace2.data.farmer.id);

    // Verify DB count
    const countCreated = await prisma.farmer.count({
      where: { nationalId: concurrentNationalId },
    });
    assert(countCreated === 1, 'Scenario 11: Exactly 1 record exists in the database for the concurrent submission');

    // =========================================================================
    // SCENARIO 12: Valid registration with farmer photo works
    // =========================================================================
    console.log('\n--- SCENARIO 12: Registration with Farmer Photo ---');
    const photoPayload = {
      ...validPayload,
      fullName: 'Farmer With Photo URL',
      phone: `+251 918 ${String(timestamp + 22).slice(-6, -3)} ${String(timestamp + 22).slice(-3)}`,
      nationalId: `ETH-PHOTO-${timestamp.toString().slice(-6)}`,
      photoUrl: '/uploads/farmers/sample-test-photo.jpg',
    };

    const res12 = await apiRequest('POST', '/farmers', agriToken, photoPayload);
    assert(res12.status === 201, 'Scenario 12: Farmer registration with photo succeeds (201)', res12);
    assert(res12.data.farmer?.photoUrl === '/uploads/farmers/sample-test-photo.jpg', 'Scenario 12: Photo URL persisted accurately');
    if (res12.data.farmer?.id) ephemeralFarmerIds.push(res12.data.farmer.id);

    // =========================================================================
    // SCENARIO 13: Registration error does not corrupt or partially create records
    // =========================================================================
    console.log('\n--- SCENARIO 13: Atomicity and Clean State on Validation Failure ---');
    const doomedPhone = `+251 918 ${String(timestamp + 25).slice(-6, -3)} ${String(timestamp + 25).slice(-3)}`;
    const res13 = await apiRequest('POST', '/farmers', agriToken, {
      ...validPayload,
      fullName: 'Doomed Farmer',
      phone: doomedPhone,
      subCityId: subCityA.id,
      kebeleId: kebeleB1.id, // intentional mismatch to trigger failure
    });
    assert(res13.status === 400, 'Scenario 13: Mismatched kebele fails as expected', res13);

    const partialFarmer = await prisma.farmer.findFirst({
      where: { phone: doomedPhone },
    });
    assert(partialFarmer === null, 'Scenario 13: No partial farmer record created');

    // =========================================================================
    // SCENARIO 14: Existing registration behavior remains compatible
    // =========================================================================
    console.log('\n--- SCENARIO 14: System Compatibility & Audit Verification ---');
    const firstFarmer = await prisma.farmer.findUnique({
      where: { id: ephemeralFarmerIds[0] },
      include: { cards: true, irrigationProfile: true, subCity: true, kebele: true },
    });

    assert(firstFarmer !== null, 'Scenario 14: Created farmer exists with complete relations');
    assert(firstFarmer?.eligibilityStatus === EligibilityStatus.ELIGIBLE, 'Scenario 14: EligibilityStatus is ELIGIBLE');
    assert(firstFarmer?.cards[0]?.status === CardStatus.ACTIVE, 'Scenario 14: Card status is ACTIVE');
    assert(firstFarmer?.cards[0]?.qrToken.startsWith('QR-FR-'), 'Scenario 14: QR token formatted with QR-FR- prefix');

    const auditLog = await prisma.auditLog.findFirst({
      where: {
        entityId: ephemeralFarmerIds[0],
        action: 'CREATE_FARMER',
      },
    });
    assert(auditLog !== null, 'Scenario 14: Audit log CREATE_FARMER recorded with operator user ID');

    console.log('\n=============================================================================');
    console.log(`TEST SUMMARY: ${passedCount} / ${totalCount} ASSERTIONS PASSED`);
    console.log('=============================================================================');

    if (passedCount !== totalCount) {
      throw new Error(`Priority 1 Task 3 test suite failed: ${totalCount - passedCount} assertions failed.`);
    }
  } finally {
    // Teardown: delete test fixtures created
    console.log('\n[Teardown] Cleaning up ephemeral test records...');
    if (ephemeralFarmerIds.length > 0) {
      try {
        await prisma.farmerCard.deleteMany({
          where: { farmerId: { in: ephemeralFarmerIds } },
        });
        await prisma.farmerIrrigationProfile.deleteMany({
          where: { farmerId: { in: ephemeralFarmerIds } },
        });
        await prisma.auditLog.deleteMany({
          where: { entityId: { in: ephemeralFarmerIds } },
        });
        await prisma.farmer.deleteMany({
          where: { id: { in: ephemeralFarmerIds } },
        });
        console.log(`[Teardown] Successfully cleaned up ${ephemeralFarmerIds.length} ephemeral farmers.`);
      } catch (e: any) {
        console.warn(`[Teardown] Warning during cleanup: ${e.message}`);
      }
    }

    if (ephemeralUserIds.length > 0) {
      try {
        await prisma.user.deleteMany({
          where: { id: { in: ephemeralUserIds } },
        });
        console.log(`[Teardown] Successfully cleaned up ${ephemeralUserIds.length} ephemeral users.`);
      } catch (e: any) {
        console.warn(`[Teardown] Warning during user cleanup: ${e.message}`);
      }
    }

    if (server) {
      server.close();
      console.log('[Teardown] Ephemeral test server closed.');
    }
    await prisma.$disconnect();
    console.log('[Teardown] Database disconnected.');
  }
}

runPriority1Task3Tests().catch((err) => {
  console.error('\n[FATAL] Test runner threw uncaught error:', err);
  process.exit(1);
});
