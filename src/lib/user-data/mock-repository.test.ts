import { beforeEach, describe, expect, it } from 'vitest';
import { getReferenceData } from '@/lib/reference';
import type { ChecklistKey, CourseCode, FieldId, ProgramId } from '@/types/reference';
import type { NewEnrollment } from '@/types/user';
import { DEMO_USER_ID } from '@/test/fixtures/demo-user';
import { MOCK_STORAGE_KEY, MockUserDataRepository } from './mock-repository';

const ref = getReferenceData();
const code: CourseCode = [...ref.courses.keys()][0];
const field = ref.fields[0].field_id;
const checklist = ref.checklist[0].checklist_key;
const enrollment: NewEnrollment = { course_code: code, taken_year: 2026, taken_semester: 1, status: 'completed', source: 'manual', credit: null, grade: null };
let repo: MockUserDataRepository;
beforeEach(() => { window.localStorage.clear(); repo = new MockUserDataRepository(); });

describe('목 저장소', () => {
  it('브라우저 저장소 없이 생성할 수 있고, 읽을 때만 저장소에 접근한다', () => {
    expect(() => new MockUserDataRepository(() => { throw new Error('SSR'); })).not.toThrow();
  });
  it('시연 계정의 프로필과 F를 포함한 수강 기록을 제공한다', async () => {
    const profile = await repo.getProfile();
    expect(profile.ok && profile.data?.id).toBe(DEMO_USER_ID);
    const items = await repo.listEnrollments();
    expect(items.ok && items.data.some((e) => e.status === 'failed')).toBe(true);
    expect(window.localStorage.getItem(MOCK_STORAGE_KEY)).toBeNull();
  });
  it('새 인스턴스에서도 저장된 이력·변경·삭제를 읽는다', async () => {
    const added = await repo.addEnrollment(enrollment); expect(added.ok).toBe(true);
    if (!added.ok) throw new Error('저장 실패');
    const other = new MockUserDataRepository();
    const updated = await other.updateEnrollment(added.data.id, { status: 'failed', grade: 'F' });
    expect(updated.ok && updated.data.status).toBe('failed');
    expect(await repo.deleteEnrollment(added.data.id)).toEqual({ ok: true, data: undefined });
    const remaining = await other.listEnrollments();
    expect(remaining.ok && remaining.data.some((e) => e.id === added.data.id)).toBe(false);
  });
  it('런타임에 전달된 패치도 소유자와 ID를 바꾸지 못한다', async () => {
    const added = await repo.addEnrollment(enrollment); if (!added.ok) throw new Error('저장 실패');
    const patch = { grade: 'A+', user_id: 'other-user', id: 'other-id' };
    const updated = await repo.updateEnrollment(added.data.id, patch);
    expect(updated.ok && updated.data.user_id).toBe(DEMO_USER_ID);
    expect(updated.ok && updated.data.id).toBe(added.data.id);
  });
  it('없는 코드·학기·음수 학점의 저장을 거절하고 기존 내용을 보존한다', async () => {
    await repo.addEnrollment(enrollment);
    const before = window.localStorage.getItem(MOCK_STORAGE_KEY);
    for (const input of [{ ...enrollment, course_code: 'XXXX9999' }, { ...enrollment, credit: -1 }, { ...enrollment, taken_semester: 0 }]) {
      expect(await repo.addEnrollment(input as NewEnrollment)).toMatchObject({ ok: false, error: { code: 'invalid_key' } });
    }
    expect(window.localStorage.getItem(MOCK_STORAGE_KEY)).toBe(before);
  });
  it('수정·삭제 대상이 없으면 not_found를 반환한다', async () => {
    expect(await repo.updateEnrollment('missing', { grade: 'A' })).toMatchObject({ ok: false, error: { code: 'not_found' } });
    expect(await repo.deleteEnrollment('missing')).toMatchObject({ ok: false, error: { code: 'not_found' } });
  });
  it('프로필은 기준 데이터의 전공과 지원 학번만 허용한다', async () => {
    expect(await repo.upsertProfile({ program_id: 'invalid' as ProgramId, admission_year: 2026 })).toMatchObject({ ok: false, error: { code: 'invalid_key' } });
    const saved = await repo.upsertProfile({ program_id: ref.programs[0].program_id, admission_year: 2026 });
    expect(saved.ok && saved.data.major_type).toBe('single');
  });
  it('관심 분야의 중복을 제거하고 알 수 없는 키를 거절한다', async () => {
    expect(await repo.setInterests([field, field])).toEqual({ ok: true, data: [field] });
    expect(await repo.setInterests(['invalid' as FieldId])).toMatchObject({ ok: false, error: { code: 'invalid_key' } });
    expect(await repo.getInterests()).toEqual({ ok: true, data: [field] });
  });
  it('비학점 미입력과 미충족을 구분하며 clear로 미입력으로 되돌린다', async () => {
    expect(await repo.getNoncredit()).toEqual({ ok: true, data: [] });
    await repo.setNoncredit(checklist, 'unmet', '미제출');
    const result = await repo.getNoncredit();
    expect(result.ok && result.data[0].status).toBe('unmet');
    await repo.clearNoncredit(checklist);
    expect(await repo.getNoncredit()).toEqual({ ok: true, data: [] });
    expect(await repo.clearNoncredit('invalid' as ChecklistKey)).toMatchObject({ ok: false, error: { code: 'invalid_key' } });
  });
  it('OCR 일괄 저장은 전체 키 검증 후 처리한다', async () => {
    const item = { raw_text: '후보', candidate_codes: [code], matched_course_code: null, review_status: 'pending' as const };
    const bad = { ...item, candidate_codes: ['XXXX9999'] };
    expect(await repo.saveOcrItems([item, bad])).toMatchObject({ ok: false, error: { code: 'invalid_key' } });
    expect(await repo.listOcrItems()).toEqual({ ok: true, data: [] });
    const saved = await repo.saveOcrItems([item]); if (!saved.ok) throw new Error('저장 실패');
    const updated = await repo.updateOcrItem(saved.data[0].id, { matched_course_code: code, review_status: 'confirmed' });
    expect(updated.ok && updated.data.matched_course_code).toBe(code);
    await repo.updateOcrItem(saved.data[0].id, { matched_course_code: null, review_status: 'pending' });
    const reset = await repo.listOcrItems(); expect(reset.ok && reset.data[0].matched_course_code).toBeNull();
  });
  it('깨진 localStorage를 시연 데이터로 덮어쓰지 않는다', async () => {
    window.localStorage.setItem(MOCK_STORAGE_KEY, '{broken');
    expect(await repo.addEnrollment(enrollment)).toMatchObject({ ok: false, error: { code: 'unknown' } });
    expect(window.localStorage.getItem(MOCK_STORAGE_KEY)).toBe('{broken');
  });
  it('유효한 JSON이어도 잘못된 스키마를 거절한다', async () => {
    window.localStorage.setItem(MOCK_STORAGE_KEY, JSON.stringify({ version: 1, profile: null, enrollments: [{ user_id: 'someone' }], interests: [], noncredit: [], ocrItems: [] }));
    expect(await repo.listEnrollments()).toMatchObject({ ok: false, error: { code: 'unknown' } });
  });
  it('저장 용량·접근 오류를 Result로 반환한다', async () => {
    const blocked = new MockUserDataRepository(() => ({ getItem: () => null, setItem: () => { throw new Error('quota'); } }));
    expect(await blocked.addEnrollment(enrollment)).toMatchObject({ ok: false, error: { code: 'unknown' } });
  });
  it('집계 전에는 함께 수강 통계를 만들어내지 않는다', async () => {
    expect(await repo.getFollowupStats(ref.programs[0].program_id)).toEqual({ ok: true, data: [] });
  });
});
