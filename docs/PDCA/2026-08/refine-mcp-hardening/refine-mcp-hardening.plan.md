---
template: plan
version: 1.3
---

# refine-mcp-hardening 계획 문서

> **한 줄 요약**: backlog-with-mcp(Match 96%)가 Check에서 남긴 균열 6건을 **실측으로 닫는 마감
> 사이클**. 새 기능 0건 — 처리일을 지울 수 있게 하고, 에러 코드 표의 유일한 예외를 없애고,
> MCP 입력 검증을 REST와 같은 강도로 맞추고, 문서가 실구현을 따라잡게 한다.
>
> **프로젝트**: PDCA-workspace
> **작성자**: cogmo
> **작성일**: 2026-08-08
> **상태**: **Approved** (v0.2 — 형 승인 4건 반영, 2026-08-08)
> **PDCA Cycle**: refine-mcp-hardening (문서화 기준 3번째 사이클)

---

## Executive Summary

| 관점 | 내용 |
|------|------|
| **Problem** | 2차 사이클은 Match 96%로 끝났지만, Checkpoint 5에서 형이 "버그는 다른 사이클에서 실사용하며 검증"을 택해 **Critical 1건·Important 1건·Minor 4건을 열어둔 채 닫았다.** 그중 처리일(closedOn) 삭제 불가는 형이 백로그를 실제로 쓰는 지금(C10 완주) 매일 밟는 자리다. 게다가 "에러 코드 표가 유일한 원천"(FR-20)·"MCP와 REST가 같은 서비스를 부른다"(옵션 B)는 2차의 두 축에 각각 정확히 한 군데씩 구멍이 남아 있어, 원칙이 "거의 지켜짐" 상태로 굳어가고 있다. |
| **Solution** | 스코프를 **이월 6건으로 고정**하고 각각을 실증으로 닫는다. ①처리일 nullable 3계층(zod·쓰기·UI) ②Origin 거부에 `FORBIDDEN` 신설해 표의 예외 제거 ③`?token=` 실배포 로그 잔존 확인 ④MCP 툴 zod를 `shared/schema.ts` 재사용으로 전환(불가 필드는 사유 주석) ⑤design 문서의 FR-21 위치 정정 + 배포 체크리스트 문서화 ⑥C7·C10이 **claude.ai 웹 커넥터로** 완주된 사실 기록. |
| **Function/UX Effect** | 형이 date input을 비워 저장하면 처리일이 실제로 지워진다(지금은 에러도 없이 무시된다). MCP로 잘못된 날짜 포맷을 보내면 500이 아니라 명시적 거부가 온다. 그리고 3차 사이클 착수 시점에 문서가 코드와 어긋난 자리가 6군데에서 0군데로 줄어든다. |
| **Core Value** | **"거의 지켜지는 원칙"은 원칙이 아니다.** 2차 사이클의 회고 Try 3건(날짜 필드 nullable 명시 / MCP 스키마 shared 재사용 / 클라이언트 종류를 스코프 질문에)을 말이 아니라 **규약과 코드**로 승격시켜, 다음 사이클이 같은 자리에서 다시 새지 않게 만든다. |

---

## Context Anchor

> Executive Summary에서 생성. Design/Do 문서로 전파되어 세션 간 컨텍스트 연속성 유지.

| Key | Value |
|-----|-------|
| **WHY** | 2차 사이클이 실사용 검증을 조건으로 열어둔 이월 6건이 지금 실사용에서 실제로 걸린다. 문서·코드·표가 각각 한 군데씩 어긋난 상태를 다음 사이클로 또 넘기면 원칙이 관행으로 무너진다. |
| **WHO** | 형(cogmo) — 브라우저 실사용자이자 승인자 / **클로드 2종**: Claude Code CLI(코드 작업)와 claude.ai 웹 MCP 커넥터(백로그·문서 운용). C7·C10을 실제로 완주한 쪽은 **웹 커넥터**다(F27). |
| **RISK** | zod에 null을 허용하면 `UpdateBacklogItemInput` 타입이 바뀌어 소비처 3곳(REST·MCP·UI)으로 번진다(RK-10) / MCP 스키마를 조이면 이미 웹 커넥터로 돌아가는 실사용 호출이 거부될 수 있다(RK-14) / 종료된 사이클 문서를 사후 개정하는 행위 자체가 "그 시점의 판단" 기록을 오염시킬 수 있다(RK-15) / 3차 기능(cycles)이 문서 없이 들어가 design 문서가 넓게 어긋나 있다 — 이번엔 한 곳만 고친다(RK-16). |
| **SUCCESS** | C11~C16 — 스코프 6건과 1:1. 전부 "고쳤다"가 아니라 **"실측/실증으로 닫혔다"**가 판정 기준. 핵심은 **C11 — 처리일 세팅→null→재조회 3단계 실증**. |
| **SCOPE** | 이월 6건 고정. 새 기능·리팩터·번들 최적화·OAuth·cycles 기능 문서화는 전부 스코프 외(§2.2에 재이월 명시). |

---

## 1. Overview

### 1.1 목적

1. **이월 6건을 실증으로 닫는다** — "코드를 고쳤다"가 아니라 "고친 결과를 눈으로 확인했다"까지가
   완료 조건이다. 특히 처리일은 세팅→삭제→재조회 3단계를 API와 브라우저 양쪽에서 본다.
2. **2차 회고 Try를 규약으로 승격** — 날짜·선택 필드의 nullable 명시(§8.2), MCP 입력 스키마의
   shared 재사용(§8.2). 회고에 적어두면 다음 사이클이 또 잊는다.
3. **문서-코드 어긋남을 0으로 정리하고 다음 사이클을 깨끗한 바닥에서 시작한다** — 단, 어긋남
   전체가 아니라 **이번 스코프가 지목한 곳만**(RK-16).

### 1.2 배경

2차 사이클(backlog-with-mcp, Match 96%) Checkpoint 5에서 형의 결정은 "그대로 진행"이었다 —
Critical(처리일 삭제 불가)·Important(Origin 에러 코드)를 지금 고치지 않고 백로그로 넘긴다,
"버그는 다른 사이클로 검증하면서 잡을거야"(analysis §7).

그 이후 실제로 일어난 일이 이 사이클의 근거다:

- 형이 **claude.ai 웹 MCP 커넥터로 C10(이월 16건 입력)과 C7(문서 훑기→백로그 갱신→착수)을
  완주**했다. 2차 report는 이 둘을 "❌ Not Met — 배포 후 형이 직접"으로 닫았는데, 그 뒤에
  달성됐고 문서에 반영이 안 됐다(스코프 6).
- 백로그를 실제로 쓰기 시작했다는 건 **처리일 삭제 불가가 매일 밟히는 버그가 됐다**는 뜻이다.
  종료 상태로 바꿀 때 오늘 날짜가 자동으로 들어가는데(ItemDialog), 잘못 들어간 값을 되돌릴
  방법이 UI에도 API에도 없다(F14).
