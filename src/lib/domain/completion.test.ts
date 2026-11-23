import { describe, expect, it } from 'vitest';
import { getReferenceData } from '@/lib/reference';
import { demoEnrollments } from '@/test/fixtures/demo-user';
import type { Enrollment } from '@/types/user';
import { resolveCompletion } from './completion';

const reference = getReferenceData();

function attempt(courseCode: string, overrides: Partial<Enrollment> = {}): Enrollment {
  return { ...demoEnrollments[0], course_code: courseCode, ...overrides };
}

describe('resolveCompletion', () => {
  it('수강 이력이 없으면 이수와 학점이 비어 있다', () => {
    const result = resolveCompletion([], reference);

    expect(result.completed.size).toBe(0);
    expect(result.failed.size).toBe(0);
    expect(result.inProgress.size).toBe(0);
    expect(result.creditByCode).toEqual({});
    expect(result.totalCredits).toBe(0);
    expect(result.isCompleted('COMP0204')).toBe(false);
  });

  it('입력 학점을 우선하고 미입력 시 기준 학점을 사용한다', () => {
    const result = resolveCompletion([
      attempt('COMP0216'),
      attempt('COMP0311', { credit: 2 }),
      attempt('COMP0218', { credit: 0 }),
      attempt('XXXX9999'),
    ], reference);

    expect(result.completed).toEqual(new Set(['COMP0216', 'COMP0311', 'COMP0218', 'XXXX9999']));
    expect(result.creditByCode).toEqual({ COMP0216: 3, COMP0311: 2, COMP0218: 0, XXXX9999: 0 });
    expect(result.totalCredits).toBe(5);
  });

  it('여름 계절학기와 정규학기를 실제 순서로 비교해 최신 이수 한 건만 인정한다', () => {
    const result = resolveCompletion([
      attempt('COMP0216', { taken_semester: 2, credit: 4 }),
      attempt('COMP0216', { taken_year: 2025, taken_semester: 4, credit: 5 }),
      attempt('COMP0216', { taken_semester: 3, credit: 2, created_at: '2026-12-01T00:00:00Z' }),
      attempt('COMP0216', { taken_semester: 1, credit: 1 }),
    ], reference);

    expect(result.completed).toEqual(new Set(['COMP0216']));
    expect(result.creditByCode).toEqual({ COMP0216: 4 });
    expect(result.totalCredits).toBe(4);
  });

  it('같은 학기의 기록은 등록 시간이 최신인 이수를 선택한다', () => {
    const result = resolveCompletion([
      attempt('COMP0216', { id: 'a', created_at: '2026-06-02T00:00:00Z', credit: 4 }),
      attempt('COMP0216', { id: 'b', created_at: '2026-06-01T00:00:00Z', credit: 2 }),
    ], reference);

    expect(result.creditByCode).toEqual({ COMP0216: 4 });
  });

  it('F는 학점과 이수에서 제외하고 이후 동일과목 이수가 있으면 실패 집합에서 지운다', () => {
    const result = resolveCompletion([
      attempt('ITEC0201', { status: 'failed', credit: 9 }),
      attempt('COMP0218', { taken_semester: 2 }),
      attempt('COMP0216', { status: 'failed', credit: 9 }),
      attempt('COMP0311'),
      attempt('COMP0311', { taken_semester: 2, status: 'failed', credit: 9 }),
    ], reference);

    expect(result.failed).toEqual(new Set(['COMP0216', 'COMP0311']));
    expect(result.isCompleted('COMP0216')).toBe(false);
    expect(result.isCompleted('ITEC0201')).toBe(true);
    expect(result.creditByCode).toEqual({ COMP0218: 3, COMP0311: 3 });
    expect(result.totalCredits).toBe(6);
  });

  it('수강 중인 과목은 별도 집합에 표시하고 이수 학점에서 제외한다', () => {
    const result = resolveCompletion([
      attempt('ITEC0201', { status: 'incomplete', credit: 9 }),
      attempt('COMP0216', { credit: 2 }),
      attempt('COMP0216', { taken_semester: 3, status: 'incomplete', credit: 9 }),
    ], reference);

    expect(result.inProgress).toEqual(new Set(['COMP0218', 'COMP0216']));
    expect(result.completed).toEqual(new Set(['COMP0216']));
    expect(result.isCompleted('COMP0218')).toBe(false);
    expect(result.totalCredits).toBe(2);
  });

  it.each([
    { code: 'COMP0204', credit: 6 },
    { code: 'COMP0206', credit: 3 },
  ])('$code 한 과목만 이수해도 두 코드를 조회할 수 있다', ({ code, credit }) => {
    const result = resolveCompletion([attempt(code)], reference);

    expect(result.canonicalOf('COMP0204')).toBe('COMP0206');
    expect(result.canonicalOf('COMP0206')).toBe('COMP0206');
    expect(result.isCompleted('COMP0204')).toBe(true);
    expect(result.isCompleted('COMP0206')).toBe(true);
    expect(result.completed).toEqual(new Set(['COMP0206']));
    expect(result.creditByCode).toEqual({ COMP0206: credit });
  });

  it('학점이 같은 동일과목은 두 코드 중 최신 이수 기록의 학점을 인정한다', () => {
    const result = resolveCompletion([
      attempt('COMP0218', { taken_semester: 1, credit: 3 }),
      attempt('ITEC0201', { taken_semester: 2, credit: 2 }),
    ], reference);

    expect(result.completed).toEqual(new Set(['COMP0218']));
    expect(result.creditByCode).toEqual({ COMP0218: 2 });
    expect(result.totalCredits).toBe(2);
  });

  it.each([
    { enteredCredit: null, expectedCredit: 3 },
    { enteredCredit: 4, expectedCredit: 4 },
  ])('학점이 달라진 동일과목을 둘 다 이수하면 신과목 학점 $expectedCredit만 인정한다', ({ enteredCredit, expectedCredit }) => {
    const result = resolveCompletion([
      attempt('COMP0206', { taken_year: 2026, credit: enteredCredit }),
      attempt('COMP0204', { taken_year: 2026, taken_semester: 2, credit: 6 }),
    ], reference);

    expect(result.completed).toEqual(new Set(['COMP0206']));
    expect(result.creditByCode).toEqual({ COMP0206: expectedCredit });
    expect(result.totalCredits).toBe(expectedCredit);
  });

  it('과목명이 같아도 지정된 동일과목이 아니면 각각 인정한다', () => {
    const result = resolveCompletion([attempt('CHEM0506'), attempt('SCED0213')], reference);

    expect(reference.courses.get('CHEM0506')?.name_ko).toBe(reference.courses.get('SCED0213')?.name_ko);
    expect(result.completed).toEqual(new Set(['CHEM0506', 'SCED0213']));
    expect(result.creditByCode).toEqual({ CHEM0506: 2, SCED0213: 1 });
    expect(result.totalCredits).toBe(3);
  });
});
