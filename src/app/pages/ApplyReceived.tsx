import { useRouter } from "../router";
import { useSettings } from "../../lib/settings";
import { settingString } from "../../services/misc";

const timeline = (slaDays: string) => [
  { label: "Application received", detail: "We have your application and will read it in full.", done: true },
  { label: "We review", detail: `Every application is read carefully. This takes up to ${slaDays} days.`, done: false },
  { label: "You hear from us", detail: "We will email and WhatsApp you with our decision or a request to speak.", done: false },
  { label: "Further verification (if shortlisted)", detail: "We follow up to confirm a few details and get to know your household before we match a puppy to it.", done: false },
  { label: "Visiting day", detail: "If we proceed, we arrange a time for you to meet the puppy.", done: false },
];

export default function ApplyReceivedPage() {
  const { navigate, getParam } = useRouter();
  const { settings } = useSettings();
  const reference = getParam("ref");
  const slaDays = settingString(settings, "review_sla_days", "14");

  return (
    <main className="min-h-screen bg-background">
      <div className="max-w-xl mx-auto px-6 pt-20 pb-24">
        <div className="mb-10">
          <p className="text-[11px] tracking-[0.25em] uppercase text-accent font-medium mb-3">
            Application received
          </p>
          <h1
            className="text-4xl font-light text-foreground mb-4 leading-tight"
            style={{ fontFamily: "'Newsreader', Georgia, serif" }}
          >
            Thank you.
          </h1>
          <p className="text-base text-muted-foreground leading-relaxed mb-6">
            We have received your application. We read every submission carefully — this takes time, and we ask for your patience.
          </p>

          {reference && (
            <div className="border border-border rounded-sm px-4 py-3 inline-flex flex-col">
              <span className="text-[10px] tracking-[0.2em] uppercase text-muted-foreground font-medium mb-1">
                Your reference
              </span>
              <span
                className="text-lg text-foreground"
                style={{ fontFamily: "'Newsreader', Georgia, serif" }}
              >
                {reference}
              </span>
            </div>
          )}
        </div>

        <div className="mb-12">
          <h2 className="text-xs tracking-[0.2em] uppercase font-medium text-muted-foreground mb-6">
            What happens next
          </h2>
          <div className="flex flex-col">
            {timeline(slaDays).map((item, i) => (
              <div key={i} className="flex gap-4">
                <div className="flex flex-col items-center">
                  <div
                    className={`w-5 h-5 rounded-full border-2 flex items-center justify-center shrink-0 ${
                      item.done
                        ? "border-accent bg-accent"
                        : "border-border bg-background"
                    }`}
                  >
                    {item.done && <div className="w-2 h-2 rounded-full bg-accent-foreground" />}
                  </div>
                  {i < timeline(slaDays).length - 1 && (
                    <div className="w-px flex-1 bg-border mt-1 mb-1 min-h-[2rem]" />
                  )}
                </div>
                <div className="pb-6">
                  <p className={`text-sm font-medium mb-1 ${item.done ? "text-accent" : "text-foreground"}`}>
                    {item.label}
                  </p>
                  <p className="text-sm text-muted-foreground leading-relaxed">{item.detail}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="border border-border rounded-sm p-5 mb-8">
          <p className="text-sm text-foreground leading-relaxed mb-1 font-medium">
            Not every application is accepted.
          </p>
          <p className="text-sm text-muted-foreground leading-relaxed">
            We will tell you our decision, and we will tell you honestly. If we cannot proceed, we will say so clearly — we will not keep you waiting indefinitely.
          </p>
        </div>

        <button
          onClick={() => navigate("/")}
          className="text-sm font-medium text-muted-foreground underline underline-offset-4 hover:text-foreground transition-colors"
        >
          ← Return to home
        </button>
      </div>
    </main>
  );
}