- 사용 주체가 CLI 하나가 아니라 **CLI + 웹 커넥터 2종**으로 확정됐다. 2차 회고 §6.2가 지적한
  "클라이언트 종류를 스코프 질문에 안 넣었다"가 현실이 된 것이고, MCP 입력 검증이 REST보다
  느슨한 상태(스코프 4)가 이제는 실사용 표면이다.

### 1.3 확정 사실 (실측)

Plan 작성 시점에 현재 저장소(HEAD `9b5c37e`)를 직접 읽어 확정한 사실이다. Design은 이 표를
전제로 한다. **추정은 표에 넣지 않았다** — 확인 못 한 것은 §6.2 검증 항목으로 내렸다.

> **식별자 규약**: 이 문서는 2차 사이클 ID를 그대로 잇는다 — 사실 `F11~`, 요구사항 `FR-22~`,
> 성공기준 `C11~`, 리스크 `RK-10~`, 결정 `D-19~`. 2차의 F1~F10 / FR-01~21 / C1~C10 /
> RK-01~09 / D-01~18과 번호가 겹치지 않으므로, 이 문서에서 `D-18`·`C7`이라고 쓰면 언제나
> 2차 사이클의 그것이다.

| # | 확인 항목 | 결과 | 근거 |
|---|-----------|------|------|
| **F11** | **이월 6건의 대상 파일이 analysis 작성 이후 무변경** | `server/mcp/{index,tools}.ts`·`server/services/backlog.ts`·`server/lib/errors.ts`·`server/routes/backlog.ts`·`src/features/backlog/components/ItemDialog.tsx`·`src/lib/api.ts` **7개 파일 전부 무변경**. `shared/schema.ts`는 cycles 기능으로 35줄 추가됐지만 **백로그 구간 변경 0건** | `git diff --numstat 301abc0..HEAD` 파일별 실행 |
| **F12** | `closedOn` zod 현행 정의 | `backlogItemFields.closedOn = dateStringSchema.optional()`, `updateBacklogItemSchema = backlogItemFields.partial()`. **`.nullable()` 없음** → `null` 전송 시 400. `dateStringSchema`(YYYY-MM-DD regex)는 **모듈 로컬로 export 안 됨** | `shared/schema.ts:66,76-86` |
| **F13** | **null → 컬럼 NULL 반영은 이미 동작한다** | `updateBacklogItemRow`가 `.set({ ...input, updatedAt })`로 input을 **그대로 스프레드**하고, `closedOn: date('closed_on')`은 notNull이 아니다. zod가 null을 통과시키면 Drizzle이 NULL로 UPDATE한다. **쓰기 지점은 `server/services/backlog.ts`가 아니라 `server/db/scoped.ts`** — 서비스는 input을 가공 없이 넘길 뿐(`backlog.ts:45`) | `server/db/scoped.ts:395-408`, `server/db/schema.ts:115` |
| **F14** | UI가 실제로 보내는 값 | `ItemDialog.tsx:83` `closedOn: closedOn \|\| undefined`, `:74`(상태 배지 전환) 동일 패턴. date input을 비우면 `''`→`undefined`→**JSON 직렬화에서 키가 사라짐**→서버는 "변경 없음"으로 해석. 이 한 줄이 analysis C-1의 "조용히 무시" 경로다 | `src/features/backlog/components/ItemDialog.tsx:74,83` |
| **F15** | 에러 코드 표 현행 전체 | 6개 — `VALIDATION_ERROR` 400 / `UNAUTHORIZED` 401 / `TRANSITION_DENIED` 403 / `NOT_FOUND` 404 / `CONFLICT` 409 / `INTERNAL` 500. **403 슬롯은 이미 `TRANSITION_DENIED`가 점유**하고, 그 의미는 표에 "canTransition false — MCP가 doing/done 시도"로 못박혀 있다 | `server/lib/errors.ts:2-17`, design §6.1 |
| **F16** | Origin 거부가 표를 안 지나간다 | `mcp/index.ts:11-14`가 `c.json({error:{code:'VALIDATION_ERROR',...}}, 403)`을 **리터럴로 직접 반환** — `ServiceError`를 경유하지 않으므로 `errors.ts` 표를 고쳐도 이 줄을 같이 고치지 않으면 다시 어긋난다 | `server/mcp/index.ts:11-14` |
| **F17** | 새 코드 추가의 프론트 회귀 표면 = 0 | `src/` 전체에서 에러 코드 문자열 참조는 `ImportDialog.tsx:184`의 `CONFLICT` **1곳뿐**. 또 `app.onError`의 status 캐스트가 `400\|401\|403\|404\|409\|500`이라 **403 코드 추가는 캐스트도 안 건드린다** | `grep -rn` src 전수, `server/app.ts` onError |
| **F18** | **MCP 툴 스키마 ↔ `shared/schema.ts` 대조 (전수)** | 아래 §1.3.1 표 | `server/mcp/tools.ts` 전수 |
| **F19** | 재사용에 필요한 준비 | `dateStringSchema` 미export(F12) → export 추가 필요. uuid는 `reorderBacklogSchema.ids = z.array(z.uuid()).min(1).max(1000)`으로 이미 존재하지만 MCP는 `z.array(z.string())`을 따로 쓴다 | `shared/schema.ts:66,88-91` vs `tools.ts:180` |
| **F20** | **`?token=`은 MCP 전용이 아니다** | `authMiddleware`가 헤더 부재 시 `?token=`을 읽고(PAT 접두어만 허용), 이 미들웨어는 `/api/health`를 뺀 **모든 API 경로**(`/me`,`/workspaces/*`,`/projects/*`,`/documents/*`,`/cycles/*`,`/backlog/*`,`/tokens/*`,`/mcp`)에 걸려 있다 → 로그 잔존 확인 범위가 `/api/mcp` 한 경로가 아니다 | `server/middleware/auth.ts:44-47`, `server/app.ts` |
| **F21** | MCP SDK가 스키마 객체 전체를 받는다 | `registerTool<..., InputArgs extends undefined \| ZodRawShapeCompat \| AnySchema>`, `AnySchema = z3.ZodTypeAny \| z4.$ZodType` → **raw shape뿐 아니라 ZodObject 전체 전달이 타입상 허용**. 단 refine이 붙은 스키마의 JSON Schema 변환 동작은 **미검증**(§6.2) | `node_modules/@modelcontextprotocol/sdk/.../server/mcp.d.ts:150`, `server/zod-compat.d.ts:3` |
| **F22** | 백로그 테스트 공백 | 정식 테스트 6파일(`transition` 10 / `path` 16 / `schema` 3 / buildDocTree / versionSort / extractLinks). **`shared/schema.test.ts`에 백로그 스키마 케이스 0건**, 백로그 서비스 유닛 테스트 없음 | `find`+`grep -c it(` |
| **F23** | 링크 검증 스크립트가 없다 | `scripts/`에 `import-docs.mjs` 하나뿐. RULE.md 종료 절차 1번(링크 전수 검증 스크립트)은 2차 사이클에서도 스크립트 없이 처리됐다 | `ls scripts/` |
| **F24** | 배포 체크리스트 문서가 없다 | 저장소 전체에 배포 절차 문서 없음. dev/main 마이그레이션 분리 지식은 2차 report §5.2·§7.2 서술로만 존재 | `docs/` 트리 전수 |
| **F25** | design 문서의 FR-21 서술 | design §6.3이 "QueryClient 전역 `onError`: 401 → 토큰 캐시 클리어 + 로그인 화면"으로 남아 있다. 실구현은 `src/lib/api.ts`의 `authedFetch`이고 **선택 사유가 코드 주석 `api.ts:6-9`에 이미 적혀 있다**("개별 api.ts가 401을 삼키는 곳이 있어 onError로는 절반만 잡힌다") | design §6.3 vs `src/lib/api.ts:6-19` |
| **F26** | 문서 없이 들어간 3차 기능 | `301abc0`(2차 docs 커밋) 이후 `c48d434`·`f569104`·`a78f188`·`9b5c37e` — 로컬 API 개발서버, 테마, **버전·릴리즈노트(cycles) 기능**, 화면·사이드바 개선이 **PDCA 문서 없이** 들어갔다(`server/routes/cycles.ts`·`services/cycles.ts`·schema 3테이블→4테이블) | `git log --oneline`, `git diff --stat` |
| **F27** | C7·C10 달성 주체 | 형 확인 — **claude.ai 웹 MCP 커넥터**로 C10(이월 16건 입력)·C7(문서 훑기→백로그 갱신→착수) 완주. Claude Code CLI의 `claude mcp add --transport http` 실연결은 **여전히 미실행** | 형 진술(2026-08-08) |

