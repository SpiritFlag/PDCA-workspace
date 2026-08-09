---
template: design
version: 1.0
---

# expand-mcp-prompts 설계 문서

> **요약**: MCP 서버에 prompts 표면을 C안(Pragmatic)으로 연다 — 신규 2파일
> (`server/mcp/prompts.ts` + `server/prompts.l1.ts`), 본문 상수 export로 테스트가
> import 대조, 인자는 정적 본문 + 접두 에코. 의미 참조는 A안(툴 description 지목).
> tools.ts·shared·src·drizzle 0줄.
>
> **프로젝트**: PDCA-workspace
> **작성자**: Claude
> **작성일**: 2026-08-09
> **상태**: 확정 (Checkpoint 3 — 형 3건 일괄 결정 ①①①, 2026-08-09, `.tmp` 문답)
> **Plan 문서**: [expand-mcp-prompts.plan.md](./expand-mcp-prompts.plan.md) (v0.3)

---

## Context Anchor

> Plan 문서에서 전파.

| Key | Value |
|-----|-------|
| **WHY** | 워크플로 지침이 대화 맥락에만 있어 세션이 바뀌면 소실된다. 복제하면 드리프트, 안 하면 재교육 |
| **WHO** | 형 — 지침의 저자이자 슬래시 커맨드 실사용자 / Claude — 서버 구현 |
| **RISK** | RK-56(웹 커넥터 prompts 미지원 가능성) · RK-57(connect 이후 등록 시 throw) · RK-58(클라이언트 목록 캐싱) · RK-63(본문 전문 하드코딩 테스트의 취약성) |
| **SUCCESS** | C45~C51 — 하네스로 prompts/list·get 실증, CC 슬래시 커맨드 실증(`/mcp__PDCA-workspace__*`), 웹 커넥터 지원 여부 사실 기록, tools 10개 무회귀 |
| **SCOPE** | S1~S3 고정 3건. tools·resources·UI·DB 변경 없음. 서버 `server/mcp/` 전용 |

---

## 1. 개요

### 1.1 설계 목표

1. **지침 = 코드 상수** — 부록 A 확정본이 `prompts.ts`의 export 상수가 되고, git diff가
   지침 개정 이력이 된다(Plan §3.3 유지보수).
2. **등록 순서의 구조적 안전** — `registerPrompts`는 `connect` 이전에만 유효(RK-57).
   호출 지점을 한 곳으로 고정하고 하네스가 회귀 감시자가 된다(C45).
3. **참조하되 복제하지 않는다** — 상태 의미·툴 용도·종료 절차는 본문이 지목만 한다
   (FR-119, D-91 A안). 프롬프트는 `shared/`를 import하지 않는다.
4. **테스트는 import 대조** — 본문 상수를 테스트가 import해 무인자 응답과 완전일치 대조.
   지침을 고쳐도 테스트가 안 깨진다(RK-63 해소, D-94).

### 1.2 설계 원칙

- **단일 원천은 "소비처 2곳 이상"일 때만 세운다**(9차 §1.2 승계) — 본문 상수의 소비처는
  `registerPrompts`와 L1 테스트 2곳이므로 export가 정당하고, 별도 모듈 분리(B안)는
  소비처 1파일이라 기각됐다.
- **프롬프트 콜백은 순수하다** — DB·서비스·env 접근 0건. `ownerId` 불요(Plan §3.1 M-1).
- **인자는 힌트다** — 전부 선택이고, 비어도 본문의 "0. 대상 확정"이 동작을 정의한다
  (Plan §2.3 확정 1·2).

---

## 2. 아키텍처

### 2.0 3안 비교와 선택 (Checkpoint 3)

| 기준 | A. Minimal | B. Clean | **C. Pragmatic** |
|------|:---:|:---:|:---:|
| 신규 파일 | 1 (`prompts.ts`) | 3 (`prompts.ts`+`prompt-texts.ts`+`prompts.l1.ts`) | **2** (`prompts.ts`+`prompts.l1.ts`) |
| 테스트 배치 | 기존 `mcp.l1.ts`에 m14~ 추가 | `prompts.l1.ts` 신설 | `prompts.l1.ts` 신설 |
| 테스트 픽스처 | ws/project/backlog/cycle 시딩을 **불필요하게 공유** | 토큰 1개 | **토큰 1개** (`cleanup`+`mintToken`만) |
| 본문 배치 | prompts.ts 내부(비공개) | 별도 모듈 — **소비처 1파일이라 분리 근거 약함**(9차 원칙 상충) | prompts.ts 내부 **export** — 테스트 import 대조 가능 |
| 위험 | 무거운 beforeAll에 경량 테스트가 묶임 | 과설계 | 균형 |

