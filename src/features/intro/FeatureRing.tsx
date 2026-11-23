'use client';

import { useState, type CSSProperties, type JSX, type ReactNode } from 'react';
import { getFields } from '@/lib/reference';
import type { FieldId } from '@/types/reference';
import styles from './intro.module.css';

/** 분야 색을 CSS 변수(--c)로 넘긴다. 라이트·다크는 CSS에서 고른다. */
function fieldColor(fieldId: FieldId): CSSProperties {
  const field = getFields().find((item) => item.field_id === fieldId);
  return { '--c-light': field?.color, '--c-dark': field?.color_dark ?? field?.color } as CSSProperties;
}

/** 노선도 미리보기: 분야 4개 노선, 지나온 역(채움)과 다음 학기 추천역(반짝임). */
function MiniRoadmap(): JSX.Element {
  const lanes: { field: FieldId; label: string; y: number; done: number; recommend?: string }[] = [
    { field: 'common', label: '기초', y: 42, done: 3, recommend: '알고리즘1' },
    { field: 'ai_data', label: 'AI', y: 78, done: 4, recommend: '기계학습개론' },
    { field: 'system', label: '시스템', y: 110, done: 2 },
    { field: 'sw_web', label: 'SW', y: 136, done: 1 },
  ];
  const xs = [46, 75, 104, 133, 162, 191, 220, 249];
  return (
    <svg className={styles.miniMap} viewBox="0 0 268 158" aria-hidden="true">
      {['1학년', '2학년', '3학년', '4학년'].map((label, index) => (
        <text key={label} x={60.5 + index * 58} y="10" textAnchor="middle">{label}</text>
      ))}
      <line className={styles.miniNow} x1="147.5" y1="18" x2="147.5" y2="150" />
      {lanes.map(({ field, label, y, done, recommend }) => (
        <g key={field} className={styles.miniLane} style={fieldColor(field)}>
          <text x="2" y={y + 3}>{label}</text>
          <line x1="46" y1={y} x2="249" y2={y} />
          {xs.map((x, index) => {
            const isDone = index < done;
            const isRecommend = recommend && index === 4;
            return <circle key={x} cx={x} cy={y} r={isDone ? 5 : 4} data-done={isDone} data-recommend={isRecommend || undefined} />;
          })}
          {recommend && <>
            <circle className={styles.miniPulse} cx={162} cy={y} r="8.5" />
            <rect className={styles.miniTag} x={162 - recommend.length * 4 - 14} y={y + 8} width={recommend.length * 8 + 28} height="11" rx="2" />
            <text className={styles.miniTagText} x="162" y={y + 16.2} textAnchor="middle">{recommend} · 추천</text>
          </>}
        </g>
      ))}
      <rect className={styles.miniHere} x="130.5" y="146" width="34" height="10" rx="2" />
      <text className={styles.miniHereText} x="147.5" y="153.3" textAnchor="middle">지금 여기</text>
    </svg>
  );
}

function Bar({ field, label, done, total }: { field?: FieldId; label: string; done: number; total: number }): JSX.Element {
  return (
    <span className={styles.mmBar} style={field ? fieldColor(field) : undefined}>
      <span><span>{label}</span><span className={styles.mono}>{done} / {total}</span></span>
      <span className={styles.mmTrack}><i style={{ width: `${Math.round((done / total) * 100)}%` }} /></span>
    </span>
  );
}

/** 링에 놓이는 미리보기 카드 6장(프로토타입 #home 순서). */
const CARDS: { head: string; title: string; body: ReactNode; wide?: boolean }[] = [
  { head: '결과 · 내 전공 노선도', title: '지나온 역과 다음 학기 추천역', body: <MiniRoadmap />, wide: true },
  { head: '결과 · 추천 이유', title: '왜 이 과목인지 바로 확인', body: (
    <span className={styles.mmPop}>
      <b>기계학습개론</b><span>전공필수</span><span>관심 분야(AI·데이터)</span><span>후수 4과목의 선수과목</span>
    </span>
  ) },
  { head: '결과 · 졸업요건', title: '졸업까지 얼마나 남았나', body: <>
    <Bar label="전공필수" done={3} total={7} />
    <Bar field="ai_data" label="AI·데이터" done={18} total={45} />
    <Bar field="system" label="시스템" done={6} total={21} />
    <Bar field="sw_web" label="소프트웨어·웹" done={3} total={15} />
  </> },
  { head: 'STEP 2 · 수강 내역', title: '시간표 링크로 한 번에', body: <>
    <span className={styles.mmInput}>everytime.kr/@xxxxxxxx</span>
    {[['자료구조', 'COME0331', true], ['선형대수', 'MTED0231', true], ['오토마타및형식언어', 'COMP0315', false]].map(([name, code, checked]) => (
      <span key={String(code)} className={styles.mmRow}>
        <i className={styles.mmCheck} data-checked={checked} />{name}<span className={styles.mono}>{code}</span>
      </span>
    ))}
  </> },
  { head: 'STEP 3 · 관심 분야', title: '관심 있는 노선을 골라요', body: (
    <span className={styles.mmChips}>
      {([['ai_data', 'AI·데이터', true], ['system', '시스템', false], ['network_security', '네트워크·보안', false], ['sw_web', '소프트웨어·웹', true]] as const)
        .map(([field, label, on]) => (
          <span key={field} className={styles.mmChip} data-on={on} style={fieldColor(field)}><i />{label}</span>
        ))}
    </span>
  ) },
  { head: '결과 · 다음 학기 추천', title: '3-1에 들을 과목 순위', body: <>
    {['인공지능', '기계학습개론', '알고리즘1', '영상이해'].map((name, index) => (
      <span key={name} className={styles.mmRank}><em>{String(index + 1).padStart(2, '0')}</em>{name}<u>추천</u></span>
    ))}
  </> },
];

/** 기능 미리보기 카드가 3D 고리 모양으로 천천히 도는 영역. 마우스를 올리거나 멈춤 버튼으로 멈춘다. */
export function FeatureRing(): JSX.Element {
  const [paused, setPaused] = useState(false);
  return (
    <>
      <div className={styles.stage} data-paused={paused} role="region" aria-label="기능 미리보기">
        <div className={styles.ring}>
          {CARDS.map(({ head, title, body, wide }, index) => (
            <article key={head} className={styles.preview} style={{ '--i': index } as CSSProperties}>
              <span className={styles.previewHead}>{head}</span>
              <h2 className={styles.previewTitle}>{title}</h2>
              <span className={styles.previewBody} data-wide={wide || undefined}>{body}</span>
            </article>
          ))}
        </div>
      </div>
      <div className={styles.spinControl}>
        <span>로그인하면 내 수강 내역으로 이 화면들을 볼 수 있어요</span>
        <button type="button" aria-pressed={paused} onClick={() => setPaused((value) => !value)}>
          {paused ? '회전 시작' : '회전 멈춤'}
        </button>
      </div>
    </>
  );
}
