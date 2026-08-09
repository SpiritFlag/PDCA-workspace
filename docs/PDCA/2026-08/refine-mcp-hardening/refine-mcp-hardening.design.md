---
template: design
version: 1.3
---

# refine-mcp-hardening 설계 문서

> **한 줄 요약**: 코드 변경은 파일 6개 — `shared/schema.ts`의 필드 스키마를 **export로 승격**해
> MCP 툴 8개가 재사용하게 하고(갭 16곳 전수 폐쇄), `closedOn`에 `.nullable()` 한 조각과
> `FORBIDDEN` 코드 한 줄을 넣고, `ItemDialog`에 ✕ 지우기 동선을 단다. Plan §6.2 검증 4건을
> **전부 실측 완료**한 상태에서 설계를 확정한다 — 추정으로 남긴 결정이 0건이다.
>
> **프로젝트**: PDCA-workspace
> **작성자**: Claude
> **작성일**: 2026-08-08
> **상태**: Draft (v0.1 — Checkpoint 3에서 FR-24 ✕ 버튼 확정)
> **계획 문서**: [refine-mcp-hardening.plan.md](./refine-mcp-hardening.plan.md)

---

## Context Anchor

> Plan에서 복사. Design→Do 인계 시 전략 컨텍스트 보존.

| Key | Value |
|-----|-------|
| **WHY** | 2차 사이클이 실사용 검증을 조건으로 열어둔 이월 6건이 지금 실사용에서 실제로 걸린다. 문서·코드·표가 각각 한 군데씩 어긋난 상태를 다음 사이클로 또 넘기면 원칙이 관행으로 무너진다. |
| **WHO** | 형 — 브라우저 실사용자이자 승인자 / **클로드 2종**: Claude Code CLI(코드 작업)와 claude.ai 웹 MCP 커넥터(백로그·문서 운용). C7·C10을 실제로 완주한 쪽은 **웹 커넥터**다(F27). |
| **RISK** | zod null 허용의 타입 파급 3소비처(RK-10) / MCP 스키마 조임이 실사용 호출을 거부(RK-14) / 종료 사이클 문서 사후 개정의 기록 오염(RK-15) / design 전면 재동기화로 스코프 번짐(RK-16). |
| **SUCCESS** | C11~C16 — 스코프 6건과 1:1. 전부 "실측/실증으로 닫혔다"가 판정 기준. 핵심은 **C11 — 처리일 세팅→null→재조회 3단계 실증**. |
| **SCOPE** | 이월 6건 고정(S1~S6). 새 기능·리팩터·번들 최적화·OAuth·cycles 문서화는 스코프 외(Plan §2.2 재이월). |

---

## 1. Overview

### 1.1 설계 목표

1. **검증 계층까지 단일 원천** — 2차 옵션 B는 "같은 서비스 함수"까지만 단일 원천이었고 입력
   검증은 REST·MCP 두 벌이었다(2차 회고 §6.2). 이번에 `shared/schema.ts`의 **필드 스키마
   export**로 검증 계층까지 한 원천으로 만든다. 갭 16곳(Plan §1.3.1)이 대상이다.
2. **표 밖 경로의 구조적 제거** — Origin 거부가 어긋난 원인은 코드값이 아니라 **표를 안
   지나는 리터럴 응답**이다(Plan F16). `FORBIDDEN`을 추가하되, 본질은 `ServiceError` 경유로
   경로를 하나로 만드는 것 — 핸들러에서 `c.json({error:...})` 직접 생성 금지를 규약으로 승격.
3. **지우기를 1급 동선으로** — `closedOn`의 null을 zod(스키마)·전송(UI)·표시(✕ 버튼) 세
   지점에서 일관되게 다룬다. 서버 쓰기 계층은 실측(Plan F13)으로 무변경 확정.

### 1.2 설계 원칙

- **2차 원칙 전부 유지** — 라우트·툴은 얇게 / 서비스는 전송을 모른다 / 툴이 없으면 실수도
  없다 / YAGNI.
- **동작 변경은 스코프가 지목한 곳만** — 필드 스키마 승격은 **제약을 바꾸지 않는 순수 이동**
  (같은 min/max/regex를 이름 붙여 export). 조여지는 건 MCP 입력뿐이고, 그것이 S4의 목적이다.
- **거부 메시지는 클로드가 스스로 고칠 수 있게** — 검증 V2로 SDK가 zod 메시지를 클라이언트까지
  그대로 전달함을 확인했다. 모든 조임 필드의 zod 메시지에 기대 형식을 담는다(RK-14).

### 1.3 Plan §6.2 검증 결과 (전건 실측 완료, 2026-08-08)

이 설계의 모든 결정은 아래 실측 위에 서 있다. 스크립트는 실행 후 삭제(2차 관례).

