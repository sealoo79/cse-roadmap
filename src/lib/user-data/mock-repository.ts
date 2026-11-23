import { isValidKey } from '@/lib/reference';
import type { AdmissionYear, ChecklistKey, FieldId, ProgramId } from '@/types/reference';
import type { Enrollment, FollowupStat, MajorType, NewEnrollment, NoncreditStatus, OcrImportItem, Profile } from '@/types/user';
import { DEMO_USER_ID, demoEnrollments, demoProfile } from '@/test/fixtures/demo-user';
import type { Result, UserDataRepository } from './repository';

export const MOCK_STORAGE_KEY = 'cse-roadmap:demo:v1';
interface StoredState {
  version: 1; profile: Profile | null; enrollments: Enrollment[]; interests: FieldId[];
  noncredit: NoncreditStatus[]; ocrItems: OcrImportItem[];
}
type StoragePort = Pick<Storage, 'getItem' | 'setItem'>;
const ok = <T>(data: T): Result<T> => ({ ok: true, data });
const invalid = <T>(): Result<T> => ({ ok: false, error: { code: 'invalid_key', message: '기준 데이터에 없는 키이거나 입력 형식이 올바르지 않습니다.' } });
const missing = <T>(): Result<T> => ({ ok: false, error: { code: 'not_found', message: '저장된 항목을 찾을 수 없습니다.' } });
const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null && !Array.isArray(value);
const isTextOrNull = (value: unknown): boolean => value === null || typeof value === 'string';
const validYear = (value: unknown): value is AdmissionYear => [2023, 2024, 2025, 2026].includes(value as number);
const validStatus = (value: unknown): boolean => ['completed', 'failed', 'incomplete'].includes(value as string);
const validSource = (value: unknown): boolean => ['manual', 'ocr', 'url'].includes(value as string);
const validReview = (value: unknown): boolean => ['pending', 'confirmed', 'rejected'].includes(value as string);
function validEnrollment(input: NewEnrollment): boolean {
  return isValidKey('course', input.course_code) && Number.isInteger(input.taken_year) && input.taken_year >= 1900 && input.taken_year <= 9999
    && [1, 2, 3, 4].includes(input.taken_semester) && validStatus(input.status) && validSource(input.source)
    && (input.credit === null || (Number.isFinite(input.credit) && input.credit >= 0)) && isTextOrNull(input.grade);
}
function validStoredState(value: unknown): value is StoredState {
  if (!isRecord(value) || value.version !== 1) return false;
  const p = value.profile;
  if (p !== null && (!isRecord(p) || p.id !== DEMO_USER_ID || !isTextOrNull(p.email) || typeof p.program_id !== 'string'
    || !isValidKey('program', p.program_id) || !validYear(p.admission_year) || !['single', 'multi'].includes(p.major_type as string)
    || typeof p.created_at !== 'string' || typeof p.updated_at !== 'string')) return false;
  if (!Array.isArray(value.enrollments) || !value.enrollments.every((e: unknown) => isRecord(e)
    && typeof e.id === 'string' && e.user_id === DEMO_USER_ID && typeof e.created_at === 'string'
    && validEnrollment(e as unknown as NewEnrollment))) return false;
  if (!Array.isArray(value.interests) || !value.interests.every((f: unknown) => typeof f === 'string' && isValidKey('field', f))) return false;
  if (!Array.isArray(value.noncredit) || !value.noncredit.every((n: unknown) => isRecord(n) && n.user_id === DEMO_USER_ID
    && typeof n.checklist_key === 'string' && isValidKey('checklist', n.checklist_key) && ['met', 'unmet'].includes(n.status as string)
    && isTextOrNull(n.input_value) && typeof n.updated_at === 'string')) return false;
  return Array.isArray(value.ocrItems) && value.ocrItems.every((o: unknown) => isRecord(o) && typeof o.id === 'string'
    && o.user_id === DEMO_USER_ID && typeof o.raw_text === 'string' && typeof o.created_at === 'string' && validReview(o.review_status)
    && Array.isArray(o.candidate_codes) && o.candidate_codes.every((c: unknown) => typeof c === 'string' && isValidKey('course', c))
    && (o.matched_course_code === null || (typeof o.matched_course_code === 'string' && isValidKey('course', o.matched_course_code))));
}

export class MockUserDataRepository implements UserDataRepository {
  constructor(private readonly storage: () => StoragePort = () => window.localStorage) {}

  private load(): StoredState {
    const raw = this.storage().getItem(MOCK_STORAGE_KEY);
    if (raw !== null) {
      const parsed: unknown = JSON.parse(raw);
      if (!validStoredState(parsed)) throw new Error('목 데이터 형식이 올바르지 않습니다. 저장된 데이터를 확인해 주세요.');
      return parsed;
    }
    return {
      version: 1, profile: isValidKey('program', demoProfile.program_id) ? structuredClone(demoProfile) : null,
      enrollments: structuredClone(demoEnrollments.filter((e) => isValidKey('course', e.course_code))),
      interests: [], noncredit: [], ocrItems: [],
    };
  }

  private async read<T>(fn: (state: StoredState) => T): Promise<Result<T>> {
    try { return ok(structuredClone(fn(this.load()))); }
    catch { return { ok: false, error: { code: 'unknown', message: '목 데이터를 읽을 수 없습니다. 브라우저 저장소 설정 또는 저장된 데이터 형식을 확인해 주세요.' } }; }
  }

