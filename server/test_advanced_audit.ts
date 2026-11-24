import prisma from './src/config/db.js';

const API_BASE = 'http://localhost:5000/api';

async function req(path: string, options: RequestInit = {}) {
  const res = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(options.headers || {}),
    },
  });
  const data = await res.json().catch(() => null);
  return { status: res.status, ok: res.ok, data };
}

async function runAdvancedAudit() {
  console.log('=== Running Advanced Acceptance & Concurrency Tests ===\n');

  let passed = 0;
  let failed = 0;

  const assert = (condition: boolean, testName: string) => {
    if (condition) {
      console.log(`  [PASS] ${testName}`);
      passed++;
    } else {
      console.error(`  [FAIL] ${testName}`);
      failed++;
    }
  };

  try {
    // 1. Database Table Count & Prisma Model Consistency
    console.log('1. Database Table Count & Schema Consistency');
    const tables: any[] = await prisma.$queryRaw`SHOW TABLES;`;
    const tableNames = tables.map((t) => Object.values(t)[0]);
    console.log(`  Discovered ${tableNames.length} tables in MySQL:`, tableNames.join(', '));
    assert(tableNames.includes('farmers'), 'Table "farmers" exists in MySQL');
    assert(tableNames.includes('fuel_authorizations'), 'Table "fuel_authorizations" exists in MySQL');
    assert(tableNames.includes('fuel_transactions'), 'Table "fuel_transactions" exists in MySQL');
    assert(tableNames.includes('station_assignments'), 'Table "station_assignments" exists in MySQL');
    assert(tableNames.includes('audit_logs'), 'Table "audit_logs" exists in MySQL');
    assert(tableNames.length >= 17, `All 17 Prisma models mapped to MySQL physical tables (Count: ${tableNames.length})`);

    // 2. Authentication Tokens
    const loginAgri = await req('/auth/login', { method: 'POST', body: JSON.stringify({ username: 'agriculture', password: 'demo123' }) });
    const tokenAgri = loginAgri.data.token;
    const loginStationA = await req('/auth/login', { method: 'POST', body: JSON.stringify({ username: 'station', password: 'demo123' }) });
    const tokenStationA = loginStationA.data.token;
    const loginAdmin = await req('/auth/login', { method: 'POST', body: JSON.stringify({ username: 'admin', password: 'demo123' }) });
    const tokenAdmin = loginAdmin.data.token;
    const loginTrade = await req('/auth/login', { method: 'POST', body: JSON.stringify({ username: 'trade', password: 'demo123' }) });
    const tokenTrade = loginTrade.data.token;

    // 3. Security & Operational Lockdown for SYSTEM_ADMIN (All 6 operational endpoints)
    console.log('\n2. SYSTEM_ADMIN Operational Lockdown Verification (Refinement 2)');
    const adminEndpoints = [
      { method: 'POST', path: '/farmers', body: { fullName: 'Hacker' }, name: 'Admin cannot register farmer' },
      { method: 'POST', path: '/allocations', body: { allocatedLiters: 100 }, name: 'Admin cannot create allocation' },
      { method: 'POST', path: '/fuel-requests', body: { title: 'Illegal' }, name: 'Admin cannot submit fuel request' },
      { method: 'POST', path: '/trade/review-request/test', body: { status: 'APPROVED' }, name: 'Admin cannot approve request' },
      { method: 'POST', path: '/trade/assign-station', body: { stationId: '1' }, name: 'Admin cannot assign station' },
      { method: 'POST', path: '/verification/verify', body: { qrTokenOrCode: 'FR-00124' }, name: 'Admin cannot scan/verify QR' },
      { method: 'POST', path: '/transactions/dispense', body: { quantityLiters: 10 }, name: 'Admin cannot dispense fuel' },
    ];

    for (const ep of adminEndpoints) {
      const res = await req(ep.path, {
        method: ep.method,
        headers: { Authorization: `Bearer ${tokenAdmin}` },
        body: JSON.stringify(ep.body),
      });
      assert(res.status === 403, `${ep.name} -> HTTP 403 Forbidden`);
    }

    // 4. Station Isolation Test: Station Operator attempting to access unassigned farmer
    console.log('\n3. Station Isolation & Cross-Station Security (Refinement 8)');
    // Let's create an authorization assigned to Station B (Abay Petroleum), then verify with Station A operator
    const stationB = await prisma.fuelStation.findFirst({ where: { code: 'BD-ST-02' } });
    const diesel = await prisma.fuelType.findFirst({ where: { code: 'DIESEL' } });
    const testFarmerB = await prisma.farmer.create({
      data: {
        farmerCode: `FR-ISO-${Date.now().toString().slice(-4)}`,
        fullName: 'Abay Shore Farmer',
        phone: '+251 918 000 777',
        kebeleId: (await prisma.kebele.findFirst())!.id,
        eligibilityStatus: 'ELIGIBLE',
        isActive: true,
        cards: {
          create: {
            cardSerialNumber: `BD-CARD-ISO-${Date.now().toString().slice(-4)}`,
            qrToken: `QR-ISO-${Date.now().toString().slice(-6)}`,
            status: 'ACTIVE',
          },
        },
      },
      include: { cards: true },
    });

    const testReqB = await prisma.fuelRequest.create({
      data: {
        requestNumber: `TR-ISO-${Date.now().toString().slice(-4)}`,
        periodMonth: 11,
        periodYear: 2026,
        title: 'Station B Isolated Request',
        submittedById: loginAgri.data.user.id,
        status: 'APPROVED',
      },
    });

    const testItemB = await prisma.fuelRequestItem.create({
      data: {
        fuelRequestId: testReqB.id,
        farmerId: testFarmerB.id,
        fuelTypeId: diesel!.id,
        requestedLiters: 100,
        approvedLiters: 100,
        itemStatus: 'APPROVED',
      },
    });

    const testAuthB = await prisma.fuelAuthorization.create({
      data: {
        authCode: `AUTH-ISO-${Date.now().toString().slice(-5)}`,
        fuelRequestId: testReqB.id,
        fuelRequestItemId: testItemB.id,
        farmerId: testFarmerB.id,
        fuelTypeId: diesel!.id,
        authorizedLiters: 100,
        remainingLiters: 100,
        validFrom: new Date('2026-11-01'),
        validTo: new Date('2026-11-30'),
        status: 'ACTIVE',
      },
    });

    // Assign to Station B ONLY
    await prisma.stationAssignment.create({
      data: {
        fuelAuthorizationId: testAuthB.id,
        fuelStationId: stationB!.id,
        assignedById: loginTrade.data.user.id,
        status: 'ACTIVE',
      },
    });

    // Now Station A attempts to verify this farmer
    const crossStationVerify = await req('/verification/verify', {
      method: 'POST',
      headers: { Authorization: `Bearer ${tokenStationA}` },
      body: JSON.stringify({ qrTokenOrCode: testFarmerB.cards[0].qrToken }),
    });

    assert(
      crossStationVerify.status === 403 && crossStationVerify.data.rejectionReason.includes('Station Mismatch'),
      'Station A blocked from verifying Station B authorization ("Station Mismatch" 403)'
    );

    // 5. Concurrency & Race Condition Test (Simultaneous Dispensing Requests)
    console.log('\n4. Atomic Dispensing & Concurrency Safety Test (Refinement 6)');
    // Let's create an authorization with 100 L remaining assigned to Station A
    const stationA = await prisma.fuelStation.findFirst({ where: { code: 'BD-ST-01' } });
    const concFarmer = await prisma.farmer.create({
      data: {
        farmerCode: `FR-CONC-${Date.now().toString().slice(-4)}`,
        fullName: 'Concurrency Test Farmer',
        phone: '+251 918 111 888',
        kebeleId: (await prisma.kebele.findFirst())!.id,
        eligibilityStatus: 'ELIGIBLE',
        isActive: true,
      },
    });

    const concAuth = await prisma.fuelAuthorization.create({
      data: {
        authCode: `AUTH-CONC-${Date.now().toString().slice(-5)}`,
        fuelRequestId: testReqB.id,
        fuelRequestItemId: (await prisma.fuelRequestItem.create({
          data: {
            fuelRequestId: testReqB.id,
            farmerId: concFarmer.id,
            fuelTypeId: diesel!.id,
            requestedLiters: 100,
            approvedLiters: 100,
            itemStatus: 'APPROVED',
          },
        })).id,
        farmerId: concFarmer.id,
        fuelTypeId: diesel!.id,
        authorizedLiters: 100,
        consumedLiters: 0,
        remainingLiters: 100,
        validFrom: new Date('2026-11-01'),
        validTo: new Date('2026-11-30'),
        status: 'ACTIVE',
      },
    });

    await prisma.stationAssignment.create({
      data: {
        fuelAuthorizationId: concAuth.id,
        fuelStationId: stationA!.id,
        assignedById: loginTrade.data.user.id,
        status: 'ACTIVE',
      },
    });

    // Now fire 5 SIMULTANEOUS dispensing requests of 30 Liters each. Total attempted: 150 L, available: 100 L.
    console.log('  Firing 5 simultaneous dispensing requests of 30 L each (Total 150 L on 100 L quota)...');
    const concurrentRequests = Array.from({ length: 5 }).map((_, i) =>
      req('/transactions/dispense', {
        method: 'POST',
        headers: { Authorization: `Bearer ${tokenStationA}` },
        body: JSON.stringify({
          authorizationId: concAuth.id,
          quantityLiters: 30,
          notes: `Concurrent burst #${i + 1}`,
        }),
      })
    );

    const burstResults = await Promise.all(concurrentRequests);
    const successfulBursts = burstResults.filter((r) => r.status === 201);
    const rejectedBursts = burstResults.filter((r) => r.status === 400);

    console.log(`  Successful bursts: ${successfulBursts.length}, Blocked bursts: ${rejectedBursts.length}`);
    assert(successfulBursts.length === 3, 'Exactly 3 bursts succeeded (3 x 30L = 90L <= 100L)');
    assert(rejectedBursts.length === 2, 'Exactly 2 bursts were blocked due to insufficient balance');

    // Verify DB state
    const finalAuth = await prisma.fuelAuthorization.findUnique({ where: { id: concAuth.id } });
    assert(Number(finalAuth?.consumedLiters) === 90, 'Database consumedLiters is strictly 90 L');
    assert(Number(finalAuth?.remainingLiters) === 10, 'Database remainingLiters is strictly 10 L (Never negative!)');

    // 6. Security & Secret Exposure Check
    console.log('\n5. Frontend Secret Scanning (Refinement 5 & Security)');
    // Verify client bundle does not contain DATABASE_URL or JWT_SECRET
    const clientBundlePath = 'c:/Users/1234/Desktop/IRFA/client/dist/assets';
    const fs = await import('fs');
    const path = await import('path');
    const files = fs.readdirSync(clientBundlePath);
    let secretFound = false;
    for (const f of files) {
      if (f.endsWith('.js')) {
        const content = fs.readFileSync(path.join(clientBundlePath, f), 'utf-8');
        if (content.includes('irfa_bahir_dar_super_secret') || content.includes('DATABASE_URL')) {
          secretFound = true;
        }
      }
    }
    assert(!secretFound, 'Client bundle contains ZERO server secrets or database connection strings');

  } catch (error: any) {
    console.error('Advanced audit fatal error:', error);
    failed++;
  }

  console.log(`\n=== Advanced Audit Summary: ${passed} PASSED, ${failed} FAILED ===`);
  if (failed > 0) process.exit(1);
}

runAdvancedAudit();
