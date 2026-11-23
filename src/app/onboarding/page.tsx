import type { JSX } from 'react';
import { ProfileSettings } from '@/features/profile/ProfileSettings';

export default function Page(): JSX.Element {
  return <ProfileSettings mode="onboarding" />;
}
