import { supabase, requireSupabase } from "../lib/supabase";
import {
  mapPuppy,
  type Puppy,
  type PuppyRowWithRelations,
  type PuppyStatus,
} from "../lib/models";
import { puppies as fallbackPuppies } from "../data/puppies";

/**
 * `sire:parents!puppies_sire_id_fkey` names the FK explicitly. PostgREST
 * cannot disambiguate two relationships to the same table on its own, and
 * puppies references `parents` twice.
 */
const SELECT_WITH_RELATIONS = `
  *,
  sire:parents!puppies_sire_id_fkey(*),
  dam:parents!puppies_dam_id_fkey(*),
  puppy_vaccinations(*),
  puppy_dewormings(*)
`;

/** Sample content used when no Supabase project is configured. */
function fallback(): Puppy[] {
  return fallbackPuppies as unknown as Puppy[];
}

export async function listPuppies(options?: {
  status?: PuppyStatus | "all";
  includeUnpublished?: boolean;
}): Promise<Puppy[]> {
  if (!supabase) {
    const all = fallback();
    return options?.status && options.status !== "all"
      ? all.filter((p) => p.status === options.status)
      : all;
  }

  let query = supabase
    .from("puppies")
    .select(SELECT_WITH_RELATIONS)
    .order("display_order", { ascending: true })
    .order("created_at", { ascending: false });

  if (!options?.includeUnpublished) query = query.eq("is_published", true);
  if (options?.status && options.status !== "all") query = query.eq("status", options.status);

  const { data, error } = await query;
  if (error) throw error;
  return (data as unknown as PuppyRowWithRelations[]).map(mapPuppy);
}

export async function getPuppyBySlug(slug: string): Promise<Puppy | null> {
  if (!supabase) return fallback().find((p) => p.slug === slug) ?? null;

  const { data, error } = await supabase
    .from("puppies")
    .select(SELECT_WITH_RELATIONS)
    .eq("slug", slug)
    .maybeSingle();

  if (error) throw error;
  return data ? mapPuppy(data as unknown as PuppyRowWithRelations) : null;
}

export async function getPuppyById(id: string): Promise<Puppy | null> {
  if (!supabase) return fallback().find((p) => p.id === id) ?? null;

  const { data, error } = await supabase
    .from("puppies")
    .select(SELECT_WITH_RELATIONS)
    .eq("id", id)
    .maybeSingle();

  if (error) throw error;
  return data ? mapPuppy(data as unknown as PuppyRowWithRelations) : null;
}

// ---------------------------------------------------------------------
// Admin writes
// ---------------------------------------------------------------------

export interface PuppyInput {
  slug: string;
  name: string;
  sex: "male" | "female";
  date_of_birth: string;
  status: PuppyStatus;
  temperament_tags: string[];
  temperament_notes: string;
  photos: string[];
  price?: number | null;
  currency?: string;
  sire_id?: string | null;
  dam_id?: string | null;
  display_order?: number;
  is_published?: boolean;
}

export async function createPuppy(input: PuppyInput): Promise<string> {
  const db = requireSupabase();
  const { data, error } = await db.from("puppies").insert(input).select("id").single();
  if (error) throw error;
  return data.id as string;
}

export async function updatePuppy(id: string, input: Partial<PuppyInput>): Promise<void> {
  const db = requireSupabase();
  const { error } = await db.from("puppies").update(input).eq("id", id);
  if (error) throw error;
}

export async function deletePuppy(id: string): Promise<void> {
  const db = requireSupabase();
  const { error } = await db.from("puppies").delete().eq("id", id);
  if (error) throw error;
}

export async function setPuppyStatus(id: string, status: PuppyStatus): Promise<void> {
  const db = requireSupabase();
  const patch: Record<string, unknown> = { status };
  // Record when a puppy was placed so the history page can order by it.
  if (status === "placed") patch.placed_at = new Date().toISOString().slice(0, 10);
  const { error } = await db.from("puppies").update(patch).eq("id", id);
  if (error) throw error;
}

// ---------------------------------------------------------------------
// Health records — replaced wholesale on save
// ---------------------------------------------------------------------

export interface VaccinationInput {
  name: string;
  administered: string | null;
  due: string | null;
  done: boolean;
}

export interface DewormingInput {
  product: string;
  administered: string;
}

/**
 * Delete-then-insert rather than diffing rows: the editor presents the list
 * as one editable block, and a partial failure is easier to reason about
 * than a half-applied diff.
 */
export async function replaceHealthRecords(
  puppyId: string,
  vaccinations: VaccinationInput[],
  dewormings: DewormingInput[]
): Promise<void> {
  const db = requireSupabase();

  const [vDel, dDel] = await Promise.all([
    db.from("puppy_vaccinations").delete().eq("puppy_id", puppyId),
    db.from("puppy_dewormings").delete().eq("puppy_id", puppyId),
  ]);
  if (vDel.error) throw vDel.error;
  if (dDel.error) throw dDel.error;

  if (vaccinations.length) {
    const { error } = await db.from("puppy_vaccinations").insert(
      vaccinations.map((v, i) => ({ ...v, puppy_id: puppyId, display_order: i }))
    );
    if (error) throw error;
  }

  if (dewormings.length) {
    const { error } = await db.from("puppy_dewormings").insert(
      dewormings.map((d, i) => ({ ...d, puppy_id: puppyId, display_order: i }))
    );
    if (error) throw error;
  }
}

// ---------------------------------------------------------------------
// Parents
// ---------------------------------------------------------------------

export async function listParents() {
  if (!supabase) return [];
  const { data, error } = await supabase.from("parents").select("*").order("name");
  if (error) throw error;
  return data;
}

export async function upsertParent(input: {
  id?: string;
  name: string;
  role: "sire" | "dam";
  health_tests: Array<{ test: string; result: string }>;
  photo_url?: string | null;
  notes?: string | null;
}) {
  const db = requireSupabase();
  const { data, error } = await db
    .from("parents")
    .upsert(input, { onConflict: "name,role" })
    .select("id")
    .single();
  if (error) throw error;
  return data.id as string;
}

export async function deleteParent(id: string): Promise<void> {
  const db = requireSupabase();
  const { error } = await db.from("parents").delete().eq("id", id);
  if (error) throw error;
}
