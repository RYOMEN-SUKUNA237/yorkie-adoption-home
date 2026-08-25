/**
 * Exercises the project the way the browser will: the publishable/anon key
 * only, going through PostgREST and GoTrue, so RLS is genuinely in force.
 *
 *   node scripts/check-client.mjs
 *
 * This is what proves the policies behave — the migration runner connects as
 * the `postgres` superuser, which bypasses RLS entirely and therefore proves
 * nothing about what a visitor can see or do.
 */
import { readFileSync, existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createClient } from "@supabase/supabase-js";
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

const env = { ...loadEnvFile(path.join(root, ".env.local")), ...process.env };
const url = env.VITE_SUPABASE_URL;
const key = env.VITE_SUPABASE_ANON_KEY;

if (!url || !key) {
  console.error("VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY missing from .env.local");
  process.exit(1);
}

const supabase = createClient(url, key, {
  auth: { persistSession: false, autoRefreshToken: false },
});

let problems = 0;
const pass = (m) => console.log(`  PASS  ${m}`);
const fail = (m) => {
  console.log(`  FAIL  ${m}`);
  problems += 1;
};
const warn = (m) => console.log(`  WARN  ${m}`);

// ---- Public reads ---------------------------------------------------
console.log("\nPublic reads (anon key, RLS enforced)");

const { data: puppies, error: puppyErr } = await supabase
  .from("puppies")
  .select("slug, name, status, sire:parents!puppies_sire_id_fkey(name), puppy_vaccinations(name)")
  .eq("is_published", true);

if (puppyErr) fail(`puppies: ${puppyErr.message}`);
else if (!puppies?.length) fail("puppies: returned nothing");
else {
  pass(`puppies: ${puppies.length} rows`);
  puppies[0].sire
    ? pass(`embedded relations resolve (${puppies[0].name} → ${puppies[0].sire.name})`)
    : fail("embedded parent relation did not resolve — check the FK hint names");
  puppies[0].puppy_vaccinations?.length
    ? pass(`health records readable (${puppies[0].puppy_vaccinations.length} for ${puppies[0].name})`)
    : warn("no vaccination rows came back on the first puppy");
}

const { data: guides, error: guideErr } = await supabase.from("guides").select("slug, title");
guideErr ? fail(`guides: ${guideErr.message}`) : pass(`guides: ${guides.length} rows`);

const { data: settings, error: settingsErr } = await supabase
  .from("site_settings")
  .select("key, value");
settingsErr
  ? fail(`site_settings: ${settingsErr.message}`)
  : pass(`site_settings: ${settings.length} public keys`);

// A non-public setting must stay hidden from anon.
const secretVisible = (settings ?? []).some((s) => s.key === "notify_email");
secretVisible
  ? fail("notify_email is visible to anon — is_public flag not respected")
  : pass("private settings hidden from anon");

// ---- Reads that must be refused -------------------------------------
console.log("\nReads that must be refused");

const { data: apps } = await supabase.from("applications").select("*");
apps?.length
  ? fail(`applications leaked ${apps.length} rows to anon`)
  : pass("applications not readable by anon");

const { data: waitlist } = await supabase.from("waitlist").select("*");
waitlist?.length
  ? fail(`waitlist leaked ${waitlist.length} rows to anon`)
  : pass("waitlist not readable by anon");

const { data: profiles } = await supabase.from("profiles").select("*");
profiles?.length
  ? fail(`profiles leaked ${profiles.length} rows to anon`)
  : pass("profiles not readable by anon");

// ---- Public write path ----------------------------------------------
console.log("\nApplication submission (anon insert)");

const stamp = Date.now();
// Submission goes through the RPC: `applications` has no SELECT policy for
// anon, so `insert().select()` would be refused on the RETURNING clause.
const { data: rpcResult, error: insertErr } = await supabase.rpc("submit_application", {
  payload: {
    first_name: "Connectivity",
    last_name: "Check",
    email: `connectivity.check.${stamp}@example.com`,
    phone: "+10000000000",
    city: "Valletta",
    country: "Malta",
    ownership: "own",
    home_type: "house",
    fenced_space: "yes",
    adult_count: 2,
    hours_alone: 2,
    owned_before: true,
    previous_dog_history: "Automated connectivity check row. Safe to delete.",
    travel_care: "Automated connectivity check row. Safe to delete at any time.",
    dog_sleeps: "Automated connectivity check row.",
    will_return: true,
    will_spay_neuter: true,
    understands_decline: true,
  },
});

const inserted = rpcResult;

