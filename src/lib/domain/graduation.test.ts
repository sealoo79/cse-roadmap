import { describe, expect, it } from 'vitest';
import { getReferenceData } from '@/lib/reference';
import { answers, buildStudent, checklistKeys, enrollment, programYears, studentProfile } from '@/test/fixtures/graduation/students';
import type { AdmissionYear, ProgramId } from '@/types/reference';
import type { Enrollment, NoncreditStatus } from '@/types/user';
import { resolveCompletion } from './completion';
import { evaluateGraduation, type GraduationItem, type GraduationReport } from './graduation';

const ref = getReferenceData();

function evaluate(programId: ProgramId, year: AdmissionYear, enrollments: Enrollment[] = [], noncredit: NoncreditStatus[] = []): GraduationReport {
  return evaluateGraduation({ profile: studentProfile(programId, year), completion: resolveCompletion(enrollments, ref), noncredit, ref });
}

function item(report: GraduationReport, id: string): GraduationItem {
  const found = report.items.find((i) => i.id === id);
  if (!found) throw new Error(`항목 없음: ${id} (있는 항목: ${report.items.map((i) => i.id).join(', ')})`);
  return found;
}

/** 자료가 없어 판정할 수 없는 것이 정상인 항목 */
function isExpectedUnknown(report: GraduationReport, i: GraduationItem): boolean {
  const noCurriculum = !ref.curriculum.some((c) => c.program_id === report.programId && c.admission_year === report.admissionYear);
  return i.id === 'bucket:design' || i.id === 'bucket:graduate_courses' || (noCurriculum && (i.kind === 'bucket' || i.kind === 'required_courses'));
}

describe('evaluateGraduation — 전공 × 학번 fixture', () => {
  for (const [programId, year] of programYears(ref)) {
    describe(`${programId} ${year}`, () => {
      it('이수 0: 충족 항목이 없고 비학점 요건은 미입력이다', () => {
        const { profile, enrollments, noncredit } = buildStudent(ref, programId, year, 'none');
        const report = evaluateGraduation({ profile, completion: resolveCompletion(enrollments, ref), noncredit, ref });

        expect(report.ruleIds.length).toBe(2);
        expect(report.summary.met).toBe(0);
        expect(report.summary.total).toBe(report.items.length);
        for (const i of report.items.filter((x) => x.kind === 'checklist')) expect(i.status).toBe('unanswered');
        expect(item(report, `total:${report.ruleIds[1]}`).earned).toBe(0);
      });

      it('일부 이수: 학점이 쌓이지만 졸업요건은 남아 있다', () => {
        const { profile, enrollments, noncredit } = buildStudent(ref, programId, year, 'partial');
        const report = evaluateGraduation({ profile, completion: resolveCompletion(enrollments, ref), noncredit, ref });
        const total = item(report, `total:${report.ruleIds[1]}`);

        expect(enrollments.length).toBeGreaterThan(0);
        expect(total.earned ?? 0).toBe(resolveCompletion(enrollments, ref).totalCredits);
        expect(total.earned ?? 0).toBeGreaterThan(0);
        expect(report.items.some((i) => i.status === 'unmet' || i.status === 'unanswered')).toBe(true);
      });

      it('졸업 가능: 미충족·미입력 항목이 없고, 판정 불가는 자료가 없는 항목뿐이다', () => {
        const { profile, enrollments, noncredit } = buildStudent(ref, programId, year, 'graduate');
        const report = evaluateGraduation({ profile, completion: resolveCompletion(enrollments, ref), noncredit, ref });

        const notMet = report.items.filter((i) => i.status === 'unmet' || i.status === 'unanswered').map((i) => `${i.id}(${i.earned}/${i.required})`);
        expect(notMet).toEqual([]);
        const unexpectedUnknown = report.items.filter((i) => i.status === 'unknown' && !isExpectedUnknown(report, i)).map((i) => i.id);
        expect(unexpectedUnknown).toEqual([]);
        expect(report.summary.met).toBe(report.items.filter((i) => i.status === 'met').length);
      });
    });
  }
});

