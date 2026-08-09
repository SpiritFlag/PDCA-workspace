---
template: design
version: 1.3
---

# refine-cycle-closing 설계 문서

> **한 줄 요약**: 사이클 종료의 문서 반영을 **3계층 스크립트**로 옮긴다 — 도메인(경로 왕복)은
> `cyclePath.ts`, I/O 계층(git 탐지·HTTP 클라이언트)은 `scripts/lib/` 2모듈, 조립은
> `scripts/docs-upload.ts` CLI 하나. 대상은 인자가 아니라 git이 정하고(최신 태그 이후
> `docs/PDCA` 변경분), 본문은 LLM 컨텍스트를 통과하지 않는다.
>
> **프로젝트**: PDCA-workspace
> **작성자**: Claude
> **작성일**: 2026-08-09
> **상태**: Checkpoint 3 확정(§1.4 — 형이 B안 선택) + V8~V10 실측 반영 완료
> **Plan 문서**: [refine-cycle-closing.plan.md](./refine-cycle-closing.plan.md) (v0.2 Approved)

---

## Context Anchor

> Plan에서 복사. Design→Do 인수인계에서 전략 맥락이 살아남도록.

| Key | Value |
|-----|-------|
| **WHY** | ①문서 본문의 LLM 경유가 토큰·정확도 양쪽에서 비용이다 ②대상 선정이 기억에 의존해 이전 사이클 사후개정분이 서버에 반영되지 않은 채 최소 2회 새어나갔다(F65). ②가 형이 직접 지목한 1급 동기이며, 이것이 스크립트의 성격을 "4종 업로더"에서 "**변경분 동기화기**"로 바꿨다. |
| **WHO** | 형 — 승인자, PAT 발급 주체(F60), 릴리즈 노트 작성자 / **클로드(Claude Code CLI) — 이 스크립트의 1급 소비자이자 유일한 상시 호출자** |
| **RISK** | git 기반 탐지가 의도치 않은 문서까지 올림(RK-38) / 역파서-빌더 왕복 불일치(RK-39) / PAT·서버 브랜치 불일치 401(RK-40) / ~~tsc 사각지대(RK-41)~~ **V9 실측으로 해소 경로 확정** / 절차 개정 사이클이 자기 자신을 그 절차로 닫음(RK-42) |
| **SUCCESS** | C26(본문 LLM 미경유)~C31(개정 절차로 자체 완주). C29(이전 사이클 사후개정 자동 포함)는 실제 상황을 만들어 실증해야 충족 |
| **SCOPE** | 6건 고정(S1 스크립트 / S2 git 대상 선정 / S3 역파서 / S4 사이클 생성 통합 / S5 tsc 커버리지 / S6 RULE.md 개정). 서버 코드 0줄. |

---

## 1. Overview

### 1.1 설계 목표

1. **본문 무경유** — 문서 내용이 디스크→스크립트→서버로만 흐른다. 클로드의 역할은 명령 1줄.
2. **대상의 구조적 결정** — "무엇을 올릴지"를 사람(형·클로드 모두)이 기억하지 않는다.
   `최신태그..HEAD` ∪ 작업트리가 유일한 결정 절차다.
3. **경로 규칙 사본 0** — 빌더·파서가 `cyclePath.ts` 한 파일에 공존하고 왕복 테스트로 묶인다.
   ImportDialog의 하드코딩(F62)이 남긴 교훈(I-3)을 세 번째 사본으로 반복하지 않는다.
4. **계층별 검증 가능성** — 형이 B안을 택한 취지. git 파싱·MCP 봉투 해석 같은 순수 로직을
   I/O에서 떼어내 단위 테스트가 닿는 자리에 둔다.

### 1.2 설계 원칙

- **순수 함수만 단위 테스트한다.** 이 프로젝트의 기존 테스트 6개 파일(path·transition·schema·
  versionSort·buildDocTree·extractLinks)은 전부 순수 함수 테스트고 목(mock)이 없다. 이번에도
  fetch·execFile을 목으로 감싸지 않는다 — I/O가 섞인 경로는 module-4 종단 검증(E1~E7)이 맡는다(D-65).
- **파싱과 실행의 분리.** git 명령 실행(I/O)과 그 출력 해석(순수)을 함수 경계로 가른다.
  테스트는 해석 함수에 실제 git 출력 표본(V8 실측물)을 먹인다.
- **에러는 파일 단위로 축적, 전체는 계속 진행**(FR-82). 실패 1건이 나머지 업로드를 막지 않는다.

### 1.3 Plan §6.3 검증 결과 (V8~V10 전건 실측 완료, 2026-08-09)

