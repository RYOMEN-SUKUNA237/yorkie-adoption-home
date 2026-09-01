/**
 * Brand tokens and the email renderer.
 *
 * Every outbound email is composed through `renderEmail` so the whole estate
 * moves together. The palette is lifted from `src/styles/theme.css` — ink,
 * gold and cream — rather than the crimson that had crept into the
 * hand-written templates.
 *
 * Email clients are not browsers. Everything here is tables and inline
 * styles: Outlook still renders with Word's engine, which has no flexbox, no
 * grid, and no `border-radius` on a `div`. Web fonts are a coin toss, so the
 * display face is a serif *stack* that degrades to Georgia.
 */

export const brand = {
  ink: "#23282F",
  inkSoft: "#5E6875",
  inkFaint: "#8C949F",
  gold: "#B8873F",
  goldDeep: "#8F6829",
  goldWash: "#F6EFE3",
  cream: "#F7F5F2",
  paper: "#FFFFFF",
  rule: "#E4E0DA",
  slate: "#5C7A99",
  success: "#2F6B4F",
  successWash: "#EDF4F0",
  serif: "Georgia, 'Times New Roman', Times, serif",
  sans: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Helvetica, Arial, sans-serif",
} as const;

export type EmailBlock =
  | { kind: "paragraph"; text: string }
  | { kind: "details"; title?: string; rows: Array<[string, string]> }
  | { kind: "callout"; title?: string; text: string; tone?: "gold" | "success" | "neutral" }
  | { kind: "quote"; text: string; attribution?: string }
  | { kind: "rule" };

export interface EmailAction {
  label: string;
  url: string;
}

export interface EmailDocument {
  /** Inbox preview line. Without it clients scrape the first body text. */
  preheader: string;
  /** Small letterspaced label above the heading. Two or three words. */
  eyebrow?: string;
  heading: string;
  /** Lead paragraph, set slightly larger than the body. */
  intro?: string;
  blocks?: EmailBlock[];
  primaryAction?: EmailAction;
  secondaryAction?: EmailAction;
  /** Fine print above the footer rule. */
  note?: string;
  siteName: string;
  siteUrl: string;
  contactEmail?: string;
  contactPhone?: string;
}

const esc = (value: unknown): string =>
  String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");

/** Escaped, but newlines survive as line breaks. */
const escMultiline = (value: unknown): string => esc(value).replace(/\r?\n/g, "<br />");

const hasText = (value: unknown): boolean =>
  value !== undefined && value !== null && String(value).trim() !== "";

const toneOf = (tone: "gold" | "success" | "neutral" = "gold") => {
  if (tone === "success") return { bar: brand.success, wash: brand.successWash, title: brand.success };
  if (tone === "neutral") return { bar: brand.inkFaint, wash: brand.cream, title: brand.ink };
  return { bar: brand.gold, wash: brand.goldWash, title: brand.goldDeep };
};

function renderBlock(block: EmailBlock): string {
  switch (block.kind) {
    case "paragraph":
      return `
        <p style="margin:0 0 18px 0;font-family:${brand.sans};font-size:15px;line-height:1.65;color:${brand.ink};">
          ${escMultiline(block.text)}
        </p>`;

    case "details": {
      const visible = block.rows.filter(([, value]) => hasText(value));
      if (visible.length === 0) return "";

      const rows = visible
        .map(([label, value], index) => {
          const border = index === 0 ? "none" : `1px solid ${brand.rule}`;
          const top = index === 0 ? "0" : "11px";
          return `
            <tr>
              <td width="1" style="padding:${top} 22px 11px 0;border-top:${border};font-family:${brand.sans};font-size:11px;letter-spacing:0.08em;text-transform:uppercase;color:${brand.inkSoft};white-space:nowrap;vertical-align:top;">${esc(label)}</td>
              <td style="padding:${top} 0 11px 0;border-top:${border};font-family:${brand.sans};font-size:15px;line-height:1.5;color:${brand.ink};vertical-align:top;">${escMultiline(value)}</td>
            </tr>`;
        })
        .join("");

      const title = block.title
        ? `<p style="margin:0 0 12px 0;font-family:${brand.sans};font-size:11px;letter-spacing:0.12em;text-transform:uppercase;color:${brand.inkFaint};">${esc(block.title)}</p>`
        : "";

      return `
        ${title}
        <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="margin:0 0 26px 0;border-collapse:collapse;">
          ${rows}
        </table>`;
    }

    case "callout": {
      const tone = toneOf(block.tone);
      const title = block.title
        ? `<p style="margin:0 0 6px 0;font-family:${brand.sans};font-size:11px;font-weight:700;letter-spacing:0.1em;text-transform:uppercase;color:${tone.title};">${esc(block.title)}</p>`
        : "";

      return `
        <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="margin:0 0 26px 0;border-collapse:collapse;">
          <tr>
            <td width="3" style="width:3px;background-color:${tone.bar};"></td>
            <td style="background-color:${tone.wash};padding:18px 20px;">
              ${title}
              <p style="margin:0;font-family:${brand.sans};font-size:14px;line-height:1.6;color:${brand.ink};">${escMultiline(block.text)}</p>
            </td>
          </tr>
        </table>`;
    }

    case "quote": {
      const attribution = block.attribution
        ? `<p style="margin:10px 0 0 0;font-family:${brand.sans};font-size:12px;color:${brand.inkSoft};">&mdash; ${esc(block.attribution)}</p>`
        : "";

      return `
        <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="margin:0 0 26px 0;border-collapse:collapse;">
          <tr>
            <td style="padding:4px 0 4px 20px;border-left:2px solid ${brand.rule};">
              <p style="margin:0;font-family:${brand.serif};font-size:16px;line-height:1.7;color:${brand.ink};">${escMultiline(block.text)}</p>
              ${attribution}
            </td>
          </tr>
        </table>`;
    }

    case "rule":
      return `<div style="height:1px;line-height:1px;font-size:0;background-color:${brand.rule};margin:0 0 26px 0;">&nbsp;</div>`;
  }
}

