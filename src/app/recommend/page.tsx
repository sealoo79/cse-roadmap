import type { JSX } from 'react';
import { EmptyState } from '@/components/ui/EmptyState';

export default function Page(): JSX.Element {
  return <><h1>다음 학기 추천</h1><p className="page-description">관심 분야를 따라 다음 수강 과목을 살펴보세요.</p><EmptyState title="추천 과목을 준비 중입니다.">추천 기능은 후속 이슈에서 연결됩니다.</EmptyState></>;
}
