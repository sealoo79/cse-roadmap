'use client';

import Link from 'next/link';
import type { JSX } from 'react';
import { GraduationProgress } from '@/features/graduation';
import { useProfile } from '@/lib/user-data/hooks';

export default function Page(): JSX.Element {
  const { profile, loading, error } = useProfile();
  return (
    <>
      <h1>졸업요건</h1>
      <p className="page-description">이수 기록으로 졸업요건 진행 상황을 계산하고, 비학점 요건은 직접 입력하세요.</p>
      {loading ? <p role="status">졸업요건을 계산하는 중입니다.</p> : profile ? (
        <GraduationProgress profile={profile} />
      ) : error ? <p className="error" role="alert">{error.message}</p> : (
        <p>전공과 학번을 먼저 <Link className="inline-link" href="/onboarding">등록해 주세요</Link>.</p>
      )}
    </>
  );
}
