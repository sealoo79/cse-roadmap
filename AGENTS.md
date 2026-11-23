# AGENTS.md — cse-roadmap 공통 계약

경북대 컴퓨터학부 학생의 이수 이력·관심 분야·졸업요건을 바탕으로
노선도(지하철 노선도형 기술 발전표)·추천·졸업요건 진행률을 보여주는 웹 서비스.
4명이 GitHub 이슈 단위로 AI에게 구현을 맡기고 PR로 머지한다.

## A-0. 스택과 명령어
- Next.js(App Router) + TypeScript(strict) + Supabase(Auth·Postgres) + Vitest, 배포 Vercel
- 기준 데이터는 `data/*.json`을 빌드에 번들, 사용자 데이터만 Supabase에 저장

| 목적 | 명령 |
|---|---|
| 설치 | `npm ci` |
| 개발 서버(목 모드) | `NEXT_PUBLIC_USE_MOCK=1 npm run dev` |
| 린트 | `npm run lint` |
| 타입 검사 | `npm run typecheck` |
| 테스트 | `npm test` (= `vitest run`) |
| 데이터 검증 | `npm run validate-data` |
| 빌드 | `npm run build` |

환경 변수(`.env.example`): `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`,
`NEXT_PUBLIC_USE_MOCK`(1이면 localStorage 목 저장소), `SUPABASE_SERVICE_ROLE_KEY`(scripts 전용, 앱 코드에서 사용 금지).
비밀 값은 커밋하지 않는다.

