'use client';

import { useState, type JSX } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Suspense } from 'react';
import type { CourseCode, FieldId } from '@/types/reference';
import { useCompletion, useProfile, useReference } from '@/lib/user-data/hooks';
import { useRecommendations } from '@/features/recommend/useRecommendations';
import { RoadmapView } from '@/features/roadmap';
import { roadmapFieldOf } from '@/features/roadmap/layout-roadmap';
import { RoadmapSearch } from '@/features/roadmap-search';
import { CourseDetailPanel } from '@/features/course-detail';

function RoadmapContent(): JSX.Element {
  const { profile, loading, error } = useProfile();
  const ref = useReference();
  const completion = useCompletion();
  const recommendations = useRecommendations();
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
  if (loading) return <p role="status">로드맵을 불러오는 중입니다.</p>;
  if (error) return <p role="alert">{error.message}</p>;
  if (!profile) return <p>프로필을 등록하면 수강 경로를 확인할 수 있어요.</p>;
  return <>
    <div className="toolbar roadmap-toolbar"><RoadmapSearch onSelect={select} visibleFields={visibleFields} onChangeVisibleFields={setVisibleFields} />
      <label><input type="checkbox" checked={showRecommendationEdges} onChange={(e) => setShowRecommendationEdges(e.target.checked)} />추천 화살표 보기</label>
    </div>
    <RoadmapView programId={profile.program_id} admissionYear={profile.admission_year} completion={completion}
      recommendations={recommendations} selectedCode={selectedCode} onSelect={select}
      showRecommendationEdges={showRecommendationEdges} visibleFields={visibleFields} />
    <CourseDetailPanel code={selectedCode} onClose={() => select(null)} onNavigate={select} />
  </>;
}
export default function RoadmapPage(): JSX.Element {
  return (
    <div className="roadmap-page">
      <h1>내 전공 노선도</h1>
      <p className="page-description">금색 고리와 ‘추천’ 표시가 붙은 역이 다음 학기 추천 과목이에요. 과목을 누르면 그 과목에서 이어지는 후수 과목이 파란 점선으로 끝까지 표시되고, 상세 창은 위쪽 손잡이를 끌어 옮길 수 있어요.</p>
      <Suspense fallback={<p role="status">로드맵을 불러오는 중입니다.</p>}><RoadmapContent /></Suspense>
    </div>
  );
}
