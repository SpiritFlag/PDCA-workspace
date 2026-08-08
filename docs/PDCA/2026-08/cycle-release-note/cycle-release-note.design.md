---
template: design
version: 1.3
---

# cycle-release-note 설계 문서

> ⚠️ **사후 재구성 문서(post-hoc)**. 아래 설계는 **구현을 읽고 기술한 것**이지 구현을 지시한 것이 아니다.
> 따라서 이 문서 대비 Gap Analysis는 정의상 100%가 되며 **아무 정보도 주지 않는다.**
> 실제 검증은 [analysis](./cycle-release-note.analysis.md)에서 **프로젝트 규약·2차 회고 Try 대비**로 수행한다.
> 본문에서 규약을 어긴 자리는 ⚠️ 로 표시해 둔다 — 그 표시가 이 문서의 실질적 가치다.
>
> **프로젝트**: PDCA-workspace
> **작성자**: cogmo
> **작성일**: 2026-08-08 (구현 완료 후 역추적 작성)
> **상태**: 사후 확정본
> **Plan 문서**: [cycle-release-note.plan.md](./cycle-release-note.plan.md)
> **PDCA Cycle**: cycle-release-note (3번째 사이클, `v0.1.2`)

---

## Context Anchor

> Plan에서 복사.

| Key | Value |
|-----|-------|
| **WHY** | 문서·백로그는 1급 데이터가 됐는데 릴리즈(버전)만 데이터가 아니다. 사이클을 묶는 유일한 수단이 경로 컨벤션이라 앱이 "이 릴리즈에 뭐가 들었나"를 대답하지 못한다. |
| **WHO** | 형(cogmo) — 브라우저 실사용자. 이번엔 클로드가 소비자가 아니다(cycles MCP 툴 0개, 누락). |
| **RISK** | PDCA 없이 구현부터 한 것(RK-01) / 사후 Design은 자기충족(RK-02) / 팔레트 규약 의도적 개정(RK-03) / 프로덕션 설정에 dev 예외 유입(RK-04). |
| **SUCCESS** | C1~C8. 핵심은 **C3 — 버전 카드 4버튼 왕복**. |
| **SCOPE** | 축1 DB+API / 축2 버전 UI / 축3 임포트 재설계 / 축4 셸·화면 / 축5 테마 / 축6 로컬 개발 서버. |

---

## 1. Overview

### 1.1 설계 목표

| # | 목표 | 실현 수단 |
|---|------|-----------|
| G1 | 릴리즈를 1급 데이터로 세운다 | `cycles` 테이블, `version` 유일 제약 |
| G2 | 사이클 연결은 **선택**이되, 연결하면 반드시 완전하다 | `name`·`yearMonth` nullable + pair refine |
| G3 | RULE.md의 경로 컨벤션을 코드 단일 원천으로 승격 | `cyclePath.ts` |
| G4 | 버전 정렬의 함정(`v0.1.10 < v0.1.2`)을 테스트로 못박는다 | `versionSort.ts` + 11 케이스 |
| G5 | 문서 생성 동선을 "경로 입력"에서 "사이클 선택"으로 뒤집는다 | `ImportDialog` 생성 모드 재설계 + `prefill` |
| G6 | 2차의 3층(라우트→서비스→scoped)을 새 도메인에도 그대로 적용 | `routes/cycles.ts` → `services/cycles.ts` → `db/scoped.ts` |

### 1.2 설계 원칙

1. **새 계층·새 패턴을 만들지 않는다.** cycles는 documents/backlog의 구조를 글자 그대로 복제한다.
2. **순수 함수를 단일 원천으로 둔다.** 2차 `shared/transition.ts`의 성공 패턴을 `cyclePath.ts`·`versionSort.ts`로 잇는다.
3. **DB에 정렬·표현 로직을 넣지 않는다.** 버전 비교는 클라이언트 순수 함수(D-21).
4. **기존 동작을 분기로 보존한다.** `ImportDialog` 편집 모드는 손대지 않고 생성 모드만 갈아끼운다.
5. **토큰 이름은 계약이다.** 팔레트를 바꿔도 `--ctp-*` 이름은 유지해 호출부를 건드리지 않는다(D-25).