| # | 검증 | 방법 | 결과 | 확정되는 결정 |
|---|------|------|------|------|
| **V1** | zod v4 `.nullable().optional()` vs `z.union([...,z.null()]).optional()` | 두 형태로 `backlogItemFields`→`.partial()` 재현, 5케이스(null 명시/정상/불량 포맷/키 부재/undefined) 파싱 대조 | **5케이스 전부 동일 동작.** null이 `.partial()` 후에도 파싱 결과에 보존됨(`'closedOn' in parsed === true`, `=== null`) | **D-20: `.nullable().optional()` 채택** (짧은 쪽) |
| **V2** | MCP SDK `inputSchema`에 ZodObject 전체(+`.refine`) 전달 | `InMemoryTransport`로 서버·클라이언트 연결, raw shape/객체/refine 객체 3툴 등록 후 `tools/list`·`tools/call` 실행 | 3형태 모두 **JSON Schema 변환 정상**(동일 출력). refine 위반 호출은 `isError` + `MCP error -32602: ... kind가 'general'이면 pdcaStage를 지정할 수 없습니다 at pdcaStage` — **우리가 쓴 한글 zod 메시지가 클라이언트까지 그대로 도달** | **D-26: 필드 단위 재사용 기본 + `document_write`만 객체 전체 전달**로 교차규칙 갭까지 폐쇄 |
| **V3** | 현행 `openedOn:'aaa'`의 실패 지점 | dev DB에 `SELECT 'aaa'::date` 캐스트(쓰기 0건) + SDK 소스(`mcp.js` CallTool 핸들러) 확인 | Postgres **`22007` invalid input syntax for type date**까지 내려감. SDK가 핸들러 throw를 catch해 `isError` + **raw DB 메시지**로 반환(500 아님, HTTP 200 JSON-RPC) | S4의 개선 폭 확정: "크래시 방지"가 아니라 **원시 에러 누출 제거 + 기대 포맷 안내**. C14 검증 기대값도 이걸로 확정 |
| **V4** | Vercel 로그의 쿼리스트링 취급 | 공식 문서(`/docs/logs/runtime`) 확인 | 로그 상세(Log details)에 **`Search Params` 필드가 명시적으로 존재**, 마스킹 옵션 언급 없음. 보존: Hobby 1시간 / Pro 1일 | S3 확인 방법 확정(§7.2). 문서 근거상 **"남는다"가 유력** — module-3 실배포에서 값이 평문인지만 최종 확인 |

### 1.4 Checkpoint 3 — 형 결정 (2026-08-08)

아키텍처 3안 비교는 **생략** — Plan §7.1("옵션 B 유지, 구조 무변경")이 형 승인(A1~A4)으로
이미 고정됐고, 이 사이클은 아키텍처 결정이 아니라 실행 완결도를 올리는 사이클이다. 대신
Plan이 Design으로 넘긴 유일한 미결(FR-24)을 Checkpoint 3으로 결정받았다:

| # | 질문 | 형의 답 |
|---|------|---------|
| **D-27** | 처리일 지우기 UI 동선 — ✕ 버튼 vs 비우고 저장만 | **✕ 버튼 추가** — 값이 있을 때만 input 옆에 표시. 크롬·파이어폭스 date input엔 보이는 지우기 버튼이 없어 "비우고 저장"만으로는 동선이 숨겨진다. 명시적 동선이 D-22(자동 규칙 없음, 지우기는 형의 정정 행위) 취지와 정합 |

---

## 2. Architecture

### 2.1 변경 지점 다이어그램

구조는 2차 §2.1 그대로다. 이번 사이클이 손대는 지점만 표시한다:

```
┌── 브라우저 ──────────────────────┐      ┌── claude.ai 웹 커넥터 / CC CLI ──┐
│ ItemDialog                       │      │ MCP 툴 호출                       │
│  ⑤ 처리일 [date] ✕  ← D-27 신규  │      │  ② 입력이 shared 스키마로 검증됨  │
│  ⑤ 저장 시 '' → null 전송        │      │     (날짜 포맷·길이·uuid, S4)     │
└──────┬───────────────────────────┘      └──────┬────────────────────────────┘
       │ PATCH { closedOn: null }                │ tools/call
┌──────▼──────────────────── server/app.ts ──────▼────────────────────────────┐
│  mcp/index.ts  ③ Origin 거부: 리터럴 c.json 제거 → ServiceError('FORBIDDEN')│
│  mcp/tools.ts  ② 8툴 inputSchema → shared 필드 스키마 재사용 (갭 16곳)      │
│  lib/errors.ts ③ FORBIDDEN: 403 추가 (표의 유일한 예외 제거)                │
│  services/*    무변경 (Plan F13)   db/scoped.ts 무변경 (스프레드가 null→NULL)│
│  shared/schema.ts ① closedOn .nullable() + 필드 스키마 export 승격          │
└─────────────────────────────────────────────────────────────────────────────┘
  ①=S1  ②=S4  ③=S2  ⑤=S1(UI)     S3=배포 로그 확인(§7.2)  S5·S6=문서(§10.3)
```

### 2.2 의존 관계 변화

| 컴포넌트 | 변화 |
|----------|------|
| `mcp/tools.ts` → `shared/schema.ts` | 의존 **확대** — 기존 enum 4곳에서 필드 스키마 전반으로. 이것이 S4의 실체 |
| `mcp/index.ts` → `lib/errors.ts` | 의존 **신규** — `ServiceError` import (지금은 리터럴이라 의존 0) |
| 그 외 전부 | 무변경. 신규 패키지 0, 마이그레이션 0, `vercel.json` 무변경 |

---

## 3. Data Model

### 3.1 DB — 무변경