**F11이 이번 사이클의 전제다.** analysis(2026-08-07)의 발견 6건이 그 뒤 코드 변경으로 무의미해졌을
가능성을 먼저 지웠다 — 7개 파일 전부 무변경이라 **재실증 없이 그대로 착수할 수 있다.**

**F13이 analysis §6.1의 파일 목록을 한 칸 정정한다.** analysis는 수정 대상으로
`shared/schema.ts` + `server/services/backlog.ts` + `ItemDialog.tsx`를 지목했지만, 실측하면
services는 input을 가공하지 않고(`:45`) 실제 쓰기는 `db/scoped.ts`의 스프레드다. 그리고 그
스프레드는 **null을 이미 올바르게 처리한다** — 즉 **서버 수정은 zod 한 줄뿐이고, services는
무변경**이다. 남은 절반은 순수하게 UI(F14)다.

#### 1.3.1 MCP 툴 스키마 ↔ `shared/schema.ts` 대조표 (F18, 전수)

| 툴 | 필드 | MCP 현행(`tools.ts`) | `shared/schema.ts` 대응 | 판정 |
|---|---|---|---|:---:|
| `project_list` | — | inputSchema 없음 | — | n/a |
| `document_list` | `projectId` | `z.string()` | 없음(REST는 경로 파라미터) | 갭(uuid 아님) |
| `document_read` | `projectId` | `z.string()` | 없음 | 갭 |
| | `path` | `z.string()` | `documentFields.path` = `min(1).max(1000)` | 갭(길이 없음) |
| `document_write` | `projectId` | `z.string()` | 없음 | 갭 |
| | `path` | `z.string()` | `min(1).max(1000)` | 갭 |
| | `title` | `z.string()` | `min(1).max(300)` | 갭 |
| | `kind` | `documentKindSchema` | 동일 | **재사용 ✅** |
| | `pdcaStage` | `pdcaStageSchema.optional()` | 동일 | **재사용 ✅** |
| | `content` | `z.string()` | `min(1)` | 갭(빈 문서 통과) |
| | (교차규칙) | 없음 | `createDocumentSchema.refine` — kind='general'이면 pdcaStage 금지 | **갭(규칙 자체 부재)** |
| `backlog_list` | `projectId` | `z.string()` | 없음 | 갭 |
| | `status` | `z.array(backlogStatusSchema).optional()` | 동일 | **재사용 ✅** |
| `backlog_create` | `projectId` | `z.string()` | 없음 | 갭 |
| | `title` | `z.string()` | `min(1).max(300)` | 갭 |
| | `priority` | `backlogPrioritySchema` | 동일 | **재사용 ✅** |
| | `detail` | `z.string().optional()` | `max(20000).optional()` | 갭 |
| | **`openedOn`** | **`z.string()`** | **`dateStringSchema`(YYYY-MM-DD regex)** | **갭 — 2차 회고가 지목한 지점** |
| `backlog_update` | `id` | `z.string()` | 없음(REST는 경로 파라미터) | 갭 |
| | `title`/`detail` | `z.string().optional()` | 위와 동일 | 갭 |
| | **`openedOn`/`closedOn`** | **`z.string().optional()`** | **`dateStringSchema.optional()`** | **갭** |
| | `status` | `z.enum(['resolved','dropped']).optional()` | `backlogStatusSchema`(5값) | **의도적 협소화 — 사유 주석 있음(`tools.ts:163`), 유지** |
| `backlog_reorder` | `projectId` | `z.string()` | 없음 | 갭 |
| | `ids` | `z.array(z.string())` | `reorderBacklogSchema.ids` = `z.array(z.uuid()).min(1).max(1000)` | 갭(analysis I-4 관찰) |

**정리**: 재사용 4곳(enum 계열) / 의도적 협소화 1곳(사유 주석 있음) / **갭 16곳**. 갭의 성격은 셋이다 —
①날짜 포맷 검증 부재(`openedOn`·`closedOn`) ②길이 제약 부재(`title`·`detail`·`path`·`content`) ③id
형식 검증 부재(`projectId`·`id`·`ids`). analysis M-4가 "구체 사례 미확인"으로 남긴 자리에 **①이
구체 사례로 확정됐다** — MCP로 `openedOn: 'aaa'`를 보내면 **zod를 통과한다**(확정). 통과 이후
어디서 어떻게 실패하는지(400/500)는 미검증이며 §6.2에서 실측한다.

### 1.4 Checkpoint 1·2 결정 사항

이 사이클은 형의 지시서(`docs/PDCA/2026-08/new.tmp`)로 스코프가 이미 확정돼 있어 신규 질문이
없다. 지시서가 **Plan에서 결정하라고 명시한 1건**만 아래에 답한다.

| # | 질문 | 결정 | 근거 |
|---|------|------|------|
| Q11 | Origin 거부(403) 에러 코드를 어떻게 정합시킬까 — 표에 `FORBIDDEN` 추가 vs 기존 코드로 재매핑 | **`FORBIDDEN`(403) 신설 + `mcp/index.ts`는 리터럴 대신 `ServiceError` throw** (→ D-23) | 재매핑 두 후보가 다 나쁘다. `TRANSITION_DENIED`(403) 재사용은 표의 "원인" 칸(canTransition false)을 거짓으로 만든다(F15). `VALIDATION_ERROR`(400)로 맞추려면 HTTP를 400으로 낮춰야 하는데 Origin 거부는 403이 맞고 이미 403을 주고 있어 회귀다. 신설 비용은 F17로 사실상 0(프론트 참조 0곳, status 캐스트 무변경) |

