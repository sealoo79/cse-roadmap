'use client';

import Link from 'next/link';
import type { JSX } from 'react';
import { EnrollmentEditor } from '@/features/enrollments';
import { useProfile } from '@/lib/user-data/hooks';

export default function Page(): JSX.Element {
  const { profile, loading, error } = useProfile();
  return (
    <>
      <h1>수강 이력</h1>
      <p className="page-description">이수한 과목과 수강 중인 과목을 관리하세요.</p>
      {loading ? <p role="status">수강 이력을 불러오는 중입니다.</p> : profile ? (
        <EnrollmentEditor mode="manage" programId={profile.program_id} admissionYear={profile.admission_year} />
      ) : error ? <p className="error" role="alert">{error.message}</p> : (
        <p>전공과 학번을 먼저 <Link className="inline-link" href="/onboarding">등록해 주세요</Link>.</p>
      )}
    </>
  );
}
