---
template: plan
version: 1.3
---

# backlog-with-mcp 계획 문서

> **한 줄 요약**: 프로젝트마다 백로그 보드를 붙이고, 워크스페이스 전체를 **원격 MCP 서버**로
> 노출해서 클로드가 PDCA 문서를 훑고 → 백로그를 갱신하고 → 형이 순서를 정해 착수하는
> 루프를 완성한다.
>
> **프로젝트**: PDCA-workspace
> **작성자**: cogmo
> **작성일**: 2026-08-07
> **상태**: Draft (v0.1 — 형 결정 9건 반영)
> **PDCA Cycle**: backlog-with-mcp (2번째 사이클)

---

## Executive Summary

| 관점 | 내용 |
|------|------|
| **Problem** | 1차 사이클로 문서 보관·조회는 됐지만 **"다음에 뭘 할지"가 어디에도 없다.** 개선 아이디어는 사이클 종료 시 report.md의 "다음 사이클 이월" 표에 갇히고, 다음 사이클을 열 때 그 표를 사람이 다시 읽어 옮겨야 한다. 게다가 그 판단(무엇이 이미 해소됐는지)은 코드와 문서를 훑어야 알 수 있는데, 클로드는 이 워크스페이스에 접근할 방법이 없다 — 웹앱은 브라우저 전용이다. |
| **Solution** | ①프로젝트 단위 **백로그 보드**(상태·중요도·처리일·드래그 정렬)를 1급 데이터로 만들고, ②Vercel Hono 앱에 **원격 MCP 서버**(`/api/mcp`)를 얹어 클로드가 문서와 백로그를 직접 읽고 쓰게 한다. ③인증은 브라우저 JWT와 별개로 **개인 액세스 토큰(PAT)** 을 추가해 headless 접근을 연다. |
| **Function/UX Effect** | 형은 Claude Code(또는 폰·웹의 클로드)에게 "이 프로젝트 백로그 정리해줘"라고 말하면 된다. 클로드가 PDCA 문서를 훑어 이미 해소된 항목을 `해소`로 내리고 새 항목을 만든다. 형은 브라우저에서 카드를 드래그해 순서를 정하고, 하나를 골라 `진행`으로 바꿔 착수한다. |
| **Core Value** | **판단은 클로드가, 결정은 형이.** 「무엇이 이미 해소됐나」는 문서를 훑어야 아는 **사실 확인**이라 클로드에게 맡기고, 「무엇을 먼저 할까」는 **의사결정**이라 형이 UI에서 쥔다. MCP 툴 권한을 이 경계선에 정확히 맞춰 설계한다 — 안전장치가 아니라 역할 분담이다. |

---

## Context Anchor

> Executive Summary에서 생성. Design/Do 문서로 전파되어 세션 간 컨텍스트 연속성 유지.

| Key | Value |
|-----|-------|
| **WHY** | PDCA 산출물은 쌓이는데 "다음 할 일"이 사람 머리와 report.md 표에만 있다. 그 판단에 필요한 문서를 클로드가 못 읽는다. |
| **WHO** | 형(cogmo) 단독 + **클로드(MCP 클라이언트)** — 이번 사이클에서 처음으로 사람이 아닌 소비자가 생긴다. |
| **RISK** | Streamable HTTP MCP를 Vercel 저수준 `routes` 위에 얹는 것(RK-01, 지난 사이클 배포 버그 6건 중 2건이 이 지점) / PAT가 형 문서 전체의 쓰기 권한을 갖는 것(RK-02) / Neon HTTP 드라이버로 드래그 정렬 N행을 원자적으로 갱신하는 것(RK-04). |
| **SUCCESS** | C1~C10. 핵심은 **C7 — next.tmp 유즈케이스 3단계(문서 훑기 → 백로그 갱신 → 형이 순서 조정·착수)를 실제 Claude Code 세션에서 끝까지 1회 완주**. |
| **SCOPE** | 축1 백로그 DB+API / 축2 백로그 UI(드래그·팝업·배지·접힘) / 축3 PAT 인증 / 축4 MCP 서버+툴 8개. 다중 유저, 백로그 알림·기한, 라벨·담당자, 백로그 간 의존관계, MCP OAuth는 스코프 외. |

---

## 1. Overview

### 1.1 목적

1. **"다음 할 일"을 1급 데이터로** — report.md 표에 갇힌 이월 항목을 조회·정렬·상태 전환 가능한
   레코드로 승격시킨다.
2. **클로드에게 워크스페이스 접근권을** — 문서를 읽고 백로그를 쓰는 MCP 툴을 열어, 유즈케이스
   1~2단계를 클로드가 자율 수행하게 한다.
3. **권한 경계를 설계로 못박는다** — 클로드가 할 수 있는 것과 형만 할 수 있는 것을 툴 목록과
   상태 전이 규칙으로 강제한다. 프롬프트로 부탁하는 게 아니라 툴이 없어서 못 하게 만든다.

### 1.2 배경

1차 사이클(`PDCA-workspace`, Match Rate 87%) 완료 시점에 이월 항목이 Important 4건 + Minor 12건
남았다. 이 목록은 지금 `PDCA-workspace.report.md` §4.1 표에만 존재한다 — 검색도 정렬도 안 되고,
"이거 이번에 하다가 이미 해결됐는데" 같은 판정을 사람이 매번 다시 해야 한다.

next.tmp에서 형이 그린 최종 유즈케이스는 이 문제를 정확히 겨냥한다:

```
1. 클로드가 프로젝트 PDCA 문서를 훑는다 (+ 기존 백로그 리스트를 가져온다)
2. 클로드가 고민해서 백로그를 해소하거나, 새로 만든다
3. 형이 그걸 보고 순서를 조정하고, 하나를 골라 착수한다
```

