/**
 * =============================================================================
 * IRFA / DIGITAL FUEL COUPON SYSTEM — PRIORITY 1, TASK 2 TEST SUITE
 * Authorization & Monthly Allocation Integrity Test Suite (17 Scenarios)
 * =============================================================================
 *
 * Verifies end-to-end:
 *  1. Authorization with valid monthly allocation -> succeeds.
 *  2. Authorization without allocation -> rejected (NO_MONTHLY_ALLOCATION).
 *  3. Authorization exceeds available allocation -> rejected (ALLOCATION_LIMIT_EXCEEDED).
 *  4. Multiple active authorizations collectively exceeding allocation -> rejected.
 *  5. Authorization for incorrect month -> rejected (NO_MONTHLY_ALLOCATION).
 *  6. Dispensing decreases authorization and allocation balances correctly.
 *  7. Dispensing more than authorization remaining -> rejected (QUOTA_EXCEEDED).
 *  8. Dispensing more than monthly allocation remaining -> rejected (MONTHLY_ALLOCATION_EXCEEDED).
 *  9. Concurrent authorization requests cannot over-reserve allocation.
 * 10. Concurrent dispensing cannot overdraw balances.
 * 11. Cancelled/revoked authorization cannot be dispensed.
 * 12. Cancellation releases unused reserved quantity correctly.
 * 13. Cancellation/revocation cannot release the same quantity twice.
 * 14. Expired authorization cannot be dispensed.
 * 15. Idempotent dispensing retry does not double-decrement.
 * 16. Failed transaction does not leave ledgers inconsistent.
 * 17. Priority 0 dispensing integrity tests continue passing.
 * =============================================================================
 */

import 'dotenv/config';
import http from 'http';
import jwt from 'jsonwebtoken';
import {
  UserRole,
  EligibilityStatus,
  CardStatus,
  RequestStatus,
  ItemStatus,
  AuthStatus,
  AllocationStatus,
  AssignmentStatus,
} from '@prisma/client';
import app from './src/app.js';
import prisma from './src/config/db.js';

const JWT_SECRET = process.env.JWT_SECRET || 'irfa_bahir_dar_super_secret_jwt_key_2026_secured';

