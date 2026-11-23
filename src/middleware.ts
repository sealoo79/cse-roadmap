import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';
import { getAccessRedirect } from '@/lib/supabase/access';
import { getSupabaseConfig, mockSessionCookie, useMockAuth } from '@/lib/supabase/config';

function unavailable(): NextResponse {
  return new NextResponse('로그인 상태를 확인할 수 없습니다. 잠시 후 다시 시도해 주세요.', {
    status: 503,
    headers: { 'content-type': 'text/plain; charset=utf-8', 'cache-control': 'no-store' },
  });
}

export async function middleware(request: NextRequest): Promise<NextResponse> {
  let response = NextResponse.next({ request });
  const { pathname } = request.nextUrl;

  const copyCookies = (target: NextResponse): NextResponse => {
    for (const cookie of response.cookies.getAll()) target.cookies.set(cookie);
    return target;
  };

  const redirect = (destination: '/' | '/onboarding' | '/roadmap' | null): NextResponse => {
    if (!destination) return response;
    const status = request.method === 'GET' || request.method === 'HEAD' ? 307 : 303;
    const redirected = NextResponse.redirect(new URL(destination, request.nextUrl), status);
    redirected.headers.set('cache-control', 'no-store');
    return copyCookies(redirected);
  };

  if (useMockAuth) {
    const authenticated = request.cookies.get(mockSessionCookie)?.value === '1';
    return redirect(getAccessRedirect(pathname, authenticated ? 'ready' : 'guest'));
  }

  const config = getSupabaseConfig();
  if (!config) return pathname === '/' ? response : unavailable();

  const supabase = createServerClient(config.url, config.key, {
    cookies: {
      getAll: () => request.cookies.getAll(),
      setAll: (entries, headers) => {
        const previous = response.cookies.getAll();
        for (const { name, value } of entries) request.cookies.set(name, value);
        response = NextResponse.next({ request });
        for (const cookie of previous) response.cookies.set(cookie);
        for (const { name, value, options } of entries) response.cookies.set(name, value, options);
        for (const [name, value] of Object.entries(headers)) response.headers.set(name, value);
      },
    },
  });

  const { data, error: authError } = await supabase.auth.getClaims();
  if (authError?.status && authError.status >= 500) return copyCookies(unavailable());
  const userId = data?.claims.sub;
  if (!userId) return redirect(getAccessRedirect(pathname, 'guest'));

  const { data: profile, error } = await supabase
    .from('profiles')
    .select('id')
    .eq('id', userId)
    .maybeSingle();

  if (error) return copyCookies(unavailable());
  response.headers.set('cache-control', 'private, no-store');
  return redirect(getAccessRedirect(pathname, profile ? 'ready' : 'onboarding'));
}

export const config = {
  runtime: 'nodejs',
  matcher: [
    '/',
    '/onboarding/:path*',
    '/roadmap/:path*',
    '/graduation/:path*',
    '/recommend/:path*',
    '/enrollments/:path*',
    '/account/:path*',
    '/api/ocr/:path*',
  ],
};
