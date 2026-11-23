'use client';

import type { JSX, ReactNode } from 'react';
import { UserDataProvider } from '@/lib/user-data/provider';

export function AppProviders({ children }: { children: ReactNode }): JSX.Element {
  if (process.env.NEXT_PUBLIC_USE_MOCK !== '1') {
    return <main className="page"><h1>실행 설정이 필요합니다</h1><p>개발용 실행은 .env.local에서 NEXT_PUBLIC_USE_MOCK=1을 설정해 주세요.</p><p>인증과 실제 저장소는 후속 작업에서 연결합니다.</p></main>;
  }
  return <UserDataProvider>{children}</UserDataProvider>;
}
