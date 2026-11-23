# courses.json

## 이 데이터가 의미하는 것

경북대학교 학부 과목의 **사전**입니다. 과목 하나가 객체 하나이며 총 **4,198개**입니다. 두 출처를 합쳤습니다.

| `source` | 개수 | 내용 |
|---|---|---|
| `cse_curriculum_2023_2026` | 122 | 컴퓨터학부 교육과정 문서(2023~2026학년도 입학생 기준)에 한 번이라도 나온 과목. 기존 데이터 그대로 두고 아래 "2026 개설 정보" 필드만 덧붙임 |
| `knuin_2026_offering` | 4,076 | 경북대 수업시간표·강의계획서 조회(knuin.knu.ac.kr, 2026학년도 1·2학기)에 개설된 **학부 과목 중 위 122개에 없는 과목**. 교양, 일반선택(창업·현장실습 등), 타 학과 전공, 교직, 융합전공 포함. 대학원 전용 과목은 제외 |

입학년도와 전공에 관계없이 모든 곳에서 공유하는 "과목 기본 정보"만 담고 있고, 어느 전공이 몇 학년에 듣는지 같은 정보는 `curriculum.json`이 가지고 있습니다(컴퓨터학부 과목만).

다른 파일과의 관계:

```
courses.json ──(course_code)── curriculum.json          어느 전공·연도에 몇 학년 몇 학기에 듣는지
             └─(from_code / to_code)── course_relations.json   과목 간 선후수 관계
             └─(required_courses)── graduation_rules.json      졸업요건의 전공필수 목록
```

## 서비스에서 쓰이는 기능

| 기능 | 사용하는 필드 | 쓰임 |
|---|---|---|
| 온보딩: 이수 과목 체크 | `course_code`, `name_ko`, `name_variants` | 학생이 이수한 과목을 고르는 목록과 검색. 옛 표기로도 찾을 수 있게 `name_variants`도 검색 대상에 포함 |
| 로드맵 생성 (②, ④) | `name_ko`, `credit`, `credit_sys` | 로드맵 카드에 과목명·학점 표시. 과목 정보의 기준은 이 파일이고, 어느 칸에 놓을지는 `curriculum.json`이 결정 |
| 졸업요건 달성 여부 (③) | `credit` | 이수한 과목의 학점을 합산해 졸업 기준 학점과 비교 |
| 과목 상세 보기 | `name_en`, `theory`, `practice`, `practice_note` | 과목을 눌렀을 때 영문명과 이론·실습 시수 표시 |
| 다음 학기 추천 필터 | `offered_semesters`, `offering_status` | 다음 학기에 실제로 열리는 과목만 추천. `confirmed`는 개설학기로 거르고, `unknown`은 제외하지 않고 "개설 미확인" 배지를 붙여 포함 |
| 졸업 지연 위험 알림 | `offered_semesters` | 졸업 필수 과목이 한 학기에만 열리는데 그 학기를 놓치면 경고 |
| 지난 교육과정 과목 표시 (선택) | `first_year`, `last_year` | 최신 교육과정에서 빠진 과목에 "현재 교육과정에는 없음" 표시 |

이 파일만으로는 **어느 전공·학년에 배치되는지, 필수인지**를 알 수 없습니다. 그 정보는 `curriculum.json`을 함께 조회해야 합니다.

## 필드

| 필드 | 타입 | 설명 | 예시 |
|---|---|---|---|
| `course_code` | string | 과목코드. 이 파일의 기본 키(중복 없음)이며 다른 파일이 이 값으로 과목을 참조함 | `"COME0331"` |
| `name_ko` | string | 한글 과목명. 연도별 표기가 다르면 가장 최근 연도 표기 | `"자료구조"` |
| `name_en` | string | 영문 과목명 (가장 최근 연도 표기) | `"Data Structure"` |
| `credit` | number | 학점 | `3` |
| `theory` | number | 이론 시수 | `3` |
| `practice` | number \| null | 실습 시수. 숫자가 아닌 값이면 `null` | `0` |
| `practice_note` | string \| null | `practice`가 숫자가 아닐 때의 원문 값 | `null` |
| `credit_sys` | string | 원문 학점체계. `학점-이론-실습` 순서 | `"3-3-0"` |
| `kind` | string | 과목 성격. `liberal`(교양) 또는 `major`(그 외 전공·일반선택 등). 2026 교과구분에 `교양`이 있으면 `liberal`, 2026 미개설 과목은 컴퓨터학부 교육과정의 구분으로 판단. **#2에서 추가** | `"major"` |
| `first_year` | number | 이 과목이 교육과정에 처음 나타난 입학년도 | `2023` |
| `last_year` | number | 이 과목이 교육과정에 마지막으로 나타난 입학년도 | `2026` |
| `name_variants` | string[] | 연도별로 달랐던 다른 표기(한글·영문). 없으면 빈 배열 | `["소프트웨어 특강"]` |
| `offered_semesters` | number[] \| null | 개설되는 학기. `[1]`은 1학기만, `[2]`는 2학기만, `[1,2]`는 둘 다. 기록이 없으면 `null` | `[1, 2]` |
| `offering_status` | string | `confirmed`(분반 데이터로 확인) 또는 `unknown`(기록 없음). `unknown`은 "안 열림"이 아니라 "모름"이라는 뜻 | `"confirmed"` |
| `offering_basis_year` | number | 개설학기를 확인한 학년도. 현재 모두 2026 | `2026` |

