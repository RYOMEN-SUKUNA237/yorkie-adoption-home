import { useEffect, useState, type ReactNode } from "react";
import {
  LayoutDashboard,
  FileText,
  Dog,
  BookOpen,
  MessagesSquare,
  ListChecks,
  Settings as SettingsIcon,
  Menu,
  X,
  LogOut,
  ExternalLink,
  Mail,
  Send,
} from "lucide-react";
import { useRouter } from "../../router";
import { useAuth } from "../../../lib/auth";
import { isSupabaseConfigured } from "../../../lib/supabase";
import { initials } from "../../../lib/format";
import { subscribeToInbox } from "../../../services/messages";
import { supabase } from "../../../lib/supabase";
import AdminLogin, { SetNewPassword } from "./AdminLogin";
import SetupRequired from "./SetupRequired";
import { LoadingState } from "../../components/admin/ui";

export interface AdminNavItem {
  href: string;
  label: string;
  icon: typeof LayoutDashboard;
}

export const ADMIN_NAV: AdminNavItem[] = [
  { href: "/admin", label: "Overview", icon: LayoutDashboard },
  { href: "/admin/applications", label: "Applications", icon: FileText },
  { href: "/admin/messages", label: "Messages", icon: MessagesSquare },
  { href: "/admin/emails", label: "Emails", icon: Mail },
  { href: "/admin/whatsapp-logs", label: "WhatsApp Logs", icon: Send },
  { href: "/admin/puppies", label: "Puppies", icon: Dog },
  { href: "/admin/guides", label: "Guides", icon: BookOpen },
  { href: "/admin/waitlist", label: "Waitlist", icon: ListChecks },
  { href: "/admin/settings", label: "Settings", icon: SettingsIcon },
];

/**
 * Admin shell.
 *
 * Gates on a `profiles` row rather than merely on being signed in — an
 * anonymous messenger visitor also holds a session, and must never reach
 * the dashboard.
 */
