import type { JSX } from 'react';
import { EmptyState } from '@/components/ui/EmptyState';

export default function Page(): JSX.Element {
  return <><h1>회원정보 변경</h1><p className="page-description">나의 전공과 관심 분야를 관리하세요.</p><EmptyState title="프로필 편집을 준비 중입니다.">현재는 개발용 시연 계정으로 연결되어 있습니다.</EmptyState></>;
}
