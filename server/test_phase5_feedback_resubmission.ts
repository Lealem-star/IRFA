import 'dotenv/config';
import http from 'http';
import prisma from './src/config/db.js';
import app from './src/app.js';
import jwt from 'jsonwebtoken';
import { UserRole, RequestStatus } from '@prisma/client';

const JWT_SECRET = process.env.JWT_SECRET || 'irfa_bahir_dar_super_secret_jwt_key_2026_secured';

function makeToken(payload: { userId: string; username: string; role: UserRole; fuelStationId?: string | null }) {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: '1h' });
}

async function runPhase5Tests() {
  console.log('================================================================================');
  console.log('   IRFA / DFCS — PHASE 5: AGRICULTURE FEEDBACK & RESUBMISSION VERIFICATION      ');
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

  // Track ephemeral IDs for safe teardown
  const ephemeralRequestIds: string[] = [];
  const ephemeralUserIds: string[] = [];
  const ephemeralFarmerIds: string[] = [];

  try {
    await prisma.$connect();
    console.log('[Setup] Connected to database.');

    // Pre-test cleanup of any residual test records
    await prisma.fuelRequestHistory.deleteMany({
      where: { fuelRequest: { requestNumber: { startsWith: 'P5-TEST-' } } },
    });
    await prisma.fuelRequestItem.deleteMany({
      where: { fuelRequest: { requestNumber: { startsWith: 'P5-TEST-' } } },
    });
    await prisma.fuelRequest.deleteMany({
      where: { requestNumber: { startsWith: 'P5-TEST-' } },
    });
    await prisma.farmer.deleteMany({
      where: { farmerCode: { startsWith: 'P5-FARMER-' } },
    });
    await prisma.user.deleteMany({
      where: { username: { startsWith: 'p5_user_' } },
    });

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

    // -------------------------------------------------------------------------
    // 1. BASELINE PRESERVATION INTEGRITY
    // -------------------------------------------------------------------------
    console.log('--- 1. Baseline Historical Data Verification ---');
    const totalStations = await prisma.fuelStation.count();
    assert(totalStations === 22, `All 22 fuel stations exist in database (found ${totalStations})`);

    const totalSubCities = await prisma.subCity.count();
    assert(totalSubCities === 4, `All 4 Sub-Cities exist in database (found ${totalSubCities})`);

    const totalKebeles = await prisma.kebele.count();
    assert(totalKebeles === 50, `All 50 Kebeles exist in database (found ${totalKebeles})`);

    const totalFarmers = await prisma.farmer.count();
    assert(totalFarmers === 20, `All 20 baseline farmers exist in database (found ${totalFarmers})`);

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

    // Fetch existing entities and users
    const agriUser = await prisma.user.findFirst({ where: { role: 'AGRICULTURE_OFFICE' } });
    const tradeUser = await prisma.user.findFirst({ where: { role: 'TRADE_OFFICE' } });
    const adminUser = await prisma.user.findFirst({ where: { role: 'SYSTEM_ADMIN' } });
    const stationUser = primaryStationAdmin;
    const existingFarmers = await prisma.farmer.findMany({ take: 2, orderBy: { farmerCode: 'asc' } });
    const fuelTypes = await prisma.fuelType.findMany({ where: { isActive: true } });
    const diesel = fuelTypes.find((f) => f.code === 'DIESEL') || fuelTypes[0];

    assert(!!agriUser && !!tradeUser && !!adminUser, 'Role users exist');

    const agriToken = makeToken({ userId: agriUser!.id, username: agriUser!.username, role: 'AGRICULTURE_OFFICE' });
    const tradeToken = makeToken({ userId: tradeUser!.id, username: tradeUser!.username, role: 'TRADE_OFFICE' });
    const adminToken = makeToken({ userId: adminUser!.id, username: adminUser!.username, role: 'SYSTEM_ADMIN' });
    const stationToken = makeToken({
      userId: stationUser!.id,
      username: stationUser!.username,
      role: 'STATION_ADMIN',
      fuelStationId: stationUser!.fuelStationId,
    });

    // Create a second agriculture officer to test multi-user scoping
    const uniqueSuffix = Date.now();
    const agriOfficer2 = await prisma.user.create({
      data: {
        username: `p5_user_agri2_${uniqueSuffix}`,
        fullName: 'Second Agri Officer',
        role: UserRole.AGRICULTURE_OFFICE,
        passwordHash: 'dummy',
        isActive: true,
      },
    });
    ephemeralUserIds.push(agriOfficer2.id);
    const agriToken2 = makeToken({ userId: agriOfficer2.id, username: agriOfficer2.username, role: 'AGRICULTURE_OFFICE' });

    // -------------------------------------------------------------------------
    // 2. CREATE CONTROLLED REQUEST FOR WORKFLOW
    // -------------------------------------------------------------------------
    console.log('\n--- 2. Create Initial Fuel Request for Workflow Testing ---');

    const createPayload = {
      title: 'P5 Initial Batch Fuel Request',
      periodMonth: 11,
      periodYear: 2026,
      items: [
        {
          farmerId: existingFarmers[0].id,
          fuelTypeId: diesel.id,
          requestedLiters: 150,
          remarks: 'Pump A initial allocation',
        },
        {
          farmerId: existingFarmers[1].id,
          fuelTypeId: diesel.id,
          requestedLiters: 200,
          remarks: 'Pump B initial allocation',
        },
      ],
    };

    const createRes = await apiRequest('POST', '/api/fuel-requests', agriToken, createPayload);
    assert(createRes.status === 201, `Agriculture Officer creates fuel request (got ${createRes.status})`);
    assert(createRes.data?.success === true, 'Response indicates success: true');
    const testReq = createRes.data?.request;
    assert(!!testReq?.id, `Request created with ID: ${testReq?.id}`);
    ephemeralRequestIds.push(testReq.id);
    assert(testReq?.status === 'SUBMITTED', "Initial status is 'SUBMITTED'");
    assert(Number(testReq?.totalLitersRequested) === 350, 'Total requested liters is 350L');

    // Verify initial history entry was created
    const initialHistory = await prisma.fuelRequestHistory.findMany({
      where: { fuelRequestId: testReq.id },
    });
    assert(initialHistory.length === 1, `Initial history entry recorded (count: ${initialHistory.length})`);
    assert(initialHistory[0].action === 'SUBMITTED', "History action is 'SUBMITTED'");
    assert(initialHistory[0].toStatus === 'SUBMITTED', "History toStatus is 'SUBMITTED'");
    assert(initialHistory[0].actorId === agriUser!.id, `History actor is submitter (${agriUser!.id})`);

    // -------------------------------------------------------------------------
    // 3. STRICT RBAC ACCESS CONTROL TESTS
    // -------------------------------------------------------------------------
    console.log('\n--- 3. Strict Role-Based Access Control (RBAC) ---');

    // Review endpoint access
    const noTokenReview = await apiRequest('POST', `/api/fuel-requests/${testReq.id}/review`, undefined, {
      status: 'UNDER_REVIEW',
    });
    assert(noTokenReview.status === 401, `Unauthenticated review blocked with 401 (got ${noTokenReview.status})`);

    const stationReview = await apiRequest('POST', `/api/fuel-requests/${testReq.id}/review`, stationToken, {
      status: 'UNDER_REVIEW',
    });
    assert(stationReview.status === 403, `STATION_ADMIN review blocked with 403 (got ${stationReview.status})`);

    const adminReview = await apiRequest('POST', `/api/fuel-requests/${testReq.id}/review`, adminToken, {
      status: 'UNDER_REVIEW',
    });
    assert(adminReview.status === 403, `SYSTEM_ADMIN review blocked with 403 (got ${adminReview.status})`);

    // Resubmission endpoint access
    const noTokenResubmit = await apiRequest('POST', `/api/fuel-requests/${testReq.id}/resubmit`, undefined, {});
    assert(noTokenResubmit.status === 401, `Unauthenticated resubmit blocked with 401 (got ${noTokenResubmit.status})`);

    const stationResubmit = await apiRequest('POST', `/api/fuel-requests/${testReq.id}/resubmit`, stationToken, {});
    assert(stationResubmit.status === 403, `STATION_ADMIN resubmit blocked with 403 (got ${stationResubmit.status})`);

    // -------------------------------------------------------------------------
    // 4. REVIEW DECISION & MANDATORY FEEDBACK ENFORCEMENT
    // -------------------------------------------------------------------------
    console.log('\n--- 4. Review Decision & Mandatory Feedback Enforcement ---');

    // Attempting to RETURN without feedback must be rejected
    const returnNoFeedback = await apiRequest('POST', `/api/fuel-requests/${testReq.id}/review`, agriToken2, {
      status: 'RETURNED',
      reviewRemarks: '',
    });
    assert(returnNoFeedback.status === 400, `Returning without feedback rejected with 400 (got ${returnNoFeedback.status})`);
    assert(
      returnNoFeedback.data?.message?.includes('Mandatory feedback'),
      'Rejection specifies mandatory feedback requirement'
    );

    // Attempting to REJECT without feedback must be rejected
    const rejectNoFeedback = await apiRequest('POST', `/api/fuel-requests/${testReq.id}/review`, agriToken2, {
      status: 'REJECTED',
      reviewRemarks: '   ',
    });
    assert(rejectNoFeedback.status === 400, `Rejecting without feedback rejected with 400 (got ${rejectNoFeedback.status})`);

    // Valid review decision: RETURN FOR CORRECTION with meaningful explanation
    const feedbackText = 'Correction Required: Farmer 2 requested volume exceeds hectare pump capacity. Reduce to 120L.';
    const returnValidRes = await apiRequest('POST', `/api/fuel-requests/${testReq.id}/review`, agriToken2, {
      status: 'RETURNED',
      reviewRemarks: feedbackText,
    });
    assert(returnValidRes.status === 200, `Return with feedback returns 200 OK (got ${returnValidRes.status})`);
    assert(returnValidRes.data?.success === true, 'Success: true');
    assert(returnValidRes.data?.request?.status === 'RETURNED', "Request status updated to 'RETURNED'");
    assert(returnValidRes.data?.request?.reviewRemarks === feedbackText, 'Review remarks accurately stored');

    // Verify history recorded the return event
    const historyAfterReturn = await prisma.fuelRequestHistory.findMany({
      where: { fuelRequestId: testReq.id },
      orderBy: { createdAt: 'desc' },
    });
    assert(historyAfterReturn.length === 2, `History has 2 entries (found ${historyAfterReturn.length})`);
    const returnEvent = historyAfterReturn[0];
    assert(returnEvent.action === 'RETURNED_FOR_CORRECTION', "History action is 'RETURNED_FOR_CORRECTION'");
    assert(returnEvent.fromStatus === 'SUBMITTED', "fromStatus is 'SUBMITTED'");
    assert(returnEvent.toStatus === 'RETURNED', "toStatus is 'RETURNED'");
    assert(returnEvent.actorId === agriOfficer2.id, `actorId is the reviewer (${agriOfficer2.id})`);
    assert(returnEvent.feedback === feedbackText, 'History preserves reviewer feedback');

    // -------------------------------------------------------------------------
    // 5. FEEDBACK VISIBILITY & REQUEST DETAILS
    // -------------------------------------------------------------------------
    console.log('\n--- 5. Feedback Visibility & Request Tracking Details ---');

    const detailRes = await apiRequest('GET', `/api/fuel-requests/${testReq.id}`, agriToken);
    assert(detailRes.status === 200, `Get request by ID returns 200 OK (got ${detailRes.status})`);
    const fetchedReq = detailRes.data?.request;
    assert(fetchedReq?.status === 'RETURNED', "Fetched status is 'RETURNED'");
    assert(fetchedReq?.reviewRemarks === feedbackText, 'Review feedback is clearly visible to submitter');
    assert(Array.isArray(fetchedReq?.history), 'Request details include history array');
    assert(fetchedReq?.history?.length >= 2, `History contains all transitions (count: ${fetchedReq?.history?.length})`);

    // -------------------------------------------------------------------------
    // 6. INVALID STATUS TRANSITIONS PROTECTION
    // -------------------------------------------------------------------------
    console.log('\n--- 6. Invalid Status Transitions Protection ---');

    // A) Cannot resubmit a request that is NOT returned (e.g. if already submitted or approved)
    // Create an ephemeral approved request to test illegal transitions
    const dummyReq = await prisma.fuelRequest.create({
      data: {
        requestNumber: `P5-TEST-APP-${Date.now()}`,
        title: 'Dummy Approved Request',
        periodMonth: 11,
        periodYear: 2026,
        status: RequestStatus.APPROVED,
        submittedById: agriUser!.id,
      },
    });
    ephemeralRequestIds.push(dummyReq.id);

    const illegalResubmit = await apiRequest('POST', `/api/fuel-requests/${dummyReq.id}/resubmit`, agriToken, {
      resubmissionNotes: 'Attempting to resubmit an approved request',
    });
    assert(illegalResubmit.status === 400, `Resubmitting APPROVED request rejected with 400 (got ${illegalResubmit.status})`);
    assert(
      illegalResubmit.data?.message?.includes("Only requests with status 'RETURNED' can be resubmitted"),
      'Rejection explains invalid status'
    );

    // B) Cannot edit an APPROVED request
    const illegalEdit = await apiRequest('PUT', `/api/fuel-requests/${dummyReq.id}`, agriToken, {
      title: 'Hacked Title',
    });
    assert(illegalEdit.status === 400, `Editing APPROVED request rejected with 400 (got ${illegalEdit.status})`);

    // -------------------------------------------------------------------------
    // 7. CORRECTION OF PERMITTED INFORMATION (PUT /api/fuel-requests/:id)
    // -------------------------------------------------------------------------
    console.log('\n--- 7. Correction of Permitted Request Information ---');

    // Submitter corrects farmer 2's volume from 200L to 120L as instructed
    const updatePayload = {
      title: 'P5 Corrected Batch Fuel Request',
      items: [
        {
          farmerId: existingFarmers[0].id,
          fuelTypeId: diesel.id,
          requestedLiters: 150,
          remarks: 'Pump A verified',
        },
        {
          farmerId: existingFarmers[1].id,
          fuelTypeId: diesel.id,
          requestedLiters: 120, // Corrected from 200L -> 120L
          remarks: 'Pump B adjusted per feedback',
        },
      ],
    };

    const updateRes = await apiRequest('PUT', `/api/fuel-requests/${testReq.id}`, agriToken, updatePayload);
    assert(updateRes.status === 200, `Updating RETURNED request returns 200 OK (got ${updateRes.status})`);
    assert(updateRes.data?.success === true, 'Success: true');
    assert(updateRes.data?.request?.title === 'P5 Corrected Batch Fuel Request', 'Title updated');
    assert(Number(updateRes.data?.request?.totalLitersRequested) === 270, 'Total requested volume recomputed to 270L');

    // -------------------------------------------------------------------------
    // 8. RESUBMISSION OF CORRECTED REQUEST & HISTORY PRESERVATION
    // -------------------------------------------------------------------------
    console.log('\n--- 8. Resubmission of Corrected Request ---');

    const resubmitNotes = 'Adjusted Farmer 2 allocation to 120L as requested. Verified with Kebele extension agent.';
    const resubmitRes = await apiRequest('POST', `/api/fuel-requests/${testReq.id}/resubmit`, agriToken, {
      resubmissionNotes: resubmitNotes,
    });
    assert(resubmitRes.status === 200, `Resubmission returns 200 OK (got ${resubmitRes.status})`);
    assert(resubmitRes.data?.success === true, 'Success: true');
    const resubmittedData = resubmitRes.data?.request;
    assert(resubmittedData?.status === 'SUBMITTED', "Status successfully transitioned back to 'SUBMITTED'");

    // Check history ledger: must have 4 entries (SUBMITTED -> RETURNED -> CORRECTED -> RESUBMITTED)
    const historyAfterResubmit = await prisma.fuelRequestHistory.findMany({
      where: { fuelRequestId: testReq.id },
      orderBy: { createdAt: 'desc' },
    });
    assert(historyAfterResubmit.length === 4, `History preserves all 4 events (found ${historyAfterResubmit.length})`);

    const latestEvent = historyAfterResubmit[0];
    assert(latestEvent.action === 'RESUBMITTED', "Latest history action is 'RESUBMITTED'");
    assert(latestEvent.fromStatus === 'RETURNED', "fromStatus is 'RETURNED'");
    assert(latestEvent.toStatus === 'SUBMITTED', "toStatus is 'SUBMITTED'");
    assert(latestEvent.actorId === agriUser!.id, `actorId is submitter (${agriUser!.id})`);
    assert(latestEvent.feedback?.includes(resubmitNotes), 'Resubmission notes preserved in history');

    // CRITICAL: Ensure NO fuel authorizations were automatically generated by resubmission
    const generatedAuths = await prisma.fuelAuthorization.count({
      where: { fuelRequestId: testReq.id },
    });
    assert(generatedAuths === 0, `CRITICAL: Exactly 0 fuel authorizations generated by resubmission (found ${generatedAuths})`);

    // -------------------------------------------------------------------------
    // 9. AUDIT TRAIL VERIFICATION
    // -------------------------------------------------------------------------
    console.log('\n--- 9. Audit Trail Verification ---');

    const auditLogs = await prisma.auditLog.findMany({
      where: {
        entityId: testReq.id,
      },
      orderBy: { createdAt: 'desc' },
    });

    const actions = auditLogs.map((l) => l.action);
    assert(actions.includes('SUBMIT_FUEL_REQUEST'), 'AuditLog recorded SUBMIT_FUEL_REQUEST');
    assert(actions.includes('REVIEW_REQUEST_RETURNED'), 'AuditLog recorded REVIEW_REQUEST_RETURNED');
    assert(actions.includes('UPDATE_RETURNED_REQUEST'), 'AuditLog recorded UPDATE_RETURNED_REQUEST');
    assert(actions.includes('RESUBMIT_FUEL_REQUEST'), 'AuditLog recorded RESUBMIT_FUEL_REQUEST');

    // -------------------------------------------------------------------------
    // 10. TEARDOWN & BASELINE INTEGRITY CONFIRMATION
    // -------------------------------------------------------------------------
    console.log('\n--- 10. Teardown & Clean Restoration ---');

    // Clean ephemeral request history, items, and requests
    await prisma.fuelRequestHistory.deleteMany({
      where: { fuelRequestId: { in: ephemeralRequestIds } },
    });
    await prisma.fuelRequestItem.deleteMany({
      where: { fuelRequestId: { in: ephemeralRequestIds } },
    });
    const deletedReqs = await prisma.fuelRequest.deleteMany({
      where: { id: { in: ephemeralRequestIds } },
    });
    console.log(`[Teardown] Deleted ${deletedReqs.count} ephemeral test fuel requests.`);

    // Clean ephemeral users
    if (ephemeralUserIds.length > 0) {
      await prisma.user.deleteMany({ where: { id: { in: ephemeralUserIds } } });
      console.log(`[Teardown] Deleted ${ephemeralUserIds.length} ephemeral test users.`);
    }

    // Baseline checks
    const postStationsCount = await prisma.fuelStation.count();
    assert(postStationsCount === 22, `All 22 stations intact (found ${postStationsCount})`);

    const postSubCitiesCount = await prisma.subCity.count();
    assert(postSubCitiesCount === 4, `All 4 Sub-Cities intact (found ${postSubCitiesCount})`);

    const postKebelesCount = await prisma.kebele.count();
    assert(postKebelesCount === 50, `All 50 Kebeles intact (found ${postKebelesCount})`);

    const postFarmersCount = await prisma.farmer.count();
    assert(postFarmersCount === 20, `All 20 baseline farmers intact (found ${postFarmersCount})`);

    const postTxCount = await prisma.fuelTransaction.count();
    assert(postTxCount === 8, `All 8 completed transactions intact (found ${postTxCount})`);

    const postVerifCount = await prisma.verificationLog.count();
    assert(postVerifCount === 32, `All 32 verification logs intact (found ${postVerifCount})`);

    const postAllocations = await prisma.stationSubCityAssignment.count();
    assert(postAllocations === 0, `Clean state preserved: 0 station-subcity allocations in DB (found ${postAllocations})`);

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

    console.log('\n================================================================================');
    console.log(`   TEST RESULTS: ${passed} PASSED, ${failed} FAILED`);
    console.log('================================================================================\n');

    process.exit(failed > 0 ? 1 : 0);
  }
}

runPhase5Tests();
