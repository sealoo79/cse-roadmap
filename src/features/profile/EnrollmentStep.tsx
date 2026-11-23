'use client';

import type { JSX } from 'react';
import { EnrollmentEditor } from '@/features/enrollments';
import { OcrImport } from '@/features/ocr/OcrImport';
import { useEnrollments } from '@/lib/user-data/hooks';
import type { AdmissionYear, ProgramId } from '@/types/reference';
import styles from './profile.module.css';

/**
 * 온보딩 2단계: 시간표 캡처(OCR)로 한 번에 불러오거나, 직접·교육과정에서 골라 수강 내역을 넣는다.
 * 프로필은 마지막 단계에서 저장되므로 1단계에서 고른 전공·학번을 받아 교육과정과 과목 매칭에 쓴다.
 */
export function EnrollmentStep({ programId, admissionYear }: {
  programId: ProgramId | '';
  admissionYear: AdmissionYear | '';
}): JSX.Element {
  const { items } = useEnrollments();
  return (
    <div className={styles.group}>
      <p className={styles.help}>
        저장된 수강 내역 {items.length}건 · 지금 넣지 않아도 나중에 수강 이력에서 추가할 수 있어요.
      </p>
      <section className={styles.enrollmentMethod} aria-labelledby="onboarding-ocr">
        <h2 id="onboarding-ocr">시간표 캡처로 한 번에 불러오기</h2>
        <p className={styles.help}>에브리타임 등 시간표 화면을 캡처해 올리면 과목을 자동으로 찾아 줘요. 학기마다 한 장씩 올릴 수 있어요.</p>
        <OcrImport programId={programId} admissionYear={admissionYear} />
      </section>
      {programId && admissionYear && (
        <section className={styles.enrollmentMethod} aria-labelledby="onboarding-manual">
          <h2 id="onboarding-manual">직접 추가하거나 교육과정에서 고르기</h2>
          <EnrollmentEditor mode="onboarding" programId={programId} admissionYear={admissionYear} />
        </section>
      )}
    </div>
  );
}
