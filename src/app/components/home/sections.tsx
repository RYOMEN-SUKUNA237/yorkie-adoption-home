import type { ReactNode } from "react";
import { ArrowRight, Quote } from "lucide-react";
import { SmartImage } from "../SmartImage";
import type { Guide, Puppy } from "../../../lib/models";

/**
 * Home-page sections that need more than a paragraph of markup.
 *
 * Kept out of Home.tsx so that file stays a readable outline of the page
 * rather than four hundred lines of nested divs.
 */

// ---------------------------------------------------------------------
// Credentials band
// ---------------------------------------------------------------------

/**
 * Four concrete numbers, directly under the hero.
 *
 * Every breeder's site claims to be careful. Numbers a visitor can check
 * against the rest of the site — the twelve-week minimum, the litter
 * count — do more than another paragraph saying so.
 */
export function CredentialsBand({ available }: { available: number }) {
  const facts: Array<{ figure: string; label: string }> = [
    { figure: "20", label: "years with the breed" },
    { figure: "1–2", label: "litters a year" },
    { figure: "12", label: "weeks minimum before leaving" },
    {
      figure: String(available),
      label: available === 1 ? "puppy available now" : "puppies available now",
    },
  ];

  return (
    <section className="border-b border-border bg-background">
      <div className="px-6 md:px-16 lg:px-24 py-10 grid grid-cols-2 lg:grid-cols-4 gap-y-8 gap-x-6">
        {facts.map((fact) => (
          <div key={fact.label} className="text-center lg:text-left">
            <p
              className="text-3xl sm:text-4xl font-light text-foreground leading-none mb-2"
              style={{ fontFamily: "'Newsreader', Georgia, serif" }}
            >
              {fact.figure}
            </p>
            <p className="text-xs text-muted-foreground leading-snug max-w-[16ch] mx-auto lg:mx-0">
              {fact.label}
            </p>
          </div>
        ))}
      </div>
    </section>
  );
}

// ---------------------------------------------------------------------
// Where they are now
// ---------------------------------------------------------------------

/**
 * The placed puppies, given a proper section.
 *
 * These already carry the warmest writing on the site — Barnaby and his
 * windowsill, Clover outranked by a cat — but they were only visible as
 * greyed-out cards behind a filter. Shown as short dispatches from homes
 * that worked out, they do more for a hesitant applicant than any
 * assurance we could write about ourselves.
 */
export function WhereTheyAreNow({ placed }: { placed: Puppy[] }) {
  if (placed.length === 0) return null;

  return (
    <section className="bg-[#23282F] py-20 px-6 md:px-16 lg:px-24">
      <div className="mb-10">
        <p className="text-[11px] tracking-[0.25em] uppercase text-[#5C7A99] font-medium mb-2">
          Where they are now
        </p>
        <h2
          className="text-3xl font-light text-[#F7F5F2] max-w-lg leading-snug"
          style={{ fontFamily: "'Newsreader', Georgia, serif" }}
        >
          Dogs we have placed, and how they got on.
        </h2>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {placed.slice(0, 3).map((puppy) => (
          <figure
            key={puppy.id}
            className="bg-[#2E3A47] rounded-lg overflow-hidden flex flex-col group"
          >
            <SmartImage
              src={puppy.photos[0]}
              alt={`${puppy.name}, a ${puppy.sex === "male" ? "male" : "female"} Yorkshire Terrier we placed`}
              loading="lazy"
              wrapperClassName="aspect-[5/4]"
              className="w-full h-full object-cover transition-transform duration-[1200ms] group-hover:scale-105"
            />
            <figcaption className="p-5 flex flex-col gap-3 flex-1">
              <Quote size={15} className="text-[#B8873F] shrink-0" aria-hidden="true" />
              <p className="text-sm text-[#C9D0D8] leading-relaxed flex-1">
                {puppy.temperamentNotes}
              </p>
              <p
                className="text-[#F7F5F2] text-base pt-1"
                style={{ fontFamily: "'Newsreader', Georgia, serif" }}
              >
                {puppy.name}
              </p>
            </figcaption>
          </figure>
        ))}
      </div>
    </section>
  );
}

// ---------------------------------------------------------------------
// Guides preview
// ---------------------------------------------------------------------

/**
 * Three guides on the home page.
 *
 * The guides are the most useful thing here for someone still deciding
 * whether this breed suits them, and they were reachable only from the
 * navigation. Surfacing them lets a visitor answer their own questions
 * before starting a form that takes ten minutes.
 */
export function GuidesPreview({
  guides,
  onOpen,
  onSeeAll,
}: {
  guides: Guide[];
  onOpen: (slug: string) => void;
  onSeeAll: () => void;
}) {
  if (guides.length === 0) return null;

  return (
    <section className="py-20 px-6 md:px-16 lg:px-24">
      <div className="mb-10 flex items-end justify-between gap-4 flex-wrap">
        <div>
          <p className="text-[11px] tracking-[0.25em] uppercase text-accent font-medium mb-2">
            Before you apply
          </p>
          <h2
            className="text-3xl font-light text-foreground max-w-md leading-snug"
            style={{ fontFamily: "'Newsreader', Georgia, serif" }}
          >
            What we wish every owner knew first.
          </h2>
        </div>
        <button
          onClick={onSeeAll}
          className="text-sm font-medium text-foreground underline underline-offset-4 decoration-border hover:decoration-foreground transition-all focus:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded-sm"
        >
          All guides →
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
        {guides.slice(0, 3).map((guide) => (
          <button
            key={guide.id}
            onClick={() => onOpen(guide.slug)}
            className="group text-left bg-card border border-border rounded-lg p-6 flex flex-col gap-3 transition-all duration-300 hover:border-accent/50 hover:-translate-y-1 hover:shadow-lg focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <span className="text-[10px] tracking-[0.15em] uppercase text-muted-foreground">
              {guide.readingTimeMin} min read
            </span>
            <h3
              className="text-lg text-foreground leading-snug group-hover:text-accent transition-colors"
              style={{ fontFamily: "'Newsreader', Georgia, serif" }}
            >
              {guide.title}
            </h3>
            <p className="text-sm text-muted-foreground leading-relaxed line-clamp-3 flex-1">
              {guide.summary}
            </p>
            <span className="inline-flex items-center gap-1.5 text-sm font-medium text-accent mt-1">
              Read
              <ArrowRight
                size={13}
                className="transition-transform group-hover:translate-x-1"
              />
            </span>
          </button>
        ))}
      </div>
    </section>
  );
}

// ---------------------------------------------------------------------
// Shared
// ---------------------------------------------------------------------

export function SectionEyebrow({ children }: { children: ReactNode }) {
  return (
    <p className="text-[11px] tracking-[0.25em] uppercase text-accent font-medium mb-2">
      {children}
    </p>
  );
}
