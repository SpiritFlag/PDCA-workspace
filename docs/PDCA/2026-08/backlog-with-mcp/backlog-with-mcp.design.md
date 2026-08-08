---
template: design
version: 1.3
---

# backlog-with-mcp 설계 문서

> **한 줄 요약**: 도메인 로직을 `server/services/*`로 분리(옵션 B)해 REST 라우트와 MCP 툴이
> **같은 서비스 함수를 호출**하게 하고, 상태 전이·에러 코드를 shared 단일 원천으로 못박는다.
> MCP는 공식 SDK + `@hono/mcp`로 기존 Hono 앱에 라우트 하나로 얹는다(`vercel.json` 무변경).
>
> **프로젝트**: PDCA-workspace
> **작성자**: cogmo
> **작성일**: 2026-08-07
> **상태**: Draft (v0.1 — Checkpoint 3에서 옵션 B 선택)
> **계획 문서**: [backlog-with-mcp.plan.md](./backlog-with-mcp.plan.md)

---

## Context Anchor

> Plan에서 복사. Design→Do 인계 시 전략 컨텍스트 보존.

| Key | Value |
|-----|-------|
| **WHY** | PDCA 산출물은 쌓이는데 "다음 할 일"이 사람 머리와 report.md 표에만 있다. 그 판단에 필요한 문서를 클로드가 못 읽는다. |
| **WHO** | 형(cogmo) 단독 + **클로드(MCP 클라이언트)** — 처음으로 사람이 아닌 소비자가 생긴다. |
| **RISK** | Streamable HTTP MCP를 Vercel에 얹기(RK-01, F1·F2로 확률 하향) / PAT 전체 쓰기 권한(RK-02) / Neon HTTP 드라이버 정렬 원자성(RK-04). |
| **SUCCESS** | C1~C10. 핵심은 **C7 — 유즈케이스 3단계(문서 훑기→백로그 갱신→형이 착수)를 실제 Claude Code 세션에서 완주**. |
| **SCOPE** | 축1 백로그 DB+API / 축2 백로그 UI / 축3 PAT / 축4 MCP 툴 8개. 다중 유저·기한·라벨·의존관계·MCP OAuth는 스코프 외. |

---

## 1. Overview

### 1.1 설계 목표

1. **로직 단일 원천** — 백로그 CRUD·정렬·전이 규칙이 REST와 MCP 두 소비자를 갖는다.
   같은 동작이 두 벌 존재하면 반드시 어긋난다(Plan RK-08) — 도메인 로직을 `server/services/*`
   한 곳에 두고 라우트와 툴은 **번역만** 한다.
2. **권한 경계의 코드화** — Q10a·Q10b(착수·완료는 형, 해소·삭제는 클로드도)를 프롬프트가
   아니라 `shared/transition.ts` 순수 함수와 툴 스키마로 강제한다.
3. **에러 코드 표 선확정** — 1차 사이클의 `PATH_TAKEN`/`CONFLICT` 분열(회고 §6.2)을 반복하지
   않는다. §6.1 표가 유일한 원천이고, 기존 코드의 어긋난 코드도 이번에 통일한다(FR-20).

### 1.2 설계 원칙

- **라우트와 툴은 얇게** — zod 파싱과 응답 변환만. 분기·쿼리·규칙은 전부 서비스에.
- **서비스는 전송을 모른다** — HTTP도 JSON-RPC도 모르는 함수. 실패는 `ServiceError(code)`로
  던지고, 어댑터(REST/MCP)가 각자의 표현으로 번역한다.
- **툴이 없으면 실수도 없다** — 클로드에게 금지할 동작은 검증으로 막지 말고 툴 자체를 빼라(Q4).
- **YAGNI 유지** — 서비스 계층은 도입하되 repository·DI·인터페이스 추상화는 안 한다.
  파일은 늘려도 개념은 안 늘린다.

---

## 2. Architecture Options

### 2.0 아키텍처 비교 (Checkpoint 3)

| 기준 | A: Minimal | B: Clean | C: Pragmatic |
|------|:---:|:---:|:---:|
| **MCP 프로토콜** | JSON-RPC 직접 구현 (~150줄) | 공식 SDK + `@hono/mcp` | 공식 SDK + `@hono/mcp` |
| **로직 공유** | 툴이 쿼리 직접 실행 | **서비스 계층 — REST·MCP가 동일 함수 호출** | 급소(전이·정렬)만 공유 함수 |
| **신규 의존성** | 0 | 2 (서버 전용) | 2 (서버 전용) |
| **기존 코드 수정** | 최소 | **기존 라우트 4개 서비스 추출** | 최소 |
| **REST↔MCP 정합성** | 낮음 (두 벌 코드) | **구조적 보장** | 중간 |
| **사양 변경 대응** | 우리 몫 | SDK가 흡수 | SDK가 흡수 |
| **추천 상황** | 의존성 결벽 | **소비자 2개 이상, 장기 유지** | 이번만 하고 끝 |

**선택: B (Clean)** — 형 확정 (Checkpoint 3). MCP라는 두 번째 소비자가 생기는 시점이
서비스 계층 도입의 정석 타이밍이다. 1차 사이클의 옵션 C 기조에서 한 단계 올라가는 결정이며,
**기존 라우트 4개(workspaces·projects·documents·links)의 서비스 추출이 스코프에 추가**된다 —
이 리팩토링은 module-1에서 백로그 서비스와 같은 패턴으로 함께 수행한다.

### 2.1 컴포넌트 다이어그램