---

## 2. Architecture Options

### 2.0 아키텍처 비교 (Checkpoint 3 — **이번 사이클엔 존재하지 않았음**)

> 아래는 사후에 복원한 "당시 선택지였을 것"이다. 실제로는 비교·승인 없이 A안이 바로 구현됐다.

| 안 | 내용 | 장점 | 단점 | 판정 |
|----|------|------|------|:---:|
| **A. 버전 1급 + 사이클 선택 연결** | `cycles.version` 유일, `name`·`yearMonth` nullable | 사이클 없는 릴리즈 표현 가능. 릴리즈노트가 버전에 자연히 붙음 | 테이블명이 `cycles`인데 의미는 "버전"이라 이름-의미 괴리 ⚠️ | **채택(실구현)** |
| B. 사이클 1급 + 버전 속성 | `name` 유일, `version` 선택 | 이름-의미 일치 | 핫픽스 등 사이클 없는 릴리즈 불가. `0002` 마이그레이션이 이 안이었다가 `0003`에서 폐기 | 폐기(F-03) |
| C. 릴리즈노트를 documents로 | `docs/RELEASE/*.md` 레코드 | 새 테이블 불필요, 기존 뷰어 재사용 | 문서 트리 오염 + 경로 미러링(D-13)에 억지 편입 + 버전 유일성 강제 불가 | 미채택 |

> ⚠️ **A안의 잔재**: 모델은 "버전"으로 뒤집혔는데 **테이블·라우트·파일명은 전부 `cycles`로 남았다.**
> UI 레이블만 "버전"이라 코드와 화면의 용어가 어긋난다([analysis](./cycle-release-note.analysis.md) M-6).

### 2.1 컴포넌트 다이어그램

```
[ProjectOverviewPage]
   ├── ProjectForm (인라인 수정)
   ├── ★백로그 링크
   ├── CycleList ──────────────────────────────┐
   │     ├── CycleForm (생성/수정)             │
   │     ├── CycleCard × N                     │
   │     │     ├── ReleaseNoteView (펼침)      │
   │     │     └── stage 4버튼 ────────────────┤ 문서 존재 → <Link>
   │     │                                     │ 문서 부재 → onCreateStage
   │     └── ImportDialog(prefill) ◄───────────┘
   └── DocumentList

[SidebarTree]  (전역, 프로젝트 진입 불필요)
   └── WorkspaceNode × N
         └── ProjectNode × N
               ├── ★백로그
               ├── VersionsSection  → useCycles + sortCycles
               └── DocumentsSection → useDocuments + buildDocTree

server:  routes/cycles.ts → services/cycles.ts → db/scoped.ts → drizzle(cycles)
shared:  schema.ts (cycleVersionSchema / cycleNameSchema / yearMonthSchema / pair refine)
```

### 2.2 데이터 흐름 — C3 유즈케이스 (이 사이클의 중심 시나리오)

```
1. 형이 프로젝트 개요를 연다
     → GET /api/projects/:id/cycles      (useCycles)
     → GET /api/projects/:id/documents   (useDocuments)

2. CycleList가 sortCycles(cycles,'version-desc')로 정렬해 카드 렌더
     existingPaths = new Set(documents.map(d => d.path))

3. CycleCard가 각 stage에 대해 cycleStagePath(yearMonth, name, stage) 계산
     existingPaths.has(path) ?  <Link to={/w/:ws/p/:proj/{path}}>  (단계색)
                             :  <button>+ stage</button>            (점선)

4. "+ design" 클릭
     → setStageCreate({ name, stage:'design', yearMonth })
     → <ImportDialog prefill={...}>  — 경로 고정, 사용자는 마크다운만 입력

5. 생성 → POST /api/projects/:id/documents
     → invalidate ['documents', projectId]
     → 3번이 재평가되어 같은 버튼이 링크로 바뀐다
```

> 4→5의 갱신 고리가 이 설계의 급소다. `existingPaths`가 documents 쿼리에서 파생되므로
> 문서 생성 후 캐시 무효화만으로 버튼 상태가 자동 전환된다 — 별도 상태 동기화 코드가 없다.