### 2026 개설 정보 필드 (모든 과목에 추가)

knuin 조회 결과에서 나온 값입니다. 2026학년도 1·2학기에 개설되지 않은 과목(기존 122개 중 24개)은 `null`입니다.

| 필드 | 타입 | 설명 | 예시 |
|---|---|---|---|
| `course_types` | string[] | 2026 개설 분반에 붙은 **교과구분**. 학과마다 다르게 붙을 수 있어 배열 | `["교양"]`, `["전공","공학전공","전공필수"]`, `["일반선택"]`. 2026 미개설이면 빈 배열 |
| `liberal_area` | object \| null | 교양 영역. `group`(첨성인기초/핵심/소양), `sub`(중분류), `detail`(소분류). 교양이 아니거나 영역 분류가 없으면 `null` | `{"group":"첨성인핵심","sub":"인문사회","detail":"인간과사회"}` |
| `offering_colleges` | string[] \| null | 개설 대학 | `["IT대학"]` |
| `offering_departments` | string[] \| null | 개설 학과(전공) | `["컴퓨터학부 인공지능컴퓨팅전공"]` |
| `offered_semesters_all_depts` | number[] \| null | **모든 학과 분반**을 합친 2026 개설 학기 | `[1, 2]` |
| `section_count_2026` | object \| null | 학기별 분반 수 | `{"1": 5, "2": 7}` |
| `tags` | string[] | 비고에서 뽑은 표시: `SU평가강좌`, `SDG교과목`, `상주캠퍼스`, `원격강좌`, `거점국립대원격강좌`, `대구라이즈공유대학강좌` | `["SU평가강좌"]` |
| `startup_related` | boolean | 과목명에 "창업·기업가정신·스타트업"이 들어간 과목. **공식 창업교과목 목록이 아니라 이름 기준 후보** | `true` |
| `design_related` | boolean | 과목명에 "설계·캡스톤"이 들어간 과목. **ABEEK 설계학점 인정 여부와는 다름** | `true` |
| `design_credit` | number \| null | ABEEK 설계학점(과목별 설계 비중 학점). 설계 14학점 계산에 쓰임. 아직 자료가 없어 전부 `null`. **#2에서 추가** | `null` |
| `source` | string | 위 출처 구분 | `"knuin_2026_offering"` |

## 예시

```json
{
  "course_code": "COME0331",
  "name_ko": "자료구조",
  "name_en": "Data Structure",
  "credit": 3,
  "theory": 3,
  "practice": 0,
  "practice_note": null,
  "credit_sys": "3-3-0",
  "kind": "major",
  "course_types": ["전공", "전공필수"],
  "liberal_area": null,
  "offered_semesters": [1, 2],
  "offering_status": "confirmed",
  "offering_basis_year": 2026,
  "offered_semesters_all_depts": [1, 2],
  "section_count_2026": {"1": 3, "2": 3},
  "offering_colleges": ["IT대학"],
  "offering_departments": ["컴퓨터학부 …"],
  "tags": [],
  "startup_related": false,
  "design_related": false,
  "design_credit": null,
  "first_year": 2023,
  "last_year": 2026,
  "name_variants": [],
  "source": "cse_curriculum_2023_2026"
}
```

## 알아둘 점

