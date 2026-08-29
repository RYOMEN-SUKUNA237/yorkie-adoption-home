import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.VITE_SUPABASE_URL || "https://ynvdvsnrnhvmauszfhtf.supabase.co";
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY || "sb_publishable_-cJUoLQ3qg2Qpyt9aziSeg_AGgpF9Gn";
const supabase = createClient(supabaseUrl, supabaseKey);

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
    const { recipientPhone, recipientName, message, reference, certUrl } = req.body || {};

    if (!recipientPhone || !message) {
      return res.status(400).json({ error: "Missing required parameters (recipientPhone, message)" });
    }

    const cleanPhone = String(recipientPhone).replace(/\D/g, "");

    // Check if Twilio environment variables exist for automated API dispatch
    const accountSid = process.env.TWILIO_ACCOUNT_SID;
    const authToken = process.env.TWILIO_AUTH_TOKEN;
    const fromWhatsApp = process.env.TWILIO_WHATSAPP_NUMBER || "whatsapp:+14155238886";

    let apiSent = false;
    let apiError: string | null = null;

    if (accountSid && authToken) {
      try {
        const auth = Buffer.from(`${accountSid}:${authToken}`).toString("base64");
        const params = new URLSearchParams();
        params.append("From", fromWhatsApp.startsWith("whatsapp:") ? fromWhatsApp : `whatsapp:${fromWhatsApp}`);
        params.append("To", `whatsapp:+${cleanPhone}`);
        params.append("Body", message);

        const twilioRes = await fetch(
          `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json`,
          {
            method: "POST",
            headers: {
              Authorization: `Basic ${auth}`,
              "Content-Type": "application/x-www-form-urlencoded",
            },
            body: params.toString(),
          }
        );

        if (twilioRes.ok) {
          apiSent = true;
        } else {
          const errData = await twilioRes.json();
          apiError = errData.message || "Twilio error";
        }
      } catch (err: any) {
        apiError = err.message;
      }
    }

    // Save WhatsApp dispatch into whatsapp_logs table
    try {
      await supabase.from("whatsapp_logs").insert({
        recipient_phone: cleanPhone,
        recipient_name: recipientName || null,
        reference: reference || null,
        message,
        status: apiSent ? "sent_api" : "generated",
      });
    } catch (logErr) {
      console.warn("[api/send-whatsapp] Failed to log to whatsapp_logs:", logErr);
    }

    const waLink = `https://wa.me/${cleanPhone}?text=${encodeURIComponent(message)}`;

    return res.status(200).json({
      success: true,
      apiSent,
      apiError,
      waLink,
      phone: cleanPhone,
      message: "WhatsApp notification logged and prepared successfully.",
    });
  } catch (err: any) {
    console.error("[api/send-whatsapp error]:", err);
    return res.status(500).json({ error: err.message || "WhatsApp dispatch error" });
  }
}