/** A gold, square-cornered button. Built as a table so Outlook fills it. */
function renderPrimary(action: EmailAction): string {
  return `
    <table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:0 0 14px 0;border-collapse:separate;">
      <tr>
        <td style="background-color:${brand.gold};padding:0;">
          <a href="${esc(action.url)}" style="display:inline-block;padding:14px 30px;font-family:${brand.sans};font-size:14px;font-weight:600;letter-spacing:0.02em;color:#FFFFFF;text-decoration:none;">${esc(action.label)}</a>
        </td>
      </tr>
    </table>`;
}

export function renderEmail(doc: EmailDocument): string {
  const blocks = (doc.blocks ?? []).map(renderBlock).join("");
  const year = new Date().getFullYear();

  const footerContact = [
    doc.contactEmail
      ? `<a href="mailto:${esc(doc.contactEmail)}" style="color:${brand.inkSoft};text-decoration:none;">${esc(doc.contactEmail)}</a>`
      : "",
    doc.contactPhone ? esc(doc.contactPhone) : "",
  ]
    .filter(Boolean)
    .join(`<span style="color:${brand.rule};"> &nbsp;&middot;&nbsp; </span>`);

  const eyebrow = doc.eyebrow
    ? `<p style="margin:0 0 14px 0;font-family:${brand.sans};font-size:10px;font-weight:600;letter-spacing:0.18em;text-transform:uppercase;color:${brand.gold};">${esc(doc.eyebrow)}</p>`
    : "";

  const intro = doc.intro
    ? `<p style="margin:0 0 26px 0;font-family:${brand.sans};font-size:16px;line-height:1.65;color:${brand.inkSoft};">${escMultiline(doc.intro)}</p>`
    : "";

  const secondary = doc.secondaryAction
    ? `<p style="margin:0 0 8px 0;font-family:${brand.sans};font-size:13px;line-height:1.6;color:${brand.inkSoft};"><a href="${esc(doc.secondaryAction.url)}" style="color:${brand.slate};text-decoration:underline;">${esc(doc.secondaryAction.label)}</a></p>`
    : "";

  const note = doc.note
    ? `<p style="margin:22px 0 0 0;font-family:${brand.sans};font-size:12px;line-height:1.65;color:${brand.inkFaint};">${escMultiline(doc.note)}</p>`
    : "";

  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width,initial-scale=1" />
<meta name="x-apple-disable-message-reformatting" />
<meta name="color-scheme" content="light" />
<meta name="supported-color-schemes" content="light" />
<title>${esc(doc.heading)}</title>
<!--[if mso]><style>body,table,td,a{font-family:Arial,Helvetica,sans-serif !important;}</style><![endif]-->
<style>
  @media only screen and (max-width:620px) {
    .shell { width:100% !important; }
    .pad { padding-left:24px !important; padding-right:24px !important; }
    .display { font-size:26px !important; }
  }
</style>
</head>
<body style="margin:0;padding:0;background-color:${brand.cream};-webkit-font-smoothing:antialiased;">

<div style="display:none;font-size:1px;line-height:1px;max-height:0;max-width:0;opacity:0;overflow:hidden;mso-hide:all;">${esc(doc.preheader)}</div>

<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="background-color:${brand.cream};">
  <tr>
    <td align="center" style="padding:40px 16px;">

      <table role="presentation" class="shell" cellpadding="0" cellspacing="0" border="0" width="600" style="width:600px;max-width:600px;background-color:${brand.paper};border:1px solid ${brand.rule};border-collapse:collapse;">

        <tr>
          <td class="pad" style="padding:30px 44px;background-color:${brand.ink};">
            <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%">
              <tr>
                <td style="font-family:${brand.serif};font-size:19px;letter-spacing:0.01em;color:${brand.paper};">${esc(doc.siteName)}</td>
                <td align="right" style="font-family:${brand.sans};font-size:10px;letter-spacing:0.16em;text-transform:uppercase;color:${brand.gold};">Yorkshire Terriers</td>
              </tr>
            </table>
          </td>
        </tr>
        <tr><td style="height:3px;line-height:3px;font-size:0;background-color:${brand.gold};">&nbsp;</td></tr>

        <tr>
          <td class="pad" style="padding:44px 44px 0 44px;">
            ${eyebrow}
            <h1 class="display" style="margin:0 0 20px 0;font-family:${brand.serif};font-size:31px;line-height:1.25;font-weight:400;color:${brand.ink};">${esc(doc.heading)}</h1>
            ${intro}
          </td>
        </tr>

        <tr>
          <td class="pad" style="padding:0 44px;">
            ${blocks}
            ${doc.primaryAction ? renderPrimary(doc.primaryAction) : ""}
            ${secondary}
            ${note}
          </td>
        </tr>

        <tr>
          <td class="pad" style="padding:34px 44px 30px 44px;">
            <div style="height:1px;line-height:1px;font-size:0;background-color:${brand.rule};margin:0 0 20px 0;">&nbsp;</div>
            <p style="margin:0 0 6px 0;font-family:${brand.serif};font-size:14px;color:${brand.ink};">${esc(doc.siteName)}</p>
            ${footerContact ? `<p style="margin:0 0 10px 0;font-family:${brand.sans};font-size:12px;color:${brand.inkSoft};">${footerContact}</p>` : ""}
            <p style="margin:0;font-family:${brand.sans};font-size:11px;line-height:1.6;color:${brand.inkFaint};">
              &copy; ${year} ${esc(doc.siteName)}. Sent because you contacted us or applied to adopt.<br />
              <a href="${esc(doc.siteUrl)}" style="color:${brand.inkFaint};text-decoration:underline;">${esc(doc.siteUrl.replace(/^https?:\/\//, ""))}</a>
            </p>
          </td>
        </tr>

      </table>

    </td>
  </tr>
</table>
</body>
</html>`;
}

/**
 * The plain-text alternative, generated from the same document so the two
 * parts cannot drift. Mail that ships HTML alone scores worse with spam
 * filters and reads as broken in text-only clients.
 */
export function renderEmailText(doc: EmailDocument): string {
  const lines: string[] = [];
  const rule = "-".repeat(58);

  lines.push(doc.siteName.toUpperCase(), rule, "");
  if (doc.eyebrow) lines.push(doc.eyebrow.toUpperCase());
  lines.push(doc.heading, "");
  if (doc.intro) lines.push(doc.intro, "");

  for (const block of doc.blocks ?? []) {
    switch (block.kind) {
      case "paragraph":
        lines.push(block.text, "");
        break;
      case "details":
        if (block.title) lines.push(block.title.toUpperCase());
        for (const [label, value] of block.rows) {
          if (!hasText(value)) continue;
          lines.push(`  ${label}: ${value}`);
        }
        lines.push("");
        break;
      case "callout":
        if (block.title) lines.push(block.title.toUpperCase());
        lines.push(block.text, "");
        break;
      case "quote":
        lines.push(block.text.split(/\r?\n/).map((line) => `  "${line}"`).join("\n"));
        if (block.attribution) lines.push(`  -- ${block.attribution}`);
        lines.push("");
        break;
      case "rule":
        lines.push(rule, "");
        break;
    }
  }

  if (doc.primaryAction) lines.push(`${doc.primaryAction.label}:`, doc.primaryAction.url, "");
  if (doc.secondaryAction) lines.push(`${doc.secondaryAction.label}:`, doc.secondaryAction.url, "");
  if (doc.note) lines.push(doc.note, "");

  lines.push(rule, doc.siteName);
  const contact = [doc.contactEmail, doc.contactPhone].filter(Boolean).join("  ·  ");
  if (contact) lines.push(contact);
  lines.push(doc.siteUrl);

  return lines.filter((line, i, all) => !(line === "" && all[i - 1] === "")).join("\n");
}
