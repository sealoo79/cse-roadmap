export const schoolEmailDomain = 'knu.ac.kr';

export function isSchoolGoogleSession(claims: {
  email?: string;
  app_metadata?: { provider?: string };
}): boolean {
  if (claims.app_metadata?.provider !== 'google' || typeof claims.email !== 'string') return false;
  const [username, domain, ...extra] = claims.email.toLowerCase().split('@');
  return Boolean(username && !/\s/.test(username)) && domain === schoolEmailDomain && extra.length === 0;
}

export type SessionState = 'guest' | 'onboarding' | 'ready';

export function getAccessRedirect(
  pathname: string,
  session: SessionState,
): '/' | '/onboarding' | '/roadmap' | null {
  if (session === 'guest') return pathname === '/' ? null : '/';
  if (session === 'onboarding') return pathname === '/onboarding' ? null : '/onboarding';
  return pathname === '/' || pathname === '/onboarding' ? '/roadmap' : null;
}