`closed_on`은 이미 nullable 컬럼(Plan F13, `schema.ts:115`)이고 `updateBacklogItemRow`의
`.set({ ...input })` 스프레드가 null을 그대로 NULL로 반영한다. **마이그레이션 0건.**

### 3.2 `shared/schema.ts` 개정 (S1 + S4의 공유 기반)

두 가지를 한 파일에서 한다 — ①`closedOn` nullable(S1), ②필드 스키마 export 승격(S4).

```typescript
// [승격] 모듈 로컬 → export. 제약은 한 글자도 안 바뀐다 — 이름을 붙여 내보낼 뿐.
// Design Ref: §3.2 — MCP 툴 입력이 이 스키마들을 재사용한다(2차 회고 Try 2의 규약화, Plan §8.2)
export const dateStringSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'YYYY-MM-DD 형식이어야 합니다')
export const backlogTitleSchema = z.string().min(1).max(300)
export const backlogDetailSchema = z.string().max(20000)
export const documentPathSchema = z.string().min(1).max(1000)
export const documentTitleSchema = z.string().min(1).max(300)
export const documentContentSchema = z.string().min(1)

// [승격] createDocumentSchema의 refine 술어를 이름 붙여 export — MCP document_write가 재사용(§4.2)
export const documentKindStageRule = (v: { kind: string; pdcaStage?: string }) =>
  v.kind === 'pdca' || v.pdcaStage === undefined
export const DOCUMENT_KIND_STAGE_MESSAGE = "kind가 'general'이면 pdcaStage를 지정할 수 없습니다"

// [S1] closedOn nullable — D-20(V1 실측: union 형태와 완전 동등, 짧은 쪽 채택)
const backlogItemFields = z.object({
  title: backlogTitleSchema,
  priority: backlogPrioritySchema,
  status: backlogStatusSchema,
  detail: backlogDetailSchema.optional(),
  openedOn: dateStringSchema,
  closedOn: dateStringSchema.nullable().optional(),   // ← 유일한 제약 변경
})
```

- 기존 `documentFields`·`createBacklogItemSchema` 등은 승격된 이름을 참조하도록 조합만
  바꾼다 — **파싱 결과는 이전과 byte-동일**(2차 module-1의 무회귀 기법 동일 적용).
- `documentFields`도 export한다 — MCP `document_write`가 `.extend()`로 재사용(§4.2).
- **uuid는 shared에 별도 정의하지 않는다**: `z.uuid()`가 zod 내장이라 그 자체가 단일
  원천이다. MCP 툴이 직접 `z.uuid()`를 쓴다(Plan FR-31의 "id용 uuid"는 이 방식으로 충족 —
  사유는 tools.ts 주석에).

**타입 파급(RK-10)**: `UpdateBacklogItemInput['closedOn']`이 `string | undefined` →
`string | null | undefined`. 소비처 3곳 중 REST 라우트·서비스·db는 값을 그대로 흘려보내므로
컴파일 영향 0(실측 F13), UI는 §5에서 명시 처리, MCP는 §4.2에서 명시 배제(D-21). 최종 판정은
`tsc -b`(DoD).

### 3.3 `''` ↔ `null` 변환 규칙 (D-28, RK-11 해소)

UI 폼 상태는 기존대로 `''` 기반(date input의 빈값)을 유지하고, **경계에서만 변환한다**:

| 경로 | 빈값(`''`)의 의미 | 전송 |
|------|------------------|------|
| **폼 저장**(`handleSubmit`) | "처리일 없음"이 확정 상태 | `closedOn: closedOn === '' ? null : closedOn` — **null 전송 = 지움** |
| **상태 배지 클릭**(`handleStatusClick`) | 날짜는 이 동작의 대상이 아님 | `closedOn: nextClosedOn || undefined` — **키 생략 = 변경 없음** (현행 유지) |

배지 클릭 경로를 null로 바꾸지 않는 이유: 재오픈(종료→대기) 시 처리일은 **유지**가 형
결정(D-22·A4)이다. 배지 클릭이 null을 보내면 "빈 상태로 재오픈"이 자동 삭제와 같아진다.
저장 경로만 지우기 동선이고, 그 동선의 유일한 입구가 ✕ 버튼 + 비우고 저장이다(D-27).

---

## 4. API Specification

### 4.1 REST — 계약 변경 1건

| Method | Path | 변경 |
|--------|------|------|
| PATCH | `/api/backlog/:id` | 요청 바디 `closedOn`에 **`null` 허용** — null이면 컬럼 NULL(지움), 키 생략이면 변경 없음(기존 동작 유지). 그 외 전 엔드포인트 계약 무변경 |

무회귀 조건: `closedOn` 키를 **생략한** PATCH가 여전히 기존 값을 유지해야 한다(§8.2 L1-r3).

### 4.2 MCP 툴 스키마 — 갭 16곳 폐쇄 명세 (S4)

Plan §1.3.1 대조표의 각 갭을 **닫는 방식**을 필드별로 확정한다. 원칙: (a)재사용 (b)사유 주석
두 가지 중 하나 — 제3의 상태 없음(FR-32).

