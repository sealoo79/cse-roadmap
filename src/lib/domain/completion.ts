import type { CourseCode, ReferenceData } from '@/types/reference';
import type { Enrollment } from '@/types/user';

export interface CompletionState {
  completed: ReadonlySet<CourseCode>; inProgress: ReadonlySet<CourseCode>; failed: ReadonlySet<CourseCode>;
  creditByCode: Readonly<Record<CourseCode, number>>; totalCredits: number;
  isCompleted(code: CourseCode): boolean; canonicalOf(code: CourseCode): CourseCode;
}
// #6 소유: 공통 계약용 빈 상태. 실제 이수 판정을 구현하지 않는다.
export function resolveCompletion(_enrollments: Enrollment[], _ref: ReferenceData): CompletionState {
  void _enrollments; void _ref;
  return { completed: new Set(), inProgress: new Set(), failed: new Set(), creditByCode: {}, totalCredits: 0,
    isCompleted: () => false, canonicalOf: (code) => code };
}