1단계와 2단계에 필요한 건 "클로드가 이 DB를 읽고 쓸 수 있어야 한다"이고, 그게 MCP다.
백로그만 만들면 2단계가 사람 몫으로 남고, MCP만 만들면 2단계에 쓸 대상이 없다 — 그래서
한 사이클이다(Q3).

### 1.3 확정 사실 (실측)

Plan 작성 시점에 현재 저장소를 직접 읽어 확정한 사실이다. Design은 이 표를 전제로 한다.

| # | 확인 항목 | 결과 | 근거 |
|---|-----------|------|------|
| F1 | API 라우팅 구조 | `vercel.json`이 저수준 `routes`로 **`^/api/(.+)$` → `/api/[...route]` 단일 함수**에 전부 넘긴다. `/api/mcp`도 자동으로 Hono에 도달한다 | `vercel.json` 실측 |
| F2 | **F1의 함의** | MCP 엔드포인트를 **새 Vercel 함수로 만들 필요가 없다.** Hono 라우트 하나(`app.post('/mcp', ...)`)면 된다 — 지난 사이클 배포 버그 2건이 났던 `vercel.json` 을 안 건드린다 | 경로 규칙 검증 |
| F3 | 진입점 HTTP 메서드 | `api/[...route].ts`가 `GET`/`POST`/`PATCH`/`DELETE`만 export. MCP는 POST 필수, GET·DELETE는 세션 모드에서만 필요 → **현 상태로 충분** | `api/[...route].ts` 실측 |
| F4 | 인증 미들웨어 | `authMiddleware`가 `Authorization: Bearer <JWT>` → JWKS 검증 → `c.set('ownerId', sub)`. **분기 지점이 함수 하나**라 PAT 추가가 국소적 | `server/middleware/auth.ts` 실측 |
| F5 | 에러 처리 | 전역 `onError`가 `HTTPException` 통과 / `23505`→409 / 나머지 500. 에러 코드 표를 여기에 붙이면 전 라우트가 자동 적용 | `server/app.ts` 실측 |
| F6 | 기존 테이블 | `workspaces`/`projects`/`documents` 3개, 전부 1:N. 백로그는 `projects`에 매달면 되고 기존 테이블 변경 0건 | `server/db/schema.ts` 실측 |
| F7 | zod 스키마 규약 | `.refine()`+`.partial()` 충돌 회피를 위해 **필드 정의(`documentFields`)와 refine을 분리**하는 패턴이 이미 있다. 백로그도 이 패턴을 따른다 | `shared/schema.ts` 실측 (§38 주석) |
| F8 | DB 드라이버 | `@neondatabase/serverless` HTTP 드라이버 — **인터랙티브 트랜잭션 불가**. 드래그 정렬의 N행 갱신 설계에 직접 영향 | `package.json` + 1차 사이클 RK-06 |
| F9 | 번들 크기 | CodeMirror 도입 후 **1.25MB**. 드래그 라이브러리 추가 시 더 커짐 — 1차 사이클 회고 §6.2에서 이미 지적된 항목 | `PDCA-workspace.report.md` §6.2 |
| F10 | 이월 항목 | Important 4건 / Minor 12건 | `PDCA-workspace.report.md` §4.1 |

**F1·F2가 이번 사이클의 최대 행운이다.** Q1에서 형이 "Vercel 원격 HTTP MCP"를 골랐을 때 내가
가장 걱정한 게 `vercel.json` 재작업이었는데(지난 사이클 지뢰밭), 실측해보니 저수준 `routes`가
이미 `/api/*` 전체를 Hono로 넘기고 있어서 **설정 파일을 한 글자도 안 건드린다.** RK-01의 확률이
크게 떨어졌다.

### 1.4 Checkpoint 1·2 결정 사항

형에게 확인받은 답이다. (질문 파일 `docs/backlog-with-mcp.q.tmp`와 `docs/next.tmp`는 반영 후 삭제)

| # | 질문 | 형의 답 |
|---|------|---------|
| Q1 | MCP 서버 위치 | **Vercel 원격 HTTP MCP** — 폰·웹 어디서든 접속. F2 덕에 Hono 라우트로 구현 |
| Q2 | MCP 인증 수단 | **개인 액세스 토큰(PAT) 테이블** — 발급·폐기·기기별 회수 가능 |
| Q3 | 사이클 범위 | **한 사이클 4모듈** — 백로그 DB+API / 백로그 UI / PAT / MCP |
| Q4 | MCP 툴 개수 | **유즈케이스 기준 압축 ~10개** — 파괴적 툴 미노출 |
| Q7 | 접힘 영역 구성 | **상태별 3개 섹션** (완료 / 해소 / 삭제 각각 독립 접힘) |
| Q8 | 백로그 화면 위치 | **전용 URL** `/w/{ws}/p/{proj}/backlog` |
| Q3' | 드래그 정렬 범위 | **전체 드래그 가능** — 접힘 영역도 순서 유지 |
| Q10a | 착수(대기→진행) 주체 | **형이 UI에서 직접** |
| Q10b | 클로드의 상태 변경 권한 | **해소·삭제만 허용** — 진행·완료는 형 전용 **(사후 2026-08-09 개정: 6차 expand-mcp-agency D-13 개정, 형 결정 2026-08-08 — 진행·완료도 클로드가 직접 가능해짐. 실사용에서 사이클 완주 시 형이 완료 항목을 수동 전환해야 했던 비용이 근거. 아래 다이어그램·§7.5·§7.6도 함께 사후 개정)** |

**Q10a+Q10b가 이 사이클의 설계 축이다.** 두 답을 합치면 상태 전이가 주체별로 갈린다:

