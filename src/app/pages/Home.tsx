import { useEffect, useRef, useState, ReactNode } from "react";
import { listPuppies } from "../../services/puppies";
import { listGuides } from "../../services/guides";
import { useAsync } from "../../hooks/useAsync";
import {
  CredentialsBand,
  GuidesPreview,
  WhereTheyAreNow,
} from "../components/home/sections";
import { PuppyCard } from "../components/PuppyCard";
import { useRouter } from "../router";

function useFadeUp() {
  const ref = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      setVisible(true);
      return;
    }
    const el = ref.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      ([entry]) => { if (entry.isIntersecting) { setVisible(true); observer.disconnect(); } },
      { threshold: 0.12 }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  return { ref, visible };
}

function FadeUp({ children, delay = 0, className = "" }: { children: ReactNode; delay?: number; className?: string }) {
  const { ref, visible } = useFadeUp();
  return (
    <div
      ref={ref}
      className={`transition-all duration-700 ease-out ${visible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-5"} ${className}`}
      style={{ transitionDelay: `${delay}ms` }}
    >
      {children}
    </div>
  );
}

const PROCESS_STEPS = [
  { n: "01", label: "Apply", desc: "Complete our application. One form, one attempt to understand your household." },
  { n: "02", label: "We review", desc: "We read every application carefully. This takes up to two weeks." },
  { n: "03", label: "Further verification", desc: "Shortlisted applicants hear from us directly. We want to know you a little before your puppy does." },
  { n: "04", label: "Meet your puppy", desc: "If we proceed, we arrange a visit. The puppy will tell you the rest." },
];

const TRUST_PANELS = [
  {
    title: "Health-tested parents",
    body: "Patella evaluations, bile acid testing for liver shunt, cardiac clearances and DNA screening for PLL and PRA — the two conditions this breed is most often let down by. Every certificate is in your puppy's record.",
  },
  {
    title: "Twelve weeks, never sooner",
    body: "Yorkshire Terrier puppies are tiny, and the very small ones are fragile in ways that matter. Nothing leaves here before twelve weeks, eating reliably and holding weight — however keen anyone is.",
  },
  {
    title: "Lifetime return policy",
    body: "If at any point in your dog's life you cannot keep them, they come back to us. No questions beyond what we need to help the dog. No exceptions, and never a third-party rehoming.",
  },
];

