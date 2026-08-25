import { useEffect, useRef, useState, type ReactNode } from "react";
import {
  AlertCircle, Check, ChevronLeft, Loader2, User, Home, Users, PawPrint,
  Sun, Heart, HandHeart, ClipboardCheck,
} from "lucide-react";

/**
 * Presentation layer for the adoption application.
 *
 * Kept apart from Apply.tsx, which holds the form state and validation, so
 * the visual language can be changed without touching the logic. The
 * component signatures deliberately match what the original inline versions
 * exposed, so every call site in the form works unchanged.
 */

export const STEPS = [
  { name: "About you",  icon: User,           lead: "Let's start with who you are." },
  { name: "Your home",  icon: Home,           lead: "Where would a puppy be living?" },
  { name: "Household",  icon: Users,          lead: "Who else shares the home?" },
  { name: "Other pets", icon: PawPrint,       lead: "Any animals there already?" },
  { name: "Daily life", icon: Sun,            lead: "What does an ordinary day look like?" },
  { name: "Experience", icon: Heart,          lead: "Have you shared a home with a dog before?" },
  { name: "Commitment", icon: HandHeart,      lead: "Three promises we ask of everyone." },
  { name: "Review",     icon: ClipboardCheck, lead: "One last look before you send it." },
] as const;

export const STEP_NAMES = STEPS.map((s) => s.name);

// ---------------------------------------------------------------------
// Progress
// ---------------------------------------------------------------------

/**
 * Step rail. Shows the whole journey on wider screens so the length of the
 * form is honest up front; collapses to a counter and bar on phones.
 */
