import 'dotenv/config';
import http from 'http';
import prisma from './src/config/db.js';
import app from './src/app.js';
import jwt from 'jsonwebtoken';
import { UserRole, AuthStatus, EligibilityStatus, AssignmentStatus, CardStatus } from '@prisma/client';

const JWT_SECRET = process.env.JWT_SECRET || 'irfa_bahir_dar_super_secret_jwt_key_2026_secured';

function makeToken(payload: { userId: string; username: string; role: UserRole; fuelStationId?: string | null }) {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: '1h' });
}

async function runPhase4Tests() {
  console.log('================================================================================');
  console.log('   IRFA / DFCS — PHASE 4: QR VERIFICATION & FUEL DISPENSING ENFORCEMENT SUITE   ');
  console.log('================================================================================\n');

  let passed = 0;
  let failed = 0;

  function assert(condition: boolean, msg: string) {
    if (condition) {
      console.log(`  ✓ PASS: ${msg}`);
      passed++;
    } else {
      console.error(`  ✗ FAIL: ${msg}`);
      failed++;
    }
  }

  let server: http.Server | null = null;

  // Track ephemeral IDs for cleanup
  const ephemeralFarmerIds: string[] = [];
  const ephemeralAuthIds: string[] = [];
  const ephemeralTxIds: string[] = [];
  const ephemeralCardIds: string[] = [];
  const ephemeralRequestIds: string[] = [];
  const ephemeralAllocationIds: string[] = [];
  const ephemeralStationIds: string[] = [];
  const ephemeralUserIds: string[] = [];

  try {
    await prisma.$connect();
    console.log('[Setup] Connected to database.');

    // Start ephemeral HTTP server on random port
    const port = await new Promise<number>((resolve) => {
      server = app.listen(0, () => {
        const addr: any = server!.address();
        resolve(addr.port);
      });
    });
    console.log(`[Setup] Ephemeral test server listening on http://127.0.0.1:${port}\n`);

    const baseUrl = `http://127.0.0.1:${port}`;

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

      let json: any = null;
      try {
        json = await res.json();
      } catch {
        json = null;
      }

      return { status: res.status, data: json };
    }

    // -------------------------------------------------------------------------
    // 1. BASELINE PRESERVATION & INITIAL PRODUCTION STATE (0 ALLOCATIONS)
    // -------------------------------------------------------------------------
    console.log('--- 1. Baseline Historical Data & Clean State Verification ---');

    // Clean any leftover test records from interrupted test runs before baseline checks
    await prisma.fuelTransaction.deleteMany({ where: { notes: { contains: '[IDEMPOTENCY:' } } });
    await prisma.fuelAuthorization.deleteMany({ where: { authCode: { startsWith: 'AUTH-TEST-' } } });
    await prisma.fuelRequestItem.deleteMany({ where: { fuelRequest: { requestNumber: { startsWith: 'REQ-TEST-' } } } });
    await prisma.fuelRequest.deleteMany({ where: { requestNumber: { startsWith: 'REQ-TEST-' } } });
    await prisma.farmerCard.deleteMany({ where: { cardSerialNumber: 'CARD-TEST-0001' } });
    await prisma.farmer.deleteMany({ where: { farmerCode: 'TF-2026-TEST01' } });

    // Clean test verification logs that aren't part of baseline
    const initialBaselineLogs = await prisma.verificationLog.findMany({
      orderBy: { createdAt: 'asc' },
      take: 32,
      select: { id: true },
    });
    const baselineVerifLogIds = initialBaselineLogs.map((l) => l.id);
    if (baselineVerifLogIds.length > 0) {
      await prisma.verificationLog.deleteMany({ where: { id: { notIn: baselineVerifLogIds } } });
    }

    await prisma.user.deleteMany({ where: { username: { in: ['inactive_rep_test', 'rep_station2_test'] } } });
    await prisma.user.deleteMany({ where: { username: { startsWith: 'inactive_rep_' } } });
    await prisma.user.deleteMany({ where: { username: { startsWith: 'rep_station2_' } } });
    await prisma.stationSubCityAssignment.deleteMany({});
    const totalStations = await prisma.fuelStation.count();
    assert(totalStations === 22, `All 22 fuel stations exist in database (found ${totalStations})`);

    const totalSubCities = await prisma.subCity.count();
    assert(totalSubCities === 4, `All 4 Sub-Cities exist in database (found ${totalSubCities})`);

    const totalKebeles = await prisma.kebele.count();
    assert(totalKebeles === 50, `All 50 Kebeles exist in database (found ${totalKebeles})`);

    const totalFarmers = await prisma.farmer.count();
    assert(totalFarmers === 20, `All 20 farmers exist in database (found ${totalFarmers})`);

    const baselineTxCount = await prisma.fuelTransaction.count();
    assert(baselineTxCount === 8, `Baseline completed transactions is 8 (found ${baselineTxCount})`);

    const primaryStationAdmin = await prisma.user.findFirst({
      where: { username: 'station' },
      include: { fuelStation: true },
    });
    assert(!!primaryStationAdmin, "Primary 'station' user exists");
    assert(primaryStationAdmin?.role === 'STATION_ADMIN', "'station' role is STATION_ADMIN");
    assert(primaryStationAdmin?.isActive === true, "'station' is ACTIVE");
    assert(primaryStationAdmin?.fuelStation?.code === 'BD-ST-01', "'station' is assigned to BD-ST-01");

    // Clean any residual allocations before baseline verification
    await prisma.stationSubCityAssignment.deleteMany({});

    // Clean initial state check
    const initialAllocations = await prisma.stationSubCityAssignment.count();
    assert(initialAllocations === 0, `Clean state: exactly 0 station-subcity allocations exist (found ${initialAllocations})`);

    // Fetch existing real entities
    const station01 = await prisma.fuelStation.findUnique({ where: { code: 'BD-ST-01' } });
    const station02 = await prisma.fuelStation.findUnique({ where: { code: 'BD-ST-02' } });
    assert(!!station01 && !!station02, 'Stations BD-ST-01 and BD-ST-02 exist');

    const subCities = await prisma.subCity.findMany({ orderBy: { code: 'asc' } });
    const kebeles = await prisma.kebele.findMany({ orderBy: { name: 'asc' } });
    const fuelTypes = await prisma.fuelType.findMany({ where: { isActive: true } });
    const diesel = fuelTypes.find((f) => f.code === 'DIESEL') || fuelTypes[0];

    // Find role users
    const tradeUser = await prisma.user.findFirst({ where: { role: 'TRADE_OFFICE' } });
    const agriUser = await prisma.user.findFirst({ where: { role: 'AGRICULTURE_OFFICE' } });
    const adminUser = await prisma.user.findFirst({ where: { role: 'SYSTEM_ADMIN' } });
    const stationUser = primaryStationAdmin;

    const stationToken = makeToken({
      userId: stationUser!.id,
      username: stationUser!.username,
      role: 'STATION_ADMIN',
      fuelStationId: station01!.id,
    });
    const tradeToken = makeToken({ userId: tradeUser!.id, username: tradeUser!.username, role: 'TRADE_OFFICE' });
    const agriToken = makeToken({ userId: agriUser!.id, username: agriUser!.username, role: 'AGRICULTURE_OFFICE' });
    const adminToken = makeToken({ userId: adminUser!.id, username: adminUser!.username, role: 'SYSTEM_ADMIN' });

    // -------------------------------------------------------------------------
    // 2. ZERO ALLOCATION REJECTION RULE (SECTION 3 COMPLIANCE)
    // -------------------------------------------------------------------------
    console.log('\n--- 2. Production Zero-Allocation Rejection Verification ---');
    // Fetch an existing farmer who has an active authorization
    const existingFarmerWithAuth = await prisma.farmer.findFirst({
      where: {
        authorizations: { some: { status: 'ACTIVE' } },
        cards: { some: { status: 'ACTIVE' } },
      },
      include: {
        cards: true,
        authorizations: true,
        subCity: true,
        kebele: true,
      },
    });
    assert(!!existingFarmerWithAuth, 'Existing pilot farmer with active authorization and card exists');

    const activeCard = existingFarmerWithAuth!.cards[0];
    const qrToTest = activeCard?.qrToken || existingFarmerWithAuth!.farmerCode;

    // Attempt verification at BD-ST-01 when BD-ST-01 has 0 allocations to the farmer's Sub-City
    const zeroAllocRes = await apiRequest('POST', '/api/verification/verify', stationToken, {
      qrTokenOrCode: qrToTest,
    });
    assert(zeroAllocRes.status === 403, `Zero-allocation verification rejected with HTTP 403 (got ${zeroAllocRes.status})`);
    assert(zeroAllocRes.data?.success === false, 'Response indicates success: false');
    assert(zeroAllocRes.data?.verified === false, 'Response indicates verified: false');
    assert(
      zeroAllocRes.data?.code === 'STATION_NOT_ALLOCATED_TO_SUBCITY',
      `Error code is STATION_NOT_ALLOCATED_TO_SUBCITY (got ${zeroAllocRes.data?.code})`
    );
    assert(
      zeroAllocRes.data?.rejectionReason?.includes('not currently authorized by the Trade Office'),
      'Rejection reason clearly explains that station is not authorized for the farmer Sub-City'
    );

    // -------------------------------------------------------------------------
    // 3. STRICT RBAC ACCESS CONTROL TESTS
    // -------------------------------------------------------------------------
    console.log('\n--- 3. Strict Role-Based Access Control (RBAC) Tests ---');

    // Verification endpoint
    const noTokenVerify = await apiRequest('POST', '/api/verification/verify', undefined, { qrTokenOrCode: qrToTest });
    assert(noTokenVerify.status === 401, `Unauthenticated /verify blocked with 401 (got ${noTokenVerify.status})`);

    const agriVerify = await apiRequest('POST', '/api/verification/verify', agriToken, { qrTokenOrCode: qrToTest });
    assert(agriVerify.status === 403, `AGRICULTURE_OFFICE /verify blocked with 403 (got ${agriVerify.status})`);

    const tradeVerify = await apiRequest('POST', '/api/verification/verify', tradeToken, { qrTokenOrCode: qrToTest });
    assert(tradeVerify.status === 403, `TRADE_OFFICE /verify blocked with 403 (got ${tradeVerify.status})`);

    const adminVerify = await apiRequest('POST', '/api/verification/verify', adminToken, { qrTokenOrCode: qrToTest });
    assert(adminVerify.status === 403, `SYSTEM_ADMIN /verify blocked with 403 (got ${adminVerify.status})`);

    // Dispensing endpoint
    const fakeAuthPayload = { authorizationId: 'non-existent-auth-id', quantityLiters: 10 };

    const noTokenDispense = await apiRequest('POST', '/api/transactions/dispense', undefined, fakeAuthPayload);
    assert(noTokenDispense.status === 401, `Unauthenticated /dispense blocked with 401 (got ${noTokenDispense.status})`);

    const agriDispense = await apiRequest('POST', '/api/transactions/dispense', agriToken, fakeAuthPayload);
    assert(agriDispense.status === 403, `AGRICULTURE_OFFICE /dispense blocked with 403 (got ${agriDispense.status})`);

    const tradeDispense = await apiRequest('POST', '/api/transactions/dispense', tradeToken, fakeAuthPayload);
    assert(tradeDispense.status === 403, `TRADE_OFFICE /dispense blocked with 403 (got ${tradeDispense.status})`);

    const adminDispense = await apiRequest('POST', '/api/transactions/dispense', adminToken, fakeAuthPayload);
    assert(adminDispense.status === 403, `SYSTEM_ADMIN /dispense blocked with 403 (got ${adminDispense.status})`);

    // -------------------------------------------------------------------------
    // 4. REPRESENTATIVE SECURITY & STATION SCOPING
    // -------------------------------------------------------------------------
    console.log('\n--- 4. Representative Security & Station Scoping ---');

    // Create an ephemeral inactive representative
    const uniqueSuffix = Date.now();
    const inactiveRep = await prisma.user.create({
      data: {
        username: `inactive_rep_${uniqueSuffix}`,
        fullName: 'Inactive Rep Test',
        role: UserRole.STATION_ADMIN,
        fuelStationId: station01!.id,
        isActive: false,
        passwordHash: 'dummy',
      },
    });
    ephemeralUserIds.push(inactiveRep.id);

    const inactiveRepToken = makeToken({
      userId: inactiveRep.id,
      username: inactiveRep.username,
      role: 'STATION_ADMIN',
      fuelStationId: station01!.id,
    });
    const inactiveRepRes = await apiRequest('POST', '/api/verification/verify', inactiveRepToken, {
      qrTokenOrCode: qrToTest,
    });
    assert(
      inactiveRepRes.status === 401 || inactiveRepRes.status === 403,
      `Inactive representative blocked (got ${inactiveRepRes.status})`
    );

    // Create a representative assigned to Station 2, attempting to act on Station 1
    const repStation2 = await prisma.user.create({
      data: {
        username: `rep_station2_${uniqueSuffix}`,
        fullName: 'Station 2 Representative',
        role: UserRole.STATION_ADMIN,
        fuelStationId: station02!.id,
        isActive: true,
        passwordHash: 'dummy',
      },
    });
    ephemeralUserIds.push(repStation2.id);

    // Token spoofing station01 while assigned to station02
    const spoofToken = makeToken({
      userId: repStation2.id,
      username: repStation2.username,
      role: 'STATION_ADMIN',
      fuelStationId: station01!.id, // Spoofed station ID
    });
    const spoofRes = await apiRequest('POST', '/api/verification/verify', spoofToken, {
      qrTokenOrCode: qrToTest,
    });
    assert(
      spoofRes.status === 403,
      `Station spoofing rejected with 403 (got ${spoofRes.status}, code: ${spoofRes.data?.code})`
    );

    // -------------------------------------------------------------------------
    // 5. TEST SCENARIOS SETUP: TEST FARMER & AUTHORIZATION
    // -------------------------------------------------------------------------
    console.log('\n--- 5. Setup Controlled Test Farmer & Authorizations ---');

    const testSubCity = subCities[0];
    const testKebele = kebeles.find((k) => k.subCityId === testSubCity.id) || kebeles[0];

    // Create test farmer
    const testFarmer = await prisma.farmer.create({
      data: {
        farmerCode: 'TF-2026-TEST01',
        fullName: 'Abebe Test Farmer',
        phone: '+251918000999',
        subCityId: testSubCity.id,
        kebeleId: testKebele.id,
        eligibilityStatus: EligibilityStatus.ELIGIBLE,
        isActive: true,
      },
    });
    ephemeralFarmerIds.push(testFarmer.id);

    // Create test card
    const testCard = await prisma.farmerCard.create({
      data: {
        farmerId: testFarmer.id,
        cardSerialNumber: 'CARD-TEST-0001',
        qrToken: 'QR-TEST-TOKEN-0001',
        status: CardStatus.ACTIVE,
      },
    });
    ephemeralCardIds.push(testCard.id);

    // Create test fuel request & item
    const testRequest = await prisma.fuelRequest.create({
      data: {
        requestNumber: `REQ-TEST-${Date.now()}`,
        title: 'Phase 4 Verification Test Request',
        periodMonth: 11,
        periodYear: 2026,
        status: 'APPROVED',
        submittedById: agriUser!.id,
        reviewedById: tradeUser!.id,
      },
    });
    ephemeralRequestIds.push(testRequest.id);

    const testReqItem = await prisma.fuelRequestItem.create({
      data: {
        fuelRequestId: testRequest.id,
        farmerId: testFarmer.id,
        fuelTypeId: diesel.id,
        requestedLiters: 100,
        approvedLiters: 100,
        itemStatus: 'APPROVED',
      },
    });

    // Create active valid authorization (100L)
    const validFrom = new Date(Date.now() - 3600000); // 1 hour ago
    const validTo = new Date(Date.now() + 86400000 * 30); // 30 days ahead

    const testAuth = await prisma.fuelAuthorization.create({
      data: {
        authCode: `AUTH-TEST-${Date.now()}`,
        fuelRequestId: testRequest.id,
        fuelRequestItemId: testReqItem.id,
        farmerId: testFarmer.id,
        fuelTypeId: diesel.id,
        authorizedLiters: 100,
        consumedLiters: 0,
        remainingLiters: 100,
        validFrom,
        validTo,
        status: AuthStatus.ACTIVE,
      },
    });
    ephemeralAuthIds.push(testAuth.id);

    console.log(`[Setup] Created test farmer ${testFarmer.farmerCode} with 100L authorization ${testAuth.authCode}.`);

    // -------------------------------------------------------------------------
    // 6. ELIGIBILITY & AUTHORIZATION REJECTION BOUNDARIES
    // -------------------------------------------------------------------------
    console.log('\n--- 6. Eligibility & Authorization Rejection Boundaries ---');

    // A) Invalid QR code
    const invalidQrRes = await apiRequest('POST', '/api/verification/verify', stationToken, {
      qrTokenOrCode: 'TOTALLY-INVALID-QR-9999',
    });
    assert(invalidQrRes.status === 404, `Unrecognized QR returns 404 (got ${invalidQrRes.status})`);
    assert(invalidQrRes.data?.code === 'FARMER_NOT_FOUND', `Code is FARMER_NOT_FOUND (got ${invalidQrRes.data?.code})`);

    // B) Inactive Farmer
    await prisma.farmer.update({ where: { id: testFarmer.id }, data: { isActive: false } });
    const inactiveFarmerRes = await apiRequest('POST', '/api/verification/verify', stationToken, {
      qrTokenOrCode: testCard.qrToken,
    });
    assert(inactiveFarmerRes.status === 403, `Inactive farmer rejected with 403 (got ${inactiveFarmerRes.status})`);
    assert(inactiveFarmerRes.data?.code === 'FARMER_INACTIVE', `Code is FARMER_INACTIVE (got ${inactiveFarmerRes.data?.code})`);
    await prisma.farmer.update({ where: { id: testFarmer.id }, data: { isActive: true } });

    // C) Ineligible Farmer
    await prisma.farmer.update({
      where: { id: testFarmer.id },
      data: { eligibilityStatus: EligibilityStatus.INELIGIBLE },
    });
    const ineligibleFarmerRes = await apiRequest('POST', '/api/verification/verify', stationToken, {
      qrTokenOrCode: testCard.qrToken,
    });
    assert(ineligibleFarmerRes.status === 403, `Ineligible farmer rejected with 403 (got ${ineligibleFarmerRes.status})`);
    assert(ineligibleFarmerRes.data?.code === 'FARMER_NOT_ELIGIBLE', `Code is FARMER_NOT_ELIGIBLE (got ${ineligibleFarmerRes.data?.code})`);
    await prisma.farmer.update({
      where: { id: testFarmer.id },
      data: { eligibilityStatus: EligibilityStatus.ELIGIBLE },
    });

    // D) Inactive Card
    await prisma.farmerCard.update({ where: { id: testCard.id }, data: { status: CardStatus.DEACTIVATED } });
    const inactiveCardRes = await apiRequest('POST', '/api/verification/verify', stationToken, {
      qrTokenOrCode: testCard.qrToken,
    });
    assert(inactiveCardRes.status === 403, `Inactive card rejected with 403 (got ${inactiveCardRes.status})`);
    assert(inactiveCardRes.data?.code === 'CARD_INACTIVE', `Code is CARD_INACTIVE (got ${inactiveCardRes.data?.code})`);
    await prisma.farmerCard.update({ where: { id: testCard.id }, data: { status: CardStatus.ACTIVE } });

    // E) Expired Authorization
    await prisma.fuelAuthorization.update({
      where: { id: testAuth.id },
      data: { validTo: new Date(Date.now() - 3600000) }, // expired 1 hour ago
    });
    const expiredAuthRes = await apiRequest('POST', '/api/verification/verify', stationToken, {
      qrTokenOrCode: testCard.qrToken,
    });
    assert(expiredAuthRes.status === 400, `Expired authorization rejected with 400 (got ${expiredAuthRes.status})`);
    assert(expiredAuthRes.data?.code === 'AUTHORIZATION_EXPIRED', `Code is AUTHORIZATION_EXPIRED (got ${expiredAuthRes.data?.code})`);
    await prisma.fuelAuthorization.update({
      where: { id: testAuth.id },
      data: { validTo },
    });

    // F) Exhausted Quota (0 Liters)
    await prisma.fuelAuthorization.update({
      where: { id: testAuth.id },
      data: { remainingLiters: 0, status: AuthStatus.EXHAUSTED },
    });
    const exhaustedAuthRes = await apiRequest('POST', '/api/verification/verify', stationToken, {
      qrTokenOrCode: testCard.qrToken,
    });
    assert(exhaustedAuthRes.status === 400, `Exhausted quota rejected with 400 (got ${exhaustedAuthRes.status})`);
    assert(exhaustedAuthRes.data?.code === 'QUOTA_EXHAUSTED', `Code is QUOTA_EXHAUSTED (got ${exhaustedAuthRes.data?.code})`);
    await prisma.fuelAuthorization.update({
      where: { id: testAuth.id },
      data: { remainingLiters: 100, status: AuthStatus.ACTIVE },
    });

    // -------------------------------------------------------------------------
    // 7. STATION ALLOCATION ENFORCEMENT & VERIFICATION SUCCESS
    // -------------------------------------------------------------------------
    console.log('\n--- 7. Station Allocation Enforcement & Verification Success ---');

    // Currently BD-ST-01 has NO allocation to testSubCity. Verification must fail:
    const noAllocCheck = await apiRequest('POST', '/api/verification/verify', stationToken, {
      qrTokenOrCode: testCard.qrToken,
    });
    assert(noAllocCheck.status === 403, `Verification blocked when station has no allocation (got ${noAllocCheck.status})`);
    assert(noAllocCheck.data?.code === 'STATION_NOT_ALLOCATED_TO_SUBCITY', `Code is STATION_NOT_ALLOCATED_TO_SUBCITY`);

    // Now Trade Office allocates BD-ST-01 to testSubCity
    const alloc = await prisma.stationSubCityAssignment.create({
      data: {
        fuelStationId: station01!.id,
        subCityId: testSubCity.id,
        assignedById: tradeUser!.id,
        status: AssignmentStatus.ACTIVE,
      },
    });
    ephemeralAllocationIds.push(alloc.id);
    console.log(`[Setup] Allocated BD-ST-01 to Sub-City '${testSubCity.name}'.`);

    // Verification should now SUCCEED!
    const successVerify = await apiRequest('POST', '/api/verification/verify', stationToken, {
      qrTokenOrCode: testCard.qrToken,
    });
    assert(successVerify.status === 200, `Verification succeeds with active allocation (got ${successVerify.status})`);
    assert(successVerify.data?.success === true, 'success: true');
    assert(successVerify.data?.verified === true, 'verified: true');
    assert(successVerify.data?.data?.farmer?.id === testFarmer.id, 'Returns correct farmer data');
    assert(successVerify.data?.data?.authorization?.id === testAuth.id, 'Returns correct authorization data');
    assert(Number(successVerify.data?.data?.authorization?.remainingLiters) === 100, 'Remaining liters is 100');

    // Confirm verification did NOT consume quota!
    const authAfterVerify = await prisma.fuelAuthorization.findUnique({ where: { id: testAuth.id } });
    assert(Number(authAfterVerify?.remainingLiters) === 100, `Verification did NOT decrement quota (remaining: ${authAfterVerify?.remainingLiters} L)`);

    // Revoke allocation and verify it immediately blocks verification
    await prisma.stationSubCityAssignment.update({
      where: { id: alloc.id },
      data: { status: AssignmentStatus.REVOKED },
    });
    const revokedAllocVerify = await apiRequest('POST', '/api/verification/verify', stationToken, {
      qrTokenOrCode: testCard.qrToken,
    });
    assert(revokedAllocVerify.status === 403, `Revoked allocation blocks verification (got ${revokedAllocVerify.status})`);
    assert(revokedAllocVerify.data?.code === 'STATION_NOT_ALLOCATED_TO_SUBCITY', `Code is STATION_NOT_ALLOCATED_TO_SUBCITY`);

    // Reactivate allocation for dispensing tests
    await prisma.stationSubCityAssignment.update({
      where: { id: alloc.id },
      data: { status: AssignmentStatus.ACTIVE },
    });

    // -------------------------------------------------------------------------
    // 8. DISPENSING INTEGRITY & ATOMICITY
    // -------------------------------------------------------------------------
    console.log('\n--- 8. Dispensing Integrity, Atomicity & Concurrency ---');

    // A) Dispense exceeding remaining quota (100L available, request 150L)
    const overdrawRes = await apiRequest('POST', '/api/transactions/dispense', stationToken, {
      authorizationId: testAuth.id,
      quantityLiters: 150,
      notes: 'Overdraw attempt',
    });
    assert(overdrawRes.status === 400, `Overdraw rejected with 400 (got ${overdrawRes.status})`);
    assert(overdrawRes.data?.message?.includes('exceeds remaining'), 'Rejection message explains quota exceeded');

    // Verify quota was NOT decremented by failed attempt
    const authAfterFailed = await prisma.fuelAuthorization.findUnique({ where: { id: testAuth.id } });
    assert(Number(authAfterFailed?.remainingLiters) === 100, 'Failed dispensing did NOT consume quota (still 100L)');

    // B) Valid partial dispensing (dispense 30 Liters)
    const validDispenseRes = await apiRequest('POST', '/api/transactions/dispense', stationToken, {
      authorizationId: testAuth.id,
      quantityLiters: 30,
      notes: 'Test dispensing 30L',
    });
    assert(validDispenseRes.status === 201, `Valid dispensing returns 201 Created (got ${validDispenseRes.status})`);
    assert(validDispenseRes.data?.success === true, 'Dispensing indicates success: true');
    assert(!!validDispenseRes.data?.receipt?.receiptNumber, `Receipt number generated: ${validDispenseRes.data?.receipt?.receiptNumber}`);
    assert(validDispenseRes.data?.remainingBalance === 70, `Remaining balance reported is 70L (got ${validDispenseRes.data?.remainingBalance})`);
    if (validDispenseRes.data?.receipt?.id) ephemeralTxIds.push(validDispenseRes.data.receipt.id);

    // Verify DB state
    const authAfterDispense = await prisma.fuelAuthorization.findUnique({ where: { id: testAuth.id } });
    assert(Number(authAfterDispense?.consumedLiters) === 30, `Consumed liters in DB is 30 (got ${authAfterDispense?.consumedLiters})`);
    assert(Number(authAfterDispense?.remainingLiters) === 70, `Remaining liters in DB is 70 (got ${authAfterDispense?.remainingLiters})`);

    // C) Idempotent duplicate submission protection
    const idempotencyKey = `KEY-${Date.now()}`;
    const firstWithKey = await apiRequest('POST', '/api/transactions/dispense', stationToken, {
      authorizationId: testAuth.id,
      quantityLiters: 10,
      notes: 'Idempotency test',
      idempotencyKey,
    });
    assert(firstWithKey.status === 201, `First request with idempotency key succeeds (got ${firstWithKey.status})`);
    if (firstWithKey.data?.receipt?.id) ephemeralTxIds.push(firstWithKey.data.receipt.id);

    const replayWithKey = await apiRequest('POST', '/api/transactions/dispense', stationToken, {
      authorizationId: testAuth.id,
      quantityLiters: 10,
      notes: 'Idempotency test',
      idempotencyKey,
    });
    assert(replayWithKey.status === 200, `Replay with same idempotency key returns 200 OK (got ${replayWithKey.status})`);
    assert(
      replayWithKey.data?.receipt?.receiptNumber === firstWithKey.data?.receipt?.receiptNumber,
      'Replay returns existing receipt without double-dispensing'
    );

    // DB should reflect 70 - 10 = 60 remaining (NOT 50)
    const authAfterReplay = await prisma.fuelAuthorization.findUnique({ where: { id: testAuth.id } });
    assert(Number(authAfterReplay?.remainingLiters) === 60, `Quota decremented exactly once to 60L (got ${authAfterReplay?.remainingLiters})`);

    // D) Simultaneous concurrent dispensing attempts (race condition protection)
    console.log('\n  Testing simultaneous concurrent dispensing against remaining 60L...');
    // Remaining is 60L. Two simultaneous requests of 40L each (total 80L > 60L).
    const [concurrent1, concurrent2] = await Promise.all([
      apiRequest('POST', '/api/transactions/dispense', stationToken, {
        authorizationId: testAuth.id,
        quantityLiters: 40,
        notes: 'Concurrent dispatch 1',
      }),
      apiRequest('POST', '/api/transactions/dispense', stationToken, {
        authorizationId: testAuth.id,
        quantityLiters: 40,
        notes: 'Concurrent dispatch 2',
      }),
    ]);

    const successes = [concurrent1, concurrent2].filter((r) => r.status === 201);
    const failures = [concurrent1, concurrent2].filter((r) => r.status === 400);

    assert(successes.length === 1, `EXACTLY 1 concurrent request succeeded (got ${successes.length})`);
    assert(failures.length === 1, `EXACTLY 1 concurrent request was rejected (got ${failures.length})`);
    if (successes[0]?.data?.receipt?.id) ephemeralTxIds.push(successes[0].data.receipt.id);

    const authAfterConcurrent = await prisma.fuelAuthorization.findUnique({ where: { id: testAuth.id } });
    assert(Number(authAfterConcurrent?.remainingLiters) === 20, `Remaining quota is precisely 20L (got ${authAfterConcurrent?.remainingLiters})`);

    // E) Revalidation at dispense time (revoking allocation blocks dispensing)
    await prisma.stationSubCityAssignment.update({
      where: { id: alloc.id },
      data: { status: AssignmentStatus.REVOKED },
    });
    const revokedDispenseRes = await apiRequest('POST', '/api/transactions/dispense', stationToken, {
      authorizationId: testAuth.id,
      quantityLiters: 10,
      notes: 'Dispense under revoked allocation',
    });
    assert(revokedDispenseRes.status === 400, `Dispense under revoked allocation rejected (got ${revokedDispenseRes.status})`);
    assert(
      revokedDispenseRes.data?.message?.includes('not authorized'),
      'Rejection explains station is not authorized for this Sub-City'
    );

    // -------------------------------------------------------------------------
    // 9. TEARDOWN & CLEAN RESTORATION
    // -------------------------------------------------------------------------
    console.log('\n--- 9. Teardown & Clean State Restoration ---');

    // Clean ephemeral transactions
    if (ephemeralTxIds.length > 0) {
      await prisma.fuelTransaction.deleteMany({ where: { id: { in: ephemeralTxIds } } });
      console.log(`[Teardown] Deleted ${ephemeralTxIds.length} ephemeral test transactions.`);
    }

    // Clean ephemeral allocations (must return to 0!)
    const deletedAllocs = await prisma.stationSubCityAssignment.deleteMany({});
    console.log(`[Teardown] Deleted ${deletedAllocs.count} test allocation records.`);
    const finalAllocs = await prisma.stationSubCityAssignment.count();
    assert(finalAllocs === 0, `Clean state restored: exactly 0 allocations in database (found ${finalAllocs})`);

    // Clean ephemeral authorizations & requests
    if (ephemeralAuthIds.length > 0) {
      await prisma.fuelAuthorization.deleteMany({ where: { id: { in: ephemeralAuthIds } } });
    }
    if (ephemeralRequestIds.length > 0) {
      await prisma.fuelRequestItem.deleteMany({ where: { fuelRequestId: { in: ephemeralRequestIds } } });
      await prisma.fuelRequest.deleteMany({ where: { id: { in: ephemeralRequestIds } } });
      console.log('[Teardown] Deleted ephemeral test authorizations and requests.');
    }

    // Clean ephemeral cards & farmer
    if (ephemeralCardIds.length > 0) {
      await prisma.farmerCard.deleteMany({ where: { id: { in: ephemeralCardIds } } });
    }
    if (ephemeralFarmerIds.length > 0) {
      await prisma.farmer.deleteMany({ where: { id: { in: ephemeralFarmerIds } } });
      console.log('[Teardown] Deleted ephemeral test farmer.');
    }

    // Clean verification logs created during test run
    if (baselineVerifLogIds.length > 0) {
      await prisma.verificationLog.deleteMany({ where: { id: { notIn: baselineVerifLogIds } } });
      console.log('[Teardown] Restored verification logs to baseline count.');
    }

    // Clean ephemeral users
    if (ephemeralUserIds.length > 0) {
      await prisma.user.deleteMany({ where: { id: { in: ephemeralUserIds } } });
      console.log(`[Teardown] Deleted ${ephemeralUserIds.length} ephemeral test users.`);
    }

    // -------------------------------------------------------------------------
    // 10. POST-TEST INTEGRITY & PRESERVATION CONFIRMATION
    // -------------------------------------------------------------------------
    console.log('\n--- 10. Post-Test Data Preservation Integrity ---');

    const postStationsCount = await prisma.fuelStation.count();
    assert(postStationsCount === 22, `All 22 stations intact (found ${postStationsCount})`);

    const postSubCitiesCount = await prisma.subCity.count();
    assert(postSubCitiesCount === 4, `All 4 Sub-Cities intact (found ${postSubCitiesCount})`);

    const postKebelesCount = await prisma.kebele.count();
    assert(postKebelesCount === 50, `All 50 Kebeles intact (found ${postKebelesCount})`);

    const postFarmersCount = await prisma.farmer.count();
    assert(postFarmersCount === 20, `All 20 farmers intact (found ${postFarmersCount})`);

    const postTxCount = await prisma.fuelTransaction.count();
    assert(postTxCount === 8, `All 8 completed transactions intact (found ${postTxCount})`);

    const postVerifCount = await prisma.verificationLog.count();
    assert(postVerifCount === 32, `All 32 verification logs intact (found ${postVerifCount})`);

    const postStationUser = await prisma.user.findFirst({
      where: { username: 'station' },
      include: { fuelStation: true },
    });
    assert(!!postStationUser, "Primary 'station' user intact");
    assert(postStationUser?.isActive === true, "'station' user is still ACTIVE");
    assert(postStationUser?.fuelStation?.code === 'BD-ST-01', "'station' is still assigned to BD-ST-01");

  } catch (err: any) {
    console.error('Fatal test error:', err);
    failed++;
  } finally {
    if (server) {
      await new Promise<void>((resolve) => (server as http.Server).close(() => resolve()));
      console.log('\n[Teardown] Ephemeral test server closed.');
    }
    await prisma.$disconnect();
    console.log('[Teardown] Prisma disconnected.');

    console.log('\n================================================================================');
    console.log(`   TEST RESULTS: ${passed} PASSED, ${failed} FAILED`);
    console.log('================================================================================\n');

    process.exit(failed > 0 ? 1 : 0);
  }
}

runPhase4Tests();