```
                    ┌──────────────────────────── 형 전용 ────────┐
     대기(todo) ────┤ → 진행(doing) ───→ 완료(done)               │
          │         └────────────────────────────────────────────┘
          │         ┌──────────────── 클로드 + 형 ────────────────┐
          └─────────┤ → 해소(resolved)                            │
                    │ → 삭제(dropped)                             │
                    └────────────────────────────────────────────┘
```

**(사후 2026-08-09 개정: 6차 D-42 — "형 전용" 상자가 진행·완료 화살표를 잃고 `todo` 복귀
하나로 축소됐다. 새 그림은 아래와 같다.)**

```
     대기(todo) ────────────────────────────────────────────────
          │  ↑                ┌──────────── 클로드 + 형 ────────┐
          │  │(형 전용,        │ → 진행(doing)                  │
          │  │ D-42)          │ → 완료(done)                    │
          │  └────────────────┤ → 해소(resolved)                │
          └──────────────────→│ → 삭제(dropped)                 │
                               └──────────────────────────────────┘
```

### 1.5 관련 문서

- 이전 사이클: [PDCA-workspace.report.md](../PDCA-workspace/PDCA-workspace.report.md)
- 이전 사이클 이월 항목: 같은 문서 §4.1
- 문서 규칙: [RULE.md](../../../RULE.md)
- 프로젝트 규칙: [CLAUDE.md](../../../../CLAUDE.md)

---

## 2. Scope

### 2.1 In Scope

- [ ] `backlog_items` 테이블 + 마이그레이션
- [ ] 백로그 CRUD API (생성·조회·수정·삭제)
- [ ] 순서 일괄 저장 API (드래그 결과 반영)
- [ ] 백로그 전용 화면 `/w/{ws}/p/{proj}/backlog` — 카드 리스트, 중요도·상태 배지
- [ ] 카드 클릭 → 상세 팝업 (마크다운 본문, 날짜 지정, 상태 전환)
- [ ] 드래그 정렬 (전체 범위, 접힘 영역 포함)
- [ ] 종료 항목 접힘 3섹션 (완료 / 해소 / 삭제)
- [ ] `api_tokens` 테이블 + PAT 발급·폐기 UI
- [ ] `authMiddleware` PAT/JWT 분기
- [ ] **`/api/mcp` Streamable HTTP MCP 서버** (stateless)
- [ ] MCP 툴 8개 (문서 3 + 백로그 4 + 프로젝트 1)
- [ ] **이월 처리**: 에러 코드 표 확정·통일, 전역 QueryClient 401 리다이렉트 핸들러

### 2.2 Out of Scope

- 다중 유저 / 백로그 공유 / 담당자 지정 (`owner_id` 스코프는 유지하되 확장 안 함)
- 백로그 기한(due date)·알림·리마인더
- 백로그 라벨·태그·카테고리 (중요도 4단계로 충분)
- 백로그 간 의존관계 / 하위 항목 / 체크리스트
- MCP OAuth 2.1 인증 흐름 (PAT 정적 토큰으로 충분 — Q2)
- MCP 리소스(Resources)·프롬프트(Prompts) — 툴만 제공
- MCP 세션 관리 / 서버→클라이언트 SSE 푸시 (stateless POST-only, §7.2 D-05)
- 백로그 변경 이력 / 감사 로그
- 이월 Minor 12건, Important 중 `javascript:` 차단·409 선택지 UI (그대로 재이월)
- 코드 분할·번들 최적화 (F9 인지하되 이번에도 스코프 외 — 단 RK-06으로 관리)

---

## 3. Requirements

### 3.1 기능 요구사항

| ID | 요구사항 | 우선순위 | 상태 |
|----|----------|:--------:|------|
| FR-01 | 백로그 항목 생성/조회/수정/삭제. 프로젝트 삭제 시 캐스케이드 | High | Pending |
| FR-02 | 필드: 이름, 중요도(긴급/높음/중간/낮음), 상태(대기/진행/완료/해소/삭제), 상세내용(md), 생성일, 처리일 | High | Pending |
| FR-03 | **생성일·처리일은 형이 날짜를 직접 지정**한다 (레코드 시각과 별개 컬럼) | High | Pending |
| FR-04 | 카드 미리보기에 이름·중요도·생성일·처리일·상태 표시. 상태·중요도는 배지 | High | Pending |
| FR-05 | 카드 클릭 시 팝업으로 상세내용(마크다운 렌더) 표시·편집 | High | Pending |
| FR-06 | 팝업에서 상태 전환, 생성일·처리일 날짜 지정 가능 | High | Pending |
| FR-07 | 드래그로 순서 변경 시 저장된다. 새로고침 후에도 유지 | High | Pending |
| FR-08 | 완료·해소·삭제는 **각각 독립 접힘 섹션**으로 하단에 분리하되 삭제하지 않는다 | High | Pending |
| FR-09 | 접힘 섹션 내부도 드래그 정렬 가능하고, 상태 전환 시 순서가 보존된다 | Medium | Pending |
| FR-10 | 전용 URL `/w/{ws}/p/{proj}/backlog` — 딥링크·새로고침 동작 | High | Pending |
| FR-11 | 사이드바/프로젝트 개요에서 백로그로 진입할 링크 | Medium | Pending |
| FR-12 | PAT 발급 — 이름 지정, 생성 시 1회만 평문 노출 | High | Pending |
| FR-13 | PAT 목록 조회(이름·생성일·최종사용일) 및 폐기 | High | Pending |
| FR-14 | `authMiddleware`가 PAT와 JWT를 접두어로 분기 검증 | High | Pending |
| FR-15 | `POST /api/mcp` — Streamable HTTP MCP 서버, `initialize`/`tools/list`/`tools/call` 처리 | High | Pending |
| FR-16 | MCP 요청도 PAT 인증 필수. 미인증 시 조회 불가 | High | Pending |
| FR-17 | MCP 툴: `project_list`, `document_list`, `document_read`, `document_write` | High | Pending |
| FR-18 | MCP 툴: `backlog_list`, `backlog_create`, `backlog_update`, `backlog_reorder` | High | Pending |
| FR-19 | `backlog_update` 툴은 `resolved`/`dropped`만 설정 가능. `doing`/`done` 시도 시 거부 | High | Pending |
| FR-20 | 에러 코드 표 확정 — 전 라우트가 이 표만 참조 (이월) | Medium | Pending |
| FR-21 | 전역 QueryClient 401 핸들러 → 로그인 리다이렉트 (이월) | Medium | Pending |

