'use client';

import { useEffect, useLayoutEffect, useMemo, useRef, useState, type CSSProperties, type JSX } from 'react';
import { EmptyState } from '@/components/ui/EmptyState';
import { getCourseFields, getCurriculum, getFields, getReferenceData, getRelations } from '@/lib/reference';
import type { CourseCode } from '@/types/reference';
import type { RoadmapViewProps } from '@/types/roadmap';
import { EdgesLayer } from './edges';
import {
  COLUMN_WIDTH, HEADER_HEIGHT, LANE_PADDING, MIN_COLUMN_WIDTH, SEMESTER_COUNT, STATION_LEAD, TRACK_LEAD,
  layoutRoadmap, roadmapFieldOf,
} from './layout-roadmap';
import styles from './roadmap.module.css';

const MIN_ZOOM = 0.5;
const MAX_ZOOM = 1.75;
const ZOOM_STEP = 0.25;
/** 분야 이름 글줄 높이와, 이름과 노선 사이 띄움. */
const LANE_LABEL_LINE = 16;
const LANE_LABEL_GAP = 4;

const statusLabels = { completed: '이수 완료', inProgress: '수강 중', pending: '미이수' };

/** 1-1 ~ 4-2 여덟 학기가 스크롤 영역 폭에 모두 들어가도록 열 폭을 정한다. */
function fitColumnWidth(viewportWidth: number): number {
  const fitted = Math.floor((viewportWidth - TRACK_LEAD) / SEMESTER_COUNT);
  return Math.min(COLUMN_WIDTH, Math.max(MIN_COLUMN_WIDTH, fitted));
}

