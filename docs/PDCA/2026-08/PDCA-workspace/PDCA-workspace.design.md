---
template: design
version: 1.3
---

# PDCA-workspace 설계 문서

> **한 줄 요약**: Hono 단일 함수 + Drizzle/Neon + Vite SPA로 3계층 CRUD를 세우고,
> 문서 URL을 레포 경로 그대로 미러링(D-13)해 마크다운 상대링크를 브라우저 표준 해석에
> 위임한다. 급소 로직(경로 정규화·링크 추출)만 순수 모듈로 격리해 단위 테스트로 방어한다.
>
> **프로젝트**: PDCA-workspace
> **작성자**: cogmo
> **작성일**: 2026-08-07
> **상태**: Draft (v0.1 — Checkpoint 3에서 옵션 C 선택)
> **계획 문서**: [PDCA-workspace.plan.md](./PDCA-workspace.plan.md)

---

## Context Anchor

> Plan에서 복사. Design→Do 인계 시 전략 컨텍스트 보존.

| Key | Value |
|-----|-------|
| **WHY** | PDCA 산출물이 레포 안 파일로만 존재해 조회·관리가 안 된다. 그렇다고 웹으로 옮기면 문서 간 상대링크(특히 docs 밖 소스코드 링크 17종)가 전부 죽는다. |
| **WHO** | 형(cogmo) 단독. 공유·협업·다중 유저 없음. 인증은 "나 말고 아무도 못 보게" 수준. |
| **RISK** | Vercel이 `.md`로 끝나는 URL을 정적 파일로 오인해 SPA 라우팅이 안 먹는 것(RK-01) / `path` 오입력이 조용히 링크를 죽이는 것(RK-02) / Neon Auth를 Vite SPA에 붙이는 경로가 Next.js 대비 덜 다져진 것(RK-03). |
| **SUCCESS** | C1~C10. 핵심은 **C6 — cogmo-report docs 67개를 실제로 넣고, 링크 4종(형제/타폴더/디렉터리/레포외부)이 전부 의도대로 동작**. |
| **SCOPE** | 축1 3계층 CRUD / 축2 경로 미러 뷰어 + 링크 판정 / 축3 에디터·테마·셸 / 축4 배포(Vercel main 직배 + Neon 브랜치 2개). 다중 유저·전문검색·Git 동기화·실시간 협업은 스코프 외. |

---

## 1. Overview

### 1.1 설계 목표

1. **링크 불변식의 구조적 보장** — "링크가 살아있다"를 기능 코드가 아니라 URL 설계
   (경로 미러)와 DB 제약(`UNIQUE(project_id, path)`)이 보장하게 한다. 코드가 하는 일은
   존재 여부 조회와 비활성 표시뿐이다.
2. **급소 격리** — 이 앱에서 틀리면 안 되는 로직은 경로 정규화와 링크 추출 둘뿐이다.
   이 둘을 React·Hono·DB에 의존하지 않는 순수 모듈로 두고 단위 테스트로 덮는다(D-15).
3. **설계-구현 1:1** — 디렉터리·라우트·컴포넌트 이름을 이 문서와 일치시켜 Check 단계
   Gap 분석이 기계적으로 성립하게 한다.

### 1.2 설계 원칙

- **브라우저가 할 수 있는 일은 앱이 하지 않는다** — 상대 URL 해석, 히스토리, 스크롤 복원.
- **실패 모드는 안전하게** — 링크 판정이 틀려도 이동은 브라우저가 정확히 한다. 표시만 틀린다.
- **서버는 신뢰 경계** — 모든 검증(zod)·소유권 확인(ownerId)은 서버에서. 클라이언트 검증은 UX용 복제일 뿐이다.
- **YAGNI** — 단일 유저 앱. 계층·인터페이스·추상화는 테스트 필요성이 입증된 곳에만.

---

## 2. Architecture Options

### 2.0 아키텍처 비교 (Checkpoint 3)

| 기준 | A: Minimal | B: Clean | C: Pragmatic |
|------|:---:|:---:|:---:|
| **접근** | 전부 인라인, 추상화 0 | 4계층 + repository 패턴 | 경계만 지키고 계층은 안 나눔 |
| **신규 파일** | ~15 | ~90 | ~45 |
| **복잡도** | 낮음 | 높음 | 중간 |
| **링크 판정 테스트 용이성** | 낮음 (컴포넌트에 박힘) | 높음 | 높음 (순수 모듈) |
| **Plan §7.4 정합** | 충돌 (Plan 개정 필요) | 초과 | **1:1 일치** |
| **유지보수** | 중간 | 높음 | 높음 |
| **추천 상황** | 반나절 프로토타입 | 팀 개발·장수 서비스 | **이 프로젝트** |

