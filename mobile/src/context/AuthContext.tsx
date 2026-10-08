import { createContext, useContext, useEffect, useMemo, useState, type PropsWithChildren } from "react";
import * as api from "../lib/api";
import { getToken, removeToken, saveToken } from "../lib/storage";
import type { User } from "../types/auth";

type AuthContextValue = {
  user: User | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (email: string, username: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: PropsWithChildren): React.JSX.Element {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const clearSession = async (): Promise<void> => {
    await removeToken();
    setUser(null);
  };

  useEffect(() => {
    const restoreSession = async (): Promise<void> => {
      const token = await getToken();
      if (!token) {
        setIsLoading(false);
        return;
      }

      try {
        const result = await api.getMe(token, clearSession);
        setUser(result.user);
      } catch {
        await clearSession();
      } finally {
        setIsLoading(false);
      }
    };

    void restoreSession();
  }, []);

  const signIn = async (email: string, password: string): Promise<void> => {
    const result = await api.login({ email, password });
    await saveToken(result.token);
    setUser(result.user);
  };

  const signUp = async (email: string, username: string, password: string): Promise<void> => {
    const result = await api.register({ email, username, password });
    await saveToken(result.token);
    setUser(result.user);
  };

  const value = useMemo(
    () => ({
      user,
      isLoading,
      isAuthenticated: user !== null,
      login: signIn,
      register: signUp,
      logout: clearSession,
    }),
    [isLoading, user],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export const useAuth = (): AuthContextValue => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used inside AuthProvider");
  }
  return context;
};
