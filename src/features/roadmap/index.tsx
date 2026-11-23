'use client';

import type { JSX } from 'react';
import { EmptyState } from '@/components/ui/EmptyState';
import type { LayoutRoadmap, RoadmapViewProps } from '@/types/roadmap';
export type { RoadmapNode, RoadmapViewProps } from '@/types/roadmap';

// #7 계약 스텁. 노드 배치와 분야별 시각화는 담당 이슈에서 구현한다.
export const layoutRoadmap: LayoutRoadmap = () => ({ nodes: [], lanes: [] });
export function RoadmapView(_props: RoadmapViewProps): JSX.Element {
  void _props;
  return <EmptyState title="나의 수강 경로를 준비하고 있어요">분야별 과목과 선수 관계가 여기에 표시됩니다.</EmptyState>;
}
