import { useState } from "react";
import {
  AlertTriangle, Check, ExternalLink, RefreshCw, Search, Trash2, Zap,
} from "lucide-react";
import { useAsync, useDebounced } from "../../../hooks/useAsync";
import {
  deleteWhatsAppLog, getWhatsAppGatewayStatus, listWhatsAppLogs,
} from "../../../services/whatsapp";
import type { WhatsAppLogRow } from "../../../lib/database.types";
import { formatDateTime, timeAgo } from "../../../lib/format";
import {
  Button, Card, EmptyState, ErrorState, LoadingState, PageHeader, TextInput,
} from "../../components/admin/ui";

/**
 * The WhatsApp dispatch record.
 *
 * Every row used to be badged "Auto Sent" with a green tick whatever its
 * status said — including the rows written as `generated`, which meant a link
 * had been built and nothing had been sent. Status here is now whatever the
 * gateway actually reported, error text included.
 */
export default function WhatsAppLogs() {
  const [search, setSearch] = useState("");
  const [pendingDelete, setPendingDelete] = useState<string | null>(null);
  const debouncedSearch = useDebounced(search, 300);

  const logs = useAsync(() => listWhatsAppLogs({ search: debouncedSearch }), [debouncedSearch]);
  const gateway = useAsync(() => getWhatsAppGatewayStatus(), []);

  const failures = logs.data?.filter((row) => row.status === "failed").length ?? 0;

  return (
    <>
      <PageHeader
        title="WhatsApp"
        subtitle={
          logs.data
            ? `${logs.data.length} dispatched${failures ? ` · ${failures} failed` : ""}`
            : "Automatic client messages"
        }
        actions={
          <Button size="sm" variant="ghost" onClick={() => { logs.reload(); gateway.reload(); }}>
            <RefreshCw size={13} className={logs.loading ? "animate-spin" : ""} /> Refresh
          </Button>
        }
      />

      <div className="flex-1 bg-background flex flex-col min-h-0">
        <div className="px-4 sm:px-6 py-3 border-b border-border bg-sidebar/30">
          <div className="relative max-w-md">
            <Search
              size={14}
              className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none"
            />
            <TextInput
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search number, name, reference, message…"
              className="pl-9"
              aria-label="Search WhatsApp dispatches"
            />
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-4 sm:p-6">
          <div className="max-w-4xl mx-auto flex flex-col gap-4">
            {gateway.data && <GatewayBanner status={gateway.data} />}

            {logs.loading && <LoadingState />}
            {logs.error && <ErrorState error={logs.error} onRetry={logs.reload} />}

            {logs.data && logs.data.length === 0 && (
              <EmptyState
                title={search ? "Nothing matches that search" : "No messages dispatched yet"}
                description={
                  search
                    ? "Try a different number, name or reference."
                    : "Approving an application sends the applicant a WhatsApp message when that is the channel they chose. Each attempt is recorded here."
                }
              />
            )}

            {logs.data?.map((row) => (
              <LogCard
                key={row.id}
                row={row}
                confirming={pendingDelete === row.id}
                onAskDelete={() => setPendingDelete(row.id)}
                onCancelDelete={() => setPendingDelete(null)}
                onConfirmDelete={async () => {
                  await deleteWhatsAppLog(row.id);
                  setPendingDelete(null);
                  logs.reload();
                }}
              />
            ))}
          </div>
        </div>
      </div>
    </>
  );
}

// ---------------------------------------------------------------------

const PROVIDER_LABEL: Record<string, string> = {
  meta: "Meta Cloud API",
  twilio: "Twilio",
  none: "not configured",
};

function GatewayBanner({
  status,
}: {
  status: { provider: string; automatic: boolean; hint?: string };
}) {
  if (status.automatic) {
    return (
      <div className="flex items-start gap-3 rounded-lg border border-border bg-sidebar/40 px-4 py-3">
        <Zap size={14} className="text-primary mt-0.5 shrink-0" />
        <p className="text-xs text-muted-foreground leading-relaxed">
          Sending automatically through{" "}
          <span className="text-foreground font-medium">
            {PROVIDER_LABEL[status.provider] ?? status.provider}
          </span>
          . No manual step is involved.
        </p>
      </div>
    );
  }

  return (
    <div className="flex items-start gap-3 rounded-lg border border-primary/40 bg-primary/5 px-4 py-3">
      <AlertTriangle size={14} className="text-primary mt-0.5 shrink-0" />
      <div className="text-xs leading-relaxed">
        <p className="text-foreground font-medium mb-1">No WhatsApp gateway is configured</p>
        <p className="text-muted-foreground">
          {status.hint ??
            "Messages cannot be delivered until provider credentials are set in the deployment."}
        </p>
      </div>
    </div>
  );
}