**선택: C (Pragmatic)** — 형 확정 (Checkpoint 3). Plan §7.4를 그대로 실행하는 안이고,
이 사이클의 승부처(C6)에 필요한 판정 로직 격리를 최소 비용으로 확보한다.
A는 검증 단계에서, B는 구현 단계에서 각각 비싸진다.

### 2.1 컴포넌트 다이어그램

```
┌───────────────────────────── 브라우저 (Vite SPA) ─────────────────────────────┐
│                                                                               │
│  React Router ──────── /w/:ws/p/:proj/* (와일드카드 = 문서 경로)               │
│       │                                                                       │
│  DocumentPage ──▶ MarkdownView ──▶ SmartLink (활성/비활성 렌더)                │
│       │                │                ▲                                     │
│       │           extractLinks ────────┘ (본문→링크 후보, 순수 모듈)           │
│       │                                                                       │
│  TanStack Query ◀──── hc<AppType> (Hono RPC, 타입은 서버에서 파생)             │
└───────┼───────────────────────────────────────────────────────────────────────┘
        │ fetch (Authorization: Bearer <Neon Auth JWT>)
┌───────▼──────────────── Vercel Serverless Function ───────────────────────────┐
│  api/[[...route]].ts (진입점, 얇게)                                            │
│       │                                                                       │
│  server/app.ts (Hono 조립)                                                    │
│    ├─ middleware/auth.ts   JWT 검증(JWKS) → ownerId 주입, 실패 시 401          │
│    ├─ routes/workspaces.ts ─┐                                                 │
│    ├─ routes/projects.ts    ├─ zod 검증(shared/schema.ts) → Drizzle 쿼리      │
│    ├─ routes/documents.ts   │   (전 쿼리 ownerId 스코프)                       │
│    └─ routes/links.ts      ─┘   resolve: paths[] → 존재 집합 (단일 쿼리)       │
│       │                                                                       │
│  server/lib/path.ts  경로 정규화 (shared, 클라이언트와 동일 코드)               │
└───────┼───────────────────────────────────────────────────────────────────────┘
        │ HTTP (@neondatabase/serverless)
┌───────▼───────────┐
│  Neon Postgres    │  dev 브랜치(로컬) / main 브랜치(프로덕션)
│  workspaces ─1:N─ projects ─1:N─ documents                                    │
└───────────────────┘
```

### 2.2 데이터 흐름 — 문서 열람 (이 앱의 중심 시나리오)

```
① URL 진입  /w/cogmo/p/cogmo-report/docs/PDCA/2026-07/golden-test/golden-test.plan.md
② Router가 와일드카드에서 path 추출 → GET /documents/by-path?path=...
③ 본문 수신 → extractLinks(content)로 상대링크 전부 추출
④ 각 링크를 현재 path 기준 정규화(normalizeRelative) → 후보 경로 배열
⑤ POST /links/resolve { paths: [...] } 1회 → 존재하는 경로 집합 수신
⑥ MarkdownView 렌더:
   - 존재 O → SmartLink가 <Link to>로 (SPA 내부 이동)
   - 존재 X → <span.link-dead> + 툴팁 "워크스페이스에 없는 문서"
   - http(s):// → <a target="_blank">
   - 끝이 '/' → 디렉터리 링크: /tree?prefix= 조회 결과로 폴더 뷰 라우팅
⑦ 사용자가 링크 클릭 → 브라우저/Router가 상대 URL 해석 → ①로 (앱의 경로 계산 0)
```

### 2.3 의존 관계

| 컴포넌트 | 의존 대상 | 목적 |
|----------|-----------|------|
| `MarkdownView` | react-markdown + remark-gfm + rehype-sanitize | 렌더 + XSS 방어 (RK-04) |
| `SmartLink` | `links/resolve` 결과 (props) | 활성/비활성 분기. 자체 fetch 없음 |
| `extractLinks` / `path.ts` | **없음 (순수)** | 단위 테스트 대상. React·DB 미의존 |
| `routes/*` | Drizzle + shared/schema.ts | CRUD + 검증 |
| `middleware/auth.ts` | Neon Auth JWKS 엔드포인트 | JWT 서명 검증 (RK-03) |
| `ImportDialog` | `extractLinks` + `links/resolve` | 저장 전 링크 생사 프리뷰 (FR-12, RK-02) |

---

## 3. Data Model

