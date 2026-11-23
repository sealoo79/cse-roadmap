import type { JSX } from 'react';
import { EmptyState } from '@/components/ui/EmptyState';

export default function Page(): JSX.Element {
  return <><h1>수강 이력</h1><p className="page-description">이수한 과목과 수강 중인 과목을 관리하세요.</p><EmptyState title="수강 이력 편집을 준비 중입니다.">시연 계정의 저장된 기록은 상단 상태 표시에서 확인할 수 있어요.</EmptyState></>;
}
