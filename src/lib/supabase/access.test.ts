import { describe, expect, it } from 'vitest';
import { getAccessRedirect, type SessionState } from './access';

describe('라우트 접근 규칙', () => {
  const cases: [SessionState, string, string | null][] = [
    ['guest', '/', null],
    ['guest', '/onboarding', '/'],
    ['guest', '/roadmap', '/'],
    ['guest', '/api/ocr', '/'],
    ['onboarding', '/', '/onboarding'],
    ['onboarding', '/onboarding', null],
    ['onboarding', '/account', '/onboarding'],
    ['ready', '/', '/roadmap'],
    ['ready', '/onboarding', '/roadmap'],
    ['ready', '/roadmap', null],
    ['ready', '/enrollments/import', null],
  ];

  it.each(cases)('%s: %s → %s', (session, pathname, destination) => {
    expect(getAccessRedirect(pathname, session)).toBe(destination);
  });
});