- **전공, 학년, 필수 여부는 이 파일에 없습니다.** 같은 과목도 전공마다 다르므로 `curriculum.json`을 (입학년도, 전공, 과목코드)로 조회해야 합니다.
- `credit_sys`는 원문 그대로이고 `credit` / `theory` / `practice`는 이를 분해한 값입니다. 계산에는 숫자 필드를, 화면 표시에는 `credit_sys`를 쓰면 됩니다.
- `practice`가 `null`인 과목은 학교현장실습(`TCHR0522`, `"2-0-4주"`) 하나뿐이며, 이때 `practice_note`가 `"4주"`입니다.
- `first_year` / `last_year`는 **교육과정 문서에 나타난 입학년도** 범위입니다. 실제 개설 이력이 아닙니다. `last_year`가 2026보다 작은 과목은 27개로, 2026 교육과정에서는 빠진 과목입니다.
- 과목 검색을 만들 때는 `name_ko`뿐 아니라 `name_variants`도 검색 대상에 넣으면 옛 표기로 찾는 경우도 처리됩니다.
- 학점체계와 한글명(띄어쓰기 제외)이 연도 간에 서로 충돌하는 과목은 없었습니다.
- **2026학년도에 개설되지 않은 교양·타 학과 과목**(격년 개설, 폐지 과목, 예전 교양 등)은 여전히 이 사전에 없습니다. 예전에 이수한 과목을 입력할 수 있도록 서비스에서 "직접 입력" 방법을 두는 것이 좋습니다.
- 이름이 비슷하지만 코드가 다른 과목이 있습니다. `COMP0322`(데이타베이스)↔`COME0427`(데이터베이스), `COMP0204`(프로그래밍기초)↔`COMP0206`(기초프로그래밍)처럼 학부 공지로 같은 과목이 된 쌍은 `course_equivalents.json`에 있습니다. 그 밖의 비슷한 이름은 다른 과목입니다.
- **개설학기는 2026학년도 한 해 기준입니다.** 격년 개설이나 다음 해 개편으로 바뀔 수 있으니 화면에 "2026학년도 개설 기준"이라고 표시하는 것이 좋습니다.
- **기존 122개 중 `offering_status`가 `unknown`인 과목은 47개**입니다. 이 중 23개는 다른 학과 분반으로 2026년에 열려서 `offered_semesters_all_depts`에 값이 있습니다. 기존 `offered_semesters`는 바꾸지 않았으니, 컴퓨터학부 분반 기준이면 `offered_semesters`, 학교 전체 기준이면 `offered_semesters_all_depts`를 쓰면 됩니다. 정말 열리지 않는 것인지, 수집 범위(교양·공통 과목 등)에서 빠진 것인지 구분할 수 없습니다. 그래서 추천에서 빼지 않고 "개설 미확인" 배지를 붙여 보여 줍니다.
- `confirmed` 75개 중 1학기만 29개, 2학기만 28개, 두 학기 모두 18개입니다. 한 학기에만 열리는 과목이 많아 졸업 지연 위험 알림의 근거로 쓸 수 있습니다.

- **새로 추가한 4,076개**는 knuin 개설 정보로 만든 것이라 `name_en`, `first_year`, `last_year`가 `null`이고 `offering_status`는 모두 `confirmed`(2026)입니다. 한 과목코드에 학과마다 이름이 조금 다르면 첫 이름을 `name_ko`, 나머지를 `name_variants`에 넣었습니다.
- **교양 334개 중 282개는 영역(`liberal_area`)이 있고 52개는 없습니다.** 영역이 없는 것은 주로 거점국립대·대구라이즈 원격강좌(과목코드 `AAAA`, `CCCC`)와 외국어 등입니다.
- `course_types`는 **개설 학과가 붙인 이수구분**입니다. 같은 과목이 학과에 따라 `전공`·`공학전공`·`융합전공` 등으로 다르게 붙으므로, 한 학생에게 어떤 구분으로 인정되는지는 그 학생의 전공 기준(`curriculum.json`, `graduation_rules.json`)으로 판단해야 합니다.
- **창업·설계 카테고리는 공식 분류가 아닙니다.** `startup_related`(36개), `design_related`(157개)는 과목명으로 찾은 후보이니, 졸업요건 계산에 쓰기 전에 학부의 공식 창업교과목·설계교과목 목록으로 확인해야 합니다.
- 수집 기준: knuin.knu.ac.kr 「수업시간표 및 강의계획서 조회」, 2026학년도 1학기(5,791개 분반)·2학기(5,587개 분반), 2026-11-22 수집.


## #2 정규화에서 바뀐 점

- `kind`(major | liberal), `design_credit`(전부 null) 필드를 추가했습니다.
- `course_types`, `tags`, `name_variants`는 값이 없으면 `null` 대신 빈 배열입니다. `startup_related`, `design_related`는 모든 과목에 boolean으로 있습니다.
- `kind`가 `liberal`인 과목은 335개입니다. 기초수학·대학글쓰기처럼 플랫폼SW&데이터과학(ABEEK)에서 기본소양·전공기반으로 인정되는 교양 과목도 `liberal`입니다. 전공별로 어떤 학점으로 인정되는지는 `curriculum.json`의 `credit_bucket`이 정합니다.
- 필드 순서를 AGENTS.md A-4의 `Course` 타입 순서에 맞췄습니다. 값은 바꾸지 않았습니다.
