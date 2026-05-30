'use client';

import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { createClient } from '@/lib/supabase';
import { clearStoredAppSession, establishSupabaseSession, restoreStoredAppSession } from '@/lib/authSession';
import { getRoleDashboard } from '@/lib/utils';
import { useRouter } from 'next/navigation';

interface User {
  id: string;
  name: string;
  email: string;
  role: 'admin' | 'qc' | 'ppic' | 'warehouse';
  is_active: boolean;
}

interface AuthContextType {
  user: User | null;
  token: string | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const router = useRouter();
  const [supabase] = useState(() => createClient());

  useEffect(() => {
    const restoreSession = async () => {
      try {
        const storedSession = await restoreStoredAppSession<User>(supabase, localStorage);
        if (storedSession) {
          setToken(storedSession.token);
          setUser(storedSession.user);
        }
      } catch {
        clearStoredAppSession(localStorage);
      } finally {
        setLoading(false);
      }
    };
    restoreSession();
  }, [supabase]);

  const login = async (email: string, password: string) => {
    const backendUrl = process.env.NEXT_PUBLIC_API_URL;

    // Strategy 1: Try backend (if configured and running)
    if (backendUrl) {
      try {
        const res = await fetch(`${backendUrl}/api/auth/login`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email, password }),
          signal: AbortSignal.timeout(4000), // 4s timeout
        });

        if (res.ok) {
          const data = await res.json();
          await establishSupabaseSession(supabase, data);
          localStorage.setItem('aromos_token', data.access_token);
          localStorage.setItem('aromos_user', JSON.stringify(data.user));
          setToken(data.access_token);
          setUser(data.user);
          router.push(getRoleDashboard(data.user.role));
          return;
        }

        // Backend responded with error — propagate it
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.error || 'Login gagal');
      } catch (err: unknown) {
        // If it's a network error (backend not running), fall through to Supabase direct
        const isNetworkError =
          err instanceof Error && (
            err.name === 'TypeError' ||
            err.name === 'AbortError' ||
            err.message.includes('fetch') ||
            err.message.includes('Failed to fetch') ||
            err.message.includes('network')
          );

        if (!isNetworkError) {
          // Backend was reachable but returned an auth error — don't retry
          throw err;
        }
        // Backend unreachable — fall through to Supabase direct login
        console.warn('Backend tidak tersedia, menggunakan Supabase direct login...');
      }
    }

    // Strategy 2: Login directly via Supabase client
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) throw new Error(error.message);

    const accessToken = data.session.access_token;

    // Fetch user profile from users table
    const { data: profile, error: profileError } = await supabase
      .from('users')
      .select('id, name, email, role, is_active')
      .eq('id', data.user.id)
      .single();

    if (profileError || !profile) {
      // Profile not in users table yet — create minimal one from auth data
      const minimalUser: User = {
        id: data.user.id,
        name: data.user.email?.split('@')[0] || 'User',
        email: data.user.email || email,
        role: 'admin', // default until profile set
        is_active: true,
      };
      localStorage.setItem('aromos_token', accessToken);
      localStorage.setItem('aromos_user', JSON.stringify(minimalUser));
      setToken(accessToken);
      setUser(minimalUser);
      router.push(getRoleDashboard(minimalUser.role));
      return;
    }

    if (!profile.is_active) {
      throw new Error('Akun ini telah dinonaktifkan');
    }

    localStorage.setItem('aromos_token', accessToken);
    localStorage.setItem('aromos_user', JSON.stringify(profile));
    setToken(accessToken);
    setUser(profile as User);
    router.push(getRoleDashboard(profile.role));
  };

  const logout = async () => {
    try {
      await supabase.auth.signOut();
    } catch {}
    clearStoredAppSession(localStorage);
    setUser(null);
    setToken(null);
    router.push('/login');
  };

  return (
    <AuthContext.Provider value={{ user, token, loading, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