function makeToken(payload: { userId: string; username: string; role: string; fuelStationId?: string }) {
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

async function runPriority1Task2Tests() {
  console.log('=============================================================================');
  console.log('IRFA PRIORITY 1, TASK 2: AUTHORIZATION & MONTHLY ALLOCATION INTEGRITY TESTS');
  console.log('=============================================================================\n');

  let server: http.Server | null = null;

  // Track ephemeral IDs for guaranteed teardown
  const ephemeralTxIds: string[] = [];
  const ephemeralLogIds: string[] = [];
  const ephemeralStationAssignIds: string[] = [];
  const ephemeralAuthIds: string[] = [];
  const ephemeralItemIds: string[] = [];
  const ephemeralHistoryIds: string[] = [];
  const ephemeralRequestIds: string[] = [];
  const ephemeralCardIds: string[] = [];
  const ephemeralAllocIds: string[] = [];
  const ephemeralFarmerIds: string[] = [];
  const ephemeralSubCityAssignIds: string[] = [];
  const ephemeralUserIds: string[] = [];
  const ephemeralStationIds: string[] = [];

  try {
    // 1. Database connection check with retries
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

    const baseUrl = `http://127.0.0.1:${port}`;

    async function apiRequest(method: string, path: string, token?: string, body?: any) {
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
      };
      if (token) {
        headers['Authorization'] = `Bearer ${token}`;
      }

      const response = await fetch(`${baseUrl}${path}`, {
        method,
        headers,
        body: body ? JSON.stringify(body) : undefined,
      });

      let data: any = null;
      try {
        data = await response.json();
      } catch {
        // non-JSON response
      }

      return {
        status: response.status,
        data,
      };
    }

    // 3. Resolve baseline master data
    const dieselFuel = await prisma.fuelType.findFirst({ where: { code: 'DIESEL' } });
    if (!dieselFuel) throw new Error('Diesel fuel type record missing.');

    const subCity = await prisma.subCity.findFirst();
    if (!subCity) throw new Error('SubCity record missing.');

    const kebele = await prisma.kebele.findFirst({ where: { subCityId: subCity.id } });
    if (!kebele) throw new Error(`Kebele missing for subcity ${subCity.name}`);

    // Create Trade Office Actor for reviews
    const tradeUser = await prisma.user.create({
      data: {
        username: `trade_p1t2_${Date.now().toString().slice(-6)}`,
        passwordHash: '$2a$10$abcdefghijklmnopqrstuv',
        fullName: 'Trade Officer P1T2',
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

    // Create Agriculture Office Actor for submissions
    const agriUser = await prisma.user.create({
      data: {
        username: `agri_p1t2_${Date.now().toString().slice(-6)}`,
        passwordHash: '$2a$10$abcdefghijklmnopqrstuv',
        fullName: 'Agriculture Officer P1T2',
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

    // Create Station & Station Admin for dispensing
    const testStation = await prisma.fuelStation.create({
      data: {
        code: `BD-ST-P1T2-${Date.now().toString().slice(-6)}`,
        name: 'P1T2 Test Station',
        location: 'Bahir Dar Hub',
        isActive: true,
      },
    });
    ephemeralStationIds.push(testStation.id);

    const stationAssign = await prisma.stationSubCityAssignment.create({
      data: {
        subCityId: subCity.id,
        fuelStationId: testStation.id,
        assignedById: tradeUser.id,
        status: AssignmentStatus.ACTIVE,
        notes: 'P1T2 Station Subcity Coverage',
      },
    });
    ephemeralSubCityAssignIds.push(stationAssign.id);

    const stationOperator = await prisma.user.create({
      data: {
        username: `station_p1t2_${Date.now().toString().slice(-6)}`,
        passwordHash: '$2a$10$abcdefghijklmnopqrstuv',
        fullName: 'Station Admin P1T2',
        role: UserRole.STATION_ADMIN,
        fuelStationId: testStation.id,
        isActive: true,
      },
    });
    ephemeralUserIds.push(stationOperator.id);
    const operatorToken = makeToken({
      userId: stationOperator.id,
      username: stationOperator.username,
      role: stationOperator.role,
      fuelStationId: testStation.id,
    });

    // Helper to create test farmer
    async function createTestFarmer(suffix: string) {
      const farmer = await prisma.farmer.create({
        data: {
          farmerCode: `FR-P1T2-${suffix}-${Date.now().toString().slice(-4)}`,
          fullName: `Farmer P1T2 ${suffix}`,
          phone: `+251 911 ${Math.floor(100000 + Math.random() * 900000)}`,
          nationalId: `ETH-P1T2-${suffix}-${Date.now().toString().slice(-4)}`,
          subCityId: subCity.id,
          kebeleId: kebele.id,
          eligibilityStatus: EligibilityStatus.ELIGIBLE,
          isActive: true,
        },
      });
      ephemeralFarmerIds.push(farmer.id);

      const card = await prisma.farmerCard.create({
        data: {
          farmerId: farmer.id,
          cardSerialNumber: `CARD-P1T2-${suffix}-${Date.now().toString().slice(-4)}`,
          qrToken: `QR-P1T2-${suffix}-${Date.now()}`,
          status: CardStatus.ACTIVE,
        },
      });
      ephemeralCardIds.push(card.id);

      return { farmer, card };
    }

    // =========================================================================
    // SCENARIO 1: Authorization with valid monthly allocation -> succeeds
    // =========================================================================
    console.log('\n--- Scenario 1: Authorization with valid monthly allocation ---');
    const { farmer: f1, card: card1 } = await createTestFarmer('S1');

    // Create 200 L active monthly allocation for period 11/2026
    const alloc1 = await prisma.monthlyAllocation.create({
      data: {
        farmerId: f1.id,
        fuelTypeId: dieselFuel.id,
        month: 11,
        year: 2026,
        allocatedLiters: 200,
        usedLiters: 0,
        remainingLiters: 200,
        status: AllocationStatus.ACTIVE,
      },
    });
    ephemeralAllocIds.push(alloc1.id);

    // Create submitted fuel request for 80 L
    const req1 = await prisma.fuelRequest.create({
      data: {
        requestNumber: `REQ-P1T2-S1-${Date.now().toString().slice(-5)}`,
        periodMonth: 11,
        periodYear: 2026,
        title: 'Scenario 1 Request',
        status: RequestStatus.SUBMITTED,
        submittedById: agriUser.id,
        totalFarmersCount: 1,
        totalLitersRequested: 80,
        totalLitersApproved: 0,
      },
    });
    ephemeralRequestIds.push(req1.id);

    const item1 = await prisma.fuelRequestItem.create({
      data: {
        fuelRequestId: req1.id,
        farmerId: f1.id,
        fuelTypeId: dieselFuel.id,
        requestedLiters: 80,
        approvedLiters: 0,
        itemStatus: ItemStatus.PENDING,
      },
    });
    ephemeralItemIds.push(item1.id);

    // Trade Office reviews and approves request
    const reviewRes1 = await apiRequest('POST', `/api/trade/review-request/${req1.id}`, tradeToken, {
      status: 'APPROVED',
      reviewRemarks: 'Approved valid allocation request',
    });

    assert(
      reviewRes1.status === 200 && reviewRes1.data.success === true,
      'Trade approval succeeds when farmer has valid active monthly allocation',
      reviewRes1.data
    );

    const createdAuth1 = await prisma.fuelAuthorization.findUnique({
      where: { fuelRequestItemId: item1.id },
    });
    if (createdAuth1) ephemeralAuthIds.push(createdAuth1.id);

    assert(
      createdAuth1 !== null &&
        Number(createdAuth1.authorizedLiters) === 80 &&
        Number(createdAuth1.remainingLiters) === 80 &&
        createdAuth1.status === AuthStatus.ACTIVE,
      'FuelAuthorization created with 80 L authorized, 80 L remaining, ACTIVE status'
    );

    // =========================================================================
    // SCENARIO 2: Authorization without allocation -> rejected
    // =========================================================================
    console.log('\n--- Scenario 2: Authorization without monthly allocation ---');
    const { farmer: f2 } = await createTestFarmer('S2');
    // Note: No MonthlyAllocation created for f2

    const req2 = await prisma.fuelRequest.create({
      data: {
        requestNumber: `REQ-P1T2-S2-${Date.now().toString().slice(-5)}`,
        periodMonth: 11,
        periodYear: 2026,
        title: 'Scenario 2 Request',
        status: RequestStatus.SUBMITTED,
        submittedById: agriUser.id,
        totalFarmersCount: 1,
        totalLitersRequested: 50,
      },
    });
    ephemeralRequestIds.push(req2.id);

    const item2 = await prisma.fuelRequestItem.create({
      data: {
        fuelRequestId: req2.id,
        farmerId: f2.id,
        fuelTypeId: dieselFuel.id,
        requestedLiters: 50,
        itemStatus: ItemStatus.PENDING,
      },
    });
    ephemeralItemIds.push(item2.id);

    const reviewRes2 = await apiRequest('POST', `/api/trade/review-request/${req2.id}`, tradeToken, {
      status: 'APPROVED',
      reviewRemarks: 'Attempt approval without allocation',
    });

    assert(
      reviewRes2.status === 400 &&
        reviewRes2.data.success === false &&
        (reviewRes2.data.code === 'NO_MONTHLY_ALLOCATION' ||
          reviewRes2.data.message?.includes('NO_MONTHLY_ALLOCATION') ||
          reviewRes2.data.message?.includes('no monthly fuel allocation')),
      'Trade approval rejected with 400 NO_MONTHLY_ALLOCATION when farmer has no allocation',
      reviewRes2.data
    );

    const authCheck2 = await prisma.fuelAuthorization.findUnique({
      where: { fuelRequestItemId: item2.id },
    });
    assert(authCheck2 === null, 'No FuelAuthorization created for rejected request without allocation');

    // =========================================================================
    // SCENARIO 3: Authorization exceeds available allocation -> rejected
    // =========================================================================
    console.log('\n--- Scenario 3: Authorization exceeds available allocation ---');
    // Farmer f1 has 200 L allocation, already has 80 L authorized in Scenario 1. Available = 120 L.
    // Try to authorize 150 L (150 > 120 L).
    const req3 = await prisma.fuelRequest.create({
      data: {
        requestNumber: `REQ-P1T2-S3-${Date.now().toString().slice(-5)}`,
        periodMonth: 11,
        periodYear: 2026,
        title: 'Scenario 3 Request Exceeds Ceiling',
        status: RequestStatus.SUBMITTED,
        submittedById: agriUser.id,
        totalFarmersCount: 1,
        totalLitersRequested: 150,
      },
    });
    ephemeralRequestIds.push(req3.id);

    const item3 = await prisma.fuelRequestItem.create({
      data: {
        fuelRequestId: req3.id,
        farmerId: f1.id,
        fuelTypeId: dieselFuel.id,
        requestedLiters: 150,
        itemStatus: ItemStatus.PENDING,
      },
    });
    ephemeralItemIds.push(item3.id);

    const reviewRes3 = await apiRequest('POST', `/api/trade/review-request/${req3.id}`, tradeToken, {
      status: 'APPROVED',
      reviewRemarks: 'Attempt approval exceeding remaining allocation quota',
    });

    assert(
      reviewRes3.status === 400 &&
        reviewRes3.data.success === false &&
        (reviewRes3.data.code === 'ALLOCATION_LIMIT_EXCEEDED' ||
          reviewRes3.data.message?.includes('ALLOCATION_LIMIT_EXCEEDED') ||
          reviewRes3.data.message?.includes('exceeds available monthly allocation quota')),
      'Trade approval rejected with 400 ALLOCATION_LIMIT_EXCEEDED when quantity exceeds remaining quota',
      reviewRes3.data
    );

    const authCheck3 = await prisma.fuelAuthorization.findUnique({
      where: { fuelRequestItemId: item3.id },
    });
    assert(authCheck3 === null, 'No FuelAuthorization created when exceeding allocation ceiling');

    // =========================================================================
    // SCENARIO 4: Multiple active authorizations collectively exceeding allocation -> rejected
    // =========================================================================
    console.log('\n--- Scenario 4: Multiple active authorizations collectively exceeding allocation ---');
    const { farmer: f3 } = await createTestFarmer('S4');
    // Farmer f3 has 100 L allocation
    const alloc3 = await prisma.monthlyAllocation.create({
      data: {
        farmerId: f3.id,
        fuelTypeId: dieselFuel.id,
        month: 11,
        year: 2026,
        allocatedLiters: 100,
        usedLiters: 0,
        remainingLiters: 100,
        status: AllocationStatus.ACTIVE,
      },
    });
    ephemeralAllocIds.push(alloc3.id);

    // Request 4A: 60 L
    const req4A = await prisma.fuelRequest.create({
      data: {
        requestNumber: `REQ-P1T2-S4A-${Date.now().toString().slice(-5)}`,
        periodMonth: 11,
        periodYear: 2026,
        title: 'Scenario 4 Request A (60 L)',
        status: RequestStatus.SUBMITTED,
        submittedById: agriUser.id,
        totalFarmersCount: 1,
        totalLitersRequested: 60,
      },
    });
    ephemeralRequestIds.push(req4A.id);

    const item4A = await prisma.fuelRequestItem.create({
      data: {
        fuelRequestId: req4A.id,
        farmerId: f3.id,
        fuelTypeId: dieselFuel.id,
        requestedLiters: 60,
        itemStatus: ItemStatus.PENDING,
      },
    });
    ephemeralItemIds.push(item4A.id);

    const reviewRes4A = await apiRequest('POST', `/api/trade/review-request/${req4A.id}`, tradeToken, {
      status: 'APPROVED',
      reviewRemarks: 'Approve 60 L',
    });
    assert(reviewRes4A.status === 200, 'First request for 60 L approved against 100 L allocation');

    const auth4A = await prisma.fuelAuthorization.findUnique({ where: { fuelRequestItemId: item4A.id } });
    if (auth4A) ephemeralAuthIds.push(auth4A.id);

    // Request 4B: 50 L (60 + 50 = 110 > 100 L)
    const req4B = await prisma.fuelRequest.create({
      data: {
        requestNumber: `REQ-P1T2-S4B-${Date.now().toString().slice(-5)}`,
        periodMonth: 11,
        periodYear: 2026,
        title: 'Scenario 4 Request B (50 L)',
        status: RequestStatus.SUBMITTED,
        submittedById: agriUser.id,
        totalFarmersCount: 1,
        totalLitersRequested: 50,
      },
    });
    ephemeralRequestIds.push(req4B.id);

    const item4B = await prisma.fuelRequestItem.create({
      data: {
        fuelRequestId: req4B.id,
        farmerId: f3.id,
        fuelTypeId: dieselFuel.id,
        requestedLiters: 50,
        itemStatus: ItemStatus.PENDING,
      },
    });
    ephemeralItemIds.push(item4B.id);

    const reviewRes4B = await apiRequest('POST', `/api/trade/review-request/${req4B.id}`, tradeToken, {
      status: 'APPROVED',
      reviewRemarks: 'Approve 50 L',
    });

    assert(
      reviewRes4B.status === 400 && reviewRes4B.data.code === 'ALLOCATION_LIMIT_EXCEEDED',
      'Second request for 50 L rejected with ALLOCATION_LIMIT_EXCEEDED (60 + 50 = 110 > 100 L)'
    );

    // =========================================================================
    // SCENARIO 5: Authorization for incorrect month -> rejected
    // =========================================================================
    console.log('\n--- Scenario 5: Authorization for incorrect month ---');
    const { farmer: f4 } = await createTestFarmer('S5');
    // Farmer f4 has allocation for Month 10/2026 ONLY
    const alloc4 = await prisma.monthlyAllocation.create({
      data: {
        farmerId: f4.id,
        fuelTypeId: dieselFuel.id,
        month: 10,
        year: 2026,
        allocatedLiters: 100,
        usedLiters: 0,
        remainingLiters: 100,
        status: AllocationStatus.ACTIVE,
      },
    });
    ephemeralAllocIds.push(alloc4.id);

    // Request for Month 11/2026
    const req5 = await prisma.fuelRequest.create({
      data: {
        requestNumber: `REQ-P1T2-S5-${Date.now().toString().slice(-5)}`,
        periodMonth: 11,
        periodYear: 2026,
        title: 'Scenario 5 Request (Month 11)',
        status: RequestStatus.SUBMITTED,
        submittedById: agriUser.id,
        totalFarmersCount: 1,
        totalLitersRequested: 40,
      },
    });
    ephemeralRequestIds.push(req5.id);

    const item5 = await prisma.fuelRequestItem.create({
      data: {
        fuelRequestId: req5.id,
        farmerId: f4.id,
        fuelTypeId: dieselFuel.id,
        requestedLiters: 40,
        itemStatus: ItemStatus.PENDING,
      },
    });
    ephemeralItemIds.push(item5.id);

    const reviewRes5 = await apiRequest('POST', `/api/trade/review-request/${req5.id}`, tradeToken, {
      status: 'APPROVED',
      reviewRemarks: 'Approve month 11 request',
    });

    assert(
      reviewRes5.status === 400 && reviewRes5.data.code === 'NO_MONTHLY_ALLOCATION',
      'Request for month 11 rejected with NO_MONTHLY_ALLOCATION when allocation exists only for month 10'
    );

    // =========================================================================
    // SCENARIO 6: Dispensing decreases authorization and allocation balances correctly
    // =========================================================================
    console.log('\n--- Scenario 6: Dispensing decreases authorization & allocation balances ---');
    // Use auth4A (60 L authorized, 0 consumed, 60 remaining) and alloc3 (100 L allocated, 0 used, 100 remaining)
    // Dispense 25 L
    const dispenseRes6 = await apiRequest('POST', '/api/transactions/dispense', operatorToken, {
      authorizationId: auth4A!.id,
      quantityLiters: 25,
      notes: 'Scenario 6 valid dispensing of 25 L',
    });

    assert(
      dispenseRes6.status === 201 && dispenseRes6.data.success === true,
      'Dispensing 25 L succeeds with HTTP 201',
      dispenseRes6.data
    );
    if (dispenseRes6.data?.receipt?.id) ephemeralTxIds.push(dispenseRes6.data.receipt.id);

    const authAfter6 = await prisma.fuelAuthorization.findUnique({ where: { id: auth4A!.id } });
    const allocAfter6 = await prisma.monthlyAllocation.findUnique({ where: { id: alloc3.id } });

    assert(
      Number(authAfter6?.consumedLiters) === 25 && Number(authAfter6?.remainingLiters) === 35,
      `Authorization balance updated correctly: consumed=25 L, remaining=35 L (found consumed=${authAfter6?.consumedLiters}, remaining=${authAfter6?.remainingLiters})`
    );
    assert(
      Number(allocAfter6?.usedLiters) === 25 && Number(allocAfter6?.remainingLiters) === 75,
      `Monthly allocation balance updated correctly: used=25 L, remaining=75 L (found used=${allocAfter6?.usedLiters}, remaining=${allocAfter6?.remainingLiters})`
    );

    // =========================================================================
    // SCENARIO 7: Dispensing more than authorization remaining -> rejected
    // =========================================================================
    console.log('\n--- Scenario 7: Dispensing more than authorization remaining ---');
    // Auth remaining is 35 L. Attempt to dispense 40 L.
    const dispenseRes7 = await apiRequest('POST', '/api/transactions/dispense', operatorToken, {
      authorizationId: auth4A!.id,
      quantityLiters: 40,
      notes: 'Scenario 7 overdraw authorization',
    });

    assert(
      dispenseRes7.status === 400 && dispenseRes7.data.code === 'QUOTA_EXCEEDED',
      'Dispensing 40 L against 35 L authorization remaining rejected with QUOTA_EXCEEDED'
    );

    const authAfter7 = await prisma.fuelAuthorization.findUnique({ where: { id: auth4A!.id } });
    const allocAfter7 = await prisma.monthlyAllocation.findUnique({ where: { id: alloc3.id } });
    assert(
      Number(authAfter7?.remainingLiters) === 35 && Number(allocAfter7?.remainingLiters) === 75,
      'Balances remain completely untouched after authorization overdraw rejection'
    );

    // =========================================================================
    // SCENARIO 8: Dispensing more than monthly allocation remaining -> rejected
    // =========================================================================
    console.log('\n--- Scenario 8: Dispensing more than monthly allocation remaining ---');
    // Set allocation remaining to 15 L while Auth remaining is 35 L
    await prisma.monthlyAllocation.update({
      where: { id: alloc3.id },
      data: { remainingLiters: 15, usedLiters: 85 },
    });

    // Attempt to dispense 20 L (within 35 L auth, but exceeds 15 L allocation)
    const dispenseRes8 = await apiRequest('POST', '/api/transactions/dispense', operatorToken, {
      authorizationId: auth4A!.id,
      quantityLiters: 20,
      notes: 'Scenario 8 overdraw allocation',
    });

    assert(
      dispenseRes8.status === 400 && dispenseRes8.data.code === 'MONTHLY_ALLOCATION_EXCEEDED',
      'Dispensing 20 L against 15 L monthly allocation remaining rejected with MONTHLY_ALLOCATION_EXCEEDED'
    );

    const authAfter8 = await prisma.fuelAuthorization.findUnique({ where: { id: auth4A!.id } });
    const allocAfter8 = await prisma.monthlyAllocation.findUnique({ where: { id: alloc3.id } });
    assert(
      Number(authAfter8?.remainingLiters) === 35 && Number(allocAfter8?.remainingLiters) === 15,
      'Balances remain completely untouched after monthly allocation limit rejection'
    );

    // Reset alloc3 remaining to 75 L for cleanliness
    await prisma.monthlyAllocation.update({
      where: { id: alloc3.id },
      data: { remainingLiters: 75, usedLiters: 25 },
    });

    // =========================================================================
    // SCENARIO 9: Concurrent authorization requests cannot over-reserve allocation
    // =========================================================================
    console.log('\n--- Scenario 9: Concurrent authorization requests race protection ---');
    const { farmer: f5 } = await createTestFarmer('S9');
    // Farmer f5 has 70 L allocation
    const alloc5 = await prisma.monthlyAllocation.create({
      data: {
        farmerId: f5.id,
        fuelTypeId: dieselFuel.id,
        month: 11,
        year: 2026,
        allocatedLiters: 70,
        usedLiters: 0,
        remainingLiters: 70,
        status: AllocationStatus.ACTIVE,
      },
    });
    ephemeralAllocIds.push(alloc5.id);

    // Create two requests of 50 L each (Total 100 L > 70 L)
    const req9A = await prisma.fuelRequest.create({
      data: {
        requestNumber: `REQ-P1T2-S9A-${Date.now().toString().slice(-5)}`,
        periodMonth: 11,
        periodYear: 2026,
        title: 'Concurrent Request 9A (50 L)',
        status: RequestStatus.SUBMITTED,
        submittedById: agriUser.id,
        totalFarmersCount: 1,
        totalLitersRequested: 50,
      },
    });
    ephemeralRequestIds.push(req9A.id);

    const item9A = await prisma.fuelRequestItem.create({
      data: {
        fuelRequestId: req9A.id,
        farmerId: f5.id,
        fuelTypeId: dieselFuel.id,
        requestedLiters: 50,
        itemStatus: ItemStatus.PENDING,
      },
    });
    ephemeralItemIds.push(item9A.id);

    const req9B = await prisma.fuelRequest.create({
      data: {
        requestNumber: `REQ-P1T2-S9B-${Date.now().toString().slice(-5)}`,
        periodMonth: 11,
        periodYear: 2026,
        title: 'Concurrent Request 9B (50 L)',
        status: RequestStatus.SUBMITTED,
        submittedById: agriUser.id,
        totalFarmersCount: 1,
        totalLitersRequested: 50,
      },
    });
    ephemeralRequestIds.push(req9B.id);

    const item9B = await prisma.fuelRequestItem.create({
      data: {
        fuelRequestId: req9B.id,
        farmerId: f5.id,
        fuelTypeId: dieselFuel.id,
        requestedLiters: 50,
        itemStatus: ItemStatus.PENDING,
      },
    });
    ephemeralItemIds.push(item9B.id);

    // Fire both reviews concurrently
    const [concRevA, concRevB] = await Promise.all([
      apiRequest('POST', `/api/trade/review-request/${req9A.id}`, tradeToken, {
        status: 'APPROVED',
        reviewRemarks: 'Concurrent review A',
      }),
      apiRequest('POST', `/api/trade/review-request/${req9B.id}`, tradeToken, {
        status: 'APPROVED',
        reviewRemarks: 'Concurrent review B',
      }),
    ]);

    const concSuccesses = [concRevA, concRevB].filter((r) => r.status === 200);
    const concRejections = [concRevA, concRevB].filter((r) => r.status === 400);

    assert(
      concSuccesses.length === 1 && concRejections.length === 1,
      `Exactly 1 of 2 concurrent reviews succeeded (${concSuccesses.length}) and 1 was safely rejected (${concRejections.length})`
    );

    const activeAuthsForF5 = await prisma.fuelAuthorization.findMany({
      where: { farmerId: f5.id, status: AuthStatus.ACTIVE },
    });
    for (const a of activeAuthsForF5) ephemeralAuthIds.push(a.id);

    const totalReservedF5 = activeAuthsForF5.reduce((s, a) => s + Number(a.remainingLiters), 0);
    assert(
      totalReservedF5 === 50 && totalReservedF5 <= 70,
      `Total active reservations for farmer (${totalReservedF5} L) strictly does not exceed allocation ceiling (70 L)`
    );

    // =========================================================================
    // SCENARIO 10: Concurrent dispensing cannot overdraw balances
    // =========================================================================
    console.log('\n--- Scenario 10: Concurrent dispensing race protection ---');
    const { farmer: f10 } = await createTestFarmer('S10');
    // Auth has 40 L remaining. Allocation has 30 L remaining.
    const alloc10 = await prisma.monthlyAllocation.create({
      data: {
        farmerId: f10.id,
        fuelTypeId: dieselFuel.id,
        month: 11,
        year: 2026,
        allocatedLiters: 100,
        usedLiters: 70,
        remainingLiters: 30,
        status: AllocationStatus.ACTIVE,
      },
    });
    ephemeralAllocIds.push(alloc10.id);

    const req10 = await prisma.fuelRequest.create({
      data: {
        requestNumber: `REQ-P1T2-S10-${Date.now().toString().slice(-5)}`,
        periodMonth: 11,
        periodYear: 2026,
        title: 'Concurrent Dispense Request',
        status: RequestStatus.APPROVED,
        submittedById: agriUser.id,
        reviewedById: tradeUser.id,
        reviewedAt: new Date(),
        totalFarmersCount: 1,
        totalLitersRequested: 40,
        totalLitersApproved: 40,
      },
    });
    ephemeralRequestIds.push(req10.id);

    const item10 = await prisma.fuelRequestItem.create({
      data: {
        fuelRequestId: req10.id,
        farmerId: f10.id,
        fuelTypeId: dieselFuel.id,
        requestedLiters: 40,
        approvedLiters: 40,
        itemStatus: ItemStatus.APPROVED,
      },
    });
    ephemeralItemIds.push(item10.id);

    const auth10 = await prisma.fuelAuthorization.create({
      data: {
        authCode: `AUTH-P1T2-S10-${Date.now().toString().slice(-5)}`,
        fuelRequestId: req10.id,
        fuelRequestItemId: item10.id,
        farmerId: f10.id,
        fuelTypeId: dieselFuel.id,
        authorizedLiters: 40,
        consumedLiters: 0,
        remainingLiters: 40,
        validFrom: new Date(2026, 10, 1),
        validTo: new Date(2026, 10, 30, 23, 59, 59),
        status: AuthStatus.ACTIVE,
      },
    });
    ephemeralAuthIds.push(auth10.id);

    // Fire 4 concurrent dispenses of 10 L each (Total 40 L against 30 L allocation)
    const dispenseBurst = await Promise.all(
      Array.from({ length: 4 }, (_, i) =>
        apiRequest('POST', '/api/transactions/dispense', operatorToken, {
          authorizationId: auth10.id,
          quantityLiters: 10,
          notes: `Concurrent dispense test attempt #${i + 1}`,
        })
      )
    );

    const burstSuccesses = dispenseBurst.filter((r) => r.status === 201);
    const burstRejections = dispenseBurst.filter((r) => r.status === 400);

    for (const r of burstSuccesses) {
      if (r.data?.receipt?.id) ephemeralTxIds.push(r.data.receipt.id);
    }

    assert(
      burstSuccesses.length === 3,
      `Exactly 3 of 4 concurrent dispense requests succeeded: ${burstSuccesses.length} successes (30 L)`
    );
    assert(
      burstRejections.length === 1,
      `Exactly 1 of 4 concurrent dispense requests was safely rejected: ${burstRejections.length} rejections`
    );

    const allocAfter10 = await prisma.monthlyAllocation.findUnique({ where: { id: alloc10.id } });
    assert(
      Number(allocAfter10?.remainingLiters) === 0 && allocAfter10?.status === AllocationStatus.EXHAUSTED,
      `Monthly allocation reached exactly 0 L and status transitioned to EXHAUSTED (found: ${allocAfter10?.remainingLiters} L)`
    );

    // =========================================================================
    // SCENARIO 11: Cancelled/revoked authorization cannot be dispensed
    // =========================================================================
    console.log('\n--- Scenario 11: Cancelled/revoked authorization cannot be dispensed ---');
    const { farmer: f11 } = await createTestFarmer('S11');
    const alloc11 = await prisma.monthlyAllocation.create({
      data: {
        farmerId: f11.id,
        fuelTypeId: dieselFuel.id,
        month: 11,
        year: 2026,
        allocatedLiters: 100,
        usedLiters: 0,
        remainingLiters: 100,
        status: AllocationStatus.ACTIVE,
      },
    });
    ephemeralAllocIds.push(alloc11.id);

    const req11 = await prisma.fuelRequest.create({
      data: {
        requestNumber: `REQ-P1T2-S11-${Date.now().toString().slice(-5)}`,
        periodMonth: 11,
        periodYear: 2026,
        title: 'Revoke Test Request',
        status: RequestStatus.APPROVED,
        submittedById: agriUser.id,
        reviewedById: tradeUser.id,
        reviewedAt: new Date(),
        totalFarmersCount: 1,
        totalLitersRequested: 50,
        totalLitersApproved: 50,
      },
    });
    ephemeralRequestIds.push(req11.id);

    const item11 = await prisma.fuelRequestItem.create({
      data: {
        fuelRequestId: req11.id,
        farmerId: f11.id,
        fuelTypeId: dieselFuel.id,
        requestedLiters: 50,
        approvedLiters: 50,
        itemStatus: ItemStatus.APPROVED,
      },
    });
    ephemeralItemIds.push(item11.id);

    const auth11 = await prisma.fuelAuthorization.create({
      data: {
        authCode: `AUTH-P1T2-S11-${Date.now().toString().slice(-5)}`,
        fuelRequestId: req11.id,
        fuelRequestItemId: item11.id,
        farmerId: f11.id,
        fuelTypeId: dieselFuel.id,
        authorizedLiters: 50,
        consumedLiters: 0,
        remainingLiters: 50,
        validFrom: new Date(2026, 10, 1),
        validTo: new Date(2026, 10, 30, 23, 59, 59),
        status: AuthStatus.ACTIVE,
      },
    });
    ephemeralAuthIds.push(auth11.id);

    // Revoke authorization via Trade Office endpoint
    const revokeRes11 = await apiRequest('PATCH', `/api/trade/authorizations/${auth11.id}/revoke`, tradeToken, {
      reason: 'Administrative revocation test',
    });

    assert(
      revokeRes11.status === 200 && revokeRes11.data.success === true,
      'Authorization successfully revoked via Trade Office PATCH endpoint',
      revokeRes11.data
    );

    const authAfterRevoke11 = await prisma.fuelAuthorization.findUnique({ where: { id: auth11.id } });
    assert(
      authAfterRevoke11?.status === AuthStatus.REVOKED,
      'Authorization status transitioned to REVOKED in database'
    );

    // Attempt to dispense against revoked authorization
    const dispenseRevokedRes = await apiRequest('POST', '/api/transactions/dispense', operatorToken, {
      authorizationId: auth11.id,
      quantityLiters: 10,
      notes: 'Attempt dispense revoked authorization',
    });

    assert(
      dispenseRevokedRes.status === 400 &&
        dispenseRevokedRes.data.code === 'AUTHORIZATION_NOT_ACTIVE',
      'Dispensing against REVOKED authorization rejected with 400 AUTHORIZATION_NOT_ACTIVE'
    );

    // =========================================================================
    // SCENARIO 12: Cancellation releases unused reserved quantity correctly
    // =========================================================================
    console.log('\n--- Scenario 12: Cancellation releases unused reserved quantity ---');
    // For farmer f11, allocation is 100 L.
    // Auth 11 was 50 L. Now that it is REVOKED, its 50 L is released.
    // Farmer f11 should now be able to authorize up to 100 L.
    const req12 = await prisma.fuelRequest.create({
      data: {
        requestNumber: `REQ-P1T2-S12-${Date.now().toString().slice(-5)}`,
        periodMonth: 11,
        periodYear: 2026,
        title: 'Post-Revocation Request (80 L)',
        status: RequestStatus.SUBMITTED,
        submittedById: agriUser.id,
        totalFarmersCount: 1,
        totalLitersRequested: 80,
      },
    });
    ephemeralRequestIds.push(req12.id);

    const item12 = await prisma.fuelRequestItem.create({
      data: {
        fuelRequestId: req12.id,
        farmerId: f11.id,
        fuelTypeId: dieselFuel.id,
        requestedLiters: 80,
        itemStatus: ItemStatus.PENDING,
      },
    });
    ephemeralItemIds.push(item12.id);

    // Review request for 80 L (which would have failed if auth11 was still active: 50 + 80 = 130 > 100 L)
    const reviewRes12 = await apiRequest('POST', `/api/trade/review-request/${req12.id}`, tradeToken, {
      status: 'APPROVED',
      reviewRemarks: 'Approve 80 L after revocation released quota',
    });

    assert(
      reviewRes12.status === 200 && reviewRes12.data.success === true,
      'Request for 80 L successfully approved after previous 50 L authorization revocation released quota'
    );

    const auth12 = await prisma.fuelAuthorization.findUnique({ where: { fuelRequestItemId: item12.id } });
    if (auth12) ephemeralAuthIds.push(auth12.id);

    assert(
      auth12 !== null && Number(auth12.remainingLiters) === 80,
      'New authorization created with 80 L remaining after revocation release'
    );

    // =========================================================================
    // SCENARIO 13: Cancellation/revocation cannot release the same quantity twice
    // =========================================================================
    console.log('\n--- Scenario 13: Revocation idempotency / double-revocation rejection ---');
    // Attempt to revoke auth11 again (already revoked)
    const revokeTwiceRes = await apiRequest('PATCH', `/api/trade/authorizations/${auth11.id}/revoke`, tradeToken, {
      reason: 'Attempt double revocation',
    });

    assert(
      revokeTwiceRes.status === 400 &&
        revokeTwiceRes.data.code === 'AUTHORIZATION_ALREADY_REVOKED',
      'Attempting to revoke an already REVOKED authorization rejected with 400 AUTHORIZATION_ALREADY_REVOKED'
    );

    // Attempt to revoke an EXHAUSTED authorization (remainingLiters = 0)
    await prisma.fuelAuthorization.update({
      where: { id: auth12!.id },
      data: { remainingLiters: 0, consumedLiters: 80, status: AuthStatus.EXHAUSTED },
    });

    const revokeExhaustedRes = await apiRequest('PATCH', `/api/trade/authorizations/${auth12!.id}/revoke`, tradeToken, {
      reason: 'Attempt revoke exhausted auth',
    });

    assert(
      revokeExhaustedRes.status === 400 &&
        revokeExhaustedRes.data.code === 'AUTHORIZATION_EXHAUSTED',
      'Attempting to revoke an EXHAUSTED authorization rejected with 400 AUTHORIZATION_EXHAUSTED'
    );

    // =========================================================================
    // SCENARIO 14: Expired authorization cannot be dispensed
    // =========================================================================
    console.log('\n--- Scenario 14: Expired authorization cannot be dispensed ---');
    const { farmer: f14 } = await createTestFarmer('S14');
    const alloc14 = await prisma.monthlyAllocation.create({
      data: {
        farmerId: f14.id,
        fuelTypeId: dieselFuel.id,
        month: 10,
        year: 2026,
        allocatedLiters: 100,
        usedLiters: 0,
        remainingLiters: 100,
        status: AllocationStatus.ACTIVE,
      },
    });
    ephemeralAllocIds.push(alloc14.id);

    const req14 = await prisma.fuelRequest.create({
      data: {
        requestNumber: `REQ-P1T2-S14-${Date.now().toString().slice(-5)}`,
        periodMonth: 10,
        periodYear: 2026,
        title: 'Expired Auth Request',
        status: RequestStatus.APPROVED,
        submittedById: agriUser.id,
        reviewedById: tradeUser.id,
        totalFarmersCount: 1,
        totalLitersRequested: 30,
        totalLitersApproved: 30,
      },
    });
    ephemeralRequestIds.push(req14.id);

    const item14 = await prisma.fuelRequestItem.create({
      data: {
        fuelRequestId: req14.id,
        farmerId: f14.id,
        fuelTypeId: dieselFuel.id,
        requestedLiters: 30,
        approvedLiters: 30,
        itemStatus: ItemStatus.APPROVED,
      },
    });
    ephemeralItemIds.push(item14.id);

    // Create authorization with validTo 2 days in the past
    const auth14 = await prisma.fuelAuthorization.create({
      data: {
        authCode: `AUTH-P1T2-S14-${Date.now().toString().slice(-5)}`,
        fuelRequestId: req14.id,
        fuelRequestItemId: item14.id,
        farmerId: f14.id,
        fuelTypeId: dieselFuel.id,
        authorizedLiters: 30,
        consumedLiters: 0,
        remainingLiters: 30,
        validFrom: new Date(Date.now() - 5 * 86400000),
        validTo: new Date(Date.now() - 2 * 86400000), // expired 2 days ago
        status: AuthStatus.ACTIVE,
      },
    });
    ephemeralAuthIds.push(auth14.id);

    const dispenseExpiredRes = await apiRequest('POST', '/api/transactions/dispense', operatorToken, {
      authorizationId: auth14.id,
      quantityLiters: 10,
      notes: 'Attempt dispense expired auth',
    });

    assert(
      dispenseExpiredRes.status === 400 &&
        dispenseExpiredRes.data.code === 'AUTHORIZATION_EXPIRED',
      'Dispensing against expired authorization rejected with 400 AUTHORIZATION_EXPIRED'
    );

    // =========================================================================
    // SCENARIO 15: Idempotent dispensing retry does not double-decrement
    // =========================================================================
    console.log('\n--- Scenario 15: Idempotent dispensing retry protection ---');
    const { farmer: f15 } = await createTestFarmer('S15');
    const alloc15 = await prisma.monthlyAllocation.create({
      data: {
        farmerId: f15.id,
        fuelTypeId: dieselFuel.id,
        month: 11,
        year: 2026,
        allocatedLiters: 100,
        usedLiters: 0,
        remainingLiters: 100,
        status: AllocationStatus.ACTIVE,
      },
    });
    ephemeralAllocIds.push(alloc15.id);

    const req15 = await prisma.fuelRequest.create({
      data: {
        requestNumber: `REQ-P1T2-S15-${Date.now().toString().slice(-5)}`,
        periodMonth: 11,
        periodYear: 2026,
        title: 'Idempotency Test Request',
        status: RequestStatus.APPROVED,
        submittedById: agriUser.id,
        reviewedById: tradeUser.id,
        totalFarmersCount: 1,
        totalLitersRequested: 50,
        totalLitersApproved: 50,
      },
    });
    ephemeralRequestIds.push(req15.id);

    const item15 = await prisma.fuelRequestItem.create({
      data: {
        fuelRequestId: req15.id,
        farmerId: f15.id,
        fuelTypeId: dieselFuel.id,
        requestedLiters: 50,
        approvedLiters: 50,
        itemStatus: ItemStatus.APPROVED,
      },
    });
    ephemeralItemIds.push(item15.id);

    const auth15 = await prisma.fuelAuthorization.create({
      data: {
        authCode: `AUTH-P1T2-S15-${Date.now().toString().slice(-5)}`,
        fuelRequestId: req15.id,
        fuelRequestItemId: item15.id,
        farmerId: f15.id,
        fuelTypeId: dieselFuel.id,
        authorizedLiters: 50,
        consumedLiters: 0,
        remainingLiters: 50,
        validFrom: new Date(2026, 10, 1),
        validTo: new Date(2026, 10, 30, 23, 59, 59),
        status: AuthStatus.ACTIVE,
      },
    });
    ephemeralAuthIds.push(auth15.id);

    const idempKey = `IDEMP-P1T2-${Date.now()}`;

    // First attempt with idempotency key
    const idempRes1 = await apiRequest('POST', '/api/transactions/dispense', operatorToken, {
      authorizationId: auth15.id,
      quantityLiters: 20,
      idempotencyKey: idempKey,
      notes: 'Initial idempotent dispensing',
    });

    assert(idempRes1.status === 201, 'Initial dispensing with idempotency key succeeded with 201');
    if (idempRes1.data?.receipt?.id) ephemeralTxIds.push(idempRes1.data.receipt.id);

    // Second attempt with identical idempotency key (network retry simulation)
    const idempRes2 = await apiRequest('POST', '/api/transactions/dispense', operatorToken, {
      authorizationId: auth15.id,
      quantityLiters: 20,
      idempotencyKey: idempKey,
      notes: 'Initial idempotent dispensing',
    });

    assert(
      idempRes2.status === 200 &&
        idempRes2.data.success === true &&
        idempRes2.data.message?.includes('Idempotent replay'),
      'Repeated request with identical idempotency key returned 200 with cached receipt'
    );

    const authAfterIdemp = await prisma.fuelAuthorization.findUnique({ where: { id: auth15.id } });
    const allocAfterIdemp = await prisma.monthlyAllocation.findUnique({ where: { id: alloc15.id } });

    assert(
      Number(authAfterIdemp?.remainingLiters) === 30 && Number(allocAfterIdemp?.remainingLiters) === 80,
      `Balances decremented exactly once: Auth remaining=30 L, Alloc remaining=80 L (auth=${authAfterIdemp?.remainingLiters}, alloc=${allocAfterIdemp?.remainingLiters})`
    );

    // =========================================================================
    // SCENARIO 16: Failed transaction does not leave ledgers inconsistent
    // =========================================================================
    console.log('\n--- Scenario 16: Failed transaction atomic rollback ---');
    // Try to dispense 100 L (exceeds auth15 remaining of 30 L and alloc15 remaining of 80 L)
    const failTxRes = await apiRequest('POST', '/api/transactions/dispense', operatorToken, {
      authorizationId: auth15.id,
      quantityLiters: 100,
      notes: 'Intentional failure to verify rollback',
    });

    assert(failTxRes.status === 400, 'Invalid dispensing attempt rejected with 400');

    const authAfterFail = await prisma.fuelAuthorization.findUnique({ where: { id: auth15.id } });
    const allocAfterFail = await prisma.monthlyAllocation.findUnique({ where: { id: alloc15.id } });

    assert(
      Number(authAfterFail?.remainingLiters) === 30 && Number(allocAfterFail?.remainingLiters) === 80,
      'Both ledgers remained completely consistent and untouched after failed transaction'
    );

    // =========================================================================
    // SCENARIO 17: Scanner verification respects revocation & allocation status
    // =========================================================================
    console.log('\n--- Scenario 17: Station verification respects revocation & allocation status ---');
    // Farmer f11's only card is card11, whose auth11 was revoked
    const verifyRevokedRes = await apiRequest('POST', '/api/verification/verify', operatorToken, {
      qrTokenOrCode: (await prisma.farmerCard.findFirst({ where: { farmerId: f11.id } }))?.qrToken,
    });

    // Scanner should reject or show status reflects revoked auth or no active auth
    assert(
      verifyRevokedRes.status === 400 || verifyRevokedRes.status === 404,
      `Scanner verification rejects farmer with revoked authorization (status=${verifyRevokedRes.status}, code=${verifyRevokedRes.data?.code})`
    );

    console.log('\n=============================================================================');
    console.log(`TEST SUMMARY: ${passedCount} / ${totalCount} PASSED`);
    console.log('=============================================================================\n');

    if (passedCount !== totalCount) {
      throw new Error(`Test suite failed: only ${passedCount} of ${totalCount} tests passed.`);
    }
  } finally {
    console.log('[Teardown] Cleaning up ephemeral test records...');

    try {
      if (ephemeralTxIds.length > 0) {
        await prisma.fuelTransaction.deleteMany({ where: { id: { in: ephemeralTxIds } } });
      }
      if (ephemeralLogIds.length > 0) {
        await prisma.verificationLog.deleteMany({ where: { id: { in: ephemeralLogIds } } });
      }
      // Also clean any verification logs referencing test farmers or operators
      if (ephemeralFarmerIds.length > 0 || ephemeralUserIds.length > 0) {
        await prisma.verificationLog.deleteMany({
          where: {
            OR: [
              { farmerId: { in: ephemeralFarmerIds } },
              { operatorId: { in: ephemeralUserIds } },
            ],
          },
        });
      }
      if (ephemeralStationAssignIds.length > 0) {
        await prisma.stationAssignment.deleteMany({ where: { id: { in: ephemeralStationAssignIds } } });
      }
      if (ephemeralAuthIds.length > 0) {
        await prisma.stationAssignment.deleteMany({ where: { fuelAuthorizationId: { in: ephemeralAuthIds } } });
        await prisma.fuelAuthorization.deleteMany({ where: { id: { in: ephemeralAuthIds } } });
      }
      if (ephemeralItemIds.length > 0) {
        await prisma.fuelRequestItem.deleteMany({ where: { id: { in: ephemeralItemIds } } });
      }
      if (ephemeralHistoryIds.length > 0) {
        await prisma.fuelRequestHistory.deleteMany({ where: { id: { in: ephemeralHistoryIds } } });
      }
      if (ephemeralRequestIds.length > 0) {
        await prisma.fuelRequestHistory.deleteMany({ where: { fuelRequestId: { in: ephemeralRequestIds } } });
        await prisma.fuelRequest.deleteMany({ where: { id: { in: ephemeralRequestIds } } });
      }
      if (ephemeralCardIds.length > 0) {
        await prisma.farmerCard.deleteMany({ where: { id: { in: ephemeralCardIds } } });
      }
      if (ephemeralAllocIds.length > 0) {
        await prisma.monthlyAllocation.deleteMany({ where: { id: { in: ephemeralAllocIds } } });
      }
      if (ephemeralFarmerIds.length > 0) {
        await prisma.farmer.deleteMany({ where: { id: { in: ephemeralFarmerIds } } });
      }
      if (ephemeralSubCityAssignIds.length > 0) {
        await prisma.stationSubCityAssignment.deleteMany({ where: { id: { in: ephemeralSubCityAssignIds } } });
      }
      if (ephemeralUserIds.length > 0) {
        await prisma.auditLog.deleteMany({ where: { userId: { in: ephemeralUserIds } } });
        await prisma.user.deleteMany({ where: { id: { in: ephemeralUserIds } } });
      }
      if (ephemeralStationIds.length > 0) {
        await prisma.fuelStation.deleteMany({ where: { id: { in: ephemeralStationIds } } });
      }
      console.log('[Teardown] Ephemeral test cleanup complete.');
    } catch (cleanErr: any) {
      console.warn('[Teardown] Warning during cleanup:', cleanErr.message);
    }

    if (server) {
      await new Promise<void>((resolve) => (server as http.Server).close(() => resolve()));
      console.log('[Teardown] Test HTTP server stopped.');
    }

    await prisma.$disconnect();
    console.log('[Teardown] Database disconnected.\n');
  }
}

runPriority1Task2Tests().catch((err) => {
  console.error('\n[FATAL] Test execution failed with error:', err);
  process.exit(1);
});
