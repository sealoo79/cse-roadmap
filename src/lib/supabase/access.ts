export type SessionState = 'guest' | 'onboarding' | 'ready';

export function getAccessRedirect(
  pathname: string,
  session: SessionState,
): '/' | '/onboarding' | '/roadmap' | null {
  if (session === 'guest') return pathname === '/' ? null : '/';
  if (session === 'onboarding') return pathname === '/onboarding' ? null : '/onboarding';
  return pathname === '/' || pathname === '/onboarding' ? '/roadmap' : null;
}
