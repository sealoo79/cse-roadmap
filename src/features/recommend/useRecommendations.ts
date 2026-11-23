'use client';

import { useMemo } from 'react';
import { nextTermOf, recommendCourses, type Recommendation } from '@/lib/domain/recommend';
import { useCompletion, useEnrollments, useFollowupStats, useInterests, useProfile, useReference } from '@/lib/user-data/hooks';

/** 다음 학기(수강 이력의 정규학기 수 + 1) 기준 우선순위 순 추천 목록 */
export function useRecommendations(): Recommendation[] {
  const { profile } = useProfile();
  const { fieldIds: interests } = useInterests();
  const completion = useCompletion();
  const followupStats = useFollowupStats();
  const { items: enrollments } = useEnrollments();
  const ref = useReference();
  const nextTerm = useMemo(() => nextTermOf(enrollments), [enrollments]);

  return useMemo(() => profile ? recommendCourses({ profile, interests, completion, followupStats, ref, nextTerm }) : [],
    [profile, interests, completion, followupStats, ref, nextTerm]);
}