#### 1.4.1 형 승인 (2026-08-08)

Plan v0.1의 §10 확인 포인트 4건 전부 **동의**. 이 사이클의 판단 기준선으로 확정한다.

| # | 항목 | 형의 답 | 형이 확인한 근거 |
|---|------|---------|-----------------|
| A1 | **D-23** `FORBIDDEN` 신설 | **동의** | 재매핑 두 후보 기각 논리(TRANSITION_DENIED 의미 오염 / 400 강등은 회귀)가 정확하고, F17로 비용 0이 검증됨 |
| A2 | **D-24** `docs/deploy/CHECKLIST.md` 신규 위치 | **동의** | 종료된 사이클 문서에 넣으면 다음 배포 때 못 찾는다는 근거 타당 |
| A3 | **FR-38** `_INDEX.md` 행 갱신을 S6에 포함 | **동의** | D-25(원문 유지 + 사후 표기) 방식이면 기록 오염 걱정 없음 |
| A4 | **D-22** 재오픈 시 처리일 자동 삭제 안 함 | **동의** | 자동 규칙 추가는 M-2의 반대편 문제 — 스코프 고정이 맞다 |

**A3이 D-25의 적용 범위를 확정한다**: 사후 개정 대상 문서가 2차 report·analysis 2종에서
`_INDEX.md`까지 3종으로 굳었고, 셋 다 같은 표기 규칙(원문 유지 + "(사후 확인: …)" +
Version History 행)을 쓴다.

### 1.5 관련 문서

- 직전 사이클: [backlog-with-mcp.plan.md](../backlog-with-mcp/backlog-with-mcp.plan.md) ·
  [design](../backlog-with-mcp/backlog-with-mcp.design.md) ·
  [analysis](../backlog-with-mcp/backlog-with-mcp.analysis.md) ·
  [report](../backlog-with-mcp/backlog-with-mcp.report.md)
- 이월 근거: analysis §6.1(C-1)·§6.2(I-3·I-4·M-1·M-4)·§3(Info) / report §4.1·§6.3·§7.2
- 1차 사이클: [PDCA-workspace.report.md](../PDCA-workspace/PDCA-workspace.report.md)
- 문서 규칙: [RULE.md](../../../RULE.md) / 프로젝트 규칙: [CLAUDE.md](../../../../CLAUDE.md)

---

## 2. Scope

### 2.1 In Scope — 이월 6건 고정

- [ ] **S1 [Critical] 처리일(`closedOn`) 삭제 가능하게** — zod nullable + UI 지우기 동선
      (analysis §6.1 C-1). 서버 쓰기 계층은 F13으로 **무변경 확인됨**
- [ ] **S2 [Important] MCP Origin 거부 에러 코드 정합** — `FORBIDDEN` 신설(D-23), analysis §6.2 I-3
- [ ] **S3 [보안 확인] `?token=pdcaw_`가 Vercel 액세스 로그에 남는지 실배포 확인** — D-18 후속
      (analysis §3 Info). 확인 범위는 `/api/mcp`가 아니라 API 전 경로(F20)
- [ ] **S4 [정합] MCP 툴 zod를 `shared/schema.ts` 재사용으로 전환** — §1.3.1 갭 16곳,
      재사용 불가 필드는 사유 주석(analysis §6.2 M-4)
- [ ] **S5 [문서만] design 문서 §6.3 FR-21 위치 정정(M-1) + dev/main 마이그레이션 배포
      체크리스트 문서화**(report §7.2)
- [ ] **S6 [기록만] C7·C10 완주 반영** — 웹 커넥터로 달성한 사실 명시(F27), 후속 기록 방침 D-25

### 2.2 Out of Scope — 재이월 기록

> 스코프 6건 외는 전부 여기에 명시적으로 재이월한다. **재이월의 1차 원천은 이제 문서 표가
> 아니라 백로그 보드다**(C10 완주 이후) — 아래 표는 "이번 사이클이 안 한 것"의 기록이고,
> 실제 순서·착수는 형이 보드에서 정한다(D-25).

| 항목 | 출처 | 왜 이번에 안 하는가 |
|------|------|--------------------|
| 종료 전환 시 처리일 "제안"을 실제 제안(입력만 채움)으로 바꿀지 | 2차 analysis M-2 | S1이 "지울 수 있게"만 다룬다. 제안 UX 재설계는 별 건 — S1 완료 후 형이 실사용으로 판단 |
| PAT 진입을 사용자 메뉴 하위로 이동 | 2차 analysis M-3 | 순수 UI 배치, 기능 영향 0 |
| MCP OAuth 2.1 정식 지원 | 2차 report §4.1 | D-18(쿼리 토큰)로 동작 중. **단 S3 결과가 "로그에 남는다"면 승격 근거가 생긴다**(RK-13·§5) |
| `javascript:` 링크 차단 | 1차 이월 Important | 1차→2차→3차 3연속 재이월. 보안 항목이라 별 사이클에서 정면으로 다룰 것 |
| 409 충돌 시 선택지 UI(덮어쓰기/경로수정) | 1차 이월 Important | 동일 |
| 1차 Minor 12건 | 1차 report §4.1 | 동일 |
| **Claude Code CLI `claude mcp add --transport http` 실연결(2차 C6)** | 2차 report §1.4 | S6은 **기록만** 한다. CLI 실연결 검증은 실행 항목이라 스코프 외 — C6은 "웹 기준 충족·CLI 미검증"으로 남는다 |
| **cycles(버전·릴리즈노트) 기능의 PDCA 문서화** | F26 | 문서 없이 들어간 기능 1건. 사후 Plan/Design을 쓰는 건 이 마감 사이클의 6배 크기다 — 별 사이클 필요(report에 기록) |
| design 문서 전면 재동기화 | F26·RK-16 | S5는 §6.3 **한 곳만** 고친다. cycles로 인한 어긋남까지 손대면 스코프가 무한히 번진다 |
| 백로그 서비스 유닛 테스트 확충(F22) | — | S1이 요구하는 스키마 케이스만 추가(§4.1). 서비스 계층 전면 테스트는 별 건 |
| 링크 검증 스크립트 작성(F23) | RULE.md 종료 절차 | 종료 절차 이행은 하되 스크립트 자산화는 스코프 외(1회성 명령으로 대체) |
| 번들 최적화·코드 분할 | 2차 F9·RK-05 | 3연속 이월. 이번에도 스코프 외 |

---

## 3. Requirements

### 3.1 기능 요구사항

