import type { AdmissionYear, ChecklistKey, FieldId, ProgramId } from '@/types/reference';
import type { Enrollment, FollowupStat, MajorType, NewEnrollment, NoncreditStatus, OcrImportItem, Profile } from '@/types/user';

export type RepoError = { code: 'invalid_key' | 'not_found' | 'unauthorized' | 'network' | 'unknown'; message: string };
export type Result<T> = { ok: true; data: T } | { ok: false; error: RepoError };
export interface UserDataRepository {
  getProfile(): Promise<Result<Profile | null>>;
  upsertProfile(input: { program_id: ProgramId; admission_year: AdmissionYear; major_type?: MajorType }): Promise<Result<Profile>>;
  listEnrollments(): Promise<Result<Enrollment[]>>;
  addEnrollment(input: NewEnrollment): Promise<Result<Enrollment>>;
  updateEnrollment(id: string, patch: Partial<NewEnrollment>): Promise<Result<Enrollment>>;
  deleteEnrollment(id: string): Promise<Result<void>>;
  getInterests(): Promise<Result<FieldId[]>>;
  setInterests(fieldIds: FieldId[]): Promise<Result<FieldId[]>>;
  getNoncredit(): Promise<Result<NoncreditStatus[]>>;
  setNoncredit(key: ChecklistKey, status: 'met' | 'unmet', inputValue: string | null): Promise<Result<NoncreditStatus>>;
  clearNoncredit(key: ChecklistKey): Promise<Result<void>>;
  listOcrItems(): Promise<Result<OcrImportItem[]>>;
  saveOcrItems(items: Omit<OcrImportItem, 'id' | 'user_id' | 'created_at'>[]): Promise<Result<OcrImportItem[]>>;
  updateOcrItem(id: string, patch: Partial<Pick<OcrImportItem, 'matched_course_code' | 'review_status'>>): Promise<Result<OcrImportItem>>;
  getFollowupStats(programId: ProgramId): Promise<Result<FollowupStat[]>>;
}
