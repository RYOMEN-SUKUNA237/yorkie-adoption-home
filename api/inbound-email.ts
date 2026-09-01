/**
 * POST /api/inbound-email — the Resend webhook.
 *
 * Three things were wrong with the previous version, and all three showed up
 * in the Email Center as nonsense:
 *
 *  1. It acted on *every* event Resend sends. The webhook is subscribed to
 *     `email.sent`, `email.delivered`, `email.opened` and the rest, and the
 *     old guard was `payload.type === "email.received" || payload.data` —
 *     which is true for all of them. So every outgoing email came straight
 *     back as a fake *incoming* row and alerted both staff inboxes.
 *  2. It never verified the signature, so anyone who knew the URL could
 *     inject mail into the dashboard and make it send.
 *  3. Its staff alert went out over Gmail SMTP using a password committed to
 *     the repository.
 *
 * This one runs on the edge runtime, which hands the handler a `Request`.
 * Svix signs the exact request bytes, and `await request.text()` is the only
 * way to see them: the Node runtime parses the body before the handler is
 * called, and a re-serialised `req.body` will not verify.
 */

export const config = { runtime: "edge" };
import { adminNotifyEmails, db, optional, siteContact, siteOrigin } from "../server/server.js";
import { sendMail, archive } from "../server/mailer.js";
import type { EmailDocument } from "../server/branding.js";

const json = (body: unknown, status = 200): Response =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", "Cache-Control": "no-store" },
  });

/**
 * Web Crypto takes a BufferSource. TypeScript now models `Uint8Array` over
 * `ArrayBufferLike`, which includes `SharedArrayBuffer` and so does not
 * satisfy that, hence the copy into a plain `ArrayBuffer`.
 */
const toBuffer = (bytes: Uint8Array): ArrayBuffer => {
  const out = new ArrayBuffer(bytes.byteLength);
  new Uint8Array(out).set(bytes);
  return out;
};

const b64ToBytes = (value: string): Uint8Array =>
  Uint8Array.from(atob(value), (char) => char.charCodeAt(0));

/** Constant time, so a wrong signature leaks nothing through timing. */
function equalBytes(a: Uint8Array, b: Uint8Array): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i += 1) diff |= a[i] ^ b[i];
  return diff === 0;
}

/**
 * Svix signature check, as Resend sends it.
 *
 * Web Crypto rather than `node:crypto` because this function runs on the edge
 * runtime — which is the whole reason the raw body is available to sign over.
 *
 * Skipped with a warning when RESEND_WEBHOOK_SECRET is unset, so an existing
 * deployment keeps working while the secret is being copied across. An
 * unverified endpoint is an open door, and the log line says so.
 */
async function verifySignature(
  headers: Headers,
  rawBody: string
): Promise<{ ok: boolean; reason?: string }> {
  const secret = optional("RESEND_WEBHOOK_SECRET");
  if (!secret) {
    console.warn(
      "[inbound-email] RESEND_WEBHOOK_SECRET is not set — accepting this request WITHOUT " +
        "verifying its signature. Anyone who knows the URL can post to it."
    );
    return { ok: true, reason: "unverified" };
  }

  const id = headers.get("svix-id");
  const timestamp = headers.get("svix-timestamp");
  const signatures = headers.get("svix-signature");

  if (!id || !timestamp || !signatures) return { ok: false, reason: "missing svix headers" };

  // Replay window. Svix uses five minutes.
  const age = Math.abs(Date.now() / 1000 - Number(timestamp));
  if (!Number.isFinite(age) || age > 300) return { ok: false, reason: "timestamp outside tolerance" };

  const key = await crypto.subtle.importKey(
    "raw",
    toBuffer(b64ToBytes(secret.replace(/^whsec_/, ""))),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );

  const signed = toBuffer(new TextEncoder().encode(`${id}.${timestamp}.${rawBody}`));
  const expected = new Uint8Array(await crypto.subtle.sign("HMAC", key, signed));

  for (const entry of signatures.split(" ")) {
    const [version, value] = entry.split(",");
    if (version !== "v1" || !value) continue;
    try {
      if (equalBytes(b64ToBytes(value), expected)) return { ok: true };
    } catch {
      // A malformed signature is simply not a match.
    }
  }

  return { ok: false, reason: "no matching signature" };
}

