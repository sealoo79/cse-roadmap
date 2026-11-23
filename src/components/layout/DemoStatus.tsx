'use client';

import Link from 'next/link';
import type { JSX } from 'react';
import { useEnrollments, useProfile, useReference } from '@/lib/user-data/hooks';

export function DemoStatus(): JSX.Element {
  const { profile, loading, error } = useProfile();
  const { items } = useEnrollments();
  const ref = useReference();
  if (loading) return <aside className="demo-status" role="status">시연 계정을 불러오는 중입니다.</aside>;
  if (error) return <aside className="demo-status error" role="alert">{error.message}</aside>;
  return <aside className="demo-status" aria-label="시연 계정 상태">
    <span className="badge">목 모드</span>
    {profile ? <span>{ref.programs.find((p) => p.program_id === profile.program_id)?.name} · {profile.admission_year}학번 · 수강 기록 {items.length}건</span>
      : <Link href="/onboarding">프로필을 등록해 주세요</Link>}
    <span className="muted">공식 졸업 판정과 추천 기능은 준비 중입니다.</span>
  </aside>;
}
