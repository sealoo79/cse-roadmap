'use client';

import Link from 'next/link';
import { useState, type CSSProperties, type JSX } from 'react';
import { EmptyState } from '@/components/ui/EmptyState';
import { useProfile, useReference } from '@/lib/user-data/hooks';
import type { FieldId } from '@/types/reference';
import { useRecommendations } from './useRecommendations';
import styles from './recommend.module.css';

export function RecommendationList(): JSX.Element {
  const { profile, loading, error } = useProfile();
  const ref = useReference();
  const recommendations = useRecommendations();
  const [selectedField, setSelectedField] = useState<FieldId | ''>('');

  if (loading) return <p role="status">추천 과목을 불러오는 중입니다.</p>;
  if (error) return <p className="error" role="alert">{error.message}</p>;
  if (!profile) return <EmptyState title="전공과 학번을 등록해 주세요.">
    <Link className="inline-link" href="/onboarding">처음 설정으로 이동</Link>
  </EmptyState>;

  const fields = [...ref.fields].sort((a, b) => a.order - b.order);
  const visible = recommendations.filter(({ code }) => !selectedField
    || ref.courseFields.get(code)?.field_ids.includes(selectedField));
  const fieldName = fields.find((field) => field.field_id === selectedField)?.name_ko;

  return (
    <section aria-label="추천 과목">
      <div className={styles.controls}>
        <label className={styles.filter}>
          관심 분야 필터
          <select value={selectedField} onChange={(event) => {
            const id = event.target.value;
            setSelectedField(fields.find((field) => field.field_id === id)?.field_id ?? '');
          }}>
            <option value="">전체 분야</option>
            {fields.map((field) => <option key={field.field_id} value={field.field_id}>{field.name_ko}</option>)}
          </select>
        </label>
        <Link className="inline-link" href="/account">내 관심 분야 변경</Link>
        <span className={styles.count} role="status">추천 {visible.length}과목</span>
      </div>

      {visible.length === 0 ? (
        <EmptyState title={selectedField ? `${fieldName} 분야의 추천 과목이 없습니다.` : '추천 과목이 없습니다.'}>
          {selectedField ? '다른 분야를 선택해 추천 과목을 확인해 보세요.' : '관심 분야와 수강 이력을 확인해 보세요.'}
        </EmptyState>
      ) : (
        <ol className={styles.list} aria-label="추천 순위">
          {visible.map(({ code, reasons, warning }) => {
            const course = ref.courses.get(code);
            const name = course?.name_ko ?? code;
            const primaryId = ref.courseFields.get(code)?.primary_field_id;
            const field = fields.find((item) => item.field_id === primaryId);
            const colors = field && {
              '--field-light': field.color, '--field-dark': field.color_dark ?? field.color,
            } as CSSProperties;

            return (
              <li key={code}>
                <article className={styles.card} style={colors}>
                  <div>
                    <h2 className={styles.title}>
                      {name}{course && <span className={styles.code}>{code}</span>}
                    </h2>
                    <ul className={styles.reasons} aria-label="추천 이유">
                      {reasons.map(({ type, label, fromCode }) => (
                        <li key={`${type}/${fromCode ?? ''}`} className={styles.reason}>{label}</li>
                      ))}
                    </ul>
                    {warning === 'prerequisite_unmet' && <p className={styles.warning}>미이수 선수과목 확인 필요</p>}
                  </div>
                  <div className={styles.details}>
                    {field && <span className={styles.field}>{field.name_ko}</span>}
                    {course?.credit != null && <span>{course.credit}학점</span>}
                    <Link className="inline-link" href={`/roadmap?course=${encodeURIComponent(code)}`}
                      aria-label={`${name} 노선도에서 보기`}>노선도에서 보기</Link>
                  </div>
                </article>
              </li>
            );
          })}
        </ol>
      )}
    </section>
  );
}
