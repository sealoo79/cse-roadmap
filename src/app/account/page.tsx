import type { JSX } from 'react';
import { ProfileSettings } from '@/features/profile/ProfileSettings';

export default function Page(): JSX.Element {
  return <>
    <h1>회원정보 변경</h1>
    <p className="page-description">전공, 학번과 관심 분야를 변경하세요.</p>
    <ProfileSettings mode="account" />
  </>;
}
