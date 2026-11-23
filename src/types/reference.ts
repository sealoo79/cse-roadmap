export type ProgramId = 'platform_sw_data' | 'global_sw' | 'ai_computing' | 'adv_computing' | 'adv_research';
export type AdmissionYear = 2023 | 2024 | 2025 | 2026;
export type CourseCode = string;
export type Semester = 1 | 2;
export type FieldId = 'common' | 'system' | 'ai_data' | 'network_security' | 'sw_web';
export type CurriculumBucketId = 'basic_literacy' | 'major_base' | 'engineering_major' | 'major' | 'liberal' | 'general_elective' | 'teaching';
export type RuleBucketId = CurriculumBucketId | 'design' | 'graduate_courses' | 'abeek_total';
export type ChecklistKey = 'english_score' | 'field_practice' | 'research_practice' | 'research_activity' | 'graduation_review' | 'topcit' | 'portfolio' | 'gq_practical_english' | 'gq_software' | 'gq_counseling' | 'gq_major_area';

export interface Program {
  program_id: ProgramId; name: string; college: string;
  years: { admission_year: AdmissionYear; curriculum_status: 'available' | 'assumed' | 'missing' }[];
  note: string | null;
}
export interface Course {
  course_code: CourseCode; name_ko: string; name_en: string | null;
  credit: number | null; theory: number | null; practice: number | null; credit_sys: string | null;
  kind: 'major' | 'liberal'; course_types: string[];
  liberal_area: { group: string; sub: string | null; detail: string | null } | null;
  offered_semesters: Semester[] | null; offering_departments: string[] | null;
  tags: string[]; startup_related: boolean; design_related: boolean; design_credit: number | null;
  name_variants: string[]; source: string;
}
export interface CurriculumEntry {
  admission_year: AdmissionYear; program_id: ProgramId; course_code: CourseCode;
  grade: 1 | 2 | 3 | 4; semester: Semester; category: string;
  credit_bucket: CurriculumBucketId; is_required: boolean; tags: string[];
}
export interface CourseRelation {
  id: number; from_code: CourseCode; to_code: CourseCode;
  type: 'official' | 'recommended' | 'coreq'; group_no: number; program_id: ProgramId | null;
  admission_year_from: number | null; admission_year_to: number | null; source: string; note: string | null;
}
export interface CourseEquivalent {
  equivalent_id: number; old_code: CourseCode; new_code: CourseCode; relation: string;
  credit_changed: boolean; counts_for_required: boolean | null; credit_recognition: string | null;
  applies_to_years: number[] | null; effective_from: string | null; source: string;
}
export interface Field {
  field_id: FieldId;
  name_ko: string;
  color: string;
  order: number;
  color_dark?: string;
  description?: string;
}
export interface CourseField {
  course_code: CourseCode;
  primary_field_id: FieldId;
  field_ids: FieldId[];
  basis: 'official' | 'team_proposal';
  name_ko?: string;
  note?: string | null;
}
export interface ChecklistItem {
  checklist_key: ChecklistKey;
  label: string;
  input_type: 'boolean' | 'number' | 'text' | 'date';
  source: string;
  help?: string;
}
export interface GraduationRule {
  rule_id: string; program_id: ProgramId | 'univ'; admission_year_from: number; admission_year_to: number;
  total_credits: number | null;
  credit_buckets: { bucket_id: RuleBucketId; label: string; min_credits: number }[];
  credits: Record<string, number | string>; required_courses: CourseCode[];
  checklist: { key: ChecklistKey; rule: string; input_type: ChecklistItem['input_type']; auto_judgeable: false }[];
  default_major_type: 'single'; follows_university_credit_rules: boolean;
  tracks?: unknown[];
  note?: string | null;
  legacy?: Record<string, unknown>;
  needs_confirmation: string[]; source: string;
}
export interface Requirement {
  requirement_id: string; name: string; group: string; program_ids: ProgramId[] | null; admission_years: number[];
  min_credits: number | null; min_credits_detail: string | null; rule: string; counts_for_graduation: boolean;
  checklist_key: ChecklistKey | null; input_required: boolean; courses: CourseCode[];
  course_basis: string; source: string; note: string | null;
}
export interface ReferenceData {
  programs: Program[]; courses: Map<CourseCode, Course>; curriculum: CurriculumEntry[];
  relations: CourseRelation[]; equivalents: CourseEquivalent[]; fields: Field[];
  courseFields: Map<CourseCode, CourseField>; checklist: ChecklistItem[];
  rules: GraduationRule[]; requirements: Requirement[];
}
