import type { JSX } from 'react';
import type { RoadmapNode } from '@/types/roadmap';
import type { CourseCode, CourseRelation } from '@/types/reference';
import type { CompletionState } from '@/lib/domain/completion';
import type { Recommendation } from '@/lib/domain/recommend';

// #14 계약 스텁: 실제 관계선을 그리지 않는다.
export function EdgesLayer(_props: {
  nodes: RoadmapNode[]; relations: CourseRelation[]; recommendations: Recommendation[];
  completion: CompletionState; selectedCode: CourseCode | null; showRecommendationEdges: boolean;
}): JSX.Element | null { void _props; return null; }