**선택: C안** — 형 결정(Checkpoint 3, 2026-08-09, `.tmp` 문답 ①①①). 함께 확정된 2건:
**D-91 = A안**(툴 description 참조), **인자 삽입 = 정적 본문 + 접두 에코**(D-97).
`.tmp`의 "예정 확정값" 3건(D-94·D-95·D-96)도 전제 그대로 성립 — §9에서 확정.

### 2.1 구성 다이어그램

```
POST /api/mcp
 └ authMiddleware (app.ts:39)                    ← prompts/*도 경로 단위로 자동 통과 필수 (M-7)
   └ mcpRoute.post('/')  — Origin 검증 (index.ts:12-16, 디스패치 이전)
     ├ new McpServer(...)
     ├ registerTools(server, ownerId)             [기존, 0줄]
     ├ registerPrompts(server)                    [신규 호출 — 반드시 connect 이전, RK-57]
     │    ├ registerPrompt('backlog_sync',  {title, description, argsSchema:{projectName?, cycleName?}}, cb)
     │    └ registerPrompt('make_cc_prompt',{title, description, argsSchema:{projectName?, targets?, cycleName?}}, cb)  [D-98]
     │         cb: 정적 본문 상수 + [인자] 접두줄 (D-97) — DB·서비스 접근 0건
     ├ server.connect(transport)                  ← SDK가 prompts capability 자동 선언 (M-2)
     └ transport.handleRequest(c)

server/mcp/prompts.ts [신규]
  export const BACKLOG_SYNC_TEXT     ─┬─ 소비처 2곳: registerPrompts / prompts.l1.ts (import 대조)
  export const MAKE_CC_PROMPT_TEXT   ─┘
  export function registerPrompts(server)

server/l1-harness.ts [확장 — 6T-1 채점 대상]
  기존: rpc()     → prompts/list·prompts/get에 무수정 재사용 (M-6)
  신규: getPrompt() → prompts/get 전용 얇은 래퍼 (callTool과 대칭)
```

### 2.2 데이터 흐름

- **DB 접근 0건.** 프롬프트 콜백은 상수 문자열(+접두줄 조립)만 반환한다. 계층 경계 규칙
  ("쿼리는 services/에서만")은 시험되지 않는다 — services import 자체가 없다.
- stateless 특성 그대로: 요청마다 `registerPrompts`가 재실행되지만 상수 등록이라 툴 10개
  등록과 같은 수준(Plan §3.3 성능).
- 인증·Origin은 기존 흐름에 **구조적으로 포함**(Plan §3.1 M-7) — 신규 방어 코드 0줄,
  p7·p8이 그 사실을 못 박는다.

### 2.3 의존성

| 자원 | 의존 대상 | 용도 |
|------|-----------|------|
| `prompts.ts` [신규] | `McpServer` 타입, `zod` | 등록 + 인자 스키마. **`shared/`·`services/` import 없음**(§1.2) |
| `index.ts` [수정] | +`registerPrompts` | 배선 2줄 (RK-57 주석 포함) |
| `l1-harness.ts` [확장] | 기존 그대로 | +`getPrompt` (rpc 재사용) |
| `prompts.l1.ts` [신규] | `l1-harness.js`의 `cleanup`·`mintToken`·`rpc`·`getPrompt`·`req` + `prompts.js`의 본문 상수 2개 | p1~p9 |

---

## 3. 데이터 모델

**변경 없음.** `drizzle/` 0줄(Plan §3.3 제약). 프롬프트는 어떤 테이블도 읽지 않는다.

---

## 4. API 명세 (JSON-RPC — `/api/mcp`)

기존 REST·`tools/*`는 전부 무변경. 신규는 SDK가 자동 처리하는 2메서드뿐이다.

### 4.1 `prompts/list`

