/**
 * POST /api/send-whatsapp
 *
 * Sends the message and reports what actually happened. The previous version
 * returned `success: true` whether or not anything was delivered — the only
 * hint was an `apiSent` flag nobody read — and logged every attempt with
 * status `generated`, meaning "a link exists, go press send yourself".
 *
 * Delivery now goes through `_lib/whatsapp`, which drives the Meta Cloud API
 * or Twilio, and the log row records the provider, its message id and its
 * error verbatim.
 */

import {
  applyCors,
  db,
  fail,
  type ApiRequest,
  type ApiResponse,
} from "../server/server.js";
import { configuredProvider, sendWhatsApp } from "../server/whatsapp.js";

export default async function handler(req: ApiRequest, res: ApiResponse) {
  if (applyCors(req, res, "POST, GET, OPTIONS")) return;

  // A quick way to check from a browser whether credentials reached Vercel.
  if (req.method === "GET") {
    const provider = configuredProvider();
    return res.status(200).json({
      status: "ok",
      provider,
      automatic: provider !== "none",
      hint:
        provider === "none"
          ? "Set WHATSAPP_PHONE_NUMBER_ID and WHATSAPP_ACCESS_TOKEN (Meta), or TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN and TWILIO_WHATSAPP_NUMBER."
          : undefined,
    });
  }

  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const { recipientPhone, recipientName, message, reference, templateParams } = (req.body ??
      {}) as {
      recipientPhone?: string;
      recipientName?: string;
      message?: string;
      reference?: string;
      templateParams?: string[];
    };

    if (!recipientPhone || !message) {
      return res.status(400).json({ error: "recipientPhone and message are both required" });
    }

    const dispatch = await sendWhatsApp({
      phone: recipientPhone,
      message,
      templateParams: Array.isArray(templateParams) ? templateParams : undefined,
    });

    // Log the truth, whichever way it went.
    try {
      const { error } = await db()
        .from("whatsapp_logs")
        .insert({
          recipient_phone: dispatch.phone,
          recipient_name: recipientName ?? null,
          reference: reference ?? null,
          message,
          status: dispatch.delivered ? "sent" : "failed",
          provider: dispatch.provider,
          provider_message_id: dispatch.messageId,
          error: dispatch.error,
        });
      if (error) throw error;
    } catch (logErr) {
      console.warn("[api/send-whatsapp] could not write whatsapp_logs:", logErr);
    }

    if (!dispatch.delivered) {
      console.error(
        `[api/send-whatsapp] ${dispatch.provider} refused ${dispatch.phone}: ` +
          `${dispatch.errorCode ?? "?"} ${dispatch.error ?? ""}`
      );
    }

    // 502 when a configured provider rejected the send: the caller asked for
    // a message to go out and it did not. 503 when nothing is configured.
    const status = dispatch.delivered ? 200 : dispatch.errorCode === "not_configured" ? 503 : 502;

    return res.status(status).json({
      success: dispatch.delivered,
      provider: dispatch.provider,
      messageId: dispatch.messageId,
      error: dispatch.error,
      errorCode: dispatch.errorCode,
      phone: dispatch.phone,
      // A manual fallback for the dashboard only — never the delivery path.
      waLink: dispatch.link,
    });
  } catch (err) {
    return fail(res, err, "api/send-whatsapp");
  }
}
