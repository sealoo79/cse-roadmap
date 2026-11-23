# programs.json

## 이 데이터가 의미하는 것

**컴퓨터학부의 전공(프로그램) 목록**과, 각 전공이 어느 입학년도에 있고 그 학번의 교육과정 자료가 있는지를 담은 파일입니다. 전공 하나가 객체 하나이며 총 5개입니다.

온보딩에서 입학년도를 고르면 그 연도에 있는 전공만 보여주고, 교육과정 자료가 없는 학번은 "준비 중"으로 안내하는 데 씁니다. 다른 파일에서 쓰는 `program_id`의 기준 목록이기도 합니다.

```
programs.json ──(program_id)── curriculum.json
              ├─(program_id)── graduation_rules.json
              ├─(program_id)── course_relations.json
              └─(program_id)── requirement_courses.json (program_ids)
```

## 서비스에서 쓰이는 기능

| 기능 | 사용하는 필드 | 쓰임 |
|---|---|---|
| 온보딩: 입학년도·전공 선택 | `program_id`, `name`, `years[].admission_year` | 학생이 고른 입학년도가 `years`에 있는 전공만 보여줌 |
| 자료 없음 안내 | `years[].curriculum_status`, `note` | `missing`이면 노선도 대신 "교육과정 자료 준비 중" 안내 |
| 화면의 전공 이름 표시 | `name` | "23학번 · ○○전공" 같은 표시 |
| 다른 JSON 조회의 기준 | `program_id` | `curriculum`, `graduation_rules`, `course_relations`를 거르는 키 |

## 필드

| 필드 | 타입 | 설명 | 예시 |
|---|---|---|---|
| `program_id` | string | 전공 식별자(고정 키). 다른 파일과 사용자 DB(`profiles.program_id`)가 이 값으로 참조하므로 바꾸지 않음 | `"ai_computing"` |
| `name` | string | 전공 이름 | `"인공지능컴퓨팅전공"` |
| `college` | string | 소속 | `"컴퓨터학부"` |
| `years` | object[] | 이 전공이 있는 입학년도와 교육과정 자료 상태 | 아래 참고 |
| `years[].admission_year` | number | 입학년도 | `2026` |
| `years[].curriculum_status` | string | `available`(교육과정 자료 있음) · `assumed`(다른 연도·문서로 대신함) · `missing`(자료 없음) | `"missing"` |
| `note` | string \| null | 보충 설명 | `"2023~2025 교육과정 자료 없음(2026만 있음)"` |

## 전공 목록

| `program_id` | 전공 | 교육과정 자료 있음 | 자료 없음 |
|---|---|---|---|
| `platform_sw_data` | 플랫폼SW&데이터과학전공 | 2023~2025 | - |
| `global_sw` | 글로벌SW융합전공 | 2023~2025 | - |
| `ai_computing` | 인공지능컴퓨팅전공 | 2026 | 2023~2025 |
| `adv_computing` | 심화컴퓨팅전공 | 2026 | - |
| `adv_research` | 첨단컴퓨팅연구전공 | 2026 | - |

입학년도별로 보여줄 전공:
- 2023~2025학번: 플랫폼SW&데이터과학, 글로벌SW융합, 인공지능컴퓨팅
- 2026학번: 인공지능컴퓨팅, 심화컴퓨팅, 첨단컴퓨팅연구

## 예시

```json
{
  "program_id": "ai_computing",
  "name": "인공지능컴퓨팅전공",
  "college": "컴퓨터학부",
  "years": [
    {
      "admission_year": 2023,
      "curriculum_status": "missing"
    },
    {
      "admission_year": 2024,
      "curriculum_status": "missing"
    },
    {
      "admission_year": 2025,
      "curriculum_status": "missing"
    },
    {
      "admission_year": 2026,
      "curriculum_status": "available"
    }
  ],
  "note": "2023~2025 교육과정 자료 없음(2026만 있음)"
}
```

## 알아둘 점

- 학생이 "2024학번"을 고르면 `years`에 2024가 있는 전공만 보여주면 됩니다.
- `curriculum_status`가 `missing`이면 노선도를 만들 수 없으므로 "교육과정 자료 준비 중"으로 안내합니다. 지금은 인공지능컴퓨팅 2023~2025가 그렇습니다. 이 학번의 졸업요건은 `graduation_rules.json`의 `ai_computing__2023_2025`(학점 기준만)를 씁니다.
- `platform_sw_data`의 교육과정은 심화컴퓨터공학프로그램(ABEEK) 교육과정표(2023~2025)를 사용했습니다(사용자 확인, `note`).
- `assumed`는 지금 데이터에 없지만, 다른 학번 문서를 대신 쓰기로 정하면 이 값으로 표시합니다.

## #2 정규화에서 바뀐 점

- 옛 연도 배열(`offered_years`, `curriculum_years`, `missing_curriculum_years`)을 없애고 `years: [{admission_year, curriculum_status}]` 하나로 합쳤습니다. 옛 배열은 `years`에서 계산할 수 있습니다.
