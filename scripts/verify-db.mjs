/**
 * Post-migration sanity check.
 *
 *   node scripts/verify-db.mjs
 *
 * Confirms the tables, RLS, storage buckets, realtime publication and seed
 * data are all actually in place, and exercises the scoring rubric against a
 * throwaway row so a silent trigger failure cannot hide.
 */
import { readFileSync, existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import pg from "pg";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

function loadEnvFile(file) {
  if (!existsSync(file)) return {};
  const out = {};
  for (const line of readFileSync(file, "utf8").split(/\r?\n/)) {
    const t = line.trim();
    if (!t || t.startsWith("#")) continue;
    const eq = t.indexOf("=");
    if (eq === -1) continue;
    out[t.slice(0, eq).trim()] = t.slice(eq + 1).trim().replace(/^["']|["']$/g, "");
  }
  return out;
}

const fileEnv = loadEnvFile(path.join(root, ".env.local"));
const connectionString =
  process.env.DIRECT_URL || fileEnv.DIRECT_URL || process.env.DATABASE_URL || fileEnv.DATABASE_URL;

if (!connectionString) {
  console.error("No DIRECT_URL found.");
  process.exit(1);
}

const client = new pg.Client({
  connectionString,
  ssl: { rejectUnauthorized: false },
  connectionTimeoutMillis: 30_000,
});

const pass = (msg) => console.log(`  PASS  ${msg}`);
const fail = (msg) => {
  console.log(`  FAIL  ${msg}`);
  problems += 1;
};
let problems = 0;

await client.connect();

// ---- Tables ---------------------------------------------------------
const expectedTables = [
  "profiles", "parents", "puppies", "puppy_vaccinations", "puppy_dewormings",
  "guides", "applications", "application_notes", "waitlist", "conversations",
  "messages", "site_settings", "activity_log",
];

const { rows: tables } = await client.query(
  `select tablename, rowsecurity from pg_tables where schemaname = 'public'`
);
const tableMap = new Map(tables.map((t) => [t.tablename, t.rowsecurity]));

console.log("\nTables and RLS");
for (const name of expectedTables) {
  if (!tableMap.has(name)) fail(`${name} — missing`);
  else if (!tableMap.get(name)) fail(`${name} — RLS is OFF`);
  else pass(`${name}`);
}

// ---- Policies -------------------------------------------------------
const { rows: policyCounts } = await client.query(
  `select tablename, count(*)::int as n from pg_policies
    where schemaname = 'public' group by tablename order by tablename`
);
const totalPolicies = policyCounts.reduce((s, r) => s + r.n, 0);
console.log(`\nPolicies: ${totalPolicies} across ${policyCounts.length} tables`);
if (totalPolicies < 25) fail(`only ${totalPolicies} policies — expected ~30+`);
else pass(`${totalPolicies} policies installed`);

// ---- Functions ------------------------------------------------------
console.log("\nFunctions");
const { rows: fns } = await client.query(
  `select proname from pg_proc p
     join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'`
);
const fnNames = new Set(fns.map((f) => f.proname));
for (const fn of [
  "is_staff", "is_admin", "score_application", "admin_dashboard_stats",
  "mark_conversation_read", "handle_new_user", "public_site_stats",
]) {
  fnNames.has(fn) ? pass(fn) : fail(`${fn} — missing`);
}

// ---- Storage buckets ------------------------------------------------
console.log("\nStorage buckets");
const { rows: buckets } = await client.query(
  `select id, public from storage.buckets order by id`
);
const bucketMap = new Map(buckets.map((b) => [b.id, b.public]));
for (const [id, shouldBePublic] of [
  ["puppy-photos", true], ["guide-images", true], ["message-files", false],
]) {
  if (!bucketMap.has(id)) fail(`${id} — missing`);
  else if (bucketMap.get(id) !== shouldBePublic)
    fail(`${id} — public flag is ${bucketMap.get(id)}, expected ${shouldBePublic}`);
  else pass(`${id} (public: ${shouldBePublic})`);
}

// ---- Realtime -------------------------------------------------------
console.log("\nRealtime publication");
const { rows: pub } = await client.query(
  `select tablename from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public'`
);
const pubSet = new Set(pub.map((p) => p.tablename));
for (const t of ["messages", "conversations", "applications"]) {
  pubSet.has(t) ? pass(t) : fail(`${t} — not published`);
}

// ---- Seed data ------------------------------------------------------
console.log("\nSeed data");
for (const [table, min] of [
  ["puppies", 5], ["parents", 4], ["guides", 4], ["site_settings", 11],
]) {
  const { rows } = await client.query(`select count(*)::int as n from public.${table}`);
  rows[0].n >= min
    ? pass(`${table}: ${rows[0].n}`)
    : fail(`${table}: ${rows[0].n}, expected >= ${min}`);
}

const { rows: rel } = await client.query(
  `select p.name, s.name as sire, d.name as dam,
          (select count(*)::int from public.puppy_vaccinations v where v.puppy_id = p.id) as vaccinations
     from public.puppies p
     left join public.parents s on s.id = p.sire_id
     left join public.parents d on d.id = p.dam_id
    order by p.display_order limit 3`
);
for (const r of rel) {
  r.sire && r.dam
    ? pass(`${r.name}: sire=${r.sire}, dam=${r.dam}, ${r.vaccinations} vaccinations`)
    : fail(`${r.name} — parent links did not resolve`);
}

// ---- Scoring trigger ------------------------------------------------
// A real insert is the only way to prove the trigger fires; rolled back so
// the applications table stays empty.
console.log("\nScoring trigger (rolled back)");
try {
  await client.query("begin");
  const { rows: scored } = await client.query(
    `insert into public.applications (
       first_name, last_name, email, phone, city, country,
       ownership, home_type, fenced_space, adult_count, hours_alone,
       owned_before, previous_dog_history, travel_care, dog_sleeps,
       will_return, will_spay_neuter, understands_decline
     ) values (
       'Test','Applicant','test@example.com','+10000000000','Valletta','Malta',
       'own','house','yes', 2, 2,
       true, ${"'" + "x".repeat(70) + "'"}, ${"'" + "y".repeat(50) + "'"}, ${"'" + "z".repeat(30) + "'"},
       true, true, true
     ) returning reference, score, jsonb_array_length(score_breakdown) as factors`
  );
  const row = scored[0];
  row.reference?.startsWith("APP-")
    ? pass(`reference assigned: ${row.reference}`)
    : fail(`reference not assigned (got ${row.reference})`);
  Number(row.score) === 10
    ? pass(`ideal application scored ${row.score}/10`)
    : fail(`ideal application scored ${row.score}/10, expected 10`);
  // Nine factors in this breed's rubric: the eight shared ones plus
  // "Handling risk", which scores on the youngest child's age because an
  // adult Yorkshire Terrier weighs two to three kilograms.
  row.factors === 9
    ? pass(`${row.factors} scoring factors recorded`)
    : fail(`${row.factors} factors, expected 9`);
} finally {
  await client.query("rollback");
}

const { rows: leftover } = await client.query(
  "select count(*)::int as n from public.applications"
);
leftover[0].n === 0
  ? pass("applications table left empty")
  : fail(`applications table has ${leftover[0].n} rows — test data leaked`);

await client.end();

console.log(
  problems === 0
    ? "\nAll checks passed."
    : `\n${problems} check(s) failed.`
);
process.exit(problems === 0 ? 0 : 1);