export function RoadmapView({
  programId, admissionYear, completion, recommendations, selectedCode, onSelect, showRecommendationEdges, visibleFields,
  toolbar,
}: RoadmapViewProps): JSX.Element {
  const ref = getReferenceData();
  const fields = getFields();
  const legend = useRef<HTMLDetailsElement>(null);
  const courseFields = getCourseFields();
  const curriculum = useMemo(() => getCurriculum(programId, admissionYear), [programId, admissionYear]);
  const relations = useMemo(() => getRelations(programId, admissionYear), [programId, admissionYear]);
  const [columnWidth, setColumnWidth] = useState(COLUMN_WIDTH);
  const { nodes, lanes } = useMemo(() => layoutRoadmap(
    visibleFields === undefined ? curriculum : curriculum.filter(
      (entry) => visibleFields.includes(roadmapFieldOf(entry.course_code, courseFields)),
    ),
    courseFields,
    columnWidth,
  ), [curriculum, courseFields, visibleFields, columnWidth]);
  const recommendedCodes = useMemo(() => new Set(recommendations.map(({ code }) => code)), [recommendations]);

  const [zoom, setZoom] = useState(1);
  const [viewportWidth, setViewportWidth] = useState<number | null>(null);
  const viewport = useRef<HTMLDivElement>(null);
  const nodeButtons = useRef(new Map<CourseCode, HTMLButtonElement>());

  const hasNodes = nodes.length > 0;
  useLayoutEffect(() => {
    const element = viewport.current;
    if (!element) return;
    const fit = (): void => {
      setViewportWidth(element.clientWidth);
      setColumnWidth(fitColumnWidth(element.clientWidth));
    };
    fit();
    const observer = new ResizeObserver(fit);
    observer.observe(element);
    return () => observer.disconnect();
  }, [hasNodes]);

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

  const mapWidth = TRACK_LEAD + columnWidth * SEMESTER_COUNT;
  const columns = Array.from({ length: SEMESTER_COUNT }, (_, col) => ({
    grade: Math.floor(col / 2) + 1,
    semester: col % 2 + 1,
    x: TRACK_LEAD + col * columnWidth,
  }));
  // 노선도가 화면보다 넓을 때(좁은 창·확대)만 가로 스크롤 영역이 된다. 세로는 항상 페이지 스크롤 하나로 본다.
  const scrollsX = viewportWidth !== null && mapWidth * zoom > viewportWidth + 0.5;
  const height = Math.max(HEADER_HEIGHT, ...nodes.map(({ y, height }) => y + height + LANE_PADDING));

  return (
    <section className={styles.roadmap} aria-label="수강 노선도">
      <div className={styles.frameBar}>
        <details ref={legend} className={styles.legendToggle} onKeyDown={(event) => {
          if (event.key !== 'Escape' || !legend.current?.open) return;
          legend.current.open = false;
          legend.current.querySelector('summary')?.focus();
        }}>
          <summary>범례</summary>
          <div className={styles.legendPanel}>
            <p className={styles.legendTitle}>과목 상태</p>
            <ul className={styles.legend}>
              <li><span className={styles.completedKey} aria-hidden="true" />이수 완료</li>
              <li><span className={styles.progressKey} aria-hidden="true" />수강 중</li>
              <li><span className={styles.pendingKey} aria-hidden="true" />미이수</li>
              <li><span className={styles.sparkle} aria-hidden="true">✦</span>다음 학기 추천</li>
            </ul>
            <p className={styles.legendTitle}>관계선</p>
            <ul className={styles.legend}>
              <li><span className={styles.officialKey} aria-hidden="true" />필수 선수</li>
              <li><span className={styles.recommendedKey} aria-hidden="true" />권장 선수</li>
              <li><span className={styles.coreqKey} aria-hidden="true" />동시 수강</li>
              <li><span className={styles.serviceKey} aria-hidden="true" />서비스 추천 (겹치면 우선 표시)</li>
            </ul>
          </div>
        </details>
        {toolbar && <div className={styles.frameTools}>{toolbar}</div>}
        <div className={styles.zoom} role="group" aria-label="노선도 확대·축소">
          <button type="button" className="button" aria-label="축소" disabled={zoom <= MIN_ZOOM}
            onClick={() => setZoom(Math.max(MIN_ZOOM, zoom - ZOOM_STEP))}>−</button>
          <button type="button" className="button" aria-label={`현재 ${Math.round(zoom * 100)}%. 100%로 되돌리기`}
            onClick={() => setZoom(1)}>{Math.round(zoom * 100)}%</button>
          <button type="button" className="button" aria-label="확대" disabled={zoom >= MAX_ZOOM}
            onClick={() => setZoom(Math.min(MAX_ZOOM, zoom + ZOOM_STEP))}>+</button>
          <button type="button" className="button" onClick={() => {
            if (viewport.current) setZoom(Math.min(1, viewport.current.clientWidth / mapWidth));
          }}>화면 맞춤</button>
        </div>
      </div>
      {nodes.length === 0 ? <EmptyState title="표시할 과목이 없어요">표시할 분야를 선택해 주세요.</EmptyState> : (
        <div ref={viewport} className={styles.viewport} data-scroll-x={scrollsX}
          tabIndex={scrollsX ? 0 : undefined} role="region" aria-label="학기별 노선도">
          {/* 학기 줄은 확대·축소(transform) 밖에 두어야 화면 위에 정확히 고정된다. 노선도 맨 위 칸 위에 겹쳐 놓는다. */}
          <div className={styles.termSticky}
            style={{ width: mapWidth * zoom, height: HEADER_HEIGHT * zoom, marginBottom: -HEADER_HEIGHT * zoom }}>
            <div className={styles.termRow} style={{ width: mapWidth, height: HEADER_HEIGHT, transform: `scale(${zoom})` }}>
              <span className={styles.termCorner} style={{ width: TRACK_LEAD }} aria-hidden="true" />
              {columns.map(({ grade, semester, x }) => (
                <span key={x} className={styles.term} data-even-grade={grade % 2 === 0} style={{ width: columnWidth }}>
                  {grade}학년 {semester}학기
                </span>
              ))}
            </div>
          </div>
          <div className={styles.sizer} style={{ width: mapWidth * zoom, height: height * zoom }}>
            <div className={styles.map} data-zoomed={zoom !== 1} style={{ width: mapWidth, height, transform: `scale(${zoom})` }} data-roadmap-map>
              {columns.map(({ grade, x }) => (
                <div key={x} className={styles.column} data-even-grade={grade % 2 === 0}
                  style={{ left: x, width: columnWidth }} aria-hidden="true" />
              ))}
              {lanes.map(({ fieldId, row }) => {
                const field = fields.find(({ field_id }) => field_id === fieldId);
                const stations = nodes.filter((node) => node.row === row);
                const top = stations[0].y;
                const bottom = Math.max(...stations.map((node) => node.y + node.height));
                const trackTop = LANE_PADDING + stations[0].height / 2 - 1.5;
                return (
                  <div key={fieldId} className={styles.lane} aria-label={field?.name_ko}
                    style={{
                      top: top - LANE_PADDING, height: bottom - top + LANE_PADDING * 2,
                      '--field-light': field?.color, '--field-dark': field?.color_dark ?? field?.color,
                    } as CSSProperties}>
                    {/* 노선은 첫 줄 카드의 세로 가운데(역 점·선이 닿는 높이)를 지난다. 3px 선의 절반만큼 올린다. */}
                    <span className={styles.track} style={{ left: 4, top: trackTop }} aria-hidden="true" />
                    {/* 1-1학기 앞 여백에서 노선 바로 위에 분야 이름을 살짝 띄워 단다. 가로 스크롤 중에도 왼쪽에 붙어 있다. */}
                    <h3 className={styles.laneLabel}
                      style={{ marginTop: trackTop - LANE_LABEL_GAP - LANE_LABEL_LINE, height: LANE_LABEL_LINE }}>
                      <span className={styles.laneDot} aria-hidden="true" />{field?.name_ko}
                    </h3>
                    {stations.map((node) => {
                      const course = ref.courses.get(node.code);
                      const status = completion.isCompleted(node.code) ? 'completed'
                        : completion.inProgress.has(completion.canonicalOf(node.code)) ? 'inProgress' : 'pending';
                      const isRecommended = recommendedCodes.has(node.code);
                      const selected = selectedCode === node.code;
                      const offset = node.y - top;
                      return (
                        <div key={node.code} className={styles.station} data-roadmap-node={node.code} data-status={status}
                          style={{
                            left: node.x, top: offset + LANE_PADDING, width: node.width, height: node.height,
                            '--station-lead': `${STATION_LEAD}px`,
                          } as CSSProperties}>
                          {/* 카드 왼쪽 자리에 지선과 역 점을 그려, 카드에 가려지지 않게 한다. */}
                          {offset > 0 && <span className={styles.spur} style={{ height: offset }} aria-hidden="true" />}
                          <span className={styles.stationDot} aria-hidden="true" />
                          <button type="button" aria-pressed={selected} data-status={status}
                            className={styles.node} title={`${course?.name_ko ?? node.code} (${node.code})`}
                            ref={(button) => {
                              if (button) nodeButtons.current.set(node.code, button);
                              else nodeButtons.current.delete(node.code);
                            }}
                            onClick={() => onSelect(selected ? null : node.code)}>
                            <span className={styles.courseName}>{course?.name_ko ?? node.code}</span>
                            <span className={styles.nodeMeta}>{course?.credit == null ? '학점 미확인' : `${course.credit}학점`}</span>
                            {/* 상태는 왼쪽 점으로 보여주고, 화면 읽기 프로그램에는 과목코드와 함께 읽어 준다. */}
                            <span className={styles.srOnly}>{node.code} {statusLabels[status]}</span>
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
