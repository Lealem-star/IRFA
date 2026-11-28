import 'dotenv/config';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function runIntegrityTests() {
  console.log('===============================================================');
  console.log('   IRFA / DFCS — PHASE 1 INTEGRITY & PRESERVATION TEST SUITE   ');
  console.log('===============================================================\n');

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

  try {
    await prisma.$connect();
    console.log('[Test] Connected to database.\n');

    // 1. Station Master Counts & Official Representation
    const stations = await prisma.fuelStation.findMany({ orderBy: { code: 'asc' } });
    assert(stations.length === 22, `Total fuel stations in database is exactly 22 (found ${stations.length})`);

    // 2. Existing Pilot Station BD-ST-01 Preservation
    const st01 = stations.find((s) => s.code === 'BD-ST-01');
    assert(!!st01, 'Station BD-ST-01 exists');
    assert(st01?.id === '32e84b8b-887f-4f16-9055-e339123f61d5', `BD-ST-01 preserves original ID (32e84b8b-...)`);
    assert(st01?.name === 'Tana Energy Fuel Station (Station A)', 'BD-ST-01 preserves original name');

    // 3. Existing Station-User Relation Preservation
    const userStation = await prisma.user.findFirst({
      where: { username: 'station' },
      include: { fuelStation: true },
    });
    assert(!!userStation, 'Station Admin user "station" exists');
    assert(userStation?.fuelStationId === '32e84b8b-887f-4f16-9055-e339123f61d5', 'User "station" remains linked to BD-ST-01');
    assert(userStation?.role === 'STATION_ADMIN', 'User "station" has role STATION_ADMIN');

    // 4. Existing Transactions Preservation
    const txCount = await prisma.fuelTransaction.count();
    assert(txCount === 8, `Historical transactions count is preserved (expected 8, found ${txCount})`);

    const sampleTx = await prisma.fuelTransaction.findUnique({
      where: { receiptNumber: 'TX-20261123-0001' },
      include: { fuelStation: true, farmer: true },
    });
    assert(!!sampleTx, 'First historical transaction TX-20261123-0001 is intact');
    assert(sampleTx?.fuelStation.code === 'BD-ST-01', 'Transaction links to BD-ST-01');
    assert(Number(sampleTx?.quantityLiters) === 80, 'Transaction quantity is 80 L');

    // 5. Existing Authorizations Preservation
    const authCount = await prisma.fuelAuthorization.count();
    assert(authCount === 2, `Historical fuel authorizations count is preserved (expected 2, found ${authCount})`);

    const auth00124 = await prisma.fuelAuthorization.findUnique({
      where: { authCode: 'AUTH-202611-00124' },
      include: { assignments: { include: { fuelStation: true } } },
    });
    assert(!!auth00124, 'Authorization AUTH-202611-00124 is intact');
    assert(Number(auth00124?.authorizedLiters) === 200, 'Authorized liters is 200');
    assert(Number(auth00124?.consumedLiters) === 60, 'Consumed liters is 60');
    assert(Number(auth00124?.remainingLiters) === 90, 'Remaining liters is 90');
    assert(auth00124?.assignments.length === 1, 'Legacy assignment is preserved');
    assert(auth00124?.assignments[0].fuelStation.code === 'BD-ST-01', 'Legacy assignment points to BD-ST-01');

    // 6. Verification Logs Preservation
    const vLogCount = await prisma.verificationLog.count();
    assert(vLogCount === 32, `Verification logs count is preserved (expected 32, found ${vLogCount})`);

    // 7. Audit Logs Preservation
    const auditCount = await prisma.auditLog.count();
    assert(auditCount >= 117, `Audit logs count is preserved (expected >= 117, found ${auditCount})`);

    // 8. New Relational Model Foundation: StationSubCityAssignment
    const subCityTableCheck = await (prisma as any).stationSubCityAssignment.count();
    assert(subCityTableCheck === 0, `StationSubCityAssignment table is present and clean (0 invented assignments, found ${subCityTableCheck})`);

    // 9. Sub-Cities & Farmers Count Integrity
    const subCityCount = await prisma.subCity.count();
    assert(subCityCount === 4, `Sub-cities count is preserved (expected 4, found ${subCityCount})`);

    const kebeleCount = await prisma.kebele.count();
    assert(kebeleCount === 50, `Kebeles count is preserved (expected 50, found ${kebeleCount})`);

    const farmerCount = await prisma.farmer.count();
    assert(farmerCount === 20, `Farmers count is preserved (expected 20, found ${farmerCount})`);

    // 10. Official Stations Coverage
    const officialCodes = [
      'BD-ST-04', 'BD-ST-05', 'BD-ST-06', 'BD-ST-07', 'BD-ST-08',
      'BD-ST-09', 'BD-ST-10', 'BD-ST-11', 'BD-ST-12', 'BD-ST-13',
      'BD-ST-14', 'BD-ST-15', 'BD-ST-16', 'BD-ST-17', 'BD-ST-18',
      'BD-ST-19', 'BD-ST-20', 'BD-ST-21', 'BD-ST-22'
    ];
    let allOfficialCodesFound = true;
    for (const code of officialCodes) {
      if (!stations.some((s) => s.code === code)) {
        allOfficialCodesFound = false;
        console.error(`Missing expected official code: ${code}`);
      }
    }
    assert(allOfficialCodesFound, 'All 19 missing official stations were registered with unique codes BD-ST-04..22');

    // 11. Duplicate Code Check
    const uniqueCodes = new Set(stations.map((s) => s.code));
    assert(uniqueCodes.size === stations.length, 'Zero duplicate station codes in database');

    console.log('\n---------------------------------------------------------------');
    console.log(`TEST SUITE RESULTS: ${passed} PASSED, ${failed} FAILED`);
    console.log('---------------------------------------------------------------');

    if (failed > 0) {
      process.exit(1);
    }
  } catch (err) {
    console.error('Test execution error:', err);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

runIntegrityTests();