```
┌────────── 브라우저 (Vite SPA) ──────────┐   ┌───── Claude Code / claude.ai ─────┐
│  /w/:ws/p/:proj/backlog                 │   │  claude mcp add --transport http  │
│  BacklogPage ─ BacklogCard ─ ItemDialog │   │    --header "Authorization:       │
│       │ (native drag / 접힘 3섹션)      │   │      Bearer pdcaw_..."            │
│  TanStack Query ◀── hc<AppType>         │   │  JSON-RPC over POST               │
└───────┼─────────────────────────────────┘   └───────────┬───────────────────────┘
        │ Bearer <JWT>                                    │ Bearer <PAT>
┌───────▼──────────────── Vercel Serverless (api/[...route].ts → server/app.ts) ──▼──┐
│  middleware/auth.ts ─── 접두어 분기: pdcaw_* → PAT 해시 조회 / 그 외 → JWKS JWT     │
│       │                                  │                                          │
│  routes/backlog.ts  routes/tokens.ts   mcp/index.ts (@hono/mcp + McpServer)         │
│  routes/workspaces·projects·documents  mcp/tools.ts (툴 8개)                        │
│       │        (전부 얇은 어댑터)         │                                          │
│       ▼                                  ▼                                          │
│  ┌──────────────── server/services/* ── 도메인 로직 단일 원천 ─────────────────┐    │
│  │ workspaces.ts  projects.ts  documents.ts  backlog.ts  tokens.ts             │    │
│  │   실패는 ServiceError(code) throw — §6.1 표의 code만 사용                    │    │
│  └──────┬──────────────────────────────────────────────────────────────────────┘    │
│         │ shared/transition.ts (전이 규칙, 순수) · shared/schema.ts (zod)            │
│         ▼ Drizzle (전 쿼리 ownerId 스코프 — scoped.ts 경유)                          │
└─────────┼───────────────────────────────────────────────────────────────────────────┘
          │ HTTP (@neondatabase/serverless)
    Neon Postgres:  projects ─1:N─ backlog_items   /   api_tokens (독립)
```

### 2.2 데이터 흐름 — C7 유즈케이스 (이 사이클의 중심 시나리오)

```
① 형: Claude Code에 "cogmo-report 백로그 정리해줘"
② 클로드 → tools/call project_list        → 프로젝트 확인
③ 클로드 → tools/call backlog_list        → 기존 백로그 (전 상태)
④ 클로드 → tools/call document_list/read  → 최근 PDCA 문서 훑기
⑤ 클로드 판단:
   - "에러 코드 통일"이 이번 사이클에서 처리됨 → backlog_update(status: 'resolved', closed_on)
   - 새 발견 항목 → backlog_create(title, priority, detail, opened_on)
   - doing으로 바꾸려는 시도 → TRANSITION_DENIED 에러 (서버가 거부, FR-19)
⑥ 형: 브라우저 /backlog 열어 결과 확인 → 드래그로 순서 조정 (PUT /order)
⑦ 형: 카드 하나 골라 배지 클릭 → 대기→진행 (형 전용 전이, Q10a)
```

②~⑤의 모든 툴 호출은 `routes/backlog.ts`가 쓰는 것과 **같은 서비스 함수**를 지난다 —
⑤의 거부도 UI 배지 전환도 동일한 `canTransition`이 판정한다.

### 2.3 의존 관계

| 컴포넌트 | 의존 대상 | 목적 |
|----------|-----------|------|
| `mcp/index.ts` | `@modelcontextprotocol/sdk` + `@hono/mcp` | 프로토콜 처리 (서버 전용 — 클라 번들 무영향, F9 안전) |
| `mcp/tools.ts` | `server/services/*` | 툴 구현. **쿼리 직접 실행 금지** |
| `routes/*` | `server/services/*` + `shared/schema.ts` | zod 파싱 → 서비스 호출 → 응답 변환 |
| `services/*` | Drizzle(`scoped.ts`) + `shared/transition.ts` | 도메인 로직 |
| `shared/transition.ts` | **없음 (순수)** | 전이 규칙. Vitest 커버 필수 |
| `BacklogPage` | hc RPC + `shared/transition.ts` | UI 배지 활성/비활성도 같은 규칙으로 |
| `ItemDialog` | `MarkdownView` (1차 사이클 자산 재사용) | detail 마크다운 렌더 |

---

## 3. Data Model

> Plan §7.3 확정 스키마의 Drizzle 구체화 + 전이 모듈 + 정렬 SQL.

### 3.1 Drizzle 스키마 (`server/db/schema.ts`에 추가)

```typescript
// Design Ref: §3.1 — Plan §7.3의 2테이블 추가. 기존 3테이블 무변경(Plan F6)
export const backlogPriority = pgEnum('backlog_priority', ['urgent', 'high', 'medium', 'low'])
export const backlogStatus = pgEnum('backlog_status', ['todo', 'doing', 'done', 'resolved', 'dropped'])

export const backlogItems = pgTable('backlog_items', {
  id: uuid('id').primaryKey().defaultRandom(),
  projectId: uuid('project_id').notNull()
    .references(() => projects.id, { onDelete: 'cascade' }),   // D-07: 프로젝트=보드
  title: text('title').notNull(),
  priority: backlogPriority('priority').notNull(),
  status: backlogStatus('status').notNull().default('todo'),
  detail: text('detail'),                                       // 상세 md, 팝업 전용
  openedOn: date('opened_on').notNull(),                        // D-08: 형이 지정하는 생성일
  closedOn: date('closed_on'),                                  //        형이 지정하는 처리일
  sortOrder: integer('sort_order').notNull(),                   // D-09: 서버가 0..N-1 정규화
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
}, (t) => [
  index('backlog_proj_sort_idx').on(t.projectId, t.sortOrder), // 목록 조회 = 이 인덱스
])

export const apiTokens = pgTable('api_tokens', {
  id: uuid('id').primaryKey().defaultRandom(),
  ownerId: text('owner_id').notNull(),
  name: text('name').notNull(),                                 // "claude-code-wsl"
  tokenHash: text('token_hash').notNull(),                      // D-04: SHA-256 hex, 평문 미저장
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  lastUsedAt: timestamp('last_used_at', { withTimezone: true }),
}, (t) => [
  uniqueIndex('api_tokens_hash_uq').on(t.tokenHash),            // 인증 조회 = 이 인덱스
  index('api_tokens_owner_idx').on(t.ownerId),
])
```

