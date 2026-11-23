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
  /** 범례·확대 막대 가운데에 놓을 도구(예: 분야 필터). 없으면 비워 둔다. */
  toolbar?: ReactNode;
}
export type RoadmapViewComponent = (props: RoadmapViewProps) => JSX.Element;
