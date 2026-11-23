import type {
  AdmissionYear, ChecklistKey, CourseCode, CurriculumBucketId, GraduationRule, ProgramId, ReferenceData, Requirement, RuleBucketId,
} from '@/types/reference';
import type { NoncreditStatus, Profile } from '@/types/user';
import type { CompletionState } from './completion';

export type ItemStatus = 'met' | 'unmet' | 'unanswered' | 'unknown';
export interface GraduationItem {
  id: string; kind: 'total' | 'bucket' | 'required_courses' | 'requirement' | 'checklist'; label: string;
  status: ItemStatus; required: number | null; earned: number | null; remaining: number | null;
  matchedCourses: CourseCode[]; missingCourses: CourseCode[]; checklistKey: ChecklistKey | null;
  source: string | null; note: string | null;
}
export interface GraduationReport {
  programId: ProgramId; admissionYear: AdmissionYear; ruleIds: string[]; items: GraduationItem[];
  summary: { met: number; total: number }; needsConfirmation: string[];
}

/** 교육과정 표가 있어야 계산할 수 있는 버킷(D09: 전공 학점은 해당 교육과정 안의 과목만 인정) */
const CURRICULUM_BUCKETS: readonly CurriculumBucketId[] = [
  'basic_literacy', 'major_base', 'engineering_major', 'major', 'general_elective', 'teaching',
];
/** ABEEK 총계는 기본소양 + 전공기반 + 공학전공 */
const ABEEK_TOTAL_PARTS: readonly CurriculumBucketId[] = ['basic_literacy', 'major_base', 'engineering_major'];

/**
 * requirement_courses 중 졸업요건 규칙의 항목과 같은 요건을 담은 것.
 * 규칙에 같은 버킷이 있으면 규칙 항목만 보여 주고 requirement 항목은 만들지 않는다(중복 계산 방지).
 */
const REQUIREMENT_BUCKET: ReadonlyArray<[prefix: string, bucket: RuleBucketId]> = [
  ['liberal_total', 'liberal'],
  ['major__', 'major'],
  ['abeek_basic_literacy__', 'basic_literacy'],
  ['abeek_major_base__', 'major_base'],
  ['abeek_design__', 'design'],
  ['graduate_courses__', 'graduate_courses'],
];

interface BucketSpec {
  bucketId: RuleBucketId;
  label: string;
  required: number;
  sources: string[];
}

function sorted(codes: Iterable<CourseCode>): CourseCode[] {
  return [...new Set(codes)].sort();
}

function joinSources(sources: Array<string | null | undefined>): string | null {
  const unique = [...new Set(sources.filter((s): s is string => Boolean(s)))];
  return unique.length > 0 ? unique.join(' / ') : null;
}

function creditStatus(required: number, earned: number): Pick<GraduationItem, 'status' | 'remaining'> {
  return { status: earned >= required ? 'met' : 'unmet', remaining: Math.max(0, required - earned) };
}

function emptyItem(partial: Pick<GraduationItem, 'id' | 'kind' | 'label' | 'status'> & Partial<GraduationItem>): GraduationItem {
  return {
    required: null, earned: null, remaining: null, matchedCourses: [], missingCourses: [],
    checklistKey: null, source: null, note: null, ...partial,
  };
}

/** 대학 기준과 전공 기준의 버킷을 합친다. 같은 버킷은 더 엄격한(큰) 최소학점을 쓴다. */
function mergeBuckets(universityRule: GraduationRule | undefined, programRule: GraduationRule): BucketSpec[] {
  const merged = new Map<RuleBucketId, BucketSpec>();
  const add = (rule: GraduationRule): void => {
    for (const bucket of rule.credit_buckets) {
      const current = merged.get(bucket.bucket_id);
      if (!current) {
        merged.set(bucket.bucket_id, { bucketId: bucket.bucket_id, label: bucket.label, required: bucket.min_credits, sources: [rule.source] });
      } else {
        current.required = Math.max(current.required, bucket.min_credits);
        current.sources.push(rule.source);
      }
    }
  };
  // 플솝(ABEEK)은 대학 공통 학점 기준 대신 ABEEK 버킷만 적용한다. 졸업자격인정제(checklist)는 그대로 적용.
  if (universityRule && programRule.follows_university_credit_rules) add(universityRule);
  add(programRule);
  return [...merged.values()];
}

