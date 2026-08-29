import { supabase, requireSupabase } from "../lib/supabase";
import type { EmailRow } from "../lib/database.types";

export interface ListEmailsOptions {
  direction?: "incoming" | "outgoing" | "all";
  search?: string;
  limit?: number;
  offset?: number;
}

export async function listEmails(options: ListEmailsOptions = {}): Promise<EmailRow[]> {
  const db = requireSupabase();
  const { direction = "all", search, limit = 100, offset = 0 } = options;

  let query = db.from("emails").select("*").order("created_at", { ascending: false });

  if (direction !== "all") {
    query = query.eq("direction", direction);
  }

  if (search?.trim()) {
    const term = `%${search.trim()}%`;
    query = query.or(
      `subject.ilike.${term},to_email.ilike.${term},from_email.ilike.${term},body_text.ilike.${term}`
    );
  }

  const { data, error } = await query.range(offset, offset + limit - 1);
  if (error) throw error;
  return (data ?? []) as EmailRow[];
}

export async function markEmailRead(id: string): Promise<void> {
  const db = requireSupabase();
  const { error } = await db
    .from("emails")
    .update({ read_at: new Date().toISOString() })
    .eq("id", id);
  if (error) throw error;
}

export async function deleteEmail(id: string): Promise<void> {
  const db = requireSupabase();
  const { error } = await db.from("emails").delete().eq("id", id);
  if (error) throw error;
}
