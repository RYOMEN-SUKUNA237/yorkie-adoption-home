import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { createClient, type Session } from "@supabase/supabase-js";
import {
  supabase,
  isSupabaseConfigured,
  clearStoredSession,
  SUPABASE_URL,
  SUPABASE_ANON_KEY,
} from "./supabase";
import type { ProfileRow } from "./database.types";

interface AuthState {
  session: Session | null;
  profile: ProfileRow | null;
  loading: boolean;
  /** True only for a real staff account — never for an anonymous messenger visitor. */
  isStaff: boolean;
  isAdmin: boolean;
  signIn: (email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
  resetPassword: (email: string) => Promise<void>;
  /** Change your own password. Verifies `current` before setting `next`. */
  changePassword: (current: string, next: string) => Promise<void>;
  /** Set a new password from an emailed recovery link. */
  completeRecovery: (next: string) => Promise<void>;
  /**
   * True between clicking an emailed reset link and setting a new password.
   *
   * Supabase signs the visitor in to apply a recovery token, so without this
   * flag the link lands them on the dashboard already authenticated and the
   * reset silently never happens - they are simply logged in with the old
   * password still in force.
   */
  recovering: boolean;
  refreshProfile: () => Promise<void>;
}

const AuthContext = createContext<AuthState>({
  session: null,
  profile: null,
  loading: true,
  isStaff: false,
  isAdmin: false,
  signIn: async () => {},
  signOut: async () => {},
  resetPassword: async () => {},
  changePassword: async () => {},
  completeRecovery: async () => {},
  recovering: false,
  refreshProfile: async () => {},
});

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [sessionResolved, setSessionResolved] = useState(!isSupabaseConfigured);
  const [profile, setProfile] = useState<ProfileRow | null>(null);
  const [profileResolved, setProfileResolved] = useState(!isSupabaseConfigured);
  const [recovering, setRecovering] = useState(false);

  const userId = session?.user?.id ?? null;

  // -------------------------------------------------------------------
  // Session
  //
  // The onAuthStateChange callback MUST stay synchronous. supabase-js
  // holds an internal auth lock while it runs, and every PostgREST request
  // waits on that lock to attach an access token — so calling back into
  // Supabase from inside the callback (to load a profile, say) deadlocks
  // the entire client and every query on the site hangs forever.
  //
  // Session goes in here; anything that needs a query happens in the
  // effect below, outside the lock.
  // -------------------------------------------------------------------
  useEffect(() => {
    if (!supabase) return;

    let active = true;

    supabase.auth
      .getSession()
      .then(async ({ data }) => {
        if (!active) return;

        // A stored session can look perfectly valid locally and still be
        // rejected by the server — refresh token revoked, account deleted,
        // or a clock that disagrees with Supabase's. getUser() is the only
        // way to find out, because it actually asks. Dropping a dead
        // session here keeps the client on the anon key, where all the
        // public content is readable anyway.
        if (data.session) {
          const { error } = await supabase!.auth.getUser();
          if (error) {
            console.warn("[auth] stored session rejected by the server:", error.message);
            clearStoredSession();
            await supabase!.auth.signOut({ scope: "local" }).catch(() => {});
            if (active) {
              setSession(null);
              setSessionResolved(true);
            }
            return;
          }
        }

        setSession(data.session);
        setSessionResolved(true);
      })
      .catch(() => {
        if (active) setSessionResolved(true);
      });

    const { data: sub } = supabase.auth.onAuthStateChange((event, nextSession) => {
      if (!active) return;
      // Still synchronous - see the note above. Setting a flag is safe;
      // calling back into Supabase from here is not.
      if (event === "PASSWORD_RECOVERY") setRecovering(true);
      setSession(nextSession);
      setSessionResolved(true);
    });

    return () => {
      active = false;
      sub.subscription.unsubscribe();
    };
  }, []);