export function evaluateGraduation(input: {
  profile: Profile; completion: CompletionState; noncredit: NoncreditStatus[]; ref: ReferenceData;
}): GraduationReport {
  const { profile, completion, noncredit, ref } = input;
  const programId = profile.program_id;
  const year = profile.admission_year;
  const inRange = (rule: GraduationRule): boolean => rule.admission_year_from <= year && year <= rule.admission_year_to;
  const universityRule = ref.rules.find((r) => r.program_id === 'univ' && inRange(r));
  const programRule = ref.rules.find((r) => r.program_id === programId && inRange(r));
  const ruleIds = [universityRule, programRule].filter((r): r is GraduationRule => r !== undefined).map((r) => r.rule_id);
  const needsConfirmation = new Set<string>();
  for (const rule of [universityRule, programRule]) for (const n of rule?.needs_confirmation ?? []) needsConfirmation.add(n);

  const items: GraduationItem[] = [];
  const finish = (): GraduationReport => ({
    programId, admissionYear: year, ruleIds, items,
    summary: { met: items.filter((i) => i.status === 'met').length, total: items.length },
    needsConfirmation: [...needsConfirmation],
  });

  if (!programRule) {
    items.push(emptyItem({
      id: `total:${programId}__${year}`, kind: 'total', label: '총 졸업학점', status: 'unknown',
      earned: completion.totalCredits, note: '이 전공·학번의 졸업요건 자료가 없습니다.',
    }));
    needsConfirmation.add(`${programId} ${year}학번 졸업요건 자료 없음`);
    return finish();
  }

  // ---------------------------------------------------------------- 이수 과목 → 버킷
  const curriculum = ref.curriculum.filter((c) => c.program_id === programId && c.admission_year === year);
  const hasCurriculum = curriculum.length > 0;
  const bucketByCanonical = new Map<CourseCode, CurriculumBucketId>();
  for (const row of curriculum) bucketByCanonical.set(completion.canonicalOf(row.course_code), row.credit_bucket);

  const earnedByBucket = new Map<CurriculumBucketId, number>();
  const coursesByBucket = new Map<CurriculumBucketId, CourseCode[]>();
  for (const code of completion.completed) {
    const credit = completion.creditByCode[code] ?? 0;
    let bucket = bucketByCanonical.get(code);
    // 교육과정 표에 없는 교양 과목은 교양 학점으로 인정한다. 그 밖의 과목은 총 학점에만 반영(D09).
    if (!bucket && ref.courses.get(code)?.kind === 'liberal') bucket = 'liberal';
    if (!bucket) continue;
    earnedByBucket.set(bucket, (earnedByBucket.get(bucket) ?? 0) + credit);
    coursesByBucket.set(bucket, [...(coursesByBucket.get(bucket) ?? []), code]);
  }

  // ---------------------------------------------------------------- 1. 총 졸업학점
  const totalRequired = programRule.total_credits;
  items.push(emptyItem({
    id: `total:${programRule.rule_id}`, kind: 'total', label: '총 졸업학점',
    status: totalRequired === null ? 'unknown' : creditStatus(totalRequired, completion.totalCredits).status,
    required: totalRequired, earned: completion.totalCredits,
    remaining: totalRequired === null ? null : Math.max(0, totalRequired - completion.totalCredits),
    source: programRule.source,
    note: totalRequired === null ? '총 졸업학점 기준이 자료에 없습니다.' : null,
  }));

  // ---------------------------------------------------------------- 2. 학점 버킷
  const buckets = mergeBuckets(universityRule, programRule);
  const activeBuckets = new Set(buckets.map((b) => b.bucketId));
  for (const bucket of buckets) {
    const id = `bucket:${bucket.bucketId}`;
    const base = { id, kind: 'bucket' as const, label: bucket.label, required: bucket.required, source: joinSources(bucket.sources) };

    if (bucket.bucketId === 'design') {
      // 설계학점은 과목마다 따로 정해진다. 자료가 하나도 없거나, 이수한 설계 과목 중 값이 빠진 과목이 있으면 판정 불가.
      const hasAnyDesignCredit = [...ref.courses.values()].some((c) => c.design_credit !== null);
      const missingDesignCredit = [...completion.completed].some((c) => ref.courses.get(c)?.design_related && ref.courses.get(c)?.design_credit === null);
      const designCourses = sorted([...completion.completed].filter((c) => (ref.courses.get(c)?.design_credit ?? null) !== null));
      if (!hasAnyDesignCredit || missingDesignCredit) {
        items.push(emptyItem({ ...base, status: 'unknown', note: '과목별 설계학점(courses.design_credit) 자료가 없어 판정할 수 없습니다.' }));
        needsConfirmation.add('과목별 설계학점(courses.design_credit) 자료 필요');
        continue;
      }
      const earned = designCourses.reduce((sum, c) => sum + (ref.courses.get(c)?.design_credit ?? 0), 0);
      items.push(emptyItem({ ...base, ...creditStatus(bucket.required, earned), earned, matchedCourses: designCourses }));
      continue;
    }

    if (bucket.bucketId === 'graduate_courses') {
      items.push(emptyItem({ ...base, status: 'unknown', note: '인정되는 대학원 교과목 목록이 자료에 없어 판정할 수 없습니다.' }));
      continue;
    }

    const parts: readonly CurriculumBucketId[] = bucket.bucketId === 'abeek_total' ? ABEEK_TOTAL_PARTS : [bucket.bucketId];
    const needsCurriculum = parts.some((p) => CURRICULUM_BUCKETS.includes(p));
    if (needsCurriculum && !hasCurriculum) {
      items.push(emptyItem({ ...base, status: 'unknown', note: '이 학번의 교육과정 자료가 없어 전공 학점을 계산할 수 없습니다(D09).' }));
      continue;
    }
    const earned = parts.reduce((sum, p) => sum + (earnedByBucket.get(p) ?? 0), 0);
    const matched = sorted(parts.flatMap((p) => coursesByBucket.get(p) ?? []));
    items.push(emptyItem({ ...base, ...creditStatus(bucket.required, earned), earned, matchedCourses: matched }));
  }

  // ---------------------------------------------------------------- 3. 전공필수
  const requiredCodes = programRule.required_courses;
  if (requiredCodes.length > 0) {
    const matched = requiredCodes.filter((c) => completion.isCompleted(c));
    const missing = requiredCodes.filter((c) => !completion.isCompleted(c));
    const equivalentCodes = new Set(ref.equivalents.flatMap((e) => [e.old_code, e.new_code]));
    const viaEquivalent = requiredCodes.some((c) => equivalentCodes.has(c));
    items.push(emptyItem({
      id: `required_courses:${programRule.rule_id}`, kind: 'required_courses', label: '전공필수',
      status: missing.length === 0 ? 'met' : 'unmet',
      required: requiredCodes.length, earned: matched.length, remaining: missing.length,
      matchedCourses: matched, missingCourses: missing, source: programRule.source,
      note: viaEquivalent ? '동일과목(구·신 코드) 이수도 인정합니다. 구과목의 전공필수 인정 여부는 학과 확인 필요(counts_for_required).' : null,
    }));
  } else if (!hasCurriculum) {
    items.push(emptyItem({
      id: `required_courses:${programRule.rule_id}`, kind: 'required_courses', label: '전공필수', status: 'unknown',
      source: programRule.source, note: '이 학번의 교육과정 자료가 없어 전공필수 목록을 알 수 없습니다.',
    }));
  }

  // ---------------------------------------------------------------- 4. 과목 목록 요건 (requirement_courses)
  const noncreditByKey = new Map(noncredit.map((n) => [n.checklist_key, n]));
  const coveredChecklistKeys = new Set<ChecklistKey>();
  const requirements = ref.requirements.filter((r) =>
    r.counts_for_graduation
    && (r.program_ids === null || r.program_ids.includes(programId))
    && r.admission_years.includes(year));

  const universityBuckets = new Set(universityRule?.credit_buckets.map((b) => b.bucket_id) ?? []);
  const duplicatesRule = (r: Requirement): boolean => {
    if (r.group === '전공필수') return true;
    const hit = REQUIREMENT_BUCKET.find(([prefix]) => r.requirement_id.startsWith(prefix));
    if (hit === undefined) return false;
    // 규칙에 같은 버킷이 있거나, ABEEK처럼 대학 공통 학점 기준을 따르지 않아 일부러 뺀 대학 버킷이면 건너뛴다.
    return activeBuckets.has(hit[1]) || (!programRule.follows_university_credit_rules && universityBuckets.has(hit[1]));
  };

  const ruleChecklistKeys = new Set([universityRule, programRule].flatMap((r) => r?.checklist.map((c) => c.key) ?? []));
  for (const requirement of requirements) {
    if (duplicatesRule(requirement)) continue;
    // 비학점 키가 붙은 요건인데 이 학생의 규칙에 그 키가 없으면, 규칙이 다른 키로 같은 요건을 다룬다
    // (예: 심화컴퓨팅은 현장실습 대신 research_practice). 입력할 수 없는 항목을 만들지 않는다.
    if (requirement.checklist_key && !ruleChecklistKeys.has(requirement.checklist_key)) continue;
    const base = {
      id: `requirement:${requirement.requirement_id}`, kind: 'requirement' as const, label: requirement.name,
      required: requirement.min_credits, checklistKey: requirement.checklist_key, source: requirement.source,
    };
    if (requirement.checklist_key) coveredChecklistKeys.add(requirement.checklist_key);

    const listed = new Set(requirement.courses.map((c) => completion.canonicalOf(c)));
    const matched = sorted([...completion.completed].filter((c) => listed.has(c)));
    const earned = matched.reduce((sum, c) => sum + (completion.creditByCode[c] ?? 0), 0);
    const notes = [requirement.min_credits_detail, requirement.note].filter((n): n is string => Boolean(n));

    if (requirement.courses.length === 0 || requirement.min_credits === null) {
      items.push(emptyItem({ ...base, status: 'unknown', earned, matchedCourses: matched, note: joinSources(['인정 과목 또는 기준 학점이 자료에 없어 판정할 수 없습니다.', ...notes]) }));
      continue;
    }

    const byCourses = creditStatus(requirement.min_credits, earned);
    let status: ItemStatus = byCourses.status;
    let note = joinSources(notes);
    if (status === 'unmet' && requirement.checklist_key) {
      // 과목 외 경로(어학성적·교육 이수 등)로도 충족할 수 있는 요건: 학생 입력으로 판정한다.
      const answer = noncreditByKey.get(requirement.checklist_key);
      if (answer?.status === 'met') {
        status = 'met';
        note = joinSources(['과목 외 방법으로 충족했다고 입력함', note]);
      } else if (!answer && requirement.input_required) {
        status = 'unanswered';
      }
    }
    items.push(emptyItem({
      ...base, status, earned, remaining: status === 'met' ? 0 : byCourses.remaining,
      matchedCourses: matched, note,
    }));
  }

  // ---------------------------------------------------------------- 5. 비학점 요건 (자동 판정하지 않음)
  const checklistRules = new Map<ChecklistKey, { rules: string[]; sources: string[] }>();
  for (const rule of [universityRule, programRule]) {
    for (const c of rule?.checklist ?? []) {
      if (coveredChecklistKeys.has(c.key)) continue;
      const entry = checklistRules.get(c.key) ?? { rules: [], sources: [] };
      entry.rules.push(c.rule);
      entry.sources.push(rule?.source ?? '');
      checklistRules.set(c.key, entry);
    }
  }
  for (const [key, entry] of checklistRules) {
    const definition = ref.checklist.find((c) => c.checklist_key === key);
    const answer = noncreditByKey.get(key);
    items.push(emptyItem({
      id: `checklist:${key}`, kind: 'checklist', label: definition?.label ?? key,
      status: answer ? answer.status : 'unanswered', checklistKey: key,
      source: joinSources([definition?.source, ...entry.sources]), note: joinSources(entry.rules),
    }));
  }

  return finish();
}
