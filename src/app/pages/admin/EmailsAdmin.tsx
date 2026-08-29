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
            <Button size="sm" variant="ghost" onClick={() => setWebhookHelpOpen(true)} title="Inbound Setup Guide">
              <HelpCircle size={13} /> Receiving Guide
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
                          className={`inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 rounded-full ${
                            isIncoming
                              ? "bg-emerald-100 text-emerald-800"
                              : "bg-blue-100 text-blue-800"
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
                          className={`text-xs font-bold px-2.5 py-0.5 rounded-full ${
                            selected.direction === "incoming"
                              ? "bg-emerald-100 text-emerald-800"
                              : "bg-blue-100 text-blue-800"
                          }`}
                        >
                          {selected.direction === "incoming" ? "INCOMING MESSAGE" : "SENT FROM SITE"}
                        </span>
                        <span className="text-xs text-muted-foreground">
                          {formatDateTime(selected.created_at)}
                        </span>
                      </div>
                      <h2 className="text-xl font-bold text-foreground">{selected.subject}</h2>
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
                  {selected.body_html ? (
                    <div
                      className="prose prose-sm max-w-none text-foreground border border-border rounded-lg p-6 bg-white"
                      dangerouslySetInnerHTML={{ __html: selected.body_html }}
                    />
                  ) : (
                    <div className="bg-sidebar/30 border border-border rounded-lg p-6 text-sm text-foreground whitespace-pre-wrap leading-relaxed font-sans">
                      {selected.body_text || "(No message body content)"}
                    </div>
                  )}
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
      {webhookHelpOpen && <WebhookHelpModal onClose={() => setWebhookHelpOpen(false)} onRefresh={() => emails.reload()} />}
    </>
  );
}

function WebhookHelpModal({ onClose, onRefresh }: { onClose: () => void; onRefresh: () => void }) {
  const [copied, setCopied] = useState(false);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<string | null>(null);
  const webhookUrl = "https://www.yorkieadoptionhome.com/api/inbound-email";

  const handleCopy = () => {
    navigator.clipboard.writeText(webhookUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleTestWebhook = async () => {
    setTesting(true);
    setTestResult(null);
    try {
      const res = await fetch("/api/inbound-email", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          from: "test-client@example.com",
          to: "support@yorkieadoptionhome.com",
          subject: "Test Inbound Email — " + new Date().toLocaleTimeString(),
          text: "This is a test email to verify the inbound email pipeline is working correctly.",
          html: "<p>This is a <strong>test email</strong> to verify the inbound email pipeline is working correctly.</p>",
        }),
      });
      const data = await res.json();
      if (res.ok) {
        setTestResult("✓ Test email successfully saved! Click Refresh to see it in your Inbox.");
        onRefresh();
      } else {
        setTestResult("✗ Test failed: " + (data.error || "Unknown error"));
      }
    } catch (err: any) {
      setTestResult("✗ Error: " + err.message);
    } finally {
      setTesting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-background border border-border rounded-xl shadow-2xl max-w-lg w-full p-6 space-y-4 my-auto">
        <div className="flex items-center justify-between border-b border-border pb-3">
          <h3 className="text-base font-semibold text-foreground">How to Receive Inbound Emails</h3>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground">✕</button>
        </div>

        <div className="space-y-4 text-sm text-foreground leading-relaxed">

          {/* Test section */}
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 space-y-2">
            <p className="text-xs font-semibold text-blue-800">🧪 Test Your Inbox Right Now</p>
            <p className="text-xs text-blue-700">
              Click below to simulate an inbound email — this will instantly add a test email to your Inbox so you can verify the inbox tab is working:
            </p>
            <Button size="sm" variant="primary" onClick={handleTestWebhook} disabled={testing}>
              {testing ? <Loader2 size={13} className="animate-spin" /> : <Mail size={13} />}
              Send Test Email to Inbox
            </Button>
            {testResult && (
              <p className={`text-xs font-medium mt-1 ${testResult.startsWith("✓") ? "text-emerald-700" : "text-red-600"}`}>
                {testResult}
              </p>
            )}
          </div>

          {/* DNS Setup */}
          <div>
            <p className="font-semibold text-foreground mb-2">For Real Inbound Emails from Clients:</p>
            <p className="text-xs text-muted-foreground mb-3">
              To receive emails sent to <strong className="text-primary font-mono">support@yorkieadoptionhome.com</strong> in this inbox, you need to complete two steps:
            </p>

            <div className="space-y-3">
              <div className="bg-amber-50 border border-amber-200 rounded-lg p-3">
                <p className="text-xs font-bold text-amber-800 mb-1">Step 1 — Add MX Record in Cloudflare/DNS</p>
                <p className="text-xs text-amber-700 mb-2">Log into your domain registrar (where you manage DNS for yorkieadoptionhome.com) and add this MX record:</p>
                <div className="font-mono text-xs bg-white border border-amber-200 rounded p-2 space-y-1">
                  <div><span className="text-muted-foreground">Type:</span> <strong>MX</strong></div>
                  <div><span className="text-muted-foreground">Name:</span> <strong>support</strong> (or <strong>@</strong> for all)</div>
                  <div><span className="text-muted-foreground">Value:</span> <strong>inbound.resend.com</strong></div>
                  <div><span className="text-muted-foreground">Priority:</span> <strong>10</strong></div>
                </div>
              </div>

              <div className="bg-sidebar p-3 rounded-lg border border-border space-y-2">
                <p className="text-xs font-bold text-foreground">Step 2 — Add Webhook in Resend Dashboard</p>
                <p className="text-xs text-muted-foreground">Your live webhook URL:</p>
                <div className="flex items-center gap-2">
                  <input
                    readOnly
                    value={webhookUrl}
                    className="flex-1 bg-background border border-border rounded px-2.5 py-1.5 text-xs font-mono select-all text-foreground"
                  />
                  <Button size="sm" variant="secondary" onClick={handleCopy}>
                    {copied ? <Check size={13} className="text-emerald-600" /> : <Copy size={13} />}
                    {copied ? "Copied" : "Copy"}
                  </Button>
                </div>
                <ol className="list-decimal list-inside space-y-1 text-xs text-muted-foreground">
                  <li>Open your <a href="https://resend.com/webhooks" target="_blank" rel="noreferrer" className="text-primary underline">Resend Webhooks Dashboard</a>.</li>
                  <li>Click <strong>+ Add Webhook</strong>.</li>
                  <li>Paste the URL above and select event: <strong>email.received</strong>.</li>
                  <li>Click <strong>Add Webhook</strong>.</li>
                </ol>
              </div>
            </div>
          </div>

          <p className="text-xs text-emerald-700 bg-emerald-50 p-2 rounded border border-emerald-200">
            ✓ Once both steps are done, every incoming email to support@yorkieadoptionhome.com will immediately appear in your Inbox and alert both admin Gmail accounts.
          </p>
        </div>

        <div className="flex justify-end pt-3 border-t border-border">
          <Button variant="primary" size="sm" onClick={onClose}>Got it</Button>
        </div>
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
          <div className="bg-red-500/10 border border-red-500/30 text-red-600 text-xs p-3 rounded-md">
            {error}
          </div>
        )}

        {success ? (
          <div className="bg-emerald-500/10 border border-emerald-500/30 text-emerald-600 text-sm p-4 rounded-md text-center font-medium">
            ✓ Email successfully sent to {toEmail}!
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