```jsonc
// req
{ "jsonrpc":"2.0", "id":"…", "method":"prompts/list" }
// res (요지, D-98 반영)
{ "result": { "prompts": [
  { "name": "backlog_sync",   "title": "백로그 최신화",
    "description": "…", "arguments": [
      { "name":"projectName", "description":"…", "required": false },
      { "name":"cycleName",   "description":"…", "required": false } ] },
  { "name": "make_cc_prompt", "title": "CC용 Plan 지시서 생성",
    "description": "…", "arguments": [
      { "name":"projectName", "description":"…", "required": false },
      { "name":"targets",     "description":"…", "required": false },
      { "name":"cycleName",   "description":"…", "required": false } ] }
] } }
```

- `required:false`는 zod `.optional()`에서, `description`은 `.describe()`에서 SDK가 파생한다
  (Plan §3.1 M-2). **인자 순서 = zod shape 키 순서** — 두 프롬프트 모두 `projectName`이 먼저
  (D-98, CC 위치인자 `/mcp__PDCA-workspace__make_cc_prompt <projectName> <targets> <cycleName>`).
  **[Check 정정, 2026-08-09]** — 이 절이 D-98 반영에서 누락돼 있던 것을 gap-detector가
  발견(I-1), 위처럼 정정했다.

### 4.2 `prompts/get`

```jsonc
// req
{ "method":"prompts/get", "params": { "name":"backlog_sync", "arguments": { "projectName":"PDCA-workspace", "cycleName":"expand-mcp-prompts" } } }
// res (요지)
{ "result": { "description":"…", "messages": [
  { "role":"user", "content": { "type":"text", "text": "[인자] projectName=PDCA-workspace cycleName=expand-mcp-prompts\n\n방금 닫힌 PDCA 사이클을…" } }
] } }
```

