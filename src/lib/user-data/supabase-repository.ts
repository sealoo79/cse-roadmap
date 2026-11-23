import type { SupabaseClient, User } from '@supabase/supabase-js';
import { isValidKey } from '@/lib/reference';
import type { Database, TablesInsert } from '@/types/database';
import type { ChecklistKey, FieldId, ProgramId } from '@/types/reference';
import type { Enrollment, FollowupStat, NewEnrollment, NoncreditStatus, OcrImportItem, Profile } from '@/types/user';
import type { RepoError, Result, UserDataRepository } from './repository';

type RepositoryDatabase = Omit<Database, 'public'> & {
  public: Omit<Database['public'], 'Functions'> & {
    Functions: Database['public']['Functions'] & {
      replace_user_interests: { Args: { field_ids: string[] }; Returns: string[] };
    };
  };
};

type OcrInput = Omit<OcrImportItem, 'id' | 'user_id' | 'created_at'>;
type OcrPatch = Partial<Pick<OcrImportItem, 'matched_course_code' | 'review_status'>>;
type ProfileInput = Parameters<UserDataRepository['upsertProfile']>[0];
type BackendError = { code?: string; status?: number };
type QueryResult<T> = { data: T | null; error: BackendError | null; status: number };

const MIN_FOLLOWUP_BASE = 3;
const messages: Record<RepoError['code'], string> = {
  invalid_key: '기준 데이터에 없는 키이거나 입력 형식이 올바르지 않습니다.',
  not_found: '저장된 항목을 찾을 수 없습니다.',
  unauthorized: '로그인이 필요하거나 접근 권한이 없습니다.',
  network: '서버에 연결할 수 없습니다. 잠시 후 다시 시도해 주세요.',
  unknown: '데이터를 처리하지 못했습니다. 잠시 후 다시 시도해 주세요.',
};

function ok<T>(data: T): Result<T> { return { ok: true, data }; }

function fail<T>(code: RepoError['code']): Result<T> {
  return { ok: false, error: { code, message: messages[code] } };
}

function backendFailure<T>(error: BackendError, status = error.status): Result<T> {
  if (status === 401 || status === 403 || error.code === '42501') return fail('unauthorized');
  if (status === 0 || status === 429 || (status !== undefined && status >= 502)) return fail('network');
  if (error.code === '23505') {
    return { ok: false, error: { code: 'invalid_key', message: '같은 항목이 이미 등록되어 있습니다.' } };
  }
  if (['22P02', '23502', '23514'].includes(error.code ?? '')) return fail('invalid_key');
  return fail('unknown');
}

function validEnrollment(input: Partial<NewEnrollment>): boolean {
  return (input.course_code === undefined || isValidKey('course', input.course_code))
    && (input.taken_year === undefined || (Number.isInteger(input.taken_year) && input.taken_year >= 1900 && input.taken_year <= 9999))
    && (input.taken_semester === undefined || [1, 2, 3, 4].includes(input.taken_semester))
    && (input.status === undefined || ['completed', 'failed', 'incomplete'].includes(input.status))
    && (input.source === undefined || ['manual', 'ocr', 'url'].includes(input.source))
    && (input.credit === undefined || input.credit === null || (Number.isFinite(input.credit) && input.credit >= 0))
    && (input.grade === undefined || input.grade === null || typeof input.grade === 'string');
}

function enrollmentFields(input: Partial<NewEnrollment>): Partial<NewEnrollment> {
  const { course_code, taken_year, taken_semester, status, source, credit, grade } = input;
  return { course_code, taken_year, taken_semester, status, source, credit, grade };
}

function validOcrPatch(patch: OcrPatch): boolean {
  return (patch.matched_course_code == null || isValidKey('course', patch.matched_course_code))
    && (patch.review_status === undefined || ['pending', 'confirmed', 'rejected'].includes(patch.review_status));
}

function requireRow<T>(row: T | null): Result<T> {
  return row === null ? fail('not_found') : ok(row);
}

export class SupabaseUserDataRepository implements UserDataRepository {
  constructor(private readonly client: SupabaseClient<RepositoryDatabase> | null) {}

  private async query<Row, Output>(
    action: (client: SupabaseClient<RepositoryDatabase>, user: User) => PromiseLike<QueryResult<Row>>,
    map: (data: Row | null) => Result<Output>,
  ): Promise<Result<Output>> {
    if (!this.client) return fail('unknown');

    try {
      const { data, error } = await this.client.auth.getUser();
      if (error) {
        if (error.name === 'AuthSessionMissingError') return fail('unauthorized');
        return backendFailure(error);
      }
      if (!data.user) return fail('unauthorized');

      const response = await action(this.client, data.user);
      return response.error ? backendFailure(response.error, response.status) : map(response.data);
    } catch {
      return fail('network');
    }
  }

  getProfile(): Promise<Result<Profile | null>> {
    return this.query((db, user) => db.from('profiles').select('*').eq('id', user.id).maybeSingle(),
      (row) => ok(row as Profile | null));
  }

  async upsertProfile(input: ProfileInput): Promise<Result<Profile>> {
    const { program_id, admission_year, major_type } = input;
    if (!isValidKey('program', program_id) || ![2023, 2024, 2025, 2026].includes(admission_year)
      || (major_type !== undefined && !['single', 'multi'].includes(major_type))) return fail('invalid_key');

    return this.query((db, user) => db.from('profiles').upsert({
      id: user.id, email: user.email ?? null, program_id, admission_year,
      ...(major_type === undefined ? {} : { major_type }),
    }, { defaultToNull: false }).select('*').maybeSingle(), (row) => requireRow(row as Profile | null));
  }

