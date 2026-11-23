import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { MockUserDataRepository } from '@/lib/user-data/mock-repository';
import { UserDataProvider } from '@/lib/user-data/provider';
import { extractDocument } from './extract-document';
import { OcrImport } from './OcrImport';

vi.mock('./extract-document', async (importOriginal) => ({
  ...await importOriginal<typeof import('./extract-document')>(),
  extractDocument: vi.fn(),
}));

beforeEach(() => window.localStorage.clear());
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

it('캡처는 검토 항목만 만들고, 확인한 과목만 수강 중으로 한 번 등록한다', async () => {
  const repository = new MockUserDataRepository();
  const onAdd = vi.spyOn(repository, 'addEnrollment');
  vi.spyOn(repository, 'updateOcrItem').mockResolvedValueOnce({
    ok: false, error: { code: 'unknown', message: '일시적인 실패' },
  });
  vi.mocked(extractDocument).mockResolvedValue(['시스템프로그 래밍', '시스템프로그래밍', '일반화학실험', '인공지능의 이해 - 튜터']);

  render(<UserDataProvider repository={repository}><OcrImport /></UserDataProvider>);
  const file = screen.getByLabelText('시간표 이미지');
  await waitFor(() => expect(file.hasAttribute('disabled')).toBe(false));
  fireEvent.change(file, { target: { files: [new File(['fixture'], 'timetable.png', { type: 'image/png' })] } });
  fireEvent.click(screen.getByRole('button', { name: '과목 추출' }));

  const form = await screen.findByRole('form', { name: '시스템프로그래밍' });
  expect(onAdd).not.toHaveBeenCalled();
  expect(await repository.listOcrItems()).toMatchObject({ ok: true, data: [
    { review_status: 'pending', matched_course_code: null },
    { review_status: 'pending', candidate_codes: ['CHEM0506', 'SCED0213'] },
    { review_status: 'pending', candidate_codes: [] },
  ] });
  expect((within(form).getByLabelText('수강 상태') as HTMLSelectElement).value).toBe('incomplete');
  fireEvent.change(screen.getByLabelText('수강 연도', { exact: true }), { target: { value: '2026' } });
  fireEvent.change(screen.getByLabelText('수강 학기', { exact: true }), { target: { value: '2' } });

  const confirm = within(form).getByRole('button', { name: '확정하고 수강 이력에 저장' });
  fireEvent.click(confirm);
  await screen.findByText(/검토 상태를 갱신하려면/);
  fireEvent.click(confirm);

  await screen.findByText('수강 이력을 저장했습니다.');
  expect(onAdd).toHaveBeenCalledExactlyOnceWith(expect.objectContaining({
    course_code: 'ELEC0462', taken_year: 2026, taken_semester: 2, status: 'incomplete', source: 'ocr',
  }));
  expect(await repository.listOcrItems()).toMatchObject({ ok: true, data: [
    { review_status: 'confirmed', matched_course_code: 'ELEC0462' },
    { review_status: 'pending' },
    { review_status: 'pending' },
  ] });
});
