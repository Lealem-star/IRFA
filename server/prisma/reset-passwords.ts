import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function resetPasswords() {
  const defaultPassword = process.env.DEFAULT_RESET_PASSWORD || 'demo123';
  const hash = await bcrypt.hash(defaultPassword, 10);

  const users = await prisma.user.findMany({
    select: { id: true, username: true, role: true },
  });

  console.log(`Found ${users.length} users. Resetting all passwords to '${defaultPassword}'...`);

  for (const u of users) {
    await prisma.user.update({
      where: { id: u.id },
      data: { passwordHash: hash },
    });
    console.log(`✓ Reset password for: ${u.username} (${u.role})`);
  }

  console.log(`\nAll users successfully updated with password: "${defaultPassword}"`);
}

resetPasswords()
  .catch((err) => {
    console.error('Failed to reset passwords:', err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
