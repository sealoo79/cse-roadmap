'use client';

import { useId, useMemo, useRef, useState, type CSSProperties, type JSX } from 'react';
import { getCurriculum } from '@/lib/reference';
import { useProfile, useReference } from '@/lib/user-data/hooks';
import type { Course, CourseCode, FieldId } from '@/types/reference';
import styles from './search.module.css';

function normalize(query: string): string {
  return query.normalize('NFKC').replace(/\s+/g, '').toLowerCase();
}

export function RoadmapSearch({
  onSelect, visibleFields, onChangeVisibleFields,
}: {
  onSelect(code: CourseCode): void;
  visibleFields: FieldId[];
  onChangeVisibleFields(ids: FieldId[]): void;
}): JSX.Element {
  const { profile } = useProfile();
  const { courses, fields } = useReference();
  const [query, setQuery] = useState('');
  const inputId = useId();
  const input = useRef<HTMLInputElement>(null);
  const results = useRef<HTMLUListElement>(null);
  const program = profile?.program_id;
  const year = profile?.admission_year;

  const roadmapCourses = useMemo(() => {
    if (!program || year === undefined) return [];

    const codes = new Set(getCurriculum(program, year).map(({ course_code }) => course_code));
    return Array.from(codes, (code) => courses.get(code))
      .filter((course): course is Course => course !== undefined)
      .sort((a, b) => a.name_ko.localeCompare(b.name_ko, 'ko') || a.course_code.localeCompare(b.course_code));
  }, [courses, program, year]);
  const term = normalize(query);
  const matches = useMemo(() => term ? roadmapCourses.filter((course) =>
    [course.course_code, course.name_ko, course.name_en ?? '', ...course.name_variants]
      .some((value) => normalize(value).includes(term)),
  ) : [], [roadmapCourses, term]);

  function select(code: CourseCode): void {
    setQuery('');
    input.current?.focus({ preventScroll: true });
    onSelect(code);
  }

  const allFields = fields.map(({ field_id }) => field_id);
  return (
    <div className={styles.tools}>
      <form className={styles.search} role="search" aria-label="노선도 과목 검색"
        onSubmit={(event) => {
          event.preventDefault();
          const match = matches[0];
          if (match) select(match.course_code);
        }}
        onKeyDown={(event) => {
          if (!event.nativeEvent.isComposing && event.key === 'Escape' && query) {
            event.preventDefault();
            setQuery('');
            input.current?.focus();
          }
        }}>
        <label htmlFor={inputId} className={styles.label}>과목 검색</label>
        <input id={inputId} ref={input} type="search" value={query} placeholder="과목명 또는 과목코드"
          className={styles.input} onChange={(event) => setQuery(event.target.value)}
          onKeyDown={(event) => {
            if (!event.nativeEvent.isComposing && event.key === 'ArrowDown' && matches.length) {
              event.preventDefault();
              results.current?.querySelector('button')?.focus();
            }
          }} />
        {term && (
          <div className={styles.results}>
            {matches.length === 0 ? <p role="status">검색 결과가 없어요.</p> : (
              <ul ref={results} aria-label="과목 검색 결과">
                {matches.map((course) => (
                  <li key={course.course_code}>
                    <button type="button" onClick={() => select(course.course_code)}>
                      <span>{course.name_ko}</span>{' '}<small>{course.course_code}</small>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}
      </form>
      <div role="group" aria-label="분야 필터" className={styles.filters}>
        {fields.map((field) => {
          const shown = visibleFields.includes(field.field_id);
          return (
            <button key={field.field_id} type="button" aria-pressed={shown} className={styles.chip}
              style={{ '--field-light': field.color, '--field-dark': field.color_dark ?? field.color } as CSSProperties}
              onClick={() => onChangeVisibleFields(shown
                ? visibleFields.filter((id) => id !== field.field_id)
                : [...visibleFields, field.field_id])}>
              <span aria-hidden="true" />{field.name_ko}
            </button>
          );
        })}
        <button type="button" className={styles.reset} disabled={allFields.every((id) => visibleFields.includes(id))}
          onClick={() => onChangeVisibleFields(allFields)}>필터 초기화</button>
      </div>
    </div>
  );
}
