'use client';

import { useCallback, useEffect, useRef, useState, type FormEvent, type JSX } from 'react';
import { Button } from '@/components/ui/Button';
import { sameEnrollment, statusLabels, terms } from '@/features/enrollments/enrollment-fields';
import { useEnrollments, useProfile } from '@/lib/user-data/hooks';
import { useUserDataContext } from '@/lib/user-data/provider';
import type { AdmissionYear, ProgramId } from '@/types/reference';
import type { EnrollmentStatus, NewEnrollment, OcrImportItem } from '@/types/user';
import { extractDocument, validateDocument } from './extract-document';
import { matchCourses } from './match-courses';
import { OcrReviewRow } from './OcrReviewRow';
import styles from './ocr.module.css';

/** 오늘 기준 이번 학기(3~8월 1학기, 9~2월 2학기). 캡처한 시간표는 대개 이번 학기다. */
export function currentTerm(today = new Date()): { year: string; semester: string } {
  const month = today.getMonth() + 1;
  if (month >= 3 && month <= 8) return { year: String(today.getFullYear()), semester: '1' };
  return { year: String(month <= 2 ? today.getFullYear() - 1 : today.getFullYear()), semester: '2' };
}

/**
 * 시간표 캡처 → 과목 자동 매칭 → 검토 후 저장.
 * 온보딩에서는 아직 프로필이 저장되기 전이라 전공·학번을 props로 받는다(없으면 저장된 프로필 사용).
 */
