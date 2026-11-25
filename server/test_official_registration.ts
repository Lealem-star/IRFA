import dotenv from 'dotenv';
dotenv.config({ path: './server/.env' });

const API_URL = 'http://localhost:5000/api';

async function req(url: string, options: any = {}) {
  const res = await fetch(url, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...options.headers,
    },
    body: options.body ? JSON.stringify(options.body) : undefined,
  });

  const data = await res.json().catch(() => null);
  return { status: res.status, ok: res.ok, data };
}

async function runTests() {
  console.log('====================================================');
  console.log('   IRFA OFFICIAL AGRICULTURE REGISTRATION TEST SUITE');
  console.log('====================================================\n');

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

  // 1. Authenticate as Agriculture Officer
  console.log('1. Authenticating as Agriculture Officer...');
  const loginRes = await req(`${API_URL}/auth/login`, {
    method: 'POST',
    body: {
      username: 'agriculture',
      password: 'demo123',
    },
  });
  const token = loginRes.data?.token;
  const authHeaders = { Authorization: `Bearer ${token}` };
  assert(loginRes.ok && !!token, 'Agriculture officer successfully authenticated');

  // Authenticate as Station Admin for QR verification regression test
  const stationLoginRes = await req(`${API_URL}/auth/login`, {
    method: 'POST',
    body: {
      username: 'station',
      password: 'demo123',
    },
  });
  const stationToken = stationLoginRes.data?.token;
  const stationAuthHeaders = { Authorization: `Bearer ${stationToken}` };

  // 2. Location Tests
  console.log('\n2. Testing Official Sub-Cities & 45 Kebeles...');
  const subCitiesRes = await req(`${API_URL}/meta/sub-cities`, { headers: authHeaders });
  const subCities = subCitiesRes.data?.subCities || [];
  assert(subCities.length === 4, `Exactly 4 Sub-Cities returned (got ${subCities.length})`);

  const tana = subCities.find((s: any) => s.code === 'SC-TANA');
  const belay = subCities.find((s: any) => s.code === 'SC-BELAY-ZELEKE');
  const menelik = subCities.find((s: any) => s.code === 'SC-DAGMAWI-MENELIK');
  const tewodros = subCities.find((s: any) => s.code === 'SC-ATSE-TEWODROS');

  assert(tana && tana.kebeles?.length === 13, `ጣና ክፍለ ከተማ has exactly 13 locations (got ${tana?.kebeles?.length})`);
  assert(belay && belay.kebeles?.length === 10, `በላይ ዘለቀ ክፍለ ከተማ has exactly 10 locations (got ${belay?.kebeles?.length})`);
  assert(menelik && menelik.kebeles?.length === 11, `ዳግማዊ ምኒልክ ክፍለ ከተማ has exactly 11 locations (got ${menelik?.kebeles?.length})`);
  assert(tewodros && tewodros.kebeles?.length === 11, `አፄ ቴዎድሮስ ክፍለ ከተማ has exactly 11 locations (got ${tewodros?.kebeles?.length})`);

  const totalLocations =
    (tana?.kebeles?.length || 0) +
    (belay?.kebeles?.length || 0) +
    (menelik?.kebeles?.length || 0) +
    (tewodros?.kebeles?.length || 0);
  assert(totalLocations === 45, `Total locations count is exactly 45 (got ${totalLocations})`);

  // Verify duplicate named locations remain distinct records
  const midreGenetTana = tana?.kebeles?.find((k: any) => k.name === 'ምድረ ገነት ቀበሌ');
  const midreGenetMenelik = menelik?.kebeles?.find((k: any) => k.name === 'ምድረ ገነት ቀበሌ');
  assert(
    midreGenetTana && midreGenetMenelik && midreGenetTana.id !== midreGenetMenelik.id,
    'Duplicate "ምድረ ገነት ቀበሌ" across ጣና and ዳግማዊ ምኒልክ are separate records with unique IDs'
  );

  const addisAlemMenelik = menelik?.kebeles?.find((k: any) => k.name === 'አዲስ ዓለም ቀበሌ');
  const addisAlemTewodros = tewodros?.kebeles?.find((k: any) => k.name === 'አዲስ ዓለም ቀበሌ');
  assert(
    addisAlemMenelik && addisAlemTewodros && addisAlemMenelik.id !== addisAlemTewodros.id,
    'Duplicate "አዲስ ዓለም ቀበሌ" across ዳግማዊ ምኒልክ and አፄ ቴዎድሮስ are separate records with unique IDs'
  );

  // 3. Validation & Business Rule Rejections
  console.log('\n3. Testing Validation Rejections & Data Integrity...');

  // A. Missing Sub-City
  const rej1 = await req(`${API_URL}/farmers`, {
    method: 'POST',
    headers: authHeaders,
    body: {
      fullName: 'Test Missing SubCity',
      gender: 'ወንድ',
      kebeleId: tana.kebeles[0].id,
      landSizeHectares: 1.5,
      primaryCrops: 'Onion',
      pumpFuelType: 'Diesel',
      declaredFuelLiters: 80,
      phone: '+251911001122',
    },
  });
  assert(rej1.status === 400, 'Rejects registration when subCityId is missing (HTTP 400)');

  // B. Missing Gender
  const rej2 = await req(`${API_URL}/farmers`, {
    method: 'POST',
    headers: authHeaders,
    body: {
      fullName: 'Test Missing Gender',
      subCityId: tana.id,
      kebeleId: tana.kebeles[0].id,
      landSizeHectares: 1.5,
      primaryCrops: 'Onion',
      pumpFuelType: 'Diesel',
      declaredFuelLiters: 80,
      phone: '+251911001122',
    },
  });
  assert(rej2.status === 400, 'Rejects registration when gender is missing (HTTP 400)');

  // C. Negative or Zero Farm Size
  const rej3 = await req(`${API_URL}/farmers`, {
    method: 'POST',
    headers: authHeaders,
    body: {
      fullName: 'Test Invalid Land',
      gender: 'ወንድ',
      subCityId: tana.id,
      kebeleId: tana.kebeles[0].id,
      landSizeHectares: -0.5,
      primaryCrops: 'Onion',
      pumpFuelType: 'Diesel',
      declaredFuelLiters: 80,
      phone: '+251911001122',
    },
  });
  assert(rej3.status === 400, 'Rejects registration when farm size is negative or zero (HTTP 400)');

  // D. Negative or Zero Declared Fuel Liters
  const rej4 = await req(`${API_URL}/farmers`, {
    method: 'POST',
    headers: authHeaders,
    body: {
      fullName: 'Test Invalid Fuel Liters',
      gender: 'ሴት',
      subCityId: tana.id,
      kebeleId: tana.kebeles[0].id,
      landSizeHectares: 1.0,
      primaryCrops: 'Tomato',
      pumpFuelType: 'Diesel',
      declaredFuelLiters: 0,
      phone: '+251911001122',
    },
  });
  assert(rej4.status === 400, 'Rejects registration when declared fuel liters <= 0 (HTTP 400)');

  // E. Wrong Sub-City & Kebele combination
  const rej5 = await req(`${API_URL}/farmers`, {
    method: 'POST',
    headers: authHeaders,
    body: {
      fullName: 'Test Mismatched Location',
      gender: 'ወንድ',
      subCityId: tana.id, // ጣና
      kebeleId: tewodros.kebeles[0].id, // አፄ ቴዎድሮስ location!
      landSizeHectares: 2.0,
      primaryCrops: 'Potato',
      pumpFuelType: 'Diesel',
      declaredFuelLiters: 100,
      phone: '+251911001122',
    },
  });
  assert(
    rej5.status === 400 && rej5.data?.message?.includes('Selected Kebele does not belong'),
    'Backend rejects mismatched Sub-City / Kebele combination (HTTP 400)'
  );

  // 4. Successful Beneficiary Farmer Registrations
  console.log('\n4. Testing Successful Beneficiary Registrations Across All 4 Sub-Cities...');

  // Farmer A: ጣና (Diesel, Male, 1.75 ha, 120 L)
  const weramitKebele = tana.kebeles.find((k: any) => k.name === 'ወራሚት ቀበሌ')!;
  const regARes = await req(`${API_URL}/farmers`, {
    method: 'POST',
    headers: authHeaders,
    body: {
      fullName: 'ሙሉቀን ደሳለኝ',
      gender: 'ወንድ',
      subCityId: tana.id,
      kebeleId: weramitKebele.id,
      landSizeHectares: 1.75,
      primaryCrops: 'ሽንኩርት እና ቲማቲም',
      pumpFuelType: 'Diesel',
      declaredFuelLiters: 120.0,
      phone: '+251918112233',
      nationalId: `ETH-BD-2026-${Date.now().toString().slice(-4)}`,
    },
  });
  assert(regARes.ok && regARes.data?.success, 'Registered farmer in ጣና ክፍለ ከተማ (ወራሚት ቀበሌ, Diesel, 1.75 ha, 120 L)');
  const farmerA = regARes.data?.farmer;

  // Farmer B: በላይ ዘለቀ (Benzene, Female, 0.85 ha, 65 L)
  const regBRes = await req(`${API_URL}/farmers`, {
    method: 'POST',
    headers: authHeaders,
    body: {
      fullName: 'ወርቅነሽ አለሙ',
      gender: 'ሴት',
      subCityId: belay.id,
      kebeleId: belay.kebeles[2].id, // ብስራት ቀበሌ
      landSizeHectares: 0.85,
      primaryCrops: 'ቃሪያ እና አትክልት',
      pumpFuelType: 'Benzene',
      declaredFuelLiters: 65.5,
      phone: '+251922334455',
      nationalId: `ETH-BD-2026-${(Date.now() + 1).toString().slice(-4)}`,
    },
  });
  assert(regBRes.ok && regBRes.data?.success, 'Registered farmer in በላይ ዘለቀ ክፍለ ከተማ (ብስራት ቀበሌ, Benzene, 0.85 ha, 65.5 L)');

  // Farmer C: ዳግማዊ ምኒልክ (Diesel, Female, 2.50 ha, 150 L)
  const regCRes = await req(`${API_URL}/farmers`, {
    method: 'POST',
    headers: authHeaders,
    body: {
      fullName: 'ታሪኳ መንግስቱ',
      gender: 'ሴት',
      subCityId: menelik.id,
      kebeleId: menelik.kebeles[0].id, // ሰላም ቀበሌ
      landSizeHectares: 2.5,
      primaryCrops: 'በቆሎ እና ድንች',
      pumpFuelType: 'Diesel',
      declaredFuelLiters: 150.0,
      phone: '+251933445566',
    },
  });
  assert(regCRes.ok && regCRes.data?.success, 'Registered farmer in ዳግማዊ ምኒልክ ክፍለ ከተማ (ሰላም ቀበሌ, Diesel, 2.5 ha, 150 L)');

  // Farmer D: አፄ ቴዎድሮስ (Diesel, Male, 3.25 ha, 200 L)
  const regDRes = await req(`${API_URL}/farmers`, {
    method: 'POST',
    headers: authHeaders,
    body: {
      fullName: 'ጌታቸው በለጠ',
      gender: 'ወንድ',
      subCityId: tewodros.id,
      kebeleId: tewodros.kebeles[5].id, // ዘንዘልማ ቀበሌ
      landSizeHectares: 3.25,
      primaryCrops: 'ቲማቲም እና ጎመን',
      pumpFuelType: 'Diesel',
      declaredFuelLiters: 200.0,
      phone: '+251944556677',
    },
  });
  assert(regDRes.ok && regDRes.data?.success, 'Registered farmer in አፄ ቴዎድሮስ ክፍለ ከተማ (ዘንዘልማ ቀበሌ, Diesel, 3.25 ha, 200 L)');

  // 5. Verification of Saved Data & Persistence
  console.log('\n5. Testing Profile Dossier & Field Persistence...');
  const dossierRes = await req(`${API_URL}/farmers/${farmerA.id}`, { headers: authHeaders });
  const dossier = dossierRes.data?.farmer;

  assert(dossier?.fullName === 'ሙሉቀን ደሳለኝ', `Name preserved exactly: ${dossier?.fullName}`);
  assert(dossier?.gender === 'ወንድ', `Gender saved correctly: ${dossier?.gender}`);
  assert(dossier?.subCity?.name === 'ጣና ክፍለ ከተማ', `Sub-City linked: ${dossier?.subCity?.name}`);
  assert(dossier?.kebele?.name === 'ወራሚት ቀበሌ', `Kebele linked: ${dossier?.kebele?.name}`);
  assert(Number(dossier?.declaredFuelLiters) === 120, `Declared Fuel Requirement preserved: ${dossier?.declaredFuelLiters} L`);
  assert(Number(dossier?.irrigationProfile?.landSizeHectares) === 1.75, `Farm size decimal preserved: ${dossier?.irrigationProfile?.landSizeHectares} ha`);
  assert(dossier?.irrigationProfile?.primaryCrops === 'ሽንኩርት እና ቲማቲም', `Crop type preserved: ${dossier?.irrigationProfile?.primaryCrops}`);
  assert(dossier?.cards?.length > 0 && dossier.cards[0].status === 'ACTIVE', `Active QR card auto-generated: ${dossier?.cards?.[0]?.cardSerialNumber}`);

  // 6. Regression: Filter & Search
  console.log('\n6. Testing Listing, Filter & Search...');
  const searchRes = await req(`${API_URL}/farmers?search=ሙሉቀን`, { headers: authHeaders });
  assert(searchRes.data?.data?.length >= 1 && searchRes.data?.data[0].fullName.includes('ሙሉቀን'), 'Farmer search by Amharic name works');

  const subCityFilterRes = await req(`${API_URL}/farmers?subCityId=${belay.id}`, { headers: authHeaders });
  assert(
    subCityFilterRes.data?.data?.every((f: any) => f.subCityId === belay.id),
    'Farmer listing filtered by Sub-City returns only farmers in that Sub-City'
  );

  // 7. Regression: QR Verification & Fuel Workflow Rule
  console.log('\n7. Testing Station QR Verification Workflow & Fuel Allocation Rule...');
  const qrTokenNew = farmerA.cards[0].qrToken;
  const qrVerifyNewRes = await req(
    `${API_URL}/verification/verify`,
    {
      method: 'POST',
      headers: stationAuthHeaders,
      body: { qrTokenOrCode: qrTokenNew },
    }
  );

  assert(
    (qrVerifyNewRes.status === 404 || qrVerifyNewRes.status === 403) &&
      (qrVerifyNewRes.data?.rejectionReason?.includes('authorization') ||
        qrVerifyNewRes.data?.rejectionReason?.includes('quota')),
    'New farmer without Trade authorization is rejected at station (Section 6 rule: registration does NOT auto-grant fuel quota)'
  );

  // Test an authorized farmer (FR-00124) with active station assignment
  const qrVerifyAuthRes = await req(
    `${API_URL}/verification/verify`,
    {
      method: 'POST',
      headers: stationAuthHeaders,
      body: { qrTokenOrCode: 'FR-00124' },
    }
  );

  assert(
    qrVerifyAuthRes.ok && qrVerifyAuthRes.data?.verified,
    'Legitimately authorized farmer (FR-00124) verified successfully at Fuel Station'
  );
  assert(
    qrVerifyAuthRes.data?.data?.farmer?.subCity === 'ጣና ክፍለ ከተማ',
    `Authorized farmer returns official Sub-City: ${qrVerifyAuthRes.data?.data?.farmer?.subCity}`
  );
  assert(
    qrVerifyAuthRes.data?.data?.farmer?.kebele === 'ባታ ቀበሌ' || !!qrVerifyAuthRes.data?.data?.farmer?.kebele,
    `Authorized farmer returns official Kebele: ${qrVerifyAuthRes.data?.data?.farmer?.kebele}`
  );

  console.log('\n====================================================');
  console.log(`   TOTAL TESTS: ${passed + failed} | PASSED: ${passed} | FAILED: ${failed}`);
  console.log('====================================================\n');

  if (failed > 0) {
    process.exit(1);
  }
}

runTests()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error('Test Suite encountered fatal error:', err);
    process.exit(1);
  });
