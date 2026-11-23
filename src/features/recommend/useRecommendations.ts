'use client';

import { useMemo } from 'react';
import { recommendCourses, type Recommendation } from '@/lib/domain/recommend';
import { useCompletion, useFollowupStats, useInterests, useProfile, useReference } from '@/lib/user-data/hooks';

export function useRecommendations(): Recommendation[] {
  const { profile } = useProfile();
  const { fieldIds: interests } = useInterests();
  const completion = useCompletion();
  const followupStats = useFollowupStats();
  const ref = useReference();

  return useMemo(() => profile ? recommendCourses({ profile, interests, completion, followupStats, ref }) : [],
    [profile, interests, completion, followupStats, ref]);
}
