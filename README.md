# cse-roadmap

경북대학교 컴퓨터학부 수강 로드맵. Next.js App Router + TypeScript(strict) + Supabase JS + Vitest.

## 개발 시작

Node.js 24 이상을 사용합니다. CI는 Node.js 24에서 실행합니다.

```sh
npm ci
cp .env.example .env.local
NEXT_PUBLIC_USE_MOCK=1 npm run dev
```

브라우저에서 http://localhost:3000 을 열고 시연 계정으로 로그인합니다.
실제 계정으로 실행하려면 `.env.local`에서 `NEXT_PUBLIC_USE_MOCK=0`과 Supabase URL·anon 키를 설정합니다.
Supabase에 마이그레이션을 적용하고 Google 로그인을 활성화한 뒤, Supabase에 앱의 `/auth/callback` URL을 등록합니다.
온보딩과 수강 이력의 입력 화면은 후속 이슈가 연결합니다.

## 목 모드와 기준 데이터

- `NEXT_PUBLIC_USE_MOCK=1`: 시연 계정 1명과 이수 기록을 브라우저 localStorage에 저장합니다.
- 기준 데이터는 빌드 시 `data/*.json`을 우선 번들합니다. 아직 없는 파일만 `src/test/fixtures/reference/*.json`의 축소 예제를 사용합니다. #2·#3 머지 후 서버를 재시작하세요.
- fixture의 과목명·전공 배치·분야 색은 **개발용 임시 예제**이며 공식 교육과정이나 졸업요건이 아닙니다. 졸업요건과 추천의 도메인 함수는 아직 빈 스텁입니다.
- localStorage 키는 `cse-roadmap:demo:v1`입니다. 깨진 저장 데이터는 자동으로 덮어쓰지 않고 오류로 표시합니다. 개발자 도구에서 이 키를 삭제하면 시연 계정의 기본 데이터로 돌아갑니다.
- Supabase를 사용할 수 없는 환경에서도 목 모드로 개발합니다. 저장소 모드는 `src/lib/user-data/index.ts`의 `getRepository()`에서 선택합니다.
- `.env.local`과 서비스 역할 키는 커밋하지 않습니다. 서비스 역할 키는 scripts 전용입니다.

## 검증

```sh
npm run lint
npm run typecheck
npm test
NEXT_PUBLIC_USE_MOCK=1 npm run build
```

`npm run validate-data`는 #8 이전의 안내용 명령입니다. 데이터 검증 성공을 뜻하지 않습니다. #8에서 실제 스크립트와 별도 CI로 교체합니다.

## 협업

AGENTS.md의 계약과 소유 표를 따릅니다. 한 이슈당 한 브랜치·한 PR로 작업하고, 필수 CI 통과 후 Squash merge합니다. 리뷰 승인은 선택 사항입니다.
기준 데이터 파일은 #2·#3만 수정합니다. 후속 이슈의 기능은 구현하지 않고 공개 타입·props·빈 스텁으로 연결합니다.
Vercel 프로젝트에서 저장소를 연결하고 Preview 환경에 `NEXT_PUBLIC_USE_MOCK=1`을 설정하면 PR 프리뷰를 확인할 수 있습니다. CI 실행·Vercel 프리뷰는 원격 연결 후 리뷰어가 확인해야 합니다.
