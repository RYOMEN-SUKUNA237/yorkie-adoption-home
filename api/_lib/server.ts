/**
 * Shared server helpers for the functions in `api/`.
 *
 * Vercel skips any file or folder under `api/` whose name begins with an
 * underscore, so this module is importable from the handlers without itself
 * becoming a route.
 *
 * Nothing in here carries a fallback secret. The previous handlers inlined a
 * live Gmail app password and the Supabase publishable key as `||` defaults,
 * which put them in git history and meant a missing environment variable
 * failed silently instead of loudly.
 */

import { createClient, type SupabaseClient } from "@supabase/supabase-js";

export class ConfigError extends Error {
  constructor(name: string) {
    super(`Missing required environment variable: ${name}`);
    this.name = "ConfigError";
  }
}

export function required(name: string): string {
  const value = process.env[name];
  if (!value || !value.trim()) throw new ConfigError(name);
  return value.trim();
}

export function optional(name: string): string | undefined {
  const value = process.env[name];
  return value && value.trim() ? value.trim() : undefined;
}

/**
 * The public site origin. `VERCEL_URL` is the *deployment* host — a
 * per-deploy subdomain that nobody should receive in an email — so the
 * custom domain wins and `VERCEL_URL` is only a last resort.
 */
export function siteOrigin(): string {
  const configured = optional("PUBLIC_SITE_URL");
  if (configured) return configured.replace(/\/+$/, "");
  if (process.env.VERCEL_ENV === "production") return "https://www.yorkieadoptionhome.com";
  return process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : "http://localhost:5173";
}

/** Inboxes that receive operational alerts. Never a client-facing address. */
export function adminNotifyEmails(): string[] {
  const configured = optional("ADMIN_NOTIFY_EMAILS");
  if (configured) {
    return configured
      .split(/[,;\s]+/)
      .map((entry) => entry.trim())
      .filter((entry) => entry.includes("@"));
  }
  return ["ntuhgireseelezanw@gmail.com", "yannickngwa844@gmail.com"];
}

let cachedDb: SupabaseClient | null = null;

/**
 * Server-side Supabase client. Prefers the service-role key when present so
 * logging is not at the mercy of the public RLS policies; falls back to the
 * publishable key, which is enough for the insert-only policies.
 */
export function db(): SupabaseClient {
  if (cachedDb) return cachedDb;
  const url = optional("SUPABASE_URL") ?? required("VITE_SUPABASE_URL");
  const key = optional("SUPABASE_SERVICE_ROLE_KEY") ?? required("VITE_SUPABASE_ANON_KEY");
  cachedDb = createClient(url, key, { auth: { persistSession: false } });
  return cachedDb;
}

export interface SiteContact {
  siteName: string;
  siteUrl: string;
  contactEmail?: string;
  contactPhone?: string;
  whatsappNumber?: string;
}

let cachedContact: { at: number; value: SiteContact } | null = null;

/**
 * Contact details as the admin last saved them, so an email footer never
 * contradicts the site. Cached briefly because a single approval can fan out
 * into several sends and there is no reason to re-read the row each time.
 */
export async function siteContact(): Promise<SiteContact> {
  if (cachedContact && Date.now() - cachedContact.at < 60_000) return cachedContact.value;

  const fallback: SiteContact = {
    siteName: optional("VITE_SITE_NAME") ?? "Yorkshire Adoption Home",
    siteUrl: siteOrigin(),
    contactEmail: optional("FROM_EMAIL"),
  };

  try {
    const { data, error } = await db()
      .from("site_settings")
      .select("key, value")
      .in("key", ["site_name", "contact_email", "contact_phone", "whatsapp_number"]);

    if (error) throw error;

    const read = (key: string): string | undefined => {
      const row = data?.find((entry: { key: string }) => entry.key === key);
      if (!row) return undefined;
      const raw = (row as { value: unknown }).value;
      const text = typeof raw === "string" ? raw : String(raw ?? "");
      return text.trim() ? text.trim() : undefined;
    };

    const value: SiteContact = {
      siteName: read("site_name") ?? fallback.siteName,
      siteUrl: fallback.siteUrl,
      contactEmail: read("contact_email") ?? fallback.contactEmail,
      contactPhone: read("contact_phone"),
      whatsappNumber: read("whatsapp_number"),
    };

    cachedContact = { at: Date.now(), value };
    return value;
  } catch (err) {
    console.warn("[server] site_settings unavailable, using env fallbacks:", err);
    return fallback;
  }
}

// ---------------------------------------------------------------------
// HTTP plumbing
// ---------------------------------------------------------------------

export interface ApiRequest {
  method?: string;
  body?: unknown;
  headers: Record<string, string | string[] | undefined>;
}

export interface ApiResponse {
  status(code: number): ApiResponse;
  json(body: unknown): void;
  end(): void;
  setHeader(name: string, value: string): void;
}

/**
 * These endpoints are called by the site itself and by provider webhooks.
 * `*` would let any origin invoke them from a browser, so the allow-list is
 * the site's own origins.
 */
export function applyCors(req: ApiRequest, res: ApiResponse, methods = "POST, OPTIONS"): boolean {
  const allowed = new Set([
    siteOrigin(),
    "https://www.yorkieadoptionhome.com",
    "https://yorkieadoptionhome.com",
    "http://localhost:5173",
  ]);

  const originHeader = req.headers.origin;
  const origin = Array.isArray(originHeader) ? originHeader[0] : originHeader;

  if (origin && allowed.has(origin)) {
    res.setHeader("Access-Control-Allow-Origin", origin);
    res.setHeader("Vary", "Origin");
  }

  res.setHeader("Access-Control-Allow-Methods", `${methods}`);
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");

  if (req.method === "OPTIONS") {
    res.status(204).end();
    return true;
  }
  return false;
}

export function fail(res: ApiResponse, err: unknown, label: string): void {
  if (err instanceof ConfigError) {
    console.error(`[${label}] configuration error:`, err.message);
    res.status(503).json({ error: err.message, code: "not_configured" });
    return;
  }
  const message = err instanceof Error ? err.message : "Unexpected error";
  console.error(`[${label}]`, err);
  res.status(500).json({ error: message });
}
