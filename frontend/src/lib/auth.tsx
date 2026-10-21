'use client';

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  type ReactNode,
} from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { usePathname, useRouter } from 'next/navigation';
import { ApiError, setCsrfToken, setUnauthorizedHandler } from './api/client';
import { authApi } from './api/endpoints';
import type { AuthResult, Locale, User } from './api/types';

type Status = 'loading' | 'authenticated' | 'anonymous';
interface AuthValue {
  user: User | null;
  status: Status;
  login: (email: string, password: string) => Promise<User>;
  register: (b: {
    email: string;
    password: string;
    fullName: string;
    locale: Locale;
  }) => Promise<User>;
  logout: () => Promise<void>;
  setUser: (u: User) => void;
}
const Ctx = createContext<AuthValue | null>(null);
const ME_KEY = ['auth', 'me'] as const;

export function AuthProvider({ children }: { children: ReactNode }) {
  const qc = useQueryClient();
  const router = useRouter();
  const pathname = usePathname();
  const pathRef = useRef(pathname);
  useEffect(() => {
    pathRef.current = pathname;
  }, [pathname]);
  const expiring = useRef(false);

  const me = useQuery<User | null>({
    queryKey: ME_KEY,
    queryFn: async () => {
      try {
        const r = await authApi.me();
        setCsrfToken(r.csrfToken);
        return r.user;
      } catch (e) {
        if (e instanceof ApiError && e.status === 401) {
          setCsrfToken(null);
          return null;
        }
        throw e;
      }
    },
    staleTime: 5 * 60_000,
    retry: (n, e) => !(e instanceof ApiError && e.status === 401) && n < 1,
  });

  // A 401 from any protected request means the session ended: reset state once and go to /login.
  useEffect(() => {
    setUnauthorizedHandler(() => {
      if (expiring.current) return;
      expiring.current = true;
      setCsrfToken(null);
      qc.clear();
      qc.setQueryData(ME_KEY, null);
      const next = encodeURIComponent(pathRef.current || '/');
      router.replace(`/login?expired=1&next=${next}`);
      setTimeout(() => (expiring.current = false), 1500);
    });
    return () => setUnauthorizedHandler(null);
  }, [qc, router]);

  const establish = useCallback(
    (r: AuthResult) => {
      setCsrfToken(r.csrfToken);
      qc.setQueryData(ME_KEY, r.user);
      return r.user;
    },
    [qc],
  );

  const value = useMemo<AuthValue>(
    () => ({
      user: me.data ?? null,
      status: me.isPending ? 'loading' : me.data ? 'authenticated' : 'anonymous',
      login: async (email, password) => {
        qc.removeQueries({ predicate: (q) => q.queryKey[0] !== 'auth' });
        return establish(await authApi.login({ email, password }));
      },
      register: async (b) => establish(await authApi.register(b)),
      logout: async () => {
        try {
          await authApi.logout();
        } catch (e) {
          // An already-expired session is effectively logged out; anything else must not leave stale UI behind either.
          if (!(e instanceof ApiError && e.status === 401)) console.error('logout failed');
        } finally {
          setCsrfToken(null);
          qc.clear();
          qc.setQueryData(ME_KEY, null);
        }
      },
      setUser: (u) => qc.setQueryData(ME_KEY, u),
    }),
    [me.data, me.isPending, qc, establish],
  );
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useAuth(): AuthValue {
  const v = useContext(Ctx);
  if (!v) throw new Error('useAuth must be used inside <AuthProvider>');
  return v;
}
