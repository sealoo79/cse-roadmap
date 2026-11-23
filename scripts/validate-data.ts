/**
 * 기준 데이터(data/*.json) 정합성 검증 — 이슈 #8, ERD II-4
 *
 * 실행: npm run validate-data            (data/ 검사)
 *       node scripts/validate-data.ts <폴더>  (다른 폴더 검사)
 *
 * 외부 패키지 없이 Node 24의 TypeScript 타입 제거 실행으로 돈다.
 * 실패 항목이 하나라도 있으면 종료 코드 1로 끝나 CI를 실패시킨다.
 */
import { readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import type {
  ChecklistItem,
  ChecklistKey,
  Course,
  CourseEquivalent,
  CourseField,
  CourseRelation,
  CurriculumBucketId,
  CurriculumEntry,
  Field,
  FieldId,
  GraduationRule,
  Program,
  ProgramId,
  Requirement,
  RuleBucketId,
} from '../src/types/reference';

// ---------------------------------------------------------------- 고정 키 (AGENTS.md A-3, src/types/reference.ts와 같아야 함)
const PROGRAM_IDS: readonly ProgramId[] = ['platform_sw_data', 'global_sw', 'ai_computing', 'adv_computing', 'adv_research'];
const FIELD_IDS: readonly FieldId[] = ['common', 'system', 'ai_data', 'network_security', 'sw_web'];
const CURRICULUM_BUCKETS: readonly CurriculumBucketId[] = [
  'basic_literacy', 'major_base', 'engineering_major', 'major', 'liberal', 'general_elective', 'teaching',
];
const RULE_BUCKETS: readonly RuleBucketId[] = [...CURRICULUM_BUCKETS, 'design', 'graduate_courses', 'abeek_total'];
const CHECKLIST_KEYS: readonly ChecklistKey[] = [
  'english_score', 'field_practice', 'research_practice', 'research_activity', 'graduation_review', 'topcit',
  'portfolio', 'gq_practical_english', 'gq_software', 'gq_counseling', 'gq_major_area',
];
/** 최소학점 없이 총 졸업학점에만 반영하는 교과 구분(#2 결정, #12에서 같은 규칙 사용) */
const TOTAL_ONLY_BUCKETS: readonly CurriculumBucketId[] = ['general_elective', 'teaching'];
const COURSE_CODE = /^[A-Z]{4}\d{4}$/;
const RULE_ID = /^(univ|platform_sw_data|global_sw|ai_computing|adv_computing|adv_research)__\d{4}(_\d{4})?$/;

// ---------------------------------------------------------------- 출력
let passed = 0;
let failed = 0;
const MAX_DETAIL = 10;

function section(title: string): void {
  console.log(`\n${title}`);
}

/** problems가 비어 있으면 통과. 있으면 앞의 몇 개를 보여주고 실패로 센다. */
function check(name: string, problems: string[]): void {
  if (problems.length === 0) {
    passed += 1;
    console.log(`  ✅ ${name}`);
    return;
  }
  failed += 1;
  console.log(`  ❌ ${name} — ${problems.length}건`);
  for (const p of problems.slice(0, MAX_DETAIL)) console.log(`     · ${p}`);
  if (problems.length > MAX_DETAIL) console.log(`     · … 외 ${problems.length - MAX_DETAIL}건`);
}

function info(message: string): void {
  console.log(`  ℹ️  ${message}`);
}

function duplicates(values: readonly string[]): string[] {
  const seen = new Set<string>();
  const dup = new Set<string>();
  for (const v of values) (seen.has(v) ? dup : seen).add(v);
  return [...dup];
}

function sameSet(a: Iterable<string>, b: Iterable<string>): boolean {
  const sa = new Set(a);
  const sb = new Set(b);
  return sa.size === sb.size && [...sa].every((x) => sb.has(x));
}

// ---------------------------------------------------------------- 데이터 읽기
const dataDir = resolve(process.argv[2] ?? 'data');

function load<T>(name: string): T[] {
  const path = join(dataDir, `${name}.json`);
  try {
    const parsed: unknown = JSON.parse(readFileSync(path, 'utf8'));
    if (!Array.isArray(parsed)) throw new Error('최상위가 배열이 아님');
    return parsed as T[];
  } catch (error) {
    console.error(`❌ ${path} 를 읽을 수 없습니다: ${(error as Error).message}`);
    process.exit(1);
  }
}

const programs = load<Program>('programs');
const courses = load<Course>('courses');
const curriculum = load<CurriculumEntry>('curriculum');
const relations = load<CourseRelation>('course_relations');
const equivalents = load<CourseEquivalent>('course_equivalents');
const rules = load<GraduationRule>('graduation_rules');
const requirements = load<Requirement>('requirement_courses');
const fields = load<Field>('fields');
const courseFields = load<CourseField>('course_fields');
const checklist = load<ChecklistItem>('checklist');

console.log(`기준 데이터 검증: ${dataDir}`);

// ---------------------------------------------------------------- 1. 과목코드 형식·중복
section('1. 과목코드 형식·중복');
const courseCodes = courses.map((c) => c.course_code);
const courseSet = new Set(courseCodes);
check('courses.json course_code 형식 ^[A-Z]{4}\\d{4}$', courseCodes.filter((c) => !COURSE_CODE.test(c)));
check('courses.json course_code 중복 없음', duplicates(courseCodes));
check('course_fields.json course_code 중복 없음', duplicates(courseFields.map((c) => c.course_code)));
check(
  'curriculum.json (입학년도, 전공, 과목) 중복 없음',
  duplicates(curriculum.map((r) => `${r.admission_year}/${r.program_id}/${r.course_code}`)),
);

// ---------------------------------------------------------------- 2. 과목코드 참조
section('2. 모든 과목코드가 courses.json에 존재');
const missing = (refs: Iterable<[string, string]>): string[] =>
  [...refs].filter(([code]) => !courseSet.has(code)).map(([code, where]) => `${code} (${where})`);
check('curriculum.json', missing(curriculum.map((r) => [r.course_code, `${r.program_id} ${r.admission_year}`])));
check(
  'course_relations.json',
  missing(relations.flatMap((r) => [[r.from_code, `id ${r.id} from`], [r.to_code, `id ${r.id} to`]] as [string, string][])),
);
check(
  'course_equivalents.json',
  missing(
    equivalents.flatMap(
      (e) => [[e.old_code, `id ${e.equivalent_id} old`], [e.new_code, `id ${e.equivalent_id} new`]] as [string, string][],
    ),
  ),
);
check('graduation_rules.json required_courses', missing(rules.flatMap((r) => r.required_courses.map((c) => [c, r.rule_id] as [string, string]))));
check(
  'requirement_courses.json courses',
  missing(requirements.flatMap((q) => q.courses.map((c) => [c, q.requirement_id] as [string, string]))),
);
check('course_fields.json', missing(courseFields.map((c) => [c.course_code, 'course_fields'] as [string, string])));

// ---------------------------------------------------------------- 3. 고정 키
section('3. 고정 키 (AGENTS.md A-3)');
check(
  'programs.json program_id 5개',
  sameSet(programs.map((p) => p.program_id), PROGRAM_IDS) ? [] : [programs.map((p) => p.program_id).join(', ')],
);
check('fields.json field_id 5개', sameSet(fields.map((f) => f.field_id), FIELD_IDS) ? [] : [fields.map((f) => f.field_id).join(', ')]);
check(
  'checklist.json checklist_key 11개',
  sameSet(checklist.map((c) => c.checklist_key), CHECKLIST_KEYS) ? [] : [checklist.map((c) => c.checklist_key).join(', ')],
);
check(
  'curriculum.json credit_bucket 값',
  curriculum.filter((r) => !CURRICULUM_BUCKETS.includes(r.credit_bucket)).map((r) => `${r.course_code}: ${r.credit_bucket}`),
);
check(
  'curriculum.json program_id 값',
  curriculum.filter((r) => !PROGRAM_IDS.includes(r.program_id)).map((r) => `${r.course_code}: ${r.program_id}`),
);
check('graduation_rules.json rule_id 형식·중복', [
  ...rules.filter((r) => !RULE_ID.test(r.rule_id)).map((r) => `형식: ${r.rule_id}`),
  ...duplicates(rules.map((r) => r.rule_id)).map((id) => `중복: ${id}`),
]);
check(
  'graduation_rules.json credit_buckets.bucket_id 값',
  rules.flatMap((r) => r.credit_buckets.filter((b) => !RULE_BUCKETS.includes(b.bucket_id)).map((b) => `${r.rule_id}: ${b.bucket_id}`)),
);
check('course_fields.json 분야 키', courseFields.flatMap((c) => {
  const bad: string[] = [];
  if (!FIELD_IDS.includes(c.primary_field_id)) bad.push(`${c.course_code}: primary ${c.primary_field_id}`);
  if (c.field_ids[0] !== c.primary_field_id) bad.push(`${c.course_code}: field_ids[0]이 primary가 아님`);
  for (const f of c.field_ids) if (!FIELD_IDS.includes(f)) bad.push(`${c.course_code}: ${f}`);
  if (duplicates(c.field_ids).length > 0) bad.push(`${c.course_code}: field_ids 중복`);
  return bad;
}));

// ---------------------------------------------------------------- 4. 학번 범위 규칙
section('4. 졸업요건 규칙 적용 범위');
const programYears = programs.flatMap((p) => p.years.map((y) => ({ program: p.program_id, year: y.admission_year, status: y.curriculum_status })));
check('전공·학번마다 univ 규칙 1개 + 전공 규칙 1개', programYears.flatMap(({ program, year }) => {
  const hit = (pid: string) => rules.filter((r) => r.program_id === pid && r.admission_year_from <= year && year <= r.admission_year_to).length;
  const u = hit('univ');
  const m = hit(program);
  return u === 1 && m === 1 ? [] : [`${program} ${year}: univ ${u}개, 전공 ${m}개`];
}));
const curriculumYears = new Set(curriculum.map((r) => `${r.program_id}/${r.admission_year}`));
check('programs.json years와 curriculum.json 연도 일치', programYears.flatMap(({ program, year, status }) => {
  const has = curriculumYears.has(`${program}/${year}`);
  if (status === 'available' && !has) return [`${program} ${year}: available인데 curriculum 없음`];
  if (status === 'missing' && has) return [`${program} ${year}: missing인데 curriculum 있음`];
  return [];
}));

// ---------------------------------------------------------------- 5. 전공필수 일치
section('5. curriculum.is_required ↔ graduation_rules.required_courses');
check('전공·학번별 전공필수 목록 일치', programYears.flatMap(({ program, year }) => {
  const rows = curriculum.filter((r) => r.program_id === program && r.admission_year === year);
  if (rows.length === 0) return [];
  const rule = rules.find((r) => r.program_id === program && r.admission_year_from <= year && year <= r.admission_year_to);
  if (!rule) return [];
  const fromCurriculum = new Set(rows.filter((r) => r.is_required).map((r) => r.course_code));
  const fromRule = new Set(rule.required_courses);
  const onlyCur = [...fromCurriculum].filter((c) => !fromRule.has(c));
  const onlyRule = [...fromRule].filter((c) => !fromCurriculum.has(c));
  return onlyCur.length + onlyRule.length === 0
    ? []
    : [`${program} ${year} (${rule.rule_id}): curriculum에만 [${onlyCur.join(', ')}] / 규칙에만 [${onlyRule.join(', ')}]`];
}));

// ---------------------------------------------------------------- 6. 분야
section('6. 과목 분야');
const fieldCovered = new Set(courseFields.map((c) => c.course_code));
const majorCodes = [...new Set(curriculum.filter((r) => r.credit_bucket !== 'liberal').map((r) => r.course_code))];
check(
  `curriculum 전공 과목 ${majorCodes.length}개 전부 primary_field_id 존재`,
  majorCodes.filter((c) => !fieldCovered.has(c)),
);
const allCurriculumCodes = [...new Set(curriculum.map((r) => r.course_code))];
const liberalMissing = allCurriculumCodes.filter((c) => !fieldCovered.has(c));
if (liberalMissing.length > 0) info(`분야가 없는 교양 과목 ${liberalMissing.length}개(노선도 공통 기초 행에 둠): ${liberalMissing.join(', ')}`);

// ---------------------------------------------------------------- 7. 교과 구분 ↔ 규칙 버킷
section('7. curriculum.credit_bucket이 졸업요건 credit_buckets에 존재');
const totalOnly: string[] = [];
check('전공·학번별 credit_bucket ↔ 규칙(전공 + univ) bucket_id', (() => {
  const problems: string[] = [];
  const seen = new Set<string>();
  for (const r of curriculum) {
    const key = `${r.program_id}/${r.admission_year}/${r.credit_bucket}`;
    if (seen.has(key)) continue;
    seen.add(key);
    const applicable = rules.filter(
      (g) => (g.program_id === 'univ' || g.program_id === r.program_id) && g.admission_year_from <= r.admission_year && r.admission_year <= g.admission_year_to,
    );
    const buckets = new Set<string>(applicable.flatMap((g) => g.credit_buckets.map((b) => b.bucket_id)));
    if (buckets.has(r.credit_bucket)) continue;
    if (TOTAL_ONLY_BUCKETS.includes(r.credit_bucket)) {
      totalOnly.push(`${r.program_id} ${r.admission_year} ${r.credit_bucket}`);
      continue;
    }
    problems.push(`${r.program_id} ${r.admission_year}: ${r.credit_bucket} 버킷이 규칙에 없음`);
  }
  return problems;
})());
if (totalOnly.length > 0) info(`최소학점 없이 총 학점에만 반영(${TOTAL_ONLY_BUCKETS.join('·')}): ${totalOnly.length}건`);

// ---------------------------------------------------------------- 8. 체크리스트 참조
section('8. checklist_key 참조');
const checklistByKey = new Map(checklist.map((c) => [c.checklist_key, c]));
check('graduation_rules.checklist[].key 전부 checklist.json에 존재', rules.flatMap((r) =>
  r.checklist.filter((c) => !checklistByKey.has(c.key)).map((c) => `${r.rule_id}: ${c.key}`)));
check('graduation_rules.checklist[].input_type이 checklist.json과 같음', rules.flatMap((r) =>
  r.checklist
    .filter((c) => checklistByKey.has(c.key) && checklistByKey.get(c.key)?.input_type !== c.input_type)
    .map((c) => `${r.rule_id}: ${c.key} ${c.input_type} ≠ ${checklistByKey.get(c.key)?.input_type}`)));
check('requirement_courses.checklist_key 전부 checklist.json에 존재', requirements
  .filter((q) => q.checklist_key !== null && !checklistByKey.has(q.checklist_key))
  .map((q) => `${q.requirement_id}: ${q.checklist_key}`));

// ---------------------------------------------------------------- 9. 동일과목 ↔ 선후수
section('9. course_equivalents ↔ course_relations 모순 없음');
// 동일과목끼리 묶은 대표 코드(union-find)
const parent = new Map<string, string>();
const find = (x: string): string => {
  let root = x;
  while (parent.has(root) && parent.get(root) !== root) root = parent.get(root) as string;
  return root;
};
for (const e of equivalents) parent.set(find(e.old_code), find(e.new_code));

check('동일과목 쌍의 구·신 코드가 다름', equivalents.filter((e) => e.old_code === e.new_code).map((e) => `id ${e.equivalent_id}: ${e.old_code}`));
check('동일과목끼리 선후수·동시수강 관계 없음', relations
  .filter((r) => find(r.from_code) === find(r.to_code))
  .map((r) => `id ${r.id}: ${r.from_code} → ${r.to_code} (같은 과목으로 묶임)`));
check('선후수 관계에 순환 없음(동일과목을 하나로 보고 전공별로 확인)', (() => {
  const problems: string[] = [];
  const scopes = new Set<string | null>(relations.map((r) => r.program_id));
  for (const scope of scopes) {
    const edges = relations.filter((r) => r.type !== 'coreq' && (r.program_id === scope || r.program_id === null));
    const graph = new Map<string, string[]>();
    for (const r of edges) {
      const a = find(r.from_code);
      const b = find(r.to_code);
      graph.set(a, [...(graph.get(a) ?? []), b]);
    }
    const state = new Map<string, 1 | 2>(); // 1 방문 중, 2 완료
    const visit = (node: string, path: string[]): void => {
      if (state.get(node) === 2) return;
      if (state.get(node) === 1) {
        problems.push(`${scope ?? '공통'}: ${[...path.slice(path.indexOf(node)), node].join(' → ')}`);
        return;
      }
      state.set(node, 1);
      for (const next of graph.get(node) ?? []) visit(next, [...path, node]);
      state.set(node, 2);
    };
    for (const node of graph.keys()) visit(node, []);
  }
  return [...new Set(problems)];
})());

// ---------------------------------------------------------------- 결과
console.log(`\n통과 ${passed} / 실패 ${failed}`);
if (failed > 0) {
  console.log('실패 항목은 data/를 직접 고치지 말고 해당 데이터 이슈(#2·#3) 담당에게 수정을 요청하세요.');
  process.exit(1);
}
