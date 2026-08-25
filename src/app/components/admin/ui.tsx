import { type ReactNode, type InputHTMLAttributes, type TextareaHTMLAttributes } from "react";
import { AlertCircle, Loader2, Inbox } from "lucide-react";
import type { ApplicationStatus } from "../../../lib/database.types";
import { scoreBand } from "../../../lib/scoring";

// ---------------------------------------------------------------------
// Status presentation — one source of truth for every table and drawer
// ---------------------------------------------------------------------

export const APPLICATION_STATUS_STYLES: Record<ApplicationStatus, string> = {
  pending: "bg-[#EDEFF2] text-[#3C5166] border-[#C3CEDB]",
  reviewing: "bg-[#EDE9F7] text-[#4A3A7B] border-[#CBC0E5]",
  shortlisted: "bg-[#E6F0F7] text-[#245A78] border-[#B4D2E4]",
  approved: "bg-[#E8F0E9] text-[#2D6A35] border-[#B8D9BB]",
  declined: "bg-[#FAF0F0] text-[#8B2D2D] border-[#E5C0C0]",
  waitlisted: "bg-[#FFF8EA] text-[#7A5A1A] border-[#E5D5A0]",
  withdrawn: "bg-[#F0F0F0] text-[#6B6B6B] border-[#D8D8D8]",
};

export const APPLICATION_STATUS_LABELS: Record<ApplicationStatus, string> = {
  pending: "Pending",
  reviewing: "Reviewing",
  shortlisted: "Shortlisted",
  approved: "Approved",
  declined: "Declined",
  waitlisted: "Waitlisted",
  withdrawn: "Withdrawn",
};

export const APPLICATION_STATUSES = Object.keys(
  APPLICATION_STATUS_LABELS
) as ApplicationStatus[];

export function StatusBadge({
  status,
  size = "sm",
}: {
  status: ApplicationStatus;
  size?: "sm" | "xs";
}) {
  return (
    <span
      className={`inline-block font-medium tracking-wide rounded-sm border whitespace-nowrap ${
        size === "xs" ? "text-[10px] px-2 py-0.5" : "text-[11px] px-2.5 py-1"
      } ${APPLICATION_STATUS_STYLES[status]}`}
    >
      {APPLICATION_STATUS_LABELS[status]}
    </span>
  );
}

export function ScoreDot({ score, showLabel = true }: { score: number; showLabel?: boolean }) {
  const band = scoreBand(score);
  const color =
    band === "strong" ? "bg-[#2D6A35]" : band === "fair" ? "bg-[#5C7A99]" : "bg-[#B8873F]";

  return (
    <span className="inline-flex items-center gap-1.5 whitespace-nowrap">
      <span className={`w-2 h-2 rounded-full shrink-0 ${color}`} />
      {showLabel && <span className="text-sm font-medium text-foreground">{score}/10</span>}
    </span>
  );
}

// ---------------------------------------------------------------------
// Layout atoms
// ---------------------------------------------------------------------

export function PageHeader({
  title,
  subtitle,
  actions,
}: {
  title: string;
  subtitle?: string;
  actions?: ReactNode;
}) {
  return (
    <header className="bg-background border-b border-border px-4 sm:px-6 py-4 flex flex-wrap items-center justify-between gap-3">
      <div className="min-w-0">
        <h1 className="text-base font-semibold text-foreground truncate">{title}</h1>
        {subtitle && <p className="text-xs text-muted-foreground mt-0.5">{subtitle}</p>}
      </div>
      {actions && <div className="flex items-center gap-2 flex-wrap">{actions}</div>}
    </header>
  );
}

export function Card({ children, className = "" }: { children: ReactNode; className?: string }) {
  return (
    <div className={`bg-card border border-border rounded-md ${className}`}>{children}</div>
  );
}

export function Button({
  children,
  variant = "secondary",
  size = "md",
  className = "",
  ...props
}: {
  children: ReactNode;
  variant?: "primary" | "secondary" | "ghost" | "danger" | "success";
  size?: "sm" | "md";
} & React.ButtonHTMLAttributes<HTMLButtonElement>) {
  const variants: Record<string, string> = {
    primary: "bg-primary text-primary-foreground hover:bg-[#A0752F] border-transparent",
    secondary:
      "bg-background text-foreground border-border hover:border-foreground/40 hover:bg-secondary/50",
    ghost: "bg-transparent text-muted-foreground border-transparent hover:text-foreground hover:bg-secondary/60",
    danger: "bg-[#FAF0F0] text-[#8B2D2D] border-[#E5C0C0] hover:bg-[#F5E0E0]",
    success: "bg-[#E8F0E9] text-[#2D6A35] border-[#B8D9BB] hover:bg-[#D0E4D2]",
  };

  return (
    <button
      {...props}
      className={`inline-flex items-center justify-center gap-1.5 font-medium border rounded-sm transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50 disabled:cursor-not-allowed ${
        size === "sm" ? "text-xs px-2.5 py-1.5" : "text-sm px-4 py-2"
      } ${variants[variant]} ${className}`}
    >
      {children}
    </button>
  );
}

