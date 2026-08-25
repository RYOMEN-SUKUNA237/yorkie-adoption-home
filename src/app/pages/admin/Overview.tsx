import { useMemo } from "react";
import { ArrowRight } from "lucide-react";
import { useRouter } from "../../router";
import { useAsync } from "../../../hooks/useAsync";
import { getDashboardStats, listActivity } from "../../../services/misc";
import { listApplications } from "../../../services/applications";
import { formatDate, timeAgo } from "../../../lib/format";
import {
  Card,
  ErrorState,
  LoadingState,
  PageHeader,
  ScoreDot,
  StatTile,
  StatusBadge,
  EmptyState,
} from "../../components/admin/ui";

export default function Overview() {
  const { navigate } = useRouter();

  const stats = useAsync(() => getDashboardStats(), []);
  const recent = useAsync(() => listApplications({ limit: 6, sort: "newest" }), []);
  const activity = useAsync(() => listActivity(8), []);

  if (stats.loading) return <LoadingState label="Loading your dashboard…" />;
  if (stats.error) return <ErrorState error={stats.error} onRetry={stats.reload} />;
  if (!stats.data) return null;

  const s = stats.data;
  const weekDelta = s.applications.last_7_days - s.applications.prev_7_days;

  return (
    <>
      <PageHeader
        title="Overview"
        subtitle={`${s.applications.pending} awaiting review · ${s.messages.unread} unread messages`}
      />

      <div className="flex-1 p-4 sm:p-6 flex flex-col gap-6 bg-sidebar">
        {/* Metrics — 1 col on phones, 2 on tablets, 4 on desktop */}
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
          <StatTile
            label="Applications"
            value={s.applications.total}
            delta={{ value: weekDelta, label: "vs last week" }}
          />
          <StatTile
            label="Awaiting review"
            value={s.applications.pending}
            hint={s.applications.pending > 0 ? "Needs your attention" : "All caught up"}
            accent={s.applications.pending > 0 ? "#B8873F" : undefined}
          />
          <StatTile
            label="Unread messages"
            value={s.messages.unread}
            hint={`${s.messages.open_conversations} open conversation${s.messages.open_conversations === 1 ? "" : "s"}`}
            accent={s.messages.unread > 0 ? "#B8873F" : undefined}
          />
          <StatTile
            label="Average score"
            value={`${s.applications.avg_score}/10`}
            hint={`${s.puppies.available} puppies available`}
          />
        </div>

        <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
          {/* Applications over time */}
          <Card className="xl:col-span-2 p-4 sm:p-5">
            <div className="flex items-baseline justify-between mb-5">
              <h2 className="text-sm font-semibold text-foreground">Applications, last 30 days</h2>
              <span className="text-xs text-muted-foreground">
                {s.applications.last_7_days} this week
              </span>
            </div>
            <ApplicationsChart data={s.applications_by_day} />
          </Card>

          {/* Pipeline */}
          <Card className="p-4 sm:p-5">
            <h2 className="text-sm font-semibold text-foreground mb-5">Pipeline</h2>
            <PipelineBars applications={s.applications} />

            <div className="border-t border-border mt-5 pt-4 grid grid-cols-3 gap-3 text-center">
              <MiniStat label="Available" value={s.puppies.available} />
              <MiniStat label="Reserved" value={s.puppies.pending} />
              <MiniStat label="Placed" value={s.puppies.placed} />
            </div>
          </Card>
        </div>

        <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
          {/* Recent applications */}
          <Card className="xl:col-span-2 overflow-hidden">
            <div className="flex items-center justify-between px-4 sm:px-5 py-4 border-b border-border">
              <h2 className="text-sm font-semibold text-foreground">Recent applications</h2>
              <button
                onClick={() => navigate("/admin/applications")}
                className="text-xs text-accent hover:underline flex items-center gap-1 focus:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded-sm"
              >
                See all <ArrowRight size={12} />
              </button>
            </div>

            {recent.loading && <LoadingState label="Loading…" />}
            {recent.data && recent.data.rows.length === 0 && (
              <EmptyState
                title="No applications yet"
                description="Submissions from the public form will appear here."
              />
            )}
            {recent.data && recent.data.rows.length > 0 && (
              <ul className="divide-y divide-border">
                {recent.data.rows.map((app) => (
                  <li key={app.id}>
                    <button
                      onClick={() => navigate(`/admin/applications?id=${app.id}`)}
                      className="w-full text-left px-4 sm:px-5 py-3.5 hover:bg-sidebar transition-colors flex items-center gap-3 focus:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:-ring-offset-2"
                    >
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium text-foreground truncate">
                          {app.first_name} {app.last_name}
                        </p>
                        <p className="text-xs text-muted-foreground truncate">
                          {app.puppy_name ? `${app.puppy_name} · ` : ""}
                          {app.city}, {app.country} · {timeAgo(app.submitted_at)}
                        </p>
                      </div>
                      <div className="hidden sm:block shrink-0">
                        <ScoreDot score={app.score} />
                      </div>
                      <div className="shrink-0">
                        <StatusBadge status={app.status} size="xs" />
                      </div>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </Card>

          {/* Most requested + activity */}
          <div className="flex flex-col gap-4">
            <Card className="p-4 sm:p-5">
              <h2 className="text-sm font-semibold text-foreground mb-4">Most requested</h2>
              {s.top_puppies.length === 0 ? (
                <p className="text-sm text-muted-foreground">No applications yet.</p>
              ) : (
                <ul className="flex flex-col gap-3">
                  {s.top_puppies.map((row) => {
                    const max = Math.max(...s.top_puppies.map((p) => p.count), 1);
                    return (
                      <li key={row.name}>
                        <div className="flex items-baseline justify-between mb-1.5">
                          <span className="text-sm text-foreground truncate">{row.name}</span>
                          <span className="text-xs text-muted-foreground shrink-0 ml-2">
                            {row.count}
                          </span>
                        </div>
                        <div className="h-1.5 bg-secondary rounded-full overflow-hidden">
                          <div
                            className="h-full bg-accent rounded-full transition-all duration-500"
                            style={{ width: `${(row.count / max) * 100}%` }}
                          />
                        </div>
                      </li>
                    );
                  })}
                </ul>
              )}
            </Card>

            <Card className="p-4 sm:p-5 flex-1">
              <h2 className="text-sm font-semibold text-foreground mb-4">Recent activity</h2>
              {activity.data && activity.data.length > 0 ? (
                <ul className="flex flex-col gap-3">
                  {activity.data.map((entry) => (
                    <li key={entry.id} className="text-xs leading-relaxed">
                      <span className="text-foreground">
                        {describeActivity(entry.action, entry.meta)}
                      </span>
                      <span className="text-muted-foreground"> · {timeAgo(entry.created_at)}</span>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-sm text-muted-foreground">Nothing yet.</p>
              )}
            </Card>
          </div>
        </div>
      </div>
    </>
  );
}

function MiniStat({ label, value }: { label: string; value: number }) {
  return (
    <div>
      <p className="text-lg font-medium text-foreground">{value}</p>
      <p className="text-[10px] uppercase tracking-wider text-muted-foreground mt-0.5">{label}</p>
    </div>
  );
}

/**
 * Inline SVG bar chart. Recharts is available, but a 30-bar count series
 * does not need a charting library and this keeps the bundle honest.
 */
function ApplicationsChart({ data }: { data: Array<{ date: string; count: number }> }) {
  const max = useMemo(() => Math.max(...data.map((d) => d.count), 1), [data]);

  if (data.every((d) => d.count === 0)) {
    return (
      <p className="text-sm text-muted-foreground py-10 text-center">
        No applications in the last 30 days.
      </p>
    );
  }

  return (
    <div>
      <div className="flex items-end gap-[3px] h-32" role="img" aria-label="Applications per day over the last 30 days">
        {data.map((day) => (
          <div key={day.date} className="flex-1 flex flex-col justify-end group relative min-w-0">
            <div
              className="w-full bg-accent/70 hover:bg-accent rounded-t-[2px] transition-all duration-200"
              style={{ height: `${Math.max((day.count / max) * 100, day.count > 0 ? 6 : 2)}%` }}
            />
            <span className="pointer-events-none absolute bottom-full left-1/2 -translate-x-1/2 mb-1.5 hidden group-hover:block whitespace-nowrap bg-foreground text-background text-[10px] px-2 py-1 rounded-sm z-10">
              {day.count} on {formatDate(day.date)}
            </span>
          </div>
        ))}
      </div>
      <div className="flex justify-between mt-2 text-[10px] text-muted-foreground">
        <span>{formatDate(data[0]?.date)}</span>
        <span>{formatDate(data[data.length - 1]?.date)}</span>
      </div>
    </div>
  );
}

function PipelineBars({
  applications,
}: {
  applications: {
    pending: number;
    reviewing: number;
    shortlisted: number;
    approved: number;
    declined: number;
    waitlisted: number;
  };
}) {
  const rows = [
    { label: "Pending", value: applications.pending, color: "#5C7A99" },
    { label: "Reviewing", value: applications.reviewing, color: "#8A7BB8" },
    { label: "Shortlisted", value: applications.shortlisted, color: "#4A87A8" },
    { label: "Approved", value: applications.approved, color: "#2D6A35" },
    { label: "Waitlisted", value: applications.waitlisted, color: "#C9A227" },
    { label: "Declined", value: applications.declined, color: "#B8873F" },
  ];
  const total = Math.max(rows.reduce((sum, r) => sum + r.value, 0), 1);

  return (
    <ul className="flex flex-col gap-3">
      {rows.map((row) => (
        <li key={row.label}>
          <div className="flex items-baseline justify-between mb-1.5">
            <span className="text-xs text-foreground">{row.label}</span>
            <span className="text-xs text-muted-foreground">{row.value}</span>
          </div>
          <div className="h-1.5 bg-secondary rounded-full overflow-hidden">
            <div
              className="h-full rounded-full transition-all duration-500"
              style={{ width: `${(row.value / total) * 100}%`, backgroundColor: row.color }}
            />
          </div>
        </li>
      ))}
    </ul>
  );
}

function describeActivity(action: string, meta: Record<string, unknown>): string {
  const reference = typeof meta.reference === "string" ? meta.reference : "an application";
  switch (action) {
    case "application.status_changed":
      return `${reference} moved to ${String(meta.to ?? "a new status")}`;
    default:
      return action.replace(/[._]/g, " ");
  }
}