### 3.2 PAT 형식·해시 (Plan §8.3 미결 해소)

| 항목 | 확정 | 근거 |
|------|------|------|
| 토큰 형식 | `pdcaw_` + `crypto.randomBytes(32)` base64url (총 ~49자) | 접두어=auth 분기 키 + 유출 시 grep 가능 |
| 해시 | **단순 SHA-256 hex** — 솔트·bcrypt 불필요 | 토큰 자체가 256bit 엔트로피라 레인보우 테이블 무의미. bcrypt는 서버리스 콜드스타트에 유해 |
| `TOKEN_HASH_SECRET` env | **불필요 — 도입 안 함** | Plan §8.3의 미결 항목을 "없음"으로 확정 |
| `last_used_at` 갱신 | 인증 성공 시 매번 UPDATE (단일 유저라 부하 무의미) | RK-02 이상 감지 |

### 3.3 전이 모듈 (`shared/transition.ts` — 순수, 급소)

```typescript
// Design Ref: §3.3 — Q10a·Q10b의 코드화. 서버 서비스·MCP 툴·UI 배지가 전부 이것만 호출
export type BacklogStatus = 'todo' | 'doing' | 'done' | 'resolved' | 'dropped'
export type Actor = 'user' | 'mcp'

/** actor='user'는 전 전이 허용. actor='mcp'는 to ∈ {resolved, dropped}만. from==to는 항상 true */
export function canTransition(from: BacklogStatus, to: BacklogStatus, actor: Actor): boolean

/** 종료 상태 여부 — 접힘 섹션 분류·closed_on 권장 판정에 공용 */
export function isClosed(status: BacklogStatus): boolean  // done|resolved|dropped
```

**단위 테스트 필수 케이스** (Vitest, DoD):

| # | from → to | actor | 기대 |
|---|-----------|:-----:|:----:|
| T1 | todo → doing | user | ✅ (착수, Q10a) |
| T2 | todo → doing | mcp | ❌ **TRANSITION_DENIED의 원천** |
| T3 | doing → done | user | ✅ / mcp ❌ |
| T4 | todo → resolved | mcp | ✅ (해소, Q10b) |
| T5 | todo → dropped | mcp | ✅ |
| T6 | resolved → todo | user | ✅ (재개) / mcp ❌ |
| T7 | done → doing | user | ✅ (재작업 — user는 제한 없음) |
| T8 | x → x (동일) | 둘 다 | ✅ (내용만 수정하는 PATCH 통과용) |

### 3.4 정렬 갱신 SQL (D-10, RK-04 해소)

`PUT /order`와 `backlog_reorder` 툴이 공유하는 `services/backlog.ts#reorder`:

```sql
-- 단일 문장 = 원자적 (Plan §6.2 검증: Neon HTTP 드라이버에서 단일 문장 다중행 UPDATE 가능)
UPDATE backlog_items AS b
SET sort_order = v.ord, updated_at = now()
FROM (VALUES ('uuid1', 0), ('uuid2', 1), ...) AS v(id, ord)
WHERE b.id = v.id::uuid
  AND b.project_id = $projectId;          -- 소유권은 서비스가 사전 검증
```

- 계약: 클라이언트가 **보드 전체 항목의 id를 표시 순서대로** 보낸다(활성 + 접힘 3섹션 concat).
- 서버 검증: 받은 id 집합 == 그 프로젝트의 전체 id 집합 (누락·외부 id 시 `VALIDATION_ERROR`).
  집합이 완전하므로 결과가 항상 0..N-1 — 드리프트 누적 없음(RK-06).
- 폴백: 단일 문장이 드라이버에서 막히면 `sql.transaction([...])` 배치(비인터랙티브, 역시 원자적).

---

## 4. API Specification

> 전 엔드포인트 인증 필수(401). PAT·JWT 모두 허용 — MCP만 PAT라는 제약은 두지 않는다(단순화).

### 4.1 REST 엔드포인트

| Method | Path | 설명 | 성공 |
|--------|------|------|:----:|
| GET | `/api/projects/:projId/backlog` | 목록, `sort_order` ASC | 200 |
| POST | `/api/projects/:projId/backlog` | 생성 — `sort_order`는 서버가 활성 목록 맨 뒤로 | 201 |
| PATCH | `/api/backlog/:id` | 수정. `status` 포함 시 `canTransition(from,to,'user')` 검증 | 200 |
| DELETE | `/api/backlog/:id` | hard delete (D-14, MCP 미노출) | 204 |
| PUT | `/api/projects/:projId/backlog/order` | `{ ids: string[] }` §3.4 | 200 |
| GET | `/api/tokens` | PAT 목록 — `tokenHash` **미반환** | 200 |
| POST | `/api/tokens` | `{ name }` → **`{ token }` 평문 1회 반환** | 201 |
| DELETE | `/api/tokens/:id` | 폐기 (즉시 무효) | 204 |
| POST | `/api/mcp` | MCP 엔드포인트 (§4.3) | 200 |
| GET·DELETE | `/api/mcp` | **405** — stateless라 SSE 스트림·세션 종료 미지원 (사양 허용, Plan §6.2 검증) | 405 |

