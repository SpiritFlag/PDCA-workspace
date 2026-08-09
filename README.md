# PDCA-workspace

> **⚠️ Korean-only project — please read before you clone**
>
> This is a self-hosted workspace for managing PDCA cycle documents. Every part of it —
> the UI labels, the error messages, the document conventions, even the code comments —
> is written in Korean, and there is no i18n layer to switch that off. If you don't read
> Korean, self-hosting this will get you a working server you can't actually use.
>
> Sorry for the dead end. If you arrived here from the [`pdcaw`](https://www.npmjs.com/package/pdcaw)
> CLI looking for the server it talks to: yes, this is it — but the CLI is only useful
> once you're running this, and this is Korean-only. The rest of this README is in Korean.

---

PDCA 사이클 문서(plan · design · analysis · report)를 웹에서 읽고 쓰는 자체 호스팅 워크스페이스.
레포 안 마크다운 파일로만 존재하던 PDCA 산출물을 **경로 구조를 그대로 유지한 채** 웹으로 옮겨,
브라우저에서 문서 사이를 오가고 백로그를 관리하고 클로드(MCP)가 직접 읽고 쓸 수 있게 한다.

## 핵심 설계 — "경로가 곧 주소다"

문서를 DB에 넣으면서 가장 먼저 깨지는 건 **마크다운 안의 상대 링크**다. 이 프로젝트는
링크 resolver를 만드는 대신, 레포 기준 경로를 **URL에 그대로 미러링**했다.

```
레포:  docs/PDCA/2026-08/adopt-pdcaw-cli/adopt-pdcaw-cli.plan.md
URL:   /w/{워크스페이스}/p/{프로젝트}/docs/PDCA/2026-08/adopt-pdcaw-cli/adopt-pdcaw-cli.plan.md
```

경로가 URL이 되면 `./adopt-pdcaw-cli.design.md` 같은 상대 링크는 **브라우저의 상대 URL 해석
규칙이 알아서 처리한다.** 서버는 "그 경로에 문서가 실제로 있는가"만 판정하면 된다 — 링크
동작을 기능이 아니라 불변식으로 만든 설계이고, 실문서 67개 임포트로 형제·타폴더·디렉터리·
레포외부 링크 4종 전부 검증했다.

## 주요 기능

| 영역 | 내용 |
|------|------|
| **3계층 구조** | Workspace > Project > Document. 계정별로 격리되며 slug로 주소가 정해진다 |
| **문서 뷰어·에디터** | 마크다운 렌더(GFM, sanitize) + CodeMirror 에디터. 링크는 존재 여부에 따라 살아있는 링크 / 생성 폼 프리필로 갈린다 |
| **임포트** | 레포 문서를 사이클 단위로 붙여넣어 등록. 경로가 규칙에 맞으면 자동 조립된다 |
| **사이클(릴리즈)** | 버전을 1급 엔티티로 관리 — 버전마다 고유 URL(`/r/{버전}`)을 갖는 릴리즈 상세 페이지가 있다. 릴리즈노트(마크다운) + PDCA 사이클 연결(선택)을 그 페이지에서 함께 보고, plan/design/analysis/report 4버튼으로 문서를 오간다 |
| **백로그 보드** | 프로젝트별 보드. 중요도 4단계 · 상태 5단계 · 드래그 정렬 · 접힘 섹션 |
| **MCP 서버** | `/api/mcp` — 클로드가 문서와 백로그를 직접 읽고 쓴다 (툴 10개) |
| **PAT 발급** | `/settings/tokens` — CLI·MCP용 개인 액세스 토큰. 평문은 발급 직후 1회만 표시 |
| **부가** | ⌘K 커맨드 팔레트(제목·경로 부분일치), 사이드바 문서 트리(버전 하위에 PDCA 4문서, 일반 문서는 별도 트리), 프로젝트 페이지 projectId 복사(`.pdcarc.json` 작성용), Latte/Mocha 테마 토글 |

### 백로그 상태 모델

상태의 **의미**를 코드(`shared/transition.ts`)에 명문화해 서버·MCP·UI가 같은 정의를 공유한다.

| 상태 | 의미 |
|------|------|
| `todo` | 아직 착수하지 않은 항목 |
| `doing` | 지금 작업 중인 항목 |
| `done` | 이 문제를 해결하려고 의도했고, 의도대로 해결됨 |
| `resolved` | 의도한 건 아닌데 다른 작업 중 우연히 같이 해결됨 또는 필요가 없어짐 |
| `dropped` | 하지 않기로 판단해 내려놓은 항목 (되돌릴 수 있음) |

MCP(클로드)는 `doing`·`done`·`resolved`·`dropped`로 전환할 수 있지만 **`todo` 복귀는 사람
전용**이다 — "완료 판정"은 판단이라 위임할 수 있어도 "재개·재작업"은 결정이라 위임하지 않는다.
하드 삭제 툴도 등록하지 않았다.

## 기술 스택

**프론트엔드** — React 19 · Vite 8 · React Router 7 · TanStack Query 5 · Tailwind CSS 4 ·
zustand · react-hook-form + zod · react-markdown · CodeMirror

**백엔드** — Hono 4 (Vercel Functions) · Drizzle ORM · Neon Serverless Postgres ·
`@modelcontextprotocol/sdk` (Streamable HTTP, stateless)

**인증** — Neon Auth(better_auth) JWT를 JWKS로 검증. 별도로 `pdcaw_` 접두어 PAT를
SHA-256 해시로 저장해 CLI·MCP 접근에 사용한다.

**검증** — TypeScript · oxlint · Vitest (순수 함수 단위 테스트 + 실 DB L1 하네스)

## 프로젝트 구조

```
src/                  프론트엔드 (기능별 모듈: features/{workspace,project,document,cycle,backlog,tokens})
server/
  app.ts              Hono 앱 — 라우트 마운트와 에러 매핑의 단일 지점
  routes/             HTTP 어댑터 (검증 → 서비스 호출)
  services/           도메인 로직 (쿼리는 여기서만)
  mcp/                MCP 서버 — 툴은 services만 호출한다
  db/                 Drizzle 스키마 · 클라이언트
shared/               서버·클라이언트 공용 zod 스키마와 상태 전이 규칙
api/[...route].ts     Vercel 진입점 (app을 export만 한다)
docs/
  RULE.md             PDCA 문서 규약 · 사이클 종료 절차
  PDCA/               사이클 문서 (_INDEX.md가 전체 이력)
  deploy/CHECKLIST.md 배포 체크리스트
```

계층 경계는 하나만 지키면 된다: **쿼리는 `services/`에서만.** 라우트도 MCP 툴도 서비스를
호출할 뿐 DB를 직접 만지지 않는다 — 그래서 웹과 MCP가 같은 규칙을 공유한다.

## 시작하기

### 1. 환경변수

`.env.local.example`을 복사해 `.env.local`을 만들고 채운다.

```bash
cp .env.local.example .env.local
```

| 변수 | 용도 |
|------|------|
| `DATABASE_URL` | Neon Postgres 연결 문자열 |
| `NEON_AUTH_JWKS_URL` | JWT 검증용 JWKS 엔드포인트 |
| `NEON_AUTH_BASE_URL` / `VITE_NEON_AUTH_BASE_URL` | 로그인 API 주소 (서버/브라우저용 동일 값) |
| `PDCAW_PAT` | `pdcaw` CLI가 쓰는 PAT (웹 UI `/settings/tokens`에서 발급) |

> **주의**: Neon Auth 값과 PAT는 **브랜치(dev/main)마다 다르다.** dev에서 발급한 PAT로
> 프로덕션에 요청하면 401이다.

`baseUrl`·`projectId`는 비밀이 아니라 저장소에 커밋된 `.pdcarc.json`에 있다.

### 2. 마이그레이션

```bash
DATABASE_URL=<브랜치-url> npx drizzle-kit migrate
```

dev·main 브랜치는 자동으로 동기화되지 않는다 — **각각 적용해야 한다.**
자세한 순서와 함정은 [`docs/deploy/CHECKLIST.md`](docs/deploy/CHECKLIST.md) 참조.

### 3. 개발 서버

```bash
npm install
npm run dev:local      # API(tsx watch) + 웹(vite) 동시 기동 — 평소엔 이걸 쓴다
```

| 명령 | 용도 |
|------|------|
| `npm run dev:local` | API + 웹 동시 기동 (권장) |
| `npm run dev` | 웹만 |
| `npm run dev:api` | API만 (`localhost:3001`) |
| `npm run dev:vercel` | Vercel 런타임으로 기동 — 배포 환경 차이를 재현할 때 |
| `npm run build` | `tsc -b` + `vite build` |
| `npm run lint` | oxlint |
| `npm test` | 단위 테스트 (순수 함수) |
| `npm run test:l1` | L1 하네스 — **실제 dev DB에 붙는다** |

## MCP 연동

`/api/mcp`가 stateless Streamable HTTP MCP 서버다. PAT로 인증하며 툴 10개를 노출한다.

```
project_list · document_list · document_read · document_write
backlog_list · backlog_create · backlog_update · backlog_reorder
cycle_list · cycle_read
```

cycles는 **읽기 전용**이다(쓰기 툴 미등록). Claude Code에서는 `Authorization: Bearer` 헤더로,
claude.ai 웹 커넥터에서는 커스텀 헤더를 넣을 자리가 없어 `?token=` 쿼리파라미터로 붙는다 —
후자는 Vercel 로그에 평문이 남는 알려진 트레이드오프이며 OAuth 승격 전까지 감내 중이다
(자세한 내용은 배포 체크리스트 §5).

## 문서 동기화 — `pdcaw` CLI

레포의 마크다운을 이 서버로 올리는 건 별도 npm 패키지 [`pdcaw`](https://www.npmjs.com/package/pdcaw)가
담당한다. 파일을 그대로 읽어 전송하므로 **문서 본문이 LLM 컨텍스트를 통과하지 않는다** —
설계 문서 한 뭉치를 올려도 토큰이 들지 않고, 옮겨 적다 생기는 오타도 없다.

```bash
# 마지막 태그 이후 변경된 docs/ 문서 전부 동기화
npx pdcaw@latest upload

# 사이클을 닫으면서 릴리즈까지 함께 생성
npx pdcaw@latest upload --cycle <사이클명> --version v0.1.0
```

## PDCA 운영 방식

이 저장소는 자기 자신을 PDCA로 개발한다. 사이클마다 `plan → design → analysis → report`
4종 문서를 쓰고, 종료 시 버전 태그와 릴리즈를 남긴다.

- **규약과 종료 절차**: [`docs/RULE.md`](docs/RULE.md)
- **전체 사이클 이력**: [`docs/PDCA/_INDEX.md`](docs/PDCA/_INDEX.md)

문서는 Plan 단계부터 `docs/PDCA/YYYY-MM/{사이클명}/`에 바로 쓰고 사이클이 끝나도 이동하지
않는다 — 이동이 없으면 상대링크가 깨질 일이 없기 때문이다.
