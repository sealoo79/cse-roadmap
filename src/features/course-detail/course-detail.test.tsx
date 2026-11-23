import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { useState, type JSX } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useRecommendations } from '@/features/recommend/useRecommendations';
import { MockUserDataRepository } from '@/lib/user-data/mock-repository';
import { UserDataProvider } from '@/lib/user-data/provider';
import { demoEnrollments, demoProfile } from '@/test/fixtures/demo-user';
import type { CourseCode } from '@/types/reference';
import { CourseDetailPanel } from './index';

vi.mock('@/features/recommend/useRecommendations', () => ({ useRecommendations: vi.fn() }));

function PanelHarness({ initialCode }: { initialCode: CourseCode | null }): JSX.Element {
  const [code, setCode] = useState(initialCode);
  return <>
    <button type="button" onClick={() => setCode('COMP0206')}>기초프로그래밍 선택</button>
    <CourseDetailPanel code={code} onClose={() => setCode(null)} onNavigate={setCode} />
  </>;
}

function repositoryFor(profile = demoProfile, enrollments = demoEnrollments): MockUserDataRepository {
  const stored = JSON.stringify({ version: 1, profile, enrollments, interests: [], noncredit: [], ocrItems: [] });
  return new MockUserDataRepository(() => ({ getItem: () => stored, setItem: () => {} }));
}

function openPanel(code: CourseCode | null, repository = repositoryFor()): void {
  render(<UserDataProvider repository={repository}><PanelHarness initialCode={code} /></UserDataProvider>);
}

beforeEach(() => vi.mocked(useRecommendations).mockReturnValue([]));
afterEach(cleanup);

describe('과목 상세 패널', () => {
  it('shows completed credit and course information, allows navigation, and restores focus on Escape', async () => {
    openPanel(null);
    const station = screen.getByRole('button', { name: '기초프로그래밍 선택' });
    station.focus();
    fireEvent.click(station);
    const panel = within(await screen.findByRole('dialog', { name: '기초프로그래밍' }));
    expect(await panel.findByText('이수 완료')).toBeTruthy();
    expect(panel.getByText('3학점')).toBeTruthy();
    expect(panel.getByText('2 / 2')).toBeTruthy();
    expect(panel.getByText('1학기', { exact: true })).toBeTruthy();
    expect(panel.getByRole('link', { name: /프로그래밍기초 COMP0204/ }).getAttribute('href')).toBe('/roadmap?course=COMP0204');
    expect(document.activeElement).toBe(panel.getByRole('button', { name: '과목 상세 닫기' }));

    fireEvent.click(await panel.findByRole('link', { name: /자료구조 COME0331/ }));
    const next = await screen.findByRole('dialog', { name: '자료구조' });
    fireEvent.keyDown(next, { key: 'Escape' });
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(document.activeElement).toBe(station);
  });

  it('warns only about unmet official prerequisite groups', async () => {
    const profile = { ...demoProfile, program_id: 'platform_sw_data', admission_year: 2025 } as const;
    const enrolled = [{ ...demoEnrollments[0], course_code: 'COMP0205' }];
    openPanel('ITEC0401', repositoryFor(profile, enrolled));

    const panel = within(await screen.findByRole('dialog', { name: '종합설계프로젝트1' }));
    expect(panel.getByText('미이수')).toBeTruthy();
    expect(await panel.findByText('미충족 · 사전승인 필요')).toBeTruthy();
    expect(panel.getByText('충족', { exact: true })).toBeTruthy();
    expect(panel.getByRole('link', { name: /COMP0217/ })).toBeTruthy();
    expect(panel.getByRole('link', { name: /ITEC0402/ })).toBeTruthy();
  });

  it('lists a corequisite in either direction and recognizes in-progress study', async () => {
    const profile = { ...demoProfile, program_id: 'global_sw', admission_year: 2025 } as const;
    const enrolled = [{ ...demoEnrollments[0], course_code: 'COME0331', status: 'incomplete' as const }];
    openPanel('COMP0216', repositoryFor(profile, enrolled));

    const panel = within(await screen.findByRole('dialog', { name: '자료구조응용' }));
    expect(await panel.findByText('동시 수강', { exact: true })).toBeTruthy();
    expect(panel.getByRole('link', { name: /COME0331/ })).toBeTruthy();
    expect(panel.queryByText('동시 수강 필요')).toBeNull();
  });

  it('renders recommendation reasons and count data from the existing hooks', async () => {
    const repository = repositoryFor();
    vi.spyOn(repository, 'getFollowupStats').mockResolvedValue({ ok: true, data: [{
      program_id: demoProfile.program_id, from_code: 'COMP0204', to_code: 'COME0331', base_count: 10, follower_count: 4,
    }] });
    vi.mocked(useRecommendations).mockReturnValue([{
      code: 'COME0331', score: 1, warning: null, fromCodes: ['COMP0206'],
      reasons: [
        { type: 'interest', label: '관심 분야 일치' },
        { type: 'required', label: '전공필수 미이수' },
        { type: 'successor', label: '이수 과목의 후수 과목' },
        { type: 'followup', label: '함께 수강', fromCode: 'COMP0206' },
      ],
    }]);
    openPanel('COME0331', repository);

    const panel = within(await screen.findByRole('dialog', { name: '자료구조' }));
    expect(panel.getByRole('heading', { name: '다음 학기 추천 이유' })).toBeTruthy();
    expect(panel.getByText('관심 분야 일치')).toBeTruthy();
    expect(panel.getByText('전공필수 미이수')).toBeTruthy();
    expect(panel.getByText('이수 과목의 후수 과목')).toBeTruthy();
    await waitFor(() => expect(panel.getByText('프로그래밍기초 이수자 10명 중 4명 수강')).toBeTruthy());
  });
});
