begin;

create or replace function public.refresh_followup_stats()
returns integer
language plpgsql
security invoker
set search_path = ''
as $$
declare
  saved_count integer;
begin
  perform pg_advisory_xact_lock(18400, 1);
  delete from public.followup_stats;

  with course_terms as (
    select senior.program_id, enrollment.senior_id, enrollment.course_code,
      enrollment.taken_year * 4 + case enrollment.taken_semester
        when 1 then 0 when 3 then 1 when 2 then 2 when 4 then 3
      end as term
    from public.senior_enrollments as enrollment
    join public.senior_profiles as senior on senior.id = enrollment.senior_id
  ),
  courses_by_senior as (
    select program_id, senior_id, course_code, min(term) as first_term, max(term) as last_term
    from course_terms
    group by program_id, senior_id, course_code
  ),
  bases as (
    select program_id, course_code, count(*)::integer as base_count
    from courses_by_senior
    group by program_id, course_code
  ),
  followers as (
    select source.program_id, source.course_code as from_code, target.course_code as to_code,
      count(*)::integer as follower_count
    from courses_by_senior as source
    join courses_by_senior as target
      on target.senior_id = source.senior_id
      and target.course_code <> source.course_code
      and target.last_term > source.first_term
    group by source.program_id, source.course_code, target.course_code
  )
  insert into public.followup_stats (program_id, from_code, to_code, follower_count, base_count)
  select followers.program_id, followers.from_code, followers.to_code, followers.follower_count, bases.base_count
  from followers
  join bases on bases.program_id = followers.program_id and bases.course_code = followers.from_code;

  get diagnostics saved_count = row_count;
  return saved_count;
end;
$$;

create or replace function public.replace_senior_seed(seed_rows jsonb)
returns integer
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if seed_rows is null or jsonb_typeof(seed_rows) <> 'array' or jsonb_array_length(seed_rows) = 0 then
    raise exception 'A nonempty seed array is required' using errcode = '22023';
  end if;

  perform pg_advisory_xact_lock(18400, 1);
  delete from public.senior_profiles;

  insert into public.senior_profiles (label, program_id, admission_year)
  select distinct label, program_id, admission_year
  from jsonb_to_recordset(seed_rows) as seed(label text, program_id text, admission_year integer);

  insert into public.senior_enrollments (senior_id, course_code, taken_year, taken_semester)
  select distinct senior.id, seed.course_code, seed.taken_year, seed.taken_semester
  from jsonb_to_recordset(seed_rows) as seed(label text, course_code text, taken_year integer, taken_semester integer)
  join public.senior_profiles as senior on senior.label = seed.label;

  return public.refresh_followup_stats();
end;
$$;

revoke all on function public.refresh_followup_stats() from public, anon, authenticated, service_role;
revoke all on function public.replace_senior_seed(jsonb) from public, anon, authenticated, service_role;
grant execute on function public.refresh_followup_stats() to service_role;
grant execute on function public.replace_senior_seed(jsonb) to service_role;

drop policy if exists followup_stats_minimum_sample on public.followup_stats;
create policy followup_stats_minimum_sample on public.followup_stats
  as restrictive for select to authenticated using (base_count >= 3);

commit;
