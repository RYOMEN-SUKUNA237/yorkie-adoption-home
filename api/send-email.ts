/**
 * POST /api/send-email
 *
 * The single outbound mail endpoint. Every message is composed as an
 * `EmailDocument` and rendered by `_lib/branding`, so the templates share one
 * masthead, one palette and one voice, and every send carries a plain-text
 * alternative.
 */

import {
  applyCors,
  adminNotifyEmails,
  fail,
  siteContact,
  siteOrigin,
  type ApiRequest,
  type ApiResponse,
} from "./_lib/server";
import { sendMail } from "./_lib/mailer";
import type { EmailDocument } from "./_lib/branding";

type Payload = Record<string, any>;

const trim = (value: unknown): string => String(value ?? "").trim();

export default async function handler(req: ApiRequest, res: ApiResponse) {
  if (applyCors(req, res)) return;

  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const { type, payload } = (req.body ?? {}) as { type?: string; payload?: Payload };

    if (!type || !payload) {
      return res.status(400).json({ error: "Missing required fields (type, payload)" });
    }

    const contact = await siteContact();
    const origin = siteOrigin();

    /** Shared footer identity for every document below. */
    const chrome = {
      siteName: contact.siteName,
      siteUrl: origin,
      contactEmail: contact.contactEmail,
      contactPhone: contact.contactPhone,
    };

    // -----------------------------------------------------------------
    // Staff alert: a visitor wrote in through the on-site messenger
    // -----------------------------------------------------------------
    if (type === "new_message") {
      const visitorName = trim(payload.visitorName) || "A visitor";
      const visitorEmail = trim(payload.visitorEmail);
      const subject = trim(payload.subject) || "Support enquiry";
      const body = trim(payload.body);

      const document: EmailDocument = {
        ...chrome,
        preheader: `${visitorName} sent a message: ${body.slice(0, 90)}`,
        eyebrow: "Support messenger",
        heading: "A visitor has started a conversation",
        intro: `${visitorName} sent a message through the live chat on the site.`,
        blocks: [
          {
            kind: "details",
            rows: [
              ["Name", visitorName],
              ["Email", visitorEmail || "Not provided"],
              ["Subject", subject],
            ],
          },
          { kind: "quote", text: body, attribution: visitorName },
        ],
        primaryAction: { label: "Open the messenger", url: `${origin}/admin/messages` },
        note: "Replies sent from the dashboard reach the visitor by email as well as in the chat window.",
      };

      await sendMail({
        to: adminNotifyEmails(),
        subject: `New support message — ${subject} (${visitorName})`,
        fromName: `${contact.siteName} Messenger`,
        replyTo: visitorEmail || undefined,
        document,
        tag: "staff-alert",
      });

      return res.status(200).json({ success: true, message: "Support alert sent to staff." });
    }

    // -----------------------------------------------------------------
    // Staff alert: a new adoption application arrived
    // -----------------------------------------------------------------
    if (type === "new_application") {
      const reference = trim(payload.reference);
      const firstName = trim(payload.firstName);
      const lastName = trim(payload.lastName);
      const applicantName = `${firstName} ${lastName}`.trim() || "Applicant";
      const score = payload.score;
      const location = [trim(payload.city), trim(payload.country)].filter(Boolean).join(", ");

      const document: EmailDocument = {
        ...chrome,
        preheader: `${applicantName} applied for ${trim(payload.puppyName) || "any puppy"} — reference ${reference}`,
        eyebrow: "Adoption application",
        heading: "A new application is waiting for review",
        intro: `${applicantName} completed the adoption questionnaire. The rubric has already scored it.`,
        blocks: [
          {
            kind: "details",
            rows: [
              ["Reference", reference],
              ["Applicant", applicantName],
              ["Email", trim(payload.email)],
              ["Phone", trim(payload.phone)],
              ["Location", location],
              ["Puppy", trim(payload.puppyName) || "Open to any puppy"],
              ["Rubric score", score == null ? "Not scored" : `${score} out of 100`],
              [
                "Notification choice",
                trim(payload.notificationPreference) === "whatsapp"
                  ? "WhatsApp only"
                  : trim(payload.notificationPreference) === "both"
                    ? "Email and WhatsApp"
                    : "Email only",
              ],
            ],
          },
        ],
        primaryAction: { label: "Review the application", url: `${origin}/admin/applications` },
        note: "The score is guidance, not a decision. Read the answers in full before approving.",
      };

      await sendMail({
        to: adminNotifyEmails(),
        subject: `New application ${reference} — ${applicantName}`,
        fromName: `${contact.siteName} Applications`,
        replyTo: trim(payload.email) || undefined,
        document,
        tag: "staff-alert",
      });

      return res.status(200).json({ success: true, message: "Application alert sent to staff." });
    }

    // -----------------------------------------------------------------
    // Client: the application was approved
    // -----------------------------------------------------------------
    if (type === "application_approved") {
      const applicantEmail = trim(payload.applicantEmail);
      if (!applicantEmail) {
        return res.status(400).json({ error: "application_approved requires applicantEmail" });
      }

      const applicantName = trim(payload.applicantName) || "there";
      const reference = trim(payload.reference);
      const puppyName = trim(payload.puppyName) || "your chosen puppy";
      const certUrl = `${origin}/certificate/${trim(payload.applicationId) || reference}`;
      const chatUrl = `${origin}/?chat=open&ref=${encodeURIComponent(reference)}`;

      const document: EmailDocument = {
        ...chrome,
        preheader: `Your application for ${puppyName} has been approved. Reference ${reference}.`,
        eyebrow: "Application approved",
        heading: `Congratulations, ${applicantName.split(" ")[0]}`,
        intro: `Your application to adopt ${puppyName} has been reviewed and approved. Your certificate of approval is ready.`,
        blocks: [
          {
            kind: "details",
            title: "Certificate of approval",
            rows: [
              ["Reference", reference],
              ["Puppy", puppyName],
              ["Applicant", trim(payload.applicantName)],
              ["Status", "Approved"],
            ],
          },
          {
            kind: "callout",
            title: "What happens next",
            text:
              "Open the support chat on our website and quote your reference. We complete identity " +
              "verification, send the adoption agreement for signature, and agree collection or " +
              "delivery from there.",
          },
          {
            kind: "paragraph",
            text:
              "Your certificate can be viewed, printed or saved as a PDF at any time using the button " +
              "below. Keep the reference to hand — we ask for it at every step.",
          },
        ],
        primaryAction: { label: "View your certificate", url: certUrl },
        secondaryAction: { label: "Continue in the support chat", url: chatUrl },
        note:
          "We never ask for payment details by email, and we will never ask you to pay anyone who " +
          "contacts you claiming to represent us. If in doubt, reach us through the website.",
      };

      await sendMail({
        to: applicantEmail,
        subject: `Your adoption application has been approved — ${reference}`,
        document,
        archive: true,
        tag: "approval",
      });

      return res.status(200).json({ success: true, message: "Approval email sent to the applicant." });
    }

    // -----------------------------------------------------------------
    // Client: a reply from the dashboard, or a composed email
    // -----------------------------------------------------------------
    if (type === "admin_reply" || type === "direct_email") {
      const recipient = trim(payload.toEmail) || trim(payload.visitorEmail);
      if (!recipient) {
        return res.status(400).json({ error: "A recipient email address is required" });
      }

      const name = trim(payload.clientName) || trim(payload.visitorName);
      const body = trim(payload.messageBody) || trim(payload.replyBody);
      if (!body) {
        return res.status(400).json({ error: "A message body is required" });
      }

      const subject = trim(payload.subject) || `A message from ${contact.siteName}`;
      const greeting = name ? `Hello ${name.split(" ")[0]},` : "Hello,";

      const document: EmailDocument = {
        ...chrome,
        preheader: body.slice(0, 110),
        eyebrow: type === "admin_reply" ? "Reply from our team" : "From our team",
        heading: subject,
        intro: greeting,
        blocks: [{ kind: "paragraph", text: body }],
        primaryAction: { label: "Visit the website", url: origin },
        note: "You can reply straight to this email — it reaches the same team.",
      };

      await sendMail({
        to: recipient,
        subject,
        fromName: `${contact.siteName} Support`,
        document,
        archive: true,
        tag: type === "admin_reply" ? "reply" : "direct",
      });

      return res.status(200).json({ success: true, message: "Email sent." });
    }

    return res.status(400).json({ error: `Unknown email type: ${type}` });
  } catch (err) {
    return fail(res, err, "api/send-email");
  }
}