| ID | 결과 | 설계 반영 |
|----|------|-----------|
| **V7** | (Plan 단계 선실측) `docs/PDCA` 하위 26개 중 25개가 4종 패턴, 예외는 `_INDEX.md` 1개 | 역파싱 필터가 `_INDEX.md` 제외를 자동 충족 — 별도 예외 규칙 없음 |
| **V8** | ①작업트리는 `git status --porcelain` 기본값이 untracked **디렉터리를 축약**한다(이번 Plan 문서가 실제로 `.../refine-cycle-closing/` 폴더로 뭉쳐 나옴) — **`-uall` 필수** ②커밋분은 `git diff --name-status <태그>..HEAD`가 `M`/`A`/`D`/`R` 문자를 준다 ③과거 전 구간(v0.1.3..v0.1.5 표본 + 전체 로그) 실사용 문자는 **`M`·`A`·`??`뿐** — rename 이력 0건 ④표본에서 `_INDEX.md`가 `M`으로 잡혀 FR-78 필터 필요성 실증 | `detectChangedDocs`가 `-uall` 강제(D-67). `D`·`R`는 경고 후 제외(FR-88) — 실제 발생 이력 0건이라 Q17 결정("정교하게 만들지 않는다")과 정합 |
| **V9** | `tsconfig.server.json` include에 `"scripts"` 추가 → `tsc -b` 그린. `--listFilesOnly`로 `.mjs` 미포함(allowJs 미설정) 확인. **오류 주입 시 실제 검출(exit 2)** — RK-41의 검출력까지 선확인 | S5 확정: 1단어 추가. Do 단계 재확인 불요(이미 red를 봤다) |
| **V10** | 스크립트→`src/features/cycle/lib/cyclePath.ts` 교차 import가 tsc(server 설정으로 끌려와 컴파일)·tsx(런타임) **양쪽 성립**을 probe 파일로 확인 | D-56 실행 가능 확정. `scripts/lib/`→`src/` import도 같은 원리로 성립 |
| **F72** | (추가 실측) `src/features/cycle/lib/yearMonth.ts` 존재 — Plan 누락분. UI 드롭다운 소스 전용(현재월 기준 ±범위 생성) | 이번 스크립트와 무관(연월은 경로에서 나옴). 재사용 대상 아님 |
| **F73** | (추가 실측) 테스트 병치 관례 — `versionSort.test.ts`가 소스와 같은 디렉터리, vitest 기본 수집(`**/*.test.ts`) | `cyclePath.test.ts`·`scripts/lib/*.test.ts` 병치. `vitest.l1.config.ts`는 `*.l1.ts`만 수집하므로 충돌 없음 |

### 1.4 Checkpoint 3 — 형 결정 (2026-08-09)

**형이 B안(클린 분리)을 선택했다** — 클로드 권고는 C안(파서만 분리)이었다. 5차 A1과 같은
"형의 반론이 기준선이 되는" 사례로, 이 문서 전체가 B 구조를 따른다.

| 안 | 구조 | 결과 |
|----|------|------|
| A: 최소 | 스크립트 1파일 자급자족(역파서 내장) | 배제 — 경로 규칙 3번째 사본, D-56 위반 |
| **B: 클린** | **`scripts/lib/` 계층 분리 + 계층별 단위 테스트** | **채택(형 결정, D-66)** |
| C: 실용 | 파서만 `cyclePath.ts`, 본체 1파일 | 클로드 권고였으나 미채택 |

B가 C 대비 추가로 사는 것: git 출력 파싱·MCP 봉투 해석이 **순수 함수로 강제 분리**되어
단위 테스트가 닿는다(C안에서는 이 로직이 CLI 본체에 섞여 종단 검증으로만 커버). 대가:
신규 파일 2→5~6개. 소비자가 아직 스크립트 하나라 재사용 수익은 미래분이다.

---

## 2. Architecture

### 2.1 컴포넌트 다이어그램 (B 구조)