### 4.2 인증 분기 (`middleware/auth.ts` 수정)

```
Authorization: Bearer <token>  (없으면 ?token=<pdcaw_...> 폴백, D-18)
  ├─ token.startsWith('pdcaw_')
  │    → sha256(token) → api_tokens.token_hash 유니크 조회
  │    → hit: ownerId 주입 + last_used_at 갱신 / miss: 401
  └─ 그 외 → 기존 JWKS JWT 검증 (무변경)
```

수정은 분기 추가뿐이고 기존 JWT 경로는 한 줄도 안 바꾼다 — 그래도 **module-3 완료 시 전
라우트 회귀 스윕 필수** (1차 사이클 C2 회귀의 재발 방지, Plan §6).

**D-18 (Check 단계 추가, 형 결정 2026-08-07)**: claude.ai 웹 커넥터는 커스텀 `Authorization`
헤더를 넣을 UI가 없어 OAuth 아니면 URL뿐이었다. OAuth 2.1(§7.2 후보였던 D-03의 미채택안)은
반나절~하루 이상 예상돼 백로그로 미루고, **쿼리파라미터 `?token=` 폴백**으로 타협했다
(`middleware/auth.ts`). PAT(`pdcaw_` 접두어)만 허용 — JWT는 절대 쿼리로 받지 않는다(브라우저
세션 전체를 대변하므로). RK-02 노출면이 늘지만(URL은 서버 접근 로그·브라우저 히스토리에
남을 수 있음) 기존 완화책(해시 저장·즉시 폐기·`last_used_at`)으로 감내하기로 함.

### 4.3 MCP 엔드포인트 (`server/mcp/`)

| 항목 | 확정 |
|------|------|
| 구현 | `@modelcontextprotocol/sdk`의 `McpServer` + `@hono/mcp`의 `StreamableHTTPTransport` |
| 모드 | **stateless** — 요청마다 서버·트랜스포트 새로 생성, `Mcp-Session-Id` 미발급 (사양 MAY, Plan §6.2 검증) |
| 응답 | JSON-RPC request → `application/json` 단건 응답 (SSE 미사용 — 사양이 양자택일 허용) |
| GET | 405 (서버→클라 푸시 없음) |
| Origin 검증 | **사양 MUST** — `Origin` 헤더가 존재하고 자기 도메인이 아니면 403. 부재(CLI 클라이언트)는 통과 |
| 프로토콜 버전 | SDK가 협상. `MCP-Protocol-Version` 무효값은 SDK가 400 |
| 인증 | authMiddleware가 MCP 핸들러보다 먼저 — 미인증이면 JSON-RPC까지 못 간다(C9) |
| 연결 확인 | `claude mcp add --transport http pdca-workspace https://<도메인>/api/mcp --header "Authorization: Bearer pdcaw_..."` — 일부 CC 버전의 헤더 미전달 이슈가 있어 **스파이크에서 인증 포함으로 검증** |

### 4.4 MCP 툴 명세 (8개)

각 description은 **언제 호출하는지**를 쓴다(RK-07). 아래 표의 설명 열이 그대로 툴 description 초안.

| 툴 | 입력 (zod) | 설명 초안 |
|---|---|---|
| `project_list` | 없음 | 작업을 시작할 때 가장 먼저 호출해 워크스페이스·프로젝트 목록과 id를 확보한다 |
| `document_list` | `projectId` | 프로젝트의 문서 경로 목록(본문 제외). PDCA 문서를 훑기 전 대상 파악용 |
| `document_read` | `projectId, path` | 경로로 문서 본문을 읽는다. 백로그 판단에 필요한 plan·report 등을 읽을 때 |
| `document_write` | `projectId, path, title, kind, pdcaStage?, content` | 경로 upsert. **기존 문서가 있으면 덮어쓰며 응답에 `{ replaced: true, previousLength }` 포함**(RK-03) |
| `backlog_list` | `projectId, status?[]` | 백로그 조회. 정리 작업 전 기존 항목 전체를 파악할 때 (기본: 전 상태) |
| `backlog_create` | `projectId, title, priority, detail?, openedOn` | 새 백로그 항목 생성. **status는 항상 todo로 시작**(입력에서 제외) |
| `backlog_update` | `id, title?, priority?, detail?, openedOn?, closedOn?, status?` | 항목 갱신. **status는 resolved(다른 작업으로 자연 해소됨)·dropped(안 하기로 판단)만 지정 가능 — doing·done은 사용자 전용이라 거부된다** |
| `backlog_reorder` | `projectId, ids[]` | 우선순위 재배열이 명시적으로 요청됐을 때만. 평소 순서는 사용자가 UI에서 관리한다 |

- `backlog_update`의 status를 zod `enum(['resolved','dropped'])`로 **스키마부터 좁힌다** —
  1차 방어. 서비스의 `canTransition(from, to, 'mcp')`가 2차 방어(심층 방어, RK-08).
- 거부는 §6.3 매핑대로 **isError 툴 결과 + 코드·사유** — 조용한 무시 금지(Plan §7.5).
- 미노출 목록(재확인): 전 리소스 delete, workspace·project create/update. 툴 결과는 전부
  텍스트 콘텐츠(JSON 직렬화) — MCP 리소스·프롬프트 미사용(스코프 외).

### 4.5 에러 응답 규격

REST는 1차 사이클 규격 유지: `{ error: { code, message, details? } }`. 코드는 §6.1 표만 사용.

---

## 5. UI/UX Design

### 5.1 백로그 화면 (`/w/:ws/p/:proj/backlog`)

