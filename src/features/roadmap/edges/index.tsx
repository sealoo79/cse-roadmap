'use client';

import { useLayoutEffect, useMemo, useRef, type JSX } from 'react';
import type { CompletionState } from '@/lib/domain/completion';
import type { Recommendation } from '@/lib/domain/recommend';
import type { CourseCode, CourseRelation } from '@/types/reference';
import type { RoadmapNode } from '@/types/roadmap';
import { buildRoadmapEdges, getRelatedCodes, routeRoadmapEdge } from './roadmap-edges';
import styles from './edges.module.css';

export function EdgesLayer({
  nodes, relations, recommendations, completion, selectedCode, showRecommendationEdges,
}: {
  nodes: RoadmapNode[];
  relations: CourseRelation[];
  recommendations: Recommendation[];
  completion: CompletionState;
  selectedCode: CourseCode | null;
  showRecommendationEdges: boolean;
}): JSX.Element {
  const layer = useRef<SVGSVGElement>(null);
  const edges = useMemo(() => buildRoadmapEdges(nodes, relations, recommendations, completion, showRecommendationEdges),
    [nodes, relations, recommendations, completion, showRecommendationEdges]);
  const relatedCodes = useMemo(() => selectedCode && nodes.some(({ code }) => code === selectedCode)
    ? getRelatedCodes(edges, selectedCode) : null, [edges, nodes, selectedCode]);

  useLayoutEffect(() => {
    if (!relatedCodes) return;

    // The roadmap owns the station buttons. Mark only stations in the map containing this layer.
    const map = layer.current?.closest('[data-roadmap-map]');
    const dimmed = [...(map?.querySelectorAll<HTMLElement>('[data-roadmap-node]') ?? [])]
      .filter((station) => !relatedCodes.has(station.dataset.roadmapNode ?? ''));
    for (const station of dimmed) station.setAttribute('data-roadmap-dimmed', '');

    return () => {
      for (const station of dimmed) station.removeAttribute('data-roadmap-dimmed');
    };
  }, [relatedCodes]);

  return (
    <svg className={styles.layer} ref={layer} aria-hidden="true" focusable="false">
      {edges.map((edge, index) => {
        const { from, to, kind } = edge;
        const { start, end, path, lock } = routeRoadmapEdge(edge, index);
        const muted = relatedCodes !== null && from.code !== selectedCode
          && !(kind === 'coreq' && to.code === selectedCode);
        return (
          <g key={`${kind === 'coreq' ? 'coreq/' : ''}${from.code}/${to.code}`}
            className={styles.edge} data-edge-kind={kind} data-from={from.code} data-to={to.code} data-muted={muted}>
            {/* 화살표 머리 없이 선으로만 잇는다. 방향은 학기(왼쪽→오른쪽) 순서로 읽힌다. */}
            <path className={styles.connector} d={path} />
            {kind === 'official' && (
              <g className={styles.lock} transform={`translate(${lock.x} ${lock.y})`}>
                <path d="M -2.5 0 V -2.5 A 2.5 2.5 0 0 1 2.5 -2.5 V 0" />
                <rect x="-4" y="0" width="8" height="6" rx="1" />
              </g>
            )}
            {kind === 'coreq' && [start, end].map((point, i) => (
              <rect key={i} className={styles.terminal} x={point.x - 3} y={point.y - 3} width="6" height="6" rx="1.5" />
            ))}
          </g>
        );
      })}
    </svg>
  );
}
