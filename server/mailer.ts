/**
 * Outbound mail, through Resend only.
 *
 * The Gmail SMTP fallback that used to live here has been removed. It sent
 * with `From: support@yorkieadoptionhome.com` over Gmail's servers, which
 * neither Gmail's SPF record nor the domain's DKIM key authorises — so every
 * message it sent failed DMARC alignment and was a spam-folder candidate.
 * Resend is the verified sender for this domain (DKIM at
 * `resend._domainkey`, Return-Path under `send.`), so it is the only path.
 */

import { db, optional, required } from "./server.js";
import { renderEmail, renderEmailText, type EmailDocument } from "./branding.js";

export interface SendResult {
  id: string | null;
  to: string;
  subject: string;
}

interface SendOptions {
  to: string | string[];
  subject: string;
  /** Composed through `renderEmail`, so HTML and text cannot drift. */
  document: EmailDocument;
  replyTo?: string;
  fromName?: string;
  /**
   * Client-facing mail is archived in `public.emails` so the Email Center
   * shows a real conversation. Internal alerts to staff are not.
   */
  archive?: boolean;
  /** Tags Resend can filter on in its dashboard. */
  tag?: string;
}

export function fromAddress(): string {
  return optional("FROM_EMAIL") ?? "support@yorkieadoptionhome.com";
}

export async function sendMail(options: SendOptions): Promise<SendResult> {
  const apiKey = required("RESEND_API_KEY");
  const from = fromAddress();
  const fromName = options.fromName ?? "Yorkshire Adoption Home";
  const recipients = Array.isArray(options.to) ? options.to : [options.to];

  const html = renderEmail(options.document);
  const text = renderEmailText(options.document);

  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: `${fromName} <${from}>`,
      to: recipients,
      reply_to: options.replyTo ?? from,
      subject: options.subject,
      html,
      text,
      ...(options.tag ? { tags: [{ name: "category", value: options.tag }] } : {}),
    }),
  });

  const payload = (await res.json().catch(() => ({}))) as { id?: string; message?: string; name?: string };

  if (!res.ok) {
    throw new Error(payload.message || payload.name || `Resend responded ${res.status}`);
  }

  if (options.archive) {
    await archive({
      direction: "outgoing",
      from_email: from,
      from_name: fromName,
      to_email: recipients.join(", "),
      subject: options.subject,
      body_text: text,
      body_html: html,
      status: "sent",
      provider_id: payload.id ?? null,
    });
  }

  return { id: payload.id ?? null, to: recipients.join(", "), subject: options.subject };
}

export interface ArchiveEntry {
  direction: "incoming" | "outgoing";
  from_email: string;
  from_name?: string | null;
  to_email: string;
  subject: string;
  body_text?: string | null;
  body_html?: string | null;
  status?: string;
  provider_id?: string | null;
}

/**
 * Archiving is best-effort. A failed insert must never turn a delivered
 * email into a 500 for the caller.
 */
export async function archive(entry: ArchiveEntry): Promise<string | null> {
  try {
    const { data, error } = await db()
      .from("emails")
      .insert({
        direction: entry.direction,
        from_email: entry.from_email,
        from_name: entry.from_name ?? null,
        to_email: entry.to_email,
        subject: entry.subject,
        body_text: entry.body_text ?? null,
        body_html: entry.body_html ?? null,
        status: entry.status ?? "sent",
        provider_id: entry.provider_id ?? null,
      })
      .select("id")
      .single();

    if (error) throw error;
    return (data as { id: string } | null)?.id ?? null;
  } catch (err) {
    console.warn("[mailer] could not archive email:", err);
    return null;
  }
}
