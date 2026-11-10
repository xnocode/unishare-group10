/**
 * Ensures prisma/schema.prisma matches the active DATABASE_URL provider
 * before `prisma generate` or `next build` runs:
 *  - PostgreSQL (`postgres://` or `postgresql://`) on Supabase / Neon / Vercel
 *  - SQLite (`file:...` or unset) for zero-config local development
 */
const fs = require("fs");
const path = require("path");

function readEnvVar(name) {
  if (process.env[name]) return process.env[name];
  const root = process.cwd();
  for (const filename of [".env.local", ".env"]) {
    const filePath = path.join(root, filename);
    if (!fs.existsSync(filePath)) continue;
    const lines = fs.readFileSync(filePath, "utf8").split(/\r?\n/);
    for (const raw of lines) {
      const trimmed = raw.trim();
      if (!trimmed || trimmed.startsWith("#")) continue;
      const eqIdx = trimmed.indexOf("=");
      if (eqIdx <= 0) continue;
      const key = trimmed.slice(0, eqIdx).trim();
      if (key === name) {
        return trimmed
          .slice(eqIdx + 1)
          .trim()
          .replace(/^["']|["']$/g, "");
      }
    }
  }
  return "";
}

const schemaPath = path.join(process.cwd(), "prisma", "schema.prisma");
const current = fs.readFileSync(schemaPath, "utf8");
const dbUrl = readEnvVar("DATABASE_URL");
const directUrl = readEnvVar("DIRECT_URL");

const usePostgres = /^postgres(ql)?:\/\//i.test(dbUrl);
const desiredProvider = usePostgres ? "postgresql" : "sqlite";

const desiredDatasourceBlock = usePostgres
  ? [
      "datasource db {",
      '  provider  = "postgresql"',
      '  url       = env("DATABASE_URL")',
      ...(directUrl ? ['  directUrl = env("DIRECT_URL")'] : []),
      "}",
    ].join("\n")
  : [
      "datasource db {",
      '  provider = "sqlite"',
      '  url      = env("DATABASE_URL")',
      "}",
    ].join("\n");

const updated = current.replace(
  /datasource db \{[\s\S]*?\}/,
  desiredDatasourceBlock
);

if (updated !== current) {
  fs.writeFileSync(schemaPath, updated, "utf8");
  console.log(`[prepare-prisma] Configured Prisma datasource for ${desiredProvider}.`);
}

