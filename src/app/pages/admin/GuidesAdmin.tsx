import { useEffect, useState } from "react";
import { Plus, X, Trash2, Loader2, ArrowUp, ArrowDown, Wand2 } from "lucide-react";
import { useAsync } from "../../../hooks/useAsync";
import {
  createGuide, deleteGuide, estimateReadingTime, listGuides, updateGuide,
  type GuideInput,
} from "../../../services/guides";
import { slugify, type Guide } from "../../../lib/models";
import type { GuideSection } from "../../../lib/database.types";
import { formatDate } from "../../../lib/format";
import {
  Button, Card, EmptyState, ErrorState, Field, LoadingState, PageHeader,
  TextArea, TextInput, Toggle,
} from "../../components/admin/ui";

export default function GuidesAdmin() {
  const [editing, setEditing] = useState<Guide | "new" | null>(null);
  const guides = useAsync(() => listGuides({ includeUnpublished: true }), []);

  return (
    <>
      <PageHeader
        title="Guides"
        subtitle={`${guides.data?.length ?? 0} article${guides.data?.length === 1 ? "" : "s"}`}
        actions={
          <Button size="sm" variant="primary" onClick={() => setEditing("new")}>
            <Plus size={14} /> New guide
          </Button>
        }
      />

      <div className="flex-1 bg-sidebar p-4 sm:p-6">
        {guides.loading && <LoadingState />}
        {guides.error && <ErrorState error={guides.error} onRetry={guides.reload} />}
        {guides.data?.length === 0 && (
          <EmptyState
            title="No guides yet"
            description="Owner guides help applicants understand what the breed needs."
            action={
              <Button variant="primary" size="sm" onClick={() => setEditing("new")}>
                <Plus size={14} /> Write the first one
              </Button>
            }
          />
        )}

        <div className="grid grid-cols-1 lg:grid-cols-2 2xl:grid-cols-3 gap-4">
          {guides.data?.map((guide) => (
            <Card key={guide.id} className="p-4 sm:p-5 flex flex-col gap-3">
              <div className="flex items-start justify-between gap-3">
                <h3
                  className="text-base font-medium text-foreground leading-snug"
                  style={{ fontFamily: "'Newsreader', Georgia, serif" }}
                >
                  {guide.title}
                </h3>
                {!guide.isPublished && (
                  <span className="shrink-0 text-[10px] font-medium px-2 py-0.5 rounded-sm bg-foreground text-background">
                    Draft
                  </span>
                )}
              </div>
              <p className="text-sm text-muted-foreground leading-relaxed line-clamp-3">
                {guide.summary}
              </p>
              <p className="text-xs text-muted-foreground">
                {formatDate(guide.publishedDate)} · {guide.readingTimeMin} min read ·{" "}
                {guide.sections.length} section{guide.sections.length === 1 ? "" : "s"}
              </p>
              <Button size="sm" className="mt-auto w-full" onClick={() => setEditing(guide)}>
                Edit
              </Button>
            </Card>
          ))}
        </div>
      </div>

      {editing && (
        <GuideEditor
          guide={editing === "new" ? null : editing}
          onClose={() => setEditing(null)}
          onSaved={() => {
            setEditing(null);
            guides.reload();
          }}
        />
      )}
    </>
  );
}

// =====================================================================
// Editor
// =====================================================================

