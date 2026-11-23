'use client';

import { useState, type JSX } from 'react';
import { useAuth } from '@/features/auth/useAuth';
import { schoolEmailDomain } from '@/lib/supabase/access';
import { useMockAuth } from '@/lib/supabase/config';
import { FeatureRing } from './FeatureRing';
import { HomeBackground } from './HomeBackground';
import styles from './intro.module.css';

/** Google 로그인 버튼 로고. Google 브랜드 가이드의 색을 그대로 써야 해서 CSS 변수 대신 고정 색을 쓴다(A-10 예외). */
function GoogleLogo(): JSX.Element {
  return (
    <svg className={styles.googleLogo} viewBox="0 0 48 48" aria-hidden="true" focusable="false">
      <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z" />
      <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z" />
      <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z" />
      <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z" />
    </svg>
  );
}

/** 첫 화면(프로토타입 #home): 노선도 배경 + 소개·로그인 + 기능 미리보기 고리. */
export function Intro({ callbackFailed }: { callbackFailed: boolean }): JSX.Element {
  const { signInWithGoogle, loading } = useAuth();
  const [signingIn, setSigningIn] = useState(false);
  const [error, setError] = useState(callbackFailed
    ? `로그인을 완료하지 못했습니다. 경북대 Google 계정(@${schoolEmailDomain})으로 다시 시도해 주세요.`
    : null);

  async function login(): Promise<void> {
    setError(null);
    setSigningIn(true);
    try {
      await signInWithGoogle();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : '로그인에 실패했습니다. 다시 시도해 주세요.');
      setSigningIn(false);
    }
  }

  return (
    <section className={styles.home} aria-labelledby="intro-title" data-home>
      <HomeBackground />
      <div className={styles.hero}>
        <p className={styles.kicker}>컴퓨터학부 수강 로드맵</p>
        <h1 id="intro-title">CSE ROADMAP</h1>
        <p className={styles.lead}>수강 내역과 관심 분야로 내 전공 노선도를 그리고, 선수과목과 졸업요건에 맞춰 다음 학기 과목을 추천해요.</p>
        <div className={styles.cta}>
          <button type="button" className={styles.googleButton} disabled={loading || signingIn} onClick={() => void login()}>
            {!useMockAuth && <GoogleLogo />}
            <span>{signingIn ? '로그인 연결 중…' : useMockAuth ? '시연 계정으로 로그인' : '경북대 Google 계정으로 로그인'}</span>
          </button>
        </div>
        <p className={styles.note}>
          {!useMockAuth && <>@{schoolEmailDomain} 이메일을 사용해 주세요. </>}
          처음 로그인하면 전공·학번, 수강 내역, 관심 분야를 한 번만 설정해요.
        </p>
        {error && <p className={styles.error} role="alert">{error}</p>}
      </div>
      <FeatureRing />
    </section>
  );
}
