import type { JSX, ReactNode } from 'react';
import { act, cleanup, renderHook, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { getReferenceData } from '@/lib/reference';
import * as completionModule from '@/lib/domain/completion';
import { UserDataProvider } from './provider';
import { MockUserDataRepository } from './mock-repository';
import { useCompletion, useEnrollments, useNoncredit, useProfile } from './hooks';

beforeEach(() => window.localStorage.clear());
afterEach(() => { cleanup(); vi.restoreAllMocks(); });
function wrapper({ children }: { children: ReactNode }): JSX.Element {
  return <UserDataProvider repository={repository}>{children}</UserDataProvider>;
}
const repository = new MockUserDataRepository();

it('이수 기록이 바뀌면 훅 데이터를 갱신하고 이수 계산을 다시 실행한다', async () => {
  const spy = vi.spyOn(completionModule, 'resolveCompletion');
  const hook = renderHook(() => ({ enrollments: useEnrollments(), profile: useProfile(), completion: useCompletion(), noncredit: useNoncredit() }), { wrapper });
  await waitFor(() => expect(hook.result.current.profile.loading).toBe(false));
  expect(hook.result.current.profile.profile?.email).toBe('demo@example.invalid');
  const before = hook.result.current.enrollments.items.length;
  const calls = spy.mock.calls.length;
  await act(async () => {
    await hook.result.current.enrollments.add({ course_code: [...getReferenceData().courses.keys()][0], taken_year: 2026, taken_semester: 2, status: 'incomplete', source: 'manual', credit: null, grade: null });
  });
  expect(hook.result.current.enrollments.items).toHaveLength(before + 1);
  expect(spy.mock.calls.length).toBeGreaterThan(calls);
  expect(spy.mock.lastCall?.[0]).toHaveLength(before + 1);
  const item = hook.result.current.enrollments.items.at(-1);
  if (!item) throw new Error('추가 기록 없음');
  await act(async () => { await hook.result.current.enrollments.remove(item.id); });
  expect(hook.result.current.enrollments.items).toHaveLength(before);
});

it('저장 실패는 profile.error에 노출하고 기존 기록을 유지한다', async () => {
  const hook = renderHook(() => ({ profile: useProfile(), enrollments: useEnrollments() }), { wrapper });
  await waitFor(() => expect(hook.result.current.profile.loading).toBe(false));
  const before = hook.result.current.enrollments.items.length;
  await act(async () => {
    await hook.result.current.enrollments.add({ course_code: 'XXXX9999', taken_year: 2026, taken_semester: 1, status: 'completed', source: 'manual', credit: null, grade: null });
  });
  expect(hook.result.current.profile.error?.code).toBe('invalid_key');
  expect(hook.result.current.enrollments.items).toHaveLength(before);
});
