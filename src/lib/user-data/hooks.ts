'use client';

import { useMemo } from 'react';
import type { ChecklistKey, FieldId, ReferenceData } from '@/types/reference';
import type { Enrollment, FollowupStat, NewEnrollment, NoncreditStatus, Profile } from '@/types/user';
import { resolveCompletion, type CompletionState } from '@/lib/domain/completion';
import { useUserDataContext } from './provider';
import type { RepoError, Result, UserDataRepository } from './repository';

export function useReference(): ReferenceData { return useUserDataContext().reference; }
export function useProfile(): {
  profile: Profile | null; loading: boolean; error: RepoError | null;
  save(input: Parameters<UserDataRepository['upsertProfile']>[0]): Promise<Result<Profile>>;
} {
  const c = useUserDataContext();
  return { profile: c.profile, loading: c.loading, error: c.error, save: (input) => c.mutate(() => c.repository.upsertProfile(input)) };
}
export function useEnrollments(): {
  items: Enrollment[]; loading: boolean;
  add(input: NewEnrollment): Promise<Result<Enrollment>>;
  update(id: string, patch: Partial<NewEnrollment>): Promise<Result<Enrollment>>;
  remove(id: string): Promise<Result<void>>;
} {
  const c = useUserDataContext();
  return { items: c.enrollments, loading: c.loading,
    add: (input) => c.mutate(() => c.repository.addEnrollment(input)),
    update: (id, patch) => c.mutate(() => c.repository.updateEnrollment(id, patch)),
    remove: (id) => c.mutate(() => c.repository.deleteEnrollment(id)) };
}
export function useInterests(): { fieldIds: FieldId[]; save(ids: FieldId[]): Promise<Result<FieldId[]>> } {
  const c = useUserDataContext();
  return { fieldIds: c.interests, save: (ids) => c.mutate(() => c.repository.setInterests(ids)) };
}
export function useNoncredit(): {
  items: NoncreditStatus[];
  set(key: ChecklistKey, status: 'met' | 'unmet', value: string | null): Promise<Result<NoncreditStatus>>;
  clear(key: ChecklistKey): Promise<Result<void>>;
} {
  const c = useUserDataContext();
  return { items: c.noncredit,
    set: (key, status, value) => c.mutate(() => c.repository.setNoncredit(key, status, value)),
    clear: (key) => c.mutate(() => c.repository.clearNoncredit(key)) };
}
export function useFollowupStats(): FollowupStat[] { return useUserDataContext().followupStats; }
export function useCompletion(): CompletionState {
  const { enrollments, reference } = useUserDataContext();
  return useMemo(() => resolveCompletion(enrollments, reference), [enrollments, reference]);
}
