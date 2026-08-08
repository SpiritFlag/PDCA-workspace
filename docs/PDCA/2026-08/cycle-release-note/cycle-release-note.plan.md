---
template: plan
version: 1.3
---

# cycle-release-note 계획 문서

> ⚠️ **사후 재구성 문서(post-hoc)**. 이 사이클은 PDCA 절차 없이 구현부터 진행됐고,
> v0.1.2 태그가 찍힌 뒤에 커밋 4개·코드·마이그레이션을 역추적해 계획을 복원한 것이다.
> **여기 적힌 요구사항·결정은 "사전에 합의된 계획"이 아니라 "구현에서 읽어낸 의도"다.**
> 사후 재구성이라는 사실 자체가 이 사이클의 가장 큰 리스크이며, 그 대가는
> [analysis](./cycle-release-note.analysis.md) §1.2에서 정면으로 다룬다.
>
> **한 줄 요약**: PDCA 산출물을 **버전(release) 단위로 묶어 릴리즈노트와 함께 관리**하고,
> 버전에서 사이클 문서 4종으로 바로 들어가는 진입로를 만든다. 곁들여 임포트 폼을
> 사이클 중심으로 재설계하고, 사이드바를 전역 계층 네비로 바꾸고, 로컬 개발 루프의
> 체감 지연(vercel dev 재초기화)을 없앤다.
>
> **프로젝트**: PDCA-workspace
> **작성자**: cogmo
> **작성일**: 2026-08-08 (구현 완료 후 역추적 작성)
> **상태**: 사후 확정본 (형 검토 대기)
> **PDCA Cycle**: cycle-release-note (3번째 사이클, 릴리즈 태그 `v0.1.2`)

---

## Executive Summary

| 관점 | 내용 |
|------|------|
| **Problem** | 1·2차 사이클로 문서(documents)와 백로그(backlog_items)는 1급 데이터가 됐지만, **"이 문서 4종이 어느 릴리즈에 속하는가"는 어디에도 없다.** 사이클 문서는 `docs/PDCA/{연월}/{사이클명}/` 경로 규칙으로만 묶여 있어서, 앱에서는 그냥 평평한 문서 목록으로 보인다. 릴리즈노트는 아예 저장할 곳이 없어 report.md §9 Changelog에 묻혀 있고, 그마저 git tag와 어긋난다(2차 report는 `v0.2.0`이라 적었지만 실제 태그는 `v0.1.1`). 게다가 새 사이클을 시작할 때마다 임포트 폼에서 `docs/PDCA/2026-08/foo/foo.plan.md`를 손으로 4번 친다. |
| **Solution** | **버전(release)을 새 1급 엔티티로 세운다.** `cycles` 테이블에 `version`(프로젝트 내 유일) + `releaseNote`(마크다운)를 두고, PDCA 사이클(`name` + `yearMonth`)은 **선택적으로 연결**한다 — 사이클 없는 버전(핫픽스 등)도 허용. 사이클이 연결된 버전 카드는 plan/design/analysis/report 4버튼을 띄워, 문서가 있으면 링크·없으면 프리필된 생성 폼으로 보낸다. 임포트 폼은 "경로를 친다"에서 "사이클명·단계·연월을 고르면 경로가 조립된다"로 뒤집는다. |
| **Function/UX Effect** | 프로젝트 개요에서 버전 목록을 최신순으로 보고, 카드를 펼치면 릴리즈노트가 렌더되고, 4버튼으로 사이클 문서를 오간다. 사이드바는 프로젝트에 들어가야만 보이던 문서 트리에서 **워크스페이스 > 프로젝트 > (백로그·버전·문서)** 전역 트리로 바뀐다. 로컬 개발은 API 응답이 매 요청 ~2초에서 수백 ms로 떨어진다. |
| **Core Value** | **"PDCA 산출물의 단위는 문서가 아니라 릴리즈다."** 지금까지 사이클을 묶어준 건 경로 컨벤션(사람이 지키는 약속)뿐이었다. 이걸 DB 레코드와 유일 제약으로 승격시켜, 앱이 "v0.1.2가 무엇이었는가"를 스스로 대답하게 만든다. |

