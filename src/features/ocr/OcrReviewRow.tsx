'use client';

import { useEffect, useId, useMemo, useState, type FormEvent, type JSX } from 'react';
import { Button } from '@/components/ui/Button';
import { readSemester, statusLabels, terms, validYear } from '@/features/enrollments/enrollment-fields';
import { searchCourses } from '@/features/enrollments';
import type { CourseCode, ReferenceData } from '@/types/reference';
import type { EnrollmentStatus, NewEnrollment, OcrImportItem } from '@/types/user';
import { courseMatchLabel } from './match-courses';
import styles from './ocr.module.css';

export function OcrReviewRow({
  item, reference, disabled, year, semester, status: defaultStatus = 'incomplete', onDraft, onConfirm, onReject,
}: {
  item: OcrImportItem;
  reference: ReferenceData;
  disabled: boolean;
  year: string;
  semester: string;
  /** 공통 수강 상태. 항목에서 바꾸면 그 값을 쓴다. */
  status?: EnrollmentStatus;
  /** 지금 입력값으로 저장할 수 있으면 그 기록, 아니면 null을 알린다(한 번에 저장용). */
  onDraft?(id: string, input: NewEnrollment | null): void;
  onConfirm(input: NewEnrollment): void;
  onReject(): void;
}): JSX.Element {
  const heading = useId();
  const matchLabel = courseMatchLabel(item, reference);
  // 후보는 일치도·내 교육과정 순으로 정렬돼 있으므로 첫 후보를 미리 골라 둔다. 사용자는 확인만 하면 된다.
  const bestCode = item.candidate_codes.find((candidate) => reference.courses.has(candidate)) ?? '';
  const exact = matchLabel === 'DB 일치';
  const [query, setQuery] = useState('');
  const [code, setCode] = useState<CourseCode>(bestCode);
  const [statusOverride, setStatus] = useState<EnrollmentStatus | null>(null);
  const status = statusOverride ?? defaultStatus;
  const selectedCourse = reference.courses.get(code);
  const [yearOverride, setYearOverride] = useState<string | null>(null);
  const [semesterOverride, setSemesterOverride] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const searchResults = useMemo(() => searchCourses(query, reference, { limit: 8 }), [query, reference]);
  const codes = [...new Set([...item.candidate_codes, ...searchResults.map((course) => course.course_code), code])]
    .filter((candidate) => reference.courses.has(candidate));
  const takenYear = yearOverride ?? year;
  const takenSemester = semesterOverride ?? semester;
  const draftTerm = readSemester(takenSemester);
  const draft: NewEnrollment | null = reference.courses.has(code) && validYear(takenYear) && draftTerm !== undefined ? {
    course_code: code,
    taken_year: Number(takenYear),
    taken_semester: draftTerm,
    status,
    source: 'ocr',
    credit: null,
    grade: status === 'failed' ? 'F' : null,
  } : null;
  const draftKey = draft ? `${draft.course_code}/${draft.taken_year}/${draft.taken_semester}/${draft.status}` : '';

  useEffect(() => {
    if (!onDraft) return;
    const [courseCode, takenYearValue, takenSemesterValue, statusValue] = draftKey.split('/');
    const term = readSemester(takenSemesterValue ?? '');
    onDraft(item.id, draftKey && term !== undefined ? {
      course_code: courseCode,
      taken_year: Number(takenYearValue),
      taken_semester: term,
      status: statusValue as EnrollmentStatus,
      source: 'ocr',
      credit: null,
      grade: statusValue === 'failed' ? 'F' : null,
    } : null);
  }, [draftKey, item.id, onDraft]);

  useEffect(() => () => onDraft?.(item.id, null), [item.id, onDraft]);

  function confirm(event: FormEvent<HTMLFormElement>): void {
    event.preventDefault();
    if (!reference.courses.has(code)) {
      setError('저장할 과목코드를 선택해 주세요.');
      return;
    }
    const term = readSemester(takenSemester);
    if (!validYear(takenYear) || term === undefined) {
      setError('실제 수강 연도와 학기를 입력해 주세요.');
      return;
    }
    setError(null);
    onConfirm({
      course_code: code,
      taken_year: Number(takenYear),
      taken_semester: term,
      status,
      source: 'ocr',
      credit: null,
      grade: status === 'failed' ? 'F' : null,
    });
  }

  return (
    <form className={styles.row} aria-labelledby={heading} onSubmit={confirm}>
      <h3 id={heading}>{selectedCourse?.name_ko ?? item.raw_text}</h3>
      <p className={item.candidate_codes.length === 0 ? styles.warning : styles.muted}>
        {selectedCourse && <code>{selectedCourse.course_code}</code>} {matchLabel}
        {!exact && bestCode && ` · 인식한 글자 “${item.raw_text}” → 가장 비슷한 과목을 골라 뒀어요. 맞는지 확인하세요.`}
        {item.candidate_codes.length === 0 && ` · “${item.raw_text}”와 맞는 과목을 찾지 못했어요. 직접 검색하거나 제외하세요.`}
      </p>
      <fieldset className={styles.fields} disabled={disabled}>
        <label>과목 다시 검색
          <input type="search" placeholder="과목명 또는 코드" value={query} onChange={(event) => setQuery(event.target.value)} />
        </label>
        <label>과목코드 선택
          <select value={code} onChange={(event) => setCode(event.target.value)}>
            <option value="">과목 선택</option>
            {codes.map((candidate) => {
              const course = reference.courses.get(candidate);
              return (
                <option key={candidate} value={candidate}>
                  {course?.name_ko} · {candidate}{course?.offering_departments?.length ? ` · ${course.offering_departments.join(' / ')}` : ''}
                </option>
              );
            })}
          </select>
        </label>
        <label>실제 수강 연도
          <input inputMode="numeric" maxLength={4} value={takenYear} onChange={(event) => setYearOverride(event.target.value)} />
        </label>
        <label>실제 수강 학기
          <select value={takenSemester} onChange={(event) => setSemesterOverride(event.target.value)}>
            <option value="">학기 선택</option>
            {terms.map((term) => <option key={term.value} value={term.value}>{term.label}</option>)}
          </select>
        </label>
        <label>수강 상태
          <select value={status} onChange={(event) => {
            const value = event.target.value;
            if (value === 'completed' || value === 'incomplete' || value === 'failed') setStatus(value);
          }}>
            {Object.entries(statusLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
          </select>
        </label>
      </fieldset>
      {error && <p className={styles.error} role="alert">{error}</p>}
      <div className={styles.actions}>
        <Button disabled={disabled} onClick={onReject}>이 항목 제외</Button>
        <Button type="submit" className={styles.primary} disabled={disabled}>확정하고 수강 이력에 저장</Button>
      </div>
    </form>
  );
}
