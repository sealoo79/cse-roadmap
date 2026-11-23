'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useState, type CSSProperties, type JSX } from 'react';
import { Button } from '@/components/ui/Button';
import { useProfile, useReference } from '@/lib/user-data/hooks';
import { useAuth } from '@/features/auth/useAuth';

/** 상단 가운데 메뉴. `also`는 메뉴에 없지만 해당 메뉴를 거쳐 들어가는 화면(수강 이력은 마이페이지에서 연다). */
const menu: { href: string; label: string; also: string[] }[] = [
  { href: '/roadmap', label: '노선도', also: [] },
  { href: '/graduation', label: '졸업요건', also: [] },
  { href: '/recommend', label: '다음 학기 추천', also: [] },
  { href: '/account', label: '마이페이지', also: ['/enrollments'] },
];

export function Navigation(): JSX.Element {
  const pathname = usePathname();
  const { fields, programs } = useReference();
  const { profile } = useProfile();
  const programName = profile ? programs.find(({ program_id }) => program_id === profile.program_id)?.name : undefined;
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
          {menu.map(({ href, label, also }) => {
            const current = [href, ...also].some((path) => pathname === path || pathname.startsWith(`${path}/`));
            return <Link key={href} href={href} aria-current={current ? 'page' : undefined}>{label}</Link>;
          })}
        </nav>
        <nav aria-label="계정 메뉴" className="account-nav">
          {profile && <span className="account-profile" title={`${programName ?? profile.program_id} · ${profile.admission_year}학번`}>
            <span className="account-program">{programName ?? profile.program_id}</span>
            <span className="account-year">{profile.admission_year}학번</span>
          </span>}
          <Button disabled={signingOut} onClick={() => void logout()}>로그아웃</Button>
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
