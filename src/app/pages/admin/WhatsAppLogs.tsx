import { useState } from "react";
import {
  Search, MessageSquare, ExternalLink, RefreshCw, Trash2, CheckCircle2, Phone, User
} from "lucide-react";
import { useAsync, useDebounced } from "../../../hooks/useAsync";
import { listWhatsAppLogs, deleteWhatsAppLog } from "../../../services/whatsapp";
import type { WhatsAppLogRow } from "../../../lib/database.types";
import { formatDateTime, timeAgo } from "../../../lib/format";
import {
  Button, EmptyState, ErrorState, LoadingState, PageHeader, TextInput, Card
} from "../../components/admin/ui";

export default function WhatsAppLogs() {
  const [search, setSearch] = useState("");
  const debouncedSearch = useDebounced(search, 300);

  const logs = useAsync(
    () => listWhatsAppLogs({ search: debouncedSearch }),
    [debouncedSearch]
  );

  return (
    <>
      <PageHeader
        title="WhatsApp Logs"
        subtitle={`${logs.data?.length ?? 0} automatic messages recorded`}
        actions={
          <Button size="sm" variant="ghost" onClick={() => logs.reload()} title="Refresh logs">
            <RefreshCw size={13} className={logs.loading ? "animate-spin" : ""} /> Refresh
          </Button>
        }
      />

      <div className="flex-1 bg-background flex flex-col min-h-0">
        {/* Search Bar */}
        <div className="px-4 sm:px-6 py-3 border-b border-border bg-sidebar/30">
          <div className="relative max-w-md">
            <Search
              size={14}
              className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none"
            />
            <TextInput
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search phone, applicant name, reference…"
              className="pl-9"
              aria-label="Search WhatsApp logs"
            />
          </div>
        </div>

        {/* Logs Content */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6">
          {logs.loading && <LoadingState />}
          {logs.error && <ErrorState error={logs.error} onRetry={logs.reload} />}
          {logs.data && logs.data.length === 0 && (
            <EmptyState
              title={search ? "No matching WhatsApp logs" : "No WhatsApp messages sent yet"}
              description={
                search
                  ? "Try searching for a different phone number or name."
                  : "Automatic WhatsApp messages sent when applications are approved will appear here."
              }
            />
          )}

          {logs.data && logs.data.length > 0 && (
            <div className="grid grid-cols-1 gap-4 max-w-5xl mx-auto">
              {logs.data.map((item) => {
                const cleanPhone = item.recipient_phone.replace(/\D/g, "");
                const waLink = `https://wa.me/${cleanPhone}?text=${encodeURIComponent(item.message)}`;

                return (
                  <Card key={item.id} className="p-5 flex flex-col gap-3.5 hover:border-border/80 transition-colors">
                    <div className="flex flex-wrap items-start justify-between gap-2 border-b border-border/60 pb-3">
                      <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-full bg-emerald-100 text-emerald-700 flex items-center justify-center shrink-0">
                          <MessageSquare size={16} />
                        </div>
                        <div>
                          <p className="text-sm font-bold text-foreground flex items-center gap-2">
                            <span>+{cleanPhone}</span>
                            {item.recipient_name && (
                              <span className="text-xs font-normal text-muted-foreground">
                                ({item.recipient_name})
                              </span>
                            )}
                          </p>
                          <p className="text-xs text-muted-foreground flex items-center gap-2 mt-0.5">
                            <span>{formatDateTime(item.created_at)}</span>
                            <span>·</span>
                            <span>{timeAgo(item.created_at)}</span>
                          </p>
                        </div>
                      </div>

                      <div className="flex items-center gap-2">
                        {item.reference && (
                          <span className="text-xs font-mono bg-sidebar-accent border border-border px-2 py-0.5 rounded text-foreground font-medium">
                            {item.reference}
                          </span>
                        )}
                        <span className="text-[11px] font-semibold bg-emerald-100 text-emerald-800 px-2.5 py-0.5 rounded-full flex items-center gap-1">
                          <CheckCircle2 size={11} /> Auto Sent
                        </span>
                      </div>
                    </div>

                    {/* Message Body */}
                    <div className="bg-sidebar/50 rounded-lg p-3.5 text-xs text-foreground whitespace-pre-wrap leading-relaxed border border-border/40 font-mono">
                      {item.message}
                    </div>

                    {/* Action Bar */}
                    <div className="flex items-center justify-between pt-1">
                      <a
                        href={waLink}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1.5 text-xs font-semibold text-emerald-700 hover:text-emerald-800 hover:underline"
                      >
                        <ExternalLink size={13} /> Open WhatsApp Chat with Client
                      </a>

                      <button
                        onClick={async () => {
                          await deleteWhatsAppLog(item.id);
                          logs.reload();
                        }}
                        className="text-xs text-muted-foreground hover:text-destructive transition-colors flex items-center gap-1"
                      >
                        <Trash2 size={12} /> Delete log
                      </button>
                    </div>
                  </Card>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </>
  );
}
