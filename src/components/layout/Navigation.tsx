'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useState, type CSSProperties, type JSX } from 'react';
import { Button } from '@/components/ui/Button';
import { useReference } from '@/lib/user-data/hooks';
import { useAuth } from '@/features/auth/useAuth';

export function Navigation(): JSX.Element {
  const pathname = usePathname();
  const { fields } = useReference();
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

  return (
    <header className="site-header">
      <div className="site-header-inner">
        <Link href="/roadmap" className="brand" aria-label="컴퓨터학부 로드맵 홈">
          cse-roadmap <small>컴퓨터학부 수강 로드맵</small>
        </Link>
        <nav aria-label="주요 메뉴" className="primary-nav">
          {[['/roadmap', '노선도'], ['/graduation', '졸업요건'], ['/recommend', '다음 학기 추천']].map(([href, label]) =>
            <Link key={href} href={href} aria-current={pathname === href ? 'page' : undefined}>{label}</Link>)}
        </nav>
        <nav aria-label="계정 메뉴" className="account-nav">
          <Link href="/account" aria-current={pathname === '/account' ? 'page' : undefined}>회원정보 변경</Link>
          <Button className="nav-logout" disabled={signingOut} onClick={() => void logout()}>로그아웃</Button>
          {error && <span role="alert" className="error">{error}</span>}
        </nav>
      </div>
      <div className="field-strip" aria-hidden="true">
        {fields.map((field) => <span key={field.field_id} style={{
          '--field-light': field.color,
          '--field-dark': field.color_dark ?? field.color,
        } as CSSProperties} />)}
      </div>
    </header>
  );
}