```
                     scripts/docs-upload.ts  (CLI 엔트리)
                     인자 파싱 · 흐름 조립 · 출력 · exit code — 로직 없음
                            │                    │
             ┌──────────────┘                    └──────────────┐
             ▼                                                  ▼
  scripts/lib/git-changes.ts                    scripts/lib/workspace-api.ts
  ┌──────────────────────────┐                  ┌──────────────────────────┐
  │ [I/O] runGit (execFile)  │                  │ [I/O] callTool (fetch)   │
  │ [순수] parseStatusLines  │◀─ 단위 테스트    │ [I/O] createCycle (fetch)│
  │ [순수] parseDiffLines    │◀─ 단위 테스트    │ [순수] parseToolEnvelope │◀─ 단위 테스트
  └────────────┬─────────────┘                  └────────────┬─────────────┘
               │ 변경 경로 목록                                │ HTTP
               ▼                                             ▼
  src/features/cycle/lib/cyclePath.ts            ┌─────────────────────────┐
  ┌──────────────────────────┐                   │  서버 (무변경, 0줄)      │
  │ cycleStagePath   (기존)  │                   │  /api/mcp document_write│ ← upsert (F56)
  │ parseCycleStagePath(신설)│◀─ 왕복 테스트     │  POST /cycles (REST)    │ ← 생성 (F57)
  │ PDCA_STAGES      (기존)  │                   │  /api/mcp project_list  │ ← 해석 (F70)
  └──────────────────────────┘                   └─────────────────────────┘
```

의존 방향: `docs-upload.ts` → `scripts/lib/*` → `src/features/cycle/lib/cyclePath.ts`.
역방향 금지 — `cyclePath.ts`는 순수 도메인이라 아무것도 import하지 않는 현 상태를 유지한다.
`scripts/lib/` 두 모듈은 서로 import하지 않는다(둘을 아는 것은 CLI뿐).

### 2.2 실행 흐름 (Plan §7.3 + Q17·Q18 반영 확정본)

```
npm run docs:upload -- [--cycle <이름>] [--version vX.Y.Z] [--all] [--base-url <url>]
  │
  ├─ 0. .env.local 주입(package.json set -a 패턴) · PDCAW_PAT 검사        [FR-84]
  │     인자 검증: --version은 --cycle 동반 필수                          [D-64]
  │
  ├─ 1. 대상 선정 ─────────────────────────── git-changes.ts
  │     --all이면 git 생략, docs/PDCA 전체 글롭                           [FR-77]
  │     아니면: 최신 태그(없으면 에러+--all 안내)                          [FR-86]
  │       diff --name-status <태그>..HEAD ∪ status --porcelain -uall     [FR-76·D-67]
  │     D·R → 경고 출력 후 제외 (서버 요청 없음)                           [FR-88]
  │     .md 필터 → parseCycleStagePath 성공분만(실패는 사유 출력)          [FR-78]
  │     --cycle 필터 → 대상 목록 출력                                     [RK-38]
  │     0건이면 "변경된 문서 없음" exit 0                                  [FR-87]
  │
  ├─ 2. 프로젝트 해석 — PDCAW_PROJECT_ID ?? project_list  ── workspace-api.ts [FR-85]
  │
  ├─ 3. 사이클 생성(--version 시) ── workspace-api.ts
  │     연월 = --cycle 사이클의 변경 문서 경로에서 파생                     [D-64]
  │     POST /cycles {version, name, yearMonth} — releaseNote 없음        [FR-79]
  │     409 → "이미 존재, 생략" 후 계속(실패 아님)                         [FR-80·D-58]
  │
  ├─ 4. 문서 업로드 — 파일별 readFile → document_write ── workspace-api.ts
  │     title=사이클명(D-59) · kind='pdca' · pdcaStage=파서 결과           [FR-81]
  │     빈 파일 → 경고 후 skip(exit 무영향)                                [FR-83·D-63]
  │     실패해도 계속, 파일 단위 사유 축적                                  [FR-82]
  │
  └─ 5. 결과 출력(신규/덮어씀/실패 건수) → 실패 ≥1이면 exit 1              [FR-82]
```

---

## 3. Data Model

### 3.1 DB — 무변경

서버·스키마 0줄(Plan 제약). 이 섹션의 대상은 스크립트 내부 타입뿐이다.

### 3.2 `cyclePath.ts` 신설 파서 (S3의 실체)

```typescript
// src/features/cycle/lib/cyclePath.ts — 기존 파일에 추가. 기존 export 무변경.

export type ParsedCyclePath = { yearMonth: string; name: string; stage: PdcaStage }

/**
 * cycleStagePath의 역함수. docs/PDCA/{ym}/{name}/{name}.{stage}.md 형태가 아니면 null.
 * 디렉터리명과 파일명의 사이클명 일치를 강제한다(RULE.md 파일명 자기식별 규칙).
 * 왕복 법칙(cyclePath.test.ts가 강제):
 *   parseCycleStagePath(cycleStagePath(ym, n, s)) ≡ {ym, n, s}      — 빌더 전사
 *   cycleStagePath(...parseCycleStagePath(p)) ≡ p  (파싱 성공한 p)   — 파서 후사
 */
export function parseCycleStagePath(path: string): ParsedCyclePath | null
```