> **Decision: [Do] module-3 실측(D-98)** — SDK의 `z.object()`는 `argsSchema` 필드가 전부
> `.optional()`이어도 `arguments` 자체가 `undefined`면 `-32602`로 거부한다("expected object,
> received undefined"). 실제 클라이언트가 무인자 호출 시 필드를 생략할 가능성에 대비해
> **클라이언트가 `arguments: {}`(빈 객체)를 보내는 것이 계약**이라고 명시한다 —
> `l1-harness.ts`의 `getPrompt`가 `args ?? {}`로 이를 보장한다(§8.2 참조).

- 무인자면 `text === 본문 상수` (완전일치, D-94).
- 없는 프롬프트명 → JSON-RPC 에러 `-32602`(SDK 처리, Plan §3.1 M-4). HTTP는 200(에러는 바디).
- 미인증 → HTTP 401 / 타 Origin → 403 (JSON-RPC 도달 이전, §2.2).

---

## 5. 프롬프트 표면 명세

> UI 사이클의 §5(UI/UX)에 해당하는 절 — 이 사이클의 "화면"은 프롬프트 메타데이터다.

### 5.1 등록 명세 (D-95·D-96 확정 반영)

| 필드 | `backlog_sync` | `make_cc_prompt` |
|------|----------------|------------------|
| `name` | `backlog_sync` | `make_cc_prompt` |
| `title` (D-96: 병기) | `백로그 최신화` | `CC용 Plan 지시서 생성` |
| `description` (D-95: Plan 부록 A 문안 그대로) | `사이클을 닫은 직후 백로그를 최신 상태로 되돌릴 때. 종료 상태 갈라 찍기 · 이월 항목 생성 · 낡은 항목 재평가를 한 번에 처리한다` | `백로그 항목을 Claude Code가 그대로 실행할 수 있는 Plan 작성 지시서로 바꿀 때. 스코프 고정 · 실측 필수 표 · P-1 표 · 승인 대기 끝맺음을 포함해 생성한다` |
| `argsSchema`(**D-98 개정** — projectName 선두 추가) | `{ projectName: z.string().optional().describe('대상 프로젝트명. 예: PDCA-workspace. 비우면 project_list 후보를 확인받는다'), cycleName: z.string().optional().describe('대상 사이클 폴더명. 예: expand-mcp-prompts. 비우면 cycle_list 최고 버전을 후보로 확인받는다') }` | `{ projectName: z.string().optional().describe('대상 프로젝트명. …'), targets: z.string().optional().describe('쉼표 구분 — 백로그 항목 id 또는 제목 일부. 비우면 후보 2~3건을 제시한다'), cycleName: z.string().optional().describe('새 사이클명. 비우면 어휘 관례로 제안한다') }` |
| 본문 | Plan 부록 A-1 (Q-1 확정 ①직접 전환 텍스트 + **D-98 "0. 프로젝트 확정" 절 신설**) | Plan 부록 A-2 (**D-98 "0. 프로젝트 확정" 절 신설**) |

### 5.2 인자 접두 에코 형식 (D-97)

```
[인자] projectName=PDCA-workspace cycleName=expand-mcp-prompts   ← 준 인자만, argsSchema 선언 순서대로 공백 구분
                                                                    (빈 줄 1개)
<본문 상수 전문>
```

- 조립 규칙: `주어진 인자 0건 → 본문 상수 그대로` / `1건 이상 → '[인자] ' + 'k=v'를
  공백으로 join + '\n\n' + 본문`.
- **[Check 정정, 2026-08-09]** 순서 기준은 "클라이언트가 준 순서"가 아니라 **콜백 인자
  구조분해 순서(= argsSchema 선언 순서)** 다 — `withArgsPrefix`가 `{ projectName, cycleName }`
  객체 리터럴을 받아 `Object.entries`로 순회하므로, 클라이언트가 JSON에서 어떤 순서로
  키를 보내든 접두줄은 항상 선언 순서로 고정된다(gap-detector I-2). 오히려 결정론적이라
  D-97의 "치환 버그 여지 0" 취지와 더 정합해 **코드는 그대로 두고 문안만 정정**했다.
- 값은 그대로 에코한다(치환·가공 없음) — 치환 버그 여지 0이 이 안의 채택 근거다.
- 본문 상수에는 `{{…}}` 자리표시가 **없다** — Plan 부록 A의 `{{cycleName}}` 표기는
  "인자로 들어올 값"의 문서상 표기였고, 확정 구현은 접두 에코다(Plan 부록 A 서두의
  "삽입 방식은 Design 결정" 이행).

### 5.3 본문 상수 코드 표현 (D-92)

- **백틱 템플릿 리터럴 상수**, 부록 A의 줄바꿈 구조 그대로 —
  `export const BACKLOG_SYNC_TEXT = \`…\``.
- **[Check 정정, 2026-08-09]** 본문 안에 백틱이 **1건 있다**(A-2 3-1) `` `git log -1 --
  docs/RULE.md` ``) — "없음을 확인"은 사실과 달랐다(gap-detector M-4). 코드는 이미 올바르게
  `` \` ``로 이스케이프해 처리하고 있어 **구현 수정은 불필요**, 이 서술만 정정한다.
- `.md` import 안은 기각: `tsconfig.server.json`·Vercel 번들 설정 파급(Plan §7.2 D-92 제약)
  대비 이득 없음.

---

## 6. 에러 처리

| 상황 | 계층 | 응답 | 비고 |
|------|------|------|------|
| 미인증 (`Authorization` 없음/무효) | authMiddleware | HTTP 401 `UNAUTHORIZED` | 기존 그대로 — p7 |
| Origin 불일치 | mcpRoute 최상단 | HTTP 403 `FORBIDDEN` (ServiceError) | 기존 그대로 — p8 |
| 없는 프롬프트명 | SDK | JSON-RPC `-32602` `Prompt X not found` | p6 |
| 알 수 없는 인자 키 | SDK(zod) | 무시 또는 `-32602` — SDK 파싱 동작에 따름 | 방어 코드 추가하지 않음. 관측되면 §7 기록 |
| 콜백 내부 예외 | — | **도달 불가 설계** — 콜백은 문자열 조립뿐 | try/catch 두지 않음(`fail()` 헬퍼 불요) |

`tools.ts`의 `ok()/fail()` 패턴을 **가져오지 않는 이유**: 그 헬퍼는 ServiceError(DB·권한)를
isError 툴 결과로 바꾸는 어댑터인데, 프롬프트 콜백엔 실패 경로 자체가 없다. 빈 대칭성을
위한 복제는 하지 않는다.

---

## 7. 보안 고려사항

| 항목 | 설계 |
|------|------|
| 지침 유출 경계 | 본문은 비밀이 아니지만 **인증 뒤에만** 내려간다(구조 보장, p7·p8이 실증). 공개 엔드포인트化 아님 |
| 본문 내 비밀 금지 | PAT·토큰·실제 uuid·개인정보 0건 — DoD에서 `grep -iE 'pdcaw_|uuid|@'`류 검수(부록 A는 이미 충족) |
| 인자 에코의 주입 위험 | 에코는 프롬프트 텍스트(사람이 읽는 지시문) 안이다. 인자는 형이 직접 친 값이고, 서버는 저장·실행하지 않는다 — 이스케이프 불요 판단. 단 접두줄은 1줄로 제한하지 않는다(개행 포함 값도 그대로 에코 — 가공이 더 위험) |
| `?token=` 평문 | 기존 트레이드오프 그대로(백로그 `128404f2`). C50 결과가 승격 근거에 +1 될 수 있음(Plan §2.4) |

---

## 8. 테스트 계획

### 8.1 범위와 순서 (5차 red→green 선례 적용)

- **module-1이 하네스+테스트를 먼저 쓰고 red를 기록한다** — 배선(index.ts) 없이는
  `prompts/list`가 `-32601 Method not found`로 실패하는 것이 기준선. **하네스가 "표면의
  부재"를 실제로 감지한다는 증거**를 남긴 뒤 module-2 배선으로 green 전환한다.
  (본문 상수·`registerPrompts`·`getPrompt`는 module-1에서 만들어야 테스트가 컴파일된다 —
  red의 원인은 **배선 부재 단 하나**로 통제한다.)
- 단위 테스트(vitest 기본 config) 신규 0건 — 순수 함수 신설이 없다(접두 에코 조립은
  콜백 내부 3줄이라 L1이 함께 검증).

### 8.2 L1 시나리오 (`server/prompts.l1.ts` — 실 dev DB, p1~p9)

> **D-98 갱신**: module-3 실증(형이 실제 다중 프로젝트 환경에서 발견)으로 인자에
> `projectName`이 추가되며 p1·p3·p5가 개정됐고, p9(단일 인자 접두줄)가 추가됐다.
> `getPrompt` 하네스는 `args ?? {}`로 무인자 호출도 항상 빈 객체를 보낸다(§4.2 참조) —
> p2·p4가 green에서도 계속 성립하는 이유다.

| # | 시나리오 | 기대 (green) | red 예측 (module-1) |
|---|----------|--------------|---------------------|
| p1 | `prompts/list` | 정확히 2건 · name·title·description 존재 · `arguments[].required` 전부 `false` · 인자 순서 `backlog_sync=[projectName,cycleName]`, `make_cc_prompt=[projectName,targets,cycleName]` | `-32601` |
| p2 | `prompts/get backlog_sync` 무인자 | `messages` 1건 · `role='user'` · `type='text'` · **`text === BACKLOG_SYNC_TEXT`**(import 완전일치) | `-32601` |
| p3 | `prompts/get backlog_sync {projectName:'hns-p1', cycleName:'hns-c1'}` | `text`가 `[인자] projectName=hns-p1 cycleName=hns-c1\n\n` + 상수 | `-32601` |
| p4 | `prompts/get make_cc_prompt` 무인자 | `text === MAKE_CC_PROMPT_TEXT` | `-32601` |
| p5 | `prompts/get make_cc_prompt {projectName:'hns-p2', targets:'hns-t1,hns-t2', cycleName:'hns-c2'}` | 접두줄 `[인자] projectName=hns-p2 targets=hns-t1,hns-t2 cycleName=hns-c2` + 상수 | `-32601` |
| p6 | `prompts/get` 없는 이름(`hns-none`) | JSON-RPC error `-32602` | `-32601` (**red에서도 실패하지만 코드가 다름** — 대조 기록) |
| p7 | 미인증 `prompts/list` (`rpc(null,…)`) | HTTP 401 | **red에서도 401(통과)** — 인증이 표면 존재와 무관함의 증거 |
| p8 | Origin 불일치 POST (`req` + `Origin: https://evil.example`) | HTTP 403 `FORBIDDEN` | **red에서도 403(통과)** — 동일 |
| **p9** | `prompts/get backlog_sync {projectName:'hns-p3'}`(단일 인자) | 접두줄 `[인자] projectName=hns-p3\n\n` + 상수 — 준 인자만 접두줄에 실림을 확인 | (module-3에서 신설, red 단계 없음) |