```
┌──────────┬────────────────────────────────────────────────┐
│ 사이드바  │ 브레드크럼: ws / proj / 백로그        [+ 항목] │
│ (기존)   ├────────────────────────────────────────────────┤
│          │ ≡ RS blend 버그 재검토       [긴급] [진행]      │
│ 백로그 ★ │   2026-08-01 ~                                 │
│  ← 진입  │ ≡ 에러 코드 통일             [높음] [대기]      │
│ 링크     │ ≡ 목록 필터 FR-20            [낮음] [대기]      │
│ 추가     │ ──────────────────────────────────────────     │
│          │ ▸ 완료 (2)                                     │
│          │ ▸ 해소 (1)                                     │
│          │ ▸ 삭제 (0)                                     │
└──────────┴────────────────────────────────────────────────┘
```

- **섹션 구성**: 활성(todo·doing 혼합, sort_order 순) 1개 + 접힘 3개(done/resolved/dropped,
  Q7). 접힘 상태는 localStorage 유지.
- **드래그**: 각 섹션 **내부** 재배열만. 섹션 간 드래그는 미지원 — 상태 변경은 배지/팝업으로만
  한다(상태 전환을 암묵 동작이 아니라 명시 동작으로 유지, Q10a의 정신). 저장 시 4개 섹션
  표시 순서를 concat한 전체 id 배열을 `PUT /order`로 전송(§3.4 계약).
- **드래그 구현**: HTML5 native DnD 먼저(D-11). `≡` 핸들 + dragover 시 삽입선 표시.
  키보드 대안: 팝업에 "위로/아래로" 버튼(접근성).
- **라우팅**: `router.tsx`에서 `backlog` 라우트를 와일드카드 문서 라우트 **앞에** 선언
  (Plan §6 순서 함정). 사이드바 상단에 백로그 진입 링크(FR-11).

### 5.2 배지 (Catppuccin, 1차 §5.5 규약 연장)

| 종류 | 값 → 색 |
|------|---------|
| 중요도 | 긴급=`red` · 높음=`peach` · 중간=`yellow` · 낮음=`overlay1` |
| 상태 | 대기=`blue` · 진행=`mauve` · 완료=`green` · 해소=`teal` · 삭제=`overlay0`+취소선 |

카드 미리보기 표시(next.tmp 확정): 이름 · 중요도 배지 · 상태 배지 · `생성일 ~ 처리일`.

### 5.3 상세 팝업 (`ItemDialog`)

카드 클릭 → 모달. 구성:

- 제목(인라인 편집), 중요도 select
- **상태 배지 행**: 5개 배지 나열, 현재 상태 강조. 클릭으로 전환하되
  `canTransition(from, to, 'user')` — user는 전부 허용이므로 사실상 전 배지 활성.
  종료 상태로 바꿀 때 `closed_on`이 비었으면 오늘 날짜를 **제안**(강제 아님, Plan §7.3)
- 생성일·처리일 date input (FR-03·C4)
- 상세내용: 보기(MarkdownView 재사용) / 편집(textarea) 토글 — CodeMirror 미사용(팝업엔 과함)
- [삭제] 버튼 → 확인 다이얼로그("삭제 상태와 다름 — 완전히 지워짐") → hard delete

### 5.4 Page UI Checklist (모듈 태깅)

> 1차 회고 §6.3 Try 반영 — 각 항목에 담당 모듈을 태깅하고, **해당 모듈 완료 시점에 그
> 모듈 항목만 즉시 대조한다.** Gap Detector는 Check에서 전수 재확인.

#### 백로그 보드 `[module-2]`

- [ ] 활성 목록이 sort_order 순으로 렌더, todo·doing 혼합
- [ ] 카드: 이름 + 중요도 배지 + 상태 배지 + 날짜 (§5.2 색 규약)
- [ ] 드래그 재배열 → 저장 → 새로고침 후 유지 (C2)
- [ ] 접힘 3섹션(완료/해소/삭제) 각각 독립 토글 + 항목 수 표시 (C3)
- [ ] 접힘 섹션 내부도 드래그 가능, 상태 전환해도 순서 보존 (FR-09)
- [ ] [+ 항목] → 생성 폼 (제목·중요도·생성일 필수, 생성일 기본값 오늘)
- [ ] 빈 보드 상태: "백로그가 없습니다 + 항목 추가" 안내
- [ ] 딥링크·새로고침 동작 (FR-10)

#### 상세 팝업 `[module-2]`

- [ ] 마크다운 보기/편집 토글, 저장
- [ ] 상태 배지 행 전환 + 종료 시 처리일 제안
- [ ] 생성일·처리일 date input — 과거 날짜 입력 가능 (C4)
- [ ] hard delete 확인 다이얼로그
- [ ] Esc/바깥 클릭 닫기, 편집 중이면 확인

#### 진입·셸 `[module-2]`

- [ ] 사이드바 백로그 링크 + 현재 페이지 하이라이트
- [ ] 브레드크럼 `ws / proj / 백로그`
- [ ] ⌘K에 "백로그: {프로젝트명}" 항목
- [ ] Latte/Mocha 테마 일관 (배지 포함)

#### PAT 관리 `[module-3]`

- [ ] 토큰 목록: 이름·생성일·최종사용일 (해시·평문 미표시)
- [ ] 발급: 이름 입력 → 생성 → **평문 1회 표시 + 복사 버튼 + "다시 볼 수 없음" 경고**
- [ ] 폐기: 확인 다이얼로그 → 목록에서 제거
- [ ] 진입: 셸 사용자 메뉴 → "API 토큰" (`/settings/tokens`)

#### 이월분 `[module-3]`

