# 선배 수강 이력 적재

수집 전에 함께 수강 추천에 사용하는 목적과 접근 범위를 설명하고 동의를 받습니다. 전공별 4~5명의 이력을 준비하고, 이름·학생번호·이메일과 연결되지 않는 임의의 식별자(예: `senior-…`)를 부여합니다. 동의 기록과 시드 원본은 저장소 바깥에 보관합니다. 수집 동의의 구체적인 방식은 팀에서 확정합니다.

## 파일 형식

다음은 가짜 레코드로 만든 JSON 배열 예시입니다.

```json
[
  {
    "label": "senior-example-a",
    "program_id": "adv_computing",
    "admission_year": 2026,
    "course_code": "COMP0204",
    "taken_year": 2026,
    "taken_semester": 1
  }
]
```

`label`은 한 사람에게 일관되게 쓰고 다른 사람과 공유하지 않습니다. 전공과 과목 코드는 `data/`의 기준 JSON을 사용합니다. 이수를 마친 기록만 넣습니다. 학기가 비어 있는 행은 건너뛰며, 학기 값은 봄 1, 여름 3, 가을 2, 겨울 4입니다. 개인 식별 정보를 넣는 추가 키는 거절합니다.

## 설치와 실행

1. 관리자 연결로 #4 마이그레이션을 적용한 DB에 [집계 SQL](../supabase/sql/followup_stats.sql)을 실행합니다. 로컬 DB를 초기화하면 이 SQL도 다시 실행합니다.
2. Node.js 24 이상에서 `npm ci`를 실행한 뒤 원본 파일을 먼저 검증합니다.

   ```sh
   node scripts/seed-seniors.ts --check /private/path/seniors.json
   ```

3. `NEXT_PUBLIC_SUPABASE_URL`을 대상 프로젝트로 설정하고 터미널 환경에 `SUPABASE_SERVICE_ROLE_KEY`를 설정합니다. 서비스 역할 키는 브라우저에 전달하지 않고, 키와 시드 원본은 PR이나 로그에 첨부하지 않습니다.

   ```sh
   node scripts/seed-seniors.ts --replace /private/path/seniors.json
   node scripts/seed-seniors.ts --refresh
   ```

`--replace`는 기존 선배 프로필, 이력, 집계를 한 트랜잭션으로 새 스냅샷으로 교체합니다. 일부 전공만 갱신할 때도 유지할 전공을 모두 입력에 포함합니다. `--refresh`는 저장된 이력으로 집계만 재계산합니다. 일반 계정의 원본 테이블과 쓰기 함수 접근은 차단됩니다. 집계는 같은 전공에서 A를 들은 고유 인원 중 나중 학기에 B를 들은 고유 인원을 셉니다. 같은 학기는 제외하고 재수강은 사람당 한 번 셉니다. A의 표본이 3명 미만인 행은 로그인 계정의 조회에서도 숨깁니다.

## 가짜 시드로 SQL 검증

설치한 로컬 테스트 DB에서 DB 관리자 권한으로 실행합니다. 트랜잭션을 끝내면 가짜 시드와 교체된 집계가 모두 롤백됩니다.

```sql
begin;
set local role service_role;

select public.replace_senior_seed((
  select jsonb_agg(to_jsonb(seed))
  from (values
    ('senior-test-a', 'adv_computing', 2026, 'COMP0204', 2026, 1),
    ('senior-test-a', 'adv_computing', 2026, 'COMP0205', 2026, 3),
    ('senior-test-a', 'adv_computing', 2026, 'COMP0205', 2026, 2),
    ('senior-test-a', 'adv_computing', 2026, 'COMP0206', 2026, 3),
    ('senior-test-b', 'adv_computing', 2026, 'COMP0204', 2026, 1),
    ('senior-test-b', 'adv_computing', 2026, 'COMP0205', 2026, 1),
    ('senior-test-c', 'adv_computing', 2026, 'COMP0204', 2026, 4),
    ('senior-test-c', 'adv_computing', 2026, 'COMP0205', 2027, 1)
  ) as seed(label, program_id, admission_year, course_code, taken_year, taken_semester)
));

do $$
begin
  if not exists (
    select 1 from public.followup_stats
    where program_id = 'adv_computing' and from_code = 'COMP0204' and to_code = 'COMP0205'
      and follower_count = 2 and base_count = 3
  ) then
    raise exception 'Expected two followers among three seniors';
  end if;
  if not exists (
    select 1 from public.followup_stats
    where from_code = 'COMP0206' and to_code = 'COMP0205' and base_count = 1
  ) then
    raise exception 'Expected a one-person aggregate to verify the visibility rule';
  end if;
end;
$$;

set local role authenticated;
set local request.jwt.claim.sub = '00000000-0000-4000-8000-000000000001';

do $$
begin
  if has_table_privilege('public.senior_enrollments', 'select')
    or has_table_privilege('public.senior_profiles', 'select')
    or has_function_privilege('public.replace_senior_seed(jsonb)', 'execute')
    or has_function_privilege('public.refresh_followup_stats()', 'execute') then
    raise exception 'Unexpected access to private seed data or import functions';
  end if;

  if not exists (
    select 1 from public.followup_stats
    where from_code = 'COMP0204' and to_code = 'COMP0205' and base_count = 3
  ) then
    raise exception 'Expected the three-person aggregate to be visible';
  end if;

  if exists (select 1 from public.followup_stats where base_count < 3) then
    raise exception 'Small cohort must not be visible';
  end if;
end;
$$;
rollback;
```