---

## Context Anchor

> Executive Summary에서 생성. Design/Do 문서로 전파되어 세션 간 컨텍스트 연속성 유지.

| Key | Value |
|-----|-------|
| **WHY** | 문서·백로그는 1급 데이터가 됐는데 **릴리즈(버전)만 데이터가 아니다.** 사이클을 묶는 유일한 수단이 경로 컨벤션이라, 앱이 "이 릴리즈에 뭐가 들었나"를 대답하지 못하고 릴리즈노트가 git tag와 어긋난 채 report.md에 묻힌다. |
| **WHO** | 형(cogmo) — 브라우저 실사용자이자 유일한 승인자. **이번 사이클에서 클로드는 소비자가 아니다**(MCP 툴 미추가 — 의도가 아니라 누락, [analysis](./cycle-release-note.analysis.md) I-2). |
| **RISK** | **PDCA 없이 구현부터 한 것 자체가 최대 리스크**(RK-01). 부수적으로 1차 §5.5 "Catppuccin 공식 토큰, 임의 색 추가 금지" 규약을 의도적으로 깨는 것(RK-03), 그리고 프로덕션 `vercel.json`에 개발 전용 예외를 넣는 것(RK-04). |
| **SUCCESS** | C1~C8. 핵심은 **C3 — 버전 카드에서 사이클 문서 4종을 오가는 왕복이 브라우저에서 실제로 된다**. |
| **SCOPE** | 축1 버전·릴리즈노트 DB+API / 축2 버전 UI(카드·폼·정렬) / 축3 임포트 폼 사이클 중심 재설계 / 축4 셸·화면 개선(사이드바 계층 네비, 개요 인라인 수정) / 축5 여름 테마 / 축6 로컬 상주 개발 서버. |

---

## 1. Overview

### 1.1 목적

프로젝트에 **버전(release)** 축을 세워, PDCA 사이클 문서 4종과 릴리즈노트를 하나의 레코드로 묶는다.
그 축을 UI의 두 곳(프로젝트 개요의 버전 목록, 사이드바의 버전 섹션)에 노출하고,
문서 생성 동선을 "경로 입력"에서 "사이클 선택"으로 바꾼다.

### 1.2 배경

| 사실 | 근거 |
|------|------|
| 사이클 문서는 경로 컨벤션(`docs/PDCA/{YYYY-MM}/{name}/{name}.{stage}.md`)으로만 묶인다 | [docs/RULE.md](../../../RULE.md) |
| 그 컨벤션이 코드에 없어서, 임포트 시 매번 손으로 전체 경로를 친다 | 1차 사이클 `ImportDialog` — `path` 자유 입력 |
| 릴리즈노트를 담을 자리가 없다 | 2차 report §9 Changelog가 유일한 자리 |
| 그 자리가 실제로 어긋났다 | 2차 report §9는 `v0.2.0 (2026-08-07)`, 실제 git tag는 `v0.1.1` |
| 사이드바는 프로젝트에 들어가야만 내용이 보인다 | 1차 `SidebarTree` — `if (!workspace \|\| !project) return "프로젝트를 선택하면..."` |
| 로컬 개발이 느리다 | `vercel dev`가 API 요청마다 함수를 재초기화 → 매 요청 ~2초(JWKS 캐시·DB 커넥션 소실) |

### 1.3 확정 사실 (실측)