- [ ] 토큰 만료·무효 시 로그인 화면 리다이렉트 (FR-21) — 임의 API 401 유발로 확인

### 5.5 로딩·에러 상태

- 목록: TanStack Query 기본 (스피너 → 데이터). 드래그 저장은 **낙관적 갱신** + 실패 시
  롤백·토스트(1차 자동저장과 동일 패턴).
- 상태 전환·팝업 저장: 즉시 반영 + 실패 롤백.

---

## 6. Error Handling

### 6.1 에러 코드 표 (FR-20 — **확정. 이후 전 라우트·서비스·툴은 이 표만 참조**)

| HTTP | code | 원인 | 클라이언트 처리 |
|:----:|------|------|----------------|
| 400 | `VALIDATION_ERROR` | zod 실패, reorder id 집합 불일치 | 폼 fieldErrors / 토스트 |
| 401 | `UNAUTHORIZED` | JWT·PAT 없음/만료/폐기됨 | 로그인 리다이렉트 (FR-21) |
| 403 | `FORBIDDEN` | 요청 주체는 확인됐으나 그 행위가 금지됨 — **MCP Origin 위반** (refine-mcp-hardening S2, D-23) | (MCP 전용 — UI에선 발생 안 함) |
| 403 | `TRANSITION_DENIED` | `canTransition` false — **MCP가 doing/done 시도 (FR-19)** | (MCP 전용 — UI에선 발생 안 함) |
| 404 | `NOT_FOUND` | 자원 없음 또는 타인 소유 (구분 안 함) | 목록 복귀 / 새로 만들기 |
| 409 | `CONFLICT` | 유니크 충돌 전반. `details.target`으로 대상 명시 (`path`, `slug`, …) | 대상별 안내 (문서: 덮어쓰기/경로수정) |
| 500 | `INTERNAL` | 서버 오류 | 토스트 + 재시도 |

**이월 통일 작업(FR-20)**: 기존 `PATH_TAKEN`(documents 라우트)을 `CONFLICT` +
`details.target: 'path'`로 변경, `onError`의 23505 변환도 `CONFLICT` 유지. 프론트의
`PATH_TAKEN` 참조를 전부 갱신. — module-1에서 서비스 추출과 함께 수행.

### 6.2 ServiceError → 어댑터 매핑

```typescript
// server/lib/errors.ts
class ServiceError extends Error { constructor(public code: ErrorCode, message, public details?) }
```

| 어댑터 | 변환 |
|--------|------|
| REST (`app.onError`) | `ServiceError` → §6.1 표의 HTTP status + `{ error: {...} }`. 기존 HTTPException·23505 경로 유지 |
| MCP (`tools.ts` 공통 래퍼) | `ServiceError` → 툴 결과 `isError: true`, 텍스트 `"[코드] 메시지"` — 예: `"[TRANSITION_DENIED] status를 doing으로 바꿀 수 없습니다. 진행·완료 전환은 사용자가 UI에서 직접 합니다."` 클로드가 형에게 그대로 전달할 수 있는 문장으로 |

### 6.3 클라이언트 전역 처리 (FR-21, 이월)

- QueryClient 전역 `onError`: 401 → 토큰 캐시 클리어 + 로그인 화면. 그 외 → 토스트.
- 1차 사이클에 없던 부분만 추가 — 개별 화면의 fieldErrors 처리는 기존 패턴 유지.

**(사후 2026-08-08 확인, refine-mcp-hardening 사이클 M-1)**: 실제 구현 위치는 위 설계와
다르다 — `src/lib/api.ts`의 `authedFetch`에 있다. 개별 feature의 api.ts가 401을 던지는 곳도
있고 `{ ok: false }`로 삼키는 곳도 있어(문서·백로그 쓰기 계열) QueryClient `onError`로는 절반만
잡힌다. 모든 요청이 `authedFetch` 하나를 지나므로 여기서 처리해야 진짜 "전역"이다 — 사유는
`api.ts:6-9` 코드 주석에 이미 있었고, 문서만 못 따라간 상태였다(2차 analysis M-1).

---

## 7. Security Considerations

- [ ] **PAT 수명주기 (RK-02)**: 평문은 발급 응답에만 존재. DB에는 SHA-256 hex만(§3.2).
      폐기는 행 삭제 = 즉시 무효. `last_used_at`으로 이상 사용 감지. C5로 실증.
- [ ] **MCP Origin 검증**: 사양 MUST(§4.3). Origin 존재 + 비허용 도메인 → 403.
- [ ] **툴 표면 최소화 (Q4)**: delete 계열 전면 미노출 — `tools/list` 실응답으로 검증(NFR).
- [ ] **전이 심층 방어 (FR-19)**: zod enum 협소화(1차) + `canTransition` 서비스 검증(2차).
      스키마를 우회한 raw JSON-RPC 호출도 2차에서 걸린다. C8로 실증.
- [ ] **인가 스코프**: 백로그·토큰 쿼리도 기존 `scoped.ts` 경유 — PAT로 인증해도 ownerId
      스코프는 동일하게 강제. 타인 자원 404.
- [ ] **detail 마크다운 XSS**: `MarkdownView` 재사용으로 1차 사이클 sanitize 체계 그대로 적용.
      MCP로 주입된 detail도 같은 경로로 렌더되므로 커버.
- [ ] **문서 덮어쓰기 (RK-03)**: `document_write` upsert 응답에 `replaced`·`previousLength`
      포함 — 파괴는 막지 않되(업로드 유즈케이스 필요) 사후 확인 가능하게.
- [ ] Rate limiting: 1차와 동일하게 미적용 (인증 필수 + 단일 유저, 명시적 제외).