### 3.2 비기능 요구사항

| 범주 | 기준 | 측정 방법 |
|------|------|-----------|
| 보안 | PAT는 **평문 미저장**. 해시만 DB에 남고 발급 시 1회 노출 | 스키마 + DB 실조회로 확인 |
| 보안 | PAT 폐기 후 그 토큰으로 API 호출 시 401 | 실토큰으로 폐기 전/후 curl |
| 보안 | MCP 툴에 파괴적 작업 미노출 — `tools/list` 응답에 delete 계열 0건 | 실응답 전수 확인 |
| 보안 | `backlog_update`로 `doing`/`done` 설정 시도 → 명시적 거부(성공 응답 아님) | 실호출 |
| 정합성 | 드래그 정렬 결과가 새로고침·재접속 후에도 동일 | 실측 |
| 정합성 | 상태 전환 후에도 `sort_order` 보존 (FR-09) | 실측 |
| 성능 | 백로그 100건 렌더 + 드래그 반응 < 100ms | 실측 |
| 성능 | MCP `tools/call` p95 < 800ms (Vercel 웜) | 배포 후 실측 |
| 호환 | Claude Code `claude mcp add --transport http`로 붙고 툴 8개가 보인다 | 실연결 |

---

## 4. Success Criteria

| ID | 기준 | 검증 방법 |
|----|------|-----------|
| **C1** | 백로그 CRUD가 브라우저에서 전부 동작한다 | 생성→수정→상태전환→삭제 1회전 |
| **C2** | 드래그 정렬이 저장되고 새로고침 후에도 유지된다. 상태 전환 시 순서도 보존 | 실측 |
| **C3** | 종료 항목 3섹션이 각각 접히고, 접힌 항목이 사라지지 않는다 | 실측 |
| **C4** | 생성일·처리일을 형이 지정한 날짜대로 저장·표시한다 (레코드 시각과 무관) | 과거 날짜 입력 후 대조 |
| **C5** | PAT를 발급해 `curl -H "Authorization: Bearer pdcaw_..."` 로 API 호출 성공. **폐기 후 401** | curl 실측 |
| **C6** | Claude Code에 원격 MCP를 붙여 `tools/list`에 툴 8개가 보인다 | `claude mcp add` 실연결 |
| **C7** | **next.tmp 유즈케이스 3단계 완주 (이 사이클의 관문)** — 클로드가 PDCA 문서를 훑고 → 백로그를 해소·생성하고 → 형이 브라우저에서 순서를 조정해 하나를 `진행`으로 착수 | 실제 Claude Code 세션 1회 완주 |
| **C8** | `backlog_update`로 `doing`/`done` 설정을 시도하면 거부된다 (Q10b 경계 실증) | MCP 실호출 |
| **C9** | 미인증(토큰 없음) MCP 요청이 401. 데이터 누출 0 | curl 실측 |
| **C10** | 형이 실제로 이 백로그에 1차 사이클 이월 항목 16건을 넣고 사용한다 | 형 확인 |

### 4.1 Definition of Done

- [ ] FR-01~FR-21 구현 (Medium 미달 시 사유 명시)
- [ ] C1~C10 전부 충족
- [ ] 정렬 재번호 로직 + PAT 해시/검증 + 상태 전이 규칙에 단위 테스트
- [ ] `analysis` 문서로 Gap 분석 완료
- [ ] `report` 문서 작성 + `docs/PDCA/_INDEX.md` 행 추가 + 링크 전수 검증
- [ ] `docs/next.tmp`, `docs/backlog-with-mcp.q.tmp` 삭제 (RULE.md 규칙)

---

## 5. Risks and Mitigation

