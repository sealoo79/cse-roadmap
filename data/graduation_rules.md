# graduation_rules.json

## 이 데이터가 의미하는 것

**입학년도·전공별 졸업요건**입니다. 한 행이 "어떤 학번 범위의 어떤 전공(또는 전 전공 공통)에 적용되는 규칙" 하나이며 총 8행입니다.

학생 한 명에게는 **두 행이 함께 적용**됩니다.
1. `program_id: "univ"` 행: 전 전공 공통 기준(교양 30학점, 졸업자격인정제)
2. 학생 전공의 행: 총 졸업학점, 전공 학점, 전공필수, 학과 비학점 요건

두 기준을 모두 충족해야 하고, 같은 항목은 더 엄격한 값을 따릅니다. 다만 플랫폼SW&데이터과학(ABEEK)은 `follows_university_credit_rules: false`라서 **학점 기준은 ABEEK 버킷만** 쓰고(교양 30학점 대신 기본소양·전공기반 등), 졸업자격인정제(univ 행의 `checklist`)는 그대로 적용합니다.

교양 영역별 필수(첨성인기초·핵심, SDG), 창업·종합설계·현장실습처럼 **과목 목록이 필요한 요건**은 `requirement_courses.json`에 있습니다.

```
graduation_rules.json ──(required_courses)── courses.json
                      ├─(program_id + admission_year 범위)── curriculum.json (credit_bucket ↔ credit_buckets.bucket_id)
                      ├─(checklist[].key)── checklist.json (#3)
                      └─ requirement_courses.json (같은 program_id·학번)
```

## 규칙 목록

| `rule_id` | 적용 | 학번 | 총 학점 | 학점 버킷(최소) | 전공필수 | 비학점 요건 |
|---|---|---|---|---|---|---|
| `univ__2023` | 전 전공 공통 | 2023 | - | liberal 30 | 0 | gq_practical_english, gq_software, gq_counseling, gq_major_area |
| `univ__2024_2026` | 전 전공 공통 | 2024~2026 | - | liberal 30 | 0 | gq_practical_english, gq_software, gq_counseling, gq_major_area |
| `platform_sw_data__2023_2025` | 플랫폼SW&데이터과학전공 | 2023~2025 | 140 | abeek_total 93, basic_literacy 15, major_base 18, engineering_major 60, design 14 | 12 | english_score, field_practice, portfolio, topcit |
| `global_sw__2023_2025` | 글로벌SW융합전공 | 2023~2025 | 130 | major 51, liberal 30 | 4 | english_score, field_practice |
| `ai_computing__2023_2025` | 인공지능컴퓨팅전공 | 2023~2025 | 140 | major 72 | 0 | - |
| `adv_computing__2026` | 심화컴퓨팅전공 | 2026 | 130 | major 72, liberal 30 | 4 | english_score, research_practice, graduation_review |
| `ai_computing__2026` | 인공지능컴퓨팅전공 | 2026 | 130 | major 72 | 7 | field_practice |
| `adv_research__2026` | 첨단컴퓨팅연구전공 | 2026 | 130 | major 72, liberal 30, graduate_courses 9 | 4 | english_score, research_activity, graduation_review |

## 필드

| 필드 | 타입 | 설명 |
|---|---|---|
| `rule_id` | string | 고정 키. `{program_id 또는 univ}__{시작연도}[_{끝연도}]` |
| `program_id` | string | 전공 또는 `"univ"`(전 전공 공통) |
| `admission_year_from` / `admission_year_to` | number | 적용 입학년도 범위(양 끝 포함) |
| `total_credits` | number \| null | 총 졸업학점. univ 행은 학과마다 달라 `null` |
| `credit_buckets` | object[] | 학점 기준. `bucket_id`는 `curriculum.json`의 `credit_bucket`과 같은 키(+ `design`, `graduate_courses`, `abeek_total`), `label`, `min_credits` |
| `credits` | object | 원본 학점 표기(레거시). **계산에 쓰지 않음** |
| `required_courses` | string[] | 전공필수 과목코드. `curriculum.json`의 `is_required`와 같음 |
| `checklist` | object[] | 비학점 요건. `key`(checklist_key), `rule`(원문 요약), `input_type`(boolean·number·text·date), `auto_judgeable`(항상 false) |
| `default_major_type` | `"single"` | 기본 단일전공 기준 |
| `follows_university_credit_rules` | boolean | false면 대학 공통 학점 기준(교양 30 등) 대신 이 행의 버킷만 적용(ABEEK) |
| `tracks` | object[] | (글솝만) 졸업 트랙 원문 |
| `needs_confirmation` | string[] | 원문으로 확정하지 못한 해석 |
| `source` / `note` | string | 근거 문서 / 보충 설명 |
| `legacy` | object | 원본 행의 `other_requirements` 등 옛 필드(추적용, 계산에 쓰지 않음) |

## 예시 (2026 심화컴퓨팅)