---

## 8. Test Plan

> 테스트 코드는 Do 단계에서 구현과 1:1 작성. Check 단계는 실행만.

### 8.1 테스트 범위

| 유형 | 대상 | 도구 | 단계 |
|------|------|------|------|
| **L0: 단위** | `transition.ts`(T1~T8), reorder 검증 로직, PAT 해시/형식 | Vitest | Do (module-1·3) |
| L1: API | 백로그·토큰·MCP 엔드포인트 status·shape | curl / Vitest fetch | Do (각 모듈 말) |
| L2: UI | §5.4 체크리스트 (모듈 태깅분) | 수동 — **모듈 완료 시 즉시** | Do |
| L3: E2E | **C7 유즈케이스 완주** | 실제 Claude Code 세션 | Check (module-4 말) |

### 8.2 L1: API 시나리오

| # | 시험 | 기대 |
|---|------|------|
| 1 | 토큰 없이 `/api/mcp` POST | 401 (**C9**) |
| 2 | PAT 발급 → 그 토큰으로 `GET /backlog` | 200 (**C5** 전반) |
| 3 | PAT 폐기 → 같은 토큰 재호출 | 401 (**C5** 후반) |
| 4 | JWT로 백로그 CRUD 1회전 | 각 2xx (**C1** API층) |
| 5 | `PATCH /backlog/:id` status doing (user) | 200 — user는 허용 |
| 6 | MCP `backlog_update` status doing | isError + `TRANSITION_DENIED` (**C8**) |
| 7 | MCP `backlog_update` status resolved | 성공 (Q10b) |
| 8 | `PUT /order` — 전체 id 셔플 | 200, 재조회 시 그 순서 |
| 9 | `PUT /order` — id 하나 누락 | 400 `VALIDATION_ERROR` (§3.4 집합 검증) |
| 10 | `tools/list` | 툴 정확히 8개, delete 계열 0 (**C6**) |
| 11 | MCP GET | 405 |
| 12 | Origin: `https://evil.example` 헤더로 MCP POST | 403 |
| 13 | 기존 문서 409 경로 (documents) | code가 `CONFLICT`로 통일됐는지 (FR-20 회귀) |

### 8.3 L3: E2E — C7 완주 시나리오 (Check 관문)

| 단계 | 행동 | 성공 기준 |
|:---:|------|-----------|
| 0 | 1차 사이클 이월 16건을 형이 백로그에 입력 (**C10** 겸) | 16건 표시 |
| 1 | `claude mcp add`로 프로덕션 MCP 연결 | `/mcp`에 connected, 툴 8개 (**C6**) |
| 2 | 클로드에게 "cogmo-report PDCA 문서 훑고 백로그 정리해줘" | document_read 실행 흔적 |
| 3 | 클로드가 최소 1건 해소 + 최소 1건 신규 생성 | DB 반영 + 브라우저 확인 |
| 4 | (유도) 클로드에게 "이거 진행으로 바꿔줘" | 거부 메시지를 클로드가 형에게 전달 (**C8** 실전) |
| 5 | 형이 브라우저에서 드래그로 순서 조정 | 저장·유지 (**C2**) |
| 6 | 형이 배지로 대기→진행 전환 | 완주 (**C7**) |

### 8.4 시드 데이터

| 엔티티 | 내용 |
|--------|------|
| backlog_items | **1차 사이클 이월 16건 실물**(report.md §4.1) — 합성 시드 대신 실데이터가 곧 시드 (1차 C6 방식 답습). module-2 L2 확인용으로는 dev 브랜치에 임시 5건 |
| api_tokens | 형 계정으로 실발급 2개 (`claude-code-wsl`, `claude-mobile`) — 폐기 시나리오는 후자로 |

---

## 9. Clean Architecture (옵션 B 적용)

### 9.1 계층 규칙

| # | 규칙 | 이유 |
|---|------|------|
| 1 | 도메인 로직(쿼리·분기·전이)은 `server/services/*`에만 | REST·MCP 정합성의 구조적 보장 (설계 목표 1) |
| 2 | `routes/*`·`mcp/tools.ts`는 파싱→서비스 호출→응답 변환만. **Drizzle import 금지** | 어댑터가 얇아야 소비자 추가가 싸다 |
| 3 | 서비스는 Hono context·HTTP status를 모른다. 실패는 `ServiceError(code)` | 전송 독립 (설계 원칙 2) |
| 4 | `shared/transition.ts`는 import 0 (순수) | 급소 테스트 가능성 + UI 공유 |
| 5 | 기존 규칙 유지: `api/` export만, 프론트는 `src/lib/api.ts` 경유, `scoped.ts`로 인가 | 1차 §9.1 계승 |

### 9.2 배치

| 구성요소 | 위치 | 성격 |
|----------|------|------|
| 백로그·토큰·문서·프로젝트·워크스페이스 로직 | `server/services/*.ts` | **신규 + 기존 라우트 4개에서 추출** |
| 전이 규칙 | `shared/transition.ts` | 순수 (급소) |
| 에러 타입·코드 | `server/lib/errors.ts` + §6.1 표 | 공통 |
| MCP 프로토콜 | `server/mcp/index.ts` | 어댑터 |
| MCP 툴 정의 | `server/mcp/tools.ts` | 어댑터 |
| PAT 해시·검증 | `server/lib/token.ts` | 순수 (crypto만) |
| 백로그 UI | `src/features/backlog/` (components/ hooks/ api.ts — 1차 features 규약) | 프론트 |
| 토큰 UI | `src/features/tokens/` | 프론트 |

