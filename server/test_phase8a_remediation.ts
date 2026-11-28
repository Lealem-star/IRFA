import 'dotenv/config';
import http from 'http';
import prisma from './src/config/db.js';
import app from './src/app.js';
import jwt from 'jsonwebtoken';
import { UserRole, RequestStatus } from '@prisma/client';
import { sanitizeCsvCell } from './src/controllers/report.controller.js';
import { resetLoginRateLimiter } from './src/middleware/rateLimiter.js';

const JWT_SECRET = process.env.JWT_SECRET || 'irfa_bahir_dar_super_secret_jwt_key_2026_secured';

function makeToken(payload: { userId: string; username: string; role: UserRole; fuelStationId?: string | null }) {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: '1h' });
}

async function runPhase8aTests() {
  console.log('================================================================================');
  console.log('   IRFA / DFCS — PHASE 8A: SECURITY & SAFEGUARD REMEDIATION TEST SUITE           ');
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
  const ephemeralRequestIds: string[] = [];
  const ephemeralHistoryIds: string[] = [];
  const ephemeralTxIds: string[] = [];

  try {
    await prisma.$connect();
    console.log('[Setup] Connected to TiDB database.');

    // Start ephemeral server
    server = app.listen(0);
    const port = (server.address() as any).port;
    const baseUrl = `http://127.0.0.1:${port}`;
    console.log(`[Setup] Ephemeral test server running at ${baseUrl}`);

    // Request helper
    async function request(path: string, options: {
      method?: string;
      body?: any;
      token?: string;
      origin?: string;
      headers?: Record<string, string>;
    } = {}) {
      const headers: Record<string, string> = { ...options.headers };
      if (options.token) headers['Authorization'] = `Bearer ${options.token}`;
      if (options.body) headers['Content-Type'] = 'application/json';
      if (options.origin !== undefined) headers['Origin'] = options.origin;

      const res = await fetch(`${baseUrl}${path}`, {
        method: options.method || 'GET',
        headers,
        body: options.body ? JSON.stringify(options.body) : undefined,
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

    // Retrieve baseline users and stations
    const stations = await prisma.fuelStation.findMany({ orderBy: { code: 'asc' } });
    const st01 = stations.find((s) => s.code === 'BD-ST-01')!;
    const agriUser = await prisma.user.findFirst({ where: { role: UserRole.AGRICULTURE_OFFICE } });
    const tradeUser = await prisma.user.findFirst({ where: { role: UserRole.TRADE_OFFICE } });
    const stationUser = await prisma.user.findFirst({ where: { role: UserRole.STATION_ADMIN, fuelStationId: st01.id } });

    assert(Boolean(agriUser && tradeUser && stationUser), 'Baseline users located');

    const agriToken = makeToken({ userId: agriUser!.id, username: agriUser!.username, role: agriUser!.role });
    const tradeToken = makeToken({ userId: tradeUser!.id, username: tradeUser!.username, role: tradeUser!.role });
    const stationToken = makeToken({
      userId: stationUser!.id,
      username: stationUser!.username,
      role: stationUser!.role,
      fuelStationId: stationUser!.fuelStationId,
    });

    // ========================================================================
    // TEST 1: SEC-02 — CORS RESTRICTIONS & FAIL-CLOSED BEHAVIOR
    // ========================================================================
    console.log('\n--- TEST SUITE 1: SEC-02 CORS Hardening ---');

    // 1.1 Non-browser requests (no Origin header) allowed
    const noOriginRes = await request('/api/health');
    assert(noOriginRes.status === 200, 'Non-browser request (no Origin header) succeeds with HTTP 200');

    // 1.2 Whitelisted development origin allowed
    const allowedOriginRes = await request('/api/health', { origin: 'http://localhost:5173' });
    assert(allowedOriginRes.status === 200, 'Whitelisted origin http://localhost:5173 is permitted with HTTP 200');
    assert(
      allowedOriginRes.headers.get('access-control-allow-origin') === 'http://localhost:5173',
      'CORS returns Access-Control-Allow-Origin matching whitelisted client'
    );

    // 1.3 127.0.0.1:5173 development origin allowed
    const loopbackOriginRes = await request('/api/health', { origin: 'http://127.0.0.1:5173' });
    assert(loopbackOriginRes.status === 200, 'Loopback origin http://127.0.0.1:5173 is permitted with HTTP 200');

    // 1.4 Arbitrary untrusted origin rejected
    const blockedOriginRes = await request('/api/health', { origin: 'https://malicious-attacker-site.com' });
    assert(
      blockedOriginRes.status === 403 || blockedOriginRes.status === 500,
      `Untrusted origin https://malicious-attacker-site.com is blocked (status: ${blockedOriginRes.status})`
    );
    assert(
      !blockedOriginRes.headers.get('access-control-allow-origin'),
      'Blocked origin does NOT receive Access-Control-Allow-Origin header'
    );

    // ========================================================================
    // TEST 2: SEC-03 — LOGIN RATE LIMITING (POST /api/auth/login)
    // ========================================================================
    console.log('\n--- TEST SUITE 2: SEC-03 Login Rate Limiting ---');
    resetLoginRateLimiter();

    // 2.1 First 10 failed login attempts are processed normally (HTTP 401)
    let reachedLimit = false;
    let rateLimitResponse: any = null;

    for (let i = 1; i <= 10; i++) {
      const res = await request('/api/auth/login', {
        method: 'POST',
        body: { username: 'invalid_user', password: 'wrong_password_123' },
        headers: { 'X-Forwarded-For': '192.168.100.50' },
      });
      if (res.status === 429) {
        reachedLimit = true;
        rateLimitResponse = res;
        break;
      }
      assert(res.status === 401, `Login attempt ${i}/10 returns HTTP 401 (Invalid credentials)`);
    }

    assert(!reachedLimit, '10 attempts within window were permitted to reach authentication');

    // 2.2 The 11th attempt MUST be blocked with HTTP 429
    const eleventhRes = await request('/api/auth/login', {
      method: 'POST',
      body: { username: 'invalid_user', password: 'wrong_password_123' },
      headers: { 'X-Forwarded-For': '192.168.100.50' },
    });

    assert(eleventhRes.status === 429, '11th login attempt returns HTTP 429 (Too Many Requests)');
    assert(
      eleventhRes.data?.message?.includes('Too many login attempts'),
      'Rate limit response contains safe user-facing message'
    );
    assert(
      Boolean(eleventhRes.headers.get('retry-after')),
      `Retry-After header is present: ${eleventhRes.headers.get('retry-after')} seconds`
    );

    // 2.3 Distinct IP is NOT affected by another IP's rate limit
    const differentIpRes = await request('/api/auth/login', {
      method: 'POST',
      body: { username: 'invalid_user', password: 'wrong_password_123' },
      headers: { 'X-Forwarded-For': '192.168.100.99' },
    });
    assert(differentIpRes.status === 401, 'Separate client IP (192.168.100.99) is not penalized');

    // 2.4 Rate limiter reset function clears block
    resetLoginRateLimiter();
    const afterResetRes = await request('/api/auth/login', {
      method: 'POST',
      body: { username: 'invalid_user', password: 'wrong_password_123' },
      headers: { 'X-Forwarded-For': '192.168.100.50' },
    });
    assert(afterResetRes.status === 401, 'Resetting rate limiter restores access for previously limited IP');

    // ========================================================================
    // TEST 3: SEC-05 — CSV FORMULA INJECTION PROTECTION
    // ========================================================================
    console.log('\n--- TEST SUITE 3: SEC-05 CSV Formula Injection Protection ---');

    // 3.1 Unit testing formula sanitizer
    assert(sanitizeCsvCell('=SUM(1+1)') === '"\'=SUM(1+1)"', 'Sanitizes leading "=" trigger by prepending single quote');
    assert(sanitizeCsvCell('+251911223344') === '"\'+251911223344"', 'Sanitizes leading "+" trigger');
    assert(sanitizeCsvCell('-cmd|/C calc!A0') === '"\'-cmd|/C calc!A0"', 'Sanitizes leading "-" trigger');
    assert(sanitizeCsvCell('@IMPORT') === '"\'@IMPORT"', 'Sanitizes leading "@" trigger');
    assert(sanitizeCsvCell('\tcalc.exe') === '"\'\tcalc.exe"', 'Sanitizes leading Tab trigger');
    assert(sanitizeCsvCell('Normal Text') === '"Normal Text"', 'Leaves benign text unmodified inside quotes');
    assert(sanitizeCsvCell('Abebe "The Farmer" Bikila') === '"Abebe ""The Farmer"" Bikila"', 'Escapes internal quotes per RFC 4180');
    assert(sanitizeCsvCell(123.45) === '123.45', 'Formats numeric values without quotes');
    assert(sanitizeCsvCell(true) === 'YES', 'Formats boolean true as YES');
    assert(sanitizeCsvCell(false) === 'NO', 'Formats boolean false as NO');
    assert(sanitizeCsvCell(null) === '""', 'Formats null as empty quotes');
    assert(sanitizeCsvCell(undefined) === '""', 'Formats undefined as empty quotes');

    // 3.2 Integration test: Agriculture CSV Export
    const agriCsvRes = await request('/api/reports/export?type=agriculture', { token: agriToken });
    assert(agriCsvRes.status === 200, 'Agriculture CSV export returns HTTP 200');
    assert(agriCsvRes.headers.get('content-type')?.includes('text/csv'), 'Returns Content-Type text/csv');
    assert(agriCsvRes.text.includes('Farmer Code,Full Name'), 'Contains standard CSV header row');

    // Verify no unquoted dangerous formula in lines
    const lines = agriCsvRes.text.split('\r\n');
    let hasUnsafeFormula = false;
    for (const line of lines) {
      if (line.startsWith('=') || line.startsWith('+') || line.startsWith('@')) {
        hasUnsafeFormula = true;
      }
    }
    assert(!hasUnsafeFormula, 'Exported CSV lines contain zero raw unescaped formula triggers');

    // 3.3 Integration test: Trade CSV Export
    const tradeCsvRes = await request('/api/reports/export?type=trade', { token: tradeToken });
    assert(tradeCsvRes.status === 200, 'Trade CSV export returns HTTP 200');
    assert(tradeCsvRes.text.includes('Station Code,Station Name'), 'Trade CSV contains valid headers');

    // 3.4 Integration test: Overview CSV Export
    const overviewCsvRes = await request('/api/reports/export?type=overview', { token: agriToken });
    assert(overviewCsvRes.status === 200, 'Overview CSV export returns HTTP 200');
    assert(overviewCsvRes.text.includes('Station Name,Station Code'), 'Overview CSV contains valid headers');

    // ========================================================================
    // TEST 4: SEC-01 — DISPENSING IDEMPOTENCY REPLAY SAFEGUARD
    // ========================================================================
    console.log('\n--- TEST SUITE 4: SEC-01 Dispensing Idempotency ---');

    // Find an existing transaction from baseline to verify idempotent replay mechanism
    const existingTx = await prisma.fuelTransaction.findFirst({
      orderBy: { transactionDate: 'desc' },
      include: { fuelStation: true },
    });

    assert(Boolean(existingTx), 'Baseline fuel transaction located for idempotency test');

    if (existingTx) {
      // Mock an idempotency key and embed into a temporary test transaction
      const testKey = `test_idemp_${Date.now()}`;
      
      // Update existing transaction notes temporarily with idempotency marker to test replay
      const originalNotes = existingTx.notes;
      await prisma.fuelTransaction.update({
        where: { id: existingTx.id },
        data: { notes: `${originalNotes || ''} [IDEMPOTENCY:${testKey}]`.trim() },
      });

      // Now call dispense endpoint with the same idempotency key and authorization ID
      const replayRes = await request('/api/transactions/dispense', {
        method: 'POST',
        token: stationToken,
        body: {
          authorizationId: existingTx.fuelAuthorizationId,
          quantityLiters: Number(existingTx.quantityLiters),
          notes: 'Duplicate attempt test',
          idempotencyKey: testKey,
        },
      });

      assert(replayRes.status === 200, 'Idempotent replay returns HTTP 200 without error');
      assert(
        replayRes.data?.message?.includes('Idempotent replay'),
        'Response indicates idempotent replay was recognized'
      );
      assert(
        replayRes.data?.receipt?.receiptNumber === existingTx.receiptNumber,
        `Returns identical receipt number (${existingTx.receiptNumber})`
      );

      // Revert the notes on existing transaction to restore original state
      await prisma.fuelTransaction.update({
        where: { id: existingTx.id },
        data: { notes: originalNotes },
      });
      console.log('  [Cleanup] Restored original baseline transaction notes');
    }

    // ========================================================================
    // TEST 5: DAT-04 — FUEL REQUEST HISTORY ON DELETE RESTRICT
    // ========================================================================
    console.log('\n--- TEST SUITE 5: DAT-04 FuelRequestHistory Delete Protection ---');

    // Create an ephemeral FuelRequest and FuelRequestHistory
    const testReqNumber = `REQ-P8A-${Date.now()}`;
    const ephemeralReq = await prisma.fuelRequest.create({
      data: {
        requestNumber: testReqNumber,
        title: 'Phase 8A Delete Restriction Test Request',
        periodMonth: 11,
        periodYear: 2026,
        status: RequestStatus.SUBMITTED,
        submittedById: agriUser!.id,
      },
    });
    ephemeralRequestIds.push(ephemeralReq.id);

    const ephemeralHist = await prisma.fuelRequestHistory.create({
      data: {
        fuelRequestId: ephemeralReq.id,
        action: 'SUBMITTED',
        toStatus: RequestStatus.SUBMITTED,
        actorId: agriUser!.id,
        feedback: 'Test audit history record for DAT-04 verification',
      },
    });
    ephemeralHistoryIds.push(ephemeralHist.id);

    console.log(`  [DAT-04 Test] Created ephemeral FuelRequest (${ephemeralReq.id}) with History (${ephemeralHist.id})`);

    // Attempt to delete FuelRequest directly: it MUST be rejected by the database constraint!
    let deleteFailedAsExpected = false;
    let deleteErrorMessage = '';

    try {
      await prisma.fuelRequest.delete({
        where: { id: ephemeralReq.id },
      });
    } catch (err: any) {
      deleteFailedAsExpected = true;
      deleteErrorMessage = err.message || '';
    }

    assert(
      deleteFailedAsExpected,
      'Direct deletion of FuelRequest with existing history is BLOCKED by foreign key constraint'
    );
    assert(
      deleteErrorMessage.toLowerCase().includes('foreign key') ||
      deleteErrorMessage.toLowerCase().includes('restrict') ||
      deleteErrorMessage.includes('P2003') ||
      deleteErrorMessage.includes('1451'),
      'Error message confirms foreign key / restriction violation'
    );

    // Verify history record still exists in the database
    const historyStillExists = await prisma.fuelRequestHistory.findUnique({
      where: { id: ephemeralHist.id },
    });
    assert(Boolean(historyStillExists), 'FuelRequestHistory record remained safe and intact');

    // Clean up ephemeral test records in reverse order (explicit deletion)
    await prisma.fuelRequestHistory.delete({ where: { id: ephemeralHist.id } });
    await prisma.fuelRequest.delete({ where: { id: ephemeralReq.id } });
    console.log('  [Cleanup] Cleaned up ephemeral request and history records successfully');

    // ========================================================================
    // DATABASE INVARIANT BASELINE VERIFICATION
    // ========================================================================
    console.log('\n--- TEST SUITE 6: Baseline Integrity Preservation ---');

    const [stationCount, farmerCount, txCount, allocCount, subCityAllocCount] = await Promise.all([
      prisma.fuelStation.count(),
      prisma.farmer.count(),
      prisma.fuelTransaction.count(),
      prisma.monthlyAllocation.count(),
      prisma.stationSubCityAssignment.count(),
    ]);

    assert(stationCount === 22, `Preserved 22 fuel stations (actual: ${stationCount})`);
    assert(farmerCount === 20, `Preserved 20 farmers (actual: ${farmerCount})`);
    assert(txCount === 8, `Preserved 8 historical transactions (actual: ${txCount})`);
    assert(allocCount === 5, `Preserved 5 farmer monthly allocations (actual: ${allocCount})`);
    assert(subCityAllocCount === 0, `Preserved 0 station-subcity allocations (actual: ${subCityAllocCount})`);

  } catch (err: any) {
    console.error('UNEXPECTED TEST ERROR:', err);
    failed++;
  } finally {
    // Teardown ephemeral server
    if (server) {
      await new Promise((resolve) => (server as http.Server).close(resolve));
      console.log('[Teardown] Ephemeral test server closed.');
    }
    await prisma.$disconnect();
  }

  console.log('\n================================================================================');
  console.log(`PHASE 8A REMEDIATION TEST SUMMARY: ${passed} PASSED | ${failed} FAILED`);
  console.log('================================================================================\n');

  if (failed > 0) {
    process.exit(1);
  } else {
    process.exit(0);
  }
}

runPhase8aTests();
