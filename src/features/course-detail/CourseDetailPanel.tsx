'use client';

import { useEffect, useId, useRef, type JSX } from 'react';
import { useRecommendations } from '@/features/recommend/useRecommendations';
import { getCurriculum, getRelations } from '@/lib/reference';
import { useCompletion, useProfile, useReference } from '@/lib/user-data/hooks';
import type { CompletionState } from '@/lib/domain/completion';
import type { Recommendation } from '@/lib/domain/recommend';
import type { Course, CourseCode, CourseEquivalent, CourseRelation, CurriculumEntry } from '@/types/reference';
import styles from './course-detail.module.css';

interface PanelProps {
  code: CourseCode | null;
  onClose(): void;
  onNavigate(code: CourseCode): void;
}

const relationLabel: Record<CourseRelation['type'], string> = {
  official: '필수 선수',
  recommended: '권장 선수',
  coreq: '동시 수강',
};

export function CourseDetailPanel({ code, onClose, onNavigate }: PanelProps): JSX.Element | null {
  const { courses, equivalents } = useReference();
  const { profile } = useProfile();
  const completion = useCompletion();
  const recommendations = useRecommendations();
  const course = code === null ? undefined : courses.get(code);
  if (!course) return null;

  const relations = profile ? getRelations(profile.program_id, profile.admission_year) : [];
  const curriculum = profile
    ? getCurriculum(profile.program_id, profile.admission_year).find(({ course_code }) => course_code === code)
    : undefined;

  return <CourseDetail course={course} courses={courses} completion={completion} curriculum={curriculum}
    relations={relations} equivalents={equivalents}
    recommendation={recommendations.find((item) => item.code === code)} onClose={onClose} onNavigate={onNavigate} />;
}

interface DetailProps extends Pick<PanelProps, 'onClose' | 'onNavigate'> {
  course: Course;
  courses: ReadonlyMap<CourseCode, Course>;
  completion: CompletionState;
  curriculum: CurriculumEntry | undefined;
  relations: CourseRelation[];
  equivalents: CourseEquivalent[];
  recommendation: Recommendation | undefined;
}

