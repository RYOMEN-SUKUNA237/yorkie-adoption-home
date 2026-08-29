import type { RealtimeChannel } from "@supabase/supabase-js";
import { supabase, requireSupabase } from "../lib/supabase";
import type { ConversationRow, MessageRow } from "../lib/database.types";

/**
 * Visitor identity.
 *
 * The messenger is open to people who have not signed up for anything, but
 * RLS needs a subject to scope rows to. Supabase anonymous sign-in gives us
 * exactly that: a real `auth.uid()` backed by a refresh token in
 * localStorage, so the same browser returns to the same thread, while the
 * database still enforces that a visitor can only read their own messages.
 *
 * Requires "Allow anonymous sign-ins" to be enabled in
 * Authentication -> Providers -> Anonymous.
 */
export async function ensureVisitorSession(): Promise<string | null> {
  if (!supabase) return null;

  const { data: existing } = await supabase.auth.getSession();
  if (existing.session?.user) return existing.session.user.id;

  const { data, error } = await supabase.auth.signInAnonymously();
  if (error) {
    console.warn(
      "[messenger] Anonymous sign-in failed. Enable it under Authentication -> Providers -> Anonymous.",
      error.message
    );
    return null;
  }
  return data.user?.id ?? null;
}

/** The visitor's own thread, or null if they have never written. */
export async function getMyConversation(): Promise<ConversationRow | null> {
  if (!supabase) return null;

  const { data: session } = await supabase.auth.getSession();
  const uid = session.session?.user?.id;
  if (!uid) return null;

  const { data, error } = await supabase
    .from("conversations")
    .select("*")
    .eq("visitor_id", uid)
    .order("last_message_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) throw error;
  return (data as ConversationRow) ?? null;
}

export async function createConversation(details: {
  name?: string;
  email?: string;
  subject?: string;
  pageUrl?: string;
}): Promise<ConversationRow> {
  const db = requireSupabase();
  const uid = await ensureVisitorSession();
  if (!uid) throw new Error("Could not start a visitor session.");

  const { data, error } = await db
    .from("conversations")
    .insert({
      visitor_id: uid,
      visitor_name: details.name?.trim() || null,
      visitor_email: details.email?.trim().toLowerCase() || null,
      subject: details.subject?.trim() || null,
      page_url: details.pageUrl ?? (typeof window !== "undefined" ? window.location.href : null),
      user_agent: typeof navigator !== "undefined" ? navigator.userAgent.slice(0, 400) : null,
    })
    .select("*")
    .single();

  if (error) throw error;
  return data as ConversationRow;
}

export async function updateVisitorDetails(
  conversationId: string,
  details: { name?: string; email?: string }
): Promise<void> {
  const db = requireSupabase();
  const patch: Record<string, unknown> = {};
  if (details.name !== undefined) patch.visitor_name = details.name.trim() || null;
  if (details.email !== undefined) patch.visitor_email = details.email.trim().toLowerCase() || null;
  if (!Object.keys(patch).length) return;

  const { error } = await db.from("conversations").update(patch).eq("id", conversationId);
  if (error) throw error;
}

export async function listMessages(conversationId: string): Promise<MessageRow[]> {
  const db = requireSupabase();
  const { data, error } = await db
    .from("messages")
    .select("*")
    .eq("conversation_id", conversationId)
    .order("created_at", { ascending: true });
  if (error) throw error;
  return (data ?? []) as MessageRow[];
}

export async function sendMessage(params: {
  conversationId: string;
  body: string;
  as: "visitor" | "admin";
  senderName?: string | null;
  attachmentUrl?: string | null;
  attachmentName?: string | null;
}): Promise<MessageRow> {
  const db = requireSupabase();
  const { data: session } = await db.auth.getUser();

  const { data, error } = await db
    .from("messages")
    .insert({
      conversation_id: params.conversationId,
      sender_role: params.as,
      sender_id: session.user?.id ?? null,
      sender_name: params.senderName ?? null,
      body: params.body,
      attachment_url: params.attachmentUrl ?? null,
      attachment_name: params.attachmentName ?? null,
    })
    .select("*")
    .single();

  if (error) throw error;
  const msg = data as MessageRow;

  // Trigger admin email alert on visitor messages
  if (params.as === "visitor") {
    try {
      db.from("conversations")
        .select("visitor_name, visitor_email, subject")
        .eq("id", params.conversationId)
        .single()
        .then(({ data: conv }) => {
          void fetch("/api/send-email", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              type: "new_message",
              payload: {
                visitorName: conv?.visitor_name || params.senderName || "Visitor",
                visitorEmail: conv?.visitor_email || "Not specified",
                subject: conv?.subject || "Support Inquiry",
                body: params.body,
              },
            }),
          });
        });
    } catch (notifyErr) {
      console.warn("[messages] Visitor message email trigger failed:", notifyErr);
    }
  }

  // Trigger client email notification when admin replies
  if (params.as === "admin") {
    try {
      db.from("conversations")
        .select("visitor_name, visitor_email, subject")
        .eq("id", params.conversationId)
        .single()
        .then(({ data: conv }) => {
          if (conv?.visitor_email) {
            void fetch("/api/send-email", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                type: "admin_reply",
                payload: {
                  visitorEmail: conv.visitor_email,
                  visitorName: conv.visitor_name || "Client",
                  subject: conv.subject || "Support Inquiry",
                  replyBody: params.body,
                },
              }),
            });
          }
        });
    } catch (replyErr) {
      console.warn("[messages] Admin reply email trigger failed:", replyErr);
    }
  }

  return msg;
}

