'use client';

import Link from 'next/link';
import { useMemo, type JSX, type ReactNode } from 'react';
import { evaluateGraduation, type GraduationItem, type ItemStatus } from '@/lib/domain/graduation';
import { useCompletion, useNoncredit, useReference } from '@/lib/user-data/hooks';
import type { CourseCode, ReferenceData } from '@/types/reference';
import type { NoncreditStatus, Profile } from '@/types/user';
import { checklistRuleText } from './noncredit-status';
import { NoncreditInput } from './NoncreditInput';
import styles from './graduation.module.css';

const STATUS_LABEL: Record<ItemStatus, string> = {
  met: '충족', unmet: '미충족', unanswered: '미입력', unknown: '확인 필요',
};

export function StatusBadge({ status }: { status: ItemStatus }): JSX.Element {
  return <span className={styles.status} data-status={status}>{STATUS_LABEL[status]}</span>;
}

function percent(earned: number | null, required: number | null): number {
  if (earned === null || required === null || required <= 0) return 0;
  return Math.min(100, Math.round((earned / required) * 100));
}

function ProgressBar({ item, unit }: { item: GraduationItem; unit: string }): JSX.Element {
  const value = percent(item.earned, item.required);
  const known = item.status !== 'unknown' && item.required !== null;
  return (
    <div
      className={styles.bar} data-status={item.status} role="progressbar" aria-label={`${item.label} 진행률`}
      aria-valuemin={0} aria-valuemax={100} aria-valuenow={known ? value : undefined}
      aria-valuetext={known ? `${item.earned ?? 0}${unit} / ${item.required}${unit}` : '판정 불가'}
    >
      <i style={{ width: `${known ? value : 0}%` }} />
    </div>
  );
}

function amount(item: GraduationItem, unit: string): string {
  const earned = item.earned ?? '–';
  return item.required === null ? `${earned}${unit}` : `${earned} / ${item.required}${unit}`;
}

function courseName(ref: ReferenceData, code: CourseCode): string {
  return ref.courses.get(code)?.name_ko ?? code;
}

function Explanation({ item }: { item: GraduationItem }): JSX.Element | null {
  if (!item.note && !item.source) return null;
  return (
    <div className={styles.explanation}>
      {item.note && <p>{item.note}</p>}
      {item.source && <p className={styles.source}>근거: {item.source}</p>}
    </div>
  );
}

function CourseList({ reference, codes, label }: { reference: ReferenceData; codes: CourseCode[]; label: string }): JSX.Element | null {
  if (codes.length === 0) return null;
  return (
    <details className={styles.courses}>
      <summary>{label} {codes.length}과목</summary>
      <ul>
        {codes.map((code) => (
          <li key={code}><span>{courseName(reference, code)}</span> <span className={styles.code}>{code}</span></li>
        ))}
      </ul>
    </details>
  );
}

function Section({ title, aside, children }: { title: string; aside?: ReactNode; children: ReactNode }): JSX.Element {
  const id = `graduation-${title.replace(/\s+/g, '-')}`;
  return (
    <section className={styles.section} aria-labelledby={id}>
      <div className={styles.sectionHeader}>
        <h2 id={id}>{title}</h2>
        {aside && <span className={styles.aside}>{aside}</span>}
      </div>
      {children}
    </section>
  );
}

/** 학점 진행률 행(총 학점·버킷·영역 요건 공통). */
function CreditRow({ item, reference, children }: { item: GraduationItem; reference: ReferenceData; children?: ReactNode }): JSX.Element {
  return (
    <li className={styles.row} data-status={item.status} aria-label={item.label}>
      <div className={styles.rowMain}>
        <span className={styles.rowName}>{item.label}</span>
        <span className={styles.num}>{amount(item, '학점')}</span>
        <ProgressBar item={item} unit="학점" />
        <StatusBadge status={item.status} />
      </div>
      {item.remaining !== null && item.remaining > 0 && item.status !== 'unknown' && (
        <p className={styles.remaining}>{item.remaining}학점 더 필요</p>
      )}
      <CourseList reference={reference} codes={item.matchedCourses} label="인정 과목" />
      {children}
      <Explanation item={item} />
    </li>
  );
}

