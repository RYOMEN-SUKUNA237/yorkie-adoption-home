import { supabase, requireSupabase } from "../lib/supabase";
import type {
  ApplicationNoteRow,
  ApplicationPet,
  ApplicationRow,
  ApplicationStatus,
} from "../lib/database.types";

/** Payload the public application form submits. */
export interface ApplicationSubmission {
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  city: string;
  country: string;

  notificationPreference?: "email" | "whatsapp" | "both";
  applicantWhatsapp?: string;

  ownership: string;
  landlordAllows: string;
  homeType: string;
  fencedSpace: string;

  adultCount: string;
  childrenAges: string;
  allergies: string;
  primaryCarer: string;

  hasPets: boolean | null;
  pets: ApplicationPet[];

  hoursAlone: number;
  dogSleeps: string;
  travelCare: string;

  ownedBefore: boolean | null;
  previousDogHistory: string;

  willReturn: boolean;
  willSpayNeuter: boolean;
  understandsDecline: boolean;
  additionalInfo: string;

  puppyId?: string | null;
  puppySlug?: string | null;
  puppyName?: string | null;
}

export interface SubmitResult {
  reference: string;
  id: string;
  /** False when the site is running without Supabase; nothing was persisted. */
  persisted: boolean;
}

/**
 * Submit an application.
 *
 * Goes through the `submit_application` RPC rather than a plain insert.
 * `applications` is write-only for the public — anon may INSERT but has no
 * SELECT policy — so `insert().select()` is refused by RLS: RETURNING needs
 * read permission on the new row. The RPC is SECURITY DEFINER and hands back
 * only the reference, id and score, so the applicant gets their reference
 * number without the table becoming readable.
 *
 * `score` and `reference` are assigned server-side and cannot be forged.
 */
export async function submitApplication(
  input: ApplicationSubmission
): Promise<SubmitResult> {
  if (!supabase) {
    // Dev fallback so the form is still walkable without a project.
    return {
      reference: `APP-DEMO-${Date.now().toString().slice(-4)}`,
      id: "demo",
      persisted: false,
    };
  }

  const payload = {
    first_name: input.firstName.trim(),
    last_name: input.lastName.trim(),
    email: input.email.trim().toLowerCase(),
    phone: input.phone.trim(),
    city: input.city.trim(),
    country: input.country.trim(),

    notification_preference: input.notificationPreference || "email",
    applicant_whatsapp: input.applicantWhatsapp?.trim() || input.phone.trim(),

    ownership: input.ownership || null,
    landlord_allows: input.landlordAllows || null,
    home_type: input.homeType || null,
    fenced_space: input.fencedSpace || null,

    adult_count: Number(input.adultCount) || 1,
    children_ages: input.childrenAges.trim() || null,
    allergies: input.allergies.trim() || null,
    primary_carer: input.primaryCarer.trim() || null,

    has_pets: input.hasPets,
    pets: input.hasPets ? input.pets : [],

    hours_alone: input.hoursAlone,
    dog_sleeps: input.dogSleeps.trim() || null,
    travel_care: input.travelCare.trim() || null,

    owned_before: input.ownedBefore,
    previous_dog_history: input.previousDogHistory.trim() || null,

    will_return: input.willReturn,
    will_spay_neuter: input.willSpayNeuter,
    understands_decline: input.understandsDecline,
    additional_info: input.additionalInfo.trim() || null,

    puppy_id: input.puppyId ?? null,
  };

  const { data, error } = await supabase.rpc("submit_application", { payload });

  if (error) throw error;

  const result = data as { id: string; reference: string; score: number };

  // Trigger admin email alert in background
  try {
    void fetch("/api/send-email", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        type: "new_application",
        payload: {
          reference: result.reference,
          firstName: input.firstName,
          lastName: input.lastName,
          email: input.email,
          phone: input.phone,
          puppyName: input.puppyName || "Any Puppy",
          score: result.score,
          city: input.city,
          country: input.country,
        },
      }),
    });
  } catch (err) {
    console.warn("[applications] Failed to trigger email notification endpoint:", err);
  }

  return { reference: result.reference, id: result.id, persisted: true };
}

// ---------------------------------------------------------------------
// Admin reads
// ---------------------------------------------------------------------

export interface ListApplicationsOptions {
  status?: ApplicationStatus | "all";
  puppySlug?: string;
  search?: string;
  sort?: "newest" | "oldest" | "score_high" | "score_low";
  limit?: number;
  offset?: number;
}

export interface ApplicationPage {
  rows: ApplicationRow[];
  total: number;
}

export async function listApplications(
  options: ListApplicationsOptions = {}
): Promise<ApplicationPage> {
  const db = requireSupabase();
  const { limit = 25, offset = 0 } = options;

  let query = db.from("applications").select("*", { count: "exact" });

  if (options.status && options.status !== "all") query = query.eq("status", options.status);
  if (options.puppySlug) query = query.eq("puppy_slug", options.puppySlug);

  if (options.search?.trim()) {
    const term = `%${options.search.trim()}%`;
    query = query.or(
      [
        `first_name.ilike.${term}`,
        `last_name.ilike.${term}`,
        `email.ilike.${term}`,
        `city.ilike.${term}`,
        `country.ilike.${term}`,
        `reference.ilike.${term}`,
      ].join(",")
    );
  }

  switch (options.sort ?? "newest") {
    case "oldest":
      query = query.order("submitted_at", { ascending: true });
      break;
    case "score_high":
      query = query.order("score", { ascending: false }).order("submitted_at", { ascending: false });
      break;
    case "score_low":
      query = query.order("score", { ascending: true }).order("submitted_at", { ascending: false });
      break;
    default:
      query = query.order("submitted_at", { ascending: false });
  }

  const { data, error, count } = await query.range(offset, offset + limit - 1);
  if (error) throw error;

  return { rows: (data ?? []) as ApplicationRow[], total: count ?? 0 };
}

