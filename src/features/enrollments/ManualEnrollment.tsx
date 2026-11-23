'use client';

import { useEffect, useMemo, useRef, useState, type JSX } from 'react';
import { Button } from '@/components/ui/Button';
import type { Course, ReferenceData } from '@/types/reference';
import type { Enrollment, EnrollmentStatus, NewEnrollment } from '@/types/user';
import { readSemester, statusLabels, terms, validYear } from './enrollment-fields';
import { searchCourses } from './search-courses';
import styles from './enrollments.module.css';

interface Props {
  reference: ReferenceData;
  record?: Enrollment;
  disabled: boolean;
  onSave(input: NewEnrollment): void;
  onCancel(): void;
}

export function ManualEnrollment({ reference, record, disabled, onSave, onCancel }: Props): JSX.Element {
  const [courseCode, setCourseCode] = useState(record?.course_code ?? '');
  const [query, setQuery] = useState('');
  const [year, setYear] = useState(record ? String(record.taken_year) : '');
  const [semester, setSemester] = useState(record ? String(record.taken_semester) : '');
  const [status, setStatus] = useState<EnrollmentStatus>(record?.status ?? 'completed');
  const [credit, setCredit] = useState<string | null>(record?.credit == null ? null : String(record.credit));
  const [error, setError] = useState<string | null>(null);
  const heading = useRef<HTMLLegendElement>(null);
  const searchInput = useRef<HTMLInputElement>(null);
  const creditInput = useRef<HTMLInputElement>(null);
  const course = reference.courses.get(courseCode);
  const results = useMemo(() => searchCourses(query, reference, { limit: 12 }), [query, reference]);

  useEffect(() => {
    if (record) heading.current?.focus();
    else searchInput.current?.focus();
  }, [record]);

  function choose(item: Course): void {
    setCourseCode(item.course_code);
    setCredit(null);
    setError(null);
    heading.current?.focus();
  }

  function save(): void {
    if (!course) {
      setError('검색 결과에서 과목을 선택해 주세요.');
      searchInput.current?.focus();
      return;
    }
    if (!validYear(year)) {
      setError('수강 연도를 네 자리 숫자로 입력해 주세요.');
      return;
    }
    const takenSemester = readSemester(semester);
    if (takenSemester === undefined) {
      setError('수강 학기를 선택해 주세요.');
      return;
    }
    const enteredCredit = credit == null || credit === '' ? null : Number(credit);
    if (creditInput.current?.validity.badInput
      || (enteredCredit !== null && (!Number.isFinite(enteredCredit) || enteredCredit < 0))) {
      setError('학점은 0 이상의 숫자로 입력해 주세요.');
      return;
    }

    setError(null);
    onSave({
      course_code: course.course_code,
      taken_year: Number(year),
      taken_semester: takenSemester,
      status,
      credit: enteredCredit,
      source: record?.source ?? 'manual',
      grade: status === 'failed' ? 'F' : status === record?.status && courseCode === record.course_code
        ? record.grade : null,
    });
  }

  return (
    <fieldset className={styles.panel} disabled={disabled} onKeyDown={(event) => {
      if (event.key === 'Enter' && event.target instanceof HTMLInputElement) {
        event.preventDefault();
        if (event.target !== searchInput.current) save();
      }
      if (event.key === 'Escape' && !disabled) onCancel();
    }}>
      <legend ref={heading} tabIndex={-1}>{record ? '수강 기록 수정' : '과목 직접 추가'}</legend>
      {course ? (
        <div className={styles.selection}>
          <p><strong>{course.name_ko}</strong> <span className={styles.code}>{course.course_code}</span></p>
          <Button onClick={() => {
            setCourseCode('');
            setQuery('');
            setError(null);
            requestAnimationFrame(() => searchInput.current?.focus());
          }}>과목 다시 선택</Button>
        </div>
      ) : (
        <>
          <label className={styles.label}>과목 검색
            <input ref={searchInput} type="search" placeholder="과목명 또는 과목코드" value={query}
              onChange={(event) => { setQuery(event.target.value); setError(null); }} />
          </label>
          {query.trim() && (results.length > 0 ? (
            <ul className={styles.results} aria-label="과목 검색 결과">
              {results.map((item) => (
                <li key={item.course_code}>
                  <Button onClick={() => choose(item)}>
                    <strong>{item.name_ko}</strong> <span className={styles.code}>{item.course_code}</span>
                    <small>{item.offering_departments?.join(' · ') || '개설학과 정보 없음'}</small>
                  </Button>
                </li>
              ))}
            </ul>
          ) : <p role="status" className={styles.muted}>검색 결과가 없습니다.</p>)}
        </>
      )}
      <div className={styles.fields}>
        <label className={styles.label}>수강 연도
          <input inputMode="numeric" maxLength={4} placeholder="예: 2026" value={year}
            onChange={(event) => setYear(event.target.value)} />
        </label>
        <label className={styles.label}>수강 학기
          <select value={semester} onChange={(event) => setSemester(event.target.value)}>
            <option value="">학기 선택</option>
            {terms.map((term) => <option key={term.value} value={term.value}>{term.label}</option>)}
          </select>
        </label>
        <label className={styles.label}>수강 상태
          <select value={status} onChange={(event) => {
            const value = event.target.value;
            if (value === 'completed' || value === 'failed' || value === 'incomplete') setStatus(value);
          }}>
            {Object.entries(statusLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
          </select>
        </label>
        <label className={styles.label}>학점
          <input ref={creditInput} type="number" min={0} step="any" value={credit ?? course?.credit ?? ''}
            onChange={(event) => setCredit(event.target.value)} />
        </label>
      </div>
      {error && <p role="alert" className={styles.error}>{error}</p>}
      <div className={styles.actions}>
        <Button onClick={onCancel}>취소</Button>
        <Button className={styles.primary} onClick={save}>{record ? '변경사항 저장' : '수강 기록 추가'}</Button>
      </div>
    </fieldset>
  );
}
