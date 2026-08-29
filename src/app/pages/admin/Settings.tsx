import { useEffect, useState } from "react";
import { Loader2, Check, ShieldCheck, User as UserIcon, KeyRound } from "lucide-react";
import { useAsync } from "../../../hooks/useAsync";
import {
  getSettings, listProfiles, settingBool, settingString, updateProfile, updateSettings,
  type SettingsMap,
} from "../../../services/misc";
import { useAuth } from "../../../lib/auth";
import { formatDate } from "../../../lib/format";
import {
  Button, Card, ErrorState, Field, LoadingState, PageHeader, Select, TextArea,
  TextInput, Toggle,
} from "../../components/admin/ui";

export default function Settings() {
  const { isAdmin, profile } = useAuth();
  const stored = useAsync(() => getSettings(), []);
  const team = useAsync(() => (isAdmin ? listProfiles() : Promise.resolve([])), [isAdmin]);

  const [draft, setDraft] = useState<SettingsMap>({});
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (stored.data) setDraft(stored.data);
  }, [stored.data]);

  const set = (key: string, value: unknown) => {
    setDraft((d) => ({ ...d, [key]: value }));
    setSaved(false);
  };

  const handleSave = async () => {
    setSaving(true);
    setError(null);
    try {
      await updateSettings(draft);
      setSaved(true);
      stored.reload();
      setTimeout(() => setSaved(false), 2500);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save.");
    } finally {
      setSaving(false);
    }
  };

  if (stored.loading) return <LoadingState />;
  if (stored.error) return <ErrorState error={stored.error} onRetry={stored.reload} />;

  return (
    <>
      <PageHeader
        title="Settings"
        subtitle="Contact details, the messenger, and who has access"
        actions={
          <Button size="sm" variant="primary" onClick={handleSave} disabled={saving}>
            {saving && <Loader2 size={13} className="animate-spin" />}
            {saved && <Check size={13} />}
            {saved ? "Saved" : "Save changes"}
          </Button>
        }
      />

      <div className="flex-1 bg-sidebar p-4 sm:p-6">
        <div className="max-w-3xl mx-auto flex flex-col gap-4">
          {error && (
            <p className="text-sm text-primary bg-background border border-border rounded-md px-4 py-3" role="alert">
              {error}
            </p>
          )}

          <Card className="p-5 sm:p-6">
            <h2 className="text-sm font-semibold text-foreground mb-1">Site details</h2>
            <p className="text-xs text-muted-foreground mb-5">
              These appear in the footer, the messenger header and outgoing links.
            </p>

            <div className="flex flex-col gap-4">
              <Field label="Site name">
                <TextInput
                  value={settingString(draft, "site_name")}
                  onChange={(e) => set("site_name", e.target.value)}
                />
              </Field>
              <Field label="Tagline">
                <TextArea
                  rows={2}
                  value={settingString(draft, "tagline")}
                  onChange={(e) => set("tagline", e.target.value)}
                />
              </Field>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <Field label="Contact email">
                  <TextInput
                    type="email"
                    value={settingString(draft, "contact_email")}
                    onChange={(e) => set("contact_email", e.target.value)}
                    placeholder="hello@example.com"
                  />
                </Field>
                <Field
                  label="Phone number"
                  hint="Shown in the footer and dialled directly from a phone."
                >
                  <TextInput
                    type="tel"
                    value={settingString(draft, "contact_phone")}
                    onChange={(e) => set("contact_phone", e.target.value)}
                    placeholder="+1 (218) 833-2266"
                  />
                </Field>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <Field
                  label="WhatsApp number"
                  hint="Digits and country code only — wa.me rejects spaces and brackets."
                >
                  <TextInput
                    value={settingString(draft, "whatsapp_number")}
                    onChange={(e) => set("whatsapp_number", e.target.value)}
                    placeholder="12188332266"
                  />
                </Field>
                <Field label="Office hours">
                  <TextInput
                    value={settingString(draft, "office_hours")}
                    onChange={(e) => set("office_hours", e.target.value)}
                    placeholder="Mon–Sat, 9am – 6pm"
                  />
                </Field>
              </div>
              <Field
                label="Address"
                hint="Optional. Appears in the footer — leave empty to show nothing."
              >
                <TextArea
                  rows={2}
                  value={settingString(draft, "address")}
                  onChange={(e) => set("address", e.target.value)}
                  placeholder="Harrogate, North Yorkshire"
                />
              </Field>
              <Field label="Instagram" hint="Optional. Full URL.">
                <TextInput
                  type="url"
                  value={settingString(draft, "instagram_url")}
                  onChange={(e) => set("instagram_url", e.target.value)}
                  placeholder="https://instagram.com/yourhandle"
                />
              </Field>
              <Field
                label="Notification email"
                hint="Where new applications and messages are announced. Never shown publicly."
              >
                <TextInput
                  type="email"
                  value={settingString(draft, "notify_email")}
                  onChange={(e) => set("notify_email", e.target.value)}
                  placeholder="hello@example.com"
                />
              </Field>
            </div>
          </Card>

          <Card className="p-5 sm:p-6">
            <h2 className="text-sm font-semibold text-foreground mb-1">Applications</h2>
            <p className="text-xs text-muted-foreground mb-5">
              Control whether the public form accepts new submissions.
            </p>

            <div className="flex flex-col gap-4">
              <Toggle
                checked={settingBool(draft, "applications_open", true)}
                onChange={(v) => set("applications_open", v)}
                label="Applications open"
                hint="When off, the Apply page explains that submissions are paused and offers the waitlist instead."
              />
              <Field
                label="Review window (days)"
                hint="Quoted to applicants on the confirmation page."
              >
                <TextInput
                  type="number"
                  min="1"
                  value={settingString(draft, "review_sla_days", "14")}
                  onChange={(e) => set("review_sla_days", Number(e.target.value) || 14)}
                />
              </Field>
            </div>
          </Card>

          <Card className="p-5 sm:p-6">
            <h2 className="text-sm font-semibold text-foreground mb-1">Messenger</h2>
            <p className="text-xs text-muted-foreground mb-5">
              The floating chat widget on the public site.
            </p>

            <div className="flex flex-col gap-4">
              <Toggle
                checked={settingBool(draft, "messenger_enabled", true)}
                onChange={(v) => set("messenger_enabled", v)}
                label="Show the messenger"
                hint="Turning this off hides the floating button entirely."
              />
              <Field label="Greeting" hint="The first thing a visitor reads when they open the panel.">
                <TextArea
                  rows={3}
                  value={settingString(draft, "messenger_greeting")}
                  onChange={(e) => set("messenger_greeting", e.target.value)}
                />
              </Field>
              <Field label="Away message" hint="Shown outside office hours.">
                <TextArea
                  rows={3}
                  value={settingString(draft, "messenger_away_message")}
                  onChange={(e) => set("messenger_away_message", e.target.value)}
                />
              </Field>
            </div>
          </Card>

          <PasswordCard />

          {/* Team — admin only */}
          {isAdmin && (
            <Card className="p-5 sm:p-6">
              <h2 className="text-sm font-semibold text-foreground mb-1">Team</h2>
              <p className="text-xs text-muted-foreground mb-5">
                New accounts are created in Supabase under Authentication → Users. They appear here
                as staff; promote to admin to let them manage the team and delete records.
              </p>

              {team.loading && <LoadingState label="Loading team…" />}
              {team.data && (
                <ul className="flex flex-col divide-y divide-border">
                  {team.data.map((member) => (
                    <li key={member.id} className="py-3 flex items-center gap-3 flex-wrap">
                      <span className="shrink-0 w-8 h-8 rounded-full bg-secondary text-secondary-foreground flex items-center justify-center">
                        {member.role === "admin" ? (
                          <ShieldCheck size={14} />
                        ) : (
                          <UserIcon size={14} />
                        )}
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium text-foreground truncate">
                          {member.full_name || member.email}
                          {member.id === profile?.id && (
                            <span className="text-xs text-muted-foreground font-normal"> (you)</span>
                          )}
                        </p>
                        <p className="text-xs text-muted-foreground truncate">
                          {member.email} · joined {formatDate(member.created_at)}
                        </p>
                      </div>
                      <Select
                        value={member.role}
                        disabled={member.id === profile?.id}
                        onChange={async (e) => {
                          await updateProfile(member.id, {
                            role: e.target.value as "admin" | "staff",
                          });
                          team.reload();
                        }}
                        className="w-28 text-xs py-1.5 shrink-0"
                        aria-label={`Role for ${member.email}`}
                      >
                        <option value="staff">Staff</option>
                        <option value="admin">Admin</option>
                      </Select>
                      <Button
                        size="sm"
                        variant={member.is_active ? "ghost" : "secondary"}
                        disabled={member.id === profile?.id}
                        onClick={async () => {
                          await updateProfile(member.id, { is_active: !member.is_active });
                          team.reload();
                        }}
                        className="shrink-0"
                      >
                        {member.is_active ? "Deactivate" : "Reactivate"}
                      </Button>
                    </li>
                  ))}
                </ul>
              )}
            </Card>
          )}

          <div className="flex justify-end pb-6">
            <Button variant="primary" onClick={handleSave} disabled={saving}>
              {saving && <Loader2 size={14} className="animate-spin" />}
              {saved && <Check size={14} />}
              {saved ? "Saved" : "Save changes"}
            </Button>
          </div>
        </div>
      </div>
    </>
  );
}


