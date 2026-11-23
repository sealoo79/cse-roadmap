'use client';

import type { JSX } from 'react';
import { useEnrollments } from '@/lib/user-data/hooks';
import styles from './profile.module.css';

export function EnrollmentStep(): JSX.Element {
  const { items } = useEnrollments();
  return (
    <div className={styles.group}>
      <h2>수강 내역</h2>
      <p>저장된 수강 내역 {items.length}건</p>
      <p className={styles.help}>수강 내역 등록 화면 연결 전에는 이 단계를 건너뛸 수 있습니다.</p>
    </div>
  );
}
