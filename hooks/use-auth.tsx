'use client';

import { createContext, useCallback, useContext, useEffect, useState, ReactNode } from 'react';
import { User } from '@/types';

interface AuthContextType {
  user: User | null;
  isLoading: boolean;
  signOut: () => Promise<void>;
  refreshUser: () => Promise<void>;
  // Dev-only mock-user controls — inert now that real auth runs in dev too.
  // Kept on the interface so existing dev-tools components still type-check.
  setDevUser?: (userId: string) => void;
  updateDevUser?: (updates: Partial<User>) => void;
  isDev?: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const fetchUser = useCallback(async () => {
    try {
      const res = await fetch('/api/auth/me', { credentials: 'include' });
      if (!res.ok) {
        setUser(null);
        return;
      }
      const data = await res.json();
      setUser((data?.user as User | null) ?? null);
    } catch (error) {
      console.error('Auth error:', error);
      setUser(null);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchUser();
  }, [fetchUser]);

  async function signOut() {
    try {
      await fetch('/api/auth/logout', { method: 'POST', credentials: 'include' });
    } finally {
      setUser(null);
    }
  }

  async function refreshUser() {
    setIsLoading(true);
    await fetchUser();
  }

  return (
    <AuthContext.Provider
      value={{
        user,
        isLoading,
        signOut,
        refreshUser,
        isDev: false,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
