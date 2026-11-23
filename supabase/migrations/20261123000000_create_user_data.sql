begin;

create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  email text,
  program_id text not null,
  admission_year integer not null,
  major_type text not null default 'single' check (major_type in ('single', 'multi')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.enrollments (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  course_code text not null,
  taken_year integer not null,
  taken_semester integer not null check (taken_semester in (1, 2, 3, 4)),
  status text not null check (status in ('completed', 'failed', 'incomplete')),
  source text not null check (source in ('manual', 'ocr', 'url')),
  credit numeric check (credit >= 0 and credit < 'Infinity'::numeric),
  grade text,
  created_at timestamptz not null default now(),
  unique (user_id, course_code, taken_year, taken_semester)
);

create table public.user_interests (
  user_id uuid not null references auth.users (id) on delete cascade,
  field_id text not null,
  primary key (user_id, field_id)
);

create table public.noncredit_status (
  user_id uuid not null references auth.users (id) on delete cascade,
  checklist_key text not null,
  status text not null check (status in ('met', 'unmet')),
  input_value text,
  updated_at timestamptz not null default now(),
  primary key (user_id, checklist_key)
);

create table public.ocr_import_items (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  raw_text text not null,
  candidate_codes text[] not null default '{}',
  matched_course_code text,
  review_status text not null default 'pending' check (review_status in ('pending', 'confirmed', 'rejected')),
  created_at timestamptz not null default now()
);

create index ocr_import_items_user_id_idx on public.ocr_import_items (user_id);

create table public.senior_profiles (
  id uuid primary key default gen_random_uuid(),
  label text not null unique,
  program_id text not null,
  admission_year integer not null
);

create table public.senior_enrollments (
  senior_id uuid not null references public.senior_profiles (id) on delete cascade,
  course_code text not null,
  taken_year integer not null,
  taken_semester integer not null check (taken_semester in (1, 2, 3, 4)),
  primary key (senior_id, course_code, taken_year, taken_semester)
);

create table public.followup_stats (
  program_id text not null,
  from_code text not null,
  to_code text not null,
  follower_count integer not null check (follower_count >= 0),
  base_count integer not null check (base_count >= follower_count),
  primary key (program_id, from_code, to_code)
);

create function public.touch_user_data_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := statement_timestamp();
  return new;
end;
$$;

revoke all on function public.touch_user_data_updated_at()
  from public, anon, authenticated, service_role;

create trigger profiles_updated_at
  before update on public.profiles
  for each row execute function public.touch_user_data_updated_at();

create trigger noncredit_status_updated_at
  before update on public.noncredit_status
  for each row execute function public.touch_user_data_updated_at();

alter table public.profiles enable row level security;
alter table public.enrollments enable row level security;
alter table public.user_interests enable row level security;
alter table public.noncredit_status enable row level security;
alter table public.ocr_import_items enable row level security;
alter table public.senior_profiles enable row level security;
alter table public.senior_enrollments enable row level security;
alter table public.followup_stats enable row level security;

revoke all on table
  public.profiles, public.enrollments, public.user_interests, public.noncredit_status,
  public.ocr_import_items, public.senior_profiles, public.senior_enrollments, public.followup_stats
  from public, anon, authenticated, service_role;

grant select, insert, update, delete on table
  public.profiles, public.enrollments, public.user_interests, public.noncredit_status,
  public.ocr_import_items to authenticated;
grant select on public.followup_stats to authenticated;

grant select, insert, update, delete on table
  public.profiles, public.enrollments, public.user_interests, public.noncredit_status,
  public.ocr_import_items, public.senior_profiles, public.senior_enrollments, public.followup_stats
  to service_role;

create policy profiles_owner on public.profiles
  for all to authenticated
  using (id = (select auth.uid()))
  with check (id = (select auth.uid()));

create policy enrollments_owner on public.enrollments
  for all to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

create policy user_interests_owner on public.user_interests
  for all to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

create policy noncredit_status_owner on public.noncredit_status
  for all to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

create policy ocr_import_items_owner on public.ocr_import_items
  for all to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

create policy followup_stats_authenticated_read on public.followup_stats
  for select to authenticated
  using ((select auth.uid()) is not null);

commit;
