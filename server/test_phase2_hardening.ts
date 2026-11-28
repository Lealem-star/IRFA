import 'dotenv/config';
import http from 'http';
import prisma from './src/config/db.js';
import app from './src/app.js';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { UserRole } from '@prisma/client';

const JWT_SECRET = process.env.JWT_SECRET || 'irfa_bahir_dar_super_secret_jwt_key_2026_secured';

function makeToken(payload: { userId: string; username: string; role: UserRole; fuelStationId?: string | null }) {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: '1h' });
}

async function runHardeningTests() {
  console.log('========================================================================');
  console.log('   IRFA / DFCS — PHASE 2: SECURITY, CONCURRENCY & INTEGRITY HARDENING   ');
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

  // Ephemeral test accounts to track for cleanup
  const ephemeralUserIds: string[] = [];

  let server: http.Server | null = null;

  try {
    await prisma.$connect();
    console.log('[Setup] Connected to database.');

    // Start ephemeral HTTP server on random port for real HTTP middleware testing
    const port = await new Promise<number>((resolve) => {
      server = app.listen(0, () => {
        const addr: any = server!.address();
        resolve(addr.port);
      });
    });
    console.log(`[Setup] Ephemeral test server listening on http://127.0.0.1:${port}\n`);

    const baseUrl = `http://127.0.0.1:${port}`;

    // Helper for HTTP requests
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

    const primaryStationAdmin = await prisma.user.findFirst({
      where: { username: 'station' },
      include: { fuelStation: true },
    });
    assert(!!primaryStationAdmin, "Primary 'station' user exists");
    assert(primaryStationAdmin?.role === 'STATION_ADMIN', "'station' role is STATION_ADMIN");
    assert(primaryStationAdmin?.isActive === true, "'station' is ACTIVE");
    assert(primaryStationAdmin?.fuelStation?.code === 'BD-ST-01', "'station' is assigned to BD-ST-01");

    const baselineTxCount = await prisma.fuelTransaction.count();
    assert(baselineTxCount === 8, `Baseline completed transactions is 8 (found ${baselineTxCount})`);

    const baselineVerifCount = await prisma.verificationLog.count();
    assert(baselineVerifCount === 32, `Baseline verification logs is 32 (found ${baselineVerifCount})`);

    const baselineFarmersCount = await prisma.farmer.count();
    assert(baselineFarmersCount === 20, `Baseline farmers is 20 (found ${baselineFarmersCount})`);

    // ---------------------------------------------------------
    // 2. ACTUAL HTTP API ROUTE AUTHORIZATION (REAL MIDDLEWARE)
    // ---------------------------------------------------------
    console.log('\n--- 2. Actual HTTP API Route Authorization by Role ---');

    const tradeUser = await prisma.user.findFirst({ where: { role: 'TRADE_OFFICE' } });
    const agriUser = await prisma.user.findFirst({ where: { role: 'AGRICULTURE_OFFICE' } });
    const sysAdminUser = await prisma.user.findFirst({ where: { role: 'SYSTEM_ADMIN' } });

    const tradeToken = makeToken({ userId: tradeUser!.id, username: tradeUser!.username, role: 'TRADE_OFFICE' });
    const agriToken = makeToken({ userId: agriUser!.id, username: agriUser!.username, role: 'AGRICULTURE_OFFICE' });
    const stationToken = makeToken({
      userId: primaryStationAdmin!.id,
      username: primaryStationAdmin!.username,
      role: 'STATION_ADMIN',
      fuelStationId: primaryStationAdmin!.fuelStationId,
    });
    const sysAdminToken = makeToken({ userId: sysAdminUser!.id, username: sysAdminUser!.username, role: 'SYSTEM_ADMIN' });

    // Test Station BD-ST-07 for authorization checks
    const station7 = await prisma.fuelStation.findUnique({ where: { code: 'BD-ST-07' } });
    assert(!!station7, 'Station BD-ST-07 exists for route testing');

    // A) GET /api/trade/representatives
    const unauthGet = await apiRequest('GET', '/api/trade/representatives');
    assert(unauthGet.status === 401, 'GET /representatives unauthenticated -> 401 Unauthorized');

    const agriGet = await apiRequest('GET', '/api/trade/representatives', agriToken);
    assert(agriGet.status === 403, 'GET /representatives as AGRICULTURE_OFFICE -> 403 Forbidden');

    const stationGet = await apiRequest('GET', '/api/trade/representatives', stationToken);
    assert(stationGet.status === 403, 'GET /representatives as STATION_ADMIN -> 403 Forbidden');

    const sysGet = await apiRequest('GET', '/api/trade/representatives', sysAdminToken);
    assert(sysGet.status === 403, 'GET /representatives as SYSTEM_ADMIN -> 403 Forbidden');

    const tradeGet = await apiRequest('GET', '/api/trade/representatives', tradeToken);
    assert(tradeGet.status === 200, 'GET /representatives as TRADE_OFFICE -> 200 OK');

    // B) POST /api/trade/representatives (Mutation)
    const postPayload = {
      fuelStationId: station7!.id,
      fullName: 'Auth Test Attendant',
      username: `rep_auth_test_${Date.now()}`,
      password: 'Password123!',
    };

    const unauthPost = await apiRequest('POST', '/api/trade/representatives', undefined, postPayload);
    assert(unauthPost.status === 401, 'POST /representatives unauthenticated -> 401 Unauthorized');

    const agriPost = await apiRequest('POST', '/api/trade/representatives', agriToken, postPayload);
    assert(agriPost.status === 403, 'POST /representatives as AGRICULTURE_OFFICE -> 403 Forbidden');

    const stationPost = await apiRequest('POST', '/api/trade/representatives', stationToken, postPayload);
    assert(stationPost.status === 403, 'POST /representatives as STATION_ADMIN -> 403 Forbidden');

    const sysPost = await apiRequest('POST', '/api/trade/representatives', sysAdminToken, postPayload);
    assert(sysPost.status === 403, 'POST /representatives as SYSTEM_ADMIN -> 403 Forbidden');

    // Trade Office creates representative successfully
    const tradePost = await apiRequest('POST', '/api/trade/representatives', tradeToken, postPayload);
    assert(tradePost.status === 201, 'POST /representatives as TRADE_OFFICE -> 201 Created');
    const authRepId = tradePost.data?.representative?.id;
    if (authRepId) ephemeralUserIds.push(authRepId);

    // C) PATCH /api/trade/representatives/:id/status
    const unauthPatch = await apiRequest('PATCH', `/api/trade/representatives/${authRepId}/status`, undefined, { status: 'INACTIVE' });
    assert(unauthPatch.status === 401, 'PATCH /status unauthenticated -> 401 Unauthorized');

    const agriPatch = await apiRequest('PATCH', `/api/trade/representatives/${authRepId}/status`, agriToken, { status: 'INACTIVE' });
    assert(agriPatch.status === 403, 'PATCH /status as AGRICULTURE_OFFICE -> 403 Forbidden');

    const stationPatch = await apiRequest('PATCH', `/api/trade/representatives/${authRepId}/status`, stationToken, { status: 'INACTIVE' });
    assert(stationPatch.status === 403, 'PATCH /status as STATION_ADMIN -> 403 Forbidden');

    const sysPatch = await apiRequest('PATCH', `/api/trade/representatives/${authRepId}/status`, sysAdminToken, { status: 'INACTIVE' });
    assert(sysPatch.status === 403, 'PATCH /status as SYSTEM_ADMIN -> 403 Forbidden');

    // D) POST /api/trade/representatives/:id/replace
    const replacePayload = {
      fullName: 'Auth Replace Rep',
      username: `rep_auth_replace_${Date.now()}`,
      password: 'Password123!',
    };
    const agriReplace = await apiRequest('POST', `/api/trade/representatives/${authRepId}/replace`, agriToken, replacePayload);
    assert(agriReplace.status === 403, 'POST /replace as AGRICULTURE_OFFICE -> 403 Forbidden');

    const stationReplace = await apiRequest('POST', `/api/trade/representatives/${authRepId}/replace`, stationToken, replacePayload);
    assert(stationReplace.status === 403, 'POST /replace as STATION_ADMIN -> 403 Forbidden');

    const sysReplace = await apiRequest('POST', `/api/trade/representatives/${authRepId}/replace`, sysAdminToken, replacePayload);
    assert(sysReplace.status === 403, 'POST /replace as SYSTEM_ADMIN -> 403 Forbidden');

    // E) POST /api/trade/representatives/:id/reassign
    const station8 = await prisma.fuelStation.findUnique({ where: { code: 'BD-ST-08' } });
    const reassignPayload = { newFuelStationId: station8!.id };

    const agriReassign = await apiRequest('POST', `/api/trade/representatives/${authRepId}/reassign`, agriToken, reassignPayload);
    assert(agriReassign.status === 403, 'POST /reassign as AGRICULTURE_OFFICE -> 403 Forbidden');

    const stationReassign = await apiRequest('POST', `/api/trade/representatives/${authRepId}/reassign`, stationToken, reassignPayload);
    assert(stationReassign.status === 403, 'POST /reassign as STATION_ADMIN -> 403 Forbidden');

    const sysReassign = await apiRequest('POST', `/api/trade/representatives/${authRepId}/reassign`, sysAdminToken, reassignPayload);
    assert(sysReassign.status === 403, 'POST /reassign as SYSTEM_ADMIN -> 403 Forbidden');

    // F) POST /api/trade/representatives/:id/reset-password
    const resetPayload = { newPassword: 'NewSecurePassword123!' };

    const agriReset = await apiRequest('POST', `/api/trade/representatives/${authRepId}/reset-password`, agriToken, resetPayload);
    assert(agriReset.status === 403, 'POST /reset-password as AGRICULTURE_OFFICE -> 403 Forbidden');

    const stationReset = await apiRequest('POST', `/api/trade/representatives/${authRepId}/reset-password`, stationToken, resetPayload);
    assert(stationReset.status === 403, 'POST /reset-password as STATION_ADMIN -> 403 Forbidden');

    const sysReset = await apiRequest('POST', `/api/trade/representatives/${authRepId}/reset-password`, sysAdminToken, resetPayload);
    assert(sysReset.status === 403, 'POST /reset-password as SYSTEM_ADMIN -> 403 Forbidden');

    // ---------------------------------------------------------
    // 3. CONCURRENCY: SIMULTANEOUS CREATION REQUESTS
    // ---------------------------------------------------------
    console.log('\n--- 3. Concurrency: Simultaneous Creation Requests on Same Station ---');
    // We will fire 4 SIMULTANEOUS requests against station BD-ST-08
    const station8Id = station8!.id;

    // Ensure station BD-ST-08 has no active rep
    await prisma.user.deleteMany({
      where: { fuelStationId: station8Id, role: 'STATION_ADMIN' },
    });

    const concurrentRequests = [1, 2, 3, 4].map((i) => {
      const username = `rep_simult_${i}_${Date.now()}`;
      return apiRequest('POST', '/api/trade/representatives', tradeToken, {
        fuelStationId: station8Id,
        fullName: `Simultaneous Attendant ${i}`,
        username,
        password: 'Password123!',
        forceReplace: false, // NONE forced
      });
    });

    console.log('  Firing 4 simultaneous POST requests via Promise.all...');
    const results = await Promise.all(concurrentRequests);

    const createdCount = results.filter((r) => r.status === 201).length;
    const conflictCount = results.filter((r) => r.status === 409).length;

    console.log(`  Results: ${createdCount} created (201), ${conflictCount} rejected with conflict (409)`);

    assert(createdCount === 1, `EXACTLY 1 creation request succeeded (got ${createdCount})`);
    assert(conflictCount === 3, `EXACTLY 3 concurrent requests rejected with HTTP 409 Conflict (got ${conflictCount})`);

    // Verify in database: exactly 1 active representative on BD-ST-08
    const activeRepsOnStation8 = await prisma.user.findMany({
      where: { fuelStationId: station8Id, role: 'STATION_ADMIN', isActive: true },
    });
    assert(activeRepsOnStation8.length === 1, `Database contains EXACTLY 1 active representative (found ${activeRepsOnStation8.length})`);

    for (const r of activeRepsOnStation8) {
      ephemeralUserIds.push(r.id);
    }

    // ---------------------------------------------------------
    // 4. CONCURRENCY: SIMULTANEOUS REPLACEMENTS
    // ---------------------------------------------------------
    console.log('\n--- 4. Concurrency: Simultaneous Replacement Requests ---');
    // Launch 3 simultaneous replacement requests with forceReplace
    const activeRepBefore = activeRepsOnStation8[0];
    const concurrentReplacements = [1, 2, 3].map((i) => {
      const username = `rep_repl_simult_${i}_${Date.now()}`;
      return apiRequest('POST', `/api/trade/representatives/${activeRepBefore.id}/replace`, tradeToken, {
        fullName: `Replacement Attendant ${i}`,
        username,
        password: 'Password123!',
        reason: `Concurrent replacement test ${i}`,
      });
    });

    console.log('  Firing 3 simultaneous replacement requests via Promise.all...');
    const replResults = await Promise.all(concurrentReplacements);

    const replCreatedCount = replResults.filter((r) => r.status === 201).length;
    const replConflictCount = replResults.filter((r) => r.status === 409).length;
    console.log(`  Replacement Results: ${replCreatedCount} replaced (201), ${replConflictCount} rejected (409)`);
    assert(replCreatedCount === 1, `EXACTLY 1 replacement request succeeded (got ${replCreatedCount})`);
    assert(replConflictCount === 2, `EXACTLY 2 concurrent replacements rejected with HTTP 409 (got ${replConflictCount})`);

    // Track created user IDs
    for (const res of replResults) {
      if (res.data?.representative?.id) {
        ephemeralUserIds.push(res.data.representative.id);
      }
    }

    // Verify invariant after concurrent replacements
    const activeRepsAfterRepl = await prisma.user.findMany({
      where: { fuelStationId: station8Id, role: 'STATION_ADMIN', isActive: true },
    });
    assert(
      activeRepsAfterRepl.length === 1,
      `After concurrent replacements, EXACTLY 1 active representative exists on station (found ${activeRepsAfterRepl.length})`
    );

    // ---------------------------------------------------------
    // 5. PASSWORD RESET SECURITY & BOUNDARY TESTS
    // ---------------------------------------------------------
    console.log('\n--- 5. Password Reset Security & Boundary Tests ---');
    const currentActiveRep = activeRepsAfterRepl[0];

    // A) Password reset response does NOT leak password or passwordHash
    const resetRes = await apiRequest(
      'POST',
      `/api/trade/representatives/${currentActiveRep.id}/reset-password`,
      tradeToken,
      { newPassword: 'SuperSecretHardened2026!' }
    );
    assert(resetRes.status === 200, 'Password reset returns HTTP 200');
    assert(!resetRes.data?.password, 'API response does NOT expose plain password');
    assert(!resetRes.data?.passwordHash, 'API response does NOT expose passwordHash');

    // B) Bcrypt verify new password
    const userInDb = await prisma.user.findUnique({ where: { id: currentActiveRep.id } });
    const hashCheck = await bcrypt.compare('SuperSecretHardened2026!', userInDb!.passwordHash);
    assert(hashCheck === true, 'New password properly hashed and verifiable with bcrypt');

    // C) Attempt to reset password of an Agriculture Office account (Non-Station)
    const nonRepReset = await apiRequest(
      'POST',
      `/api/trade/representatives/${agriUser!.id}/reset-password`,
      tradeToken,
      { newPassword: 'HackedPassword123!' }
    );
    assert(
      nonRepReset.status === 404,
      `Attempt to reset non-station user returns 404 Not Found (got ${nonRepReset.status})`
    );

    // D) Attempt to reset password of a System Admin account
    const sysAdminReset = await apiRequest(
      'POST',
      `/api/trade/representatives/${sysAdminUser!.id}/reset-password`,
      tradeToken,
      { newPassword: 'HackedPassword123!' }
    );
    assert(
      sysAdminReset.status === 404,
      `Attempt to reset System Admin returns 404 Not Found (got ${sysAdminReset.status})`
    );

    // E) Reset password on an INACTIVE representative preserves inactive state
    await prisma.user.update({
      where: { id: currentActiveRep.id },
      data: { isActive: false },
    });
    const inactiveReset = await apiRequest(
      'POST',
      `/api/trade/representatives/${currentActiveRep.id}/reset-password`,
      tradeToken,
      { newPassword: 'AnotherPassword456!' }
    );
    assert(inactiveReset.status === 200, 'Resetting inactive representative returns 200');
    const inactiveUserAfter = await prisma.user.findUnique({ where: { id: currentActiveRep.id } });
    assert(inactiveUserAfter?.isActive === false, 'Resetting password on inactive rep keeps isActive = false');

    // ---------------------------------------------------------
    // 6. TRANSACTIONAL AUDIT INTEGRITY
    // ---------------------------------------------------------
    console.log('\n--- 6. Transactional Audit Integrity ---');
    const latestAudits = await prisma.auditLog.findMany({
      where: {
        action: {
          in: [
            'CREATE_STATION_REPRESENTATIVE',
            'DEACTIVATE_REPRESENTATIVE',
            'ACTIVATE_REPRESENTATIVE',
            'REPLACE_REPRESENTATIVE',
            'REASSIGN_REPRESENTATIVE',
            'RESET_REPRESENTATIVE_PASSWORD',
          ],
        },
      },
      orderBy: { createdAt: 'desc' },
      take: 10,
    });

    assert(latestAudits.length > 0, `Audit log entries exist for representative mutations (found ${latestAudits.length})`);
    for (const log of latestAudits) {
      const detailsStr = typeof log.details === 'string' ? log.details : JSON.stringify(log.details);
      assert(!detailsStr.includes('SuperSecretHardened2026!'), `Audit details do NOT leak plain password (action: ${log.action})`);
      assert(!detailsStr.includes('$2a$') && !detailsStr.includes('$2b$'), `Audit details do NOT leak bcrypt hash (action: ${log.action})`);
    }

    // ---------------------------------------------------------
    // 7. CLEANUP & HISTORICAL DATA INTEGRITY
    // ---------------------------------------------------------
    console.log('\n--- 7. Cleanup & Historical Data Safety ---');
    if (ephemeralUserIds.length > 0) {
      await prisma.user.deleteMany({
        where: { id: { in: ephemeralUserIds } },
      });
      console.log(`  Cleaned up ${ephemeralUserIds.length} ephemeral test accounts.`);
    }

    // Verify production baseline
    const finalStationAdmin = await prisma.user.findFirst({
      where: { username: 'station' },
      include: { fuelStation: true },
    });
    assert(finalStationAdmin?.id === primaryStationAdmin!.id, "CRITICAL: 'station' ID is completely untouched");
    assert(finalStationAdmin?.isActive === true, "CRITICAL: 'station' isActive is true");
    assert(finalStationAdmin?.fuelStation?.code === 'BD-ST-01', "CRITICAL: 'station' is assigned to BD-ST-01");

    const finalTx = await prisma.fuelTransaction.count();
    assert(finalTx === 8, `CRITICAL: All 8 completed fuel transactions remain intact (found ${finalTx})`);

    const finalVerif = await prisma.verificationLog.count();
    assert(finalVerif === 32, `CRITICAL: All 32 verification logs remain intact (found ${finalVerif})`);

    const finalFarmers = await prisma.farmer.count();
    assert(finalFarmers === 20, `CRITICAL: All 20 farmers remain intact (found ${finalFarmers})`);

    const finalStations = await prisma.fuelStation.count();
    assert(finalStations === 22, `CRITICAL: All 22 fuel stations remain intact (found ${finalStations})`);

    console.log('\n========================================================================');
    console.log(`   HARDENING TEST RESULTS: ${passed} PASSED / ${failed} FAILED`);
    console.log('========================================================================\n');

    if (failed > 0) {
      process.exit(1);
    }
  } catch (err) {
    console.error('Hardening test execution error:', err);
    process.exit(1);
  } finally {
    if (server) {
      (server as any).close();
    }
    await prisma.$disconnect();
  }
}

runHardeningTests();
