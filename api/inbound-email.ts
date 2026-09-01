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
 * This handler uses the Web signature rather than `(req, res)` because Svix
 * signs the exact request bytes, and `await request.text()` is the only way
 * to see them — a re-serialised `req.body` will not verify.
 */

import { createHmac, timingSafeEqual } from "node:crypto";
import { adminNotifyEmails, db, optional, siteContact, siteOrigin } from "./_lib/server";
import { sendMail, archive } from "./_lib/mailer";
import type { EmailDocument } from "./_lib/branding";

const json = (body: unknown, status = 200): Response =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", "Cache-Control": "no-store" },
  });

/**
 * Svix signature check, as Resend sends it.
 *
 * Skipped with a warning when RESEND_WEBHOOK_SECRET is unset, so an existing
 * deployment keeps working while the secret is being copied over — but an
 * unverified endpoint is an open door, and the log line says so.
 */
function verifySignature(headers: Headers, rawBody: string): { ok: boolean; reason?: string } {
  const secret = optional("RESEND_WEBHOOK_SECRET");
  if (!secret) {
    console.warn(
      "[inbound-email] RESEND_WEBHOOK_SECRET is not set — accepting the request WITHOUT " +
        "verifying its signature. Anyone who knows this URL can post to it."
    );
    return { ok: true, reason: "unverified" };
  }

  const id = headers.get("svix-id");
  const timestamp = headers.get("svix-timestamp");
  const signatures = headers.get("svix-signature");

  if (!id || !timestamp || !signatures) return { ok: false, reason: "missing svix headers" };

  const age = Math.abs(Date.now() / 1000 - Number(timestamp));
  if (!Number.isFinite(age) || age > 300) return { ok: false, reason: "timestamp outside tolerance" };

  const key = Buffer.from(secret.replace(/^whsec_/, ""), "base64");
  const expected = createHmac("sha256", key).update(`${id}.${timestamp}.${rawBody}`).digest();

  for (const entry of signatures.split(" ")) {
    const [version, value] = entry.split(",");
    if (version !== "v1" || !value) continue;
    const candidate = Buffer.from(value, "base64");
    if (candidate.length === expected.length && timingSafeEqual(candidate, expected)) {
      return { ok: true };
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

    const verified = verifySignature(request.headers, rawBody);
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

    // Resend retries on any non-2xx, so the same message can arrive twice.
    if (providerId) {
      const { data: existing } = await db()
        .from("emails")
        .select("id")
        .eq("provider_id", providerId)
        .maybeSingle();

      if (existing) {
        return json({ success: true, deduplicated: true, id: (existing as { id: string }).id });
      }
    }

    const from = splitAddress(data.from);
    const to = Array.isArray(data.to) ? data.to.join(", ") : String(data.to ?? "");
    const subject = String(data.subject ?? "").trim() || "(no subject)";
    const html = String(data.html ?? "");
    const text = String(data.text ?? "").trim() || (html ? stripHtml(html) : "");

    const storedId = await archive({
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

    // Tell the team, in the same voice as everything else we send.
    const contact = await siteContact();
    const origin = siteOrigin();
    const preview = text.slice(0, 1500);

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

    return json({ success: true, inbound: true, id: storedId, verified: verified.reason !== "unverified" });
  } catch (err) {
    console.error("[inbound-email]", err);
    return json({ error: err instanceof Error ? err.message : "Failed to process inbound email" }, 500);
  }
}
