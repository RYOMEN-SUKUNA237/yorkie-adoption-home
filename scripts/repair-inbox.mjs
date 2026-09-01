/**
 * Inbox repair.
 *
 *   node scripts/repair-inbox.mjs            # report only, changes nothing
 *   node scripts/repair-inbox.mjs --apply    # act
 *
 * Two problems to clean up after the inbound webhook was fixed.
 *
 * 1. Phantom rows. The old handler acted on every Resend event, so each
 *    *outgoing* email was also filed as an *incoming* one, with no body and
 *    the literal sender "Unknown Sender". Those rows are deleted.
 *
 * 2. Missing bodies. The `email.received` webhook carries metadata only; the
 *    body has to be fetched from `GET /emails/receiving/{id}`, which the old
 *    handler did not do. Real received mail is re-read from Resend and the
 *    stored rows are filled in — or inserted, if they were never stored.
 *
 * Reports first, always. Nothing is deleted that this script has not printed.
 */
import { readFileSync, existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import pg from "pg";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const apply = process.argv.includes("--apply");
// --show <text> prints the stored body of matching rows, which is the only
// way to confirm the body actually arrived rather than merely a row.
const showIndex = process.argv.indexOf("--show");
const show = showIndex === -1 ? null : process.argv[showIndex + 1];

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
const env = { ...fileEnv, ...process.env };

const connectionString = env.DIRECT_URL;
const resendKey = env.RESEND_API_KEY;

if (!connectionString) {
  console.error("DIRECT_URL is not set. Add it to .env.local.");
  process.exit(1);
}

const dim = (s) => `\x1b[2m${s}\x1b[0m`;
const bold = (s) => `\x1b[1m${s}\x1b[0m`;

const OWN_DOMAIN = (env.FROM_EMAIL || "support@yorkieadoptionhome.com").split("@")[1];

/**
 * A row that is not really a received email.
 *
 * The old handler stored the *display* form of the sender, so these are
 * strings like `Yorkshire Adoption Home System <support@yorkieadoptionhome.com>`
 * rather than bare addresses, and sometimes a bare name with no address at
 * all. "Unknown Sender" was its literal fallback. The `@example.` and
 * `.invalid` cases are the removed test button and a privilege probe.
 */
function isPhantom(row) {
  const from = String(row.from_email || "").toLowerCase();
  const subject = String(row.subject || "");

  return (
    from.includes(OWN_DOMAIN) ||
    from.startsWith("yorkshire adoption home") ||
    from === "unknown sender" ||
    from.includes("@example.") ||
    from.includes(".invalid") ||
    subject.startsWith("[New Application]") ||
    subject.startsWith("[New Support Message]") ||
    subject.startsWith("[Client Reply]")
  );
}

async function resend(pathname) {
  if (!resendKey) return null;
  const res = await fetch(`https://api.resend.com/${pathname}`, {
    headers: { Authorization: `Bearer ${resendKey}` },
  });
  if (!res.ok) {
    console.warn(dim(`  Resend ${pathname} -> ${res.status}`));
    return null;
  }
  return res.json();
}

const client = new pg.Client({ connectionString, ssl: { rejectUnauthorized: false } });
await client.connect();

try {
  // -----------------------------------------------------------------
  // Report
  // -----------------------------------------------------------------
  const { rows: incoming } = await client.query(`
    select id, from_email, from_name, to_email, subject, provider_id,
           coalesce(length(body_text), 0) as text_len,
           coalesce(length(body_html), 0) as html_len,
           created_at
      from public.emails
     where direction = 'incoming'
     order by created_at desc
  `);

  if (show) {
    const { rows } = await client.query(
      `select from_email, from_name, to_email, subject, status, provider_id,
              body_text, coalesce(length(body_html), 0) as html_len, created_at
         from public.emails
        where direction = 'incoming'
          and (subject ilike '%' || $1 || '%' or from_email ilike '%' || $1 || '%')
        order by created_at desc`,
      [show]
    );
    console.log(`
${bold(`Rows matching "${show}"`)} (${rows.length})`);
    for (const r of rows) {
      console.log(`
  from       : ${r.from_name ? r.from_name + " <" + r.from_email + ">" : r.from_email}`);
      console.log(`  to         : ${r.to_email}`);
      console.log(`  subject    : ${r.subject}`);
      console.log(`  status     : ${r.status}   provider_id: ${r.provider_id ?? "(none)"}`);
      console.log(`  html bytes : ${r.html_len}`);
      console.log(`  text body  :`);
      for (const line of String(r.body_text ?? "(empty)").split(String.fromCharCode(10)).slice(0, 14)) {
        console.log(`    ${dim("|")} ${line}`);
      }
    }
    console.log("");
    await client.end();
    throw { __reportOnly: true };
  }

  const phantoms = incoming.filter(isPhantom);
  const genuine = incoming.filter((r) => !isPhantom(r));

  const bySender = new Map();
  for (const r of incoming) {
    const key = String(r.from_email);
    const bucket = bySender.get(key) ?? { count: 0, phantom: isPhantom(r), empty: 0 };
    bucket.count += 1;
    if (r.text_len === 0 && r.html_len === 0) bucket.empty += 1;
    bySender.set(key, bucket);
  }

  console.log(`\n${bold("Stored incoming rows")} (${incoming.length}), grouped by sender\n`);
  for (const [sender, b] of [...bySender.entries()].sort((a, c) => c[1].count - a[1].count)) {
    console.log(
      `  ${String(b.count).padStart(3)}x  ${b.phantom ? "PHANTOM" : "genuine"}  ` +
        `${b.empty ? `${b.empty} empty  ` : "        "}${sender.slice(0, 56)}`
    );
  }

  if (genuine.length) {
    console.log(`\n${bold("Kept as genuine")}\n`);
    for (const r of genuine) {
      console.log(
        `  ${r.created_at.toISOString().slice(0, 19)}  ` +
          `${String(r.from_email).padEnd(30).slice(0, 30)}  ` +
          `${r.text_len === 0 && r.html_len === 0 ? "EMPTY" : String(r.text_len) + "b"}  ` +
          `${String(r.subject).slice(0, 44)}`
      );
    }
  }

  console.log(`\n${bold("Assessment")}`);
  console.log(`  rows that are really our own outgoing mail       : ${phantoms.length}`);
  console.log(`  rows kept as genuine received mail              : ${genuine.length}`);

  // -----------------------------------------------------------------
  // What Resend actually received
  // -----------------------------------------------------------------
  const received = (await resend("emails/receiving"))?.data ?? [];
  console.log(`  messages Resend has on record                   : ${received.length}`);

  const storedIds = new Set(incoming.map((r) => r.provider_id).filter(Boolean));
  const missing = received.filter((m) => !storedIds.has(m.id));
  console.log(`  received but never stored                       : ${missing.length}`);

  // -----------------------------------------------------------------
  // WhatsApp dispatch log
  // -----------------------------------------------------------------
  const { rows: dispatches } = await client.query(`
    select status, provider, count(*) as n
      from public.whatsapp_logs
     group by status, provider
     order by n desc
  `);

  console.log(`\n${bold("WhatsApp dispatch log")}\n`);
  if (dispatches.length === 0) {
    console.log("  (empty)");
  } else {
    for (const d of dispatches) {
      console.log(
        `  ${String(d.n).padStart(3)}x  ${String(d.status).padEnd(10)}` +
          `via ${d.provider ?? "(unrecorded)"}`
      );
    }
  }

  const { rows: probes } = await client.query(`
    select id, recipient_phone, recipient_name
      from public.whatsapp_logs
     where recipient_name ilike '%probe%'
        or recipient_phone in ('10000000000', '0000000000')
  `);
  if (probes.length) {
    console.log(`\n  ${probes.length} probe row(s) from privilege testing, removable`);
  }

  if (!apply) {
    console.log(`\n${dim("Report only. Re-run with --apply to delete the phantom rows and")}`);
    console.log(`${dim("backfill the genuine messages from Resend.")}\n`);
    await client.end();
    process.exitCode = 0;
    // eslint-disable-next-line no-unsafe-finally
    throw { __reportOnly: true };
  }

  // -----------------------------------------------------------------
  // Apply
  // -----------------------------------------------------------------
  console.log(`\n${bold("Applying")}\n`);
  await client.query("begin");

  if (probes.length) {
    const { rowCount } = await client.query(
      `delete from public.whatsapp_logs where id = any($1::uuid[])`,
      [probes.map((r) => r.id)]
    );
    console.log(`  deleted ${rowCount} WhatsApp probe row(s)`);
  }

  if (phantoms.length) {
    const { rowCount } = await client.query(
      `delete from public.emails where id = any($1::uuid[])`,
      [phantoms.map((r) => r.id)]
    );
    console.log(`  deleted ${rowCount} phantom row(s)`);
  }

  let filled = 0;
  let inserted = 0;

  for (const summary of received) {
    // Self-addressed mail is a test of the pipeline, not client
    // correspondence; backfilling it would undo the deletion above.
    if (String(summary.from ?? "").toLowerCase().includes(OWN_DOMAIN)) {
      console.log(`  skipped  self-addressed  ${String(summary.subject).slice(0, 40)}`);
      continue;
    }

    const full = await resend(`emails/receiving/${summary.id}`);
    if (!full) continue;

    const text = full.text ?? "";
    const html = full.html ?? "";
    const fromRaw = String(full.from ?? summary.from ?? "");
    const match = fromRaw.match(/^\s*(.*?)\s*<([^>]+)>\s*$/);
    const fromName = match ? match[1].replace(/^["']|["']$/g, "").trim() || null : null;
    const fromEmail = match ? match[2].trim() : fromRaw.trim();
    const to = Array.isArray(full.to) ? full.to.join(", ") : String(full.to ?? "");

    // Match on provider_id first, then on the subject/sender/minute, which is
    // how rows written before provider_id existed can still be recognised.
    const { rows: existing } = await client.query(
      `select id from public.emails
        where direction = 'incoming'
          and (provider_id = $1
               or (provider_id is null
                   and subject = $2
                   and lower(from_email) = lower($3)
                   and created_at between $4::timestamptz - interval '10 minutes'
                                      and $4::timestamptz + interval '10 minutes'))
        order by provider_id nulls last
        limit 1`,
      [summary.id, summary.subject ?? "(no subject)", fromEmail, summary.created_at]
    );

    if (existing.length) {
      await client.query(
        `update public.emails
            set body_text = $2, body_html = $3, from_email = $4, from_name = $5,
                to_email = coalesce(nullif($6, ''), to_email), provider_id = $7,
                status = 'received'
          where id = $1`,
        [existing[0].id, text, html || null, fromEmail, fromName, to, summary.id]
      );
      filled += 1;
      console.log(`  filled   ${fromEmail}  ${String(summary.subject).slice(0, 40)}`);
    } else {
      await client.query(
        `insert into public.emails
           (direction, from_email, from_name, to_email, subject,
            body_text, body_html, status, provider_id, created_at)
         values ('incoming', $1, $2, $3, $4, $5, $6, 'received', $7, $8)`,
        [
          fromEmail,
          fromName,
          to || "support@yorkieadoptionhome.com",
          summary.subject ?? "(no subject)",
          text,
          html || null,
          summary.id,
          summary.created_at,
        ]
      );
      inserted += 1;
      console.log(`  inserted ${fromEmail}  ${String(summary.subject).slice(0, 40)}`);
    }
  }

  await client.query("commit");
  console.log(
    `\n${bold("Done.")} ${phantoms.length} deleted, ${filled} filled, ${inserted} inserted.\n`
  );
} catch (err) {
  if (err && err.__reportOnly) {
    // Report-only run, nothing to unwind.
  } else {
    await client.query("rollback").catch(() => {});
    console.error("\nFailed, rolled back:", err?.message ?? err);
    process.exitCode = 1;
  }
} finally {
  await client.end().catch(() => {});
}
