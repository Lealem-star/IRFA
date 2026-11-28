import prisma from './src/config/db.js';

async function check() {
  const now = new Date();
  const auths = await prisma.fuelAuthorization.findMany({
    where: {
      status: 'ACTIVE',
      validFrom: { lte: now },
      validTo: { gte: now },
      remainingLiters: { gt: 0 },
    },
    include: {
      farmer: {
        include: {
          cards: true,
          subCity: true,
          kebele: { include: { subCity: true } },
          allocations: true,
        },
      },
      fuelType: true,
    },
    take: 5,
  });

  console.log('ACTIVE VALID AUTHS COUNT:', auths.length);
  for (const a of auths) {
    console.log({
      id: a.id,
      code: a.authCode,
      farmer: a.farmer.fullName,
      farmerCode: a.farmer.farmerCode,
      subCityId: a.farmer.subCityId || a.farmer.kebele?.subCityId,
      subCity: a.farmer.subCity?.name || a.farmer.kebele?.subCity?.name,
      cards: a.farmer.cards.map(c => ({ id: c.id, qr: c.qrToken, serial: c.cardSerialNumber, status: c.status })),
      allocations: a.farmer.allocations.map(m => ({ month: m.month, year: m.year, remaining: m.remainingLiters, status: m.status })),
    });
  }

  const station = await prisma.fuelStation.findFirst({
    where: { code: 'BD-ST-01' },
    include: {
      users: true,
      subCityAssignments: { include: { subCity: true } },
    },
  });
  console.log('BD-ST-01 Station:', {
    name: station?.name,
    users: station?.users.map(u => ({ username: u.username, role: u.role, active: u.isActive })),
    subCities: station?.subCityAssignments.map(a => a.subCity.name),
  });

  await prisma.$disconnect();
}

check().catch(console.error);
