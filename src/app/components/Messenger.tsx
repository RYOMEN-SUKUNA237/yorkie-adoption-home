import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { MessageCircle, X, Send, Paperclip, Loader2, CheckCheck } from "lucide-react";
import { isSupabaseConfigured } from "../../lib/supabase";
import type { ConversationRow, MessageRow } from "../../lib/database.types";
import { dayLabel, formatTime } from "../../lib/format";
import {
  createConversation,
  ensureVisitorSession,
  getMyConversation,
  listMessages,
  markRead,
  sendMessage,
  subscribeToMessages,
  updateVisitorDetails,
} from "../../services/messages";
import { uploadAttachment, type SettingsMap, settingBool, settingString } from "../../services/misc";

type Phase = "loading" | "intro" | "chat" | "unavailable";

interface MessengerProps {
  settings: SettingsMap;
}

/**
 * Floating in-app messenger.
 *
 * The visitor never signs up: `ensureVisitorSession()` creates an anonymous
 * Supabase session, which gives RLS a subject to scope the thread to and
 * lets the same browser return to the same conversation later.
 */
export default function Messenger({ settings }: MessengerProps) {
  const enabled = settingBool(settings, "messenger_enabled", true);

  const [open, setOpen] = useState(false);
  const [phase, setPhase] = useState<Phase>("loading");
  const [conversation, setConversation] = useState<ConversationRow | null>(null);
  const [messages, setMessages] = useState<MessageRow[]>([]);
  const [draft, setDraft] = useState("");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [sending, setSending] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [unread, setUnread] = useState(0);
  // Bumped by the offline notice to re-run the bootstrap effect. A visitor
  // whose first load raced a dropped connection would otherwise sit on the
  // fallback for the rest of the session with no way back to live chat.
  const [retry, setRetry] = useState(0);
  const [retrying, setRetrying] = useState(false);

  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const greeting = settingString(
    settings,
    "messenger_greeting",
    "Hello. Ask us anything about our puppies or the adoption process."
  );
  const officeHours = settingString(settings, "office_hours", "");

  // -------------------------------------------------------------------
  // Bootstrap: resume an existing thread if this browser already has one
  // -------------------------------------------------------------------
  useEffect(() => {
    if (!enabled) return;

    if (!isSupabaseConfigured) {
      setPhase("unavailable");
      return;
    }

    let cancelled = false;
    if (retry > 0) setPhase("loading");

    (async () => {
      try {
        const uid = await ensureVisitorSession();
        if (cancelled) return;
        if (!uid) {
          setPhase("unavailable");
          return;
        }

        const existing = await getMyConversation();
        if (cancelled) return;

        if (existing) {
          setConversation(existing);
          setName(existing.visitor_name ?? "");
          setEmail(existing.visitor_email ?? "");
          setUnread(existing.unread_for_visitor);
          const history = await listMessages(existing.id);
          if (cancelled) return;
          setMessages(history);
          setPhase("chat");
        } else {
          setPhase("intro");
        }
      } catch (err) {
        if (!cancelled) {
          console.warn("[messenger]", err);
          setPhase("unavailable");
        }
      } finally {
        if (!cancelled) setRetrying(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [enabled, retry]);

  // -------------------------------------------------------------------
  // External trigger: listen for 'open-chat' events or ?chat=open in URL
  // -------------------------------------------------------------------
  useEffect(() => {
    const handleOpenChat = (e: Event) => {
      setOpen(true);
      const custom = e as CustomEvent<{ message?: string; name?: string; email?: string }>;
      if (custom.detail?.message) setDraft(custom.detail.message);
      if (custom.detail?.name) setName(custom.detail.name);
      if (custom.detail?.email) setEmail(custom.detail.email);
    };
    window.addEventListener("open-chat", handleOpenChat);

    if (typeof window !== "undefined") {
      const params = new URLSearchParams(window.location.search);
      if (params.get("chat") === "open" || params.get("chat") === "1") {
        setOpen(true);
        const refParam = params.get("ref");
        if (refParam) {
          setDraft(
            `Hello! My adoption application (${refParam}) has been approved. I would like to verify and proceed with next steps.`
          );
        }
      }
    }

    return () => window.removeEventListener("open-chat", handleOpenChat);
  }, []);

  // -------------------------------------------------------------------
  // Realtime: new messages arrive whether the panel is open or shut
  // -------------------------------------------------------------------
  useEffect(() => {
    if (!conversation) return;

    return subscribeToMessages(conversation.id, (incoming) => {
      setMessages((current) => {
        // The sender already appended their own message optimistically.
        if (current.some((m) => m.id === incoming.id)) return current;
        return [...current, incoming];
      });

      if (incoming.sender_role !== "visitor") {
        setUnread((n) => (open ? 0 : n + 1));
      }
    });
  }, [conversation, open]);

  // Clear the badge once the visitor is actually looking at the thread.
  useEffect(() => {
    if (!open || !conversation || unread === 0) return;
    setUnread(0);
    void markRead(conversation.id, "visitor").catch(() => {});
  }, [open, conversation, unread]);

  // Keep the newest message in view.
  useEffect(() => {
    const el = scrollRef.current;
    if (el && open) el.scrollTop = el.scrollHeight;
  }, [messages, open, phase]);

  // Escape closes the panel; focus moves to the composer when it opens.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    const timer = setTimeout(() => inputRef.current?.focus(), 120);
    return () => {
      window.removeEventListener("keydown", onKey);
      clearTimeout(timer);
    };
  }, [open, phase]);

  // Lock body scroll behind the mobile full-screen sheet.
  useEffect(() => {
    if (!open) return;
    const isMobile = window.matchMedia("(max-width: 639px)").matches;
    if (!isMobile) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previous;
    };
  }, [open]);

  // -------------------------------------------------------------------
  // Actions
  // -------------------------------------------------------------------
  const startConversation = useCallback(
    async (firstMessage: string) => {
      setSending(true);
      setError(null);
      try {
        const created = await createConversation({
          name,
          email,
          subject: firstMessage.slice(0, 80),
        });
        setConversation(created);
        setPhase("chat");

        const sent = await sendMessage({
          conversationId: created.id,
          body: firstMessage,
          as: "visitor",
          senderName: name || "Visitor",
        });
        setMessages([sent]);
        setDraft("");
      } catch (err) {
        setError(err instanceof Error ? err.message : "Could not start the conversation.");
      } finally {
        setSending(false);
      }
    },
    [name, email]
  );

  const handleSend = useCallback(async () => {
    const body = draft.trim();
    if (!body || sending) return;

    if (!conversation) {
      await startConversation(body);
      return;
    }

    setSending(true);
    setError(null);
    setDraft("");

    try {
      const sent = await sendMessage({
        conversationId: conversation.id,
        body,
        as: "visitor",
        senderName: name || "Visitor",
      });
      setMessages((current) =>
        current.some((m) => m.id === sent.id) ? current : [...current, sent]
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "Message not sent.");
      setDraft(body); // give the text back rather than losing it
    } finally {
      setSending(false);
    }
  }, [draft, sending, conversation, name, startConversation]);

  const handleAttach = useCallback(
    async (file: File) => {
      if (!conversation) {
        setError("Send a message first, then you can attach a file.");
        return;
      }
      if (file.size > 10 * 1024 * 1024) {
        setError("Files must be 10 MB or smaller.");
        return;
      }

      setUploading(true);
      setError(null);
      try {
        const { url, name: filename } = await uploadAttachment(file);
        const sent = await sendMessage({
          conversationId: conversation.id,
          body: `Sent a file: ${filename}`,
          as: "visitor",
          senderName: name || "Visitor",
          attachmentUrl: url,
          attachmentName: filename,
        });
        setMessages((current) =>
          current.some((m) => m.id === sent.id) ? current : [...current, sent]
        );
      } catch (err) {
        setError(err instanceof Error ? err.message : "Upload failed.");
      } finally {
        setUploading(false);
        if (fileRef.current) fileRef.current.value = "";
      }
    },
    [conversation, name]
  );

  const saveDetails = useCallback(async () => {
    if (!conversation) return;
    try {
      await updateVisitorDetails(conversation.id, { name, email });
    } catch {
      /* non-critical */
    }
  }, [conversation, name, email]);

  // Group messages under Today / Yesterday / date separators.
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

  if (!enabled) return null;

  return (
    <>
      {/* ---------------------------------------------------------------
          Launcher
      --------------------------------------------------------------- */}
      <button
        onClick={() => setOpen((o) => !o)}
        aria-label={open ? "Close messages" : "Open messages"}
        aria-expanded={open}
        className={`fixed bottom-5 right-5 z-[60] flex items-center justify-center rounded-full shadow-lg transition-all duration-300 focus:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2
          h-14 w-14 sm:h-14 sm:w-14
          ${open
            ? "bg-foreground text-background rotate-90 scale-95"
            : "bg-primary text-primary-foreground hover:bg-[#A0752F] hover:scale-105"}`}
        style={{ marginBottom: "env(safe-area-inset-bottom)" }}
      >
        {open ? <X size={22} /> : <MessageCircle size={22} />}
        {!open && unread > 0 && (
          <span className="absolute -top-1 -right-1 min-w-[22px] h-[22px] px-1 rounded-full bg-[#23282F] text-[#F7F5F2] text-[11px] font-semibold flex items-center justify-center border-2 border-background">
            {unread > 9 ? "9+" : unread}
          </span>
        )}
      </button>

      {/* ---------------------------------------------------------------
          Panel — full-screen sheet on phones, docked card from `sm` up
      --------------------------------------------------------------- */}
      {open && (
        <div
          role="dialog"
          aria-modal="false"
          aria-label="Message the breeder"
          className="fixed z-[59] flex flex-col bg-background shadow-2xl
                     inset-0 sm:inset-auto
                     sm:bottom-24 sm:right-5 sm:w-[380px] sm:h-[min(600px,calc(100vh-8rem))]
                     sm:rounded-lg sm:border sm:border-border
                     overflow-hidden messenger-panel-in"
        >
          <MessengerHeader
            settings={settings}
            officeHours={officeHours}
            onClose={() => setOpen(false)}
          />

          {phase === "loading" && (
            <div className="flex-1 flex items-center justify-center">
              <Loader2 className="animate-spin text-muted-foreground" size={22} />
            </div>
          )}

          {phase === "unavailable" && (
            <UnavailableNotice
              settings={settings}
              retrying={retrying}
              onRetry={() => {
                setRetrying(true);
                setRetry((n) => n + 1);
              }}
            />
          )}

          {(phase === "intro" || phase === "chat") && (
            <>
              <div
                ref={scrollRef}
                className="flex-1 overflow-y-auto px-4 py-4 flex flex-col gap-1 overscroll-contain"
              >
                {/* Greeting always leads the thread */}
                <div className="flex flex-col gap-2 mb-4">
                  <div className="max-w-[85%] bg-secondary text-secondary-foreground rounded-lg rounded-tl-sm px-3.5 py-2.5">
                    <p className="text-sm leading-relaxed">{greeting}</p>
                  </div>
                </div>

                {phase === "intro" && (
                  <IntroFields
                    name={name}
                    email={email}
                    onName={setName}
                    onEmail={setEmail}
                  />
                )}

                {grouped.map((group) => (
                  <div key={group.label} className="flex flex-col gap-1">
                    <div className="flex items-center gap-3 my-3">
                      <div className="h-px flex-1 bg-border" />
                      <span className="text-[10px] uppercase tracking-[0.15em] text-muted-foreground">
                        {group.label}
                      </span>
                      <div className="h-px flex-1 bg-border" />
                    </div>
                    {group.items.map((message) => (
                      <MessageBubble key={message.id} message={message} />
                    ))}
                  </div>
                ))}
              </div>

              {error && (
                <p className="px-4 pb-2 text-xs text-primary" role="alert">
                  {error}
                </p>
              )}

              <Composer
                draft={draft}
                onDraft={setDraft}
                onSend={handleSend}
                onBlurDetails={saveDetails}
                sending={sending}
                uploading={uploading}
                inputRef={inputRef}
                fileRef={fileRef}
                onAttach={handleAttach}
                canAttach={Boolean(conversation)}
              />
            </>
          )}
        </div>
      )}
    </>
  );
}

// ---------------------------------------------------------------------
// Pieces
// ---------------------------------------------------------------------

function MessengerHeader({
  settings,
  officeHours,
  onClose,
}: {
  settings: SettingsMap;
  officeHours: string;
  onClose: () => void;
}) {
  return (
    <header className="shrink-0 bg-[#23282F] text-[#F7F5F2] px-4 py-3.5 flex items-start justify-between gap-3">
      <div className="min-w-0">
        <p
          className="text-sm font-medium truncate"
          style={{ fontFamily: "'Newsreader', Georgia, serif" }}
        >
          {settingString(settings, "site_name", "Yorkshire Adoption Home")}
        </p>
        <p className="text-[11px] text-[#9AA5B2] mt-0.5 flex items-center gap-1.5">
          <span className="w-1.5 h-1.5 rounded-full bg-[#5FA86B] shrink-0" />
          <span className="truncate">
            {officeHours ? `Usually replies within a day · ${officeHours}` : "Usually replies within a day"}
          </span>
        </p>
      </div>
      <button
        onClick={onClose}
        aria-label="Close messages"
        className="shrink-0 p-1.5 -mr-1.5 text-[#9AA5B2] hover:text-[#F7F5F2] transition-colors rounded-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-[#5C7A99]"
      >
        <X size={18} />
      </button>
    </header>
  );
}

function IntroFields({
  name,
  email,
  onName,
  onEmail,
}: {
  name: string;
  email: string;
  onName: (v: string) => void;
  onEmail: (v: string) => void;
}) {
  return (
    <div className="border border-border rounded-md p-3.5 mb-3 bg-card">
      <p className="text-xs text-muted-foreground mb-3 leading-relaxed">
        So we know who we are speaking to — both optional.
      </p>
      <div className="flex flex-col gap-2">
        <input
          value={name}
          onChange={(e) => onName(e.target.value)}
          placeholder="Your name"
          autoComplete="name"
          className="w-full px-3 py-2 bg-input-background border border-border rounded-sm text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
        />
        <input
          value={email}
          onChange={(e) => onEmail(e.target.value)}
          placeholder="Email (so we can reply if you leave)"
          type="email"
          autoComplete="email"
          className="w-full px-3 py-2 bg-input-background border border-border rounded-sm text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
        />
      </div>
    </div>
  );
}

function MessageBubble({ message }: { message: MessageRow }) {
  const fromVisitor = message.sender_role === "visitor";

  if (message.sender_role === "system") {
    return (
      <p className="text-center text-[11px] text-muted-foreground py-2">{message.body}</p>
    );
  }

  return (
    <div className={`flex flex-col ${fromVisitor ? "items-end" : "items-start"} mb-1.5`}>
      <div
        className={`max-w-[85%] px-3.5 py-2.5 rounded-lg text-sm leading-relaxed break-words ${
          fromVisitor
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
      <span className="text-[10px] text-muted-foreground mt-1 px-1 flex items-center gap-1">
        {!fromVisitor && message.sender_name ? `${message.sender_name} · ` : ""}
        {formatTime(message.created_at)}
        {fromVisitor && message.read_at && <CheckCheck size={11} className="text-accent" />}
      </span>
    </div>
  );
}

function Composer({
  draft,
  onDraft,
  onSend,
  onBlurDetails,
  sending,
  uploading,
  inputRef,
  fileRef,
  onAttach,
  canAttach,
}: {
  draft: string;
  onDraft: (v: string) => void;
  onSend: () => void;
  onBlurDetails: () => void;
  sending: boolean;
  uploading: boolean;
  inputRef: React.RefObject<HTMLTextAreaElement>;
  fileRef: React.RefObject<HTMLInputElement>;
  onAttach: (file: File) => void;
  canAttach: boolean;
}) {
  // Grow the textarea with its content, up to a ceiling.
  const resize = (el: HTMLTextAreaElement) => {
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, 120)}px`;
  };

  return (
    <div
      className="shrink-0 border-t border-border bg-background px-3 py-3"
      style={{ paddingBottom: "max(0.75rem, env(safe-area-inset-bottom))" }}
    >
      <div className="flex items-end gap-2">
        {canAttach && (
          <>
            <input
              ref={fileRef}
              type="file"
              className="sr-only"
              accept="image/*,application/pdf"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) onAttach(file);
              }}
            />
            <button
              type="button"
              onClick={() => fileRef.current?.click()}
              disabled={uploading}
              aria-label="Attach a file"
              className="shrink-0 p-2.5 text-muted-foreground hover:text-foreground transition-colors rounded-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50"
            >
              {uploading ? <Loader2 size={17} className="animate-spin" /> : <Paperclip size={17} />}
            </button>
          </>
        )}

        <textarea
          ref={inputRef}
          value={draft}
          rows={1}
          onChange={(e) => {
            onDraft(e.target.value);
            resize(e.target);
          }}
          onBlur={onBlurDetails}
          onKeyDown={(e) => {
            // Enter sends; Shift+Enter breaks the line.
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              onSend();
            }
          }}
          placeholder="Write a message…"
          aria-label="Message"
          className="flex-1 resize-none px-3.5 py-2.5 bg-input-background border border-border rounded-md text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring leading-relaxed max-h-[120px]"
        />

        <button
          type="button"
          onClick={onSend}
          disabled={!draft.trim() || sending}
          aria-label="Send message"
          className="shrink-0 h-10 w-10 flex items-center justify-center bg-primary text-primary-foreground rounded-md hover:bg-[#A0752F] transition-colors disabled:opacity-40 disabled:cursor-not-allowed focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          {sending ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />}
        </button>
      </div>
    </div>
  );
}