  // -------------------------------------------------------------------
  // Profile — a separate effect, so the query runs outside the auth lock.
  // -------------------------------------------------------------------
  const fetchProfile = useCallback(async (id: string): Promise<ProfileRow | null> => {
    if (!supabase) return null;

    // An anonymous messenger visitor has a session but no profiles row;
    // maybeSingle() returns null for them, which is exactly right.
    const { data, error } = await supabase
      .from("profiles")
      .select("*")
      .eq("id", id)
      .maybeSingle();

    if (error) {
      console.warn("[auth] could not load profile:", error.message);
      return null;
    }
    return (data as ProfileRow) ?? null;
  }, []);

  useEffect(() => {
    if (!supabase || !sessionResolved) return;

    if (!userId) {
      setProfile(null);
      setProfileResolved(true);
      return;
    }

    let active = true;
    setProfileResolved(false);

    fetchProfile(userId)
      .then((row) => {
        if (active) setProfile(row);
      })
      .finally(() => {
        if (active) setProfileResolved(true);
      });

    return () => {
      active = false;
    };
  }, [userId, sessionResolved, fetchProfile]);

  // -------------------------------------------------------------------
  // Actions
  // -------------------------------------------------------------------
  const signIn = useCallback(async (email: string, password: string) => {
    if (!supabase) throw new Error("Supabase is not configured.");
    const { error } = await supabase.auth.signInWithPassword({
      email: email.trim().toLowerCase(),
      password,
    });
    if (error) throw error;
  }, []);

  const signOut = useCallback(async () => {
    if (!supabase) return;
    await supabase.auth.signOut();
    setProfile(null);
    setSession(null);
  }, []);

  const resetPassword = useCallback(async (email: string) => {
    if (!supabase) throw new Error("Supabase is not configured.");
    const { error } = await supabase.auth.resetPasswordForEmail(email.trim().toLowerCase(), {
      redirectTo: `${window.location.origin}/admin`,
    });
    if (error) throw error;
  }, []);

  /**
   * Change your own password.
   *
   * Supabase's updateUser() will set a new password on the strength of the
   * session alone, which means an unattended logged-in laptop is enough to
   * take an account over. Re-authenticating with the current password first
   * closes that, and doubles as the typo check on the old one.
   *
   * The re-auth uses a throwaway client so a wrong current password cannot
   * disturb the session already in hand - signInWithPassword on the live
   * client would replace or drop it on the way through.
   */
  const changePassword = useCallback(async (current: string, next: string) => {
    if (!supabase) throw new Error("Supabase is not configured.");

    const { data: userData } = await supabase.auth.getUser();
    const email = userData.user?.email;
    if (!email) throw new Error("You are not signed in.");

    const probe = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const { error: reauthError } = await probe.auth.signInWithPassword({
      email,
      password: current,
    });
    await probe.auth.signOut().catch(() => {});

    if (reauthError) throw new Error("That is not your current password.");

    const { error } = await supabase.auth.updateUser({ password: next });
    if (error) throw error;
  }, []);

  /** Finish a reset started from an emailed link. */
  const completeRecovery = useCallback(async (next: string) => {
    if (!supabase) throw new Error("Supabase is not configured.");
    const { error } = await supabase.auth.updateUser({ password: next });
    if (error) throw error;
    setRecovering(false);
  }, []);

  const refreshProfile = useCallback(async () => {
    if (!userId) return;
    const row = await fetchProfile(userId);
    setProfile(row);
  }, [userId, fetchProfile]);

  const value = useMemo<AuthState>(
    () => ({
      session,
      profile,
      loading: !sessionResolved || !profileResolved,
      isStaff: Boolean(profile?.is_active),
      isAdmin: Boolean(profile?.is_active && profile.role === "admin"),
      signIn,
      signOut,
      resetPassword,
      changePassword,
      completeRecovery,
      recovering,
      refreshProfile,
    }),
    [
      session,
      profile,
      sessionResolved,
      profileResolved,
      signIn,
      signOut,
      resetPassword,
      refreshProfile,
    ]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export const useAuth = () => useContext(AuthContext);
