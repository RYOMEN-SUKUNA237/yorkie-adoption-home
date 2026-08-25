/**
 * Client-side mirror of the SQL rubric in
 * supabase/migrations/0002_functions.sql -> score_application().
 *
 * This exists only to render a live preview in the application form and in
 * the dashboard. The authoritative score is always the one the database
 * trigger computes on insert, which is why the trigger overwrites whatever
 * a client sends. Keep the two in step when the rubric changes.
 */
import type { ScoreFactor } from "./database.types";

export interface ScoreInput {
  ownership?: string | null;
  landlordAllows?: string | null;
  homeType?: string | null;
  fencedSpace?: string | null;
  hoursAlone?: number | null;
  adultCount?: number | null;
  childrenAges?: string | null;
  ownedBefore?: boolean | null;
  previousDogHistory?: string | null;
  willReturn?: boolean;
  willSpayNeuter?: boolean;
  understandsDecline?: boolean;
  travelCare?: string | null;
  dogSleeps?: string | null;
}

export interface ScoreResult {
  score: number;
  breakdown: ScoreFactor[];
}

const len = (s: string | null | undefined) => (s ?? "").trim().length;

export function scoreApplication(input: ScoreInput): ScoreResult {
  const breakdown: ScoreFactor[] = [];
  let total = 0;

  const add = (label: string, points: number, max: number, reason: string) => {
    breakdown.push({ label, points, max, reason });
    total += points;
  };

  // Hours alone (max 2.0) — the heaviest factor. Yorkshire Terriers are
  // strongly predisposed to separation anxiety.
  const hours = input.hoursAlone ?? 0;
  if (hours <= 2) add("Hours alone", 2.0, 2.0, `${hours}h alone per day`);
  else if (hours <= 4) add("Hours alone", 1.5, 2.0, `${hours}h alone per day`);
  else if (hours <= 6) add("Hours alone", 1.0, 2.0, `${hours}h alone per day`);
  else if (hours <= 8) add("Hours alone", 0.5, 2.0, `${hours}h alone per day - a lot for this breed`);
  else add("Hours alone", 0, 2.0, `${hours}h alone per day - longer than we place for`);

  // Housing security (max 1.5)
  if (input.ownership === "own") {
    add("Housing security", 1.5, 1.5, "Owns their home");
  } else if (input.ownership === "rent" && input.landlordAllows === "yes") {
    add("Housing security", 1.0, 1.5, "Renting with written landlord permission");
  } else if (input.ownership === "rent" && input.landlordAllows === "unsure") {
    add("Housing security", 0.25, 1.5, "Renting, landlord permission unconfirmed");
  } else {
    add("Housing security", 0, 1.5, "Renting without landlord permission");
  }

  // Dog experience (max 1.5)
  if (input.ownedBefore && len(input.previousDogHistory) >= 60) {
    add("Dog experience", 1.5, 1.5, "Previous owner, detailed history given");
  } else if (input.ownedBefore) {
    add("Dog experience", 1.0, 1.5, "Previous dog owner");
  } else {
    add("Dog experience", 0.25, 1.5, "First-time dog owner");
  }

  // Secure outdoor space (max 1.25) — terriers dig, squeeze and follow a
  // scent through boundaries that would hold a larger dog.
  if (input.fencedSpace === "yes") {
    add("Secure outdoor space", 1.25, 1.25, "Fully enclosed outdoor space");
  } else if (input.fencedSpace === "partial") {
    add("Secure outdoor space", 0.6, 1.25, "Partially enclosed - terriers find the gaps");
  } else {
    add("Secure outdoor space", 0, 1.25, "No enclosed outdoor space");
  }

  // Household support (max 1.0)
  const adults = input.adultCount ?? 0;
  if (adults >= 2) add("Household support", 1.0, 1.0, `${adults} adults in the household`);
  else if (adults === 1) add("Household support", 0.5, 1.0, "Single-adult household");
  else add("Household support", 0, 1.0, "Household size not given");

  // Commitments (max 1.0)
  if (input.willReturn && input.willSpayNeuter && input.understandsDecline) {
    add("Commitments", 1.0, 1.0, "All three commitments accepted");
  } else {
    add("Commitments", 0, 1.0, "Commitments incomplete");
  }

  // Handling risk (max 0.75) — specific to a 2-3kg dog. Young children are
  // not a disqualifier, but they change what the placement needs.
  const ages = (input.childrenAges ?? "").match(/\d+/g);
  const youngest = ages && ages.length ? Math.min(...ages.map(Number)) : null;
  if (youngest === null) {
    add("Handling risk", 0.75, 0.75, "No young children in the household");
  } else if (youngest >= 8) {
    add("Handling risk", 0.75, 0.75, `Youngest child is ${youngest} - old enough to handle a very small dog`);
  } else if (youngest >= 5) {
    add("Handling risk", 0.4, 0.75, `Youngest child is ${youngest} - workable with supervision`);
  } else {
    add("Handling risk", 0.1, 0.75, `Youngest child is ${youngest} - a 2kg dog is easily injured`);
  }

  // Home type (max 0.75) — weighted lower than for a quieter breed.
  if (input.homeType === "house" || input.homeType === "compound") {
    add("Home type", 0.75, 0.75, "House or compound");
  } else if (input.homeType === "apartment") {
    add("Home type", 0.45, 0.75, "Apartment - fine for the dog, worth thinking about the barking");
  } else {
    add("Home type", 0, 0.75, "Home type not given");
  }

  // Care planning (max 0.25)
  if (len(input.travelCare) >= 40 && len(input.dogSleeps) >= 20) {
    add("Care planning", 0.25, 0.25, "Sleeping and travel arrangements described in detail");
  } else if (len(input.travelCare) >= 20) {
    add("Care planning", 0.1, 0.25, "Care arrangements described briefly");
  } else {
    add("Care planning", 0, 0.25, "Care arrangements not described");
  }

  return {
    score: Math.round(Math.min(10, Math.max(0, total)) * 10) / 10,
    breakdown,
  };
}

/** Traffic-light band used consistently by the card, dot and detail panel. */
export function scoreBand(score: number): "strong" | "fair" | "weak" {
  if (score >= 8) return "strong";
  if (score >= 6) return "fair";
  return "weak";
}
