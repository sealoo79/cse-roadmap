import type { AdmissionYear, Course, CourseCode, ProgramId, ReferenceData } from '@/types/reference';
import type { OcrImportItem } from '@/types/user';

export type NewOcrItem = Omit<OcrImportItem, 'id' | 'user_id' | 'created_at'>;

/** 학생의 전공·학번. 주면 그 교육과정에 있는 과목을 먼저 후보로 둔다. */
export interface MatchContext { programId?: ProgramId | ''; admissionYear?: AdmissionYear | '' }

const codePattern = /\b([A-Z]{4})\s*(\d{4})\b/i;
/** 튜터링 등 시간표에 직접 추가한 일정은 이름이 비슷해도 수업으로 매칭하지 않는다. */
const personalSchedule = /(?:튜터|튜티|스터디)$/u;
const MAX_CANDIDATES = 5;

function normalizeName(value: string): string {
  return value.normalize('NFKC').toLowerCase().replace(/[^\p{L}\p{N}]/gu, '');
}

function courseNames(course: Course): string[] {
  return [course.name_ko, course.name_en ?? '', ...course.name_variants].map(normalizeName);
}

/** 한글 음절을 초성·중성·종성으로 나눈다. OCR 오류는 받침 하나(팅→티)처럼 음절 일부만 틀리는 경우가 많다. */
function jamo(value: string): string {
  let out = '';
  for (const char of value) {
    const code = char.codePointAt(0) ?? 0;
    if (code < 0xac00 || code > 0xd7a3) {
      out += char;
      continue;
    }
    const offset = code - 0xac00;
    out += String.fromCharCode(0x1100 + Math.floor(offset / 588), 0x1161 + Math.floor((offset % 588) / 28));
    if (offset % 28) out += String.fromCharCode(0x11a7 + (offset % 28));
  }
  return out;
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

const digits = (value: string): string => value.replace(/\D/g, '');

/** 알고리즘1·알고리즘2처럼 번호만 다른 과목은 서로 비슷한 이름으로 보지 않는다. */
function digitsConflict(ocr: string, known: string): boolean {
  const a = digits(ocr);
  const b = digits(known);
  return a !== '' && b !== '' && a !== b;
}

/**
 * OCR 이름과 기준 과목 이름의 일치 점수(0이면 후보 아님).
 * 90 같은 이름 · 85 뒤가 잘린 과목명 · 75 과목명 뒤에 짧은 글자가 붙음 · 70 많이 잘린 과목명
 * · 그 밖은 자모 단위 유사도(0.8 이상일 때 70~88).
 */
function nameScore(ocr: string, known: string): number {
  if (!known || !ocr) return 0;
  if (ocr === known) return 90;
  if (digitsConflict(ocr, known)) return 0;
  // 칸이 좁아 뒤가 잘린 이름(기초프로그래밍실 → 기초프로그래밍실습)이 교수명이 붙은 경우보다 흔하다.
  if (ocr.length >= 4 && known.startsWith(ocr) && ocr.length / known.length >= .75) return 85;
  if (known.length >= 3 && ocr.startsWith(known) && ocr.length - known.length <= 3) return 75;
  if (ocr.length >= 4 && known.startsWith(ocr) && ocr.length / known.length >= .6) return 70;
  if (ocr.length < 4) return 0;
  const a = jamo(ocr);
  const b = jamo(known);
  if (Math.abs(a.length - b.length) > Math.max(2, Math.round(b.length * .25))) return 0;
  const similarity = 1 - editDistance(a, b) / Math.max(a.length, b.length);
  return similarity >= .8 ? Math.round(88 * similarity) : 0;
}

export function matchCourses(titles: string[], ref: ReferenceData, context: MatchContext = {}): NewOcrItem[] {
  const names = new Map<string, Set<CourseCode>>();
  for (const course of ref.courses.values()) {
    for (const name of courseNames(course)) {
      if (!name) continue;
      const codes = names.get(name) ?? new Set<CourseCode>();
      codes.add(course.course_code);
      names.set(name, codes);
    }
  }
  const curriculum = new Set(ref.curriculum
    .filter((entry) => entry.program_id === context.programId && entry.admission_year === context.admissionYear)
    .map((entry) => entry.course_code));
  /** 같은 이름이면 내 교육과정 과목 → 컴퓨터학부 개설 과목 순으로 먼저 둔다. */
  const preference = (code: CourseCode): number => (curriculum.has(code) ? 15 : 0)
    + (ref.courses.get(code)?.offering_departments?.some((department) => department.startsWith('컴퓨터학부')) ? 5 : 0);

  const result: NewOcrItem[] = [];
  const seen = new Set<string>();
  for (const title of titles) {
    const raw_text = title.trim().slice(0, 100);
    const code = raw_text.match(codePattern)?.slice(1).join('').toUpperCase();
    const name = normalizeName(raw_text.replace(codePattern, ''));
    if (!name && !code) continue;

    const scores = new Map<CourseCode, number>();
    const add = (candidate: CourseCode, score: number): void => {
      if (score > (scores.get(candidate) ?? 0)) scores.set(candidate, score);
    };
    if (code && ref.courses.has(code)) {
      add(code, 100);
      // 코드와 이름이 같은 다른 학과 과목도 함께 보여 준다.
      for (const same of names.get(normalizeName(ref.courses.get(code)?.name_ko ?? '')) ?? []) add(same, 89);
    }
    for (const exact of names.get(name) ?? []) add(exact, 90);
    if (scores.size === 0 && name && !personalSchedule.test(name)) {
      // 강의실 줄이 깨져 제목 뒤에 붙는 경우가 많아, 앞 단어부터 잘라 가며 맞춰 본다(뒤를 뗄수록 조금 감점).
      const words = raw_text.replace(codePattern, ' ').split(/\s+/).filter(Boolean);
      const variants = new Map<string, number>();
      for (let count = words.length; count >= 1; count--) {
        const variant = normalizeName(words.slice(0, count).join(''));
        if (variant && !variants.has(variant)) variants.set(variant, count === words.length ? 0 : 3);
      }
      for (const [variant, penalty] of variants) {
        const exact = names.get(variant);
        if (exact) for (const candidate of exact) add(candidate, 90 - penalty);
        for (const [known, codes] of exact ? [] : names) {
          const score = nameScore(variant, known);
          if (score > 0) for (const candidate of codes) add(candidate, score - penalty);
        }
      }
    }

    const ranked = [...scores].map(([candidate, score]) => ({ candidate, score, total: score + preference(candidate) }))
      .sort((a, b) => b.total - a.total || b.score - a.score || a.candidate.localeCompare(b.candidate));
    const best = ranked[0]?.score ?? 0;
    // 일치도가 확실히 낮은 후보는 빼서 목록을 짧게 유지한다(같은 이름 과목은 남긴다).
    const candidate_codes = ranked.filter(({ score }) => score >= 89 || score >= best - 8)
      .slice(0, MAX_CANDIDATES).map(({ candidate }) => candidate);

    const key = best >= 89 ? `codes:${[...candidate_codes].sort().join(',')}` : `title:${code ?? ''}/${name}`;
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