구현 방침: `^docs/PDCA/(\d{4}-\d{2})/([^/]+)/([^/]+)\.(plan|design|analysis|report)\.md$`
매칭 후 **캡처 2(디렉터리)와 캡처 3(파일명 어간)의 동일성 비교**로 자기식별을 강제한다
(정규식 백레퍼런스보다 비교가 읽기 쉽고 테스트 메시지가 명확하다). 사이클명의 문자 집합
검증(`A-Za-z0-9._-`)은 **하지 않는다** — 그건 서버 `cycleNameSchema`의 몫이고, 파서가
막으면 서버가 거부할 파일이 "건너뜀"으로 조용히 빠져 원인이 숨는다.

### 3.3 `git-changes.ts` 타입

```typescript
// scripts/lib/git-changes.ts

export type ChangeKind = 'modified' | 'added' | 'untracked' | 'deleted' | 'renamed'
export type ChangedPath = { path: string; kind: ChangeKind; renamedFrom?: string }

// [순수] V8 실측 표본이 테스트 픽스처: 'M\tdocs/...' / 'A\t...' / 'R100\told\tnew'
export function parseDiffLines(stdout: string): ChangedPath[]
// [순수] porcelain -uall 표본: ' M docs/...' / '?? docs/...' / ' D ...' (XY 2문자 + 공백)
export function parseStatusLines(stdout: string): ChangedPath[]

// [I/O] execFile('git', ...) 래퍼. 최신 태그 조회(git describe --tags --abbrev=0) 포함.
// 태그 없음·git repo 아님을 구분된 에러로 던진다(FR-86).
export function detectChangedDocs(repoRoot: string): Promise<{
  baseTag: string
  changes: ChangedPath[]   // docs/PDCA 하위로 이미 한정(-- pathspec), 합집합·중복 제거 후
}>
```

합집합 규칙: 같은 경로가 커밋분과 작업트리 양쪽에 있으면 **작업트리 판정을 우선**한다
(커밋 후 다시 수정한 파일 — 어차피 올릴 내용은 디스크의 현재 본문 하나다).

### 3.4 `workspace-api.ts` 타입

```typescript
// scripts/lib/workspace-api.ts

export type Api = { baseUrl: string; pat: string }
export type ToolResult = { ok: true; data: unknown } | { ok: false; errorText: string }

// [순수] MCP JSON-RPC 응답 봉투 해석 — l1-harness callTool의 해석부와 같은 규칙
//        (result.content[0].text, isError, JSON.parse 시도). 테스트 대상.
export function parseToolEnvelope(json: unknown): ToolResult

// [I/O] F58 실측 형태 그대로: 헤더 2개(Authorization·Content-Type), initialize 불요.
//       HTTP 401이면 RK-40 원인 지목형 메시지("PAT와 대상 서버가 짝인지")를 에러에 포함.
export function callTool(api: Api, name: string, args: Record<string, unknown>): Promise<ToolResult>

// [I/O] REST POST /api/projects/:id/cycles. 201/409/그외를 구분해 반환(409는 실패 아님, D-58).
export function createCycle(api: Api, projectId: string, input: {
  version: string; name: string; yearMonth: string
}): Promise<{ status: 'created' | 'exists' | 'failed'; detail?: string }>

// [I/O] PDCAW_PROJECT_ID ?? project_list 단일 프로젝트 자동 해석(2개 이상이면 목록 출력 후 에러)
export function resolveProjectId(api: Api, explicit?: string): Promise<string>
```

---

## 4. API Specification — 서버 무변경, 스크립트가 소비하는 계약

| # | 채널 | 엔드포인트/툴 | 용도 | 근거 실측 |
|---|------|---------------|------|-----------|
| 1 | MCP | `document_write` | 문서 upsert — `{projectId, path, title, kind, pdcaStage, content}` → `{replaced, previousLength}` | F56 |
| 2 | MCP | `project_list` | 프로젝트 자동 해석 | F70 |
| 3 | REST | `POST /api/projects/:id/cycles` | 사이클 생성 — `{version, name, yearMonth}` (releaseNote 미전송) | F57·F68 |

- MCP 호출 형태(F58): `POST {base}/api/mcp`, body `{jsonrpc:'2.0', id, method:'tools/call',
  params:{name, arguments}}`. 헤더 `Authorization: Bearer <PAT>`·`Content-Type` 둘뿐.
- 스크립트가 겪는 에러 코드와 대응: `401 UNAUTHORIZED`(RK-40 안내) / `404 NOT_FOUND`(프로젝트
  id 오류) / `409 CONFLICT`(사이클 — 정상 경로 D-58; 문서는 upsert라 발생 안 함) /
  `400 VALIDATION_ERROR`(빈 content — D-63이 사전 차단하므로 도달 시 버그).

