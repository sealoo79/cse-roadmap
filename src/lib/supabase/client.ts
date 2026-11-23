import { createBrowserClient } from '@supabase/ssr';
import type { SupabaseClient } from '@supabase/supabase-js';
import { getSupabaseConfig } from './config';

export function createBrowserSupabaseClient(): SupabaseClient | null {
  const config = getSupabaseConfig();
  return config ? createBrowserClient(config.url, config.key) : null;
}
