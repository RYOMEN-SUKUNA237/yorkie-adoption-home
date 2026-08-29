import { useEffect, useState } from "react";
import { useRouter } from "../router";
import { getApprovalCertificate } from "../../services/applications";
import { useSettings } from "../../lib/settings";
import { settingString } from "../../services/misc";
import type { ApplicationRow } from "../../lib/database.types";
import { formatDate } from "../../lib/format";
import {
  CheckCircle2, Printer, ShieldCheck, MessageCircle, AlertCircle, Dog, ArrowLeft, Loader2, Download, MessageSquare
} from "lucide-react";

export default function AdoptionCertificate({ certificateId }: { certificateId?: string }) {
  const { getParam, navigate, path } = useRouter();
  const { settings } = useSettings();

  // Robust ID resolution: from props, query param ?id=, or URL path (/certificate/:id)
  const pathId = typeof window !== "undefined"
    ? window.location.pathname.replace(/^\/(certificate|approval-proof)\/?/, "").split("/")[0].trim()
    : path.replace(/^\/(certificate|approval-proof)\/?/, "").split("/")[0].trim();

  const id = certificateId || getParam("id") || pathId;

  const [application, setApplication] = useState<ApplicationRow | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const sellerWhatsApp = settingString(settings, "whatsapp_number", "12188332266");
  const siteName = settingString(settings, "site_name", "Yorkshire Adoption Home");

  useEffect(() => {
    if (!id) {
      setError("No application reference or ID provided in URL.");
      setLoading(false);
      return;
    }

    getApprovalCertificate(id)
      .then((data) => {
        if (!data) {
          setError("Adoption approval certificate not found or reference is invalid.");
        } else {
          setApplication(data);
        }
      })
      .catch((err) => {
        setError(err.message || "Failed to load approval certificate.");
      })
      .finally(() => setLoading(false));
  }, [id]);

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
        <div className="flex items-center gap-3 bg-white p-6 rounded-xl shadow-md border border-slate-100">
          <Loader2 className="animate-spin text-red-700" size={24} />
          <span className="text-slate-700 font-medium">Verifying adoption certificate...</span>
        </div>
      </div>
    );
  }

  if (error || !application) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
        <div className="max-w-md w-full bg-white p-8 rounded-2xl shadow-lg border border-slate-200 text-center">
          <div className="w-12 h-12 rounded-full bg-red-100 text-red-600 flex items-center justify-center mx-auto mb-4">
            <AlertCircle size={24} />
          </div>
          <h2 className="text-xl font-bold text-slate-900 mb-2">Certificate Not Found</h2>
          <p className="text-sm text-slate-600 mb-6">{error || "Invalid or expired application reference."}</p>
          <button
            onClick={() => navigate("/")}
            className="inline-flex items-center gap-2 px-5 py-2.5 bg-slate-900 text-white rounded-lg font-medium hover:bg-slate-800 transition-colors text-sm"
          >
            <ArrowLeft size={16} /> Return to Home
          </button>
        </div>
      </div>
    );
  }

  const cleanWaNumber = sellerWhatsApp.replace(/\D/g, "");
  const waUrl = `https://wa.me/${cleanWaNumber}?text=${encodeURIComponent(
    `Hello! My application (${application.reference}) for ${application.puppy_name || "a Yorkshire puppy"} has been approved. I am reaching out with my Proof Certificate to complete final verification.`
  )}`;

  return (
    <div className="min-h-screen bg-slate-100 py-10 px-4 sm:px-6 print:bg-white print:py-0 print:px-0">
      {/* Top Action Bar (Hidden on Print) */}
      <div className="max-w-3xl mx-auto mb-6 flex flex-wrap items-center justify-between gap-4 print:hidden">
        <button
          onClick={() => navigate("/")}
          className="inline-flex items-center gap-2 text-sm text-slate-600 hover:text-slate-900 font-medium"
        >
          <ArrowLeft size={16} /> Back to Site
        </button>

        <div className="flex flex-wrap items-center gap-3">
          <button
            onClick={() => window.print()}
            className="inline-flex items-center gap-2 px-4 py-2 bg-slate-900 text-white hover:bg-slate-800 rounded-lg text-sm font-semibold shadow-sm transition-colors"
          >
            <Download size={16} /> Download / Save PDF
          </button>

          <button
            onClick={() => window.print()}
            className="inline-flex items-center gap-2 px-4 py-2 bg-white text-slate-700 hover:text-slate-900 border border-slate-300 rounded-lg text-sm font-semibold shadow-sm hover:bg-slate-50 transition-colors"
          >
            <Printer size={16} /> Print
          </button>

          <a
            href={waUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-sm font-semibold shadow-sm transition-colors"
          >
            <MessageCircle size={16} /> Reach Seller on WhatsApp
          </a>
        </div>
      </div>

      {/* Main Certificate Sheet */}
      <div className="max-w-3xl mx-auto bg-white rounded-2xl shadow-xl border-4 border-amber-900/10 overflow-hidden relative print:shadow-none print:border-2 print:border-slate-800 print:rounded-none">
        
        {/* Decorative Top Banner */}
        <div className="bg-gradient-to-r from-red-900 via-red-800 to-amber-900 text-white p-8 sm:p-10 text-center relative overflow-hidden">
          <div className="absolute right-4 -top-6 text-white/5 pointer-events-none">
            <Dog size={220} />
          </div>

          <div className="inline-flex items-center gap-2 bg-amber-400/20 text-amber-200 border border-amber-400/30 px-3 py-1 rounded-full text-xs font-semibold uppercase tracking-widest mb-3">
            <ShieldCheck size={14} className="text-amber-400" /> Official Verification Proof
          </div>
          <h1 className="text-2xl sm:text-4xl font-extrabold tracking-tight mb-2">
            Adoption Approval Certificate
          </h1>
          <p className="text-red-100 text-sm sm:text-base max-w-xl mx-auto font-light">
            This document verifies that the adoption application below has been reviewed and officially approved by {siteName}.
          </p>
        </div>

        {/* Status Ribbon */}
        <div className="bg-emerald-50 border-y border-emerald-200 px-6 py-4 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-emerald-600 text-white flex items-center justify-center shrink-0">
              <CheckCircle2 size={24} />
            </div>
            <div>
              <span className="text-xs uppercase font-bold tracking-wider text-emerald-800">Application Status</span>
              <p className="text-base font-bold text-emerald-950">APPROVED & VERIFIED</p>
            </div>
          </div>
          <div className="text-right sm:text-right text-center">
            <span className="text-xs text-slate-500 font-medium">Reference ID</span>
            <p className="text-lg font-mono font-bold text-slate-900">{application.reference}</p>
          </div>
        </div>

        {/* Certificate Details */}
        <div className="p-6 sm:p-10 space-y-8">
          {/* Applicant & Puppy Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 bg-slate-50 p-6 rounded-xl border border-slate-200">
            <div>
              <h3 className="text-xs uppercase font-bold text-slate-500 tracking-wider mb-3">Approved Applicant</h3>
              <p className="text-lg font-bold text-slate-900">{application.first_name} {application.last_name}</p>
              <p className="text-sm text-slate-600 font-medium mt-1">{application.email}</p>
              <p className="text-sm text-slate-600 font-medium">{application.phone}</p>
              <p className="text-sm text-slate-500 mt-2">{application.city}, {application.country}</p>
            </div>

            <div className="md:border-l md:border-slate-200 md:pl-6">
              <h3 className="text-xs uppercase font-bold text-slate-500 tracking-wider mb-3">Adoption Puppy</h3>
              <p className="text-lg font-bold text-slate-900">{application.puppy_name || "Yorkshire Puppy"}</p>
              <p className="text-sm text-slate-600 font-medium mt-1">Breed: Yorkshire Terrier</p>
              <p className="text-sm text-slate-600 font-medium">Application Date: {formatDate(application.submitted_at)}</p>
              {application.reviewed_at && (
                <p className="text-sm text-emerald-700 font-semibold mt-2">Approved on: {formatDate(application.reviewed_at)}</p>
              )}
            </div>
          </div>

          {/* Verification Directive Notice */}
          <div className="bg-amber-50 border-l-4 border-amber-500 p-5 rounded-r-xl">
            <div className="flex gap-3">
              <AlertCircle size={22} className="text-amber-700 shrink-0 mt-0.5" />
              <div>
                <h4 className="text-sm font-bold text-amber-900 uppercase tracking-wide">Next Step: Verification & Puppy Logistics</h4>
                <p className="text-xs sm:text-sm text-amber-800 mt-1 leading-relaxed">
                  Congratulations on your adoption approval! Please click the <strong>"Chat with Adoption Support"</strong> button below or use our live chat widget at the bottom right. Quote your <strong>Reference ID ({application.reference})</strong> to finalize identity verification, sign agreements, and schedule your puppy collection or delivery.
                </p>
              </div>
            </div>
          </div>

          {/* Verification Stamp & Signature Line */}
          <div className="pt-6 border-t border-slate-200 flex flex-col sm:flex-row items-center justify-between gap-6">
            <div className="flex items-center gap-3">
              <div className="w-14 h-14 rounded-full border-2 border-red-800/30 bg-red-50 text-red-900 flex items-center justify-center font-serif text-xs font-bold text-center leading-tight p-1 shadow-inner">
                VERIFIED<br/>OFFICIAL
              </div>
              <div>
                <p className="text-xs font-bold text-slate-900">{siteName}</p>
                <p className="text-xs text-slate-500">Adoption Placement Department</p>
                <p className="text-[11px] text-slate-400 font-mono mt-0.5">ID: {application.id}</p>
              </div>
            </div>

            <div className="text-center sm:text-right">
              <div className="w-44 border-b border-slate-400 mb-1 mx-auto sm:ml-auto"></div>
              <p className="text-xs font-semibold text-slate-700">Authorized Officer Signature</p>
              <p className="text-[11px] text-slate-400">Yorkshire Adoption Home</p>
            </div>
          </div>

          {/* Action buttons on print mode / web mode */}
          <div className="pt-4 flex flex-col sm:flex-row items-center justify-center gap-3 print:hidden">
            <button
              onClick={() => {
                window.dispatchEvent(
                  new CustomEvent("open-chat", {
                    detail: {
                      message: `Hello! My adoption application (${application.reference}) for ${application.puppy_name || "a Yorkshire puppy"} has been approved. Here is my Reference ID: ${application.reference}. What are the next steps to finalize my adoption?`,
                      name: `${application.first_name} ${application.last_name}`,
                      email: application.email,
                    },
                  })
                );
              }}
              className="inline-flex items-center justify-center gap-2 w-full sm:w-auto px-8 py-3.5 bg-primary hover:bg-[#A0752F] text-primary-foreground rounded-xl font-bold shadow-lg shadow-primary/20 transition-all text-sm cursor-pointer"
            >
              <MessageSquare size={18} /> 💬 Chat with Adoption Support Now (Ref #{application.reference})
            </button>
            <a
              href={waUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center justify-center gap-2 w-full sm:w-auto px-6 py-3.5 bg-slate-800 hover:bg-slate-900 text-white rounded-xl font-medium transition-all text-sm"
            >
              <MessageCircle size={18} /> Open WhatsApp Instead
            </a>
          </div>

        </div>
      </div>
    </div>
  );
}
