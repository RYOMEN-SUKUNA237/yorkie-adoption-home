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