| 툴 | 필드 | 현행 | **확정** | 방식 |
|---|---|---|---|:---:|
| `document_list` | `projectId` | `z.string()` | `z.uuid()` | (a) zod 내장 |
| `document_read` | `projectId` | `z.string()` | `z.uuid()` | (a) |
| | `path` | `z.string()` | `documentPathSchema` | (a) |
| `document_write` | 전체 | 필드 나열 | **객체 전체 전달**: `documentFields.omit({ content: true }).extend({ projectId: z.uuid(), content: documentContentSchema }).refine(documentKindStageRule, { message: DOCUMENT_KIND_STAGE_MESSAGE, path: ['pdcaStage'] })` — V2 실측으로 refine 포함 객체가 JSON Schema 변환·파싱 시 거부 모두 정상 확인 | (a) **D-26 예외 적용부** |
| `backlog_list` | `projectId` | `z.string()` | `z.uuid()` | (a) |
| | `status` | 재사용 중 | 유지 | — |
| `backlog_create` | `projectId` | `z.string()` | `z.uuid()` | (a) |
| | `title` | `z.string()` | `backlogTitleSchema` | (a) |
| | `priority` | 재사용 중 | 유지 | — |
| | `detail` | `z.string().optional()` | `backlogDetailSchema.optional()` | (a) |
| | **`openedOn`** | `z.string()` | **`dateStringSchema`** — V3의 raw DB 에러 누출을 zod 거부로 대체 | (a) |
| `backlog_update` | `id` | `z.string()` | `z.uuid()` | (a) |
| | `title` | `z.string().optional()` | `backlogTitleSchema.optional()` | (a) |
| | `priority` | 재사용 중 | 유지 | — |
| | `detail` | `z.string().optional()` | `backlogDetailSchema.optional()` | (a) |
| | `openedOn` | `z.string().optional()` | `dateStringSchema.optional()` | (a) |
| | **`closedOn`** | `z.string().optional()` | **`dateStringSchema.optional()` — nullable 미적용.** 주석: `// D-21: 지우기는 형의 정정 행위. shared는 nullable이지만 MCP는 null 배제` | **(b) 의도적 협소화** |
| | `status` | 2값 협소화 | 유지 (기존 주석 유지) | (b) 기존 |
| `backlog_reorder` | `projectId` | `z.string()` | `z.uuid()` | (a) |
| | `ids` | `z.array(z.string())` | `reorderBacklogSchema.shape.ids` (`z.array(z.uuid()).min(1).max(1000)`) | (a) |

- **`document_write`만 객체 전체 전달**(D-26): 교차규칙(refine)은 필드 단위로 표현이 불가능한
  유일한 갭이라 객체 단위가 필요하다. 나머지 툴은 REST와 필드 조합이 달라(협소화·부분 필드)
  필드 단위가 맞다.
- **uuid 사유 주석**(tools.ts 상단 1곳): `// id류는 z.uuid() 직접 사용 — zod 내장이 단일 원천, shared 재정의는 순수 오버헤드`
- **툴 설명 갱신**(RK-14, 2차 RK-07 연장): `backlog_create`·`backlog_update` description에
  `날짜는 YYYY-MM-DD` 문구를 추가한다 — 거부를 받기 전에 맞게 보내도록.

### 4.3 Origin 거부 (S2)

```typescript
// server/mcp/index.ts — 현행 리터럴 제거:
//   return c.json({ error: { code: 'VALIDATION_ERROR', message: 'Invalid Origin' } }, 403)
// 개정:
if (origin && origin !== new URL(c.req.url).origin) {
  // Design Ref: §4.3 — 표 밖 경로 금지(§9.1 규칙 6). onError가 §6.1 표대로 403 + FORBIDDEN 변환
  throw new ServiceError('FORBIDDEN', 'Invalid Origin')
}
```

- `app.onError`의 `ServiceError` 분기가 `{ error: { code: 'FORBIDDEN', message: 'Invalid Origin' } }`
  + HTTP 403을 만든다 — status 캐스트는 403을 이미 포함(Plan F17)하므로 `app.ts` 무변경.
- 응답 바디에서 바뀌는 건 `code` 값뿐. 프론트 참조 0곳(F17), MCP 클라이언트는 연결 실패
  텍스트로만 소비 — 회귀 표면 없음.

### 4.4 에러 응답 규격

2차 규격 유지: `{ error: { code, message, details? } }`. 코드는 §6.1 표(개정판)만 사용.

---

## 5. UI/UX Design

### 5.1 `ItemDialog` 처리일 지우기 (S1 + D-27)

```
중요도 [중간 ▾]   생성일 [2026-08-01]   처리일 [2026-08-05] ✕
                                                            ↑
                                       value가 있을 때만 렌더 (D-27)
```

변경 3점(전부 `ItemDialog.tsx` 안):

| # | 지점 | 현행 | 개정 |
|---|------|------|------|
| 1 | 처리일 label | date input만 | input 오른쪽에 ✕ 버튼 — `closedOn !== ''`일 때만 렌더. `type="button"`, `aria-label="처리일 지우기"`, 클릭 시 `setClosedOn('')` (저장 전까지 미확정 — dirty 경고 체계에 자연 편입) |
| 2 | `handleSubmit` (`:83`) | `closedOn: closedOn \|\| undefined` | `closedOn: closedOn === '' ? null : closedOn` (D-28 폼 저장 경로) |
| 3 | `handleStatusClick` (`:74`) | `closedOn: nextClosedOn \|\| undefined` | **무변경** + 사유 주석 `// D-22·D-28: 배지 클릭은 날짜 무변경(키 생략). 지우기는 폼 저장 경로만` |

