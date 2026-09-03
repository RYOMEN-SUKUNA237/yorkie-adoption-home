/**
 * The canine vaccination catalogue the admin picks from.
 *
 * Until now the vaccination name was a free-text box, and the production
 * data shows exactly what that produces: alongside the three real entries
 * there are twelve rows with no name at all, and a scattering of values
 * where somebody typed the puppy's age into the name field — `1 weeks`,
 * `2days`, `8 weeks (6 weeks)2months`, `DIPPING first`. Those render as
 * empty or nonsensical bullets on the public puppy page.
 *
 * A fixed list fixes that at the source. `name` is the exact string written
 * to `puppy_vaccinations.name`, so the three labels already in the database
 * — `DHPPi — first (8 weeks)`, `DHPPi — second (12 weeks)`,
 * `Kennel Cough — intranasal` and `Rabies` — are reproduced here verbatim
 * rather than renamed. Existing records therefore map onto the catalogue
 * instead of becoming orphans.
 *
 * This is a record-keeping aid, not veterinary advice. It reflects the
 * schedule a typical small-breed puppy follows; the attending vet's
 * protocol governs, and every date here is a suggestion the admin can
 * overwrite.
 *
 * Deliberately absent: enteric coronavirus and Giardia. Both exist as
 * products, and neither is recommended for routine use by the WSAVA or
 * AAHA guidelines, so offering them in a picker would invite records that
 * misrepresent good practice.
 */

export type VaccineGroup = "core" | "lifestyle";

export interface VaccineOption {
  /** Stable key for React. Never stored — `name` is what reaches the row. */
  id: string;
  /** Written verbatim to `puppy_vaccinations.name`. */
  name: string;
  group: VaccineGroup;
  /** Plain-language note shown under the picker once chosen. */
  protects: string;
  /**
   * Age in weeks this dose is normally given at, used to suggest a due
   * date from the puppy's date of birth. Omitted where there is no
   * meaningful default.
   */
  week?: number;
}

export const VACCINE_GROUPS: Array<{ key: VaccineGroup; label: string; caption: string }> = [
  {
    key: "core",
    label: "Core",
    caption: "Given to every puppy regardless of where it goes to live.",
  },
  {
    key: "lifestyle",
    label: "Lifestyle and regional",
    caption: "Given according to where the puppy will live and what it will do.",
  },
];

