import { NextResponse, type NextRequest } from 'next/server';
import { useMockAuth } from '@/lib/supabase/config';
import { createServerSupabaseClient } from '@/lib/supabase/server';

function redirectToIntro(failed: boolean): NextResponse {
  return new NextResponse(null, {
    status: 303,
    headers: { location: failed ? '/?auth_error=1' : '/', 'cache-control': 'no-store' },
  });
}

export async function GET(request: NextRequest): Promise<NextResponse> {
  if (useMockAuth) return redirectToIntro(false);

  const code = request.nextUrl.searchParams.get('code');
  if (!code) return redirectToIntro(true);

  const supabase = await createServerSupabaseClient();
  if (!supabase) return redirectToIntro(true);

  const { error } = await supabase.auth.exchangeCodeForSession(code);
  return redirectToIntro(Boolean(error));
}
