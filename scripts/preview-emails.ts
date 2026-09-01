/**
 * Renders every outbound email template to `.email-preview/` so the
 * design can be reviewed in a browser without sending anything.
 *
 *   npm run preview:emails
 *
 * The bodies here are the same `EmailDocument` shapes that `api/send-email.ts`
 * builds, so what you see is what a client receives.
 */

import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { renderEmail, renderEmailText, type EmailDocument } from "../server/branding.js";

const siteName = "Yorkshire Adoption Home";
const siteUrl = "https://www.yorkieadoptionhome.com";
const chrome = {
  siteName,
  siteUrl,
  contactEmail: "support@yorkieadoptionhome.com",
  contactPhone: "+1 (218) 833-2266",
};

const reference = "YAH-2K91-4F7C";
const certUrl = `${siteUrl}/certificate/${reference}`;

const samples: Array<{ name: string; subject: string; document: EmailDocument }> = [
  {
    name: "application-approved",
    subject: `Your adoption application has been approved — ${reference}`,
    document: {
      ...chrome,
      preheader: `Your application for Sixpence has been approved. Reference ${reference}.`,
      eyebrow: "Application approved",
      heading: "Congratulations, Amara",
      intro:
        "Your application to adopt Sixpence has been reviewed and approved. Your certificate of approval is ready.",
      blocks: [
        {
          kind: "details",
          title: "Certificate of approval",
          rows: [
            ["Reference", reference],
            ["Puppy", "Sixpence"],
            ["Applicant", "Amara Okonkwo"],
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
            "Your certificate can be viewed, printed or saved as a PDF at any time using the " +
            "button below. Keep the reference to hand — we ask for it at every step.",
        },
      ],
      primaryAction: { label: "View your certificate", url: certUrl },
      secondaryAction: { label: "Continue in the support chat", url: `${siteUrl}/?chat=open` },
      note:
        "We never ask for payment details by email, and we will never ask you to pay anyone who " +
        "contacts you claiming to represent us. If in doubt, reach us through the website.",
    },
  },
  {
    name: "admin-reply",
    subject: "About collection times for Sixpence",
    document: {
      ...chrome,
      preheader: "Thank you for your patience. We can hold Sixpence until the weekend.",
      eyebrow: "Reply from our team",
      heading: "About collection times for Sixpence",
      intro: "Hello Amara,",
      blocks: [
        {
          kind: "paragraph",
          text:
            "Thank you for your patience. We can hold Sixpence until Saturday afternoon, and " +
            "someone will be at the kennel from ten until four.\n\nIf a weekday suits you better, " +
            "any morning before eleven works well — she is calmest then, which makes the handover " +
            "easier on her.",
        },
      ],
      primaryAction: { label: "Visit the website", url: siteUrl },
      note: "You can reply straight to this email — it reaches the same team.",
    },
  },
  {
    name: "staff-new-application",
    subject: `New application ${reference} — Amara Okonkwo`,
    document: {
      ...chrome,
      preheader: `Amara Okonkwo applied for Sixpence — reference ${reference}`,
      eyebrow: "Adoption application",
      heading: "A new application is waiting for review",
      intro: "Amara Okonkwo completed the adoption questionnaire. The rubric has already scored it.",
      blocks: [
        {
          kind: "details",
          rows: [
            ["Reference", reference],
            ["Applicant", "Amara Okonkwo"],
            ["Email", "amara@example.com"],
            ["Phone", "+1 218 555 0142"],
            ["Location", "Duluth, United States"],
            ["Puppy", "Sixpence"],
            ["Rubric score", "84 out of 100"],
            ["Notification choice", "Email and WhatsApp"],
          ],
        },
      ],
      primaryAction: { label: "Review the application", url: `${siteUrl}/admin/applications` },
      note: "The score is guidance, not a decision. Read the answers in full before approving.",
    },
  },
  {
    name: "staff-inbound-email",
    subject: "Client email — Is Sixpence still available?",
    document: {
      ...chrome,
      preheader: "Amara Okonkwo: Is Sixpence still available?",
      eyebrow: "Inbound email",
      heading: "A client has written in",
      intro: "Amara Okonkwo sent a message to support@yorkieadoptionhome.com.",
      blocks: [
        {
          kind: "details",
          rows: [
            ["From", "Amara Okonkwo <amara@example.com>"],
            ["To", "support@yorkieadoptionhome.com"],
            ["Subject", "Is Sixpence still available?"],
          ],
        },
        {
          kind: "quote",
          text:
            "Good morning — I saw Sixpence on your listings page this week and wondered whether " +
            "she is still looking for a home. We have a fenced garden and I work from home four " +
            "days a week.",
        },
      ],
      primaryAction: { label: "Open the Email Center", url: `${siteUrl}/admin/emails` },
      note: "Reply from the dashboard and the thread stays on record.",
    },
  },
];

// Deliberately not inside `dist`: `vite build` wipes that directory, and
// anything left in it after a build would be published on the live site.
const outDir = join(process.cwd(), ".email-preview");
mkdirSync(outDir, { recursive: true });

const index: string[] = [];

for (const sample of samples) {
  writeFileSync(join(outDir, `${sample.name}.html`), renderEmail(sample.document), "utf8");
  writeFileSync(join(outDir, `${sample.name}.txt`), renderEmailText(sample.document), "utf8");
  index.push(
    `<li><a href="${sample.name}.html">${sample.subject}</a> &nbsp;<a href="${sample.name}.txt" style="font-size:12px;color:#5E6875;">plain text</a></li>`
  );
  console.log(`  ${sample.name}.html  +  .txt`);
}

writeFileSync(
  join(outDir, "index.html"),
  `<!doctype html><meta charset="utf-8"><title>Email previews</title>
<body style="font-family:-apple-system,Segoe UI,Helvetica,Arial,sans-serif;background:#F7F5F2;color:#23282F;padding:40px;">
<h1 style="font-family:Georgia,serif;font-weight:400;">Email previews</h1>
<ul style="line-height:2;">${index.join("")}</ul>
</body>`,
  "utf8"
);

console.log(`\nOpen ${join(outDir, "index.html")}`);