> Plan §7.3 확정 스키마를 Drizzle 코드로 구체화한다. 컬럼·제약은 Plan과 동일 — 여기서
> 추가되는 것은 enum 선언, 인덱스 명세, 정규화 불변식의 코드 위치뿐이다.

### 3.1 Drizzle 스키마 (`server/db/schema.ts`)

```typescript
// Design Ref: §3.1 — Plan §7.3의 3테이블. 전부 1:N, 다대다 없음
import { pgTable, uuid, text, timestamp, pgEnum, uniqueIndex, index } from 'drizzle-orm/pg-core'

export const documentKind = pgEnum('document_kind', ['pdca', 'general'])
export const pdcaStage = pgEnum('pdca_stage', ['plan', 'design', 'analysis', 'report'])

export const workspaces = pgTable('workspaces', {
  id: uuid('id').primaryKey().defaultRandom(),
  ownerId: text('owner_id').notNull(),        // Neon Auth user id — 다중 유저 확장 여지
  name: text('name').notNull(),
  slug: text('slug').notNull(),
  description: text('description'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
}, (t) => [
  uniqueIndex('workspaces_owner_slug_uq').on(t.ownerId, t.slug),
  index('workspaces_owner_idx').on(t.ownerId),
])

export const projects = pgTable('projects', {
  id: uuid('id').primaryKey().defaultRandom(),
  workspaceId: uuid('workspace_id').notNull()
    .references(() => workspaces.id, { onDelete: 'cascade' }),  // RK-06: 캐스케이드는 DB가
  name: text('name').notNull(),
  slug: text('slug').notNull(),
  serviceUrl: text('service_url'),
  githubUrl: text('github_url'),
  githubBranch: text('github_branch').default('main'),          // v1 미사용, 백로그 대비
  description: text('description'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
}, (t) => [
  uniqueIndex('projects_ws_slug_uq').on(t.workspaceId, t.slug),
  index('projects_ws_idx').on(t.workspaceId),
])

export const documents = pgTable('documents', {
  id: uuid('id').primaryKey().defaultRandom(),
  projectId: uuid('project_id').notNull()
    .references(() => projects.id, { onDelete: 'cascade' }),
  title: text('title').notNull(),
  path: text('path').notNull(),               // 레포 루트 기준. 저장 전 normalizePath 통과 필수
  kind: documentKind('kind').notNull(),
  pdcaStage: pdcaStage('pdca_stage'),         // kind='pdca'일 때만. CHECK는 마이그레이션 SQL로
  content: text('content').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
}, (t) => [
  uniqueIndex('documents_proj_path_uq').on(t.projectId, t.path),  // FR-04 + resolve 조회 인덱스
  index('documents_proj_idx').on(t.projectId),
])
```

마이그레이션 SQL에 수동 추가(Drizzle 미지원분):

```sql
-- kind='general'이면 stage 금지 (Plan §7.3 CHECK)
ALTER TABLE documents ADD CONSTRAINT documents_stage_chk
  CHECK (kind != 'general' OR pdca_stage IS NULL);
-- 디렉터리 링크(FR-09) prefix 조회용
CREATE INDEX documents_proj_path_pattern_idx
  ON documents (project_id, path text_pattern_ops);
```

### 3.2 경로 모듈 (`server/lib/path.ts` — 클라이언트 공유, 순수)

이 앱의 유일한 "도메인 로직". 규칙은 Plan §7.3 불변식의 코드화다.

```typescript
// Design Ref: §3.2 — 급소 모듈. React·DB 미의존, Vitest 커버 필수 (Plan D-15)

/** 저장용 정규화: 선행 '/'·'./' 제거, 빈 세그먼트 압축. '..' 포함 시 reject(에러). */
export function normalizePath(raw: string): string

/** 링크 판정용: 현재 문서 path 기준으로 상대링크를 절대화.
 *  '..'이 루트를 뚫으면 null (= 워크스페이스 밖 → 무조건 비활성).
 *  '#앵커'·'?쿼리'는 잘라서 판정하고 렌더 시 되붙임. */
export function resolveRelative(fromDocPath: string, link: string): string | null

/** 분류: 'external'(http·mailto) | 'anchor'(#만) | 'directory'(끝 '/') | 'document' */
export function classifyLink(href: string): LinkClass
```

**단위 테스트 필수 케이스** (Plan F2~F6의 실측 사례를 그대로 픽스처로):

