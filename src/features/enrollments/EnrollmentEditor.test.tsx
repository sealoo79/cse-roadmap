import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { getReferenceData } from '@/lib/reference';
import { evaluateGraduation } from '@/lib/domain/graduation';
import { useCompletion, useNoncredit, useProfile, useReference } from '@/lib/user-data/hooks';
import { MockUserDataRepository } from '@/lib/user-data/mock-repository';
import { UserDataProvider } from '@/lib/user-data/provider';
import type { JSX } from 'react';
import { EnrollmentEditor, searchCourses } from './index';

beforeEach(() => localStorage.clear());
afterEach(() => { cleanup(); vi.restoreAllMocks(); });

function Calculations(): JSX.Element {
  const completion = useCompletion();
  const { profile } = useProfile();
  const { items: noncredit } = useNoncredit();
  const ref = useReference();
  const report = profile && evaluateGraduation({ profile, completion, noncredit, ref });

  return <>
    <output aria-label="이수 판정">{completion.isCompleted('CHEM0506') ? '이수' : '미이수'}</output>
    <output aria-label="졸업요건 총 인정 학점">{report && report.items.find((item) => item.kind === 'total')?.earned}</output>
  </>;
}

function renderEditor(repository: MockUserDataRepository, onDone?: () => void): void {
  render(<UserDataProvider repository={repository}>
    <form onSubmit={(event) => event.preventDefault()}>
      <EnrollmentEditor mode={onDone ? 'onboarding' : 'manage'} programId="adv_computing" admissionYear={2026} onDone={onDone} />
    </form>
    <Calculations />
  </UserDataProvider>);
}

async function openCourse(code: string): Promise<void> {
  fireEvent.click(await screen.findByRole('button', { name: '과목 직접 추가' }));
  fireEvent.change(screen.getByRole('searchbox', { name: '과목 검색' }), { target: { value: code } });
  const results = screen.getByRole('list', { name: '과목 검색 결과' });
  fireEvent.click(within(results).getByRole('button', { name: new RegExp(code, 'i') }));
}

function setTerm(year: string, semester: string): void {
  fireEvent.change(screen.getByLabelText('수강 연도'), { target: { value: year } });
  fireEvent.change(screen.getByLabelText('수강 학기'), { target: { value: semester } });
}

describe('searchCourses', () => {
  it('전공·교양에서 과목명과 부분 코드를 검색하고 동일 과목명을 코드로 구분한다', () => {
    const ref = getReferenceData();
    expect(searchCourses(' 일반화학 실험 ', ref).map((course) => course.course_code))
      .toEqual(expect.arrayContaining(['CHEM0506', 'SCED0213']));
    expect(searchCourses('cltr02', ref, { limit: 3 })).toHaveLength(3);
    expect(searchCourses('cltr0205', ref, { limit: 1 })[0]?.course_code).toBe('CLTR0205');
    expect(searchCourses(' ', ref)).toEqual([]);
  });
});

