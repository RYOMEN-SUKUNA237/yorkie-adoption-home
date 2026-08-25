import { createClient, type SupabaseClient } from "@supabase/supabase-js";

const url = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;

/**
 * Whether the app has real credentials.
 *
 * The site is designed to run without them: every service falls back to the
 * bundled sample content so `npm run dev` works on a fresh clone, and the
 * dashboard shows a setup panel instead of a login form. Check this before
 * assuming `supabase` is non-null.
 */
export const isSupabaseConfigured = Boolean(
  url && anonKey && !url.includes("your-project-ref") && !anonKey.includes("your-anon")
);

export const AUTH_STORAGE_KEY = "yah-auth";

/**
 * Fetch wrapper that keeps a broken session from breaking the public site.
 *
 * Supabase attaches whatever session it holds to every request. If that
 * token is unusable — expired past refresh, revoked, or issued against a
 * clock that disagrees with the server's — PostgREST rejects the request
 * with 401 / PGRST303. Without this, a stale login makes the puppy list and
 * the guides go blank for a visitor who never needed to be signed in at all.
 *
 * Public content is readable by `anon`, so on that specific failure we retry
 * once with the anon key. Genuine permission errors (a visitor reaching for
 * the applications table) return 401 with a different code and are passed
 * straight through.
 */
const resilientFetch: typeof fetch = async (input, init) => {
  const response = await fetch(input, init);

  if (response.status !== 401 || !anonKey) return response;

  let code: string | undefined;
  let message: string | undefined;
  try {
    const body = await response.clone().json();
    code = body?.code ?? body?.error_code;
    message = body?.message;
  } catch {
    return response; // not JSON — nothing to interpret
  }

  const tokenIsBad = code === "PGRST303" || message === "JWT expired";
  if (!tokenIsBad) return response;

  console.warn(
    "[supabase] the stored session was rejected (%s). Retrying as an anonymous visitor.",
    message ?? code
  );

  const headers = new Headers(init?.headers as HeadersInit | undefined);
  headers.set("Authorization", `Bearer ${anonKey}`);
  headers.set("apikey", anonKey);

  return fetch(input, { ...init, headers });
};

export const supabase: SupabaseClient | null = isSupabaseConfigured
  ? createClient(url!, anonKey!, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
        storageKey: AUTH_STORAGE_KEY,
      },
      realtime: {
        params: { eventsPerSecond: 10 },
      },
      global: {
        headers: { "x-application-name": "yorkshire-adoption-home" },
        fetch: resilientFetch,
      },
    })
  : null;

/** Discard a session the server will not accept, so the client starts clean. */
export function clearStoredSession(): void {
  try {
    window.localStorage.removeItem(AUTH_STORAGE_KEY);
  } catch {
    /* private mode — nothing to clear */
  }
}

/**
 * Narrowing helper for services that cannot work without a backend.
 * Throws rather than returning null so callers get one clear error instead
 * of a cascade of `Cannot read property of null`.
 */
export function requireSupabase(): SupabaseClient {
  if (!supabase) {
    throw new Error(
      "Supabase is not configured. Copy .env.example to .env.local and set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY."
    );
  }
  return supabase;
}

export const SITE_NAME =
  (import.meta.env.VITE_SITE_NAME as string | undefined) || "Yorkshire Adoption Home";