---

## 5. UI/UX Design — 해당 없음 (CLI 출력 사양으로 대체)

### 5.1 출력 사양 (형이 로그로 읽는 화면이다)

```
→ https://pdca-workspace.vercel.app  project=8f0c…            ← 대상 서버 항상 표시(RK-40)
기준: v0.1.5 이후 + 작업트리                                   ← 탐지 근거 명시
대상 4건:
  refine-cycle-closing  plan      (작업트리)
  refine-cycle-closing  design    (작업트리)
  expand-mcp-agency     report    (커밋분)                     ← 이전 사이클 개정분이 섞인 예
  skip  docs/PDCA/_INDEX.md — 사이클 경로 아님                  ← FR-78 건너뜀 사유
  warn  삭제 감지: docs/PDCA/…/x.plan.md — 서버는 지우지 않음    ← FR-88 (해당 시)
사이클: v0.1.6 생성 (refine-cycle-closing 2026-08 연결)         ← --version 시
  ok    plan      신규
  ok    design    덮어씀 (이전 12480자)
  FAIL  report    HTTP 500: …                                  ← 파일 단위 실패 사유
문서: 신규 1 / 덮어씀 1 / 실패 1 → exit 1
```

원칙: **PAT는 어떤 줄에도 등장하지 않는다**(FR-84). 본문도 등장하지 않는다 — 길이만(FR-75).

---

## 6. Error Handling

| 상황 | 동작 | exit | 근거 |
|------|------|:----:|------|
| `PDCAW_PAT` 미설정 | 발급 안내(웹 `/tokens` → `.env.local`) 출력 | 1 | FR-84 |
| `--version`에 `--cycle` 없음 | 사용법 출력 | 1 | D-64 |
| git 태그 없음 / repo 아님 | 구분된 메시지 + `--all` 안내 | 1 | FR-86 |
| 대상 0건 | "변경된 문서 없음" | 0 | FR-87 |
| 역파싱 실패 경로 | `skip` + 사유, 계속 | 무영향 | FR-78 |
| 삭제·rename 감지 | `warn` + "서버는 지우지 않음", 계속 | 무영향 | FR-88·Q17 |
| 빈 파일 | `warn` + skip, 계속 | 무영향 | FR-83·D-63 |
| 사이클 409 | "이미 존재, 생략", 계속 | 무영향 | FR-80·D-58 |
| 사이클 그 외 실패 | `FAIL` 사유 출력, **문서 업로드는 계속** | 1 | 형 결정 3(문서·사이클 독립 복구) |
| 문서 업로드 실패 | 파일 단위 `FAIL` 사유, 나머지 계속 | 1 | FR-82 |
| HTTP 401 | RK-40 원인 지목형 메시지(PAT-서버 짝) | 1 | RK-40 |

---

## 7. Security Considerations

- [x] **PAT 무출력** — 로그·에러·스택 전부. module-4 E7이 실행 로그 전문을 `pdcaw_`로 grep해 0건 확인
- [x] **본문 무출력** — 성공/실패 로그에 길이만
- [x] 전송은 HTTPS(프로덕션 기본, D-61) — dev(localhost)만 http
- [x] PAT 스코프 — 기존 서버 권한 체계 그대로(ownerId 단위), 스크립트가 새 권한면을 만들지 않음
- [x] `.env.local`은 이미 gitignore 대상(기존 관례 유지, 커밋면 무변화)

---

## 8. Test Plan

### 8.1 테스트 범위

| 층 | 대상 | 도구 | 단계 |
|----|------|------|------|
| L0 단위 | `cyclePath` 왕복 / `git-changes` 파싱 / `workspace-api` 봉투 | vitest (`npm test`, 순수 함수만 — D-65) | Do (코드와 1세트) |
| 종단 E1~E7 | 스크립트 전체 흐름, 실 dev 서버 + 실 DB | `l1-harness` 픽스처 + 실행 로그 | Do module-4 |
| 실전 C31 | 개정된 RULE.md 절차로 이 사이클 자체 종료 | 프로덕션 | 사이클 종료 시 |

### 8.2 L0 — 단위 테스트 시나리오

