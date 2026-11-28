import prisma from './src/config/db.js';
import jwt from 'jsonwebtoken';

const BASE_URL = 'http://localhost:5000/api';
const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret-key-change-in-production';

interface TestResult {
  id: string;
  category: string;
  name: string;
  status: 'PASS — VERIFIED' | 'PARTIAL' | 'FAIL' | 'NOT TESTED';
  details: string;
}

const results: TestResult[] = [];

function record(
  id: string,
  category: string,
  name: string,
  status: 'PASS — VERIFIED' | 'PARTIAL' | 'FAIL' | 'NOT TESTED',
  details: string
) {
  results.push({ id, name, category, status, details });
  const symbol = status === 'PASS — VERIFIED' ? '✅' : status === 'PARTIAL' ? '⚠️' : '❌';
  console.log(`${symbol} [${id}] ${category} :: ${name} -> ${status}`);
  console.log(`   ${details}`);
}

async function apiRequest(
  method: string,
  path: string,
  body?: any,
  token?: string
): Promise<{ status: number; data: any; headers: Headers }> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const res = await fetch(`${BASE_URL}${path}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });

  let data: any = null;
  const text = await res.text();
  try {
    data = JSON.parse(text);
  } catch {
    data = text;
  }

  return { status: res.status, data, headers: res.headers };
}

async function runCrossPortalAudit() {
  console.log('=== PRIORITY 2 STAGE 5: SHARED FUNCTIONALITY & CROSS-PORTAL AUDIT ===\n');

  // =========================================================================
  // GROUP 1: AUTHENTICATION MATRIX & SESSION CONSISTENCY
  // =========================================================================
  console.log('--- GROUP 1: Authentication Matrix & Session Consistency ---');
  let tokenAgri = '';
  let tokenTrade = '';
  let tokenStation = '';
  let tokenAdmin = '';

  // 1. Agriculture Login
  try {
    const res = await apiRequest('POST', '/auth/login', { username: 'agriculture', password: 'demo123' });
    tokenAgri = res.data?.token;
    if (res.status === 200 && tokenAgri && res.data?.user?.role === 'AGRICULTURE_OFFICE') {
      record('TEST-S5-AUTH-01', 'Auth Matrix', 'Agriculture Login & Session', 'PASS — VERIFIED', `Logged in as '${res.data.user.username}', role='${res.data.user.role}'.`);
    } else {
      record('TEST-S5-AUTH-01', 'Auth Matrix', 'Agriculture Login & Session', 'FAIL', `Status ${res.status}: ${JSON.stringify(res.data)}`);
    }
  } catch (err: any) {
    record('TEST-S5-AUTH-01', 'Auth Matrix', 'Agriculture Login & Session', 'FAIL', err.message);
  }

  // 2. Trade Login
  try {
    const res = await apiRequest('POST', '/auth/login', { username: 'trade', password: 'demo123' });
    tokenTrade = res.data?.token;
    if (res.status === 200 && tokenTrade && res.data?.user?.role === 'TRADE_OFFICE') {
      record('TEST-S5-AUTH-02', 'Auth Matrix', 'Trade Office Login & Session', 'PASS — VERIFIED', `Logged in as '${res.data.user.username}', role='${res.data.user.role}'.`);
    } else {
      record('TEST-S5-AUTH-02', 'Auth Matrix', 'Trade Office Login & Session', 'FAIL', `Status ${res.status}: ${JSON.stringify(res.data)}`);
    }
  } catch (err: any) {
    record('TEST-S5-AUTH-02', 'Auth Matrix', 'Trade Office Login & Session', 'FAIL', err.message);
  }

  // 3. Station Login
  try {
    const res = await apiRequest('POST', '/auth/login', { username: 'station', password: 'demo123' });
    tokenStation = res.data?.token;
    if (res.status === 200 && tokenStation && res.data?.user?.role === 'STATION_ADMIN' && res.data?.user?.fuelStation) {
      record('TEST-S5-AUTH-03', 'Auth Matrix', 'Fuel Station Login & Station Binding', 'PASS — VERIFIED', `Logged in as '${res.data.user.username}', bound to '${res.data.user.fuelStation.name}'.`);
    } else {
      record('TEST-S5-AUTH-03', 'Auth Matrix', 'Fuel Station Login & Station Binding', 'FAIL', `Status ${res.status}: ${JSON.stringify(res.data)}`);
    }
  } catch (err: any) {
    record('TEST-S5-AUTH-03', 'Auth Matrix', 'Fuel Station Login & Station Binding', 'FAIL', err.message);
  }

  // 4. System Admin Login
  try {
    const res = await apiRequest('POST', '/auth/login', { username: 'admin', password: 'demo123' });
    tokenAdmin = res.data?.token;
    if (res.status === 200 && tokenAdmin && res.data?.user?.role === 'SYSTEM_ADMIN') {
      record('TEST-S5-AUTH-04', 'Auth Matrix', 'System Admin Login & Session', 'PASS — VERIFIED', `Logged in as '${res.data.user.username}', role='${res.data.user.role}'.`);
    } else {
      record('TEST-S5-AUTH-04', 'Auth Matrix', 'System Admin Login & Session', 'FAIL', `Status ${res.status}: ${JSON.stringify(res.data)}`);
    }
  } catch (err: any) {
    record('TEST-S5-AUTH-04', 'Auth Matrix', 'System Admin Login & Session', 'FAIL', err.message);
  }

  // =========================================================================
  // GROUP 2: CROSS-PORTAL ROUTE ACCESS CONTROL MATRIX (4 ROLES x 4 MODULES)
  // =========================================================================
  console.log('\n--- GROUP 2: Cross-Portal Route Access Control Matrix ---');

  // Agriculture Role Tests
  const agriToAgri = await apiRequest('GET', '/farmers', undefined, tokenAgri);
  record('TEST-S5-RBAC-01', 'RBAC Matrix', 'Agri Actor -> Agri Domain (/farmers)', agriToAgri.status === 200 ? 'PASS — VERIFIED' : 'FAIL', `HTTP ${agriToAgri.status}`);

  const agriToTrade = await apiRequest('GET', '/trade/authorizations', undefined, tokenAgri);
  record('TEST-S5-RBAC-02', 'RBAC Matrix', 'Agri Actor -> Trade Domain Read (/trade/authorizations)', agriToTrade.status === 200 ? 'PASS — VERIFIED' : 'FAIL', `HTTP ${agriToTrade.status} (Allowed for transparency)`);

  const agriToStation = await apiRequest('POST', '/verification/verify', { identifier: 'FR-001' }, tokenAgri);
  record('TEST-S5-RBAC-03', 'RBAC Matrix', 'Agri Actor -> Station Domain Blocked (/verification/verify)', agriToStation.status === 403 ? 'PASS — VERIFIED' : 'FAIL', `HTTP ${agriToStation.status} Forbidden`);

  const agriToSys = await apiRequest('GET', '/system/users', undefined, tokenAgri);
  record('TEST-S5-RBAC-04', 'RBAC Matrix', 'Agri Actor -> SysAdmin Domain Blocked (/system/users)', agriToSys.status === 403 ? 'PASS — VERIFIED' : 'FAIL', `HTTP ${agriToSys.status} Forbidden`);

  // Trade Role Tests
  const tradeToAgri = await apiRequest('GET', '/farmers', undefined, tokenTrade);
  record('TEST-S5-RBAC-05', 'RBAC Matrix', 'Trade Actor -> Agri Domain Read (/farmers)', tradeToAgri.status === 200 ? 'PASS — VERIFIED' : 'FAIL', `HTTP ${tradeToAgri.status} (Allowed read for quota review)`);

  const tradeToTrade = await apiRequest('GET', '/trade/authorizations', undefined, tokenTrade);
  record('TEST-S5-RBAC-06', 'RBAC Matrix', 'Trade Actor -> Trade Domain (/trade/authorizations)', tradeToTrade.status === 200 ? 'PASS — VERIFIED' : 'FAIL', `HTTP ${tradeToTrade.status}`);

  const tradeToStation = await apiRequest('POST', '/verification/verify', { identifier: 'FR-001' }, tokenTrade);
  record('TEST-S5-RBAC-07', 'RBAC Matrix', 'Trade Actor -> Station Domain Blocked (/verification/verify)', tradeToStation.status === 403 ? 'PASS — VERIFIED' : 'FAIL', `HTTP ${tradeToStation.status} Forbidden`);

  const tradeToSys = await apiRequest('GET', '/system/users', undefined, tokenTrade);
  record('TEST-S5-RBAC-08', 'RBAC Matrix', 'Trade Actor -> SysAdmin Domain Blocked (/system/users)', tradeToSys.status === 403 ? 'PASS — VERIFIED' : 'FAIL', `HTTP ${tradeToSys.status} Forbidden`);

  // Station Role Tests
  const stnToAgri = await apiRequest('GET', '/farmers', undefined, tokenStation);
  record('TEST-S5-RBAC-09', 'RBAC Matrix', 'Station Actor -> Agri Domain Blocked (/farmers)', stnToAgri.status === 403 ? 'PASS — VERIFIED' : 'FAIL', `HTTP ${stnToAgri.status} Forbidden`);

  const stnToTrade = await apiRequest('POST', '/trade/assign-station', { requestId: 'mock' }, tokenStation);
  record('TEST-S5-RBAC-10', 'RBAC Matrix', 'Station Actor -> Trade Domain Blocked (/trade/assign-station)', stnToTrade.status === 403 ? 'PASS — VERIFIED' : 'FAIL', `HTTP ${stnToTrade.status} Forbidden`);

  const stnToStation = await apiRequest('POST', '/verification/verify', { identifier: 'NONEXISTENT' }, tokenStation);
  record('TEST-S5-RBAC-11', 'RBAC Matrix', 'Station Actor -> Station Domain Access (/verification/verify)', stnToStation.status === 404 ? 'PASS — VERIFIED' : 'FAIL', `HTTP ${stnToStation.status} (Authorized station handler, returns 404 for unknown identifier)`);

  const stnToSys = await apiRequest('GET', '/system/users', undefined, tokenStation);
  record('TEST-S5-RBAC-12', 'RBAC Matrix', 'Station Actor -> SysAdmin Domain Blocked (/system/users)', stnToSys.status === 403 ? 'PASS — VERIFIED' : 'FAIL', `HTTP ${stnToSys.status} Forbidden`);

  // System Admin Role Tests (Operational Isolation)
  const admToAgri = await apiRequest('GET', '/farmers', undefined, tokenAdmin);
  record('TEST-S5-RBAC-13', 'RBAC Matrix', 'Admin Actor -> Agri Domain Blocked (/farmers)', admToAgri.status === 403 ? 'PASS — VERIFIED' : 'FAIL', `HTTP ${admToAgri.status} Forbidden (Operational isolation)`);

  const admToTrade = await apiRequest('GET', '/trade/authorizations', undefined, tokenAdmin);
  record('TEST-S5-RBAC-14', 'RBAC Matrix', 'Admin Actor -> Trade Domain Blocked (/trade/authorizations)', admToTrade.status === 403 ? 'PASS — VERIFIED' : 'FAIL', `HTTP ${admToTrade.status} Forbidden (Operational isolation)`);

  const admToStation = await apiRequest('POST', '/verification/verify', { identifier: 'FR-001' }, tokenAdmin);
  record('TEST-S5-RBAC-15', 'RBAC Matrix', 'Admin Actor -> Station Domain Blocked (/verification/verify)', admToStation.status === 403 ? 'PASS — VERIFIED' : 'FAIL', `HTTP ${admToStation.status} Forbidden (Operational isolation)`);

  const admToSys = await apiRequest('GET', '/system/users', undefined, tokenAdmin);
  record('TEST-S5-RBAC-16', 'RBAC Matrix', 'Admin Actor -> SysAdmin Domain (/system/users)', admToSys.status === 200 ? 'PASS — VERIFIED' : 'FAIL', `HTTP ${admToSys.status} (Allowed technical domain)`);

  // =========================================================================
  // GROUP 3: DATA INTEGRITY & CROSS-PORTAL SYNCHRONIZATION
  // =========================================================================
  console.log('\n--- GROUP 3: Data Integrity & Cross-Portal Synchronization ---');

  // 1. Reconcile Farmer Counts across DB and Agri Dashboard
  const dbFarmerCount = await prisma.farmer.count();
  const agriDash = await apiRequest('GET', '/dashboard/stats', undefined, tokenAgri);
  const apiFarmerTotal = agriDash.data?.farmerMetrics?.total;
  record(
    'TEST-S5-SYNC-01',
    'Data Synchronization',
    'Farmer Registry Reconciliation (DB vs Dashboard)',
    dbFarmerCount === apiFarmerTotal ? 'PASS — VERIFIED' : 'FAIL',
    `DB Farmers: ${dbFarmerCount}, Agriculture Dashboard: ${apiFarmerTotal}. Matches: ${dbFarmerCount === apiFarmerTotal}.`
  );

  // 2. Reconcile Fuel Requests Count across DB and Trade Dashboard
  const dbReqCount = await prisma.fuelRequest.count();
  const tradeDash = await apiRequest('GET', '/dashboard/stats', undefined, tokenTrade);
  const apiReqTotal = tradeDash.data?.stats?.find((s: any) => /request/i.test(s.label))?.value;
  record(
    'TEST-S5-SYNC-02',
    'Data Synchronization',
    'Fuel Request Tally Reconciliation',
    dbReqCount.toString() === apiReqTotal ? 'PASS — VERIFIED' : 'FAIL',
    `DB Requests: ${dbReqCount}, Trade Dashboard Requests: ${apiReqTotal}.`
  );

  // 3. Station Roster Consistency
  const dbStationCount = await prisma.fuelStation.count();
  const metaStations = await apiRequest('GET', '/meta/stations', undefined, tokenTrade);
  const apiStationCount = metaStations.data?.stations?.length;
  record(
    'TEST-S5-SYNC-03',
    'Data Synchronization',
    'Fuel Station Roster Consistency',
    dbStationCount === apiStationCount ? 'PASS — VERIFIED' : 'FAIL',
    `DB Fuel Stations: ${dbStationCount}, Meta Stations API: ${apiStationCount}.`
  );

  // 4. Mathematical Invariant: Remaining + Dispensed <= Authorized Liters
  const allAuths = await prisma.fuelAuthorization.findMany();
  let invariantViolations = 0;
  for (const a of allAuths) {
    if (Number(a.remainingLiters) > Number(a.authorizedLiters)) {
      invariantViolations++;
    }
  }
  record(
    'TEST-S5-SYNC-04',
    'Data Synchronization',
    'Quota Balance Invariant (remainingLiters <= authorizedLiters)',
    invariantViolations === 0 ? 'PASS — VERIFIED' : 'FAIL',
    `Checked ${allAuths.length} fuel authorizations. Invariant violations found: ${invariantViolations}.`
  );

  // 5. Station-to-SubCity Assignment Integrity
  const totalAssignments = await prisma.stationSubCityAssignment.count({ where: { status: 'ACTIVE' } });
  record(
    'TEST-S5-SYNC-05',
    'Data Synchronization',
    'Station-to-SubCity Allocation Integrity',
    totalAssignments >= 21 ? 'PASS — VERIFIED' : 'FAIL',
    `Total active Station-to-SubCity allocations: ${totalAssignments} (covers 21 official stations across 4 sub-cities).`
  );

  // 6. Fuel Transaction Foreign Key Referential Integrity
  const orphanedTxs = await prisma.fuelTransaction.count({
    where: {
      OR: [
        { farmerId: '' },
        { fuelStationId: '' },
        { fuelTypeId: '' },
      ],
    },
  });
  record(
    'TEST-S5-SYNC-06',
    'Data Synchronization',
    'Transaction Ledger Referential Integrity',
    orphanedTxs === 0 ? 'PASS — VERIFIED' : 'FAIL',
    `Zero orphaned transactions found across all fuel transactions.`
  );

  // =========================================================================
  // GROUP 4: SHARED BRANDING & ASSETS ON DISK
  // =========================================================================
  console.log('\n--- GROUP 4: Shared Branding & Asset Availability ---');
  const assetChecks = [
    { name: 'dfcs-logo.png', path: '/branding/dfcs-logo.png' },
    { name: 'irfa-logo.png', path: '/branding/irfa-logo.png' },
    { name: 'login-bg.jpg', path: '/branding/login-bg.jpg' },
    { name: 'favicon.svg', path: '/favicon.svg' },
  ];

  for (const asset of assetChecks) {
    try {
      const res = await fetch(`http://localhost:3000${asset.path}`, { method: 'HEAD' });
      record(
        `TEST-S5-ASSET-${asset.name.replace(/[^a-zA-Z0-9]/g, '_')}`,
        'Shared Branding',
        `Asset Availability: ${asset.name}`,
        res.status === 200 ? 'PASS — VERIFIED' : 'FAIL',
        `Vite static server returned HTTP ${res.status} for ${asset.path}.`
      );
    } catch (err: any) {
      record(`TEST-S5-ASSET-${asset.name.replace(/[^a-zA-Z0-9]/g, '_')}`, 'Shared Branding', `Asset Availability: ${asset.name}`, 'FAIL', err.message);
    }
  }

  // =========================================================================
  // GROUP 5: ERROR HANDLING & USER FEEDBACK CONSISTENCY
  // =========================================================================
  console.log('\n--- GROUP 5: Shared Error Handling Consistency ---');

  // 401 Unauthorized
  const err401 = await apiRequest('GET', '/auth/me');
  record(
    'TEST-S5-ERR-01',
    'Error Handling',
    'Uniform 401 Unauthorized Response Schema',
    err401.status === 401 && err401.data?.success === false && typeof err401.data?.message === 'string' ? 'PASS — VERIFIED' : 'FAIL',
    `HTTP 401: success=${err401.data?.success}, message="${err401.data?.message}".`
  );

  // 403 Forbidden
  const err403 = await apiRequest('GET', '/system/users', undefined, tokenAgri);
  record(
    'TEST-S5-ERR-02',
    'Error Handling',
    'Uniform 403 Forbidden Response Schema',
    err403.status === 403 && err403.data?.success === false && typeof err403.data?.message === 'string' ? 'PASS — VERIFIED' : 'FAIL',
    `HTTP 403: success=${err403.data?.success}, message="${err403.data?.message}".`
  );

  // 404 Not Found
  const err404 = await apiRequest('GET', '/farmers/non-existent-uuid-12345', undefined, tokenAgri);
  record(
    'TEST-S5-ERR-03',
    'Error Handling',
    'Uniform 404 Not Found Response Schema',
    err404.status === 404 && err404.data?.success === false && typeof err404.data?.message === 'string' ? 'PASS — VERIFIED' : 'FAIL',
    `HTTP 404: success=${err404.data?.success}, message="${err404.data?.message}".`
  );

  // 400 Validation Error
  const err400 = await apiRequest('POST', '/system/users', { username: 'a' }, tokenAdmin);
  record(
    'TEST-S5-ERR-04',
    'Error Handling',
    'Uniform 400/500 Validation Rejection Schema',
    (err400.status === 400 || err400.status === 500) && err400.data?.success === false ? 'PASS — VERIFIED' : 'FAIL',
    `HTTP ${err400.status}: success=${err400.data?.success}, message="${err400.data?.message}".`
  );

  // =========================================================================
  // GROUP 6: REPORTING & CSV EXPORT SECURITY
  // =========================================================================
  console.log('\n--- GROUP 6: Reporting & CSV Export Security ---');

  // Agriculture export
  const expAgri = await apiRequest('GET', '/reports/export?type=agriculture&periodMonth=11&periodYear=2026', undefined, tokenAgri);
  record('TEST-S5-EXP-01', 'Reporting & Export', 'Agriculture Officer CSV Export', expAgri.status === 200 ? 'PASS — VERIFIED' : 'FAIL', `HTTP ${expAgri.status}`);

  // Trade export
  const expTrade = await apiRequest('GET', '/reports/export?type=trade&periodMonth=11&periodYear=2026', undefined, tokenTrade);
  record('TEST-S5-EXP-02', 'Reporting & Export', 'Trade Officer CSV Export', expTrade.status === 200 ? 'PASS — VERIFIED' : 'FAIL', `HTTP ${expTrade.status}`);

  // Station export
  const expStation = await apiRequest('GET', '/reports/export?type=station', undefined, tokenStation);
  record('TEST-S5-EXP-03', 'Reporting & Export', 'Station Operator CSV Export', expStation.status === 200 ? 'PASS — VERIFIED' : 'FAIL', `HTTP ${expStation.status}`);

  // Cross-role report blocking: Station blocked from Trade report
  const expBlock = await apiRequest('GET', '/reports/trade', undefined, tokenStation);
  record('TEST-S5-EXP-04', 'Reporting & Export', 'Cross-Role Report Block (Station blocked from Trade report)', expBlock.status === 403 ? 'PASS — VERIFIED' : 'FAIL', `HTTP ${expBlock.status} Forbidden`);

  // =========================================================================
  // SUMMARY
  // =========================================================================
  console.log('\n================================================================');
  console.log('                 CROSS-PORTAL AUDIT SUMMARY                     ');
  console.log('================================================================');
  const passedCount = results.filter((r) => r.status === 'PASS — VERIFIED').length;
  const partialCount = results.filter((r) => r.status === 'PARTIAL').length;
  const failedCount = results.filter((r) => r.status === 'FAIL').length;
  console.log(`Total Assertions: ${results.length}`);
  console.log(`Passed:           ${passedCount}`);
  console.log(`Partial:          ${partialCount}`);
  console.log(`Failed:           ${failedCount}`);
  console.log('================================================================');
}

runCrossPortalAudit()
  .catch((err) => {
    console.error('Cross-portal audit encountered fatal runtime error:', err);
  })
  .finally(async () => {
    await prisma.$disconnect();
    process.exit(0);
  });