### 2.3 의존 관계

| From | To | 성격 |
|------|----|------|
| `SidebarTree` | `features/cycle/hooks`, `features/cycle/lib` | 셸 → feature (기존 `features/document` 의존과 동일 패턴) |
| `CycleList` | `features/document/components/ImportDialog`, `hooks/useDocuments` | **feature → feature 교차 의존** ⚠️ — 문서 생성 UI를 재사용하기 위한 의도적 선택 |
| `CycleCard` | `features/document/lib/stageColor` | 단계색 단일 원천 재사용 ✅ |
| `ImportDialog` | (없음) | ⚠️ `cyclePath`·`yearMonth`를 재사용하지 않고 **자체 복제**했다 → analysis I-3 |

---

## 3. Data Model

### 3.1 Drizzle 스키마 (`server/db/schema.ts`)

```ts
export const cycles = pgTable('cycles', {
  id:          uuid('id').primaryKey().defaultRandom(),
  projectId:   uuid('project_id').notNull().references(() => projects.id, { onDelete: 'cascade' }),
  version:     text('version').notNull(),   // "v0.1.0" — 정렬은 클라이언트 versionSort가 담당
  releaseNote: text('release_note'),        // 마크다운
  name:        text('name'),                // 사이클 폴더명(연결 시)
  yearMonth:   text('year_month'),          // "2026-08" — 경로 조립용(연결 시)
  createdAt:   timestamp(...).notNull().defaultNow(),
  updatedAt:   timestamp(...).notNull().defaultNow(),
}, (t) => [
  uniqueIndex('cycles_proj_version_uq').on(t.projectId, t.version),
  uniqueIndex('cycles_proj_name_uq').on(t.projectId, t.name),
  index('cycles_proj_idx').on(t.projectId),
])
```

**핵심 결정 3가지**

| 결정 | 이유 |
|------|------|
| `name` nullable인데 unique 인덱스를 건다 | postgres btree unique는 NULL 중복을 허용 → "연결된 사이클끼리만 유일"이 공짜로 성립(D-26) |
| `version`이 진짜 유일키 | 릴리즈가 1급이라는 D-19의 실체 |
| 정렬 컬럼 없음 | 클라이언트 `versionSort`가 담당(D-21) |

### 3.2 마이그레이션 이력 — 모델 전환의 물증

| 파일 | 내용 |
|------|------|
| `0002_rich_falcon.sql` | `cycles` 생성 — `name` **NOT NULL**, `year_month` **NOT NULL**, `release_note` **없음**, `(project_id,name)` unique만 |
| `0003_odd_rawhide_kid.sql` | `name`·`year_month` **DROP NOT NULL**, `release_note` **추가**, `(project_id,version)` unique **추가** |

> 두 마이그레이션이 **같은 커밋**(`a78f188`)에 들어 있다 = 설계 도중 "사이클 우선 → 버전 우선"으로
> 방향을 바꾼 흔적이 스키마에 화석으로 남았다. 사전 설계가 있었다면 `0002` 하나로 끝났을 자리다.
> ⚠️ 이것이 "PDCA 없이 진행"의 비용이 **코드에 남긴 가장 구체적인 자국**이다.

### 3.3 zod 스키마 (`shared/schema.ts`)

```ts
export const cycleVersionSchema = z.string().regex(/^v\d+\.\d+\.\d+$/, ...)
export const yearMonthSchema    = z.string().regex(/^\d{4}-\d{2}$/, ...)
export const cycleNameSchema    = z.string().min(1).max(100)
                                   .regex(/^[A-Za-z0-9._-]+$/, ...)  // 경로 세그먼트 안전성

const cycleFields = z.object({
  version:     cycleVersionSchema,
  releaseNote: z.string().max(50000).optional(),
  name:        cycleNameSchema.optional(),
  yearMonth:   yearMonthSchema.optional(),
})

// 연결하려면 둘 다, 안 하려면 둘 다 없어야 한다
const cyclePairRule = (v) => (v.name === undefined) === (v.yearMonth === undefined)

export const createCycleSchema = cycleFields.refine(cyclePairRule, { path: ['name'] })
export const updateCycleSchema = cycleFields.partial()   // ⚠️ refine 소실
```

