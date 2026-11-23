begin;

insert into auth.users (id, email) values
  ('00000000-0000-4000-8000-000000000001', 'first@example.invalid'),
  ('00000000-0000-4000-8000-000000000002', 'second@example.invalid');

do $$
begin
  if exists (select 1 from public.profiles where id in (
    '00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000002'
  )) then
    raise exception 'Profiles must be created by onboarding';
  end if;
end;
$$;

insert into public.profiles (id, program_id, admission_year)
select id, 'adv_computing', 2026 from auth.users
where id in ('00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000002');
insert into public.enrollments (user_id, course_code, taken_year, taken_semester, status, source)
select id, 'COMP0204', 2026, 1, 'completed', 'manual' from auth.users
where id in ('00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000002');
insert into public.user_interests (user_id, field_id)
select id, 'common' from auth.users
where id in ('00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000002');
insert into public.noncredit_status (user_id, checklist_key, status)
select id, 'topcit', 'unmet' from auth.users
where id in ('00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000002');
insert into public.ocr_import_items (user_id, raw_text)
select id, 'example' from auth.users
where id in ('00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000002');

set local role service_role;
insert into public.senior_profiles (id, label, program_id, admission_year)
values ('00000000-0000-4000-8000-000000000003', 'test-senior', 'adv_computing', 2024);
insert into public.senior_enrollments (senior_id, course_code, taken_year, taken_semester)
values ('00000000-0000-4000-8000-000000000003', 'COMP0204', 2024, 1);
insert into public.followup_stats (program_id, from_code, to_code, follower_count, base_count)
values ('adv_computing', 'COMP0204', 'COMP0205', 2, 3);

set local role authenticated;
set local request.jwt.claim.sub = '00000000-0000-4000-8000-000000000001';

do $$
declare
  own_id constant uuid := '00000000-0000-4000-8000-000000000001';
  other_id constant uuid := '00000000-0000-4000-8000-000000000002';
  target record;
  affected bigint;
begin
  for target in
    select * from (values
      ('profiles', 'id'),
      ('enrollments', 'user_id'),
      ('user_interests', 'user_id'),
      ('noncredit_status', 'user_id'),
      ('ocr_import_items', 'user_id')
    ) as targets(table_name, owner_column)
  loop
    execute format('select count(*) from public.%I where %I = $1', target.table_name, target.owner_column)
      into affected using own_id;
    if affected <> 1 then
      raise exception '%: own row should be visible', target.table_name;
    end if;

    execute format('select count(*) from public.%I where %I = $1', target.table_name, target.owner_column)
      into affected using other_id;
    if affected <> 0 then
      raise exception '%: another user''s row is visible', target.table_name;
    end if;

    execute format('update public.%I set %I = $1 where %I = $1',
      target.table_name, target.owner_column, target.owner_column) using other_id;
    get diagnostics affected = row_count;
    if affected <> 0 then
      raise exception '%: another user''s row was updated', target.table_name;
    end if;

    execute format('delete from public.%I where %I = $1', target.table_name, target.owner_column) using other_id;
    get diagnostics affected = row_count;
    if affected <> 0 then
      raise exception '%: another user''s row was deleted', target.table_name;
    end if;

    begin
      execute format('update public.%I set %I = $1 where %I = $2',
        target.table_name, target.owner_column, target.owner_column) using other_id, own_id;
      raise exception '%: changing the row owner was permitted', target.table_name;
    exception when insufficient_privilege then
      null;
    end;
  end loop;

  insert into public.enrollments (user_id, course_code, taken_year, taken_semester, status, source)
  values (own_id, 'COMP0205', 2026, 2, 'incomplete', 'manual');
  begin
    insert into public.enrollments (user_id, course_code, taken_year, taken_semester, status, source)
    values (own_id, 'COMP0205', 2026, 2, 'incomplete', 'manual');
    raise exception 'A duplicate enrollment for the same term was permitted';
  exception when unique_violation then
    null;
  end;

  update public.enrollments set grade = 'A+' where user_id = own_id and course_code = 'COMP0205';
  get diagnostics affected = row_count;
  if affected <> 1 then
    raise exception 'Own enrollment should be updatable';
  end if;
  delete from public.enrollments where user_id = own_id and course_code = 'COMP0205';
  get diagnostics affected = row_count;
  if affected <> 1 then
    raise exception 'Own enrollment should be deletable';
  end if;

  begin
    insert into public.enrollments (user_id, course_code, taken_year, taken_semester, status, source)
    values (other_id, 'COMP0205', 2026, 2, 'incomplete', 'manual');
    raise exception 'Inserting for another user was permitted';
  exception when insufficient_privilege then
    null;
  end;
end;
$$;

do $$
declare
  restricted_table text;
begin
  foreach restricted_table in array array['senior_profiles', 'senior_enrollments']
  loop
    if pg_catalog.has_table_privilege('public.' || restricted_table, 'SELECT, INSERT, UPDATE, DELETE') then
      raise exception 'Authenticated role has access to %', restricted_table;
    end if;

    begin
      execute format('select count(*) from public.%I', restricted_table);
      raise exception 'Authenticated role can read %', restricted_table;
    exception when insufficient_privilege then
      null;
    end;
  end loop;

  if not exists (
    select 1 from public.followup_stats
    where program_id = 'adv_computing' and from_code = 'COMP0204' and to_code = 'COMP0205'
  ) then
    raise exception 'Authenticated role should see follow-up stats';
  end if;
  if pg_catalog.has_table_privilege('public.followup_stats', 'INSERT, UPDATE, DELETE, TRUNCATE') then
    raise exception 'Authenticated role has a write privilege on follow-up stats';
  end if;
end;
$$;

do $$
begin
  if public.replace_user_interests(array['system', 'system']) <> array['system'] then
    raise exception 'Interest replacement must deduplicate selected fields';
  end if;
  if public.replace_user_interests('{}') <> '{}' then
    raise exception 'An empty interest selection must clear the list';
  end if;
  if exists (select 1 from public.user_interests) then
    raise exception 'Existing interests were not cleared';
  end if;
end;
$$;

set local request.jwt.claim.sub = '00000000-0000-4000-8000-000000000002';

do $$
begin
  if not exists (select 1 from public.user_interests where field_id = 'common') then
    raise exception 'Interest replacement affected another user';
  end if;
end;
$$;

set local request.jwt.claim.sub = '';

do $$
begin
  if exists (select 1 from public.followup_stats) then
    raise exception 'Follow-up stats are visible without an authenticated identity';
  end if;
end;
$$;

set local role anon;

do $$
declare
  target text;
begin
  if pg_catalog.has_function_privilege('public.replace_user_interests(text[])', 'EXECUTE') then
    raise exception 'Anonymous role can replace interests';
  end if;
  foreach target in array array[
    'profiles', 'enrollments', 'user_interests', 'noncredit_status',
    'ocr_import_items', 'senior_profiles', 'senior_enrollments', 'followup_stats'
  ]
  loop
    if pg_catalog.has_table_privilege('public.' || target, 'SELECT, INSERT, UPDATE, DELETE, TRUNCATE') then
      raise exception 'Anonymous role has access to %', target;
    end if;
  end loop;
end;
$$;

-- The assertions above fail with an SQL error and are rolled back with their fixtures.
-- Return a TAP result so the same script also runs under supabase test db (pg_prove).
select '1..1';
select 'ok 1 - User data RLS and role grants';
rollback;
