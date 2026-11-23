'use client';

import { usePathname } from 'next/navigation';
import type { JSX, ReactNode } from 'react';
import { UserDataProvider } from '@/lib/user-data/provider';
import { Navigation } from './Navigation';
import { DemoStatus } from './DemoStatus';

const useMock = process.env.NEXT_PUBLIC_USE_MOCK === '1';

export function AppProviders({ children }: { children: ReactNode }): JSX.Element {
  const pathname = usePathname();
  const content = <main id="main-content" className="page">{children}</main>;

  if (pathname === '/') return content;

  if (!useMock) {
    return <>
      <Navigation />
      <main id="main-content" className="page"><h1>사용자 데이터 연결을 준비 중입니다</h1></main>
    </>;
  }

  return <UserDataProvider><Navigation /><DemoStatus />{content}</UserDataProvider>;
}
