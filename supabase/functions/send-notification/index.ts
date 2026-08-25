/**
 * send-notification — email alerts for new applications and messages.
 *
 * Deploy:
 *   supabase functions deploy send-notification
 *   supabase secrets set RESEND_API_KEY=re_... NOTIFY_EMAIL=you@example.com
 *
 * Then wire it to a Database Webhook (Database → Webhooks) on INSERT for
 * `public.applications` and `public.messages`, or call it directly.
 *
 * Without RESEND_API_KEY the function logs and returns 200 rather than
 * failing — a missing mail provider should never break a submission.
 */

interface WebhookPayload {
  type: "INSERT" | "UPDATE" | "DELETE";
  table: string;
  record: Record<string, unknown>;
  old_record: Record<string, unknown> | null;
}

const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");
const NOTIFY_EMAIL = Deno.env.get("NOTIFY_EMAIL");
const FROM_EMAIL = Deno.env.get("FROM_EMAIL") ?? "onboarding@resend.dev";
const SITE_URL = Deno.env.get("SITE_URL") ?? "";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const escapeHtml = (value: unknown): string =>
  String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");

function buildEmail(payload: WebhookPayload): { subject: string; html: string } | null {
  const r = payload.record;

  if (payload.table === "applications" && payload.type === "INSERT") {
    const name = `${escapeHtml(r.first_name)} ${escapeHtml(r.last_name)}`;
    return {
      subject: `New application ${escapeHtml(r.reference)} — ${name}`,
      html: `
        <div style="font-family:system-ui,-apple-system,sans-serif;max-width:560px">
          <p style="font-size:11px;letter-spacing:.15em;text-transform:uppercase;color:#5A6480">
            New adoption application
          </p>
          <h1 style="font-size:22px;font-weight:400;color:#151B2E;margin:8px 0 4px">${name}</h1>
          <p style="color:#5A6480;margin:0 0 20px">
            ${escapeHtml(r.reference)} · scored ${escapeHtml(r.score)}/10
          </p>
          <table style="width:100%;border-collapse:collapse;font-size:14px;color:#151B2E">
            <tr><td style="padding:6px 0;color:#5A6480">Puppy</td><td>${escapeHtml(r.puppy_name) || "No preference"}</td></tr>
            <tr><td style="padding:6px 0;color:#5A6480">Location</td><td>${escapeHtml(r.city)}, ${escapeHtml(r.country)}</td></tr>
            <tr><td style="padding:6px 0;color:#5A6480">Email</td><td>${escapeHtml(r.email)}</td></tr>
            <tr><td style="padding:6px 0;color:#5A6480">Phone</td><td>${escapeHtml(r.phone)}</td></tr>
            <tr><td style="padding:6px 0;color:#5A6480">Hours alone</td><td>${escapeHtml(r.hours_alone)}h / day</td></tr>
            <tr><td style="padding:6px 0;color:#5A6480">Owned before</td><td>${r.owned_before ? "Yes" : "First dog"}</td></tr>
          </table>
          ${
            SITE_URL
              ? `<p style="margin-top:24px">
                   <a href="${SITE_URL}/admin/applications"
                      style="background:#C2564B;color:#FAF9F6;padding:10px 18px;border-radius:2px;text-decoration:none;font-size:14px">
                     Review in the dashboard
                   </a>
                 </p>`
              : ""
          }
        </div>`,
    };
  }

  // Only visitor messages are worth an alert; staff replies are our own.
  if (payload.table === "messages" && payload.type === "INSERT" && r.sender_role === "visitor") {
    return {
      subject: `New message from ${escapeHtml(r.sender_name) || "a visitor"}`,
      html: `
        <div style="font-family:system-ui,-apple-system,sans-serif;max-width:560px">
          <p style="font-size:11px;letter-spacing:.15em;text-transform:uppercase;color:#5A6480">
            New message
          </p>
          <blockquote style="border-left:3px solid #7C9BC4;margin:16px 0;padding:4px 0 4px 14px;color:#151B2E;font-size:15px;line-height:1.6">
            ${escapeHtml(r.body)}
          </blockquote>
          ${
            SITE_URL
              ? `<p><a href="${SITE_URL}/admin/messages" style="color:#C2564B">Reply in the dashboard</a></p>`
              : ""
          }
        </div>`,
    };
  }

  return null;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });

  try {
    const payload = (await req.json()) as WebhookPayload;
    const email = buildEmail(payload);

    if (!email) {
      return new Response(JSON.stringify({ skipped: "no notification for this event" }), {
        headers: { ...CORS, "Content-Type": "application/json" },
      });
    }

    if (!RESEND_API_KEY || !NOTIFY_EMAIL) {
      console.log("[send-notification] no mail provider configured:", email.subject);
      return new Response(JSON.stringify({ skipped: "mail provider not configured" }), {
        headers: { ...CORS, "Content-Type": "application/json" },
      });
    }

    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${RESEND_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: FROM_EMAIL,
        to: [NOTIFY_EMAIL],
        subject: email.subject,
        html: email.html,
      }),
    });

    if (!response.ok) {
      const detail = await response.text();
      console.error("[send-notification] provider rejected the send:", detail);
      // 200 on purpose: a failed alert must not roll back the row that
      // triggered it, and the webhook has nothing useful to retry.
      return new Response(JSON.stringify({ sent: false, detail }), {
        headers: { ...CORS, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ sent: true }), {
      headers: { ...CORS, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("[send-notification]", error);
    return new Response(JSON.stringify({ error: String(error) }), {
      status: 400,
      headers: { ...CORS, "Content-Type": "application/json" },
    });
  }
});
