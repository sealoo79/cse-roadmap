import { describe, expect, it } from 'vitest';
import { getReferenceData } from '@/lib/reference';
import type { CourseCode, CourseField, CurriculumEntry, FieldId } from '@/types/reference';
import { layoutRoadmap } from './layout-roadmap';

const entry = (course_code: CourseCode, grade: CurriculumEntry['grade'], semester: CurriculumEntry['semester']): CurriculumEntry => ({
  course_code, grade, semester, program_id: 'adv_computing', admission_year: 2026,
  category: '전공', credit_bucket: 'major', is_required: false, tags: [],
});

const field = (course_code: CourseCode, primary_field_id: FieldId): CourseField => ({
  course_code, primary_field_id, field_ids: [primary_field_id], basis: 'team_proposal',
});

describe('layoutRoadmap', () => {
  it('places every recommended semester in a distinct column', () => {
    const entries = [
      entry('COMP0000', 1, 1), entry('COMP0001', 1, 2), entry('COMP0002', 2, 1), entry('COMP0003', 2, 2),
      entry('COMP0004', 3, 1), entry('COMP0005', 3, 2), entry('COMP0006', 4, 1), entry('COMP0007', 4, 2),
    ];
    const { nodes } = layoutRoadmap(entries, new Map());

    expect(nodes.map(({ col }) => col)).toEqual([0, 1, 2, 3, 4, 5, 6, 7]);
    expect(new Set(nodes.map(({ x }) => x)).size).toBe(8);
    expect(new Set(nodes.map(({ y }) => y)).size).toBe(1);
  });

  it('stacks same-cell stations without overlap and defaults unclassified courses to common', () => {
    const entries = [entry('COMP0003', 1, 1), entry('COMP0002', 1, 1), entry('COMP0001', 1, 1)];
    const courseFields = new Map([['COMP0003', field('COMP0003', 'system')]]);
    const result = layoutRoadmap(entries, courseFields);
    const [first, second, third] = result.nodes;

    expect(result.lanes).toEqual([{ fieldId: 'common', row: 0 }, { fieldId: 'system', row: 1 }]);
    expect([first.code, second.code, third.code]).toEqual(['COMP0001', 'COMP0002', 'COMP0003']);
    expect(first.y + first.height).toBeLessThan(second.y);
    expect(second.y + second.height).toBeLessThan(third.y);
    expect(entries[0].course_code).toBe('COMP0003');
    expect(layoutRoadmap([...entries].reverse(), courseFields)).toEqual(result);
  });

  it('lays out all published curricula and keeps missing curricula empty', () => {
    const ref = getReferenceData();
    for (const program of ref.programs) {
      for (const year of program.years) {
        const entries = ref.curriculum.filter(
          (row) => row.program_id === program.program_id && row.admission_year === year.admission_year,
        );
        const { nodes, lanes } = layoutRoadmap(entries, ref.courseFields);
        if (year.curriculum_status === 'missing') {
          expect(nodes).toEqual([]);
          expect(lanes).toEqual([]);
        } else {
          expect(nodes.length).toBeGreaterThan(0);
          expect(nodes.map(({ code }) => code).sort()).toEqual(entries.map(({ course_code }) => course_code).sort());
        }
      }
    }
  });
});
