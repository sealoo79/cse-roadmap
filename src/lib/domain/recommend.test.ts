import { describe, expect, it } from 'vitest';
import { getReferenceData } from '@/lib/reference';
import { enrollment, studentProfile } from '@/test/fixtures/graduation/students';
import type { CourseCode, CourseField, CourseRelation, CurriculumEntry, ReferenceData } from '@/types/reference';
import type { FollowupStat } from '@/types/user';
import { resolveCompletion } from './completion';
import { DEFAULT_WEIGHTS, nextTermOf, recommendCourses } from './recommend';

const reference = getReferenceData();
const profile = studentProfile('adv_computing', 2026);

function course(code: CourseCode, overrides: Partial<CurriculumEntry> = {}): CurriculumEntry {
  return {
    course_code: code,
    program_id: profile.program_id,
    admission_year: profile.admission_year,
    grade: 4,
    semester: 2,
    is_required: false,
    category: '전공',
    credit_bucket: 'major',
    tags: [],
    ...overrides,
  };
}

function relation(from: CourseCode, to: CourseCode, overrides: Partial<CourseRelation> = {}): CourseRelation {
  return {
    id: 1,
    from_code: from,
    to_code: to,
    type: 'recommended',
    group_no: 1,
    program_id: null,
    admission_year_from: null,
    admission_year_to: null,
    source: '테스트',
    note: null,
    ...overrides,
  };
}

function followup(from: CourseCode, to: CourseCode, followers: number, base: number): FollowupStat {
  return { program_id: profile.program_id, from_code: from, to_code: to, follower_count: followers, base_count: base };
}

function withReference(overrides: Partial<ReferenceData>): ReferenceData {
  return { ...reference, relations: [], courseFields: new Map(), ...overrides };
}