| # | 입력 (from: `docs/PDCA/2026-08/x/x.plan.md`) | 기대 |
|---|------|------|
| T1 | `refine-db-cycle-1.plan.md` | `docs/PDCA/2026-08/x/refine-db-cycle-1.plan.md` |
| T2 | `./y.design.md` | 동일 폴더 해석 |
| T3 | `../../../code-review/a.md` | `docs/code-review/a.md` |
| T4 | `../../../../CLAUDE.md` | `CLAUDE.md` (루트 도달, 유효) |
| T5 | `../../../../../etc/passwd` | `null` (루트 초과) |
| T6 | `../260731-python-314/` | directory 분류 + prefix `docs/PDCA/2026-08/260731-python-314/` |
| T7 | `a.py#L52`, `a.md#L73-L83` | 앵커 분리 후 판정, 렌더 시 복원 |
| T8 | `https://github.com/...` | external |
| T9 | 저장 정규화: `./docs//a.md` → `docs/a.md`, `../a.md` → reject | |

### 3.3 엔티티 관계

```
neon_auth 사용자 (Neon Auth 관리, 앱은 ownerId 문자열만 저장)
    1 ─── N  workspaces  1 ─── N  projects  1 ─── N  documents
                              (ON DELETE CASCADE 연쇄)
```

---

## 4. API Specification

> Plan §7.5의 구체화. 전 엔드포인트 인증 필수(401), 전 쿼리 ownerId 스코프(타인 소유는 404).

### 4.1 엔드포인트 목록

| Method | Path | 설명 | 성공 |
|--------|------|------|:----:|
| GET | `/api/workspaces` | 내 워크스페이스 목록 | 200 |
| POST | `/api/workspaces` | 생성 | 201 |
| PATCH | `/api/workspaces/:id` | 수정 | 200 |
| DELETE | `/api/workspaces/:id` | 삭제 (하위 캐스케이드) | 204 |
| GET | `/api/workspaces/:wsId/projects` | 프로젝트 목록 | 200 |
| POST | `/api/workspaces/:wsId/projects` | 생성 | 201 |
| PATCH | `/api/projects/:id` | 수정 | 200 |
| DELETE | `/api/projects/:id` | 삭제 | 204 |
| GET | `/api/projects/:projId/documents` | 문서 목록 (`content` 제외 — 트리 구성용) | 200 |
| GET | `/api/projects/:projId/documents/by-path?path=` | **경로로 1건** (FR-05의 심장) | 200 |
| POST | `/api/projects/:projId/documents` | 생성 (임포트 포함) | 201 |
| PATCH | `/api/documents/:id` | 수정 (본문·제목·경로·분류) | 200 |
| DELETE | `/api/documents/:id` | 삭제 | 204 |
| POST | `/api/projects/:projId/links/resolve` | `{paths: string[]}` → 존재 집합 | 200 |
| GET | `/api/projects/:projId/tree?prefix=` | prefix 하위 경로 목록 (FR-09) | 200 |

### 4.2 상세 명세 (대표 3건)

#### `GET /documents/by-path?path=docs/PDCA/.../x.plan.md`

- 서버는 받은 path를 `normalizePath`로 재정규화 후 `(projectId, path)` 유니크 인덱스 단건 조회.
- **200**: `{ data: { id, title, path, kind, pdcaStage, content, updatedAt } }`
- **404**: `{ error: { code: "NOT_FOUND" } }` — 프론트는 "이 경로에 문서 없음 + 새로 만들기" 화면.

#### `POST /links/resolve`

```jsonc
// 요청 — 클라이언트가 정규화까지 마친 절대 경로 배열 (null 제외)
{ "paths": ["docs/PDCA/2026-08/x/y.plan.md", "CLAUDE.md", "app/main.py"] }
// 200 — 존재하는 것만 반환. 요청 순서 무관, Set으로 소비
{ "data": { "existing": ["docs/PDCA/2026-08/x/y.plan.md"] } }
```

- 구현: `WHERE project_id = ? AND path IN (...)` **단일 쿼리** (N+1 금지, `documents_proj_path_uq` 인덱스 사용).
- 상한: `paths` 최대 500개 (zod). 초과 시 400. (실측 최대 문서의 링크 수 << 500)

#### `POST /documents` (임포트)

```jsonc
// 요청
{ "title": "golden-test 계획 문서", "path": "docs/PDCA/2026-07/golden-test/golden-test.plan.md",
  "kind": "pdca", "pdcaStage": "plan", "content": "# ..." }
```

- **201**: 생성 문서 반환. / **400**: zod 실패(경로 `..` 포함, kind·stage 불일치 등) — `fieldErrors` 포함.
- **409**: `(projectId, path)` 중복 — `{ error: { code: "PATH_TAKEN", path } }`. 프론트는 덮어쓰기/경로 변경 선택지 제시.

### 4.3 에러 응답 규격 (전 엔드포인트 공통)