- 픽스처: `cleanup()` + `mintToken('hns-owner-prompts-…')` 뿐(5T-2 N/A 근거 그대로).
  워크스페이스 시딩 없음.
- `tools/list` 10건 무회귀는 기존 `mcp.l1.ts` m7이 담당(C48) — 중복 작성하지 않는다.
- p7·p8이 red에서도 통과하는 것은 결함이 아니라 **주장 그 자체**다(경계가 표면 등록보다
  앞 계층에 있다) — red 기록 시 이 구분을 명시한다.

### 8.3 사람 실증 (module-3 — 형) — 전건 완료

| # | 시나리오 | SC | 결과 |
|---|----------|-----|------|
| h1 | CC에서 `/` 입력 → `/mcp__PDCA-workspace__backlog_sync`·`__make_cc_prompt` 노출 확인 | C49 | ✅ **성공**(형, 2026-08-09, D-98 이전 1차 실증) |
| h2 | CC에서 무인자 실행 1회 + 인자 실행 1회 — 지침이 대화에 주입되는지 | C49 | ⚠️→✅ **1차 실행에서 projectName 인자 부재 발견(D-98) → 수정·재배포 → 재실증 "성공, 프로젝트 특정까지 정상"**(형, 2026-08-09). module-3의 핵심 성과 — 사람 실증이 아니었으면 놓쳤을 구조적 결함을 잡았다 |
| h3 | claude.ai 웹 커넥터에서 프롬프트 노출 여부 확인 (성패 무관 사실 기록) | C50 | ✅ **노출됨**(형, 2026-08-09) — RK-56 우려(공식 문서에 prompts 언급 0건)와 달리 **실제로는 지원한다**. 웹 커넥터도 CC와 동일하게 이 표면을 쓸 수 있다는 뜻이라 §2.2 Out of Scope "웹 프로젝트 지침 축소"의 전제(RK-60)가 더 강해짐 |
| h4 | (배포 후) `curl` 프로덕션 `prompts/list` → 2건 | C51 | ✅ **확인**(클로드 실행, 1차 배포 `ed8dcab` + D-98 재배포 `f9d32f8` 양쪽 다 재확인) |

