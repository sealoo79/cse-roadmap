import type { Course, CourseCode, ReferenceData } from '@/types/reference';
import type { OcrImportItem } from '@/types/user';

export type NewOcrItem = Omit<OcrImportItem, 'id' | 'user_id' | 'created_at'>;

const codePattern = /\b([A-Z]{4})\s*(\d{4})\b/i;

function normalizeName(value: string): string {
  return value.normalize('NFKC').toLowerCase().replace(/[^\p{L}\p{N}]/gu, '');
}

function courseNames(course: Course): string[] {
  return [course.name_ko, course.name_en ?? '', ...course.name_variants].map(normalizeName);
}

function editDistance(a: string, b: string): number {
  let previous = Array.from({ length: b.length + 1 }, (_, index) => index);
  for (let i = 1; i <= a.length; i++) {
    const next = [i];
    for (let j = 1; j <= b.length; j++) {
      next[j] = Math.min(previous[j] + 1, next[j - 1] + 1, previous[j - 1] + Number(a[i - 1] !== b[j - 1]));
    }
    previous = next;
  }
  return previous[b.length];
}

export function matchCourses(titles: string[], ref: ReferenceData): NewOcrItem[] {
  const names = new Map<string, Set<CourseCode>>();
  for (const course of ref.courses.values()) {
    for (const name of courseNames(course)) {
      if (!name) continue;
      const codes = names.get(name) ?? new Set<CourseCode>();
      codes.add(course.course_code);
      names.set(name, codes);
    }
  }

  function withSameName(codes: CourseCode[]): CourseCode[] {
    return [...new Set(codes.flatMap((code) => [
      code, ...(names.get(normalizeName(ref.courses.get(code)?.name_ko ?? '')) ?? []),
    ]))];
  }

  const result: NewOcrItem[] = [];
  const seen = new Set<string>();
  for (const title of titles) {
    const raw_text = title.trim().slice(0, 100);
    const code = raw_text.match(codePattern)?.slice(1).join('').toUpperCase();
    const name = normalizeName(raw_text.replace(codePattern, ''));
    if (!name && !code) continue;

    const exactCodes = code && ref.courses.has(code) ? [code] : [...(names.get(name) ?? [])];
    let candidate_codes = withSameName(exactCodes);
    // 튜터링 등 시간표에 직접 추가한 일정은 접두사가 같아도 수업으로 매칭하지 않는다.
    if (candidate_codes.length === 0 && name.length >= 5 && !/(?:튜터|튜티|스터디)$/u.test(name)) {
      const maxEdits = name.length >= 10 ? 2 : 1;
      const similar = [...names.keys()].filter((known) => Math.abs(known.length - name.length) <= maxEdits)
        .map((known) => ({ known, distance: editDistance(known, name) }))
        .filter(({ distance }) => distance <= maxEdits)
        .sort((a, b) => a.distance - b.distance || a.known.localeCompare(b.known))
        .slice(0, 5);
      candidate_codes = withSameName(similar.flatMap(({ known }) => [...(names.get(known) ?? [])]));
    }

    const key = exactCodes.length ? `codes:${[...candidate_codes].sort().join(',')}` : `title:${code ?? ''}/${name}`;
    if (seen.has(key)) continue;
    seen.add(key);
    result.push({ raw_text, candidate_codes, matched_course_code: null, review_status: 'pending' });
  }
  return result;
}

export function courseMatchLabel(item: NewOcrItem, ref: ReferenceData): string {
  if (item.candidate_codes.length === 0) return '미매칭';
  if (item.candidate_codes.length > 1) return `DB 후보 ${item.candidate_codes.length}개`;
  const course = ref.courses.get(item.candidate_codes[0]);
  if (course && (item.raw_text.match(codePattern)?.slice(1).join('').toUpperCase() === course.course_code
    || courseNames(course).includes(normalizeName(item.raw_text.replace(codePattern, ''))))) {
    return 'DB 일치';
  }
  return '유사 과목 후보';
}