if (insertErr) {
  fail(`submit_application refused: ${insertErr.message}`);
} else {
  pass(`submitted ${inserted.reference}, server-scored ${inserted.score}/10`);

  // A weak application claiming a perfect score must still be scored honestly.
  const { error: forgeErr, data: forged } = await supabase.rpc("submit_application", {
    payload: {
      first_name: "Forged",
      last_name: "Score",
      email: `forged.${stamp}@example.com`,
      phone: "+10000000000",
      city: "X",
      country: "Y",
      ownership: "rent",
      landlord_allows: "no",
      home_type: "apartment",
      fenced_space: "no",
      adult_count: 1,
      hours_alone: 12,
      owned_before: false,
      will_return: true,
      will_spay_neuter: true,
      understands_decline: true,
      score: 10,          // <- the lie
      status: "approved", // <- the other lie
    },
  });

  if (forgeErr) {
    warn(`forged submission refused outright: ${forgeErr.message}`);
  } else {
    Number(forged.score) < 10
      ? pass(`client-supplied score ignored (server scored ${forged.score}/10, not 10)`)
      : fail("client-supplied score survived — scoring is not server-authoritative");
  }

  // A submission that skips the commitments must be rejected.
  const { error: noCommitErr } = await supabase.rpc("submit_application", {
    payload: {
      first_name: "No", last_name: "Commitment",
      email: `nocommit.${stamp}@example.com`,
      phone: "+1", city: "X", country: "Y",
      will_return: false, will_spay_neuter: true, understands_decline: true,
    },
  });
  noCommitErr
    ? pass("submission without the commitments rejected")
    : fail("submission without the commitments was accepted");

  // anon must not be able to approve anything.
  const { data: escalated } = await supabase
    .from("applications")
    .update({ status: "approved" })
    .eq("id", inserted.id)
    .select("id");
  escalated?.length
    ? fail("anon was able to approve an application")
    : pass("anon cannot change application status");
}

// ---- Anonymous auth (the messenger depends on this) -----------------
console.log("\nAnonymous sign-in (required by the messenger)");
const { data: anonAuth, error: anonErr } = await supabase.auth.signInAnonymously();

