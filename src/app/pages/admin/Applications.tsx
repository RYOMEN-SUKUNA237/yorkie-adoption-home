import { useCallback, useEffect, useState } from "react";
import {
  X, ChevronRight, Search, Download, Mail, Phone, Trash2, Loader2, Send,
} from "lucide-react";
import { useRouter } from "../../router";
import { useAsync, useDebounced } from "../../../hooks/useAsync";
import {
  addApplicationNote, applicationsToCsv, deleteApplication, getApplication,
  listApplicationNotes, listApplications, updateApplicationStatus,
  type ListApplicationsOptions,
} from "../../../services/applications";
import { downloadCsv } from "../../../services/misc";
import type {
  ApplicationNoteRow, ApplicationRow, ApplicationStatus, ScoreFactor,
} from "../../../lib/database.types";
import { formatDate, formatDateTime, timeAgo, whatsappHref } from "../../../lib/format";
import { useAuth } from "../../../lib/auth";
import {
  APPLICATION_STATUSES, APPLICATION_STATUS_LABELS, Button, EmptyState, ErrorState,
  Field, FilterChips, LoadingState, PageHeader, ScoreDot, Select, StatusBadge,
  TextArea, TextInput,
} from "../../components/admin/ui";

const PAGE_SIZE = 25;

type StatusFilter = ApplicationStatus | "all";

