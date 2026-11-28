import fs from 'fs';
import path from 'path';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function connectWithRetry(retries = 6, delayMs = 3000) {
  for (let i = 1; i <= retries; i++) {
    try {
      await prisma.$connect();
      console.log(`[Backup] Connected to TiDB database successfully (attempt ${i}/${retries}).`);
      return;
    } catch (e: any) {
      console.warn(`[Backup] Database connection attempt ${i} failed: ${e.message}`);
      if (i === retries) throw e;
      await new Promise((r) => setTimeout(r, delayMs));
    }
  }
}

async function runBackup() {
  await connectWithRetry();

  console.log('[Backup] Querying all operational and historical tables...');

  const [
    fuelStations,
    users,
    subCities,
    kebeles,
    farmers,
    farmerCards,
    fuelRequests,
    fuelRequestItems,
    fuelAuthorizations,
    stationAssignments,
    fuelTransactions,
    verificationLogs,
    auditLogs,
    monthlyAllocations,
    stationSubCityAssignments,
    fuelRequestHistories,
    fuelShortages,
  ] = await Promise.all([
    prisma.fuelStation.findMany({ orderBy: { code: 'asc' } }),
    prisma.user.findMany({ orderBy: { username: 'asc' } }),
    prisma.subCity.findMany({ orderBy: { code: 'asc' } }),
    prisma.kebele.findMany({ orderBy: { code: 'asc' } }),
    prisma.farmer.findMany({ orderBy: { farmerCode: 'asc' } }),
    prisma.farmerCard.findMany({ orderBy: { cardSerialNumber: 'asc' } }),
    prisma.fuelRequest.findMany({ orderBy: { requestNumber: 'asc' } }),
    prisma.fuelRequestItem.findMany(),
    prisma.fuelAuthorization.findMany({ orderBy: { authCode: 'asc' } }),
    prisma.stationAssignment.findMany(),
    prisma.fuelTransaction.findMany({ orderBy: { receiptNumber: 'asc' } }),
    prisma.verificationLog.findMany({ orderBy: { createdAt: 'desc' } }),
    prisma.auditLog.findMany({ orderBy: { createdAt: 'desc' } }),
    prisma.monthlyAllocation.findMany(),
    prisma.stationSubCityAssignment.findMany(),
    prisma.fuelRequestHistory.findMany({ orderBy: { createdAt: 'desc' } }),
    prisma.fuelShortage.findMany({ orderBy: { createdAt: 'desc' } }),
  ]);

  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const backupDir = path.resolve(__dirname, '../../backups');

  if (!fs.existsSync(backupDir)) {
    fs.mkdirSync(backupDir, { recursive: true });
  }

  const backupFilePath = path.join(backupDir, `backup_phase8a_${timestamp}.json`);

  const payload = {
    metadata: {
      generatedAt: new Date().toISOString(),
      environment: 'production-tidb',
      purpose: 'Phase 8A Security & Dispensing Safeguard Pre-Remediation Safety Snapshot',
      counts: {
        fuelStations: fuelStations.length,
        users: users.length,
        subCities: subCities.length,
        kebeles: kebeles.length,
        farmers: farmers.length,
        farmerCards: farmerCards.length,
        fuelRequests: fuelRequests.length,
        fuelRequestItems: fuelRequestItems.length,
        fuelAuthorizations: fuelAuthorizations.length,
        stationAssignments: stationAssignments.length,
        fuelTransactions: fuelTransactions.length,
        verificationLogs: verificationLogs.length,
        auditLogs: auditLogs.length,
        monthlyAllocations: monthlyAllocations.length,
        stationSubCityAssignments: stationSubCityAssignments.length,
        fuelRequestHistories: fuelRequestHistories.length,
        fuelShortages: fuelShortages.length,
      },
    },
    data: {
      fuelStations,
      users,
      subCities,
      kebeles,
      farmers,
      farmerCards,
      fuelRequests,
      fuelRequestItems,
      fuelAuthorizations,
      stationAssignments,
      fuelTransactions,
      verificationLogs,
      auditLogs,
      monthlyAllocations,
      stationSubCityAssignments,
      fuelRequestHistories,
      fuelShortages,
    },
  };

  fs.writeFileSync(backupFilePath, JSON.stringify(payload, null, 2), 'utf8');

  // Verify readability
  const stats = fs.statSync(backupFilePath);
  console.log(`[Backup] Verified backup written to: ${backupFilePath}`);
  console.log(`[Backup] File size: ${(stats.size / 1024).toFixed(2)} KB`);

  const readBack = JSON.parse(fs.readFileSync(backupFilePath, 'utf8'));
  console.log('[Backup] Readability check PASSED: Verified snapshot contains:');
  console.log(`  - FuelStations: ${readBack.data.fuelStations.length}`);
  console.log(`  - Users: ${readBack.data.users.length}`);
  console.log(`  - Farmers: ${readBack.data.farmers.length}`);
  console.log(`  - FuelAuthorizations: ${readBack.data.fuelAuthorizations.length}`);
  console.log(`  - StationAssignments: ${readBack.data.stationAssignments.length}`);
  console.log(`  - FuelTransactions: ${readBack.data.fuelTransactions.length}`);
  console.log(`  - VerificationLogs: ${readBack.data.verificationLogs.length}`);
  console.log(`  - AuditLogs: ${readBack.data.auditLogs.length}`);

  await prisma.$disconnect();
  return backupFilePath;
}

runBackup()
  .then((file) => {
    console.log(`\nSUCCESS: Pre-migration database backup safely archived at ${file}`);
    process.exit(0);
  })
  .catch((err) => {
    console.error('FATAL: Database backup failed:', err);
    process.exit(1);
  });