> **⚠️ 설계 결함 2건이 이 10줄에 있다.**
>
> 1. `updateCycleSchema`가 `partial()`이라 **pair refine이 사라진다.** `PATCH {name:'x'}`만 보내면
>    `name`은 있고 `yearMonth`는 null인 부정합 레코드가 만들어진다. 그 레코드는 UI에서
>    `hasCycle = !!name && !!yearMonth`가 false라 사이클 미연결로 보이지만,
>    `cycles_proj_name_uq`는 점유하고 있어 같은 이름으로 다른 버전을 만들면
>    "이미 존재하는 사이클명입니다"만 뜨고 **원인이 화면 어디에도 안 보인다**(analysis I-1).
> 2. `name`·`yearMonth`가 `.optional()`이고 `.nullable()`이 아니라서 **한 번 연결한 사이클을 해제할 수 없다.**
>    `undefined`는 JSON 직렬화에서 키째 사라지므로 PATCH 본문에 안 실리고, 서버는 기존 값을 유지한다.
>    → **2차 사이클의 `closedOn` 삭제 불가(Critical)와 완전히 같은 클래스의 버그가 재발했다**(analysis C-1).
>    2차 회고 Try #1("날짜·선택 필드는 zod 작성 시 지울 수 있는가를 명시적으로 결정하고 `.nullable()` 여부를
>    Design 표에 기록")이 **적용되지 않았다.**

### 3.4 순수 함수 모듈

| 모듈 | 계약 | 테스트 |
|------|------|:---:|
| `cyclePath.ts` | `cycleStagePath(ym, name, stage) → docs/PDCA/{ym}/{name}/{name}.{stage}.md`, `PDCA_STAGES` 상수 | ❌ 없음 |
| `versionSort.ts` | `parseVersion` / `compareVersions` / `sortCycles(items, mode)` — 원본 불변 | ✅ 11 케이스 |
| `yearMonth.ts` | `currentYearMonth()`, `yearMonthOptions()` — 미래 2개월 ~ 과거 36개월 최신순 | ❌ 없음 |

---

## 4. API Specification

### 4.1 REST 엔드포인트

| 메서드 | 경로 | 요청 | 성공 | 실패 |
|--------|------|------|------|------|
| GET | `/api/projects/:projId/cycles` | — | 200 `{data: Cycle[]}` | 404 프로젝트 없음/타인 소유 |
| POST | `/api/projects/:projId/cycles` | `createCycleSchema` | 201 `{data: Cycle}` | 400 검증, 404, 409 version/name 중복 |
| PATCH | `/api/cycles/:id` | `updateCycleSchema` | 200 `{data: Cycle}` | 400, 404, 409 |
| DELETE | `/api/cycles/:id` | — | 204 | 404 |

`server/app.ts` 배선:

```ts
.use('/projects/*', authMiddleware)
.route('/projects', projectCyclesRoute)   // 프로젝트 하위
.use('/cycles/*', authMiddleware)
.route('/cycles', cycleItemRoute)         // 단건
```

> documents/backlog와 동일한 **2분할 라우트 패턴**(프로젝트 하위 / 단건)을 따른다 ✅

### 4.2 에러 매핑

| 상황 | 코드 | status | details |
|------|------|:---:|---------|
| 프로젝트 없음/타인 소유 | `NOT_FOUND` | 404 | — |
| 사이클 없음/타인 소유 | `NOT_FOUND` | 404 | — |
| version 중복 | `CONFLICT` | 409 | `{ target: 'version' }` |
| name 중복 | `CONFLICT` | 409 | `{ target: 'name' }` |
| zod 실패 | `VALIDATION_ERROR` | 400 | zod issues |

✅ 신규 에러 코드를 만들지 않았다 — 2차 FR-20 규약 준수.
⚠️ 다만 `details.target`의 새 값(`'version'`, `'name'`)이 2차 Design §6.1 표에 등재되지 않았다(analysis M-5).

### 4.3 소유권 강제