**module-3 결론**: C45~C51 **전건 Met.** D-98 발견·수정·재검증 사이클 자체가 h2의 존재
이유를 증명한다 — 코드 리뷰·L1 하네스만으로는 "여러 프로젝트가 있다"는 실사용 조건을
못 잡았을 것이다.

---

## 9. Decision Record

> 6T-3 지시 이행 — `파생 효과` 열 포함. D-91~D-96은 Plan §7.2 예약 번호, D-97·D-98은 신규.

| ID | 결정 | 선택지 | 근거 | 파생 효과 |
|----|------|--------|------|-----------|
| **D-91** | 상태 의미 참조 = **A안(툴 description 지목)** | A: 참조 지시 / B: `STATUS_MEANING` 보간 | 형 결정(①). 의미가 프로토콜 표면 한 곳(툴)에만 실린다. 부록 A 확정본 무수정 | `STATUS_MEANING` 소비자 **불변(2곳)**. `prompts.ts`가 `shared/` import 0건 → 표면 격리 검증(`git diff -- shared`)이 그대로 성립 |
| **D-92** | 본문 = **템플릿 리터럴 상수 export** | 상수 / 배열 join / `.md` import | 형 결정(① C안에 포함). git diff 가독성 + 테스트 import 대조 가능 | 본문 상수 소비처 2곳(등록·테스트) — 9차 "2곳 이상만 단일 원천" 원칙 충족. `.md` import였다면 빌드 설정 파급 |
| **D-93** | 테스트 = **`prompts.l1.ts` 신설** | mcp.l1.ts 추가 / 신설 | 형 결정(① C안에 포함). 픽스처가 토큰 1개라 무거운 beforeAll 공유가 순수 낭비 | `.l1.ts` 3파일 — `fileParallelism:false`(6차)로 경합 안전 기확인. `cleanup()`이 `hns-` 규칙으로 함께 정리 |
| **D-94** | C46 대조 = **무인자 import 완전일치 + 유인자 접두줄 검사** | 앵커 / 전문 하드코딩 / import 일치 | `.tmp` 예정 확정값 승인. import 일치는 앵커보다 강하고(전문 검증) RK-63(하드코딩 취약성)도 회피 | **Plan C46의 "앵커 대조" 문안을 상회 대체** — RK-63의 실체가 "하드코딩"이었으므로 취지 유지·수단 개선. Check에서 이 이탈을 D-25류 형식으로 기록하지 않아도 됨(Design이 사전 확정) |
| **D-95** | description = **Plan 부록 A 문안 그대로** | 용도 1문장 / 절차 요약 | `.tmp` 예정 확정값 승인. 툴 문체("~할 때") 정합 | 슬래시 커맨드 목록·`prompts/list`에 그대로 노출 — 문안 수정은 이후 본문과 같은 파일 1곳 |
| **D-96** | `title` **병기** | 병기 / 미사용 | `.tmp` 예정 확정값 승인. CC가 표시하는 필드 미확인 → 양쪽 채움이 안전 | h1에서 CC가 실제로 어느 필드를 보여주는지 관측 기록(§7 관찰) |
| **D-97** | 인자 = **정적 본문 + 접두 에코** | 접두 에코 / `{{}}` 치환 | 형 결정(①). 본문 불변 → 대조 단순, 치환 버그 여지 0 | 부록 A의 `{{…}}` 표기는 구현 안 됨(문서상 표기로 남음 — 부록 서두가 이미 "삽입 방식은 Design 결정"으로 유보). C46 테스트가 p3·p5로 양분됨 |
| **D-98** | **인자에 `projectName` 추가** — `backlog_sync(projectName?, cycleName?)`, `make_cc_prompt(projectName?, targets?, cycleName?)`. 본문에 "0. 프로젝트 확정" 절 신설 | 인자 추가(형 결정) / 절차만 명문화(인자 미추가) / PDCA-workspace 고정 | module-3 실증(형)에서 발견 — 이 계정에 워크스페이스 2개·프로젝트 4개 존재(`project_list` 실측), 그런데 부록 A 초안은 프로젝트를 특정하는 절차가 아예 없었다. `cycle_list`·`backlog_list` 등 스코프 툴은 전부 `projectId` 필수라 이 결함이 있으면 잘못된 프로젝트를 고를 위험이 실재했다(9차 M-9류 "실측이 설계를 반증한" 사례) | argsSchema·본문·L1 테스트(p1·p3·p5·p9)·`prompts.ts` 코드 전부 재개정(module-3 중 재작업). **Plan 부록 A는 module-3에서 이 결함을 안고 확정됐던 것**이므로 Plan §2.3도 사후 갱신 대상(Plan Version History에 기록). `projectName`을 `cycleName`보다 선행 배치 — CC 위치인자 순서상 "어느 프로젝트"가 "어느 사이클"보다 먼저 결정돼야 하는 인과 순서를 그대로 반영 |

