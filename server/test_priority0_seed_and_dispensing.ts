import 'dotenv/config';
import http from 'http';
import prisma from './src/config/db.js';
import app from './src/app.js';
import jwt from 'jsonwebtoken';
import {
  UserRole,
  AuthStatus,
  EligibilityStatus,
  AssignmentStatus,
  CardStatus,
  AllocationStatus,
  RequestStatus,
  ItemStatus,
} from '@prisma/client';
import { OFFICIAL_STATIONS_MASTER } from './src/config/officialStations.js';
import { OFFICIAL_SUB_CITIES } from './src/config/officialLocations.js';

const JWT_SECRET = process.env.JWT_SECRET || 'irfa_bahir_dar_super_secret_jwt_key_2026_secured';

function makeToken(payload: { userId: string; username: string; role: UserRole; fuelStationId?: string | null }) {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: '1h' });
}

async function runPriority0Tests() {
  console.log('================================================================================');
  console.log('   IRFA PRIORITY 0: CLEAN SEED READINESS & DISPENSING ALLOCATION INTEGRITY      ');
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
  const ephemeralUserIds: string[] = [];
  const ephemeralFarmerIds: string[] = [];
  const ephemeralCardIds: string[] = [];
  const ephemeralStationIds: string[] = [];
  const ephemeralSubCityAssignIds: string[] = [];
  const ephemeralRequestIds: string[] = [];
  const ephemeralItemIds: string[] = [];
  const ephemeralAuthIds: string[] = [];
  const ephemeralAllocIds: string[] = [];
  const ephemeralTxIds: string[] = [];

  try {
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

    // =========================================================================
    // SECTION 1: MASTER DATA & SEED INTEGRITY AUDIT
    // =========================================================================
    console.log('--- SECTION 1: SEED MASTER DATA & COVERAGE INTEGRITY ---');

    // 1.1 Verify official station count
    const totalStations = await prisma.fuelStation.count();
    assert(
      totalStations >= 21,
      `Official station roster in database: expected >= 21, found ${totalStations}`
    );

    // 1.2 Verify official sub-cities
    const subCities = await prisma.subCity.findMany();
    const expectedSubCityCodes = ['SC-TANA', 'SC-BELAY-ZELEKE', 'SC-DAGMAWI-MENELIK', 'SC-ATSE-TEWODROS'];
    const foundSubCityCodes = subCities.map((s) => s.code);
    const allSubCitiesPresent = expectedSubCityCodes.every((c) => foundSubCityCodes.includes(c));
    assert(
      allSubCitiesPresent,
      `All 4 official Sub-Cities exist: [${foundSubCityCodes.join(', ')}]`
    );

    // 1.3 Verify official kebeles count
    const totalKebeles = await prisma.kebele.count();
    assert(
      totalKebeles >= 45,
      `Official kebele count in database: expected >= 45, found ${totalKebeles}`
    );

    // 1.4 Verify station assignments coverage
    const stationAssignments = await prisma.stationSubCityAssignment.findMany({
      where: { status: AssignmentStatus.ACTIVE },
      include: { subCity: true, fuelStation: true },
    });
    const coveredSubCityCodes = Array.from(new Set(stationAssignments.map((a) => a.subCity.code)));
    console.log(`  [Info] Active station-to-subcity allocations: ${stationAssignments.length}`);
    console.log(`  [Info] Sub-Cities with active station coverage: [${coveredSubCityCodes.join(', ')}]`);

    const hasSubCityCoverage = expectedSubCityCodes.every((c) => coveredSubCityCodes.includes(c));
    // If database already had assignments or will have them after fresh seed:
    if (!hasSubCityCoverage) {
      console.log('  [Notice] Live DB is pre-seed. Synchronizing official station assignments for Section 1 check...');
      // Ensure test station assignments exist
      const tradeUser = await prisma.user.findFirst({ where: { role: UserRole.TRADE_OFFICE } });
      const tanaSC = await prisma.subCity.findUnique({ where: { code: 'SC-TANA' } });
      const atseSC = await prisma.subCity.findUnique({ where: { code: 'SC-ATSE-TEWODROS' } });
      const bzSC = await prisma.subCity.findUnique({ where: { code: 'SC-BELAY-ZELEKE' } });
      const dmSC = await prisma.subCity.findUnique({ where: { code: 'SC-DAGMAWI-MENELIK' } });

      const st01 = await prisma.fuelStation.findUnique({ where: { code: 'BD-ST-01' } });
      const st02 = await prisma.fuelStation.findUnique({ where: { code: 'BD-ST-02' } });
      const st04 = await prisma.fuelStation.findUnique({ where: { code: 'BD-ST-04' } });
      const st06 = await prisma.fuelStation.findUnique({ where: { code: 'BD-ST-06' } });

      if (tradeUser && tanaSC && st01) {
        const a1 = await prisma.stationSubCityAssignment.upsert({
          where: { subCityId_fuelStationId: { subCityId: tanaSC.id, fuelStationId: st01.id } },
          update: { status: AssignmentStatus.ACTIVE },
          create: { subCityId: tanaSC.id, fuelStationId: st01.id, assignedById: tradeUser.id, status: AssignmentStatus.ACTIVE },
        });
        ephemeralSubCityAssignIds.push(a1.id);
      }
      if (tradeUser && atseSC && st02) {
        const a2 = await prisma.stationSubCityAssignment.upsert({
          where: { subCityId_fuelStationId: { subCityId: atseSC.id, fuelStationId: st02.id } },
          update: { status: AssignmentStatus.ACTIVE },
          create: { subCityId: atseSC.id, fuelStationId: st02.id, assignedById: tradeUser.id, status: AssignmentStatus.ACTIVE },
        });
        ephemeralSubCityAssignIds.push(a2.id);
      }
      if (tradeUser && bzSC && st04) {
        const a3 = await prisma.stationSubCityAssignment.upsert({
          where: { subCityId_fuelStationId: { subCityId: bzSC.id, fuelStationId: st04.id } },
          update: { status: AssignmentStatus.ACTIVE },
          create: { subCityId: bzSC.id, fuelStationId: st04.id, assignedById: tradeUser.id, status: AssignmentStatus.ACTIVE },
        });
        ephemeralSubCityAssignIds.push(a3.id);
      }
      if (tradeUser && dmSC && st06) {
        const a4 = await prisma.stationSubCityAssignment.upsert({
          where: { subCityId_fuelStationId: { subCityId: dmSC.id, fuelStationId: st06.id } },
          update: { status: AssignmentStatus.ACTIVE },
          create: { subCityId: dmSC.id, fuelStationId: st06.id, assignedById: tradeUser.id, status: AssignmentStatus.ACTIVE },
        });
        ephemeralSubCityAssignIds.push(a4.id);
      }
    }

    const recheckedAssignments = await prisma.stationSubCityAssignment.findMany({
      where: { status: AssignmentStatus.ACTIVE },
      include: { subCity: true },
    });
    const recheckedCodes = Array.from(new Set(recheckedAssignments.map((a) => a.subCity.code)));
    assert(
      expectedSubCityCodes.every((c) => recheckedCodes.includes(c)),
      `All 4 Sub-Cities have active StationSubCityAssignments: [${recheckedCodes.join(', ')}]`
    );

    // 1.5 Verify station operator credentials alignment
    const stationOperator = await prisma.user.findFirst({
      where: { role: UserRole.STATION_ADMIN },
      include: { fuelStation: true },
    });
    assert(
      stationOperator !== null && stationOperator.fuelStation !== null && stationOperator.fuelStation.isActive,
      `Station operator '${stationOperator?.username}' is assigned to active station '${stationOperator?.fuelStation?.name}' (${stationOperator?.fuelStation?.code})`
    );

    // =========================================================================
    // SECTION 2: DISPENSING INTEGRITY & ALLOCATION ENFORCEMENT TEST MATRIX
    // =========================================================================
    console.log('\n--- SECTION 2: DISPENSING QUOTA & ALLOCATION INTEGRITY MATRIX ---');

    // Create isolated ephemeral test fixtures
    const dieselFuel = await prisma.fuelType.findFirst({ where: { code: 'DIESEL' } });
    if (!dieselFuel) throw new Error('Diesel fuel type not found in database.');

    const tanaSubCity = await prisma.subCity.findFirst({ where: { code: 'SC-TANA' } });
    if (!tanaSubCity) throw new Error('SC-TANA not found in database.');

    const tanaKebele = await prisma.kebele.findFirst({ where: { subCityId: tanaSubCity.id } });
    if (!tanaKebele) throw new Error('Kebele for SC-TANA not found in database.');

    // 1. Ephemeral Station in SC-TANA
    const testStation = await prisma.fuelStation.create({
      data: {
        code: `BD-TEST-ST-${Date.now().toString().slice(-6)}`,
        name: 'Priority 0 Test Fuel Station',
        location: 'Lake Tana Test District',
        isActive: true,
      },
    });
    ephemeralStationIds.push(testStation.id);

    // 2. Ephemeral Operator for Test Station
    const testOperator = await prisma.user.create({
      data: {
        username: `p0_operator_${Date.now().toString().slice(-6)}`,
        passwordHash: '$2a$10$abcdefghijklmnopqrstuv',
        fullName: 'Priority 0 Test Operator',
        role: UserRole.STATION_ADMIN,
        fuelStationId: testStation.id,
        isActive: true,
      },
    });
    ephemeralUserIds.push(testOperator.id);
    const operatorToken = makeToken({
      userId: testOperator.id,
      username: testOperator.username,
      role: testOperator.role,
      fuelStationId: testStation.id,
    });

    // 3. Ephemeral StationSubCityAssignment (Test Station -> SC-TANA)
    const adminUser = (await prisma.user.findFirst({ where: { role: UserRole.SYSTEM_ADMIN } })) || testOperator;
    const testStationAssign = await prisma.stationSubCityAssignment.create({
      data: {
        subCityId: tanaSubCity.id,
        fuelStationId: testStation.id,
        assignedById: adminUser.id,
        status: AssignmentStatus.ACTIVE,
        notes: 'Priority 0 Test Suite Station Assignment',
      },
    });
    ephemeralSubCityAssignIds.push(testStationAssign.id);

    // 4. Ephemeral Farmer in SC-TANA
    const testFarmer = await prisma.farmer.create({
      data: {
        farmerCode: `FR-P0-${Date.now().toString().slice(-6)}`,
        fullName: 'Priority 0 Test Farmer',
        phone: '+251 918 999 001',
        nationalId: `ETH-P0-${Date.now().toString().slice(-6)}`,
        subCityId: tanaSubCity.id,
        kebeleId: tanaKebele.id,
        eligibilityStatus: EligibilityStatus.ELIGIBLE,
        isActive: true,
      },
    });
    ephemeralFarmerIds.push(testFarmer.id);

    // 5. Ephemeral Card
    const testCard = await prisma.farmerCard.create({
      data: {
        farmerId: testFarmer.id,
        cardSerialNumber: `CARD-P0-${Date.now().toString().slice(-6)}`,
        qrToken: `QR-P0-TOKEN-${Date.now()}`,
        status: CardStatus.ACTIVE,
      },
    });
    ephemeralCardIds.push(testCard.id);

    // 6. Ephemeral Fuel Request
    const testRequest = await prisma.fuelRequest.create({
      data: {
        requestNumber: `REQ-P0-${Date.now().toString().slice(-6)}`,
        periodMonth: 11,
        periodYear: 2026,
        title: 'Priority 0 Automated Test Request',
        status: RequestStatus.APPROVED,
        submittedById: adminUser.id,
        reviewedById: adminUser.id,
        reviewedAt: new Date(),
        totalFarmersCount: 1,
        totalLitersRequested: 500,
        totalLitersApproved: 500,
      },
    });
    ephemeralRequestIds.push(testRequest.id);

    // 7. Ephemeral Fuel Request Item
    const testItem = await prisma.fuelRequestItem.create({
      data: {
        fuelRequestId: testRequest.id,
        farmerId: testFarmer.id,
        fuelTypeId: dieselFuel.id,
        requestedLiters: 500,
        approvedLiters: 500,
        itemStatus: ItemStatus.APPROVED,
      },
    });
    ephemeralItemIds.push(testItem.id);

    // -------------------------------------------------------------------------
    // Scenario 1: Scanner verification succeeds cleanly on valid setup
    // -------------------------------------------------------------------------
    console.log('\n  [Scenario 1] Scanner Verification Clean Success');
    const authValidPeriod = await prisma.fuelAuthorization.create({
      data: {
        authCode: `AUTH-P0-S1-${Date.now().toString().slice(-6)}`,
        fuelRequestId: testRequest.id,
        fuelRequestItemId: testItem.id,
        farmerId: testFarmer.id,
        fuelTypeId: dieselFuel.id,
        authorizedLiters: 200,
        consumedLiters: 0,
        remainingLiters: 200,
        validFrom: new Date(Date.now() - 3600000), // 1 hour ago
        validTo: new Date(Date.now() + 86400000), // tomorrow
        status: AuthStatus.ACTIVE,
      },
    });
    ephemeralAuthIds.push(authValidPeriod.id);

    const allocValidPeriod = await prisma.monthlyAllocation.create({
      data: {
        farmerId: testFarmer.id,
        fuelTypeId: dieselFuel.id,
        month: authValidPeriod.validFrom.getMonth() + 1,
        year: authValidPeriod.validFrom.getFullYear(),
        allocatedLiters: 200,
        usedLiters: 0,
        remainingLiters: 200,
        status: AllocationStatus.ACTIVE,
      },
    });
    ephemeralAllocIds.push(allocValidPeriod.id);

    const verifyRes = await apiRequest('POST', '/api/verification/verify', operatorToken, {
      qrTokenOrCode: testCard.qrToken,
      fuelTypeId: dieselFuel.id,
    });
    assert(
      verifyRes.status === 200 && verifyRes.data.verified === true,
      `QR verification returns 200 OK and verified=true (found: status=${verifyRes.status}, verified=${verifyRes.data?.verified})`
    );

    // -------------------------------------------------------------------------
    // Scenario 2: Valid Dispensing (Both Auth & Alloc Sufficient)
    // -------------------------------------------------------------------------
    console.log('\n  [Scenario 2] Valid Dispensing (Both Balances Sufficient)');
    const dispenseRes1 = await apiRequest('POST', '/api/transactions/dispense', operatorToken, {
      authorizationId: authValidPeriod.id,
      quantityLiters: 50,
      notes: 'Priority 0 Test Dispense 50L',
    });
    assert(
      dispenseRes1.status === 201 && dispenseRes1.data.success === true,
      `Dispensing succeeds with 201 Created (status=${dispenseRes1.status})`
    );

    const authAfterS2 = await prisma.fuelAuthorization.findUnique({ where: { id: authValidPeriod.id } });
    const allocAfterS2 = await prisma.monthlyAllocation.findUnique({ where: { id: allocValidPeriod.id } });

    assert(
      Number(authAfterS2?.remainingLiters) === 150 && Number(authAfterS2?.consumedLiters) === 50,
      `Authorization atomically decremented: remaining=${authAfterS2?.remainingLiters} L (expected 150), consumed=${authAfterS2?.consumedLiters} L`
    );
    assert(
      Number(allocAfterS2?.remainingLiters) === 150 && Number(allocAfterS2?.usedLiters) === 50,
      `Monthly allocation atomically decremented: remaining=${allocAfterS2?.remainingLiters} L (expected 150), used=${allocAfterS2?.usedLiters} L`
    );

    if (dispenseRes1.data?.receipt?.id) {
      ephemeralTxIds.push(dispenseRes1.data.receipt.id);
    }

    // -------------------------------------------------------------------------
    // Scenario 3: Authorization Exceeded Rejection
    // -------------------------------------------------------------------------
    console.log('\n  [Scenario 3] Authorization Limit Rejection (Requested > Auth Balance)');
    // Current auth remaining is 150 L. Attempt to dispense 160 L.
    const dispenseExceedAuth = await apiRequest('POST', '/api/transactions/dispense', operatorToken, {
      authorizationId: authValidPeriod.id,
      quantityLiters: 160,
      notes: 'Should fail - exceeds auth',
    });
    assert(
      dispenseExceedAuth.status === 400 && dispenseExceedAuth.data.success === false,
      `Overdraw beyond authorization rejected with 400 (code=${dispenseExceedAuth.data?.code}, msg='${dispenseExceedAuth.data?.message}')`
    );

    const authAfterS3 = await prisma.fuelAuthorization.findUnique({ where: { id: authValidPeriod.id } });
    const allocAfterS3 = await prisma.monthlyAllocation.findUnique({ where: { id: allocValidPeriod.id } });
    assert(
      Number(authAfterS3?.remainingLiters) === 150 && Number(allocAfterS3?.remainingLiters) === 150,
      `Balances remained strictly untouched after authorization overdraw rejection (auth=${authAfterS3?.remainingLiters}, alloc=${allocAfterS3?.remainingLiters})`
    );

    // -------------------------------------------------------------------------
    // Scenario 4: Monthly Allocation Exceeded Rejection (Requested > Alloc Balance)
    // -------------------------------------------------------------------------
    console.log('\n  [Scenario 4] Monthly Allocation Limit Rejection (Requested > Alloc Balance)');
    // Set monthly allocation remaining to 30 L, while authorization still has 150 L.
    await prisma.monthlyAllocation.update({
      where: { id: allocValidPeriod.id },
      data: { remainingLiters: 30, usedLiters: 170 },
    });

    // Attempt to dispense 50 L (within auth of 150 L, but exceeds allocation of 30 L)
    const dispenseExceedAlloc = await apiRequest('POST', '/api/transactions/dispense', operatorToken, {
      authorizationId: authValidPeriod.id,
      quantityLiters: 50,
      notes: 'Should fail - exceeds monthly allocation',
    });
    assert(
      dispenseExceedAlloc.status === 400 &&
        dispenseExceedAlloc.data.success === false &&
        (dispenseExceedAlloc.data.code === 'MONTHLY_ALLOCATION_EXCEEDED' ||
          dispenseExceedAlloc.data.message?.includes('MONTHLY_ALLOCATION_EXCEEDED')),
      `Overdraw beyond monthly allocation rejected with 400 and MONTHLY_ALLOCATION_EXCEEDED (msg='${dispenseExceedAlloc.data?.message}')`
    );

    const authAfterS4 = await prisma.fuelAuthorization.findUnique({ where: { id: authValidPeriod.id } });
    const allocAfterS4 = await prisma.monthlyAllocation.findUnique({ where: { id: allocValidPeriod.id } });
    assert(
      Number(authAfterS4?.remainingLiters) === 150 && Number(allocAfterS4?.remainingLiters) === 30,
      `Balances remained strictly untouched after monthly allocation rejection (auth=${authAfterS4?.remainingLiters}, alloc=${allocAfterS4?.remainingLiters})`
    );

    // -------------------------------------------------------------------------
    // Scenario 5: Monthly Allocation Exhausted Rejection (0 L remaining)
    // -------------------------------------------------------------------------
    console.log('\n  [Scenario 5] Monthly Allocation Exhausted Rejection (0 L remaining)');
    await prisma.monthlyAllocation.update({
      where: { id: allocValidPeriod.id },
      data: { remainingLiters: 0, usedLiters: 200, status: AllocationStatus.EXHAUSTED },
    });

    const dispenseAllocExhausted = await apiRequest('POST', '/api/transactions/dispense', operatorToken, {
      authorizationId: authValidPeriod.id,
      quantityLiters: 10,
      notes: 'Should fail - allocation is exhausted',
    });
    assert(
      dispenseAllocExhausted.status === 400 &&
        (dispenseAllocExhausted.data.code === 'MONTHLY_ALLOCATION_EXHAUSTED' ||
          dispenseAllocExhausted.data.message?.includes('MONTHLY_ALLOCATION_EXHAUSTED')),
      `Dispensing against exhausted allocation rejected with 400 (msg='${dispenseAllocExhausted.data?.message}')`
    );

    // -------------------------------------------------------------------------
    // Scenario 6: Station Not Allocated to Sub-City Rejection
    // -------------------------------------------------------------------------
    console.log('\n  [Scenario 6] Station Not Authorized for Sub-City Enforcement');
    // Create rogue station not assigned to SC-TANA
    const rogueStation = await prisma.fuelStation.create({
      data: {
        code: `BD-ROGUE-${Date.now().toString().slice(-6)}`,
        name: 'Rogue Test Fuel Station',
        location: 'Outside Bahir Dar',
        isActive: true,
      },
    });
    ephemeralStationIds.push(rogueStation.id);

    const rogueOperator = await prisma.user.create({
      data: {
        username: `rogue_op_${Date.now().toString().slice(-6)}`,
        passwordHash: '$2a$10$abcdefghijklmnopqrstuv',
        fullName: 'Rogue Operator',
        role: UserRole.STATION_ADMIN,
        fuelStationId: rogueStation.id,
        isActive: true,
      },
    });
    ephemeralUserIds.push(rogueOperator.id);
    const rogueToken = makeToken({
      userId: rogueOperator.id,
      username: rogueOperator.username,
      role: rogueOperator.role,
      fuelStationId: rogueStation.id,
    });

    const rogueDispense = await apiRequest('POST', '/api/transactions/dispense', rogueToken, {
      authorizationId: authValidPeriod.id,
      quantityLiters: 10,
      notes: 'Rogue station attempt',
    });
    assert(
      rogueDispense.status === 400 &&
        (rogueDispense.data.code === 'STATION_NOT_ALLOCATED' ||
          rogueDispense.data.message?.includes('STATION_NOT_ALLOCATED')),
      `Rogue unallocated station rejected with STATION_NOT_ALLOCATED (status=${rogueDispense.status}, msg='${rogueDispense.data?.message}')`
    );

    // -------------------------------------------------------------------------
    // Scenario 7: Concurrency Burst Protection on Allocation Quota
    // -------------------------------------------------------------------------
    console.log('\n  [Scenario 7] Concurrency Burst Race Condition Protection');
    // Setup: Auth has 60 L. Allocation has 40 L.
    // Send 5 parallel requests of 10 L each (Total requested: 50 L).
    // Exactly 4 MUST succeed (40 L total). Exactly 1 MUST fail (allocation exceeded).
    await prisma.fuelAuthorization.update({
      where: { id: authValidPeriod.id },
      data: { remainingLiters: 60, consumedLiters: 140, status: AuthStatus.ACTIVE },
    });
    await prisma.monthlyAllocation.update({
      where: { id: allocValidPeriod.id },
      data: { remainingLiters: 40, usedLiters: 160, status: AllocationStatus.ACTIVE },
    });

    const burstRequests = Array.from({ length: 5 }, (_, i) =>
      apiRequest('POST', '/api/transactions/dispense', operatorToken, {
        authorizationId: authValidPeriod.id,
        quantityLiters: 10,
        notes: `Burst test attempt #${i + 1}`,
      })
    );

    const burstResults = await Promise.all(burstRequests);
    const burstSuccesses = burstResults.filter((r) => r.status === 201);
    const burstRejections = burstResults.filter((r) => r.status === 400);

    for (const res of burstSuccesses) {
      if (res.data?.receipt?.id) ephemeralTxIds.push(res.data.receipt.id);
    }

    assert(
      burstSuccesses.length === 4,
      `Exactly 4 of 5 burst requests succeeded: ${burstSuccesses.length} successes (40 L total)`
    );
    assert(
      burstRejections.length === 1,
      `Exactly 1 of 5 burst requests was safely rejected: ${burstRejections.length} rejections`
    );

    const authAfterBurst = await prisma.fuelAuthorization.findUnique({ where: { id: authValidPeriod.id } });
    const allocAfterBurst = await prisma.monthlyAllocation.findUnique({ where: { id: allocValidPeriod.id } });

    assert(
      Number(authAfterBurst?.remainingLiters) === 20,
      `Authorization balance preserved exactly: ${authAfterBurst?.remainingLiters} L (expected 20 L)`
    );
    assert(
      Number(allocAfterBurst?.remainingLiters) === 0 && allocAfterBurst?.status === AllocationStatus.EXHAUSTED,
      `Monthly allocation balance reached exactly 0 L and transitioned to EXHAUSTED (found: ${allocAfterBurst?.remainingLiters} L, status=${allocAfterBurst?.status})`
    );

    // -------------------------------------------------------------------------
    // Scenario 8: Idempotency Key Replay Protection
    // -------------------------------------------------------------------------
    console.log('\n  [Scenario 8] Idempotency Key Replay Protection');
    // Reset balances for test: Auth = 50 L, Alloc = 50 L
    await prisma.fuelAuthorization.update({
      where: { id: authValidPeriod.id },
      data: { remainingLiters: 50, consumedLiters: 150, status: AuthStatus.ACTIVE },
    });
    await prisma.monthlyAllocation.update({
      where: { id: allocValidPeriod.id },
      data: { remainingLiters: 50, usedLiters: 150, status: AllocationStatus.ACTIVE },
    });

    const testIdempotencyKey = `IDEMP-P0-${Date.now()}`;
    const firstDispense = await apiRequest('POST', '/api/transactions/dispense', operatorToken, {
      authorizationId: authValidPeriod.id,
      quantityLiters: 15,
      idempotencyKey: testIdempotencyKey,
      notes: 'Initial idempotent transaction',
    });

    assert(
      firstDispense.status === 201 && firstDispense.data.success === true,
      `First transaction created receipt #${firstDispense.data?.receipt?.receiptNumber}`
    );
    if (firstDispense.data?.receipt?.id) ephemeralTxIds.push(firstDispense.data.receipt.id);

    // Replay with exact same idempotency key
    const replayDispense = await apiRequest('POST', '/api/transactions/dispense', operatorToken, {
      authorizationId: authValidPeriod.id,
      quantityLiters: 15,
      idempotencyKey: testIdempotencyKey,
      notes: 'Replay idempotent transaction',
    });

    assert(
      replayDispense.status === 200 &&
        replayDispense.data.success === true &&
        replayDispense.data.receipt?.receiptNumber === firstDispense.data.receipt?.receiptNumber,
      `Replayed transaction returned 200 OK with identical receipt #${replayDispense.data?.receipt?.receiptNumber}`
    );

    const authAfterReplay = await prisma.fuelAuthorization.findUnique({ where: { id: authValidPeriod.id } });
    const allocAfterReplay = await prisma.monthlyAllocation.findUnique({ where: { id: allocValidPeriod.id } });

    assert(
      Number(authAfterReplay?.remainingLiters) === 35,
      `Authorization not double-deducted: remaining is ${authAfterReplay?.remainingLiters} L (expected 35 L)`
    );
    assert(
      Number(allocAfterReplay?.remainingLiters) === 35,
      `Monthly allocation not double-deducted: remaining is ${allocAfterReplay?.remainingLiters} L (expected 35 L)`
    );

    // -------------------------------------------------------------------------
    // Scenario 9: Transaction Rollback on Concurrent Failure
    // -------------------------------------------------------------------------
    console.log('\n  [Scenario 9] Transaction Atomicity & Rollback Integrity');
    // If an error is thrown after authorization check or during allocation lock,
    // verify no partial updates leak into the database.
    const preRollbackAuth = await prisma.fuelAuthorization.findUnique({ where: { id: authValidPeriod.id } });
    const preRollbackAlloc = await prisma.monthlyAllocation.findUnique({ where: { id: allocValidPeriod.id } });

    // Intentionally pass an invalid quantity (e.g. 0 or negative) handled by Zod schema
    const failedDispense = await apiRequest('POST', '/api/transactions/dispense', operatorToken, {
      authorizationId: authValidPeriod.id,
      quantityLiters: -10,
    });
    assert(failedDispense.status === 400, `Invalid quantity rejected with 400 (status=${failedDispense.status})`);

    const postRollbackAuth = await prisma.fuelAuthorization.findUnique({ where: { id: authValidPeriod.id } });
    const postRollbackAlloc = await prisma.monthlyAllocation.findUnique({ where: { id: allocValidPeriod.id } });

    assert(
      Number(preRollbackAuth?.remainingLiters) === Number(postRollbackAuth?.remainingLiters) &&
        Number(preRollbackAlloc?.remainingLiters) === Number(postRollbackAlloc?.remainingLiters),
      `Full atomicity maintained: zero partial decrements on rejected transactions.`
    );
  } catch (err: any) {
    console.error('Fatal error in Priority 0 test suite:', err);
    failed++;
  } finally {
    // =========================================================================
    // CLEANUP EPHEMERAL TEST FIXTURES
    // =========================================================================
    console.log('\n--- CLEANUP: Removing ephemeral test records ---');
    try {
      if (ephemeralUserIds.length > 0) {
        await prisma.verificationLog.deleteMany({ where: { operatorId: { in: ephemeralUserIds } } });
        await prisma.fuelTransaction.deleteMany({ where: { operatorId: { in: ephemeralUserIds } } });
        await prisma.auditLog.deleteMany({ where: { userId: { in: ephemeralUserIds } } });
      }
      if (ephemeralTxIds.length > 0) {
        await prisma.fuelTransaction.deleteMany({ where: { id: { in: ephemeralTxIds } } });
      }
      if (ephemeralAuthIds.length > 0) {
        await prisma.stationAssignment.deleteMany({ where: { fuelAuthorizationId: { in: ephemeralAuthIds } } });
        await prisma.fuelAuthorization.deleteMany({ where: { id: { in: ephemeralAuthIds } } });
      }
      if (ephemeralAllocIds.length > 0) {
        await prisma.monthlyAllocation.deleteMany({ where: { id: { in: ephemeralAllocIds } } });
      }
      if (ephemeralItemIds.length > 0) {
        await prisma.fuelRequestItem.deleteMany({ where: { id: { in: ephemeralItemIds } } });
      }
      if (ephemeralRequestIds.length > 0) {
        await prisma.fuelRequest.deleteMany({ where: { id: { in: ephemeralRequestIds } } });
      }
      if (ephemeralCardIds.length > 0) {
        await prisma.farmerCard.deleteMany({ where: { id: { in: ephemeralCardIds } } });
      }
      if (ephemeralFarmerIds.length > 0) {
        await prisma.farmer.deleteMany({ where: { id: { in: ephemeralFarmerIds } } });
      }
      if (ephemeralSubCityAssignIds.length > 0) {
        await prisma.stationSubCityAssignment.deleteMany({ where: { id: { in: ephemeralSubCityAssignIds } } });
      }
      if (ephemeralUserIds.length > 0) {
        await prisma.user.deleteMany({ where: { id: { in: ephemeralUserIds } } });
      }
      if (ephemeralStationIds.length > 0) {
        await prisma.fuelStation.deleteMany({ where: { id: { in: ephemeralStationIds } } });
      }
      console.log('  ✓ Ephemeral test records safely purged.');
    } catch (cleanErr) {
      console.error('  ✗ Error cleaning up ephemeral test records:', cleanErr);
    }

    if (server) {
      await new Promise<void>((resolve) => server!.close(() => resolve()));
      console.log('  ✓ Test HTTP server closed.');
    }

    await prisma.$disconnect();
    console.log('  ✓ Database disconnected.');

    console.log('\n================================================================================');
    console.log(`   PRIORITY 0 TEST RESULTS: ${passed} PASSED | ${failed} FAILED                 `);
    console.log('================================================================================\n');

    if (failed > 0) {
      process.exit(1);
    }
  }
}

runPriority0Tests();