export function OcrImport({ programId, admissionYear }: { programId?: ProgramId | ''; admissionYear?: AdmissionYear | '' } = {}): JSX.Element {
  const { reference, repository } = useUserDataContext();
  const { profile } = useProfile();
  const { add, loading } = useEnrollments();
  const context = { programId: programId ?? profile?.program_id, admissionYear: admissionYear ?? profile?.admission_year };
  const [file, setFile] = useState<File | null>(null);
  const [rows, setRows] = useState<OcrImportItem[]>([]);
  const [year, setYear] = useState(() => currentTerm().year);
  const [semester, setSemester] = useState(() => currentTerm().semester);
  const [statusOverride, setStatusOverride] = useState<EnrollmentStatus | null>(null);
  const [draftCount, setDraftCount] = useState(0);
  const drafts = useRef(new Map<string, NewEnrollment>());
  const [initializing, setInitializing] = useState(true);
  const [progress, setProgress] = useState<string | null>(null);
  const [notice, setNotice] = useState<{ text: string; error: boolean } | null>(null);
  const [busy, setBusy] = useState(false);
  const lock = useRef(false);
  const mounted = useRef(false);
  const input = useRef<HTMLInputElement>(null);

  useEffect(() => {
    let active = true;
    mounted.current = true;
    void repository.listOcrItems().then((result) => {
      if (!active) return;
      if (result.ok) setRows(result.data);
      else setNotice({ text: result.error.message, error: true });
    }).catch(() => {
      if (active) setNotice({ text: '검토 기록을 불러오지 못했습니다.', error: true });
    }).finally(() => {
      if (active) setInitializing(false);
    });

    return () => {
      active = false;
      mounted.current = false;
    };
  }, [repository]);

  async function perform(action: () => Promise<void>): Promise<void> {
    if (lock.current) return;
    lock.current = true;
    setBusy(true);
    setNotice(null);
    try {
      await action();
    } catch (error) {
      if (mounted.current) setNotice({
        text: error instanceof Error ? error.message : '처리 중 오류가 발생했습니다. 다시 시도해 주세요.',
        error: true,
      });
    } finally {
      lock.current = false;
      if (mounted.current) {
        setBusy(false);
        setProgress(null);
      }
    }
  }

  function extract(event: FormEvent<HTMLFormElement>): void {
    event.preventDefault();
    if (!file) {
      setNotice({ text: '내역을 읽을 파일을 선택해 주세요.', error: true });
      return;
    }
    void perform(async () => {
      setProgress('파일 읽는 중…');
      const titles = await extractDocument(file, (label) => {
        if (mounted.current) setProgress(label);
      });
      if (!mounted.current) return;
      const found = matchCourses(titles, reference, context);
      if (!found.length) throw new Error('과목이 들어 있는 행을 찾지 못했습니다. 더 선명한 파일로 시도해 주세요.');
      if (found.length > 200) throw new Error('검토할 행이 너무 많습니다. 과목이 있는 부분을 나눠 불러와 주세요.');

      const result = await repository.saveOcrItems(found);
      if (!result.ok) throw new Error(result.error.message);
      if (!mounted.current) return;

      setRows((current) => [...current, ...result.data]);
      setFile(null);
      if (input.current) input.current.value = '';
      const matched = result.data.filter((row) => row.candidate_codes.length > 0).length;
      setNotice({
        text: `${result.data.length}개 항목 중 ${matched}과목을 자동으로 찾았습니다. 과목명과 학기를 확인하고 한 번에 저장하세요.`,
        error: false,
      });
    });
  }

  function updateReview(row: OcrImportItem): void {
    setRows((current) => current.map((item) => item.id === row.id ? row : item));
  }

  async function save(row: OcrImportItem, enrollment: NewEnrollment): Promise<void> {
    const existing = await repository.listEnrollments();
    if (!existing.ok) throw new Error(existing.error.message);
    const same = existing.data.find((item) => sameEnrollment(item, enrollment));
    if (same && (same.source !== 'ocr' || same.status !== enrollment.status)) {
      throw new Error(`${reference.courses.get(enrollment.course_code)?.name_ko ?? enrollment.course_code}: 같은 연도와 학기에 이미 등록된 과목입니다. 수강 이력에서 기존 기록을 확인해 주세요.`);
    }

    // 등록 후 검토 상태 저장이 실패해도, 같은 OCR 기록을 다시 추가하지 않는다.
    if (!same) {
      const result = await add(enrollment);
      if (!result.ok) throw new Error(result.error.message);
    }

    const reviewed = await repository.updateOcrItem(row.id, {
      matched_course_code: enrollment.course_code,
      review_status: 'confirmed',
    });
    if (!reviewed.ok) throw new Error(`수강 기록은 저장됐습니다. 검토 상태를 갱신하려면 같은 정보로 다시 확정해 주세요. ${reviewed.error.message}`);
    updateReview(reviewed.data);
  }

  function confirm(row: OcrImportItem, enrollment: NewEnrollment): void {
    void perform(async () => {
      await save(row, enrollment);
      setNotice({ text: '수강 이력을 저장했습니다.', error: false });
    });
  }

  /** 과목이 정해진 검토 항목을 한 번에 저장한다. 실패한 항목은 남겨 두고 이유를 보여 준다. */
  function confirmAll(): void {
    void perform(async () => {
      let saved = 0;
      const failures: string[] = [];
      for (const row of rows.filter((item) => item.review_status === 'pending')) {
        const enrollment = drafts.current.get(row.id);
        if (!enrollment) continue;
        try {
          await save(row, enrollment);
          saved++;
        } catch (error) {
          failures.push(error instanceof Error ? error.message : row.raw_text);
        }
        if (!mounted.current) return;
      }
      setNotice(failures.length
        ? { text: `${saved}과목을 저장했습니다. 저장하지 못한 항목: ${failures.join(' / ')}`, error: true }
        : { text: `${saved}과목을 수강 이력에 저장했습니다.`, error: false });
    });
  }

  const reportDraft = useCallback((id: string, enrollment: NewEnrollment | null): void => {
    if (enrollment) drafts.current.set(id, enrollment);
    else drafts.current.delete(id);
    setDraftCount(drafts.current.size);
  }, []);

  function reject(row: OcrImportItem): void {
    void perform(async () => {
      const result = await repository.updateOcrItem(row.id, { matched_course_code: null, review_status: 'rejected' });
      if (!result.ok) throw new Error(result.error.message);
      updateReview(result.data);
      setNotice({ text: '검토에서 제외했습니다.', error: false });
    });
  }

  const pending = rows.filter((row) => row.review_status === 'pending');
  const now = currentTerm();
  const status: EnrollmentStatus = statusOverride ?? (year === now.year && semester === now.semester ? 'incomplete' : 'completed');
  const done = rows.filter((row) => row.review_status !== 'pending');
  const disabled = busy || loading || initializing;

  return (
    <div className={styles.editor} aria-busy={busy}>
      <form className={styles.panel} onSubmit={extract}>
        <h2>시간표 캡처</h2>
        <label className={styles.file}>시간표 이미지
          <input ref={input} type="file" accept=".png,.jpg,.jpeg,.webp" disabled={disabled}
            onChange={(event) => {
              const selected = event.target.files?.[0] ?? null;
              const problem = selected && validateDocument(selected);
              setFile(problem ? null : selected);
              setNotice(problem ? { error: true, text: problem } : null);
            }} />
        </label>
        <p className={styles.muted}>이미지는 브라우저에서 읽습니다. 과목 검토 항목과 확정한 수강 기록만 저장합니다.</p>
        <div className={styles.actions}>
          <Button className={styles.primary} type="submit" disabled={disabled || !file}>과목 추출</Button>
        </div>
      </form>
      {progress && <p role="status">{progress}</p>}
      {notice && <p role={notice.error ? 'alert' : 'status'} className={notice.error ? styles.error : styles.success}>{notice.text}</p>}
      <section className={styles.panel} aria-label="과목 검토">
        <h2>과목 검토 <span className={styles.muted}>{pending.length}건</span></h2>
        {initializing && <p role="status">검토 항목을 불러오는 중입니다.</p>}
        {!initializing && pending.length === 0 && <p className={styles.muted}>검토할 과목이 없습니다.</p>}
        {pending.length > 0 && (
          <fieldset className={styles.fields} disabled={disabled}>
            <legend>공통 수강 기간</legend>
            <label>수강 연도
              <input inputMode="numeric" maxLength={4} placeholder="예: 2026" value={year} onChange={(event) => setYear(event.target.value)} />
            </label>
            <label>수강 학기
              <select value={semester} onChange={(event) => setSemester(event.target.value)}>
                <option value="">학기 선택</option>
                {terms.map((term) => <option key={term.value} value={term.value}>{term.label}</option>)}
              </select>
            </label>
            <label>공통 수강 상태
              <select value={status} onChange={(event) => {
                const value = event.target.value;
                if (value === 'completed' || value === 'incomplete' || value === 'failed') setStatusOverride(value);
              }}>
                {Object.entries(statusLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
              </select>
            </label>
            <p className={styles.muted}>이번 학기 시간표면 &lsquo;수강 중&rsquo;, 지난 학기면 &lsquo;이수 완료&rsquo;로 저장해요. 항목마다 바꿀 수도 있어요.</p>
          </fieldset>
        )}
        {pending.length > 0 && (
          <div className={styles.actions}>
            <Button className={styles.primary} disabled={disabled || draftCount === 0} onClick={confirmAll}>
              과목이 정해진 {draftCount}건 한 번에 저장
            </Button>
          </div>
        )}
        {pending.map((item) => (
          <OcrReviewRow key={item.id} item={item} reference={reference} disabled={disabled}
            year={year} semester={semester} status={status} onDraft={reportDraft}
            onConfirm={(record) => confirm(item, record)} onReject={() => reject(item)} />
        ))}
      </section>
      {done.length > 0 && (
        <details className={styles.panel}>
          <summary>검토 완료 {done.length}건</summary>
          {done.map((item) => {
            const code = item.matched_course_code;
            const course = code ? reference.courses.get(code) : undefined;
            return (
              <div className={styles.reviewed} key={item.id}>
                <p>{item.review_status === 'confirmed' ? '저장 완료' : '제외됨'}</p>
                <span>{course?.name_ko ?? item.raw_text} {code && <code>{code}</code>}</span>
              </div>
            );
          })}
        </details>
      )}
    </div>
  );
}