function RequiredCourses({ item, reference: ref, profile }: { item: GraduationItem; reference: ReferenceData; profile: Profile }): JSX.Element {
  const order = new Map<CourseCode, number>();
  for (const row of ref.curriculum) {
    if (row.program_id === profile.program_id && row.admission_year === profile.admission_year) {
      order.set(row.course_code, row.grade * 10 + row.semester);
    }
  }
  const rows = [...item.matchedCourses.map((code) => ({ code, done: true })), ...item.missingCourses.map((code) => ({ code, done: false }))]
    .sort((a, b) => (order.get(a.code) ?? 99) - (order.get(b.code) ?? 99) || a.code.localeCompare(b.code));

  if (item.status === 'unknown') {
    return <div className={styles.unknownBox}><StatusBadge status="unknown" /><Explanation item={item} /></div>;
  }
  return (
    <>
      <table className={styles.table}>
        <caption className={styles.visuallyHidden}>전공필수 과목 이수 현황</caption>
        <thead>
          <tr><th scope="col">권장</th><th scope="col">과목</th><th scope="col">코드</th><th scope="col" className={styles.right}>상태</th></tr>
        </thead>
        <tbody>
          {rows.map(({ code, done }) => {
            const at = order.get(code);
            return (
              <tr key={code} data-status={done ? 'met' : 'unmet'}>
                <td className={styles.code}>{at === undefined ? '–' : `${Math.floor(at / 10)}-${at % 10}`}</td>
                <td>{courseName(ref, code)}</td>
                <td className={styles.code}>{code}</td>
                <td className={styles.right}>
                  {done ? <span className={styles.status} data-status="met">이수</span> : (
                    <>
                      <span className={styles.status} data-status="unmet">미이수</span>{' '}
                      <Link
                        className="inline-link" href={`/roadmap?course=${encodeURIComponent(code)}`}
                        aria-label={`${courseName(ref, code)} 노선도에서 보기`}
                      >
                        노선도에서 보기
                      </Link>
                    </>
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
      <Explanation item={item} />
    </>
  );
}

/** evaluateGraduation 결과를 요건별 진행률로 보여 주고, 비학점 요건을 입력받는다. */
export function GraduationProgress({ profile }: { profile: Profile }): JSX.Element {
  const ref = useReference();
  const completion = useCompletion();
  const { items: noncredit } = useNoncredit();
  const report = useMemo(
    () => evaluateGraduation({ profile, completion, noncredit, ref }),
    [profile, completion, noncredit, ref],
  );

  const ruleText = useMemo(() => checklistRuleText(ref.rules, report.ruleIds), [ref.rules, report.ruleIds]);
  const answers = new Map<string, NoncreditStatus>(noncredit.map((n) => [n.checklist_key, n]));
  const programName = ref.programs.find((p) => p.program_id === profile.program_id)?.name ?? profile.program_id;

  const total = report.items.find((i) => i.kind === 'total');
  const buckets = report.items.filter((i) => i.kind === 'bucket');
  const required = report.items.find((i) => i.kind === 'required_courses');
  const requirements = report.items.filter((i) => i.kind === 'requirement');
  const checklist = report.items.filter((i) => i.kind === 'checklist');

  const input = (item: GraduationItem, legend: string): JSX.Element | null => {
    if (!item.checklistKey) return null;
    return (
      <NoncreditInput
        checklistKey={item.checklistKey} legend={legend} answer={answers.get(item.checklistKey)}
        definition={ref.checklist.find((c) => c.checklist_key === item.checklistKey)}
        rule={ruleText.get(item.checklistKey) ?? null}
      />
    );
  };

  return (
    <div className={styles.progress}>
      <p className={styles.context}>
        {programName} · {profile.admission_year}학번 · 이수 {completion.completed.size}과목 {completion.totalCredits}학점
      </p>

      <div className={styles.stats}>
        {total && (
          <div className={styles.stat} data-status={total.status}>
            <div className={styles.statLabel}>{total.label} <StatusBadge status={total.status} /></div>
            <div className={styles.statValue}>
              {total.earned ?? 0} <small>/ {total.required ?? '–'}학점</small>
            </div>
            <ProgressBar item={total} unit="학점" />
          </div>
        )}
        {required && required.status !== 'unknown' && (
          <div className={styles.stat} data-status={required.status}>
            <div className={styles.statLabel}>{required.label} <StatusBadge status={required.status} /></div>
            <div className={styles.statValue}>{required.earned} <small>/ {required.required}과목</small></div>
            <ProgressBar item={required} unit="과목" />
          </div>
        )}
        <div className={styles.stat}>
          <div className={styles.statLabel}>충족한 요건</div>
          <div className={styles.statValue}>{report.summary.met} <small>/ {report.summary.total}개</small></div>
          <div className={styles.bar} aria-hidden="true"><i style={{ width: `${percent(report.summary.met, report.summary.total)}%` }} /></div>
        </div>
      </div>
      {total && total.status === 'unknown' && <Explanation item={total} />}

      {buckets.length > 0 && (
        <Section title="영역별 학점" aside="이수 / 기준 학점">
          <ul className={styles.rows}>
            {buckets.map((item) => <CreditRow key={item.id} item={item} reference={ref} />)}
          </ul>
        </Section>
      )}

      {required && (
        <Section title="전공필수" aside={required.status === 'unknown' ? '확인 필요' : `${required.earned} / ${required.required}과목`}>
          <RequiredCourses item={required} reference={ref} profile={profile} />
        </Section>
      )}

      {requirements.length > 0 && (
        <Section title="교양·영역 요건" aside="인정 과목 학점">
          <ul className={styles.rows}>
            {requirements.map((item) => (
              <CreditRow key={item.id} item={item} reference={ref}>
                {item.checklistKey && (item.status !== 'met' || answers.has(item.checklistKey)) && (
                  <div className={styles.alternative}>
                    <p className={styles.help}>과목 대신 다른 방법(어학성적·교육 이수 등)으로 충족했나요?</p>
                    {input(item, `${item.label} 과목 외 충족 여부`)}
                  </div>
                )}
              </CreditRow>
            ))}
          </ul>
        </Section>
      )}

      {checklist.length > 0 && (
        <Section title="비학점 요건" aside="직접 입력">
          <ul className={styles.rows}>
            {checklist.map((item) => (
              <li key={item.id} className={styles.row} data-status={item.status} aria-label={item.label}>
                <div className={`${styles.rowMain} ${styles.compact}`}>
                  <span className={styles.rowName}>{item.label}</span>
                  <StatusBadge status={item.status} />
                </div>
                {input(item, item.label)}
                <Explanation item={item} />
              </li>
            ))}
          </ul>
        </Section>
      )}

      {report.needsConfirmation.length > 0 && (
        <Section title="학과 확인이 필요한 항목">
          <ul className={styles.confirm}>
            {report.needsConfirmation.map((text) => <li key={text}><StatusBadge status="unknown" /> {text}</li>)}
          </ul>
        </Section>
      )}

      <p className={styles.help}>
        이수 기록이나 비학점 입력을 바꾸면 바로 다시 계산합니다. 이수 기록은{' '}
        <Link className="inline-link" href="/enrollments">수강 이력</Link>에서 고칠 수 있습니다.
      </p>
    </div>
  );
}
