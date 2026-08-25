import { useState } from "react";
import { Download, Trash2, Mail } from "lucide-react";
import { useAsync } from "../../../hooks/useAsync";
import {
  downloadCsv, listWaitlist, removeFromWaitlist, setWaitlistStatus, waitlistToCsv,
} from "../../../services/misc";
import type { WaitlistStatus } from "../../../lib/database.types";
import { formatDate } from "../../../lib/format";
import {
  Button, EmptyState, ErrorState, FilterChips, LoadingState, PageHeader, Select,
} from "../../components/admin/ui";

const STATUS_LABELS: Record<WaitlistStatus, string> = {
  active: "Active",
  contacted: "Contacted",
  converted: "Converted",
  removed: "Removed",
};

const STATUS_STYLES: Record<WaitlistStatus, string> = {
  active: "bg-[#E8F0E9] text-[#2D6A35] border-[#B8D9BB]",
  contacted: "bg-[#EDEFF2] text-[#3C5166] border-[#C3CEDB]",
  converted: "bg-[#E6F0F7] text-[#245A78] border-[#B4D2E4]",
  removed: "bg-[#F0F0F0] text-[#6B6B6B] border-[#D8D8D8]",
};

export default function Waitlist() {
  const [filter, setFilter] = useState<WaitlistStatus | "all">("all");
  const rows = useAsync(() => listWaitlist(filter), [filter]);

  const changeStatus = async (id: string, status: WaitlistStatus) => {
    await setWaitlistStatus(id, status);
    rows.setData((current) =>
      current ? current.map((r) => (r.id === id ? { ...r, status } : r)) : current
    );
  };

  const remove = async (id: string) => {
    await removeFromWaitlist(id);
    rows.setData((current) => (current ? current.filter((r) => r.id !== id) : current));
  };

  return (
    <>
      <PageHeader
        title="Waitlist"
        subtitle={`${rows.data?.length ?? 0} ${filter === "all" ? "total" : STATUS_LABELS[filter].toLowerCase()}`}
        actions={
          <Button
            size="sm"
            disabled={!rows.data?.length}
            onClick={() =>
              rows.data &&
              downloadCsv(
                `waitlist-${new Date().toISOString().slice(0, 10)}.csv`,
                waitlistToCsv(rows.data)
              )
            }
          >
            <Download size={13} /> Export CSV
          </Button>
        }
      />

      <div className="bg-background border-b border-border px-4 sm:px-6 py-3">
        <FilterChips<WaitlistStatus | "all">
          value={filter}
          onChange={setFilter}
          options={[
            { value: "all", label: "All" },
            { value: "active", label: "Active" },
            { value: "contacted", label: "Contacted" },
            { value: "converted", label: "Converted" },
            { value: "removed", label: "Removed" },
          ]}
        />
      </div>

      <div className="flex-1 bg-background">
        {rows.loading && <LoadingState />}
        {rows.error && <ErrorState error={rows.error} onRetry={rows.reload} />}
        {rows.data?.length === 0 && (
          <EmptyState
            title="Nobody on the waitlist"
            description="People who join from the site — including after a declined application — appear here."
          />
        )}

        {rows.data && rows.data.length > 0 && (
          <>
            {/* Table from md up */}
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border bg-sidebar text-left">
                    <th className="pl-6 pr-4 py-3 text-xs font-medium text-muted-foreground">Person</th>
                    <th className="px-4 py-3 text-xs font-medium text-muted-foreground">Country</th>
                    <th className="px-4 py-3 text-xs font-medium text-muted-foreground">Source</th>
                    <th className="px-4 py-3 text-xs font-medium text-muted-foreground">Joined</th>
                    <th className="px-4 py-3 text-xs font-medium text-muted-foreground">Status</th>
                    <th className="w-10 px-4 py-3" />
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {rows.data.map((row) => (
                    <tr key={row.id} className="hover:bg-sidebar transition-colors">
                      <td className="pl-6 pr-4 py-3.5">
                        <p className="font-medium text-foreground">{row.full_name || "—"}</p>
                        <a
                          href={`mailto:${row.email}`}
                          className="text-xs text-accent hover:underline break-all"
                        >
                          {row.email}
                        </a>
                      </td>
                      <td className="px-4 py-3.5 text-foreground">{row.country || "—"}</td>
                      <td className="px-4 py-3.5 text-xs text-muted-foreground capitalize">
                        {row.source}
                      </td>
                      <td className="px-4 py-3.5 text-xs text-muted-foreground">
                        {formatDate(row.created_at)}
                      </td>
                      <td className="px-4 py-3.5">
                        <Select
                          value={row.status}
                          onChange={(e) =>
                            void changeStatus(row.id, e.target.value as WaitlistStatus)
                          }
                          className="text-xs py-1 w-32"
                          aria-label={`Status for ${row.email}`}
                        >
                          {(Object.keys(STATUS_LABELS) as WaitlistStatus[]).map((s) => (
                            <option key={s} value={s}>
                              {STATUS_LABELS[s]}
                            </option>
                          ))}
                        </Select>
                      </td>
                      <td className="px-4 py-3.5">
                        <button
                          onClick={() => void remove(row.id)}
                          aria-label={`Remove ${row.email}`}
                          className="p-1.5 text-muted-foreground hover:text-primary rounded-sm transition-colors"
                        >
                          <Trash2 size={14} />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Cards below md */}
            <ul className="md:hidden divide-y divide-border">
              {rows.data.map((row) => (
                <li key={row.id} className="px-4 py-4">
                  <div className="flex items-start justify-between gap-3 mb-2">
                    <div className="min-w-0">
                      <p className="font-medium text-foreground text-sm truncate">
                        {row.full_name || "—"}
                      </p>
                      <a
                        href={`mailto:${row.email}`}
                        className="text-xs text-accent hover:underline break-all"
                      >
                        {row.email}
                      </a>
                    </div>
                    <span
                      className={`shrink-0 text-[10px] font-medium px-2 py-0.5 rounded-sm border ${STATUS_STYLES[row.status]}`}
                    >
                      {STATUS_LABELS[row.status]}
                    </span>
                  </div>
                  <p className="text-xs text-muted-foreground mb-3">
                    {row.country ? `${row.country} · ` : ""}
                    {row.source} · joined {formatDate(row.created_at)}
                  </p>
                  <div className="flex items-center gap-2">
                    <Select
                      value={row.status}
                      onChange={(e) => void changeStatus(row.id, e.target.value as WaitlistStatus)}
                      className="text-xs py-1.5 flex-1"
                      aria-label={`Status for ${row.email}`}
                    >
                      {(Object.keys(STATUS_LABELS) as WaitlistStatus[]).map((s) => (
                        <option key={s} value={s}>
                          {STATUS_LABELS[s]}
                        </option>
                      ))}
                    </Select>
                    <a
                      href={`mailto:${row.email}`}
                      aria-label={`Email ${row.email}`}
                      className="p-2 border border-border rounded-sm text-muted-foreground hover:text-foreground transition-colors"
                    >
                      <Mail size={14} />
                    </a>
                    <button
                      onClick={() => void remove(row.id)}
                      aria-label={`Remove ${row.email}`}
                      className="p-2 border border-border rounded-sm text-muted-foreground hover:text-primary transition-colors"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          </>
        )}
      </div>
    </>
  );
}