cycles 전 쿼리가 `cycles → projects → workspaces.ownerId` 2단 조인을 통과한다 —
`listCycles`/`getCycle`/`getCycleByVersion`/`getCycleByName`/`createCycle`/`updateCycle`/`deleteCycle` 7함수 전부. ✅

```ts
.innerJoin(projects,   eq(cycles.projectId, projects.id))
.innerJoin(workspaces, eq(projects.workspaceId, workspaces.id))
.where(and(..., eq(workspaces.ownerId, ownerId)))
```

### 4.4 MCP 노출

**없음.** ⚠️ `server/mcp/tools.ts`는 여전히 8툴(`project_list`, `document_list/read/write`,
`backlog_list/create/update/reorder`)이고 cycles 툴은 0개다.
2차의 핵심 가치("판단에 필요한 데이터를 클로드가 직접 읽는다")가 **새로 만든 1급 데이터에는 적용되지 않았다**(analysis I-2).

---

## 5. UI/UX Design

### 5.1 프로젝트 개요 (`/w/:ws/p/:proj`)

```
← 워크스페이스명
프로젝트명                                    [수정]
/slug
🔗 서비스 URL   GitHub (branch)
설명…
┌────────────────────────────────────────────┐
│              ★ 백로그                       │  ← 강조 버튼(mauve 블록)으로 승격
└────────────────────────────────────────────┘
버전 (N)                    [정렬 ▾] [+ 버전 추가]
  ┌──────────────────────────────────────────┐
  │ ▶ v0.1.2  cycle-release-note   수정 삭제 │
  │ ┌──────┬──────┬──────────┬──────┐        │
  │ │ plan │design│ analysis │report│        │  존재=단계색 링크 / 부재=점선 +버튼
  │ └──────┴──────┴──────────┴──────┘        │
  └──────────────────────────────────────────┘
문서 목록…
```

| 요소 | 동작 |
|------|------|
| 카드 헤더 클릭 | 릴리즈노트 펼침/접힘(▶/▼). 노트 없으면 "릴리즈 노트가 없습니다." |
| 정렬 셀렉트 | 버전 최신순(기본) / 버전 오래된순 / 이름순 |
| 삭제 | `confirm("… 연결된 문서 자체는 그대로 남습니다")` — 캐스케이드 없음을 문구로 고지 |
| 인라인 수정 | 개요 헤더의 [수정] → `ProjectForm`/`WorkspaceForm` 인라인 전환 |

### 5.2 버전 폼 (`CycleForm`)

버전 → 릴리즈노트(textarea 6행) → `☐ PDCA 사이클 연결` 체크박스 → (체크 시) 사이클명 + 연월 셀렉트.

토글이 폼 상태를 직접 동기화한다:

```ts
function toggleLink(on) {
  if (on)  { if (!getValues('yearMonth')) setValue('yearMonth', currentYearMonth()) }
  else     { setValue('name', undefined); setValue('yearMonth', undefined) }
}
```

> ⚠️ 이 `setValue(undefined)`가 **끄기 방향으로는 작동하지 않는다.** 클라이언트 zod(pairRule)는 통과하지만
> 직렬화에서 키가 사라져 서버에 도달하지 않는다(§3.3 결함 2). **체크를 끄고 저장해도 에러 없이 아무 일도 안 일어난다** —
> 2차 `closedOn`과 같은 "조용한 실패" UX다.

### 5.3 임포트 폼 재설계 (`ImportDialog`)

3가지 모드로 분기한다.

| 모드 | 조건 | 입력 |
|------|------|------|
| **편집** | `document` 있음 | 제목 + 경로 자유입력 + 분류/단계 — **1차 동작 그대로 보존** |
| **프리필 생성** | `prefill` 있음 | 입력 없음. 대상 경로를 읽기전용 표시, 사용자는 마크다운만 |
| **일반 생성** | 그 외 | 분류 → 사이클명/문서명 → (pdca)단계 → 연월 셀렉트, 경로는 조립 결과를 인라인 표시 |

경로·제목 파생:

```ts
const derivedPath = kind === 'pdca'
  ? `docs/PDCA/${ym}/${name}/${name}.${stage}.md`   // ⚠️ cycleStagePath() 미사용
  : `docs/${tail}`
const effectivePath  = isEdit ? path  : derivedPath
const effectiveTitle = isEdit ? title : name.trim()
```