| ID | 리스크 | 영향 | 확률 | 완화 |
|----|--------|:----:|:----:|------|
| **RK-01** | Streamable HTTP MCP를 Vercel 위에 얹는 과정에서 라우팅·응답 형태 문제 발생. 지난 사이클 배포 버그 6건 중 2건이 Vercel 라우팅이었다 | High | **Low↓** | **F1·F2로 확률이 크게 떨어졌다** — `vercel.json`을 안 건드리고 Hono 라우트로 끝난다. 그래도 module-4 착수 시 **스파이크 먼저**: 툴 0개짜리 빈 MCP 서버를 배포하고 `claude mcp add`로 연결만 확인한 뒤 툴을 붙인다 |
| **RK-02** | PAT가 형 문서·백로그 전체의 **쓰기 권한**을 갖는다. 유출 시 피해 범위가 계정 전체 | High | Low | 평문 미저장(해시만), 발급 시 1회 노출, 목록에서 즉시 폐기 가능, `last_used_at` 기록으로 이상 감지. 스코프 분리(읽기 전용 토큰)는 오버엔지니어링이라 미도입 |
| **RK-03** | 클로드가 `document_write`로 형의 문서를 의도치 않게 덮어쓴다 | High | Medium | `document_write`를 **경로 기준 upsert**로 하되, 기존 문서 갱신 시 응답에 이전 길이/신규 길이를 반환해 사후 확인 가능하게. 문서 삭제 툴은 아예 미노출(Q4) |
| **RK-04** | **Neon HTTP 드라이버는 인터랙티브 트랜잭션 불가**(F8). 드래그 정렬 N행 갱신이 원자적이지 않으면 중간 실패 시 순서가 깨진다 | Medium | Medium | 재번호를 루프가 아니라 **단일 SQL문**(`UPDATE ... FROM (VALUES ...)`)으로 처리해 원자성 확보. 이게 안 되면 드라이버의 배치 `transaction()` API 사용. Design에서 확정 |
| **RK-05** | 드래그 라이브러리가 번들을 더 키운다(F9: 이미 1.25MB) | Low | High | 라이브러리 도입 전 **HTML5 native drag-and-drop으로 먼저 시도**. 항목 수십 개 스코프에서 충분한지 실측하고, 부족할 때만 라이브러리 도입 + lazy load |
| **RK-06** | `sort_order` 정수 재번호가 동시 편집 시 충돌 | Low | Low | 단일 사용자라 실질 무해. 재번호를 서버가 항상 정규화(0..N-1)해 드리프트를 누적시키지 않음 |
| **RK-07** | MCP 툴 8개의 설명이 부실해 클로드가 잘못된 툴을 고르거나 안 쓴다 | Medium | Medium | 각 툴 `description`에 **언제 호출해야 하는지**를 명시(무엇을 하는지만 쓰지 않는다). 특히 `backlog_update`는 설정 가능한 상태를 설명에 못박아 FR-19 거부를 사전에 줄인다 |
| **RK-08** | 상태 전이 규칙이 서버·MCP·UI 세 군데에 흩어져 어긋난다 | Medium | Medium | 전이 규칙을 `shared/`의 **순수 함수 1개**로 두고 세 경로가 전부 그것만 호출. 단위 테스트 대상(DoD) |
| **RK-09** | `.tmp` 질문 파일과 next.tmp를 삭제하지 않고 사이클을 종료 | Low | Medium | DoD 체크리스트에 명시. 사이클 종료 절차에 포함 |

---

## 6. Impact Analysis

> 1차 사이클과 달리 **기존 소비자가 있다.** 이번 변경이 무엇을 건드리는지 명시한다.

| 대상 | 변경 유형 | 영향 |
|------|-----------|------|
| `server/db/schema.ts` | **추가만** (2테이블) | 기존 3테이블 무변경 (F6) — 마이그레이션 리스크 최소 |
| `server/middleware/auth.ts` | **수정** | PAT 분기 추가. **전 API가 이 함수를 지나므로 회귀 표면이 가장 넓다** — 1차 사이클에서 C2(401)가 여기서 회귀했다. 수정 직후 전 라우트 재검증 필수 |
| `server/app.ts` | 수정 | 라우트 3개 추가(backlog, tokens, mcp) + 에러 코드 표 반영(FR-20) |
| `shared/schema.ts` | 추가 | 백로그·PAT zod 스키마. F7 패턴(필드/refine 분리) 준수 |
| `api/[...route].ts` | **무변경** | F3 — 현 export로 충분 |
| `vercel.json` | **무변경** | F1·F2 — 이번 사이클 최대 안전 요소 |
| `src/app/router.tsx` | 수정 | `/backlog` 라우트 추가. **와일드카드 문서 라우트보다 먼저 매칭돼야 한다** — 순서 실수 시 `backlog`가 문서 경로로 해석됨 |
| 프론트 전역 | 수정 | QueryClient 401 핸들러(FR-21) — 전 쿼리에 영향 |

### 6.1 신규 외부 의존

| 의존 | 용도 | 끊기면 |
|------|------|--------|
| MCP TypeScript SDK (또는 직접 구현한 JSON-RPC 핸들러) | MCP 프로토콜 처리 | MCP 기능 정지. 웹앱은 무관 |
| 드래그 라이브러리 (RK-05에서 도입 판정 시) | 정렬 UX | 정렬만 영향 |

### 6.2 검증

- [ ] Design 착수 전 **MCP Streamable HTTP 사양 확인** — stateless 모드에서 필수 엔드포인트/헤더,
      `Mcp-Session-Id` 생략 가능 여부, `Accept` 헤더 요구사항
- [ ] Design 착수 전 **Claude Code 원격 MCP 연결 방식 확인** — `claude mcp add --transport http`의
      커스텀 헤더 전달 형식
- [ ] Neon HTTP 드라이버의 단일 SQL 다중행 갱신 가능 여부 (RK-04)

---

## 7. Architecture Considerations

### 7.1 프로젝트 레벨

1차 사이클과 동일 — **Dynamic**. 계층을 나누지 않고 경계만 지키는 옵션 C(Pragmatic) 기조 유지.

### 7.2 핵심 아키텍처 결정 (Decision Record)