export default function Applications() {
  const { getParam, navigate } = useRouter();

  const [status, setStatus] = useState<StatusFilter>("all");
  const [search, setSearch] = useState("");
  const [sort, setSort] = useState<ListApplicationsOptions["sort"]>("newest");
  const [page, setPage] = useState(0);
  const [selectedId, setSelectedId] = useState<string | null>(getParam("id"));

  const debouncedSearch = useDebounced(search, 300);

  // Reset to the first page whenever the query changes underneath us.
  useEffect(() => setPage(0), [status, debouncedSearch, sort]);

  const list = useAsync(
    () =>
      listApplications({
        status,
        search: debouncedSearch,
        sort,
        limit: PAGE_SIZE,
        offset: page * PAGE_SIZE,
      }),
    [status, debouncedSearch, sort, page]
  );

  /** Patch one row in place so the table does not flash on a status change. */
  const patchRow = useCallback(
    (id: string, patch: Partial<ApplicationRow>) => {
      list.setData((current) =>
        current
          ? { ...current, rows: current.rows.map((r) => (r.id === id ? { ...r, ...patch } : r)) }
          : current
      );
    },
    [list]
  );

  const handleExport = () => {
    if (!list.data?.rows.length) return;
    downloadCsv(
      `applications-${new Date().toISOString().slice(0, 10)}.csv`,
      applicationsToCsv(list.data.rows)
    );
  };

  const total = list.data?.total ?? 0;
  const pageCount = Math.max(1, Math.ceil(total / PAGE_SIZE));

  return (
    <>
      <PageHeader
        title="Applications"
        subtitle={`${total} total${status !== "all" ? ` · filtered by ${APPLICATION_STATUS_LABELS[status]}` : ""}`}
        actions={
          <Button size="sm" onClick={handleExport} disabled={!list.data?.rows.length}>
            <Download size={13} /> Export CSV
          </Button>
        }
      />

      {/* Filters */}
      <div className="bg-background border-b border-border px-4 sm:px-6 py-3 flex flex-col gap-3">
        <div className="flex flex-col sm:flex-row gap-2 sm:items-center">
          <div className="relative flex-1 min-w-0">
            <Search
              size={14}
              className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none"
            />
            <TextInput
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search name, email, city, reference…"
              className="pl-9"
              aria-label="Search applications"
            />
          </div>
          <Select
            value={sort}
            onChange={(e) => setSort(e.target.value as ListApplicationsOptions["sort"])}
            aria-label="Sort applications"
            className="sm:w-44 shrink-0"
          >
            <option value="newest">Newest first</option>
            <option value="oldest">Oldest first</option>
            <option value="score_high">Highest score</option>
            <option value="score_low">Lowest score</option>
          </Select>
        </div>

        <FilterChips<StatusFilter>
          value={status}
          onChange={setStatus}
          options={[
            { value: "all", label: "All" },
            ...APPLICATION_STATUSES.map((s) => ({ value: s, label: APPLICATION_STATUS_LABELS[s] })),
          ]}
        />
      </div>

      {/* Results */}
      <div className="flex-1 bg-background">
        {list.loading && <LoadingState />}
        {list.error && <ErrorState error={list.error} onRetry={list.reload} />}
        {list.data && list.data.rows.length === 0 && (
          <EmptyState
            title={search || status !== "all" ? "No matching applications" : "No applications yet"}
            description={
              search || status !== "all"
                ? "Try a different search or filter."
                : "Submissions from the public form land here, scored automatically."
            }
          />
        )}

        {list.data && list.data.rows.length > 0 && (
          <>
            {/* Table from md up */}
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border bg-sidebar text-left">
                    <Th className="pl-6">Applicant</Th>
                    <Th>Puppy</Th>
                    <Th>Score</Th>
                    <Th>Status</Th>
                    <Th className="hidden lg:table-cell">Submitted</Th>
                    <th className="w-10 px-4 py-3" />
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {list.data.rows.map((app) => (
                    <tr
                      key={app.id}
                      onClick={() => setSelectedId(app.id)}
                      className="hover:bg-sidebar cursor-pointer transition-colors"
                    >
                      <td className="pl-6 pr-4 py-3.5">
                        <p className="font-medium text-foreground">
                          {app.first_name} {app.last_name}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {app.reference} · {app.city}, {app.country}
                        </p>
                      </td>
                      <td className="px-4 py-3.5 text-foreground">{app.puppy_name ?? "—"}</td>
                      <td className="px-4 py-3.5">
                        <ScoreDot score={app.score} />
                      </td>
                      <td className="px-4 py-3.5">
                        <StatusBadge status={app.status} size="xs" />
                      </td>
                      <td className="px-4 py-3.5 text-xs text-muted-foreground hidden lg:table-cell">
                        {formatDate(app.submitted_at)}
                      </td>
                      <td className="px-4 py-3.5">
                        <ChevronRight size={14} className="text-muted-foreground" />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Cards below md — a 6-column table is unusable on a phone */}
            <ul className="md:hidden divide-y divide-border">
              {list.data.rows.map((app) => (
                <li key={app.id}>
                  <button
                    onClick={() => setSelectedId(app.id)}
                    className="w-full text-left px-4 py-4 hover:bg-sidebar transition-colors"
                  >
                    <div className="flex items-start justify-between gap-3 mb-1.5">
                      <p className="font-medium text-foreground text-sm min-w-0 truncate">
                        {app.first_name} {app.last_name}
                      </p>
                      <StatusBadge status={app.status} size="xs" />
                    </div>
                    <p className="text-xs text-muted-foreground mb-2">
                      {app.puppy_name ? `${app.puppy_name} · ` : ""}
                      {app.city}, {app.country}
                    </p>
                    <div className="flex items-center justify-between">
                      <ScoreDot score={app.score} />
                      <span className="text-xs text-muted-foreground">
                        {timeAgo(app.submitted_at)}
                      </span>
                    </div>
                  </button>
                </li>
              ))}
            </ul>

            {pageCount > 1 && (
              <div className="flex items-center justify-between px-4 sm:px-6 py-4 border-t border-border">
                <Button size="sm" disabled={page === 0} onClick={() => setPage((p) => p - 1)}>
                  Previous
                </Button>
                <span className="text-xs text-muted-foreground">
                  Page {page + 1} of {pageCount}
                </span>
                <Button
                  size="sm"
                  disabled={page >= pageCount - 1}
                  onClick={() => setPage((p) => p + 1)}
                >
                  Next
                </Button>
              </div>
            )}
          </>
        )}
      </div>

      {selectedId && (
        <ApplicationDrawer
          id={selectedId}
          onClose={() => {
            setSelectedId(null);
            if (getParam("id")) navigate("/admin/applications");
          }}
          onChanged={(patch) => patchRow(selectedId, patch)}
          onDeleted={() => {
            setSelectedId(null);
            list.reload();
          }}
        />
      )}
    </>
  );
}

function Th({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return (
    <th
      className={`px-4 py-3 text-xs font-medium text-muted-foreground tracking-wide ${className}`}
    >
      {children}
    </th>
  );
}

// =====================================================================
// Detail drawer
// =====================================================================

function ApplicationDrawer({
  id,
  onClose,
  onChanged,
  onDeleted,
}: {
  id: string;
  onClose: () => void;
  onChanged: (patch: Partial<ApplicationRow>) => void;
  onDeleted: () => void;
}) {
  const { isAdmin } = useAuth();
  const app = useAsync(() => getApplication(id), [id]);
  const notes = useAsync(() => listApplicationNotes(id), [id]);

  const [busy, setBusy] = useState(false);
  const [noteDraft, setNoteDraft] = useState("");
  const [decisionNote, setDecisionNote] = useState("");
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (app.data) setDecisionNote(app.data.decision_note ?? "");
  }, [app.data]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = previous;
    };
  }, [onClose]);

  const changeStatus = async (status: ApplicationStatus) => {
    setBusy(true);
    setError(null);
    try {
      await updateApplicationStatus(id, status, decisionNote || undefined);
      app.setData((current) => (current ? { ...current, status } : current));
      onChanged({ status });
      notes.reload();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not update the status.");
    } finally {
      setBusy(false);
    }
  };

  const submitNote = async () => {
    const body = noteDraft.trim();
    if (!body) return;
    setBusy(true);
    try {
      const created = await addApplicationNote(id, body);
      notes.setData((current) => [created, ...(current ?? [])]);
      setNoteDraft("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save the note.");
    } finally {
      setBusy(false);
    }
  };

  const handleDelete = async () => {
    setBusy(true);
    try {
      await deleteApplication(id);
      onDeleted();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not delete.");
      setBusy(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex">
      <div className="absolute inset-0 bg-foreground/25 backdrop-blur-sm" onClick={onClose} />

      <div className="relative ml-auto w-full sm:max-w-lg bg-background sm:border-l border-border h-full overflow-y-auto shadow-2xl flex flex-col overscroll-contain">
        {app.loading && <LoadingState />}
        {app.error && <ErrorState error={app.error} onRetry={app.reload} />}

        {app.data && (
          <>
            <header className="flex items-start justify-between gap-3 px-5 sm:px-6 py-4 border-b border-border sticky top-0 bg-background z-10">
              <div className="min-w-0">
                <p className="text-[10px] text-muted-foreground tracking-[0.15em] uppercase mb-1">
                  {app.data.reference}
                </p>
                <h2
                  className="text-lg font-medium text-foreground truncate"
                  style={{ fontFamily: "'Newsreader', Georgia, serif" }}
                >
                  {app.data.first_name} {app.data.last_name}
                </h2>
              </div>
              <button
                onClick={onClose}
                aria-label="Close"
                className="shrink-0 p-2 -mr-2 text-muted-foreground hover:text-foreground transition-colors rounded-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                <X size={18} />
              </button>
            </header>

            <div className="flex-1 px-5 sm:px-6 py-5 flex flex-col gap-6">
              <div className="flex items-center justify-between gap-3">
                <StatusBadge status={app.data.status} />
                <ScoreDot score={app.data.score} />
              </div>

              {error && (
                <p className="text-sm text-primary" role="alert">
                  {error}
                </p>
              )}

              <Section title="Contact">
                <div className="flex flex-col gap-2">
                  <a
                    href={`mailto:${app.data.email}`}
                    className="text-sm text-accent hover:underline flex items-center gap-2 break-all"
                  >
                    <Mail size={13} className="shrink-0" /> {app.data.email}
                  </a>
                  <a
                    href={whatsappHref(app.data.phone)}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-sm text-accent hover:underline flex items-center gap-2"
                  >
                    <Phone size={13} className="shrink-0" /> {app.data.phone}
                  </a>
                  <p className="text-sm text-muted-foreground">
                    {app.data.city}, {app.data.country}
                  </p>
                </div>
              </Section>

              <Section title="Score breakdown">
                <ScoreBreakdown factors={app.data.score_breakdown} total={app.data.score} />
              </Section>

              <Section title="Application">
                <dl className="grid grid-cols-2 gap-x-4 gap-y-3 text-sm">
                  <Detail label="Puppy" value={app.data.puppy_name ?? "No preference"} />
                  <Detail label="Submitted" value={formatDate(app.data.submitted_at)} />
                  <Detail label="Home" value={app.data.home_type ?? "—"} capitalize />
                  <Detail label="Ownership" value={app.data.ownership ?? "—"} capitalize />
                  {app.data.ownership === "rent" && (
                    <Detail label="Landlord allows" value={app.data.landlord_allows ?? "—"} capitalize />
                  )}
                  <Detail label="Fenced space" value={app.data.fenced_space ?? "—"} capitalize />
                  <Detail label="Adults" value={String(app.data.adult_count)} />
                  <Detail label="Children" value={app.data.children_ages || "None"} />
                  <Detail label="Hours alone" value={`${app.data.hours_alone}h / day`} />
                  <Detail label="Owned before" value={app.data.owned_before ? "Yes" : "First dog"} />
                  <Detail label="Primary carer" value={app.data.primary_carer ?? "—"} />
                  <Detail label="Allergies" value={app.data.allergies || "None reported"} />
                </dl>
              </Section>

              {app.data.has_pets && app.data.pets.length > 0 && (
                <Section title={`Other pets (${app.data.pets.length})`}>
                  <ul className="flex flex-col gap-2">
                    {app.data.pets.map((pet, i) => (
                      <li key={i} className="text-sm text-foreground border border-border rounded-sm px-3 py-2">
                        <span className="font-medium capitalize">{pet.species || "Pet"}</span>
                        {pet.age && <span className="text-muted-foreground"> · {pet.age}</span>}
                        {pet.sex && <span className="text-muted-foreground"> · {pet.sex}</span>}
                        <span className="text-muted-foreground">
                          {" · "}
                          {pet.vaccinated ? "vaccinated" : "not vaccinated"}
                          {pet.neutered ? ", neutered" : ""}
                        </span>
                      </li>
                    ))}
                  </ul>
                </Section>
              )}

              {app.data.dog_sleeps && (
                <Section title="Where the dog will sleep">
                  <Prose>{app.data.dog_sleeps}</Prose>
                </Section>
              )}
              {app.data.travel_care && (
                <Section title="Care while travelling">
                  <Prose>{app.data.travel_care}</Prose>
                </Section>
              )}
              {app.data.previous_dog_history && (
                <Section title="Previous dogs">
                  <Prose>{app.data.previous_dog_history}</Prose>
                </Section>
              )}
              {app.data.additional_info && (
                <Section title="Anything else">
                  <Prose>{app.data.additional_info}</Prose>
                </Section>
              )}

              <Section title="Decision note">
                <Field label="" hint="Visible to staff only. Saved with the next status change.">
                  <TextArea
                    rows={3}
                    value={decisionNote}
                    onChange={(e) => setDecisionNote(e.target.value)}
                    placeholder="Why this decision was made…"
                  />
                </Field>
              </Section>

              <Section title="Review timeline">
                <div className="flex gap-2 mb-4">
                  <TextInput
                    value={noteDraft}
                    onChange={(e) => setNoteDraft(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && submitNote()}
                    placeholder="Add an internal note…"
                    className="flex-1"
                  />
                  <Button
                    size="sm"
                    variant="secondary"
                    onClick={submitNote}
                    disabled={!noteDraft.trim() || busy}
                    aria-label="Add note"
                  >
                    <Send size={13} />
                  </Button>
                </div>

                {notes.data && notes.data.length > 0 ? (
                  <ul className="flex flex-col gap-3">
                    {notes.data.map((note) => (
                      <NoteItem key={note.id} note={note} />
                    ))}
                  </ul>
                ) : (
                  <p className="text-sm text-muted-foreground">No notes yet.</p>
                )}
              </Section>

              {isAdmin && (
                <Section title="Danger zone">
                  {confirmDelete ? (
                    <div className="flex flex-col gap-2">
                      <p className="text-sm text-muted-foreground leading-relaxed">
                        Delete this application permanently? The applicant is not notified and this
                        cannot be undone.
                      </p>
                      <div className="flex gap-2">
                        <Button variant="danger" size="sm" onClick={handleDelete} disabled={busy}>
                          {busy && <Loader2 size={12} className="animate-spin" />} Yes, delete
                        </Button>
                        <Button variant="ghost" size="sm" onClick={() => setConfirmDelete(false)}>
                          Cancel
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <Button variant="danger" size="sm" onClick={() => setConfirmDelete(true)}>
                      <Trash2 size={13} /> Delete application
                    </Button>
                  )}
                </Section>
              )}
            </div>

            {/* Sticky decision bar */}
            <div
              className="px-5 sm:px-6 py-4 border-t border-border sticky bottom-0 bg-background flex flex-col gap-2"
              style={{ paddingBottom: "max(1rem, env(safe-area-inset-bottom))" }}
            >
              <Select
                value={app.data.status}
                onChange={(e) => void changeStatus(e.target.value as ApplicationStatus)}
                disabled={busy}
                aria-label="Application status"
              >
                {APPLICATION_STATUSES.map((s) => (
                  <option key={s} value={s}>
                    {APPLICATION_STATUS_LABELS[s]}
                  </option>
                ))}
              </Select>
              <div className="flex gap-2">
                <Button
                  variant="success"
                  className="flex-1"
                  disabled={busy || app.data.status === "approved"}
                  onClick={() => void changeStatus("approved")}
                >
                  Approve
                </Button>
                <Button
                  variant="danger"
                  className="flex-1"
                  disabled={busy || app.data.status === "declined"}
                  onClick={() => void changeStatus("declined")}
                >
                  Decline
                </Button>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

function NoteItem({ note }: { note: ApplicationNoteRow }) {
  return (
    <li
      className={`text-sm border-l-2 pl-3 ${
        note.is_system ? "border-border" : "border-accent"
      }`}
    >
      <p className={note.is_system ? "text-muted-foreground italic" : "text-foreground leading-relaxed"}>
        {note.body}
      </p>
      <p className="text-[11px] text-muted-foreground mt-1">
        {note.author_name ?? "System"} · {formatDateTime(note.created_at)}
      </p>
    </li>
  );
}

function ScoreBreakdown({ factors, total }: { factors: ScoreFactor[]; total: number }) {
  if (!Array.isArray(factors) || factors.length === 0) {
    return <p className="text-sm text-muted-foreground">No breakdown recorded.</p>;
  }

  return (
    <ul className="flex flex-col gap-2.5">
      {factors.map((factor) => (
        <li key={factor.label}>
          <div className="flex items-baseline justify-between gap-2 mb-1">
            <span className="text-sm text-foreground">{factor.label}</span>
            <span className="text-xs text-muted-foreground shrink-0 tabular-nums">
              {factor.points} / {factor.max}
            </span>
          </div>
          <div className="h-1.5 bg-secondary rounded-full overflow-hidden mb-1">
            <div
              className="h-full bg-accent rounded-full transition-all duration-500"
              style={{ width: `${factor.max > 0 ? (factor.points / factor.max) * 100 : 0}%` }}
            />
          </div>
          <p className="text-[11px] text-muted-foreground">{factor.reason}</p>
        </li>
      ))}
      <li className="border-t border-border pt-2.5 flex items-baseline justify-between">
        <span className="text-sm font-medium text-foreground">Total</span>
        <span className="text-sm font-medium text-foreground tabular-nums">{total} / 10</span>
      </li>
    </ul>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="border-t border-border pt-4 first:border-t-0 first:pt-0">
      <h3 className="text-[10px] text-muted-foreground uppercase tracking-[0.15em] font-medium mb-3">
        {title}
      </h3>
      {children}
    </section>
  );
}

function Detail({
  label,
  value,
  capitalize,
}: {
  label: string;
  value: string;
  capitalize?: boolean;
}) {
  return (
    <div>
      <dt className="text-xs text-muted-foreground mb-0.5">{label}</dt>
      <dd className={`font-medium text-foreground ${capitalize ? "capitalize" : ""}`}>{value}</dd>
    </div>
  );
}

function Prose({ children }: { children: React.ReactNode }) {
  return <p className="text-sm text-foreground leading-relaxed whitespace-pre-wrap">{children}</p>;
}
