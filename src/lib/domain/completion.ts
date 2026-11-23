import type { CourseCode, ReferenceData } from '@/types/reference';
import type { Enrollment, TakenSemester } from '@/types/user';

export interface CompletionState {
  completed: ReadonlySet<CourseCode>;
  inProgress: ReadonlySet<CourseCode>;
  failed: ReadonlySet<CourseCode>;
  creditByCode: Readonly<Record<CourseCode, number>>;
  totalCredits: number;
  isCompleted(code: CourseCode): boolean;
  canonicalOf(code: CourseCode): CourseCode;
}

const semesterOrder: Record<TakenSemester, number> = { 1: 0, 3: 1, 2: 2, 4: 3 };

function compareAttempts(first: Enrollment, second: Enrollment): number {
  return first.taken_year - second.taken_year
    || semesterOrder[first.taken_semester] - semesterOrder[second.taken_semester]
    || Date.parse(first.created_at) - Date.parse(second.created_at)
    || first.id.localeCompare(second.id);
}

export function resolveCompletion(enrollments: Enrollment[], ref: ReferenceData): CompletionState {
  const representativeByCode = new Map<CourseCode, CourseCode>();
  function canonicalOf(code: CourseCode): CourseCode {
    let representative = code;
    let next = representativeByCode.get(representative);
    while (next !== undefined) {
      representative = next;
      next = representativeByCode.get(representative);
    }
    return representative;
  }

  const passedCodes = new Set<CourseCode>();
  for (const { course_code, status } of enrollments) {
    if (status === 'completed') passedCodes.add(course_code);
  }

  const supersededCreditCodes = new Set<CourseCode>();
  for (const equivalent of ref.equivalents) {
    if (equivalent.relation !== 'same_course') continue;

    const oldRepresentative = canonicalOf(equivalent.old_code);
    const newRepresentative = canonicalOf(equivalent.new_code);
    if (oldRepresentative !== newRepresentative) {
      representativeByCode.set(oldRepresentative, newRepresentative);
    }

    // 두 코드 모두 이수했고 별도 인정 기준이 없으면 신과목 학점을 사용한다.
    if (equivalent.credit_changed && equivalent.credit_recognition === null
      && passedCodes.has(equivalent.old_code) && passedCodes.has(equivalent.new_code)) {
      supersededCreditCodes.add(equivalent.old_code);
    }
  }

  const creditedAttempts = new Map<CourseCode, Enrollment>();
  const failed = new Set<CourseCode>();
  const inProgress = new Set<CourseCode>();

  for (const enrollment of [...enrollments].sort(compareAttempts)) {
    const code = canonicalOf(enrollment.course_code);
    switch (enrollment.status) {
      case 'completed': {
        failed.delete(code);
        const previous = creditedAttempts.get(code);
        if (!previous || !supersededCreditCodes.has(enrollment.course_code)
          || supersededCreditCodes.has(previous.course_code)) {
          creditedAttempts.set(code, enrollment);
        }
        break;
      }
      case 'failed':
        failed.add(code);
        break;
      case 'incomplete':
        inProgress.add(code);
        break;
    }
  }

  const completed = new Set(creditedAttempts.keys());
  const credits = new Map<CourseCode, number>();
  let totalCredits = 0;
  for (const [code, enrollment] of creditedAttempts) {
    const credit = enrollment.credit ?? ref.courses.get(enrollment.course_code)?.credit ?? 0;
    credits.set(code, credit);
    totalCredits += credit;
  }

  return {
    completed,
    inProgress,
    failed,
    creditByCode: Object.fromEntries(credits),
    totalCredits,
    isCompleted: (code) => completed.has(canonicalOf(code)),
    canonicalOf,
  };
}
