import type { CourseCode, CourseField, CurriculumEntry, FieldId } from '@/types/reference';
import type { LayoutRoadmap, RoadmapNode } from '@/types/roadmap';
import { getFields } from '@/lib/reference';

export const SEMESTER_COUNT = 8;
/** 화면이 충분히 넓을 때의 학기 열 폭(기본값). */
export const COLUMN_WIDTH = 192;
/** 화면 맞춤 시 더 줄이지 않는 최소 열 폭. 이보다 좁은 창에서는 가로 스크롤한다. */
export const MIN_COLUMN_WIDTH = 132;
/** 1-1학기 열 앞의 여백. 노선이 여기서 시작하고, 분야 이름을 노선 바로 위에 적는다(가장 긴 이름 ≈ 80px). */
export const TRACK_LEAD = 84;
export const HEADER_HEIGHT = 64;
/** 분야 위아래 여백. 분야 사이에 구분선이 없으므로 이 값의 두 배가 분야 사이 간격이 된다. */
export const LANE_PADDING = 16;
/**
 * 역(노드)의 왼쪽에 노선 점과 세로 지선을 그리는 자리. 카드는 이만큼 오른쪽에서 시작해
 * 점·지선이 카드에 가려지지 않는다. 노드의 x는 이 자리의 왼쪽 끝(관계선이 들어오는 곳)이다.
 */
export const STATION_LEAD = 18;
/** 카드(과목명·학점)의 최대 폭. 열이 넓어지면 카드 대신 학기 사이 간격이 넓어진다. */
const CARD_MAX_WIDTH = 128;
/** 노드 양옆 최소 여백. 앞 학기 카드와 다음 학기 노선 사이에 관계선이 지나갈 간격(이 값의 두 배)을 남긴다. */
const NODE_MIN_INSET = 12;
const NODE_HEIGHT = 56;
const NODE_GAP = 8;
const LANE_GAP = LANE_PADDING * 2;
const fieldOrder = getFields().map(({ field_id }) => field_id);

function columnOf(entry: CurriculumEntry): number {
  return (entry.grade - 1) * 2 + entry.semester - 1;
}

export function roadmapFieldOf(code: CourseCode, courseFields: Map<CourseCode, CourseField>): FieldId {
  return courseFields.get(code)?.primary_field_id ?? 'common';
}

export function layoutRoadmap(
  curriculum: CurriculumEntry[],
  courseFields: Map<CourseCode, CourseField>,
  columnWidth: number = COLUMN_WIDTH,
): ReturnType<LayoutRoadmap> {
  const nodeWidth = Math.min(STATION_LEAD + CARD_MAX_WIDTH, columnWidth - NODE_MIN_INSET * 2);
  const nodeInset = (columnWidth - nodeWidth) / 2;
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
        x: TRACK_LEAD + col * columnWidth + nodeInset,
        y: laneTop + slot * (NODE_HEIGHT + NODE_GAP),
        width: nodeWidth,
        height: NODE_HEIGHT,
      });
    }
    const maxSlots = Math.max(...columnCounts);
    laneTop += maxSlots * NODE_HEIGHT + (maxSlots - 1) * NODE_GAP + LANE_GAP;
  }

  return { nodes, lanes };
}

layoutRoadmap satisfies LayoutRoadmap;
