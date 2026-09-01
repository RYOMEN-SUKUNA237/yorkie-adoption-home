import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Search, Send, ArrowLeft, Check, Archive, Trash2, Loader2, Paperclip, Mail,
} from "lucide-react";
import { useAsync, useDebounced, useMediaQuery } from "../../../hooks/useAsync";
import {
  deleteConversation, listConversations, listMessages, markRead, sendMessage,
  setConversationStatus, subscribeToInbox, subscribeToMessages,
} from "../../../services/messages";
import type { ConversationRow, MessageRow } from "../../../lib/database.types";
import { dayLabel, formatTime, initials, timeAgo, truncate } from "../../../lib/format";
import { useAuth } from "../../../lib/auth";
import {
  Button, EmptyState, ErrorState, Field, FilterChips, LoadingState, PageHeader, TextArea, TextInput,
} from "../../components/admin/ui";

type StatusFilter = "open" | "closed" | "all";

/**
 * Staff inbox for the floating messenger.
 *
 * Two panes on desktop, one at a time on phones — on a narrow screen the
 * list and the thread swap places rather than being squeezed side by side.
 */
export default function Messages() {
  const { profile } = useAuth();
  const isDesktop = useMediaQuery("(min-width: 1024px)");

  const [statusFilter, setStatusFilter] = useState<StatusFilter>("open");
  const [search, setSearch] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [composeOpen, setComposeOpen] = useState(false);

  const debouncedSearch = useDebounced(search, 300);

  const conversations = useAsync(
    () => listConversations({ status: statusFilter, search: debouncedSearch }),
    [statusFilter, debouncedSearch]
  );

  // Any inbox event refreshes the list so previews and badges stay live.
  useEffect(() => subscribeToInbox(() => conversations.reload()), [conversations.reload]);

  const selected = useMemo(
    () => conversations.data?.find((c) => c.id === selectedId) ?? null,
    [conversations.data, selectedId]
  );

  const showList = isDesktop || !selectedId;
  const showThread = isDesktop || Boolean(selectedId);

  return (
    <>
      <PageHeader
        title="Messages"
        subtitle={
          conversations.data
            ? `${conversations.data.filter((c) => c.unread_for_admin > 0).length} awaiting a reply`
            : undefined
        }
        actions={
          <Button size="sm" variant="primary" onClick={() => setComposeOpen(true)}>
            <Mail size={13} /> Compose Email to Client
          </Button>
        }
      />

      {composeOpen && <ComposeEmailModal onClose={() => setComposeOpen(false)} />}

      <div className="flex-1 flex min-h-0 bg-background">
        {/* Conversation list */}
        {showList && (
          <div className="w-full lg:w-80 xl:w-96 shrink-0 border-r border-border flex flex-col min-h-0">
            <div className="px-4 py-3 border-b border-border flex flex-col gap-3">
              <div className="relative">
                <Search
                  size={14}
                  className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none"
                />
                <TextInput
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search conversations…"
                  className="pl-9"
                  aria-label="Search conversations"
                />
              </div>
              <FilterChips<StatusFilter>
                value={statusFilter}
                onChange={setStatusFilter}
                options={[
                  { value: "open", label: "Open" },
                  { value: "closed", label: "Closed" },
                  { value: "all", label: "All" },
                ]}
              />
            </div>

            <div className="flex-1 overflow-y-auto">
              {conversations.loading && <LoadingState />}
              {conversations.error && (
                <ErrorState error={conversations.error} onRetry={conversations.reload} />
              )}
              {conversations.data?.length === 0 && (
                <EmptyState
                  title="No conversations"
                  description={
                    statusFilter === "open"
                      ? "When a visitor writes from the floating messenger, the thread appears here."
                      : "Nothing in this view."
                  }
                />
              )}
              <ul className="divide-y divide-border">
                {conversations.data?.map((conversation) => (
                  <li key={conversation.id}>
                    <button
                      onClick={() => setSelectedId(conversation.id)}
                      className={`w-full text-left px-4 py-3.5 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:-ring-inset ${
                        selectedId === conversation.id ? "bg-sidebar" : "hover:bg-sidebar/60"
                      }`}
                    >
                      <div className="flex items-start gap-3">
                        <span className="shrink-0 w-9 h-9 rounded-full bg-secondary text-secondary-foreground text-xs font-semibold flex items-center justify-center">
                          {initials(conversation.visitor_name) || "?"}
                        </span>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-baseline justify-between gap-2">
                            <p
                              className={`text-sm truncate ${
                                conversation.unread_for_admin > 0
                                  ? "font-semibold text-foreground"
                                  : "font-medium text-foreground"
                              }`}
                            >
                              {conversation.visitor_name || "Anonymous visitor"}
                            </p>
                            <span className="text-[10px] text-muted-foreground shrink-0">
                              {timeAgo(conversation.last_message_at)}
                            </span>
                          </div>
                          <p
                            className={`text-xs truncate mt-0.5 ${
                              conversation.unread_for_admin > 0
                                ? "text-foreground"
                                : "text-muted-foreground"
                            }`}
                          >
                            {conversation.last_message_preview
                              ? truncate(conversation.last_message_preview, 60)
                              : "No messages yet"}
                          </p>
                          {conversation.visitor_email && (
                            <p className="text-[11px] text-muted-foreground truncate mt-0.5">
                              {conversation.visitor_email}
                            </p>
                          )}
                        </div>
                        {conversation.unread_for_admin > 0 && (
                          <span className="shrink-0 mt-1 min-w-[18px] h-[18px] px-1 rounded-full bg-primary text-primary-foreground text-[10px] font-semibold flex items-center justify-center">
                            {conversation.unread_for_admin}
                          </span>
                        )}
                      </div>
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        )}

        {/* Thread */}
        {showThread && (
          <div className="flex-1 flex flex-col min-w-0 min-h-0">
            {selected ? (
              <Thread
                conversation={selected}
                staffName={profile?.full_name || "Yorkshire Adoption Home"}
                onBack={() => setSelectedId(null)}
                onChanged={() => conversations.reload()}
                onDeleted={() => {
                  setSelectedId(null);
                  conversations.reload();
                }}
              />
            ) : (
              <div className="flex-1 flex items-center justify-center">
                <EmptyState
                  title="Select a conversation"
                  description="Pick a thread on the left to read it and reply."
                />
              </div>
            )}
          </div>
        )}
      </div>
    </>
  );
}

// =====================================================================
// Thread
// =====================================================================

function Thread({
  conversation,
  staffName,
  onBack,
  onChanged,
  onDeleted,
}: {
  conversation: ConversationRow;
  staffName: string;
  onBack: () => void;
  onChanged: () => void;
  onDeleted: () => void;
}) {
  const [messages, setMessages] = useState<MessageRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const scrollRef = useRef<HTMLDivElement>(null);

  // Load history, then clear the unread badge for this thread.
  useEffect(() => {
    let cancelled = false;
    setLoading(true);

    listMessages(conversation.id)
      .then((history) => {
        if (cancelled) return;
        setMessages(history);
        setLoading(false);
        return markRead(conversation.id, "admin").then(onChanged);
      })
      .catch((err) => {
        if (cancelled) return;
        setError(err instanceof Error ? err.message : "Could not load the conversation.");
        setLoading(false);
      });

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [conversation.id]);

  useEffect(
    () =>
      subscribeToMessages(conversation.id, (incoming) => {
        setMessages((current) =>
          current.some((m) => m.id === incoming.id) ? current : [...current, incoming]
        );
        if (incoming.sender_role === "visitor") void markRead(conversation.id, "admin");
      }),
    [conversation.id]
  );

  useEffect(() => {
    const el = scrollRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [messages]);

  const handleSend = useCallback(async () => {
    const body = draft.trim();
    if (!body || sending) return;

    setSending(true);
    setDraft("");
    setError(null);

    try {
      const sent = await sendMessage({
        conversationId: conversation.id,
        body,
        as: "admin",
        senderName: staffName,
      });
      setMessages((current) =>
        current.some((m) => m.id === sent.id) ? current : [...current, sent]
      );
      onChanged();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Message not sent.");
      setDraft(body);
    } finally {
      setSending(false);
    }
  }, [draft, sending, conversation.id, staffName, onChanged]);

  const changeStatus = async (status: "open" | "closed") => {
    await setConversationStatus(conversation.id, status);
    onChanged();
  };

  const grouped = useMemo(() => {
    const groups: Array<{ label: string; items: MessageRow[] }> = [];
    for (const message of messages) {
      const label = dayLabel(message.created_at);
      const last = groups[groups.length - 1];
      if (last && last.label === label) last.items.push(message);
      else groups.push({ label, items: [message] });
    }
    return groups;
  }, [messages]);

  return (
    <>
      <header className="shrink-0 border-b border-border px-4 py-3 flex items-center gap-3 bg-background">
        <button
          onClick={onBack}
          aria-label="Back to conversations"
          className="lg:hidden shrink-0 p-1.5 -ml-1.5 text-muted-foreground hover:text-foreground rounded-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <ArrowLeft size={18} />
        </button>

        <span className="shrink-0 w-9 h-9 rounded-full bg-secondary text-secondary-foreground text-xs font-semibold flex items-center justify-center">
          {initials(conversation.visitor_name) || "?"}
        </span>

        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium text-foreground truncate">
            {conversation.visitor_name || "Anonymous visitor"}
          </p>
          <p className="text-xs text-muted-foreground truncate">
            {conversation.visitor_email ? (
              <a href={`mailto:${conversation.visitor_email}`} className="hover:underline">
                {conversation.visitor_email}
              </a>
            ) : (
              "No email given"
            )}
            {conversation.page_url && ` · from ${shortPath(conversation.page_url)}`}
          </p>
        </div>

        <div className="shrink-0 flex items-center gap-1.5">
          {conversation.visitor_email && (
            <a
              href={`mailto:${conversation.visitor_email}`}
              aria-label="Email this visitor"
              className="hidden sm:inline-flex p-2 text-muted-foreground hover:text-foreground rounded-sm transition-colors"
            >
              <Mail size={15} />
            </a>
          )}
          <Button
            size="sm"
            variant="ghost"
            onClick={() => void changeStatus(conversation.status === "closed" ? "open" : "closed")}
            aria-label={conversation.status === "closed" ? "Reopen" : "Close"}
          >
            {conversation.status === "closed" ? <Archive size={14} /> : <Check size={14} />}
            <span className="hidden sm:inline">
              {conversation.status === "closed" ? "Reopen" : "Close"}
            </span>
          </Button>
        </div>
      </header>

      <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 py-5 min-h-0">
        {loading && <LoadingState />}
        {!loading && messages.length === 0 && (
          <p className="text-center text-sm text-muted-foreground py-10">No messages yet.</p>
        )}

        {grouped.map((group) => (
          <div key={group.label}>
            <div className="flex items-center gap-3 my-4">
              <div className="h-px flex-1 bg-border" />
              <span className="text-[10px] uppercase tracking-[0.15em] text-muted-foreground">
                {group.label}
              </span>
              <div className="h-px flex-1 bg-border" />
            </div>
            {group.items.map((message) => (
              <AdminBubble key={message.id} message={message} />
            ))}
          </div>
        ))}
      </div>

      {error && (
        <p className="px-4 pb-2 text-xs text-primary" role="alert">
          {error}
        </p>
      )}

      <div
        className="shrink-0 border-t border-border bg-background px-4 py-3"
        style={{ paddingBottom: "max(0.75rem, env(safe-area-inset-bottom))" }}
      >
        <div className="flex items-end gap-2">
          <textarea
            value={draft}
            rows={1}
            onChange={(e) => {
              setDraft(e.target.value);
              e.target.style.height = "auto";
              e.target.style.height = `${Math.min(e.target.scrollHeight, 140)}px`;
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                void handleSend();
              }
            }}
            placeholder="Write a reply…  (Enter to send, Shift+Enter for a new line)"
            aria-label="Reply"
            className="flex-1 resize-none px-3.5 py-2.5 bg-input-background border border-border rounded-md text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring leading-relaxed max-h-[140px]"
          />
          <button
            onClick={() => void handleSend()}
            disabled={!draft.trim() || sending}
            aria-label="Send reply"
            className="shrink-0 h-10 w-10 flex items-center justify-center bg-primary text-primary-foreground rounded-md hover:bg-[#A0752F] transition-colors disabled:opacity-40 focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            {sending ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />}
          </button>
        </div>

        <div className="flex items-center justify-end mt-2">
          {confirmDelete ? (
            <div className="flex items-center gap-2">
              <span className="text-xs text-muted-foreground">Delete this thread permanently?</span>
              <Button
                size="sm"
                variant="danger"
                onClick={async () => {
                  await deleteConversation(conversation.id);
                  onDeleted();
                }}
              >
                Delete
              </Button>
              <Button size="sm" variant="ghost" onClick={() => setConfirmDelete(false)}>
                Cancel
              </Button>
            </div>
          ) : (
            <button
              onClick={() => setConfirmDelete(true)}
              className="text-[11px] text-muted-foreground hover:text-primary transition-colors flex items-center gap-1"
            >
              <Trash2 size={11} /> Delete conversation
            </button>
          )}
        </div>
      </div>
    </>
  );
}

function AdminBubble({ message }: { message: MessageRow }) {
  const fromStaff = message.sender_role === "admin";

  if (message.sender_role === "system") {
    return <p className="text-center text-[11px] text-muted-foreground py-2">{message.body}</p>;
  }

  return (
    <div className={`flex flex-col mb-2 ${fromStaff ? "items-end" : "items-start"}`}>
      <div
        className={`max-w-[80%] px-3.5 py-2.5 rounded-lg text-sm leading-relaxed break-words ${
          fromStaff
            ? "bg-primary text-primary-foreground rounded-br-sm"
            : "bg-secondary text-secondary-foreground rounded-tl-sm"
        }`}
      >
        {message.attachment_url ? (
          <a
            href={message.attachment_url}
            target="_blank"
            rel="noopener noreferrer"
            className="underline underline-offset-2 flex items-center gap-1.5"
          >
            <Paperclip size={13} className="shrink-0" />
            {message.attachment_name ?? "Attachment"}
          </a>
        ) : (
          <p className="whitespace-pre-wrap">{message.body}</p>
        )}
      </div>
      <span className="text-[10px] text-muted-foreground mt-1 px-1">
        {fromStaff ? message.sender_name ?? "You" : message.sender_name ?? "Visitor"} ·{" "}
        {formatTime(message.created_at)}
      </span>
    </div>
  );
}

function shortPath(url: string): string {
  try {
    return new URL(url).pathname || "/";
  } catch {
    return url;
  }
}

function ComposeEmailModal({ onClose }: { onClose: () => void }) {
  const [toEmail, setToEmail] = useState("");
  const [clientName, setClientName] = useState("");
  const [subject, setSubject] = useState("");
  const [messageBody, setMessageBody] = useState("");
  const [sending, setSending] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSend = async () => {
    if (!toEmail.trim() || !messageBody.trim()) {
      setError("Recipient email and message body are required.");
      return;
    }

    setSending(true);
    setError(null);

    try {
      const res = await fetch("/api/send-email", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: "direct_email",
          payload: {
            toEmail: toEmail.trim(),
            clientName: clientName.trim(),
            subject: subject.trim() || "Update from Yorkshire Adoption Home",
            messageBody: messageBody.trim(),
          },
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to send email.");

      setSuccess(true);
      setTimeout(() => {
        onClose();
      }, 1800);
    } catch (err: any) {
      setError(err.message || "Failed to send email.");
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
      <div className="bg-background border border-border rounded-xl shadow-2xl max-w-lg w-full p-6 space-y-4">
        <div className="flex items-center justify-between border-b border-border pb-3">
          <div>
            <h3 className="text-base font-semibold text-foreground">Compose Email to Client</h3>
            <p className="text-xs text-muted-foreground">
              Sends directly from <strong className="text-foreground font-mono">support@yorkieadoptionhome.com</strong>
            </p>
          </div>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground">
            ✕
          </button>
        </div>

        {error && (
          <div className="bg-destructive/10 border border-destructive/30 text-destructive text-xs p-3 rounded-md">
            {error}
          </div>
        )}

        {success ? (
          <div className="bg-accent/10 border border-accent/30 text-accent text-sm p-4 rounded-md text-center">
            Sent to {toEmail}.
          </div>
        ) : (
          <div className="space-y-3">
            <Field label="Recipient Email" required hint="Client's email address">
              <TextInput
                type="email"
                placeholder="client@example.com"
                value={toEmail}
                onChange={(e) => setToEmail(e.target.value)}
              />
            </Field>

            <Field label="Client Name" hint="Optional">
              <TextInput
                placeholder="Jane Doe"
                value={clientName}
                onChange={(e) => setClientName(e.target.value)}
              />
            </Field>

            <Field label="Subject" hint="Defaults to 'Update from Yorkshire Adoption Home'">
              <TextInput
                placeholder="e.g. Regarding your adoption inquiry"
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
              />
            </Field>

            <Field label="Message Body" required>
              <TextArea
                rows={5}
                placeholder="Write your email text here…"
                value={messageBody}
                onChange={(e) => setMessageBody(e.target.value)}
              />
            </Field>

            <div className="flex justify-end gap-2 pt-3 border-t border-border">
              <Button variant="ghost" onClick={onClose} disabled={sending}>
                Cancel
              </Button>
              <Button variant="primary" onClick={handleSend} disabled={sending}>
                {sending ? <Loader2 size={13} className="animate-spin" /> : <Send size={13} />}
                Send Email
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
