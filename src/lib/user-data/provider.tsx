'use client';

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type JSX, type ReactNode } from 'react';
import { getReferenceData } from '@/lib/reference';
import type { Enrollment, FollowupStat, NoncreditStatus, Profile } from '@/types/user';
import type { FieldId, ReferenceData } from '@/types/reference';
import { getRepository } from './index';
import { MOCK_STORAGE_KEY } from './mock-repository';
import type { RepoError, Result, UserDataRepository } from './repository';

interface UserDataState {
  profile: Profile | null; enrollments: Enrollment[]; interests: FieldId[];
  noncredit: NoncreditStatus[]; followupStats: FollowupStat[]; loading: boolean; error: RepoError | null;
}
interface UserDataContextValue extends UserDataState {
  reference: ReferenceData; repository: UserDataRepository;
  mutate<T>(action: () => Promise<Result<T>>): Promise<Result<T>>;
}
const initialState: UserDataState = { profile: null, enrollments: [], interests: [], noncredit: [], followupStats: [], loading: true, error: null };
const UserDataContext = createContext<UserDataContextValue | null>(null);

export function UserDataProvider({ children, repository: suppliedRepository }: { children: ReactNode; repository?: UserDataRepository }): JSX.Element {
  const repository = useMemo(() => suppliedRepository ?? getRepository(), [suppliedRepository]);
  const reference = useMemo(() => getReferenceData(), []);
  const [state, setState] = useState<UserDataState>(initialState);
  const generation = useRef(0);
  const advanceGeneration = useCallback((): number => ++generation.current, []);
  const refresh = useCallback(async (): Promise<void> => {
    const request = advanceGeneration();
    const [profile, enrollments, interests, noncredit] = await Promise.all([
      repository.getProfile(), repository.listEnrollments(), repository.getInterests(), repository.getNoncredit(),
    ]);
    const followupStats: Result<FollowupStat[]> = profile.ok && profile.data
      ? await repository.getFollowupStats(profile.data.program_id) : { ok: true, data: [] };
    if (request !== generation.current) return;
    const error = [profile, enrollments, interests, noncredit, followupStats].find((r) => !r.ok);
    setState({
      profile: profile.ok ? profile.data : null, enrollments: enrollments.ok ? enrollments.data : [],
      interests: interests.ok ? interests.data : [], noncredit: noncredit.ok ? noncredit.data : [],
      followupStats: followupStats.ok ? followupStats.data : [], loading: false,
      error: error && !error.ok ? error.error : null,
    });
  }, [advanceGeneration, repository]);

  useEffect(() => {
    void refresh();
    const sync = (event: StorageEvent): void => {
      if (event.key === null || event.key === MOCK_STORAGE_KEY) void refresh();
    };
    window.addEventListener('storage', sync);
    return () => {
      advanceGeneration();
      window.removeEventListener('storage', sync);
    };
  }, [advanceGeneration, refresh]);

  const mutate = useCallback(async <T,>(action: () => Promise<Result<T>>): Promise<Result<T>> => {
    const result = await action();
    if (result.ok) await refresh();
    else setState((current) => ({ ...current, error: result.error }));
    return result;
  }, [refresh]);
  const value = useMemo(() => ({ ...state, reference, repository, mutate }), [state, reference, repository, mutate]);
  return <UserDataContext.Provider value={value}>{children}</UserDataContext.Provider>;
}

export function useUserDataContext(): UserDataContextValue {
  const value = useContext(UserDataContext);
  if (!value) throw new Error('사용자 데이터 훅은 UserDataProvider 안에서 사용해야 합니다.');
  return value;
}