export function FilterChips<T extends string>({
  options,
  value,
  onChange,
  counts,
}: {
  options: Array<{ value: T; label: string }>;
  value: T;
  onChange: (v: T) => void;
  counts?: Partial<Record<T, number>>;
}) {
  return (
    <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar -mx-1 px-1 py-0.5">
      {options.map((option) => {
        const active = value === option.value;
        const count = counts?.[option.value];
        return (
          <button
            key={option.value}
            onClick={() => onChange(option.value)}
            aria-pressed={active}
            className={`text-xs font-medium px-3 py-1.5 rounded-sm border transition-colors whitespace-nowrap shrink-0 focus:outline-none focus-visible:ring-2 focus-visible:ring-ring ${
              active
                ? "bg-foreground text-background border-foreground"
                : "bg-transparent text-muted-foreground border-border hover:border-foreground/30 hover:text-foreground"
            }`}
          >
            {option.label}
            {count !== undefined && count > 0 && (
              <span className={`ml-1.5 ${active ? "opacity-70" : "opacity-60"}`}>{count}</span>
            )}
          </button>
        );
      })}
    </div>
  );
}

export function Field({
  label,
  required,
  hint,
  error,
  children,
}: {
  label: string;
  required?: boolean;
  hint?: string;
  error?: string;
  children: ReactNode;
}) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className="text-xs font-medium text-foreground">
        {label}
        {required && <span className="text-primary ml-0.5">*</span>}
      </span>
      {hint && <span className="text-xs text-muted-foreground -mt-1">{hint}</span>}
      {children}
      {error && (
        <span className="text-xs text-primary flex items-center gap-1">
          <AlertCircle size={11} /> {error}
        </span>
      )}
    </label>
  );
}

const inputClasses =
  "w-full px-3 py-2 bg-input-background border border-border rounded-sm text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring disabled:opacity-60";

export function TextInput(props: InputHTMLAttributes<HTMLInputElement>) {
  return <input {...props} className={`${inputClasses} ${props.className ?? ""}`} />;
}

export function TextArea(props: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return (
    <textarea
      {...props}
      className={`${inputClasses} leading-relaxed resize-y ${props.className ?? ""}`}
    />
  );
}

export function Select({
  children,
  ...props
}: React.SelectHTMLAttributes<HTMLSelectElement> & { children: ReactNode }) {
  return (
    <select {...props} className={`${inputClasses} ${props.className ?? ""}`}>
      {children}
    </select>
  );
}

export function Toggle({
  checked,
  onChange,
  label,
  hint,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  label: string;
  hint?: string;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
      className="flex items-start gap-3 text-left w-full group focus:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded-sm p-1 -m-1"
    >
      <span
        className={`mt-0.5 shrink-0 w-9 h-5 rounded-full transition-colors relative ${
          checked ? "bg-[#2D6A35]" : "bg-switch-background"
        }`}
      >
        <span
          className={`absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-white shadow-sm transition-transform ${
            checked ? "translate-x-4" : "translate-x-0"
          }`}
        />
      </span>
      <span className="min-w-0">
        <span className="block text-sm font-medium text-foreground">{label}</span>
        {hint && <span className="block text-xs text-muted-foreground mt-0.5">{hint}</span>}
      </span>
    </button>
  );
}

// ---------------------------------------------------------------------
// States
// ---------------------------------------------------------------------

export function LoadingState({ label = "Loading…" }: { label?: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-20 gap-3 text-muted-foreground">
      <Loader2 className="animate-spin" size={22} />
      <p className="text-sm">{label}</p>
    </div>
  );
}

export function EmptyState({
  title,
  description,
  action,
}: {
  title: string;
  description?: string;
  action?: ReactNode;
}) {
  return (
    <div className="flex flex-col items-center justify-center py-20 px-6 text-center gap-2">
      <Inbox className="text-muted mb-1" size={28} />
      <p className="text-sm font-medium text-foreground">{title}</p>
      {description && (
        <p className="text-sm text-muted-foreground max-w-sm leading-relaxed">{description}</p>
      )}
      {action && <div className="mt-3">{action}</div>}
    </div>
  );
}

export function ErrorState({ error, onRetry }: { error: Error; onRetry?: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center py-16 px-6 text-center gap-3">
      <AlertCircle className="text-primary" size={26} />
      <p className="text-sm font-medium text-foreground">Something went wrong</p>
      <p className="text-sm text-muted-foreground max-w-md leading-relaxed break-words">
        {error.message}
      </p>
      {onRetry && (
        <Button onClick={onRetry} variant="secondary" size="sm">
          Try again
        </Button>
      )}
    </div>
  );
}

/** Small metric tile used across the overview. */
export function StatTile({
  label,
  value,
  delta,
  hint,
  accent,
}: {
  label: string;
  value: string | number;
  delta?: { value: number; label: string };
  hint?: string;
  accent?: string;
}) {
  return (
    <Card className="p-4 sm:p-5">
      <p className="text-[10px] tracking-[0.15em] uppercase text-muted-foreground font-medium mb-2">
        {label}
      </p>
      <p
        className="text-3xl font-light text-foreground leading-none"
        style={{ fontFamily: "'Newsreader', Georgia, serif", color: accent }}
      >
        {value}
      </p>
      {delta && (
        <p
          className={`text-xs mt-2 ${
            delta.value > 0
              ? "text-[#2D6A35]"
              : delta.value < 0
                ? "text-[#8B2D2D]"
                : "text-muted-foreground"
          }`}
        >
          {delta.value > 0 ? "▲" : delta.value < 0 ? "▼" : "—"} {Math.abs(delta.value)}{" "}
          {delta.label}
        </p>
      )}
      {hint && !delta && <p className="text-xs text-muted-foreground mt-2">{hint}</p>}
    </Card>
  );
}