| # | 사실 | 확인 방법 |
|---|------|-----------|
| F-01 | `v0.1.1..v0.1.2`는 커밋 4개 | `git log --oneline v0.1.1..v0.1.2` |
| F-02 | 마이그레이션이 `0002`(생성) → `0003`(즉시 정정) 2개로 나뉜다 | `drizzle/0002_rich_falcon.sql`, `drizzle/0003_odd_rawhide_kid.sql` |
| F-03 | `0002`는 `name`·`year_month` NOT NULL로 만들었다가 `0003`에서 둘 다 DROP NOT NULL + `release_note` 추가 | 위 두 파일 diff — **"사이클 우선" → "버전 우선"으로 모델이 뒤집힌 흔적**(D-19) |
| F-04 | postgres btree unique는 NULL 중복을 허용하므로 `cycles_proj_name_uq`는 name nullable과 양립한다 | `server/db/schema.ts` 주석 + postgres 표준 동작 |
| F-05 | 서버 MCP 툴은 여전히 8개(`project_list`/`document_*` 3/`backlog_*` 4)로 cycles 툴 0개 | `grep registerTool server/mcp/tools.ts` |
| F-06 | 테스트 46개 통과(2차 35 + versionSort 11), oxlint·`tsc -b` 클린 | `npx vitest run`, `npm run lint`, `npx tsc -b` |
| F-07 | `useDeleteWorkspace`·`useDeleteProject` 훅이 호출부 0건으로 남았다 | `grep -rn useDelete{Workspace,Project} src/` |

### 1.4 사후 재구성의 한계 (Checkpoint 1·2 대체)

이 사이클엔 Checkpoint 1(계획 승인)·2(스코프 확정)가 **존재하지 않았다.** 아래는 그 자리를 대신하는 고지다.

| 항목 | 통상 사이클 | 이번 사이클 |
|------|-------------|-------------|
| 스코프 확정 | Plan §2에서 형이 승인 | 커밋 4개를 사후에 1개 사이클로 묶기로 형이 결정(2026-08-08) |
| 아키텍처 선택지 비교 | Design §2.0에서 옵션 제시 후 선택 | **비교 없이 구현된 것을 사후 기술.** 대안은 [design](./cycle-release-note.design.md) §2.0에 "당시 선택지였을 것"으로만 기록 |
| Success Criteria | 착수 전 합의 | §4는 구현에서 역산한 것 — **기준이 결과를 보고 쓰인 이상, 충족률은 자기충족적으로 부풀 수 있다**([analysis](./cycle-release-note.analysis.md) §1.2) |
| 이월 항목 처리 | 직전 report의 이월을 Plan에서 재배치 | 2차 이월 6건은 손대지 않았고, `refine-mcp-hardening` plan은 착수 전 상태로 보류 |

### 1.5 관련 문서

| 문서 | 관계 |
|------|------|
| [docs/RULE.md](../../../RULE.md) | 이 사이클이 코드로 승격시킨 경로 컨벤션의 원천 |
| [PDCA-workspace](../PDCA-workspace/PDCA-workspace.plan.md) | 1차 — documents·경로 미러링·Catppuccin 팔레트 규약 |
| [backlog-with-mcp](../backlog-with-mcp/backlog-with-mcp.plan.md) | 2차 — 서비스 계층(옵션 B)·에러 코드 표(§6.1)·MCP 8툴. 이번 구현이 그대로 따른 틀 |
| `docs/PDCA/2026-08/refine-mcp-hardening/refine-mcp-hardening.plan.md` | 2차 이월 6건 마감용으로 작성됐으나 **미착수 보류**(커밋 안 됨). 이 사이클과 무관 |

---

## 2. Scope

### 2.1 In Scope

| 축 | 항목 | 커밋 |
|----|------|------|
| **축1** | `cycles` 테이블(version 유일, releaseNote, name·yearMonth nullable) + scoped 쿼리 + 서비스 + REST 4개 | `a78f188` |
| **축2** | 버전 UI — `CycleList`/`CycleCard`/`CycleForm`/`ReleaseNoteView`, 정렬 3종(`versionSort`), stage 4버튼 | `a78f188` |
| **축3** | `ImportDialog` 재설계 — 생성 모드를 사이클 중심(분류→이름→단계→연월)으로, 경로 자동 조립. 사이클 카드에서 온 `prefill` 모드 추가 | `a78f188` |
| **축4** | 사이드바 전역 계층 네비(워크스페이스>프로젝트>백로그·버전·문서), 워크스페이스·프로젝트 개요 인라인 수정, 목록에서 삭제 버튼 제거 | `9b5c37e` |
| **축5** | 여름 팔레트(쿨 틸/스카이)로 전면 교체 + `--ctp-lavender` 신설, design 배지 mauve→lavender | `f569104` |
| **축6** | 로컬 상주 Hono 개발 서버(`server/dev-server.ts`) + vite `/api` 프록시 + npm 스크립트 3종 | `c48d434` |

