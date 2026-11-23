import type { CompletionState } from '@/lib/domain/completion';
import type { Recommendation } from '@/lib/domain/recommend';
import type { CourseCode, CourseRelation } from '@/types/reference';
import type { RoadmapNode } from '@/types/roadmap';

import { STATION_CENTER_Y, STATION_RADIUS } from '../layout-roadmap';

type EdgeKind = CourseRelation['type'] | 'service';

export interface RoadmapEdge {
  from: RoadmapNode;
  to: RoadmapNode;
  kind: EdgeKind;
}

export function buildRoadmapEdges(
  nodes: RoadmapNode[],
  relations: CourseRelation[],
  recommendations: Recommendation[],
  completion: CompletionState,
  showRecommendationEdges: boolean,
): RoadmapEdge[] {
  const nodesByCode = new Map(nodes.map((node) => [node.code, node]));
  const directed = new Map<string, RoadmapEdge>();
  const corequisites = new Map<string, RoadmapEdge>();

  for (const relation of relations) {
    const from = nodesByCode.get(relation.from_code);
    const to = nodesByCode.get(relation.to_code);
    if (!from || !to || from === to) continue;

    if (relation.type === 'coreq') {
      const [first, second] = from.code < to.code ? [from, to] : [to, from];
      corequisites.set(`${first.code}/${second.code}`, { from: first, to: second, kind: 'coreq' });
      continue;
    }

    const key = `${from.code}/${to.code}`;
    if (directed.get(key)?.kind !== 'official') directed.set(key, { from, to, kind: relation.type });
  }

  if (showRecommendationEdges) {
    const nodesByCanonicalCode = new Map(nodes.map((node) => [completion.canonicalOf(node.code), node]));
    for (const recommendation of recommendations) {
      const to = nodesByCode.get(recommendation.code);
      if (!to) continue;

      for (const code of recommendation.fromCodes) {
        if (!completion.isCompleted(code)) continue;
        const from = nodesByCode.get(code) ?? nodesByCanonicalCode.get(completion.canonicalOf(code));
        if (from && from !== to) directed.set(`${from.code}/${to.code}`, { from, to, kind: 'service' });
      }
    }
  }

  return [...corequisites.values(), ...directed.values()];
}

/**
 * 선택한 과목에서 이어지는 후수 과목을 끝까지 따라간다.
 * 필수·권장 선수 관계(from → to)를 차례로 밟고, 동시 수강 과목은 양쪽을 함께 묶는다.
 * extraLinks에는 화면에 그린 추천 경로(들은 과목 → 추천 과목)처럼 관계 자료 밖의 연결을 넣는다.
 */
export function getRelatedCodes(
  relations: CourseRelation[],
  selected: CourseCode,
  extraLinks: ReadonlyArray<readonly [CourseCode, CourseCode]> = [],
): ReadonlySet<CourseCode> {
  const next = new Map<CourseCode, CourseCode[]>();
  const link = (from: CourseCode, to: CourseCode): void => { next.set(from, [...(next.get(from) ?? []), to]); };
  for (const relation of relations) {
    link(relation.from_code, relation.to_code);
    if (relation.type === 'coreq') link(relation.to_code, relation.from_code);
  }
  for (const [from, to] of extraLinks) link(from, to);

  const related = new Set<CourseCode>([selected]);
  const queue: CourseCode[] = [selected];
  for (let code = queue.shift(); code !== undefined; code = queue.shift()) {
    for (const following of next.get(code) ?? []) {
      if (related.has(following)) continue;
      related.add(following);
      queue.push(following);
    }
  }
  return related;
}

interface Point { x: number; y: number }

function moveTowards(from: Point, to: Point, distance: number): Point {
  const length = Math.hypot(to.x - from.x, to.y - from.y);
  const ratio = length === 0 ? 0 : Math.min(0.5, distance / length);
  return { x: from.x + (to.x - from.x) * ratio, y: from.y + (to.y - from.y) * ratio };
}

function curveThrough(points: [Point, ...Point[]]): string {
  const [start, ...remaining] = points;
  let path = `M ${start.x} ${start.y}`;
  for (let i = 1; i < points.length - 1; i++) {
    const point = points[i];
    const entry = moveTowards(point, points[i - 1], 5);
    const exit = moveTowards(point, points[i + 1], 5);
    path += ` L ${entry.x} ${entry.y} Q ${point.x} ${point.y} ${exit.x} ${exit.y}`;
  }
  const end = remaining.at(-1);
  return end ? `${path} L ${end.x} ${end.y}` : path;
}

export function routeRoadmapEdge(edge: RoadmapEdge, index: number): { path: string; start: Point; end: Point; lock: Point } {
  const { from, to } = edge;
  const direction = from.col <= to.col ? 1 : -1;
  const start = { x: from.x + from.width / 2 + direction * STATION_RADIUS, y: from.y + STATION_CENTER_Y };
  const end = { x: to.x + to.width / 2 + (from.col === to.col ? 1 : -direction) * STATION_RADIUS, y: to.y + STATION_CENTER_Y };
  const offset = 6 + index % 3 * 2;

  if (from.col === to.col) {
    const gutter = from.x + from.width + offset + 2;
    return { start, end,
      path: `M ${start.x} ${start.y} C ${gutter} ${start.y} ${gutter} ${end.y} ${end.x} ${end.y}`,
      lock: { x: start.x + 0.75 * (gutter - start.x), y: (start.y + end.y) / 2 },
    };
  }

  if (Math.abs(from.col - to.col) === 1) {
    const middle = (start.x + end.x) / 2 + direction * (index % 3 - 1) * 3;
    return { start, end,
      path: `M ${start.x} ${start.y} C ${middle} ${start.y} ${middle} ${end.y} ${end.x} ${end.y}`,
      lock: { x: (start.x + end.x + 6 * middle) / 8, y: (start.y + end.y) / 2 },
    };
  }

  // Run long edges through the semester gutters and the space immediately above the source row.
  const corridor = from.y - 2 - index % 3;
  const exitX = from.x + (direction === 1 ? from.width : 0) + direction * offset;
  const entryX = to.x + (direction === -1 ? to.width : 0) - direction * offset;
  return { start, end,
    path: curveThrough([start, { x: exitX, y: start.y }, { x: exitX, y: corridor },
      { x: entryX, y: corridor }, { x: entryX, y: end.y }, end]),
    lock: { x: entryX, y: end.y + Math.sign(corridor - end.y) * 13 },
  };
}
