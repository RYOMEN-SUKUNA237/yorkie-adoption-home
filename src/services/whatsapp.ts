import { supabase, requireSupabase } from "../lib/supabase";
import type { WhatsAppLogRow } from "../lib/database.types";

export interface ListWhatsAppOptions {
  search?: string;
  limit?: number;
  offset?: number;
}

export async function listWhatsAppLogs(options: ListWhatsAppOptions = {}): Promise<WhatsAppLogRow[]> {
  const db = requireSupabase();
  const { search, limit = 100, offset = 0 } = options;

  let query = db.from("whatsapp_logs").select("*").order("created_at", { ascending: false });

  if (search?.trim()) {
    const term = `%${search.trim()}%`;
    query = query.or(
      `recipient_phone.ilike.${term},recipient_name.ilike.${term},reference.ilike.${term},message.ilike.${term}`
    );
  }

  const { data, error } = await query.range(offset, offset + limit - 1);
  if (error) throw error;
  return (data ?? []) as WhatsAppLogRow[];
}

export async function deleteWhatsAppLog(id: string): Promise<void> {
  const db = requireSupabase();
  const { error } = await db.from("whatsapp_logs").delete().eq("id", id);
  if (error) throw error;
}

/** What the serverless endpoint reports about its own configuration. */
export interface WhatsAppGatewayStatus {
  provider: "meta" | "twilio" | "none";
  /** True when a provider is configured and sends need no human step. */
  automatic: boolean;
  /**
   * True when an approved WhatsApp template is configured. Without one the
   * gateway can only reach a client who wrote within the last 24 hours, so a
   * configured-but-untemplated gateway still fails most approval notices.
   */
  templated?: boolean;
  hint?: string;
}

/**
 * Ask the API which gateway it has credentials for.
 *
 * The dashboard needs this to explain a silent failure honestly: without it,
 * an unconfigured provider is indistinguishable from a working one until a
 * client fails to receive their approval.
 */
export async function getWhatsAppGatewayStatus(): Promise<WhatsAppGatewayStatus> {
  try {
    const res = await fetch("/api/send-whatsapp", { method: "GET" });
    if (!res.ok) throw new Error(`Status endpoint returned ${res.status}`);
    const data = (await res.json()) as WhatsAppGatewayStatus;
    return {
      provider: data.provider ?? "none",
      automatic: Boolean(data.automatic),
      templated: Boolean(data.templated),
      hint: data.hint,
    };
  } catch {
    return {
      provider: "none",
      automatic: false,
      hint: "The WhatsApp endpoint could not be reached. In local development it only exists on a Vercel deployment.",
    };
  }
}
