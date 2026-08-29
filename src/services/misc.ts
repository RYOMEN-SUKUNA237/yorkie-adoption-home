import { supabase, requireSupabase } from "../lib/supabase";
import type {
  ActivityLogRow,
  DashboardStats,
  ProfileRow,
  WaitlistStatus,
  WaitlistRow,
} from "../lib/database.types";

// ---------------------------------------------------------------------
// Waitlist
// ---------------------------------------------------------------------

export async function joinWaitlist(input: {
  email: string;
  fullName?: string;
  phone?: string;
  country?: string;
  note?: string;
  source?: string;
  applicationId?: string | null;
}): Promise<{ persisted: boolean }> {
  if (!supabase) return { persisted: false };

  const { error } = await supabase.from("waitlist").insert({
    email: input.email.trim().toLowerCase(),
    full_name: input.fullName?.trim() || null,
    phone: input.phone?.trim() || null,
    country: input.country?.trim() || null,
    note: input.note?.trim() || null,
    source: input.source ?? "website",
    application_id: input.applicationId ?? null,
    status: "active",
  });

  // A repeat sign-up is not an error worth showing the visitor.
  if (error && error.code !== "23505") throw error;
  return { persisted: true };
}

export async function listWaitlist(status?: WaitlistStatus | "all"): Promise<WaitlistRow[]> {
  const db = requireSupabase();
  let query = db.from("waitlist").select("*").order("created_at", { ascending: false });
  if (status && status !== "all") query = query.eq("status", status);
  const { data, error } = await query;
  if (error) throw error;
  return (data ?? []) as WaitlistRow[];
}

export async function setWaitlistStatus(id: string, status: WaitlistStatus): Promise<void> {
  const db = requireSupabase();
  const { error } = await db.from("waitlist").update({ status }).eq("id", id);
  if (error) throw error;
}

export async function removeFromWaitlist(id: string): Promise<void> {
  const db = requireSupabase();
  const { error } = await db.from("waitlist").delete().eq("id", id);
  if (error) throw error;
}

export function waitlistToCsv(rows: WaitlistRow[]): string {
  const escape = (v: unknown) => {
    const s = v === null || v === undefined ? "" : String(v);
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const header = ["Email", "Name", "Phone", "Country", "Status", "Source", "Joined", "Note"];
  const lines = rows.map((r) =>
    [r.email, r.full_name ?? "", r.phone ?? "", r.country ?? "", r.status, r.source, r.created_at, r.note ?? ""]
      .map(escape)
      .join(",")
  );
  return [header.join(","), ...lines].join("\r\n");
}

// ---------------------------------------------------------------------
// Site settings
// ---------------------------------------------------------------------

export type SettingsMap = Record<string, unknown>;

const DEFAULT_SETTINGS: SettingsMap = {
  site_name: "Yorkshire Adoption Home",
  tagline: "A small, selective Yorkshire Terrier breeder. One or two litters a year, raised in our kitchen.",
  contact_email: "support@yorkieadoptionhome.com",
  contact_phone: "+1 (218) 833-2266",
  whatsapp_number: "12188332266",
  address: "",
  instagram_url: "",
  notify_email: "ntuhgireseelezanw@gmail.com",
  applications_open: true,
  messenger_enabled: true,
  messenger_greeting:
    "Hello. Ask us anything about our Yorkshire Terriers or the adoption process - we usually reply within a day.",
  messenger_away_message:
    "We are not at the desk right now. Leave a message and your email, and we will come back to you.",
  office_hours: "Mon-Sat, 9am - 6pm (GMT+8)",
  review_sla_days: 14,
};

/**
 * Keys that must never reach the public site.
 *
 * `site_settings.is_public` defaults to true, so a key written without an
 * explicit value becomes world-readable the moment it is first saved. That
 * is fine for a tagline and wrong for the address notifications are sent to,
 * and the failure is silent - the row simply starts being served to anon.
 * Naming them here means the write below decides deliberately rather than
 * inheriting a default.
 */
const PRIVATE_SETTING_KEYS = new Set(["notify_email"]);

export async function getSettings(): Promise<SettingsMap> {
  if (!supabase) return { ...DEFAULT_SETTINGS };

  const { data, error } = await supabase.from("site_settings").select("key, value");
  if (error) {
    console.warn("[settings] falling back to defaults:", error.message);
    return { ...DEFAULT_SETTINGS };
  }

  const map: SettingsMap = { ...DEFAULT_SETTINGS };
  for (const row of data ?? []) map[row.key as string] = row.value;
  return map;
}

export async function updateSettings(patch: SettingsMap): Promise<void> {
  const db = requireSupabase();
  const { data: session } = await db.auth.getUser();

  const rows = Object.entries(patch).map(([key, value]) => ({
    key,
    value,
    is_public: !PRIVATE_SETTING_KEYS.has(key),
    updated_by: session.user?.id ?? null,
    updated_at: new Date().toISOString(),
  }));

  const { error } = await db.from("site_settings").upsert(rows, { onConflict: "key" });
  if (error) throw error;
}

/** Read a setting as a string with a fallback, since values are jsonb. */
export function settingString(settings: SettingsMap, key: string, fallback = ""): string {
  const v = settings[key];
  return typeof v === "string" ? v : v == null ? fallback : String(v);
}

export function settingBool(settings: SettingsMap, key: string, fallback = false): boolean {
  const v = settings[key];
  return typeof v === "boolean" ? v : fallback;
}

// ---------------------------------------------------------------------
// Dashboard stats
// ---------------------------------------------------------------------

export async function getDashboardStats(): Promise<DashboardStats> {
  const db = requireSupabase();
  const { data, error } = await db.rpc("admin_dashboard_stats");
  if (error) throw error;
  return data as DashboardStats;
}

// ---------------------------------------------------------------------
// Activity log
// ---------------------------------------------------------------------

export async function listActivity(limit = 30): Promise<ActivityLogRow[]> {
  const db = requireSupabase();
  const { data, error } = await db
    .from("activity_log")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) throw error;
  return (data ?? []) as ActivityLogRow[];
}

