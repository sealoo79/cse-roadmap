import type { JSX } from 'react';
import type { CourseCode, FieldId } from '@/types/reference';

// #20 계약 스텁
export function RoadmapSearch(_props: { onSelect(code: CourseCode): void; visibleFields: FieldId[]; onChangeVisibleFields(ids: FieldId[]): void }): JSX.Element {
  void _props; return <span className="muted">과목 검색과 분야 필터를 준비 중입니다.</span>;
}
