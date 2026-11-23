import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { JSX } from 'react';
import { resolveCompletion } from '@/lib/domain/completion';
import { evaluateGraduation } from '@/lib/domain/graduation';
import { getReferenceData } from '@/lib/reference';
import { useEnrollments } from '@/lib/user-data/hooks';
import { MOCK_STORAGE_KEY, MockUserDataRepository } from '@/lib/user-data/mock-repository';
import { UserDataProvider } from '@/lib/user-data/provider';
import { demoProfile } from '@/test/fixtures/demo-user';
import type { AdmissionYear, ProgramId } from '@/types/reference';
import type { NoncreditStatus, Profile } from '@/types/user';
import { GraduationProgress } from './index';

const ref = getReferenceData();

/** 전공마다 하나씩, 목 계정 5개 */
const ACCOUNTS: ReadonlyArray<[ProgramId, AdmissionYear]> = [
  ['platform_sw_data', 2025], ['global_sw', 2025], ['ai_computing', 2026], ['adv_computing', 2026], ['adv_research', 2026],
];

beforeEach(() => localStorage.clear());
afterEach(() => cleanup());

function seed(programId: ProgramId, year: AdmissionYear): Profile {
  const profile: Profile = { ...demoProfile, program_id: programId, admission_year: year };
  localStorage.setItem(MOCK_STORAGE_KEY, JSON.stringify({
    version: 1, profile, enrollments: [], interests: [], noncredit: [], ocrItems: [],
  }));
  return profile;
}

function AddCourse({ code }: { code: string }): JSX.Element {
  const { add } = useEnrollments();
  return (
    <button type="button" onClick={() => void add({
      course_code: code, taken_year: 2026, taken_semester: 1, status: 'completed', source: 'manual', credit: null, grade: null,
    })}>과목 추가</button>
  );
}

function renderProgress(programId: ProgramId, year: AdmissionYear, extra?: JSX.Element): Profile {
  const profile = seed(programId, year);
  render(
    <UserDataProvider repository={new MockUserDataRepository()}>
      <GraduationProgress profile={profile} />
      {extra}
    </UserDataProvider>,
  );
  return profile;
}

function storedNoncredit(): NoncreditStatus[] {
  return (JSON.parse(localStorage.getItem(MOCK_STORAGE_KEY) ?? '{}') as { noncredit: NoncreditStatus[] }).noncredit;
}

function valueText(element: HTMLElement): string | null {
  return element.getAttribute('aria-valuetext');
}

async function row(name: string): Promise<HTMLElement> {
  return screen.findByRole('listitem', { name });
}

