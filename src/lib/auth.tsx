import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import type { Session } from "@supabase/supabase-js";
import { supabase, isSupabaseConfigured, clearStoredSession } from "./supabase";
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
  refreshProfile: async () => {},
});

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [sessionResolved, setSessionResolved] = useState(!isSupabaseConfigured);
  const [profile, setProfile] = useState<ProfileRow | null>(null);
  const [profileResolved, setProfileResolved] = useState(!isSupabaseConfigured);

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

    const { data: sub } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      if (!active) return;
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
