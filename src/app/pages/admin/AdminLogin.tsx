import { useState } from "react";
import { Loader2, ArrowLeft } from "lucide-react";
import { useAuth } from "../../../lib/auth";
import { useRouter } from "../../router";
import { Button, Field, TextInput } from "../../components/admin/ui";

/**
 * Dashboard sign-in.
 *
 * `signedInButNotStaff` covers the case where a session exists but carries
 * no profiles row — most often an anonymous messenger visitor who navigated
 * to /admin. They need signing out, not another password prompt.
 */
export default function AdminLogin({ signedInButNotStaff = false }: { signedInButNotStaff?: boolean }) {
  const { signIn, signOut, resetPassword } = useAuth();
  const { navigate } = useRouter();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [mode, setMode] = useState<"signin" | "reset">("signin");
  const [resetSent, setResetSent] = useState(false);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setBusy(true);
    setError(null);

    try {
      if (mode === "reset") {
        await resetPassword(email);
        setResetSent(true);
      } else {
        await signIn(email, password);
        // AuthProvider picks up the session; the layout re-renders itself.
      }
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message.replace("Invalid login credentials", "That email and password do not match.")
          : "Could not sign in."
      );
    } finally {
      setBusy(false);
    }
  };

  if (signedInButNotStaff) {
    return (
      <Shell>
        <h1
          className="text-2xl font-light text-foreground mb-3"
          style={{ fontFamily: "'Newsreader', Georgia, serif" }}
        >
          This account has no dashboard access.
        </h1>
        <p className="text-sm text-muted-foreground leading-relaxed mb-6">
          You are signed in, but the account is not a staff account. If you were expecting access,
          ask an administrator to add you to the team in Settings.
        </p>
        <div className="flex flex-col gap-2">
          <Button variant="primary" onClick={() => void signOut()}>
            Sign out and use another account
          </Button>
          <Button variant="ghost" onClick={() => navigate("/")}>
            <ArrowLeft size={14} /> Back to the site
          </Button>
        </div>
      </Shell>
    );
  }

  return (
    <Shell>
      <p className="text-[11px] tracking-[0.25em] uppercase text-accent font-medium mb-3">
        Yorkshire Adoption Home
      </p>
      <h1
        className="text-3xl font-light text-foreground mb-2"
        style={{ fontFamily: "'Newsreader', Georgia, serif" }}
      >
        {mode === "reset" ? "Reset your password" : "Dashboard sign in"}
      </h1>
      <p className="text-sm text-muted-foreground leading-relaxed mb-8">
        {mode === "reset"
          ? "We will email you a link to set a new password."
          : "This area is for the breeder and staff. Applicants do not need an account."}
      </p>

      {resetSent ? (
        <div className="flex flex-col gap-4">
          <p className="text-sm text-foreground leading-relaxed">
            If an account exists for <strong>{email}</strong>, a reset link is on its way.
          </p>
          <Button
            variant="secondary"
            onClick={() => {
              setMode("signin");
              setResetSent(false);
            }}
          >
            Back to sign in
          </Button>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <Field label="Email">
            <TextInput
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              autoComplete="email"
              autoFocus
              placeholder="you@example.com"
            />
          </Field>

          {mode === "signin" && (
            <Field label="Password">
              <TextInput
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                autoComplete="current-password"
                placeholder="••••••••"
              />
            </Field>
          )}

          {error && (
            <p className="text-sm text-primary leading-relaxed" role="alert">
              {error}
            </p>
          )}

          <Button type="submit" variant="primary" disabled={busy} className="w-full py-3 mt-1">
            {busy && <Loader2 size={15} className="animate-spin" />}
            {mode === "reset" ? "Send reset link" : "Sign in"}
          </Button>

          <div className="flex items-center justify-between text-xs pt-1">
            <button
              type="button"
              onClick={() => {
                setMode(mode === "signin" ? "reset" : "signin");
                setError(null);
              }}
              className="text-muted-foreground hover:text-foreground underline underline-offset-4 transition-colors"
            >
              {mode === "signin" ? "Forgot your password?" : "Back to sign in"}
            </button>
            <button
              type="button"
              onClick={() => navigate("/")}
              className="text-muted-foreground hover:text-foreground transition-colors"
            >
              Back to the site
            </button>
          </div>
        </form>
      )}
    </Shell>
  );
}

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-sidebar flex items-center justify-center px-5 py-12">
      <div className="w-full max-w-sm bg-background border border-border rounded-md p-7 sm:p-9 shadow-sm">
        {children}
      </div>
    </div>
  );
}
