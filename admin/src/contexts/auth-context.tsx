import { apiFetch } from "@/lib/api";
import { createContext, use, useCallback, useEffect, useMemo, useState, type ReactNode } from "react";

export interface AuthUser {
  id: number;
  email: string;
  name: string;
  firstName: string | null;
  lastName: string | null;
  bio: string | null;
  website: string | null;
  role: "admin" | "editor" | "author";
  avatarUrl: string | null;
  createdAt: string;
}

interface AuthContextValue {
  user: AuthUser | null;
  loading: boolean;
  needsSetup: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (input: { email: string; name: string; password: string }) => Promise<void>;
  logout: () => Promise<void>;
  refresh: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [needsSetup, setNeedsSetup] = useState(false);

  const refresh = useCallback(async () => {
    try {
      const { user } = await apiFetch<{ user: AuthUser }>("/api/auth/me");
      setUser(user);
    } catch {
      setUser(null);
      try {
        const { needsSetup } = await apiFetch<{ needsSetup: boolean }>("/api/auth/setup-status");
        setNeedsSetup(needsSetup);
      } catch {
        setNeedsSetup(false);
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const login = useCallback(async (email: string, password: string) => {
    const { user } = await apiFetch<{ user: AuthUser }>("/api/auth/login", {
      method: "POST",
      body: JSON.stringify({ email, password }),
    });
    setUser(user);
    setNeedsSetup(false);
  }, []);

  const register = useCallback(async (input: { email: string; name: string; password: string }) => {
    const { user } = await apiFetch<{ user: AuthUser }>("/api/auth/register", {
      method: "POST",
      body: JSON.stringify(input),
    });
    setUser(user);
    setNeedsSetup(false);
  }, []);

  const logout = useCallback(async () => {
    await apiFetch("/api/auth/logout", { method: "POST" });
    setUser(null);
  }, []);

  const value = useMemo(
    () => ({ user, loading, needsSetup, login, register, logout, refresh }),
    [user, loading, needsSetup, login, register, logout, refresh],
  );

  return <AuthContext value={value}>{children}</AuthContext>;
}

export function useAuth(): AuthContextValue {
  const ctx = use(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
