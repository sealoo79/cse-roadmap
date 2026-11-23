import type { CourseCode, CourseField, CurriculumEntry, FieldId } from '@/types/reference';
import type { LayoutRoadmap, RoadmapNode } from '@/types/roadmap';
import { getFields } from '@/lib/reference';

export const SEMESTER_COUNT = 8;
export const COLUMN_WIDTH = 192;
export const LABEL_WIDTH = 148;
export const HEADER_HEIGHT = 64;
export const LANE_PADDING = 12;
const NODE_WIDTH = 164;
const NODE_HEIGHT = 76;
const NODE_GAP = 6;
const LANE_GAP = 24;
const fieldOrder = getFields().map(({ field_id }) => field_id);

function columnOf(entry: CurriculumEntry): number {
  return (entry.grade - 1) * 2 + entry.semester - 1;
}

export function roadmapFieldOf(code: CourseCode, courseFields: Map<CourseCode, CourseField>): FieldId {
  return courseFields.get(code)?.primary_field_id ?? 'common';
}

export const layoutRoadmap: LayoutRoadmap = (curriculum, courseFields) => {
  const ordered = [...curriculum].sort((a, b) => columnOf(a) - columnOf(b) || a.course_code.localeCompare(b.course_code));
  const entriesByField = new Map<FieldId, CurriculumEntry[]>();
  for (const entry of ordered) {
    const field = roadmapFieldOf(entry.course_code, courseFields);
    const entries = entriesByField.get(field) ?? [];
    entries.push(entry);
    entriesByField.set(field, entries);
  }

  const nodes: RoadmapNode[] = [];
  const lanes: { fieldId: FieldId; row: number }[] = [];
  let laneTop = HEADER_HEIGHT + LANE_PADDING;
  for (const fieldId of fieldOrder) {
    const entries = entriesByField.get(fieldId);
    if (!entries?.length) continue;

    const row = lanes.length;
    lanes.push({ fieldId, row });
    const columnCounts = Array<number>(SEMESTER_COUNT).fill(0);
    for (const entry of entries) {
      const col = columnOf(entry);
      const slot = columnCounts[col]++;
      nodes.push({
        code: entry.course_code, col, row, fieldId,
        x: LABEL_WIDTH + col * COLUMN_WIDTH + (COLUMN_WIDTH - NODE_WIDTH) / 2,
        y: laneTop + slot * (NODE_HEIGHT + NODE_GAP),
        width: NODE_WIDTH,
        height: NODE_HEIGHT,
      });
    }
    const maxSlots = Math.max(...columnCounts);
    laneTop += maxSlots * NODE_HEIGHT + (maxSlots - 1) * NODE_GAP + LANE_GAP;
  }

  return { nodes, lanes };
};