| ID | 요구사항 | 스코프 | 우선순위 | 상태 |
|----|----------|:---:|:--------:|------|
| FR-22 | `updateBacklogItemSchema`가 `closedOn: null`을 허용한다 (`dateStringSchema` nullable 조합, 형태는 D-20) | S1 | High | Pending |
| FR-23 | `ItemDialog`에서 처리일 date input을 비우고 저장하면 `null`이 전송된다 — `\|\| undefined`로 키가 사라지지 않는다(F14) | S1 | High | Pending |
| FR-24 | 처리일 지우기 동선이 화면에 보인다 — 비우고 저장이 유일한 방법이면 그것으로 충분하되, 값이 있을 때 [지우기]가 필요한지 Design에서 확정 | S1 | Medium | Pending |
| FR-25 | MCP `backlog_update`의 `closedOn`은 **null 미허용을 유지**하고 그 사유를 주석으로 남긴다(D-21) | S1 | High | Pending |
| FR-26 | `server/lib/errors.ts`에 `FORBIDDEN`(403) 추가 | S2 | High | Pending |
| FR-27 | `mcp/index.ts` Origin 거부가 리터럴 응답이 아니라 `ServiceError('FORBIDDEN', ...)` throw로 `onError`를 지난다(F16) | S2 | High | Pending |
| FR-28 | design §6.1 에러 코드 표에 403 `FORBIDDEN` 행 추가 — 표와 코드가 같은 커밋에서 맞는다 | S2 | High | Pending |
| FR-29 | 실배포 요청 1건을 `?token=`으로 보낸 뒤 Vercel 로그에서 쿼리스트링 잔존 여부를 확인하고 **결론을 문서에 확정 기록**(남음/안 남음) | S3 | High | Pending |
| FR-30 | 잔존 시 완화 결정 — 로그 마스킹 가능 여부, OAuth 2.1 승격 근거, 또는 감내 재확인 중 하나를 기록(§5 RK-13) | S3 | High | Pending |
| FR-31 | `shared/schema.ts`가 재사용 대상 필드 스키마를 export한다(최소 `dateStringSchema`, id용 uuid) | S4 | High | Pending |
| FR-32 | MCP 툴 8개의 §1.3.1 갭 16곳이 전부 (a)shared 재사용 또는 (b)사유 주석 중 하나로 처리된다 | S4 | High | Pending |
| FR-33 | MCP로 잘못된 날짜 포맷 전송 시 명시적 거부(isError + 기대 포맷 안내) — 500이 아니다 | S4 | High | Pending |
| FR-34 | design §6.3의 FR-21 서술을 실구현(`src/lib/api.ts` `authedFetch`)으로 정정 + Version History 행 추가(F25) | S5 | High | Pending |
| FR-35 | dev/main 마이그레이션 배포 체크리스트 문서 작성 — 위치 D-24, "적용 안 하면 무엇이 깨지는지"(report §7.2) 포함 | S5 | High | Pending |
| FR-36 | 2차 report·analysis의 C7·C10 서술을 "claude.ai 웹 커넥터로 완주"로 정정 + Version History 행(D-25) | S6 | High | Pending |
| FR-37 | C6은 "웹 기준 충족 / Claude Code CLI 실연결 미검증"으로 구분 기록 | S6 | Medium | Pending |
| FR-38 | `docs/PDCA/_INDEX.md`의 backlog-with-mcp 행 중 "2/10 미충족(C7·C10)" 서술 갱신 — **형 승인 A3으로 S6 포함 확정**, 표기는 D-25 | S6 | **High** | Pending |

### 3.2 비기능 요구사항

