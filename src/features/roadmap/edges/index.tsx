'use client';

import { useId, useLayoutEffect, useMemo, useRef, type JSX } from 'react';
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
  const marker = useId();
  const edges = useMemo(() => buildRoadmapEdges(nodes, relations, recommendations, completion, showRecommendationEdges),
    [nodes, relations, recommendations, completion, showRecommendationEdges]);
  // 선택한 과목에서 이어지는 후수 과목 전체(후수의 후수까지). 화면에 그린 추천 경로도 따라간다.
  const relatedCodes = useMemo(() => {
    if (!selectedCode || !nodes.some(({ code }) => code === selectedCode)) return null;
    const serviceLinks = edges.filter(({ kind }) => kind === 'service').map(({ from, to }) => [from.code, to.code] as const);
    return getRelatedCodes(relations, selectedCode, serviceLinks);
  }, [edges, nodes, relations, selectedCode]);

  useLayoutEffect(() => {
    if (!relatedCodes) return;

    // The roadmap owns the station buttons. Mark only stations in the map containing this layer.
    const map = layer.current?.closest('[data-roadmap-map]');
    const stations = [...(map?.querySelectorAll<HTMLElement>('[data-roadmap-node]') ?? [])];
    const dimmed = stations.filter((station) => !relatedCodes.has(station.dataset.roadmapNode ?? ''));
    // 선택한 과목에서 이어지는 후수 과목 역은 파란 테두리로 따로 표시한다.
    const chained = stations.filter((station) => station.dataset.roadmapNode !== selectedCode
      && relatedCodes.has(station.dataset.roadmapNode ?? ''));
    for (const station of dimmed) station.setAttribute('data-roadmap-dimmed', '');
    for (const station of chained) station.setAttribute('data-roadmap-chain', '');

    return () => {
      for (const station of dimmed) station.removeAttribute('data-roadmap-dimmed');
      for (const station of chained) station.removeAttribute('data-roadmap-chain');
    };
  }, [relatedCodes, selectedCode]);

  return (
    <svg className={styles.layer} ref={layer} aria-hidden="true" focusable="false">
      <defs>
        <marker id={`${marker}-academic`} viewBox="0 0 8 8" refX="8" refY="4"
          markerWidth="8" markerHeight="8" markerUnits="userSpaceOnUse" orient="auto">
          <path className={styles.academicArrow} d="M 0 0 L 8 4 L 0 8 Z" />
        </marker>
        <marker id={`${marker}-service`} viewBox="0 0 8 8" refX="8" refY="4"
          markerWidth="8" markerHeight="8" markerUnits="userSpaceOnUse" orient="auto">
          <path className={styles.serviceArrow} d="M 0 0 L 8 4 L 0 8 Z" />
        </marker>
        <marker id={`${marker}-chain`} viewBox="0 0 8 8" refX="8" refY="4"
          markerWidth="10" markerHeight="10" markerUnits="userSpaceOnUse" orient="auto">
          <path className={styles.chainArrow} d="M 0 0 L 8 4 L 0 8 Z" />
        </marker>
      </defs>
      {edges.map((edge, index) => {
        const { from, to, kind } = edge;
        const { start, end, path, lock } = routeRoadmapEdge(edge, index);
        // 선택한 과목에서 이어지는 길(양 끝이 모두 후수 사슬에 있는 선)만 강조하고 나머지는 흐리게 둔다.
        const chain = relatedCodes !== null && relatedCodes.has(from.code) && relatedCodes.has(to.code);
        const muted = relatedCodes !== null && !chain;
        const arrow = chain ? 'chain' : kind === 'service' ? 'service' : 'academic';
        return (
          <g key={`${kind === 'coreq' ? 'coreq/' : ''}${from.code}/${to.code}`}
            className={styles.edge} data-edge-kind={kind} data-from={from.code} data-to={to.code}
            data-muted={muted} data-chain={chain}>
            <path className={styles.connector} d={path}
              markerEnd={kind === 'coreq' ? undefined : `url(#${marker}-${arrow})`} />
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