describe('EnrollmentEditor', () => {
  it('동명 과목의 코드·개설학과를 표시하고 CRUD 직후 이수 판정과 졸업 학점을 갱신한다', async () => {
    const repository = new MockUserDataRepository();
    renderEditor(repository);
    fireEvent.click(await screen.findByRole('button', { name: '과목 직접 추가' }));
    fireEvent.change(screen.getByRole('searchbox'), { target: { value: '일반화학실험' } });
    const result = screen.getByRole('button', { name: /CHEM0506.*바이오섬유소재학과/ });
    expect(screen.getByRole('button', { name: /SCED0213.*통합과학교육전공/ })).toBeDefined();
    fireEvent.click(result);
    expect((screen.getByLabelText('학점') as HTMLInputElement).value).toBe('2');
    const total = screen.getByLabelText('졸업요건 총 인정 학점');
    const base = Number(total.textContent);
    expect(base).toBeGreaterThan(0);

    setTerm('2025', '4');
    fireEvent.click(screen.getByRole('button', { name: '수강 기록 추가' }));
    const edit = await screen.findByRole('button', { name: /CHEM0506 수강 기록 수정/ });
    expect(screen.getByLabelText('이수 판정').textContent).toBe('이수');
    expect(total.textContent).toBe(String(base + 2));
    expect(await repository.listEnrollments()).toMatchObject({
      ok: true, data: expect.arrayContaining([expect.objectContaining({ course_code: 'CHEM0506', taken_year: 2025, taken_semester: 4 })]),
    });

    fireEvent.click(edit);
    fireEvent.change(screen.getByLabelText('학점'), { target: { value: '2.5' } });
    fireEvent.click(screen.getByRole('button', { name: '변경사항 저장' }));
    await waitFor(() => expect(total.textContent).toBe(String(base + 2.5)));

    fireEvent.click(screen.getByRole('button', { name: /CHEM0506 수강 기록 삭제/ }));
    const confirmation = screen.getByRole('group', { name: '수강 기록 확인' });
    fireEvent.click(within(confirmation).getByRole('button', { name: '기록 삭제' }));
    await waitFor(() => expect(total.textContent).toBe(String(base)));
    expect(screen.getByLabelText('이수 판정').textContent).toBe('미이수');
  });

  it('수강 학기를 지정하지 않으면 저장하지 않는다', async () => {
    const repository = new MockUserDataRepository();
    const add = vi.spyOn(repository, 'addEnrollment');
    renderEditor(repository);
    await openCourse('CLTR0205');
    setTerm('2026', '');
    fireEvent.click(screen.getByRole('button', { name: '수강 기록 추가' }));
    expect(screen.getByRole('alert').textContent).toBe('수강 학기를 선택해 주세요.');
    expect(add).not.toHaveBeenCalled();
  });

  it('같은 학기의 동일 코드 중복을 막고 다른 학기의 재수강은 확인 후 저장한다', async () => {
    const repository = new MockUserDataRepository();
    const add = vi.spyOn(repository, 'addEnrollment');
    renderEditor(repository);
    await openCourse('COMP0216');
    setTerm('2026', '1');
    fireEvent.click(screen.getByRole('button', { name: '수강 기록 추가' }));
    expect(screen.getByRole('alert').textContent).toContain('기존 기록을 수정');
    expect(add).not.toHaveBeenCalled();

    setTerm('2026', '2');
    fireEvent.click(screen.getByRole('button', { name: '수강 기록 추가' }));
    expect(add).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: '재수강으로 저장' }));
    await screen.findByText('1과목을 등록했습니다.');
    expect(add).toHaveBeenCalledTimes(1);
    expect(add).toHaveBeenCalledWith(expect.objectContaining({ course_code: 'COMP0216', taken_semester: 2 }));
  });

  it('교육과정의 학기를 실제 수강 연도에 연결해 여러 과목을 등록하고 다음 단계로 진행한다', async () => {
    const repository = new MockUserDataRepository();
    const add = vi.spyOn(repository, 'addEnrollment');
    const onDone = vi.fn();
    renderEditor(repository, onDone);
    fireEvent.click(await screen.findByRole('button', { name: '교육과정에서 추가' }));
    fireEvent.change(screen.getByLabelText('실제 수강 연도'), { target: { value: '2027' } });
    fireEvent.click(screen.getByRole('checkbox', { name: /COMP0218/ }));
    fireEvent.click(screen.getByRole('checkbox', { name: /COME0301/ }));
    expect(screen.getByText('2과목 선택')).toBeDefined();
    fireEvent.click(screen.getByRole('button', { name: '선택 과목 등록' }));
    await screen.findByText('2과목을 등록했습니다.');
    expect(add.mock.calls.map(([input]) => [input.course_code, input.taken_year, input.taken_semester]))
      .toEqual([['COMP0218', 2027, 1], ['COME0301', 2027, 1]]);
    expect(screen.getByText('0과목 선택')).toBeDefined();
    fireEvent.click(screen.getByRole('button', { name: '다음: 관심 분야' }));
    expect(onDone).toHaveBeenCalledOnce();
  });

  it('일부 저장에 실패하면 성공한 과목을 제외하고 남은 과목을 다시 저장할 수 있다', async () => {
    const repository = new MockUserDataRepository();
    const originalAdd = repository.addEnrollment.bind(repository);
    const add = vi.spyOn(repository, 'addEnrollment');
    add.mockImplementationOnce(originalAdd)
      .mockResolvedValueOnce({ ok: false, error: { code: 'network', message: '연결을 확인해 주세요.' } });
    renderEditor(repository);
    fireEvent.click(await screen.findByRole('button', { name: '교육과정에서 추가' }));
    fireEvent.click(screen.getByRole('checkbox', { name: /COMP0218/ }));
    fireEvent.click(screen.getByRole('checkbox', { name: /COME0301/ }));
    fireEvent.click(screen.getByRole('button', { name: '선택 과목 등록' }));
    expect((await screen.findByRole('alert')).textContent).toContain('1과목을 등록했습니다.');
    expect(screen.getByText('1과목 선택')).toBeDefined();
    fireEvent.click(screen.getByRole('button', { name: '선택 과목 등록' }));
    await screen.findByText('1과목을 등록했습니다.');
    expect(add.mock.calls.map(([input]) => input.course_code)).toEqual(['COMP0218', 'COME0301', 'COME0301']);
  });
});