describe('recommendCourses', () => {
  it('이수 이력 없이 관심 분야가 일치하는 전공·학번 과목의 근거를 한 번 반영한다', () => {
    const curriculum = [
      course('COMP0312'),
      course('COMP0411', { program_id: 'ai_computing' }),
      course('COMP0315', { admission_year: 2025 }),
    ];
    const courseFields = new Map(curriculum.map(({ course_code }) => [
      course_code,
      { course_code, primary_field_id: 'common', field_ids: ['common', 'system'], basis: 'team_proposal' } satisfies CourseField,
    ]));
    const ref = withReference({ curriculum, courseFields });
    const completion = resolveCompletion([], ref);
    const results = recommendCourses({ profile, interests: ['system', 'common', 'system'], completion, followupStats: [], ref });

    expect(results).toEqual([{
      code: 'COMP0312',
      score: DEFAULT_WEIGHTS.interest,
      reasons: [{ type: 'interest', label: '관심 분야 일치 (공통 기초 · 시스템)' }],
      fromCodes: [],
      warning: null,
    }]);
  });

  it('동일과목 이수를 후수·함께 수강에 반영하고 근거와 출발 코드를 중복하지 않는다', () => {
    const curriculum = [course('COMP0206'), course('COMP0336', { is_required: true })];
    const ref = withReference({
      curriculum,
      relations: [relation('COMP0204', 'COMP0217'), relation('COMP0206', 'COMP0336')],
    });
    const completion = resolveCompletion([enrollment('COMP0204')], ref);
    const followupStats = [followup('COMP0204', 'COMP0217', 3, 3), followup('COMP0206', 'COMP0336', 4, 5)];
    const [result] = recommendCourses({ profile, interests: [], completion, followupStats, ref });

    expect(result.code).toBe('COMP0336');
    expect(result.score).toBeCloseTo(DEFAULT_WEIGHTS.required + DEFAULT_WEIGHTS.successor + DEFAULT_WEIGHTS.followup * 4 / 5);
    expect(result.reasons.map(({ type }) => type)).toEqual(['required', 'successor', 'followup']);
    expect(result.reasons.at(-1)).toMatchObject({ type: 'followup', value: 0.8, fromCode: 'COMP0206' });
    expect(result.reasons.at(-1)?.label).toContain('5명 중 4명');
    expect(result.fromCodes).toEqual(['COMP0206']);
  });

  it('전공·학번이 맞는 필수 선수 그룹을 OR 및 AND로 평가하고 한 번 감점한다', () => {
    const target = 'ITEC0401';
    const first = 'COMP0205';
    const alternative = 'COMP0207';
    const second = 'COMP0217';
    const ref = withReference({
      curriculum: [course(target, { is_required: true })],
      relations: [
        relation(first, target, { type: 'official' }),
        relation(alternative, target, { type: 'official' }),
        relation(second, target, { type: 'official', group_no: 2 }),
        relation('COMP0320', target, { type: 'official', group_no: 3, program_id: 'ai_computing' }),
        relation('COMP0411', target, { type: 'official', group_no: 4, admission_year_to: 2025 }),
        relation('COMP0315', target, { type: 'official', group_no: 5, admission_year_from: 2027 }),
        relation('COMP0319', target, { type: 'coreq' }),
      ],
    });
    const weights = { ...DEFAULT_WEIGHTS, prerequisiteUnmetPenalty: 2.5 };
    const input = { profile, interests: [], followupStats: [], ref, weights };
    const records = [enrollment(alternative), enrollment('COMP0319')];
    const incomplete = recommendCourses({ ...input,
      completion: resolveCompletion(records, ref) });
    const fulfilled = recommendCourses({ ...input,
      completion: resolveCompletion([...records, enrollment(second)], ref) });

    expect(incomplete[0]).toMatchObject({
      warning: 'prerequisite_unmet',
      score: weights.required + weights.successor - weights.prerequisiteUnmetPenalty,
      fromCodes: [alternative],
    });
    expect(fulfilled[0]).toMatchObject({
      warning: null,
      score: weights.required + 2 * weights.successor,
      fromCodes: [alternative, 'COMP0336'],
    });
  });

  it('이수·F 처리된 동일과목을 후보에서 빼고 실제 이수만 후속 추천에 사용한다', () => {
    const curriculum = [
      course('COMP0206', { is_required: true }),
      course('COMP0336', { is_required: true }),
      course('COMP0312'),
      course('COMP0315'),
    ];
    const ref = withReference({
      curriculum,
      relations: [relation('COMP0217', 'COMP0312'), relation('COMP0204', 'COMP0315')],
    });
    const completion = resolveCompletion([enrollment('COMP0204'), enrollment('COMP0217', { status: 'failed' })], ref);
    const followupStats = [followup('COMP0217', 'COMP0312', 5, 5)];
    const results = recommendCourses({ profile, interests: [], completion, followupStats, ref });

    expect(results.map(({ code }) => code)).toEqual(['COMP0315']);
    expect(results[0].fromCodes).toEqual(['COMP0206']);
  });

  it('최소 표본과 가중치 변경을 반영하고 전공 외·소표본·잘못된 집계를 사용하지 않는다', () => {
    const target = 'COMP0312';
    const ref = withReference({ curriculum: [course(target, { is_required: true })] });
    const completion = resolveCompletion([enrollment('COMP0411'), enrollment('COMP0319')], ref);
    const followupStats = [
      followup('COMP0411', target, 2, 3),
      followup('COMP0319', target, 2, 2),
      followup('COMP0319', target, 6, 5),
      followup('COMP0315', target, 8, 8),
      { ...followup('COMP0319', target, 8, 8), program_id: 'ai_computing' as const },
    ];
    const input = { profile, interests: [], completion, followupStats, ref };
    const included = recommendCourses({ ...input, weights: { ...DEFAULT_WEIGHTS, followup: 3, minFollowupBase: 2 } })[0];
    const excluded = recommendCourses({ ...input, weights: { ...DEFAULT_WEIGHTS, required: 4, minFollowupBase: 4 } })[0];

    expect(included.score).toBeCloseTo(DEFAULT_WEIGHTS.required + 2);
    expect(included.reasons.filter(({ type }) => type === 'followup')).toHaveLength(1);
    expect(included.fromCodes).toEqual(['COMP0411']);
    expect(excluded).toMatchObject({ score: 4, reasons: [{ type: 'required' }], fromCodes: [] });
  });

  it('함께 수강 근거만으로 네 과목을 추천하고 같은 점수는 코드 순으로 정렬한다', () => {
    const ref = withReference({
      curriculum: [course('COMP0315'), course('COMP0312'), course('COMP0321'), course('COMP0319')],
    });
    const completion = resolveCompletion([enrollment('COMP0411')], ref);
    const followupStats = ['COMP0315', 'COMP0312', 'COMP0321', 'COMP0319']
      .map((code) => followup('COMP0411', code, 3, 4));
    const results = recommendCourses({ profile, interests: [], completion, followupStats, ref });
    expect(results.map(({ code }) => code)).toEqual(['COMP0312', 'COMP0315', 'COMP0319', 'COMP0321']);
    expect(results.every(({ reasons, score }) => reasons.length === 1 && reasons[0].type === 'followup' && score === 0.75))
      .toBe(true);
  });

  it('함께 수강 집계와 개설 학기 정보 없이도 미이수 전공필수와 후속 과목을 점수순으로 반환한다', () => {
    const noOffering = reference.courses.get('COMP0315');
    if (!noOffering) throw new Error('테스트 과목 COMP0315가 없습니다.');
    const courses = new Map(reference.courses).set('COMP0315', { ...noOffering, offered_semesters: null });
    const ref = withReference({
      courses,
      curriculum: [course('COMP0315'), course('COMP0312', { is_required: true }), course('COMP0319')],
      relations: [relation('COMP0411', 'COMP0315'), relation('COMP0411', 'COMP0312')],
    });
    const completion = resolveCompletion([enrollment('COMP0411')], ref);
    const input = { profile, interests: [], completion, followupStats: [], ref };

    expect(recommendCourses(input).map(({ code, score }) => [code, score]))
      .toEqual([['COMP0312', 2], ['COMP0315', 1]]);
    const changedWeights = { ...DEFAULT_WEIGHTS, required: 2, successor: 3 };
    expect(recommendCourses({ ...input, weights: changedWeights }).map(({ score }) => score)).toEqual([5, 3]);
    const noHistory = recommendCourses({ ...input, completion: resolveCompletion([], ref) });
    expect(noHistory.map(({ code }) => code)).toEqual(['COMP0312']);
  });

  it('교육과정이나 추천 근거가 비어 있으면 빈 결과를 반환한다', () => {
    for (const curriculum of [[], [course('COMP0312')]]) {
      const ref = withReference({ curriculum });
      expect(recommendCourses({ profile, interests: [], completion: resolveCompletion([], ref), followupStats: [], ref })).toEqual([]);
    }
  });
});