  private async write<T>(fn: (state: StoredState) => Result<T>): Promise<Result<T>> {
    try {
      const state = this.load();
      const result = fn(state);
      if (result.ok) this.storage().setItem(MOCK_STORAGE_KEY, JSON.stringify(state));
      return structuredClone(result);
    } catch { return { ok: false, error: { code: 'unknown', message: '목 데이터를 저장할 수 없습니다. 브라우저 저장소의 용량과 접근 권한을 확인해 주세요.' } }; }
  }

  async getProfile(): Promise<Result<Profile | null>> { return this.read((s) => s.profile); }
  async upsertProfile(input: { program_id: ProgramId; admission_year: AdmissionYear; major_type?: MajorType }): Promise<Result<Profile>> {
    if (!isValidKey('program', input.program_id) || !validYear(input.admission_year) || (input.major_type !== undefined && !['single', 'multi'].includes(input.major_type))) return invalid();
    return this.write((s) => {
      const now = new Date().toISOString();
      s.profile = { id: DEMO_USER_ID, email: demoProfile.email, ...input, major_type: input.major_type ?? s.profile?.major_type ?? 'single', created_at: s.profile?.created_at ?? now, updated_at: now };
      return ok(s.profile);
    });
  }
  async listEnrollments(): Promise<Result<Enrollment[]>> { return this.read((s) => s.enrollments); }
  async addEnrollment(input: NewEnrollment): Promise<Result<Enrollment>> {
    if (!validEnrollment(input)) return invalid();
    return this.write((s) => {
      const item: Enrollment = { ...input, id: crypto.randomUUID(), user_id: DEMO_USER_ID, created_at: new Date().toISOString() };
      s.enrollments.push(item); return ok(item);
    });
  }
  async updateEnrollment(id: string, patch: Partial<NewEnrollment>): Promise<Result<Enrollment>> {
    return this.write((s) => {
      const i = s.enrollments.findIndex((e) => e.id === id); if (i < 0) return missing();
      const old = s.enrollments[i];
      const item = { ...old, ...patch, id: old.id, user_id: old.user_id, created_at: old.created_at };
      if (!validEnrollment(item)) return invalid();
      s.enrollments[i] = item; return ok(item);
    });
  }
  async deleteEnrollment(id: string): Promise<Result<void>> {
    return this.write((s) => {
      const i = s.enrollments.findIndex((e) => e.id === id); if (i < 0) return missing();
      s.enrollments.splice(i, 1); return ok(undefined);
    });
  }
  async getInterests(): Promise<Result<FieldId[]>> { return this.read((s) => s.interests); }
  async setInterests(fieldIds: FieldId[]): Promise<Result<FieldId[]>> {
    if (!fieldIds.every((id) => isValidKey('field', id))) return invalid();
    return this.write((s) => { s.interests = [...new Set(fieldIds)]; return ok(s.interests); });
  }
  async getNoncredit(): Promise<Result<NoncreditStatus[]>> { return this.read((s) => s.noncredit); }
  async setNoncredit(key: ChecklistKey, status: 'met' | 'unmet', inputValue: string | null): Promise<Result<NoncreditStatus>> {
    if (!isValidKey('checklist', key) || !['met', 'unmet'].includes(status) || !isTextOrNull(inputValue)) return invalid();
    return this.write((s) => {
      const item: NoncreditStatus = { user_id: DEMO_USER_ID, checklist_key: key, status, input_value: inputValue, updated_at: new Date().toISOString() };
      s.noncredit = [...s.noncredit.filter((n) => n.checklist_key !== key), item]; return ok(item);
    });
  }
  async clearNoncredit(key: ChecklistKey): Promise<Result<void>> {
    if (!isValidKey('checklist', key)) return invalid();
    return this.write((s) => { s.noncredit = s.noncredit.filter((n) => n.checklist_key !== key); return ok(undefined); });
  }
  async listOcrItems(): Promise<Result<OcrImportItem[]>> { return this.read((s) => s.ocrItems); }
  async saveOcrItems(items: Omit<OcrImportItem, 'id' | 'user_id' | 'created_at'>[]): Promise<Result<OcrImportItem[]>> {
    if (!items.every((i) => typeof i.raw_text === 'string' && validReview(i.review_status)
      && i.candidate_codes.every((c) => isValidKey('course', c))
      && (i.matched_course_code === null || isValidKey('course', i.matched_course_code)))) return invalid();
    return this.write((s) => {
      const rows = items.map((i) => ({ ...i, id: crypto.randomUUID(), user_id: DEMO_USER_ID, created_at: new Date().toISOString() }));
      s.ocrItems.push(...rows); return ok(rows);
    });
  }
  async updateOcrItem(id: string, patch: Partial<Pick<OcrImportItem, 'matched_course_code' | 'review_status'>>): Promise<Result<OcrImportItem>> {
    if ((patch.matched_course_code !== undefined && patch.matched_course_code !== null && !isValidKey('course', patch.matched_course_code))
      || (patch.review_status !== undefined && !validReview(patch.review_status))) return invalid();
    return this.write((s) => {
      const i = s.ocrItems.findIndex((o) => o.id === id); if (i < 0) return missing();
      const old = s.ocrItems[i];
      s.ocrItems[i] = { ...old, matched_course_code: patch.matched_course_code === undefined ? old.matched_course_code : patch.matched_course_code, review_status: patch.review_status ?? old.review_status };
      return ok(s.ocrItems[i]);
    });
  }
  async getFollowupStats(programId: ProgramId): Promise<Result<FollowupStat[]>> {
    if (!isValidKey('program', programId)) return invalid();
    return ok([]); // #18 집계 전에는 추천 표본을 만들지 않는다.
  }
}
