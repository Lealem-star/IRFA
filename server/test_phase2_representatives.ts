import 'dotenv/config';
import prisma from './src/config/db.js';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { UserRole } from '@prisma/client';

const JWT_SECRET = process.env.JWT_SECRET || 'irfa_bahir_dar_super_secret_jwt_key_2026_secured';

interface TestToken {
  userId: string;
  username: string;
  role: UserRole;
  fuelStationId?: string | null;
}

function makeToken(payload: TestToken): string {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: '1h' });
}

async function runPhase2Tests() {
  console.log('========================================================================');
  console.log('   IRFA / DFCS — PHASE 2: TRADE OFFICE REPRESENTATIVE MANAGEMENT TESTS  ');
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

  try {
    await prisma.$connect();
    console.log('[Test Suite] Connected to database.\n');

    // ---------------------------------------------------------
    // 1. BASELINE INTEGRITY & DATA PRESERVATION
    // ---------------------------------------------------------
    console.log('--- 1. Baseline Integrity & Data Preservation ---');
    const totalStations = await prisma.fuelStation.count();
    assert(totalStations === 22, `All 22 fuel stations preserved (found ${totalStations})`);

    const primaryStationAdmin = await prisma.user.findFirst({
      where: { username: 'station' },
      include: { fuelStation: true },
    });
    assert(!!primaryStationAdmin, "Primary 'station' user exists in database");
    assert(primaryStationAdmin?.role === 'STATION_ADMIN', "'station' user role is STATION_ADMIN");
    assert(primaryStationAdmin?.isActive === true, "'station' user isActive is true");
    assert(primaryStationAdmin?.fuelStation?.code === 'BD-ST-01', "'station' assigned to BD-ST-01 (Tana Energy)");

    const txCount = await prisma.fuelTransaction.count();
    assert(txCount === 8, `All 8 completed fuel transactions preserved (found ${txCount})`);

    const verifCount = await prisma.verificationLog.count();
    assert(verifCount === 32, `All 32 verification logs preserved (found ${verifCount})`);

    const farmersCount = await prisma.farmer.count();
    assert(farmersCount === 20, `All 20 farmers preserved (found ${farmersCount})`);

    const subCitiesCount = await prisma.subCity.count();
    assert(subCitiesCount === 4, `All 4 sub-cities preserved (found ${subCitiesCount})`);

    const kebelesCount = await prisma.kebele.count();
    assert(kebelesCount === 50, `All 50 kebeles preserved (found ${kebelesCount})`);

    // ---------------------------------------------------------
    // 2. SETUP AUTH TOKENS FOR RBAC TESTING
    // ---------------------------------------------------------
    console.log('\n--- 2. RBAC & Operational Authority Verification ---');
    const tradeUser = await prisma.user.findFirst({ where: { role: 'TRADE_OFFICE' } });
    const agriUser = await prisma.user.findFirst({ where: { role: 'AGRICULTURE_OFFICE' } });
    const sysAdminUser = await prisma.user.findFirst({ where: { role: 'SYSTEM_ADMIN' } });

    assert(!!tradeUser, 'Trade Office user exists in database for testing');
    assert(!!agriUser, 'Agriculture Office user exists in database');
    assert(!!sysAdminUser, 'System Admin user exists in database');

    const tradeToken = makeToken({ userId: tradeUser!.id, username: tradeUser!.username, role: 'TRADE_OFFICE' });
    const agriToken = makeToken({ userId: agriUser!.id, username: agriUser!.username, role: 'AGRICULTURE_OFFICE' });
    const stationToken = makeToken({
      userId: primaryStationAdmin!.id,
      username: primaryStationAdmin!.username,
      role: 'STATION_ADMIN',
      fuelStationId: primaryStationAdmin!.fuelStationId,
    });
    const sysAdminToken = makeToken({ userId: sysAdminUser!.id, username: sysAdminUser!.username, role: 'SYSTEM_ADMIN' });

    // Mock Express Request & Response for controller testing
    const {
      listRepresentatives,
      createRepresentative,
      updateRepresentativeStatus,
      replaceRepresentative,
      reassignRepresentative,
      resetRepresentativePassword,
    } = await import('./src/controllers/representative.controller.js');

    function createMockRes() {
      const res: any = {
        statusCode: 200,
        data: null,
        status(code: number) {
          this.statusCode = code;
          return this;
        },
        json(payload: any) {
          this.data = payload;
          return this;
        },
      };
      return res;
    }

    // ---------------------------------------------------------
    // 3. LIST REPRESENTATIVES
    // ---------------------------------------------------------
    console.log('\n--- 3. Directory Listing & Metrics Verification ---');
    const mockReqList: any = {
      user: { userId: tradeUser!.id, role: 'TRADE_OFFICE' },
      query: {},
    };
    const mockResList = createMockRes();
    await listRepresentatives(mockReqList, mockResList);

    assert(mockResList.statusCode === 200, 'listRepresentatives returns HTTP 200');
    assert(mockResList.data.success === true, 'listRepresentatives returns success: true');
    assert(mockResList.data.stations.length === 22, `Returns all 22 fuel stations (got ${mockResList.data.stations.length})`);
    assert(mockResList.data.metrics.totalStations === 22, 'Metrics totalStations is 22');
    assert(mockResList.data.metrics.stationsWithActiveRep >= 1, 'Metrics stationsWithActiveRep is at least 1 (BD-ST-01)');

    // ---------------------------------------------------------
    // 4. CREATE REPRESENTATIVE ON UNASSIGNED STATION (BD-ST-04)
    // ---------------------------------------------------------
    console.log('\n--- 4. Create Representative on Station BD-ST-04 ---');
    const station4 = await prisma.fuelStation.findUnique({ where: { code: 'BD-ST-04' } });
    assert(!!station4, 'Station BD-ST-04 (TotalEnergies BGI) exists');

    const testRep1Username = `test_rep_bgi_${Date.now()}`;
    const mockReqCreate: any = {
      user: { userId: tradeUser!.id, role: 'TRADE_OFFICE' },
      body: {
        fuelStationId: station4!.id,
        fullName: 'Test Attendant BGI 1',
        username: testRep1Username,
        password: 'Password123!',
        email: `${testRep1Username}@station.et`,
        forceReplace: false,
      },
      ip: '127.0.0.1',
      headers: { 'user-agent': 'TestAgent/1.0' },
    };
    const mockResCreate = createMockRes();
    await createRepresentative(mockReqCreate, mockResCreate);

    assert(mockResCreate.statusCode === 201, `Create representative returns HTTP 201 Created (got ${mockResCreate.statusCode})`);
    assert(mockResCreate.data.success === true, 'Create representative returns success: true');
    const createdRep1Id = mockResCreate.data.representative.id;

    // Verify in database
    const createdRep1Db = await prisma.user.findUnique({ where: { id: createdRep1Id } });
    assert(!!createdRep1Db, 'Created representative persists in database');
    assert(createdRep1Db?.isActive === true, 'Created representative is active');
    assert(createdRep1Db?.role === 'STATION_ADMIN', 'Role is STATION_ADMIN');
    assert(createdRep1Db?.fuelStationId === station4!.id, 'Assigned to BD-ST-04');
    assert(createdRep1Db?.passwordHash !== 'Password123!', 'Password is cryptographically hashed');
    const hashValid = await bcrypt.compare('Password123!', createdRep1Db!.passwordHash);
    assert(hashValid === true, 'Password hash matches original plain password');

    // ---------------------------------------------------------
    // 5. INVARIANT: 2ND ACTIVE REP ON SAME STATION REJECTED (409)
    // ---------------------------------------------------------
    console.log('\n--- 5. One-Active-Representative Invariant Enforcement ---');
    const testRep2Username = `test_rep_bgi2_${Date.now()}`;
    const mockReqConflict: any = {
      user: { userId: tradeUser!.id, role: 'TRADE_OFFICE' },
      body: {
        fuelStationId: station4!.id,
        fullName: 'Test Attendant BGI 2',
        username: testRep2Username,
        password: 'Password123!',
        forceReplace: false, // NOT forcing
      },
      ip: '127.0.0.1',
      headers: { 'user-agent': 'TestAgent/1.0' },
    };
    const mockResConflict = createMockRes();
    await createRepresentative(mockReqConflict, mockResConflict);

    assert(mockResConflict.statusCode === 409, `Conflict returns HTTP 409 Conflict (got ${mockResConflict.statusCode})`);
    assert(mockResConflict.data.conflict === true, 'Returns conflict: true flag');
    assert(
      mockResConflict.data.currentRepresentative?.username === testRep1Username,
      'Identifies current active representative in response'
    );

    // Verify user was NOT created
    const notCreatedUser = await prisma.user.findUnique({ where: { username: testRep2Username } });
    assert(!notCreatedUser, 'Second active representative was blocked from creation in database');

    // ---------------------------------------------------------
    // 6. FORCE REPLACEMENT CREATION (ATOMIC REPLACEMENT)
    // ---------------------------------------------------------
    console.log('\n--- 6. Force Replacement Creation (Atomic Transaction) ---');
    const mockReqForce: any = {
      user: { userId: tradeUser!.id, role: 'TRADE_OFFICE' },
      body: {
        fuelStationId: station4!.id,
        fullName: 'Test Attendant BGI 2 (Replacement)',
        username: testRep2Username,
        password: 'Password123!',
        forceReplace: true, // EXPLICIT FORCE
      },
      ip: '127.0.0.1',
      headers: { 'user-agent': 'TestAgent/1.0' },
    };
    const mockResForce = createMockRes();
    await createRepresentative(mockReqForce, mockResForce);

    assert(mockResForce.statusCode === 201, `Force replacement returns HTTP 201 Created (got ${mockResForce.statusCode})`);
    const createdRep2Id = mockResForce.data.representative.id;

    // Verify atomic invariant in database: former is deactivated, new is active
    const rep1After = await prisma.user.findUnique({ where: { id: createdRep1Id } });
    const rep2After = await prisma.user.findUnique({ where: { id: createdRep2Id } });

    assert(rep1After?.isActive === false, 'Former representative was atomically deactivated (isActive: false)');
    assert(rep2After?.isActive === true, 'New replacement representative was activated (isActive: true)');

    const activeRepsOnStation4 = await prisma.user.count({
      where: { fuelStationId: station4!.id, role: 'STATION_ADMIN', isActive: true },
    });
    assert(activeRepsOnStation4 === 1, `Exactly 1 active representative on station BD-ST-04 (count: ${activeRepsOnStation4})`);

    // ---------------------------------------------------------
    // 7. STATUS TOGGLE (DEACTIVATE & REACTIVATE)
    // ---------------------------------------------------------
    console.log('\n--- 7. Status Toggle (Deactivate / Reactivate) ---');
    const mockReqDeact: any = {
      user: { userId: tradeUser!.id, role: 'TRADE_OFFICE' },
      params: { id: createdRep2Id },
      body: { status: 'INACTIVE' },
      ip: '127.0.0.1',
    };
    const mockResDeact = createMockRes();
    await updateRepresentativeStatus(mockReqDeact, mockResDeact);

    assert(mockResDeact.statusCode === 200, 'Deactivation returns HTTP 200');
    const rep2Deactivated = await prisma.user.findUnique({ where: { id: createdRep2Id } });
    assert(rep2Deactivated?.isActive === false, 'Representative isActive successfully set to false');

    // Reactivate rep1 (when rep2 is inactive)
    const mockReqReact: any = {
      user: { userId: tradeUser!.id, role: 'TRADE_OFFICE' },
      params: { id: createdRep1Id },
      body: { status: 'ACTIVE' },
      ip: '127.0.0.1',
    };
    const mockResReact = createMockRes();
    await updateRepresentativeStatus(mockReqReact, mockResReact);

    assert(mockResReact.statusCode === 200, 'Reactivation returns HTTP 200');
    const rep1Reactivated = await prisma.user.findUnique({ where: { id: createdRep1Id } });
    assert(rep1Reactivated?.isActive === true, 'Representative 1 successfully reactivated');

    // ---------------------------------------------------------
    // 8. DEDICATED ATOMIC REPLACEMENT ENDPOINT
    // ---------------------------------------------------------
    console.log('\n--- 8. Dedicated Replacement Endpoint ---');
    const testRep3Username = `test_rep_bgi3_${Date.now()}`;
    const mockReqReplace: any = {
      user: { userId: tradeUser!.id, role: 'TRADE_OFFICE' },
      params: { id: createdRep1Id },
      body: {
        fullName: 'Test Attendant BGI 3 (Final Replacement)',
        username: testRep3Username,
        password: 'Password999!',
        reason: 'Staff official transition',
      },
      ip: '127.0.0.1',
    };
    const mockResReplace = createMockRes();
    await replaceRepresentative(mockReqReplace, mockResReplace);

    assert(mockResReplace.statusCode === 201, `Replace endpoint returns HTTP 201 Created (got ${mockResReplace.statusCode})`);
    const createdRep3Id = mockResReplace.data.representative.id;

    const rep1AfterReplace = await prisma.user.findUnique({ where: { id: createdRep1Id } });
    const rep3AfterReplace = await prisma.user.findUnique({ where: { id: createdRep3Id } });

    assert(rep1AfterReplace?.isActive === false, 'Replaced rep is deactivated');
    assert(rep3AfterReplace?.isActive === true, 'Replacement rep is active');

    // ---------------------------------------------------------
    // 9. REASSIGNMENT ACROSS STATIONS
    // ---------------------------------------------------------
    console.log('\n--- 9. Station Reassignment ---');
    const station5 = await prisma.fuelStation.findUnique({ where: { code: 'BD-ST-05' } });
    assert(!!station5, 'Station BD-ST-05 (TotalEnergies Maraki) exists');

    const mockReqReassign: any = {
      user: { userId: tradeUser!.id, role: 'TRADE_OFFICE' },
      params: { id: createdRep3Id },
      body: {
        newFuelStationId: station5!.id,
        reason: 'Authorized transfer to Maraki',
      },
      ip: '127.0.0.1',
    };
    const mockResReassign = createMockRes();
    await reassignRepresentative(mockReqReassign, mockResReassign);

    assert(mockResReassign.statusCode === 200, 'Reassignment returns HTTP 200');
    const rep3Reassigned = await prisma.user.findUnique({ where: { id: createdRep3Id } });
    assert(rep3Reassigned?.fuelStationId === station5!.id, 'Representative fuelStationId updated to BD-ST-05');

    // ---------------------------------------------------------
    // 10. SECURE PASSWORD RESET
    // ---------------------------------------------------------
    console.log('\n--- 10. Secure Password Reset ---');
    const newSecretPassword = 'SecureNewPassword2026!';
    const mockReqReset: any = {
      user: { userId: tradeUser!.id, role: 'TRADE_OFFICE' },
      params: { id: createdRep3Id },
      body: { newPassword: newSecretPassword },
      ip: '127.0.0.1',
    };
    const mockResReset = createMockRes();
    await resetRepresentativePassword(mockReqReset, mockResReset);

    assert(mockResReset.statusCode === 200, 'Password reset returns HTTP 200');
    assert(!mockResReset.data.password, 'Response does NOT leak plain password');
    assert(!mockResReset.data.passwordHash, 'Response does NOT leak password hash');

    const rep3WithNewPw = await prisma.user.findUnique({ where: { id: createdRep3Id } });
    const verifyNewPw = await bcrypt.compare(newSecretPassword, rep3WithNewPw!.passwordHash);
    assert(verifyNewPw === true, 'New password matches database bcrypt hash');

    // ---------------------------------------------------------
    // 11. AUDIT LOGGING VERIFICATION
    // ---------------------------------------------------------
    console.log('\n--- 11. Audit Logging Verification ---');
    const testAuditLogs = await prisma.auditLog.findMany({
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
    assert(testAuditLogs.length >= 6, `All representative lifecycle actions logged in AuditLog (found ${testAuditLogs.length})`);

    // ---------------------------------------------------------
    // 12. CLEANUP TEST DATA ONLY (PRESERVE ALL HISTORICAL DATA)
    // ---------------------------------------------------------
    console.log('\n--- 12. Test Teardown & Historical Data Safety Verification ---');
    // Delete only the test reps created in this test run
    await prisma.user.deleteMany({
      where: {
        id: { in: [createdRep1Id, createdRep2Id, createdRep3Id] },
      },
    });
    console.log('  Cleaned up ephemeral test representative accounts.');

    // Verify baseline preserved
    const finalPrimaryRep = await prisma.user.findFirst({
      where: { username: 'station' },
      include: { fuelStation: true },
    });
    assert(finalPrimaryRep?.isActive === true, "CRITICAL: 'station' account on BD-ST-01 is intact and active");
    assert(finalPrimaryRep?.id === primaryStationAdmin!.id, "CRITICAL: 'station' ID is identical and untouched");

    const finalTx = await prisma.fuelTransaction.count();
    assert(finalTx === 8, 'CRITICAL: All 8 completed fuel transactions remain intact');

    const finalStations = await prisma.fuelStation.count();
    assert(finalStations === 22, 'CRITICAL: All 22 fuel stations remain intact');

    const finalFarmers = await prisma.farmer.count();
    assert(finalFarmers === 20, 'CRITICAL: All 20 farmers remain intact');

    console.log('\n========================================================================');
    console.log(`   TEST RESULTS: ${passed} PASSED / ${failed} FAILED`);
    console.log('========================================================================\n');

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

runPhase2Tests();
