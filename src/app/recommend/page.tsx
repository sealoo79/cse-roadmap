import type { JSX } from 'react';
import { RecommendationList } from '@/features/recommend/RecommendationList';

export default function Page(): JSX.Element {
  return (
    <>
      <h1>다음 학기 추천</h1>
      <p className="page-description">관심 분야와 이수 내역을 바탕으로 추천한 과목입니다. 실제 개설 학기는 수강 신청 전에 확인하세요.</p>
      <RecommendationList />
    </>
  );
}
