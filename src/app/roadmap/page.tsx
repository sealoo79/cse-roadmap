'use client';

import { useState, type JSX } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Suspense } from 'react';
import type { CourseCode, FieldId } from '@/types/reference';
import { useCompletion, useProfile, useReference } from '@/lib/user-data/hooks';
import { useRecommendations } from '@/features/recommend/useRecommendations';
import { RoadmapView } from '@/features/roadmap';
import { roadmapFieldOf } from '@/features/roadmap/layout-roadmap';
import { RoadmapCourseSearch, RoadmapFieldFilters } from '@/features/roadmap-search';
import { CourseDetailPanel } from '@/features/course-detail';
import styles from '@/features/roadmap/roadmap.module.css';

function RoadmapContent(): JSX.Element {
  const { profile, loading, error } = useProfile();
  const ref = useReference();
  const completion = useCompletion();
  const recommendations = useRecommendations();
  const [visibleFields, setVisibleFields] = useState<FieldId[]>(ref.fields.map((f) => f.field_id));
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
  if (loading) return <><PageTitle /><p role="status">로드맵을 불러오는 중입니다.</p></>;
  if (error) return <><PageTitle /><p role="alert">{error.message}</p></>;
  if (!profile) return <><PageTitle /><p>프로필을 등록하면 수강 경로를 확인할 수 있어요.</p></>;
  return <>
    <div className={styles.pageHeader}>
      <PageTitle />
      <div className={styles.pageSearch}><RoadmapCourseSearch onSelect={select} /></div>
    </div>
    <RoadmapView programId={profile.program_id} admissionYear={profile.admission_year} completion={completion}
      recommendations={recommendations} selectedCode={selectedCode} onSelect={select}
      showRecommendationEdges visibleFields={visibleFields}
      toolbar={<RoadmapFieldFilters visibleFields={visibleFields} onChangeVisibleFields={setVisibleFields} />} />
    <CourseDetailPanel code={selectedCode} onClose={() => select(null)} onNavigate={select} />
  </>;
}
function PageTitle(): JSX.Element {
  return <h1 className={styles.pageTitle}>수강 로드맵</h1>;
}

export default function RoadmapPage(): JSX.Element {
  // roadmap-page: 노선도 화면은 넓은 본문 폭(--wide-width)을 쓴다(globals.css).
  return (
    <div className="roadmap-page">
      <Suspense fallback={<><PageTitle /><p role="status">로드맵을 불러오는 중입니다.</p></>}><RoadmapContent /></Suspense>
    </div>
  );
}