/**
 * Change your own password.
 *
 * Kept out of the settings draft entirely: everything else on this page is
 * saved together by "Save changes", and a password must not ride along with
 * a tagline edit — it needs its own confirmation, its own errors, and must
 * not be re-sent every time something unrelated is saved.
 */
function PasswordCard() {
  const { changePassword } = useAuth();

  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const tooShort = next.length > 0 && next.length < 8;
  const mismatch = confirm.length > 0 && next !== confirm;
  const ready = current.length > 0 && next.length >= 8 && next === confirm;

  const submit = async () => {
    setBusy(true);
    setError(null);
    try {
      await changePassword(current, next);
      setCurrent("");
      setNext("");
      setConfirm("");
      setDone(true);
      setTimeout(() => setDone(false), 4000);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not change the password.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Card className="p-5 sm:p-6">
      <h2 className="text-sm font-semibold text-foreground mb-1">Your password</h2>
      <p className="text-xs text-muted-foreground mb-5">
        Changing this signs you out of nothing — your other devices keep working until their
        sessions expire.
      </p>

      {error && (
        <p
          className="text-sm text-primary bg-background border border-border rounded-md px-4 py-3 mb-4"
          role="alert"
        >
          {error}
        </p>
      )}

      <div className="flex flex-col gap-4">
        <Field label="Current password">
          <TextInput
            type="password"
            autoComplete="current-password"
            value={current}
            onChange={(e) => setCurrent(e.target.value)}
          />
        </Field>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Field
            label="New password"
            hint={tooShort ? "At least 8 characters." : "At least 8 characters."}
          >
            <TextInput
              type="password"
              autoComplete="new-password"
              value={next}
              onChange={(e) => setNext(e.target.value)}
              aria-invalid={tooShort || undefined}
            />
          </Field>
          <Field label="Confirm new password" hint={mismatch ? "These do not match." : undefined}>
            <TextInput
              type="password"
              autoComplete="new-password"
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              aria-invalid={mismatch || undefined}
            />
          </Field>
        </div>
        <div className="flex justify-end">
          <Button variant="secondary" onClick={submit} disabled={!ready || busy}>
            {busy && <Loader2 size={14} className="animate-spin" />}
            {done ? <Check size={14} /> : <KeyRound size={14} />}
            {done ? "Password changed" : "Change password"}
          </Button>
        </div>
      </div>
    </Card>
  );
}
