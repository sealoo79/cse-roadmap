# checklist.json

## 이 데이터가 의미하는 것

**비학점 졸업요건 항목의 정의**입니다. 영어 성적, 현장실습, 졸업심사, 졸업자격인정제처럼 과목 학점으로 계산할 수 없는 요건을 키 하나로 표현합니다.

항목 **정의**(라벨, 입력 방식)는 이 파일에, **어느 전공·학번에 어떤 기준으로 적용되는지**는 `graduation_rules.json`의 `checklist[]`(`key`, `rule`)에 있습니다. 학생의 입력 상태는 Supabase `noncredit_status`에 저장합니다.

```
checklist.json ──(checklist_key)── graduation_rules.json (checklist[].key)
               ├─(checklist_key)── requirement_courses.json (checklist_key)
               └─(checklist_key)── noncredit_status (Supabase, 학생 입력)
```

## 서비스에서 쓰이는 기능

| 기능 | 사용하는 필드 | 쓰임 |
|---|---|---|
| 비학점 요건 입력 (#17 등) | `label`, `input_type`, `help` | 항목 이름, 입력 컨트롤 종류, 도움말 |
| 졸업요건 계산 (#12) | `checklist_key` | 학생 입력을 `met` · `unmet` · `unanswered`로 판정. 자동 판정하지 않음 |

## 필드

| 필드 | 타입 | 설명 |
|---|---|---|
| `checklist_key` | string | 고정 키(AGENTS.md A-3) |
| `label` | string | 화면 표시 이름 |
| `input_type` | string | `boolean` · `number` · `text` · `date`. `graduation_rules`의 같은 키 `input_type`과 같음 |
| `source` | string | 요건 출처 |
| `help` | string | 입력 화면 도움말. **옵셔널 추가 필드** |

## 항목 목록

| 키 | 라벨 | 입력 | 출처 | 쓰는 규칙 |
|---|---|---|---|---|
| `english_score` | 공인영어 성적 | number | 학과 졸업요건(플랫폼SW&데이터과학·글로벌SW융합·심화컴퓨팅·첨단컴퓨팅연구) | `platform_sw_data__2023_2025`, `global_sw__2023_2025`, `adv_computing__2026`, `adv_research__2026` |
| `field_practice` | 현장실습 이수 | boolean | 학과 졸업요건(플랫폼SW&데이터과학·글로벌SW융합·인공지능컴퓨팅) | `platform_sw_data__2023_2025`, `global_sw__2023_2025`, `ai_computing__2026` |
| `research_practice` | 연구실습 이수 | boolean | 학과 졸업요건(심화컴퓨팅) | `adv_computing__2026` |
| `research_activity` | 연구 활동 | boolean | 학과 졸업요건(첨단컴퓨팅연구) | `adv_research__2026` |
| `graduation_review` | 졸업심사 | boolean | 학과 졸업요건(심화컴퓨팅·첨단컴퓨팅연구) | `adv_computing__2026`, `adv_research__2026` |
| `topcit` | TOPCIT 성적표 제출 | boolean | ABEEK 졸업심사(플랫폼SW&데이터과학) | `platform_sw_data__2023_2025` |
| `portfolio` | 포트폴리오 제출 | boolean | ABEEK 졸업심사(플랫폼SW&데이터과학) | `platform_sw_data__2023_2025` |
| `gq_practical_english` | 졸업자격인정제 · 실용영어 | boolean | 경북대 졸업자격인정제 | `univ__2023`, `univ__2024_2026` |
| `gq_software` | 졸업자격인정제 · 소프트웨어 | boolean | 경북대 졸업자격인정제 | `univ__2023`, `univ__2024_2026` |
| `gq_counseling` | 졸업자격인정제 · 지도교수 상담 | boolean | 경북대 졸업자격인정제 | `univ__2023`, `univ__2024_2026` |
| `gq_major_area` | 졸업자격인정제 · 전공영역 | boolean | 경북대 졸업자격인정제 | `univ__2023`, `univ__2024_2026` |

## 알아둘 점

- `english_score`만 `number`입니다. 점수 기준은 전공·트랙마다 달라 이 파일이 아니라 각 규칙의 `rule` 문구에 있습니다(TOEIC 700, 글솝 해외복수학위 800 등).
- 글로벌SW융합의 트랙 선택·글로벌역량·다중전공 키는 해커톤 범위에서 추가하지 않기로 했습니다. 해당 내용은 `graduation_rules.json`의 `tracks` 원문으로 안내합니다.
- 키 추가는 #3에서만 합니다(AGENTS.md A-3). 추가하면 `src/types/reference.ts`의 `ChecklistKey`도 함께 바꿔야 하므로 #1 담당과 맞춥니다.
