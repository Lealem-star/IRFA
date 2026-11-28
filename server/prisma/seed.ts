import {
  PrismaClient,
  UserRole,
  EligibilityStatus,
  WaterSource,
  CardStatus,
  RequestStatus,
  ItemStatus,
  AuthStatus,
  AssignmentStatus,
  TransactionStatus,
  VerificationResult,
} from '@prisma/client';
import bcrypt from 'bcryptjs';
import { OFFICIAL_STATIONS_MASTER } from '../src/config/officialStations.js';
import { OFFICIAL_SUB_CITIES } from '../src/config/officialLocations.js';

const prisma = new PrismaClient();

async function main() {
  // CRITICAL SAFETY GUARD: Prevent accidental execution in production environment
  if (process.env.NODE_ENV === 'production' && !process.env.FORCE_PRODUCTION_SEED) {
    console.error('CRITICAL ABORT: seed.ts execution blocked because NODE_ENV=production.');
    console.error('This script wipes database tables. It must NEVER run in a live government production deployment.');
    process.exit(1);
  }

  console.log('Seeding IRFA Database for Bahir Dar City Administration...');

  // 0. Clean existing tables in strict reverse order of foreign keys
  await prisma.verificationLog.deleteMany();
  await prisma.fuelTransaction.deleteMany();
  await prisma.stationAssignment.deleteMany();
  await prisma.stationSubCityAssignment.deleteMany();
  await prisma.fuelAuthorization.deleteMany();
  await prisma.fuelRequestHistory.deleteMany();
  await prisma.fuelRequestItem.deleteMany();
  await prisma.fuelRequest.deleteMany();
  await prisma.fuelShortage.deleteMany();
  await prisma.monthlyAllocation.deleteMany();
  await prisma.farmerCard.deleteMany();
  await prisma.farmerIrrigationProfile.deleteMany();
  await prisma.farmer.deleteMany();
  await prisma.kebele.deleteMany();
  await prisma.location.deleteMany();
  await prisma.subCity.deleteMany();
  await prisma.fuelType.deleteMany();
  await prisma.auditLog.deleteMany();
  await prisma.systemSetting.deleteMany();
  await prisma.user.deleteMany();
  await prisma.fuelStation.deleteMany();
  await prisma.office.deleteMany();

  // 1. Create Municipal Offices
  const agriOffice = await prisma.office.create({
    data: {
      code: 'BD-AGRI',
      name: 'Bahir Dar Agriculture Department',
      nameAmharic: 'ባህር ዳር ግብርና መምሪያ',
      type: 'AGRICULTURE',
    },
  });

  const tradeOffice = await prisma.office.create({
    data: {
      code: 'BD-TRADE',
      name: 'Bahir Dar Trade & Market Development Office',
      nameAmharic: 'ባህር ዳር ንግድና ገበያ ልማት መምሪያ',
      type: 'TRADE',
    },
  });

  const adminOffice = await prisma.office.create({
    data: {
      code: 'BD-ADMIN',
      name: 'Bahir Dar City Administration Bureau',
      nameAmharic: 'ባህር ዳር ከተማ አስተዳደር ቢሮ',
      type: 'ADMINISTRATION',
    },
  });

  // 2. Create Official Fuel Stations (Reconciled Official Roster: 21 Stations)
  const stationsMap = new Map<string, any>();
  for (const def of OFFICIAL_STATIONS_MASTER) {
    const st = await prisma.fuelStation.create({
      data: {
        code: def.assignedCode,
        name: def.officialName,
        nameAmharic: def.nameAmharic || null,
        company: def.company || null,
        location: def.location || 'Bahir Dar',
        contactPerson: 'Station Manager',
        phone: '+251 918 000 000',
        licenseNumber: `BD-LIC-${def.assignedCode}`,
        isActive: true,
      },
    });
    stationsMap.set(def.assignedCode, st);
  }
  console.log(`Seeded ${stationsMap.size} official Bahir Dar fuel stations.`);

  const stationGhion = stationsMap.get('BD-ST-01')!;
  const stationAbayBus = stationsMap.get('BD-ST-02')!;

  // 3. Create Core Administrative & Station Users
  const passwordHash = await bcrypt.hash('demo123', 10);

  const userAgri = await prisma.user.create({
    data: {
      username: 'agriculture',
      email: 'agri.officer@bahirdar.gov.et',
      passwordHash,
      fullName: 'Agriculture Office Officer',
      role: UserRole.AGRICULTURE_OFFICE,
      officeId: agriOffice.id,
      isActive: true,
    },
  });

  const userTrade = await prisma.user.create({
    data: {
      username: 'trade',
      email: 'trade.officer@bahirdar.gov.et',
      passwordHash,
      fullName: 'Trade Office Officer',
      role: UserRole.TRADE_OFFICE,
      officeId: tradeOffice.id,
      isActive: true,
    },
  });

  const userStation = await prisma.user.create({
    data: {
      username: 'station',
      email: 'station.admin@ghionpetroleum.et',
      passwordHash,
      fullName: 'Ghion Fuel Station Operator',
      role: UserRole.STATION_ADMIN,
      fuelStationId: stationGhion.id,
      isActive: true,
    },
  });

  const userAdmin = await prisma.user.create({
    data: {
      username: 'admin',
      email: 'sysadmin@bahirdar.gov.et',
      passwordHash,
      fullName: 'City Administration System Admin',
      role: UserRole.SYSTEM_ADMIN,
      officeId: adminOffice.id,
      isActive: true,
    },
  });

  // 4. Create Locations, Official Sub-Cities (4) and Official Kebeles (45)
  const defaultLocation = await prisma.location.create({
    data: {
      name: 'Bahir Dar Zuria & Lake Basin',
      subCity: 'Bahir Dar Perimeter',
    },
  });

  const subCityMap = new Map<string, any>();
  const kebeleMap = new Map<string, any>();

  for (const scDef of OFFICIAL_SUB_CITIES) {
    const sc = await prisma.subCity.create({
      data: {
        code: scDef.code,
        name: scDef.name,
        nameAmharic: scDef.name,
      },
    });
    subCityMap.set(scDef.code, sc);

    for (const kbDef of scDef.kebeles) {
      const kb = await prisma.kebele.create({
        data: {
          code: kbDef.code,
          name: kbDef.name,
          subCityId: sc.id,
          locationId: defaultLocation.id,
        },
      });
      kebeleMap.set(kbDef.code, kb);
    }
  }
  console.log(`Seeded ${subCityMap.size} official sub-cities and ${kebeleMap.size} official kebeles.`);

  // 5. Deterministic Station-to-SubCity Allocations (StationSubCityAssignment)
  // Mapping the 21 official stations across the 4 official sub-cities to ensure 100% municipal coverage
  const subCityStationCodes: Record<string, string[]> = {
    'SC-TANA': ['BD-ST-01', 'BD-ST-07', 'BD-ST-08', 'BD-ST-14', 'BD-ST-19'],
    'SC-BELAY-ZELEKE': ['BD-ST-04', 'BD-ST-05', 'BD-ST-12', 'BD-ST-17', 'BD-ST-21'],
    'SC-DAGMAWI-MENELIK': ['BD-ST-06', 'BD-ST-09', 'BD-ST-13', 'BD-ST-16', 'BD-ST-18', 'BD-ST-22'],
    'SC-ATSE-TEWODROS': ['BD-ST-02', 'BD-ST-10', 'BD-ST-11', 'BD-ST-15', 'BD-ST-20'],
  };

  let assignmentCount = 0;
  for (const [subCityCode, stationCodes] of Object.entries(subCityStationCodes)) {
    const sc = subCityMap.get(subCityCode);
    if (!sc) continue;

    for (const stCode of stationCodes) {
      const st = stationsMap.get(stCode);
      if (!st) continue;

      await prisma.stationSubCityAssignment.create({
        data: {
          subCityId: sc.id,
          fuelStationId: st.id,
          assignedById: userTrade.id,
          status: AssignmentStatus.ACTIVE,
          notes: `Official Trade Office allocation for ${sc.name}`,
        },
      });
      assignmentCount++;
    }
  }
  console.log(`Seeded ${assignmentCount} deterministic station-to-subcity assignments across all 4 sub-cities.`);

  // 6. Create Official Fuel Types
  const diesel = await prisma.fuelType.create({
    data: {
      name: 'Diesel',
      nameAmharic: 'ናፍጣ',
      code: 'DIESEL',
      unit: 'Liters',
      currentPricePerLiter: 104.5,
      isActive: true,
    },
  });

  const benzene = await prisma.fuelType.create({
    data: {
      name: 'Benzene',
      nameAmharic: 'ቤንዚን',
      code: 'BENZENE',
      unit: 'Liters',
      currentPricePerLiter: 115.2,
      isActive: true,
    },
  });

  // 7. Create Farmers with Irrigation Profiles and Cards
  const scTana = subCityMap.get('SC-TANA')!;
  const scAtse = subCityMap.get('SC-ATSE-TEWODROS')!;
  const scDagmawi = subCityMap.get('SC-DAGMAWI-MENELIK')!;
  const scBelay = subCityMap.get('SC-BELAY-ZELEKE')!;

  const kbChenta = kebeleMap.get('KB-TANA-01')!;
  const kbWeramit = kebeleMap.get('KB-TANA-02')!;
  const kbShimbit = kebeleMap.get('KB-TANA-11')!;
  const kbZenzelma = kebeleMap.get('KB-AT-06')!;
  const kbSelam = kebeleMap.get('KB-DM-01')!;
  const kbSebatAmit = kebeleMap.get('KB-BZ-04')!;

  // Farmer 1: Abebe Tesfaye (Eligible, Diesel, Card Issued, SC-TANA, Station BD-ST-01)
  const farmer1 = await prisma.farmer.create({
    data: {
      farmerCode: 'FR-00124',
      fullName: 'Abebe Tesfaye',
      phone: '+251 918 112 233',
      nationalId: 'ETH-BD-2024-1001',
      subCityId: scTana.id,
      kebeleId: kbChenta.id,
      eligibilityStatus: EligibilityStatus.ELIGIBLE,
      isActive: true,
      irrigationProfile: {
        create: {
          landSizeHectares: 3.5,
          waterSource: WaterSource.LAKE_TANA,
          waterSourceDetail: 'Direct Lake Tana suction channel',
          pumpFuelType: 'Diesel',
          pumpHorsepower: '12 HP',
          pumpModel: 'Changfa CF1100 Single Cylinder',
          primaryCrops: 'Onion, Tomato, Maize',
          irrigationSeason: 'Bega / Dry Season 2026',
        },
      },
      cards: {
        create: {
          cardSerialNumber: 'BD-CARD-2026-00124',
          qrToken: 'QR-FR-00124-ABEBE-BD-SECURE',
          status: CardStatus.ACTIVE,
          issuedAt: new Date('2026-01-10'),
        },
      },
    },
  });

  // Farmer 2: Mulugeta Kebede (Eligible, Benzene, Card Issued, SC-ATSE-TEWODROS, Station BD-ST-02)
  const farmer2 = await prisma.farmer.create({
    data: {
      farmerCode: 'FR-00125',
      fullName: 'Mulugeta Kebede',
      phone: '+251 918 223 344',
      nationalId: 'ETH-BD-2024-1002',
      subCityId: scAtse.id,
      kebeleId: kbZenzelma.id,
      eligibilityStatus: EligibilityStatus.ELIGIBLE,
      isActive: true,
      irrigationProfile: {
        create: {
          landSizeHectares: 2.0,
          waterSource: WaterSource.BLUE_NILE,
          waterSourceDetail: 'Upper Abay River diversion canal',
          pumpFuelType: 'Benzene',
          pumpHorsepower: '7.5 HP',
          pumpModel: 'Honda GX200 High Flow',
          primaryCrops: 'Pepper, Cabbage, Garlic',
          irrigationSeason: 'Bega / Dry Season 2026',
        },
      },
      cards: {
        create: {
          cardSerialNumber: 'BD-CARD-2026-00125',
          qrToken: 'QR-FR-00125-MULUGETA-BD-SECURE',
          status: CardStatus.ACTIVE,
          issuedAt: new Date('2026-01-12'),
        },
      },
    },
  });

  // Farmer 3: Hana Worku (Under Review, Diesel, Card Pending, SC-DAGMAWI-MENELIK)
  const farmer3 = await prisma.farmer.create({
    data: {
      farmerCode: 'FR-00126',
      fullName: 'Hana Worku',
      phone: '+251 918 334 455',
      nationalId: 'ETH-BD-2024-1003',
      subCityId: scDagmawi.id,
      kebeleId: kbSelam.id,
      eligibilityStatus: EligibilityStatus.UNDER_REVIEW,
      isActive: true,
      irrigationProfile: {
        create: {
          landSizeHectares: 2.8,
          waterSource: WaterSource.RIVER_DIVERSION,
          waterSourceDetail: 'Shumeta stream weir',
          pumpFuelType: 'Diesel',
          pumpHorsepower: '10 HP',
          pumpModel: 'Kirloskar DM10',
          primaryCrops: 'Potato, Onion',
          irrigationSeason: 'Bega / Dry Season 2026',
        },
      },
      cards: {
        create: {
          cardSerialNumber: 'BD-CARD-2026-00126',
          qrToken: 'QR-FR-00126-HANA-BD-PENDING',
          status: CardStatus.PENDING,
          issuedAt: new Date('2026-02-01'),
        },
      },
    },
  });

  // Farmer 4: Kassahun Alemu (Suspended, Diesel, Card Deactivated, SC-TANA)
  const farmer4 = await prisma.farmer.create({
    data: {
      farmerCode: 'FR-00127',
      fullName: 'Kassahun Alemu',
      phone: '+251 918 445 566',
      nationalId: 'ETH-BD-2024-1004',
      subCityId: scTana.id,
      kebeleId: kbWeramit.id,
      eligibilityStatus: EligibilityStatus.SUSPENDED,
      isActive: false,
      suspensionReason: 'Land tenure verification inquiry and quota diversion audit',
      irrigationProfile: {
        create: {
          landSizeHectares: 4.0,
          waterSource: WaterSource.LAKE_TANA,
          waterSourceDetail: 'Shoreline pump basin',
          pumpFuelType: 'Diesel',
          pumpHorsepower: '14 HP',
          pumpModel: 'Lister Petter ST2',
          primaryCrops: 'Sugarcane, Khat',
          irrigationSeason: 'Bega / Dry Season 2026',
        },
      },
      cards: {
        create: {
          cardSerialNumber: 'BD-CARD-2026-00127',
          qrToken: 'QR-FR-00127-KASSAHUN-BD-DEACTIVATED',
          status: CardStatus.DEACTIVATED,
          issuedAt: new Date('2025-11-15'),
          deactivatedAt: new Date('2026-10-10'),
          deactivationReason: 'Suspended by Agriculture Office order',
        },
      },
    },
  });

  // Farmer 5: Almaz Tadesse (Eligible, Benzene, Card Active, SC-BELAY-ZELEKE)
  const farmer5 = await prisma.farmer.create({
    data: {
      farmerCode: 'FR-00128',
      fullName: 'Almaz Tadesse',
      phone: '+251 918 556 677',
      nationalId: 'ETH-BD-2024-1005',
      subCityId: scBelay.id,
      kebeleId: kbSebatAmit.id,
      eligibilityStatus: EligibilityStatus.ELIGIBLE,
      isActive: true,
      irrigationProfile: {
        create: {
          landSizeHectares: 1.5,
          waterSource: WaterSource.BOREHOLE,
          waterSourceDetail: 'Community solar/generator deep well',
          pumpFuelType: 'Benzene',
          pumpHorsepower: '6.5 HP',
          pumpModel: 'Robin Subaru EY20',
          primaryCrops: 'Carrot, Beetroot, Swiss Chard',
          irrigationSeason: 'Bega / Dry Season 2026',
        },
      },
      cards: {
        create: {
          cardSerialNumber: 'BD-CARD-2026-00128',
          qrToken: 'QR-FR-00128-ALMAZ-BD-SECURE',
          status: CardStatus.ACTIVE,
          issuedAt: new Date('2026-01-20'),
        },
      },
    },
  });

  // Farmer 6: Demissew Belay (Eligible, Diesel, Card Active, SC-TANA)
  const farmer6 = await prisma.farmer.create({
    data: {
      farmerCode: 'FR-00129',
      fullName: 'Demissew Belay',
      phone: '+251 918 667 788',
      nationalId: 'ETH-BD-2024-1006',
      subCityId: scTana.id,
      kebeleId: kbShimbit.id,
      eligibilityStatus: EligibilityStatus.ELIGIBLE,
      isActive: true,
      irrigationProfile: {
        create: {
          landSizeHectares: 5.2,
          waterSource: WaterSource.LAKE_TANA,
          waterSourceDetail: 'Main municipal irrigation feed canal',
          pumpFuelType: 'Diesel',
          pumpHorsepower: '16 HP',
          pumpModel: 'Changfa CF1115 High Output',
          primaryCrops: 'Wheat, Onion, Maize',
          irrigationSeason: 'Bega / Dry Season 2026',
        },
      },
      cards: {
        create: {
          cardSerialNumber: 'BD-CARD-2026-00129',
          qrToken: 'QR-FR-00129-DEMISSEW-BD-SECURE',
          status: CardStatus.ACTIVE,
          issuedAt: new Date('2026-01-25'),
        },
      },
    },
  });

  // 8. Monthly Fuel Allocations (November 2026)
  await prisma.monthlyAllocation.createMany({
    data: [
      {
        farmerId: farmer1.id,
        fuelTypeId: diesel.id,
        month: 11,
        year: 2026,
        allocatedLiters: 200.0,
        usedLiters: 80.0,
        remainingLiters: 120.0,
        notes: 'Monthly irrigation quota based on 3.5 ha',
      },
      {
        farmerId: farmer2.id,
        fuelTypeId: benzene.id,
        month: 11,
        year: 2026,
        allocatedLiters: 150.0,
        usedLiters: 40.0,
        remainingLiters: 110.0,
        notes: 'Monthly irrigation quota based on 2.0 ha',
      },
      {
        farmerId: farmer3.id,
        fuelTypeId: diesel.id,
        month: 11,
        year: 2026,
        allocatedLiters: 180.0,
        usedLiters: 0.0,
        remainingLiters: 180.0,
        notes: 'Allocation pending review resolution',
      },
      {
        farmerId: farmer5.id,
        fuelTypeId: benzene.id,
        month: 11,
        year: 2026,
        allocatedLiters: 100.0,
        usedLiters: 0.0,
        remainingLiters: 100.0,
        notes: 'Monthly allocation for Sebat Amit Kebele group',
      },
      {
        farmerId: farmer6.id,
        fuelTypeId: diesel.id,
        month: 11,
        year: 2026,
        allocatedLiters: 300.0,
        usedLiters: 50.0,
        remainingLiters: 250.0,
        notes: 'Monthly allocation for large farm cooperative',
      },
    ],
  });

  // 9. Fuel Requests to Trade Office
  // Request A: TR-2026-040 (Approved request with Authorizations and Station Assignments)
  const reqApproved = await prisma.fuelRequest.create({
    data: {
      requestNumber: 'TR-2026-040',
      periodMonth: 11,
      periodYear: 2026,
      title: 'Tana & Atse Tewodros Kebeles Monthly Fuel Request',
      totalFarmersCount: 94,
      totalLitersRequested: 9200.0,
      totalLitersApproved: 9200.0,
      status: RequestStatus.APPROVED,
      submittedById: userAgri.id,
      submittedAt: new Date('2026-11-05T09:30:00Z'),
      reviewedById: userTrade.id,
      reviewedAt: new Date('2026-11-07T14:15:00Z'),
      reviewRemarks: 'Approved in full following quota validation against verified land records.',
    },
  });

  const reqItem1 = await prisma.fuelRequestItem.create({
    data: {
      fuelRequestId: reqApproved.id,
      farmerId: farmer1.id,
      fuelTypeId: diesel.id,
      requestedLiters: 200.0,
      approvedLiters: 200.0,
      itemStatus: ItemStatus.APPROVED,
      remarks: 'Verified 3.5 ha Diesel pump',
    },
  });

  const reqItem2 = await prisma.fuelRequestItem.create({
    data: {
      fuelRequestId: reqApproved.id,
      farmerId: farmer2.id,
      fuelTypeId: benzene.id,
      requestedLiters: 150.0,
      approvedLiters: 150.0,
      itemStatus: ItemStatus.APPROVED,
      remarks: 'Verified 2.0 ha Benzene pump',
    },
  });

  // Create Fuel Authorizations for Approved Items
  const auth1 = await prisma.fuelAuthorization.create({
    data: {
      authCode: 'AUTH-202611-00124',
      fuelRequestId: reqApproved.id,
      fuelRequestItemId: reqItem1.id,
      farmerId: farmer1.id,
      fuelTypeId: diesel.id,
      authorizedLiters: 200.0,
      consumedLiters: 80.0,
      remainingLiters: 120.0,
      validFrom: new Date('2026-11-01T00:00:00Z'),
      validTo: new Date('2026-11-30T23:59:59Z'),
      status: AuthStatus.ACTIVE,
      remarks: 'Authorized for Ghion Fuel Station dispensing',
    },
  });

  const auth2 = await prisma.fuelAuthorization.create({
    data: {
      authCode: 'AUTH-202611-00125',
      fuelRequestId: reqApproved.id,
      fuelRequestItemId: reqItem2.id,
      farmerId: farmer2.id,
      fuelTypeId: benzene.id,
      authorizedLiters: 150.0,
      consumedLiters: 40.0,
      remainingLiters: 110.0,
      validFrom: new Date('2026-11-01T00:00:00Z'),
      validTo: new Date('2026-11-30T23:59:59Z'),
      status: AuthStatus.ACTIVE,
      remarks: 'Authorized for Total Abay Bus Station dispensing',
    },
  });

  // Station Authorization Assignments
  await prisma.stationAssignment.create({
    data: {
      fuelAuthorizationId: auth1.id,
      fuelStationId: stationGhion.id,
      assignedById: userTrade.id,
      status: AssignmentStatus.ACTIVE,
      notes: 'Assigned to Ghion Station for convenient farmer collection',
    },
  });

  await prisma.stationAssignment.create({
    data: {
      fuelAuthorizationId: auth2.id,
      fuelStationId: stationAbayBus.id,
      assignedById: userTrade.id,
      status: AssignmentStatus.ACTIVE,
      notes: 'Assigned to Total Abay Bus Station for Atse Tewodros farmers',
    },
  });

  // Request B: TR-2026-041 (Submitted, awaiting Trade review)
  const reqSubmitted = await prisma.fuelRequest.create({
    data: {
      requestNumber: 'TR-2026-041',
      periodMonth: 11,
      periodYear: 2026,
      title: 'Dagmawi Menelik & Belay Zeleke Kebeles Fuel Allocation Phase II',
      totalFarmersCount: 128,
      totalLitersRequested: 12600.0,
      totalLitersApproved: 0.0,
      status: RequestStatus.SUBMITTED,
      submittedById: userAgri.id,
      submittedAt: new Date('2026-11-18T11:00:00Z'),
    },
  });

  await prisma.fuelRequestItem.create({
    data: {
      fuelRequestId: reqSubmitted.id,
      farmerId: farmer5.id,
      fuelTypeId: benzene.id,
      requestedLiters: 100.0,
      approvedLiters: 0.0,
      itemStatus: ItemStatus.PENDING,
      remarks: 'Standard allotment for 1.5 ha',
    },
  });

  await prisma.fuelRequestItem.create({
    data: {
      fuelRequestId: reqSubmitted.id,
      farmerId: farmer6.id,
      fuelTypeId: diesel.id,
      requestedLiters: 300.0,
      approvedLiters: 0.0,
      itemStatus: ItemStatus.PENDING,
      remarks: 'High capacity pump allotment',
    },
  });

  // Request C: TR-2026-039 (October Partially Approved)
  await prisma.fuelRequest.create({
    data: {
      requestNumber: 'TR-2026-039',
      periodMonth: 10,
      periodYear: 2026,
      title: 'October Pre-Season Irrigation Fuel Distribution',
      totalFarmersCount: 110,
      totalLitersRequested: 10400.0,
      totalLitersApproved: 8900.0,
      status: RequestStatus.PARTIALLY_APPROVED,
      submittedById: userAgri.id,
      submittedAt: new Date('2026-10-04T10:00:00Z'),
      reviewedById: userTrade.id,
      reviewedAt: new Date('2026-10-06T15:30:00Z'),
      reviewRemarks: 'Reduced 1,500 L for incomplete land registration records.',
    },
  });

  // 10. Initial Fuel Transactions
  await prisma.fuelTransaction.create({
    data: {
      receiptNumber: 'TX-20261123-0001',
      fuelStationId: stationGhion.id,
      operatorId: userStation.id,
      farmerId: farmer1.id,
      fuelAuthorizationId: auth1.id,
      fuelTypeId: diesel.id,
      quantityLiters: 80.0,
      pricePerLiter: 104.5,
      totalAmount: 8360.0,
      transactionDate: new Date('2026-11-23T09:42:00Z'),
      status: TransactionStatus.COMPLETED,
      notes: 'First dispensing from November quota. Barrels verified.',
    },
  });

  await prisma.fuelTransaction.create({
    data: {
      receiptNumber: 'TX-20261123-0002',
      fuelStationId: stationAbayBus.id,
      operatorId: userStation.id,
      farmerId: farmer2.id,
      fuelAuthorizationId: auth2.id,
      fuelTypeId: benzene.id,
      quantityLiters: 40.0,
      pricePerLiter: 115.2,
      totalAmount: 4608.0,
      transactionDate: new Date('2026-11-23T10:16:00Z'),
      status: TransactionStatus.COMPLETED,
      notes: 'Dispensed into approved jerrycans.',
    },
  });

  // 11. Initial Verification Logs
  await prisma.verificationLog.create({
    data: {
      fuelStationId: stationGhion.id,
      operatorId: userStation.id,
      farmerId: farmer1.id,
      scannedToken: 'QR-FR-00124-ABEBE-BD-SECURE',
      result: VerificationResult.SUCCESS,
      ipAddress: '127.0.0.1',
    },
  });

  await prisma.verificationLog.create({
    data: {
      fuelStationId: stationAbayBus.id,
      operatorId: userStation.id,
      farmerId: farmer2.id,
      scannedToken: 'QR-FR-00125-MULUGETA-BD-SECURE',
      result: VerificationResult.SUCCESS,
      ipAddress: '127.0.0.1',
    },
  });

  await prisma.verificationLog.create({
    data: {
      fuelStationId: stationGhion.id,
      operatorId: userStation.id,
      farmerId: farmer4.id,
      scannedToken: 'QR-FR-00127-KASSAHUN-BD-DEACTIVATED',
      result: VerificationResult.REJECTED,
      rejectionReason: 'Farmer account is SUSPENDED: Land tenure verification inquiry and quota diversion audit',
      ipAddress: '127.0.0.1',
    },
  });

  // 12. System Settings
  await prisma.systemSetting.createMany({
    data: [
      {
        key: 'SYSTEM_NAME',
        value: 'IRFA — Irrigation Resource & Fuel Authorization System',
        category: 'GENERAL',
        description: 'Official system title for Bahir Dar City Administration',
      },
      {
        key: 'CITY_ADMINISTRATION',
        value: 'Bahir Dar City Administration (ባህር ዳር ከተማ አስተዳደር)',
        category: 'GENERAL',
        description: 'Municipal governing authority name',
      },
      {
        key: 'MAX_DIESEL_PER_HECTARE',
        value: '60',
        category: 'ALLOCATION_RULES',
        description: 'Maximum recommended Diesel quota per hectare per month (Liters)',
      },
      {
        key: 'MAX_BENZENE_PER_HECTARE',
        value: '50',
        category: 'ALLOCATION_RULES',
        description: 'Maximum recommended Benzene quota per hectare per month (Liters)',
      },
      {
        key: 'QR_EXPIRY_DAYS',
        value: '365',
        category: 'SECURITY',
        description: 'Validity lifespan in days for newly issued Farmer ID cards',
      },
      {
        key: 'ALLOW_OVERDISPENSING',
        value: 'false',
        category: 'FUEL_CONTROL',
        description: 'Strictly prohibit dispensing exceeding authorized remaining balance',
      },
    ],
  });

  // 13. Audit Logs
  await prisma.auditLog.createMany({
    data: [
      {
        userId: userAdmin.id,
        action: 'SYSTEM_INITIALIZATION',
        entityType: 'SYSTEM',
        entityId: 'INIT',
        details: 'System database successfully provisioned and seeded for Bahir Dar City Administration.',
        ipAddress: '127.0.0.1',
      },
      {
        userId: userTrade.id,
        action: 'STATION_ASSIGNMENT',
        entityType: 'StationAssignment',
        entityId: stationGhion.id,
        details: 'Assigned TR-2026-040 approved farmers to Ghion Fuel Station.',
        ipAddress: '127.0.0.1',
      },
      {
        userId: userAgri.id,
        action: 'SUBMIT_REQUEST',
        entityType: 'FuelRequest',
        entityId: reqSubmitted.id,
        details: 'Submitted TR-2026-041 with 128 farmers for 12,600 L fuel.',
        ipAddress: '127.0.0.1',
      },
    ],
  });

  console.log('Seeding completed successfully!');
  console.log('Default credentials:');
  console.log('  Agriculture: agriculture / demo123');
  console.log('  Trade:       trade / demo123');
  console.log('  Station:     station / demo123');
  console.log('  SysAdmin:    admin / demo123');
}

main()
  .catch((e) => {
    console.error('Seeding error:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
