begin;

create function public.require_knu_google_signup(event jsonb)
returns jsonb
language sql
set search_path = ''
as $$
  select case
    when event #>> '{user,app_metadata,provider}' = 'google'
      and lower(event #>> '{user,email}') ~ '^[^@[:space:]]+@knu[.]ac[.]kr$'
    then '{}'::jsonb
    else jsonb_build_object('error', jsonb_build_object(
      'http_code', 403,
      'message', '경북대 Google 계정(@knu.ac.kr)으로 로그인해 주세요.'
    ))
  end;
$$;

create function public.require_knu_google_token(event jsonb)
returns jsonb
language sql
set search_path = ''
as $$
  select case
    when event ->> 'authentication_method' in ('oauth', 'token_refresh')
      and event #>> '{claims,app_metadata,provider}' = 'google'
      and lower(event #>> '{claims,email}') ~ '^[^@[:space:]]+@knu[.]ac[.]kr$'
    then jsonb_build_object('claims', event -> 'claims')
    else jsonb_build_object('error', jsonb_build_object(
      'http_code', 403,
      'message', '경북대 Google 계정(@knu.ac.kr)으로 로그인해 주세요.'
    ))
  end;
$$;

revoke all on function public.require_knu_google_signup(jsonb),
  public.require_knu_google_token(jsonb) from public, anon, authenticated, service_role;
grant usage on schema public to supabase_auth_admin;
grant execute on function public.require_knu_google_signup(jsonb),
  public.require_knu_google_token(jsonb) to supabase_auth_admin;

commit;
