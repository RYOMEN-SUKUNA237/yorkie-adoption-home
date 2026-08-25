/**
 * Domain models + row mappers.
 *
 * The pages built from the Figma export consume camelCase objects
 * (`ageWeeks`, `temperamentTags`, `parents.sire`). Postgres returns
 * snake_case rows. Mapping here keeps that translation in one place so the
 * presentation components did not have to be rewritten around the schema.
 */
import type {
  DewormingRow,
  GuideRow,
  GuideSection,
  HealthTest,
  ParentRow,
  PuppyRow,
  PuppySex,
  PuppyStatus,
  VaccinationRow,
} from "./database.types";

export type { PuppyStatus, PuppySex, HealthTest, GuideSection };

export interface Vaccination {
  id?: string;
  name: string;
  date: string;
  due?: string;
  done: boolean;
}

export interface Deworming {
  id?: string;
  product: string;
  date: string;
}

export interface Parent {
  id?: string;
  name: string;
  healthTests: HealthTest[];
}

export interface Puppy {
  id: string;
  slug: string;
  name: string;
  ageWeeks: number;
  sex: PuppySex;
  dateOfBirth: string;
  temperamentTags: string[];
  status: PuppyStatus;
  photos: string[];
  temperamentNotes: string;
  price?: number | null;
  currency?: string;
  isPublished?: boolean;
  displayOrder?: number;
  sireId?: string | null;
  damId?: string | null;
  vaccinations: Vaccination[];
  dewormings: Deworming[];
  parents: { sire: Parent; dam: Parent };
}

export interface Guide {
  id: string;
  slug: string;
  title: string;
  summary: string;
  readingTimeMin: number;
  publishedDate: string;
  sections: GuideSection[];
  coverImage?: string | null;
  isPublished?: boolean;
  displayOrder?: number;
}

const EMPTY_PARENT: Parent = { name: "Not recorded", healthTests: [] };

/** Weeks since birth, computed at render time so it never goes stale. */
export function ageInWeeks(dateOfBirth: string): number {
  const dob = new Date(dateOfBirth + "T00:00:00");
  if (Number.isNaN(dob.getTime())) return 0;
  const ms = Date.now() - dob.getTime();
  return Math.max(0, Math.floor(ms / (1000 * 60 * 60 * 24 * 7)));
}

export interface PuppyRowWithRelations extends PuppyRow {
  sire?: ParentRow | null;
  dam?: ParentRow | null;
  puppy_vaccinations?: VaccinationRow[] | null;
  puppy_dewormings?: DewormingRow[] | null;
}

export function mapParent(row: ParentRow | null | undefined): Parent {
  if (!row) return EMPTY_PARENT;
  return {
    id: row.id,
    name: row.name,
    healthTests: Array.isArray(row.health_tests) ? row.health_tests : [],
  };
}

export function mapPuppy(row: PuppyRowWithRelations): Puppy {
  const byOrder = <T extends { display_order: number }>(a: T, b: T) =>
    a.display_order - b.display_order;

  return {
    id: row.id,
    slug: row.slug,
    name: row.name,
    ageWeeks: ageInWeeks(row.date_of_birth),
    sex: row.sex,
    dateOfBirth: row.date_of_birth,
    temperamentTags: row.temperament_tags ?? [],
    status: row.status,
    photos: row.photos ?? [],
    temperamentNotes: row.temperament_notes ?? "",
    price: row.price,
    currency: row.currency,
    isPublished: row.is_published,
    displayOrder: row.display_order,
    sireId: row.sire_id,
    damId: row.dam_id,
    vaccinations: (row.puppy_vaccinations ?? [])
      .slice()
      .sort(byOrder)
      .map((v) => ({
        id: v.id,
        name: v.name,
        date: v.administered ?? "",
        due: v.due ?? undefined,
        done: v.done,
      })),
    dewormings: (row.puppy_dewormings ?? [])
      .slice()
      .sort(byOrder)
      .map((d) => ({ id: d.id, product: d.product, date: d.administered })),
    parents: {
      sire: mapParent(row.sire),
      dam: mapParent(row.dam),
    },
  };
}

export function mapGuide(row: GuideRow): Guide {
  return {
    id: row.id,
    slug: row.slug,
    title: row.title,
    summary: row.summary,
    readingTimeMin: row.reading_time_min,
    publishedDate: row.published_date,
    sections: Array.isArray(row.sections) ? row.sections : [],
    coverImage: row.cover_image,
    isPublished: row.is_published,
    displayOrder: row.display_order,
  };
}

/** Turn a title into a URL slug that satisfies the DB's slug CHECK constraint. */
export function slugify(input: string): string {
  return input
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "") // strip combining accents
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}
