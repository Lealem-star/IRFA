import 'dotenv/config';
import http from 'http';
import prisma from './src/config/db.js';
import app from './src/app.js';
import jwt from 'jsonwebtoken';
import { UserRole } from '@prisma/client';

const JWT_SECRET = process.env.JWT_SECRET || 'irfa_bahir_dar_super_secret_jwt_key_2026_secured';

function makeToken(payload: { userId: string; username: string; role: UserRole; fuelStationId?: string | null }) {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: '1h' });
}

async function runPhase3Tests() {
  console.log('========================================================================');
  console.log('   IRFA / DFCS — PHASE 3: STATION-SUB-CITY ALLOCATION VERIFICATION SUITE ');
  console.log('========================================================================\n');

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
  const createdAllocationIds: string[] = [];

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

    // ---------------------------------------------------------
    // 1. DATA PRESERVATION BASELINE CHECK
    // ---------------------------------------------------------
    console.log('--- 1. Baseline Historical Data Verification ---');
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

    const baselineVerifCount = await prisma.verificationLog.count();
    assert(baselineVerifCount === 32, `Baseline verification logs is 32 (found ${baselineVerifCount})`);

    const primaryStationAdmin = await prisma.user.findFirst({
      where: { username: 'station' },
      include: { fuelStation: true },
    });
    assert(!!primaryStationAdmin, "Primary 'station' user exists");
    assert(primaryStationAdmin?.role === 'STATION_ADMIN', "'station' role is STATION_ADMIN");
    assert(primaryStationAdmin?.isActive === true, "'station' is ACTIVE");
    assert(primaryStationAdmin?.fuelStation?.code === 'BD-ST-01', "'station' is assigned to BD-ST-01");

    // Ensure clean state before baseline check
    await prisma.stationSubCityAssignment.deleteMany({});

    // Clean initial state check
    const initialAllocations = await prisma.stationSubCityAssignment.count();
    assert(initialAllocations === 0, `Clean initial state: exactly 0 station-subcity allocations exist (found ${initialAllocations})`);

    // Fetch existing sample entities for tests
    const subCities = await prisma.subCity.findMany({ orderBy: { code: 'asc' } });
    const stations = await prisma.fuelStation.findMany({ where: { isActive: true }, orderBy: { code: 'asc' } });
    const subCity1 = subCities[0];
    const subCity2 = subCities[1];
    const station1 = stations[0]; // BD-ST-01
    const station2 = stations[1]; // BD-ST-02

    // Fetch or find users for each role
    const tradeUser = await prisma.user.findFirst({ where: { role: 'TRADE_OFFICE' } });
    const agriUser = await prisma.user.findFirst({ where: { role: 'AGRICULTURE_OFFICE' } });
    const adminUser = await prisma.user.findFirst({ where: { role: 'SYSTEM_ADMIN' } });
    const stationUser = primaryStationAdmin;

    assert(!!tradeUser, "Trade Office user exists in database");
    assert(!!agriUser, "Agriculture Office user exists in database");
    assert(!!adminUser, "System Admin user exists in database");

    const tradeToken = makeToken({ userId: tradeUser!.id, username: tradeUser!.username, role: 'TRADE_OFFICE' });
    const agriToken = makeToken({ userId: agriUser!.id, username: agriUser!.username, role: 'AGRICULTURE_OFFICE' });
    const adminToken = makeToken({ userId: adminUser!.id, username: adminUser!.username, role: 'SYSTEM_ADMIN' });
    const stationToken = makeToken({ userId: stationUser!.id, username: stationUser!.username, role: 'STATION_ADMIN' });

    // ---------------------------------------------------------
    // 2. STRICT RBAC ACCESS CONTROL TESTS
    // ---------------------------------------------------------
    console.log('\n--- 2. Strict Role-Based Access Control (RBAC) Tests ---');

    // GET /api/trade/station-allocations
    const noTokenGet = await apiRequest('GET', '/api/trade/station-allocations');
    assert(noTokenGet.status === 401, `Anonymous GET is blocked with 401 (got ${noTokenGet.status})`);

    const agriGet = await apiRequest('GET', '/api/trade/station-allocations', agriToken);
    assert(agriGet.status === 403, `AGRICULTURE_OFFICE GET is blocked with 403 (got ${agriGet.status})`);

    const stationGet = await apiRequest('GET', '/api/trade/station-allocations', stationToken);
    assert(stationGet.status === 403, `STATION_ADMIN GET is blocked with 403 (got ${stationGet.status})`);

    const adminGet = await apiRequest('GET', '/api/trade/station-allocations', adminToken);
    assert(adminGet.status === 403, `SYSTEM_ADMIN GET is blocked with 403 (got ${adminGet.status})`);

    const tradeGet = await apiRequest('GET', '/api/trade/station-allocations', tradeToken);
    assert(tradeGet.status === 200, `TRADE_OFFICE GET is permitted with 200 (got ${tradeGet.status})`);
    assert(tradeGet.data?.success === true, 'Response indicates success: true');
    assert(Array.isArray(tradeGet.data?.data?.allocations), 'Response data contains allocations array');
    assert(Array.isArray(tradeGet.data?.data?.byStation), 'Response data contains byStation array');
    assert(Array.isArray(tradeGet.data?.data?.bySubCity), 'Response data contains bySubCity array');

    // POST /api/trade/station-allocations (Create)
    const testPayload = { fuelStationId: station1.id, subCityId: subCity1.id, notes: 'RBAC test allocation' };

    const noTokenPost = await apiRequest('POST', '/api/trade/station-allocations', undefined, testPayload);
    assert(noTokenPost.status === 401, `Anonymous POST is blocked with 401 (got ${noTokenPost.status})`);

    const agriPost = await apiRequest('POST', '/api/trade/station-allocations', agriToken, testPayload);
    assert(agriPost.status === 403, `AGRICULTURE_OFFICE POST is blocked with 403 (got ${agriPost.status})`);

    const stationPost = await apiRequest('POST', '/api/trade/station-allocations', stationToken, testPayload);
    assert(stationPost.status === 403, `STATION_ADMIN POST is blocked with 403 (got ${stationPost.status})`);

    const adminPost = await apiRequest('POST', '/api/trade/station-allocations', adminToken, testPayload);
    assert(adminPost.status === 403, `SYSTEM_ADMIN POST is blocked with 403 (got ${adminPost.status})`);

    // ---------------------------------------------------------
    // 3. ALLOCATION CREATION & BUSINESS INVARIANTS
    // ---------------------------------------------------------
    console.log('\n--- 3. Allocation Creation & Business Invariants ---');

    // Create valid allocation: station1 -> subCity1
    const createRes1 = await apiRequest('POST', '/api/trade/station-allocations', tradeToken, {
      fuelStationId: station1.id,
      subCityId: subCity1.id,
      notes: 'Initial allocation BD-ST-01 to SubCity 1',
    });
    assert(createRes1.status === 201, `Trade Office successfully creates allocation (got ${createRes1.status})`);
    const alloc1 = createRes1.data?.data;
    assert(!!alloc1?.id, `Allocation has generated ID: ${alloc1?.id}`);
    if (alloc1?.id) createdAllocationIds.push(alloc1.id);
    assert(alloc1?.fuelStationId === station1.id, 'Allocation links to correct fuel station');
    assert(alloc1?.subCityId === subCity1.id, 'Allocation links to correct sub-city');
    assert(alloc1?.status === 'ACTIVE', 'Initial allocation status is ACTIVE');

    // Duplicate creation must be rejected with 409 Conflict
    const dupRes = await apiRequest('POST', '/api/trade/station-allocations', tradeToken, {
      fuelStationId: station1.id,
      subCityId: subCity1.id,
      notes: 'Duplicate attempt',
    });
    assert(dupRes.status === 409, `Duplicate allocation rejected with 409 Conflict (got ${dupRes.status})`);
    assert(dupRes.data?.code === 'ALLOCATION_EXISTS', `Duplicate returns code ALLOCATION_EXISTS (got ${dupRes.data?.code})`);

    // Inactive station creation must be rejected with 400 Bad Request
    // First create a temporary inactive station or find one
    let tempInactiveStation = await prisma.fuelStation.findFirst({ where: { isActive: false } });
    let createdTempInactive = false;
    if (!tempInactiveStation) {
      tempInactiveStation = await prisma.fuelStation.create({
        data: {
          code: 'TEMP-INACTIVE-TEST',
          name: 'Temporary Inactive Test Station',
          company: 'TEST',
          location: 'Test Location',
          isActive: false,
        },
      });
      createdTempInactive = true;
    }

    const inactiveStationRes = await apiRequest('POST', '/api/trade/station-allocations', tradeToken, {
      fuelStationId: tempInactiveStation.id,
      subCityId: subCity1.id,
    });
    assert(inactiveStationRes.status === 400, `Allocation to inactive station rejected with 400 (got ${inactiveStationRes.status})`);
    assert(inactiveStationRes.data?.code === 'STATION_INACTIVE', `Error code is STATION_INACTIVE (got ${inactiveStationRes.data?.code})`);

    if (createdTempInactive && tempInactiveStation) {
      await prisma.fuelStation.delete({ where: { id: tempInactiveStation.id } });
    }

    // ---------------------------------------------------------
    // 4. MANY-TO-MANY RELATIONSHIP VERIFICATION
    // ---------------------------------------------------------
    console.log('\n--- 4. Many-to-Many Relationship Verification ---');

    // A) One station serving MULTIPLE sub-cities: station1 -> subCity2
    const createRes2 = await apiRequest('POST', '/api/trade/station-allocations', tradeToken, {
      fuelStationId: station1.id,
      subCityId: subCity2.id,
      notes: 'Station 1 also serves SubCity 2',
    });
    assert(createRes2.status === 201, `Station 1 allocated to SubCity 2 (got ${createRes2.status})`);
    if (createRes2.data?.data?.id) createdAllocationIds.push(createRes2.data.data.id);

    // B) One sub-city served by MULTIPLE stations: station2 -> subCity1
    const createRes3 = await apiRequest('POST', '/api/trade/station-allocations', tradeToken, {
      fuelStationId: station2.id,
      subCityId: subCity1.id,
      notes: 'Station 2 also serves SubCity 1',
    });
    assert(createRes3.status === 201, `Station 2 allocated to SubCity 1 (got ${createRes3.status})`);
    if (createRes3.data?.data?.id) createdAllocationIds.push(createRes3.data.data.id);

    // Query GET to verify many-to-many aggregations
    const listRes = await apiRequest('GET', '/api/trade/station-allocations', tradeToken);
    const station1Group = listRes.data?.data?.byStation?.find((s: any) => s.id === station1.id);
    assert(station1Group?.allocationCount === 2, `Station 1 has exactly 2 sub-cities (found ${station1Group?.allocationCount})`);
    assert(station1Group?.activeSubCities?.length === 2, `Station 1 has 2 activeSubCities (found ${station1Group?.activeSubCities?.length})`);

    const subCity1Group = listRes.data?.data?.bySubCity?.find((sc: any) => sc.id === subCity1.id);
    assert(subCity1Group?.stationCount === 2, `SubCity 1 has exactly 2 stations (found ${subCity1Group?.stationCount})`);
    assert(subCity1Group?.authorizedStations?.length === 2, `SubCity 1 has 2 authorizedStations (found ${subCity1Group?.authorizedStations?.length})`);

    // ---------------------------------------------------------
    // 5. BULK ALLOCATION SYNC (PUT /station/:id)
    // ---------------------------------------------------------
    console.log('\n--- 5. Bulk Allocation Sync Verification ---');

    // Update station2 to serve BOTH subCity1 and subCity2 in a single bulk sync call
    const bulkRes = await apiRequest('PUT', `/api/trade/station-allocations/station/${station2.id}`, tradeToken, {
      subCityIds: [subCity1.id, subCity2.id],
      notes: 'Bulk sync station 2 to subCity 1 and 2',
    });
    assert(bulkRes.status === 200, `Bulk sync returned 200 OK (got ${bulkRes.status})`);
    assert(bulkRes.data?.data?.activeSubCities?.length === 2, `Station 2 now has 2 active sub-cities (got ${bulkRes.data?.data?.activeSubCities?.length})`);

    // Track any new allocation records created for station2
    const st2Allocs = await prisma.stationSubCityAssignment.findMany({ where: { fuelStationId: station2.id } });
    for (const a of st2Allocs) {
      if (!createdAllocationIds.includes(a.id)) {
        createdAllocationIds.push(a.id);
      }
    }

    // ---------------------------------------------------------
    // 6. STATUS LIFECYCLE & DELETION
    // ---------------------------------------------------------
    console.log('\n--- 6. Status Lifecycle & Deletion Verification ---');

    // Revoke allocation 1
    const revokeRes = await apiRequest('PATCH', `/api/trade/station-allocations/${alloc1.id}/status`, tradeToken, {
      status: 'REVOKED',
      notes: 'Revoked for testing',
    });
    assert(revokeRes.status === 200, `Allocation status updated to REVOKED (got ${revokeRes.status})`);
    assert(revokeRes.data?.data?.status === 'REVOKED', `Status is confirmed REVOKED`);

    // Reactivate allocation 1
    const reactivateRes = await apiRequest('PATCH', `/api/trade/station-allocations/${alloc1.id}/status`, tradeToken, {
      status: 'ACTIVE',
      notes: 'Reactivated for testing',
    });
    assert(reactivateRes.status === 200, `Allocation status reactivated to ACTIVE (got ${reactivateRes.status})`);
    assert(reactivateRes.data?.data?.status === 'ACTIVE', `Status is confirmed ACTIVE`);

    // Delete allocation 1
    const deleteRes = await apiRequest('DELETE', `/api/trade/station-allocations/${alloc1.id}`, tradeToken);
    assert(deleteRes.status === 200, `Allocation deleted successfully (got ${deleteRes.status})`);
    const checkDeleted = await prisma.stationSubCityAssignment.findUnique({ where: { id: alloc1.id } });
    assert(checkDeleted === null, 'Deleted allocation no longer exists in database');

    // ---------------------------------------------------------
    // 7. AUDIT TRAIL VERIFICATION
    // ---------------------------------------------------------
    console.log('\n--- 7. Transactional Audit Trail Verification ---');

    const allocationAuditLogs = await prisma.auditLog.findMany({
      where: {
        action: {
          in: [
            'CREATE_STATION_ALLOCATION',
            'UPDATE_STATION_ALLOCATIONS',
            'ACTIVATE_STATION_ALLOCATION',
            'REVOKE_STATION_ALLOCATION',
            'REMOVE_STATION_ALLOCATION',
          ],
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    const createLogs = allocationAuditLogs.filter((l) => l.action === 'CREATE_STATION_ALLOCATION');
    const updateLogs = allocationAuditLogs.filter((l) => l.action === 'UPDATE_STATION_ALLOCATIONS');
    const statusLogs = allocationAuditLogs.filter(
      (l) => l.action === 'ACTIVATE_STATION_ALLOCATION' || l.action === 'REVOKE_STATION_ALLOCATION'
    );
    const deleteLogs = allocationAuditLogs.filter((l) => l.action === 'REMOVE_STATION_ALLOCATION');

    assert(createLogs.length >= 1, `Audit log recorded CREATE_STATION_ALLOCATION (count: ${createLogs.length})`);
    assert(updateLogs.length >= 1, `Audit log recorded UPDATE_STATION_ALLOCATIONS (count: ${updateLogs.length})`);
    assert(statusLogs.length >= 1, `Audit log recorded status changes (count: ${statusLogs.length})`);
    assert(deleteLogs.length >= 1, `Audit log recorded REMOVE_STATION_ALLOCATION (count: ${deleteLogs.length})`);

    const sampleLog = createLogs[0];
    assert(sampleLog.userId === tradeUser!.id, `Audit log correctly identifies Trade Office user ${sampleLog.userId}`);
    assert(sampleLog.entityType === 'StationSubCityAssignment', `Audit log entityType is StationSubCityAssignment`);

    // ---------------------------------------------------------
    // 8. TEARDOWN & CLEANUP: ZERO INVENTED ALLOCATIONS
    // ---------------------------------------------------------
    console.log('\n--- 8. Cleanup & Zero-State Teardown ---');

    const deleteResult = await prisma.stationSubCityAssignment.deleteMany({});
    console.log(`[Teardown] Deleted ${deleteResult.count} test allocation records.`);

    const finalAllocationsCount = await prisma.stationSubCityAssignment.count();
    assert(finalAllocationsCount === 0, `Clean state restored: exactly 0 allocations in database (found ${finalAllocationsCount})`);

    // ---------------------------------------------------------
    // 9. FINAL POST-TEST PRESERVATION INTEGRITY
    // ---------------------------------------------------------
    console.log('\n--- 9. Post-Test Data Preservation Integrity ---');

    const postStationsCount = await prisma.fuelStation.count();
    assert(postStationsCount === 22, `All 22 stations intact (found ${postStationsCount})`);

    const postSubCitiesCount = await prisma.subCity.count();
    assert(postSubCitiesCount === 4, `All 4 Sub-Cities intact (found ${postSubCitiesCount})`);

    const postKebelesCount = await prisma.kebele.count();
    assert(postKebelesCount === 50, `All 50 Kebeles intact (found ${postKebelesCount})`);

    const postFarmersCount = await prisma.farmer.count();
    assert(postFarmersCount === 20, `All 20 farmers intact (found ${postFarmersCount})`);

    const postTxCount = await prisma.fuelTransaction.count();
    assert(postTxCount === 8, `All 8 transactions intact (found ${postTxCount})`);

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

    console.log('\n========================================================================');
    console.log(`   TEST RESULTS: ${passed} PASSED, ${failed} FAILED`);
    console.log('========================================================================\n');

    process.exit(failed > 0 ? 1 : 0);
  }
}

runPhase3Tests();
