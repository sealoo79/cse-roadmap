'use client';

import { useMemo, useState, type JSX } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Suspense } from 'react';
import type { CourseCode, FieldId } from '@/types/reference';
import { useCompletion, useProfile, useReference } from '@/lib/user-data/hooks';
import { useRecommendations } from '@/features/recommend/useRecommendations';
import { RoadmapView } from '@/features/roadmap';
import { roadmapFieldOf } from '@/features/roadmap/layout-roadmap';
import { RoadmapCourseSearch, RoadmapFieldFilters } from '@/features/roadmap-search';
import { CourseDetailPanel } from '@/features/course-detail';

const ROADMAP_RECOMMENDATION_LIMIT = 5;

function RoadmapContent(): JSX.Element {
  const { profile, loading, error } = useProfile();
  const ref = useReference();
  const completion = useCompletion();
  // 노선도에는 우선순위(recommendCourses 정렬) 상위 5과목만 추천으로 표시한다.
  const allRecommendations = useRecommendations();
  const recommendations = useMemo(() => allRecommendations.slice(0, ROADMAP_RECOMMENDATION_LIMIT), [allRecommendations]);
  const [visibleFields, setVisibleFields] = useState<FieldId[]>(ref.fields.map((f) => f.field_id));
  const [showRecommendationEdges, setShowRecommendationEdges] = useState(true);
  const router = useRouter();
  const params = useSearchParams();
  const code = params.get('course');
  const selectedCode = code && ref.courses.has(code) ? code : null;
  const select = (next: CourseCode | null): void => {
    if (next) {
      const field = roadmapFieldOf(next, ref.courseFields);
      setVisibleFields((current) => current.includes(field) ? current : [...current, field]);
    }
    router.replace(next ? `/roadmap?course=${encodeURIComponent(next)}` : '/roadmap', { scroll: false });
  };
  const header = (search?: JSX.Element): JSX.Element => (
    <header className="roadmap-header">
      <h1>수강 로드맵</h1>
      {search}
    </header>
  );
  if (loading) return <>{header()}<p role="status">로드맵을 불러오는 중입니다.</p></>;
  if (error) return <>{header()}<p role="alert">{error.message}</p></>;
  if (!profile) return <>{header()}<p>프로필을 등록하면 수강 경로를 확인할 수 있어요.</p></>;
  return <>
    {header(<RoadmapCourseSearch onSelect={select} />)}
    <RoadmapView programId={profile.program_id} admissionYear={profile.admission_year} completion={completion}
      recommendations={recommendations} selectedCode={selectedCode} onSelect={select}
      showRecommendationEdges={showRecommendationEdges} visibleFields={visibleFields}
      toolbar={<RoadmapFieldFilters visibleFields={visibleFields} onChangeVisibleFields={setVisibleFields} />}
      legendExtra={<label><input type="checkbox" checked={showRecommendationEdges}
        onChange={(e) => setShowRecommendationEdges(e.target.checked)} />서비스 추천 화살표 보기</label>} />
    <CourseDetailPanel code={selectedCode} onClose={() => select(null)} onNavigate={select} />
  </>;
}
export default function RoadmapPage(): JSX.Element {
  return (
    <div className="roadmap-page">
      <Suspense fallback={<p role="status">로드맵을 불러오는 중입니다.</p>}><RoadmapContent /></Suspense>
    </div>
  );
}