- `dirty` 판정(`:46`)은 `''` 기반 상태가 유지되므로 **무변경으로 정확히 동작** — ✕ 클릭 시
  `closedOn('') !== (item.closedOn ?? '')`이 true가 되어 닫기 경고가 걸린다.
- 카드(`BacklogCard`)·접힘 섹션은 무변경 — `closedOn: null`은 기존 "없음" 렌더 경로
  (`item.closedOn ?? ''`류)를 그대로 탄다. 확인은 §8.3 L2에서.

### 5.2 Page UI Checklist (모듈 태깅)

#### 처리일 지우기 `[module-1]`

- [ ] 처리일 값이 있으면 ✕ 표시, 없으면 미표시
- [ ] ✕ 클릭 → input 비워짐(아직 저장 안 됨) → 닫기 시도 시 dirty 경고
- [ ] ✕ 후 저장 → 팝업 재오픈 시 처리일 빈칸, **카드에서 처리일 표기 사라짐** (C11 브라우저 절반)
- [ ] date input을 키보드로 직접 비우고 저장해도 동일하게 지워짐 (D-28: ✕ 없이도 동작)
- [ ] 종료 상태 전환 시 오늘 날짜 자동 입력(기존 동작) 후 ✕로 정정 가능
- [ ] 재오픈(해소→대기) 시 처리일 유지 (D-22 회귀 확인)

---

## 6. Error Handling

### 6.1 에러 코드 표 (개정판 — FORBIDDEN 행 추가)

| HTTP | code | 원인 | 클라이언트 처리 |
|:----:|------|------|----------------|
| 400 | `VALIDATION_ERROR` | zod 실패, reorder id 집합 불일치 | 폼 fieldErrors / 토스트 |
| 401 | `UNAUTHORIZED` | JWT·PAT 없음/만료/폐기됨 | 로그인 리다이렉트 (FR-21) |
| **403** | **`FORBIDDEN`** | **요청 주체는 확인됐으나 그 행위가 금지됨 — MCP Origin 위반 (S2 신설)** | **(MCP 전용 — UI에선 발생 안 함)** |
| 403 | `TRANSITION_DENIED` | `canTransition` false — MCP가 doing/done 시도 (FR-19) | (MCP 전용 — UI에선 발생 안 함) |
| 404 | `NOT_FOUND` | 자원 없음 또는 타인 소유 (구분 안 함) | 목록 복귀 / 새로 만들기 |
| 409 | `CONFLICT` | 유니크 충돌 전반. `details.target`으로 대상 명시 | 대상별 안내 |
| 500 | `INTERNAL` | 서버 오류 | 토스트 + 재시도 |

- 403이 두 코드를 갖게 된다 — HTTP status는 겹쳐도 되고, code가 원인을 구분하는 게 이 표의
  존재 이유다(`TRANSITION_DENIED`는 전이 규칙 위반, `FORBIDDEN`은 그 외 금지 행위).
- **정본(canonical) 표는 2차 design §6.1이다.** 이 표는 그 개정판이며, FR-28에 따라 2차
  design §6.1에 같은 행을 **코드와 같은 커밋에서** 추가한다(RK-12). 사후 개정 표기는 D-25.

### 6.2 어댑터 매핑 — 무변경

REST(`app.onError`)·MCP(`fail()` 래퍼) 매핑은 2차 §6.2 그대로. `FORBIDDEN`은 기존
`ServiceError` 경로에 자동 편입된다 — 새 분기 0줄.

### 6.3 MCP 입력 거부 형태 (S4 이후)

| 상황 | 현행 (V3 실측) | 개정 후 |
|------|----------------|---------|
| `openedOn: 'aaa'` | 서비스→DB 통과 후 Postgres `22007`, SDK가 raw 메시지 노출: `invalid input syntax for type date: "aaa"` | **SDK 입력 검증 단계 거부**: `MCP error -32602: Input validation error: ... YYYY-MM-DD 형식이어야 합니다` (V2 실측 형태) — DB 왕복 0회, 원시 에러 누출 0 |
| `closedOn: null` (raw JSON-RPC) | zod `.optional()`이 거부 (우연히 안전) | **명시적 거부 유지** — D-21 의도가 주석으로 명문화됨 |
| 비-uuid `projectId`/`ids` | 서비스 집합 검증에서 걸림 (2차 I-4 — raw SQL 도달 불가) | zod에서 조기 거부 — 방어가 한 층 앞으로 |

---

## 7. Security Considerations

- [ ] **S2가 곧 보안 항목** — Origin 위반 응답이 표준 경로를 타게 됨. 거부 자체는 기존과
      동일하게 403 (완화도 강화도 아님, 정합화).
- [ ] **S4가 입력 검증 표면 축소** — 날짜·길이·uuid가 zod에서 조기 거부되어 DB까지 내려가는
      비정상 입력이 사라진다(V3의 raw 에러 누출 제거 포함).
- [ ] **D-21 유지** — MCP의 `closedOn` null 배제. 상태 전이 경계(Q10a·Q10b)와 같은 축의
      권한 설계: 정정 행위는 형 전용.

