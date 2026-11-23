import { createBrowserSupabaseClient } from '@/lib/supabase/client';
import { MockUserDataRepository } from './mock-repository';
import { SupabaseUserDataRepository } from './supabase-repository';
import type { UserDataRepository } from './repository';

let repository: UserDataRepository | undefined;
export function getRepository(): UserDataRepository {
  repository ??= process.env.NEXT_PUBLIC_USE_MOCK === '1'
    ? new MockUserDataRepository()
    : new SupabaseUserDataRepository(createBrowserSupabaseClient());
  return repository;
}
export type { RepoError, Result, UserDataRepository } from './repository';
