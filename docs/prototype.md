# UI 프로토타입

[prototype.html](prototype.html)은 `cse-roadmap-final.html`을 옮긴 팀의 화면 시안이다. 저장소를 체크아웃한 뒤 HTML 파일을 브라우저에서 열거나, GitHub 파일 화면에서 원본을 내려받아 연다. macOS에서는 저장소 루트에서 다음 명령으로 열 수 있다.

```sh
open docs/prototype.html
```

인트로에서 **Google 계정으로 로그인**을 누르고 예시 계정을 선택한다. 전공·학번 → 수강 내역 → 관심 분야를 지나면 노선도가 열린다. 상단 메뉴에서 졸업요건·추천·회원정보 화면을 볼 수 있다. **회원정보 변경 → 초기화**로 처음 설정 흐름을 다시 확인할 수 있다.

## 이슈별 확인 화면

작업 범위와 의존 관계는 [트래킹 이슈 #22](https://github.com/sealoo79/cse-roadmap/issues/22)에 있다. 해시 주소는 HTML 시안의 화면 위치를 가리킨다.

| 이슈 | 시안 화면 | 구현·검증 전에 확인할 부분 |
|---|---|---|
| [#5 인트로·로그인](https://github.com/sealoo79/cse-roadmap/issues/5) | `#home` | 인트로의 정보 배치, 로그인 버튼, 처음 설정으로 이어지는 흐름. 실제 Google 인증과 세션은 #5와 A-7·A-8을 따른다. |
| [#7 노선도](https://github.com/sealoo79/cse-roadmap/issues/7) | `#roadmap` | 분야별 노선, 학기 열, 과목 노드의 상태 구분, 범례, 확대·축소와 화면 맞춤. |
| [#10 온보딩·회원정보](https://github.com/sealoo79/cse-roadmap/issues/10) | `#setup`, `#courses`, `#interests`, `#account` | 3단계 흐름, 단계별 안내, 관심 분야 다중 선택, 회원정보에서 각 설정을 다시 여는 흐름. |
| [#11 수강 이력 관리](https://github.com/sealoo79/cse-roadmap/issues/11) | `#courses` | 학기별 과목 목록, 수기 추가 진입점, 선택 요약의 배치. 등록·수정·삭제는 #11의 범위를 따른다. |
| [#14 관계선](https://github.com/sealoo79/cse-roadmap/issues/14) | `#roadmap` | 과목 선택 시 강조와 흐리게 표시하기, 추천 화살표 토글. 선수·권장·동시 수강 관계의 표시는 A-9를 따른다. |
| [#15 OCR](https://github.com/sealoo79/cse-roadmap/issues/15) | `#courses`의 불러오기 탭 | 입력 방식의 진입 위치. 과목 매칭과 검토·저장 화면은 #15의 인수 조건으로 설계한다. |
| [#16 과목 상세](https://github.com/sealoo79/cse-roadmap/issues/16) | `#roadmap`의 과목 상세와 추천 팝오버 | 학점·개설·선후수·추천 이유의 정보 배치와 과목 간 탐색. |
| [#17 졸업요건](https://github.com/sealoo79/cse-roadmap/issues/17) | `#progress` | 학점 진행률과 필수 과목 표의 정보 배치. 비학점 입력과 판정 불가 표기는 #17과 A-6·A-9를 따른다. |
| [#19 다음 학기 추천](https://github.com/sealoo79/cse-roadmap/issues/19) | `#recommend`, `#roadmap` | 추천 목록, 과목별 추천 이유, 노선도로 이동하는 흐름. 추천 후보와 점수는 A-6·A-9를 따른다. |
| [#20 과목 검색·분야 필터](https://github.com/sealoo79/cse-roadmap/issues/20) | `#roadmap`의 도구 영역 | 검색·필터의 배치와 범례·확대 도구와의 관계. 검색과 분야 숨기기의 동작은 #20과 A-8을 따른다. |
| [#21 통합 시나리오](https://github.com/sealoo79/cse-roadmap/issues/21) | 인트로 → 온보딩 → 노선도·졸업요건·추천·회원정보 | 시연 순서와 화면 사이의 이동을 확인한다. 통합 검증은 목 모드 앱에서 진행한다. |

## 적용 기준

- 앱의 라우트, 상태, 접근 제어와 계산은 [공통 계약](../AGENTS.md), 기준 데이터와 해당 이슈의 인수 조건을 따른다.
- 시안의 계정, 학점, 과목 관계, 추천 순위, 시간표 URL과 가져오기 결과는 시연용이다. 화면에는 기존 앱 저장소와 도메인 함수가 제공하는 값을 연결한다.
- 레이아웃과 인터랙션을 구현할 때 공통 CSS 변수, 분야 색, 키보드 조작 계약을 적용한다. 공통 시안이나 이 안내를 바꿀 때는 계약 변경 이슈에 변경 범위를 적는다.
