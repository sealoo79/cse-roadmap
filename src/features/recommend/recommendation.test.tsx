import type { JSX, ReactNode } from 'react';
import { act, cleanup, fireEvent, render, renderHook, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { useInterests } from '@/lib/user-data/hooks';
import { MockUserDataRepository } from '@/lib/user-data/mock-repository';
import { UserDataProvider } from '@/lib/user-data/provider';
import { demoProfile } from '@/test/fixtures/demo-user';
import { RecommendationList } from './RecommendationList';
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

it('공개 가능한 집계와 과목별 노선도 링크를 표시하고 분야별로 목록을 좁힌다', async () => {
  await repository.setInterests(['ai_data', 'system']);
  const program_id = demoProfile.program_id;
  vi.spyOn(repository, 'getFollowupStats').mockResolvedValue({ ok: true, data: [
    { program_id, from_code: 'COMP0204', to_code: 'COMP0324', base_count: 9, follower_count: 6 },
    { program_id, from_code: 'COMP0204', to_code: 'ELEC0462', base_count: 2, follower_count: 2 },
  ] });

  render(<RecommendationList />, { wrapper });
  const link = await screen.findByRole('link', { name: '인공지능 노선도에서 보기' });
  expect(link.getAttribute('href')).toBe('/roadmap?course=COMP0324');
  expect(screen.getByText(/같은 전공 선배 9명 중 6명/)).toBeTruthy();
  expect(screen.queryByText(/같은 전공 선배 2명/)).toBeNull();

  fireEvent.change(screen.getByRole('combobox', { name: '관심 분야 필터' }), { target: { value: 'system' } });
  const list = within(screen.getByRole('list', { name: '추천 순위' }));
  expect(list.queryByRole('link', { name: '인공지능 노선도에서 보기' })).toBeNull();
  expect(list.getByRole('link', { name: '시스템프로그래밍 노선도에서 보기' })).toBeTruthy();
});
