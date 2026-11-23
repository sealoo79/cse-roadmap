export const useMockAuth = process.env.NEXT_PUBLIC_USE_MOCK === '1';
export const mockSessionCookie = 'cse-roadmap-demo-session';

export function getSupabaseConfig(): { url: string; key: string } | null {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  return url && key ? { url, key } : null;
}