| 범주 | 기준 | 측정 방법 |
|------|------|-----------|
| 무회귀 | 기존 REST·MCP 응답이 S1·S2·S4 변경 후에도 동일 — 특히 `closedOn` **미포함** PATCH가 여전히 "변경 없음"으로 동작 | 실 DB(`app.request()` 하네스) 재실행 |
| 무회귀 | 2차 design §8.2 L1 시나리오 13개 전부 통과 유지 | 하네스 재실행 (S2·S4가 #6·#9·#12·#13을 직접 건드린다) |
| 무회귀 | `tsc -b` + `oxlint` + `vitest run` 전부 통과 — 타입 변경(RK-10) 파급을 컴파일러로 전수 확인 | 명령 실행 |
| 정합성 | `errors.ts` 코드 집합 == design §6.1 표 == 실제 응답 코드, 예외 0건 | grep 대조 + 실 요청 |
| 보안 | `?token=` 노출면 결론이 "미확인"으로 남지 않는다 | FR-29 결과 기록 |
| 문서 | 저장소 마크다운 링크 신규 깨짐 0건 (RULE.md 종료 절차 1) | 링크 추출 후 파일 존재 확인 |

---

## 4. Success Criteria

> **스코프 6건과 1:1.** 판정 기준은 전부 "고쳤다"가 아니라 **"실측/실증으로 닫혔다"**다.

| ID | 스코프 | 기준 | 검증 방법 |
|----|:---:|------|-----------|
| **C11** | S1 | **처리일 삭제 3단계 실증** — ①`PATCH {closedOn:'2026-08-01'}` 후 재조회에 값이 있다 ②`PATCH {closedOn:null}`이 2xx ③**재조회에서 `closedOn === null`** | 실 DB 하네스 3요청 + **브라우저에서 date input 비우고 저장 → 카드에서 처리일 사라짐**(API만으론 F14를 못 닫는다) |
| **C12** | S2 | Origin 위반 요청이 **403 + `{"error":{"code":"FORBIDDEN"}}`** 이고, `errors.ts`·design §6.1 표·실응답 셋이 일치한다. 표 밖 조합 0건 | `curl -H 'Origin: https://evil.example'` 실측 + 코드 표 grep 대조 |
| **C13** | S3 | `?token=` 잔존 여부가 **"남음" 또는 "안 남음"으로 확정 기록**되고, 남으면 완화 결정까지 기록된다. "확인 필요"로 남으면 미충족 | 실배포 요청 1건(그 후 즉시 폐기할 전용 PAT) → Vercel 로그 검색 → analysis/report에 결론 1행 |
| **C14** | S4 | §1.3.1 갭 **16곳 전수**가 재사용 또는 사유 주석으로 닫힌다. 그리고 MCP `backlog_create {openedOn:'aaa'}`가 **명시적 거부**(현재는 zod 통과가 확정 사실) | 대조표 재작성(Do 후 표를 다시 채운다) + MCP 실호출 2건(정상/불량 포맷) |
| **C15** | S5 | design §6.3이 실구현과 일치하고, 배포 체크리스트 문서가 존재하며 **dev·main 두 브랜치 절차와 "미적용 시 깨지는 것"을 포함**한다 | 문서 대조 + `/api/tokens` 500 사례가 체크리스트로 예방되는지 절차 읽기 검증 |
| **C16** | S6 | 2차 report·analysis·`_INDEX.md`에서 C7·C10이 "웹 커넥터로 완주"로 정정되고, C6의 CLI 미검증이 별도로 남으며, 각 문서에 Version History 행이 추가된다 | 3문서 diff 확인 |

### 4.1 Definition of Done

- [ ] FR-22~FR-38 구현 (Medium 미달 시 사유 명시)
- [ ] C11~C16 전부 충족
- [ ] `shared/schema.test.ts`에 **백로그 스키마 케이스 추가**(F22 공백 일부 해소): `closedOn`
      null 허용 / 잘못된 날짜 포맷 거부 / `closedOn` 키 부재 시 통과 — 3케이스 최소
- [ ] 2차 design §8.2 L1 13개 하네스 재실행 통과 (§3.2 무회귀)
- [ ] `tsc -b` · `oxlint` · `vitest run` 통과
- [ ] `analysis` 문서로 Gap 분석 — **스코프 6건 각각이 닫혔는지만** 본다(전면 재분석 아님)
- [ ] `report` 문서 + `_INDEX.md` 행 추가 + 링크 전수 검증(RULE.md 종료 절차)
- [ ] `docs/PDCA/2026-08/new.tmp` 삭제 (RULE.md — 답 반영 후 .tmp 삭제)

---

## 5. Risks and Mitigation

| ID | 리스크 | 영향 | 확률 | 완화 |
|----|--------|:----:|:----:|------|
| **RK-10** | `closedOn`에 null을 허용하면 `UpdateBacklogItemInput` 타입이 `string \| null`로 바뀌어 **소비처 3곳(REST 라우트·MCP 툴·UI 훅)으로 번진다.** MCP `backlog_update`가 무심코 null을 받게 되면 D-21 결정과 어긋난다 | Medium | Medium | 타입 파급은 `tsc -b`로 전수 검출(§3.2). MCP는 **자기 스키마에서 null을 명시적으로 배제**하고 사유 주석(FR-25·D-21). S4에서 MCP가 shared를 재사용하게 되므로 "재사용하면 null도 따라 들어온다"는 함정을 Design에서 명시 처리 |
| **RK-11** | date input 비우기가 브라우저마다 다르게 동작하거나, `dirty` 판정(`ItemDialog:46` `closedOn !== (item.closedOn ?? '')`)이 `''`↔`null` 왕복에서 어긋난다 | Low | Medium | C11의 **브라우저 경로를 API 경로와 별도 필수 검증**으로 둔다. `''`↔`null` 변환을 한 함수로 좁혀 UI 전역이 같은 규칙을 쓰게 한다 |
| **RK-12** | `FORBIDDEN` 추가가 코드·design 표·이번 사이클 문서 3곳에 분산돼 또 어긋난다(F16이 정확히 그 재발) | Medium | Low | FR-26·27·28을 **한 커밋에 묶는다.** 그리고 리터럴 응답을 제거해 표를 지나는 경로 하나만 남긴다 — 구조로 재발을 막는다 |
| **RK-13** | **S3 결과가 "로그에 남는다"로 나오면 D-18(쿼리 토큰) 자체가 재검토 대상이 된다.** 노출면이 형 계정 전체 쓰기 권한(2차 RK-02)이고, `?token=`은 MCP뿐 아니라 API 전 경로에서 통한다(F20) | High | Medium | 이번 사이클은 **결론 기록까지만** 한다(FR-29·30). 남을 경우 완화 3안을 기록: ①Vercel 로그 마스킹/드레인 필터 가능 여부 확인 ②웹 커넥터용 PAT를 **전용 1개로 분리**해 폐기 반경을 좁힘(즉시 가능, 코드 0줄) ③OAuth 2.1 승격(§2.2에서 재이월 중 — 이 결과가 승격 근거). 확인용 PAT는 **전용 발급 후 즉시 폐기**해 확인 행위 자체가 노출을 늘리지 않게 한다 |
| **RK-14** | MCP 입력 스키마를 조이면 **이미 웹 커넥터로 돌아가는 실사용 호출이 깨진다** — 클로드가 `openedOn: '2026-8-7'`처럼 보내고 있었다면 오늘부터 거부된다 | Medium | Medium | 거부 메시지에 **기대 포맷을 명시**해 클로드가 즉시 재시도하게 한다(2차 RK-07 연장: 툴 설명에 포맷 명기). S4 배포 직후 웹 커넥터로 `backlog_create`·`backlog_update` 실호출 1회씩 확인(C14) |
| **RK-15** | 종료된 사이클 문서를 사후 개정하는 것이 **"그 시점의 판단" 기록을 오염시킨다** — 2차 report의 "❌ Not Met"은 그 시점엔 맞는 서술이었다 | Medium | Medium | D-25: 원문을 지우지 않고 **"(사후 2026-08-08 확인: …)" 형태로 덧붙이고** Version History에 행 추가. 상태 기호만 바꿀 때도 근거 날짜를 같은 칸에 남긴다 |
| **RK-16** | cycles 기능이 문서 없이 들어가(F26) design 문서가 이번 스코프 밖에서도 넓게 어긋나 있다. S5에서 "이왕 고치는 김에" 전면 재동기화로 번진다 | Medium | High | §2.2에 **명시적으로 재이월**. S5는 §6.3 한 곳 + 신규 체크리스트 문서만 건드린다. 어긋남의 존재 자체는 report에 "별 사이클 필요"로 기록해 잊지 않게 한다 |
| **RK-17** | 마감 사이클이라 "작으니까 검증 생략"으로 흐른다. 2차 Critical이 정확히 그렇게 발생했다(회고 §6.2 — 스펙 단계에서 "지우기"를 안 물었다) | Medium | Medium | Success Criteria를 **전부 실증 기준으로만** 작성했고(C11~C16), C11은 3단계를 한 단계도 못 빼게 못박았다. DoD에 하네스 L1 13개 재실행을 포함 |
| **RK-18** | 스코프 6건이 실제로는 파일 5개·수십 줄인데 문서 4종을 쓰는 오버헤드가 더 크다 | Low | Medium | 감내한다 — 이월 6건이 문서에 흩어져 있던 게 문제였고, 그걸 문서로 닫는 게 이 사이클의 목적이다. 대신 analysis는 **스코프 6건 대조만** 하고 전면 재분석하지 않는다(DoD) |

---

## 6. Impact Analysis

| 대상 | 변경 유형 | 영향 |
|------|-----------|------|
| `shared/schema.ts` | **수정** (백로그 필드 1줄 + export 추가) | `UpdateBacklogItemInput` 타입이 바뀌어 **REST·MCP·UI 세 소비처로 파급**(RK-10). 가장 넓은 회귀 표면 |
| `server/services/backlog.ts` | **무변경** | **F13** — input을 가공하지 않으므로 손댈 것이 없다. analysis §6.1의 파일 목록을 실측으로 정정한 지점 |
| `server/db/scoped.ts` | **무변경** | F13 — 스프레드가 null을 이미 NULL로 반영 |
| `server/lib/errors.ts` | 수정 (1줄+1줄) | 코드 1개 추가. `app.onError`의 status 캐스트는 403을 이미 포함(F17) → 무변경 |
| `server/mcp/index.ts` | 수정 | Origin 거부를 리터럴→`ServiceError`로. **응답 body의 code가 바뀐다**(VALIDATION_ERROR→FORBIDDEN) — 프론트 참조 0곳(F17), MCP 클라이언트는 에러 텍스트만 본다 |
| `server/mcp/tools.ts` | **수정 (8툴 전부)** | 입력 검증이 조여진다 → **실사용 호출 거부 가능**(RK-14). 서비스 호출부는 무변경 |
| `src/features/backlog/components/ItemDialog.tsx` | 수정 | `\|\| undefined` 제거 + 지우기 동선. 상태 배지 전환 경로(`:74`)도 같은 규칙을 써야 어긋나지 않는다 |
| `src/lib/api.ts` · `src/features/backlog/hooks/*` | 확인 필요 | 타입 파급(RK-10) — 수정 여부는 `tsc -b`가 판정 |
| **2차 사이클 문서 3종 + `_INDEX.md`** | 수정 (사후 개정) | 종료된 사이클 문서를 고치는 행위 — D-25 방식 고정(RK-15) |
| `docs/deploy/CHECKLIST.md` | **신규** | PDCA 밖 상시 운영 문서(D-24) |
| `vercel.json` · `api/[...route].ts` · DB 스키마·마이그레이션 | **무변경** | 마이그레이션 0건 — `closedOn`은 이미 nullable 컬럼(F13). **이번 사이클은 DB를 안 건드린다** |

### 6.1 신규 외부 의존

없음. 패키지 추가·제거 0건.

### 6.2 검증 (Design 착수 전)

- [ ] zod v4에서 `dateStringSchema.nullable().optional()`과 `z.union([dateStringSchema, z.null()]).optional()`이
      `.partial()` 조합에서 동일하게 동작하는지 — 동등하면 짧은 쪽 채택(D-20 확정)
- [ ] MCP로 `openedOn: 'aaa'`를 보냈을 때 **현재** 어디서 어떻게 실패하는지 실측 —
      Postgres date 파싱 에러(500)인지, 다른 경로로 400인지. S4의 개선 폭을 이 결과가 정한다
- [ ] MCP SDK `inputSchema`에 **스키마 객체 전체**(F21: 타입상 허용)를 넘길 때 `tools/list`의
      JSON Schema 변환이 정상인지, refine 규칙이 파싱 시 살아있는지 — 되면 `document_write`의
      교차규칙 갭(§1.3.1)을 통째로 닫을 수 있다(D-26)
- [ ] Vercel 로그에서 쿼리스트링을 볼 수 있는 경로(대시보드 Logs vs `vercel logs`)와 보존
      기간·마스킹 옵션 — S3 실행 방법 확정

---

## 7. Architecture Considerations

### 7.1 프로젝트 레벨

1·2차와 동일 — **Dynamic**, 옵션 B(서비스 계층) 유지. 이 사이클은 구조를 바꾸지 않는다.
**아키텍처 결정이 아니라 이미 내린 결정의 실행 완결도를 올리는 사이클**이다.

### 7.2 핵심 아키텍처 결정 (Decision Record)

> 2차 D-18을 이어 D-19부터 번호를 매긴다.

| # | 결정 | 후보 | 채택 | 근거 |
|---|------|------|------|:----|
| **D-19** | 처리일 삭제의 표현 | `null` 명시 전송 / 빈 문자열 `''` / 전용 엔드포인트 | **`null`** | F13 — 스프레드가 null을 그대로 컬럼 NULL로 반영한다. `''`는 date 컬럼에 부적합하고 전용 엔드포인트는 필드 하나에 과설계 |
| **D-20** | zod 표현 형태 | `dateStringSchema.nullable().optional()` / `z.union([dateStringSchema, z.null()]).optional()` | **§6.2 실측 후 확정, 동등하면 `.nullable()`** | analysis §6.1이 제시한 union과 동등하면 짧고 읽히는 쪽. F12의 `.partial()` 조합에서 동일 동작인지가 유일한 판단 기준 |
| **D-21** | MCP도 `closedOn: null`을 허용할까 | 허용 / **미허용** | **미허용 + 사유 주석** | 처리일을 지우는 건 형의 **정정 행위**다. 클로드는 해소·삭제 시 날짜를 넣는 쪽이고, 지우기 권한까지 줄 이유가 없다 — 2차 D-13(판단은 클로드, 결정은 형)의 연장. S4에서 shared를 재사용할 때 null이 따라 들어오지 않게 명시 배제(RK-10) |
| **D-22** | 재오픈(종료→대기/진행) 시 처리일 자동 삭제 | 자동 삭제 / **유지** | **유지** (형 승인 A4) | 자동 삭제는 "제안"의 반대편 문제(analysis M-2)를 새로 만든다. S1은 **명시적 지우기 동선 하나만** 제공하고 자동 규칙은 안 만든다 — 스코프 고정 |
| **D-23** | Origin 거부 에러 코드 (**지시서가 Plan에서 결정하라고 한 항목**) | 표에 `FORBIDDEN` 추가 / `TRANSITION_DENIED` 재사용 / `VALIDATION_ERROR`+400 | **`FORBIDDEN`(403) 신설 + `ServiceError` 경유** (형 승인 A1) | Q11 근거 참조. 추가로 **리터럴 응답 제거**가 본질이다 — 코드만 바꾸고 리터럴을 남기면 F16의 구조적 원인(표를 안 지나가는 경로)이 그대로다 |
| **D-24** | 배포 체크리스트 위치 | 2차 design 문서에 절 추가 / **최상위 `docs/deploy/CHECKLIST.md`** / RULE.md | **`docs/deploy/CHECKLIST.md`** (형 승인 A2) | 배포마다 읽는 **상시 운영 문서**라 종료된 사이클 문서에 넣으면 다음 배포 때 아무도 못 찾는다. RULE.md의 "PDCA 밖 문서는 최상위 주제 디렉터리"에 정확히 해당(`docs/code-review/`와 같은 층) |
| **D-25** | 종료된 사이클 문서의 사후 개정 방식 | 원문 덮어쓰기 / **원문 유지 + 사후 확인 덧붙임** / 이번 사이클 문서에만 기록 | **원문 유지 + "(사후 YYYY-MM-DD 확인: …)" + Version History 행** | RK-15 — "그 시점엔 미충족이었다"도 사실이다. 상태 기호를 갱신하되 판단 이력을 지우지 않는다. RULE.md의 "개정 시 Version History 행 추가"와 정합 |
| **D-26** | MCP 스키마 재사용 단위 | 필드 스키마 export 후 조합 / 스키마 객체 전체 전달 / 툴별 유지 | **필드 단위 재사용을 기본**, 객체 전체는 `document_write` 교차규칙에 한해 §6.2 결과에 따라 | 툴별 필드 조합이 REST와 다르다(예: `backlog_update.status`는 2값으로 협소화, D-21로 null 배제). 필드 단위가 그 차이를 표현할 수 있는 유일한 단위. 교차규칙(refine)만은 객체 단위여야 하므로 F21 실측에 맡긴다 |

---

## 8. Convention Prerequisites

### 8.1 기존 규약

- [x] `CLAUDE.md` / `docs/RULE.md`
- [x] 에러 코드 단일 원천(2차 FR-20·D-17) — **이번 사이클이 그 유일한 예외를 없앤다**
- [x] 옵션 B 계층 규칙(서비스만 도메인, 어댑터는 Drizzle import 금지)
- [x] 주석 규약 `// Design Ref: §N`, `// Plan SC: CN`, `// Decision: [Do] …`

### 8.2 이번에 정의할 규약 — 2차 회고 Try의 승격

| 범주 | 정의할 것 | 출처 | 우선순위 |
|------|-----------|------|:--------:|
| **zod 선택 필드** | 날짜·선택 필드는 스키마 작성 시 **"값을 지울 수 있어야 하는가"를 명시 결정**하고 `.nullable()` 여부를 Design 표에 기록한다 | 2차 report §6.3 Try 1 | High |
| **MCP 입력 스키마** | MCP 툴 입력은 `shared/schema.ts` 필드 스키마 **재사용이 원칙**. 못 하는 경우(협소화·부분 필드·권한 경계)는 **사유를 주석으로** 남긴다 | 2차 report §6.3 Try 2 | High |
| **에러 응답 경로** | 에러 응답은 반드시 `ServiceError`를 경유한다. 핸들러에서 `c.json({error:...})`를 직접 만들지 않는다 — 표 밖 조합의 구조적 원인 제거(F16) | 이번 사이클 신규 | High |
| **클라이언트 종류** | Plan 스코프 질문에 "이 기능을 쓸 클라이언트가 몇 종류인가(CLI/웹/브라우저)"를 명시 포함 | 2차 report §6.3 Try 3 | Medium |
| **사후 개정 표기** | 종료된 사이클 문서 개정은 D-25 형식 고정 | 이번 사이클 신규 | Medium |

### 8.3 환경변수

변경 없음 — 신규 0건. (`DATABASE_URL` / `NEON_AUTH_JWKS_URL` / `VITE_*` 기존 유지)

---

## 9. [DO] 실행 마일스톤

코드 → 정합 → 배포 확인 → 문서 순. 배포가 필요한 S3은 앞의 코드 변경 배포에 **편승**시켜
배포 횟수를 늘리지 않는다.

| Module | 스코프 | 산출물 | 완료 판정 |
|:------:|:---:|--------|-----------|
| **1** | S1 + S2 | zod nullable(FR-22), `ItemDialog` 지우기 동선(FR-23·24), MCP null 배제 주석(FR-25), `FORBIDDEN` 신설 + `ServiceError` 경유(FR-26·27·28), `shared/schema.test.ts` 백로그 3케이스 | **C11(3단계 실증, API+브라우저 양쪽)·C12**. `tsc -b`로 RK-10 파급 전수 확인 |
| **2** | S4 | 필드 스키마 export(FR-31), 툴 8개 스키마 전환 + 사유 주석(FR-32), 거부 메시지에 포맷 명기(FR-33) | **C14** — §1.3.1 대조표를 **다시 채워** 갭 0 확인 + MCP 실호출 2건. 2차 L1 13개 하네스 재실행 |
| **3** | S3 | 전용 PAT 발급 → `?token=` 실배포 요청 1건 → 로그 검색 → 결론 기록(FR-29·30) → **PAT 즉시 폐기** | **C13** — "남음/안 남음" 확정 기록. 남으면 완화 결정까지 |
| **4** | S5 + S6 | design §6.3 정정(FR-34), `docs/deploy/CHECKLIST.md`(FR-35), 2차 report·analysis·`_INDEX.md` 사후 개정(FR-36·37·38) | **C15·C16** + 링크 전수 검증 |

**순서 근거**

- module-1이 먼저인 이유: S1의 zod 변경이 타입을 통해 **module-2가 만질 MCP 스키마로 파급**된다
  (RK-10). 순서를 뒤집으면 tools.ts를 두 번 만진다.
- S1과 S2를 한 모듈에 묶는 이유: 둘 다 "표/스키마 한 줄 + 실증"이고 회귀 검증(하네스 L1)을
  공유한다. 나누면 검증만 두 번이다.
- module-3을 코드 모듈 뒤에 두는 이유: S3은 **실배포가 전제**다. module-1·2의 배포에 편승하면
  배포 1회로 끝난다.
- module-4를 마지막에 두는 이유: S5의 배포 체크리스트가 module-3의 배포 경험을 반영할 수 있고,
  S6의 기록은 다른 모듈 결과가 확정된 뒤에 써야 두 번 안 쓴다.

**세션 분할 권고**: module-1~2 한 세션(타입 파급이 이어짐) / module-3~4 한 세션(배포 후).

**Checkpoint 태깅**: module-1·2는 끝날 때 각각 C11~C12 / C14만 즉시 대조한다 — 2차 회고 §6.3
Try(마지막에 몰아서 대조하지 않기)를 이번에도 적용.

---

## 10. Next Steps

1. [x] **형 Plan 승인** — 확인 포인트 4건(D-23 / D-24 / FR-38 / D-22) **전부 동의**,
       2026-08-08. 상세는 §1.4.1
2. [ ] §6.2 검증 4건 수행 (zod nullable 형태 / 현행 날짜 포맷 실패 지점 / SDK 객체 스키마 /
       Vercel 로그 확인 경로)
3. [ ] 설계 문서 작성 (`refine-mcp-hardening.design.md`) — §1.3.1 대조표의 **닫는 방식**을
       필드별로 확정한 표 포함
4. [ ] module-1 착수
5. [ ] 사이클 종료 시 `docs/PDCA/2026-08/new.tmp` 삭제 (RULE.md)

---

## Version History

| 버전 | 날짜 | 변경 내용 | 작성자 |
|------|------|-----------|--------|
| 0.1 | 2026-08-08 | 최초 작성. 형 지시서(new.tmp)의 이월 6건을 스코프로 고정. 현 HEAD 실측 F11~F27 — 특히 **F11**(대상 7파일 무변경으로 analysis 발견이 그대로 유효), **F13**(null→NULL 반영이 이미 동작하므로 `services/backlog.ts`는 수정 불필요 — analysis §6.1 파일 목록 정정), **F18/§1.3.1**(MCP 스키마 갭 16곳 전수 대조, M-4의 "구체 사례 미확인"을 `openedOn` 날짜 포맷으로 확정), **F17**(FORBIDDEN 추가 비용 0). 지시서가 Plan 결정으로 넘긴 Origin 에러 코드는 **D-23 FORBIDDEN 신설 + ServiceError 경유**로 확정 | cogmo |
| 0.2 | 2026-08-08 | 형 승인 반영 — §10 확인 포인트 4건(D-23 FORBIDDEN 신설 / D-24 `docs/deploy/CHECKLIST.md` 위치 / FR-38 `_INDEX.md` 갱신을 S6 포함 / D-22 재오픈 시 자동삭제 없음) 전부 동의. §1.4.1 승인 표 신설, D-22·23·24에 승인 표기, FR-38 우선순위 Medium→High(A3으로 확정 항목이 됨), 상태 Draft→Approved | cogmo |
