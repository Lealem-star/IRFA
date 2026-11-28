import { PrismaClient } from '@prisma/client';
import { OFFICIAL_STATIONS_MASTER } from '../config/officialStations.js';

const prisma = new PrismaClient();

async function connectWithRetry(retries = 6, delayMs = 3000) {
  for (let i = 1; i <= retries; i++) {
    try {
      await prisma.$connect();
      console.log(`[Seed] Connected to database (attempt ${i}/${retries}).`);
      return;
    } catch (e: any) {
      console.warn(`[Seed] Connection attempt ${i} failed: ${e.message}`);
      if (i === retries) throw e;
      await new Promise((r) => setTimeout(r, delayMs));
    }
  }
}

export async function seedOfficialStations() {
  await connectWithRetry();

  console.log('===============================================================');
  console.log('   IRFA / DFCS — OFFICIAL FUEL STATION RECONCILIATION & SEED   ');
  console.log('===============================================================\n');

  // 1. Fetch current database stations
  const existingStations = await prisma.fuelStation.findMany({
    orderBy: { code: 'asc' },
  });
  console.log(`[Reconciliation] Found ${existingStations.length} existing station records in database:`);
  existingStations.forEach((s) => {
    console.log(`  - [${s.code}] ${s.name} (ID: ${s.id}, Active: ${s.isActive})`);
  });

  const existingCodes = new Set(existingStations.map((s) => s.code));
  const existingNames = new Set(existingStations.map((s) => s.name.trim().toLowerCase()));

  const report = {
    totalOfficialList: OFFICIAL_STATIONS_MASTER.length,
    existingPreserved: existingStations.length,
    inserted: [] as string[],
    pendingConfirmation: [] as { name: string; candidateCode: string; notes: string }[],
    alreadySeeded: [] as string[],
  };

  // 2. Process each official station definition
  for (const item of OFFICIAL_STATIONS_MASTER) {
    if (item.reconciliationStatus === 'PENDING_CONFIRMATION') {
      report.pendingConfirmation.push({
        name: item.officialName,
        candidateCode: item.candidateExistingCode || 'N/A',
        notes: item.reconciliationNotes,
      });
      continue;
    }

    // Check if station already exists by code or exact name
    const alreadyExists =
      existingCodes.has(item.assignedCode) || existingNames.has(item.officialName.trim().toLowerCase());

    if (alreadyExists) {
      report.alreadySeeded.push(`[${item.assignedCode}] ${item.officialName}`);
      continue;
    }

    // Safe Idempotent Insertion of Genuinely Missing Station
    const created = await prisma.fuelStation.create({
      data: {
        code: item.assignedCode,
        name: item.officialName,
        nameAmharic: item.nameAmharic || null,
        company: item.company || null,
        location: item.location || 'Bahir Dar',
        contactPerson: null, // Strictly no fabricated data
        phone: null,
        licenseNumber: null,
        isActive: true,
      },
    });

    existingCodes.add(created.code);
    existingNames.add(created.name.trim().toLowerCase());
    report.inserted.push(`[${created.code}] ${created.name}`);
  }

  // 3. Final State Verification
  const finalStations = await prisma.fuelStation.findMany({
    orderBy: { code: 'asc' },
  });

  console.log('\n---------------------------------------------------------------');
  console.log('   RECONCILIATION & SEEDING REPORT SUMMARY                     ');
  console.log('---------------------------------------------------------------');
  console.log(`• Official Stations Defined:          ${report.totalOfficialList}`);
  console.log(`• Existing Station Records Preserved: ${report.existingPreserved}`);
  console.log(`• Stations Inserted:                  ${report.inserted.length}`);
  console.log(`• Already Present (Idempotent Skip):  ${report.alreadySeeded.length}`);
  console.log(`• Pending Human Confirmation:         ${report.pendingConfirmation.length}`);
  console.log(`• Total Stations in Database Now:     ${finalStations.length}\n`);

  if (report.inserted.length > 0) {
    console.log('Newly Registered Stations:');
    report.inserted.forEach((s) => console.log(`  + ${s}`));
    console.log('');
  }

  if (report.pendingConfirmation.length > 0) {
    console.log('Stations Marked PENDING_CONFIRMATION (Preserved unchanged):');
    report.pendingConfirmation.forEach((p) => {
      console.log(`  ? ${p.name} -> Candidate: ${p.candidateCode}`);
      console.log(`    Note: ${p.notes}`);
    });
    console.log('');
  }

  await prisma.$disconnect();
  return { finalStations, report };
}

// Auto-run if executed directly
if (process.argv[1]?.endsWith('seedOfficialStations.ts')) {
  seedOfficialStations()
    .then(() => {
      console.log('SUCCESS: Station master list seeding completed cleanly.');
      process.exit(0);
    })
    .catch((err) => {
      console.error('FATAL: Station master seeding failed:', err);
      process.exit(1);
    });
}
