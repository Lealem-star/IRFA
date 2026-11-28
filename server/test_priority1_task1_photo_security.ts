import 'dotenv/config';
import http from 'http';
import path from 'path';
import fs from 'fs';
import prisma from './src/config/db.js';
import app from './src/app.js';
import jwt from 'jsonwebtoken';
import { UserRole, EligibilityStatus } from '@prisma/client';

const JWT_SECRET = process.env.JWT_SECRET || 'irfa_bahir_dar_super_secret_jwt_key_2026_secured';

function makeToken(payload: { userId: string; username: string; role: UserRole; fuelStationId?: string | null }) {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: '1h' });
}

// Minimal valid 1x1 JPEG byte stream for test fixtures
const DUMMY_JPEG_BUFFER = Buffer.from([
  0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46, 0x00, 0x01, 0x01, 0x01, 0x00, 0x48,
  0x00, 0x48, 0x00, 0x00, 0xff, 0xdb, 0x00, 0x43, 0x00, 0x08, 0x06, 0x06, 0x07, 0x06, 0x05, 0x08,
  0x07, 0x07, 0x07, 0x09, 0x09, 0x08, 0x0a, 0x0c, 0x14, 0x0d, 0x0c, 0x0b, 0x0b, 0x0c, 0x19, 0x12,
  0x13, 0x0f, 0x14, 0x1d, 0x1a, 0x1f, 0x1e, 0x1d, 0x1a, 0x1c, 0x1c, 0x20, 0x24, 0x2e, 0x27, 0x20,
  0x22, 0x2c, 0x23, 0x1c, 0x1c, 0x28, 0x37, 0x29, 0x2c, 0x30, 0x31, 0x34, 0x34, 0x34, 0x1f, 0x27,
  0x39, 0x3d, 0x38, 0x32, 0x3c, 0x2e, 0x33, 0x34, 0x32, 0xff, 0xc0, 0x00, 0x0b, 0x08, 0x00, 0x01,
  0x00, 0x01, 0x01, 0x01, 0x11, 0x00, 0xff, 0xc4, 0x00, 0x1f, 0x00, 0x00, 0x01, 0x05, 0x01, 0x01,
  0x01, 0x01, 0x01, 0x01, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x01, 0x02, 0x03, 0x04,
  0x05, 0x06, 0x07, 0x08, 0x09, 0x0a, 0x0b, 0xff, 0xda, 0x00, 0x08, 0x01, 0x01, 0x00, 0x00, 0x3f,
  0x00, 0xbf, 0x80, 0xff, 0xd9
]);

