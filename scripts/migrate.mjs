/**
 * Applies supabase/migrations/*.sql (and optionally seed.sql) to a Postgres
 * database over the session-mode pooler.
 *
 *   node scripts/migrate.mjs              # migrations only
 *   node scripts/migrate.mjs --seed       # migrations, then seed.sql
 *   node scripts/migrate.mjs --seed-only  # seed.sql only
 *
 * Reads DIRECT_URL (preferred) or DATABASE_URL from the environment or from
 * .env.local. Use the SESSION-mode pooler on port 5432, not the transaction
 * pooler on 6543 — DDL and the multi-statement bodies here need a real
 * session, and pgbouncer's transaction mode will reject them.
 *
 * Each file runs as one statement batch, matching how you would paste it
 * into the Supabase SQL editor. The migrations are written to be idempotent,
 * so re-running is safe.
 */
import { readFileSync, readdirSync, existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import pg from "pg";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

/** Minimal .env parser — avoids a dependency for five lines of work. */
function loadEnvFile(file) {
  if (!existsSync(file)) return {};
  const out = {};
  for (const line of readFileSync(file, "utf8").split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq === -1) continue;
    const key = trimmed.slice(0, eq).trim();
    let value = trimmed.slice(eq + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    out[key] = value;
  }
  return out;
}

const fileEnv = loadEnvFile(path.join(root, ".env.local"));
const connectionString =
  process.env.DIRECT_URL ||
  process.env.DATABASE_URL ||
  fileEnv.DIRECT_URL ||
  fileEnv.DATABASE_URL;

if (!connectionString) {
  console.error(
    "No connection string. Set DIRECT_URL (session pooler, port 5432) in the\n" +
      "environment or in .env.local."
  );
  process.exit(1);
}

if (connectionString.includes(":6543")) {
  console.error(
    "That is the transaction-mode pooler (port 6543). It cannot run this DDL.\n" +
      "Use the session-mode pooler on port 5432 (DIRECT_URL)."
  );
  process.exit(1);
}

const args = new Set(process.argv.slice(2));
const seedOnly = args.has("--seed-only");
const withSeed = args.has("--seed") || seedOnly;

const migrationsDir = path.join(root, "supabase/migrations");
const files = seedOnly
  ? []
  : readdirSync(migrationsDir)
      .filter((f) => f.endsWith(".sql"))
      .sort()
      .map((f) => ({ label: f, file: path.join(migrationsDir, f) }));

if (withSeed) {
  files.push({ label: "seed.sql", file: path.join(root, "supabase/seed.sql") });
}

const client = new pg.Client({
  connectionString,
  ssl: { rejectUnauthorized: false },
  // Supabase's pooler can be slow to hand out a session under load.
  connectionTimeoutMillis: 30_000,
  statement_timeout: 120_000,
});

let failed = false;

try {
  await client.connect();
  const { rows } = await client.query(
    "select current_database() as db, current_user as usr, version() as version"
  );
  console.log(`Connected to ${rows[0].db} as ${rows[0].usr}`);
  console.log(`${rows[0].version.split(",")[0]}\n`);

  for (const { label, file } of files) {
    const sql = readFileSync(file, "utf8");
    process.stdout.write(`  ${label.padEnd(24)} `);
    try {
      await client.query(sql);
      console.log("ok");
    } catch (error) {
      console.log("FAILED");
      console.error(`\n    ${error.message}`);
      if (error.hint) console.error(`    hint: ${error.hint}`);
      if (error.position) console.error(`    at character ${error.position}`);
      failed = true;
      break;
    }
  }
} catch (error) {
  console.error("\nConnection failed:", error.message);
  failed = true;
} finally {
  await client.end().catch(() => {});
}

if (failed) {
  process.exit(1);
}

console.log("\nDone.");