```jsonc
{ "error": { "code": "VALIDATION_ERROR", "message": "...", "details": { "fieldErrors": {} } } }
```

---

## 5. UI/UX Design

### 5.1 화면 레이아웃

```
┌──────────┬───────────────────────────────────────────────┐
│ 사이드바  │  상단바: 브레드크럼(ws / proj / …path) 테마⛭  │
│          ├───────────────────────────────────────────────┤
│ ws 선택▾ │                                               │
│ 프로젝트  │   본문 영역 (라우트별 교체)                     │
│  ▾ docs/ │   - 문서 뷰 (MarkdownView)                    │
│    ▾ PDCA│   - 문서 편집 (Editor + 미리보기)              │
│      ▸ …│   - 폴더 뷰 (디렉터리 링크 착지점)              │
│          │   - 프로젝트 개요 / 대시보드                   │
│ [+ 문서] │                                               │
│ [⌘K 검색]│                                               │
└──────────┴───────────────────────────────────────────────┘
```

### 5.2 사용자 플로우

```
로그인(Neon Auth) → 워크스페이스 선택 → 프로젝트 선택
  → 사이드바 트리 or ⌘K로 문서 열람 → 본문 내 링크 클릭으로 문서 간 이동
  → [편집] 토글 → CodeMirror 편집(자동저장) → [보기] 복귀
  → [+ 문서] → ImportDialog: RAW 붙여넣기 → 경로 입력 → 링크 생사 프리뷰 → 저장
```

### 5.3 컴포넌트 목록

| 컴포넌트 | 위치 | 책임 |
|----------|------|------|
| `AppShell` | `components/shell/` | 사이드바+상단바 프레임, 반응형 |
| `SidebarTree` | `components/shell/` | 문서 목록→경로 트리 변환·접기 (FR-16) |
| `CommandPalette` | `components/shell/` | ⌘K 제목·경로 검색 (FR-17, cmdk) |
| `ThemeToggle` | `components/shell/` | Latte/Mocha 전환, localStorage 유지 (FR-18) |
| `MarkdownView` | `features/document/components/` | react-markdown 구성, 컴포넌트 오버라이드 주입 |
| `SmartLink` | `features/document/components/` | 링크 4분류 렌더 (FR-07/08/09/10) |
| `Editor` | `features/document/components/` | CodeMirror 6 + 미리보기 토글 + 자동저장 (FR-13) |
| `ImportDialog` | `features/document/components/` | RAW 붙여넣기 + 경로 + 링크 프리뷰 (FR-11/12) |
| `FolderView` | `features/document/components/` | tree 조회 결과 목록 (FR-09) |
| `WorkspaceList/Form`, `ProjectList/Form` | 각 `features/*/components/` | CRUD 폼 (react-hook-form + shared zod) |

### 5.4 Page UI Checklist

> Gap Detector가 항목 단위로 검증한다.

#### 문서 뷰 페이지 (`/w/:ws/p/:proj/*`)

- [ ] 브레드크럼: ws / proj / 경로 세그먼트 전부 클릭 가능(중간 세그먼트→폴더 뷰)
- [ ] PDCA 배지: `pdcaStage` 값별 색 구분(plan/design/analysis/report) — `kind=pdca`일 때만 (FR-19)
- [ ] 본문: GFM 표·체크박스·코드펜스·각주 렌더 (FR-06)
- [ ] 활성 링크: 내부 이동, 밑줄+액센트색
- [ ] **비활성 링크: 회색+취소선급 구분 + 🚫 아이콘(색 이외 구분, NFR 접근성) + 툴팁 "워크스페이스에 없는 문서: {경로}"** (FR-08)
- [ ] 외부 링크: ↗ 아이콘, 새 탭 (FR-10)
- [ ] [편집] 버튼, [삭제] 버튼(확인 다이얼로그)
- [ ] 404 화면: "이 경로에 문서 없음" + [이 경로로 새 문서] 버튼

#### 편집 화면

- [ ] CodeMirror 6 마크다운 하이라이트
- [ ] 보기/분할 미리보기 토글
- [ ] 자동저장 인디케이터(저장 중/저장됨/실패-재시도)
- [ ] 제목·경로·kind·stage 메타 편집 폼 (경로 변경 시 링크 프리뷰 재계산)

#### ImportDialog

- [ ] RAW 붙여넣기 textarea (100KB급 수용)
- [ ] 제목 입력 (첫 `# 헤딩` 자동 제안)
- [ ] 경로 입력 + 실시간 정규화 표시 (`..` 포함 시 즉시 에러)
- [ ] kind 선택(pdca/general), pdca 시 stage 선택 — 파일명 `.plan.md` 등에서 자동 제안
- [ ] **링크 프리뷰: "링크 N개 중 활성 A · 비활성 D" + 비활성 목록 펼침** (FR-12, RK-02 방어)
- [ ] 중복 경로(409) 시: 덮어쓰기 / 경로 수정 선택지