export const VACCINE_CATALOGUE: VaccineOption[] = [
  // -------------------------------------------------------------------
  // Core
  // -------------------------------------------------------------------
  {
    id: "dhppi-1",
    name: "DHPPi — first (8 weeks)",
    group: "core",
    protects: "Distemper, hepatitis (adenovirus), parvovirus and parainfluenza, in one shot.",
    week: 8,
  },
  {
    id: "dhppi-2",
    name: "DHPPi — second (12 weeks)",
    group: "core",
    protects: "Second dose of the primary course. Immunity is not reliable until this one.",
    week: 12,
  },
  {
    id: "dhppi-3",
    name: "DHPPi — third (16 weeks)",
    group: "core",
    protects:
      "Final dose of the primary course. Some protocols stop at two; a third covers puppies whose maternal antibodies lingered.",
    week: 16,
  },
  {
    id: "dhppi-booster",
    name: "DHPPi — booster (12 months)",
    group: "core",
    protects: "First annual booster, due a year after the primary course.",
    week: 52,
  },
  {
    id: "lepto-1",
    name: "Leptospirosis — first (12 weeks)",
    group: "core",
    protects:
      "Bacterial infection carried in standing water and rodent urine. Core in the UK; regional in the United States.",
    week: 12,
  },
  {
    id: "lepto-2",
    name: "Leptospirosis — second (15 weeks)",
    group: "core",
    protects: "Second dose, two to four weeks after the first. One dose alone does very little.",
    week: 15,
  },
  {
    id: "rabies",
    name: "Rabies",
    group: "core",
    protects:
      "Required by law in most of the United States. Twelve weeks is usually the earliest permitted age.",
    week: 16,
  },
  {
    id: "rabies-booster",
    name: "Rabies — booster",
    group: "core",
    protects: "Due a year after the first dose, then every one to three years by jurisdiction.",
    week: 68,
  },

  // -------------------------------------------------------------------
  // Lifestyle and regional
  // -------------------------------------------------------------------
  {
    id: "kennel-cough-intranasal",
    name: "Kennel Cough — intranasal",
    group: "lifestyle",
    protects:
      "Bordetella bronchiseptica and parainfluenza, given as nose drops. Wanted by most boarding kennels and groomers.",
    week: 8,
  },
  {
    id: "kennel-cough-injectable",
    name: "Kennel Cough — injectable",
    group: "lifestyle",
    protects: "The same cover by injection, for a puppy that will not tolerate nose drops.",
    week: 8,
  },
  {
    id: "influenza-1",
    name: "Canine influenza — first",
    group: "lifestyle",
    protects: "H3N8 and H3N2. Worth having where a dog will board, attend daycare or be shown.",
    week: 12,
  },
  {
    id: "influenza-2",
    name: "Canine influenza — second",
    group: "lifestyle",
    protects: "Second dose, two to four weeks after the first.",
    week: 15,
  },
  {
    id: "lyme-1",
    name: "Lyme disease — first",
    group: "lifestyle",
    protects:
      "Borrelia burgdorferi, carried by ticks. Regional — relevant in the northeast, upper midwest and Pacific coast.",
    week: 12,
  },
  {
    id: "lyme-2",
    name: "Lyme disease — second",
    group: "lifestyle",
    protects: "Second dose, two to four weeks after the first.",
    week: 15,
  },
  {
    id: "rattlesnake",
    name: "Rattlesnake toxoid",
    group: "lifestyle",
    protects:
      "Crotalus atrox. Only where rattlesnakes are endemic, and it buys time to reach a vet rather than replacing that trip.",
    week: 16,
  },
];

/** Catalogue entries in the order they should appear, grouped. */
export function vaccinesByGroup(group: VaccineGroup): VaccineOption[] {
  return VACCINE_CATALOGUE.filter((v) => v.group === group);
}

/**
 * Canonical label for a catalogue id.
 *
 * Throws rather than returning undefined. The sample content and the seed
 * generator call this, and a silent `undefined` would write a nameless
 * vaccination row — precisely the defect this catalogue exists to prevent.
 */
export function vaccineName(id: string): string {
  const found = VACCINE_CATALOGUE.find((v) => v.id === id);
  if (!found) throw new Error(`Unknown vaccine id: ${id}`);
  return found.name;
}

/**
 * Match a stored name back to a catalogue entry.
 *
 * Tolerant of stray whitespace and casing so a legacy row still matches,
 * but not of near-misses: `DHPPi` on its own is genuinely not one of the
 * three numbered doses and should stay a custom value rather than being
 * guessed into the wrong one.
 */
export function findVaccine(name: string): VaccineOption | undefined {
  const needle = String(name ?? "").trim().toLowerCase();
  if (!needle) return undefined;
  return VACCINE_CATALOGUE.find((v) => v.name.toLowerCase() === needle);
}

/**
 * The date this dose would fall due for a puppy born on `dateOfBirth`.
 *
 * Returns null when either the birth date or the typical age is unknown,
 * so the caller leaves the field empty rather than inventing a date.
 */
export function suggestedDue(option: VaccineOption, dateOfBirth: string): string | null {
  if (!dateOfBirth || option.week == null) return null;
  const born = new Date(`${dateOfBirth}T00:00:00Z`);
  if (Number.isNaN(born.getTime())) return null;
  born.setUTCDate(born.getUTCDate() + option.week * 7);
  return born.toISOString().slice(0, 10);
}