---

## 10. 코딩 컨벤션

- 파일 헤더에 `// Design Ref: §N — …` (7차 D-66 이후 관례). `prompts.ts` 헤더에
  **RK-57(connect 이전 등록)**·D-91·D-97을 명시.
- `index.ts` 배선 줄에 `// Design Ref: §2.1 — connect 이전 필수(RK-57)` 1줄.
- 본문 상수는 부록 A와 **바이트 동일**을 목표로 옮긴다(줄바꿈·들여쓰기 포함) —
  Check에서 `document_read`가 아니라 코드 Read로 부록 A와 육안 대조한다.
- 하네스 확장은 기존 `callTool` 스타일과 대칭(`ok/isError` 유니온 반환).

---

## 11. 구현 가이드

### 11.1 파일 변경 목록 (예측 — Check에서 실측 대조)

| 파일 | 상태 | 예상 규모 | 내용 |
|------|:----:|:---------:|------|
| `server/mcp/prompts.ts` | 신규 | ~130줄 (본문 상수가 대부분) | `BACKLOG_SYNC_TEXT`·`MAKE_CC_PROMPT_TEXT`·`registerPrompts` |
| `server/mcp/index.ts` | 수정 | +2줄 | import + 호출(RK-57 주석) |
| `server/l1-harness.ts` | 확장 | +~25줄 | `getPrompt(token, name, args?)` — **6T-1 채점 대상** |
| `server/prompts.l1.ts` | 신규 | ~100줄(D-98 이후, p1~p9) | p1~p9 |
| `server/mcp/tools.ts` · `shared/` · `src/` · `drizzle/` · `api/` | — | **0줄 (제약)** | C48 |