### 2.2 Out of Scope

| 항목 | 사유 |
|------|------|
| cycles MCP 툴 | **의도적 제외가 아니다.** 그냥 안 했다 — [analysis](./cycle-release-note.analysis.md) I-2에서 결함으로 계상 |
| 버전 ↔ git tag 동기화 | 사람이 양쪽에 따로 입력. 자동화 미착수 |
| 버전별 상세 페이지·URL | 사이드바 버전 링크가 전부 프로젝트 개요로 감(M-3) |
| 2차 이월 6건(closedOn 삭제, FORBIDDEN 코드, MCP zod 재사용 등) | 이 사이클에서 손대지 않음 |
| 릴리즈노트 자동 생성(커밋 요약 등) | 수동 마크다운 입력만 |

---

## 3. Requirements

### 3.1 기능 요구사항

> 번호는 2차(FR-21)에 이어서 FR-22부터.

| ID | 요구사항 | 구현 위치 |
|----|----------|-----------|
| FR-22 | 프로젝트별 버전 CRUD (목록·생성·수정·삭제) | `server/routes/cycles.ts`, `server/services/cycles.ts` |
| FR-23 | `version`은 프로젝트 내 유일하고 `v0.0.0` 형식이어야 한다 | `cycleVersionSchema`, `cycles_proj_version_uq` |
| FR-24 | PDCA 사이클 연결은 선택 — `name`+`yearMonth`가 **둘 다 있거나 둘 다 없어야** 한다 | `cyclePairRule` refine |
| FR-25 | 사이클명은 프로젝트 내 유일하고 경로 세그먼트로 안전해야 한다(`[A-Za-z0-9._-]`) | `cycleNameSchema`, `cycles_proj_name_uq` |
| FR-26 | 릴리즈노트를 마크다운으로 저장하고 카드 펼침 시 렌더한다(최대 50,000자) | `ReleaseNoteView`(react-markdown + GFM + rehype-sanitize) |
| FR-27 | 버전 목록 정렬 3종: 버전 최신순(기본)·오래된순·이름순. **버전은 문자열이 아니라 숫자 파트로 비교**한다 | `versionSort.ts` |
| FR-28 | 사이클 연결된 버전 카드는 plan/design/analysis/report 4버튼을 띄운다 — 문서 존재 시 링크(단계색), 부재 시 생성 버튼 | `CycleCard` + `cyclePath.ts` |
| FR-29 | stage 생성 버튼은 `ImportDialog`를 사이클명·단계·연월 프리필 상태로 연다(경로 고정, 사용자는 본문만 작성) | `CycleList` → `ImportDialog prefill` |
| FR-30 | 임포트 생성 모드를 재설계: 분류 → 사이클명/문서명 → (pdca면)단계 → 연월 드롭다운 순서로 묻고 경로를 조립해 보여준다 | `ImportDialog` |
| FR-31 | 사이드바를 전역 계층 네비로 전환: 워크스페이스 > 프로젝트 > (백로그 · 버전 N · 문서 N). 현재 URL에 해당하는 노드는 마운트 시 자동 펼침 | `SidebarTree` |
| FR-32 | 워크스페이스·프로젝트 개요에서 이름/슬러그/URL/설명을 인라인 수정한다 | `ProjectListPage`, `ProjectOverviewPage` |
| FR-33 | 목록 화면에서 워크스페이스·프로젝트 **삭제 버튼을 제거**한다(오조작 방지) | `WorkspaceList`, `ProjectList` |
| FR-34 | 사이드바 기본 열림 여부를 뷰포트 폭(≥768px)으로 결정한다 | `AppShell` |
| FR-35 | 팔레트를 청량한 여름 테마로 교체하고, 주 강조색 변경으로 충돌한 design 배지를 `--ctp-lavender`로 분리한다 | `catppuccin.css`, `stageColor.ts` |
| FR-36 | 로컬 개발용 상주 API 서버와 vite 프록시를 두어 `vercel dev`의 요청당 재초기화 비용을 없앤다 | `server/dev-server.ts`, `vite.config.ts` |