async function runPhotoSecurityTests() {
  console.log('================================================================================');
  console.log('   IRFA PRIORITY 1 — TASK 1: FARMER PHOTO SECURITY & ACCESS CONTROL TEST SUITE  ');
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

  // Track ephemeral IDs and files for cleanup
  const ephemeralFarmerIds: string[] = [];
  const ephemeralUserIds: string[] = [];
  const createdTestFiles: string[] = [];

  try {
    let connected = false;
    for (let attempt = 1; attempt <= 4; attempt++) {
      try {
        await prisma.$connect();
        connected = true;
        break;
      } catch (e: any) {
        console.warn(`[Setup] DB connection attempt ${attempt} failed (${e.message}). Retrying in 2s...`);
        await new Promise((r) => setTimeout(r, 2000));
      }
    }
    if (!connected) throw new Error('Could not connect to database after 4 attempts.');
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

    async function apiRequest(method: string, pathUrl: string, token?: string, body?: any, isMultipart = false) {
      const headers: Record<string, string> = {};
      if (token) {
        headers['Authorization'] = `Bearer ${token}`;
      }
      if (!isMultipart && body) {
        headers['Content-Type'] = 'application/json';
      }

      const res = await fetch(`${baseUrl}${pathUrl}`, {
        method,
        headers,
        body: isMultipart ? body : body ? JSON.stringify(body) : undefined,
      });

      const contentType = res.headers.get('content-type') || '';
      let json: any = null;
      let text: string = '';

      if (contentType.includes('application/json')) {
        try {
          json = await res.json();
        } catch {}
      } else {
        text = await res.text();
      }

      return {
        status: res.status,
        headers: res.headers,
        contentType,
        data: json,
        text,
      };
    }

    // -------------------------------------------------------------------------
    // SETUP: Users with different roles
    // -------------------------------------------------------------------------
    const agriUser = (await prisma.user.findFirst({ where: { role: UserRole.AGRICULTURE_OFFICE } })) ||
      (await prisma.user.create({
        data: {
          username: `p1_agri_${Date.now()}`,
          passwordHash: '$2a$10$abcdefghijklmnopqrstuv',
          fullName: 'Test Agri Officer',
          role: UserRole.AGRICULTURE_OFFICE,
          isActive: true,
        },
      }));
    if (agriUser.username.startsWith('p1_agri_')) ephemeralUserIds.push(agriUser.id);

    const tradeUser = (await prisma.user.findFirst({ where: { role: UserRole.TRADE_OFFICE } })) ||
      (await prisma.user.create({
        data: {
          username: `p1_trade_${Date.now()}`,
          passwordHash: '$2a$10$abcdefghijklmnopqrstuv',
          fullName: 'Test Trade Officer',
          role: UserRole.TRADE_OFFICE,
          isActive: true,
        },
      }));
    if (tradeUser.username.startsWith('p1_trade_')) ephemeralUserIds.push(tradeUser.id);

    const stationUser = await prisma.user.findFirst({
      where: { role: UserRole.STATION_ADMIN },
      include: { fuelStation: true },
    });
    if (!stationUser) throw new Error('Station admin user not found in database.');

    const adminUser = (await prisma.user.findFirst({ where: { role: UserRole.SYSTEM_ADMIN } })) ||
      (await prisma.user.create({
        data: {
          username: `p1_admin_${Date.now()}`,
          passwordHash: '$2a$10$abcdefghijklmnopqrstuv',
          fullName: 'Test System Admin',
          role: UserRole.SYSTEM_ADMIN,
          isActive: true,
        },
      }));
    if (adminUser.username.startsWith('p1_admin_')) ephemeralUserIds.push(adminUser.id);

    const agriToken = makeToken({ userId: agriUser.id, username: agriUser.username, role: agriUser.role });
    const tradeToken = makeToken({ userId: tradeUser.id, username: tradeUser.username, role: tradeUser.role });
    const stationToken = makeToken({
      userId: stationUser.id,
      username: stationUser.username,
      role: stationUser.role,
      fuelStationId: stationUser.fuelStationId,
    });
    const adminToken = makeToken({ userId: adminUser.id, username: adminUser.username, role: adminUser.role });

    // Ensure uploads/farmers directory exists
    const uploadsFarmersDir = path.resolve(process.cwd(), 'uploads/farmers');
    if (!fs.existsSync(uploadsFarmersDir)) {
      fs.mkdirSync(uploadsFarmersDir, { recursive: true });
    }

    // Create a real test photo file
    const testFilename = `farmer-photo-p1t1-test-${Date.now()}.jpg`;
    const testFilePath = path.join(uploadsFarmersDir, testFilename);
    fs.writeFileSync(testFilePath, DUMMY_JPEG_BUFFER);
    createdTestFiles.push(testFilePath);

    // Get an existing kebele for farmer creation
    const kebele = await prisma.kebele.findFirst();
    if (!kebele) throw new Error('No kebele found in database.');

    // Create Farmer A with photo
    const farmerWithPhoto = await prisma.farmer.create({
      data: {
        farmerCode: `FR-P1-${Date.now().toString().slice(-5)}`,
        fullName: 'Priority 1 Test Farmer With Photo',
        phone: '+251 918 001 001',
        nationalId: `ETH-P1-${Date.now().toString().slice(-6)}`,
        kebeleId: kebele.id,
        subCityId: kebele.subCityId,
        photoUrl: `/uploads/farmers/${testFilename}`,
        eligibilityStatus: EligibilityStatus.ELIGIBLE,
        isActive: true,
      },
    });
    ephemeralFarmerIds.push(farmerWithPhoto.id);

    // Create Farmer B without photo
    const farmerNoPhoto = await prisma.farmer.create({
      data: {
        farmerCode: `FR-P1-${(Date.now() + 1).toString().slice(-5)}`,
        fullName: 'Priority 1 Test Farmer No Photo',
        phone: '+251 918 001 002',
        nationalId: `ETH-P1-${(Date.now() + 1).toString().slice(-6)}`,
        kebeleId: kebele.id,
        subCityId: kebele.subCityId,
        photoUrl: null,
        eligibilityStatus: EligibilityStatus.ELIGIBLE,
        isActive: true,
      },
    });
    ephemeralFarmerIds.push(farmerNoPhoto.id);

    // =========================================================================
    // SECTION 1: PUBLIC STATIC ACCESS REMOVAL (SEC-04 Remediation)
    // =========================================================================
    console.log('--- SECTION 1: PUBLIC STATIC ACCESS REMOVAL ---');

    // 1.1 Direct public access to farmer photo via /uploads/farmers/ must return 404
    const pubPhotoRes = await apiRequest('GET', `/uploads/farmers/${testFilename}`);
    assert(
      pubPhotoRes.status === 404,
      `Direct unauthenticated /uploads/farmers/${testFilename} returns 404 (status=${pubPhotoRes.status})`
    );

    // 1.2 Direct public access to /uploads root must return 404
    const pubUploadsRes = await apiRequest('GET', '/uploads');
    assert(
      pubUploadsRes.status === 404,
      `Direct unauthenticated /uploads returns 404 (status=${pubUploadsRes.status})`
    );

    // 1.3 Direct public access to non-existent /uploads/farmers path returns 404
    const pubGuessRes = await apiRequest('GET', '/uploads/farmers/some-guessed-photo.jpg');
    assert(
      pubGuessRes.status === 404,
      `Guessed /uploads/farmers URL returns 404 (status=${pubGuessRes.status})`
    );

    // =========================================================================
    // SECTION 2: UNAUTHENTICATED REQUEST REJECTION (401)
    // =========================================================================
    console.log('\n--- SECTION 2: UNAUTHENTICATED ACCESS ENFORCEMENT ---');

    // 2.1 Access /api/farmers/:id/photo without token -> 401
    const unauthIdRes = await apiRequest('GET', `/api/farmers/${farmerWithPhoto.id}/photo`);
    assert(
      unauthIdRes.status === 401 && unauthIdRes.data?.success === false,
      `GET /api/farmers/:id/photo without token rejected with 401 (status=${unauthIdRes.status})`
    );

    // 2.2 Access /api/farmers/photo/:filename without token -> 401
    const unauthFilenameRes = await apiRequest('GET', `/api/farmers/photo/${testFilename}`);
    assert(
      unauthFilenameRes.status === 401 && unauthFilenameRes.data?.success === false,
      `GET /api/farmers/photo/:filename without token rejected with 401 (status=${unauthFilenameRes.status})`
    );

    // 2.3 Access with invalid / forged token -> 401
    const invalidTokenRes = await apiRequest('GET', `/api/farmers/${farmerWithPhoto.id}/photo`, 'forged.invalid.token');
    assert(
      invalidTokenRes.status === 401,
      `Invalid token rejected with 401 (status=${invalidTokenRes.status})`
    );

    // =========================================================================
    // SECTION 3: ROLE-BASED ACCESS CONTROL (RBAC) (403)
    // =========================================================================
    console.log('\n--- SECTION 3: ROLE-BASED ACCESS CONTROL ---');

    // 3.1 SYSTEM_ADMIN role is prohibited from operational workflows
    const adminPhotoRes = await apiRequest('GET', `/api/farmers/${farmerWithPhoto.id}/photo`, adminToken);
    assert(
      adminPhotoRes.status === 403,
      `SYSTEM_ADMIN blocked from farmer photo by ID with 403 (status=${adminPhotoRes.status})`
    );

    const adminFilenameRes = await apiRequest('GET', `/api/farmers/photo/${testFilename}`, adminToken);
    assert(
      adminFilenameRes.status === 403,
      `SYSTEM_ADMIN blocked from farmer photo by filename with 403 (status=${adminFilenameRes.status})`
    );

    // =========================================================================
    // SECTION 4: AUTHORIZED PHOTO RETRIEVAL (200 OK & Proper Headers)
    // =========================================================================
    console.log('\n--- SECTION 4: AUTHORIZED PHOTO ACCESS & CONTENT INTEGRITY ---');

    // 4.1 AGRICULTURE_OFFICE retrieves photo by farmer ID
    const agriIdRes = await apiRequest('GET', `/api/farmers/${farmerWithPhoto.id}/photo`, agriToken);
    assert(
      agriIdRes.status === 200 && agriIdRes.contentType.includes('image/jpeg'),
      `AGRICULTURE_OFFICE retrieves photo by ID: 200 OK, Content-Type=${agriIdRes.contentType}`
    );
    assert(
      agriIdRes.headers.get('x-content-type-options') === 'nosniff',
      `Security header X-Content-Type-Options: nosniff present`
    );
    assert(
      agriIdRes.headers.get('cache-control')?.includes('private') === true,
      `Cache-Control header contains 'private'`
    );

    // 4.2 AGRICULTURE_OFFICE retrieves photo by farmerCode
    const agriCodeRes = await apiRequest('GET', `/api/farmers/${farmerWithPhoto.farmerCode}/photo`, agriToken);
    assert(
      agriCodeRes.status === 200 && agriCodeRes.contentType.includes('image/jpeg'),
      `AGRICULTURE_OFFICE retrieves photo by farmerCode (${farmerWithPhoto.farmerCode}): 200 OK`
    );

    // 4.3 TRADE_OFFICE retrieves photo by filename
    const tradeFileRes = await apiRequest('GET', `/api/farmers/photo/${testFilename}`, tradeToken);
    assert(
      tradeFileRes.status === 200 && tradeFileRes.contentType.includes('image/jpeg'),
      `TRADE_OFFICE retrieves photo by filename: 200 OK`
    );

    // 4.4 STATION_ADMIN retrieves photo during scanner verification
    const stationFileRes = await apiRequest('GET', `/api/farmers/photo/${testFilename}`, stationToken);
    assert(
      stationFileRes.status === 200 && stationFileRes.contentType.includes('image/jpeg'),
      `STATION_ADMIN retrieves photo for identity verification: 200 OK`
    );

    // 4.5 Query-parameter token retrieval (simulating browser <img> tag loading)
    const queryTokenRes = await apiRequest('GET', `/api/farmers/photo/${testFilename}?token=${agriToken}`);
    assert(
      queryTokenRes.status === 200 && queryTokenRes.contentType.includes('image/jpeg'),
      `Browser <img> retrieval via query token (?token=...): 200 OK`
    );

    // =========================================================================
    // SECTION 5: MISSING & INVALID IDENTIFIER HANDLING (404 & 400)
    // =========================================================================
    console.log('\n--- SECTION 5: MISSING & INVALID IDENTIFIER HANDLING ---');

    // 5.1 Farmer exists but has no photo uploaded
    const noPhotoRes = await apiRequest('GET', `/api/farmers/${farmerNoPhoto.id}/photo`, agriToken);
    assert(
      noPhotoRes.status === 404 && noPhotoRes.data?.message?.includes('no photo'),
      `Farmer with no photo returns 404 with explicit message (msg='${noPhotoRes.data?.message}')`
    );

    // 5.2 Non-existent farmer ID
    const notFoundFarmerRes = await apiRequest(
      'GET',
      '/api/farmers/00000000-0000-0000-0000-000000000000/photo',
      agriToken
    );
    assert(
      notFoundFarmerRes.status === 404 && notFoundFarmerRes.data?.message?.includes('Farmer not found'),
      `Non-existent farmer ID returns 404 (status=${notFoundFarmerRes.status})`
    );

    // 5.3 Photo not registered to any farmer in database
    const unlinkedPhotoRes = await apiRequest('GET', '/api/farmers/photo/farmer-photo-unlinked-9999.jpg', agriToken);
    assert(
      unlinkedPhotoRes.status === 404,
      `Unregistered photo filename returns 404 (status=${unlinkedPhotoRes.status})`
    );

    // =========================================================================
    // SECTION 6: DIRECTORY TRAVERSAL & ARBITRARY FILE ACCESS DEFENSE
    // =========================================================================
    console.log('\n--- SECTION 6: DIRECTORY TRAVERSAL & MALICIOUS INPUT DEFENSE ---');

    // 6.1 Basic dot-dot traversal attempt
    const dotDotRes = await apiRequest('GET', '/api/farmers/photo/../../package.json', agriToken);
    assert(
      dotDotRes.status === 400 || dotDotRes.status === 404,
      `Directory traversal (/../../package.json) rejected (status=${dotDotRes.status})`
    );

    // 6.2 URL-encoded traversal attempt (%2e%2e%2f)
    const encodedTraversalRes = await apiRequest('GET', '/api/farmers/photo/..%2f..%2fpackage.json', agriToken);
    assert(
      encodedTraversalRes.status === 400 || encodedTraversalRes.status === 404,
      `URL-encoded traversal (..%2f..%2fpackage.json) rejected (status=${encodedTraversalRes.status})`
    );

    // 6.3 Backslash traversal attempt (..\..\)
    const backslashTraversalRes = await apiRequest('GET', '/api/farmers/photo/..\\..\\package.json', agriToken);
    assert(
      backslashTraversalRes.status === 400 || backslashTraversalRes.status === 404,
      `Backslash traversal (..\\..\\package.json) rejected (status=${backslashTraversalRes.status})`
    );

    // 6.4 Malicious non-image extension attempt (.sh, .exe, .env)
    const dangerousExtRes = await apiRequest('GET', '/api/farmers/photo/exploit.sh', agriToken);
    assert(
      dangerousExtRes.status === 400 || dangerousExtRes.status === 404,
      `Malicious file extension (exploit.sh) rejected (status=${dangerousExtRes.status})`
    );

    // 6.5 Attempt to access server.ts or .env
    const envFileRes = await apiRequest('GET', '/api/farmers/photo/.env', agriToken);
    assert(
      envFileRes.status === 400 || envFileRes.status === 404,
      `Attempt to access .env rejected (status=${envFileRes.status})`
    );

    // =========================================================================
    // SECTION 7: PHOTO UPLOAD AND SUBSEQUENT SECURE RETRIEVAL FLOW
    // =========================================================================
    console.log('\n--- SECTION 7: PHOTO UPLOAD & END-TO-END WORKFLOW INTEGRITY ---');

    // 7.1 Upload new photo for farmerNoPhoto via multipart/form-data
    const boundary = '----WebKitFormBoundaryTest' + Date.now();
    const multipartBody = Buffer.concat([
      Buffer.from(
        `--${boundary}\r\n` +
        `Content-Disposition: form-data; name="photo"; filename="test_upload.jpg"\r\n` +
        `Content-Type: image/jpeg\r\n\r\n`
      ),
      DUMMY_JPEG_BUFFER,
      Buffer.from(`\r\n--${boundary}--\r\n`),
    ]);

    const uploadHeaders: Record<string, string> = {
      'Authorization': `Bearer ${agriToken}`,
      'Content-Type': `multipart/form-data; boundary=${boundary}`,
    };

    const uploadRes = await fetch(`${baseUrl}/api/farmers/${farmerNoPhoto.id}/photo`, {
      method: 'POST',
      headers: uploadHeaders,
      body: multipartBody,
    });
    const uploadData = await uploadRes.json();

    assert(
      uploadRes.status === 200 && uploadData.success === true,
      `Photo upload via POST /api/farmers/:id/photo succeeds (status=${uploadRes.status})`
    );

    if (uploadData.photoUrl) {
      const uploadedFilename = path.basename(uploadData.photoUrl);
      const uploadedDiskPath = path.join(uploadsFarmersDir, uploadedFilename);
      createdTestFiles.push(uploadedDiskPath);

      // 7.2 Immediately verify the newly uploaded photo can be retrieved via the secure endpoint
      const getUploadedPhotoRes = await apiRequest('GET', `/api/farmers/${farmerNoPhoto.id}/photo`, agriToken);
      assert(
        getUploadedPhotoRes.status === 200 && getUploadedPhotoRes.contentType.includes('image/jpeg'),
        `Newly uploaded photo securely retrievable via GET /api/farmers/:id/photo (status=${getUploadedPhotoRes.status})`
      );

      // 7.3 Verify newly uploaded photo is NOT accessible via public /uploads/farmers
      const publicCheckRes = await apiRequest('GET', uploadData.photoUrl);
      assert(
        publicCheckRes.status === 404,
        `Newly uploaded photo is BLOCKED from public static access (status=${publicCheckRes.status})`
      );
    }

    // =========================================================================
    // SECTION 8: PUBLIC USER AVATARS PRESERVED
    // =========================================================================
    console.log('\n--- SECTION 8: USER AVATAR SERVING FUNCTIONALITY PRESERVED ---');

    // Create dummy avatar if none exists to verify public avatar serving
    const avatarsDir = path.resolve(process.cwd(), 'uploads/avatars');
    if (!fs.existsSync(avatarsDir)) {
      fs.mkdirSync(avatarsDir, { recursive: true });
    }
    const testAvatarName = `avatar-p1t1-test-${Date.now()}.jpg`;
    const testAvatarPath = path.join(avatarsDir, testAvatarName);
    fs.writeFileSync(testAvatarPath, DUMMY_JPEG_BUFFER);
    createdTestFiles.push(testAvatarPath);

    const avatarRes = await apiRequest('GET', `/uploads/avatars/${testAvatarName}`);
    assert(
      avatarRes.status === 200 && avatarRes.contentType.includes('image'),
      `Public user avatar static serving preserved at /uploads/avatars/${testAvatarName} (status=${avatarRes.status})`
    );
  } catch (err: any) {
    console.error('Fatal error in Photo Security test suite:', err);
    failed++;
  } finally {
    // =========================================================================
    // CLEANUP EPHEMERAL TEST FIXTURES
    // =========================================================================
    console.log('\n--- CLEANUP: Removing test files and ephemeral records ---');
    try {
      if (ephemeralFarmerIds.length > 0) {
        await prisma.farmerCard.deleteMany({ where: { farmerId: { in: ephemeralFarmerIds } } });
        await prisma.farmer.deleteMany({ where: { id: { in: ephemeralFarmerIds } } });
      }
      if (ephemeralUserIds.length > 0) {
        await prisma.user.deleteMany({ where: { id: { in: ephemeralUserIds } } });
      }
      for (const filePath of createdTestFiles) {
        if (fs.existsSync(filePath)) {
          fs.unlinkSync(filePath);
        }
      }
      console.log('  ✓ Ephemeral test records and disk files safely purged.');
    } catch (cleanErr) {
      console.error('  ✗ Error cleaning up test records:', cleanErr);
    }

    if (server) {
      await new Promise<void>((resolve) => server!.close(() => resolve()));
      console.log('  ✓ Test HTTP server closed.');
    }

    await prisma.$disconnect();
    console.log('  ✓ Database disconnected.');

    console.log('\n================================================================================');
    console.log(`   PHOTO SECURITY TEST RESULTS: ${passed} PASSED | ${failed} FAILED            `);
    console.log('================================================================================\n');

    if (failed > 0) {
      process.exit(1);
    }
  }
}

runPhotoSecurityTests();
