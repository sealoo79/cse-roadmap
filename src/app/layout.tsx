import type { Metadata } from 'next';
import type { JSX, ReactNode } from 'react';
import { Navigation } from '@/components/layout/Navigation';
import { AppProviders } from '@/components/layout/AppProviders';
import { DemoStatus } from '@/components/layout/DemoStatus';
import './globals.css';

export const metadata: Metadata = { title: 'CSE Roadmap | 컴퓨터학부 수강 로드맵', description: '나의 이수 기록을 바탕으로 살펴보는 컴퓨터학부 수강 로드맵' };
export default function RootLayout({ children }: { children: ReactNode }): JSX.Element {
  return <html lang="ko"><body><a href="#main-content" className="skip-link">본문으로 이동</a>
    <AppProviders><Navigation /><DemoStatus /><main id="main-content" className="page">{children}</main></AppProviders>
  </body></html>;
}
