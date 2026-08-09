---
template: analysis
version: 1.3
---

# backlog-with-mcp 분석 문서

> **분석 유형**: Gap Analysis (Design vs Implementation) + Runtime Verification
> **프로젝트**: PDCA-workspace
> **작성자**: Claude
> **작성일**: 2026-08-07
> **Plan 문서**: [backlog-with-mcp.plan.md](./backlog-with-mcp.plan.md)
> **Design 문서**: [backlog-with-mcp.design.md](./backlog-with-mcp.design.md)

---

## Context Anchor

> Design에서 복사.

| Key | Value |
|-----|-------|
| **WHY** | PDCA 산출물은 쌓이는데 "다음 할 일"이 사람 머리와 report.md 표에만 있다. 그 판단에 필요한 문서를 클로드가 못 읽는다. |
| **WHO** | 형 단독 + **클로드(MCP 클라이언트)** — 처음으로 사람이 아닌 소비자가 생긴다. |
| **RISK** | Streamable HTTP MCP를 Vercel에 얹기(F1·F2로 확률 하향) / PAT 전체 쓰기 권한(RK-02, D-18로 노출면 소폭 확대) / Neon HTTP 드라이버 정렬 원자성(RK-04, module-1에서 해소). |
| **SUCCESS** | C1~C10. 핵심은 **C7 — 유즈케이스 3단계를 실제 Claude Code 세션에서 완주**. |
| **SCOPE** | 축1 백로그 DB+API / 축2 백로그 UI / 축3 PAT / 축4 MCP 툴 8개. |

---

## Strategic Alignment Check

> PRD는 이 사이클에서 생략(`/pdca pm` 미실행). Plan→Design→Do 체인만 검증.

### Plan Core Value 정합

| Plan 요소 | 기대 | 구현 상태 |
|-----------|------|:---------:|
| Problem(WHY) — "다음 할 일"이 report.md 표에만 있음 | 조회·정렬·상태전환 가능한 레코드로 승격 | ✅ `backlog_items` 테이블 + 보드 UI |
| Solution — 백로그 보드 + 원격 MCP + PAT | 3축 전부 | ✅ module-1~4 전부 구현 |
| Core Value — "판단은 클로드가, 결정은 형이" | MCP 툴 권한 경계 = Q10a·Q10b | ✅ `canTransition` + zod 협소화로 코드화(§3.3, §4.4) — 프롬프트가 아니라 구조로 강제 |

### Success Criteria 상태 (Plan §4)