#### 폴더 뷰 / 사이드바 / 목록

- [ ] 폴더 뷰: prefix 하위 문서·하위 폴더 목록, 각각 클릭 이동
- [ ] 사이드바: 경로 트리 접기/펴기, 현재 문서 하이라이트
- [ ] ⌘K: 제목·경로 부분일치, ↑↓ 이동 + Enter
- [ ] 문서 목록: kind·stage 필터 (FR-20)

#### Workspace/Project CRUD

- [ ] Workspace: 목록 카드, 생성/수정 폼(name·slug·description), 삭제 시 "하위 전부 삭제" 경고 문구
- [ ] Project: 목록, 폼(name·slug·serviceUrl·githubUrl·description), URL 필드 형식 검증

### 5.5 테마 (Design Anchor 대체)

> Pencil MCP 미사용. Catppuccin 공식 토큰을 앵커로 고정한다.

| 항목 | 값 |
|------|-----|
| 팔레트 | Catppuccin **Latte**(라이트) / **Mocha**(다크) — 공식 hex를 CSS 변수로, 임의 색 추가 금지 |
| 액센트 | `mauve` 단일 액센트 (링크·포커스·선택) |
| PDCA 배지 | plan=`blue`, design=`mauve`, analysis=`peach`, report=`green` |
| 비활성 링크 | `overlay0` + 취소선 + 🚫 |
| 폰트 | UI: 시스템 산세리프 스택 / 본문·코드: `'JetBrains Mono', monospace` 코드펜스만 |
| 구현 | `styles/catppuccin.css`에서 CSS 변수 정의 → `tailwind.config.ts`가 변수 참조. `:root[data-theme]` 전환 |

---

## 6. Error Handling

### 6.1 에러 코드

| HTTP | code | 원인 | 클라이언트 처리 |
|:----:|------|------|----------------|
| 400 | `VALIDATION_ERROR` | zod 실패 (경로 `..`, stage 불일치, resolve 500개 초과) | 폼 fieldErrors 표시 |
| 401 | `UNAUTHORIZED` | JWT 없음/만료/서명 불일치 | 로그인 화면 리다이렉트 |
| 404 | `NOT_FOUND` | 자원 없음 **또는 타인 소유** (구분 안 함 — 존재 노출 방지) | 문서면 "새로 만들기" 화면, 그 외 목록 복귀 |
| 409 | `PATH_TAKEN` | `(project, path)` 중복 | 덮어쓰기/경로 변경 선택지 |
| 500 | `INTERNAL` | 서버 오류 | 토스트 + 재시도 버튼 |

### 6.2 클라이언트 공통 처리

- QueryClient 전역 `onError`: 401→로그인, 그 외→토스트. 개별 화면은 fieldErrors만 처리.
- 자동저장 실패: 낙관적 갱신 롤백 + "저장 실패 — 재시도" 배너. **편집 내용은 로컬 상태에 보존**(유실 금지).

---

## 7. Security Considerations

- [ ] **XSS (RK-04)**: `rehype-sanitize` 화이트리스트. Do 단계 착수 시 cogmo-report 67개 문서의 인라인 HTML 태그를 전수 grep해 화이트리스트 확정(예상: `br`, `details`, `summary`, `sub`, `sup` 수준). `javascript:` URL은 `classifyLink`에서 별도 차단. C7 페이로드 실증.
- [ ] **인증 (RK-03)**: Neon Auth JWT를 `Authorization: Bearer`로 전달, 서버는 JWKS(`jose` 라이브러리)로 서명·만료 검증. 세션 쿠키 방식이 막히면 이 토큰 방식이 기본. 스파이크 실패 시 Plan RK-03 대안 발동.
- [ ] **인가**: 모든 쿼리가 `workspaces.ownerId = ctx.ownerId` 조인을 강제 — routes가 직접 짜지 않고 `server/db/scoped.ts` 헬퍼 경유(우회 경로 자체를 없앰). 타인 소유는 404.
- [ ] **크리덴셜 격리**: `DATABASE_URL`·`STACK_SECRET_SERVER_KEY`는 서버 전용. 빌드 산출물 grep으로 검증(NFR).
- [ ] **경로 주입**: `..` 저장 금지(normalizePath reject) + resolve 시 서버 재정규화 — 클라이언트 정규화를 신뢰하지 않음.
- [ ] Rate Limiting: 단일 유저 + 인증 필수라 v1 미적용 (명시적 제외).