export async function markRead(conversationId: string, as: "visitor" | "admin"): Promise<void> {
  const db = requireSupabase();
  const { error } = await db.rpc("mark_conversation_read", {
    p_conversation_id: conversationId,
    p_as: as,
  });
  if (error) throw error;
}

// ---------------------------------------------------------------------
// Realtime
// ---------------------------------------------------------------------

/**
 * Subscribe to new messages in one thread.
 *
 * Realtime enforces RLS, so this only ever delivers rows the caller is
 * allowed to read. Returns an unsubscribe function.
 */
export function subscribeToMessages(
  conversationId: string,
  onMessage: (message: MessageRow) => void
): () => void {
  const db = supabase;
  if (!db) return () => {};

  const channel: RealtimeChannel = db
    .channel(`messages:${conversationId}`)
    .on(
      "postgres_changes",
      {
        event: "INSERT",
        schema: "public",
        table: "messages",
        filter: `conversation_id=eq.${conversationId}`,
      },
      (payload) => onMessage(payload.new as MessageRow)
    )
    .subscribe();

  return () => {
    void db.removeChannel(channel);
  };
}

/** Subscribe to the whole inbox — used by the dashboard. */
export function subscribeToInbox(
  onChange: (event: { type: "message" | "conversation"; row: MessageRow | ConversationRow }) => void
): () => void {
  const db = supabase;
  if (!db) return () => {};

  const channel = db
    .channel("admin-inbox")
    .on(
      "postgres_changes",
      { event: "INSERT", schema: "public", table: "messages" },
      (payload) => onChange({ type: "message", row: payload.new as MessageRow })
    )
    .on(
      "postgres_changes",
      { event: "*", schema: "public", table: "conversations" },
      (payload) => onChange({ type: "conversation", row: payload.new as ConversationRow })
    )
    .subscribe();

  return () => {
    void db.removeChannel(channel);
  };
}

// ---------------------------------------------------------------------
// Admin inbox
// ---------------------------------------------------------------------

export interface ConversationFilter {
  status?: "open" | "snoozed" | "closed" | "all";
  search?: string;
  unreadOnly?: boolean;
}

export async function listConversations(
  filter: ConversationFilter = {}
): Promise<ConversationRow[]> {
  const db = requireSupabase();

  let query = db.from("conversations").select("*").order("last_message_at", { ascending: false });

  if (filter.status && filter.status !== "all") query = query.eq("status", filter.status);
  if (filter.unreadOnly) query = query.gt("unread_for_admin", 0);
  if (filter.search?.trim()) {
    const term = `%${filter.search.trim()}%`;
    query = query.or(
      `visitor_name.ilike.${term},visitor_email.ilike.${term},last_message_preview.ilike.${term}`
    );
  }

  const { data, error } = await query.limit(200);
  if (error) throw error;
  return (data ?? []) as ConversationRow[];
}

export async function setConversationStatus(
  id: string,
  status: "open" | "snoozed" | "closed"
): Promise<void> {
  const db = requireSupabase();
  const { error } = await db.from("conversations").update({ status }).eq("id", id);
  if (error) throw error;
}

export async function assignConversation(id: string, profileId: string | null): Promise<void> {
  const db = requireSupabase();
  const { error } = await db.from("conversations").update({ assigned_to: profileId }).eq("id", id);
  if (error) throw error;
}

export async function deleteConversation(id: string): Promise<void> {
  const db = requireSupabase();
  const { error } = await db.from("conversations").delete().eq("id", id);
  if (error) throw error;
}