| # | 기준 | 상태 | 근거 |
|---|------|:---:|------|
| C1 | 백로그 CRUD가 브라우저에서 전부 동작 | ⚠️ | API 계층은 100% 실증(L1 #4·8·9). 브라우저 UI 자체는 내가 직접 클릭해본 게 아니라 코드 완결성 + 형의 부분 사용(토큰 페이지)으로만 확인 |
| C2 | 드래그 정렬 저장·새로고침 유지, 상태전환 시 순서보존 | ⚠️ | `PUT /order` 원자성·재조회 일치는 API로 실증(L1 #8). 실제 드래그 UX는 미확인 |
| C3 | 종료 항목 3섹션 접힘, 사라지지 않음 | ⚠️ | 코드 완결(`SectionCollapse.tsx`, localStorage), 브라우저 미확인 |
| C4 | 생성일·처리일 형 지정대로 저장·표시 | ⚠️ | 생성일은 실증됨. **처리일은 한 번 넣으면 못 지운다(C-1, 아래)** — C4 취지 일부 위반 |
| C5 | PAT 발급 curl 성공, 폐기 후 401 | ✅ | L1 #2·#3 실증 |
| C6 | `tools/list`에 툴 8개 | ⚠️ | 프로토콜 레벨(`app.request()` 시뮬레이션)로는 완전 실증(L1 #10). **실제 `claude mcp add` 연결은 미실행** — **(사후 2026-08-08)** 웹 커넥터 실사용으론 확인됨(F27), CLI는 여전히 미검증 |
| C7 | 유즈케이스 3단계 완주 (관문) | ~~❌~~ → **✅ (사후)** | 배포 + 실제 Claude Code 세션 필요. 이번 세션에서 미실행. **(사후 2026-08-08)** claude.ai 웹 MCP 커넥터로 완주(F27, refine-mcp-hardening S6) |
| C8 | `backlog_update`로 doing/done 거부 | ✅ | L1 #6 실증(zod 1차 방어에서 거부) |
| C9 | 미인증 MCP 401 | ✅ | L1 #1 실증 |
| C10 | 형이 실제로 이월 16건을 넣고 사용 | ~~❌~~ → **✅ (사후)** | 아직 미실행. **(사후 2026-08-08)** claude.ai 웹 MCP 커넥터로 완료(F27, refine-mcp-hardening S6) |

**Success Rate**: 3/10 완전 충족, 5건 부분(대부분 "API는 되는데 브라우저·실연결 미확인"), 2건(C7·C10) 미충족 — **둘 다 배포 후 형의 실사용이 필요한 항목**.

### Decision Record Verification

| 출처 | 결정 | 준수 여부 | 이탈 내용 |
|------|------|:---:|-----------|
| [Plan] D-01·D-02 | 원격 HTTP MCP, Hono 라우트(새 Vercel 함수 아님) | ✅ | `vercel.json` 무변경 확인(F1·F2 그대로 유효) |
| [Plan] D-03 | PAT 정적 토큰(OAuth 아님) | ✅ (확장) | OAuth는 이번에도 미채택 — 대신 **D-18**로 쿼리파라미터 폴백 추가(아래) |
| [Plan] D-04 | PAT 해시(SHA-256, 솔트 불필요) | ✅ | `lib/token.ts` |
| [Plan] D-05 | stateless POST-only | ✅ | `mcp/index.ts` — GET·DELETE 405(L1 #11) |
| [Plan] D-07·D-08·D-09 | 프로젝트=보드, opened_on 분리, 정수 sort_order | ✅ | `db/schema.ts` |
| [Plan] D-10 | 정렬 갱신 단일 SQL | ✅ | `scoped.ts:reorderBacklogItems` — `::int` 캐스팅 버그를 실 DB 테스트로 발견·수정(module-1) |
| [Plan] D-11 | native DnD 먼저 | ✅ | `BacklogCard`/`BacklogPage` HTML5 `draggable`, 라이브러리 0 |
| [Plan] D-12·D-13 | shared 순수 함수 전이 규칙, 클로드는 해소·삭제만 | ✅ | `shared/transition.ts` T1~T8 전수 일치(§3.3) |
| [Plan] D-14 | 백로그 삭제 REST만, MCP 미노출 | ✅ | `DELETE /api/backlog/:id` 존재, MCP 8툴에 delete 계열 0 |
| [Plan] D-15·D-16 | 전용 URL, 3섹션 접힘 | ✅ | `router.tsx`, `SectionCollapse.tsx` |
| [Plan] D-17 | 에러 코드 표 확정 | ✅ (1건 예외) | `lib/errors.ts` 6코드 코드화. **`mcp/index.ts`의 Origin 거부만 표에 없는 조합**(I-3, 아래) |
| [Design] 옵션 B 선택 | 서비스 계층 분리 | ✅ | routes·mcp/tools.ts 전부 Drizzle import 0건(grep 전수 확인) |
| [Design] §9.1 규칙 #2 | 어댑터는 Drizzle 직접 import 금지 | ✅ | 위반 0건 |
| **[Do/Check] D-18** | **MCP 인증에 `?token=` 쿼리 폴백 추가** | ✅ (신규) | claude.ai 웹 커넥터가 커스텀 헤더를 못 넣어 형이 결정(2026-08-07). Design §4.2에 반영 완료 |

---

## 1. 분석 개요

### 1.1 목적

module-1~4 구현이 Design 문서와 얼마나 일치하는지, 그리고 이 상태로 Report로 넘어가도 되는지 판단.

### 1.2 범위·방법

- **Design 문서**: `docs/PDCA/2026-08/backlog-with-mcp/backlog-with-mcp.design.md`
- **구현 범위**: `server/{services,routes,mcp,lib,db,middleware}`, `shared/`, `src/features/{backlog,tokens}`, 셸·라우터 수정분
- **분석 방법**: gap-detector 에이전트(정적 3축, 백그라운드 실행) + 본인이 실 DB(`app.request()` 하네스)로 런타임 L1 13개 재실증 + gap-detector가 제기한 의심 항목 4건을 git 히스토리·실 요청으로 직접 재검증
- **분석일**: 2026-08-07

---

## 2. Gap Analysis (Design vs Implementation)

### 2.1 Match Rate 요약

```
┌─────────────────────────────────────────────┐
│  Structural Match Rate:  98%  (51/52)        │
│  Functional Match Rate:  91%                 │
│  Contract Match Rate:    94%  (17.5/18)      │
│  Runtime Match Rate:    100%  (L1 13/13)     │
│  ─────────────────────────────────────────── │
│  Overall Match Rate:     96%                 │
│  = (98×0.15)+(91×0.25)+(94×0.25)+(100×0.35)  │
│  = 14.7+22.75+23.5+35 = 95.95% ≈ 96%         │
└─────────────────────────────────────────────┘
```

Structural·Functional·Contract 3축은 gap-detector 산정치를 그대로 채택(§2.2~2.4에 근거 요약).
Runtime은 본인이 Design §8.2 L1 표 13개 항목을 실 DB로 전부 재실증한 결과(§2.5).

### 2.2 Structural Match — 98%

§11.1 신규 22개 파일 22/22 존재. 수정 8개 중 7.5/8 — `app/providers.tsx`(설계가 지정한 401 핸들러
위치)는 무변경이고, 실제로는 `src/lib/api.ts`로 위치가 바뀌었다(§2.6 M-1). §3.1 Drizzle 스키마·
§4.4 MCP 툴 8개는 100% 일치.

### 2.3 Functional Depth — 91%

TODO/FIXME/placeholder grep 전체 0건. §5.4 Page UI Checklist 22항목 중 19 완전 / 3 부분
(처리일 "제안"이 실제로는 즉시 저장 확정, PAT 진입이 "사용자 메뉴"가 아니라 상시 링크,
처리일 삭제 불가). `shared/transition.ts`는 T1~T8 truth table과 **완전 일치**(단위 테스트로
전수 커버). §9.1 "Drizzle import 금지" 규칙 위반 **0건**(routes 5개·mcp/tools.ts 전수 확인).

### 2.4 API Contract — 94%

§4.1 REST 9개·§4.4 MCP 8개 전부 PASS. GET/DELETE `/mcp`가 405를 반환하는 건 맞지만
**authMiddleware가 먼저라 미인증 상태에선 401이 먼저 뜬다** — Design §4.3 문구("인증이
MCP 핸들러보다 먼저")와는 정합적이나, L1 #11을 그대로 실행하려면 유효 토큰이 있어야
한다는 전제가 문서에 명시돼 있지 않아 0.5점 감점.

### 2.5 Runtime Verification — L1 13/13 (100%)

> Design §8.2 L1 API 시나리오 표를 실 DB(`.env.local`, Neon dev 브랜치)에 `app.request()`로
> 전부 재실행. 각 요청 후 생성한 워크스페이스·프로젝트·토큰은 실행 종료 시 캐스케이드 삭제로 정리.

| # | 시험 | 기대 | 실제 | Pass |
|---|------|------|------|:---:|
| 1 | 토큰 없이 `/api/mcp` POST | 401 | 401 | ✅ |
| 2 | PAT 발급 → `GET /backlog` | 200 | 200 | ✅ |
| 3 | PAT 폐기 → 재호출 | 401 | 401 | ✅ |
| 4 | 백로그 CRUD 1회전 (JWT 대신 PAT로 대체 — 브라우저 세션 없이는 JWT 발급 불가) | 각 2xx | POST 201 / PATCH 200 / DELETE 204 | ✅ |
| 5 | `PATCH /backlog/:id` status=doing (user) | 200 | 200 | ✅ |
| 6 | MCP `backlog_update` status=doing | isError | isError(zod 1차 방어) | ✅ |
| 7 | MCP `backlog_update` status=resolved | 성공 | 성공 | ✅ |
| 8 | `PUT /order` 전체 셔플 | 200, 순서 반영 | 200, 재조회 일치 | ✅ |
| 9 | `PUT /order` id 누락 | 400 VALIDATION_ERROR | 400 VALIDATION_ERROR | ✅ |
| 10 | `tools/list` | 8개, delete 0개 | 8개, delete 0개 | ✅ |
| 11 | MCP GET | 405 | 405 | ✅ |
| 12 | Origin: evil.example | 403 | 403 | ✅ |
| 13 | 문서 경로 중복 | CONFLICT 통일 | CONFLICT + details.target:'path' | ✅ |

추가로 이번 Check 단계에서 도입한 **D-18(쿼리파라미터 PAT 인증)**도 별도 3케이스 실증:
`?token=` 정상 인증 통과 / `pdcaw_` 아닌 값은 쿼리로 거부(JWT 우회 차단 확인) / 폐기된
토큰은 쿼리로도 401.

### 2.6 gap-detector 발견 사항 재검증

> gap-detector는 "이 디렉터리가 git 저장소가 아니라 diff 불가"라고 보고했으나 **실제로는
> git 저장소이고 cycle-1 커밋이 그대로 남아있어**, 아래 4건은 `git show`로 직접 대조하고
> 2건은 실 요청으로 재현했다. 최초 보고와 결론이 달라진 항목은 굵게 표시.

| # | gap-detector 주장 | 재검증 방법 | 결론 |
|---|---|---|---|
| **I-1** | `listDocuments`가 새로 프로젝트 선검증을 추가해 무회귀 조건 위반 가능 | `git show 1b0ce1b:server/routes/documents.ts`로 원본 대조 | **오탐 — 원본 라우트가 이미 동일한 `getProject` 선검증 + 404를 하고 있었다.** 서비스 추출로 그대로 이동한 것뿐, 동작 변경 없음 |
| **I-2** | `createProjectInWorkspace`만 NOT_FOUND에 message가 있어 다른 서비스와 불일치·회귀 가능 | 동일 방법 | **오탐 — 원본 라우트도 이 한 곳만 `message: 'workspace not found'`를 갖고 있었다.** byte-동일 재현이 맞다 |
| I-3 | Origin 거부가 `VALIDATION_ERROR`(표상 400)를 HTTP 403으로 반환 — 표에 없는 조합 | 실 요청 재현 | **확인됨.** `{"error":{"code":"VALIDATION_ERROR","message":"Invalid Origin"}}`을 403으로 반환. §6.1 표의 유일한 균열 |
| **I-4** | `backlog_reorder`에 비-uuid id를 주면 500 크래시 | 실 요청 2종(개수 불일치 / 개수 일치+비uuid) 재현 | **부분 오탐 — 크래시 재현 안 됨.** `reorderBacklog` 서비스의 집합 완전성 검증(§3.4)이 먼저 걸려 항상 `VALIDATION_ERROR`로 막힌다(구조적으로 raw SQL 도달 불가). 다만 **MCP 툴 zod 스키마가 `shared/schema.ts`를 재사용하지 않는다**는 관찰 자체는 사실 — 다른 필드(날짜 포맷 등)에서 헐거울 여지는 남아있음(미검증) |
| **C-1** | 처리일(closedOn)을 한 번 세팅하면 지울 방법이 없다 | 실 요청 3단계(세팅→null 시도→생략 시도) 재현 | **확인됨(Critical).** `closedOn:null` PATCH는 zod가 400 거부(`.optional()`뿐 `.nullable()` 없음). ItemDialog가 실제로 보내는 방식(필드 생략)은 서버가 "변경 없음"으로 해석해 **조용히 무시** — 에러도 없이 그냥 안 지워짐 |

**결론**: gap-detector가 제기한 5건 중 **2건은 git 대조로 오탐 확정(I-1, I-2), 1건은 부분 오탐(I-4,
크래시는 재현 안 되지만 관찰은 유효), 2건은 실증 확인(I-3, C-1)**. module-1의 "기존 API 응답
byte-동일" 완료 조건은 오탐 판정 후에도 **유지된다** — 실제로는 gap-detector 우려보다 더 깨끗하다.

---

## 3. 보안 이슈

| 심각도 | 파일 | 위치 | 내용 | 권장 조치 |
|:---:|------|------|------|-----------|
| 🟡 Warning | `server/mcp/index.ts` | Origin 거부 | 403인데 code가 `VALIDATION_ERROR`(표상 400) — §6.1 표 밖 조합(I-3) | 전용 코드(예: `FORBIDDEN`)를 표에 추가하거나 기존 코드로 재매핑 |
| 🟢 Info | `server/middleware/auth.ts` | D-18 쿼리 토큰 | PAT 노출면이 서버 접근 로그·브라우저 히스토리로 확대(RK-02) | 기존 완화책(해시 저장·즉시 폐기·`last_used_at`)으로 감내하기로 형이 결정. Vercel 로그에 PAT 쿼리스트링이 남는지는 실배포 후 확인 필요 |
| 🟢 Info | — | — | PAT/JWT 인가 스코프(`scoped.ts`)는 백로그·토큰에도 동일하게 적용됨 확인(L1 #2 — PAT로 조회해도 ownerId 스코프 정상) | - |

---

## 4. 테스트 커버리지

| 영역 | 현재 | 비고 |
|------|------|------|
| L0(`shared/transition.ts`) | T1~T8 + isClosed 케이스 | ✅ Design §3.3 요구 충족 |
| L0(기존 3개 스위트) | `path.test.ts`·`schema.test.ts`·`buildDocTree.test.ts`·`extractLinks.test.ts` | ✅ 1차 사이클분 유지 |
| L1(API) | 이번 사이클 신규 curl 없음, 본 분석에서 스크립트로 13개 전수 실행(§2.5) | 스크립트는 실행 후 삭제(임시 검증용, RULE.md상 정식 테스트 파일 아님) |
| L2/L3 | 미실행 | 브라우저·실배포 필요, 형 몫 |

전체 Vitest 35개 통과. 백로그 관련 정식 테스트 파일은 `shared/transition.test.ts` 1개 —
서비스 계층(backlog.ts 등)에 대한 유닛 테스트는 없고 이번 분석의 실 DB 통합 검증으로 대체함.

---

## 5. Clean Architecture 준수 (옵션 B)

| 규칙 | 확인 |
|------|:---:|
| 1. 도메인 로직은 `server/services/*`에만 | ✅ |
| 2. `routes/*`·`mcp/tools.ts`는 Drizzle import 금지 | ✅ 위반 0건(grep 전수) |
| 3. 서비스는 HTTP 모름, `ServiceError`만 throw | ✅ |
| 4. `shared/transition.ts` import 0(순수) | ✅ |
| 5. 기존 규칙(`api/` export만, `src/lib/api.ts` 경유, `scoped.ts` 인가) 유지 | ✅ |

**5/5 준수.**

---

## 6. 권장 조치

### 6.1 Critical (1)

| 우선순위 | 항목 | 파일 |
|:---:|------|------|
| 🔴 1 | `closedOn`을 지울 수 있는 명시적 방법 추가 — `updateBacklogItemSchema`에 `closedOn: z.union([dateStringSchema, z.null()]).optional()` 같은 nullable 허용 + `db.updateBacklogItemRow`가 `null`을 실제 컬럼 NULL로 반영하도록 | `shared/schema.ts`, `server/services/backlog.ts`, `src/features/backlog/components/ItemDialog.tsx` |

### 6.2 Important (1)

| 우선순위 | 항목 | 파일 |
|:---:|------|------|
| 🟡 1 | Origin 거부 응답 코드를 §6.1 표와 일치시키기(신규 코드 추가 또는 재매핑) | `server/mcp/index.ts`, `server/lib/errors.ts` |

### 6.3 Minor (4, 백로그)

| # | 항목 |
|---|------|
| M-1 | FR-21 401 핸들러 위치를 Design §6.3(QueryClient onError)에서 실제 구현(`lib/api.ts` 전역 fetch 훅)로 문서 갱신 — **사유가 코드 주석에 이미 있음**(`api.ts:6-9`), 문서만 못 따라감 |
| M-2 | 종료 상태 전환 시 처리일 "제안"을 실제 제안(입력 필드 채움, 저장은 별도 확정)으로 바꿀지, 지금처럼 즉시 확정으로 갈지 재확인 |
| M-3 | PAT 진입을 "사용자 메뉴 하위"로 옮길지, 지금의 상시 링크로 유지할지 |
| M-4 | MCP 툴 zod 스키마가 `shared/schema.ts`를 재사용하지 않음 — 날짜 포맷 등 REST보다 느슨한 지점이 남아있을 수 있음(구체 사례 미확인) |

---

## 7. Checkpoint 5 — 형 결정

**형 결정: "그대로 진행"** — Critical(C-1 처리일 삭제 불가)·Important(I-3 Origin 에러 코드
불일치) 둘 다 지금 고치지 않고 백로그로 남긴다. "버그는 다른 사이클로 검증하면서 잡을거야"
원칙에 따라 실사용 중 재확인되면 그때 처리.

**(사후 2026-08-08 확인)**: 그 원칙대로 실사용(형이 백로그를 직접 쓰기 시작) 중 재확인됐고,
refine-mcp-hardening 마감 사이클(module-1)에서 둘 다 해소됐다 — C-1은 `.nullable()` + UI ✕
버튼, I-3은 `FORBIDDEN` 코드 신설 + `ServiceError` 경유. M-4(MCP 스키마 미재사용)도 같은
사이클(module-2)에서 갭 16곳 전수 폐쇄로 해소됐다.

C7·C10은 애초에 배포·형의 실사용이 있어야 하는 항목이라 이 세션 완결 여부와 무관하게
"미충족, 배포 후 형이 직접"으로 report에 기록한다.

---

## Version History

| 버전 | 날짜 | 변경 내용 | 작성자 |
|------|------|-----------|--------|
| 0.1 | 2026-08-07 | 최초 분석. gap-detector 정적 3축(93.6%) + 본인 Runtime L1 13/13 재실증 + gap-detector 의심 5건 중 4건 git/실요청으로 재검증(2건 오탐 확정). Overall 96% | Claude |
| 0.2 | 2026-08-08 | **(사후 확인, refine-mcp-hardening 사이클)** C7·C10 웹 커넥터 완주(F27, S6) 반영. Checkpoint 5에서 이월했던 Critical(C-1)·Important(I-3)·M-4가 module-1·2에서 해소됨을 §7에 기록 | Claude |
