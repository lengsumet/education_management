import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import { PrismaMariaDb } from '@prisma/adapter-mariadb';
import bcrypt from 'bcryptjs';

const dbUrl = process.env.DATABASE_URL ?? '';
const isAccelerate = dbUrl.startsWith('prisma');
const prisma = isAccelerate
  ? new PrismaClient({ accelerateUrl: dbUrl })
  : new PrismaClient({ adapter: new PrismaMariaDb(dbUrl) });

async function main() {
  const adminEmail = process.env.ADMIN_EMAIL || 'admin@ku.ac.th';
  const adminPassword = process.env.ADMIN_PASSWORD || 'demo1234';
  const hashedPassword = await bcrypt.hash(adminPassword, 10);

  const admin = await prisma.user.upsert({
    where: { email: adminEmail },
    update: {
      // Ensure an existing admin is always approved/active.
      isActive: true,
      approvalStatus: 'approved',
    },
    create: {
      email: adminEmail,
      passwordHash: hashedPassword,
      role: 'admin',
      firstName: 'System',
      lastName: 'Administrator',
      isActive: true,
      approvalStatus: 'approved',
      approvedAt: new Date(),
    },
  });

  console.log('Admin account ready:', admin.email);
  if (!process.env.ADMIN_PASSWORD) {
    console.warn('⚠️  Using default admin password "demo1234" — set ADMIN_PASSWORD in .env for production.');
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
