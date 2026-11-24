import { PrismaClient, UserRole, EligibilityStatus, WaterSource, CardStatus, RequestStatus, ItemStatus, AuthStatus, AssignmentStatus, TransactionStatus, VerificationResult } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  console.log('Seeding IRFA Database for Bahir Dar City Administration...');

  // Clean existing tables in reverse order of foreign keys
  await prisma.verificationLog.deleteMany();
  await prisma.fuelTransaction.deleteMany();
  await prisma.stationAssignment.deleteMany();
  await prisma.fuelAuthorization.deleteMany();
  await prisma.fuelRequestItem.deleteMany();
  await prisma.fuelRequest.deleteMany();
  await prisma.monthlyAllocation.deleteMany();
  await prisma.farmerCard.deleteMany();
  await prisma.farmerIrrigationProfile.deleteMany();
  await prisma.farmer.deleteMany();
  await prisma.kebele.deleteMany();
  await prisma.location.deleteMany();
  await prisma.fuelType.deleteMany();
  await prisma.auditLog.deleteMany();
  await prisma.systemSetting.deleteMany();
  await prisma.user.deleteMany();
  await prisma.fuelStation.deleteMany();
  await prisma.office.deleteMany();

  // 1. Create Offices
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

  // 2. Create Fuel Stations
  const stationA = await prisma.fuelStation.create({
    data: {
      code: 'BD-ST-01',
      name: 'Tana Energy Fuel Station (Station A)',
      location: 'Lake Tana Shore Boulevard, Bahir Dar',
      contactPerson: 'Yohannes Getachew',
      phone: '+251 918 700 001',
      licenseNumber: 'BD-FUEL-2024-88',
      isActive: true,
    },
  });

  const stationB = await prisma.fuelStation.create({
    data: {
      code: 'BD-ST-02',
      name: 'Abay Petroleum Hub (Station B)',
      location: 'Kebele 02 Ring Road, Bahir Dar',
      contactPerson: 'Birtukan Mengistu',
      phone: '+251 918 700 002',
      licenseNumber: 'BD-FUEL-2024-89',
      isActive: true,
    },
  });

  const stationC = await prisma.fuelStation.create({
    data: {
      code: 'BD-ST-03',
      name: 'Tis Abay Agro-Fuel Depot',
      location: 'Tis Abay Highway Junction, Bahir Dar',
      contactPerson: 'Ephrem Assefa',
      phone: '+251 918 700 003',
      licenseNumber: 'BD-FUEL-2024-90',
      isActive: true,
    },
  });

  // 3. Create Users
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
      email: 'station.admin@tanaenergy.com',
      passwordHash,
      fullName: 'Tana Station Administrator',
      role: UserRole.STATION_ADMIN,
      fuelStationId: stationA.id,
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

  // 4. Create Locations and Kebeles
  const locationZuria = await prisma.location.create({
    data: {
      name: 'Bahir Dar Zuria & Lake Basin',
      subCity: 'Bahir Dar Perimeter',
    },
  });

  const kebeleTana = await prisma.kebele.create({
    data: {
      name: 'Tana Kebele (01)',
      code: 'BD-KEB-01',
      locationId: locationZuria.id,
    },
  });

  const kebeleZenzelma = await prisma.kebele.create({
    data: {
      name: 'Zenzelma Kebele (02)',
      code: 'BD-KEB-02',
      locationId: locationZuria.id,
    },
  });

  const kebeleShumeta = await prisma.kebele.create({
    data: {
      name: 'Shumeta Kebele (03)',
      code: 'BD-KEB-03',
      locationId: locationZuria.id,
    },
  });

  const kebeleWeramit = await prisma.kebele.create({
    data: {
      name: 'Weramit Kebele (04)',
      code: 'BD-KEB-04',
      locationId: locationZuria.id,
    },
  });

  const kebeleShimbit = await prisma.kebele.create({
    data: {
      name: 'Shimbit Kebele (05)',
      code: 'BD-KEB-05',
      locationId: locationZuria.id,
    },
  });

  // 5. Create Fuel Types
  const diesel = await prisma.fuelType.create({
    data: {
      name: 'Diesel',
      nameAmharic: 'ናፍጣ',
      code: 'DIESEL',
      unit: 'Liters',
      currentPricePerLiter: 104.50,
      isActive: true,
    },
  });

  const benzene = await prisma.fuelType.create({
    data: {
      name: 'Benzene',
      nameAmharic: 'ቤንዚን',
      code: 'BENZENE',
      unit: 'Liters',
      currentPricePerLiter: 115.20,
      isActive: true,
    },
  });

  // 6. Create Farmers with Irrigation Profiles and Cards
  // Farmer 1: Abebe Tesfaye (Eligible, Diesel, Card Issued, Has Active Allocation & Trade Auth at Station A)
  const farmer1 = await prisma.farmer.create({
    data: {
      farmerCode: 'FR-00124',
      fullName: 'Abebe Tesfaye',
      phone: '+251 918 112 233',
      nationalId: 'ETH-BD-2024-1001',
      kebeleId: kebeleTana.id,
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

  // Farmer 2: Mulugeta Kebede (Eligible, Benzene, Card Issued, Has Active Allocation & Trade Auth at Station A)
  const farmer2 = await prisma.farmer.create({
    data: {
      farmerCode: 'FR-00125',
      fullName: 'Mulugeta Kebede',
      phone: '+251 918 223 344',
      nationalId: 'ETH-BD-2024-1002',
      kebeleId: kebeleZenzelma.id,
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

  // Farmer 3: Hana Worku (Under Review, Diesel, Card Pending)
  const farmer3 = await prisma.farmer.create({
    data: {
      farmerCode: 'FR-00126',
      fullName: 'Hana Worku',
      phone: '+251 918 334 455',
      nationalId: 'ETH-BD-2024-1003',
      kebeleId: kebeleShumeta.id,
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

  // Farmer 4: Kassahun Alemu (Suspended, Diesel, Card Deactivated)
  const farmer4 = await prisma.farmer.create({
    data: {
      farmerCode: 'FR-00127',
      fullName: 'Kassahun Alemu',
      phone: '+251 918 445 566',
      nationalId: 'ETH-BD-2024-1004',
      kebeleId: kebeleTana.id,
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

  // Farmer 5: Almaz Tadesse (Eligible, Benzene, Card Active)
  const farmer5 = await prisma.farmer.create({
    data: {
      farmerCode: 'FR-00128',
      fullName: 'Almaz Tadesse',
      phone: '+251 918 556 677',
      nationalId: 'ETH-BD-2024-1005',
      kebeleId: kebeleWeramit.id,
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

  // Farmer 6: Demissew Belay (Eligible, Diesel, Card Active)
  const farmer6 = await prisma.farmer.create({
    data: {
      farmerCode: 'FR-00129',
      fullName: 'Demissew Belay',
      phone: '+251 918 667 788',
      nationalId: 'ETH-BD-2024-1006',
      kebeleId: kebeleShimbit.id,
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

  // 7. Monthly Fuel Allocations (November 2026)
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
        notes: 'Monthly allocation for Weramit Kebele group',
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

  // 8. Fuel Requests to Trade Office
  // Request A: TR-2026-040 (Approved request with Authorizations and Station Assignments)
  const reqApproved = await prisma.fuelRequest.create({
    data: {
      requestNumber: 'TR-2026-040',
      periodMonth: 11,
      periodYear: 2026,
      title: 'Tana & Zenzelma Kebeles Monthly Fuel Request',
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

  // Items in Request A
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
      remarks: 'Authorized for Tana Energy Station dispensing',
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
      remarks: 'Authorized for Tana Energy Station dispensing',
    },
  });

  // Assign Station A to both Authorizations
  await prisma.stationAssignment.create({
    data: {
      fuelAuthorizationId: auth1.id,
      fuelStationId: stationA.id,
      assignedById: userTrade.id,
      status: AssignmentStatus.ACTIVE,
      notes: 'Assigned to Tana Station for convenient farmer collection',
    },
  });

  await prisma.stationAssignment.create({
    data: {
      fuelAuthorizationId: auth2.id,
      fuelStationId: stationA.id,
      assignedById: userTrade.id,
      status: AssignmentStatus.ACTIVE,
      notes: 'Assigned to Tana Station for convenient farmer collection',
    },
  });

  // Request B: TR-2026-041 (Submitted, awaiting Trade review)
  const reqSubmitted = await prisma.fuelRequest.create({
    data: {
      requestNumber: 'TR-2026-041',
      periodMonth: 11,
      periodYear: 2026,
      title: 'Shumeta & Weramit Kebeles Fuel Allocation Phase II',
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
      reviewRemarks: 'Reduced 1,500 L for incomplete Kebele 03 land registration records.',
    },
  });

  // 9. Initial Fuel Transactions for Station A
  await prisma.fuelTransaction.create({
    data: {
      receiptNumber: 'TX-20261123-0001',
      fuelStationId: stationA.id,
      operatorId: userStation.id,
      farmerId: farmer1.id,
      fuelAuthorizationId: auth1.id,
      fuelTypeId: diesel.id,
      quantityLiters: 80.0,
      pricePerLiter: 104.50,
      totalAmount: 8360.00,
      transactionDate: new Date('2026-11-23T09:42:00Z'),
      status: TransactionStatus.COMPLETED,
      notes: 'First dispensing from November quota. Barrels verified.',
    },
  });

  await prisma.fuelTransaction.create({
    data: {
      receiptNumber: 'TX-20261123-0002',
      fuelStationId: stationA.id,
      operatorId: userStation.id,
      farmerId: farmer2.id,
      fuelAuthorizationId: auth2.id,
      fuelTypeId: benzene.id,
      quantityLiters: 40.0,
      pricePerLiter: 115.20,
      totalAmount: 4608.00,
      transactionDate: new Date('2026-11-23T10:16:00Z'),
      status: TransactionStatus.COMPLETED,
      notes: 'Dispensed into approved jerrycans.',
    },
  });

  // 10. Sample Verification Logs
  await prisma.verificationLog.create({
    data: {
      fuelStationId: stationA.id,
      operatorId: userStation.id,
      farmerId: farmer1.id,
      scannedToken: 'QR-FR-00124-ABEBE-BD-SECURE',
      result: VerificationResult.SUCCESS,
      ipAddress: '127.0.0.1',
    },
  });

  await prisma.verificationLog.create({
    data: {
      fuelStationId: stationA.id,
      operatorId: userStation.id,
      farmerId: farmer2.id,
      scannedToken: 'QR-FR-00125-MULUGETA-BD-SECURE',
      result: VerificationResult.SUCCESS,
      ipAddress: '127.0.0.1',
    },
  });

  await prisma.verificationLog.create({
    data: {
      fuelStationId: stationA.id,
      operatorId: userStation.id,
      farmerId: farmer4.id,
      scannedToken: 'QR-FR-00127-KASSAHUN-BD-DEACTIVATED',
      result: VerificationResult.REJECTED,
      rejectionReason: 'Farmer account is SUSPENDED: Land tenure verification inquiry and quota diversion audit',
      ipAddress: '127.0.0.1',
    },
  });

  // 11. System Settings
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

  // 12. Audit Logs
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
        entityId: stationA.id,
        details: 'Assigned TR-2026-040 approved farmers to Tana Energy Station A.',
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
