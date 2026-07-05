import { PrismaClient } from '@prisma/client';
import { withAccelerate } from '@prisma/extension-accelerate';
import { PrismaMariaDb } from '@prisma/adapter-mariadb';

const dbUrl = process.env.DATABASE_URL ?? '';
// Accelerate URLs use the prisma:// protocol (any prisma... prefix). A plain
// mysql:// URL means a direct connection (local dev) via the MariaDB adapter.
const isAccelerate = dbUrl.startsWith('prisma');

const prismaClientSingleton = () => {
  // Both branches yield the same PrismaClient type; keep .$extends() on both so
  // the returned type is uniform (a union would make every model method
  // uncallable under TS). withAccelerate is a no-op for non-cacheStrategy
  // queries, so it's harmless on a direct adapter connection.
  const base = isAccelerate
    ? new PrismaClient({ accelerateUrl: dbUrl })
    : new PrismaClient({ adapter: new PrismaMariaDb(dbUrl) });
  return base.$extends(withAccelerate());
};

declare global {
  var prismaGlobal: undefined | ReturnType<typeof prismaClientSingleton>;
}

const prisma = globalThis.prismaGlobal ?? prismaClientSingleton();

export default prisma;

if (process.env.NODE_ENV !== 'production') globalThis.prismaGlobal = prisma;
