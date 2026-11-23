import type { AdmissionYear, ChecklistKey, CourseCode, ProgramId, ReferenceData } from '@/types/reference';
import type { NoncreditStatus, Profile } from '@/types/user';
import type { CompletionState } from './completion';

export type ItemStatus = 'met' | 'unmet' | 'unanswered' | 'unknown';
export interface GraduationItem {
  id: string; kind: 'total' | 'bucket' | 'required_courses' | 'requirement' | 'checklist'; label: string;
  status: ItemStatus; required: number | null; earned: number | null; remaining: number | null;
  matchedCourses: CourseCode[]; missingCourses: CourseCode[]; checklistKey: ChecklistKey | null;
  source: string | null; note: string | null;
}
export interface GraduationReport {
  programId: ProgramId; admissionYear: AdmissionYear; ruleIds: string[]; items: GraduationItem[];
  summary: { met: number; total: number }; needsConfirmation: string[];
}
// #12 소유: 빈 결과는 졸업요건 충족을 의미하지 않는다.
export function evaluateGraduation(input: { profile: Profile; completion: CompletionState; noncredit: NoncreditStatus[]; ref: ReferenceData }): GraduationReport {
  return { programId: input.profile.program_id, admissionYear: input.profile.admission_year, ruleIds: [], items: [], summary: { met: 0, total: 0 }, needsConfirmation: [] };
}
