import type { Course, ReferenceData } from '@/types/reference';

function normalize(value: string): string {
  return value.normalize('NFKC').toLowerCase().replace(/\s+/g, '');
}

export function searchCourses(query: string, ref: ReferenceData, opts?: { limit?: number }): Course[] {
  const term = normalize(query);
  const limit = opts?.limit ?? 30;
  if (!term || limit < 1) return [];

  const matches: { course: Course; rank: number }[] = [];
  for (const course of ref.courses.values()) {
    const code = normalize(course.course_code);
    const names = [course.name_ko, course.name_en ?? '', ...course.name_variants].map(normalize);
    if (code === term) matches.push({ course, rank: 0 });
    else if (names.includes(term)) matches.push({ course, rank: 1 });
    else if (code.startsWith(term) || names.some((name) => name.startsWith(term))) matches.push({ course, rank: 2 });
    else if (code.includes(term) || names.some((name) => name.includes(term))) matches.push({ course, rank: 3 });
  }

  return matches.sort((a, b) => a.rank - b.rank || a.course.course_code.localeCompare(b.course.course_code))
    .slice(0, limit).map(({ course }) => course);
}