  listEnrollments(): Promise<Result<Enrollment[]>> {
    return this.query((db, user) => db.from('enrollments').select('*').eq('user_id', user.id).order('created_at').order('id'),
      (rows) => ok((rows ?? []) as Enrollment[]));
  }

  async addEnrollment(input: NewEnrollment): Promise<Result<Enrollment>> {
    if (!isValidKey('course', input.course_code) || !validEnrollment(input)) return fail('invalid_key');
    const fields: Omit<TablesInsert<'enrollments'>, 'user_id'> = {
      ...enrollmentFields(input),
      course_code: input.course_code, taken_year: input.taken_year, taken_semester: input.taken_semester,
      status: input.status, source: input.source,
    };
    return this.query((db, user) => db.from('enrollments').insert({ ...fields, user_id: user.id }).select('*').maybeSingle(),
      (row) => requireRow(row as Enrollment | null));
  }

  async updateEnrollment(id: string, patch: Partial<NewEnrollment>): Promise<Result<Enrollment>> {
    if (!validEnrollment(patch)) return fail('invalid_key');
    const fields = enrollmentFields(patch);
    return this.query((db, user) => {
      const table = db.from('enrollments');
      const row = Object.values(fields).some((value) => value !== undefined)
        ? table.update(fields).select('*') : table.select('*');
      return row.eq('user_id', user.id).eq('id', id).maybeSingle();
    }, (row) => requireRow(row as Enrollment | null));
  }

  deleteEnrollment(id: string): Promise<Result<void>> {
    return this.query((db, user) => db.from('enrollments').delete().eq('user_id', user.id).eq('id', id).select('id').maybeSingle(),
      (row) => row ? ok(undefined) : fail('not_found'));
  }

  getInterests(): Promise<Result<FieldId[]>> {
    return this.query((db, user) => db.from('user_interests').select('field_id').eq('user_id', user.id).order('field_id'),
      (rows) => ok((rows ?? []).map(({ field_id }) => field_id as FieldId)));
  }

  async setInterests(fieldIds: FieldId[]): Promise<Result<FieldId[]>> {
    if (!fieldIds.every((id) => isValidKey('field', id))) return fail('invalid_key');
    const field_ids = [...new Set(fieldIds)];
    return this.query((db) => db.rpc('replace_user_interests', { field_ids }),
      (saved) => ok((saved ?? []) as FieldId[]));
  }

  getNoncredit(): Promise<Result<NoncreditStatus[]>> {
    return this.query((db, user) => db.from('noncredit_status').select('*').eq('user_id', user.id).order('checklist_key'),
      (rows) => ok((rows ?? []) as NoncreditStatus[]));
  }

  async setNoncredit(key: ChecklistKey, status: NoncreditStatus['status'], inputValue: string | null): Promise<Result<NoncreditStatus>> {
    if (!isValidKey('checklist', key) || !['met', 'unmet'].includes(status)
      || (inputValue !== null && typeof inputValue !== 'string')) return fail('invalid_key');

    return this.query((db, user) => db.from('noncredit_status').upsert({
      user_id: user.id, checklist_key: key, status, input_value: inputValue,
    }).select('*').maybeSingle(), (row) => requireRow(row as NoncreditStatus | null));
  }

  async clearNoncredit(key: ChecklistKey): Promise<Result<void>> {
    if (!isValidKey('checklist', key)) return fail('invalid_key');
    return this.query((db, user) => db.from('noncredit_status').delete().eq('user_id', user.id).eq('checklist_key', key),
      () => ok(undefined));
  }

  listOcrItems(): Promise<Result<OcrImportItem[]>> {
    return this.query((db, user) => db.from('ocr_import_items').select('*').eq('user_id', user.id).order('created_at').order('id'),
      (rows) => ok((rows ?? []) as OcrImportItem[]));
  }

  async saveOcrItems(items: OcrInput[]): Promise<Result<OcrImportItem[]>> {
    if (!items.every((item) => typeof item.raw_text === 'string' && validOcrPatch(item)
      && Array.isArray(item.candidate_codes) && item.candidate_codes.every((code) => isValidKey('course', code)))) {
      return fail('invalid_key');
    }
    if (items.length === 0) return ok([]);

    return this.query((db, user) => db.from('ocr_import_items').insert(items.map((item) => ({
      user_id: user.id, raw_text: item.raw_text, candidate_codes: item.candidate_codes,
      matched_course_code: item.matched_course_code, review_status: item.review_status,
    }))).select('*'), (rows) => ok((rows ?? []) as OcrImportItem[]));
  }

  async updateOcrItem(id: string, patch: OcrPatch): Promise<Result<OcrImportItem>> {
    if (!validOcrPatch(patch)) return fail('invalid_key');
    const { matched_course_code, review_status } = patch;
    return this.query((db, user) => {
      const table = db.from('ocr_import_items');
      const row = matched_course_code === undefined && review_status === undefined
        ? table.select('*') : table.update({ matched_course_code, review_status }).select('*');
      return row.eq('user_id', user.id).eq('id', id).maybeSingle();
    }, (row) => requireRow(row as OcrImportItem | null));
  }

  async getFollowupStats(programId: ProgramId): Promise<Result<FollowupStat[]>> {
    if (!isValidKey('program', programId)) return fail('invalid_key');
    return this.query((db) => db.from('followup_stats').select('*').eq('program_id', programId)
      .gte('base_count', MIN_FOLLOWUP_BASE).order('from_code').order('to_code'),
    (rows) => ok((rows ?? []) as FollowupStat[]));
  }
}