**기존 라우트 서비스 추출 범위**: 라우트의 쿼리·분기를 함수로 옮기는 **기계적 이동**이다.
동작 변경은 FR-20(에러 코드 통일) 단 하나 — 그 외 응답이 1차 사이클과 byte-동일해야 하며,
이를 module-1 완료 판정에 포함한다(리팩토링 회귀 방어).

---

## 10. Coding Convention Reference

1차 §10 전부 유지. 이번 사이클 추가분:

| 항목 | 규칙 |
|------|------|
| MCP 툴 이름 | `{리소스}_{동작}` snake_case (Plan §8.2) |
| 서비스 함수 | `{동사}{리소스}` camelCase — `listBacklog`, `reorderBacklog`, `issueToken` |
| 에러 | 서비스는 `ServiceError`만 throw. 어댑터 밖으로 HTTPException 직접 던지지 않기 (기존 코드는 module-1에서 정리) |
| 상태·중요도 라벨 | enum(영문)↔한글 매핑은 `src/features/backlog/lib/labels.ts` 1곳 |

---

## 11. Implementation Guide

### 11.1 신규·수정 파일

```
신규 (~22):
  server/services/{workspaces,projects,documents,backlog,tokens}.ts
  server/mcp/{index,tools}.ts
  server/lib/{errors,token}.ts
  server/routes/{backlog,tokens}.ts
  shared/transition.ts (+ transition.test.ts)
  src/features/backlog/{api.ts, components/{BacklogPage,BacklogCard,ItemDialog,SectionCollapse}.tsx,
                        hooks/useBacklog.ts, lib/labels.ts}
  src/features/tokens/{api.ts, components/TokensPage.tsx}
수정 (~8):
  server/db/schema.ts (+2테이블) · shared/schema.ts (+zod)
  server/middleware/auth.ts (PAT 분기) · server/app.ts (라우트 3 + onError 표 반영)
  server/routes/{workspaces,projects,documents}.ts (서비스 추출로 얇게)
  src/app/{router,providers}.tsx (라우트 순서 주의 + 401 핸들러)
  src/components/shell/SidebarTree.tsx 등 (진입 링크)
```

### 11.2 구현 순서 (Plan §9 모듈에 Design 섹션 매핑)

| Module | 내용 | Design 참조 | 완료 판정 |
|:------:|------|-------------|-----------|
| 1 | 스키마·서비스 계층(신규+기존 추출)·백로그 API·에러 표 | §3, §4.1, §6, §9 | L1 #4·8·9·13 + L0 T1~T8 + **기존 API 응답 무회귀** |
| 2 | 백로그 UI 전체 | §5 | §5.4 `[module-2]` 전 항목 즉시 대조 |
| 3 | PAT + auth 분기 + 401 핸들러 | §3.2, §4.2, §5.4 `[module-3]` | L1 #1~3 + **전 라우트 회귀 스윕** |
| 4 | MCP 스파이크 → 툴 8개 → C7 완주 | §4.3, §4.4, §6.2, §8.3 | L1 #6·7·10·11·12 + **C7** |

### 11.3 Session Guide

#### Module Map

| Module | Scope Key | 내용 | 예상 규모 |
|--------|-----------|------|:---------:|
| 백엔드 기반 | `module-1` | 스키마 + 서비스 추출 + 백로그 API + 에러 표 | **대** (리팩토링 포함) |
| 보드 UI | `module-2` | 백로그 화면·드래그·팝업 | 중 |
| 인증 | `module-3` | PAT + 분기 + 회귀 스윕 | 소 |
| MCP | `module-4` | 스파이크 + 툴 + C7 | 중 |

#### 권장 세션 계획

| 세션 | 스코프 | 비고 |
|------|--------|------|
| 1 | Plan + Design | 완료 (본 문서) |
| 2 | `--scope module-1` | 서비스 추출 회귀 확인이 종료 조건 |
| 3 | `--scope module-2` | §5.4 module-2 체크리스트 대조까지 |
| 4 | `--scope module-3,module-4` | 스파이크 실패 시 여기서 중단·재설계. **C7 완주는 반드시 이 세션에서** |

---

## Version History

| 버전 | 날짜 | 변경 내용 | 작성자 |
|------|------|-----------|--------|
| 0.1 | 2026-08-07 | 최초 작성. Checkpoint 3에서 옵션 B(Clean — 서비스 계층) 선택. Plan §6.2 검증 3건 반영(MCP stateless 사양 적합·`claude mcp add` 헤더 방식·Neon 단일문/배치 원자성). Plan §8.3 미결(TOKEN_HASH_SECRET)을 "불필요"로 확정, 에러 코드 표(§6.1) 확정 및 PATH_TAKEN→CONFLICT 통일 결정 | cogmo |
| 0.2 | 2026-08-07 | Check 단계 중 D-18 추가: claude.ai 웹 커넥터 대응으로 MCP 인증에 `?token=` 쿼리파라미터 폴백(PAT 한정) 추가. §4.2 갱신 | cogmo |
| 0.3 | 2026-08-08 | **(사후 확인, refine-mcp-hardening 사이클 module-1)** §6.1에 403 `FORBIDDEN` 행 추가 — Origin 거부가 표를 안 지나는 리터럴 응답이던 균열(I-3)을 코드(`mcp/index.ts`가 `ServiceError('FORBIDDEN', ...)` throw)와 같은 커밋에서 정합화(RK-12) | cogmo |
| 0.4 | 2026-08-08 | **(사후 확인, refine-mcp-hardening 사이클 module-4, S5)** §6.3에 FR-21 실구현 위치 정정 추가(M-1) — Design은 QueryClient onError를 지정했지만 실제는 `src/lib/api.ts`의 `authedFetch` | cogmo |
