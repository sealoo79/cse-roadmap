import programs from '@reference/programs';
import courses from '@reference/courses';
import curriculum from '@reference/curriculum';
import relations from '@reference/course_relations';
import equivalents from '@reference/course_equivalents';
import fields from '@reference/fields';
import courseFields from '@reference/course_fields';
import checklist from '@reference/checklist';
import rules from '@reference/graduation_rules';
import requirements from '@reference/requirement_courses';
import type { AdmissionYear, ChecklistItem, Course, CourseCode, CourseEquivalent, CourseField, CourseRelation, CurriculumEntry, Field, GraduationRule, Program, ProgramId, ReferenceData, Requirement } from '@/types/reference';

// JSON은 빌드에 번들한다. data 파일이 아직 없는 경우에만 tsconfig 경로의 축소 fixture로 해석한다.
// #2 이전 필드 누락을 기본값으로 보완하되, 졸업학점 등의 값을 추정하지 않는다.
let cached: ReferenceData | undefined;
export function getReferenceData(): ReferenceData {
  if (!cached) {
    const courseRows = (courses as unknown as Course[]).map((c) => ({
      ...c, design_credit: c.design_credit ?? null, tags: c.tags ?? [],
      name_variants: c.name_variants ?? [], course_types: c.course_types ?? [],
    }));
    cached = {
      programs: programs as Program[], courses: new Map(courseRows.map((c) => [c.course_code, c])),
      curriculum: curriculum as CurriculumEntry[], relations: relations as CourseRelation[],
      equivalents: equivalents as CourseEquivalent[], fields: [...fields as Field[]].sort((a, b) => a.order - b.order),
      courseFields: new Map((courseFields as CourseField[]).map((c) => [c.course_code, c])),
      checklist: checklist as ChecklistItem[],
      rules: (rules as unknown as GraduationRule[]).map((r) => ({ ...r, total_credits: r.total_credits ?? null, credit_buckets: r.credit_buckets ?? [], needs_confirmation: r.needs_confirmation ?? [] })),
      requirements: requirements as Requirement[],
    };
  }
  return cached;
}
export function getCourse(code: CourseCode): Course | undefined { return getReferenceData().courses.get(code); }
export function getCurriculum(programId: ProgramId, year: AdmissionYear): CurriculumEntry[] {
  return getReferenceData().curriculum.filter((c) => c.program_id === programId && c.admission_year === year);
}
export function getRelations(programId: ProgramId, year: AdmissionYear): CourseRelation[] {
  return getReferenceData().relations.filter((r) => (r.program_id === null || r.program_id === programId)
    && (r.admission_year_from === null || r.admission_year_from <= year)
    && (r.admission_year_to === null || r.admission_year_to >= year));
}
export function getEquivalents(): CourseEquivalent[] { return getReferenceData().equivalents; }
export function getRules(programId: ProgramId, year: AdmissionYear): GraduationRule[] {
  return getReferenceData().rules.filter((r) => (r.program_id === 'univ' || r.program_id === programId) && r.admission_year_from <= year && r.admission_year_to >= year);
}
export function getRequirements(programId: ProgramId, year: AdmissionYear): Requirement[] {
  return getReferenceData().requirements.filter((r) => (r.program_ids === null || r.program_ids.includes(programId)) && r.admission_years.includes(year));
}
export function getFields(): Field[] { return getReferenceData().fields; }
export function getCourseFields(): Map<CourseCode, CourseField> { return getReferenceData().courseFields; }
export function getChecklist(): ChecklistItem[] { return getReferenceData().checklist; }
export function isValidKey(kind: 'program' | 'course' | 'field' | 'checklist', value: string): boolean {
  const ref = getReferenceData();
  switch (kind) {
    case 'program': return ref.programs.some((p) => p.program_id === value);
    case 'course': return /^[A-Z]{4}\d{4}$/.test(value) && ref.courses.has(value);
    case 'field': return ref.fields.some((f) => f.field_id === value);
    case 'checklist': return ref.checklist.some((c) => c.checklist_key === value);
  }
}
