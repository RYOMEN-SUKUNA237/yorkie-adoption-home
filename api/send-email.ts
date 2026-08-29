import nodemailer from "nodemailer";
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.VITE_SUPABASE_URL || "https://ynvdvsnrnhvmauszfhtf.supabase.co";
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY || "sb_publishable_-cJUoLQ3qg2Qpyt9aziSeg_AGgpF9Gn";
const supabase = createClient(supabaseUrl, supabaseKey);

const ADMIN_NOTIFY_EMAILS = [
  "ntuhgireseelezanw@gmail.com",
  "yannickngwa844@gmail.com",
];

async function logEmail(entry: {
  direction: "incoming" | "outgoing";
  from_email: string;
  from_name?: string;
  to_email: string;
  subject: string;
  body_text?: string;
  body_html?: string;
}) {
  try {
    await supabase.from("emails").insert({
      direction: entry.direction,
      from_email: entry.from_email,
      from_name: entry.from_name || null,
      to_email: entry.to_email,
      subject: entry.subject,
      body_text: entry.body_text || null,
      body_html: entry.body_html || null,
      status: "sent",
    });
  } catch (err) {
    console.warn("[api/send-email] Failed to log email to database:", err);
  }
}

async function dispatchEmail(options: {
  to: string;
  subject: string;
  html: string;
  text?: string;
  replyTo?: string;
  fromName?: string;
  isClientFacing?: boolean;
}) {
  const adminNotifyUser = process.env.GMAIL_USER || "ntuhgireseelezanw@gmail.com";
  const pass = (process.env.GMAIL_APP_PASSWORD || "bzcepcaknyhyazexr").replace(/\s+/g, "");
  const resendApiKey = process.env.RESEND_API_KEY || (pass.startsWith("re_") ? pass : null);

  const defaultFromAddress = process.env.FROM_EMAIL || "support@yorkieadoptionhome.com";
  const defaultReplyTo = options.replyTo || defaultFromAddress;
  const fromName = options.fromName || "Yorkshire Adoption Home";

  if (resendApiKey) {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${resendApiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: `${fromName} <${defaultFromAddress}>`,
        to: [options.to],
        reply_to: defaultReplyTo,
        subject: options.subject,
        html: options.html,
        text: options.text,
      }),
    });

    const data = await res.json();
    if (!res.ok) {
      throw new Error(data.message || JSON.stringify(data));
    }

    if (options.isClientFacing) {
      await logEmail({
        direction: "outgoing",
        from_email: defaultFromAddress,
        from_name: fromName,
        to_email: options.to,
        subject: options.subject,
        body_text: options.text,
        body_html: options.html,
      });
    }

    return data;
  } else {
    // Gmail SMTP fallback
    const transporter = nodemailer.createTransport({
      service: "gmail",
      auth: { user: adminNotifyUser, pass },
    });

    const result = await transporter.sendMail({
      from: `"${fromName}" <${defaultFromAddress}>`,
      to: options.to,
      replyTo: defaultReplyTo,
      subject: options.subject,
      html: options.html,
      text: options.text,
    });

    if (options.isClientFacing) {
      await logEmail({
        direction: "outgoing",
        from_email: defaultFromAddress,
        from_name: fromName,
        to_email: options.to,
        subject: options.subject,
        body_text: options.text,
        body_html: options.html,
      });
    }

    return result;
  }
}

