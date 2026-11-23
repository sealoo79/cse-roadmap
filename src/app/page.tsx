import type { JSX } from 'react';
import { Intro } from '@/features/intro/Intro';

export default async function Home({
  searchParams,
}: {
  searchParams: Promise<{ auth_error?: string }>;
}): Promise<JSX.Element> {
  const { auth_error } = await searchParams;
  return <Intro callbackFailed={auth_error === '1'} />;
}
