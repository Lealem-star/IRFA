import { PrismaClient, UserRole } from '@prisma/client';
import bcrypt from 'bcryptjs';
import dotenv from 'dotenv';
import path from 'path';

// Load .env
dotenv.config({ path: path.resolve(process.cwd(), '.env') });
dotenv.config({ path: path.resolve(process.cwd(), 'server/.env') });

const prisma = new PrismaClient();

async function main() {
  console.log('====================================================');
  console.log('  Digital Fuel Coupon System — Admin Account Creator');
  console.log('====================================================\n');

  // Parse arguments or use defaults
  const args = process.argv.slice(2);
  const username = args[0] || process.env.ADMIN_USERNAME || 'admin';
  const password = args[1] || process.env.ADMIN_PASSWORD || 'Admin@2026!';
  const email = args[2] || process.env.ADMIN_EMAIL || `${username}@bahirdar.gov.et`;
  const fullName = args[3] || 'System Administrator';

  const dbUrl = process.env.DATABASE_URL || '';
  // Mask password in DB URL for display
  const maskedDbUrl = dbUrl.replace(/:([^:@]+)@/, ':****@');
  console.log(`Target Database: ${maskedDbUrl}`);

  try {
    // 1. Verify Database Connection
    console.log('Connecting to database...');
    await prisma.$connect();
    console.log('Connected successfully to database.\n');

    // 2. Ensure an Admin Office exists
    let adminOffice = await prisma.office.findFirst({
      where: { code: 'BD-ADMIN' },
    });

    if (!adminOffice) {
      console.log('Creating default Admin Office (BD-ADMIN)...');
      adminOffice = await prisma.office.create({
        data: {
          code: 'BD-ADMIN',
          name: 'City Administration General Office',
          nameAmharic: 'የባሕር ዳር ከተማ አስተዳደር ዋና መምሪያ',
          type: 'ADMINISTRATION',
        },
      });
    }

    // 3. Hash the Password
    console.log(`Hashing password for admin user '${username}'...`);
    const passwordHash = await bcrypt.hash(password, 10);

    // 4. Upsert Admin User (Create if not exists, Update if already exists)
    const adminUser = await prisma.user.upsert({
      where: { username },
      update: {
        passwordHash,
        email,
        fullName,
        role: UserRole.SYSTEM_ADMIN,
        officeId: adminOffice.id,
        isActive: true,
      },
      create: {
        username,
        passwordHash,
        email,
        fullName,
        role: UserRole.SYSTEM_ADMIN,
        officeId: adminOffice.id,
        isActive: true,
      },
    });

    console.log('\n====================================================');
    console.log('  SUCCESS: Admin Credentials Created Successfully!  ');
    console.log('====================================================');
    console.log(`  User ID:    ${adminUser.id}`);
    console.log(`  Username:   ${adminUser.username}`);
    console.log(`  Password:   ${password}`);
    console.log(`  Role:       ${adminUser.role}`);
    console.log(`  Full Name:  ${adminUser.fullName}`);
    console.log(`  Email:      ${adminUser.email}`);
    console.log(`  Status:     ${adminUser.isActive ? 'ACTIVE' : 'INACTIVE'}`);
    console.log('====================================================\n');
    console.log('You can now log in at: http://localhost:5173/login');
    console.log(`with username: "${username}" and password: "${password}"\n`);
  } catch (error: any) {
    console.error('\n[ERROR] Failed to create admin user:');
    if (error.message && error.message.includes('Connections using insecure transport')) {
      console.error('TiDB Cloud requires secure TLS. Ensure "?sslaccept=strict" is appended to DATABASE_URL in .env');
    } else if (error.message && error.message.includes('Authentication failed')) {
      console.error('Database authentication failed. Please check your username and cluster password in .env.');
    } else if (error.message && error.code === 'P2021' || (error.message && error.message.includes("Table") && error.message.includes("doesn't exist"))) {
      console.error('Tables not found in database. Please run "npx prisma db push" first to apply schema to TiDB.');
    } else {
      console.error(error.message || error);
    }
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

main();
