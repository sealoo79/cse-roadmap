import type { JSX } from 'react';
import { ProfileSettings } from '@/features/profile/ProfileSettings';

export default function Page(): JSX.Element {
  return <>
    <h1>시작하기</h1>
    <p className="page-description">전공과 학번을 등록하고 관심 분야를 선택하세요.</p>
    <ProfileSettings mode="onboarding" />
  </>;
}
