const API_BASE = 'http://localhost:5000/api';

async function runTests() {
  console.log('=== Starting IRFA End-to-End System Verification ===\n');

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

  const req = async (path: string, options: RequestInit = {}) => {
    const res = await fetch(`${API_BASE}${path}`, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        ...(options.headers || {}),
      },
    });
    const data = await res.json().catch(() => null);
    return { status: res.status, ok: res.ok, data };
  };

  try {
    // 1. Health Endpoint
    console.log('1. Health Check');
    const health = await req('/health');
    assert(health.status === 200, 'Health endpoint HTTP 200');
    assert(health.data.administration.includes('Bahir Dar'), 'Administration is Bahir Dar City');

    // 2. Authentication for 4 Roles
    console.log('\n2. Authentication & JWT Issuance');
    const loginAgri = await req('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ username: 'agriculture', password: 'demo123' }),
    });
    assert(loginAgri.status === 200 && loginAgri.data.user.role === 'AGRICULTURE_OFFICE', 'Login Agriculture Office (role: AGRICULTURE_OFFICE)');
    const tokenAgri = loginAgri.data.token;

    const loginTrade = await req('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ username: 'trade', password: 'demo123' }),
    });
    assert(loginTrade.status === 200 && loginTrade.data.user.role === 'TRADE_OFFICE', 'Login Trade Office (role: TRADE_OFFICE)');
    const tokenTrade = loginTrade.data.token;

    const loginStation = await req('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ username: 'station', password: 'demo123' }),
    });
    assert(loginStation.status === 200 && loginStation.data.user.role === 'STATION_ADMIN', 'Login Fuel Station (role: STATION_ADMIN)');
    const tokenStation = loginStation.data.token;

    const loginAdmin = await req('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ username: 'admin', password: 'demo123' }),
    });
    assert(loginAdmin.status === 200 && loginAdmin.data.user.role === 'SYSTEM_ADMIN', 'Login System Admin (role: SYSTEM_ADMIN)');
    const tokenAdmin = loginAdmin.data.token;

    // Bad Password Test
    const badLogin = await req('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ username: 'admin', password: 'wrongpassword' }),
    });
    assert(badLogin.status === 401, 'Bad credentials correctly returns 401 Unauthorized');

    // 3. RBAC Strict Boundaries Test
    console.log('\n3. Strict Role-Based Access Control (RBAC) Boundaries');
    const adminBlocked = await req('/farmers', {
      method: 'POST',
      headers: { Authorization: `Bearer ${tokenAdmin}` },
      body: JSON.stringify({ fullName: 'Unauthorized Test' }),
    });
    assert(adminBlocked.status === 403, 'System Administrator blocked from operational endpoints (403 Forbidden)');

    const agriBlocked = await req('/trade/review-request/some-id', {
      method: 'POST',
      headers: { Authorization: `Bearer ${tokenAgri}` },
      body: JSON.stringify({ status: 'APPROVED' }),
    });
    assert(agriBlocked.status === 403, 'Agriculture Office blocked from Trade review endpoint (403 Forbidden)');

    // 4. Dashboards per Role
    console.log('\n4. Role-Specific Dashboards');
    const dashAgri = await req('/dashboard/stats', { headers: { Authorization: `Bearer ${tokenAgri}` } });
    assert(dashAgri.data.role === 'agriculture' && dashAgri.data.stats.length === 4, 'Agriculture dashboard returns 4 metric cards');

    const dashTrade = await req('/dashboard/stats', { headers: { Authorization: `Bearer ${tokenTrade}` } });
    assert(dashTrade.data.role === 'trade' && dashTrade.data.stats.length === 4, 'Trade dashboard returns 4 metric cards');

    const dashStation = await req('/dashboard/stats', { headers: { Authorization: `Bearer ${tokenStation}` } });
    assert(dashStation.data.role === 'station' && dashStation.data.stats.length === 4, 'Station dashboard returns 4 metric cards');

    const dashAdmin = await req('/dashboard/stats', { headers: { Authorization: `Bearer ${tokenAdmin}` } });
    assert(dashAdmin.data.role === 'sysadmin' && dashAdmin.data.stats.length === 4, 'Admin dashboard returns 4 metric cards');

    // 5. Full Operational Lifecycle
    console.log('\n5. Operational Lifecycle Workflow Test');
    
    // Step A: Metadata
    const kebelesRes = await req('/meta/kebeles', { headers: { Authorization: `Bearer ${tokenAgri}` } });
    const kebeleId = kebelesRes.data.kebeles[0].id;
    const fuelTypesRes = await req('/meta/fuel-types', { headers: { Authorization: `Bearer ${tokenAgri}` } });
    const dieselType = fuelTypesRes.data.fuelTypes.find((f: any) => f.code === 'DIESEL');

    // Step B: Register Farmer
    const farmerRes = await req('/farmers', {
      method: 'POST',
      headers: { Authorization: `Bearer ${tokenAgri}` },
      body: JSON.stringify({
        fullName: 'Dawit Mengesha',
        phone: '+251 918 999 111',
        nationalId: `ETH-BD-TEST-${Date.now().toString().slice(-4)}`,
        kebeleId,
        landSizeHectares: 3.0,
        waterSource: 'LAKE_TANA',
        pumpFuelType: 'Diesel',
        pumpHorsepower: '12 HP',
        primaryCrops: 'Onion, Pepper',
      }),
    });
    assert(farmerRes.status === 201 && farmerRes.data.farmer.farmerCode.startsWith('FR-'), `Registered farmer with ID: ${farmerRes.data.farmer.farmerCode}`);
    const newFarmer = farmerRes.data.farmer;

    // Step C: Create Monthly Allocation
    const allocRes = await req('/allocations', {
      method: 'POST',
      headers: { Authorization: `Bearer ${tokenAgri}` },
      body: JSON.stringify({
        farmerId: newFarmer.id,
        fuelTypeId: dieselType.id,
        month: 11,
        year: 2026,
        allocatedLiters: 160,
        notes: 'Monthly dry season irrigation allocation',
      }),
    });
    assert(allocRes.status === 201 && Number(allocRes.data.allocation.allocatedLiters) === 160, 'Monthly fuel allocation created (160 L Diesel)');

    // Step D: Submit Request to Trade
    const reqRes = await req('/fuel-requests', {
      method: 'POST',
      headers: { Authorization: `Bearer ${tokenAgri}` },
      body: JSON.stringify({
        title: 'Tana Perimeter Automated Test Batch',
        periodMonth: 11,
        periodYear: 2026,
        items: [
          {
            farmerId: newFarmer.id,
            fuelTypeId: dieselType.id,
            requestedLiters: 160,
          },
        ],
      }),
    });
    assert(reqRes.status === 201 && reqRes.data.request.requestNumber.startsWith('TR-'), `Submitted fuel request: ${reqRes.data.request.requestNumber}`);
    const fuelReq = reqRes.data.request;

    // Step E: Trade Reviews and Approves Request
    const reviewRes = await req(`/trade/review-request/${fuelReq.id}`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${tokenTrade}` },
      body: JSON.stringify({
        status: 'APPROVED',
        reviewRemarks: 'Fully approved by Trade officer',
      }),
    });
    assert(reviewRes.status === 200 && reviewRes.data.request.status === 'APPROVED', 'Trade reviewed and APPROVED request');

    // Fetch newly provisioned FuelAuthorization
    const authListRes = await req(`/trade/authorizations?search=${newFarmer.farmerCode}`, {
      headers: { Authorization: `Bearer ${tokenTrade}` },
    });
    const newAuth = authListRes.data.data.find((a: any) => a.farmerId === newFarmer.id);
    assert(newAuth && Number(newAuth.authorizedLiters) === 160, `FuelAuthorization record generated: ${newAuth?.authCode}`);

    // Step F: Trade Assigns Station A to Authorization
    const stationsRes = await req('/meta/stations', { headers: { Authorization: `Bearer ${tokenTrade}` } });
    const stationA = stationsRes.data.stations.find((s: any) => s.code === 'BD-ST-01');

    const assignRes = await req('/trade/assign-station', {
      method: 'POST',
      headers: { Authorization: `Bearer ${tokenTrade}` },
      body: JSON.stringify({
        authorizationId: newAuth.id,
        fuelStationId: stationA.id,
        notes: 'Assigned to Tana Station for automated test verification',
      }),
    });
    assert(assignRes.status === 200 && assignRes.data.assignment.status === 'ACTIVE', `Assigned authorization to station: ${stationA.name}`);

    // Step G: QR Verification at Station
    const activeCard = newFarmer.cards[0];
    const verifyRes = await req('/verification/verify', {
      method: 'POST',
      headers: { Authorization: `Bearer ${tokenStation}` },
      body: JSON.stringify({ qrTokenOrCode: activeCard.qrToken }),
    });
    assert(verifyRes.status === 200 && verifyRes.data.verified === true, '8-Step live QR verification succeeded (VERIFIED)');
    assert(Number(verifyRes.data.data.authorization.remainingLiters) === 160, 'Verified remaining balance is 160 L');

    // Step H: Fuel Dispensing (Atomic Transaction)
    const dispenseRes = await req('/transactions/dispense', {
      method: 'POST',
      headers: { Authorization: `Bearer ${tokenStation}` },
      body: JSON.stringify({
        authorizationId: newAuth.id,
        quantityLiters: 60,
        notes: 'Test dispensing 60 Liters into drums',
      }),
    });
    assert(dispenseRes.status === 201 && dispenseRes.data.receipt.receiptNumber.startsWith('TX-'), `Dispensed 60 L. Generated Receipt #${dispenseRes.data.receipt.receiptNumber}`);
    assert(dispenseRes.data.remainingBalance === 100, 'Remaining balance accurately decremented to 100 L');

    // Step I: Overdispensing Protection Check
    const overdispenseRes = await req('/transactions/dispense', {
      method: 'POST',
      headers: { Authorization: `Bearer ${tokenStation}` },
      body: JSON.stringify({
        authorizationId: newAuth.id,
        quantityLiters: 150, // exceeds remaining 100
      }),
    });
    assert(overdispenseRes.status === 400 && overdispenseRes.data.message.includes('exceeds'), 'Overdispensing accurately BLOCKED by atomic guard (400 Bad Request)');

    // Step J: Suspended Farmer Verification Check
    const suspendedRes = await req('/verification/verify', {
      method: 'POST',
      headers: { Authorization: `Bearer ${tokenStation}` },
      body: JSON.stringify({ qrTokenOrCode: 'FR-00127' }), // Known suspended farmer Kassahun Alemu
    });
    assert(suspendedRes.status === 403 && suspendedRes.data.rejectionReason.includes('inactive'), 'Suspended farmer verification correctly REJECTED with 403 reason');

  } catch (error: any) {
    console.error('Test execution fatal error:', error);
    failed++;
  }

  console.log(`\n=== Verification Summary: ${passed} PASSED, ${failed} FAILED ===`);
  if (failed > 0) process.exit(1);
}

runTests();
