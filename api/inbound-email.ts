import { createClient } from "@supabase/supabase-js";
import nodemailer from "nodemailer";

const supabaseUrl = process.env.VITE_SUPABASE_URL || "https://ynvdvsnrnhvmauszfhtf.supabase.co";
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY || "sb_publishable_-cJUoLQ3qg2Qpyt9aziSeg_AGgpF9Gn";
const supabase = createClient(supabaseUrl, supabaseKey);

const ADMIN_NOTIFY_EMAILS = [
  "ntuhgireseelezanw@gmail.com",
  "yannickngwa844@gmail.com",
];

export default async function handler(req: any, res: any) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") {
    return res.status(200).end();
  }

  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const payload = req.body || {};
    const from = payload.from || payload.sender || payload.from_email || "Unknown Sender";
    const to = payload.to || payload.recipient || payload.to_email || "support@yorkieadoptionhome.com";
    const subject = payload.subject || "No Subject";
    const text = payload.text || payload.body_text || payload.body || "";
    const html = payload.html || payload.body_html || "";

    // 1. Insert into emails table as incoming email
    const { data: inserted, error: dbError } = await supabase
      .from("emails")
      .insert({
        direction: "incoming",
        from_email: typeof from === "string" ? from : JSON.stringify(from),
        to_email: typeof to === "string" ? to : JSON.stringify(to),
        subject,
        body_text: text,
        body_html: html,
        status: "received",
      })
      .select("*")
      .single();

    if (dbError) {
      console.warn("[inbound-email] Database save error:", dbError.message);
    }

    // 2. Alert the 2 admin notification emails about the incoming client email
    const user = process.env.GMAIL_USER || "ntuhgireseelezanw@gmail.com";
    const pass = (process.env.GMAIL_APP_PASSWORD || "bzcepcaknyhyazexr").replace(/\s+/g, "");

    const transporter = nodemailer.createTransport({
      service: "gmail",
      auth: { user, pass },
    });

    await Promise.all(
      ADMIN_NOTIFY_EMAILS.map((admin) =>
        transporter.sendMail({
          from: `"Yorkshire Adoption Home Mailbox" <${user}>`,
          to: admin,
          subject: `[Client Reply] ${subject} from ${from}`,
          text: `You have received a new client email to support@yorkieadoptionhome.com!\n\nFrom: ${from}\nSubject: ${subject}\n\nMessage:\n${text}\n\nView and reply in your Admin Dashboard under the Emails tab.`,
          html: `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; border: 1px solid #e2e8f0; border-radius: 8px; padding: 20px; background-color: #ffffff;">
              <h3 style="color: #991b1b; margin-top: 0;">New Client Email Received</h3>
              <p style="font-size: 14px; color: #475569;">A client has sent an email to <strong>support@yorkieadoptionhome.com</strong>.</p>
              <div style="background-color: #f8fafc; border-left: 4px solid #991b1b; padding: 14px; margin: 16px 0;">
                <p style="margin: 0 0 6px 0;"><strong>From:</strong> ${from}</p>
                <p style="margin: 0 0 6px 0;"><strong>Subject:</strong> ${subject}</p>
                <p style="margin: 0; color: #1e293b; white-space: pre-wrap;">${text}</p>
              </div>
              <p style="font-size: 13px; color: #64748b;">
                Log into the Admin Dashboard -> <strong>Emails</strong> to read and reply.
              </p>
            </div>
          `,
        })
      )
    );

    return res.status(200).json({ success: true, message: "Inbound email logged and notified." });
  } catch (err: any) {
    console.error("[inbound-email error]:", err);
    return res.status(500).json({ error: err.message || "Failed to process inbound email" });
  }
}