// ---------------------------------------------------------------------
// Team
// ---------------------------------------------------------------------

export async function listProfiles(): Promise<ProfileRow[]> {
  const db = requireSupabase();
  const { data, error } = await db.from("profiles").select("*").order("created_at");
  if (error) throw error;
  return (data ?? []) as ProfileRow[];
}

export async function updateProfile(
  id: string,
  patch: Partial<Pick<ProfileRow, "full_name" | "role" | "is_active">>
): Promise<void> {
  const db = requireSupabase();
  const { error } = await db.from("profiles").update(patch).eq("id", id);
  if (error) throw error;
}

// ---------------------------------------------------------------------
// Storage
// ---------------------------------------------------------------------

/** Upload an image and return its public URL. */
export async function uploadImage(
  bucket: "puppy-photos" | "guide-images",
  file: File,
  folder = ""
): Promise<string> {
  const db = requireSupabase();

  const ext = file.name.split(".").pop()?.toLowerCase() || "jpg";
  const path = `${folder ? folder.replace(/\/$/, "") + "/" : ""}${crypto.randomUUID()}.${ext}`;

  const { error } = await db.storage.from(bucket).upload(path, file, {
    cacheControl: "31536000",
    upsert: false,
    contentType: file.type,
  });
  if (error) throw error;

  return db.storage.from(bucket).getPublicUrl(path).data.publicUrl;
}

/**
 * Upload a messenger attachment. Stored under the uploader's user id so the
 * storage policy can scope it to them.
 */
export async function uploadAttachment(file: File): Promise<{ url: string; name: string }> {
  const db = requireSupabase();
  const { data: session } = await db.auth.getUser();
  const uid = session.user?.id;
  if (!uid) throw new Error("No session for upload.");

  const ext = file.name.split(".").pop()?.toLowerCase() || "bin";
  const path = `${uid}/${crypto.randomUUID()}.${ext}`;

  const { error } = await db.storage.from("message-files").upload(path, file, {
    upsert: false,
    contentType: file.type,
  });
  if (error) throw error;

  // Private bucket: a signed URL is the only way to read it back. One week
  // is long enough for a conversation to stay useful without being permanent.
  const { data, error: signError } = await db.storage
    .from("message-files")
    .createSignedUrl(path, 60 * 60 * 24 * 7);
  if (signError) throw signError;

  return { url: data.signedUrl, name: file.name };
}

/** Trigger a browser download for generated CSV text. */
export function downloadCsv(filename: string, csv: string): void {
  // BOM so Excel opens UTF-8 correctly.
  const blob = new Blob(["﻿" + csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