### 3.2 비기능 요구사항

| ID | 항목 | 목표 | 근거 |
|----|------|------|------|
| NFR-01 | 계층 규칙(옵션 B) | `routes/cycles.ts`에 Drizzle import 0건, 서비스만 `db/scoped` 호출 | 2차 Design §9.1 |
| NFR-02 | ownerId 강제 | cycles 전 쿼리가 `project → workspace → ownerId` 2단 조인 | 2차 Design §9.2 |
| NFR-03 | 에러 코드 | `server/lib/errors.ts`의 6코드만 사용(신설 금지) | 2차 Design §6.1(FR-20) |
| NFR-04 | XSS | 릴리즈노트 렌더에 raw HTML 미파싱 + `rehype-sanitize` | 1차 `MarkdownView` 방침 |
| NFR-05 | 로컬 API 응답 | 요청당 ~2초 → 수백 ms | `dev-server.ts` 주석의 실측 근거 |
| NFR-06 | 무회귀 | 기존 테스트 35개 + 신규 전부 통과, lint·타입 클린 | F-06 |

---

## 4. Success Criteria

> ⚠️ **사후 역산 기준.** 구현을 보고 쓴 기준이므로 "충족"이 곧 "잘 설계했다"를 뜻하지 않는다.
> 이 절의 신뢰도 자체를 [analysis](./cycle-release-note.analysis.md) §1.2에서 감액한다.

| # | 기준 | 검증 방법 |
|---|------|-----------|
| C1 | 버전을 만들고(버전+릴리즈노트) 목록에서 보고 수정·삭제할 수 있다 | 브라우저 |
| C2 | 사이클 연결 없이 버전만 만들 수 있고, 연결하면 `name`+`yearMonth`가 함께 저장된다 | 브라우저 + API |
| C3 | **버전 카드 4버튼으로 사이클 문서 4종을 오갈 수 있고, 없는 단계는 프리필 폼으로 생성된다** (이 사이클의 관문) | 브라우저 |
| C4 | `v0.1.10`이 `v0.1.2`보다 위에 온다 | 단위 테스트 + 브라우저 |
| C5 | 릴리즈노트 마크다운이 표·목록까지 렌더된다 | 브라우저 |
| C6 | 임포트 폼에서 경로를 한 글자도 안 치고 PDCA 문서를 만들 수 있다 | 브라우저 |
| C7 | 사이드바에서 다른 워크스페이스·프로젝트로 이동할 수 있다 | 브라우저 |
| C8 | `npm run dev:local`로 로컬에서 로그인·문서·버전이 전부 동작하고 응답이 체감상 즉시다 | 로컬 |

### 4.1 Definition of Done

- [x] 마이그레이션이 dev DB에 적용됐다
- [ ] **마이그레이션이 main(프로덕션) DB에 적용됐다** — 2차에서 `/api/tokens` 500을 낸 바로 그 자리. 미확인
- [x] `npx vitest run` 전부 통과 (46/46)
- [x] `npm run lint`·`npx tsc -b` 클린
- [ ] cycles API 런타임 실증(2차의 `app.request()` 실 DB 하네스) — **미실행**
- [ ] PDCA 문서 4종 + `_INDEX.md` 행 — 이 사이클에선 사후 작성

---

## 5. Risks and Mitigation