### 11.2 구현 순서

1. **[module-1 — red]** `prompts.ts`(상수+등록 함수, **배선 없음**) → `l1-harness.ts` `getPrompt`
   → `prompts.l1.ts` p1~p8 → `npm run test:l1` 실행, **p1~p6 실패(-32601)·p7~p8 통과**를
   red 기준선으로 기록
2. **[module-2 — green]** `index.ts` 2줄 배선 → `test:l1` 전건 green + `tsc -b`·`oxlint`·
   `npm test` 무회귀 → C45~C48 확정
3. **[module-3 — 실증]** 커밋·배포(`ed8dcab`) → h4(C51 curl, 성공) → 형: h1(성공) → h2 실행 중
   **projectName 인자 누락 발견**(D-98) → `prompts.ts`·`prompts.l1.ts` 재개정(p9 신설) →
   재검증 그린(22건) → 재커밋·재배포(`f9d32f8`) → C51 재실증 → 남은 h1·h2 재확인(projectName
   포함)·h3(C50)을 형이 계속 진행

### 11.3 Session Guide

| Module | 내용 | 산출 SC | 세션 |
|--------|------|---------|:----:|
| module-1 | red 기준선 (하네스·테스트 선행) | — (red 기록) | 1 |
| module-2 | 배선 + green + 무회귀 | C45~C48 | 1 (module-1과 같은 세션 가능) |
| module-3 | 배포 + 사람 실증 | C49~C51 | 형 가용 시점 |

전체 1~2세션 규모. `--scope` 분할 불요 예상.

---

## Version History

| Version | Date | Changes | Author |
|---------|------|---------|--------|
| **1.3** | 2026-08-09 | **gap-detector 정적분석(Overall 93%) 반영 — Important 2건·Minor 5건 전건 즉시 수정.** I-1: §4.1 JSON·불릿·§2.1 다이어그램이 D-98(projectName) 반영 누락 상태였던 것 정정. I-2: §5.2 "준 순서대로"를 실제 코드 동작인 "argsSchema 선언 순서대로"로 정정(코드는 이미 정답, 문서만 이탈). M-2·M-3: `p1~p8` 잔존 표기 2건을 `p1~p9`로 정정. M-4: "본문에 백틱 없음" 서술이 실제(A-2에 1건 존재, 코드는 이미 올바르게 이스케이프)와 다름을 정정. `server/prompts.l1.ts` 헤더 주석도 동기화. 세부는 Analysis §2 참조 | Claude |
| **1.2** | 2026-08-09 | **§8.3 사람 실증 전건 완료 반영** — h1(성공)·h2(D-98 재배포 후 재실증 "프로젝트 특정까지 정상")·h3(웹 커넥터 노출 확인, RK-56 우려와 반대 결과)·h4(1·2차 배포 양쪽 재확인). **C45~C51 전건 Met 확정** — Check 단계 진입 가능 | Claude |
| 1.1 | 2026-08-09 | **D-98 신설 — module-3 실증(형) 중 발견한 설계 결함 수정.** 이 계정에 워크스페이스 2개·프로젝트 4개가 실재하는데(실측: PDCA-workspace·pdcaw-cli·CogMoUp-Fishing 등) 부록 A 초안·§4·§5·§8.2에는 프로젝트를 특정하는 절차가 없었다. `argsSchema`에 `projectName`(선두) 추가, 본문에 "0. 프로젝트 확정" 절 신설, §4.2·§5.1·§5.2·§8.2·§11.1·§11.2 갱신. 코드는 이미 재구현·재검증(22건 그린)·재배포(`f9d32f8`) 완료 — 이 개정은 그 결과를 문서에 반영 | Claude |
| 1.0 | 2026-08-09 | 최초 작성 — Checkpoint 3 형 결정 ①①①(C안·D-91 A안·D-97 접두 에코) 반영해 확정. D-94~D-96은 `.tmp` 예정 확정값 승인분. red→green 순서(5차 선례) 채택 | Claude |
