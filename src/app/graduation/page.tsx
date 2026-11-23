import type { JSX } from 'react';
import { EmptyState } from '@/components/ui/EmptyState';

export default function Page(): JSX.Element {
  return <><h1>졸업요건</h1><p className="page-description">이수 기록과 졸업요건을 한눈에 확인하세요.</p><EmptyState title="졸업요건 진행률을 준비 중입니다.">졸업 판정 엔진과 비학점 요건 입력 화면이 연결될 예정입니다.</EmptyState></>;
}
