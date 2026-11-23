'use client';

import { useState, type JSX } from 'react';
import { Button } from '@/components/ui/Button';
import type { AdmissionYear, CourseCode, CurriculumEntry, ReferenceData } from '@/types/reference';
import type { Enrollment, NewEnrollment } from '@/types/user';
import { sameEnrollment, validYear } from './enrollment-fields';
import styles from './enrollments.module.css';

interface Props {
  admissionYear: AdmissionYear;
  curriculum: CurriculumEntry[];
  reference: ReferenceData;
  records: Enrollment[];
  disabled: boolean;
  onSave(inputs: NewEnrollment[], onSaved: (codes: CourseCode[]) => void): void;
  onCancel(): void;
}

function termIndex(entry: CurriculumEntry): number {
  return (entry.grade - 1) * 2 + entry.semester - 1;
}

export function CurriculumChecklist({
  admissionYear, curriculum, reference, records, disabled, onSave, onCancel,
}: Props): JSX.Element {
  const [term, setTerm] = useState(0);
  const [yearOverride, setYearOverride] = useState<string | null>(null);
  const [selected, setSelected] = useState<CourseCode[]>([]);
  const [error, setError] = useState<string | null>(null);

  const availableTerms = [...new Set(curriculum.map(termIndex))].sort((a, b) => a - b);
  const activeTerm = availableTerms.includes(term) ? term : (availableTerms[0] ?? 0);
  const entries = curriculum.filter((entry) => termIndex(entry) === activeTerm);
  const year = yearOverride ?? String(admissionYear + Math.floor(activeTerm / 2));

  function inputFor(entry: CurriculumEntry): NewEnrollment {
    return {
      course_code: entry.course_code,
      taken_year: Number(year),
      taken_semester: entry.semester,
      status: 'completed',
      source: 'manual',
      credit: null,
      grade: null,
    };
  }

  const rows = entries.map((entry) => ({
    entry,
    course: reference.courses.get(entry.course_code),
    registered: records.some((record) => sameEnrollment(record, inputFor(entry))),
  }));
  const pending = rows.filter(({ entry, registered }) => !registered && selected.includes(entry.course_code));
  const save = (): void => {
    if (!validYear(year)) {
      setError('수강 연도를 네 자리 숫자로 입력해 주세요.');
      return;
    }
    setError(null);
    onSave(pending.map(({ entry }) => inputFor(entry)), (saved) => {
      setSelected((codes) => codes.filter((code) => !saved.includes(code)));
    });
  };

  return (
    <fieldset className={styles.panel} disabled={disabled} onKeyDown={(event) => {
      if (event.key === 'Enter' && event.target instanceof HTMLInputElement) event.preventDefault();
      if (event.key === 'Escape' && !disabled) onCancel();
    }}>
      <legend>교육과정에서 추가</legend>
      {availableTerms.length === 0 ? <p className={styles.muted}>이 전공·학번의 교육과정 자료가 없습니다.</p> : (
        <>
          <div className={styles.fields}>
            <label className={styles.label}>교육과정 학기
              <select value={activeTerm} onChange={(event) => {
                setTerm(Number(event.target.value));
                setYearOverride(null);
                setSelected([]);
                setError(null);
              }}>
                {availableTerms.map((index) => (
                  <option key={index} value={index}>{Math.floor(index / 2) + 1}학년 {index % 2 + 1}학기</option>
                ))}
              </select>
            </label>
            <label className={styles.label}>실제 수강 연도
              <input inputMode="numeric" maxLength={4} value={year}
                onChange={(event) => setYearOverride(event.target.value)} />
            </label>
          </div>
          <ul className={styles.checklist}>
            {rows.map(({ entry, course, registered }) => (
              <li key={entry.course_code}>
                <label className={styles.checkRow}>
                  <input type="checkbox" checked={registered || selected.includes(entry.course_code)}
                    disabled={registered} onChange={(event) => {
                      const checked = event.target.checked;
                      setSelected((codes) => checked ? [...codes, entry.course_code] : codes.filter((code) => code !== entry.course_code));
                    }} />
                  <span><strong>{course?.name_ko ?? entry.course_code}</strong> <span className={styles.code}>{entry.course_code}</span></span>
                  <span className={styles.muted}>{registered ? '등록됨' : course?.credit == null ? '학점 미정' : `${course.credit}학점`}</span>
                </label>
              </li>
            ))}
          </ul>
        </>
      )}
      {error && <p role="alert" className={styles.error}>{error}</p>}
      <div className={styles.summary}>
        <span aria-live="polite">{pending.length}과목 선택</span>
        <div className={styles.actions}>
          <Button onClick={onCancel}>닫기</Button>
          <Button className={styles.primary} disabled={pending.length === 0} onClick={save}>선택 과목 등록</Button>
        </div>
      </div>
    </fieldset>
  );
}