---

## 8. Test Plan

> 테스트 코드는 Do 단계에서 구현과 1:1로 작성. Check 단계는 실행만.

### 8.1 테스트 범위

| 유형 | 대상 | 도구 | 단계 |
|------|------|------|------|
| **L0: 단위** | `path.ts`(T1~T9), `extractLinks` | **Vitest** | Do (Phase 5·6) |
| L1: API | 전 엔드포인트 status·shape·401·400·409 | curl / Vitest fetch | Do |
| L2: UI 액션 | §5.4 체크리스트 | 수동 (Plan D-15: E2E 자동화 제외) | Check |
| L3: E2E 시나리오 | 실데이터 링크 4종 클릭 (C6) | **수동 — 이 사이클의 관문** | Check (Phase 7) |

### 8.2 L1: API 시나리오

| # | 엔드포인트 | 시험 | 기대 |
|---|-----------|------|------|
| 1 | 아무 API, 토큰 없음 | 인증 가드 | 401 `UNAUTHORIZED` (**C2**) |
| 2 | `POST /workspaces` 정상 | 생성 | 201, id 존재 |
| 3 | `DELETE /workspaces/:id` | 캐스케이드 | 204 후 하위 project·document 조회 404 |
| 4 | `POST /documents` path에 `..` | 검증 | 400 fieldErrors.path |
| 5 | `POST /documents` 동일 path 2회 | 중복 | 2회차 409 `PATH_TAKEN` |
| 6 | `GET /documents/by-path` 실존/비실존 | 단건 조회 | 200 / 404 |
| 7 | `POST /links/resolve` 혼합 배열 | 판정 | existing에 실존만 |
| 8 | `GET /tree?prefix=docs/PDCA/` | 디렉터리 | 하위 경로 목록 |
| 9 | 타인 ownerId 자원 접근 (토큰 2개로) | 인가 | 404 (NFR) |

### 8.3 L3: E2E 시나리오 (Check 단계 수동, C6)

| # | 시나리오 | 단계 | 성공 기준 |
|---|----------|------|-----------|
| 1 | **실데이터 임포트** | cogmo-report 67개 문서를 실제 경로로 임포트 | 67건 전부 저장, 409 0건 |
| 2 | **형제 링크** (F2) | `refine-db-cycle-1.plan.md` 링크 클릭 | 대상 문서로 SPA 이동 |
| 3 | **타 폴더 링크** (F3) | `../../../code-review/260730-code-review.md` 클릭 | 이동 성공 |
| 4 | **디렉터리 링크** (F4) | `../260731-python-314/` 클릭 | 폴더 뷰 표시 |
| 5 | **레포 외부 링크** (F5) | `../../../../app/...repository.py#L52` | **비활성** 표시 + 툴팁, 클릭 무동작 |
| 6 | 딥링크 | 프로덕션에서 문서 URL 직접 입력·새로고침·뒤로가기 | 전부 동작 (**C3**) |
| 7 | 100KB 렌더 | `260730-code-review-fix-cycle-4.plan.md` | 깨짐 없음 (**C5**) |
| 8 | XSS | `<script>`·`onerror`·`javascript:` 페이로드 문서 | 실행 0 (**C7**) |
| 9 | 임포트 프리뷰 | 링크 많은 문서 임포트 시 | 활성/비활성 카운트가 실제와 일치 (**C4**) |

### 8.4 시드 데이터

| 엔티티 | 최소 | 내용 |
|--------|:----:|------|
| workspace | 1 | `cogmo` |
| project | 1 | `cogmo-report` (githubUrl 실제 값) |
| document | 67 | **cogmo-report docs 실물** — 합성 시드 대신 실데이터가 곧 시드 (Phase 7). 임포트 보조 스크립트 `scripts/import-docs.ts`(로컬 전용, 파일 읽어 API 호출) 허용 |

---

## 9. Clean Architecture (Pragmatic 적용)

> 옵션 C — 계층은 안 나누되 경계는 지킨다. 규칙은 3개뿐.

### 9.1 경계 규칙

| # | 규칙 | 이유 |
|---|------|------|
| 1 | `api/`는 `server/app.ts`를 export만 한다 (로직 0) | 함수 본문을 Vercel 밖(로컬 Vitest)에서 실행 가능하게 |
| 2 | `server/lib/path.ts`·`src/features/document/lib/extractLinks.ts`는 **import 0** (순수) | 급소 로직의 테스트 가능성 (설계 목표 2) |
| 3 | 프론트는 `src/lib/api.ts`(RPC 클라이언트)로만 서버 호출 — 컴포넌트 직접 fetch 금지 | 타입 파생 단일 경로 유지 |

