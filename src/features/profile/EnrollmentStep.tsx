'use client';

import type { JSX } from 'react';
import { useEnrollments, useReference } from '@/lib/user-data/hooks';
import styles from './profile.module.css';

export function EnrollmentStep(): JSX.Element {
  const { items } = useEnrollments();
  const { courses } = useReference();
  return (
    <div className={styles.group}>
      <h2>저장된 과목</h2>
      <p>저장된 수강 내역 {items.length}건</p>
      {items.length > 0 && (
        <ul className={styles.enrollmentRows}>
          {items.map((item) => (
            <li key={item.id}>
              <strong>{courses.get(item.course_code)?.name_ko ?? item.course_code}</strong>
              <code>{item.course_code}</code>
            </li>
          ))}
        </ul>
      )}
      <p className={styles.help}>설정을 마친 뒤 수강 이력에서 과목을 등록하거나 수정할 수 있어요.</p>
    </div>
  );
}
