import type { AccessContext } from "@albatrans/contracts";
import type { Session } from "@supabase/supabase-js";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode
} from "react";
import { getSupabaseClient } from "../infrastructure/supabase/client";
import { loadAccessContext, signOut as performSignOut } from "./auth-service";

interface AuthState {
  configured: boolean;
  loading: boolean;
  session: Session | null;
  access: AccessContext | null;
  error: string | null;
  refreshAccess: () => Promise<void>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const supabase = getSupabaseClient();
  const [loading, setLoading] = useState(Boolean(supabase));
  const [session, setSession] = useState<Session | null>(null);
  const [access, setAccess] = useState<AccessContext | null>(null);
  const [error, setError] = useState<string | null>(null);

  const hydrateAccess = useCallback(async (nextSession: Session | null) => {
    setSession(nextSession);
    setAccess(null);
    setError(null);

    if (!nextSession) {
      setLoading(false);
      return;
    }

    setLoading(true);
    try {
      setAccess(await loadAccessContext(nextSession.user.id));
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : "No se pudo resolver el acceso de tu cuenta."
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!supabase) {
      setLoading(false);
      return;
    }

    let active = true;
    void supabase.auth.getSession().then(({ data }) => {
      if (active) void hydrateAccess(data.session);
    });

    const { data: listener } = supabase.auth.onAuthStateChange(
      (_event, nextSession) => {
        if (active) void hydrateAccess(nextSession);
      }
    );

    return () => {
      active = false;
      listener.subscription.unsubscribe();
    };
  }, [hydrateAccess, supabase]);

  const refreshAccess = useCallback(async () => {
    if (session) await hydrateAccess(session);
  }, [hydrateAccess, session]);

  const handleSignOut = useCallback(async () => {
    await performSignOut();
    setSession(null);
    setAccess(null);
    setError(null);
  }, []);

  const value = useMemo<AuthState>(
    () => ({
      configured: Boolean(supabase),
      loading,
      session,
      access,
      error,
      refreshAccess,
      signOut: handleSignOut
    }),
    [access, error, handleSignOut, loading, refreshAccess, session, supabase]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthState {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth debe utilizarse dentro de AuthProvider.");
  }
  return context;
}