describe('nextTermOf', () => {
  it('들은 정규학기 수 + 1을 다음 학기로 보고 계절학기·같은 학기 중복은 세지 않는다', () => {
    expect(nextTermOf([])).toEqual({ grade: 1, semester: 1 });
    const records = [
      enrollment('COMP0206'), enrollment('COMP0204'),
      enrollment('COME0331', { taken_semester: 2 }),
      enrollment('COMP0216', { taken_semester: 3 }),
      enrollment('COMP0319', { taken_year: 2028, taken_semester: 1 }),
      enrollment('COMP0217', { taken_year: 2028, taken_semester: 2 }),
    ];
    expect(nextTermOf(records)).toEqual({ grade: 3, semester: 1 });
    const many = Array.from({ length: 12 }, (_, i) => enrollment('COMP0206', { taken_year: 2026 + i, taken_semester: 1 }));
    expect(nextTermOf(many)).toEqual({ grade: 4, semester: 2 });
  });
});

describe('recommendCourses 우선순위 (다음 학기 기준)', () => {
  const offeredBoth = (codes: CourseCode[], onlySecond: CourseCode[] = []): ReferenceData['courses'] => {
    const courses = new Map(reference.courses);
    for (const code of [...codes, ...onlySecond]) {
      const base = courses.get(code);
      if (!base) throw new Error(`테스트 과목 ${code}가 없습니다.`);
      courses.set(code, { ...base, offered_semesters: onlySecond.includes(code) ? [2] : [1, 2] });
    }
    return courses;
  };

  it('밀린 전공필수 → 다음 학기 전공필수 → 나머지(점수·학기 거리) → 먼 학기 → 선수 미충족 순으로 정렬한다', () => {
    const codes: CourseCode[] = ['COME0331', 'COMP0319', 'ITEC0401', 'COMP0312', 'COMP0321', 'COMP0315', 'COMP0217'];
    const curriculum = [
      course('COME0331', { grade: 1, semester: 2, is_required: true }),
      course('COMP0319', { grade: 3, semester: 1, is_required: true }),
      course('ITEC0401', { grade: 4, semester: 1, is_required: true }),
      course('COMP0312', { grade: 3, semester: 1 }),
      course('COMP0321', { grade: 4, semester: 2 }),
      course('COMP0411', { grade: 2, semester: 1, is_required: true }),
      course('COMP0315', { grade: 2, semester: 2, is_required: true }),
      course('COMP0217', { grade: 1, semester: 1, is_required: true }),
    ];
    const courseFields = new Map(['COMP0312', 'COMP0321'].map((course_code) => [
      course_code,
      { course_code, primary_field_id: 'system', field_ids: ['system'], basis: 'team_proposal' } satisfies CourseField,
    ]));
    const ref = withReference({
      courses: offeredBoth(codes, ['COMP0411']),
      curriculum,
      courseFields,
      relations: [relation('COMP0205', 'COMP0217', { type: 'official' })],
    });
    const completion = resolveCompletion([enrollment('COMP0315', { status: 'incomplete' })], ref);
    const results = recommendCourses({
      profile, interests: ['system'], completion, followupStats: [], ref, nextTerm: { grade: 3, semester: 1 },
    });

    // COMP0411(2학기에만 개설)과 수강 중인 COMP0315는 빠진다.
    expect(results.map(({ code }) => code))
      .toEqual(['COME0331', 'COMP0319', 'COMP0312', 'ITEC0401', 'COMP0321', 'COMP0217']);
    expect(results.at(-1)?.warning).toBe('prerequisite_unmet');
  });

  it('같은 학기에 밀린 전공필수끼리는 뒤에서 막히는 과목이 많은 쪽이 먼저다', () => {
    const ref = withReference({
      courses: offeredBoth(['COME0331', 'COMP0216']),
      curriculum: [
        course('COME0331', { grade: 1, semester: 2, is_required: true }),
        course('COMP0216', { grade: 1, semester: 2, is_required: true }),
      ],
      relations: [relation('COMP0216', 'COMP0322'), relation('COMP0322', 'COMP0414')],
    });
    const results = recommendCourses({
      profile, interests: [], completion: resolveCompletion([], ref), followupStats: [], ref, nextTerm: { grade: 2, semester: 1 },
    });
    expect(results.map(({ code }) => code)).toEqual(['COMP0216', 'COME0331']);
  });
});
