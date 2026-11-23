'use client';

import { useEffect, useId, useRef, useState, type JSX } from 'react';
import { Button } from '@/components/ui/Button';
import { useCompletion, useEnrollments, useReference } from '@/lib/user-data/hooks';
import type { AdmissionYear, CourseCode, ProgramId } from '@/types/reference';
import type { Enrollment, NewEnrollment } from '@/types/user';
import { CurriculumChecklist } from './CurriculumChecklist';
import { sameEnrollment, statusLabels, terms } from './enrollment-fields';
import { ManualEnrollment } from './ManualEnrollment';
import styles from './enrollments.module.css';

interface Props {
  mode: 'onboarding' | 'manage';
  programId: ProgramId;
  admissionYear: AdmissionYear;
  onDone?(): void;
}

type Panel = { type: 'manual'; record?: Enrollment } | { type: 'curriculum' };
type Notice = { message: string; error: boolean };
type Confirmation = { message: string; label: string; apply(): Promise<void> };

export function EnrollmentEditor({ mode, programId, admissionYear, onDone }: Props): JSX.Element {
  const reference = useReference();
  const { items, loading, add, update, remove } = useEnrollments();
  const completion = useCompletion();
  const [panel, setPanel] = useState<Panel | null>(null);
  const [notice, setNotice] = useState<Notice | null>(null);
  const [confirmation, setConfirmation] = useState<Confirmation | null>(null);
  const [saving, setSaving] = useState(false);
  const busy = useRef(false);
  const actionOrigin = useRef<HTMLButtonElement | null>(null);
  const confirmationOrigin = useRef<HTMLButtonElement | null>(null);
  const confirmCancel = useRef<HTMLButtonElement>(null);
  const manualButton = useRef<HTMLButtonElement>(null);
  const heading = useId();

  useEffect(() => {
    if (confirmation) confirmCancel.current?.focus();
  }, [confirmation]);

  function closePanel(): void {
    setPanel(null);
    setNotice(null);
    requestAnimationFrame(() => (actionOrigin.current ?? manualButton.current)?.focus());
  }

  function cancelConfirmation(): void {
    setConfirmation(null);
    requestAnimationFrame(() => confirmationOrigin.current?.focus());
  }

  async function perform(action: () => Promise<void>): Promise<void> {
    if (busy.current) return;
    busy.current = true;
    setSaving(true);
    setConfirmation(null);
    setNotice(null);
    try {
      await action();
    } catch {
      setNotice({ error: true, message: '수강 이력을 저장할 수 없습니다. 다시 시도해 주세요.' });
    } finally {
      busy.current = false;
      setSaving(false);
    }
  }

  function requestSave(inputs: NewEnrollment[], editing?: Enrollment, onSaved?: (codes: CourseCode[]) => void): void {
    if (busy.current || inputs.length === 0) return;
    if (inputs.some((input) => items.some((item) => item.id !== editing?.id && sameEnrollment(item, input)))) {
      setNotice({ error: true, message: '같은 과목의 수강 기록이 해당 연도와 학기에 이미 있습니다. 기존 기록을 수정해 주세요.' });
      return;
    }

    const apply = async (): Promise<void> => {
      const saved: CourseCode[] = [];
      for (const input of inputs) {
        const result = editing ? await update(editing.id, input) : await add(input);
        if (!result.ok) {
          onSaved?.(saved);
          const summary = saved.length ? `${saved.length}과목을 등록했습니다. ` : '';
          setNotice({ error: true, message: `${summary}${input.course_code} 저장 실패. ${result.error.message}` });
          return;
        }
        saved.push(input.course_code);
      }
      onSaved?.(saved);
      if (!onSaved) closePanel();
      setNotice({
        error: false,
        message: editing ? '수강 기록을 수정했습니다.' : `${saved.length}과목을 등록했습니다.`,
      });
    };

    const retakes = inputs.filter((input) => {
      if (editing && sameEnrollment(editing, input)) return false;
      return items.some((item) => item.id !== editing?.id
        && completion.canonicalOf(item.course_code) === completion.canonicalOf(input.course_code));
    });

    if (retakes.length === 0) {
      void perform(apply);
      return;
    }
    const names = retakes.map(({ course_code }) => reference.courses.get(course_code)?.name_ko ?? course_code);
    setNotice(null);
    if (document.activeElement instanceof HTMLButtonElement) confirmationOrigin.current = document.activeElement;
    setConfirmation({
      message: `${names.join(', ')}의 수강 기록이 이미 있습니다. 재수강 기록으로 저장할까요?`,
      label: '재수강으로 저장',
      apply,
    });
  }

  function requestRemove(record: Enrollment): void {
    setNotice(null);
    setConfirmation({
      message: `${reference.courses.get(record.course_code)?.name_ko ?? record.course_code} 수강 기록을 삭제할까요?`,
      label: '기록 삭제',
      async apply() {
        const result = await remove(record.id);
        if (result.ok) {
          if (panel?.type === 'manual' && panel.record?.id === record.id) setPanel(null);
          requestAnimationFrame(() => manualButton.current?.focus());
        }
        setNotice(result.ok
          ? { error: false, message: '수강 기록을 삭제했습니다.' }
          : { error: true, message: result.error.message });
      },
    });
  }

  if (loading) return <p role="status">수강 이력을 불러오는 중입니다.</p>;

  const disabled = saving || confirmation !== null;
  const curriculum = reference.curriculum.filter((item) => item.program_id === programId && item.admission_year === admissionYear);
  const groups = new Map<string, Enrollment[]>();
  for (const item of items) {
    const key = `${item.taken_year}-${item.taken_semester}`;
    const group = groups.get(key);
    if (group) group.push(item);
    else groups.set(key, [item]);
  }
  const sortedGroups = [...groups.values()].sort(([a], [b]) => b.taken_year - a.taken_year
    || terms.findIndex((term) => term.value === b.taken_semester) - terms.findIndex((term) => term.value === a.taken_semester));

  return (
    <section className={styles.editor} aria-labelledby={heading} aria-busy={saving}>
      <div className={styles.header}>
        <h2 id={heading}>수강 기록</h2>
        <div className={styles.actions}>
          <button type="button" className="button" ref={manualButton} disabled={disabled} onClick={(event) => {
            actionOrigin.current = event.currentTarget;
            setNotice(null);
            setPanel({ type: 'manual' });
          }}>과목 직접 추가</button>
          <Button disabled={disabled} onClick={(event) => {
            actionOrigin.current = event.currentTarget;
            setNotice(null);
            setPanel({ type: 'curriculum' });
          }}>교육과정에서 추가</Button>
        </div>
      </div>
      {panel?.type === 'manual' && (
        <ManualEnrollment key={panel.record?.id ?? 'new'} reference={reference} record={panel.record}
          disabled={disabled} onSave={(input) => requestSave([input], panel.record)} onCancel={closePanel} />
      )}
      {panel?.type === 'curriculum' && (
        <CurriculumChecklist key={`${programId}-${admissionYear}`} admissionYear={admissionYear}
          curriculum={curriculum} reference={reference} records={items} disabled={disabled}
          onSave={(inputs, onSaved) => requestSave(inputs, undefined, onSaved)} onCancel={closePanel} />
      )}
      {confirmation && (
        <div className={styles.panel} role="group" aria-label="수강 기록 확인" onKeyDown={(event) => {
          if (event.key === 'Escape') cancelConfirmation();
        }}>
          <p>{confirmation.message}</p>
          <div className={styles.actions}>
            <button type="button" className="button" ref={confirmCancel} onClick={cancelConfirmation}>취소</button>
            <Button className={styles.primary} onClick={() => void perform(confirmation.apply)}>{confirmation.label}</Button>
          </div>
        </div>
      )}
      {notice && <p role={notice.error ? 'alert' : 'status'} className={notice.error ? styles.error : styles.success}>{notice.message}</p>}
      {items.length === 0 && <p className={styles.muted}>등록된 수강 기록이 없습니다.</p>}
      {sortedGroups.map((group) => {
        const [{ taken_year, taken_semester }] = group;
        const termHeading = `${heading}-${taken_year}-${taken_semester}`;
        return (
          <section key={termHeading} aria-labelledby={termHeading} className={styles.term}>
            <div className={styles.header}>
              <h3 id={termHeading}>{taken_year}년 {terms.find((term) => term.value === taken_semester)?.label}</h3>
              <span className={styles.muted}>{group.length}과목</span>
            </div>
            <ul className={styles.records}>
              {group.map((record) => {
                const course = reference.courses.get(record.course_code);
                const credit = record.credit ?? course?.credit;
                const name = course?.name_ko ?? record.course_code;
                return (
                  <li key={record.id} className={styles.record}>
                    <div><strong>{name}</strong> <span className={styles.code}>{record.course_code}</span></div>
                    <span>{credit == null ? '학점 미정' : `${credit}학점`}</span>
                    <span className={styles[record.status]}>{statusLabels[record.status]}</span>
                    <div className={styles.actions}>
                      <Button disabled={disabled} aria-label={`${name} ${record.course_code} 수강 기록 수정`}
                        onClick={(event) => {
                          actionOrigin.current = event.currentTarget;
                          setNotice(null);
                          setPanel({ type: 'manual', record });
                        }}>수정</Button>
                      <Button disabled={disabled} aria-label={`${name} ${record.course_code} 수강 기록 삭제`}
                        onClick={(event) => {
                          confirmationOrigin.current = event.currentTarget;
                          requestRemove(record);
                        }}>삭제</Button>
                    </div>
                  </li>
                );
              })}
            </ul>
          </section>
        );
      })}
      <div className={styles.summary}>
        <span aria-live="polite">수강 기록 {items.length}건 · 인정 학점 {completion.totalCredits}학점</span>
        {mode === 'onboarding' && onDone && (
          <Button className={styles.primary} disabled={disabled} onClick={onDone}>다음: 관심 분야</Button>
        )}
      </div>
    </section>
  );
}
