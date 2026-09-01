/**
 * Database row types.
 *
 * Hand-maintained to match supabase/migrations. To regenerate from a live
 * project instead:
 *   npx supabase gen types typescript --project-id <ref> > src/lib/database.types.ts
 */

export type PuppyStatus = "available" | "pending" | "placed";
export type PuppySex = "male" | "female";
export type ParentRole = "sire" | "dam";
export type UserRole = "admin" | "staff";
export type ConversationStatus = "open" | "snoozed" | "closed";
export type SenderRole = "visitor" | "admin" | "system";
export type WaitlistStatus = "active" | "contacted" | "converted" | "removed";

export type ApplicationStatus =
  | "pending"
  | "reviewing"
  | "shortlisted"
  | "approved"
  | "declined"
  | "waitlisted"
  | "withdrawn";

export interface HealthTest {
  test: string;
  result: string;
}

export interface GuideSection {
  heading?: string;
  body: string;
}

export interface ApplicationPet {
  species: string;
  age: string;
  sex: string;
  vaccinated: boolean;
  neutered: boolean;
}

export interface ScoreFactor {
  label: string;
  points: number;
  max: number;
  reason: string;
}

export interface ProfileRow {
  id: string;
  email: string;
  full_name: string | null;
  avatar_url: string | null;
  role: UserRole;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface ParentRow {
  id: string;
  name: string;
  role: ParentRole;
  photo_url: string | null;
  health_tests: HealthTest[];
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface PuppyRow {
  id: string;
  slug: string;
  name: string;
  sex: PuppySex;
  date_of_birth: string;
  status: PuppyStatus;
  temperament_tags: string[];
  temperament_notes: string;
  photos: string[];
  price: number | null;
  currency: string;
  sire_id: string | null;
  dam_id: string | null;
  display_order: number;
  is_published: boolean;
  placed_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface VaccinationRow {
  id: string;
  puppy_id: string;
  name: string;
  administered: string | null;
  due: string | null;
  done: boolean;
  display_order: number;
  created_at: string;
}

export interface DewormingRow {
  id: string;
  puppy_id: string;
  product: string;
  administered: string;
  display_order: number;
  created_at: string;
}

export interface GuideRow {
  id: string;
  slug: string;
  title: string;
  summary: string;
  cover_image: string | null;
  reading_time_min: number;
  published_date: string;
  sections: GuideSection[];
  is_published: boolean;
  display_order: number;
  created_at: string;
  updated_at: string;
}

export interface ApplicationRow {
  id: string;
  reference: string;

  first_name: string;
  last_name: string;
  email: string;
  phone: string;
  city: string;
  country: string;

  ownership: string | null;
  landlord_allows: string | null;
  home_type: string | null;
  fenced_space: string | null;

  adult_count: number;
  children_ages: string | null;
  allergies: string | null;
  primary_carer: string | null;

  has_pets: boolean | null;
  pets: ApplicationPet[];

  hours_alone: number;
  dog_sleeps: string | null;
  travel_care: string | null;

  owned_before: boolean | null;
  previous_dog_history: string | null;

  will_return: boolean;
  will_spay_neuter: boolean;
  understands_decline: boolean;
  additional_info: string | null;

  puppy_id: string | null;
  puppy_slug: string | null;
  puppy_name: string | null;
  score: number;
  score_breakdown: ScoreFactor[];
  status: ApplicationStatus;
  reviewed_at: string | null;
  reviewed_by: string | null;
  decision_note: string | null;

  notification_preference?: "email" | "whatsapp" | "both";
  applicant_whatsapp?: string | null;

  submitted_at: string;
  updated_at: string;
}

export interface ApplicationNoteRow {
  id: string;
  application_id: string;
  author_id: string | null;
  author_name: string | null;
  body: string;
  is_system: boolean;
  created_at: string;
}

export interface WaitlistRow {
  id: string;
  email: string;
  full_name: string | null;
  phone: string | null;
  country: string | null;
  note: string | null;
  source: string;
  application_id: string | null;
  status: WaitlistStatus;
  created_at: string;
  updated_at: string;
}

export interface ConversationRow {
  id: string;
  visitor_id: string;
  visitor_name: string | null;
  visitor_email: string | null;
  subject: string | null;
  status: ConversationStatus;
  assigned_to: string | null;
  last_message_at: string;
  last_message_preview: string | null;
  unread_for_admin: number;
  unread_for_visitor: number;
  page_url: string | null;
  user_agent: string | null;
  created_at: string;
  updated_at: string;
}

export interface MessageRow {
  id: string;
  conversation_id: string;
  sender_role: SenderRole;
  sender_id: string | null;
  sender_name: string | null;
  body: string;
  attachment_url: string | null;
  attachment_name: string | null;
  read_at: string | null;
  created_at: string;
}

export interface SiteSettingRow {
  key: string;
  value: unknown;
  is_public: boolean;
  updated_at: string;
  updated_by: string | null;
}

export interface ActivityLogRow {
  id: string;
  actor_id: string | null;
  actor_name: string | null;
  action: string;
  entity: string;
  entity_id: string | null;
  meta: Record<string, unknown>;
  created_at: string;
}

/** Shape returned by the admin_dashboard_stats() RPC. */
export interface DashboardStats {
  applications: {
    total: number;
    pending: number;
    reviewing: number;
    shortlisted: number;
    approved: number;
    declined: number;
    waitlisted: number;
    last_7_days: number;
    prev_7_days: number;
    avg_score: number;
  };
  puppies: { total: number; available: number; pending: number; placed: number };
  messages: { open_conversations: number; unread: number; awaiting_reply: number };
  waitlist: { total: number; active: number };
  guides: { total: number; published: number };
  applications_by_day: Array<{ date: string; count: number }>;
  top_puppies: Array<{ name: string; count: number }>;
}

/** Delivery states Resend reports back through the inbound webhook. */
export type EmailStatus =
  | "sent"
  | "delivered"
  | "opened"
  | "bounced"
  | "complained"
  | "delayed"
  | "failed"
  | "received";

export interface EmailRow {
  id: string;
  direction: "incoming" | "outgoing";
  from_email: string;
  from_name: string | null;
  to_email: string;
  subject: string;
  body_text: string | null;
  body_html: string | null;
  status: EmailStatus | string;
  read_at: string | null;
  created_at: string;
  /** Resend message id. Deduplicates webhook retries and anchors delivery events. */
  provider_id: string | null;
}

export type WhatsAppStatus = "sent" | "delivered" | "read" | "failed";

export interface WhatsAppLogRow {
  id: string;
  recipient_phone: string;
  recipient_name: string | null;
  reference: string | null;
  message: string;
  status: WhatsAppStatus | string;
  created_at: string;
  /** Which gateway carried it: `meta`, `twilio`, or `none` when unconfigured. */
  provider: string | null;
  provider_message_id: string | null;
  /** Verbatim provider error. Meta 131047 means an approved template is required. */
  error: string | null;
}
