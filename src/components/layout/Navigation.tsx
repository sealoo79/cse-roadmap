'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useState, type JSX } from 'react';
import { Button } from '@/components/ui/Button';
import { useAuth } from '@/features/auth/useAuth';

export function Navigation(): JSX.Element {
  const pathname = usePathname();
  const { signOut } = useAuth();
  const [signingOut, setSigningOut] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function logout(): Promise<void> {
    setSigningOut(true);
    setError(null);
    try {
      await signOut();
    } catch {
      setError('로그아웃하지 못했습니다. 다시 시도해 주세요.');
      setSigningOut(false);
    }
  }

  return <header className="site-header">
    <Link href="/roadmap" className="brand" aria-label="컴퓨터학부 로드맵 홈"><span className="brand-symbol" aria-hidden="true">◎</span> CSE ROADMAP</Link>
    <nav aria-label="주요 메뉴" className="primary-nav">
      {[['/roadmap', '노선도'], ['/graduation', '졸업요건'], ['/recommend', '다음 학기 추천']].map(([href, label]) =>
        <Link key={href} href={href} aria-current={pathname === href ? 'page' : undefined}>{label}</Link>)}
    </nav>
    <nav aria-label="계정 메뉴" className="account-nav">
      <Link href="/account" aria-current={pathname === '/account' ? 'page' : undefined}>회원정보 변경</Link>
      <Button disabled={signingOut} onClick={() => void logout()}>로그아웃</Button>
      {error && <span role="alert" className="error">{error}</span>}
    </nav>
  </header>;
}