describe('evaluateGraduation — 규칙', () => {
  it('대학 기준과 전공 기준의 같은 버킷은 하나로 합치고 더 엄격한 값을 쓴다', () => {
    const report = evaluate('adv_computing', 2026);
    const liberal = report.items.filter((i) => i.id === 'bucket:liberal');

    expect(liberal).toHaveLength(1);
    expect(liberal[0].required).toBe(30);
    expect(liberal[0].source ?? '').toContain(' / ');
    expect(report.ruleIds).toEqual(['univ__2024_2026', 'adv_computing__2026']);
  });

  it('플솝(ABEEK)은 대학 공통 학점 기준 대신 ABEEK 버킷을 쓰고 졸업자격인정제는 그대로 적용한다', () => {
    const report = evaluate('platform_sw_data', 2025);
    const ids = report.items.map((i) => i.id);

    expect(ids).not.toContain('bucket:liberal');
    expect(ids).not.toContain('requirement:liberal_total');
    expect(ids).toContain('bucket:abeek_total');
    expect(ids).toContain('bucket:engineering_major');
    expect(ids).toContain('requirement:gq_practical_english');
    expect(ids).toContain('checklist:gq_counseling');
  });

  it('ABEEK 총계는 기본소양·전공기반·공학전공 학점의 합이다', () => {
    const codes = ref.curriculum.filter((c) => c.program_id === 'platform_sw_data' && c.admission_year === 2025).map((c) => c.course_code);
    const report = evaluate('platform_sw_data', 2025, [...new Set(codes)].map((c) => enrollment(c)));
    const parts = ['basic_literacy', 'major_base', 'engineering_major'].map((b) => item(report, `bucket:${b}`).earned ?? 0);

    expect(item(report, 'bucket:abeek_total').earned).toBe(parts.reduce((a, b) => a + b, 0));
  });

  it('전공 학점은 해당 교육과정 안의 과목만 인정하고, 그 밖의 과목은 총 학점에만 더한다(D09)', () => {
    const outside = [...ref.courses.values()].find((c) => c.kind === 'major' && (c.credit ?? 0) > 0
      && !ref.curriculum.some((r) => r.course_code === c.course_code));
    expect(outside).toBeDefined();
    const report = evaluate('adv_computing', 2026, [enrollment(outside?.course_code ?? '')]);

    expect(item(report, 'bucket:major').earned).toBe(0);
    expect(item(report, 'total:adv_computing__2026').earned).toBe(outside?.credit);
  });

  it('전공필수 미이수 과목을 목록으로 돌려준다', () => {
    const rule = ref.rules.find((r) => r.rule_id === 'adv_computing__2026');
    const [first, ...rest] = rule?.required_courses ?? [];
    const report = evaluate('adv_computing', 2026, [enrollment(first)]);
    const required = item(report, 'required_courses:adv_computing__2026');

    expect(required.status).toBe('unmet');
    expect(required.matchedCourses).toEqual([first]);
    expect(required.missingCourses).toEqual(rest);
    expect(required.remaining).toBe(rest.length);
  });

  it('구과목 코드로 이수한 전공필수도 동일과목으로 인정한다', () => {
    const pair = ref.equivalents.find((e) => ref.rules.some((r) => r.required_courses.includes(e.new_code)));
    expect(pair).toBeDefined();
    const rule = ref.rules.find((r) => pair !== undefined && r.required_courses.includes(pair.new_code));
    const programId = rule?.program_id as ProgramId;
    const year = rule?.admission_year_from as AdmissionYear;
    const report = evaluate(programId, year, [enrollment(pair?.old_code ?? '')]);

    expect(item(report, `required_courses:${rule?.rule_id}`).matchedCourses).toContain(pair?.new_code);
  });

  it('비학점 요건은 입력값으로만 판정하고 미입력과 미충족을 구분한다', () => {
    const report = evaluate('adv_computing', 2026, [], [
      ...answers(['english_score'], 'met'),
      ...answers(['graduation_review'], 'unmet'),
    ]);

    expect(item(report, 'checklist:english_score').status).toBe('met');
    expect(item(report, 'checklist:graduation_review').status).toBe('unmet');
    expect(item(report, 'checklist:research_practice').status).toBe('unanswered');
    expect(item(report, 'checklist:gq_counseling').status).toBe('unanswered');
  });

  it('과목 외 방법으로도 충족할 수 있는 요건은 과목이 모자라도 입력이 met이면 충족, 없으면 미입력이다', () => {
    expect(item(evaluate('adv_computing', 2026), 'requirement:gq_practical_english').status).toBe('unanswered');
    expect(item(evaluate('adv_computing', 2026, [], answers(['gq_practical_english'], 'met')), 'requirement:gq_practical_english').status).toBe('met');
    expect(item(evaluate('adv_computing', 2026, [], answers(['gq_practical_english'], 'unmet')), 'requirement:gq_practical_english').status).toBe('unmet');
    // 요건 항목이 대신 표시하므로 같은 키의 체크리스트 항목은 따로 만들지 않는다.
    expect(evaluate('adv_computing', 2026).items.map((i) => i.id)).not.toContain('checklist:gq_practical_english');
  });

  it('과목으로 학점을 채우면 입력 없이도 요건을 충족한다', () => {
    const requirement = ref.requirements.find((r) => r.requirement_id === 'gq_software');
    const codes = (requirement?.courses ?? []).filter((c) => (ref.courses.get(c)?.credit ?? 0) >= 3).slice(0, 1);
    const report = evaluate('adv_computing', 2026, codes.map((c) => enrollment(c)));

    expect(item(report, 'requirement:gq_software').status).toBe('met');
    expect(item(report, 'requirement:gq_software').matchedCourses).toEqual(codes);
  });

  it('설계학점 자료가 없으면 설계 버킷은 판정 불가로 돌려준다', () => {
    const report = evaluate('platform_sw_data', 2025);
    const design = item(report, 'bucket:design');

    expect(design.status).toBe('unknown');
    expect(design.earned).toBeNull();
    expect(report.needsConfirmation.some((n) => n.includes('design_credit'))).toBe(true);
  });

  it('교육과정 자료가 없는 학번은 전공 학점·전공필수를 판정 불가로 돌려준다', () => {
    const report = evaluate('ai_computing', 2024);

    expect(item(report, 'bucket:major').status).toBe('unknown');
    expect(item(report, 'required_courses:ai_computing__2023_2025').status).toBe('unknown');
    expect(item(report, 'total:ai_computing__2023_2025').required).toBe(140);
  });

  it('규칙에 없는 비학점 키가 붙은 요건은 만들지 않는다(심화컴퓨팅은 현장실습 대신 연구실습)', () => {
    const ids = evaluate('adv_computing', 2026).items.map((i) => i.id);

    expect(ids).not.toContain('requirement:field_practice__cse');
    expect(ids).toContain('checklist:research_practice');
    expect(evaluate('ai_computing', 2026).items.map((i) => i.id)).toContain('requirement:field_practice__cse');
  });

  it('대학원 교과목처럼 인정 과목이 정해지지 않은 버킷은 판정 불가다', () => {
    expect(item(evaluate('adv_research', 2026), 'bucket:graduate_courses').status).toBe('unknown');
  });

  it('counts_for_graduation이 false인 참고 목록은 계산하지 않는다', () => {
    const ids = evaluate('global_sw', 2025).items.map((i) => i.id);

    expect(ids).not.toContain('requirement:ref_startup_all');
    expect(ids).toContain('requirement:startup__global_sw__2023_2025');
  });

  it('F 과목은 학점에 넣지 않는다', () => {
    const code = ref.rules.find((r) => r.rule_id === 'adv_computing__2026')?.required_courses[0] ?? '';
    const report = evaluate('adv_computing', 2026, [enrollment(code, { status: 'failed' })]);

    expect(item(report, 'total:adv_computing__2026').earned).toBe(0);
    expect(item(report, 'required_courses:adv_computing__2026').missingCourses).toContain(code);
  });

  it('모든 항목에 근거 문서가 있고 id는 겹치지 않는다', () => {
    for (const [programId, year] of programYears(ref)) {
      const report = evaluate(programId, year, [], answers(checklistKeys(ref, programId, year), 'met'));
      const ids = report.items.map((i) => i.id);

      expect(new Set(ids).size).toBe(ids.length);
      expect(report.items.filter((i) => !i.source).map((i) => i.id)).toEqual([]);
    }
  });
});
