'use client';

import { useEffect, useState, type JSX } from 'react';
import { useAuth } from '@/features/auth/useAuth';
import { useMockAuth } from '@/lib/supabase/config';
import styles from './intro.module.css';

const features = [
  { label: '노선도', title: '과목이 연결되는 길', description: '선수·후수 과목을 살펴보고 나에게 맞는 수강 경로를 찾으세요.' },
  { label: '졸업요건', title: '졸업까지 남은 요건', description: '전공과 학번에 맞춰 이수 학점과 비학점 항목을 확인하세요.' },
  { label: '다음 학기 추천', title: '다음에 들을 과목', description: '관심 분야와 지금까지 이수한 과목을 바탕으로 다음 학기를 준비하세요.' },
];

export function Intro({ callbackFailed }: { callbackFailed: boolean }): JSX.Element {
  const { signInWithGoogle, loading } = useAuth();
  const [selected, setSelected] = useState(0);
  const [rotating, setRotating] = useState(false);
  const [signingIn, setSigningIn] = useState(false);
  const [error, setError] = useState(callbackFailed ? '로그인을 완료하지 못했습니다. 다시 시도해 주세요.' : null);
  const active = features[selected];

  useEffect(() => {
    if (!rotating) return;
    const motion = window.matchMedia('(prefers-reduced-motion: reduce)');
    if (motion.matches) return;
    const id = window.setInterval(() => setSelected((index) => (index + 1) % features.length), 5500);
    const stopOnReducedMotion = (): void => {
      if (motion.matches) setRotating(false);
    };
    motion.addEventListener('change', stopOnReducedMotion);
    return () => {
      window.clearInterval(id);
      motion.removeEventListener('change', stopOnReducedMotion);
    };
  }, [rotating]);

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
    <section className={styles.intro} aria-labelledby="intro-title">
      <div className={styles.map} aria-hidden="true">
        <span className={styles.lineOne}><i /><i /><i /></span>
        <span className={styles.lineTwo}><i /><i /><i /></span>
        <span className={styles.lineThree}><i /><i /></span>
      </div>
      <div className={styles.copy}>
        <h1 id="intro-title">들은 과목을 넣으면 다음 학기가 보여요</h1>
        <p>컴퓨터학부 수강 노선도, 졸업요건, 다음 학기 추천을 한 곳에서 확인하세요.</p>
        <button type="button" className={styles.login} disabled={loading || signingIn} onClick={() => void login()}>
          {signingIn ? '로그인 연결 중…' : useMockAuth ? '시연 계정으로 로그인' : 'Google 계정으로 로그인'}
        </button>
        {error && <p className={styles.error} role="alert">{error}</p>}
      </div>

      <div className={styles.preview} aria-label="로드맵 기능 미리보기">
        <div className={styles.stack}>
          <article key={active.label} className={styles.card} aria-live={rotating ? 'off' : 'polite'}>
            <p>{active.label}</p>
            <h2>{active.title}</h2>
            <div>{active.description}</div>
          </article>
        </div>
        <div className={styles.controls}>
          {features.map((feature, index) => (
            <button key={feature.label} type="button" aria-pressed={index === selected} onClick={() => { setRotating(false); setSelected(index); }}>
              {feature.label}
            </button>
          ))}
          <button type="button" className={styles.motionControl} onClick={() => setRotating((active) => !active)}>
            {rotating ? '회전 멈춤' : '자동 회전 시작'}
          </button>
        </div>
      </div>
    </section>
  );
}
