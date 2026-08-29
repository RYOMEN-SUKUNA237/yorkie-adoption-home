import { useState } from "react";
import { RouterProvider, useRouter } from "./router";
import { AuthProvider } from "../lib/auth";
import { SettingsProvider, useSettings } from "../lib/settings";
import { settingString } from "../services/misc";
import HomePage from "./pages/Home";
import PuppiesPage from "./pages/Puppies";
import PuppyDetailPage from "./pages/PuppyDetail";
import ApplyPage from "./pages/Apply";
import ApplyReceivedPage from "./pages/ApplyReceived";
import ApplyDeclinedPage from "./pages/ApplyDeclined";
import GuidesPage from "./pages/Guides";
import GuideDetailPage from "./pages/GuideDetail";
import AboutPage from "./pages/About";
import Messenger from "./components/Messenger";
import AdminLayout from "./pages/admin/AdminLayout";
import Overview from "./pages/admin/Overview";
import Applications from "./pages/admin/Applications";
import Messages from "./pages/admin/Messages";
import PuppiesAdmin from "./pages/admin/PuppiesAdmin";
import GuidesAdmin from "./pages/admin/GuidesAdmin";
import Waitlist from "./pages/admin/Waitlist";
import Settings from "./pages/admin/Settings";
import EmailsAdmin from "./pages/admin/EmailsAdmin";
import WhatsAppLogs from "./pages/admin/WhatsAppLogs";
import AdoptionCertificate from "./pages/AdoptionCertificate";
import { Menu, X } from "lucide-react";

const NAV_LINKS = [
  { href: "/puppies", label: "Puppies" },
  { href: "/guides", label: "Guides" },
  { href: "/about", label: "About" },
];

