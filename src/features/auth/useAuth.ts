'use client';

import { useEffect, useState, useSyncExternalStore } from 'react';
import { demoProfile } from '@/test/fixtures/demo-user';
import { createBrowserSupabaseClient } from '@/lib/supabase/client';
import { getSupabaseConfig, mockSessionCookie, useMockAuth } from '@/lib/supabase/config';

interface AuthUser {
  id: string;
  email: string | null;
}

interface AuthState {
  user: AuthUser | null;
  loading: boolean;
  signInWithGoogle(): Promise<void>;
  signOut(): Promise<void>;
}

function setMockSession(active: boolean): void {
  const secure = window.location.protocol === 'https:' ? '; Secure' : '';
  document.cookie = `${mockSessionCookie}=${active ? '1' : ''}; Path=/; Max-Age=${active ? 86400 : 0}; SameSite=Lax${secure}`;
}

function readMockSession(): boolean {
  return useMockAuth && document.cookie.split(';').some((cookie) => cookie.trim() === `${mockSessionCookie}=1`);
}

// Mock sign-in and sign-out both navigate, so the snapshot is read on the next page load.
function subscribeToMockSession(): () => void {
  return () => {};
}

function readServerMockSession(): boolean {
  return false;
}

export function useAuth(): AuthState {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(!useMockAuth && Boolean(getSupabaseConfig()));
  const mockSignedIn = useSyncExternalStore(subscribeToMockSession, readMockSession, readServerMockSession);

  useEffect(() => {
    if (useMockAuth) return;
    const client = createBrowserSupabaseClient();
    if (!client) return;
    const { data: { subscription } } = client.auth.onAuthStateChange((_event, session) => {
      const authUser = session?.user;
      setUser(authUser ? { id: authUser.id, email: authUser.email ?? null } : null);
      setLoading(false);
    });
    return () => subscription.unsubscribe();
  }, []);

  async function signInWithGoogle(): Promise<void> {
    if (useMockAuth) {
      setMockSession(true);
      // Reload so the middleware receives the new cookie on a document request.
      window.location.assign(new URL('/roadmap', window.location.origin));
      return;
    }

    const client = createBrowserSupabaseClient();
    if (!client) throw new Error('Supabase 로그인 설정을 확인해 주세요.');

    const { error } = await client.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: new URL('/auth/callback', window.location.origin).href },
    });
    if (error) throw new Error('Google 로그인에 연결할 수 없습니다. 다시 시도해 주세요.');
  }

  async function signOut(): Promise<void> {
    if (useMockAuth) setMockSession(false);
    else {
      const client = createBrowserSupabaseClient();
      if (!client) throw new Error('Supabase 로그인 설정을 확인해 주세요.');
      const { error } = await client.auth.signOut({ scope: 'local' });
      if (error) throw new Error('로그아웃하지 못했습니다. 다시 시도해 주세요.');
    }
    window.location.replace('/');
  }

  const currentUser = useMockAuth
    ? mockSignedIn ? { id: demoProfile.id, email: demoProfile.email } : null
    : user;
  return { user: currentUser, loading, signInWithGoogle, signOut };
}