## A-1. 작업 범위 규칙 (충돌 방지 — 가장 중요)
1. **한 번에 이슈 하나만** 구현한다. 이슈 본문의 '작업 범위(파일 소유권)' 안의 파일만 만들고 고친다.
2. 소유 범위 밖 파일이 꼭 필요하면 **고치지 말고** PR 본문 "범위 밖 요청"에 적는다.
3. 다른 이슈의 기능이 아직 없으면 #1의 **스텁·목**을 그대로 쓴다. 스텁을 직접 구현하지 않는다.
4. `data/*.json`은 데이터 이슈(#2, #3)만 수정한다. 포맷 변경(들여쓰기 등)도 금지.
5. `package.json`은 의존성 추가 시에만 고치고 **별도 커밋**으로 분리한다. lockfile 충돌은 main 기준으로 재생성.
6. 하위 폴더에 AGENTS.md / CLAUDE.md를 추가하지 않는다.

### 폴더 소유 표
| 경로 | 소유 이슈 |
|---|---|
| 설정 파일, `.github/workflows/ci.yml`, `AGENTS.md`, `CLAUDE.md`, `src/app/layout.tsx`, `src/app/globals.css`, `src/components/**`, `src/types/**`, `src/lib/reference/**`, `src/lib/user-data/{repository,mock-repository,provider,hooks,index}.ts(x)`, `src/test/fixtures/**` | #1 |
| `data/{programs,courses,curriculum,course_relations,course_equivalents,graduation_rules,requirement_courses}.json`, `docs/data_dictionary.md` | #2 |
| `data/{fields,course_fields,checklist}.json` | #3 |
| `supabase/migrations/**`, `supabase/config.toml`, `src/types/database.ts` | #4 |
| `src/app/page.tsx`, `src/app/auth/**`, `src/lib/supabase/**`, `src/middleware.ts`, `src/features/intro/**`, `src/features/auth/**` | #5 |
| `src/lib/domain/completion.ts(.test.ts)` | #6 |
| `src/features/roadmap/**`(edges 제외), `src/app/roadmap/page.tsx` | #7 |
| `scripts/validate-data.ts`, `.github/workflows/validate-data.yml` | #8 |
| `src/lib/user-data/supabase-repository.ts(.test.ts)` | #9 |
| `src/app/onboarding/**`, `src/app/account/**`, `src/features/profile/**` | #10 |
| `src/features/enrollments/**`, `src/app/enrollments/page.tsx` | #11 |
| `src/lib/domain/graduation.ts(.test.ts)`, `src/test/fixtures/graduation/**` | #12 |
| `src/lib/domain/recommend.ts(.test.ts)` | #13 |
| `src/features/roadmap/edges/**` | #14 |
| `src/features/ocr/**`, `src/app/enrollments/import/**`, `src/app/api/ocr/**` | #15 |
| `src/features/course-detail/**` | #16 |
| `src/features/graduation/**`, `src/app/graduation/page.tsx` | #17 |
| `scripts/seed-seniors.ts`, `supabase/sql/followup_stats.sql`, `docs/senior-seed.md` | #18 |
| `src/features/recommend/**`, `src/app/recommend/page.tsx` | #19 |
| `src/features/roadmap-search/**` | #20 |
| `tests/e2e/**`, `docs/demo.md` | #21 |

## A-2. 계약 변경 절차
- 이 파일의 A-3 ~ A-8(키, 타입, 함수 시그니처, 인터페이스, props, 라우트)이 **계약**이다.
- 바꿔야 하면: ① 이슈에 코멘트로 제안 → ② #1 담당이 `contract:` 접두어의 작은 PR로 `src/types`·스텁·이 파일을 함께 수정 → ③ 머지 후 각자 rebase.
- 필드 **추가**(옵셔널)는 하위 호환이므로 허용, 이름 변경·삭제는 팀 합의 필수.

## A-3. 고정 키 값 (한번 정하면 바꾸지 않는다)
| 키 | 값 |
|---|---|
| `program_id` | `platform_sw_data`(플랫폼SW&데이터과학) · `global_sw`(글로벌SW융합) · `ai_computing`(인공지능컴퓨팅) · `adv_computing`(심화컴퓨팅) · `adv_research`(첨단컴퓨팅연구) |
| `admission_year` | 2023 · 2024 · 2025 · 2026 |
| `course_code` | `^[A-Z]{4}\d{4}$` (예: COMP0204). **과목 식별은 코드로만**, 과목명 매칭 금지 |
| `field_id` | `common` · `system` · `ai_data` · `network_security` · `sw_web` |
| `credit_bucket`(curriculum) | `basic_literacy` · `major_base` · `engineering_major` · `major` · `liberal` · `general_elective` · `teaching` |
| 규칙 버킷(`credit_buckets.bucket_id`) | 위 7개 + `design` · `graduate_courses` · `abeek_total` |
| `rule_id` | `{program_id 또는 univ}__{시작연도}[_{끝연도}]` 예: `univ__2023`, `adv_research__2026` |
| `requirement_id` | `requirement_courses.json`의 값 그대로(예: `chs_core_humanities_social`, `startup__global_sw__2023_2025`) |
| `checklist_key` | `english_score` · `field_practice` · `research_practice` · `research_activity` · `graduation_review` · `topcit` · `portfolio` · `gq_practical_english` · `gq_software` · `gq_counseling` · `gq_major_area` (추가는 #3에서만) |
| 관계 `type` | `official`(필수 선수, 미준수 시 사전승인) · `recommended`(권장) · `coreq`(동시 수강) |
| 수강 상태 `status` | `completed` · `failed`(F) · `incomplete`(수강 중) |
| 입력 출처 `source` | `manual` · `ocr` · `url` |
| 수강 학기 `taken_semester` | `1`(1학기) · `2`(2학기) · `3`(여름 계절) · `4`(겨울 계절) |
| 노선도 열 `col` | 0~7 = 1-1, 1-2, 2-1, 2-2, 3-1, 3-2, 4-1, 4-2 |

## A-4. 기준 데이터 타입 — `src/types/reference.ts`
```ts
export type ProgramId = 'platform_sw_data' | 'global_sw' | 'ai_computing' | 'adv_computing' | 'adv_research';
export type AdmissionYear = 2023 | 2024 | 2025 | 2026;
export type CourseCode = string;               // ^[A-Z]{4}\d{4}$
export type Semester = 1 | 2;
export type FieldId = 'common' | 'system' | 'ai_data' | 'network_security' | 'sw_web';
export type CurriculumBucketId =
  | 'basic_literacy' | 'major_base' | 'engineering_major' | 'major'
  | 'liberal' | 'general_elective' | 'teaching';
export type RuleBucketId = CurriculumBucketId | 'design' | 'graduate_courses' | 'abeek_total';
export type ChecklistKey =
  | 'english_score' | 'field_practice' | 'research_practice' | 'research_activity'
  | 'graduation_review' | 'topcit' | 'portfolio'
  | 'gq_practical_english' | 'gq_software' | 'gq_counseling' | 'gq_major_area';

export interface Program {
  program_id: ProgramId;
  name: string;
  college: string;
  years: { admission_year: AdmissionYear; curriculum_status: 'available' | 'assumed' | 'missing' }[];
  note: string | null;
}

export interface Course {
  course_code: CourseCode;
  name_ko: string;
  name_en: string | null;
  credit: number | null;            // 교양 등 모르면 null → 학생 입력
  theory: number | null;
  practice: number | null;
  credit_sys: string | null;        // "3-2-2"
  kind: 'major' | 'liberal';
  course_types: string[];           // 교과구분 원문: 전공, 전공필수, 교양, 공학전공 …
  liberal_area: { group: string; sub: string | null; detail: string | null } | null;
  offered_semesters: Semester[] | null;
  offering_departments: string[] | null;
  tags: string[];                   // SDG교과목, 원격강좌 …
  startup_related: boolean;
  design_related: boolean;
  design_credit: number | null;     // ABEEK 설계학점, 모르면 null
  name_variants: string[];
  source: string;
}

export interface CurriculumEntry {
  admission_year: AdmissionYear;
  program_id: ProgramId;
  course_code: CourseCode;
  grade: 1 | 2 | 3 | 4;
  semester: Semester;
  category: string;                 // 원문 구분(전공, 공학전공, 기본소양 …) — 표시용
  credit_bucket: CurriculumBucketId;// 계산용 표준 키
  is_required: boolean;
  tags: string[];                   // 설계, 창업, 첨성인기초(수리) …
}

export interface CourseRelation {
  id: number;
  from_code: CourseCode;
  to_code: CourseCode;
  type: 'official' | 'recommended' | 'coreq';
  group_no: number;                 // 같은 to_code·같은 group_no = OR, 다른 group_no = AND
  program_id: ProgramId | null;
  admission_year_from: number | null;
  admission_year_to: number | null;
  source: string;
  note: string | null;
}

export interface CourseEquivalent {
  equivalent_id: number;
  old_code: CourseCode;
  new_code: CourseCode;
  relation: string;                 // same_course 등
  credit_changed: boolean;
  counts_for_required: boolean | null;   // null = 학과 확인 필요
  credit_recognition: string | null;
  applies_to_years: number[] | null;
  effective_from: string | null;
  source: string;
}

export interface Field {
  field_id: FieldId;
  name_ko: string;
  color: string;
  order: number;
  color_dark?: string;
  description?: string;
}

export interface CourseField {
  course_code: CourseCode;
  primary_field_id: FieldId;        // 노선도 행
  field_ids: FieldId[];             // 추천 가중치용
  basis: 'official' | 'team_proposal';
  name_ko?: string;                 // 검토용 과목명, 식별에는 course_code 사용
  note?: string | null;
}

export interface ChecklistItem {
  checklist_key: ChecklistKey;
  label: string;
  input_type: 'boolean' | 'number' | 'text' | 'date';
  source: string;
  help?: string;
}

export interface GraduationRule {
  rule_id: string;
  program_id: ProgramId | 'univ';
  admission_year_from: number;
  admission_year_to: number;
  total_credits: number | null;
  credit_buckets: { bucket_id: RuleBucketId; label: string; min_credits: number }[];
  credits: Record<string, number | string>;   // 원본 유지(레거시), 계산에 쓰지 않음
  required_courses: CourseCode[];
  checklist: { key: ChecklistKey; rule: string; input_type: ChecklistItem['input_type']; auto_judgeable: false }[];
  default_major_type: 'single';
  follows_university_credit_rules: boolean;   // 플솝(ABEEK) = false
  tracks?: unknown[];                         // 글솝 트랙 원문
  note?: string | null;
  legacy?: Record<string, unknown>;            // 추적용 원본 필드
  needs_confirmation: string[];
  source: string;
}

export interface Requirement {
  requirement_id: string;
  name: string;
  group: string;                    // 교양 영역별 필수, 졸업자격인정제, 전공, 전공필수, 공학인증(ABEEK), 창업, 설계, 현장실습, 참고
  program_ids: ProgramId[] | null;  // null = 전 전공
  admission_years: number[];
  min_credits: number | null;
  min_credits_detail: string | null;
  rule: string;
  counts_for_graduation: boolean;   // false = 참고용, 계산 제외
  checklist_key: ChecklistKey | null;
  input_required: boolean;
  courses: CourseCode[];
  course_basis: string;
  source: string;
  note: string | null;
}

export interface ReferenceData {
  programs: Program[];
  courses: Map<CourseCode, Course>;
  curriculum: CurriculumEntry[];
  relations: CourseRelation[];
  equivalents: CourseEquivalent[];
  fields: Field[];
  courseFields: Map<CourseCode, CourseField>;
  checklist: ChecklistItem[];
  rules: GraduationRule[];
  requirements: Requirement[];
}
```

### 로더 — `src/lib/reference/index.ts` (#1)
```ts
export function getReferenceData(): ReferenceData;                       // 모듈 단위 캐시
export function getCourse(code: CourseCode): Course | undefined;
export function getCurriculum(programId: ProgramId, year: AdmissionYear): CurriculumEntry[];
export function getRelations(programId: ProgramId, year: AdmissionYear): CourseRelation[];
export function getEquivalents(): CourseEquivalent[];
export function getRules(programId: ProgramId, year: AdmissionYear): GraduationRule[];   // univ 행 + 전공 행
export function getRequirements(programId: ProgramId, year: AdmissionYear): Requirement[];
export function getFields(): Field[];
export function getCourseFields(): Map<CourseCode, CourseField>;
export function getChecklist(): ChecklistItem[];
export function isValidKey(kind: 'program' | 'course' | 'field' | 'checklist', value: string): boolean;
```
- `data/courses.json`은 3MB 이상이다. **통째로 열거나 출력하지 말고** `jq`/`grep`으로 필요한 과목만 본다.

## A-5. 사용자 데이터 타입 — `src/types/user.ts`
```ts
export type MajorType = 'single' | 'multi';
export type EnrollmentStatus = 'completed' | 'failed' | 'incomplete';
export type EnrollmentSource = 'manual' | 'ocr' | 'url';
export type TakenSemester = 1 | 2 | 3 | 4;          // 3=여름계절, 4=겨울계절

export interface Profile {
  id: string;                        // auth.users.id
  email: string | null;
  program_id: ProgramId;
  admission_year: AdmissionYear;
  major_type: MajorType;             // 기본 single, 화면에서는 숨김
  created_at: string;
  updated_at: string;
}

export interface Enrollment {
  id: string;
  user_id: string;
  course_code: CourseCode;
  taken_year: number;
  taken_semester: TakenSemester;     // 필수
  status: EnrollmentStatus;
  source: EnrollmentSource;
  credit: number | null;             // null이면 courses.credit 사용
  grade: string | null;              // 'A+' 등, 선택
  created_at: string;
}
export type NewEnrollment = Omit<Enrollment, 'id' | 'user_id' | 'created_at'>;

export interface NoncreditStatus {   // 행이 없으면 '미입력(unanswered)'
  user_id: string;
  checklist_key: ChecklistKey;
  status: 'met' | 'unmet';
  input_value: string | null;
  updated_at: string;
}

export interface OcrImportItem {
  id: string;
  user_id: string;
  raw_text: string;
  candidate_codes: CourseCode[];     // 후보(복수 가능)
  matched_course_code: CourseCode | null;   // 사용자가 확정한 코드, null = 미매칭
  review_status: 'pending' | 'confirmed' | 'rejected';
  created_at: string;
}

export interface FollowupStat {
  program_id: ProgramId;
  from_code: CourseCode;
  to_code: CourseCode;
  follower_count: number;
  base_count: number;
}
```
DB 컬럼명은 위 필드명과 **같다**(snake_case). `src/types/database.ts`(#4 생성)와 어긋나면 이 타입이 기준.

## A-6. 도메인 함수 계약 — `src/lib/domain/*` (순수 함수, I/O·Date.now 금지)
```ts
// completion.ts (#6)
export interface CompletionState {
  completed: ReadonlySet<CourseCode>;        // 학점 인정된 이수(대표 코드 기준)
  inProgress: ReadonlySet<CourseCode>;
  failed: ReadonlySet<CourseCode>;           // 이후 non-F 이수가 없는 F만
  creditByCode: Readonly<Record<CourseCode, number>>;
  totalCredits: number;
  isCompleted(code: CourseCode): boolean;    // 동일과목(구·신 코드) 포함 판정
  canonicalOf(code: CourseCode): CourseCode; // 동일과목 쌍의 대표 코드
}
export function resolveCompletion(enrollments: Enrollment[], ref: ReferenceData): CompletionState;

// graduation.ts (#12)
export type ItemStatus = 'met' | 'unmet' | 'unanswered' | 'unknown';  // unknown = 데이터 부족으로 판정 불가
export interface GraduationItem {
  id: string;                                // rule_id·bucket_id·requirement_id·checklist_key 조합
  kind: 'total' | 'bucket' | 'required_courses' | 'requirement' | 'checklist';
  label: string;
  status: ItemStatus;
  required: number | null;
  earned: number | null;
  remaining: number | null;
  matchedCourses: CourseCode[];
  missingCourses: CourseCode[];
  checklistKey: ChecklistKey | null;
  source: string | null;
  note: string | null;
}
export interface GraduationReport {
  programId: ProgramId;
  admissionYear: AdmissionYear;
  ruleIds: string[];
  items: GraduationItem[];
  summary: { met: number; total: number };
  needsConfirmation: string[];
}
export function evaluateGraduation(input: {
  profile: Profile; completion: CompletionState; noncredit: NoncreditStatus[]; ref: ReferenceData;
}): GraduationReport;

// recommend.ts (#13)
export type ReasonType = 'interest' | 'successor' | 'required' | 'followup';
export interface RecommendationReason { type: ReasonType; label: string; fromCode?: CourseCode; value?: number }
export interface Recommendation {
  code: CourseCode;
  score: number;
  reasons: RecommendationReason[];           // 항상 1개 이상
  fromCodes: CourseCode[];                   // 노선도 초록 화살표 출발(이수 과목)
  warning: 'prerequisite_unmet' | null;
}
export interface RecommendWeights {
  interest: number; successor: number; required: number; followup: number;
  prerequisiteUnmetPenalty: number; minFollowupBase: number;   // 기본 3
}
export const DEFAULT_WEIGHTS: RecommendWeights;
export function recommendCourses(input: {
  profile: Profile; interests: FieldId[]; completion: CompletionState;
  followupStats: FollowupStat[]; ref: ReferenceData; weights?: RecommendWeights;
}): Recommendation[];                        // score 내림차순
```
#1은 위 시그니처로 스텁을 만든다(`resolveCompletion`은 빈 상태, `evaluateGraduation`은 빈 items, `recommendCourses`는 `[]` 반환).

## A-7. 저장소·훅·인증 계약 — `src/lib/user-data/*`, `src/features/auth/*`
```ts
export type RepoError = { code: 'invalid_key' | 'not_found' | 'unauthorized' | 'network' | 'unknown'; message: string };
export type Result<T> = { ok: true; data: T } | { ok: false; error: RepoError };

export interface UserDataRepository {
  getProfile(): Promise<Result<Profile | null>>;              // null = 온보딩 필요
  upsertProfile(input: { program_id: ProgramId; admission_year: AdmissionYear; major_type?: MajorType }): Promise<Result<Profile>>;
  listEnrollments(): Promise<Result<Enrollment[]>>;
  addEnrollment(input: NewEnrollment): Promise<Result<Enrollment>>;
  updateEnrollment(id: string, patch: Partial<NewEnrollment>): Promise<Result<Enrollment>>;
  deleteEnrollment(id: string): Promise<Result<void>>;
  getInterests(): Promise<Result<FieldId[]>>;
  setInterests(fieldIds: FieldId[]): Promise<Result<FieldId[]>>;
  getNoncredit(): Promise<Result<NoncreditStatus[]>>;
  setNoncredit(key: ChecklistKey, status: 'met' | 'unmet', inputValue: string | null): Promise<Result<NoncreditStatus>>;
  clearNoncredit(key: ChecklistKey): Promise<Result<void>>;   // 미입력으로 되돌림
  listOcrItems(): Promise<Result<OcrImportItem[]>>;
  saveOcrItems(items: Omit<OcrImportItem, 'id' | 'user_id' | 'created_at'>[]): Promise<Result<OcrImportItem[]>>;
  updateOcrItem(id: string, patch: Partial<Pick<OcrImportItem, 'matched_course_code' | 'review_status'>>): Promise<Result<OcrImportItem>>;
  getFollowupStats(programId: ProgramId): Promise<Result<FollowupStat[]>>;   // base_count < minFollowupBase 제외
}
```
- 모든 쓰기는 저장 전 `isValidKey`로 키를 검사하고, 없으면 `invalid_key`를 반환한다(ERD I-1).
- 구현: `mock-repository.ts`(#1, localStorage + 시연 계정) / `supabase-repository.ts`(#9). 선택은 `index.ts`의 `getRepository()` 한 곳.

훅(`hooks.ts`, `<UserDataProvider>` 안에서만 사용):
```ts
useReference(): ReferenceData
useProfile(): { profile: Profile | null; loading: boolean; error: RepoError | null; save(input): Promise<Result<Profile>> }
useEnrollments(): { items: Enrollment[]; loading: boolean; add(i): Promise<Result<Enrollment>>; update(id, p): Promise<Result<Enrollment>>; remove(id): Promise<Result<void>> }
useInterests(): { fieldIds: FieldId[]; save(ids): Promise<Result<FieldId[]>> }
useNoncredit(): { items: NoncreditStatus[]; set(key, status, value): Promise<Result<NoncreditStatus>>; clear(key): Promise<Result<void>> }
useFollowupStats(): FollowupStat[]
useCompletion(): CompletionState            // enrollments 변경 시 자동 재계산(B05)
useRecommendations(): Recommendation[]      // src/features/recommend (#19). #1은 [] 스텁
useAuth(): { user: { id: string; email: string | null } | null; loading: boolean; signInWithGoogle(): Promise<void>; signOut(): Promise<void> }  // #5, 목 모드는 시연 계정
```
**계산 결과(이수·졸업·추천)는 DB에 저장하지 않는다.** 항상 훅에서 다시 계산한다.

## A-8. 화면·컴포넌트 계약
### 라우트
| 경로 | 화면 | 소유 | 접근 |
|---|---|---|---|
| `/` | 인트로·구글 로그인 | #5 | 비로그인 |
| `/auth/callback` | OAuth 콜백 | #5 | — |
| `/onboarding` | 1 전공·학번 → 2 수강 내역 → 3 관심 분야 | #10 | 로그인 + 프로필 없음 |
| `/roadmap?course=CODE` | 노선도(쿼리 있으면 해당 과목 선택) | #7 | 온보딩 완료 |
| `/graduation` | 졸업요건 | #17 | 온보딩 완료 |
| `/recommend` | 다음 학기 추천 | #19 | 온보딩 완료 |
| `/enrollments`, `/enrollments/import` | 수강 이력 관리, OCR 입력 | #11, #15 | 온보딩 완료 |
| `/account` | 회원정보 변경 | #10 | 온보딩 완료 |

상단 내비(#1): 왼쪽 {노선도, 졸업요건, 다음 학기 추천} / 오른쪽 {회원정보 변경, 로그아웃}.
과목으로 이동하는 링크는 모두 `/roadmap?course=CODE` 형식을 쓴다.

### 컴포넌트 props
```ts
// #7 src/features/roadmap
export interface RoadmapNode { code: CourseCode; col: number; row: number; x: number; y: number; width: number; height: number; fieldId: FieldId }
export function layoutRoadmap(curriculum: CurriculumEntry[], courseFields: Map<CourseCode, CourseField>): { nodes: RoadmapNode[]; lanes: { fieldId: FieldId; row: number }[] };
export function RoadmapView(props: {
  programId: ProgramId; admissionYear: AdmissionYear;
  completion: CompletionState; recommendations: Recommendation[];
  selectedCode: CourseCode | null; onSelect(code: CourseCode | null): void;
  showRecommendationEdges: boolean;        // '추천 화살표 보기' 체크박스
  visibleFields?: FieldId[];               // #20 필터, 없으면 전체
}): JSX.Element;

// #14 src/features/roadmap/edges
export function EdgesLayer(props: {
  nodes: RoadmapNode[]; relations: CourseRelation[]; recommendations: Recommendation[];
  completion: CompletionState; selectedCode: CourseCode | null; showRecommendationEdges: boolean;
}): JSX.Element;                           // #1·#7은 빈 컴포넌트(null 반환)로 둔다

// #16 src/features/course-detail
export function CourseDetailPanel(props: { code: CourseCode | null; onClose(): void; onNavigate(code: CourseCode): void }): JSX.Element | null;

// #20 src/features/roadmap-search
export function RoadmapSearch(props: { onSelect(code: CourseCode): void; visibleFields: FieldId[]; onChangeVisibleFields(ids: FieldId[]): void }): JSX.Element;

// #11 src/features/enrollments
export function EnrollmentEditor(props: { mode: 'onboarding' | 'manage'; programId: ProgramId; admissionYear: AdmissionYear; onDone?(): void }): JSX.Element;
export function searchCourses(query: string, ref: ReferenceData, opts?: { limit?: number }): Course[];   // #15도 사용
```
- `src/app/roadmap/page.tsx`(#7)가 `RoadmapView`·`RoadmapSearch`·`CourseDetailPanel`을 조립한다. #1이 세 컴포넌트를 import하는 골격을 미리 만들고, 각 이슈는 자기 컴포넌트만 구현한다.

## A-9. 도메인 규칙 (ERD I-5 · Requirements D05~D09)
1. 과목 식별은 `course_code`만. 과목명은 검색·OCR **후보 제시**에만 쓰고, 확정은 사용자가 한다.
2. F(`failed`)는 보관하되 미이수. 학점·선수 충족·추천 근거에서 제외.
3. 재수강은 같은 과목의 **최신 non-F 1건만** 학점 인정.
4. 동일과목은 `course_equivalents` 쌍만 같은 과목. 쌍 중 1건만 학점에 1회 반영.
5. 전공 학점은 **해당 전공·학번 교육과정 안의 과목만** 인정(D09). 타 전공 학점 불인정.
6. 대학 기준(`univ__*`)과 전공 기준을 **둘 다** 충족해야 하고, 같은 항목은 더 엄격한 값을 쓴다. 플솝은 `follows_university_credit_rules: false`로 ABEEK 버킷 적용.
7. 단일전공(`single`)이 기본.
8. 비학점 요건은 자동 판정하지 않는다. `met`/`unmet`/**미입력(`unanswered`)** 을 구분한다. 데이터가 부족하면 `unknown`(판정 불가)로 표시하고 근거를 보여준다.
9. `counts_for_graduation: false` 요건은 계산에서 제외(참고용).
10. 관계선: 검정 = 학부 권장(`official` 실선, `recommended` 점선), 초록 = 서비스 추천(이수 과목 → 추천 과목), `coreq`는 화살표 대신 묶음 표시. 서비스 추천은 데이터 파일에 저장하지 않는다.
11. 추천 대상은 모든 후속 후보(다음 학기 개설 여부 미반영, D07). 이수·F 과목 제외, 추천 이유 1개 이상.
12. 함께 수강 집계는 `base_count < 3`이면 숨긴다. 선배 시드 원본은 repo에 커밋하지 않는다.

## A-10. 코드 규칙
- TypeScript strict. `any` 금지(불가피하면 `unknown` + 좁히기). 공개 함수·컴포넌트는 반환 타입 명시.
- 계산 로직은 `src/lib/domain`의 순수 함수에만 둔다. 컴포넌트 안에서 학점·요건을 다시 계산하지 않는다.
- 파일명: 컴포넌트 `PascalCase.tsx`, 그 외 `kebab-case.ts`. named export만(페이지 제외).
- UI 문구는 한국어. 색은 CSS 변수(`--bg`, `--surface`, `--text`, `--muted`, `--line`, `--accent`, `--ok`, `--warn`, `--danger`)와 `fields.json`의 분야 색만 사용, 하드코딩 금지. 라이트/다크는 `prefers-color-scheme`를 따른다.
- 접근성: 버튼은 `<button>`, 아이콘 버튼에 `aria-label`, 키보드로 선택·닫기 가능.
- 테스트: 도메인 함수는 Vitest 단위 테스트 필수(정상·경계·동일과목·F·재수강). 테스트 데이터는 `src/test/fixtures`.
- 새 의존성은 이슈 목적에 꼭 필요할 때만 추가하고 PR에 이유를 적는다.

## A-11. Git·PR 규칙 (이슈 본문의 브랜치 규칙보다 이 절이 우선)
- **브랜치 이름: `feat/issue#N`** (N = 이슈 번호, 예: `feat/issue#6`). 이슈 하나에 브랜치 하나.
  - 만들기: `git switch main && git pull && git switch -c "feat/issue#6"`
  - `#` 때문에 셸(zsh 등)에서 오류가 날 수 있으니 브랜치 이름은 **항상 따옴표로 감싼다**.
- main 직접 커밋·force push 금지. 선행 이슈가 머지되면 `git rebase main`으로 최신화한다.
- 커밋 메시지: `feat(#6): 동일과목 처리 추가` 형식(`feat`·`fix`·`test`·`docs`·`chore`·`contract`). 커밋은 여러 개여도 된다(Squash로 하나로 합쳐짐).
- **PR 제목**: `[#N] 이슈 제목` (예: `[#6] 이수 판정 로직`)
- **PR 본문(description)에 작업 설명을 반드시 적는다.** 아래 형식을 그대로 쓴다.

```markdown
Closes #N

## 작업 내용
<!-- 이 PR이 무엇을 했는지 2~4문장. 리뷰어가 이슈를 다시 열지 않아도 이해할 수 있게 -->

## 변경 사항
<!-- 파일(또는 폴더)별로 무엇을 만들고 바꿨는지 -->
- `src/lib/domain/completion.ts`: …
- `src/lib/domain/completion.test.ts`: …

## 구현 방식과 주요 결정
<!-- 어떤 방식으로 구현했는지, 고민한 선택지와 고른 이유, AGENTS.md 계약 중 사용한 부분 -->

## 인수 조건 체크
- [x] (이슈의 인수 조건을 그대로 옮기고 충족 여부 표시)

## 테스트
<!-- 실행한 명령과 결과, 직접 확인한 방법 -->
- `npm run lint` / `npm run typecheck` / `npm test`: 통과
- 목 모드에서 확인한 화면·시나리오:

## 스크린샷 (화면 변경 시)

## 범위 밖 요청 · 계약 변경 요청
<!-- 없으면 '없음' -->

## 남은 일 · 확인 필요
<!-- 후속 이슈로 넘길 것, 팀 결정이 필요한 것. 없으면 '없음' -->
```

- 머지 조건: CI(lint·typecheck·test·build·validate-data) 통과. 코드 리뷰와 리뷰 승인은 선택 사항이다. 이 조건은 이슈 본문에 남아 있는 리뷰 승인 규칙보다 우선한다.
- **머지 방식: Squash and merge만 사용**한다(Merge commit·Rebase merge 사용 안 함). Squash 커밋 메시지는 PR 제목 `[#N] 이슈 제목`을 그대로 쓰고, 머지 후 브랜치는 삭제한다.
- 이 PR 본문 형식은 `.github/pull_request_template.md`(#1)에도 그대로 넣는다.

## A-12. 완료 전 체크리스트
- [ ] 이슈의 인수 조건을 모두 충족했다
- [ ] 소유 범위 밖 파일을 고치지 않았다(`git diff --name-only main`으로 확인)
- [ ] `npm run lint && npm run typecheck && npm test` 통과
- [ ] 계약(A-3~A-8)을 바꾸지 않았다. 바꿔야 하면 PR에 '계약 변경 요청'으로 적었다
- [ ] 목 모드(`NEXT_PUBLIC_USE_MOCK=1`)에서 화면이 동작한다
- [ ] 브랜치 이름이 `feat/issue#N`이다
- [ ] PR 본문에 A-11 형식의 작업 설명(작업 내용·변경 사항·구현 방식·테스트·범위 밖 요청·남은 일)을 모두 적었다

## A-13. Codex 전용 작업 방식 (Claude Code는 CLAUDE.md를 따른다)
- 작업 요청에는 이슈 번호와 본문을 함께 넣는다. 예: "이슈 #6을 AGENTS.md 계약대로 구현해줘" + 이슈 본문.
- 샌드박스에서 네트워크·Supabase를 쓸 수 없으면 **목 모드로만** 개발·테스트한다. 실제 DB 연결을 검증하지 못한 경우 PR 본문에 기록한다.
- 작업을 끝내기 전에 A-0의 lint·typecheck·test를 직접 실행하고 결과를 요약에 붙인다.
- 브랜치는 `"feat/issue#N"`으로 만든다(A-11).
- 작업이 끝나면 **A-11의 PR 본문 형식을 그대로 채운 PR description**을 결과로 출력한다. Codex가 PR을 직접 만들 때도 이 본문을 쓴다. 제목은 `[#N] 이슈 제목`.
- Codex는 PR을 열고 필수 CI가 통과하면 GitHub에서 **Squash and merge**를 진행한다. 리뷰 승인 대기 없이 병합하고 GitHub에서 결과를 확인한다.
