@AGENTS.md

# CLAUDE.md — Claude Code 작업 방식

공통 계약은 위에서 불러온 `AGENTS.md`가 기준이다. 이 파일과 AGENTS.md가 다르면 AGENTS.md를 따른다.
AGENTS.md의 "A-13. Codex 전용 작업 방식"은 무시한다.

## 작업 순서 (이슈 하나 = 세션 하나)
1. **이슈 읽기**: `gh issue view <번호>`로 본문을 읽는다(안 되면 사용자가 붙여넣은 본문 사용). 선행 이슈가 머지됐는지 `gh issue view <선행번호>`로 확인한다.
2. **브랜치**: `git switch main && git pull && git switch -c "feat/issue#<번호>"` (따옴표 필수, 예: `"feat/issue#6"`)
3. **계획 먼저**: 코드를 쓰기 전에 ① 만들/고칠 파일 목록(소유 범위 안인지 표시) ② 사용할 계약(타입·함수·훅) ③ 테스트 계획을 짧게 제시하고, 사용자가 확인하면 구현한다.
4. **구현**: 3단계 이상이면 할 일 목록을 만들고 하나씩 완료 표시한다. 도메인 로직은 테스트를 먼저 쓰고 구현한다.
5. **검사**: `npm run lint && npm run typecheck && npm test`를 실행해 통과시킨다. 실패하면 원인을 고치고 다시 실행한다(테스트를 지우거나 건너뛰지 않는다).
6. **범위 확인**: `git diff --name-only main`으로 소유 범위 밖 파일이 없는지 확인한다.
7. **PR 본문 작성**: AGENTS.md A-11의 형식(작업 내용·변경 사항·구현 방식과 주요 결정·인수 조건 체크·테스트·스크린샷·범위 밖 요청·남은 일)을 실제 작업 내용으로 채워 `pr-body.md`로 만들고 사용자에게 보여준다. 빈 칸이나 템플릿 주석을 남기지 않는다.
8. **커밋·PR**: `feat(#번호): …` 형식으로 커밋하고 `git push -u origin "feat/issue#<번호>"` → `gh pr create --title "[#<번호>] 이슈 제목" --body-file pr-body.md`로 PR을 연다. `pr-body.md`는 커밋하지 않는다.
9. **머지**: 필수 CI가 통과하면 Claude Code가 `gh pr merge --squash --delete-branch` 또는 GitHub의 **Squash and merge**로 병합한다. 리뷰 승인 대기 없이 병합하고 GitHub에서 결과를 확인한다.
10. **보고**: 변경 파일, 인수 조건별 충족 여부, 검사 결과, 범위 밖·계약 변경 요청, 남은 결정을 정리한다.

## 하지 말 것
- 소유 범위 밖 파일 수정, 스텁을 대신 구현하기, `data/*.json` 수정(데이터 이슈 제외)
- `git push --force`, main 직접 커밋, `.env` 등 비밀 파일 커밋
- `data/courses.json` 전체를 Read로 열기 — `jq '.[] | select(.course_code=="COMP0204")' data/courses.json`처럼 필요한 부분만 조회
- 사용자 확인 없이 의존성 추가, PR 생성, 마이그레이션 실행

## 컨텍스트 관리
- 이슈가 바뀌면 `/clear` 후 새로 시작한다(다른 이슈 맥락이 섞이지 않게).
- 계약이 헷갈리면 추측하지 말고 `AGENTS.md`의 해당 절(A-3~A-9)을 다시 확인한다.
- 계약 변경이 필요하다고 판단되면 구현을 멈추고 사용자에게 변경 내용을 제안한다.

## 자주 쓰는 명령
| 목적 | 명령 |
|---|---|
| 이슈 보기 | `gh issue view 6` |
| 내 이슈 목록 | `gh issue list --assignee @me` |
| 목 모드 실행 | `NEXT_PUBLIC_USE_MOCK=1 npm run dev` |
| 특정 테스트 | `npx vitest run src/lib/domain/completion.test.ts` |
| PR 상태 | `gh pr status`, `gh pr checks` |