export default async function handler(req: any, res: any) {
  // CORS & Method Check
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
    const { type, payload } = req.body || {};

    if (!type || !payload) {
      return res.status(400).json({ error: "Missing required fields (type, payload)" });
    }

    const siteUrl = process.env.VERCEL_URL
      ? `https://${process.env.VERCEL_URL}`
      : "https://yorkshire-adoption-home.vercel.app";

    if (type === "new_message") {
      const { visitorName, visitorEmail, body, subject } = payload;

      // Send simultaneously to both admin notification inboxes
      await Promise.all(
        ADMIN_NOTIFY_EMAILS.map((adminEmail) =>
          dispatchEmail({
            to: adminEmail,
            fromName: "Yorkshire Adoption Home Messenger",
            subject: `[New Support Message] ${subject || "Inquiry"} from ${visitorName || "Visitor"}`,
            text: `New support message from ${visitorName || "Visitor"} (${visitorEmail || "No email"})\n\nMessage:\n${body}`,
            html: `
              <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; border: 1px solid #e0e0e0; border-radius: 8px; padding: 24px; background-color: #ffffff;">
                <h2 style="color: #991b1b; margin-top: 0;">New Support Message Received</h2>
                <p style="color: #4b5563;">A visitor has sent a support message on Yorkshire Adoption Home.</p>
                <div style="background-color: #f9fafb; border-left: 4px solid #991b1b; padding: 16px; margin: 20px 0;">
                  <p style="margin: 0 0 8px 0;"><strong>Name:</strong> ${visitorName || "Anonymous"}</p>
                  <p style="margin: 0 0 8px 0;"><strong>Email:</strong> ${visitorEmail || "Not provided"}</p>
                  <p style="margin: 0;"><strong>Message:</strong></p>
                  <p style="margin: 8px 0 0 0; color: #1f2937; white-space: pre-wrap;">${body}</p>
                </div>
                <p style="font-size: 13px; color: #6b7280;">Log in to the dashboard to reply to this message directly.</p>
              </div>
            `,
            isClientFacing: false,
          })
        )
      );

      return res.status(200).json({ success: true, message: "Support message notifications sent to admin emails." });
    }

    if (type === "new_application") {
      const { reference, firstName, lastName, email, phone, puppyName, score, city, country } = payload;

      // Send simultaneously to both admin notification inboxes
      await Promise.all(
        ADMIN_NOTIFY_EMAILS.map((adminEmail) =>
          dispatchEmail({
            to: adminEmail,
            fromName: "Yorkshire Adoption Home System",
            subject: `[New Application] ${reference} - ${firstName} ${lastName} (${puppyName || "Any Puppy"})`,
            text: `New adoption application received.\nReference: ${reference}\nApplicant: ${firstName} ${lastName}\nEmail: ${email}\nPhone: ${phone}\nLocation: ${city}, ${country}\nPuppy: ${puppyName || "Any"}\nScore: ${score}/100`,
            html: `
              <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; border: 1px solid #e0e0e0; border-radius: 8px; padding: 24px; background-color: #ffffff;">
                <div style="background-color: #991b1b; color: #ffffff; padding: 16px; border-radius: 6px 6px 0 0; text-align: center;">
                  <h2 style="margin: 0; font-size: 20px;">New Adoption Application Submitted</h2>
                </div>
                <div style="padding: 20px 0;">
                  <p style="font-size: 15px; color: #374151;">A new adoption application has been submitted and scored by the system.</p>
                  
                  <table style="width: 100%; border-collapse: collapse; margin-top: 16px;">
                    <tr>
                      <td style="padding: 8px; border-bottom: 1px solid #eee; font-weight: bold;">Reference:</td>
                      <td style="padding: 8px; border-bottom: 1px solid #eee;">${reference}</td>
                    </tr>
                    <tr>
                      <td style="padding: 8px; border-bottom: 1px solid #eee; font-weight: bold;">Applicant:</td>
                      <td style="padding: 8px; border-bottom: 1px solid #eee;">${firstName} ${lastName}</td>
                    </tr>
                    <tr>
                      <td style="padding: 8px; border-bottom: 1px solid #eee; font-weight: bold;">Email:</td>
                      <td style="padding: 8px; border-bottom: 1px solid #eee;"><a href="mailto:${email}">${email}</a></td>
                    </tr>
                    <tr>
                      <td style="padding: 8px; border-bottom: 1px solid #eee; font-weight: bold;">Phone:</td>
                      <td style="padding: 8px; border-bottom: 1px solid #eee;">${phone}</td>
                    </tr>
                    <tr>
                      <td style="padding: 8px; border-bottom: 1px solid #eee; font-weight: bold;">Location:</td>
                      <td style="padding: 8px; border-bottom: 1px solid #eee;">${city}, ${country}</td>
                    </tr>
                    <tr>
                      <td style="padding: 8px; border-bottom: 1px solid #eee; font-weight: bold;">Puppy Preferred:</td>
                      <td style="padding: 8px; border-bottom: 1px solid #eee;">${puppyName || "Open to any puppy"}</td>
                    </tr>
                    <tr>
                      <td style="padding: 8px; border-bottom: 1px solid #eee; font-weight: bold;">Rubric Score:</td>
                      <td style="padding: 8px; border-bottom: 1px solid #eee; font-weight: bold; color: #059669;">${score ?? "N/A"} / 100</td>
                    </tr>
                  </table>

                  <div style="margin-top: 24px; text-align: center;">
                    <a href="${siteUrl}/admin/applications" style="background-color: #991b1b; color: #ffffff; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: bold; display: inline-block;">Review Application in Admin Dashboard</a>
                  </div>
                </div>
              </div>
            `,
            isClientFacing: false,
          })
        )
      );

      return res.status(200).json({ success: true, message: "Application notification emails sent." });
    }

    if (type === "application_approved") {
      const {
        applicantEmail,
        applicantName,
        reference,
        puppyName,
        applicationId,
        sellerWhatsApp,
      } = payload;

      const certUrl = `${siteUrl}/certificate/${applicationId || reference}`;
      const waNumberClean = (sellerWhatsApp || "18587986768").replace(/\D/g, "");
      const waDirectUrl = `https://wa.me/${waNumberClean}?text=${encodeURIComponent(
        `Hello! My adoption application (${reference}) for ${puppyName || "a Yorkshire puppy"} has been APPROVED. Here is my official proof certificate: ${certUrl}`
      )}`;

      await dispatchEmail({
        to: applicantEmail,
        fromName: "Yorkshire Adoption Home",
        subject: `🎉 Congratulations! Your Adoption Application Has Been APPROVED (${reference})`,
        text: `Dear ${applicantName},\n\nYour adoption application (${reference}) for ${puppyName || "your requested puppy"} has been APPROVED!\n\nView Proof Certificate: ${certUrl}\n\nPlease contact the seller to complete final verification.`,
        html: `
          <div style="font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; max-width: 650px; margin: 0 auto; border: 1px solid #e2e8f0; border-radius: 12px; overflow: hidden; background-color: #ffffff; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1);">
            <div style="background-color: #7f1d1d; color: #ffffff; padding: 32px 24px; text-align: center;">
              <div style="font-size: 14px; text-transform: uppercase; letter-spacing: 2px; opacity: 0.9; margin-bottom: 8px;">Official Notification</div>
              <h1 style="margin: 0; font-size: 26px; font-weight: 700;">Adoption Application Approved!</h1>
            </div>
            
            <div style="padding: 32px 28px;">
              <p style="font-size: 16px; color: #334155; line-height: 1.6;">Dear <strong>${applicantName}</strong>,</p>
              
              <p style="font-size: 16px; color: #334155; line-height: 1.6;">
                We are delighted to inform you that your adoption application for <strong>${puppyName || "your requested puppy"}</strong> has been officially <span style="color: #15803d; font-weight: bold;">APPROVED</span>!
              </p>

              <div style="background-color: #f8fafc; border: 2px dashed #cbd5e1; border-radius: 10px; padding: 24px; margin: 28px 0; text-align: center;">
                <span style="display: inline-block; background-color: #dcfce7; color: #166534; font-size: 12px; font-weight: 700; padding: 4px 12px; border-radius: 9999px; margin-bottom: 12px;">PROOF OF APPLICATION APPROVAL</span>
                <h3 style="margin: 0 0 6px 0; color: #0f172a; font-size: 20px;">Reference ID: ${reference}</h3>
                <p style="margin: 0 0 16px 0; color: #64748b; font-size: 14px;">Yorkshire Adoption Home Official Verification</p>
                <a href="${certUrl}" style="background-color: #0f172a; color: #ffffff; padding: 10px 20px; text-decoration: none; border-radius: 6px; font-size: 14px; font-weight: 600; display: inline-block;">View Official Proof Certificate Online</a>
              </div>

              <div style="background-color: #fff7ed; border-left: 4px solid #f97316; padding: 16px 20px; border-radius: 0 8px 8px 0; margin-bottom: 28px;">
                <h4 style="margin: 0 0 6px 0; color: #9a3412; font-size: 15px;">👉 NEXT REQUIRED STEP FOR VERIFICATION:</h4>
                <p style="margin: 0; color: #c2410c; font-size: 14px; line-height: 1.5;">
                  Please reach out immediately to the seller or shelter representative you clicked from to present your Approval Reference ID (<strong>${reference}</strong>). Further identity & location verification will take place directly with the seller before final pickup/delivery arrangements are made.
                </p>
              </div>

              <div style="text-align: center; margin: 32px 0 16px 0;">
                <a href="${waDirectUrl}" style="background-color: #25d366; color: #ffffff; padding: 14px 28px; text-decoration: none; border-radius: 8px; font-weight: 700; font-size: 15px; display: inline-block; box-shadow: 0 2px 4px rgba(37, 211, 102, 0.3);">💬 Contact Seller via WhatsApp Now</a>
              </div>

              <hr style="border: none; border-top: 1px solid #e2e8f0; margin: 32px 0 20px 0;" />
              <p style="font-size: 12px; color: #94a3b8; text-align: center; margin: 0;">
                Yorkshire Adoption Home · Official Automated Approval Notice<br/>
                If you have any questions, reply to this email or contact us via our website.
              </p>
            </div>
          </div>
        `,
        isClientFacing: true,
      });

      return res.status(200).json({ success: true, message: "Approval confirmation email sent to applicant." });
    }

    if (type === "admin_reply" || type === "direct_email") {
      const { visitorEmail, toEmail, visitorName, clientName, subject, replyBody, messageBody } = payload;
      const recipient = toEmail || visitorEmail;
      const name = clientName || visitorName || "Client";
      const bodyText = messageBody || replyBody;

      await dispatchEmail({
        to: recipient,
        fromName: "Yorkshire Adoption Home Support",
        subject: subject || "Update from Yorkshire Adoption Home",
        text: `Dear ${name},\n\n${bodyText}\n\n---\nYorkshire Adoption Home Support\n${siteUrl}`,
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; border: 1px solid #e2e8f0; border-radius: 10px; padding: 24px; background-color: #ffffff;">
            <div style="border-bottom: 2px solid #991b1b; padding-bottom: 12px; margin-bottom: 20px;">
              <h2 style="margin: 0; color: #991b1b; font-size: 18px;">Yorkshire Adoption Home Support</h2>
            </div>
            
            <p style="font-size: 15px; color: #334155; line-height: 1.6;">Hello <strong>${name}</strong>,</p>

            <div style="background-color: #f8fafc; border-left: 4px solid #991b1b; padding: 18px; border-radius: 0 6px 6px 0; margin: 20px 0;">
              <p style="margin: 0; color: #0f172a; font-size: 15px; line-height: 1.6; white-space: pre-wrap;">${bodyText}</p>
            </div>

            <p style="font-size: 13px; color: #64748b; line-height: 1.5; margin-top: 24px;">
              If you have further questions, simply reply directly to this email or chat with us on our website.
            </p>

            <hr style="border: none; border-top: 1px solid #e2e8f0; margin: 24px 0 16px 0;" />
            <p style="font-size: 11px; color: #94a3b8; text-align: center; margin: 0;">
              Yorkshire Adoption Home · <a href="${siteUrl}" style="color: #991b1b; text-decoration: none;">Visit Website</a>
            </p>
          </div>
        `,
        isClientFacing: true,
      });

      return res.status(200).json({ success: true, message: "Email sent successfully to client." });
    }

    return res.status(400).json({ error: "Invalid email notification type" });
  } catch (err: any) {
    console.error("[api/send-email error]:", err);
    return res.status(500).json({ error: err.message || "Failed to send email" });
  }
}