function Nav() {
  const { path, navigate } = useRouter();
  const { settings } = useSettings();
  const [menuOpen, setMenuOpen] = useState(false);

  const siteName = settingString(settings, "site_name", "Yorkshire Adoption Home");

  const isActive = (href: string) =>
    href === "/" ? path === "/" : path.startsWith(href);

  const go = (href: string) => {
    navigate(href);
    setMenuOpen(false);
  };

  return (
    <>
      <header className="sticky top-0 z-40 bg-background/95 backdrop-blur-sm border-b border-border">
        <div className="px-6 md:px-16 lg:px-24 h-14 flex items-center justify-between gap-6">
          {/* Logo */}
          <button
            onClick={() => go("/")}
            className="focus:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded-sm min-w-0"
          >
            <span
              className="text-sm sm:text-base font-light text-foreground tracking-tight truncate block"
              style={{ fontFamily: "'Newsreader', Georgia, serif" }}
            >
              {siteName}
            </span>
          </button>

          {/* Desktop nav */}
          <nav className="hidden md:flex items-center gap-6">
            {NAV_LINKS.map((link) => (
              <button
                key={link.href}
                onClick={() => go(link.href)}
                className={`text-sm transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded-sm ${
                  isActive(link.href)
                    ? "text-foreground font-medium"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                {link.label}
              </button>
            ))}
          </nav>

          <div className="flex items-center gap-3 shrink-0">
            <button
              onClick={() => go("/apply")}
              className="hidden md:inline-flex bg-primary text-primary-foreground px-5 py-2 text-sm font-medium rounded-sm hover:bg-[#A0752F] transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              Apply
            </button>
            <button
              className="md:hidden p-2 -mr-2 text-muted-foreground hover:text-foreground transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded-sm"
              onClick={() => setMenuOpen(!menuOpen)}
              aria-label={menuOpen ? "Close menu" : "Open menu"}
              aria-expanded={menuOpen}
            >
              {menuOpen ? <X size={20} /> : <Menu size={20} />}
            </button>
          </div>
        </div>
      </header>

      {/* Mobile menu */}
      {menuOpen && (
        <div className="md:hidden fixed inset-0 z-30 bg-background flex flex-col pt-14">
          <nav className="flex flex-col px-6 pt-8 gap-2">
            {NAV_LINKS.map((link) => (
              <button
                key={link.href}
                onClick={() => go(link.href)}
                className="text-left py-4 border-b border-border text-lg text-foreground hover:text-accent transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded-sm"
                style={{ fontFamily: "'Newsreader', Georgia, serif" }}
              >
                {link.label}
              </button>
            ))}
          </nav>
          <div className="px-6 pt-8">
            <button
              onClick={() => go("/apply")}
              className="w-full bg-primary text-primary-foreground py-4 text-sm font-medium rounded-sm hover:bg-[#A0752F] transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              Start an application
            </button>
          </div>
        </div>
      )}
    </>
  );
}

function Footer() {
  const { navigate } = useRouter();
  const { settings } = useSettings();

  const siteName = settingString(settings, "site_name", "Yorkshire Adoption Home");
  const tagline = settingString(settings, "tagline", "");
  const email = settingString(settings, "contact_email", "");
  const phone = settingString(settings, "contact_phone", "");
  const whatsapp = settingString(settings, "whatsapp_number", "");
  const address = settingString(settings, "address", "");
  const instagram = settingString(settings, "instagram_url", "");

  return (
    <footer className="bg-[#23282F] text-[#9AA5B2]">
      <div className="px-6 md:px-16 lg:px-24 py-14 sm:py-16">
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-10 mb-12">
          <div>
            <p
              className="text-[#F7F5F2] text-base font-light mb-3"
              style={{ fontFamily: "'Newsreader', Georgia, serif" }}
            >
              {siteName}
            </p>
            <p className="text-sm leading-relaxed max-w-xs">{tagline}</p>
          </div>
          <div>
            <p className="text-[10px] tracking-[0.2em] uppercase font-medium text-[#5C7A99] mb-4">
              Navigate
            </p>
            <div className="flex flex-col gap-2.5">
              {[
                { href: "/puppies", label: "Available puppies" },
                { href: "/guides", label: "Owner guides" },
                { href: "/about", label: "About us" },
                { href: "/apply", label: "Apply to adopt" },
              ].map((link) => (
                <button
                  key={link.href}
                  onClick={() => navigate(link.href)}
                  className="text-sm text-left hover:text-[#F7F5F2] transition-colors focus:outline-none focus-visible:ring-1 focus-visible:ring-[#5C7A99] rounded-sm"
                >
                  {link.label}
                </button>
              ))}
            </div>
          </div>
          <div>
            <p className="text-[10px] tracking-[0.2em] uppercase font-medium text-[#5C7A99] mb-4">
              Contact
            </p>
            <div className="flex flex-col gap-2.5 text-sm">
              {phone && (
                <a
                  href={`tel:${phone.replace(/[^\d+]/g, "")}`}
                  className="hover:text-[#F7F5F2] transition-colors"
                >
                  {phone}
                </a>
              )}
              {whatsapp && (
                <a
                  href={`https://wa.me/${whatsapp.replace(/\D/g, "")}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="hover:text-[#F7F5F2] transition-colors"
                >
                  WhatsApp
                </a>
              )}
              {email && (
                <a
                  href={`mailto:${email}`}
                  className="hover:text-[#F7F5F2] transition-colors break-all"
                >
                  {email}
                </a>
              )}
              {instagram && (
                <a
                  href={instagram}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="hover:text-[#F7F5F2] transition-colors"
                >
                  Instagram
                </a>
              )}
              {address && (
                <p className="leading-relaxed whitespace-pre-line pt-1">{address}</p>
              )}
            </div>
          </div>
        </div>
        <div className="border-t border-[#3A4550] pt-6 flex flex-wrap items-center justify-between gap-4 text-xs">
          <p>
            © {new Date().getFullYear()} {siteName}. All rights reserved.
          </p>
          <button
            onClick={() => navigate("/admin")}
            className="text-[#5A6675] hover:text-[#9AA5B2] transition-colors focus:outline-none"
          >
            Admin
          </button>
        </div>
      </div>
    </footer>
  );
}

/** Admin routes live under /admin and render inside the dashboard shell. */
function AdminRoutes({ path }: { path: string }) {
  return (
    <AdminLayout>
      {path === "/admin" && <Overview />}
      {path.startsWith("/admin/applications") && <Applications />}
      {path.startsWith("/admin/messages") && <Messages />}
      {path.startsWith("/admin/emails") && <EmailsAdmin />}
      {path.startsWith("/admin/whatsapp-logs") && <WhatsAppLogs />}
      {path.startsWith("/admin/puppies") && <PuppiesAdmin />}
      {path.startsWith("/admin/guides") && <GuidesAdmin />}
      {path.startsWith("/admin/waitlist") && <Waitlist />}
      {path.startsWith("/admin/settings") && <Settings />}
    </AdminLayout>
  );
}

function Routes() {
  const { path } = useRouter();

  if (path === "/admin" || path.startsWith("/admin/")) {
    return <AdminRoutes path={path} />;
  }

  const certId =
    path.match(/^\/certificate\/([^/]+)$/)?.[1] ||
    path.match(/^\/approval-proof\/([^/]+)$/)?.[1];
  if (certId) {
    return <AdoptionCertificate />;
  }

  const puppySlug = path.match(/^\/puppies\/([^/]+)$/)?.[1];
  const guideSlug = path.match(/^\/guides\/([^/]+)$/)?.[1];

  const isApplyFlow =
    path === "/apply" || path === "/apply/received" || path === "/apply/declined";

  const knownPath =
    path === "/" ||
    path === "/puppies" ||
    path === "/guides" ||
    path === "/about" ||
    isApplyFlow ||
    !!puppySlug ||
    !!guideSlug;

  return (
    <>
      <Nav />
      <div className="min-h-[calc(100vh-3.5rem)]">
        {path === "/" && <HomePage />}
        {path === "/puppies" && <PuppiesPage />}
        {puppySlug && <PuppyDetailPage slug={puppySlug} />}
        {path === "/guides" && <GuidesPage />}
        {guideSlug && <GuideDetailPage slug={guideSlug} />}
        {path === "/about" && <AboutPage />}
        {path === "/apply" && <ApplyPage />}
        {path === "/apply/received" && <ApplyReceivedPage />}
        {path === "/apply/declined" && <ApplyDeclinedPage />}
        {!knownPath && <NotFound />}
      </div>
      {!isApplyFlow && <Footer />}
      <PublicMessenger />
    </>
  );
}

/** The messenger follows the visitor across the public site, but not the form. */
function PublicMessenger() {
  const { path } = useRouter();
  const { settings } = useSettings();

  if (path === "/apply") return null;

  return <Messenger settings={settings} />;
}

function NotFound() {
  const { navigate } = useRouter();
  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-6 text-center">
      <p
        className="text-6xl font-light text-muted mb-4"
        style={{ fontFamily: "'Newsreader', Georgia, serif" }}
      >
        404
      </p>
      <p className="text-foreground font-medium mb-2">Page not found</p>
      <p className="text-sm text-muted-foreground mb-8">This page does not exist.</p>
      <button
        onClick={() => navigate("/")}
        className="bg-primary text-primary-foreground px-6 py-3 text-sm font-medium rounded-sm hover:bg-[#A0752F] transition-colors"
      >
        Go home
      </button>
    </div>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <SettingsProvider>
        <RouterProvider>
          <Routes />
        </RouterProvider>
      </SettingsProvider>
    </AuthProvider>
  );
}
