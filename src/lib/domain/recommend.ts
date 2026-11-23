import type { CourseCode, CourseRelation, FieldId, ReferenceData } from '@/types/reference';
import type { FollowupStat, Profile } from '@/types/user';
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

export const DEFAULT_WEIGHTS: RecommendWeights = {
  interest: 1,
  successor: 1,
  required: 1,
  followup: 1,
  prerequisiteUnmetPenalty: 1,
  minFollowupBase: MIN_PUBLIC_FOLLOWUP_BASE,
};

export function recommendCourses({
  profile, interests, completion, followupStats, ref, weights = DEFAULT_WEIGHTS,
}: {
  profile: Profile;
  interests: FieldId[];
  completion: CompletionState;
  followupStats: FollowupStat[];
  ref: ReferenceData;
  weights?: RecommendWeights;
}): Recommendation[] {
  const { program_id, admission_year } = profile;
  const curriculum = new Map<CourseCode, { code: CourseCode; required: boolean }>();
  for (const entry of ref.curriculum) {
    if (entry.program_id !== program_id || entry.admission_year !== admission_year) continue;
    const canonical = completion.canonicalOf(entry.course_code);
    const previous = curriculum.get(canonical);
    curriculum.set(canonical, {
      code: !previous || entry.course_code === canonical ? entry.course_code : previous.code,
      required: entry.is_required || previous?.required === true,
    });
  }

  const candidates = [...curriculum].filter(([canonical]) => !completion.isCompleted(canonical) && !completion.failed.has(canonical));
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
  const recommendations: Recommendation[] = [];

  for (const [canonical, { code, required }] of candidates) {
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
    recommendations.push({ code, score, reasons, fromCodes: [...fromCodes], warning });
  }

  return recommendations.sort((a, b) => b.score - a.score || a.code.localeCompare(b.code));
}
