import type { JSX, ReactNode } from 'react';
import { act, cleanup, renderHook, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { useInterests } from '@/lib/user-data/hooks';
import { MockUserDataRepository } from '@/lib/user-data/mock-repository';
import { UserDataProvider } from '@/lib/user-data/provider';
import { useRecommendations } from './useRecommendations';

const repository = new MockUserDataRepository();

function wrapper({ children }: { children: ReactNode }): JSX.Element {
  return <UserDataProvider repository={repository}>{children}</UserDataProvider>;
}

beforeEach(() => window.localStorage.clear());
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

it('저장된 관심 분야가 바뀌면 공통 추천 훅이 우선순위 순으로 다시 정렬한다', async () => {
  const { result } = renderHook(() => ({
    recommendations: useRecommendations(),
    interests: useInterests(),
  }), { wrapper });
  await waitFor(() => expect(result.current.recommendations.length).toBeGreaterThan(0));

  await act(async () => { await result.current.interests.save(['common']); });
  const commonCodes = result.current.recommendations.map(({ code }) => code);
  expect(commonCodes).toContain('ITEC0401');
  expect(commonCodes).not.toContain('COMP0324');

  await act(async () => { await result.current.interests.save(['ai_data']); });
  const aiCodes = result.current.recommendations.map(({ code }) => code);
  expect(aiCodes).toContain('COMP0324');
  expect(aiCodes).toContain('ITEC0401');
  expect(aiCodes.indexOf('ITEC0401')).toBeGreaterThan(commonCodes.indexOf('ITEC0401'));
  // 시연 계정은 1학년 1학기만 들었으므로 다음 학기(1학년 2학기) 전공필수인 자료구조가 관심 분야와 상관없이 맨 앞이다.
  expect(commonCodes[0]).toBe('COME0331');
  expect(aiCodes[0]).toBe('COME0331');
});