describe('GraduationProgress', () => {
  it.each(ACCOUNTS)('%s %i학번 목 계정의 모든 요건을 보여 준다', async (programId, year) => {
    const profile = renderProgress(programId, year);
    const report = evaluateGraduation({ profile, completion: resolveCompletion([], ref), noncredit: [], ref });
    const total = report.items.find((i) => i.kind === 'total');

    expect(valueText(await screen.findByRole('progressbar', { name: '총 졸업학점 진행률' }))).toBe(`0학점 / ${total?.required}학점`);
    for (const item of report.items.filter((i) => i.kind === 'bucket' || i.kind === 'requirement' || i.kind === 'checklist')) {
      expect((await row(item.label)).dataset.status).toBe(item.status);
    }
    const programName = ref.programs.find((p) => p.program_id === programId)?.name ?? '';
    expect(screen.getByText(new RegExp(`${programName} · ${year}학번`))).toBeDefined();
  });

  it('이수 기록을 추가하면 총 학점과 전공필수를 바로 다시 계산한다', async () => {
    renderProgress('ai_computing', 2026, <AddCourse code="COME0331" />);
    const credit = ref.courses.get('COME0331')?.credit ?? 0;
    const link = await screen.findByRole('link', { name: '자료구조 노선도에서 보기' });
    expect(link.getAttribute('href')).toBe('/roadmap?course=COME0331');

    fireEvent.click(screen.getByRole('button', { name: '과목 추가' }));

    await waitFor(() => expect(valueText(screen.getByRole('progressbar', { name: '총 졸업학점 진행률' }))).toBe(`${credit}학점 / 130학점`));
    expect(screen.queryByRole('link', { name: '자료구조 노선도에서 보기' })).toBeNull();
    expect(valueText(screen.getByRole('progressbar', { name: '전공필수 진행률' }))).toBe('1과목 / 7과목');
  });

  it('체크형 비학점 요건은 미입력 → 충족 → 미입력으로 바뀌고 저장된다', async () => {
    renderProgress('adv_computing', 2026);
    const item = await row('연구실습 이수');
    expect(item.dataset.status).toBe('unanswered');

    fireEvent.click(within(item).getByRole('radio', { name: '충족' }));
    await waitFor(() => expect(item.dataset.status).toBe('met'));
    expect(storedNoncredit()).toMatchObject([{ checklist_key: 'research_practice', status: 'met' }]);

    fireEvent.click(within(item).getByRole('radio', { name: '미충족' }));
    await waitFor(() => expect(item.dataset.status).toBe('unmet'));

    fireEvent.click(within(item).getByRole('radio', { name: '입력 안 함' }));
    await waitFor(() => expect(item.dataset.status).toBe('unanswered'));
    expect(storedNoncredit()).toEqual([]);
  });

  it('공인영어 점수는 규칙의 기준 점수로 충족 여부를 정한다', async () => {
    renderProgress('adv_computing', 2026);
    const item = await row('공인영어 성적');
    expect(within(item).getByText('기준 700점 이상이면 충족으로 판정합니다.')).toBeDefined();

    fireEvent.change(within(item).getByRole('spinbutton', { name: '점수' }), { target: { value: '650' } });
    fireEvent.click(within(item).getByRole('button', { name: '저장' }));
    await waitFor(() => expect(item.dataset.status).toBe('unmet'));

    fireEvent.change(within(item).getByRole('spinbutton', { name: '점수' }), { target: { value: '720' } });
    fireEvent.click(within(item).getByRole('button', { name: '저장' }));
    await waitFor(() => expect(item.dataset.status).toBe('met'));
    expect(storedNoncredit()).toMatchObject([{ checklist_key: 'english_score', status: 'met', input_value: '720' }]);
  });

  it('기준 점수가 트랙마다 다르면 학생이 충족 여부를 고른다', async () => {
    renderProgress('global_sw', 2025);
    const item = await row('공인영어 성적');

    fireEvent.change(within(item).getByRole('spinbutton', { name: '점수' }), { target: { value: '750' } });
    fireEvent.click(within(item).getByRole('button', { name: '저장' }));
    expect((await within(item).findByRole('alert')).textContent).toBe('충족 여부를 선택해 주세요.');
    expect(item.dataset.status).toBe('unanswered');

    fireEvent.click(within(item).getByRole('radio', { name: '충족' }));
    fireEvent.click(within(item).getByRole('button', { name: '저장' }));
    await waitFor(() => expect(item.dataset.status).toBe('met'));
  });

  it('과목으로 못 채운 영역 요건은 과목 외 충족을 입력할 수 있다', async () => {
    renderProgress('ai_computing', 2026);
    const item = await row('졸업자격인정 - 실용영어');
    expect(item.dataset.status).toBe('unanswered');
    expect(within(item).getByText('4학점 더 필요')).toBeDefined();

    fireEvent.click(within(item).getByRole('radio', { name: '충족' }));
    await waitFor(() => expect(item.dataset.status).toBe('met'));
    expect(within(item).queryByText('4학점 더 필요')).toBeNull();
  });

  it('맨 위 요약에 이수·남은 학점과 그 밖의 요건 상태를 한 번에 보여 준다', async () => {
    const profile = renderProgress('adv_computing', 2026);
    const report = evaluateGraduation({ profile, completion: resolveCompletion([], ref), noncredit: [], ref });
    const total = report.items.find((i) => i.kind === 'total');
    const checklist = report.items.filter((i) => i.kind === 'checklist');

    const summary = await screen.findByRole('region', { name: '나의 졸업 현황' });
    // 이수 기록이 없으면 남은 졸업학점 = 기준 학점
    expect(within(summary).getByText('남은 졸업학점').parentElement?.querySelector('strong')?.textContent)
      .toBe(String(total?.required));
    expect(within(summary).getByText(`요건 ${report.summary.met} / ${report.summary.total} 충족`)).toBeDefined();
    for (const item of checklist) expect(within(summary).getByText(item.label)).toBeDefined();
  });

  it('판정할 수 없는 항목은 확인 필요 배지와 근거를 보여 준다', async () => {
    renderProgress('platform_sw_data', 2025);
    const design = await row('설계');
    expect(design.dataset.status).toBe('unknown');
    expect(within(design).getByText('확인 필요')).toBeDefined();
    expect(within(design).getByText(/설계학점\(courses\.design_credit\)/)).toBeDefined();
    expect(within(design).getByText(/^근거: /)).toBeDefined();
    // 학과 확인 목록 영역은 화면에서 뺐다. 판정 불가 항목은 각 행의 '확인 필요' 배지와 근거로만 보여 준다.
    expect(screen.queryByRole('heading', { name: '학과 확인이 필요한 항목' })).toBeNull();
  });
});
