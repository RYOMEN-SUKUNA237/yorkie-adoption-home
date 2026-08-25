import { listGuides } from "../../services/guides";
import { useAsync } from "../../hooks/useAsync";
import { useRouter } from "../router";

export default function GuidesPage() {
  const { navigate } = useRouter();
  const { data: guides, loading, error } = useAsync(() => listGuides(), []);

  return (
    <main className="min-h-screen bg-background">
      <div className="px-6 md:px-16 lg:px-24 pt-14 pb-6">
        <p className="text-[11px] tracking-[0.25em] uppercase text-accent font-medium mb-3">
          Owner guides
        </p>
        <h1
          className="text-4xl lg:text-5xl font-light text-foreground mb-4 leading-tight max-w-xl"
          style={{ fontFamily: "'Newsreader', Georgia, serif" }}
        >
          Living with a Yorkshire Terrier
        </h1>
        <p className="text-base text-muted-foreground max-w-lg leading-relaxed">
          Coat, teeth, fragility and temperament — the four things new Yorkshire Terrier owners most often wish they had known first. Written for our adopters; available to everyone.
        </p>
      </div>

      <div className="px-6 md:px-16 lg:px-24 pt-10 pb-24">
        {loading && <p className="text-muted-foreground text-sm py-12">Loading guides…</p>}
        {error && (
          <p className="text-muted-foreground text-sm py-12">
            We could not load the guides just now. Please refresh the page.
          </p>
        )}
        <div className="flex flex-col divide-y divide-border">
          {(guides ?? []).map((guide) => (
            <article
              key={guide.id}
              className="py-8 group cursor-pointer"
              onClick={() => navigate(`/guides/${guide.slug}`)}
              role="link"
              tabIndex={0}
              onKeyDown={(e) => e.key === "Enter" && navigate(`/guides/${guide.slug}`)}
            >
              <div className="flex items-start justify-between gap-6">
                <div className="flex-1 min-w-0">
                  <h2
                    className="text-xl font-medium text-foreground mb-2 group-hover:text-accent transition-colors"
                    style={{ fontFamily: "'Newsreader', Georgia, serif" }}
                  >
                    {guide.title}
                  </h2>
                  <p className="text-sm text-muted-foreground leading-relaxed max-w-2xl">
                    {guide.summary}
                  </p>
                  <div className="flex items-center gap-4 mt-3 text-xs text-muted-foreground">
                    <span>{formatDate(guide.publishedDate)}</span>
                    <span>·</span>
                    <span>{guide.readingTimeMin} min read</span>
                  </div>
                </div>
                <span className="text-muted-foreground group-hover:text-accent transition-colors shrink-0 mt-1 text-lg">
                  →
                </span>
              </div>
            </article>
          ))}
        </div>
      </div>
    </main>
  );
}

function formatDate(dateStr: string) {
  return new Date(dateStr).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}
