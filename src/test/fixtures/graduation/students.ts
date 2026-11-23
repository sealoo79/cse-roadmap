/**
 * 졸업요건 계산(#12) 테스트용 학생 fixture.
 *
 * 기준 데이터(data/*.json)에서 전공·학번별로 학생을 만든다. 데이터가 바뀌어도 같은 규칙으로 다시 만들어지도록
 * 과목을 손으로 적지 않고 교육과정·요건 목록에서 고른다.
 * - none: 이수 0
 * - partial: 1~2학년 교육과정만 이수, 비학점 요건 미입력
 * - graduate: 교육과정 전부 + 요건별 인정 과목 + 교양·총 학점 채움, 비학점 요건 전부 충족 입력
 */
import { resolveCompletion } from '@/lib/domain/completion';
import { evaluateGraduation } from '@/lib/domain/graduation';
import type { AdmissionYear, ChecklistKey, CourseCode, ProgramId, ReferenceData } from '@/types/reference';
import type { Enrollment, NoncreditStatus, Profile } from '@/types/user';

export type Scenario = 'none' | 'partial' | 'graduate';

export const STUDENT_ID = '00000000-0000-4000-8000-0000000000aa';
const TIMESTAMP = '2026-01-01T00:00:00.000Z';

export function studentProfile(programId: ProgramId, admissionYear: AdmissionYear): Profile {
  return {
    id: STUDENT_ID, email: null, program_id: programId, admission_year: admissionYear,
    major_type: 'single', created_at: TIMESTAMP, updated_at: TIMESTAMP,
  };
}

export function enrollment(code: CourseCode, overrides: Partial<Enrollment> = {}): Enrollment {
  return {
    id: `e-${code}-${overrides.taken_year ?? 2026}-${overrides.taken_semester ?? 1}-${overrides.status ?? 'completed'}`,
    user_id: STUDENT_ID, course_code: code, taken_year: 2026, taken_semester: 1, status: 'completed',
    source: 'manual', credit: null, grade: null, created_at: TIMESTAMP, ...overrides,
  };
}

export function answers(keys: Iterable<ChecklistKey>, status: 'met' | 'unmet'): NoncreditStatus[] {
  return [...keys].map((key) => ({ user_id: STUDENT_ID, checklist_key: key, status, input_value: null, updated_at: TIMESTAMP }));
}

/** 데이터에 있는 모든 (전공, 학번) 조합 */
export function programYears(ref: ReferenceData): Array<[ProgramId, AdmissionYear]> {
  return ref.programs.flatMap((p) => p.years.map((y): [ProgramId, AdmissionYear] => [p.program_id, y.admission_year]));
}

function credited(ref: ReferenceData, code: CourseCode): boolean {
  return (ref.courses.get(code)?.credit ?? 0) > 0;
}

/** 이 학생에게 적용되는 비학점 요건 키 전부 */
export function checklistKeys(ref: ReferenceData, programId: ProgramId, year: AdmissionYear): Set<ChecklistKey> {
  const keys = new Set<ChecklistKey>();
  for (const rule of ref.rules) {
    if ((rule.program_id === 'univ' || rule.program_id === programId) && rule.admission_year_from <= year && year <= rule.admission_year_to) {
      for (const c of rule.checklist) keys.add(c.key);
    }
  }
  return keys;
}

export function buildStudent(ref: ReferenceData, programId: ProgramId, year: AdmissionYear, scenario: Scenario): {
  profile: Profile; enrollments: Enrollment[]; noncredit: NoncreditStatus[];
} {
  const profile = studentProfile(programId, year);
  if (scenario === 'none') return { profile, enrollments: [], noncredit: [] };

  const curriculum = ref.curriculum.filter((c) => c.program_id === programId && c.admission_year === year);
  const requirements = ref.requirements.filter((r) => r.counts_for_graduation
    && (r.program_ids === null || r.program_ids.includes(programId)) && r.admission_years.includes(year));

  if (scenario === 'partial') {
    // 교육과정 자료가 없는 학번은 교양 요건 과목 일부로 대신한다.
    const codes = curriculum.length > 0
      ? curriculum.filter((c) => c.grade <= 2).map((c) => c.course_code)
      : requirements.filter((r) => r.group === '교양 영역별 필수').flatMap((r) => r.courses.slice(0, 1));
    return { profile, enrollments: [...new Set(codes.filter((c) => credited(ref, c)))].map((c) => enrollment(c)), noncredit: [] };
  }

  // graduate
  const chosen = new Set<CourseCode>();
  const take = (code: CourseCode): void => { if (credited(ref, code)) chosen.add(code); };
  for (const row of curriculum) take(row.course_code);
  for (const r of requirements) {
    if (r.min_credits === null) continue;
    let earned = r.courses.filter((c) => chosen.has(c)).reduce((s, c) => s + (ref.courses.get(c)?.credit ?? 0), 0);
    for (const code of r.courses) {
      if (earned >= r.min_credits) break;
      if (chosen.has(code) || !credited(ref, code)) continue;
      take(code);
      earned += ref.courses.get(code)?.credit ?? 0;
    }
  }

  // 교양·총 학점이 모자라면 교양 과목으로 채운다.
  const fillers = [...ref.courses.values()].filter((c) => c.kind === 'liberal' && (c.credit ?? 0) > 0).map((c) => c.course_code);
  const noncredit = answers(checklistKeys(ref, programId, year), 'met');
  for (const code of fillers) {
    const enrollments = [...chosen].map((c) => enrollment(c));
    const report = evaluateGraduation({ profile, completion: resolveCompletion(enrollments, ref), noncredit, ref });
    const short = report.items.some((i) => (i.id === 'bucket:liberal' || i.kind === 'total') && i.status === 'unmet');
    if (!short) break;
    take(code);
  }
  return { profile, enrollments: [...chosen].map((c) => enrollment(c)), noncredit };
}