> ⚠️ **규약 위반 3건이 이 파일에 몰려 있다**(analysis I-3):
> 1. 경로 템플릿을 `cycleStagePath()` 대신 하드코딩 — D-22 위반
> 2. `ymOf`/`currentYm`/`MONTH_OPTIONS`를 `yearMonth.ts`와 **똑같이 다시 구현** — 단일 원천 위반
> 3. 사이클명 검증이 `cycleNameSchema`(`[A-Za-z0-9._-]`)가 아니라 `/[/\s]/` 금지뿐 — **한글 사이클명이 통과한다.**
>    같은 이름을 `CycleForm`에 넣으면 거부되므로 **두 화면의 규칙이 어긋난다.**

### 5.4 사이드바 전역 계층 네비 (`SidebarTree`)

```
▾ 워크스페이스A                    ← useProjects(ws.id)
  ▾ 프로젝트1
      ★ 백로그
      ▾ ⛿ 버전 (3)                ← useCycles + sortCycles('version-desc')
          v0.1.2  cycle-release-note
          v0.1.1  backlog-with-mcp
      ▾ 문서 (67)                  ← useDocuments + buildDocTree
          docs/…
  ▸ 프로젝트2
▸ 워크스페이스B
```

| 항목 | 설계 |
|------|------|
| 자동 펼침 | `useState(active)` — 현재 URL에 해당하는 노드를 **마운트 시점에** 펼친다 |
| 데이터 로딩 | `WorkspaceNode`는 항상 `useProjects` 호출. `VersionsSection`/`DocumentsSection`은 열렸을 때만 렌더 → 그때만 fetch |
| 빈 상태 | "워크스페이스가 없습니다" / "프로젝트 없음" / "버전 없음" / "문서 없음" |

> ⚠️ 설계상 한계 2건:
> 1. `useState(active)`는 **초기값만** 반영한다. 사이드바는 라우트 전환에도 언마운트되지 않으므로,
>    다른 워크스페이스로 이동해도 그 노드는 자동으로 펼쳐지지 않는다(analysis M-1).
> 2. `WorkspaceNode`가 접혀 있어도 `useProjects`가 실행되어 **워크스페이스 수만큼 요청이 나간다**(analysis M-2).

### 5.5 팔레트 (D-25 규약 개정)

| 토큰 | Latte(라이트) | Mocha(다크) | 비고 |
|------|------|------|------|
| `--ctp-base` | `#f1f6f6` | `#152029` | 쿨 그레이-틸 |
| `--ctp-mauve` | `#0e9488` | `#2dd4bf` | **주 강조를 보라→틸로 교체** |
| `--ctp-lavender` | `#7c6cf0` | `#a99bf5` | **신설** — 원래 mauve 자리의 보라 |
| `--ctp-blue` | `#0ea5e9` | `#58c4f0` | 스카이 |
| `--ctp-peach`/`yellow`/`green`/`teal`/`red` | 여름 톤으로 재조정 | 〃 | |

연쇄 변경: `STAGE_COLOR.design`이 `mauve` → **`lavender`**.
주 강조색이 틸이 되면서 `design`(구 mauve)이 `plan`(blue)과 색이 겹칠 뻔한 걸 분리한 것.

> ✅ **토큰 이름을 유지했기 때문에 CSS 파일 1개 + 상수 1줄만 바뀌었다.** 컴포넌트 코드 변경 0줄.
> 1차 §5.5가 세운 "색은 변수로만" 규약의 값을 실제로 증명한 자리다.
> 다만 파일명·주석이 여전히 `catppuccin.css`라 이름이 내용을 배신한다(analysis M-7).

---

## 6. Error Handling

### 6.1 사용 코드 (2차 §6.1 표 준수, 신설 0건)

