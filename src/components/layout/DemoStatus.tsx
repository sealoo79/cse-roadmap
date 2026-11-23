'use client';

import Link from 'next/link';
import type { JSX } from 'react';
import { useEnrollments, useProfile, useReference } from '@/lib/user-data/hooks';

export function DemoStatus(): JSX.Element {
  const { profile, loading, error } = useProfile();
  const { items } = useEnrollments();
  const ref = useReference();
  return (
    <aside className="demo-status" aria-label="시연 계정 상태">
      <div className="demo-status-inner">
        {loading ? <span role="status">시연 계정을 불러오는 중입니다.</span> : error ? (
          <span className="error" role="alert">{error.message}</span>
        ) : (
          <>
            <span className="badge">목 모드</span>
            {profile ? <span>
              {ref.programs.find((p) => p.program_id === profile.program_id)?.name} · {profile.admission_year}학번 · 수강 기록 {items.length}건
            </span> : <Link href="/onboarding" className="inline-link">프로필을 등록해 주세요</Link>}
          </>
        )}
      </div>
    </aside>
  );
}
