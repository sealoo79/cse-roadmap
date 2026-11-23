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

  return <UserDataProvider><Navigation />{useMock && <DemoStatus />}{content}</UserDataProvider>;
}