**`cyclePath.test.ts`** (신설, 왕복 법칙이 곧 명세):
| # | 입력 | 기대 |
|---|------|------|
| t1 | `cycleStagePath(ym,n,s)` 4 stage 전수 → `parse` | 원값 복원 (빌더 전사) |
| t2 | 파싱 성공 경로 → `cycleStagePath(...)` 재조립 | 원 경로 (파서 후사) |
| t3 | `docs/PDCA/_INDEX.md` | null (V7 유일 예외 실물) |
| t4 | 디렉터리명≠파일명 어간 (`…/a/b.plan.md`) | null (자기식별 강제) |
| t5 | `docs/PDCA/2026-08/x/x.plan.md.tmp`·`…/x.review.md` | null (확장자·stage 밖) |
| t6 | `docs/other/2026-08/x/x.plan.md` | null (접두 밖) |
| t7 | 연월 형태 위반 (`2026-8`) | null |

**`git-changes.test.ts`** (V8 실측 표본이 픽스처):
| # | 입력 | 기대 |
|---|------|------|
| g1 | `M\t…` / `A\t…` diff 표본 | modified/added |
| g2 | `R100\told\tnew` | renamed + renamedFrom |
| g3 | `D\t…` | deleted |
| g4 | porcelain `?? …` / ` M …` / ` D …` | untracked/modified/deleted |
| g5 | 경로에 공백 포함 | 경로 온전 보존 |
| g6 | 빈 stdout | [] |

**`workspace-api.test.ts`**:
| # | 입력 | 기대 |
|---|------|------|
| w1 | 정상 봉투(`content[0].text`가 JSON) | ok + 파싱된 data |
| w2 | `isError: true` + 텍스트 | ok:false + errorText |
| w3 | JSON-RPC `error` 필드 | ok:false |
| w4 | text가 비JSON 문자열 | ok + 원문 문자열 |

### 8.3 종단 E1~E7 (module-4, dev 서버 + `hns-` 격리 픽스처 — 6T-1 회신)

준비: `l1-harness.ts`의 `mintToken`·`seedWorkspaceProject`·`cleanup`을 tsx 원샷 스크립트로
호출해 dev DB에 합성 owner·PAT·프로젝트를 만든다(형의 실 PAT·실 데이터 무접촉). dev 서버
(`localhost:3001`) 기동 후 `PDCAW_BASE_URL`·`PDCAW_PAT`·`PDCAW_PROJECT_ID`를 픽스처 값으로
주입해 실행하고, 종료 후 `cleanup`.

| # | 시나리오 | 판정 | SC |
|---|----------|------|----|
| E1 | 이번 사이클 문서 업로드 | 대상 자동 탐지 + `신규 N` 로그 | C27 |
| E2 | 같은 명령 재실행 | 전건 `덮어씀`, `--version` 동반 시 사이클 "이미 존재, 생략", exit 0 | C28 |
| E3 | **이전 사이클 문서 1건을 일시 수정 후 실행** (검증 후 `git checkout --`로 원복) | 그 문서가 대상에 자동 포함 | **C29** |
| E4 | `PDCAW_PAT` 제거 후 실행 | 발급 안내 + exit 1 | FR-84 |
| E5 | `--version 1.2.3`(형식 위반) / `--version`만(`--cycle` 없음) | 각각 명확한 에러 + exit 1 | D-64 |
| E6 | scratchpad 임시 git repo(태그 0개)에서 실행 | 태그 없음 에러 + `--all` 안내 | FR-86 |
| E7 | E1~E6 전체 로그를 `pdcaw_`로 grep | 0건 | FR-84 |

C26(본문 무경유)은 별도 시나리오가 아니라 **E1~E3의 실행 방식 그 자체**가 증거다 — 클로드가
출력한 것은 명령 1줄뿐임을 세션 기록이 보여준다.

### 8.4 시드 데이터

| 엔티티 | 최소 | 비고 |
|--------|:----:|------|
| 합성 owner + PAT | 1 | `mintToken('hns-owner-docs-<run>', …)` |
| workspace + project | 1+1 | `seedWorkspaceProject` — `PDCAW_PROJECT_ID`로 주입 |
| 업로드 원본 문서 | 실물 | `docs/PDCA` 실제 파일(이 사이클 plan/design 등) — 별도 시드 불필요 |

---

## 9. Clean Architecture

### 9.1 계층 배치

| 컴포넌트 | 계층 | 위치 | 규칙 |
|----------|------|------|------|
| `parseCycleStagePath` | Domain (순수) | `src/features/cycle/lib/cyclePath.ts` | 외부 의존 0 유지 |
| `git-changes.ts` | Infrastructure | `scripts/lib/` | `cyclePath` import 가능, `workspace-api` 금지 |
| `workspace-api.ts` | Infrastructure | `scripts/lib/` | `git-changes` 금지 |
| `docs-upload.ts` | Application(조립) | `scripts/` | 유일하게 둘 다 아는 자리. 파싱·해석 로직 두지 않음 |