function CourseDetail({
  course, courses, completion, curriculum, relations, equivalents, recommendation, onClose, onNavigate,
}: DetailProps): JSX.Element {
  const titleId = useId();
  const panel = useRef<HTMLElement>(null);
  const close = useRef<HTMLButtonElement>(null);
  const code = course.course_code;

  useEffect(() => {
    const previous = document.activeElement;
    return () => { if (previous instanceof HTMLElement && previous.isConnected) previous.focus({ preventScroll: true }); };
  }, []);

  useEffect(() => {
    close.current?.focus({ preventScroll: true });
    if (panel.current) panel.current.scrollTop = 0;
  }, [code]);

  useEffect(() => {
    function handleKey(event: KeyboardEvent): void {
      if (event.key !== 'Escape' || event.defaultPrevented || event.isComposing) return;
      event.preventDefault();
      onClose();
    }
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [onClose]);

  const incoming = relations.filter(({ type, to_code }) => type !== 'coreq' && to_code === code);
  const officialGroups = new Map<number, Set<CourseCode>>();
  for (const relation of incoming) {
    if (relation.type !== 'official') continue;
    const codes = officialGroups.get(relation.group_no) ?? new Set<CourseCode>();
    codes.add(relation.from_code);
    officialGroups.set(relation.group_no, codes);
  }
  const recommended = new Set(incoming.filter(({ type }) => type === 'recommended').map(({ from_code }) => from_code));
  const corequisites = new Set(relations.filter(({ type, from_code, to_code }) => type === 'coreq'
    && (from_code === code || to_code === code)).map(({ from_code, to_code }) => from_code === code ? to_code : from_code));
  const successors = new Map(relations.filter(({ type, from_code }) => type !== 'coreq' && from_code === code)
    .map(({ to_code, type }) => [`${to_code}/${type}`, { to_code, type }]));
  const sameCourses = equivalents.filter(({ old_code, new_code, relation }) => relation === 'same_course'
    && (old_code === code || new_code === code));

  const inProgress = (relatedCode: CourseCode): boolean => completion.inProgress.has(completion.canonicalOf(relatedCode));
  const status = completion.isCompleted(code) ? '이수 완료' : inProgress(code) ? '수강 중' : '미이수';
  const hasPrerequisites = officialGroups.size > 0 || recommended.size > 0 || corequisites.size > 0;
  const courseLink = (target: CourseCode): JSX.Element => (
    <a href={`/roadmap?course=${encodeURIComponent(target)}`} className={styles.courseLink}
      onClick={(event) => {
        if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
        event.preventDefault();
        onNavigate(target);
      }}>
      {courses.get(target)?.name_ko ?? target}
      {courses.has(target) && <>{' '}<small>{target}</small></>}
    </a>
  );

  return (
    <aside role="dialog" aria-labelledby={titleId} className={styles.panel} ref={panel}>
      <header className={styles.header}>
        <div>
          <p className={styles.code}>{code}</p>
          <h2 id={titleId}>{course.name_ko}</h2>
          <p className={styles.status}>{status}</p>
        </div>
        <button ref={close} type="button" className={styles.close} aria-label="과목 상세 닫기" onClick={onClose}>×</button>
      </header>

      <dl className={styles.facts}>
        <dt>학점</dt><dd>{course.credit === null ? '확인 필요' : `${course.credit}학점`}</dd>
        <dt>이론 / 실습</dt><dd>{course.theory ?? '미확인'} / {course.practice ?? '미확인'}</dd>
        <dt>개설 학기</dt><dd>{course.offered_semesters?.length ? course.offered_semesters.map((term) => `${term}학기`).join(' · ') : '확인 필요'}</dd>
        <dt>개설 학과</dt><dd>{course.offering_departments?.length ? course.offering_departments.join(' · ') : '확인 필요'}</dd>
        <dt>교과구분</dt><dd>{course.course_types.join(' · ') || (course.kind === 'major' ? '전공' : '교양')}</dd>
        {curriculum && <><dt>권장 이수</dt><dd>{curriculum.grade}학년 {curriculum.semester}학기</dd></>}
      </dl>

      {recommendation && (
        <section className={styles.section}>
          <h3>다음 학기 추천 이유</h3>
          <ul className={styles.reasons}>{recommendation.reasons.map((reason, i) =>
            <li key={`${reason.type}/${reason.fromCode ?? ''}/${i}`}>{reason.label}</li>)}</ul>
        </section>
      )}

      <section className={styles.section}>
        <h3>선수·동시 수강 과목</h3>
        {!hasPrerequisites && <p className={styles.muted}>등록된 과목이 없어요.</p>}
        {[...officialGroups].map(([group, codes]) => {
          const met = [...codes].some((target) => completion.isCompleted(target));
          return (
            <div key={group} className={styles.relationGroup}>
              <p>{codes.size > 1 ? '필수 선수 · 아래 과목 중 하나' : '필수 선수'}
                <span data-warning={!met}>{met ? '충족' : '미충족 · 사전승인 필요'}</span></p>
              <ul>{[...codes].map((target) => <li key={target}>{courseLink(target)}</li>)}</ul>
            </div>
          );
        })}
        {recommended.size > 0 && <div className={styles.relationGroup}>
          <p>{relationLabel.recommended}</p>
          <ul>{[...recommended].map((target) => (
            <li key={target}>{courseLink(target)}{!completion.isCompleted(target) && <span data-warning>권장 과목 미이수</span>}</li>
          ))}</ul>
        </div>}
        {corequisites.size > 0 && <div className={styles.relationGroup}>
          <p>{relationLabel.coreq}</p>
          <ul>{[...corequisites].map((target) => {
            const met = completion.isCompleted(target) || inProgress(target);
            return <li key={target}>{courseLink(target)}{!met && <span data-warning>동시 수강 필요</span>}</li>;
          })}</ul>
        </div>}
      </section>

      <section className={styles.section}>
        <h3>후수 과목</h3>
        {successors.size === 0 ? <p className={styles.muted}>등록된 과목이 없어요.</p> : (
          <ul className={styles.relationList}>
            {[...successors].map(([key, { to_code, type }]) =>
              <li key={key}>{courseLink(to_code)}<span>{relationLabel[type]}</span></li>)}
          </ul>
        )}
      </section>

      {sameCourses.length > 0 && <section className={styles.section}>
        <h3>동일과목</h3>
        <ul className={styles.equivalents}>
          {sameCourses.map((item) => (
            <li key={item.equivalent_id}>
              <div><span>구 과목</span>{item.old_code === code ? <b>{code}</b> : courseLink(item.old_code)}</div>
              <div><span>신 과목</span>{item.new_code === code ? <b>{code}</b> : courseLink(item.new_code)}</div>
              {item.applies_to_years?.length ? <p className={styles.muted}>적용 학번 {item.applies_to_years.join(' · ')}</p> : null}
              {item.credit_recognition && <p className={styles.muted}>{item.credit_recognition}</p>}
              {item.counts_for_required === null && <p data-warning>필수 과목 인정 여부는 학과에 확인하세요.</p>}
            </li>
          ))}
        </ul>
      </section>}
    </aside>
  );
}
