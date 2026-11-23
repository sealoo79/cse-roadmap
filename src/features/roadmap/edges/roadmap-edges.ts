import type { CompletionState } from '@/lib/domain/completion';
import type { Recommendation } from '@/lib/domain/recommend';
import type { CourseCode, CourseRelation } from '@/types/reference';
import type { RoadmapNode } from '@/types/roadmap';

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

export function getRelatedCodes(edges: RoadmapEdge[], selected: CourseCode): ReadonlySet<CourseCode> {
  const related = new Set<CourseCode>([selected]);
  for (const edge of edges) {
    if (edge.from.code === selected) related.add(edge.to.code);
    if (edge.kind === 'coreq' && edge.to.code === selected) related.add(edge.from.code);
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
  const start = { x: direction === 1 ? from.x + from.width : from.x, y: from.y + from.height / 2 };
  const end = { x: direction === -1 || from.col === to.col ? to.x + to.width : to.x, y: to.y + to.height / 2 };
  const offset = 6 + index % 3 * 2;

  if (from.col === to.col) {
    const gutter = start.x + offset + 2;
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
  const exitX = start.x + direction * offset;
  const entryX = end.x - direction * offset;
  return { start, end,
    path: curveThrough([start, { x: exitX, y: start.y }, { x: exitX, y: corridor },
      { x: entryX, y: corridor }, { x: entryX, y: end.y }, end]),
    lock: { x: entryX, y: end.y + Math.sign(corridor - end.y) * 13 },
  };
}