`scripts/` → `src/` 방향 import만 허용(V10 실증). 역방향(앱이 scripts를 아는 것)은 금지 —
브라우저 번들에 Node 전용 코드(`node:child_process` 등)가 스치면 빌드가 깨진다.

### 9.2 tsconfig (S5 확정형)

```jsonc
// tsconfig.server.json — include 1단어 추가 (V9 실증 그대로)
"include": ["server", "api", "scripts", "drizzle.config.ts"]
```

---

## 10. Coding Convention Reference

- `// Design Ref: §N` / `// Plan SC: CN` 주석 — 주요 분기에 부착(기존 관례)
- `.env.local` 주입: `"docs:upload": "set -a && . ./.env.local && set +a && tsx scripts/docs-upload.ts"`
- 테스트 병치(F73) · 순수 함수만 테스트(D-65) · 에러 메시지 한국어(기존 스크립트·서버 관례)

### 10.1 Decision Record — **6T-3 "파생 효과" 열 첫 적용**

| ID | 결정 | 근거 | **파생 효과 (이 결정이 다른 어디를 건드리나)** |
|----|------|------|------------------------------------------------|
| **D-64** | `--version`은 `--cycle` 동반 필수 | 버전에 연결할 사이클(name+yearMonth 쌍, F69)을 변경 목록에서 자동 추론하는 것은 위험 — 변경분에 여러 사이클이 섞이는 게 정상 상태(C29)라 "제일 많이 바뀐 사이클" 같은 휴리스틱이 없다 | 연월을 `--month` 인자 없이 **해당 사이클 변경 경로의 파서 결과에서 얻는다** — Plan 초안의 `--month` 인자가 완전히 사라짐. 단 같은 사이클명이 두 연월에 걸쳐 변경돼 있으면 모호 → 에러로 중단(실물 이력상 발생 0건) |
| **D-65** | 단위 테스트는 순수 함수만, I/O 목 없음 | 기존 테스트 6파일 전부가 이 관례(목 0개) | §8.2가 파싱·봉투 함수로 한정되고, I/O 경로 커버리지는 **전적으로 E1~E7에 의존** — module-4를 건너뛰면 안전망이 없다는 뜻이라 Session Guide에서 module-4를 필수로 표시 |
| **D-66** | `scripts/lib/` 계층 도입 (B안) | **형 결정** (Checkpoint 3, §1.4) | 신규 파일 2→5~6. `tsconfig.server.json`의 `scripts` include가 `scripts/lib/`까지 자동 커버(디렉터리 include라 추가 변경 없음). 다음 자동화 스크립트가 생기면 `workspace-api.ts`가 공용 자산이 된다 |
| **D-67** | 작업트리 탐지는 `--porcelain -uall` 강제 | V8 실측 — 기본값은 untracked 디렉터리를 축약해 **신규 사이클 문서가 통째로 안 보인다** | 이 플래그가 빠지면 C27(이번 사이클 = 전부 신규 = 전부 ??)이 통째로 실패하는 급소 — g4 단위 테스트와 E1이 이중으로 잡는다 |
| **D-68** | 커밋분·작업트리 중복 시 작업트리 우선 | 올릴 본문은 어차피 디스크 현재본 하나 | 합집합이 순서 의존이 아니게 됨(경로 키 dedupe) — 파일당 업로드는 항상 정확히 1회 |

---

## 11. Implementation Guide

### 11.1 신규·수정 파일

| 파일 | 구분 | 내용 | Design Ref |
|------|:----:|------|-----------|
| `src/features/cycle/lib/cyclePath.ts` | 수정 | `parseCycleStagePath` + `ParsedCyclePath` 추가 | §3.2 |
| `src/features/cycle/lib/cyclePath.test.ts` | 신규 | 왕복 t1~t7 | §8.2 |
| `scripts/lib/git-changes.ts` | 신규 | 탐지 I/O + 파싱 순수 함수 | §3.3 |
| `scripts/lib/git-changes.test.ts` | 신규 | g1~g6 | §8.2 |
| `scripts/lib/workspace-api.ts` | 신규 | MCP·REST 클라이언트 + 봉투 해석 | §3.4 |
| `scripts/lib/workspace-api.test.ts` | 신규 | w1~w4 | §8.2 |
| `scripts/docs-upload.ts` | 신규 | CLI 조립 | §2.2 |
| `package.json` | 수정 | `docs:upload` 1줄 | §10 |
| `tsconfig.server.json` | 수정 | include `"scripts"` | §9.2 |
| `docs/RULE.md` | 수정 | 종료 절차 3·4 통합 (module-5) | §11.2 |