```json
{
  "rule_id": "adv_computing__2026",
  "program_id": "adv_computing",
  "admission_year_from": 2026,
  "admission_year_to": 2026,
  "total_credits": 130,
  "credit_buckets": [
    {
      "bucket_id": "major",
      "label": "전공(단일전공 기준)",
      "min_credits": 72
    },
    {
      "bucket_id": "liberal",
      "label": "교양",
      "min_credits": 30
    }
  ],
  "credits": {
    "major": 72,
    "liberal": 30,
    "other": 28
  },
  "required_courses": [
    "COME0331",
    "COMP0206",
    "COMP0319",
    "ITEC0401"
  ],
  "checklist": [
    {
      "key": "english_score",
      "rule": "토익 700점 이상 또는 이에 상응하는 공인 영어성적",
      "input_type": "number",
      "auto_judgeable": false
    },
    {
      "key": "research_practice",
      "rule": "연구실습 3학점 이상 또는 현장실습대체인정",
      "input_type": "boolean",
      "auto_judgeable": false
    },
    {
      "key": "graduation_review",
      "rule": "전공 학업역량평가 응시",
      "input_type": "boolean",
      "auto_judgeable": false
    }
  ],
  "default_major_type": "single",
  "follows_university_credit_rules": true,
  "needs_confirmation": [
    "다전공 시 전공 54학점 기준(전공과목 이수 내용 hwp)은 단일전공 기본값이라 버킷에 넣지 않음"
  ],
  "source": "2026 심화컴퓨팅전공 안내 · 2026 전공과목 이수 내용(학사안내 첨부 hwp, 학칙 제44조)",
  "note": null
}
```

## 조회 방법

```
univ_rule   = rules.find(r => r.program_id == "univ" && from <= 학번 <= to)
major_rule  = rules.find(r => r.program_id == 학생 전공 && from <= 학번 <= to)
```
모든 전공·학번 조합에 두 행이 정확히 하나씩 있습니다(검증 스크립트로 확인).

## 확인 필요 (`needs_confirmation`)

- `univ__2023`: SDG교양 3학점의 2023학번 적용 여부: hwp 표의 병합 셀이 모호함. 홈페이지 학사안내 기준(2024학번부터)에 따라 2023학번은 미적용으로 둠
- `platform_sw_data__2023_2025`: 전공과목 이수 내용(hwp)의 플랫폼소프트웨어·데이터과학 전공 65학점과 ABEEK 공학전공 60학점의 관계 / 총 졸업학점 140학점은 졸업학점 표의 병합 셀(컴퓨터학부(글솝 제외))을 해석한 값 / 설계 14학점은 과목별 설계학점(courses.design_credit)이 아직 없어 계산 불가 / 전공영역 평가(gq_major_area)를 컴퓨터학부가 실시하는지
- `global_sw__2023_2025`: 원본은 2025 졸업요건 문서 1건뿐임. 종합설계 요건의 "2022학번부터" 표기를 근거로 2023~2024학번에도 같은 기준을 적용함 / 트랙 선택·글로벌역량(해외대학 인정 학점, 복수학위)·다중전공 이수는 checklist 키가 없어 tracks 원문으로만 둠 (#3에 키 추가 필요) / 총 130학점·종합설계 3학점·전공 51학점·교양 30학점은 표의 병합 셀을 세 트랙 공통으로 해석한 값
- `ai_computing__2023_2025`: 2023~2025 교육과정·학과 졸업요건 문서가 없음. 전공 학점(단일 72 / 다전공 54)은 전공과목 이수 내용(hwp), 총 140학점은 졸업학점 표의 병합 셀(컴퓨터학부(글솝 제외)) 해석값 / 전공필수 과목과 학과 비학점 요건(영어·현장실습 등)을 확인해야 함
- `adv_computing__2026`: 다전공 시 전공 54학점 기준(전공과목 이수 내용 hwp)은 단일전공 기본값이라 버킷에 넣지 않음
- `ai_computing__2026`: 영어성적 요건은 졸업자격인정제 실용영어 영역(univ 행 gq_practical_english)으로 갈음되어 별도 항목을 두지 않음 / 다전공 시 전공 54학점 기준(전공과목 이수 내용 hwp)은 단일전공 기본값이라 버킷에 넣지 않음
- `adv_research__2026`: 대학원 교과목 9학점의 대상 과목(requirement_courses.json의 graduate_courses__adv_research__2026, 학과 확인 필요) / 다전공 시 전공 54학점 기준(전공과목 이수 내용 hwp)은 단일전공 기본값이라 버킷에 넣지 않음

## #2 정규화에서 바뀐 점

- `rule_id`, `admission_year_from/to`를 추가하고, 내용이 같은 행을 학번 범위로 합쳤습니다(플랫폼SW&데이터과학 2023~2025 3행 → 1행).
- **univ 행 2개 추가**(`univ__2023`, `univ__2024_2026`): 교양 30학점, 졸업자격인정제 4개 영역(`gq_practical_english`, `gq_software`, `gq_counseling`, `gq_major_area`). 근거는 교양과목 이수 내용(hwp)과 학사안내 졸업자격인정제 페이지입니다. SDG교양 적용 시작 학번 때문에 2023과 2024~2026을 나눴습니다.
- **`ai_computing__2023_2025` 추가**: 교육과정 자료는 없지만 학칙(hwp)의 전공 학점(단일 72 / 다전공 54)과 총 140학점(병합 셀 해석)으로 학점 기준만 둡니다.
- 글로벌SW융합은 원본이 2025 문서 1행이라 `global_sw__2023_2025`로 2023~2024에도 적용했습니다(확인 필요).
- `credits`의 전공마다 다른 키를 `credit_buckets`로 표준화했습니다. `credits`는 레거시로 남깁니다.
- `other_requirements`를 `checklist`(고정 키)로 바꿨습니다. 졸업자격인정제 항목은 univ 행으로 옮겼고, 원문은 `legacy`에 남깁니다.
- 다전공 기준 학점(54학점)은 단일전공 기본값이라 버킷에 넣지 않았습니다.
