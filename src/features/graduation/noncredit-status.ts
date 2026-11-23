import type { ChecklistItem, ChecklistKey, GraduationRule } from '@/types/reference';

export type NoncreditInputType = ChecklistItem['input_type'];
export type NoncreditChoice = 'met' | 'unmet';
export type NoncreditDecision =
  | { ok: true; status: NoncreditChoice; value: string | null }
  | { ok: false; message: string };

/**
 * 규칙 문장에서 기준 점수("700점 이상")를 찾는다.
 * 서로 다른 점수가 둘 이상이면(트랙별 기준 등) 자동 판정할 수 없으므로 null.
 */
export function scoreThreshold(rule: string | null): number | null {
  if (!rule) return null;
  const found = new Set([...rule.matchAll(/(\d{2,4})\s*점\s*이상/g)].map((m) => Number(m[1])));
  return found.size === 1 ? [...found][0] : null;
}

/** 학생에게 적용되는 규칙들에서 비학점 키별 규칙 문장을 모은다. */
export function checklistRuleText(rules: GraduationRule[], ruleIds: string[]): Map<ChecklistKey, string> {
  const texts = new Map<ChecklistKey, string[]>();
  for (const rule of rules) {
    if (!ruleIds.includes(rule.rule_id)) continue;
    for (const c of rule.checklist) texts.set(c.key, [...(texts.get(c.key) ?? []), c.rule]);
  }
  return new Map([...texts].map(([key, list]) => [key, [...new Set(list)].join(' / ')]));
}

/**
 * 숫자·텍스트·날짜 입력을 저장할 상태로 바꾼다.
 * 숫자는 규칙에 기준 점수가 하나로 정해져 있으면 자동으로 충족 여부를 정하고, 그 밖에는 학생이 고른 값을 쓴다.
 */
export function decideNoncredit(
  type: Exclude<NoncreditInputType, 'boolean'>,
  input: { value: string; choice: NoncreditChoice | null },
  threshold: number | null,
): NoncreditDecision {
  const value = input.value.trim();
  if (value === '') return { ok: false, message: '값을 입력해 주세요.' };
  if (type === 'number') {
    const score = Number(value);
    if (!Number.isFinite(score) || score < 0) return { ok: false, message: '0 이상의 숫자를 입력해 주세요.' };
    if (threshold !== null) return { ok: true, status: score >= threshold ? 'met' : 'unmet', value: String(score) };
  }
  if (type === 'date' && !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return { ok: false, message: '날짜를 YYYY-MM-DD 형식으로 입력해 주세요.' };
  }
  if (input.choice === null) return { ok: false, message: '충족 여부를 선택해 주세요.' };
  return { ok: true, status: input.choice, value };
}