function StatusPill({ row }: { row: WhatsAppLogRow }) {
  const failed = row.status === "failed";
  const label =
    { sent: "Sent", delivered: "Delivered", read: "Read", failed: "Failed" }[row.status] ??
    row.status;

  return (
    <span
      className={`text-[11px] px-2 py-0.5 rounded-full flex items-center gap-1 border ${
        failed
          ? "border-primary/40 bg-primary/10 text-primary"
          : "border-border bg-sidebar-accent text-foreground"
      }`}
    >
      {failed ? <AlertTriangle size={10} /> : <Check size={10} />}
      {label}
    </span>
  );
}

function LogCard({
  row,
  confirming,
  onAskDelete,
  onCancelDelete,
  onConfirmDelete,
}: {
  row: WhatsAppLogRow;
  confirming: boolean;
  onAskDelete: () => void;
  onCancelDelete: () => void;
  onConfirmDelete: () => void;
}) {
  const phone = row.recipient_phone.replace(/\D/g, "");

  return (
    <Card className="p-5 flex flex-col gap-3.5">
      <div className="flex flex-wrap items-start justify-between gap-3 border-b border-border/60 pb-3">
        <div>
          <p className="text-sm text-foreground flex flex-wrap items-baseline gap-2">
            <span className="font-mono">+{phone}</span>
            {row.recipient_name && (
              <span className="text-xs text-muted-foreground">{row.recipient_name}</span>
            )}
          </p>
          <p className="text-xs text-muted-foreground mt-1">
            {formatDateTime(row.created_at)} · {timeAgo(row.created_at)}
            {row.provider && row.provider !== "none" && (
              <> · via {PROVIDER_LABEL[row.provider] ?? row.provider}</>
            )}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {row.reference && (
            <span className="text-xs font-mono bg-sidebar-accent border border-border px-2 py-0.5 rounded text-foreground">
              {row.reference}
            </span>
          )}
          <StatusPill row={row} />
        </div>
      </div>

      {row.error && (
        <div className="rounded-md border border-primary/30 bg-primary/5 px-3 py-2">
          <p className="text-[11px] tracking-[0.12em] uppercase text-primary mb-1">
            Gateway response
          </p>
          <p className="text-xs text-foreground leading-relaxed break-words">{row.error}</p>
          {/* The single most common rejection, and it is not a bug in the site. */}
          {row.error.includes("131047") && (
            <p className="text-xs text-muted-foreground leading-relaxed mt-2">
              WhatsApp refuses free-form text more than 24 hours after the client last messaged
              you. Sending outside that window needs an approved template — set
              WHATSAPP_TEMPLATE_NAME once yours is approved.
            </p>
          )}
        </div>
      )}

      <p className="bg-sidebar/50 rounded-md p-3.5 text-xs text-foreground whitespace-pre-wrap leading-relaxed border border-border/40">
        {row.message}
      </p>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <a
          href={`https://wa.me/${phone}`}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1.5 text-xs text-accent hover:underline"
        >
          <ExternalLink size={12} /> Open this chat in WhatsApp
        </a>

        {confirming ? (
          <span className="flex items-center gap-2 text-xs">
            <span className="text-muted-foreground">Delete this record?</span>
            <button onClick={onConfirmDelete} className="text-destructive hover:underline">
              Delete
            </button>
            <button onClick={onCancelDelete} className="text-muted-foreground hover:underline">
              Cancel
            </button>
          </span>
        ) : (
          <button
            onClick={onAskDelete}
            className="text-xs text-muted-foreground hover:text-destructive transition-colors flex items-center gap-1"
          >
            <Trash2 size={12} /> Delete
          </button>
        )}
      </div>
    </Card>
  );
}
