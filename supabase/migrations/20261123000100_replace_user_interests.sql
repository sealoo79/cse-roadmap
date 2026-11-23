begin;

create function public.replace_user_interests(field_ids text[])
returns text[]
language plpgsql
security invoker
set search_path = ''
as $$
declare
  owner_id uuid := auth.uid();
  saved_ids text[];
begin
  if owner_id is null then
    raise exception 'Authentication required' using errcode = '42501';
  end if;
  if field_ids is null or array_position(field_ids, null) is not null then
    raise exception 'Expected an array of field IDs' using errcode = '22023';
  end if;

  -- Serialize replacements for the same user, including empty lists.
  perform pg_advisory_xact_lock(hashtextextended(owner_id::text, 0));
  delete from public.user_interests where user_id = owner_id;
  insert into public.user_interests (user_id, field_id)
  select distinct owner_id, field_id from unnest(field_ids) as fields(field_id);

  select coalesce(array_agg(field_id order by field_id), '{}'::text[]) into saved_ids
  from public.user_interests where user_id = owner_id;
  return saved_ids;
end;
$$;

revoke all on function public.replace_user_interests(text[]) from public, anon, authenticated, service_role;
grant execute on function public.replace_user_interests(text[]) to authenticated;
commit;
