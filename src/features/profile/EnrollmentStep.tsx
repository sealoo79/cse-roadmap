'use client';

import type { JSX } from 'react';
import { EnrollmentEditor } from '@/features/enrollments';
import type { AdmissionYear, ProgramId } from '@/types/reference';

/**
 * 온보딩 2단계: 수강 이력 화면(/enrollments)과 같은 편집기로 과목을 직접 추가하거나 교육과정에서 고른다.
 * 프로필은 마지막 단계에서 저장되므로 1단계에서 고른 전공·학번을 받아 교육과정을 불러온다.
 */
export function EnrollmentStep({ programId, admissionYear }: {
  programId: ProgramId;
  admissionYear: AdmissionYear;
}): JSX.Element {
  return <EnrollmentEditor mode="onboarding" programId={programId} admissionYear={admissionYear} />;
}
