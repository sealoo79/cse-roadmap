import type { CourseCode, CourseRelation, FieldId, ReferenceData } from '@/types/reference';
import type { Enrollment, FollowupStat, Profile } from '@/types/user';
import type { CompletionState } from './completion';

export type ReasonType = 'interest' | 'successor' | 'required' | 'followup';

export interface RecommendationReason {
  type: ReasonType;
  label: string;
  fromCode?: CourseCode;
  value?: number;
}

export interface Recommendation {
  code: CourseCode;
  score: number;
  reasons: RecommendationReason[];
  fromCodes: CourseCode[];
  warning: 'prerequisite_unmet' | null;
}

export interface RecommendWeights {
  interest: number;
  successor: number;
  required: number;
  followup: number;
  prerequisiteUnmetPenalty: number;
  minFollowupBase: number;
}

const MIN_PUBLIC_FOLLOWUP_BASE = 3;

/** 학년·학기 (예: 3학년 1학기 → { grade: 3, semester: 1 }) */
export interface AcademicTerm { grade: number; semester: 1 | 2 }

const LAST_TERM_INDEX = 8;
const termIndex = ({ grade, semester }: { grade: number; semester: number }): number => (grade - 1) * 2 + semester;

/**
 * 다음 학기 = 수강 이력에 있는 정규학기(1·2학기) 수 + 1.
 * 달력 연도 대신 들은 학기 수를 세므로 휴학·군복무가 있어도 학년이 밀리지 않는다. 계절학기는 세지 않는다.
 * 이력이 없으면 1학년 1학기, 4학년 2학기를 넘으면 4학년 2학기로 본다.
 */
export function nextTermOf(enrollments: ReadonlyArray<Pick<Enrollment, 'taken_year' | 'taken_semester'>>): AcademicTerm {
  const terms = new Set(enrollments
    .filter(({ taken_semester }) => taken_semester === 1 || taken_semester === 2)
    .map(({ taken_year, taken_semester }) => `${taken_year}-${taken_semester}`));
  const next = Math.min(LAST_TERM_INDEX, terms.size + 1);
  return { grade: Math.ceil(next / 2), semester: next % 2 === 1 ? 1 : 2 };
}

/**
 * 정렬 단계(작을수록 먼저). 같은 단계 안의 순서는 recommendCourses 끝의 비교 함수 참고.
 * 0 권장 학기가 지난 전공필수 → 1 다음 학기에 맞는 전공필수 → 2 나머지(2학기 앞까지)
 * → 3 그보다 먼 학기 과목 → 4 필수 선수과목을 아직 안 들은 과목
 */
type Tier = 0 | 1 | 2 | 3 | 4;
const FUTURE_REACH = 2;

export const DEFAULT_WEIGHTS: RecommendWeights = {
  interest: 1,
  successor: 1,
  required: 1,
  followup: 1,
  prerequisiteUnmetPenalty: 1,
  minFollowupBase: MIN_PUBLIC_FOLLOWUP_BASE,
};

