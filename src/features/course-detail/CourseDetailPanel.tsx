'use client';

import { useEffect, useId, useRef, useState, type JSX, type PointerEvent as ReactPointerEvent, type KeyboardEvent as ReactKeyboardEvent } from 'react';
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

interface Offset { x: number; y: number }
const NO_OFFSET: Offset = { x: 0, y: 0 };
/** 방향키로 패널을 옮길 때 한 번에 움직이는 거리(px). Shift를 누르면 네 배. */
const KEY_STEP = 24;

export function CourseDetailPanel({ code, onClose, onNavigate }: PanelProps): JSX.Element | null {
  // 옮긴 위치는 패널을 닫았다 열거나 다른 과목으로 바꿔도 유지한다(노선도를 가리지 않는 자리에 두고 계속 쓰도록).
  const [offset, setOffset] = useState<Offset>(NO_OFFSET);
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
    recommendation={recommendations.find((item) => item.code === code)} onClose={onClose} onNavigate={onNavigate}
    offset={offset} onMove={setOffset} />;
}

interface DetailProps extends Pick<PanelProps, 'onClose' | 'onNavigate'> {
  course: Course;
  courses: ReadonlyMap<CourseCode, Course>;
  completion: CompletionState;
  curriculum: CurriculumEntry | undefined;
  relations: CourseRelation[];
  equivalents: CourseEquivalent[];
  recommendation: Recommendation | undefined;
  offset: Offset;
  onMove(offset: Offset): void;
}

/** 패널이 화면 밖으로 완전히 나가지 않도록, 머리 부분이 늘 화면 안에 남게 이동 범위를 제한한다. */
function clampOffset(panel: HTMLElement, current: Offset, next: Offset): Offset {
  const rect = panel.getBoundingClientRect();
  const baseLeft = rect.left - current.x;
  const baseTop = rect.top - current.y;
  const keep = 64;
  return {
    x: Math.min(window.innerWidth - keep - baseLeft, Math.max(keep - rect.width - baseLeft, next.x)),
    y: Math.min(window.innerHeight - keep - baseTop, Math.max(-baseTop, next.y)),
  };
}

