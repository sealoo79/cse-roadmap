import type { JSX, ReactNode } from 'react';
import type { AdmissionYear, CourseCode, CourseField, CurriculumEntry, FieldId, ProgramId } from './reference';
import type { CompletionState } from '@/lib/domain/completion';
import type { Recommendation } from '@/lib/domain/recommend';

export interface RoadmapNode { code: CourseCode; col: number; row: number; x: number; y: number; width: number; height: number; fieldId: FieldId }
export type LayoutRoadmap = (curriculum: CurriculumEntry[], courseFields: Map<CourseCode, CourseField>) => { nodes: RoadmapNode[]; lanes: { fieldId: FieldId; row: number }[] };
export interface RoadmapViewProps {
  programId: ProgramId; admissionYear: AdmissionYear; completion: CompletionState; recommendations: Recommendation[];
  selectedCode: CourseCode | null; onSelect(code: CourseCode | null): void;
  showRecommendationEdges: boolean; visibleFields?: FieldId[];
  /** 상단 바 가운데에 놓을 도구(분야 필터 등) */
  toolbar?: ReactNode;
  /** '범례'를 펼쳤을 때 범례 아래에 덧붙일 설정(추천 화살표 보기 등) */
  legendExtra?: ReactNode;
}
export type RoadmapViewComponent = (props: RoadmapViewProps) => JSX.Element;