| ID | 리스크 | 확률 | 영향 | 대응 |
|----|--------|:---:|:---:|------|
| RK-01 | **PDCA 없이 진행 → 설계 결함이 리뷰 없이 코드로 굳음** | 발생함 | 높음 | 사후 문서화(이 사이클)로 결함을 명시적 목록으로 전환. 실제로 Critical 1·Important 3건 검출 |
| RK-02 | 사후 Design은 구현의 사본이라 Gap Analysis가 자동으로 100%가 된다 | 발생함 | 높음 | Gap 기준을 "Design 대비"가 아니라 **"프로젝트 규약 + 2차 회고 Try 대비"**로 재정의(analysis §2.1) |
| RK-03 | 1차 §5.5 "Catppuccin 공식 토큰, 임의 색 추가 금지" 규약 위반 | 발생함 | 중 | D-25로 규약을 명시적으로 개정. 토큰 이름은 유지(`--ctp-*`)해 호출부 무변경 |
| RK-04 | 프로덕션 `vercel.json`에 개발 전용 경로 예외 유입 | 발생함 | 낮음 | 프로덕션 산출물은 `/assets/*`라 실해는 없음. 다만 설정 오염으로 M-4 계상 |
| RK-05 | `cycles.name` unique가 nullable과 만나 부정합 레코드를 허용 | 발생함 | 중 | `updateCycleSchema`가 pair refine을 잃은 것이 원인(analysis I-1). 이월 |
| RK-06 | main DB 마이그레이션 미적용으로 배포 직후 500 | 미확인 | 높음 | 2차에서 실제로 발생한 사고. DoD 미충족 항목으로 남김 |

---

## 6. Impact Analysis

| 대상 | 영향 | 회귀 위험 |
|------|------|:---:|
| `server/db/schema.ts` | `cycles` 테이블 추가(기존 테이블 무변경) | 낮음 |
| `server/db/scoped.ts` | cycles 헬퍼 7개 추가(+96줄), 기존 함수 무변경 | 낮음 |
| `server/app.ts` | `/projects/:id/cycles`, `/cycles/:id` 라우트 2줄 + 미들웨어 1줄 | 낮음 |
| `ImportDialog.tsx` | **생성 모드 전면 재작성**(+266/-…). 편집 모드는 분기로 기존 동작 보존 | **중** |
| `SidebarTree.tsx` | **전면 재작성**(+234/-…). 컴포넌트 4개 신설 | **중** |
| `catppuccin.css` | 토큰 값 전면 교체(이름은 유지) | 중 — 전 화면 색이 바뀌지만 호출부 코드는 무변경 |
| `WorkspaceList`/`ProjectList` | 삭제 UI 제거 → 훅 2개가 dead code로 남음 | 낮음(기능 축소는 의도, D-23) |
| `vercel.json` | SPA 폴백 정규식에 dev 경로 제외 추가 | 낮음 |

### 6.1 신규 외부 의존

| 패키지 | 용도 | 구분 |
|--------|------|------|
| `@hono/node-server` | 상주 개발 서버 | dev |
| `tsx` | `server/dev-server.ts` watch 실행 | dev |
| `concurrently` | api + web 동시 실행(`dev:local`) | dev |
| `vercel` | `dev:vercel` 스크립트용 | dev |

> 전부 devDependencies — 프로덕션 번들·함수 크기 무영향.

---

## 7. Architecture Considerations

### 7.1 프로젝트 레벨

Dynamic (2차와 동일). 새 계층·새 런타임 없음 — 2차에서 세운 라우트→서비스→scoped 3층에 도메인 하나를 얹는다.

### 7.2 핵심 아키텍처 결정 (Decision Record)

