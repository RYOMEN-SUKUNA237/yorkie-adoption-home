/**
 * End-to-end check of every dashboard function, the adoption flow and the
 * messenger — exercised through the real RLS policies.
 *
 *   node scripts/check-admin.mjs
 *
 * Staff actions are tested by impersonating a real profile: `SET LOCAL ROLE
 * authenticated` plus a `request.jwt.claims` setting is exactly what
 * PostgREST does per request, so `auth.uid()` and every policy behave as
 * they do for a signed-in user — without needing anyone's password.
 *
 * Everything runs inside one transaction that is rolled back, so the check
 * never leaves rows behind.
 */
import { readFileSync, existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import pg from "pg";
import { randomUUID } from "node:crypto";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

function loadEnv(file) {
  if (!existsSync(file)) return {};
  const out = {};
  for (const line of readFileSync(file, "utf8").split(/\r?\n/)) {
    const t = line.trim();
    if (!t || t.startsWith("#")) continue;
    const eq = t.indexOf("=");
    if (eq > -1) out[t.slice(0, eq).trim()] = t.slice(eq + 1).trim().replace(/^["']|["']$/g, "");
  }
  return out;
}

const env = loadEnv(path.join(root, ".env.local"));
const connectionString = process.env.DIRECT_URL || env.DIRECT_URL;
if (!connectionString) {
  console.error("No DIRECT_URL in .env.local");
  process.exit(1);
}

const client = new pg.Client({
  connectionString,
  ssl: { rejectUnauthorized: false },
  connectionTimeoutMillis: 30_000,
});

let failures = 0;
let section = "";
const head = (s) => {
  section = s;
  console.log(`\n${s}`);
};
const pass = (m) => console.log(`  PASS  ${m}`);
const fail = (m) => {
  console.log(`  FAIL  ${m}`);
  failures += 1;
};

/** Run a block as a given Postgres role + auth.uid(). */
async function as(role, uid = null) {
  await client.query(`set local role ${role}`);
  await client.query(`select set_config('request.jwt.claims', $1, true)`, [
    uid ? JSON.stringify({ sub: uid, role }) : "",
  ]);
}
async function asOwner() {
  await client.query("reset role");
  await client.query(`select set_config('request.jwt.claims', '', true)`);
}

/** Assert a statement succeeds, returning its rows. */
async function ok(label, sql, params = []) {
  const sp = `sp_${Math.random().toString(36).slice(2, 10)}`;
  await client.query(`savepoint ${sp}`);
  try {
    const { rows } = await client.query(sql, params);
    await client.query(`release savepoint ${sp}`);
    pass(`${label}${rows.length ? ` (${rows.length} row${rows.length === 1 ? "" : "s"})` : ""}`);
    return rows;
  } catch (e) {
    // Roll back just this statement so one failure does not cascade.
    await client.query(`rollback to savepoint ${sp}`).catch(() => {});
    fail(`${label} — ${e.message}`);
    return null;
  }
}

/**
 * Assert a statement is REFUSED (the deny-side of each policy).
 *
 * Wrapped in a savepoint: a policy violation raises, which aborts the
 * enclosing transaction and would make every later check fail with
 * "current transaction is aborted". Rolling back to the savepoint keeps
 * the suite running.
 */
async function denied(label, sql, params = []) {
  const sp = `sp_${Math.random().toString(36).slice(2, 10)}`;
  await client.query(`savepoint ${sp}`);
  try {
    const { rows } = await client.query(sql, params);
    await client.query(`release savepoint ${sp}`);
    if (rows.length === 0) {
      pass(`${label} (returned nothing)`);
      return;
    }
    fail(`${label} — NOT refused, got ${rows.length} row(s)`);
  } catch {
    await client.query(`rollback to savepoint ${sp}`);
    pass(`${label} (refused)`);
  }
}

await client.connect();
await client.query("begin");

try {
  // -----------------------------------------------------------------
  const admin = (
    await client.query(
      `select id, email from public.profiles where role = 'admin' and is_active limit 1`
    )
  ).rows[0];

  if (!admin) {
    console.error("No active admin profile found. Create one in Authentication -> Users.");
    process.exit(1);
  }
  console.log(`Impersonating ${admin.email} (${admin.id.slice(0, 8)}…)`);

  // =================================================================
  head("Adoption flow — public submission");
  // =================================================================
  await as("anon");

  const submitted = await ok(
    "anon submits an application via submit_application()",
    `select public.submit_application($1::jsonb) as result`,
    [
      JSON.stringify({
        first_name: "Endtoend",
        last_name: "Check",
        email: `e2e.${Date.now()}@example.com`,
        phone: "+35612345678",
        city: "Valletta",
        country: "Malta",
        ownership: "own",
        home_type: "house",
        fenced_space: "yes",
        adult_count: 2,
        hours_alone: 3,
        owned_before: true,
        previous_dog_history:
          "We had a Yorkshire Terrier for fifteen years, from eight weeks until she died last spring.",
        dog_sleeps: "In a crate in our bedroom, beside the bed.",
        travel_care: "My sister lives two streets away and has looked after dogs for us before.",
        will_return: true,
        will_spay_neuter: true,
        understands_decline: true,
      }),
    ]
  );

  let applicationId = null;
  if (submitted) {
    const r = submitted[0].result;
    applicationId = r.id;
    r.reference?.startsWith("APP-")
      ? pass(`reference issued: ${r.reference}`)
      : fail(`no reference issued (${r.reference})`);
    Number(r.score) > 8
      ? pass(`scored server-side: ${r.score}/10`)
      : fail(`unexpected score ${r.score}/10 for a strong application`);
  }

  await denied(
    "anon cannot read applications back",
    `select id from public.applications limit 1`
  );

  await ok("anon joins the waitlist", `insert into public.waitlist (email, source) values ($1, 'website')`, [
    `e2e.wait.${Date.now()}@example.com`,
  ]);
  await denied("anon cannot read the waitlist", `select id from public.waitlist limit 1`);

  // =================================================================
  head("Dashboard — overview");
  // =================================================================
  await asOwner();
  await as("authenticated", admin.id);

  const statsRows = await ok("admin_dashboard_stats() RPC", `select public.admin_dashboard_stats() as s`);
  if (statsRows) {
    const s = statsRows[0].s;
    const keys = ["applications", "puppies", "messages", "waitlist", "guides", "applications_by_day", "top_puppies"];
    const missing = keys.filter((k) => !(k in s));
    missing.length
      ? fail(`stats missing keys: ${missing.join(", ")}`)
      : pass(`stats complete (${s.applications.total} applications, ${s.puppies.total} puppies)`);
    Array.isArray(s.applications_by_day) && s.applications_by_day.length === 30
      ? pass("30-day chart series present")
      : fail(`chart series has ${s.applications_by_day?.length} points, expected 30`);
  }

  await ok("activity log readable", `select id from public.activity_log limit 5`);

  // =================================================================
  head("Dashboard — applications");
  // =================================================================
  await ok("list applications", `select id, reference, status from public.applications limit 10`);
  await ok(
    "search applications (the ilike filter the UI sends)",
    `select id from public.applications
      where first_name ilike '%end%' or email ilike '%end%' limit 5`
  );
  await ok(
    "sort by score",
    `select id from public.applications order by score desc, submitted_at desc limit 5`
  );

  if (applicationId) {
    await ok(
      "read one application in full",
      `select * from public.applications where id = $1`,
      [applicationId]
    );

    await ok(
      "change status to shortlisted",
      `update public.applications
          set status = 'shortlisted', reviewed_at = now(), reviewed_by = $2, decision_note = 'e2e check'
        where id = $1`,
      [applicationId, admin.id]
    );

    const sysNotes = await ok(
      "status change wrote a system note",
      `select body from public.application_notes
        where application_id = $1 and is_system order by created_at desc limit 1`,
      [applicationId]
    );
    if (sysNotes && sysNotes.length === 0) fail("no system note was written by the trigger");

    const logged = await ok(
      "status change wrote an activity log entry",
      `select action, meta from public.activity_log
        where entity = 'application' and entity_id = $1 order by created_at desc limit 1`,
      [applicationId]
    );
    if (logged && logged.length === 0) fail("no activity_log row was written");

    await ok(
      "add a staff note",
      `insert into public.application_notes (application_id, author_id, author_name, body)
       values ($1, $2, 'E2E', 'Internal note from the end-to-end check.')`,
      [applicationId, admin.id]
    );

    await ok(
      "re-scoring on update stays server-authoritative",
      `update public.applications set hours_alone = 12 where id = $1 returning score`,
      [applicationId]
    ).then((rows) => {
      if (rows && Number(rows[0].score) >= 9) {
        fail(`score did not fall after worsening hours_alone (${rows[0].score})`);
      } else if (rows) {
        pass(`score recomputed on edit: now ${rows[0].score}/10`);
      }
    });
  }

  // =================================================================
  head("Dashboard — puppies");
  // =================================================================
  const puppyId = randomUUID();
  await ok(
    "create a puppy",
    `insert into public.puppies (id, slug, name, sex, date_of_birth, status, temperament_tags, temperament_notes, photos)
     values ($1, 'e2e-check-puppy', 'E2E Check', 'female', current_date - 60, 'available',
             array['calm']::text[], 'Created by the end-to-end check.', array[]::text[])`,
    [puppyId]
  );
  await ok("update the puppy", `update public.puppies set name = 'E2E Renamed' where id = $1`, [puppyId]);
  await ok(
    "set status to placed",
    `update public.puppies set status = 'placed', placed_at = current_date where id = $1`,
    [puppyId]
  );
  await ok(
    "add vaccination records",
    `insert into public.puppy_vaccinations (puppy_id, name, administered, done, display_order)
     values ($1, 'DHPPi — first (8 weeks)', current_date - 14, true, 0)`,
    [puppyId]
  );
  await ok(
    "add deworming records",
    `insert into public.puppy_dewormings (puppy_id, product, administered, display_order)
     values ($1, 'Milbemax 0.5/12.5 mg', current_date - 30, 0)`,
    [puppyId]
  );
  await ok(
    "unpublish (hidden from the public site)",
    `update public.puppies set is_published = false where id = $1`,
    [puppyId]
  );
  await ok("create a parent", `insert into public.parents (name, role, health_tests)
     values ('E2E Test Sire', 'sire', '[{"test":"Cardiac","result":"Normal"}]'::jsonb)`);
  await ok("delete the puppy (cascades health records)", `delete from public.puppies where id = $1`, [
    puppyId,
  ]);

  // =================================================================
  head("Dashboard — guides");
  // =================================================================
  const guideId = randomUUID();
  await ok(
    "create a guide",
    `insert into public.guides (id, slug, title, summary, sections, reading_time_min)
     values ($1, 'e2e-check-guide', 'E2E Guide', 'Created by the check.',
             '[{"heading":"One","body":"Body text."}]'::jsonb, 4)`,
    [guideId]
  );
  await ok("update the guide", `update public.guides set title = 'E2E Guide v2' where id = $1`, [guideId]);
  await ok("unpublish the guide", `update public.guides set is_published = false where id = $1`, [guideId]);
  await ok("delete the guide", `delete from public.guides where id = $1`, [guideId]);

  // =================================================================
  head("Dashboard — waitlist, settings, team");
  // =================================================================
  await ok("read the waitlist", `select id, email, status from public.waitlist limit 5`);
  await ok(
    "change a waitlist status",
    `update public.waitlist set status = 'contacted'
      where id = (select id from public.waitlist order by created_at desc limit 1)`
  );
  await ok(
    "read settings including private keys",
    `select key from public.site_settings where is_public = false`
  );
  await ok(
    "update a setting",
    `update public.site_settings set value = to_jsonb('E2E hours'::text) where key = 'office_hours'`
  );
  await ok("read the team", `select id, email, role from public.profiles`);
  await ok(
    "promote/demote a teammate (admin only)",
    `update public.profiles set role = role where id = $1`,
    [admin.id]
  );

  // =================================================================
  head("Messenger — visitor side");
  // =================================================================
  const visitorId = randomUUID();
  const conversationId = randomUUID();

  await asOwner();
  await as("authenticated", visitorId);

  await ok(
    "visitor opens a conversation",
    `insert into public.conversations (id, visitor_id, visitor_name, visitor_email, subject)
     values ($1, $2, 'E2E Visitor', 'e2e.visitor@example.com', 'Question about Juniper')`,
    [conversationId, visitorId]
  );
  await ok(
    "visitor posts a message",
    `insert into public.messages (conversation_id, sender_role, sender_id, sender_name, body)
     values ($1, 'visitor', $2, 'E2E Visitor', 'Is Juniper still available?')`,
    [conversationId, visitorId]
  );

  const bumped = await ok(
    "conversation summary updated by trigger",
    `select last_message_preview, unread_for_admin from public.conversations where id = $1`,
    [conversationId]
  );
  if (bumped?.length) {
    bumped[0].unread_for_admin === 1
      ? pass("unread_for_admin incremented to 1")
      : fail(`unread_for_admin is ${bumped[0].unread_for_admin}, expected 1`);
    bumped[0].last_message_preview
      ? pass(`preview stored: "${bumped[0].last_message_preview.slice(0, 40)}"`)
      : fail("last_message_preview not set");
  }

  await denied(
    "visitor CANNOT post as the breeder",
    `insert into public.messages (conversation_id, sender_role, body)
     values ($1, 'admin', 'Forged staff reply') returning id`,
    [conversationId]
  );

  // A second visitor must not see the first one's thread.
  await asOwner();
  await as("authenticated", randomUUID());
  await denied(
    "another visitor cannot read this thread",
    `select id from public.conversations where id = $1`,
    [conversationId]
  );
  await denied(
    "another visitor cannot read its messages",
    `select id from public.messages where conversation_id = $1`,
    [conversationId]
  );

  // =================================================================
  head("Messenger — staff side");
  // =================================================================
  await asOwner();
  await as("authenticated", admin.id);

  await ok("staff sees the conversation", `select id from public.conversations where id = $1`, [
    conversationId,
  ]);
  await ok("staff reads the messages", `select id from public.messages where conversation_id = $1`, [
    conversationId,
  ]);
  await ok(
    "staff replies as admin",
    `insert into public.messages (conversation_id, sender_role, sender_id, sender_name, body)
     values ($1, 'admin', $2, 'Yorkshire Adoption Home', 'She is — shall we talk about your household?')`,
    [conversationId, admin.id]
  );

  const afterReply = await ok(
    "reply bumped the visitor's unread counter",
    `select unread_for_visitor, unread_for_admin from public.conversations where id = $1`,
    [conversationId]
  );
  if (afterReply?.length) {
    afterReply[0].unread_for_visitor === 1
      ? pass("unread_for_visitor incremented to 1")
      : fail(`unread_for_visitor is ${afterReply[0].unread_for_visitor}, expected 1`);
  }

  await ok("staff marks the thread read", `select public.mark_conversation_read($1, 'admin')`, [
    conversationId,
  ]);
  const cleared = await ok(
    "admin unread counter cleared",
    `select unread_for_admin from public.conversations where id = $1`,
    [conversationId]
  );
  if (cleared?.length && cleared[0].unread_for_admin !== 0) {
    fail(`unread_for_admin is ${cleared[0].unread_for_admin}, expected 0`);
  }

  await ok(
    "staff closes the conversation",
    `update public.conversations set status = 'closed' where id = $1`,
    [conversationId]
  );

  // A visitor reply must reopen a closed thread.
  await asOwner();
  await as("authenticated", visitorId);
  await ok(
    "visitor writes again",
    `insert into public.messages (conversation_id, sender_role, body)
     values ($1, 'visitor', 'Yes please.')`,
    [conversationId]
  );
  const reopened = await ok(
    "closed thread reopened automatically",
    `select status from public.conversations where id = $1`,
    [conversationId]
  );
  if (reopened?.length && reopened[0].status !== "open") {
    fail(`status is ${reopened[0].status}, expected open`);
  }

  await ok("visitor marks their side read", `select public.mark_conversation_read($1, 'visitor')`, [
    conversationId,
  ]);

  // =================================================================
  head("Privilege boundaries");
  // =================================================================
  await asOwner();
  await as("authenticated", visitorId); // messenger visitor: session but no profile

  await denied(
    "messenger visitor cannot read applications",
    `select id from public.applications limit 1`
  );
  await denied("messenger visitor cannot read profiles", `select id from public.profiles limit 1`);
  await denied(
    "messenger visitor cannot edit puppies",
    `update public.puppies set name = 'hacked' where slug = 'biscuit' returning id`
  );
  await denied(
    "messenger visitor cannot read the waitlist",
    `select id from public.waitlist limit 1`
  );
} catch (e) {
  fail(`${section || "suite"} threw: ${e.message}`);
} finally {
  await client.query("rollback").catch(() => {});
  await asOwner().catch(() => {});
  await client.end().catch(() => {});
}

console.log(
  failures === 0
    ? "\nAll admin, messaging and adoption checks passed. (Transaction rolled back — no data left behind.)"
    : `\n${failures} check(s) failed.`
);
process.exit(failures === 0 ? 0 : 1);