if (anonErr) {
  warn(`disabled: ${anonErr.message}`);
  warn("Enable it: Authentication -> Providers -> Anonymous. Until then the");
  warn("messenger shows the email/WhatsApp fallback instead of live chat.");
} else {
  pass(`anonymous session issued (uid ${anonAuth.user?.id.slice(0, 8)}…)`);

  const { data: convo, error: convoErr } = await supabase
    .from("conversations")
    .insert({ visitor_name: "Connectivity check", subject: "automated" , visitor_id: anonAuth.user.id })
    .select("id")
    .single();

  if (convoErr) {
    fail(`conversation insert: ${convoErr.message}`);
  } else {
    pass("visitor can open a conversation");

    const { error: msgErr } = await supabase.from("messages").insert({
      conversation_id: convo.id,
      sender_role: "visitor",
      body: "Automated connectivity check.",
    });
    msgErr ? fail(`message insert: ${msgErr.message}`) : pass("visitor can post a message");

    // The critical one: a visitor must not be able to impersonate the breeder.
    const { error: forgeMsgErr } = await supabase.from("messages").insert({
      conversation_id: convo.id,
      sender_role: "admin",
      body: "Forged staff reply.",
    });
    forgeMsgErr
      ? pass("visitor cannot post as admin (RLS refused it)")
      : fail("visitor WAS able to post as admin - impersonation possible");

    // Resuming a thread. The messenger calls this on every page load; if the
    // select policy is wrong the visitor silently loses their history and the
    // panel opens on the intro form as though they had never written.
    const { data: mine, error: mineErr } = await supabase
      .from("conversations")
      .select("*")
      .eq("visitor_id", anonAuth.user.id)
      .maybeSingle();
    if (mineErr) fail(`visitor cannot re-read own conversation: ${mineErr.message}`);
    else if (!mine) fail("visitor cannot re-read own conversation (no row returned)");
    else pass("visitor can resume their own conversation");

    const { data: myMsgs, error: myMsgsErr } = await supabase
      .from("messages")
      .select("*")
      .eq("conversation_id", convo.id);
    if (myMsgsErr) fail(`visitor cannot read own messages: ${myMsgsErr.message}`);
    else if (!myMsgs?.length) fail("visitor cannot read own messages (none returned)");
    else pass(`visitor can read their own history (${myMsgs.length})`);

    // mark_conversation_read is an RPC because unread_for_* must not be
    // directly writable by the visitor.
    const { error: readErr } = await supabase.rpc("mark_conversation_read", {
      p_conversation_id: convo.id,
      p_as: "visitor",
    });
    readErr ? fail(`mark_conversation_read: ${readErr.message}`) : pass("visitor can mark read");

    // Realtime, which is the whole point of the panel. RLS applies to the
    // replication stream too, so this also proves the visitor is subscribed
    // to their own thread and not merely to a channel name.
    //
    // The budget is deliberately generous: this is the first WebSocket of the
    // run, and a cold Realtime connection has been seen to take well over ten
    // seconds. A tight timeout here fails as "realtime is broken" when the
    // truth is "the socket had not finished connecting", which is a far more
    // expensive thing to be told.
    let probeChannel = null;
    const outcome = await new Promise((resolve) => {
      const timer = setTimeout(
        () => resolve({ ok: false, why: "no INSERT arrived within 30s" }),
        30_000
      );
      const settle = (value) => {
        clearTimeout(timer);
        resolve(value);
      };
      probeChannel = supabase
        .channel(`check:${convo.id}`)
        .on(
          "postgres_changes",
          {
            event: "INSERT",
            schema: "public",
            table: "messages",
            filter: `conversation_id=eq.${convo.id}`,
          },
          () => settle({ ok: true })
        )
        .subscribe(async (status, err) => {
          if (status === "SUBSCRIBED") {
            const { error } = await supabase.from("messages").insert({
              conversation_id: convo.id,
              sender_role: "visitor",
              body: "Realtime probe.",
            });
            if (error) settle({ ok: false, why: `probe insert refused: ${error.message}` });
            return;
          }
          // CHANNEL_ERROR / TIMED_OUT / CLOSED are terminal — say so straight
          // away rather than sitting out the full timeout.
          if (status !== "CLOSED") {
            settle({ ok: false, why: `channel ${status}${err ? `: ${err.message}` : ""}` });
          }
        });
    });
    outcome.ok
      ? pass("realtime delivered the message to the visitor")
      : fail(`realtime: ${outcome.why} - check Database -> Replication`);
    if (probeChannel) await supabase.removeChannel(probeChannel);

    // Isolation: a second visitor must not be able to see the first one's
    // thread. This is the policy that keeps one stranger's conversation out
    // of another stranger's panel.
    const other = createClient(url, key, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const { error: otherAuthErr } = await other.auth.signInAnonymously();
    if (otherAuthErr) {
      warn(`could not open a second visitor session: ${otherAuthErr.message}`);
    } else {
      const { data: leaked } = await other
        .from("conversations")
        .select("id")
        .eq("id", convo.id);
      leaked?.length
        ? fail("another visitor CAN read this conversation - threads are not isolated")
        : pass("another visitor cannot read this conversation");

      const { data: leakedMsgs } = await other
        .from("messages")
        .select("id")
        .eq("conversation_id", convo.id);
      leakedMsgs?.length
        ? fail("another visitor CAN read these messages - threads are not isolated")
        : pass("another visitor cannot read these messages");

      await other.auth.signOut();
    }

    await supabase.from("conversations").delete().eq("id", convo.id);
  }
  await supabase.auth.signOut();
}

// ---------------------------------------------------------------------
// Cleanup
//
// The submission checks go through submit_application(), which really does
// write a row - that is the point, since a mock would prove nothing about
// the trigger or the RPC. But `applications` deliberately has no DELETE
// policy for anon, so the anon key that made these rows cannot remove them,
// and every run left three more behind until db:verify failed with "test
// data leaked" and the dashboard filled up with fake applicants.
//
// So cleanup is a separate, explicitly privileged step that runs only after
// every assertion above has finished with the anon key. The pattern is
// narrow by design: the three generated local-parts at example.com, a
// domain RFC 2606 reserves precisely so it can never be a real applicant.
// ---------------------------------------------------------------------
console.log("\nCleanup");

const adminUrl = env.DIRECT_URL || env.DATABASE_URL;
const TEST_ROW_PATTERN = "^(connectivity\\.check|forged|nocommit)\\.[0-9]+@example\\.com$";

if (!adminUrl) {
  warn("DIRECT_URL not set - the submitted test applications were left behind.");
  warn("Set it in .env.local and re-run, or delete them in Admin -> Applications.");
} else {
  const admin = new pg.Client({
    connectionString: adminUrl,
    ssl: { rejectUnauthorized: false },
  });
  try {
    await admin.connect();
    const { rowCount } = await admin.query(
      "delete from public.applications where email ~ $1",
      [TEST_ROW_PATTERN]
    );
    pass(`removed ${rowCount} test application(s)`);
  } catch (err) {
    fail(`could not remove test applications: ${err.message}`);
  } finally {
    await admin.end().catch(() => {});
  }
}

console.log(
  problems === 0 ? "\nAll client checks passed." : `\n${problems} client check(s) failed.`
);
process.exit(problems === 0 ? 0 : 1);