export function recommendCourses({
  profile, interests, completion, followupStats, ref, weights = DEFAULT_WEIGHTS, nextTerm,
}: {
  profile: Profile;
  interests: FieldId[];
  completion: CompletionState;
  followupStats: FollowupStat[];
  ref: ReferenceData;
  weights?: RecommendWeights;
  /** 주면 다음 학기에 열리지 않는 과목을 빼고 학기 우선순위를 쓴다(nextTermOf 참고). */
  nextTerm?: AcademicTerm;
}): Recommendation[] {
  const { program_id, admission_year } = profile;
  const curriculum = new Map<CourseCode, { code: CourseCode; required: boolean; term: number }>();
  for (const entry of ref.curriculum) {
    if (entry.program_id !== program_id || entry.admission_year !== admission_year) continue;
    const canonical = completion.canonicalOf(entry.course_code);
    const previous = curriculum.get(canonical);
    curriculum.set(canonical, {
      code: !previous || entry.course_code === canonical ? entry.course_code : previous.code,
      required: entry.is_required || previous?.required === true,
      term: Math.min(termIndex(entry), previous?.term ?? Infinity),
    });
  }

  const nextIndex = nextTerm ? termIndex(nextTerm) : null;
  const offeredNext = (code: CourseCode, canonical: CourseCode): boolean => {
    const offered = (ref.courses.get(code) ?? ref.courses.get(canonical))?.offered_semesters;
    return !nextTerm || !offered?.length || offered.includes(nextTerm.semester);
  };
  const candidates = [...curriculum].filter(([canonical, { code }]) => !completion.isCompleted(canonical)
    && !completion.failed.has(canonical) && !completion.inProgress.has(canonical) && offeredNext(code, canonical));
  if (candidates.length === 0) return [];
  const candidateCodes = new Set(candidates.map(([canonical]) => canonical));

  const relationsByTarget = new Map<CourseCode, CourseRelation[]>();
  for (const relation of ref.relations) {
    const to = completion.canonicalOf(relation.to_code);
    if (relation.type === 'coreq' || !candidateCodes.has(to)
      || (relation.program_id !== null && relation.program_id !== program_id)
      || (relation.admission_year_from !== null && admission_year < relation.admission_year_from)
      || (relation.admission_year_to !== null && admission_year > relation.admission_year_to)) continue;
    const incoming = relationsByTarget.get(to);
    if (incoming) incoming.push(relation);
    else relationsByTarget.set(to, [relation]);
  }

  // 이 과목을 안 들으면 뒤에서 막히는 과목 수: 전공·학번에 맞는 선후수(동시수강 제외)를 따라가며 아직 안 들은 과목을 센다.
  const successors = new Map<CourseCode, Set<CourseCode>>();
  for (const relation of ref.relations) {
    if (relation.type === 'coreq'
      || (relation.program_id !== null && relation.program_id !== program_id)
      || (relation.admission_year_from !== null && admission_year < relation.admission_year_from)
      || (relation.admission_year_to !== null && admission_year > relation.admission_year_to)) continue;
    const from = completion.canonicalOf(relation.from_code);
    const next = successors.get(from) ?? new Set<CourseCode>();
    next.add(completion.canonicalOf(relation.to_code));
    successors.set(from, next);
  }
  const blockingCount = (start: CourseCode): number => {
    const seen = new Set<CourseCode>([start]);
    const queue = [start];
    let count = 0;
    while (queue.length) {
      for (const next of successors.get(queue.shift() as CourseCode) ?? []) {
        if (seen.has(next)) continue;
        seen.add(next);
        queue.push(next);
        if (!completion.isCompleted(next)) count += 1;
      }
    }
    return count;
  };

  const followupsByTarget = new Map<CourseCode, Map<CourseCode, FollowupStat>>();
  const minFollowupBase = Math.max(MIN_PUBLIC_FOLLOWUP_BASE, weights.minFollowupBase);
  for (const stat of followupStats) {
    const to = completion.canonicalOf(stat.to_code);
    if (stat.program_id !== program_id || !candidateCodes.has(to) || !completion.isCompleted(stat.from_code)
      || !Number.isInteger(stat.base_count) || stat.base_count < minFollowupBase
      || !Number.isInteger(stat.follower_count) || stat.follower_count <= 0 || stat.follower_count > stat.base_count) continue;
    const from = completion.canonicalOf(stat.from_code);
    const followups = followupsByTarget.get(to) ?? new Map<CourseCode, FollowupStat>();
    const previous = followups.get(from);
    // 동일과목 코드로 집계된 표본은 겹칠 수 있으므로 더 큰 표본 하나를 사용한다.
    if (!previous || stat.base_count > previous.base_count
      || (stat.base_count === previous.base_count && stat.follower_count > previous.follower_count)) {
      followups.set(from, stat);
    }
    followupsByTarget.set(to, followups);
  }

  const interestIds = new Set(interests);
  const fieldNames = new Map(ref.fields.map((field) => [field.field_id, field.name_ko]));
  const courseName = (code: CourseCode): string => ref.courses.get(code)?.name_ko ?? code;
  const roadmapCode = (canonical: CourseCode): CourseCode => curriculum.get(canonical)?.code ?? canonical;
  const ranked: { recommendation: Recommendation; tier: Tier; term: number; blocking: number }[] = [];

  for (const [canonical, { code, required, term }] of candidates) {
    const reasons: RecommendationReason[] = [];
    const fromCodes = new Set<CourseCode>();
    let score = 0;

    const matchingFields = (ref.courseFields.get(code)?.field_ids ?? ref.courseFields.get(canonical)?.field_ids ?? [])
      .filter((field) => interestIds.has(field));
    if (matchingFields.length > 0) {
      const names = [...new Set(matchingFields)].map((field) => fieldNames.get(field) ?? field);
      reasons.push({ type: 'interest', label: `관심 분야 일치 (${names.join(' · ')})` });
      score += weights.interest;
    }

    if (required) {
      reasons.push({ type: 'required', label: '아직 이수하지 않은 전공필수 과목' });
      score += weights.required;
    }

    const prerequisiteGroups = new Map<string, boolean>();
    for (const relation of relationsByTarget.get(canonical) ?? []) {
      const completed = completion.isCompleted(relation.from_code);
      if (relation.type === 'official') {
        const group = `${relation.to_code}/${relation.group_no}`;
        prerequisiteGroups.set(group, completed || prerequisiteGroups.get(group) === true);
      }
      if (!completed) continue;
      const fromCode = roadmapCode(completion.canonicalOf(relation.from_code));
      if (fromCodes.has(fromCode)) continue;
      fromCodes.add(fromCode);
      reasons.push({ type: 'successor', label: `${courseName(fromCode)}의 후속 과목`, fromCode });
      score += weights.successor;
    }

    for (const [from, stat] of followupsByTarget.get(canonical) ?? []) {
      const fromCode = roadmapCode(from);
      const ratio = stat.follower_count / stat.base_count;
      fromCodes.add(fromCode);
      reasons.push({
        type: 'followup',
        label: `같은 전공 선배 ${stat.base_count}명 중 ${stat.follower_count}명이 ${courseName(fromCode)} 이후 수강`,
        fromCode,
        value: ratio,
      });
      score += weights.followup * ratio;
    }

    if (reasons.length === 0) continue;
    const warning = [...prerequisiteGroups.values()].every(Boolean) ? null : 'prerequisite_unmet';
    if (warning) score -= weights.prerequisiteUnmetPenalty;
    const tier: Tier = warning ? 4
      : required && nextIndex !== null && term < nextIndex ? 0
        : required && (nextIndex === null || term === nextIndex) ? 1
          : nextIndex !== null && term > nextIndex + FUTURE_REACH ? 3 : 2;
    ranked.push({ recommendation: { code, score, reasons, fromCodes: [...fromCodes], warning }, tier, term, blocking: blockingCount(canonical) });
  }

  // 우선순위: ① 단계(Tier) ② 전공필수 단계(0·1)는 더 오래 밀린 과목 → 뒤에 막히는 과목이 많은 순 → 점수
  // ③ 나머지 단계는 점수 → 다음 학기와 가까운 순 → 뒤에 막히는 과목이 많은 순. 마지막은 과목코드.
  const distance = (term: number): number => nextIndex === null ? 0 : Math.abs(term - nextIndex);
  return ranked.sort((a, b) => a.tier - b.tier || (a.tier <= 1
    ? a.term - b.term || b.blocking - a.blocking || b.recommendation.score - a.recommendation.score
    : b.recommendation.score - a.recommendation.score || distance(a.term) - distance(b.term) || b.blocking - a.blocking)
    || a.recommendation.code.localeCompare(b.recommendation.code)).map(({ recommendation }) => recommendation);
}