| 코드 | status | cycles에서의 발생 |
|------|:---:|------|
| `VALIDATION_ERROR` | 400 | 버전 형식, 사이클명 문자, 연월 형식, pair rule 위반 |
| `UNAUTHORIZED` | 401 | 미인증 |
| `NOT_FOUND` | 404 | 프로젝트/사이클 부재 또는 타인 소유 |
| `CONFLICT` | 409 | version 중복(`target:'version'`), name 중복(`target:'name'`) |
| `INTERNAL` | 500 | 그 외 |

### 6.2 클라이언트 처리

| 계층 | 동작 |
|------|------|
| `api.ts` | 생성/수정은 `{ok:false, error}`로 반환(throw 안 함) → 폼이 인라인 메시지 표시 |
| `CycleList` | `formError` state로 폼 위에 빨간 텍스트 |
| 삭제 | ⚠️ `deleteCycleRequest`는 실패 시 **throw**하는데 `handleDelete`에 `try/catch`가 없다 → 미처리 rejection(analysis M-8) |

---

## 7. Security Considerations

| 항목 | 설계 | 상태 |
|------|------|:---:|
| 소유권 | cycles 전 쿼리 ownerId 2단 조인 | ✅ |
| 인증 | `/projects/*`, `/cycles/*` 둘 다 `authMiddleware` | ✅ |
| XSS | 릴리즈노트 = react-markdown(raw HTML 미파싱) + `rehype-sanitize` | ✅ |
| 경로 주입 | `cycleNameSchema`가 `/`·공백·`..`을 차단 → 경로 조립 안전 | ✅ (단, `ImportDialog`는 별도 규칙 ⚠️) |
| 입력 크기 | 릴리즈노트 50,000자 상한 | ✅ |
| 신규 노출면 | 없음 — 새 인증 경로·새 공개 엔드포인트 0건 | ✅ |

---

## 8. Test Plan

### 8.1 실제 커버리지

| 레벨 | 대상 | 상태 |
|------|------|:---:|
| L0 단위 | `versionSort` — parse 3 / compare 4 / sort 4 = 11 케이스 | ✅ |
| L0 단위 | `cyclePath`, `yearMonth` | ❌ 없음 |
| L1 API | cycles 4엔드포인트 (`app.request()` 실 DB 하네스) | ❌ **미실행** |
| L3 E2E | C3 왕복 시나리오 | ❌ 미실행 |
| 회귀 | 기존 35 + 신규 11 = 46 통과, lint·`tsc -b` 클린 | ✅ |

> ⚠️ **2차 사이클 회고 Keep #1**("실 DB 하네스로 배포 없이 배포처럼 검증")이 이번엔 한 번도 안 쓰였다.
> 순수 함수만 테스트했고, **DB·HTTP·권한 경계를 지나는 경로는 단 한 줄도 실행 검증되지 않았다**(analysis I-4).

### 8.2 있었어야 할 L1 시나리오 (미실행 — 이월)

| # | 시나리오 | 기대 |
|---|----------|------|
| 1 | 미인증 `GET /api/projects/:id/cycles` | 401 |
| 2 | 타인 프로젝트의 cycles 조회 | 404 |
| 3 | 사이클 미연결 버전 생성 | 201, name·yearMonth null |
| 4 | 사이클 연결 버전 생성 | 201, 둘 다 저장 |
| 5 | `name`만 보내고 `yearMonth` 생략 | **400 기대 / 실제는 201** ← I-1 재현 |
| 6 | 같은 version 재생성 | 409 `target:'version'` |
| 7 | 같은 name 재생성 | 409 `target:'name'` |
| 8 | 잘못된 버전 형식(`0.1.0`) | 400 |
| 9 | 한글 사이클명 | 400 |
| 10 | PATCH로 사이클 연결 해제 시도 | **해제 기대 / 실제는 무시** ← C-1 재현 |
| 11 | DELETE 후 재조회 | 404, 문서는 잔존 |

---

## 9. Clean Architecture (옵션 B 준수)

### 9.1 계층 규칙

| 계층 | 파일 | 아는 것 | 모르는 것 |
|------|------|---------|-----------|
| Route | `routes/cycles.ts` | Hono, zod 스키마, 서비스 | **Drizzle** ✅ 0건 |
| Service | `services/cycles.ts` | `db/scoped`, `ServiceError` | Hono, HTTP status |
| Data | `db/scoped.ts` | Drizzle, ownerId 조인 | 도메인 에러 의미 |

