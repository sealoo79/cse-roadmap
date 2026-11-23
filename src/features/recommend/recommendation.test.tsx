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

it('저장된 관심 분야가 바뀌면 공통 추천 훅이 점수 순으로 다시 정렬한다', async () => {
  const { result } = renderHook(() => ({
    recommendations: useRecommendations(),
    interests: useInterests(),
  }), { wrapper });
  await waitFor(() => expect(result.current.recommendations.length).toBeGreaterThan(0));

  await act(async () => { await result.current.interests.save(['common']); });
  const commonCodes = result.current.recommendations.map(({ code }) => code);
  expect(commonCodes).toContain('COMP0319');
  expect(commonCodes).not.toContain('COMP0218');

  await act(async () => { await result.current.interests.save(['ai_data']); });
  const aiCodes = result.current.recommendations.map(({ code }) => code);
  expect(aiCodes).toContain('COMP0218');
  expect(aiCodes).toContain('COMP0319');
  expect(aiCodes.indexOf('COMP0319')).toBeGreaterThan(commonCodes.indexOf('COMP0319'));
  const scores = result.current.recommendations.map(({ score }) => score);
  expect(scores).toEqual([...scores].sort((a, b) => b - a));
});

it('공개 가능한 집계와 과목별 노선도 링크를 표시하고 분야별로 목록을 좁힌다', async () => {
  await repository.setInterests(['ai_data', 'system']);
  const program_id = demoProfile.program_id;
  vi.spyOn(repository, 'getFollowupStats').mockResolvedValue({ ok: true, data: [
    { program_id, from_code: 'COMP0204', to_code: 'COMP0218', base_count: 9, follower_count: 6 },
    { program_id, from_code: 'COMP0204', to_code: 'ELEC0462', base_count: 2, follower_count: 2 },
  ] });

  render(<RecommendationList />, { wrapper });
  const link = await screen.findByRole('link', { name: '인공지능과컴퓨팅 노선도에서 보기' });
  expect(link.getAttribute('href')).toBe('/roadmap?course=COMP0218');
  expect(screen.getByText(/같은 전공 선배 9명 중 6명/)).toBeTruthy();
  expect(screen.queryByText(/같은 전공 선배 2명/)).toBeNull();

  fireEvent.change(screen.getByRole('combobox', { name: '관심 분야 필터' }), { target: { value: 'system' } });
  const list = within(screen.getByRole('list', { name: '추천 순위' }));
  expect(list.queryByRole('link', { name: '인공지능과컴퓨팅 노선도에서 보기' })).toBeNull();
  expect(list.getByRole('link', { name: '시스템프로그래밍 노선도에서 보기' })).toBeTruthy();
});