### 7.1 S3 — `?token=` 로그 잔존 확인 절차 (module-3)

V4로 확인 방법이 확정됐다. **문서 근거상 "남는다"가 유력**(로그 상세에 `Search Params` 필드
존재, 마스킹 옵션 없음)이므로, module-3의 일은 "남는가"보다 **"값이 평문 그대로인가"**의
최종 확인 + 완화 결정이다.

| 단계 | 행동 | 비고 |
|:---:|------|------|
| 1 | 확인 전용 PAT 발급 (`s3-log-probe` 같은 식별 이름) | 기존 실사용 PAT를 확인에 쓰지 않는다 — 확인 행위가 노출을 늘리지 않게(Plan RK-13) |
| 2 | `curl "https://<도메인>/api/health...` 가 아닌 **인증 필요 경로** 1건을 `?token=`으로 호출 (예: `GET /api/me?token=pdcaw_...`) | authMiddleware가 걸린 경로여야 실사용과 같은 조건(F20) |
| 3 | Vercel 대시보드 → 프로젝트 → **Logs** → 해당 요청 클릭 → 상세의 **Search Params** 필드 확인 | V4 확정 경로. 보존이 짧으므로(Hobby 1h/Pro 1d) 요청 직후 확인 |
| 4 | 결과 기록: **평문 잔존 여부를 analysis에 1행으로 확정** (C13 — "확인 필요"로 남으면 미충족) | |
| 5 | **전용 PAT 즉시 폐기** | |
| 6 | 잔존 시 완화 결정(FR-30): ①로그 드레인/마스킹 가능 여부 ②웹 커넥터용 PAT 전용 1개 분리(코드 0줄, 즉시 가능) ③OAuth 2.1 승격 근거로 기록 — 중 택1 이상을 형이 결정 | Plan RK-13의 3안 |

#### 7.1.1 실측 결과 (2026-08-08, 형이 브라우저에서 직접 수행)

이 환경(샌드박스)이 Vercel API로 프로덕션 시크릿을 가져오면 값을 `[SENSITIVE]`로 치환해
CLI 경로(§7.1 절차를 클로드가 대행)가 막혔다 — 형이 직접 1~6단계를 수행했다.

| # | 결과 |
|---|------|
| **C13 확정** | **잔존함** — Vercel Logs 상세의 Search Params 필드에 `token=pdcaw_...`가 **평문 그대로** 표시됨(V4가 예측한 "남는다"가 실측으로 확인) |
| **FR-30 완화 결정** | **③ OAuth 2.1 승격 근거로 기록만** — 형이 선택. ①(로그 마스킹)·②(PAT 분리)는 이번엔 채택 안 함, 코드·설정 변경 0건 |

Plan §2.2 Out of Scope의 "MCP OAuth 2.1 정식 지원 — D-18로 임시 대응 중. **단 S3 결과가 '남는다'면
승격 근거가 생긴다**"가 실현됐다 — 이 사이클에서 착수하지는 않되, 다음 사이클 후보 우선순위를
올릴 근거로 report·`_INDEX.md`에 남긴다(module-4, S6과 함께).

### 7.2 이번 사이클 밖 (재확인)

Rate limiting·XSS·PAT 수명주기 등 2차 §7 체계 전부 유지, 재작업 없음.

---

## 8. Test Plan

> 테스트 코드는 Do 단계에서 구현과 1:1 작성. Check 단계는 실행만(2차 방식).

### 8.1 테스트 범위

| 유형 | 대상 | 도구 | 단계 |
|------|------|------|------|
| **L0: 단위** | `shared/schema.test.ts` 백로그 케이스 3+ (DoD) | Vitest | Do (module-1) |
| L1: API | 신규 시나리오 7 + **2차 L1 13개 재실행**(무회귀) | 실 DB `app.request()` 하네스 | Do (module-1·2 말) |
| L2: UI | §5.2 체크리스트 | 수동 — module-1 완료 시 즉시 | Do |
| L3: 배포 확인 | S3 절차(§7.1) + MCP 실호출 2건(웹 커넥터) | 실배포 | Do (module-3) |

### 8.2 L0 — 스키마 단위 케이스 (`shared/schema.test.ts` 추가분)

| # | 케이스 | 기대 |
|---|--------|------|
| t1 | `updateBacklogItemSchema.parse({ closedOn: null })` | 통과, `closedOn === null` 보존 (V1 재확인의 정식화) |
| t2 | `updateBacklogItemSchema.safeParse({ closedOn: 'aaa' })` | 거부 |
| t3 | `updateBacklogItemSchema.parse({})` | 통과, `'closedOn' in result === false` (키 부재 = 변경 없음 계약) |

### 8.3 L1 — 신규 API 시나리오

