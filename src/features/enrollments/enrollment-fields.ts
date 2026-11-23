import type { Enrollment, EnrollmentStatus, NewEnrollment, TakenSemester } from '@/types/user';

export const terms: { value: TakenSemester; label: string }[] = [
  { value: 1, label: '1학기' },
  { value: 3, label: '여름 계절학기' },
  { value: 2, label: '2학기' },
  { value: 4, label: '겨울 계절학기' },
];

export const statusLabels: Record<EnrollmentStatus, string> = {
  completed: '이수 완료',
  failed: '미이수(F)',
  incomplete: '수강 중',
};

export function validYear(value: string): boolean {
  return /^\d{4}$/.test(value) && Number(value) >= 1900;
}

export function readSemester(value: string): TakenSemester | undefined {
  return terms.find((term) => String(term.value) === value)?.value;
}

export function sameEnrollment(
  record: Enrollment,
  input: Pick<NewEnrollment, 'taken_year' | 'taken_semester' | 'course_code'>,
): boolean {
  return record.course_code === input.course_code && record.taken_year === input.taken_year
    && record.taken_semester === input.taken_semester;
}
