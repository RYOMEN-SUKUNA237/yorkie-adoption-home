import { useEffect, useState } from "react";
import { useRouter } from "../router";
import { getApprovalCertificate } from "../../services/applications";
import { useSettings } from "../../lib/settings";
import { settingString } from "../../services/misc";
import type { ApplicationRow } from "../../lib/database.types";
import { formatDate } from "../../lib/format";
import { AlertCircle, ArrowLeft, Loader2, MessageSquare, Printer } from "lucide-react";

/**
 * The certificate of approval.
 *
 * Written as a formal document rather than a congratulations card: the
 * previous version leaned on a crimson gradient, dashed borders and emoji,
 * none of which belong on something an adopter is asked to keep and show.
 * The palette here is the site's own — ink, gold, cream — and the layout is
 * built to survive a printer, since most people will save it as a PDF.
 */

const serif = { fontFamily: "'Newsreader', Georgia, serif" } as const;

/** A hairline moiré, the way a share certificate or a banknote is toned. */
const GUILLOCHE =
  "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='28' height='28'%3E%3Cpath d='M0 28L28 0M-7 7L7 -7M21 35L35 21' stroke='%2323282F' stroke-width='0.5' fill='none' opacity='0.5'/%3E%3C/svg%3E\")";

export default function AdoptionCertificate({ certificateId }: { certificateId?: string }) {
  const { getParam, navigate, path } = useRouter();
  const { settings } = useSettings();

  // The id can arrive three ways: as a prop, as ?id=, or in the path.
  const pathId =
    typeof window !== "undefined"
      ? window.location.pathname.replace(/^\/(certificate|approval-proof)\/?/, "").split("/")[0].trim()
      : path.replace(/^\/(certificate|approval-proof)\/?/, "").split("/")[0].trim();

  const id = certificateId || getParam("id") || pathId;

  const [application, setApplication] = useState<ApplicationRow | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const siteName = settingString(settings, "site_name", "Yorkshire Adoption Home");

  useEffect(() => {
    if (!id) {
      setError("No application reference was given in the address.");
      setLoading(false);
      return;
    }

    getApprovalCertificate(id)
      .then((data) => {
        if (!data) setError("No approved application matches this reference.");
        else setApplication(data);
      })
      .catch((err) => setError(err?.message || "The certificate could not be loaded."))
      .finally(() => setLoading(false));
  }, [id]);

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-6">
        <div className="flex items-center gap-3 text-muted-foreground">
          <Loader2 className="animate-spin text-primary" size={18} />
          <span className="text-sm">Verifying this certificate…</span>
        </div>
      </div>
    );
  }

  if (error || !application) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-6">
        <div className="max-w-sm w-full text-center">
          <AlertCircle size={22} className="text-primary mx-auto mb-4" />
          <h2 className="text-xl text-foreground mb-2" style={serif}>
            Certificate not found
          </h2>
          <p className="text-sm text-muted-foreground leading-relaxed mb-7">
            {error || "This reference is not valid, or the approval has since been withdrawn."}
          </p>
          <button
            onClick={() => navigate("/")}
            className="inline-flex items-center gap-2 px-5 py-2.5 border border-border text-foreground rounded-md text-sm hover:bg-secondary transition-colors"
          >
            <ArrowLeft size={14} /> Back to the site
          </button>
        </div>
      </div>
    );
  }

  const applicantName = `${application.first_name} ${application.last_name}`.trim();
  const puppyName = application.puppy_name || "a Yorkshire Terrier puppy";
  const reference = application.reference ?? application.id;

  const openChat = () => {
    window.dispatchEvent(
      new CustomEvent("open-chat", {
        detail: {
          message:
            `Hello — my application ${reference} for ${puppyName} has been approved. ` +
            `I would like to complete verification and arrange collection.`,
          name: applicantName,
          email: application.email,
        },
      })
    );
  };

  return (
    <div className="min-h-screen bg-secondary/60 py-8 px-4 sm:px-6 print:bg-white print:p-0">
      {/* Toolbar — never printed */}
      <div className="max-w-[820px] mx-auto mb-6 flex flex-wrap items-center justify-between gap-3 print:hidden">
        <button
          onClick={() => navigate("/")}
          className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          <ArrowLeft size={14} /> Back to the site
        </button>

        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={() => window.print()}
            className="inline-flex items-center gap-2 px-4 py-2 bg-foreground text-background rounded-md text-sm hover:opacity-90 transition-opacity"
          >
            <Printer size={14} /> Print or save as PDF
          </button>
          <button
            onClick={openChat}
            className="inline-flex items-center gap-2 px-4 py-2 border border-border text-foreground rounded-md text-sm hover:bg-background transition-colors"
          >
            <MessageSquare size={14} /> Continue in support chat
          </button>
        </div>
      </div>

      {/* The document */}
      <article className="max-w-[820px] mx-auto bg-card shadow-[0_1px_2px_rgba(35,40,47,0.06),0_12px_40px_-12px_rgba(35,40,47,0.18)] print:shadow-none">
        {/* Ink band */}
        <header className="bg-foreground px-8 sm:px-14 py-7 flex items-baseline justify-between gap-4">
          <span className="text-background text-lg sm:text-xl" style={serif}>
            {siteName}
          </span>
          <span className="text-primary text-[10px] tracking-[0.22em] uppercase whitespace-nowrap">
            Yorkshire Terriers
          </span>
        </header>
        <div className="h-[3px] bg-primary" />

        {/* Toned field */}
        <div className="relative overflow-hidden">
          <div
            aria-hidden
            className="absolute inset-0 opacity-[0.035] print:opacity-[0.02]"
            style={{ backgroundImage: GUILLOCHE }}
          />

          <div className="relative px-8 sm:px-14 pt-14 pb-12">
            {/* Title */}
            <div className="text-center mb-12">
              <p className="text-[10px] tracking-[0.28em] uppercase text-primary mb-5">
                Certificate of approval
              </p>
              <h1
                className="text-[30px] sm:text-[42px] leading-[1.15] text-foreground mb-6"
                style={serif}
              >
                Adoption Application
                <br />
                Approved
              </h1>
              <DoubleRule />
              <p className="text-sm text-muted-foreground leading-relaxed max-w-md mx-auto mt-6">
                This certifies that the application recorded below has been reviewed against our
                placement criteria and approved by {siteName}.
              </p>
            </div>

            {/* Named parties, set as a formal citation */}
            <div className="text-center mb-12">
              <Caption>Approved applicant</Caption>
              <p className="text-2xl sm:text-3xl text-foreground mt-2 mb-8" style={serif}>
                {applicantName}
              </p>
              <Caption>For the adoption of</Caption>
              <p className="text-xl sm:text-2xl text-foreground mt-2" style={serif}>
                {puppyName}
              </p>
            </div>

            {/* Particulars */}
            <dl className="grid grid-cols-1 sm:grid-cols-2 gap-x-12 border-t border-border">
              <Row label="Reference" value={reference} mono />
              <Row label="Status" value="Approved" />
              <Row label="Breed" value="Yorkshire Terrier" />
              <Row label="Applied" value={formatDate(application.submitted_at)} />
              {application.reviewed_at && (
                <Row label="Approved" value={formatDate(application.reviewed_at)} />
              )}
              <Row
                label="Residence"
                value={[application.city, application.country].filter(Boolean).join(", ")}
              />
              <Row label="Email on record" value={application.email} />
              <Row label="Telephone on record" value={application.phone} />
            </dl>

            {/* Next step */}
            <div className="mt-12 border-l-2 border-primary pl-5 sm:pl-6">
              <Caption>Next step</Caption>
              <p className="text-sm text-foreground leading-relaxed mt-2 max-w-xl">
                Open the support chat on our website and quote reference{" "}
                <span className="font-medium">{reference}</span>. We complete identity verification,
                send the adoption agreement for signature, and agree collection or delivery from
                there.
              </p>
            </div>

            {/* Seal and signature */}
            <div className="mt-14 flex flex-col sm:flex-row items-center sm:items-end justify-between gap-10">
              <Seal reference={reference} />

              <div className="text-center sm:text-right">
                <p
                  className="text-[26px] text-foreground/85 mb-1 italic"
                  style={serif}
                  aria-hidden
                >
                  {siteName.split(" ")[0]}
                </p>
                <div className="w-52 border-b border-foreground/25 mb-2 mx-auto sm:ml-auto" />
                <Caption>Placement officer</Caption>
                <p className="text-xs text-muted-foreground mt-1">{siteName}</p>
              </div>
            </div>
          </div>
        </div>

        {/* Verification strip */}
        <footer className="border-t border-border bg-secondary/40 px-8 sm:px-14 py-5 print:bg-transparent">
          <p className="text-[11px] text-muted-foreground leading-relaxed">
            <span className="tracking-[0.14em] uppercase text-foreground/70">Verify</span>{" "}
            &nbsp;This certificate can be confirmed at any time at{" "}
            <span className="font-mono text-foreground/80 break-all">
              yorkieadoptionhome.com/certificate/{reference}
            </span>
            . Document id <span className="font-mono">{application.id}</span>.
          </p>
          <p className="text-[11px] text-muted-foreground leading-relaxed mt-2">
            {siteName} never requests payment by email or through a third party. If anyone contacts
            you claiming to act on our behalf, reach us through the website before responding.
          </p>
        </footer>
      </article>

      {/* Screen-only actions beneath the document */}
      <div className="max-w-[820px] mx-auto mt-6 flex flex-col sm:flex-row items-center justify-center gap-3 print:hidden">
        <button
          onClick={openChat}
          className="inline-flex items-center justify-center gap-2 w-full sm:w-auto px-7 py-3 bg-primary text-primary-foreground rounded-md text-sm hover:opacity-90 transition-opacity"
        >
          <MessageSquare size={15} /> Continue in support chat — reference {reference}
        </button>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------
// Pieces
// ---------------------------------------------------------------------

function Caption({ children }: { children: React.ReactNode }) {
  return (
    <span className="text-[10px] tracking-[0.2em] uppercase text-muted-foreground">{children}</span>
  );
}

/** Thick over thin — the classic engraved separator. */
function DoubleRule() {
  return (
    <div className="w-24 mx-auto" aria-hidden>
      <div className="h-[2px] bg-primary/70" />
      <div className="h-px bg-primary/40 mt-[3px]" />
    </div>
  );
}

function Row({ label, value, mono }: { label: string; value?: string | null; mono?: boolean }) {
  if (!value) return null;
  return (
    <div className="flex items-baseline gap-4 py-3 border-b border-border">
      <dt className="text-[10px] tracking-[0.16em] uppercase text-muted-foreground w-[9.5rem] shrink-0">
        {label}
      </dt>
      <dd className={`text-sm text-foreground break-words ${mono ? "font-mono" : ""}`}>{value}</dd>
    </div>
  );
}

/**
 * The seal, drawn rather than imaged so it stays crisp at print resolution.
 * Curved lettering uses a textPath, which is the only way to set type on an
 * arc without shipping a raster.
 */
function Seal({ reference }: { reference: string }) {
  const arcId = `seal-arc-${reference.replace(/[^A-Za-z0-9]/g, "")}`;

  return (
    <svg
      viewBox="0 0 128 128"
      className="w-[104px] h-[104px] shrink-0 text-primary"
      role="img"
      aria-label="Seal of approval"
    >
      <defs>
        <path id={`${arcId}-top`} d="M 64 64 m -47 0 a 47 47 0 0 1 94 0" fill="none" />
        <path id={`${arcId}-bottom`} d="M 64 64 m -41 0 a 41 41 0 0 0 82 0" fill="none" />
      </defs>

      <circle cx="64" cy="64" r="61" fill="none" stroke="currentColor" strokeWidth="1.5" />
      <circle cx="64" cy="64" r="56" fill="none" stroke="currentColor" strokeWidth="0.6" />
      <circle cx="64" cy="64" r="35" fill="none" stroke="currentColor" strokeWidth="0.6" />

      {/* Ticks around the rim */}
      {Array.from({ length: 48 }).map((_, i) => (
        <line
          key={i}
          x1="64"
          y1="8.5"
          x2="64"
          y2="12"
          stroke="currentColor"
          strokeWidth="0.7"
          opacity="0.55"
          transform={`rotate(${i * 7.5} 64 64)`}
        />
      ))}

      <text
        fontSize="9.5"
        letterSpacing="2.4"
        fill="currentColor"
        style={{ fontFamily: "'Newsreader', Georgia, serif" }}
      >
        <textPath href={`#${arcId}-top`} startOffset="50%" textAnchor="middle">
          YORKSHIRE ADOPTION HOME
        </textPath>
      </text>

      <text
        fontSize="8"
        letterSpacing="2"
        fill="currentColor"
        opacity="0.75"
        style={{ fontFamily: "'Newsreader', Georgia, serif" }}
      >
        <textPath href={`#${arcId}-bottom`} startOffset="50%" textAnchor="middle">
          APPROVED PLACEMENT
        </textPath>
      </text>

      <text
        x="64"
        y="70"
        textAnchor="middle"
        fontSize="24"
        letterSpacing="1"
        fill="currentColor"
        style={{ fontFamily: "'Newsreader', Georgia, serif" }}
      >
        YAH
      </text>
      <line x1="46" y1="78" x2="82" y2="78" stroke="currentColor" strokeWidth="0.6" />
    </svg>
  );
}
