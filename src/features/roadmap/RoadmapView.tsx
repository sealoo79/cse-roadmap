'use client';

import { useEffect, useMemo, useRef, useState, type CSSProperties, type JSX } from 'react';
import { EmptyState } from '@/components/ui/EmptyState';
import { getCourseFields, getCurriculum, getFields, getReferenceData, getRelations } from '@/lib/reference';
import type { CourseCode } from '@/types/reference';
import type { RoadmapViewProps } from '@/types/roadmap';
import { EdgesLayer } from './edges';
import {
  COLUMN_WIDTH, HEADER_HEIGHT, LABEL_WIDTH, LANE_PADDING, SEMESTER_COUNT, layoutRoadmap, roadmapFieldOf,
} from './layout-roadmap';
import styles from './roadmap.module.css';

const MAP_WIDTH = LABEL_WIDTH + COLUMN_WIDTH * SEMESTER_COUNT;
const MIN_ZOOM = 0.5;
const MAX_ZOOM = 1.75;
const ZOOM_STEP = 0.25;

const statusLabels = { completed: '이수 완료', inProgress: '수강 중', pending: '미이수' };
const columns = Array.from({ length: SEMESTER_COUNT }, (_, col) => ({
  grade: Math.floor(col / 2) + 1,
  semester: col % 2 + 1,
  x: LABEL_WIDTH + col * COLUMN_WIDTH,
}));

