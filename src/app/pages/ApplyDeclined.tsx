import { useState } from "react";
import { useRouter } from "../router";
import { joinWaitlist } from "../../services/misc";

export default function ApplyDeclinedPage() {
  const { navigate } = useRouter();
  const [waitlistEmail, setWaitlistEmail] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleJoin = async () => {
    const email = waitlistEmail.trim();
    if (!email || busy) return;

    setBusy(true);
    setError(null);
    try {
      await joinWaitlist({ email, source: "declined-application" });
      setSubmitted(true);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "We could not add you just now. Please try again."
      );
    } finally {
      setBusy(false);
    }
  };

  return (
    <main className="min-h-screen bg-background">
      <div className="max-w-xl mx-auto px-6 pt-20 pb-24">
        <p className="text-[11px] tracking-[0.25em] uppercase text-muted-foreground font-medium mb-4">
          Application update
        </p>
        <h1
          className="text-4xl font-light text-foreground mb-6 leading-tight"
          style={{ fontFamily: "'Newsreader', Georgia, serif" }}
        >
          We are not able to proceed with your application.
        </h1>
        <p className="text-base text-muted-foreground leading-relaxed mb-4">
          We have considered your application carefully. On this occasion, we are not able to proceed.
        </p>
        <p className="text-sm text-muted-foreground leading-relaxed mb-12">
          We do not provide specific reasons for this decision. This is not a reflection on your character — it is a reflection of what we believe this particular dog needs at this particular time.
        </p>

        <div className="border-t border-border pt-8 mb-8">
          <h2
            className="text-xl font-light text-foreground mb-2"
            style={{ fontFamily: "'Newsreader', Georgia, serif" }}
          >
            Join the waiting list
          </h2>
          <p className="text-sm text-muted-foreground mb-5">
            If circumstances change, or a future litter may be a better match, we will reach out to people on our waiting list first.
          </p>
          {submitted ? (
            <p className="text-sm text-foreground font-medium">
              Added to the waiting list. We will be in touch if something changes.
            </p>
          ) : (
            <div className="flex flex-col gap-2">
              <div className="flex flex-col sm:flex-row gap-3">
                <input
                  type="email"
                  value={waitlistEmail}
                  onChange={(e) => setWaitlistEmail(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleJoin()}
                  placeholder="Your email address"
                  aria-label="Your email address"
                  className="flex-1 px-4 py-3 bg-input-background border border-border rounded-sm text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                />
                <button
                  onClick={handleJoin}
                  disabled={!waitlistEmail.trim() || busy}
                  className="px-5 py-3 bg-foreground text-background text-sm font-medium rounded-sm hover:bg-foreground/90 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-ring whitespace-nowrap disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {busy ? "Adding…" : "Join list"}
                </button>
              </div>
              {error && (
                <p className="text-sm text-primary" role="alert">
                  {error}
                </p>
              )}
            </div>
          )}
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