`services/cycles.ts`는 scoped의 판별 유니온(`{error:'VERSION_TAKEN'}` 등)을 `ServiceError`로 번역하는
얇은 어댑터 — documents 서비스와 같은 형태 ✅

### 9.2 배치

| 파일 | 줄수 | 역할 |
|------|:---:|------|
| `server/routes/cycles.ts` | 34 | 2분할 라우트 |
| `server/services/cycles.ts` | 43 | 도메인 로직 + 에러 번역 |
| `server/db/scoped.ts` (추가분) | 96 | cycles 7함수 |
| `shared/schema.ts` (추가분) | 35 | zod 스키마 4 + 타입 2 |
| `src/features/cycle/**` | 9파일 | api / hooks / components 4 / lib 3(+test) |

---

## 10. Coding Convention Reference

| 규약 | 준수 |
|------|:---:|
| 라우트에 Drizzle import 금지 | ✅ |
| 에러 코드 신설 금지 | ✅ |
| ownerId 2단 조인 | ✅ |
| 색상은 CSS 변수만 | ✅ |
| 경로 조립은 `cycleStagePath()`만 | ⚠️ **1건 위반**(ImportDialog) |
| 연월 옵션은 `yearMonth.ts`만 | ⚠️ **1건 위반**(ImportDialog) |
| 입력 검증은 `shared/schema.ts` 재사용 | ⚠️ **1건 위반**(ImportDialog 자체 정규식) |
| 한국어 주석으로 "왜"를 남긴다 | ✅ 신규 파일 전부 헤더 주석 보유 |

---

## 11. Implementation Guide

### 11.1 신규·수정 파일

| 구분 | 파일 |
|------|------|
| 신규(server) | `routes/cycles.ts`, `services/cycles.ts`, `dev-server.ts` |
| 신규(마이그레이션) | `drizzle/0002_rich_falcon.sql`, `drizzle/0003_odd_rawhide_kid.sql` (+ 스냅샷 2) |
| 신규(client) | `features/cycle/` 9파일 |
| 수정(server) | `db/schema.ts`, `db/scoped.ts`, `app.ts`, `shared/schema.ts` |
| 수정(client) | `ImportDialog.tsx`, `ProjectOverviewPage.tsx`, `ProjectListPage.tsx`, `ProjectList.tsx`, `WorkspaceList.tsx`, `SidebarTree.tsx`, `AppShell.tsx`, `stageColor.ts`, `catppuccin.css` |
| 수정(설정) | `vite.config.ts`, `vercel.json`, `package.json` |
| 삭제 | `prompt.tmp` (RULE.md의 `.tmp` 규칙 준수 ✅) |

### 11.2 로컬 개발 구성 (축6)

```
npm run dev:local
  ├── dev:api : .env.local 로드 → tsx watch server/dev-server.ts  (:3001 상주 Hono)
  └── vite    : :5173, /api → http://localhost:3001 프록시
npm run dev:vercel : vercel dev (프로덕션 경로와 동일하게 확인할 때만)
```

`vercel.json` SPA 폴백 정규식에 dev 경로 제외 추가:

```
(?!api/|src/|shared/|server/|@vite|@react-refresh|@id/|@fs/|node_modules/)
```

> ⚠️ 이 예외는 `vercel dev`에서만 의미가 있다. 프로덕션 빌드 산출물은 `/assets/*`이므로 실해는 없지만,
> **프로덕션 배포 설정 파일에 개발 전용 관심사가 들어갔다**(analysis M-4).

---

## Version History

| 버전 | 날짜 | 변경 내용 | 작성자 |
|------|------|-----------|--------|
| 0.1 | 2026-08-08 | **사후 재구성** 최초 작성. 구현된 구조를 설계 형식으로 기술하고, 규약을 어긴 자리 8곳을 ⚠️로 표시. §3.3(zod 결함 2건)·§3.2(마이그레이션 0002→0003 화석)·§5.3(ImportDialog 규약 위반 3건)·§8.1(런타임 실증 0건)이 본 문서의 실질 산출물 | cogmo |
