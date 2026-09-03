import { getGuideBySlug } from "../../services/guides";
import { useAsync } from "../../hooks/useAsync";
import { useRouter } from "../router";
import { ChevronLeft } from "lucide-react";
import { useSettings } from "../../lib/settings";
import { settingString } from "../../services/misc";

export default function GuideDetailPage({ slug }: { slug: string }) {
  const { navigate } = useRouter();
  const { data: guide, loading } = useAsync(() => getGuideBySlug(slug), [slug]);
  const { settings } = useSettings();
  const contactEmail = settingString(settings, "contact_email", "support@yorkieadoptionhome.com");
  const whatsappNumber = settingString(settings, "whatsapp_number", "18587986768");
  const whatsAppHref = `https://wa.me/${whatsappNumber.replace(/\D/g, "")}`;

  if (loading) {
    return (
      <main className="min-h-screen px-6 md:px-16 lg:px-24 pt-20">
        <p className="text-muted-foreground text-sm">Loading…</p>
      </main>
    );
  }

  if (!guide) {
    return (
      <main className="min-h-screen px-6 md:px-16 lg:px-24 pt-20">
        <p className="text-muted-foreground">Guide not found.</p>
        <button onClick={() => navigate("/guides")} className="mt-4 text-sm underline">
          Back to guides
        </button>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-background pb-24">
      <div className="px-6 md:px-16 lg:px-24 pt-8">
        <button
          onClick={() => navigate("/guides")}
          className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded-sm mb-10"
        >
          <ChevronLeft size={14} />
          All guides
        </button>
      </div>

      <article className="px-6 md:px-16 lg:px-24">
        {/* Article header */}
        <div className="max-w-2xl mb-12">
          <p className="text-[11px] tracking-[0.25em] uppercase text-accent font-medium mb-4">
            Owner guide
          </p>
          <h1
            className="text-4xl lg:text-5xl font-light text-foreground mb-6 leading-tight"
            style={{ fontFamily: "'Newsreader', Georgia, serif" }}
          >
            {guide.title}
          </h1>
          <p className="text-lg text-muted-foreground leading-relaxed mb-6">
            {guide.summary}
          </p>
          <div className="flex items-center gap-4 text-xs text-muted-foreground pb-6 border-b border-border">
            <span>Yorkshire Adoption Home</span>
            <span>·</span>
            <span>{formatDate(guide.publishedDate)}</span>
            <span>·</span>
            <span>{guide.readingTimeMin} min read</span>
          </div>
        </div>

        {/* Article body */}
        <div className="max-w-[68ch] flex flex-col gap-8">
          {guide.sections.map((section, i) => (
            <div key={i}>
              {section.heading && (
                <h2
                  className="text-xl font-medium text-foreground mb-3"
                  style={{ fontFamily: "'Newsreader', Georgia, serif" }}
                >
                  {section.heading}
                </h2>
              )}
              <p className="text-base text-foreground leading-[1.85] text-muted-foreground">
                {section.body}
              </p>
            </div>
          ))}
        </div>

        {/* Footer */}
        <div className="max-w-[68ch] mt-16 pt-8 border-t border-border">
          <p className="text-sm text-muted-foreground mb-4">
            Questions about this guide? Reach us on WhatsApp or email.
          </p>
          <div className="flex flex-wrap gap-4">
            <a
              href={whatsAppHref}
              className="text-sm font-medium text-accent hover:text-foreground transition-colors underline underline-offset-2"
              target="_blank"
              rel="noopener noreferrer"
            >
              WhatsApp
            </a>
            <a
              href={`mailto:${contactEmail}`}
              className="text-sm font-medium text-accent hover:text-foreground transition-colors underline underline-offset-2"
            >
              {contactEmail}
            </a>
          </div>
        </div>
      </article>
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