| ID | 결정 | 근거 | 대안 |
|----|------|------|------|
| **D-19** | **1급 엔티티는 "사이클"이 아니라 "버전(release)"이다.** `version`이 유일키이고 PDCA 사이클(`name`+`yearMonth`)은 선택적 부속물 | `0002`(name NOT NULL) → `0003`(DROP NOT NULL)이 이 전환의 물증(F-03). 핫픽스처럼 사이클 없는 릴리즈가 실재한다 | 사이클을 유일키로 두고 버전을 속성으로 — 사이클 없는 릴리즈를 표현 못 함 |
| **D-20** | 릴리즈노트를 `documents` 레코드가 아니라 `cycles.release_note` 컬럼에 둔다 | 릴리즈노트는 경로·링크 해석·트리 노출이 필요 없다. 문서로 만들면 경로 미러링(D-13) 규칙에 억지로 끼워야 한다 | `docs/RELEASE/v0.1.2.md` 문서로 저장 — 트리 오염 + 링크 판정 불필요한 비용 |
| **D-21** | 버전 정렬은 **클라이언트** 순수 함수(`versionSort.ts`) | `localeCompare`면 `v0.1.10 < v0.1.2`가 되고, SQL로 하려면 파트 분해 캐스팅이 필요하다(2차 `::int` 캐스팅 버그의 재판). 목록 크기가 프로젝트당 수십 건이라 클라이언트 정렬로 충분 | DB `ORDER BY` + semver 확장 — Neon HTTP 드라이버에서 검증 비용이 큼 |
| **D-22** | 사이클↔문서 경로 규칙을 `cyclePath.ts` 순수 함수 단일 원천으로 | RULE.md의 사람 컨벤션을 코드로 승격. 2차 `shared/transition.ts`와 같은 패턴 | 각 컴포넌트에서 템플릿 리터럴 — **실제로 `ImportDialog`가 이렇게 남아 규약을 깼다**(analysis I-3) |
| **D-23** | 워크스페이스·프로젝트 삭제를 목록 UI에서 제거(API는 유지) | 하위 전부 캐스케이드 삭제라 오조작 비용이 크고, 실사용상 삭제 빈도가 0에 가깝다 | confirm 2단계 유지 — 여전히 오클릭 가능 |
| **D-24** | 로컬 개발은 `vercel dev`가 아니라 상주 Hono + vite 프록시 | `vercel dev`는 요청마다 함수를 재초기화해 JWKS 캐시·DB 커넥션이 매번 소실된다(~2초). 상주 프로세스면 재사용된다 | `vercel dev` 유지 — 프로덕션과 동일 경로라는 장점이 있어 `dev:vercel` 스크립트로 병존 |
| **D-25** | **1차 §5.5 "Catppuccin 공식 토큰만, 임의 색 추가 금지" 규약을 개정한다.** 커스텀 여름 팔레트를 쓰되 **토큰 이름 체계(`--ctp-*`)는 유지**한다 | 이름을 유지하면 호출부 코드가 한 줄도 안 바뀐다. 규약의 진짜 목적(색을 컴포넌트에 하드코딩하지 않기)은 지켜진다 | 팔레트 유지 — 형의 취향 요구를 못 받음 / 토큰 이름까지 교체 — 전 컴포넌트 수정 |
| **D-26** | 사이클 미연결 버전을 허용하기 위해 `name`을 nullable로 두고, unique 인덱스는 그대로 건다 | postgres btree unique는 NULL 중복을 허용(F-04)하므로 "연결된 것들끼리만 유일"이 공짜로 성립 | 부분 인덱스(`WHERE name IS NOT NULL`) — drizzle 표현이 번거롭고 효과 동일 |

### 7.3 데이터베이스 스키마

`cycles` — 상세는 [design](./cycle-release-note.design.md) §3.1.

| 컬럼 | 타입 | 제약 |
|------|------|------|
| id | uuid PK | `defaultRandom()` |
| project_id | uuid | FK projects, `ON DELETE CASCADE` |
| version | text | NOT NULL, `(project_id, version)` unique |
| release_note | text | nullable, 마크다운 |
| name | text | **nullable**, `(project_id, name)` unique |
| year_month | text | **nullable**, `YYYY-MM` |
| created_at / updated_at | timestamptz | `defaultNow()` |

### 7.4 API 엔드포인트

| 메서드 | 경로 | 설명 |
|--------|------|------|
| GET | `/api/projects/:projId/cycles` | 목록(정렬 없음 — 클라이언트가 정렬, D-21) |
| POST | `/api/projects/:projId/cycles` | 생성 → 201 |
| PATCH | `/api/cycles/:id` | 수정 |
| DELETE | `/api/cycles/:id` | 삭제 → 204 (연결 문서는 남는다) |

