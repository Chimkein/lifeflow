import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@prisma/client";

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

// pg (via @prisma/adapter-pg) currently treats sslmode=require/prefer/verify-ca
// as full certificate verification, but warns that a future major version will
// switch these to weaker libpq semantics. Pin to verify-full so the effective
// behavior stays the same (and silence the deprecation warning) across every
// environment — local and the Neon-backed deployment alike.
function resolveConnectionString(): string | undefined {
  const url = process.env.DATABASE_URL;
  if (!url) return url;
  return url.replace(
    /([?&])sslmode=(?:require|prefer|verify-ca)\b/gi,
    "$1sslmode=verify-full"
  );
}

function createPrismaClient() {
  const adapter = new PrismaPg({
    connectionString: resolveConnectionString(),
  });
  return new PrismaClient({ adapter });
}

export const prisma = globalForPrisma.prisma ?? createPrismaClient();

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;