| # | 시험 | 기대 | SC |
|---|------|------|:---:|
| r1 | `PATCH /backlog/:id` `{ closedOn: '2026-08-01' }` → 재조회 | 200, 값 존재 | **C11-①** |
| r2 | `PATCH` `{ closedOn: null }` → 재조회 | 200, **`closedOn === null`** | **C11-②③** |
| r3 | `PATCH` closedOn 키 생략 (r1 값 세팅 후) | 200, 기존 값 유지 (무회귀) | §4.1 |
| r4 | `Origin: https://evil.example`로 MCP POST | 403 + `{"error":{"code":"FORBIDDEN"}}` | **C12** |
| r5 | MCP `backlog_create` `{ openedOn: 'aaa' }` | isError + 메시지에 `YYYY-MM-DD` 포함, **DB 미도달** | **C14** |
| r6 | MCP `backlog_update` `{ closedOn: null }` (raw JSON-RPC) | isError (D-21) | C14 |
| r7 | MCP `backlog_create`·`backlog_update` 정상 입력 | 성공 — 조임의 무회귀 (RK-14) | C14 |
| — | **2차 §8.2 L1 #1~13 전수 재실행** | 전부 기존 기대값 유지 (#12만 body code가 FORBIDDEN으로 변경된 기대값) | §3.2 NFR |

### 8.4 L3 — 배포 후 (module-3)

| 단계 | 행동 | SC |
|:---:|------|:---:|
| 1 | §7.1 S3 절차 1~6 | **C13** |
| 2 | claude.ai 웹 커넥터로 `backlog_create` 1건 + `backlog_update` 1건 실호출 | C14 실사용 무회귀 (RK-14) |

### 8.5 문서 검증 (module-4)

- 저장소 전체 마크다운 링크 추출→존재 확인, 신규 깨짐 0 (RULE.md 종료 절차)
- §6.1 정합 3중 대조: `errors.ts` 코드 집합 == 2차 design §6.1 표 == L1 실응답 code (C12 후반)

---

## 9. Clean Architecture

### 9.1 계층 규칙 — 2차 §9.1 유지 + 1건 추가

| # | 규칙 | 비고 |
|---|------|------|
| 1~5 | 2차 규칙 전부 유지 (서비스만 도메인 / 어댑터 Drizzle 금지 / ServiceError만 throw / transition 순수 / 기존 규약) | 이번 사이클 위반 유발 변경 없음 |
| **6** | **에러 응답은 반드시 `ServiceError` 경유 — 핸들러에서 `c.json({ error: ... })` 직접 생성 금지** | **신규(Plan §8.2).** F16의 구조적 원인 제거. 유일한 기존 위반(`mcp/index.ts` Origin)이 S2에서 소거되므로 규칙 확정 시점에 위반 0건 |

### 9.2 배치 — 변경 파일만

| 구성요소 | 위치 | 성격 |
|----------|------|------|
| 필드 스키마 export 승격 + closedOn nullable | `shared/schema.ts` | 수정 (S1·S4) |
| 스키마 단위 테스트 | `shared/schema.test.ts` | 수정 (+3케이스) |
| FORBIDDEN 코드 | `server/lib/errors.ts` | 수정 (2줄) |
| Origin 거부 ServiceError화 | `server/mcp/index.ts` | 수정 (S2) |
| 툴 8개 스키마 재사용 | `server/mcp/tools.ts` | 수정 (S4) |
| ✕ 버튼 + null 전송 | `src/features/backlog/components/ItemDialog.tsx` | 수정 (S1) |
| 배포 체크리스트 | `docs/deploy/CHECKLIST.md` | **신규** (S5, D-24) |
| 2차 design §6.1·§6.3 / 2차 report·analysis / `_INDEX.md` | 각 원위치 | 사후 개정 (S5·S6, D-25) |

---

## 10. Coding Convention Reference

2차 §10 전부 유지. 이번 사이클 추가분(Plan §8.2의 규약 승격을 코드 규약으로):

| 항목 | 규칙 |
|------|------|
| zod 선택 필드 | 날짜·선택 필드는 `.nullable()` 여부를 **Design 표에 명시 결정** — 이번 사이클: `closedOn`만 nullable(REST), MCP는 배제(D-21) |
| MCP 입력 스키마 | `shared/schema.ts` 필드 스키마 재사용이 원칙. 불가 시 사유 주석 — `(b)` 주석 2곳(`closedOn` null 배제, `status` 협소화) + uuid 사유 1곳 |
| 에러 응답 | `ServiceError` 경유만 (§9.1 규칙 6) |
| 사후 개정 표기 | `**(사후 YYYY-MM-DD 확인)** …` + Version History 행 (D-25) |

### 10.1 배포 체크리스트 목차 (S5, `docs/deploy/CHECKLIST.md` — module-4에서 작성)

report §7.2("적용 안 하면 무엇이 깨지는지 명시")를 뼈대로:

1. **마이그레이션** — dev·main 브랜치 각각 `DATABASE_URL` 지정 후 `drizzle-kit migrate`,
   적용 확인 쿼리, **미적용 시 증상**(2차 실사례: main 미적용 → `/api/tokens` 500)
2. **배포 순서** — 마이그레이션 먼저(구코드는 신스키마에 안전, 역은 아님) → Vercel 배포
3. **배포 후 확인** — `/api/health` + 인증 경로 1건 + (스키마 변경 시) 해당 기능 1회전
4. **롤백 기준** — 어떤 증상이면 되돌리는가

---

## 11. Implementation Guide

### 11.1 신규·수정 파일