export async function getApplication(id: string): Promise<ApplicationRow | null> {
  const db = requireSupabase();
  const { data, error } = await db.from("applications").select("*").eq("id", id).maybeSingle();
  if (error) throw error;
  return (data as ApplicationRow) ?? null;
}

export async function getApprovalCertificate(lookupKey: string): Promise<ApplicationRow | null> {
  const db = requireSupabase();
  const { data, error } = await db.rpc("get_approval_certificate", { lookup_key: lookupKey });
  if (error) {
    console.warn("getApprovalCertificate RPC error:", error);
    return await getApplication(lookupKey);
  }
  return (data as ApplicationRow) ?? null;
}

export async function updateApplicationStatus(
  id: string,
  status: ApplicationStatus,
  decisionNote?: string
): Promise<void> {
  const db = requireSupabase();
  const { data: session } = await db.auth.getUser();

  const { error } = await db
    .from("applications")
    .update({
      status,
      reviewed_at: new Date().toISOString(),
      reviewed_by: session.user?.id ?? null,
      ...(decisionNote !== undefined ? { decision_note: decisionNote } : {}),
    })
    .eq("id", id);

  if (error) throw error;

  // Automated notification dispatch on approval without human intervention
  if (status === "approved") {
    try {
      const app = await getApplication(id);
      if (app) {
        const pref = app.notification_preference || "email";
        const origin = typeof window !== "undefined" ? window.location.origin : "https://www.yorkieadoptionhome.com";
        const certUrl = `${origin}/certificate/${app.reference || app.id}`;
        const applicantName = `${app.first_name} ${app.last_name}`;

        // 1. Send Email if preference is 'email' or 'both'
        if (pref === "email" || pref === "both") {
          void fetch("/api/send-email", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              type: "application_approved",
              payload: {
                applicantEmail: app.email,
                applicantName,
                reference: app.reference,
                puppyName: app.puppy_name || "Yorkshire Puppy",
                applicationId: app.reference || app.id,
              },
            }),
          });
        }

        // 2. Send WhatsApp if preference is 'whatsapp' or 'both'
        if (pref === "whatsapp" || pref === "both") {
          const recipientPhone = app.applicant_whatsapp || app.phone;
          const waMessage = `🎉 Hello ${applicantName}! Your adoption application (${app.reference}) for ${app.puppy_name || "a Yorkshire puppy"} has been APPROVED!\n\nPlease view your official Proof Certificate here:\n${certUrl}\n\n👉 REQUIRED STEP: Please reach out to the seller to complete final verification.`;

          void fetch("/api/send-whatsapp", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              recipientPhone,
              recipientName: applicantName,
              message: waMessage,
              reference: app.reference,
              certUrl,
            }),
          });
        }
      }
    } catch (notifyErr) {
      console.warn("[applications] Approval notification error:", notifyErr);
    }
  }
}

export async function deleteApplication(id: string): Promise<void> {
  const db = requireSupabase();
  const { error } = await db.from("applications").delete().eq("id", id);
  if (error) throw error;
}

// ---------------------------------------------------------------------
// Review notes
// ---------------------------------------------------------------------

export async function listApplicationNotes(applicationId: string): Promise<ApplicationNoteRow[]> {
  const db = requireSupabase();
  const { data, error } = await db
    .from("application_notes")
    .select("*")
    .eq("application_id", applicationId)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return (data ?? []) as ApplicationNoteRow[];
}

export async function addApplicationNote(
  applicationId: string,
  body: string
): Promise<ApplicationNoteRow> {
  const db = requireSupabase();
  const { data: session } = await db.auth.getUser();

  let authorName: string | null = session.user?.email ?? null;
  if (session.user?.id) {
    const { data: profile } = await db
      .from("profiles")
      .select("full_name")
      .eq("id", session.user.id)
      .maybeSingle();
    authorName = (profile?.full_name as string | null) ?? authorName;
  }

  const { data, error } = await db
    .from("application_notes")
    .insert({
      application_id: applicationId,
      author_id: session.user?.id ?? null,
      author_name: authorName,
      body: body.trim(),
    })
    .select("*")
    .single();

  if (error) throw error;
  return data as ApplicationNoteRow;
}

export async function deleteApplicationNote(id: string): Promise<void> {
  const db = requireSupabase();
  const { error } = await db.from("application_notes").delete().eq("id", id);
  if (error) throw error;
}

/** CSV export of the current filter selection. */
export function applicationsToCsv(rows: ApplicationRow[]): string {
  const headers = [
    "Reference", "Submitted", "Status", "Score", "First name", "Last name",
    "Email", "Phone", "City", "Country", "Puppy", "Home type", "Ownership",
    "Fenced space", "Adults", "Children ages", "Hours alone", "Owned before",
    "Has pets", "Primary carer", "Notes",
  ];

  const escape = (v: unknown) => {
    const s = v === null || v === undefined ? "" : String(v);
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };

  const lines = rows.map((r) =>
    [
      r.reference, r.submitted_at, r.status, r.score, r.first_name, r.last_name,
      r.email, r.phone, r.city, r.country, r.puppy_name ?? "", r.home_type ?? "",
      r.ownership ?? "", r.fenced_space ?? "", r.adult_count, r.children_ages ?? "",
      r.hours_alone, r.owned_before ? "yes" : "no", r.has_pets ? "yes" : "no",
      r.primary_carer ?? "", r.decision_note ?? "",
    ]
      .map(escape)
      .join(",")
  );

  return [headers.join(","), ...lines].join("\r\n");
}
