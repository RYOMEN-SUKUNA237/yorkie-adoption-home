import { useEffect, useMemo, useState } from "react";
import {
  Search, Mail, Send, Inbox, ArrowUpRight, ArrowDownLeft, RefreshCw, Trash2,
  Reply, Loader2, CheckCircle2, Clock, Eye, AlertCircle, HelpCircle, Copy, Check
} from "lucide-react";
import { useAsync, useDebounced, useMediaQuery } from "../../../hooks/useAsync";
import { listEmails, deleteEmail, markEmailRead } from "../../../services/emails";
import type { EmailRow } from "../../../lib/database.types";
import { formatDate, formatDateTime, timeAgo } from "../../../lib/format";
import {
  Button, EmptyState, ErrorState, FilterChips, LoadingState, PageHeader,
  TextInput, TextArea, Field
} from "../../components/admin/ui";

type DirectionFilter = "all" | "incoming" | "outgoing";

export default function EmailsAdmin() {
  const isDesktop = useMediaQuery("(min-width: 1024px)");
  const [filter, setFilter] = useState<DirectionFilter>("all");
  const [search, setSearch] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [composeOpen, setComposeOpen] = useState(false);
  const [webhookHelpOpen, setWebhookHelpOpen] = useState(false);
  const [replyToEmail, setReplyToEmail] = useState<{ email: string; subject: string; name?: string } | null>(null);

  const debouncedSearch = useDebounced(search, 300);

  const emails = useAsync(
    () => listEmails({ direction: filter, search: debouncedSearch }),
    [filter, debouncedSearch]
  );

  const selected = useMemo(
    () => emails.data?.find((e) => e.id === selectedId) ?? null,
    [emails.data, selectedId]
  );

  // Auto select first email on desktop
  useEffect(() => {
    if (isDesktop && emails.data?.length && !selectedId) {
      setSelectedId(emails.data[0].id);
    }
  }, [isDesktop, emails.data, selectedId]);

  const handleOpenReply = (email: EmailRow) => {
    const targetEmail = email.direction === "incoming" ? email.from_email : email.to_email;
    const sub = email.subject.startsWith("Re:") ? email.subject : `Re: ${email.subject}`;
    setReplyToEmail({ email: targetEmail, subject: sub, name: email.from_name || undefined });
    setComposeOpen(true);
  };

  const showList = isDesktop || !selectedId;
  const showReader = isDesktop || Boolean(selectedId);

  return (
    <>
      <PageHeader
        title="Email Center"
        subtitle="Manage incoming replies and outgoing emails sent from support@yorkieadoptionhome.com"
        actions={
          <div className="flex items-center gap-2">
            <Button size="sm" variant="ghost" onClick={() => setWebhookHelpOpen(true)} title="How receiving is wired up">
              <HelpCircle size={13} /> Receiving
            </Button>
            <Button size="sm" variant="ghost" onClick={() => emails.reload()} title="Refresh mailbox">
              <RefreshCw size={13} className={emails.loading ? "animate-spin" : ""} /> Refresh
            </Button>
            <Button size="sm" variant="primary" onClick={() => { setReplyToEmail(null); setComposeOpen(true); }}>
              <Mail size={13} /> Compose Email
            </Button>
          </div>
        }
      />

      <div className="flex-1 flex min-h-0 bg-background">
        {/* Email List Column */}
        {showList && (
          <div className="w-full lg:w-96 shrink-0 border-r border-border flex flex-col min-h-0">
            <div className="px-4 py-3 border-b border-border flex flex-col gap-3">
              <div className="relative">
                <Search
                  size={14}
                  className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none"
                />
                <TextInput
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search emails, subject, recipient…"
                  className="pl-9"
                  aria-label="Search emails"
                />
              </div>
              <FilterChips<DirectionFilter>
                value={filter}
                onChange={setFilter}
                options={[
                  { value: "all", label: "All Mails" },
                  { value: "incoming", label: "Inbox (Received)" },
                  { value: "outgoing", label: "Sent" },
                ]}
              />
            </div>

            <div className="flex-1 overflow-y-auto divide-y divide-border">
              {emails.loading && <LoadingState />}
              {emails.error && <ErrorState error={emails.error} onRetry={emails.reload} />}
              {emails.data?.length === 0 && (
                <EmptyState
                  title="No emails found"
                  description={
                    filter === "incoming"
                      ? "Received client replies to support@yorkieadoptionhome.com will appear here."
                      : "Emails sent to clients and incoming replies will appear here."
                  }
                />
              )}

              {emails.data?.map((email) => {
                const isSelected = email.id === selectedId;
                const isIncoming = email.direction === "incoming";
                return (
                  <button
                    key={email.id}
                    onClick={() => {
                      setSelectedId(email.id);
                      if (isIncoming && !email.read_at) {
                        void markEmailRead(email.id);
                      }
                    }}
                    className={`w-full text-left p-4 transition-colors flex flex-col gap-1.5 focus:outline-none ${
                      isSelected
                        ? "bg-sidebar-accent border-l-4 border-primary"
                        : "hover:bg-sidebar-accent/50"
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-1.5 min-w-0">
                        <span
                          className={`inline-flex items-center gap-1 text-[11px] px-2 py-0.5 rounded-full border ${
                            isIncoming
                              ? "border-accent/40 bg-accent/10 text-accent"
                              : "border-border bg-sidebar-accent text-muted-foreground"
                          }`}
                        >
                          {isIncoming ? <ArrowDownLeft size={11} /> : <ArrowUpRight size={11} />}
                          {isIncoming ? "Inbox" : "Sent"}
                        </span>
                        <p className="text-xs font-semibold text-foreground truncate">
                          {isIncoming ? email.from_email : email.to_email}
                        </p>
                      </div>
                      <span className="text-[11px] text-muted-foreground shrink-0">
                        {timeAgo(email.created_at)}
                      </span>
                    </div>

                    <p className="text-sm font-medium text-foreground truncate">
                      {email.subject || "(No Subject)"}
                    </p>

                    <p className="text-xs text-muted-foreground line-clamp-2">
                      {email.body_text || "No preview text available."}
                    </p>
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* Email Reading / Details Pane */}
        {showReader && (
          <div className="flex-1 flex flex-col min-h-0 bg-background">
            {selected ? (
              <div className="flex-1 flex flex-col min-h-0 overflow-y-auto">
                {/* Mobile Back Button */}
                {!isDesktop && (
                  <div className="p-3 border-b border-border">
                    <Button size="sm" variant="ghost" onClick={() => setSelectedId(null)}>
                      ← Back to emails
                    </Button>
                  </div>
                )}

                {/* Email Header */}
                <div className="p-6 border-b border-border bg-sidebar/40 space-y-4">
                  <div className="flex flex-wrap items-start justify-between gap-4">
                    <div>
                      <div className="flex items-center gap-2 mb-1.5">
                        <span
                          className={`text-[10px] tracking-[0.14em] uppercase px-2.5 py-0.5 rounded-full border ${
                            selected.direction === "incoming"
                              ? "border-accent/40 bg-accent/10 text-accent"
                              : "border-border bg-sidebar-accent text-muted-foreground"
                          }`}
                        >
                          {selected.direction === "incoming" ? "Received" : "Sent"}
                        </span>
                        <DeliveryState email={selected} />
                        <span className="text-xs text-muted-foreground">
                          {formatDateTime(selected.created_at)}
                        </span>
                      </div>
                      <h2 className="text-xl text-foreground" style={{ fontFamily: "'Newsreader', Georgia, serif" }}>{selected.subject}</h2>
                    </div>

                    <div className="flex items-center gap-2">
                      <Button size="sm" variant="primary" onClick={() => handleOpenReply(selected)}>
                        <Reply size={13} /> Reply
                      </Button>
                      <Button
                        size="sm"
                        variant="danger"
                        onClick={async () => {
                          await deleteEmail(selected.id);
                          setSelectedId(null);
                          emails.reload();
                        }}
                      >
                        <Trash2 size={13} /> Delete
                      </Button>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs bg-background p-3 rounded-lg border border-border">
                    <div>
                      <span className="text-muted-foreground">From: </span>
                      <strong className="text-foreground">{selected.from_name ? `${selected.from_name} <${selected.from_email}>` : selected.from_email}</strong>
                    </div>
                    <div>
                      <span className="text-muted-foreground">To: </span>
                      <strong className="text-foreground">{selected.to_email}</strong>
                    </div>
                  </div>
                </div>

                {/* Email Body Content */}
                <div className="p-6 sm:p-8 flex-1">
                  <EmailBody email={selected} />
                </div>
              </div>
            ) : (
              <div className="flex-1 flex items-center justify-center p-8 text-center text-muted-foreground">
                <div>
                  <Mail size={40} className="mx-auto mb-3 opacity-30" />
                  <p className="text-sm font-medium">Select an email to read details</p>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Compose / Reply Modal */}
      {composeOpen && (
        <ComposeModal
          initial={replyToEmail}
          onClose={() => {
            setComposeOpen(false);
            setReplyToEmail(null);
            emails.reload();
          }}
        />
      )}

      {/* Inbound Webhook Help Guide Modal */}
      {webhookHelpOpen && <ReceivingStatusModal onClose={() => setWebhookHelpOpen(false)} />}
    </>
  );
}

/**
 * The message body.
 *
 * Inbound HTML arrives from whoever emailed us, and it used to be handed to
 * `dangerouslySetInnerHTML` — which runs it inside the authenticated admin
 * session, next to the Supabase token. A crafted `<img onerror>` in a client
 * reply was enough to take the dashboard over.
 *
 * A `sandbox` iframe with no tokens gets no scripts, no same-origin access,
 * no forms and no top-level navigation, so the markup can only draw itself.
 * `srcDoc` keeps it in the document with no network fetch.
 */
function EmailBody({ email }: { email: EmailRow }) {
  if (!email.body_html) {
    return (
      <div className="bg-sidebar/30 border border-border rounded-lg p-6 text-sm text-foreground whitespace-pre-wrap leading-relaxed">
        {email.body_text || "(no message body)"}
      </div>
    );
  }

  return (
    <div className="border border-border rounded-lg overflow-hidden bg-white">
      <iframe
        title={`Message: ${email.subject}`}
        sandbox=""
        referrerPolicy="no-referrer"
        srcDoc={email.body_html}
        className="w-full h-[560px] block border-0"
      />
    </div>
  );
}

const DELIVERY_LABEL: Record<string, string> = {
  sent: "Sent",
  delivered: "Delivered",
  opened: "Opened",
  delayed: "Delayed",
  bounced: "Bounced",
  complained: "Marked as spam",
  failed: "Failed",
};

/**
 * Resend reports what became of each outgoing message through the same
 * webhook that carries inbound mail. Bounces are the ones worth noticing.
 */
function DeliveryState({ email }: { email: EmailRow }) {
  if (email.direction !== "outgoing") return null;

  const label = DELIVERY_LABEL[email.status];
  if (!label) return null;

  const bad = email.status === "bounced" || email.status === "failed" || email.status === "complained";

  return (
    <span
      className={`text-[10px] tracking-[0.14em] uppercase px-2.5 py-0.5 rounded-full border ${
        bad ? "border-destructive/40 bg-destructive/10 text-destructive" : "border-border text-muted-foreground"
      }`}
    >
      {label}
    </span>
  );
}

/**
 * Receiving status.
 *
 * This panel replaced a walkthrough that told you to point an MX record at
 * `inbound.resend.com`. No such host exists — Resend issues a regional
 * inbound address, and the one this domain was given is below. The panel also
 * used to offer a button that injected a fake email straight into the client
 * archive; it now reports what the endpoint says about itself, which is the
 * thing actually worth knowing.
 */
function ReceivingStatusModal({ onClose }: { onClose: () => void }) {
  const [copied, setCopied] = useState<string | null>(null);
  const [probe, setProbe] = useState<{ ok: boolean; verified: boolean; detail?: string } | null>(null);
  const [probing, setProbing] = useState(false);

  const webhookUrl = "https://www.yorkieadoptionhome.com/api/inbound-email";

  const copy = (value: string, key: string) => {
    navigator.clipboard.writeText(value);
    setCopied(key);
    setTimeout(() => setCopied(null), 2000);
  };

  const runProbe = async () => {
    setProbing(true);
    setProbe(null);
    try {
      const res = await fetch("/api/inbound-email", { method: "GET" });
      const data = await res.json();
      setProbe({
        ok: res.ok,
        verified: data.signatureVerification === "enabled",
        detail: res.ok ? undefined : data.error || `Endpoint returned ${res.status}`,
      });
    } catch (err) {
      setProbe({
        ok: false,
        verified: false,
        detail: err instanceof Error ? err.message : "Could not reach the endpoint.",
      });
    } finally {
      setProbing(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-foreground/40 flex items-start sm:items-center justify-center p-4 overflow-y-auto">
      <div className="bg-background border border-border rounded-xl shadow-2xl max-w-xl w-full my-auto">
        <div className="flex items-start justify-between gap-4 px-6 py-4 border-b border-border">
          <div>
            <h3 className="text-base text-foreground">Receiving mail</h3>
            <p className="text-xs text-muted-foreground mt-0.5">
              What has to be true for client replies to reach this inbox
            </p>
          </div>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground shrink-0">
            &#10005;
          </button>
        </div>

        <div className="px-6 py-5 space-y-5">
          <section>
            <Step n={1} title="One MX record, and only one" />
            <p className="text-xs text-muted-foreground leading-relaxed mb-3">
              Mail for the domain has to arrive at Resend. Two MX records at the same priority split
              delivery between them at random, which is why replies were being lost rather than
              merely delayed. Remove every other MX record on the apex.
            </p>
            <RecordTable
              rows={[
                ["Type", "MX"],
                ["Host", "@"],
                ["Value", "inbound-smtp.eu-west-1.amazonaws.com"],
                ["Priority", "10"],
              ]}
              onCopy={() => copy("inbound-smtp.eu-west-1.amazonaws.com", "mx")}
              copied={copied === "mx"}
            />
          </section>

          <section>
            <Step n={2} title="A webhook subscribed to email.received" />
            <p className="text-xs text-muted-foreground leading-relaxed mb-2">
              Resend posts each received message to this endpoint, which files it here and alerts
              the team.
            </p>
            <div className="flex items-center gap-2">
              <input
                readOnly
                value={webhookUrl}
                onFocus={(e) => e.currentTarget.select()}
                className="flex-1 min-w-0 bg-input-background border border-border rounded px-2.5 py-1.5 text-xs font-mono text-foreground"
              />
              <Button size="sm" variant="secondary" onClick={() => copy(webhookUrl, "url")}>
                {copied === "url" ? <Check size={13} /> : <Copy size={13} />}
                {copied === "url" ? "Copied" : "Copy"}
              </Button>
            </div>
          </section>

          <section>
            <Step n={3} title="The signing secret" />
            <p className="text-xs text-muted-foreground leading-relaxed">
              Copy the webhook signing secret from Resend into the deployment as{" "}
              <code className="font-mono text-foreground">RESEND_WEBHOOK_SECRET</code>. Until it is
              set the endpoint accepts unsigned requests, so anyone who knows the address could file
              mail into this inbox and make the site send.
            </p>
          </section>

          <section className="border-t border-border pt-4">
            <div className="flex flex-wrap items-center gap-3">
              <Button size="sm" variant="secondary" onClick={runProbe} disabled={probing}>
                {probing ? <Loader2 size={13} className="animate-spin" /> : <HelpCircle size={13} />}
                Check the endpoint
              </Button>
              {probe && (
                <p className={`text-xs ${probe.ok ? "text-muted-foreground" : "text-destructive"}`}>
                  {probe.ok
                    ? probe.verified
                      ? "Reachable, and signatures are being verified."
                      : "Reachable, but signatures are NOT verified — set RESEND_WEBHOOK_SECRET."
                    : probe.detail}
                </p>
              )}
            </div>
          </section>
        </div>

        <div className="flex justify-end px-6 py-4 border-t border-border">
          <Button variant="primary" size="sm" onClick={onClose}>
            Close
          </Button>
        </div>
      </div>
    </div>
  );
}

function Step({ n, title }: { n: number; title: string }) {
  return (
    <div className="flex items-center gap-2.5 mb-2">
      <span className="w-5 h-5 rounded-full border border-primary/50 text-primary text-[10px] flex items-center justify-center shrink-0">
        {n}
      </span>
      <h4 className="text-sm text-foreground">{title}</h4>
    </div>
  );
}

function RecordTable({
  rows,
  onCopy,
  copied,
}: {
  rows: Array<[string, string]>;
  onCopy: () => void;
  copied: boolean;
}) {
  return (
    <div className="rounded-lg border border-border overflow-hidden">
      <table className="w-full text-xs">
        <tbody className="divide-y divide-border">
          {rows.map(([label, value]) => (
            <tr key={label}>
              <td className="px-3 py-2 text-muted-foreground w-20 align-top">{label}</td>
              <td className="px-3 py-2 font-mono text-foreground break-all">{value}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <div className="border-t border-border px-3 py-2 bg-sidebar/40 flex justify-end">
        <button
          onClick={onCopy}
          className="text-xs text-accent hover:underline inline-flex items-center gap-1.5"
        >
          {copied ? <Check size={12} /> : <Copy size={12} />}
          {copied ? "Copied" : "Copy the value"}
        </button>
      </div>
    </div>
  );
}

function ComposeModal({
  initial,
  onClose,
}: {
  initial: { email: string; subject: string; name?: string } | null;
  onClose: () => void;
}) {
  const [toEmail, setToEmail] = useState(initial?.email || "");
  const [clientName, setClientName] = useState(initial?.name || "");
  const [subject, setSubject] = useState(initial?.subject || "");
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
      }, 1500);
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
            <h3 className="text-base font-semibold text-foreground">
              {initial ? "Reply to Client" : "Compose Professional Email"}
            </h3>
            <p className="text-xs text-muted-foreground">
              Sender: <strong className="text-foreground font-mono">support@yorkieadoptionhome.com</strong>
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
            <Field label="Recipient Email" required>
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

            <Field label="Subject" required>
              <TextInput
                placeholder="e.g. Regarding your puppy inquiry"
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
              />
            </Field>

            <Field label="Message Body" required>
              <TextArea
                rows={6}
                placeholder="Write your email message here…"
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
