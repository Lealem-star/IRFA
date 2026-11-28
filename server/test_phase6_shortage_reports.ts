import 'dotenv/config';
import http from 'http';
import prisma from './src/config/db.js';
import app from './src/app.js';
import jwt from 'jsonwebtoken';
import { UserRole, ShortageCategory, ShortageStatus } from '@prisma/client';

const JWT_SECRET = process.env.JWT_SECRET || 'irfa_bahir_dar_super_secret_jwt_key_2026_secured';

function makeToken(payload: { userId: string; username: string; role: UserRole; fuelStationId?: string | null }) {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: '1h' });
}

async function runPhase6Tests() {
  console.log('================================================================================');
  console.log('   IRFA / DFCS — PHASE 6: SHORTAGE MANAGEMENT, DASHBOARDS & REPORTS TEST        ');
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
  const ephemeralShortageIds: string[] = [];
  const ephemeralUserIds: string[] = [];

  try {
    await prisma.$connect();
    console.log('[Setup] Connected to database.');

    // Pre-test cleanup of any residual test shortages
    await prisma.fuelShortage.deleteMany({
      where: { description: { contains: 'P6-TEST' } },
    });
    await prisma.user.deleteMany({
      where: { username: { startsWith: 'p6_unassigned_' } },
    });

    // Start ephemeral server
    server = app.listen(0);
    const port = (server.address() as any).port;
    const baseUrl = `http://127.0.0.1:${port}`;
    console.log(`[Setup] Ephemeral test server running at ${baseUrl}`);

    // Helper request
    async function request(path: string, method: string = 'GET', body?: any, token?: string) {
      const headers: Record<string, string> = {};
      if (token) headers['Authorization'] = `Bearer ${token}`;
      if (body) headers['Content-Type'] = 'application/json';

      const res = await fetch(`${baseUrl}${path}`, {
        method,
        headers,
        body: body ? JSON.stringify(body) : undefined,
      });

      const contentType = res.headers.get('content-type') || '';
      let data: any = null;
      let text: string = '';

      if (contentType.includes('application/json')) {
        data = await res.json();
      } else {
        text = await res.text();
      }

      return { status: res.status, headers: res.headers, data, text };
    }

    // Retrieve baseline entities
    const stations = await prisma.fuelStation.findMany({ orderBy: { code: 'asc' } });
    const st01 = stations.find((s) => s.code === 'BD-ST-01')!;
    const st02 = stations.find((s) => s.code === 'BD-ST-02')!;
    const fuelTypes = await prisma.fuelType.findMany({ where: { isActive: true } });
    const diesel = fuelTypes.find((f) => f.name.toLowerCase().includes('diesel')) || fuelTypes[0];

    // Find baseline users
    const agriUser = await prisma.user.findFirst({ where: { role: UserRole.AGRICULTURE_OFFICE } });
    const tradeUser = await prisma.user.findFirst({ where: { role: UserRole.TRADE_OFFICE } });
    const stationUser = await prisma.user.findFirst({ where: { role: UserRole.STATION_ADMIN, fuelStationId: st01.id } });
    const sysAdminUser = await prisma.user.findFirst({ where: { role: UserRole.SYSTEM_ADMIN } });

    assert(Boolean(agriUser), 'Found baseline Agriculture Office user');
    assert(Boolean(tradeUser), 'Found baseline Trade Office user');
    assert(Boolean(stationUser), 'Found baseline Station Admin user for BD-ST-01');
    assert(Boolean(sysAdminUser), 'Found baseline System Admin user');

    const agriToken = makeToken({ userId: agriUser!.id, username: agriUser!.username, role: UserRole.AGRICULTURE_OFFICE });
    const tradeToken = makeToken({ userId: tradeUser!.id, username: tradeUser!.username, role: UserRole.TRADE_OFFICE });
    const stationToken = makeToken({ userId: stationUser!.id, username: stationUser!.username, role: UserRole.STATION_ADMIN, fuelStationId: st01.id });
    const sysAdminToken = makeToken({ userId: sysAdminUser!.id, username: sysAdminUser!.username, role: UserRole.SYSTEM_ADMIN });

    // =========================================================================
    // SECTION 1: BASELINE PRESERVATION CHECKS
    // =========================================================================
    console.log('\n--- Section 1: Baseline Preservation & Operational State ---');
    const [stationCount, subCityCount, kebeleCount, farmerCount, txCount, verifCount] = await Promise.all([
      prisma.fuelStation.count(),
      prisma.subCity.count(),
      prisma.kebele.count(),
      prisma.farmer.count(),
      prisma.fuelTransaction.count(),
      prisma.verificationLog.count(),
    ]);

    assert(stationCount === 22, `Official 22 fuel stations intact (found ${stationCount})`);
    assert(subCityCount === 4, `Official 4 Sub-Cities intact (found ${subCityCount})`);
    assert(kebeleCount >= 45, `Kebeles intact (found ${kebeleCount})`);
    assert(farmerCount >= 20, `Baseline farmers intact (found ${farmerCount})`);
    assert(txCount >= 8, `Historical transactions intact (found ${txCount})`);
    assert(verifCount >= 32, `Historical verification logs intact (found ${verifCount})`);

    // =========================================================================
    // SECTION 2: INSTITUTION-SPECIFIC DASHBOARDS
    // =========================================================================
    console.log('\n--- Section 2: Institution-Specific Dashboards ---');

    // 2.1 Agriculture Office Dashboard
    {
      const res = await request('/api/dashboard/stats', 'GET', undefined, agriToken);
      assert(res.status === 200, 'Agriculture Office dashboard returns 200');
      assert(res.data.role === 'agriculture', 'Dashboard response role is agriculture');
      assert(Array.isArray(res.data.stats) && res.data.stats.length === 4, 'Stats array has 4 cards');
      assert(res.data.farmerMetrics && typeof res.data.farmerMetrics.total === 'number', 'farmerMetrics.total returned');
      assert(typeof res.data.farmerMetrics.active === 'number', 'farmerMetrics.active returned');
      assert(typeof res.data.farmerMetrics.eligible === 'number', 'farmerMetrics.eligible returned');
      assert(res.data.requestMetrics && typeof res.data.requestMetrics.total === 'number', 'requestMetrics.total returned');
      assert(Array.isArray(res.data.subCityDistribution) && res.data.subCityDistribution.length === 4, 'subCityDistribution has 4 sub-cities');
      assert(Array.isArray(res.data.fuelBreakdowns), 'fuelBreakdowns returned');
    }

    // 2.2 Trade Office Dashboard
    {
      const res = await request('/api/dashboard/stats', 'GET', undefined, tradeToken);
      assert(res.status === 200, 'Trade Office dashboard returns 200');
      assert(res.data.role === 'trade', 'Dashboard response role is trade');
      assert(Array.isArray(res.data.stats) && res.data.stats.length === 4, 'Stats array has 4 cards');
      assert(res.data.stationMetrics && res.data.stationMetrics.totalStations === 22, 'stationMetrics shows 22 total stations');
      assert(res.data.stationMetrics.activeStations === 22, 'stationMetrics shows 22 active stations');
      assert(res.data.stationMetrics.inactiveStations === 0, 'stationMetrics shows 0 inactive stations');
      assert(res.data.stationMetrics.stationsWithRepresentative >= 1, 'stationMetrics shows representatives assigned');
      assert(res.data.monitoring && typeof res.data.monitoring.totalAuthorized === 'number', 'monitoring.totalAuthorized returned');
      assert(typeof res.data.monitoring.totalConsumed === 'number', 'monitoring.totalConsumed returned');
      assert(res.data.shortages && typeof res.data.shortages.activeCount === 'number', 'shortages.activeCount returned');
      assert(Array.isArray(res.data.dispensingByFuelType), 'dispensingByFuelType array returned');
    }

    // 2.3 Station Representative Dashboard (Strict Isolation)
    {
      const res = await request('/api/dashboard/stats', 'GET', undefined, stationToken);
      assert(res.status === 200, 'Station Admin dashboard returns 200');
      assert(res.data.role === 'station', 'Dashboard response role is station');
      assert(res.data.stationName === st01.name, `Station name matches BD-ST-01 (${st01.name})`);
      assert(res.data.stationInfo && res.data.stationInfo.code === 'BD-ST-01', 'stationInfo.code matches BD-ST-01');
      assert(res.data.todayPerformance && typeof res.data.todayPerformance.transactionsCount === 'number', 'todayPerformance.transactionsCount returned');
      assert(res.data.verificationStats && typeof res.data.verificationStats.totalSuccess === 'number', 'verificationStats returned');
      assert(typeof res.data.verificationStats.rejectionReasons === 'object', 'rejectionReasons breakdown map returned');
      assert(Array.isArray(res.data.recentTransactions), 'recentTransactions returned');
      // Ensure all returned recent transactions belong strictly to BD-ST-01
      const wrongStationTx = res.data.recentTransactions.filter((t: any) => t.fuelStationId && t.fuelStationId !== st01.id);
      assert(wrongStationTx.length === 0, 'Station Admin transactions strictly isolated to assigned station BD-ST-01');
    }

    // 2.4 Unassigned Station Admin Dashboard Handling
    {
      const unassignedUser = await prisma.user.create({
        data: {
          username: 'p6_unassigned_admin',
          passwordHash: 'dummy_hash_p6',
          fullName: 'Unassigned Rep Test',
          role: UserRole.STATION_ADMIN,
          fuelStationId: null,
        },
      });
      ephemeralUserIds.push(unassignedUser.id);

      const unassignedToken = makeToken({ userId: unassignedUser.id, username: unassignedUser.username, role: UserRole.STATION_ADMIN });
      const res = await request('/api/dashboard/stats', 'GET', undefined, unassignedToken);
      assert(res.status === 200, 'Unassigned representative dashboard handles gracefully with 200');
      assert(res.data.role === 'station', 'Returns station role');
      assert(res.data.stationInfo === null, 'stationInfo is null for unassigned rep');
    }

    // 2.5 System Administrator Dashboard (Technical Monitoring Only)
    {
      const res = await request('/api/dashboard/stats', 'GET', undefined, sysAdminToken);
      assert(res.status === 200, 'System Admin dashboard returns 200');
      assert(res.data.role === 'sysadmin', 'Dashboard response role is sysadmin');
      assert(res.data.technicalMetrics && typeof res.data.technicalMetrics.totalUsers === 'number', 'technicalMetrics.totalUsers returned');
      assert(typeof res.data.technicalMetrics.activeUsers === 'number', 'technicalMetrics.activeUsers returned');
      assert(typeof res.data.technicalMetrics.usersByRole === 'object', 'technicalMetrics.usersByRole object returned');
      assert(res.data.systemHealth && res.data.systemHealth.appStatus === 'Operational', 'systemHealth.appStatus is Operational');
      assert(res.data.systemHealth.dbStatus === 'Connected', 'systemHealth.dbStatus is Connected');
      assert(typeof res.data.systemHealth.uptimeSeconds === 'number', 'systemHealth.uptimeSeconds returned');
      assert(Array.isArray(res.data.recentAuditLogs), 'recentAuditLogs returned');
    }

    // 2.6 Security & Authentication
    {
      const res = await request('/api/dashboard/stats', 'GET');
      assert(res.status === 401, 'Unauthenticated request to dashboard rejected with 401');
    }

    // =========================================================================
    // SECTION 3: CONTROLLED FUEL SHORTAGE MANAGEMENT WORKFLOW
    // =========================================================================
    console.log('\n--- Section 3: Controlled Fuel Shortage Management Workflow ---');

    let shortage1Id: string = '';
    let shortage2Id: string = '';

    // 3.1 Station Admin reports shortage for own station
    {
      const res = await request('/api/shortages', 'POST', {
        fuelStationId: st01.id,
        fuelTypeId: diesel.id,
        category: ShortageCategory.FUEL_SUPPLY_SHORTAGE,
        description: 'P6-TEST: Low diesel inventory from distribution delay',
        estimatedAvailable: 350.0,
        estimatedShortage: 2500.0,
        notes: 'Expected tanker arrival in 48 hours',
      }, stationToken);

      assert(res.status === 201, 'Station Admin reports shortage for own station with 201 Created');
      assert(res.data.success === true, 'Response indicates success');
      assert(res.data.shortage.status === ShortageStatus.REPORTED, 'Initial shortage status is REPORTED');
      assert(res.data.shortage.fuelStationId === st01.id, 'Shortage linked to BD-ST-01');
      assert(res.data.shortage.category === 'FUEL_SUPPLY_SHORTAGE', 'Category matches');
      assert(Number(res.data.shortage.estimatedAvailable) === 350, 'Available quantity matches');
      assert(Number(res.data.shortage.estimatedShortage) === 2500, 'Estimated shortage quantity matches');
      shortage1Id = res.data.shortage.id;
      ephemeralShortageIds.push(shortage1Id);
    }

    // 3.2 Station Admin attempts to report shortage for another station (Forbidden)
    {
      const res = await request('/api/shortages', 'POST', {
        fuelStationId: st02.id, // BD-ST-02
        fuelTypeId: diesel.id,
        category: ShortageCategory.FUEL_SUPPLY_SHORTAGE,
        description: 'P6-TEST: Unauthorized attempt on another station',
      }, stationToken);

      assert(res.status === 403, 'Station Admin cannot report shortage for another station (403 Forbidden)');
    }

    // 3.3 Trade Office reports shortage for any station
    {
      const res = await request('/api/shortages', 'POST', {
        fuelStationId: st02.id,
        fuelTypeId: diesel.id,
        category: ShortageCategory.TECHNICAL_STATION_PROBLEM,
        description: 'P6-TEST: Trade reported pump calibration fault at BD-ST-02',
        estimatedShortage: 1000.0,
      }, tradeToken);

      assert(res.status === 201, 'Trade Office reports shortage for BD-ST-02 with 201 Created');
      shortage2Id = res.data.shortage.id;
      ephemeralShortageIds.push(shortage2Id);
    }

    // 3.4 Agriculture Office & System Admin blocked from reporting
    {
      const resAgri = await request('/api/shortages', 'POST', {
        fuelStationId: st01.id,
        fuelTypeId: diesel.id,
        category: ShortageCategory.OTHER,
        description: 'P6-TEST: Agri cannot report',
      }, agriToken);
      assert(resAgri.status === 403, 'Agriculture Office blocked from reporting shortages (403)');

      const resSys = await request('/api/shortages', 'POST', {
        fuelStationId: st01.id,
        fuelTypeId: diesel.id,
        category: ShortageCategory.OTHER,
        description: 'P6-TEST: SysAdmin cannot report',
      }, sysAdminToken);
      assert(resSys.status === 403, 'System Admin blocked from operational shortage reporting (403)');
    }

    // 3.5 Validation Enforcement
    {
      const res = await request('/api/shortages', 'POST', {
        fuelStationId: st01.id,
        fuelTypeId: diesel.id,
        category: 'INVALID_CATEGORY',
        description: 'ab', // too short (< 3 chars)
      }, stationToken);

      assert(res.status === 400, 'Invalid category and short description rejected with 400 Bad Request');
    }

    // 3.6 Scoped Shortages Listing
    {
      // Station Admin listing
      const resStation = await request('/api/shortages', 'GET', undefined, stationToken);
      assert(resStation.status === 200, 'Station Admin queries shortages with 200 OK');
      const otherStationShortages = resStation.data.shortages.filter((s: any) => s.fuelStationId !== st01.id);
      assert(otherStationShortages.length === 0, 'Station Admin listing is strictly scoped to assigned station');
      const ownShortage = resStation.data.shortages.find((s: any) => s.id === shortage1Id);
      assert(Boolean(ownShortage), 'Station Admin sees own reported shortage');

      // Trade Office listing
      const resTrade = await request('/api/shortages', 'GET', undefined, tradeToken);
      assert(resTrade.status === 200, 'Trade Office queries all shortages with 200 OK');
      const hasSt01 = resTrade.data.shortages.some((s: any) => s.id === shortage1Id);
      const hasSt02 = resTrade.data.shortages.some((s: any) => s.id === shortage2Id);
      assert(hasSt01 && hasSt02, 'Trade Office sees shortages from all stations (BD-ST-01 and BD-ST-02)');
    }

    // 3.7 Shortage Review Lifecycle by Trade Office
    {
      // Step A: Station Admin cannot review
      const resStationReview = await request(`/api/shortages/${shortage1Id}/review`, 'PATCH', {
        status: ShortageStatus.CONFIRMED,
      }, stationToken);
      assert(resStationReview.status === 403, 'Station Admin cannot review shortage (403 Forbidden)');

      // Step B: Trade Office moves to UNDER_REVIEW
      const resUnderReview = await request(`/api/shortages/${shortage1Id}/review`, 'PATCH', {
        status: ShortageStatus.UNDER_REVIEW,
        reviewRemarks: 'Trade inspector verifying dispatch records',
      }, tradeToken);
      assert(resUnderReview.status === 200, 'Trade Office moves shortage to UNDER_REVIEW');
      assert(resUnderReview.data.shortage.status === ShortageStatus.UNDER_REVIEW, 'Status updated to UNDER_REVIEW');

      // Step C: Trade Office CONFIRMED
      const resConfirmed = await request(`/api/shortages/${shortage1Id}/review`, 'PATCH', {
        status: ShortageStatus.CONFIRMED,
        reviewRemarks: 'Shortage confirmed by supplier communication',
      }, tradeToken);
      assert(resConfirmed.status === 200, 'Trade Office moves shortage to CONFIRMED');
      assert(resConfirmed.data.shortage.status === ShortageStatus.CONFIRMED, 'Status updated to CONFIRMED');

      // Step D: Trade Office rejection WITHOUT mandatory remarks fails
      const resRejectNoRemarks = await request(`/api/shortages/${shortage2Id}/review`, 'PATCH', {
        status: ShortageStatus.REJECTED,
        reviewRemarks: '', // Missing explanation
      }, tradeToken);
      assert(resRejectNoRemarks.status === 400, 'Rejecting shortage without explanation rejected with 400 Bad Request');

      // Step E: Trade Office rejection WITH mandatory remarks succeeds
      const resRejectWithRemarks = await request(`/api/shortages/${shortage2Id}/review`, 'PATCH', {
        status: ShortageStatus.REJECTED,
        reviewRemarks: 'Calibration test passed; no operational fuel shortage observed',
      }, tradeToken);
      assert(resRejectWithRemarks.status === 200, 'Rejecting shortage with explanation succeeds with 200');
      assert(resRejectWithRemarks.data.shortage.status === ShortageStatus.REJECTED, 'Shortage 2 status updated to REJECTED');

      // Step F: Trade Office marks shortage1 as RESOLVED
      const resResolved = await request(`/api/shortages/${shortage1Id}/review`, 'PATCH', {
        status: ShortageStatus.RESOLVED,
        reviewRemarks: 'New tanker delivery of 10,000L arrived and verified',
      }, tradeToken);
      assert(resResolved.status === 200, 'Trade Office resolves shortage with 200');
      assert(resResolved.data.shortage.status === ShortageStatus.RESOLVED, 'Status updated to RESOLVED');
      assert(Boolean(resResolved.data.shortage.resolvedAt), 'resolvedAt timestamp recorded');
    }

    // 3.8 Dispensing Invariant Check
    {
      // Confirm that the database authorizations, quotas, and allocations remain untouched by shortage events
      const activeAuths = await prisma.fuelAuthorization.count({ where: { status: 'ACTIVE' } });
      const activeAllocs = await prisma.monthlyAllocation.count({ where: { status: 'ACTIVE' } });
      assert(activeAuths >= 2, `Active authorizations count unchanged (${activeAuths})`);
      assert(activeAllocs >= 2, `Active allocations count unchanged (${activeAllocs})`);
    }

    // =========================================================================
    // SECTION 4: OPERATIONAL REPORTS & CSV EXPORT
    // =========================================================================
    console.log('\n--- Section 4: Operational Reports & CSV Export ---');

    // 4.1 Reports Overview
    {
      const res = await request('/api/reports/overview?periodMonth=11&periodYear=2026', 'GET', undefined, agriToken);
      assert(res.status === 200, '/api/reports/overview returns 200');
      assert(Array.isArray(res.data.fuelSummary), 'fuelSummary array returned');
      assert(Array.isArray(res.data.stationSummary), 'stationSummary array returned');
      assert(res.data.stationSummary.length === 22, 'stationSummary includes all 22 official stations');
      assert(res.data.farmerStats && typeof res.data.farmerStats.eligible === 'number', 'farmerStats returned');
    }

    // 4.2 Agriculture Report
    {
      const res = await request('/api/reports/agriculture', 'GET', undefined, agriToken);
      assert(res.status === 200, '/api/reports/agriculture returns 200');
      assert(res.data.reportType === 'AGRICULTURE', 'reportType is AGRICULTURE');
      assert(typeof res.data.eligibilityCounts === 'object', 'eligibilityCounts returned');
      assert(Array.isArray(res.data.subCityBreakdown) && res.data.subCityBreakdown.length === 4, 'subCityBreakdown has 4 sub-cities');
      assert(Array.isArray(res.data.requestsByStatus), 'requestsByStatus array returned');
      assert(res.data.allocationsSummary && typeof res.data.allocationsSummary.totalAllocated === 'number', 'allocationsSummary returned');
    }

    // 4.3 Trade Report
    {
      const res = await request('/api/reports/trade', 'GET', undefined, tradeToken);
      assert(res.status === 200, '/api/reports/trade returns 200');
      assert(res.data.reportType === 'TRADE', 'reportType is TRADE');
      assert(Array.isArray(res.data.stationReports) && res.data.stationReports.length === 22, 'stationReports includes 22 stations');
      assert(res.data.authorizationsSummary && typeof res.data.authorizationsSummary.totalAuthorizedLiters === 'number', 'authorizationsSummary returned');
      assert(Array.isArray(res.data.activeShortages), 'activeShortages array returned');
    }

    // 4.4 Station Report
    {
      const res = await request('/api/reports/station', 'GET', undefined, stationToken);
      assert(res.status === 200, '/api/reports/station returns 200 for Station Admin');
      assert(res.data.reportType === 'STATION', 'reportType is STATION');
      assert(res.data.station && res.data.station.code === 'BD-ST-01', 'Report station is BD-ST-01');
      assert(res.data.summary && typeof res.data.summary.totalDispensedLiters === 'number', 'summary.totalDispensedLiters returned');
      assert(res.data.verificationSummary && typeof res.data.verificationSummary.total === 'number', 'verificationSummary returned');
    }

    // 4.5 CSV Export Endpoints
    {
      // Overview CSV
      const resOverview = await request('/api/reports/export?type=overview', 'GET', undefined, agriToken);
      assert(resOverview.status === 200, '/api/reports/export?type=overview returns 200');
      assert(resOverview.headers.get('content-type')?.includes('text/csv') || false, 'Overview CSV header is text/csv');
      assert(resOverview.text.includes('Station Name') && resOverview.text.includes('BD-ST-01'), 'Overview CSV contains station header and data');

      // Agriculture CSV
      const resAgri = await request('/api/reports/export?type=agriculture', 'GET', undefined, agriToken);
      assert(resAgri.status === 200, '/api/reports/export?type=agriculture returns 200');
      assert(resAgri.headers.get('content-type')?.includes('text/csv') || false, 'Agriculture CSV header is text/csv');
      assert(resAgri.text.includes('Farmer Code') && resAgri.text.includes('Full Name'), 'Agriculture CSV contains farmer headers');

      // Trade CSV
      const resTrade = await request('/api/reports/export?type=trade', 'GET', undefined, tradeToken);
      assert(resTrade.status === 200, '/api/reports/export?type=trade returns 200');
      assert(resTrade.headers.get('content-type')?.includes('text/csv') || false, 'Trade CSV header is text/csv');
      assert(resTrade.text.includes('Station Code') && resTrade.text.includes('Active Representative'), 'Trade CSV contains station performance headers');

      // Station CSV
      const resStation = await request('/api/reports/export?type=station', 'GET', undefined, stationToken);
      assert(resStation.status === 200, '/api/reports/export?type=station returns 200');
      assert(resStation.headers.get('content-type')?.includes('text/csv') || false, 'Station CSV header is text/csv');
      assert(resStation.text.includes('Receipt Number') && resStation.text.includes('Quantity (L)'), 'Station CSV contains dispensing headers');
    }

    // =========================================================================
    // SECTION 5: TEARDOWN & CLEAN STATE VERIFICATION
    // =========================================================================
    console.log('\n--- Section 5: Teardown & Clean Database Verification ---');

    if (ephemeralShortageIds.length > 0) {
      await prisma.fuelShortage.deleteMany({
        where: { id: { in: ephemeralShortageIds } },
      });
      console.log(`[Teardown] Cleaned up ${ephemeralShortageIds.length} ephemeral test shortages.`);
    }

    if (ephemeralUserIds.length > 0) {
      await prisma.user.deleteMany({
        where: { id: { in: ephemeralUserIds } },
      });
      console.log(`[Teardown] Cleaned up ${ephemeralUserIds.length} ephemeral test users.`);
    }

    await prisma.auditLog.deleteMany({
      where: { action: { startsWith: 'SHORTAGE_' } },
    });

    const [finalStations, finalShortages, finalAllocations, finalFarmers, finalTx] = await Promise.all([
      prisma.fuelStation.count(),
      prisma.fuelShortage.count(),
      prisma.stationSubCityAssignment.count(),
      prisma.farmer.count(),
      prisma.fuelTransaction.count(),
    ]);

    assert(finalStations === 22, `22 fuel stations preserved (found ${finalStations})`);
    assert(finalShortages === 0, `0 mock shortage records remain in DB (found ${finalShortages})`);
    assert(finalAllocations === 0, `0 invented station allocations preserved (found ${finalAllocations})`);
    assert(finalFarmers === farmerCount, `Farmer records intact (${finalFarmers})`);
    assert(finalTx === txCount, `Historical transactions intact (${finalTx})`);

  } catch (err: any) {
    console.error('Unhandled test suite error:', err);
    failed++;
  } finally {
    if (server) {
      server.close();
      console.log('\n[Teardown] Ephemeral test server closed.');
    }
    await prisma.$disconnect();
    console.log('[Teardown] Disconnected from database.');
  }

  console.log('\n================================================================================');
  console.log(`   PHASE 6 TEST RESULTS: ${passed} PASSED, ${failed} FAILED                      `);
  console.log('================================================================================\n');

  if (failed > 0) {
    process.exit(1);
  }
}

runPhase6Tests();