### 9.2 이 기능의 배치

| 구성요소 | 위치 | 성격 |
|----------|------|------|
| 경로 정규화·링크 분류 | `server/lib/path.ts` (→ `src/lib/path.ts` re-export) | 순수 (급소) |
| 링크 추출 | `src/features/document/lib/extractLinks.ts` | 순수 (급소) |
| CRUD·resolve·tree | `server/routes/*.ts` | 서버 |
| 검증 스키마 | `shared/schema.ts` | 공유 |
| 렌더·에디터·임포트 | `src/features/document/components/` | 프론트 |
| 소유권 스코프 | `server/db/scoped.ts` | 서버 (우회 불가 헬퍼) |

---

## 10. Coding Convention Reference

> Plan §8.2 확정분. 요점만.

| 항목 | 규칙 |
|------|------|
| 네이밍 | 컴포넌트 PascalCase / 훅 `use*` / 유틸 camelCase / 폴더 kebab-case |
| import 순서 | 외부 → `@/` 별칭 → 상대 → type → css (ESLint `import/order` 강제) |
| 주석 | `// Design Ref: §N`, `// Plan SC: CN` — 비직관적 선택에만 (CLAUDE.md 규칙) |
| 에러 | 서버 Hono `HTTPException` 단일 경로 / 클라이언트 QueryClient 전역 onError |
| 환경변수 | `VITE_` 접두사만 클라이언트 노출 (Plan §8.3 표 4개가 전부) |

---

## 11. Implementation Guide

### 11.1 파일 구조

Plan §7.4 트리를 그대로 따른다 (옵션 C = 1:1). 신규 파일 ~45개.

### 11.2 구현 순서

Plan §9 마일스톤(Phase 0~10)을 그대로 따른다. Phase별 이 문서의 참조 섹션:

| Phase | 내용 | Design 참조 |
|:-----:|------|-------------|
| 0 | 환경 + **RK-01 스파이크** | §2.1 `vercel.json` (Plan §7.4) |
| 1 | DB 스키마 | §3.1 + 마이그레이션 SQL |
| 2 | 인증 | §7 인증·인가 |
| 3~4 | Workspace·Project CRUD | §4.1, §5.4 CRUD 체크리스트 |
| 5 | Document 저장 + path 모듈 + **L0 테스트** | §3.2 (T1~T9), §4.2 |
| 6 | 뷰어 + 링크 판정 | §2.2 데이터 흐름, §5.4 문서 뷰 |
| 7 | 실데이터 검증 | §8.3 (C6), §8.4 임포트 스크립트 |
| 8 | 에디터 | §5.4 편집 화면 |
| 9 | 셸 + 테마 | §5.1, §5.5 |
| 10 | 배포 + 마무리 | §8.2 L1 전체, Plan C10 |

### 11.3 Session Guide

#### Module Map

| Module | Scope Key | 내용 (Plan Phase) | 예상 규모 |
|--------|-----------|-------------------|:---------:|
| 기반 | `module-1` | 환경·스파이크·DB·인증 (Phase 0~2) | 중 |
| CRUD | `module-2` | Workspace·Project·Document + path 모듈 + L0 (Phase 3~5) | 중 |
| 뷰어 | `module-3` | 경로 미러 뷰어 + 링크 판정 + 실데이터 검증 (Phase 6~7) | **대 (핵심)** |
| 마감 | `module-4` | 에디터·셸·테마·배포 (Phase 8~10) | 중 |

#### 권장 세션 계획

| 세션 | 단계 | 스코프 | 비고 |
|------|------|--------|------|
| 1 | Plan + Design | 전체 | 완료 (본 문서) |
| 2 | Do | `--scope module-1` | RK-01 스파이크 실패 시 여기서 중단·재설계 |
| 3 | Do | `--scope module-2` | L0 테스트 통과가 세션 종료 조건 |
| 4 | Do | `--scope module-3` | **Phase 6·7은 반드시 같은 세션** (Plan §9 근거) |
| 5 | Do + Check | `--scope module-4` → analyze | |

---

## Version History

| 버전 | 날짜 | 변경 내용 | 작성자 |
|------|------|-----------|--------|
| 0.1 | 2026-08-07 | 최초 작성. Checkpoint 3에서 옵션 C(Pragmatic) 선택 반영. path 모듈 테스트 케이스 T1~T9를 Plan 실측(F2~F6) 픽스처로 확정 | cogmo |
