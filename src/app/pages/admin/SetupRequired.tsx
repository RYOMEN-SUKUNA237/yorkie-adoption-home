import { Database, ArrowLeft } from "lucide-react";
import { useRouter } from "../../router";
import { Button } from "../../components/admin/ui";

const STEPS: Array<{ title: string; detail: string; code?: string }> = [
  {
    title: "Create a Supabase project",
    detail: "supabase.com → New project. Any region; the free tier is enough to start.",
  },
  {
    title: "Run the migrations",
    detail:
      "Open the SQL Editor and run each file in supabase/migrations in numerical order, then supabase/seed.sql to load the sample puppies and guides.",
    code: "0001_schema → 0002_functions → 0003_rls → 0004_storage → 0005_realtime → seed.sql",
  },
  {
    title: "Enable anonymous sign-ins",
    detail:
      "Authentication → Providers → Anonymous. The floating messenger uses this to give each visitor an identity that row-level security can scope their thread to.",
  },
  {
    title: "Add your credentials",
    detail:
      "Copy .env.example to .env.local and paste in the Project URL and anon key from Project Settings → API. Restart the dev server afterwards.",
    code: "VITE_SUPABASE_URL=…\nVITE_SUPABASE_ANON_KEY=…",
  },
  {
    title: "Create your admin account",
    detail:
      "Authentication → Users → Add user (with a password). The first account created becomes the admin automatically; everyone after that is staff until you promote them here in Settings.",
  },
];

/** Shown in place of the dashboard when no Supabase credentials are present. */
export default function SetupRequired() {
  const { navigate } = useRouter();

  return (
    <div className="min-h-screen bg-sidebar px-5 py-12 sm:py-16">
      <div className="max-w-2xl mx-auto">
        <div className="bg-background border border-border rounded-md p-6 sm:p-10">
          <div className="flex items-center gap-3 mb-6">
            <span className="w-10 h-10 rounded-sm bg-secondary flex items-center justify-center shrink-0">
              <Database size={18} className="text-accent" />
            </span>
            <div>
              <p className="text-[11px] tracking-[0.2em] uppercase text-muted-foreground font-medium">
                Setup required
              </p>
              <h1
                className="text-xl font-light text-foreground"
                style={{ fontFamily: "'Newsreader', Georgia, serif" }}
              >
                Connect the database
              </h1>
            </div>
          </div>

          <p className="text-sm text-muted-foreground leading-relaxed mb-8">
            The public site is running on the bundled sample content, so you can browse it as it
            will look. Applications, messages and this dashboard need a Supabase project before
            anything is stored.
          </p>

          <ol className="flex flex-col gap-6 mb-8">
            {STEPS.map((step, i) => (
              <li key={step.title} className="flex gap-4">
                <span className="shrink-0 w-6 h-6 rounded-full border border-border text-xs font-medium text-muted-foreground flex items-center justify-center mt-0.5">
                  {i + 1}
                </span>
                <div className="min-w-0">
                  <p className="text-sm font-medium text-foreground mb-1">{step.title}</p>
                  <p className="text-sm text-muted-foreground leading-relaxed">{step.detail}</p>
                  {step.code && (
                    <pre className="mt-2 text-xs bg-secondary text-secondary-foreground rounded-sm px-3 py-2 overflow-x-auto whitespace-pre-wrap break-words">
                      {step.code}
                    </pre>
                  )}
                </div>
              </li>
            ))}
          </ol>

          <div className="border-t border-border pt-6 flex flex-wrap gap-2">
            <Button variant="secondary" onClick={() => navigate("/")}>
              <ArrowLeft size={14} /> Back to the site
            </Button>
            <a
              href="https://supabase.com/dashboard"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center justify-center gap-1.5 text-sm font-medium border border-transparent bg-primary text-primary-foreground rounded-sm px-4 py-2 hover:bg-[#A0752F] transition-colors"
            >
              Open Supabase
            </a>
          </div>
        </div>

        <p className="text-xs text-muted-foreground text-center mt-6 leading-relaxed">
          Full instructions, including the schema walkthrough, are in{" "}
          <code className="text-foreground">supabase/README.md</code>.
        </p>
      </div>
    </div>
  );
}
