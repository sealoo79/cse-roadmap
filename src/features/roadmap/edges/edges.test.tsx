import { render } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { resolveCompletion } from '@/lib/domain/completion';
import { getReferenceData } from '@/lib/reference';
import { demoEnrollments } from '@/test/fixtures/demo-user';
import type { Recommendation } from '@/lib/domain/recommend';
import type { CourseRelation } from '@/types/reference';
import type { RoadmapNode } from '@/types/roadmap';
import { EdgesLayer } from './index';
import { buildRoadmapEdges, routeRoadmapEdge } from './roadmap-edges';

const nodes: RoadmapNode[] = [
  { code: 'COMP0206', col: 0, row: 0, x: 162, y: 76, width: 164, height: 76, fieldId: 'common' },
  { code: 'COME0331', col: 1, row: 0, x: 354, y: 158, width: 164, height: 76, fieldId: 'common' },
  { code: 'COMP0312', col: 4, row: 2, x: 930, y: 420, width: 164, height: 76, fieldId: 'system' },
  { code: 'COMP0411', col: 3, row: 2, x: 738, y: 420, width: 164, height: 76, fieldId: 'system' },
];

function relation(from_code: string, to_code: string, type: CourseRelation['type']): CourseRelation {
  return { id: 1, from_code, to_code, type, group_no: 1, program_id: null, admission_year_from: null,
    admission_year_to: null, source: '테스트', note: null };
}

const relations = [
  relation('COMP0206', 'COME0331', 'official'),
  relation('COMP0206', 'COME0331', 'recommended'),
  relation('COME0331', 'COMP0312', 'recommended'),
  relation('COMP0312', 'COMP0411', 'coreq'),
  relation('COMP0411', 'COMP0312', 'coreq'),
  relation('COMP0411', 'COMP9999', 'official'),
];
const completion = resolveCompletion(demoEnrollments, getReferenceData());
const recommendations: Recommendation[] = [
  { code: 'COME0331', score: 1, reasons: [{ type: 'successor', label: '후수 과목' }],
    fromCodes: ['COMP0204', 'COMP0411'], warning: null },
];

describe('EdgesLayer', () => {
  it('gives a visible recommendation precedence, restores the official edge on toggle, and only connects completed sources', () => {
    const props = { nodes, relations, completion, recommendations, selectedCode: null };
    const { container, rerender } = render(<EdgesLayer {...props} showRecommendationEdges />);
    expect(container.querySelector('[data-from=COMP0206][data-to=COME0331]')?.getAttribute('data-edge-kind')).toBe('service');
    expect(container.querySelector('[data-from=COMP0411][data-to=COME0331]')).toBeNull();
    expect(container.querySelector('[data-to=COMP9999]')).toBeNull();
    const corequisites = container.querySelectorAll('[data-edge-kind=coreq]');
    expect(corequisites).toHaveLength(1);
    expect(corequisites[0].querySelector('path')?.hasAttribute('marker-end')).toBe(false);

    rerender(<EdgesLayer {...props} showRecommendationEdges={false} />);
    expect(container.querySelector('[data-from=COMP0206][data-to=COME0331]')?.getAttribute('data-edge-kind')).toBe('official');
  });

  it('dims only unrelated stations and restores them when cleared', () => {
    const view = (selectedCode: string | null) => (
      <div data-roadmap-map>
        {nodes.map(({ code }) => <div key={code} data-roadmap-node={code} />)}
        <EdgesLayer {...{ nodes, relations, recommendations, completion, selectedCode }} showRecommendationEdges />
      </div>
    );
    const { container, rerender } = render(view('COMP0206'));
    const dimmed = () => Array.from(container.querySelectorAll<HTMLElement>('[data-roadmap-dimmed]'),
      (node) => node.dataset.roadmapNode);
    expect(dimmed()).toEqual(['COMP0312', 'COMP0411']);
    expect(container.querySelector('[data-from=COME0331][data-to=COMP0312]')?.getAttribute('data-muted')).toBe('true');

    rerender(view('COMP0312'));
    expect(dimmed()).toEqual(['COMP0206', 'COME0331']);

    rerender(view(null));
    expect(dimmed()).toEqual([]);
  });

  it('uses map coordinates for adjacent and long routes', () => {
    const edges = buildRoadmapEdges(nodes, relations, [], completion, false);
    const adjacent = routeRoadmapEdge(edges.find(({ kind }) => kind === 'official')!, 0);
    expect(adjacent.start).toEqual({ x: 326, y: 114 });
    expect(adjacent.end).toEqual({ x: 354, y: 196 });
    expect(adjacent.path).toMatch(/^M 326 114 C .+ 354 196$/);

    const long = routeRoadmapEdge(edges.find(({ kind }) => kind === 'recommended')!, 0);
    expect(long.path).toMatch(/^M 518 196 L .+ Q .+ L 930 458$/);
  });
});