전부 `authMiddleware` 뒤. 409 응답은 `CONFLICT` + `details.target: 'version' | 'name'` — 1차의 `path` 패턴 재사용.

---

## 8. Convention Prerequisites

### 8.1 기존 규약 (준수 대상)

| 규약 | 출처 |
|------|------|
| 라우트는 Drizzle을 모른다(옵션 B 3층) | 2차 Design §9.1 |
| 에러는 `errors.ts` 6코드만 | 2차 Design §6.1 |
| 전 쿼리 ownerId 2단 조인 | 2차 Design §9.2 |
| 색은 CSS 변수로만, 컴포넌트에 hex 금지 | 1차 Design §5.5 |
| 마크다운은 raw HTML 미파싱 + sanitize | 1차 |

### 8.2 이번에 정의·개정한 규약

| 규약 | 내용 |
|------|------|
| **경로 조립 단일 원천** | 사이클 문서 경로는 `cycleStagePath()`만 쓴다 (D-22) — *실제 구현에서 1건 위반* |
| **연월 옵션 단일 원천** | 연월 드롭다운 목록은 `yearMonth.ts`만 쓴다 — *실제 구현에서 1건 위반* |
| **팔레트 규약 개정** | 커스텀 팔레트 허용, 단 토큰 이름은 `--ctp-*` 유지 (D-25) |
| **버전 표기** | `v` + semver 3파트(`^v\d+\.\d+\.\d+$`). git tag와 동일 표기 |

### 8.3 환경변수

| 변수 | 용도 | 기본 |
|------|------|------|
| `API_PORT` | 상주 개발 서버 포트 | `3001` (vite 프록시 대상과 일치해야 함) |

---

## 9. [DO] 실행 마일스톤

> 실제로는 아래 순서로 커밋됐다(사후 확인). 통상 사이클의 module-N에 해당.

| # | 커밋 | 범위 | 산출물 |
|---|------|------|--------|
| M1 | `c48d434` | 축6 — 개발 루프 | `dev-server.ts`, vite 프록시, npm 스크립트 3종, `prompt.tmp` 삭제 |
| M2 | `f569104` | 축5 — 테마 | 여름 팔레트, `--ctp-lavender` 신설, design 배지 분리 |
| M3 | `a78f188` | 축1~3 — 버전 도메인 + UI + 임포트 재설계 | 마이그레이션 2개, scoped 7함수, 서비스·라우트, cycle feature 9파일, `ImportDialog` 재작성 |
| M4 | `9b5c37e` | 축4 — 셸·화면 | `SidebarTree` 재작성, 개요 인라인 수정, 삭제 UI 제거 |

> M3이 전체 변경의 대부분을 담은 단일 커밋이라, 리뷰 단위로는 지나치게 크다([report](./cycle-release-note.report.md) §6.2).

---

## 10. Next Steps

1. [design](./cycle-release-note.design.md) — 구현된 구조를 설계 문서 형식으로 확정
2. [analysis](./cycle-release-note.analysis.md) — **규약·회고 기준** Gap 분석 및 결함 등급 분류
3. [report](./cycle-release-note.report.md) — Success Criteria 최종 판정, 회고, 이월 목록
4. `_INDEX.md` 행 추가 + docs 커밋 1개 (RULE.md 사이클 종료 절차)

---

## Version History

| 버전 | 날짜 | 변경 내용 | 작성자 |
|------|------|-----------|--------|
| 0.1 | 2026-08-08 | **사후 재구성** 최초 작성. v0.1.2 커밋 4개(`c48d434`·`f569104`·`a78f188`·`9b5c37e`)와 코드·마이그레이션에서 역추적. FR-22~FR-36, D-19~D-26, C1~C8 정의. 사전 승인이 없었던 사실과 그로 인한 기준 신뢰도 감액을 §1.4·RK-01·RK-02에 명시 | cogmo |