export function RibbonProgress({ step }: { step: number }) {
  const total = STEPS.length;
  const pct = ((step - 1) / (total - 1)) * 100;
  const current = STEPS[step - 1];

  return (
    <div className="mb-8">
      {/* Dots — sm and up */}
      <div className="hidden sm:flex items-center justify-between mb-5">
        {STEPS.map((s, i) => {
          const index = i + 1;
          const done = index < step;
          const active = index === step;
          const Icon = s.icon;

          return (
            <div key={s.name} className="flex items-center flex-1 last:flex-none">
              <div className="flex flex-col items-center gap-1.5 shrink-0">
                <div
                  className={`w-8 h-8 rounded-full flex items-center justify-center transition-all duration-300 ${
                    done
                      ? "bg-accent text-accent-foreground"
                      : active
                        ? "bg-primary text-primary-foreground ring-4 ring-primary/15 scale-110"
                        : "bg-secondary text-muted-foreground"
                  }`}
                >
                  {done ? <Check size={14} className="pop" /> : <Icon size={14} />}
                </div>
                <span
                  className={`text-[10px] tracking-wide transition-colors hidden md:block ${
                    active ? "text-foreground font-medium" : "text-muted-foreground"
                  }`}
                >
                  {s.name}
                </span>
              </div>

              {index < total && (
                <div className="flex-1 h-px mx-1.5 md:mx-2 -mt-5 bg-border relative overflow-hidden">
                  <div
                    className="absolute inset-y-0 left-0 bg-accent transition-all duration-500 ease-out"
                    style={{ width: done ? "100%" : "0%" }}
                  />
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Counter + bar — always visible */}
      <div className="flex items-baseline justify-between mb-2.5">
        <span className="text-[10px] tracking-[0.2em] uppercase text-muted-foreground font-medium">
          Step {step} of {total}
        </span>
        <span className="text-sm font-medium text-foreground sm:hidden">{current.name}</span>
        <span className="text-xs text-muted-foreground hidden sm:block">
          {Math.round(pct)}% complete
        </span>
      </div>

      <div
        className="relative h-[5px] bg-muted rounded-full overflow-hidden"
        role="progressbar"
        aria-valuenow={step}
        aria-valuemin={1}
        aria-valuemax={total}
        aria-label={`Step ${step} of ${total}: ${current.name}`}
      >
        <div
          className="absolute inset-y-0 left-0 rounded-full transition-all duration-700 ease-out progress-sheen"
          style={{
            width: `${Math.max(pct, 2)}%`,
            backgroundImage:
              "linear-gradient(90deg, #5C7A99 0%, #B8873F 50%, #5C7A99 100%)",
          }}
        />
      </div>
    </div>
  );
}

/** Warm heading for each step — the form should feel written by a person. */
export function StepHeader({ step }: { step: number }) {
  const { name, lead, icon: Icon } = STEPS[step - 1];

  return (
    <div className="mb-8 flex items-start gap-3.5">
      <span className="shrink-0 w-10 h-10 rounded-full bg-secondary flex items-center justify-center text-accent mt-0.5">
        <Icon size={18} />
      </span>
      <div className="min-w-0">
        <p className="text-[10px] tracking-[0.2em] uppercase text-accent font-medium mb-1">
          {name}
        </p>
        <h2
          className="text-2xl sm:text-[28px] font-light text-foreground leading-tight"
          style={{ fontFamily: "'Newsreader', Georgia, serif" }}
        >
          {lead}
        </h2>
      </div>
    </div>
  );
}

/** Wraps step content so it animates in each time the step changes. */
export function StepPanel({ step, children }: { step: number; children: ReactNode }) {
  return (
    <div key={step} className="step-enter">
      {children}
    </div>
  );
}

/** Applies the stagger delay to a block of fields. */
export function Stagger({ children }: { children: ReactNode[] | ReactNode }) {
  const items = Array.isArray(children) ? children : [children];
  return (
    <>
      {items.map((child, i) => (
        <div
          key={i}
          className="stagger-child"
          style={{ ["--i" as string]: i }}
        >
          {child}
        </div>
      ))}
    </>
  );
}

// ---------------------------------------------------------------------
// Fields
// ---------------------------------------------------------------------

export function FieldLabel({ children, required }: { children: ReactNode; required?: boolean }) {
  return (
    <label className="block text-sm font-medium text-foreground mb-2">
      {children}
      {required && (
        <span className="text-primary ml-1" aria-label="required">
          *
        </span>
      )}
    </label>
  );
}

const fieldBase =
  "w-full px-4 py-3 bg-input-background border rounded-md text-sm text-foreground " +
  "placeholder:text-muted-foreground/70 focus:outline-none transition-all duration-200 " +
  "focus:border-accent focus:ring-4 focus:ring-accent/12 focus:bg-card";

export function Input({
  value,
  onChange,
  type = "text",
  placeholder,
  min,
  max,
  invalid,
}: {
  value: string;
  onChange: (v: string) => void;
  type?: string;
  placeholder?: string;
  min?: number | string;
  max?: number | string;
  invalid?: boolean;
}) {
  return (
    <input
      type={type}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      min={min}
      max={max}
      aria-invalid={invalid || undefined}
      className={`${fieldBase} ${invalid ? "border-primary/60 bg-[#FBF7F1]" : "border-border hover:border-foreground/25"}`}
    />
  );
}

export function Textarea({
  value,
  onChange,
  placeholder,
  rows = 4,
  invalid,
  showCount,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  rows?: number;
  invalid?: boolean;
  showCount?: boolean;
}) {
  return (
    <div className="relative">
      <textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        rows={rows}
        aria-invalid={invalid || undefined}
        className={`${fieldBase} leading-relaxed resize-none ${
          invalid ? "border-primary/60 bg-[#FBF7F1]" : "border-border hover:border-foreground/25"
        }`}
      />
      {showCount && value.trim().length > 0 && (
        <span className="absolute bottom-2.5 right-3 text-[10px] text-muted-foreground tabular-nums pointer-events-none">
          {value.trim().length}
        </span>
      )}
    </div>
  );
}

/**
 * Selectable cards rather than radio dots.
 *
 * A dot is a control; a card is a choice. The form asks people to describe
 * their home and their life, and cards give those answers room to carry a
 * short explanation — which also cuts down on wrong answers.
 */
export function RadioGroup<T extends string>({
  value,
  onChange,
  options,
  name,
  columns = 1,
}: {
  value: T | "";
  onChange: (v: T) => void;
  options: { value: T; label: string; hint?: string; icon?: ReactNode }[];
  name: string;
  columns?: 1 | 2;
}) {
  return (
    <div
      role="radiogroup"
      aria-label={name}
      className={`grid gap-2.5 ${columns === 2 ? "sm:grid-cols-2" : "grid-cols-1"}`}
    >
      {options.map((opt) => {
        const selected = value === opt.value;
        return (
          <label
            key={opt.value}
            className={`relative flex items-start gap-3 p-3.5 rounded-md border cursor-pointer group transition-all duration-200 ${
              selected
                ? "border-accent bg-accent/[0.07] shadow-sm"
                : "border-border bg-card hover:border-accent/50 hover:-translate-y-0.5 hover:shadow-sm"
            }`}
          >
            <input
              type="radio"
              name={name}
              value={opt.value}
              checked={selected}
              onChange={() => onChange(opt.value)}
              className="sr-only peer"
            />

            <span
              className={`mt-0.5 shrink-0 w-[18px] h-[18px] rounded-full border-2 flex items-center justify-center transition-all duration-200 peer-focus-visible:ring-4 peer-focus-visible:ring-accent/25 ${
                selected
                  ? "border-accent bg-accent"
                  : "border-border group-hover:border-accent/60"
              }`}
            >
              {selected && <Check size={11} strokeWidth={3} className="text-accent-foreground pop" />}
            </span>

            <span className="min-w-0 flex-1">
              <span
                className={`block text-sm transition-colors ${
                  selected ? "text-foreground font-medium" : "text-foreground"
                }`}
              >
                {opt.label}
              </span>
              {opt.hint && (
                <span className="block text-xs text-muted-foreground mt-0.5 leading-relaxed">
                  {opt.hint}
                </span>
              )}
            </span>

            {opt.icon && <span className="shrink-0 text-muted-foreground">{opt.icon}</span>}
          </label>
        );
      })}
    </div>
  );
}

/** A yes/no pair rendered as two side-by-side cards. */
export function BooleanChoice({
  value,
  onChange,
  name,
  yesLabel = "Yes",
  noLabel = "No",
  yesHint,
  noHint,
}: {
  value: boolean | null;
  onChange: (v: boolean) => void;
  name: string;
  yesLabel?: string;
  noLabel?: string;
  yesHint?: string;
  noHint?: string;
}) {
  return (
    <RadioGroup<"yes" | "no">
      name={name}
      columns={2}
      value={value === null ? "" : value ? "yes" : "no"}
      onChange={(v) => onChange(v === "yes")}
      options={[
        { value: "yes", label: yesLabel, hint: yesHint },
        { value: "no", label: noLabel, hint: noHint },
      ]}
    />
  );
}

export function ErrorMsg({ msg }: { msg: string }) {
  return (
    <p className="flex items-start gap-1.5 text-xs text-primary mt-2 shake-once" role="alert">
      <AlertCircle size={12} className="shrink-0 mt-px" />
      <span>{msg}</span>
    </p>
  );
}

/**
 * Commitment checkbox rendered as a signed undertaking.
 *
 * These three are the only hard gates in the form, so they are given the
 * visual weight of something you are agreeing to rather than a tickbox.
 */
export function CommitmentCard({
  checked,
  onChange,
  title,
  body,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  title: string;
  body: string;
}) {
  return (
    <label
      className={`flex items-start gap-3.5 p-4 rounded-md border cursor-pointer transition-all duration-200 group ${
        checked
          ? "border-[#2D6A35]/40 bg-[#F2F7F2] shadow-sm"
          : "border-border bg-card hover:border-foreground/25 hover:shadow-sm"
      }`}
    >
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="sr-only peer"
      />
      <span
        className={`mt-0.5 shrink-0 w-5 h-5 rounded border-2 flex items-center justify-center transition-all duration-200 peer-focus-visible:ring-4 peer-focus-visible:ring-accent/25 ${
          checked
            ? "border-[#2D6A35] bg-[#2D6A35]"
            : "border-border group-hover:border-foreground/40"
        }`}
      >
        {checked && <Check size={13} strokeWidth={3} className="text-white pop" />}
      </span>
      <span className="min-w-0">
        <span className="block text-sm font-medium text-foreground mb-1">{title}</span>
        <span className="block text-sm text-muted-foreground leading-relaxed">{body}</span>
      </span>
    </label>
  );
}

/**
 * Hours-alone slider.
 *
 * This is the heaviest factor in the rubric, and the honest answer matters
 * more than a flattering one. Showing the consequence as you drag makes the
 * breed's needs concrete instead of hiding them in a scoring function.
 */
export function HoursAloneSlider({
  value,
  onChange,
}: {
  value: number;
  onChange: (v: number) => void;
}) {
  const bands = [
    { max: 2, label: "Ideal for this breed", tone: "text-[#2D6A35]", bg: "bg-[#E8F0E9]" },
    { max: 4, label: "Very workable", tone: "text-[#2D6A35]", bg: "bg-[#E8F0E9]" },
    { max: 6, label: "Workable with planning", tone: "text-[#3C5166]", bg: "bg-[#EDEFF2]" },
    { max: 8, label: "This is a lot for a Yorkie", tone: "text-[#7A5A1A]", bg: "bg-[#FFF8EA]" },
    { max: 24, label: "Longer than we place for", tone: "text-[#8B2D2D]", bg: "bg-[#FAF0F0]" },
  ];
  const band = bands.find((b) => value <= b.max) ?? bands[bands.length - 1];

  return (
    <div>
      <div className="flex items-baseline justify-between mb-3">
        <span
          className="text-3xl font-light text-foreground tabular-nums"
          style={{ fontFamily: "'Newsreader', Georgia, serif" }}
        >
          {value}
          <span className="text-base text-muted-foreground ml-1">
            {value === 1 ? "hour" : "hours"}
          </span>
        </span>
        <span
          className={`text-xs font-medium px-2.5 py-1 rounded-sm ${band.bg} ${band.tone} transition-colors duration-300`}
        >
          {band.label}
        </span>
      </div>

      <input
        type="range"
        min={0}
        max={12}
        step={1}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        aria-label="Hours alone on a typical day"
        className="w-full h-2 rounded-full appearance-none cursor-pointer bg-muted accent-[#B8873F] focus:outline-none focus-visible:ring-4 focus-visible:ring-accent/25"
        style={{
          background: `linear-gradient(90deg, #5C7A99 0%, #B8873F ${(value / 12) * 100}%, var(--muted) ${(value / 12) * 100}%)`,
        }}
      />

      <div className="flex justify-between text-[10px] text-muted-foreground mt-1.5">
        <span>Rarely alone</span>
        <span>12+ hours</span>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------
// Navigation
// ---------------------------------------------------------------------

export function NavButtons({
  step,
  onBack,
  onContinue,
  continueLabel = "Continue",
  isLast = false,
  busy = false,
}: {
  step: number;
  onBack: () => void;
  onContinue: () => void;
  continueLabel?: string;
  isLast?: boolean;
  busy?: boolean;
}) {
  return (
    <div className="flex items-center justify-between gap-4 mt-10 pt-6 border-t border-border">
      {step > 1 ? (
        <button
          onClick={onBack}
          disabled={busy}
          className="inline-flex items-center gap-1 text-sm font-medium text-muted-foreground hover:text-foreground transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded-sm disabled:opacity-50 group"
        >
          <ChevronLeft size={15} className="transition-transform group-hover:-translate-x-0.5" />
          Back
        </button>
      ) : (
        <div />
      )}

      <button
        onClick={onContinue}
        disabled={busy}
        className={`inline-flex items-center gap-2 px-7 sm:px-9 py-3.5 text-sm font-medium rounded-md transition-all duration-200 focus:outline-none focus-visible:ring-4 focus-visible:ring-accent/30 disabled:opacity-60 disabled:cursor-not-allowed shadow-sm hover:shadow-md hover:-translate-y-px active:translate-y-0 ${
          isLast
            ? "bg-primary text-primary-foreground hover:bg-[#A0752F]"
            : "bg-foreground text-background hover:bg-foreground/90"
        }`}
      >
        {busy && <Loader2 size={14} className="animate-spin" />}
        {continueLabel}
        {!busy && !isLast && <span aria-hidden="true">→</span>}
        {!busy && isLast && <Heart size={14} aria-hidden="true" />}
      </button>
    </div>
  );
}

/**
 * The puppy this application is for, pinned beside the form.
 *
 * A long form is easier to finish when you can see who it is for.
 */
export function PuppyCompanion({
  name,
  photo,
  ageWeeks,
  sex,
}: {
  name: string;
  photo?: string;
  ageWeeks: number;
  sex: string;
}) {
  return (
    <div className="flex items-center gap-3.5 p-3 rounded-lg border border-accent/25 bg-accent/[0.05] mb-8 stagger-child">
      {photo ? (
        <img
          src={photo}
          alt={name}
          className="w-14 h-14 rounded-md object-cover shrink-0"
          loading="lazy"
        />
      ) : (
        <span className="w-14 h-14 rounded-md bg-secondary flex items-center justify-center shrink-0">
          <PawPrint size={20} className="text-accent" />
        </span>
      )}
      <div className="min-w-0">
        <p className="text-[10px] tracking-[0.18em] uppercase text-accent font-medium mb-0.5">
          Applying for
        </p>
        <p
          className="text-lg font-medium text-foreground leading-tight"
          style={{ fontFamily: "'Newsreader', Georgia, serif" }}
        >
          {name}
        </p>
        <p className="text-xs text-muted-foreground">
          {sex === "male" ? "Male" : "Female"} · {ageWeeks} weeks old
        </p>
      </div>
    </div>
  );
}

/**
 * Fires confetti once, on submission.
 *
 * canvas-confetti is loaded on demand so it stays out of the initial bundle
 * — nobody needs it until the moment it runs. Silently does nothing if the
 * import fails or the visitor prefers reduced motion.
 */
export function useConfetti() {
  const fired = useRef(false);

  return useRef(() => {
    if (fired.current) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    fired.current = true;

    import("canvas-confetti")
      .then(({ default: confetti }) => {
        const shared = {
          spread: 70,
          ticks: 120,
          gravity: 0.9,
          scalar: 0.9,
          colors: ["#B8873F", "#5C7A99", "#F7F5F2", "#2D6A35"],
        };
        confetti({ ...shared, particleCount: 60, origin: { x: 0.2, y: 0.7 } });
        confetti({ ...shared, particleCount: 60, origin: { x: 0.8, y: 0.7 } });
        setTimeout(
          () => confetti({ ...shared, particleCount: 40, origin: { x: 0.5, y: 0.6 } }),
          180
        );
      })
      .catch(() => {
        /* decoration only */
      });
  }).current;
}

/** Small reassurance line under the form. */
export function Reassurance({ children }: { children: ReactNode }) {
  return (
    <p className="text-xs text-muted-foreground leading-relaxed mt-6 flex items-start gap-2">
      <Heart size={12} className="shrink-0 mt-0.5 text-accent" />
      <span>{children}</span>
    </p>
  );
}

/** Marks a step as saved locally, so leaving the tab feels less risky. */
export function SavedIndicator({ visible }: { visible: boolean }) {
  const [show, setShow] = useState(false);

  useEffect(() => {
    if (!visible) return;
    setShow(true);
    const t = setTimeout(() => setShow(false), 2000);
    return () => clearTimeout(t);
  }, [visible]);

  if (!show) return null;

  return (
    <span className="inline-flex items-center gap-1 text-[11px] text-[#2D6A35] pop">
      <Check size={11} strokeWidth={3} /> Progress kept
    </span>
  );
}
