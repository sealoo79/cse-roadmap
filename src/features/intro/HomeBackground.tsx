import type { CSSProperties, JSX } from 'react';
import { getFields } from '@/lib/reference';
import type { FieldId } from '@/types/reference';
import styles from './intro.module.css';

type Point = [number, number];

/**
 * 첫 화면 뒤에 깔리는 지하철 노선도(프로토타입 #home). 좌표계 1440×900, 직선과 45도 꺾임만 쓴다.
 * 각 노선은 분야 색을 쓰고, 노선 위로 작은 열차가 천천히 지나간다.
 */
const LINES: { id: string; field: FieldId; d: string; stations: Point[]; duration: number; delay: number }[] = [
  { id: 'ai', field: 'ai_data', d: 'M-60 150 H330 L500 320 H960 L1130 150 H1500',
    stations: [[120, 150], [330, 150], [500, 320], [730, 320], [960, 320], [1130, 150], [1320, 150]], duration: 26, delay: 0 },
  { id: 'sys', field: 'system', d: 'M-60 760 H230 L430 560 V300 L600 130 V-60',
    stations: [[90, 760], [230, 760], [430, 560], [430, 420], [430, 300], [600, 130]], duration: 24, delay: -12 },
  { id: 'sw', field: 'sw_web', d: 'M1500 820 H1180 L1010 650 H700 L560 790 V960',
    stations: [[1360, 820], [1180, 820], [1010, 650], [850, 650], [700, 650], [560, 790]], duration: 22, delay: -5 },
  { id: 'net', field: 'network_security', d: 'M1060 -60 V250 L1260 450 V620 L1420 780 H1500',
    stations: [[1060, 60], [1060, 250], [1260, 450], [1260, 620], [1420, 780]], duration: 20, delay: -3 },
  { id: 'base', field: 'common', d: 'M-60 470 H120 L300 650 H900 L1060 490 H1500',
    stations: [[120, 470], [300, 650], [520, 650], [760, 650], [900, 650], [1060, 490], [1300, 490]], duration: 30, delay: -8 },
];

/** 노선이 만나는 환승역(가운데 기준 좌표). */
const INTERCHANGES: Point[] = [[430, 600], [600, 320], [1060, 490], [1150, 650], [790, 650]];

export function HomeBackground(): JSX.Element {
  const fields = getFields();
  return (
    <svg className={styles.background} viewBox="0 0 1440 900" preserveAspectRatio="xMidYMid slice"
      aria-hidden="true" focusable="false">
      {LINES.map(({ id, field: fieldId, d, stations, duration, delay }) => {
        const field = fields.find((item) => item.field_id === fieldId);
        const style = { '--field-light': field?.color, '--field-dark': field?.color_dark ?? field?.color } as CSSProperties;
        return (
          <g key={id} className={styles.bgLine} style={style}>
            <path id={`home-line-${id}`} d={d} />
            {stations.map(([cx, cy]) => <circle key={`${cx}-${cy}`} cx={cx} cy={cy} r="9" />)}
            {/* 노선을 따라 천천히 지나가는 열차 (움직임 줄이기 설정에서는 숨긴다) */}
            <rect className={styles.train} x="-13" y="-6" width="26" height="12" rx="6">
              <animateMotion dur={`${duration}s`} begin={`${delay}s`} repeatCount="indefinite" rotate="auto">
                <mpath href={`#home-line-${id}`} />
              </animateMotion>
            </rect>
          </g>
        );
      })}
      {INTERCHANGES.map(([x, y]) => (
        <rect key={`${x}-${y}`} className={styles.interchange} x={x - 14} y={y - 14} width="28" height="28" rx="14" />
      ))}
    </svg>
  );
}
