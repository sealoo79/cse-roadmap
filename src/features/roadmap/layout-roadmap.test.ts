import { describe, expect, it } from 'vitest';
import { getReferenceData } from '@/lib/reference';
import type { CourseCode, CourseField, CurriculumEntry, FieldId } from '@/types/reference';
import {
  COLUMN_WIDTH, HEADER_HEIGHT, LANE_PADDING, MIN_COLUMN_WIDTH, STATION_LEAD, TRACK_LEAD, layoutRoadmap,
} from './layout-roadmap';

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

  it('fits stations inside a narrower column width when one is given', () => {
    const entries = Array.from({ length: 8 }, (_, col) => entry(`COMP000${col}`, (Math.floor(col / 2) + 1) as 1 | 2 | 3 | 4, (col % 2 + 1) as 1 | 2));
    const columnWidth = 132;
    const { nodes } = layoutRoadmap(entries, new Map(), columnWidth);
    const wide = layoutRoadmap(entries, new Map());

    for (const node of nodes) {
      const left = TRACK_LEAD + node.col * columnWidth;
      expect(node.x).toBeGreaterThan(left);
      expect(node.x + node.width).toBeLessThan(left + columnWidth);
    }
    expect(nodes[0].width).toBeLessThan(wide.nodes[0].width);
    expect(nodes.map(({ y, height }) => [y, height])).toEqual(wide.nodes.map(({ y, height }) => [y, height]));
    expect(layoutRoadmap(entries, new Map(), COLUMN_WIDTH)).toEqual(wide);
  });

  it('keeps stations compact so relation lines have room between semesters', () => {
    const entries = [entry('COMP0000', 1, 1), entry('COMP0001', 1, 2), entry('COMP0002', 1, 1)];
    for (const columnWidth of [MIN_COLUMN_WIDTH, 138, COLUMN_WIDTH]) {
      const { nodes } = layoutRoadmap(entries, new Map(), columnWidth);
      const [first, second] = nodes.filter(({ col }) => col === 0);
      const next = nodes.find(({ col }) => col === 1)!;
      // 앞 학기 카드 오른쪽 끝 ~ 다음 학기 노선(점) 사이 간격, 그리고 점 ~ 카드 사이 간격
      expect(next.x - (first.x + first.width)).toBeGreaterThanOrEqual(24);
      expect(STATION_LEAD).toBeGreaterThanOrEqual(16);
      expect(first.width - STATION_LEAD).toBeGreaterThanOrEqual(90);
      expect(first.width - STATION_LEAD).toBeLessThanOrEqual(128);
      expect(first.height).toBeLessThanOrEqual(58);
      expect(second.y - (first.y + first.height)).toBeGreaterThanOrEqual(8);
    }
  });

  it('leaves a left margin before 1-1 for the field label and separates fields by space', () => {
    const entries = [entry('COMP0000', 1, 1), entry('COMP0001', 2, 1)];
    const courseFields = new Map([['COMP0001', field('COMP0001', 'system')]]);
    const { nodes } = layoutRoadmap(entries, courseFields, 150);
    const [common, system] = nodes;

    // 분야 이름(가장 긴 '네트워크·보안' ≈ 80px)이 1-1 열 앞 여백에 들어가야 한다.
    expect(TRACK_LEAD).toBeGreaterThanOrEqual(80);
    expect(common.x).toBeGreaterThanOrEqual(TRACK_LEAD);
    expect(common.y).toBe(HEADER_HEIGHT + LANE_PADDING);
    // 분야 사이 구분선이 없으므로 분야 사이를 카드 사이(8px)보다 확실히 넓게 띄운다.
    expect(system.y - (common.y + common.height)).toBeGreaterThanOrEqual(32);
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
