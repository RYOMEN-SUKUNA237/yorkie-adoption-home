/**
 * Automated WhatsApp delivery.
 *
 * The previous implementation only ever *generated* a `wa.me` link unless
 * Twilio credentials happened to be present, which meant a human still had
 * to open WhatsApp and press send. This module actually delivers, through
 * whichever provider is configured, and records the outcome truthfully.
 *
 * Two providers are supported and auto-detected:
 *
 *   Twilio                    TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN,
 *                             TWILIO_WHATSAPP_NUMBER, TWILIO_CONTENT_SID
 *   Meta WhatsApp Cloud API   WHATSAPP_PHONE_NUMBER_ID, WHATSAPP_ACCESS_TOKEN,
 *                             WHATSAPP_TEMPLATE_NAME
 *
 * Twilio is the easier of the two to stand up and is what the setup guide
 * walks through; Meta is cheaper at volume. Nothing here prefers one, so
 * whichever set of credentials exists is the one used.
 *
 * A constraint worth knowing before blaming the code, and it applies to both
 * providers because it is a WhatsApp rule rather than a vendor one: a
 * business may not send arbitrary text to someone who has not messaged it in
 * the last 24 hours. Outside that window only a pre-approved *template* is
 * accepted — Meta rejects free-form text with error 131047, Twilio with
 * 63016. Approval emails almost always fall outside the window, so a
 * template is not optional for this site's main use.
 *
 * Point TWILIO_CONTENT_SID (or WHATSAPP_TEMPLATE_NAME) at an approved
 * template and this module sends that instead of plain text, which works at
 * any time. `templateParams` substitute in order.
 */

import { optional } from "./server.js";

export type WhatsAppProvider = "meta" | "twilio" | "none";

export interface WhatsAppDispatch {
  provider: WhatsAppProvider;
  delivered: boolean;
  /** Provider-side message id, when the provider returns one. */
  messageId: string | null;
  error: string | null;
  /** Machine-readable provider error code, useful for the 131047 case. */
  errorCode: string | null;
  /** The normalised recipient, digits only, country code included. */
  phone: string;
  /** A `wa.me` deep link. Kept for the admin UI, never the delivery path. */
  link: string;
}

/**
 * Reduce whatever the applicant typed to E.164 digits.
 *
 * A ten-digit number with no country code is the common case in the
 * application form; DEFAULT_COUNTRY_CODE decides what it means. Without
 * that, WhatsApp silently treats the digits as an unknown number.
 */
export function normalisePhone(input: string): string {
  let digits = String(input ?? "").replace(/\D/g, "");
  if (!digits) return "";

  // A leading international prefix, written out.
  digits = digits.replace(/^00/, "");

  const cc = (optional("DEFAULT_COUNTRY_CODE") ?? "1").replace(/\D/g, "");
  if (cc && digits.length === 10) digits = cc + digits;

  return digits;
}

export function waLink(phone: string, message: string): string {
  return `https://wa.me/${phone}?text=${encodeURIComponent(message)}`;
}

/**
 * Only one provider's credentials are ever expected to be present, so this
 * order decides nothing in practice. Twilio is checked first purely because
 * it is the documented route.
 */
export function configuredProvider(): WhatsAppProvider {
  if (optional("TWILIO_ACCOUNT_SID") && optional("TWILIO_AUTH_TOKEN") && optional("TWILIO_WHATSAPP_NUMBER")) {
    return "twilio";
  }
  if (optional("WHATSAPP_PHONE_NUMBER_ID") && optional("WHATSAPP_ACCESS_TOKEN")) return "meta";
  return "none";
}

/**
 * Whether the configured provider can reach someone who has not written in
 * the last 24 hours. False means delivery works only during an open
 * conversation window, which for an approval notice is almost never.
 */
export function hasApprovedTemplate(): boolean {
  const provider = configuredProvider();
  if (provider === "twilio") return Boolean(optional("TWILIO_CONTENT_SID"));
  if (provider === "meta") return Boolean(optional("WHATSAPP_TEMPLATE_NAME"));
  return false;
}

interface Attempt {
  delivered: boolean;
  messageId: string | null;
  error: string | null;
  errorCode: string | null;
}

/**
 * Template parameters substitute into the approved template's body in order.
 * Meta rejects newlines and tabs inside a parameter, so they are flattened.
 */
const flatten = (value: string): string => String(value ?? "").replace(/\s*[\r\n\t]+\s*/g, " ").trim();