| # | 결정 | 후보 | 채택 | 근거 |
|---|------|------|------|:----|
| D-01 | MCP 서버 위치 | 로컬 stdio / **Vercel 원격 HTTP** / DB 직접 | 원격 HTTP | **형 결정(Q1).** 폰·웹 어디서든 접속 |
| D-02 | MCP 배치 | 새 Vercel 함수 / **Hono 라우트** | Hono 라우트 | **F2.** `vercel.json` 무변경 → 지난 사이클 최대 지뢰를 우회 |
| D-03 | MCP 인증 | OAuth 2.1 / **PAT 정적 토큰** / env 시크릿 | PAT | **형 결정(Q2).** OAuth는 개인 앱 스코프에 과함, env 시크릿은 폐기 수단이 없음 |
| D-04 | PAT 저장 | 평문 / **해시** | 해시 | 유출 시 피해 최소화(RK-02). 발급 시 1회만 평문 반환 |
| D-05 | MCP 전송 모드 | 세션+SSE / **stateless POST-only** | stateless | 서버리스에 세션 상태를 둘 수 없다. 툴 호출은 요청-응답이라 서버→클라 푸시 불필요 |
| D-06 | 백로그 저장 | `documents`에 통합 / **전용 테이블** | 전용 테이블 | 정렬·상태·날짜가 1급 필드여야 정렬·필터가 가능. 문서로 넣으면 전부 본문 파싱 |
| D-07 | 보드 단위 | `backlogs` 테이블 / **프로젝트=보드** | 프로젝트=보드 | next.tmp "project 단위로 하나씩". 중간 테이블은 순수 오버헤드 |
| D-08 | 사용자 지정 날짜 | `created_at` 재사용 / **`opened_on` 분리** | 분리 | next.tmp "생성일은 날짜 지정해서 입력". 합치면 "3일 전 아이디어를 오늘 입력"에서 반드시 꼬인다 |
| D-09 | 정렬 저장 | fractional index / **`sort_order` 정수** | 정수 | 수십 개 스코프에 LexoRank는 과설계. 서버가 항상 0..N-1로 정규화 |
| D-10 | 정렬 갱신 | 루프 UPDATE / **단일 SQL 다중행** | 단일 SQL | **F8** — HTTP 드라이버에 인터랙티브 트랜잭션이 없다. 원자성을 SQL 한 문장으로 확보(RK-04) |
| D-11 | 드래그 구현 | 라이브러리 선도입 / **native 먼저** | native 먼저 | **F9** 번들 1.25MB. 부족할 때만 도입(RK-05) |
| D-12 | 상태 전이 규칙 | 각 경로에 인라인 / **shared 순수 함수** | 순수 함수 | Q10a·Q10b 경계가 서버·MCP·UI 3곳에 필요. 흩어지면 어긋난다(RK-08) |
| D-13 | 클로드 상태 권한 | 전체 / **해소·삭제만** / 없음 | 해소·삭제만 | **형 결정(Q10b).** 사실 확인은 클로드, 의사결정은 형 |
| D-14 | 백로그 삭제 API | 없음 / **REST에만 존재** | REST만 | `삭제` 상태는 레코드 보존. 오타 정리용 hard delete는 남기되 MCP 미노출(Q4·Q6) |
| D-15 | 백로그 URL | 프로젝트 탭 / **전용 경로** | 전용 경로 | **형 결정(Q8).** 경로 미러링 체계에 편입, ⌘K 점프 가능 |
| D-16 | 접힘 구성 | 통합 1섹션 / **상태별 3섹션** | 3섹션 | **형 결정(Q7).** 완료/해소/삭제는 성격이 다른 종료 |
| D-17 | 에러 코드 | 라우트별 즉흥 / **Design에 표 확정** | 표 확정 | 1차 회고 §6.3 Try. `PATH_TAKEN`/`CONFLICT` 분열의 재발 방지 |

### 7.3 데이터베이스 스키마 — *Action Item 1*

#### 관계도

```
   workspaces ──1──N── projects ──1──N── documents
                          │
                          └──1──N── backlog_items      ← 신규
                                    - id (uuid, pk)
   (독립)                            - project_id (fk, cascade)
   api_tokens         ← 신규         - title
   - id (uuid, pk)                   - priority   urgent|high|medium|low
   - owner_id                        - status     todo|doing|done|resolved|dropped
   - name                            - detail     (md, nullable)
   - token_hash                      - opened_on  (date, 형 지정)
   - created_at                      - closed_on  (date, nullable, 형 지정)
   - last_used_at                    - sort_order (int)
                                     - created_at / updated_at
```

#### `backlog_items`

