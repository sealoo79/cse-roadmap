import type { CourseCode, FieldId, ReferenceData } from '@/types/reference';
import type { FollowupStat, Profile } from '@/types/user';
import type { CompletionState } from './completion';

export type ReasonType = 'interest' | 'successor' | 'required' | 'followup';
export interface RecommendationReason { type: ReasonType; label: string; fromCode?: CourseCode; value?: number }
export interface Recommendation { code: CourseCode; score: number; reasons: RecommendationReason[]; fromCodes: CourseCode[]; warning: 'prerequisite_unmet' | null }
export interface RecommendWeights { interest: number; successor: number; required: number; followup: number; prerequisiteUnmetPenalty: number; minFollowupBase: number }
export const DEFAULT_WEIGHTS: RecommendWeights = { interest: 1, successor: 1, required: 1, followup: 1, prerequisiteUnmetPenalty: 1, minFollowupBase: 3 };
// #13 소유. 가중치의 실제 조정도 #13에서 수행한다.
export function recommendCourses(_input: { profile: Profile; interests: FieldId[]; completion: CompletionState; followupStats: FollowupStat[]; ref: ReferenceData; weights?: RecommendWeights }): Recommendation[] {
  void _input; return [];
}
