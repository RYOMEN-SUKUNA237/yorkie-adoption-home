import { useState } from "react";
import { getPuppyBySlug } from "../../services/puppies";
import { useAsync } from "../../hooks/useAsync";
import { useRouter } from "../router";
import { CheckCircle, Circle, ChevronLeft } from "lucide-react";

const STATUS_LABELS: Record<string, string> = {
  available: "Available",
  pending: "Pending review",
  placed: "Placed",
};

const STATUS_STYLES: Record<string, string> = {
  available: "bg-[#E8F0E9] text-[#2D6A35] border-[#B8D9BB]",
  pending: "bg-[#EDEFF2] text-[#3C5166] border-[#C3CEDB]",
  placed: "bg-[#F0F0F0] text-[#888888] border-[#D8D8D8]",
};

export default function PuppyDetailPage({ slug }: { slug: string }) {
  const { navigate } = useRouter();
  const { data: puppy, loading } = useAsync(() => getPuppyBySlug(slug), [slug]);
  const [photoIdx, setPhotoIdx] = useState(0);

  if (loading) {
    return (
      <main className="min-h-screen px-6 md:px-16 lg:px-24 pt-20 pb-20">
        <p className="text-muted-foreground text-sm">Loading…</p>
      </main>
    );
  }

  if (!puppy) {
    return (
      <main className="min-h-screen px-6 md:px-16 lg:px-24 pt-20 pb-20">
        <p className="text-muted-foreground">Puppy not found.</p>
        <button onClick={() => navigate("/puppies")} className="mt-4 text-sm underline">
          Back to all puppies
        </button>
      </main>
    );
  }

  const dob = new Date(puppy.dateOfBirth).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });

  return (
    <main className="min-h-screen bg-background pb-24">
      {/* Breadcrumb */}
      <div className="px-6 md:px-16 lg:px-24 pt-8">
        <button
          onClick={() => navigate("/puppies")}
          className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded-sm"
        >
          <ChevronLeft size={14} />
          All puppies
        </button>
      </div>

      <div className="px-6 md:px-16 lg:px-24 pt-8">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 lg:gap-16 max-w-6xl">
          {/* Gallery */}
          <div className="flex flex-col gap-3">
            <div className="relative aspect-[4/5] bg-muted rounded-sm overflow-hidden">
              <img
                src={puppy.photos[photoIdx]}
                alt={`${puppy.name}, a ${puppy.sex} Yorkshire Terrier puppy`}
                className="w-full h-full object-cover"
              />
              <div
                className={`absolute top-4 right-4 text-[11px] font-medium tracking-wide px-2 py-1 rounded-sm border ${STATUS_STYLES[puppy.status]}`}
              >
                {STATUS_LABELS[puppy.status]}
              </div>
            </div>
            {puppy.photos.length > 1 && (
              <div className="flex gap-2">
                {puppy.photos.map((photo, i) => (
                  <button
                    key={i}
                    onClick={() => setPhotoIdx(i)}
                    className={`w-16 h-16 rounded-sm overflow-hidden border-2 transition-colors ${
                      i === photoIdx ? "border-accent" : "border-transparent"
                    } focus:outline-none focus-visible:ring-2 focus-visible:ring-ring`}
                    aria-label={`View photo ${i + 1}`}
                  >
                    <img src={photo} alt="" className="w-full h-full object-cover" />
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Info */}
          <div className="flex flex-col gap-8">
            <div>
              <h1
                className="text-4xl font-light text-foreground mb-2"
                style={{ fontFamily: "'Newsreader', Georgia, serif" }}
              >
                {puppy.name}
              </h1>
              <div className="flex flex-wrap items-center gap-3 text-sm text-muted-foreground mb-4">
                <span>{puppy.sex === "male" ? "Male" : "Female"}</span>
                <span>·</span>
                <span>{puppy.ageWeeks} weeks old</span>
                <span>·</span>
                <span>Born {dob}</span>
              </div>
              <div className="flex flex-wrap gap-1.5 mb-5">
                {puppy.temperamentTags.map((tag) => (
                  <span
                    key={tag}
                    className="text-[11px] tracking-wide uppercase font-medium text-accent border border-accent/30 px-2 py-0.5 rounded-sm"
                  >
                    {tag}
                  </span>
                ))}
              </div>
              <p className="text-sm text-muted-foreground leading-[1.8]">{puppy.temperamentNotes}</p>
            </div>

            {/* Apply CTA */}
            {puppy.status !== "placed" && (
              <button
                onClick={() => navigate(`/apply?puppy=${puppy.slug}`)}
                className="w-full bg-primary text-primary-foreground py-4 text-sm font-medium tracking-wide rounded-sm hover:bg-[#A0752F] transition-colors duration-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                Apply for {puppy.name}
              </button>
            )}

            {/* Vaccination checklist */}
            <div>
              <h2 className="text-xs tracking-[0.2em] uppercase font-medium text-muted-foreground mb-4">
                Vaccinations
              </h2>
              <div className="flex flex-col gap-3">
                {puppy.vaccinations.map((v, i) => (
                  <div key={i} className="flex items-start gap-3">
                    {v.done ? (
                      <CheckCircle size={16} className="text-[#2D6A35] mt-0.5 shrink-0" />
                    ) : (
                      <Circle size={16} className="text-muted-foreground mt-0.5 shrink-0" />
                    )}
                    <div>
                      <p className="text-sm font-medium text-foreground">{v.name}</p>
                      <p className="text-xs text-muted-foreground">
                        {v.done ? `Administered ${formatDate(v.date)}` : `Due ${formatDate(v.due || v.date)}`}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Deworming */}
            <div>
              <h2 className="text-xs tracking-[0.2em] uppercase font-medium text-muted-foreground mb-4">
                Deworming
              </h2>
              <div className="flex flex-col gap-2">
                {puppy.dewormings.map((d, i) => (
                  <div key={i} className="flex items-center justify-between text-sm">
                    <span className="text-foreground">{d.product}</span>
                    <span className="text-muted-foreground text-xs">{formatDate(d.date)}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Parents */}
            <div>
              <h2 className="text-xs tracking-[0.2em] uppercase font-medium text-muted-foreground mb-4">
                Parent health testing
              </h2>
              {[
                { role: "Sire", parent: puppy.parents.sire },
                { role: "Dam", parent: puppy.parents.dam },
              ].map(({ role, parent }) => (
                <div key={role} className="mb-5">
                  <p className="text-xs text-muted-foreground uppercase tracking-wide mb-1">{role}</p>
                  <p
                    className="text-base font-medium text-foreground mb-3"
                    style={{ fontFamily: "'Newsreader', Georgia, serif" }}
                  >
                    {parent.name}
                  </p>
                  <div className="flex flex-col gap-2">
                    {parent.healthTests.map((ht, i) => (
                      <div key={i} className="flex items-start gap-2 text-sm">
                        <CheckCircle size={14} className="text-accent mt-0.5 shrink-0" />
                        <span className="text-muted-foreground">
                          {ht.test}{" "}
                          <span className="text-foreground font-medium">— {ht.result}</span>
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}

function formatDate(dateStr: string) {
  return new Date(dateStr).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}