export default function HomePage() {
  const { navigate } = useRouter();
  // Only the puppies a visitor can still act on belong in the teaser.
  const { data: puppies, error: puppiesError } = useAsync(() => listPuppies(), []);
  const { data: guides } = useAsync(() => listGuides(), []);
  if (puppiesError) console.warn("[home] could not load puppies:", puppiesError.message);

  const all = puppies ?? [];
  const teaserPuppies = all.filter((p) => p.status !== "placed").slice(0, 3);
  const placedPuppies = all.filter((p) => p.status === "placed");
  const availableCount = all.filter((p) => p.status === "available").length;

  return (
    <main>
      {/* Hero */}
      <section className="relative min-h-[92vh] flex items-end overflow-hidden bg-[#23282F]">
        <img
          src="https://images.unsplash.com/photo-1548927548-1a8bb9c7d5e7?w=1600&h=1200&fit=crop&auto=format"
          alt="A Yorkshire Terrier with a steel-blue and tan coat, photographed against a soft background"
          className="absolute inset-0 w-full h-full object-cover object-center hero-image"
          style={{ objectPosition: "60% center" }}
        />
        <div
          className="absolute inset-0"
          style={{
            background:
              "linear-gradient(105deg, rgba(21,27,46,0.88) 0%, rgba(21,27,46,0.6) 50%, rgba(21,27,46,0.2) 100%)",
          }}
        />

        <div className="relative w-full px-6 pb-16 pt-32 md:px-16 lg:px-24 max-w-5xl">
          <p
            className="text-[11px] tracking-[0.25em] uppercase text-[#5C7A99] font-medium mb-6"
          >
            Yorkshire Adoption Home
          </p>
          <h1
            className="text-4xl sm:text-5xl lg:text-6xl font-light text-[#F7F5F2] leading-[1.1] mb-6 max-w-2xl"
            style={{ fontFamily: "'Newsreader', Georgia, serif", fontVariationSettings: "'opsz' 72" }}
          >
            A small dog with<br />
            <em className="not-italic" style={{ fontStyle: "italic" }}>a very large opinion.</em>
          </h1>
          <p className="text-base text-[#D9DDE3] max-w-md leading-relaxed mb-10">
            One or two litters a year, raised in our kitchen. We screen every application — not because we distrust people, but because this breed is more demanding than its size suggests.
          </p>
          <button
            onClick={() => navigate("/apply")}
            className="inline-flex items-center gap-2 bg-[#B8873F] text-[#F7F5F2] px-8 py-4 text-sm font-medium tracking-wide rounded-sm hover:bg-[#A0752F] transition-colors duration-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#B8873F] focus-visible:ring-offset-2 focus-visible:ring-offset-[#23282F]"
          >
            Start an application
          </button>
        </div>
      </section>

      {/* Credentials */}
      <CredentialsBand available={availableCount} />

      {/* Process strip */}
      <section className="bg-[#23282F] py-16 px-6 md:px-16 lg:px-24">
        <FadeUp className="mb-10">
          <p className="text-[11px] tracking-[0.25em] uppercase text-[#5C7A99] font-medium mb-2">
            How it works
          </p>
          <h2
            className="text-2xl font-light text-[#F7F5F2]"
            style={{ fontFamily: "'Newsreader', Georgia, serif" }}
          >
            The adoption process
          </h2>
        </FadeUp>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-8">
          {PROCESS_STEPS.map((step, i) => (
            <FadeUp key={step.n} delay={i * 80}>
              <div className="flex flex-col gap-3">
                <span
                  className="text-4xl font-light text-[#5C7A99]/50"
                  style={{ fontFamily: "'Newsreader', Georgia, serif" }}
                >
                  {step.n}
                </span>
                <h3 className="text-base font-semibold text-[#F7F5F2] tracking-wide">
                  {step.label}
                </h3>
                <p className="text-sm text-[#9AA5B2] leading-relaxed">{step.desc}</p>
              </div>
            </FadeUp>
          ))}
        </div>
      </section>

      {/* Trust panels */}
      <section className="bg-background py-20 px-6 md:px-16 lg:px-24">
        <FadeUp className="mb-12">
          <p className="text-[11px] tracking-[0.25em] uppercase text-accent font-medium mb-2">
            Our commitments
          </p>
          <h2
            className="text-3xl font-light text-foreground"
            style={{ fontFamily: "'Newsreader', Georgia, serif" }}
          >
            What every puppy comes with
          </h2>
        </FadeUp>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 lg:gap-10">
          {TRUST_PANELS.map((panel, i) => (
            <FadeUp key={panel.title} delay={i * 100}>
              <div className="border-t border-border pt-8">
                <h3
                  className="text-xl font-medium text-foreground mb-4 leading-snug"
                  style={{ fontFamily: "'Newsreader', Georgia, serif" }}
                >
                  {panel.title}
                </h3>
                <p className="text-sm text-muted-foreground leading-relaxed">{panel.body}</p>
              </div>
            </FadeUp>
          ))}
        </div>
      </section>

      {/* Puppy teaser */}
      <section className="bg-secondary/30 py-20 px-6 md:px-16 lg:px-24">
        <FadeUp className="mb-10 flex items-end justify-between gap-4 flex-wrap">
          <div>
            <p className="text-[11px] tracking-[0.25em] uppercase text-accent font-medium mb-2">
              Current litter
            </p>
            <h2
              className="text-3xl font-light text-foreground"
              style={{ fontFamily: "'Newsreader', Georgia, serif" }}
            >
              Available puppies
            </h2>
          </div>
          <button
            onClick={() => navigate("/puppies")}
            className="text-sm font-medium text-foreground underline underline-offset-4 decoration-border hover:decoration-foreground transition-all"
          >
            See all →
          </button>
        </FadeUp>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {teaserPuppies.map((puppy, i) => (
            <FadeUp key={puppy.id} delay={i * 80}>
              <PuppyCard puppy={puppy} />
            </FadeUp>
          ))}
        </div>
      </section>

      {/* Guides */}
      <FadeUp>
        <GuidesPreview
          guides={guides ?? []}
          onOpen={(slug) => navigate(`/guides/${slug}`)}
          onSeeAll={() => navigate("/guides")}
        />
      </FadeUp>

      {/* Placed dogs */}
      <FadeUp>
        <WhereTheyAreNow placed={placedPuppies} />
      </FadeUp>

      {/* Closing CTA */}
      <section className="py-24 px-6 md:px-16 lg:px-24 text-center">
        <FadeUp>
          <p
            className="text-3xl sm:text-4xl font-light text-foreground mb-4 max-w-xl mx-auto leading-snug"
            style={{ fontFamily: "'Newsreader', Georgia, serif" }}
          >
            Not every application is accepted.
          </p>
          <p className="text-base text-muted-foreground mb-10 max-w-sm mx-auto">
            That is not a warning. It is how we protect the dogs we raise.
          </p>
          <button
            onClick={() => navigate("/apply")}
            className="inline-flex items-center gap-2 bg-primary text-primary-foreground px-8 py-4 text-sm font-medium tracking-wide rounded-sm hover:bg-[#A0752F] transition-colors duration-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            Start an application
          </button>
        </FadeUp>
      </section>
    </main>
  );
}
