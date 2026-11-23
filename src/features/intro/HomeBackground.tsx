import type { CSSProperties, JSX } from 'react';
import { getFields } from '@/lib/reference';
import type { FieldId } from '@/types/reference';
import styles from './intro.module.css';

type Point = [number, number];

/**
 * 첫 화면 뒤에 깔리는 지하철 노선도(프로토타입 #home). 좌표계 1440×900, 직선과 45도 꺾임만 쓴다.
 * 각 노선은 분야 색을 쓰고, 노선 위로 작은 열차가 천천히 지나간다.
 * 노선끼리 같은 구간을 겹쳐 지나가지 않게 배치한다.
 */
const LINES: { id: string; field: FieldId; points: Point[]; stations: Point[]; duration: number; delay: number }[] = [
  { id: 'ai', field: 'ai_data', points: [[-60, 150], [330, 150], [500, 320], [960, 320], [1130, 150], [1500, 150]],
    stations: [[120, 150], [330, 150], [500, 320], [730, 320], [960, 320], [1130, 150], [1320, 150]], duration: 26, delay: 0 },
  { id: 'sys', field: 'system', points: [[-60, 760], [230, 760], [430, 560], [430, 300], [600, 130], [600, -60]],
    stations: [[90, 760], [230, 760], [430, 560], [430, 420], [600, 130]], duration: 24, delay: -12 },
  { id: 'sw', field: 'sw_web', points: [[1500, 820], [1180, 820], [1050, 690], [690, 690], [560, 820], [560, 960]],
    stations: [[1360, 820], [1180, 820], [1050, 690], [870, 690], [690, 690], [560, 820]], duration: 22, delay: -5 },
  { id: 'net', field: 'network_security', points: [[1060, -60], [1060, 250], [1260, 450], [1260, 620], [1420, 780], [1500, 780]],
    stations: [[1060, 60], [1260, 620], [1420, 780]], duration: 20, delay: -3 },
  { id: 'base', field: 'common', points: [[-60, 470], [120, 470], [300, 650], [900, 650], [1060, 490], [1500, 490]],
    stations: [[120, 470], [520, 650], [760, 650], [900, 650], [1060, 490]], duration: 30, delay: -8 },
];

const toPath = (points: Point[]): string => points.map(([x, y], index) => `${index ? 'L' : 'M'}${x} ${y}`).join(' ');

/** 두 선분의 교차점(평행이면 없음). */
function crossing([a, b]: [Point, Point], [c, d]: [Point, Point]): Point | null {
  const r: Point = [b[0] - a[0], b[1] - a[1]];
  const s: Point = [d[0] - c[0], d[1] - c[1]];
  const denominator = r[0] * s[1] - r[1] * s[0];
  if (denominator === 0) return null;
  const t = ((c[0] - a[0]) * s[1] - (c[1] - a[1]) * s[0]) / denominator;
  const u = ((c[0] - a[0]) * r[1] - (c[1] - a[1]) * r[0]) / denominator;
  return t >= 0 && t <= 1 && u >= 0 && u <= 1 ? [a[0] + t * r[0], a[1] + t * r[1]] : null;
}

/** 서로 다른 노선이 실제로 만나는 곳 = 환승역. 화면 안에 들어오는 것만 남긴다. */
const INTERCHANGES: Point[] = (() => {
  const segments = LINES.map(({ points }) => points.slice(1).map((point, index): [Point, Point] => [points[index], point]));
  const found: Point[] = [];
  segments.forEach((mine, i) => segments.slice(i + 1).forEach((theirs) => mine.forEach((a) => theirs.forEach((b) => {
    const point = crossing(a, b);
    if (point && point[0] > 0 && point[0] < 1440 && point[1] > 0 && point[1] < 900
      && !found.some(([x, y]) => Math.hypot(x - point[0], y - point[1]) < 20)) found.push(point);
  }))));
  return found;
})();

/** 환승역과 겹치는 일반 역은 그리지 않는다. */
const nearInterchange = ([x, y]: Point): boolean => INTERCHANGES.some(([ix, iy]) => Math.hypot(ix - x, iy - y) < 30);

export function HomeBackground(): JSX.Element {
  const fields = getFields();
  return (
    <svg className={styles.background} viewBox="0 0 1440 900" preserveAspectRatio="xMidYMid slice"
      aria-hidden="true" focusable="false">
      {LINES.map(({ id, field: fieldId, points, stations, duration, delay }) => {
        const field = fields.find((item) => item.field_id === fieldId);
        const style = { '--field-light': field?.color, '--field-dark': field?.color_dark ?? field?.color } as CSSProperties;
        return (
          <g key={id} className={styles.bgLine} style={style}>
            <path id={`home-line-${id}`} d={toPath(points)} />
            {stations.filter((point) => !nearInterchange(point))
              .map(([cx, cy]) => <circle key={`${cx}-${cy}`} cx={cx} cy={cy} r="9" />)}
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
