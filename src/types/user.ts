import type { AdmissionYear, ChecklistKey, CourseCode, FieldId, ProgramId } from './reference';

export type MajorType = 'single' | 'multi';
export type EnrollmentStatus = 'completed' | 'failed' | 'incomplete';
export type EnrollmentSource = 'manual' | 'ocr' | 'url';
export type TakenSemester = 1 | 2 | 3 | 4;
export interface Profile {
  id: string; email: string | null; program_id: ProgramId; admission_year: AdmissionYear;
  major_type: MajorType; created_at: string; updated_at: string;
}
export interface Enrollment {
  id: string; user_id: string; course_code: CourseCode; taken_year: number;
  taken_semester: TakenSemester; status: EnrollmentStatus; source: EnrollmentSource;
  credit: number | null; grade: string | null; created_at: string;
}
export type NewEnrollment = Omit<Enrollment, 'id' | 'user_id' | 'created_at'>;
export interface NoncreditStatus {
  user_id: string; checklist_key: ChecklistKey; status: 'met' | 'unmet'; input_value: string | null; updated_at: string;
}
export interface OcrImportItem {
  id: string; user_id: string; raw_text: string; candidate_codes: CourseCode[];
  matched_course_code: CourseCode | null; review_status: 'pending' | 'confirmed' | 'rejected'; created_at: string;
}
export interface FollowupStat { program_id: ProgramId; from_code: CourseCode; to_code: CourseCode; follower_count: number; base_count: number }
export interface UserInterest { user_id: string; field_id: FieldId }
