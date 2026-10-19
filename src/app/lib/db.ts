import { PrismaClient } from "@prisma/client";
import fs from "fs";
import path from "path";

function getDatabaseClient(): PrismaClient {
  let dbUrl = process.env.DATABASE_URL;

  // On Vercel / Serverless lambdas, the root filesystem is read-only.
  // /tmp is the only writable directory for SQLite dev.db.
  if (process.env.VERCEL || process.env.NODE_ENV === "production") {
    try {
      const isSqliteUrl = !dbUrl || dbUrl.startsWith("file:");
      if (isSqliteUrl) {
        const tmpDir = "/tmp";
        const tmpDb = path.join(tmpDir, "dev.db");
        const seedDb = path.join(process.cwd(), "prisma", "dev.db");

        if (!fs.existsSync(tmpDb) && fs.existsSync(seedDb)) {
          fs.copyFileSync(seedDb, tmpDb);
        }

        if (fs.existsSync(tmpDb)) {
          dbUrl = `file:${tmpDb}`;
        }
      }
    } catch (e) {
      console.warn("Could not copy dev.db to /tmp:", e);
    }
  }

  return new PrismaClient({
    datasources: dbUrl
      ? {
          db: {
            url: dbUrl,
          },
        }
      : undefined,
  });
}

const globalForPrisma = globalThis as unknown as { prisma: PrismaClient };

export const db = globalForPrisma.prisma || getDatabaseClient();

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = db;