```
코드 수정 (6):
  shared/schema.ts                                   ← S1 nullable + S4 export 승격
  shared/schema.test.ts                              ← L0 3케이스
  server/lib/errors.ts                               ← FORBIDDEN (2줄)
  server/mcp/index.ts                                ← ServiceError 경유
  server/mcp/tools.ts                                ← 8툴 스키마 (§4.2 표대로)
  src/features/backlog/components/ItemDialog.tsx     ← ✕ + D-28 변환
확인만 (tsc -b가 판정, 수정 예상 0):
  server/services/backlog.ts · server/db/scoped.ts · server/routes/backlog.ts
  src/features/backlog/hooks/useBacklog.ts · src/features/backlog/api.ts
문서 신규 (1):
  docs/deploy/CHECKLIST.md                           ← §10.1 목차
문서 사후 개정 (4, D-25 형식):
  docs/PDCA/2026-08/backlog-with-mcp/backlog-with-mcp.design.md    ← §6.1 FORBIDDEN 행 + §6.3 정정
  docs/PDCA/2026-08/backlog-with-mcp/backlog-with-mcp.report.md    ← C7·C10 사후 확인
  docs/PDCA/2026-08/backlog-with-mcp/backlog-with-mcp.analysis.md  ← C7·C10 사후 확인
  docs/PDCA/_INDEX.md                                              ← "2/10 미충족" 서술 갱신
```

### 11.2 구현 순서 (Plan §9 모듈에 Design 섹션 매핑)

| Module | 스코프 | Design 참조 | 완료 판정 |
|:------:|:---:|-------------|-----------|
| 1 | S1+S2 | §3.2·§3.3·§4.1·§4.3·§5·§6.1·§8.2 | L0 t1~t3 + L1 r1~r4 + §5.2 체크리스트 즉시 대조 + `tsc -b` (**C11·C12**) |
| 2 | S4 | §4.2 표 전체·§6.3 | L1 r5~r7 + 2차 L1 13개 재실행 + §4.2 표를 Do 결과로 재채움 (**C14** 정적 절반) |
| 3 | S3 | §7.1 | L3 (**C13** + C14 실사용) |
| 4 | S5+S6 | §10.1·§11.1 문서 목록·D-25 | 링크 전수 검증 + §6.1 3중 대조 (**C15·C16**) |

- **커밋 단위 주의(RK-12)**: module-1에서 `errors.ts`·`mcp/index.ts`·2차 design §6.1 행
  추가를 **한 커밋**으로 묶는다 (2차 design 개정만 예외적으로 코드 커밋에 동승 — 표-코드
  정합이 커밋 단위로 깨지지 않게. 이번 사이클 자체 문서 4종은 RULE.md대로 종료 시 1커밋).

### 11.3 Session Guide

#### Module Map

| Module | Scope Key | 내용 | 예상 규모 |
|--------|-----------|------|:---------:|
| 처리일+에러코드 | `module-1` | S1 전체 + S2 전체 + L0/L1 | 소 |
| MCP 스키마 | `module-2` | S4 — 툴 8개 + 재실행 검증 | 소~중 (검증이 본체) |
| 배포 확인 | `module-3` | S3 로그 확인 + 웹 커넥터 실호출 | 소 (배포 편승) |
| 문서 | `module-4` | S5+S6 + 종료 절차 | 소 |

#### 권장 세션 계획 (Plan §9 그대로)

| 세션 | 스코프 | 비고 |
|------|--------|------|
| 1 | Plan + Design | 완료 (본 문서) |
| 2 | `--scope module-1,module-2` | 타입 파급(RK-10)이 이어지므로 한 세션. `tsc -b`·`vitest`·하네스까지 |
| 3 | `--scope module-3,module-4` | 배포 후. S3 결과에 따라 RK-13 완화 결정을 형에게 받는 지점 포함 |

---

## Version History

| 버전 | 날짜 | 변경 내용 | 작성자 |
|------|------|-----------|--------|
| 0.1 | 2026-08-08 | 최초 작성. Plan §6.2 검증 4건 전건 실측 완료(§1.3): V1로 D-20(`.nullable().optional()`) 확정, V2로 D-26(필드 단위 + `document_write`만 refine 포함 객체 전달) 확정 — SDK가 zod 한글 메시지를 클라이언트까지 전달함을 확인, V3로 현행 `'aaa'`가 Postgres 22007 raw 메시지 누출(500 아님)임을 확정해 C14 기대값 구체화, V4로 Vercel 로그 상세에 Search Params 필드 존재 확인(S3 절차 §7.1 확정). Checkpoint 3에서 형이 D-27(✕ 버튼) 선택. D-28(`''`↔null 변환 — 폼 저장만 null, 배지 클릭은 키 생략) 신설. §4.2에 갭 16곳 필드별 폐쇄 명세 확정 | Claude |
| 0.2 | 2026-08-08 | module-1+2 구현 완료(코드 6파일, `tsc -b`·`oxlint`·`vitest` 49/49·L1 하네스 36/36 그린 — 커밋 `f474274`). module-3 착수 중 CLI 경로가 샌드박스의 프로덕션 시크릿 자동 마스킹(`[SENSITIVE]`)으로 막혀 형이 §7.1 절차를 브라우저에서 직접 수행. §7.1.1 신설 — **C13 확정("남음", 평문 잔존)** + FR-30 완화 결정(③ OAuth 2.1 승격 근거로 기록만, 코드 변경 없음) | Claude |
