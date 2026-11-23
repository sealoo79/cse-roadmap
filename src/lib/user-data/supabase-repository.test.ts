import { createClient } from '@supabase/supabase-js';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { getReferenceData } from '@/lib/reference';
import type { FieldId } from '@/types/reference';
import type { NewEnrollment } from '@/types/user';
import { SupabaseUserDataRepository } from './supabase-repository';

const userId = '00000000-0000-4000-8000-000000000001';
const otherId = '00000000-0000-4000-8000-000000000002';
const ref = getReferenceData();
const programId = ref.programs[0].program_id;
const fieldId = ref.fields[0].field_id;
const checklistKey = ref.checklist[0].checklist_key;
const courseCode = [...ref.courses.keys()][0];
const enrollment: NewEnrollment = {
  course_code: courseCode, taken_year: 2026, taken_semester: 1,
  status: 'completed', source: 'manual', credit: null, grade: null,
};

function setup() {
  const fetch = vi.fn<typeof globalThis.fetch>();
  const client = createClient('https://project.example.invalid', 'public-key', {
    auth: { autoRefreshToken: false, persistSession: false, detectSessionInUrl: false },
    global: { fetch },
  });
  const auth = vi.spyOn(client.auth, 'getUser').mockResolvedValue({
    data: { user: {
      id: userId, email: 'demo@example.invalid', aud: 'authenticated',
      app_metadata: {}, user_metadata: {}, created_at: '2026-01-01',
    } },
    error: null,
  });
  return { fetch, auth, repo: new SupabaseUserDataRepository(client) };
}

function body(json: unknown, status = 200): Response {
  return new Response(JSON.stringify(json), { status, headers: { 'content-type': 'application/json' } });
}

function requestAt(fetch: ReturnType<typeof setup>['fetch'], index = 0) {
  const [input, init] = fetch.mock.calls[index];
  return { url: new URL(input.toString()), method: init?.method, value: init?.body && JSON.parse(String(init.body)) };
}

afterEach(() => vi.restoreAllMocks());

describe('Supabase 사용자 저장소', () => {
  it('잘못된 기준 키와 OCR 묶음을 네트워크 요청 전에 거절한다', async () => {
    const { repo, fetch, auth } = setup();
    const results = await Promise.all([
      repo.addEnrollment({ ...enrollment, course_code: 'XXXX9999' }),
      repo.updateEnrollment(userId, { course_code: 'XXXX9999' }),
      repo.setInterests(['unknown' as FieldId]),
      repo.saveOcrItems([{ raw_text: '과목', candidate_codes: [courseCode, 'XXXX9999'], matched_course_code: null, review_status: 'pending' }]),
    ]);
    for (const result of results) expect(result).toMatchObject({ ok: false, error: { code: 'invalid_key' } });
    expect(auth).not.toHaveBeenCalled();
    expect(fetch).not.toHaveBeenCalled();
  });

  it('사용자의 프로필만 저장하고 전공 유형을 생략한 수정을 지원한다', async () => {
    const { repo, fetch } = setup();
    const row = { id: userId, email: 'demo@example.invalid', program_id: programId, admission_year: 2026, major_type: 'multi' };
    fetch.mockResolvedValueOnce(body(row, 201));
    expect(await repo.upsertProfile({ program_id: programId, admission_year: 2026 })).toEqual({ ok: true, data: row });
    expect(requestAt(fetch)).toMatchObject({
      method: 'POST', value: { id: userId, email: row.email, program_id: programId, admission_year: 2026 },
    });
    expect(requestAt(fetch).value).not.toHaveProperty('major_type');
  });

  it('수강 수정에서 소유자와 식별자를 제외하고 자신의 행만 조회한다', async () => {
    const { repo, fetch } = setup();
    fetch.mockResolvedValueOnce(body({ ...enrollment, id: userId, user_id: userId, grade: 'A+' }));
    const patch = { grade: 'A+', user_id: otherId, id: otherId };
    expect(await repo.updateEnrollment(userId, patch)).toMatchObject({ ok: true, data: { grade: 'A+' } });
    const request = requestAt(fetch);
    expect(request.value).toEqual({ grade: 'A+' });
    expect(request.url.searchParams.get('user_id')).toBe(`eq.${userId}`);
    expect(request.url.searchParams.get('id')).toBe(`eq.${userId}`);
  });

  it('관심 분야를 중복 없이 한 번의 RPC로 교체하고 빈 목록도 저장한다', async () => {
    const { repo, fetch } = setup();
    fetch.mockResolvedValueOnce(body([fieldId])).mockResolvedValueOnce(body([]));
    expect(await repo.setInterests([fieldId, fieldId])).toEqual({ ok: true, data: [fieldId] });
    expect(await repo.setInterests([])).toEqual({ ok: true, data: [] });
    expect(fetch).toHaveBeenCalledTimes(2);
    expect(requestAt(fetch).url.pathname).toBe('/rest/v1/rpc/replace_user_interests');
    expect(requestAt(fetch).value).toEqual({ field_ids: [fieldId] });
    expect(requestAt(fetch, 1).value).toEqual({ field_ids: [] });
  });

  it('비학점 항목을 저장하고 자신의 키만 지운다', async () => {
    const { repo, fetch } = setup();
    const row = { user_id: userId, checklist_key: checklistKey, status: 'met', input_value: '제출' };
    fetch.mockResolvedValueOnce(body(row)).mockResolvedValueOnce(new Response(null, { status: 204 }));
    expect(await repo.setNoncredit(checklistKey, 'met', '제출')).toEqual({ ok: true, data: row });
    expect(requestAt(fetch).value).toEqual(row);
    expect(await repo.clearNoncredit(checklistKey)).toEqual({ ok: true, data: undefined });
    const request = requestAt(fetch, 1);
    expect(request.method).toBe('DELETE');
    expect(request.url.searchParams.get('user_id')).toBe(`eq.${userId}`);
    expect(request.url.searchParams.get('checklist_key')).toBe(`eq.${checklistKey}`);
  });

  it('통계 요청에 전공과 최소 표본 조건을 포함한다', async () => {
    const { repo, fetch } = setup();
    fetch.mockResolvedValueOnce(body([]));
    expect(await repo.getFollowupStats(programId)).toEqual({ ok: true, data: [] });
    const { url } = requestAt(fetch);
    expect(url.searchParams.get('program_id')).toBe(`eq.${programId}`);
    expect(url.searchParams.get('base_count')).toBe('gte.3');
  });

  it('존재하지 않는 행, 접근 거절, 연결 실패를 구분한다', async () => {
    const { repo, fetch } = setup();
    fetch.mockResolvedValueOnce(body([]))
      .mockResolvedValueOnce(body({ code: '42501', message: 'private database details' }, 403))
      .mockRejectedValueOnce(new TypeError('offline'));
    expect(await repo.deleteEnrollment(userId)).toMatchObject({ ok: false, error: { code: 'not_found' } });
    expect(await repo.getInterests()).toEqual({ ok: false, error: { code: 'unauthorized', message: '로그인이 필요하거나 접근 권한이 없습니다.' } });
    expect(await repo.listEnrollments()).toMatchObject({ ok: false, error: { code: 'network' } });
  });
});