async function sendViaMeta(phone: string, message: string, templateParams?: string[]): Promise<Attempt> {
  const phoneNumberId = optional("WHATSAPP_PHONE_NUMBER_ID")!;
  const token = optional("WHATSAPP_ACCESS_TOKEN")!;
  const version = optional("WHATSAPP_API_VERSION") ?? "v21.0";
  const templateName = optional("WHATSAPP_TEMPLATE_NAME");
  const templateLang = optional("WHATSAPP_TEMPLATE_LANG") ?? "en_US";

  const body =
    templateName && templateParams?.length
      ? {
          messaging_product: "whatsapp",
          recipient_type: "individual",
          to: phone,
          type: "template",
          template: {
            name: templateName,
            language: { code: templateLang },
            components: [
              {
                type: "body",
                parameters: templateParams.map((text) => ({ type: "text", text: flatten(text) })),
              },
            ],
          },
        }
      : {
          messaging_product: "whatsapp",
          recipient_type: "individual",
          to: phone,
          type: "text",
          text: { preview_url: true, body: message },
        };

  const res = await fetch(`https://graph.facebook.com/${version}/${phoneNumberId}/messages`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

  const payload = (await res.json().catch(() => ({}))) as {
    messages?: Array<{ id?: string }>;
    error?: { message?: string; code?: number; error_subcode?: number; error_data?: { details?: string } };
  };

  if (!res.ok || payload.error) {
    const error = payload.error;
    const detail = error?.error_data?.details;
    return {
      delivered: false,
      messageId: null,
      error: [error?.message, detail].filter(Boolean).join(" — ") || `Meta responded ${res.status}`,
      errorCode: error?.code != null ? String(error.code) : String(res.status),
    };
  }

  return {
    delivered: true,
    messageId: payload.messages?.[0]?.id ?? null,
    error: null,
    errorCode: null,
  };
}

async function sendViaTwilio(
  phone: string,
  message: string,
  templateParams?: string[]
): Promise<Attempt> {
  const sid = optional("TWILIO_ACCOUNT_SID")!;
  const token = optional("TWILIO_AUTH_TOKEN")!;
  const sender = optional("TWILIO_WHATSAPP_NUMBER")!;
  const contentSid = optional("TWILIO_CONTENT_SID");
  const from = sender.startsWith("whatsapp:") ? sender : `whatsapp:${sender.startsWith("+") ? sender : `+${sender}`}`;

  const params = new URLSearchParams({ From: from, To: `whatsapp:+${phone}` });

  if (contentSid && templateParams?.length) {
    // Twilio's Content API is how an approved WhatsApp template is sent:
    // `ContentSid` names the template and `ContentVariables` is a JSON object
    // keyed by the template's 1-based placeholder numbers. `Body` must be
    // omitted — sending both makes Twilio fall back to the free-form path,
    // which is refused outside the 24-hour window with error 63016.
    params.set("ContentSid", contentSid);
    params.set(
      "ContentVariables",
      JSON.stringify(
        Object.fromEntries(templateParams.map((text, i) => [String(i + 1), flatten(text)]))
      )
    );
  } else {
    params.set("Body", message);
  }

  const res = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${sid}/Messages.json`, {
    method: "POST",
    headers: {
      Authorization: `Basic ${Buffer.from(`${sid}:${token}`).toString("base64")}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: params.toString(),
  });

  const payload = (await res.json().catch(() => ({}))) as {
    sid?: string;
    message?: string;
    code?: number;
    status?: string;
  };

  if (!res.ok) {
    return {
      delivered: false,
      messageId: null,
      error: payload.message || `Twilio responded ${res.status}`,
      errorCode: payload.code != null ? String(payload.code) : String(res.status),
    };
  }

  return { delivered: true, messageId: payload.sid ?? null, error: null, errorCode: null };
}

export async function sendWhatsApp(input: {
  phone: string;
  message: string;
  /** Ordered substitutions for the approved template, when one is configured. */
  templateParams?: string[];
}): Promise<WhatsAppDispatch> {
  const phone = normalisePhone(input.phone);
  const link = waLink(phone, input.message);
  const provider = configuredProvider();

  if (!phone) {
    return {
      provider,
      delivered: false,
      messageId: null,
      error: "Recipient number is empty or has no digits.",
      errorCode: "invalid_recipient",
      phone,
      link,
    };
  }

  if (provider === "none") {
    return {
      provider,
      delivered: false,
      messageId: null,
      error:
        "No WhatsApp provider configured. Set TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN and " +
        "TWILIO_WHATSAPP_NUMBER, or WHATSAPP_PHONE_NUMBER_ID and WHATSAPP_ACCESS_TOKEN " +
        "for the Meta Cloud API.",
      errorCode: "not_configured",
      phone,
      link,
    };
  }

  try {
    const attempt =
      provider === "meta"
        ? await sendViaMeta(phone, input.message, input.templateParams)
        : await sendViaTwilio(phone, input.message, input.templateParams);

    return { provider, ...attempt, phone, link };
  } catch (err) {
    return {
      provider,
      delivered: false,
      messageId: null,
      error: err instanceof Error ? err.message : "WhatsApp provider request failed",
      errorCode: "request_failed",
      phone,
      link,
    };
  }
}
