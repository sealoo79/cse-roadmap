# 데이터 사전 (data dictionary)

cse-roadmap의 **기준 데이터**(`data/*.json`) 전체 지도입니다. 기준 데이터는 repo에 JSON으로 두고 빌드에 번들하며, 사용자 데이터만 Supabase에 저장합니다(ERD I-1). 필드별 상세 설명은 각 파일 옆의 `.md`를 보세요. 타입 정의는 `AGENTS.md` A-4가 기준입니다.

## 파일 목록

| 파일 | 행 수 | 기본 키 | 담는 내용 | 담당 이슈 |
|---|---|---|---|---|
| `programs.json` | 5 | `program_id` | 전공 5개와 학번별 교육과정 자료 상태 | #2 |
| `courses.json` | 4,198 | `course_code` | 과목 사전(전공·교양·타 학과 포함, `kind`) | #2 |
| `curriculum.json` | 598 | (`admission_year`, `program_id`, `course_code`) | 전공·학번별 교육과정 배치, `credit_bucket`, 전공필수 | #2 |
| `course_relations.json` | 25 | `id` | 선후수(official)·권장(recommended)·동시수강(coreq) | #2 |
| `course_equivalents.json` | 11 | `equivalent_id` | 구·신 동일과목 대응 | #2 |
| `graduation_rules.json` | 8 | `rule_id` | 학번 범위별 졸업요건(univ 공통 + 전공) | #2 |
| `requirement_courses.json` | 28 | `requirement_id` | 졸업요건 항목별 인정 과목(1:N) | #2 |
| `fields.json` | - | `field_id` | 관심 분야 5개 | #3 |
| `course_fields.json` | - | `course_code` | 과목별 대표·복수 분야 | #3 |
| `checklist.json` | - | `checklist_key` | 비학점 요건 키 정의 | #3 |

## 관계

```
programs ─program_id─┬─ curriculum ─course_code─ courses
                     ├─ course_relations (from_code, to_code → courses)
                     ├─ graduation_rules ─required_courses─ courses
                     │        └─ checklist[].key ─ checklist (#3)
                     └─ requirement_courses ─courses[]─ courses
                                └─ checklist_key ─ checklist (#3)
course_equivalents (old_code, new_code → courses)
course_fields (#3) ─course_code─ courses, ─field_id─ fields (#3)
```

사용자 테이블(Supabase)은 기준 데이터를 **DB FK 없이 키 값으로** 참조합니다: `profiles.program_id`, `enrollments.course_code`, `user_interests.field_id`, `noncredit_status.checklist_key`. 저장 전에 앱 코드에서 키가 JSON에 있는지 검사합니다.

## 고정 키 (바꾸지 않음)

| 키 | 값 |
|---|---|
| `program_id` | `platform_sw_data`, `global_sw`, `ai_computing`, `adv_computing`, `adv_research` (+ 규칙 전용 `univ`) |
| `admission_year` | 2023~2026 |
| `course_code` | `^[A-Z]{4}\d{4}$` |
| `credit_bucket` | `basic_literacy`, `major_base`, `engineering_major`, `major`, `liberal`, `general_elective`, `teaching` |
| 규칙 버킷 | 위 7개 + `design`, `graduate_courses`, `abeek_total` |
| `rule_id` | `univ__2023`, `univ__2024_2026`, `platform_sw_data__2023_2025`, `global_sw__2023_2025`, `ai_computing__2023_2025`, `adv_computing__2026`, `ai_computing__2026`, `adv_research__2026` |
| `checklist_key` | `english_score`, `field_practice`, `research_practice`, `research_activity`, `graduation_review`, `topcit`, `portfolio`, `gq_practical_english`, `gq_software`, `gq_counseling`, `gq_major_area` |

## 졸업요건 계산에 쓰는 순서 (요약)

1. 학생의 `program_id`, `admission_year`로 `graduation_rules`에서 univ 행 1개와 전공 행 1개를 찾는다.
2. 이수 기록을 `courses.json`·`course_equivalents.json`으로 정리한다(F 제외, 재수강 최신 1건, 동일과목 1회).
3. 같은 전공·학번의 `curriculum.json` 행으로 과목마다 `credit_bucket`을 붙여 버킷별 학점을 합산하고 `credit_buckets.min_credits`와 비교한다. 전공 학점은 그 교육과정 안의 과목만 인정한다(D09).
4. `required_courses`와 `requirement_courses`(같은 전공·학번, `counts_for_graduation: true`)로 과목 요건을 판정한다.
5. `checklist`는 자동 판정하지 않고 학생 입력(`noncredit_status`)으로 met / unmet / 미입력을 표시한다.

## 확인이 필요한 항목

각 파일의 `needs_confirmation`, `note`에 원문으로 확정하지 못한 해석을 적었습니다. 대표 항목:
- 플랫폼SW&데이터과학 전공 65학점(학칙)과 ABEEK 공학전공 60학점의 관계
- 병합 셀로 해석한 졸업학점(140 / 130)
- 과목별 설계학점(`courses.design_credit`, 전부 null)
- 첨단컴퓨팅연구 대학원 교과목 9학점의 대상 과목
- 구과목 이수가 신과목 전공필수를 충족하는지(`course_equivalents.counts_for_required`)
- 종합설계프로젝트1 선수 관계의 AND/OR(`course_relations` id 4·7)
- SDG교양의 2023학번 적용 여부, 글솝 2025 졸업요건의 2023~2024학번 적용 여부
