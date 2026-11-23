import type { JSX } from 'react';
import type { AdmissionYear, CourseCode, CourseField, CurriculumEntry, FieldId, ProgramId } from './reference';
import type { CompletionState } from '@/lib/domain/completion';
import type { Recommendation } from '@/lib/domain/recommend';

export interface RoadmapNode { code: CourseCode; col: number; row: number; x: number; y: number; width: number; height: number; fieldId: FieldId }
export type LayoutRoadmap = (curriculum: CurriculumEntry[], courseFields: Map<CourseCode, CourseField>) => { nodes: RoadmapNode[]; lanes: { fieldId: FieldId; row: number }[] };
export interface RoadmapViewProps {
  programId: ProgramId; admissionYear: AdmissionYear; completion: CompletionState; recommendations: Recommendation[];
  selectedCode: CourseCode | null; onSelect(code: CourseCode | null): void;
  showRecommendationEdges: boolean; visibleFields?: FieldId[];
}
export type RoadmapViewComponent = (props: RoadmapViewProps) => JSX.Element;
