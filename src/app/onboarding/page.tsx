import type { JSX } from 'react';
import { EmptyState } from '@/components/ui/EmptyState';

export default function Page(): JSX.Element {
  return <><h1>시작하기</h1><p className="page-description">전공과 학번, 이수 기록과 관심 분야를 등록하세요.</p><EmptyState title="온보딩을 준비 중입니다.">전공·학번 → 수강 내역 → 관심 분야 순서로 입력하게 됩니다.</EmptyState></>;
}