function UnavailableNotice({
  settings,
  retrying,
  onRetry,
}: {
  settings: SettingsMap;
  retrying: boolean;
  onRetry: () => void;
}) {
  const emailAddress = settingString(settings, "contact_email", "");
  const phone = settingString(settings, "contact_phone", "");
  const whatsapp = settingString(settings, "whatsapp_number", "");

  return (
    <div className="flex-1 flex flex-col items-center justify-center px-6 text-center gap-3">
      <p className="text-sm font-medium text-foreground">Live chat is offline</p>
      <p className="text-sm text-muted-foreground leading-relaxed">
        We cannot reach the message service right now. Please use one of these instead — we read
        both.
      </p>
      <div className="flex flex-col gap-2 mt-2 w-full">
        <button
          type="button"
          onClick={onRetry}
          disabled={retrying}
          className="w-full min-h-10 py-2.5 text-sm font-medium border border-border rounded-sm hover:border-foreground/40 transition-colors disabled:opacity-60 inline-flex items-center justify-center gap-2"
        >
          {retrying && <Loader2 className="w-3.5 h-3.5 animate-spin" aria-hidden="true" />}
          {retrying ? "Reconnecting…" : "Try again"}
        </button>
        {phone && (
          <a
            href={`tel:${phone.replace(/[^\d+]/g, "")}`}
            className="w-full py-2.5 text-sm font-medium border border-border rounded-sm hover:border-foreground/40 transition-colors"
          >
            {phone}
          </a>
        )}
        {emailAddress && (
          <a
            href={`mailto:${emailAddress}`}
            className="w-full py-2.5 text-sm font-medium border border-border rounded-sm hover:border-foreground/40 transition-colors"
          >
            {emailAddress}
          </a>
        )}
        {whatsapp && (
          <a
            href={`https://wa.me/${whatsapp.replace(/\D/g, "")}`}
            target="_blank"
            rel="noopener noreferrer"
            className="w-full py-2.5 text-sm font-medium bg-primary text-primary-foreground rounded-sm hover:bg-[#A0752F] transition-colors"
          >
            Message on WhatsApp
          </a>
        )}
      </div>
    </div>
  );
}
