'use client';

import { useId, useMemo, useState, type FormEvent, type JSX } from 'react';
import { Button } from '@/components/ui/Button';
import { readSemester, statusLabels, terms, validYear } from '@/features/enrollments/enrollment-fields';
import { searchCourses } from '@/features/enrollments';
import type { CourseCode, ReferenceData } from '@/types/reference';
import type { EnrollmentStatus, NewEnrollment, OcrImportItem } from '@/types/user';
import { courseMatchLabel } from './match-courses';
import styles from './ocr.module.css';

export function OcrReviewRow({ item, reference, disabled, year, semester, onConfirm, onReject }: {
  item: OcrImportItem;
  reference: ReferenceData;
  disabled: boolean;
  year: string;
  semester: string;
  onConfirm(input: NewEnrollment): void;
  onReject(): void;
}): JSX.Element {
  const heading = useId();
  const matchLabel = courseMatchLabel(item, reference);
  const exactCode = matchLabel === 'DB 일치' ? item.candidate_codes[0] : '';
  const exactCourse = reference.courses.get(exactCode);
  const [query, setQuery] = useState('');
  const [code, setCode] = useState<CourseCode>(exactCode);
  const [status, setStatus] = useState<EnrollmentStatus>('incomplete');
  const [yearOverride, setYearOverride] = useState<string | null>(null);
  const [semesterOverride, setSemesterOverride] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const searchResults = useMemo(() => searchCourses(query, reference, { limit: 8 }), [query, reference]);
  const codes = [...new Set([...item.candidate_codes, ...searchResults.map((course) => course.course_code), code])]
    .filter((candidate) => reference.courses.has(candidate));
  const takenYear = yearOverride ?? year;
  const takenSemester = semesterOverride ?? semester;

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
      <h3 id={heading}>{exactCourse?.name_ko ?? item.raw_text}</h3>
      <p className={item.candidate_codes.length === 0 ? styles.warning : styles.muted}>
        {matchLabel}
        {item.candidate_codes.length === 0 && ' · 직접 검색하거나 검토에서 제외할 수 있어요.'}
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