| 컬럼 | 타입 | 제약 | 설명 |
|------|------|------|------|
| `id` | uuid | PK, default gen_random_uuid() | |
| `project_id` | uuid | FK → projects.id **ON DELETE CASCADE**, index | D-07: 프로젝트가 곧 보드 |
| `title` | text | NOT NULL | 이름 (카드 미리보기) |
| `priority` | enum(`urgent`,`high`,`medium`,`low`) | NOT NULL | 긴급/높음/중간/낮음 |
| `status` | enum(`todo`,`doing`,`done`,`resolved`,`dropped`) | NOT NULL, default `todo` | 대기/진행/완료/해소/삭제 |
| `detail` | text | NULL 허용 | 상세내용 마크다운 (팝업) |
| `opened_on` | date | NOT NULL | **생성일 — 형이 지정**(D-08) |
| `closed_on` | date | NULL 허용 | **처리일 — 형이 지정** |
| `sort_order` | integer | NOT NULL | 전체 드래그 정렬(Q3'). 서버가 0..N-1 정규화 |
| `created_at` / `updated_at` | timestamptz | NOT NULL, default now() | 레코드 시각 (화면 미노출) |

- INDEX `(project_id, sort_order)` ← 목록 조회가 이 인덱스를 그대로 탄다
- `status`가 종료 3종(`done`/`resolved`/`dropped`)이면 `closed_on` 입력을 UI가 권장(강제 아님 —
  과거 항목 일괄 입력 시 막히면 불편)

#### `api_tokens`

| 컬럼 | 타입 | 제약 | 설명 |
|------|------|------|------|
| `id` | uuid | PK | |
| `owner_id` | text | NOT NULL, index | Neon Auth 사용자 ID (기존 규약과 동일) |
| `name` | text | NOT NULL | `claude-code-wsl` 같은 식별용 |
| `token_hash` | text | NOT NULL, unique | **평문 미저장**(D-04) |
| `created_at` | timestamptz | NOT NULL | |
| `last_used_at` | timestamptz | NULL 허용 | 이상 감지용(RK-02) |

토큰 형식: `pdcaw_` + 랜덤. **접두어가 authMiddleware 분기 키**(F4).

### 7.4 API 엔드포인트 — *Action Item 2*

| 메서드 | 경로 | 설명 |
|--------|------|------|
| GET | `/api/projects/:projId/backlog` | 백로그 목록 (sort_order 순) |
| POST | `/api/projects/:projId/backlog` | 항목 생성 |
| PATCH | `/api/backlog/:id` | 항목 수정 (내용·중요도·상태·날짜) |
| DELETE | `/api/backlog/:id` | hard delete (D-14, MCP 미노출) |
| **PUT** | `/api/projects/:projId/backlog/order` | **순서 일괄 저장** — `{ ids: string[] }` |
| GET | `/api/tokens` | PAT 목록 (해시 미반환) |
| POST | `/api/tokens` | PAT 발급 — **평문 1회 반환** |
| DELETE | `/api/tokens/:id` | PAT 폐기 |
| **POST** | `/api/mcp` | **MCP Streamable HTTP 엔드포인트** (D-02·D-05) |

`PUT .../order`가 D-10의 구현 지점이다 — 받은 `ids` 배열을 단일 SQL 다중행 UPDATE로
0..N-1 재번호하고, 배열에 없는 항목은 손대지 않는다.

### 7.5 MCP 툴 목록 — *Action Item 3*

Q4(압축 ~10개)에 따라 **8개**. 각 툴 설명에는 *무엇을 하는지*가 아니라 **언제 호출해야 하는지**를
쓴다(RK-07).

| 툴 | 용도 | 유즈케이스 단계 |
|---|---|:---:|
| `project_list` | 워크스페이스·프로젝트 목록 | 진입 |
| `document_list` | 프로젝트 문서 목록/트리 (본문 제외) | ① |
| `document_read` | 경로로 문서 본문 | ① |
| `document_write` | 문서 생성·갱신 (경로 upsert, RK-03) | 산출물 업로드 |
| `backlog_list` | 백로그 조회 (상태 필터) | ① |
| `backlog_create` | 항목 생성 | ② |
| `backlog_update` | 내용·중요도·날짜 갱신 + **`resolved`/`dropped` 전환만** | ② |
| `backlog_reorder` | 순서 일괄 저장 (형 UI가 주력, 툴은 보조) | ③ 보조 |

**의도적으로 뺀 것**: 워크스페이스·프로젝트·문서·백로그의 모든 `delete` 계열, 워크스페이스·
프로젝트 `create`/`update`. 툴이 없으면 실수할 방법이 없다.
**(사후 2026-08-09 확인: 6차 expand-mcp-agency D-43 — 이 목록은 불변으로 유지됐다. 6차가
넓힌 건 `backlog_update`의 status 값 범위뿐이고, 삭제·workspace/project create·update는
여전히 툴 미등록이다)**

**FR-19 거부 응답**은 조용한 무시가 아니라 명시적 에러여야 한다 — 클로드가 "바꿨다"고 형에게
보고하는 걸 막아야 하기 때문이다.
**(사후 2026-08-09 개정: 6차 D-42 — `backlog_update`의 status 허용 범위가 `resolved`·`dropped`
2값에서 `doing`·`done`·`resolved`·`dropped` 4값(전 상태 − `todo`)으로 넓어졌다. 거부 대상은
`todo` 복귀 하나로 좁아졌지만, "거부는 명시적 에러"라는 이 원칙 자체는 그대로 적용된다 —
6차 CK3-2 문안이 그 자리를 잇는다)**

### 7.6 상태 전이 규칙 (D-12의 실체)

`shared/` 순수 함수 1개. 서버 PATCH·MCP 툴·UI 배지가 전부 이것만 호출한다.

```
canTransition(from, to, actor: 'user' | 'mcp') → boolean

actor='user' : 모든 전이 허용
actor='mcp'  : to ∈ {resolved, dropped} 만 허용   ← Q10b
```

단위 테스트 대상(DoD). 여기가 흔들리면 Q10a·Q10b 결정 전체가 무너진다.

**(사후 2026-08-09 개정: 6차 expand-mcp-agency D-42·D-44 — 허용 목적지가 `MCP_ALLOWED_TARGETS`
export 상수로 승격되고 4값으로 넓어졌다.)**

```
canTransition(from, to, actor: 'user' | 'mcp') → boolean   // 본체 무변경

actor='user' : 모든 전이 허용
actor='mcp'  : to ∈ MCP_ALLOWED_TARGETS = {doing, done, resolved, dropped} 만 허용
               (= 전 상태 − todo)   ← 6차 D-42, "todo 복귀만 형 전용"
```

---

## 8. Convention Prerequisites

### 8.1 기존 규약

- [x] `CLAUDE.md` — 기본수칙·git·PDCA 문서 규칙
- [x] `docs/RULE.md` — PDCA 문서 규칙 (경로 고정, 4종만, .tmp 질문)
- [x] oxlint / tsconfig / vitest 구성 완료
- [x] 주석 규약 `// Design Ref: §N`, `// Plan SC: CN` — 1차 사이클에서 정착

### 8.2 이번에 정의할 규약

| 범주 | 정의할 것 | 우선순위 |
|------|-----------|:--------:|
| **에러 코드** | Design §에 **전체 코드 표 확정**. 신규 라우트는 이 표만 참조 (FR-20, D-17) | High |
| 상태 라벨 | enum 값(영문) ↔ 화면 라벨(한글) 매핑을 `shared/`에 1곳 | High |
| MCP 툴 명명 | `{리소스}_{동작}` snake_case 고정 | High |
| 토큰 접두어 | `pdcaw_` 고정 — 분기 키이자 유출 시 grep 가능 | High |
| 날짜 표기 | `date` 컬럼은 타임존 없음. 화면·API 모두 `YYYY-MM-DD` 문자열 | Medium |

### 8.3 환경변수

| 변수 | 용도 | 범위 | 신규 |
|------|------|------|:----:|
| `DATABASE_URL` | Neon 연결 | Server | 기존 |
| `NEON_AUTH_JWKS_URL` | JWT 검증 | Server | 기존 |
| `VITE_*` (Neon Auth) | 로그인 | Client | 기존 |
| `TOKEN_HASH_SECRET` | PAT 해시 솔트/키 (해시 방식에 따라 불필요할 수도) | Server | **Design에서 확정** |

---

## 9. [DO] 실행 마일스톤 — *Action Item 4*

리스크가 큰 것과 하위 의존을 앞에 둔다. 각 모듈은 **끝났을 때 눈으로 확인 가능한 결과**를 남긴다.

| Module | 이름 | 산출물 | 완료 판정 |
|:------:|------|--------|-----------|
| **1** | 백로그 DB + API | `backlog_items` 스키마·마이그레이션, `routes/backlog.ts`, zod 스키마, 상태 전이 순수 함수 + 단위 테스트, **에러 코드 표 확정(FR-20)** | dev 브랜치 적용 후 curl로 CRUD + `PUT order` 1회전. 정렬 재번호 원자성 실증 (**C1** 일부, RK-04 해소) |
| **2** | 백로그 UI | `/backlog` 라우트, 카드 리스트, 배지, 상세 팝업, 드래그 정렬, 접힘 3섹션, 진입 링크 | 브라우저에서 CRUD·드래그·접힘 전부 동작 (**C1·C2·C3·C4**). RK-05 판정(native로 충분한가) |
| **3** | PAT 인증 | `api_tokens` 스키마, `authMiddleware` 분기, 발급·폐기 UI, **전역 401 핸들러(FR-21)** | PAT 발급 → curl 성공 → 폐기 → 401 (**C5**). **전 라우트 회귀 스윕 필수** (§6 auth 영향) |
| **4** | MCP 서버 | `/api/mcp` Streamable HTTP, 툴 8개, 툴 설명 작성 | **스파이크 먼저**(툴 0개 배포 + `claude mcp add` 연결) → 툴 8개 → **C6·C7·C8·C9** |

**순서 근거**

- module-1을 먼저 두는 이유: module-2(UI)와 module-4(MCP 툴)가 둘 다 백로그 API에 의존한다.
  API 계약이 흔들리면 두 모듈을 다시 만진다.
- module-3(PAT)을 module-4보다 앞에 두는 이유: MCP가 PAT 없이는 인증을 못 한다. 그리고 **auth
  수정은 전 라우트 회귀 표면**(§6)이라 MCP를 얹기 전에 회귀를 털어내야 원인 분리가 쉽다.
- module-4 안에서 스파이크를 먼저 두는 이유: RK-01이 참이면 D-02(Hono 라우트)를 재검토해야
  하는데, 툴 8개를 다 만든 뒤에 알면 손실이 크다.
- module-2를 module-3보다 앞에 두는 이유: C7(관문)의 3단계가 UI라서, UI가 먼저 서 있어야
  module-4 끝에 곧바로 완주 검증을 할 수 있다.

**§5.4 체크리스트 태깅** (1차 회고 §6.3 Try 반영): Design에서 화면 체크리스트를 만들 때
**모듈별 커버 항목을 미리 태깅**하고, 각 모듈 완료 시 그 항목만 즉시 대조한다. 1차 사이클처럼
마지막 Check에서 27항목을 한꺼번에 대조하지 않는다.

**세션 분할 권고**: module-1~2 / module-3 / module-4 — 3세션. module-3은 회귀 스윕까지 한 세션에
묶고, module-4는 스파이크→툴→C7 완주를 한 세션에 붙인다(스파이크와 툴 구현이 갈리면 디버깅
왕복이 생긴다).

---

## 10. Next Steps

1. [ ] 형 Plan 승인
2. [ ] §6.2 검증 3건 수행 (MCP 사양 / Claude Code 연결 방식 / Neon 다중행 UPDATE)
3. [ ] 설계 문서 작성 (`backlog-with-mcp.design.md`) — **에러 코드 표 + 모듈별 태깅된 UI 체크리스트 포함**
4. [ ] module-1 착수
5. [ ] 사이클 종료 시 `docs/next.tmp` · `docs/backlog-with-mcp.q.tmp` 삭제

---

## Version History

| 버전 | 날짜 | 변경 내용 | 작성자 |
|------|------|-----------|--------|
| 0.1 | 2026-08-07 | 최초 작성. 형 결정 9건(Q1 원격 HTTP MCP / Q2 PAT / Q3 한 사이클 4모듈 / Q4 툴 8개 / Q7 3섹션 접힘 / Q8 전용 URL / Q3' 전체 드래그 / Q10a 착수는 형 / Q10b 클로드는 해소·삭제만) 반영. 현 저장소 실측(F1~F10) 기반 — 특히 F1·F2로 `vercel.json` 무변경 확인해 RK-01 확률 하향 | cogmo |
| 0.2 | 2026-08-09 | **(사후 개정, expand-mcp-agency 사이클 6차 D-13 개정, 형 결정 2026-08-08)** Q10b 권한 경계 개정 반영 3곳 — §1.4 Q10b 표 + ASCII 다이어그램("형 전용" 상자가 진행·완료를 잃고 todo 복귀로 축소) / §7.5 FR-19 문단(미노출 목록은 D-43로 불변 확인) / §7.6 `canTransition` 명세(허용 목적지 4값, `MCP_ALLOWED_TARGETS` export). 실사용에서 사이클 완주 시 형이 완료 항목을 수동 전환해야 했던 비용이 개정 근거. 전부 원문 유지 + 사후 문구 병기(4차 D-25 형식) | cogmo |
