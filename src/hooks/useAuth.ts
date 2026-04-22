import { useCallback, useEffect, useState } from "react";

const AUTH_STORAGE_KEY = "quizAuth";
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL?.trim() || "";

type AuthState = {
  token: string;
  expiresAt: number;
  user: {
    id: string;
    email: string;
  };
  spotifyTokens?: {
    accessToken: string;
    refreshToken: string;
  } | null;
};

type LoginResponse = AuthState & {
  created: boolean;
  accessToken?: string;
  refreshToken?: string;
};

const apiUrl = (path: string) => `${API_BASE_URL}${path}`;

const readStoredAuth = (): AuthState | null => {
  try {
    const raw = localStorage.getItem(AUTH_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as AuthState & { user?: { id?: string; email?: string; login?: string } };
    const email = parsed?.user?.email ?? parsed?.user?.login;
    if (!parsed?.token || !parsed?.user?.id || !email || parsed.expiresAt <= Date.now()) {
      localStorage.removeItem(AUTH_STORAGE_KEY);
      return null;
    }
    return {
      ...parsed,
      user: {
        id: parsed.user.id,
        email,
      },
    };
  } catch {
    localStorage.removeItem(AUTH_STORAGE_KEY);
    return null;
  }
};

export const useAuth = () => {
  const [auth, setAuth] = useState<AuthState | null>(() => readStoredAuth());
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (!auth) {
      localStorage.removeItem(AUTH_STORAGE_KEY);
      return;
    }
    localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(auth));
  }, [auth]);

  const login = useCallback(async (email: string, password: string) => {
    setIsLoading(true);
    try {
      const response = await fetch(apiUrl("/api/auth/login"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: email.trim(),
          password,
        }),
      });

      if (!response.ok) {
        const text = await response.text();
        throw new Error(text || `HTTP ${response.status}`);
      }

      const nextAuth = (await response.json()) as LoginResponse;
      const spotifyTokens =
        nextAuth.accessToken && nextAuth.refreshToken
          ? {
              accessToken: nextAuth.accessToken,
              refreshToken: nextAuth.refreshToken,
            }
          : null;
      const persisted = {
        token: nextAuth.token,
        expiresAt: nextAuth.expiresAt,
        user: nextAuth.user,
        spotifyTokens,
      };
      setAuth(persisted);
      return nextAuth;
    } finally {
      setIsLoading(false);
    }
  }, []);

  const logout = useCallback(() => {
    setAuth(null);
  }, []);

  return {
    auth,
    token: auth?.token ?? null,
    user: auth?.user ?? null,
    spotifyTokens: auth?.spotifyTokens ?? null,
    isAuthenticated: !!auth,
    isLoading,
    login,
    logout,
  };
};

export type UseAuthReturn = ReturnType<typeof useAuth>;