export function RoadmapView({
  programId, admissionYear, completion, recommendations, selectedCode, onSelect, showRecommendationEdges, visibleFields,
}: RoadmapViewProps): JSX.Element {
  const ref = getReferenceData();
  const fields = getFields();
  const courseFields = getCourseFields();
  const curriculum = useMemo(() => getCurriculum(programId, admissionYear), [programId, admissionYear]);
  const relations = useMemo(() => getRelations(programId, admissionYear), [programId, admissionYear]);
  const { nodes, lanes } = useMemo(() => layoutRoadmap(
    visibleFields === undefined ? curriculum : curriculum.filter(
      (entry) => visibleFields.includes(roadmapFieldOf(entry.course_code, courseFields)),
    ),
    courseFields,
  ), [curriculum, courseFields, visibleFields]);
  const recommendedCodes = useMemo(() => new Set(recommendations.map(({ code }) => code)), [recommendations]);

  const [zoom, setZoom] = useState(1);
  const viewport = useRef<HTMLDivElement>(null);
  const nodeButtons = useRef(new Map<CourseCode, HTMLButtonElement>());

  useEffect(() => {
    if (selectedCode) nodeButtons.current.get(selectedCode)?.scrollIntoView({ block: 'nearest', inline: 'nearest' });
  }, [selectedCode, nodes]);

  const program = ref.programs.find(({ program_id }) => program_id === programId);
  const year = program?.years.find(({ admission_year }) => admission_year === admissionYear);
  if (year?.curriculum_status === 'missing' || curriculum.length === 0) {
    return <EmptyState title="교육과정 자료가 없어요">
      {program?.name ?? '선택한 전공'} {admissionYear}학번의 교육과정을 확인할 수 없습니다.
    </EmptyState>;
  }

  const height = Math.max(HEADER_HEIGHT, ...nodes.map(({ y, height }) => y + height + LANE_PADDING));

  return (
    <section className={styles.roadmap} aria-label="수강 노선도">
      <div className={styles.tools}>
        <div className={styles.legends}>
          <ul className={styles.legend} aria-label="과목 상태 범례">
            <li><span className={styles.completedKey} aria-hidden="true" />이수 완료</li>
            <li><span className={styles.progressKey} aria-hidden="true" />수강 중</li>
            <li><span className={styles.pendingKey} aria-hidden="true" />미이수</li>
            <li><span className={styles.sparkle} aria-hidden="true">✦</span>다음 학기 추천</li>
          </ul>
          <ul className={styles.legend} aria-label="관계선 범례">
            <li><span className={styles.officialKey} aria-hidden="true" />필수 선수</li>
            <li><span className={styles.recommendedKey} aria-hidden="true" />권장 선수</li>
            <li><span className={styles.coreqKey} aria-hidden="true" />동시 수강</li>
            <li><span className={styles.serviceKey} aria-hidden="true" />서비스 추천 (겹치면 우선 표시)</li>
          </ul>
        </div>
        <div className={styles.zoom} role="group" aria-label="노선도 확대·축소">
          <button type="button" className="button" aria-label="축소" disabled={zoom <= MIN_ZOOM}
            onClick={() => setZoom(Math.max(MIN_ZOOM, zoom - ZOOM_STEP))}>−</button>
          <button type="button" className="button" aria-label={`현재 ${Math.round(zoom * 100)}%. 100%로 되돌리기`}
            onClick={() => setZoom(1)}>{Math.round(zoom * 100)}%</button>
          <button type="button" className="button" aria-label="확대" disabled={zoom >= MAX_ZOOM}
            onClick={() => setZoom(Math.min(MAX_ZOOM, zoom + ZOOM_STEP))}>+</button>
          <button type="button" className="button" onClick={() => {
            if (viewport.current) setZoom(Math.min(1, viewport.current.clientWidth / MAP_WIDTH));
          }}>화면 맞춤</button>
        </div>
      </div>
      <ul className={styles.fieldLegend} aria-label="분야별 노선 범례">
        {fields.map((field) => <li key={field.field_id} style={{
          '--field-light': field.color, '--field-dark': field.color_dark ?? field.color,
        } as CSSProperties}><span aria-hidden="true" />{field.name_ko}</li>)}
      </ul>
      {nodes.length === 0 ? <EmptyState title="표시할 과목이 없어요">표시할 분야를 선택해 주세요.</EmptyState> : (
        <div ref={viewport} className={styles.viewport} tabIndex={0} role="region" aria-label="학기별 노선도 스크롤 영역">
          <div className={styles.sizer} style={{ width: MAP_WIDTH * zoom, height: height * zoom }}>
            <div className={styles.map} style={{ width: MAP_WIDTH, height, transform: `scale(${zoom})` }} data-roadmap-map>
              {columns.map(({ grade, semester, x }) => (
                <div key={x} className={styles.column} data-even-grade={grade % 2 === 0}
                  style={{ left: x, width: COLUMN_WIDTH }}>
                  <span className={styles.term} style={{ height: HEADER_HEIGHT }}>{grade}학년 {semester}학기</span>
                </div>
              ))}
              {lanes.map(({ fieldId, row }) => {
                const field = fields.find(({ field_id }) => field_id === fieldId);
                const stations = nodes.filter((node) => node.row === row);
                const top = stations[0].y;
                const bottom = Math.max(...stations.map((node) => node.y + node.height));
                return (
                  <div key={fieldId} className={styles.lane} aria-label={field?.name_ko}
                    style={{
                      top: top - LANE_PADDING, height: bottom - top + LANE_PADDING * 2,
                      '--field-light': field?.color, '--field-dark': field?.color_dark ?? field?.color,
                    } as CSSProperties}>
                    <h3 className={styles.laneLabel} style={{ width: LABEL_WIDTH }}>{field?.name_ko}</h3>
                    <span className={styles.track} style={{ left: LABEL_WIDTH }} aria-hidden="true" />
                    {stations.map((node) => {
                      const course = ref.courses.get(node.code);
                      const status = completion.isCompleted(node.code) ? 'completed'
                        : completion.inProgress.has(completion.canonicalOf(node.code)) ? 'inProgress' : 'pending';
                      const isRecommended = recommendedCodes.has(node.code);
                      const offered = course?.offered_semesters;
                      const selected = selectedCode === node.code;
                      const offset = node.y - top;
                      return (
                        <div key={node.code} className={styles.station} data-roadmap-node={node.code}
                          style={{ left: node.x, top: offset + LANE_PADDING, width: node.width, height: node.height }}>
                          {offset > 0 && <span className={styles.spur} style={{ height: offset }} aria-hidden="true" />}
                          <button type="button" aria-pressed={selected} data-status={status}
                            className={styles.node} title={course?.name_ko ?? node.code}
                            ref={(button) => {
                              if (button) nodeButtons.current.set(node.code, button);
                              else nodeButtons.current.delete(node.code);
                            }}
                            onClick={() => onSelect(selected ? null : node.code)}>
                            <span className={styles.stationDot} aria-hidden="true" />
                            <span className={styles.courseName}>{course?.name_ko ?? node.code}</span>
                            <span className={styles.nodeMeta}>{node.code} · {course?.credit == null ? '학점 미확인' : `${course.credit}학점`}</span>
                            <span className={styles.nodeFoot}>
                              <span className={styles.status}>{statusLabels[status]}</span>
                              {offered?.length ? <span className={styles.offered}>{offered.join('·')}학기 개설</span> : null}
                            </span>
                            {isRecommended && <span className={styles.recommendation}>
                              <span className={styles.sparkle} aria-hidden="true">✦</span><span className={styles.srOnly}>다음 학기 추천</span>
                            </span>}
                          </button>
                        </div>
                      );
                    })}
                  </div>
                );
              })}
              <div className={styles.edges}>
                <EdgesLayer nodes={nodes} relations={relations} recommendations={recommendations}
                  completion={completion} selectedCode={selectedCode} showRecommendationEdges={showRecommendationEdges} />
              </div>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
