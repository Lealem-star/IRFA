import dotenv from 'dotenv';
dotenv.config({ path: './server/.env' });
import prisma from '../config/db.js';
import { OFFICIAL_SUB_CITIES } from '../config/officialLocations.js';

export async function syncOfficialLocations() {
  console.log('--- STARTING SYNC OF OFFICIAL SUB-CITIES AND KEBELES ---');

  // 1. Get default Location (Bahir Dar Zuria & Lake Basin) for backwards compatibility
  let defaultLocation = await prisma.location.findFirst();
  if (!defaultLocation) {
    defaultLocation = await prisma.location.create({
      data: {
        name: 'Bahir Dar Zuria & Lake Basin',
        subCity: 'Bahir Dar Perimeter',
      },
    });
  }

  // 2. Upsert Sub-Cities
  const subCityMap = new Map<string, string>(); // code -> id

  for (const scDef of OFFICIAL_SUB_CITIES) {
    const sc = await prisma.subCity.upsert({
      where: { code: scDef.code },
      update: { name: scDef.name, nameAmharic: scDef.name },
      create: {
        code: scDef.code,
        name: scDef.name,
        nameAmharic: scDef.name,
      },
    });
    subCityMap.set(scDef.code, sc.id);
    console.log(`SubCity synced: ${sc.name} (${sc.code}) -> ID: ${sc.id}`);
  }

  // 3. Upsert 45 Kebeles
  let kebeleCount = 0;
  for (const scDef of OFFICIAL_SUB_CITIES) {
    const subCityId = subCityMap.get(scDef.code)!;

    for (const kbDef of scDef.kebeles) {
      const kb = await prisma.kebele.upsert({
        where: { code: kbDef.code },
        update: {
          name: kbDef.name,
          subCityId,
          locationId: defaultLocation.id,
        },
        create: {
          code: kbDef.code,
          name: kbDef.name,
          subCityId,
          locationId: defaultLocation.id,
        },
      });
      kebeleCount++;
    }
  }

  console.log(`Successfully synced ${kebeleCount} official kebeles across 4 sub-cities!`);

  // 4. Safely update existing farmers so their subCityId and kebele references are valid
  const farmers = await prisma.farmer.findMany({
    include: { kebele: true, irrigationProfile: true },
  });

  console.log(`Auditing and updating ${farmers.length} existing farmer records...`);

  // Mapping existing seed kebeles to official kebeles
  const tanaSubCityId = subCityMap.get('SC-TANA')!;
  const atseTewodrosSubCityId = subCityMap.get('SC-ATSE-TEWODROS')!;

  const weramitOfficial = await prisma.kebele.findUnique({ where: { code: 'KB-TANA-02' } });
  const shimbitOfficial = await prisma.kebele.findUnique({ where: { code: 'KB-TANA-11' } });
  const zenzelmaOfficial = await prisma.kebele.findUnique({ where: { code: 'KB-AT-06' } });
  const bataOfficial = await prisma.kebele.findUnique({ where: { code: 'KB-TANA-10' } });

  for (const f of farmers) {
    let targetSubCityId = f.subCityId;
    let targetKebeleId = f.kebeleId;

    if (!targetSubCityId) {
      const kebeleName = f.kebele?.name || '';
      if (kebeleName.includes('Weramit') && weramitOfficial) {
        targetSubCityId = tanaSubCityId;
        targetKebeleId = weramitOfficial.id;
      } else if (kebeleName.includes('Shimbit') && shimbitOfficial) {
        targetSubCityId = tanaSubCityId;
        targetKebeleId = shimbitOfficial.id;
      } else if (kebeleName.includes('Zenzelma') && zenzelmaOfficial) {
        targetSubCityId = atseTewodrosSubCityId;
        targetKebeleId = zenzelmaOfficial.id;
      } else if (kebeleName.includes('Tana') && bataOfficial) {
        targetSubCityId = tanaSubCityId;
        targetKebeleId = bataOfficial.id;
      } else {
        targetSubCityId = tanaSubCityId;
        if (bataOfficial) targetKebeleId = bataOfficial.id;
      }

      await prisma.farmer.update({
        where: { id: f.id },
        data: {
          subCityId: targetSubCityId,
          kebeleId: targetKebeleId,
          gender: f.gender || 'ወንድ',
          declaredFuelLiters: f.declaredFuelLiters || (f.irrigationProfile?.pumpFuelType === 'Diesel' ? 120 : 80),
        },
      });
      console.log(`Updated farmer ${f.farmerCode} (${f.fullName}) -> SubCity: ${targetSubCityId}, Kebele: ${targetKebeleId}`);
    }
  }

  console.log('--- SYNC AND COMPATIBILITY UPDATE COMPLETE ---');
}

// Run if called directly
if (process.argv[1]?.includes('syncOfficialLocations')) {
  syncOfficialLocations()
    .then(() => process.exit(0))
    .catch((err) => {
      console.error('Sync failed:', err);
      process.exit(1);
    });
}
