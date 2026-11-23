import { NextRequest } from 'next/server';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { middleware } from '@/middleware';

const { getClaims, getProfile } = vi.hoisted(() => ({
  getClaims: vi.fn(),
  getProfile: vi.fn(),
}));

vi.mock('./config', () => ({
  useMockAuth: false,
  getSupabaseConfig: () => ({ url: 'https://project.example.invalid', key: 'test' }),
}));

vi.mock('@supabase/ssr', () => ({
  createServerClient: (_url: string, _key: string, options: {
    cookies: { setAll: (entries: { name: string; value: string }[], headers: Record<string, string>) => void };
  }) => ({
    auth: {
      getClaims: async () => {
        const result = await getClaims();
        if (result.data) {
          options.cookies.setAll([{ name: 'test-session', value: 'refreshed' }], { 'cache-control': 'private, no-store' });
        }
        return result;
      },
    },
    from: () => ({ select: () => ({ eq: () => ({ maybeSingle: getProfile }) }) }),
  }),
}));

const schoolClaims = {
  sub: 'demo-id',
  email: 'student@KNU.AC.KR',
  app_metadata: { provider: 'google' },
};

describe('Supabase 라우트 가드', () => {
  afterEach(() => vi.resetAllMocks());

  it('검증된 세션이 없으면 프로필 조회 없이 인트로로 이동한다', async () => {
    getClaims.mockResolvedValue({ data: null, error: null });
    const response = await middleware(new NextRequest('https://preview.example.invalid/roadmap'));
    expect(response.status).toBe(307);
    expect(response.headers.get('location')).toBe('https://preview.example.invalid/');
    expect(getProfile).not.toHaveBeenCalled();
  });

  it.each([
    { ...schoolClaims, email: 'student@gmail.com' },
    { ...schoolClaims, email: 'student@knu.ac.kr.example' },
    { ...schoolClaims, email: 'student@@knu.ac.kr' },
    { ...schoolClaims, app_metadata: { provider: 'email' } },
  ])('학교 Google 계정이 아니면 프로필 조회 없이 인트로로 이동한다', async (claims) => {
    getClaims.mockResolvedValue({ data: { claims }, error: null });
    const response = await middleware(new NextRequest('https://preview.example.invalid/roadmap'));
    expect(response.status).toBe(307);
    expect(response.headers.get('location')).toBe('https://preview.example.invalid/');
    expect(getProfile).not.toHaveBeenCalled();
  });

  it.each([
    [null, '/onboarding'],
    [{ id: 'demo-id' }, '/roadmap'],
  ])('프로필이 %j이면 %s로 이동하고 갱신 쿠키를 전달한다', async (profile, pathname) => {
    getClaims.mockResolvedValue({ data: { claims: schoolClaims }, error: null });
    getProfile.mockResolvedValue({ data: profile, error: null });
    const response = await middleware(new NextRequest('https://preview.example.invalid/'));
    expect(response.status).toBe(307);
    expect(response.headers.get('location')).toBe(`https://preview.example.invalid${pathname}`);
    expect(response.cookies.get('test-session')?.value).toBe('refreshed');
    expect(response.headers.get('cache-control')).toBe('no-store');
  });

  it('프로필 조회가 실패하면 접근을 허용하지 않고 갱신 쿠키를 보존한다', async () => {
    getClaims.mockResolvedValue({ data: { claims: schoolClaims }, error: null });
    getProfile.mockResolvedValue({ data: null, error: { message: 'offline' } });
    const response = await middleware(new NextRequest('https://preview.example.invalid/roadmap'));
    expect(response.status).toBe(503);
    expect(response.headers.get('location')).toBeNull();
    expect(response.cookies.get('test-session')?.value).toBe('refreshed');
  });
});
