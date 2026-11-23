import { describe, expect, it } from 'vitest';
import { getCourse, getCurriculum, getReferenceData, getRelations, isValidKey } from './index';

describe('기준 데이터 로더', () => {
  it('한 모듈 캐시에서 과목을 코드로 조회한다', () => {
    const ref = getReferenceData(); const course = [...ref.courses.values()][0];
    expect(getReferenceData()).toBe(ref);
    expect(getCourse(course.course_code)).toBe(course);
    expect(getCourse(course.name_ko)).toBeUndefined();
    expect(isValidKey('course', course.name_ko)).toBe(false);
  });
  it('교육과정과 관계를 전공·학번별로 제한한다', () => {
    const row = getReferenceData().curriculum[0];
    expect(getCurriculum(row.program_id, row.admission_year).every((c) => c.program_id === row.program_id && c.admission_year === row.admission_year)).toBe(true);
    expect(getRelations(row.program_id, row.admission_year).every((r) => (r.program_id === null || r.program_id === row.program_id)
      && (r.admission_year_from === null || r.admission_year_from <= row.admission_year)
      && (r.admission_year_to === null || r.admission_year_to >= row.admission_year))).toBe(true);
    expect(isValidKey('program', 'univ')).toBe(false);
  });
});