/** `Ada Lovelace <ada@example.com>` becomes its two halves. */
function splitAddress(value: unknown): { name: string | null; email: string } {
  const raw = Array.isArray(value) ? value.join(", ") : String(value ?? "");
  const match = raw.match(/^\s*(.*?)\s*<([^>]+)>\s*$/);
  if (match) {
    const name = match[1].replace(/^["']|["']$/g, "").trim();
    return { name: name || null, email: match[2].trim() };
  }
  return { name: null, email: raw.trim() };
}

const stripHtml = (html: string): string =>
  html
    .replace(/<style[\s\S]*?<\/style>/gi, "")
    .replace(/<script[\s\S]*?<\/script>/gi, "")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/p>/gi, "\n\n")
    .replace(/<[^>]*>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/\n{3,}/g, "\n\n")
    .trim();

/**
 * The `email.received` webhook carries metadata only — `from`, `to`,
 * `subject`, `message_id`, `attachments` — and **no body**. The body has to be
 * fetched separately from `GET /emails/receiving/{id}`, which returns `text`,
 * `html`, `raw` and `headers`.
 *
 * Missing this is why received mail showed up in the Email Center with the
 * right sender and subject and nothing to read.
 */
async function fetchReceivedBody(
  id: string
): Promise<{ text: string; html: string; to?: string; from?: string } | null> {
  const apiKey = optional("RESEND_API_KEY");
  if (!apiKey) {
    console.warn("[inbound-email] no RESEND_API_KEY, cannot fetch the message body");
    return null;
  }

  try {
    const res = await fetch(`https://api.resend.com/emails/receiving/${encodeURIComponent(id)}`, {
      headers: { Authorization: `Bearer ${apiKey}` },
    });

    if (!res.ok) {
      console.warn(`[inbound-email] body fetch for ${id} returned ${res.status}`);
      return null;
    }

    const payload = (await res.json()) as {
      text?: string;
      html?: string;
      to?: string[] | string;
      from?: string;
    };

    return {
      text: String(payload.text ?? ""),
      html: String(payload.html ?? ""),
      to: Array.isArray(payload.to) ? payload.to.join(", ") : payload.to,
      from: payload.from,
    };
  } catch (err) {
    console.warn(`[inbound-email] body fetch for ${id} failed:`, err);
    return null;
  }
}

/**
 * Everything from the first quoted-reply marker onwards.
 *
 * A Gmail reply carries the entire previous thread, so an alert that quoted
 * the raw body would be mostly our own last message. The full text is still
 * stored — this only shortens what the alert shows.
 */
function withoutQuotedHistory(text: string): string {
  const markers = [
    /^On .*wrote:\s*$/m,
    /^-{2,}\s*Original Message\s*-{2,}/im,
    /^_{10,}/m,
    /^From: .*$/m,
    /^Sent from /m,
  ];

  let cut = text.length;
  for (const marker of markers) {
    const found = text.search(marker);
    if (found > 0) cut = Math.min(cut, found);
  }

  const trimmed = text.slice(0, cut).replace(/\n{3,}/g, "\n\n").trim();
  // A reply that is nothing but quoted history is better shown whole.
  return trimmed || text.trim();
}

/**
 * Delivery events for mail we sent. The row is already in `public.emails`
 * from the send, so this only moves its status along.
 */
async function recordDeliveryEvent(eventType: string, data: Record<string, any>): Promise<void> {
  const status = {
    "email.delivered": "delivered",
    "email.bounced": "bounced",
    "email.complained": "complained",
    "email.delivery_delayed": "delayed",
    "email.failed": "failed",
    "email.opened": "opened",
  }[eventType];

  if (!status) return;

  const providerId = data.email_id ?? data.id;
  if (!providerId) return;

  try {
    // `opened` must not overwrite a stronger signal such as `bounced`.
    const query = db().from("emails").update({ status }).eq("provider_id", providerId);
    const { error } =
      status === "opened" ? await query.in("status", ["sent", "delivered"]) : await query;
    if (error) throw error;
  } catch (err) {
    console.warn(`[inbound-email] could not apply ${eventType}:`, err);
  }
}

export default async function handler(request: Request): Promise<Response> {
  const cors = {
    "Access-Control-Allow-Origin": siteOrigin(),
    "Access-Control-Allow-Methods": "POST, GET, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization, svix-id, svix-timestamp, svix-signature",
  };

  if (request.method === "OPTIONS") return new Response(null, { status: 204, headers: cors });

  // Resend probes the endpoint before it will save it.
  if (request.method === "GET") {
    return json({
      status: "ok",
      endpoint: "/api/inbound-email",
      signatureVerification: optional("RESEND_WEBHOOK_SECRET") ? "enabled" : "disabled",
    });
  }

  if (request.method !== "POST") return json({ error: "Method not allowed" }, 405);

  try {
    const rawBody = await request.text();

    const verified = await verifySignature(request.headers, rawBody);
    if (!verified.ok) {
      console.warn("[inbound-email] rejected:", verified.reason);
      return json({ error: "Invalid signature" }, 401);
    }

    let event: { type?: string; data?: Record<string, any> } = {};
    try {
      event = JSON.parse(rawBody || "{}");
    } catch {
      return json({ error: "Body is not valid JSON" }, 400);
    }

    const eventType = String(event.type ?? "");
    const data = event.data ?? {};

    // Anything that is not a received email is a delivery signal for mail we
    // sent. Acting on it as if it were inbound is what produced the phantom
    // rows and the duplicate staff alerts.
    if (eventType !== "email.received") {
      await recordDeliveryEvent(eventType, data);
      return json({ success: true, handled: eventType || "unknown", inbound: false });
    }

    const providerId: string | null = data.email_id ?? data.id ?? null;

    const from = splitAddress(data.from);
    const subject = String(data.subject ?? "").trim() || "(no subject)";

    // The webhook may or may not include a body depending on the event
    // version, so take whatever is there and fill the gap from the API.
    let html = String(data.html ?? "");
    let text = String(data.text ?? "");
    let to = Array.isArray(data.to) ? data.to.join(", ") : String(data.to ?? "");

    if (!text.trim() && !html.trim() && providerId) {
      const fetched = await fetchReceivedBody(providerId);
      if (fetched) {
        html = fetched.html || html;
        text = fetched.text || text;
        if (!to && fetched.to) to = fetched.to;
      }
    }

    if (!text.trim() && html.trim()) text = stripHtml(html);

    const outcome = await archive({
      direction: "incoming",
      from_email: from.email || "unknown",
      from_name: from.name,
      to_email: to || (optional("FROM_EMAIL") ?? "support@yorkieadoptionhome.com"),
      subject,
      body_text: text,
      body_html: html || null,
      status: "received",
      provider_id: providerId,
    });

    // Resend retries on any non-2xx, so the same message can arrive twice.
    // The unique index over provider_id is what catches it.
    if (outcome === "duplicate") {
      return json({ success: true, deduplicated: true });
    }

    // Tell the team, in the same voice as everything else we send.
    const contact = await siteContact();
    const origin = siteOrigin();
    const preview = withoutQuotedHistory(text).slice(0, 1500);

    const document: EmailDocument = {
      siteName: contact.siteName,
      siteUrl: origin,
      contactEmail: contact.contactEmail,
      contactPhone: contact.contactPhone,
      preheader: `${from.name || from.email}: ${subject}`,
      eyebrow: "Inbound email",
      heading: "A client has written in",
      intro: `${from.name || from.email} sent a message to ${to || "the support mailbox"}.`,
      blocks: [
        {
          kind: "details",
          rows: [
            ["From", from.name ? `${from.name} <${from.email}>` : from.email],
            ["To", to],
            ["Subject", subject],
          ],
        },
        { kind: "quote", text: preview || "(no message body)" },
      ],
      primaryAction: { label: "Open the Email Center", url: `${origin}/admin/emails` },
      note: "Reply from the dashboard and the thread stays on record.",
    };

    try {
      await sendMail({
        to: adminNotifyEmails(),
        subject: `Client email — ${subject}`,
        fromName: `${contact.siteName} Mailbox`,
        replyTo: from.email || undefined,
        document,
        tag: "inbound-alert",
      });
    } catch (alertErr) {
      // The message is safely stored; a failed alert must not make Resend retry.
      console.warn("[inbound-email] stored the email but could not alert staff:", alertErr);
    }

    return json({
      success: true,
      inbound: true,
      stored: outcome,
      hasBody: Boolean(text.trim() || html.trim()),
      verified: verified.reason !== "unverified",
    });
  } catch (err) {
    console.error("[inbound-email]", err);
    return json({ error: err instanceof Error ? err.message : "Failed to process inbound email" }, 500);
  }
}