export default function AdminLayout({ children }: { children: ReactNode }) {
  const { path, navigate } = useRouter();
  const { loading, session, isStaff, profile, signOut, recovering } = useAuth();
  const [menuOpen, setMenuOpen] = useState(false);
  const [unreadMessages, setUnreadMessages] = useState(0);

  // Live unread badge on the Messages tab.
  useEffect(() => {
    if (!isStaff || !supabase) return;

    const db = supabase;
    const load = async () => {
      const { data } = await db
        .from("conversations")
        .select("unread_for_admin")
        .gt("unread_for_admin", 0);
      setUnreadMessages(
        (data ?? []).reduce((sum, row) => sum + (row.unread_for_admin as number), 0)
      );
    };

    void load();
    return subscribeToInbox(() => void load());
  }, [isStaff]);

  // Close the mobile drawer whenever the route changes.
  useEffect(() => setMenuOpen(false), [path]);

  if (!isSupabaseConfigured) return <SetupRequired />;
  if (loading) {
    return (
      <div className="min-h-screen bg-sidebar flex items-center justify-center">
        <LoadingState label="Checking your session…" />
      </div>
    );
  }
  // Recovery is checked before the staff gate, not after. Supabase signs the
  // visitor in to apply the recovery token, so by the time we get here they
  // look like an ordinary signed-in member of staff — fall through and they
  // land on the dashboard with the old password still in force, having been
  // shown no way to set a new one.
  if (recovering) return <SetNewPassword />;
  if (!session || !isStaff) return <AdminLogin signedInButNotStaff={Boolean(session) && !isStaff} />;

  const isActive = (href: string) =>
    href === "/admin" ? path === "/admin" : path.startsWith(href);

  const navLinks = (
    <nav className="flex-1 px-3 py-4 flex flex-col gap-0.5 overflow-y-auto">
      {ADMIN_NAV.map((item) => {
        const Icon = item.icon;
        const active = isActive(item.href);
        return (
          <button
            key={item.href}
            onClick={() => navigate(item.href)}
            aria-current={active ? "page" : undefined}
            className={`w-full text-left px-3 py-2.5 rounded-sm text-sm transition-colors flex items-center gap-2.5 focus:outline-none focus-visible:ring-2 focus-visible:ring-ring ${
              active
                ? "bg-sidebar-accent text-sidebar-primary font-medium"
                : "text-muted-foreground hover:text-foreground hover:bg-sidebar-accent/50"
            }`}
          >
            <Icon size={16} className="shrink-0" />
            <span className="flex-1 truncate">{item.label}</span>
            {item.href === "/admin/messages" && unreadMessages > 0 && (
              <span className="shrink-0 min-w-[20px] h-5 px-1.5 rounded-full bg-primary text-primary-foreground text-[11px] font-semibold flex items-center justify-center">
                {unreadMessages > 99 ? "99+" : unreadMessages}
              </span>
            )}
          </button>
        );
      })}
    </nav>
  );

  const accountBlock = (
    <div className="px-3 py-3 border-t border-sidebar-border">
      <div className="flex items-center gap-2.5 px-2 py-2">
        <span className="shrink-0 w-8 h-8 rounded-full bg-accent text-accent-foreground text-xs font-semibold flex items-center justify-center">
          {initials(profile?.full_name || profile?.email)}
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-xs font-medium text-foreground truncate">
            {profile?.full_name || profile?.email}
          </p>
          <p className="text-[11px] text-muted-foreground capitalize">{profile?.role}</p>
        </div>
      </div>
      <div className="flex flex-col gap-0.5 mt-1">
        <button
          onClick={() => navigate("/")}
          className="w-full text-left px-2 py-2 text-xs text-muted-foreground hover:text-foreground transition-colors rounded-sm flex items-center gap-2"
        >
          <ExternalLink size={13} /> View the site
        </button>
        <button
          onClick={() => void signOut()}
          className="w-full text-left px-2 py-2 text-xs text-muted-foreground hover:text-foreground transition-colors rounded-sm flex items-center gap-2"
        >
          <LogOut size={13} /> Sign out
        </button>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-sidebar flex">
      {/* Desktop sidebar */}
      <aside className="hidden lg:flex flex-col w-60 bg-sidebar border-r border-sidebar-border shrink-0 h-screen sticky top-0">
        <div className="px-5 py-5 border-b border-sidebar-border">
          <button onClick={() => navigate("/admin")} className="text-left w-full">
            <p className="text-[10px] tracking-[0.2em] uppercase text-muted-foreground font-medium">
              Yorkshire Adoption Home
            </p>
            <p
              className="text-sm font-semibold text-foreground mt-0.5"
              style={{ fontFamily: "'Newsreader', Georgia, serif" }}
            >
              Dashboard
            </p>
          </button>
        </div>
        {navLinks}
        {accountBlock}
      </aside>

      {/* Mobile / tablet drawer */}
      {menuOpen && (
        <div className="lg:hidden fixed inset-0 z-50 flex">
          <div
            className="absolute inset-0 bg-foreground/30 backdrop-blur-sm"
            onClick={() => setMenuOpen(false)}
          />
          <aside className="relative w-[min(17rem,85vw)] bg-sidebar border-r border-sidebar-border flex flex-col h-full">
            <div className="px-5 py-4 border-b border-sidebar-border flex items-center justify-between">
              <p
                className="text-sm font-semibold text-foreground"
                style={{ fontFamily: "'Newsreader', Georgia, serif" }}
              >
                Dashboard
              </p>
              <button
                onClick={() => setMenuOpen(false)}
                aria-label="Close menu"
                className="p-1.5 -mr-1.5 text-muted-foreground hover:text-foreground"
              >
                <X size={18} />
              </button>
            </div>
            {navLinks}
            {accountBlock}
          </aside>
        </div>
      )}

      {/* Main column */}
      <div className="flex-1 flex flex-col min-w-0 min-h-screen">
        <div className="lg:hidden bg-background border-b border-border px-4 py-3 flex items-center justify-between sticky top-0 z-40">
          <button
            onClick={() => setMenuOpen(true)}
            aria-label="Open menu"
            className="p-1.5 -ml-1.5 text-muted-foreground hover:text-foreground rounded-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-ring relative"
          >
            <Menu size={20} />
            {unreadMessages > 0 && (
              <span className="absolute top-0 right-0 w-2 h-2 rounded-full bg-primary" />
            )}
          </button>
          <p className="text-sm font-semibold text-foreground">
            {ADMIN_NAV.find((i) => isActive(i.href))?.label ?? "Dashboard"}
          </p>
          <span className="w-8 h-8 rounded-full bg-accent text-accent-foreground text-[11px] font-semibold flex items-center justify-center">
            {initials(profile?.full_name || profile?.email)}
          </span>
        </div>

        <main className="flex-1 flex flex-col min-w-0">{children}</main>
      </div>
    </div>
  );
}
