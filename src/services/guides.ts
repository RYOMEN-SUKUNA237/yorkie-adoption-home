import { supabase, requireSupabase } from "../lib/supabase";
import { mapGuide, type Guide } from "../lib/models";
import type { GuideRow, GuideSection } from "../lib/database.types";
import { guides as fallbackGuides } from "../data/guides";

function fallback(): Guide[] {
  return fallbackGuides as unknown as Guide[];
}

export async function listGuides(options?: { includeUnpublished?: boolean }): Promise<Guide[]> {
  if (!supabase) return fallback();

  let query = supabase
    .from("guides")
    .select("*")
    .order("display_order", { ascending: true })
    .order("published_date", { ascending: false });

  if (!options?.includeUnpublished) query = query.eq("is_published", true);

  const { data, error } = await query;
  if (error) throw error;
  return (data as GuideRow[]).map(mapGuide);
}

export async function getGuideBySlug(slug: string): Promise<Guide | null> {
  if (!supabase) return fallback().find((g) => g.slug === slug) ?? null;

  const { data, error } = await supabase
    .from("guides")
    .select("*")
    .eq("slug", slug)
    .maybeSingle();

  if (error) throw error;
  return data ? mapGuide(data as GuideRow) : null;
}

export async function getGuideById(id: string): Promise<Guide | null> {
  if (!supabase) return fallback().find((g) => g.id === id) ?? null;

  const { data, error } = await supabase.from("guides").select("*").eq("id", id).maybeSingle();
  if (error) throw error;
  return data ? mapGuide(data as GuideRow) : null;
}

export interface GuideInput {
  slug: string;
  title: string;
  summary: string;
  cover_image?: string | null;
  reading_time_min: number;
  published_date: string;
  sections: GuideSection[];
  is_published?: boolean;
  display_order?: number;
}

export async function createGuide(input: GuideInput): Promise<string> {
  const db = requireSupabase();
  const { data, error } = await db.from("guides").insert(input).select("id").single();
  if (error) throw error;
  return data.id as string;
}

export async function updateGuide(id: string, input: Partial<GuideInput>): Promise<void> {
  const db = requireSupabase();
  const { error } = await db.from("guides").update(input).eq("id", id);
  if (error) throw error;
}

export async function deleteGuide(id: string): Promise<void> {
  const db = requireSupabase();
  const { error } = await db.from("guides").delete().eq("id", id);
  if (error) throw error;
}

/**
 * Rough reading time from the section bodies, at 200 wpm. Offered as a
 * default in the editor so the field is not left at a made-up number.
 */
export function estimateReadingTime(sections: GuideSection[]): number {
  const words = sections.reduce(
    (sum, s) => sum + (s.body ?? "").trim().split(/\s+/).filter(Boolean).length,
    0
  );
  return Math.max(1, Math.round(words / 200));
}
