import { createServerClient } from '@supabase/ssr';
import type { SupabaseClient } from '@supabase/supabase-js';
import { cookies } from 'next/headers';
import { getSupabaseConfig } from './config';

// Use from Route Handlers or Server Actions, where cookie writes are allowed.
export async function createServerSupabaseClient(): Promise<SupabaseClient | null> {
  const config = getSupabaseConfig();
  if (!config) return null;

  const cookieStore = await cookies();
  return createServerClient(config.url, config.key, {
    cookies: {
      getAll: () => cookieStore.getAll(),
      setAll: (entries) => {
        for (const { name, value, options } of entries) cookieStore.set(name, value, options);
      },
    },
  });
}