function CourseDetail({
  course, courses, completion, curriculum, relations, equivalents, recommendation, onClose, onNavigate, offset, onMove,
}: DetailProps): JSX.Element {
  const titleId = useId();
  const panel = useRef<HTMLElement>(null);
  const close = useRef<HTMLButtonElement>(null);
  const drag = useRef<{ pointerId: number; startX: number; startY: number; origin: Offset } | null>(null);
  const [dragging, setDragging] = useState(false);
  const code = course.course_code;

  // 머리 부분(제목 줄)을 끌어 패널을 옮긴다. 닫기 버튼·링크를 누를 때는 끌지 않는다.
  function startDrag(event: ReactPointerEvent<HTMLElement>): void {
    if (event.button !== 0 || (event.target as Element).closest('button:not([data-grip]), a')) return;
    drag.current = { pointerId: event.pointerId, startX: event.clientX, startY: event.clientY, origin: shift };
    event.currentTarget.setPointerCapture?.(event.pointerId);
    setDragging(true);
    event.preventDefault();
  }
  function moveDrag(event: ReactPointerEvent<HTMLElement>): void {
    const state = drag.current;
    if (!state || state.pointerId !== event.pointerId || !panel.current) return;
    onMove(clampOffset(panel.current, shift, {
      x: state.origin.x + event.clientX - state.startX, y: state.origin.y + event.clientY - state.startY,
    }));
  }
  function endDrag(event: ReactPointerEvent<HTMLElement>): void {
    if (drag.current?.pointerId !== event.pointerId) return;
    drag.current = null;
    setDragging(false);
  }
  // 키보드로도 옮길 수 있게, 이동 손잡이에서 방향키를 받는다.
  function moveByKey(event: ReactKeyboardEvent<HTMLButtonElement>): void {
    const step = event.shiftKey ? KEY_STEP * 4 : KEY_STEP;
    const delta = { ArrowLeft: [-step, 0], ArrowRight: [step, 0], ArrowUp: [0, -step], ArrowDown: [0, step] }[event.key];
    if (!delta || !panel.current) return;
    event.preventDefault();
    onMove(clampOffset(panel.current, shift, { x: shift.x + delta[0], y: shift.y + delta[1] }));
  }
  const moved = offset.x !== 0 || offset.y !== 0;
  // 직접 옮기지 않았다면, 선택한 과목과 후수 과목 역을 가리지 않는 모서리로 패널을 자동으로 비켜 둔다.
  const [autoShift, setAutoShift] = useState<Offset>(NO_OFFSET);
  useEffect(() => {
    if (moved) return;
    const frame = requestAnimationFrame(() => {
      const element = panel.current;
      if (!element) return;
      const targets = [...document.querySelectorAll<HTMLElement>(
        `[data-roadmap-node="${CSS.escape(code)}"], [data-roadmap-chain]`,
      )].map((station) => station.getBoundingClientRect());
      if (targets.length === 0) { setAutoShift(NO_OFFSET); return; }
      const rect = element.getBoundingClientRect();
      setAutoShift((current) => {
        const base = { left: rect.left - current.x, top: rect.top - current.y };
        const margin = 16;
        const down = Math.max(0, window.innerHeight - margin - rect.height - base.top);
        const candidates: Offset[] = [NO_OFFSET, { x: margin - base.left, y: 0 }, { x: 0, y: down }, { x: margin - base.left, y: down }];
        const covered = (shift: Offset): number => targets.reduce((sum, target) => {
          const left = base.left + shift.x;
          const top = base.top + shift.y;
          const w = Math.min(left + rect.width, target.right) - Math.max(left, target.left);
          const h = Math.min(top + rect.height, target.bottom) - Math.max(top, target.top);
          return sum + (w > 0 && h > 0 ? w * h : 0);
        }, 0);
        return candidates.reduce((a, b) => (covered(b) < covered(a) ? b : a));
      });
    });
    return () => cancelAnimationFrame(frame);
  }, [code, moved]);
  const shift = moved ? offset : autoShift;

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
  // 후수의 후수까지: 직접 후수(1단계) 다음부터 몇 단계 뒤에 열리는 과목인지 함께 보여 준다.
  const laterSuccessors: { code: CourseCode; step: number }[] = [];
  {
    const seen = new Set<CourseCode>([code, ...[...successors.values()].map(({ to_code }) => to_code)]);
    let frontier = [...new Set([...successors.values()].map(({ to_code }) => to_code))];
    for (let step = 2; frontier.length > 0 && step <= 8; step++) {
      const next: CourseCode[] = [];
      for (const from of frontier) {
        for (const { type, from_code, to_code } of relations) {
          if (type === 'coreq' || from_code !== from || seen.has(to_code)) continue;
          seen.add(to_code);
          next.push(to_code);
          laterSuccessors.push({ code: to_code, step });
        }
      }
      frontier = next;
    }
  }
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
    <aside role="dialog" aria-labelledby={titleId} className={styles.panel} ref={panel} data-dragging={dragging}
      style={shift.x !== 0 || shift.y !== 0 ? { transform: `translate(${shift.x}px, ${shift.y}px)` } : undefined}>
      <header className={styles.header} onPointerDown={startDrag} onPointerMove={moveDrag}
        onPointerUp={endDrag} onPointerCancel={endDrag}>
        <div className={styles.handle}>
          <button type="button" className={styles.grip} data-grip aria-label="과목 상세 패널 옮기기. 방향키로 이동"
            title="끌거나 방향키로 패널을 옮길 수 있어요" onKeyDown={moveByKey}>⠿</button>
          <span className={styles.hint} aria-hidden="true">끌어서 옮기기</span>
          {moved && <button type="button" className={styles.reset} onClick={() => onMove(NO_OFFSET)}>제자리</button>}
        </div>
        <div className={styles.titleBlock}>
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
        {laterSuccessors.length > 0 && <>
          <p className={styles.subheading}>그다음 이어지는 과목</p>
          <ul className={styles.relationList}>
            {laterSuccessors.map(({ code: target, step }) =>
              <li key={target}>{courseLink(target)}<span>{step}단계 후</span></li>)}
          </ul>
        </>}
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