### 11.2 RULE.md 개정안 (S6 — module-5에서 적용)

종료 절차 3·4번을 다음 한 단계로 교체:

> 3. **`npm run docs:upload -- --cycle <사이클명> --version <버전>`** 으로 릴리즈 생성 +
>    변경 문서 업로드를 한 번에 처리한다 (릴리즈 노트는 공란 — 웹 UI에서 형이 직접 작성).
>    - **MCP `document_write`를 직접 호출하지 않는다** — 본문 재타이핑은 토큰 낭비이자
>      오타 위험. 스크립트는 파일을 그대로 읽어 보내므로 본문이 LLM을 경유하지 않는다.
>    - 대상은 최신 태그 이후 변경된 `docs/PDCA` 문서 전부 — **이전 사이클 사후개정분도
>      자동 포함**되므로 따로 기억할 필요 없다.
>    - 사이클 중간에 문서만 동기화하려면 `--version` 없이 실행한다.

(이하 4~6번은 기존 5~7번 번호만 당김)

### 11.3 Session Guide

#### Module Map

| Module | Scope Key | 내용 | 산출물 | 필수 |
|--------|-----------|------|--------|:----:|
| 파서 | `module-1` | `parseCycleStagePath` + t1~t7 (**red 먼저** — 5차 선례) | cyclePath.ts/.test.ts | ✅ |
| 계층 | `module-2` | `git-changes`·`workspace-api` + g1~g6·w1~w4 + tsconfig | scripts/lib/*, tsconfig | ✅ |
| CLI | `module-3` | `docs-upload.ts` 조립 + package.json | scripts/docs-upload.ts | ✅ |
| 종단 | `module-4` | E1~E7 (dev + `hns-` 픽스처) | 실행 로그 | ✅ (D-65 파생 — 건너뛰면 I/O 무검증) |
| 절차 | `module-5` | RULE.md 개정 + 사이클 종료로 C31 실증 | docs/RULE.md | ✅ |

#### Recommended Session Plan

| Session | Phase | Scope | 비고 |
|---------|-------|-------|------|
| 1 | Do | `module-1,module-2` | 단위 테스트 red→green까지 |
| 2 | Do | `module-3,module-4` | dev 서버 기동 포함. **형 선행: `.env.local`에 PDCAW_* (프로덕션용— E1~E7 자체는 픽스처 PAT 사용)** |
| 3 | Check+Report | 전체 | module-5는 종료 절차와 함께 |

---

## Version History

| 버전 | 날짜 | 변경 내용 | 작성자 |
|------|------|-----------|--------|
| 0.1 | 2026-08-09 | 최초 작성. **Checkpoint 3에서 형이 B안(클린 분리) 선택** — 클로드 권고 C를 뒤집은 5차 A1형 사례로, `scripts/lib/` 2모듈(git-changes·workspace-api) + 도메인 파서(cyclePath) 3계층 구조 확정(D-66). Design 착수 전 검증 V8~V10 전건 실측 — **V8**: porcelain 기본값이 untracked 디렉터리를 축약(실물로 확인)해 `-uall` 필수(D-67, 빠지면 C27 전체 실패 급소), 과거 전 구간 상태 문자는 M·A·??뿐(rename 0건 → Q17 결정과 정합), `_INDEX.md`가 M으로 잡혀 FR-78 필터 필요성 실증. **V9**: tsconfig `scripts` 추가 그린 + `.mjs` 미포함 + **오류 주입 검출(exit 2)까지 선확인**(RK-41 해소 경로 확정). **V10**: `scripts→src` 교차 import가 tsc·tsx 양쪽 성립. 추가 실측 F72(yearMonth.ts는 UI 전용, 무관)·F73(테스트 병치 관례). 신설 결정 D-64~D-68 — 특히 **D-64**(`--version`은 `--cycle` 동반 필수, 연월은 경로 파서에서 획득 → Plan 초안의 `--month` 인자 소멸), **D-65**(순수 함수만 단위 테스트 — 기존 6개 테스트 파일 전부 목 0개인 관례 준수, 파생: module-4가 I/O의 유일한 안전망이라 필수 표시). **6T-3(파생 효과 열)을 Decision Record에 첫 적용**(§10.1) — D-64의 파생(--month 소멸·동명 사이클 모호성 에러)과 D-67의 파생(급소 식별)이 이 열에서 나왔다. 테스트 계획: L0 순수 17케이스(t1~t7·g1~g6·w1~w4) + 종단 E1~E7(hns- 픽스처, 6T-1 회신) + C31(자체 완주) | Claude |