function GuideEditor({
  guide,
  onClose,
  onSaved,
}: {
  guide: Guide | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [title, setTitle] = useState(guide?.title ?? "");
  const [slug, setSlug] = useState(guide?.slug ?? "");
  const [summary, setSummary] = useState(guide?.summary ?? "");
  const [publishedDate, setPublishedDate] = useState(
    guide?.publishedDate ?? new Date().toISOString().slice(0, 10)
  );
  const [readingTime, setReadingTime] = useState(String(guide?.readingTimeMin ?? 5));
  const [isPublished, setIsPublished] = useState(guide?.isPublished ?? true);
  const [sections, setSections] = useState<GuideSection[]>(
    guide?.sections.length ? guide.sections : [{ body: "" }]
  );

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);

  useEffect(() => {
    if (!guide && title) setSlug(slugify(title));
  }, [title, guide]);

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

  const updateSection = (index: number, patch: Partial<GuideSection>) =>
    setSections((current) => current.map((s, i) => (i === index ? { ...s, ...patch } : s)));

  const moveSection = (index: number, direction: -1 | 1) => {
    const target = index + direction;
    if (target < 0 || target >= sections.length) return;
    const next = [...sections];
    [next[index], next[target]] = [next[target], next[index]];
    setSections(next);
  };

  const handleSave = async () => {
    if (!title.trim() || !slug) {
      setError("A title and slug are required.");
      return;
    }
    const cleaned = sections.filter((s) => (s.body ?? "").trim());
    if (cleaned.length === 0) {
      setError("Write at least one section.");
      return;
    }

    setSaving(true);
    setError(null);

    try {
      const input: GuideInput = {
        slug,
        title: title.trim(),
        summary: summary.trim(),
        reading_time_min: Number(readingTime) || estimateReadingTime(cleaned),
        published_date: publishedDate,
        sections: cleaned.map((s) => ({
          ...(s.heading?.trim() ? { heading: s.heading.trim() } : {}),
          body: s.body.trim(),
        })),
        is_published: isPublished,
      };

      if (guide) await updateGuide(guide.id, input);
      else await createGuide(input);
      onSaved();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save.");
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex">
      <div className="absolute inset-0 bg-foreground/25 backdrop-blur-sm" onClick={onClose} />

      <div className="relative ml-auto w-full sm:max-w-2xl bg-background sm:border-l border-border h-full overflow-y-auto shadow-2xl flex flex-col overscroll-contain">
        <header className="flex items-center justify-between gap-3 px-5 sm:px-6 py-4 border-b border-border sticky top-0 bg-background z-10">
          <h2
            className="text-lg font-medium text-foreground truncate"
            style={{ fontFamily: "'Newsreader', Georgia, serif" }}
          >
            {guide ? "Edit guide" : "New guide"}
          </h2>
          <button
            onClick={onClose}
            aria-label="Close"
            className="shrink-0 p-2 -mr-2 text-muted-foreground hover:text-foreground rounded-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <X size={18} />
          </button>
        </header>

        <div className="flex-1 px-5 sm:px-6 py-5 flex flex-col gap-5">
          {error && (
            <p className="text-sm text-primary" role="alert">
              {error}
            </p>
          )}

          <Field label="Title" required>
            <TextInput value={title} onChange={(e) => setTitle(e.target.value)} />
          </Field>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Field
              label="URL slug"
              required
              hint={guide ? "Changing this breaks existing links." : undefined}
            >
              <TextInput value={slug} onChange={(e) => setSlug(slugify(e.target.value))} />
            </Field>
            <Field label="Published date">
              <TextInput
                type="date"
                value={publishedDate}
                onChange={(e) => setPublishedDate(e.target.value)}
              />
            </Field>
          </div>

          <Field label="Summary" hint="Shown on the guides index.">
            <TextArea rows={3} value={summary} onChange={(e) => setSummary(e.target.value)} />
          </Field>

          <Field label="Reading time (minutes)">
            <div className="flex gap-2">
              <TextInput
                type="number"
                min="1"
                value={readingTime}
                onChange={(e) => setReadingTime(e.target.value)}
              />
              <Button
                size="sm"
                variant="secondary"
                className="shrink-0"
                onClick={() => setReadingTime(String(estimateReadingTime(sections)))}
                title="Estimate from the text at 200 words per minute"
              >
                <Wand2 size={13} /> Estimate
              </Button>
            </div>
          </Field>

          <Toggle
            checked={isPublished}
            onChange={setIsPublished}
            label="Published"
            hint="Drafts stay hidden from the public site."
          />

          <section className="border-t border-border pt-5">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-semibold text-foreground">
                Sections ({sections.length})
              </h3>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => setSections((s) => [...s, { body: "" }])}
              >
                <Plus size={12} /> Add section
              </Button>
            </div>

            <ul className="flex flex-col gap-4">
              {sections.map((section, i) => (
                <li key={i} className="border border-border rounded-sm p-3 flex flex-col gap-2.5">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-[10px] uppercase tracking-[0.15em] text-muted-foreground font-medium">
                      Section {i + 1}
                    </span>
                    <div className="flex items-center gap-0.5">
                      <button
                        onClick={() => moveSection(i, -1)}
                        disabled={i === 0}
                        aria-label="Move section up"
                        className="p-1.5 text-muted-foreground hover:text-foreground disabled:opacity-30 rounded-sm"
                      >
                        <ArrowUp size={13} />
                      </button>
                      <button
                        onClick={() => moveSection(i, 1)}
                        disabled={i === sections.length - 1}
                        aria-label="Move section down"
                        className="p-1.5 text-muted-foreground hover:text-foreground disabled:opacity-30 rounded-sm"
                      >
                        <ArrowDown size={13} />
                      </button>
                      <button
                        onClick={() => setSections((s) => s.filter((_, idx) => idx !== i))}
                        disabled={sections.length === 1}
                        aria-label="Remove section"
                        className="p-1.5 text-muted-foreground hover:text-primary disabled:opacity-30 rounded-sm"
                      >
                        <Trash2 size={13} />
                      </button>
                    </div>
                  </div>

                  <TextInput
                    value={section.heading ?? ""}
                    onChange={(e) => updateSection(i, { heading: e.target.value })}
                    placeholder="Heading (optional — leave blank for an intro paragraph)"
                  />
                  <TextArea
                    rows={6}
                    value={section.body}
                    onChange={(e) => updateSection(i, { body: e.target.value })}
                    placeholder="Body text…"
                  />
                </li>
              ))}
            </ul>
          </section>

          {guide && (
            <section className="border-t border-border pt-5">
              {confirmDelete ? (
                <div className="flex flex-col gap-2">
                  <p className="text-sm text-muted-foreground leading-relaxed">
                    Delete “{guide.title}” permanently?
                  </p>
                  <div className="flex gap-2">
                    <Button
                      variant="danger"
                      size="sm"
                      disabled={saving}
                      onClick={async () => {
                        setSaving(true);
                        try {
                          await deleteGuide(guide.id);
                          onSaved();
                        } catch (err) {
                          setError(err instanceof Error ? err.message : "Could not delete.");
                          setSaving(false);
                        }
                      }}
                    >
                      Yes, delete
                    </Button>
                    <Button variant="ghost" size="sm" onClick={() => setConfirmDelete(false)}>
                      Cancel
                    </Button>
                  </div>
                </div>
              ) : (
                <Button variant="danger" size="sm" onClick={() => setConfirmDelete(true)}>
                  <Trash2 size={13} /> Delete guide
                </Button>
              )}
            </section>
          )}
        </div>

        <div
          className="px-5 sm:px-6 py-4 border-t border-border sticky bottom-0 bg-background flex gap-2"
          style={{ paddingBottom: "max(1rem, env(safe-area-inset-bottom))" }}
        >
          <Button variant="ghost" onClick={onClose} className="flex-1">
            Cancel
          </Button>
          <Button variant="primary" onClick={handleSave} disabled={saving} className="flex-1">
            {saving && <Loader2 size={14} className="animate-spin" />}
            {guide ? "Save changes" : "Create guide"}
          </Button>
        </div>
      </div>
    </div>
  );
}
