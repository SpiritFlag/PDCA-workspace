---
template: plan
version: 1.3
---

# refine-cycles-hardening 계획 문서

> **한 줄 요약**: cycle-release-note(3차, 사후 문서화, Match 50%)가 이월한 **cycles 도메인 데이터
> 무결성 3건**을 닫는 마감 사이클. 새 기능 0건 — 4차(refine-mcp-hardening)가 백로그 도메인에서
> 확립한 패턴(nullable 스키마 · 명시적 해제 동선 · L1 하네스)을 cycles 도메인에 **그대로 재적용**한다.
>
> **프로젝트**: PDCA-workspace
> **작성자**: cogmo
> **작성일**: 2026-08-09
> **상태**: **Approved** (v0.2 — 형 승인 4건 반영. ②③④ 동의, **①은 형의 절충안 채택**, 2026-08-09)
> **PDCA Cycle**: refine-cycles-hardening (문서화 기준 5번째 사이클)

---

## Executive Summary

| 관점 | 내용 |
|------|------|
| **Problem** | `.optional()` vs `.nullable()` 결함이 **3번째로 재발**했다. 1번째는 2차 `closedOn`(Critical), 2번째는 4차가 닫은 그 자리, 3번째가 지금 cycles의 `name`/`yearMonth`다(3차 C-1). 3차는 PDCA 절차를 건너뛰고 구현해서, 2차가 회고에 적고 이월까지 시킨 학습이 **한 번도 다시 읽히지 않았다**(3차 회고 Try 0/3). 게다가 같은 스키마에서 `.partial()`이 pair refine을 잃어(I-1) 화면에 안 보이면서 이름 unique만 점유하는 유령 레코드를 허용하고, cycles 도메인의 **런타임 실증은 0건**(I-4)이라 이 둘이 코드 정독으로만 발견됐다. |
| **Solution** | 스코프를 **3건으로 고정**한다. ①`name`/`yearMonth` nullable + 해제 동선(C-1) ②`updateCycleSchema`에 pair rule 복원(I-1) ③cycles L1 하네스 실증 **+ 자산화**(I-4). ①②는 같은 스키마 블록을 만지므로 한 모듈. **순서를 뒤집어 하네스를 먼저 세우고 red를 확인한 뒤 고친다** — 4차는 코드→검증 순이었지만, 3차 회고가 지목한 결함이 "하네스만 돌렸으면 공짜로 잡혔을 것"이므로 이번엔 하네스가 먼저 값을 증명해야 한다. 그리고 **이번 하네스는 버리지 않고 저장소에 남긴다**(형 승인 A1) — 2차·4차가 짓고 버린 탓에 이번이 세 번째 재건축이다. |
| **Function/UX Effect** | 형이 버전 카드에서 `☐ PDCA 사이클 연결` 체크를 끄고 저장하면 **실제로 해제된다**(지금은 에러 없이 저장되고 그대로 남는다). 해제한 사이클명을 다른 버전에 다시 쓸 수 있다. `PATCH /api/cycles/:id`에 `{"name":"foo"}`만 보내면 200이 아니라 **400**이 온다. |
| **Core Value** | **"같은 결함이 세 번 나면 그건 코드 문제가 아니라 절차 문제다."** 이 사이클은 결함 3건을 고치는 동시에, 3차 회고가 제안한 절차 조치 **P-1(직전 Try 이행 현황 표)·P-2(zod 표의 "지울 수 있는가" 열)·P-3(L1 시나리오를 DoD 체크박스로)의 최초 적용 사례**가 된다. P-1은 이 문서 §1.4가, P-2·P-3은 이 사이클의 Design과 §4.1 DoD가 형식으로 집행한다. |

---

## Context Anchor

> Executive Summary에서 생성. Design/Do 문서로 전파되어 세션 간 컨텍스트 연속성 유지.

| Key | Value |
|-----|-------|
| **WHY** | `.optional()`/`.nullable()` 결함의 3번째 재발(3차 C-1)과, 그것이 코드 정독으로만 발견된 이유(I-4 런타임 실증 0건)를 **같은 사이클에서** 닫는다. 재발의 원인은 코드가 아니라 "회고가 다음 Plan에서 다시 읽히지 않음"이므로, 재발 방지 장치(P-1~P-3)를 이 사이클 문서에 형식으로 적용하는 것까지가 목적이다. |
| **WHO** | 형(cogmo) — 브라우저 실사용자이자 승인자, **브라우저·프로덕션 실증과 main 마이그레이션의 실행 주체**(4차 회고 §6.2의 실행 환경 제약 교훈) / 클로드(Claude Code CLI) — 코드·dev DB 하네스 / **claude.ai 웹 MCP 커넥터 — 이번 스코프에서는 소비자가 아니다**(cycles MCP 툴 0개, F36) |
| **RISK** | `cycleFields`가 create·update에 **공유**돼 있어 4차의 백로그 패턴(create/update 스키마 분리)이 그대로 안 맞는다(RK-19) / `pairRule`이 `null`을 "정의됨"으로 취급해 `{name:null, yearMonth:'2026-08'}`을 통과시킨다(RK-20, 실측 확인) / pair rule 강화가 **이미 존재하는 부정합 레코드를 수정 불가로** 만들 수 있다(RK-21) / 2차·4차의 L1 하네스는 **저장소에 파일로 존재하지 않는다**(F34) — "같은 파일 구조로 추가"할 원본이 없다 |
| **SUCCESS** | C17~C20 — 스코프 3건에 대응(S3만 실증/자산화로 둘). 전부 "고쳤다"가 아니라 **"실측/실증으로 닫혔다"**가 판정 기준(4차 방식). 핵심은 **C17 — 해제→저장→재조회 3단계를 API와 브라우저 양쪽에서** 확인, **C19 — 수정 전 red → 수정 후 green 순서 기록**, **C20 — 하네스가 저장소에 남아 다음 사이클이 재건축하지 않는다**(형 승인 A1). |
| **SCOPE** | 이월 3건 고정(C-1·I-1·I-4). I-2(cycles MCP 툴)·I-3(ImportDialog 단일 원천)·I-5(문서 제목 파생)·M-1~M-9·`cycles`→`releases` 리네임·Q10b 권한 개정·RULE.md/템플릿 개정은 전부 스코프 외(§2.2에 재이월 명시). |

---

## 1. Overview

### 1.1 목적

1. **cycles 도메인 데이터 무결성 3건을 실증으로 닫는다** — "코드를 고쳤다"가 아니라 "고친 결과를
   눈으로 확인했다"까지가 완료 조건이다. C-1은 해제→저장→재조회 3단계를 API와 브라우저 양쪽에서 본다.
2. **4차가 확립한 패턴을 도메인만 바꿔 재적용한다** — 4차 D-19(해제=`null` 명시 전송)·D-20(nullable
   스키마)·D-27(명시적 해제 동선)·§10 규약(nullable 여부를 Design 표에 명시 결정). 새 판단을 만들지
   않고, **이미 값을 지불한 판단을 옮겨 붙이는 것**이 이 사이클의 성격이다.
3. **재발 방지 장치를 문서 형식으로 집행한다** — P-1은 §1.4 표로, P-2·P-3은 Design과 §4.1 DoD로.
   단 **RULE.md·템플릿 자체의 개정은 하지 않는다**(§2.2) — 이번엔 "이 사이클 문서에 형식을
   적용"까지다. 형식이 실제로 값을 하는지 확인한 뒤에 규칙으로 승격하는 게 순서다.

### 1.2 배경

3차 사이클(cycle-release-note)은 **PDCA 절차 없이 구현하고 사후에 문서를 쓴** 유일한 사이클이다.
그 report §6.4의 결론이 이 사이클의 근거다 — "구조가 강제하는 축은 절차 없이도 만점(계층 6/6,
보안·회귀 9/9)이었고, 사람의 기억에 의존하던 축만 0점(회고 Try 0/3, 런타임 실증 0/11)이었다."

0점이 난 두 축이 정확히 이번 스코프 3건을 만들었다:

- **회고 Try 0/3 → C-1**. 2차가 `closedOn`에서 Critical로 잡고, 회고 Try D1("날짜·선택 필드의
  `.nullable()` 여부를 명시 결정")로 합의하고, 이월까지 시킨 결함이 **3차에서 `name`/`yearMonth`에
  그대로 재현**됐다. 4차 report §6.3도 이 재발을 "나중에 확인했다"고 기록하며 "규약을 문서에 적는
  것과 다음 세션이 그 문서를 실제로 참조하는 것 사이의 간극"을 다음 과제로 남겼다.
- **런타임 실증 0/11 → I-4, 그리고 I-1의 발견 경위**. 2차의 `app.request()` 실 DB 하네스는 정렬
  SQL 캐스팅 버그를 잡은 실적이 있는 도구인데 3차에서 0회 사용됐다. 그 결과 C-1·I-1은 코드
  정독으로만 발견됐고, 둘은 3차 design §8.2 시나리오 **#10·#5에 정확히 대응**한다 — 하네스만
  돌렸으면 자동으로 잡혔을 결함이다(3차 analysis I-4).

그리고 3차 analysis §7이 제시한 선택지 중 형이 고른 방향이 **B**(C-1·I-1·I-4를 묶어 다음
사이클에서)였다. 4차는 2차 이월분을 먼저 닫았고, 이번이 3차 이월분 차례다.

### 1.3 확정 사실 (실측)

Plan 작성 시점에 현재 저장소(HEAD `39cb3ba`)를 직접 읽고 **런타임에 돌려서** 확정한 사실이다.
Design은 이 표를 전제로 한다. **추정은 표에 넣지 않았다** — 확인 못 한 것은 §6.2 검증 항목으로 내렸다.

> **식별자 규약**: 사실 `F28~`, 요구사항 `FR-39~`, 성공기준 `C17~`, 리스크 `RK-19~`, 결정 `D-29~`.
> 스코프 `S1~S3`과 모듈 번호는 사이클마다 리셋되므로 이 문서 안에서는 언제나 이번 사이클의 것이다.
> **⚠️ `D-19`~`D-26`은 3차와 4차 두 사이클에 각각 존재한다**(F39) — 이 문서는 반드시
> "3차 D-26" / "4차 D-20"처럼 사이클을 붙여 쓴다.

| # | 확인 항목 | 결과 | 근거 |
|---|-----------|------|------|
| **F28** | **3차 analysis 작성 이후 cycles 대상 코드 무변경** | `server/services/cycles.ts`·`server/routes/cycles.ts`·`server/db/scoped.ts`·`server/db/schema.ts`·`src/features/cycle/**` **전부 무변경**. `shared/schema.ts`는 4차가 29줄 추가했지만 **cycles 구간(107~140행) 변경 0건** | `git diff --numstat ed55e16..HEAD` + `git diff … shared/schema.ts \| grep -i cycle` (빈 출력) |
| **F29** | cycles zod 스키마 현행 전문 | `cycleFields`(122~127): `version` 필수 / `releaseNote.optional()` / **`name: cycleNameSchema.optional()`** / **`yearMonth: yearMonthSchema.optional()`** — `.nullable()` 없음. `cyclePairRule`(130~131) = `(v.name===undefined)===(v.yearMonth===undefined)`. `createCycleSchema = cycleFields.refine(cyclePairRule)`(133). **`updateCycleSchema = cycleFields.partial()`(139) — refine 미부착**. `cycleFields`·`cyclePairRule` 둘 다 **미export**(모듈 로컬) | `shared/schema.ts:107-140` |
| **F30** | **현행 스키마 런타임 실측 (C-1·I-1 결함 지점 확정)** | `updateCycleSchema.safeParse({name:'x'})` → **OK**(I-1 확정) / `{yearMonth:'2026-08'}` → **OK**(I-1 대칭 확인) / `{name:null}` → **FAIL** "expected string, received null" / `{name:null,yearMonth:null}` → **FAIL** (C-1의 zod 층 확정) / `{}` → OK / `createCycleSchema.safeParse({version,name})` → FAIL(pair rule 정상 동작) | 임시 스크립트 `tsx` 실행(2026-08-09) |
| **F31** | **서버 update 흐름은 이미 정상일 가능성이 높다 (4차 F13 재현)** | `services/cycles.ts:29-38` `updateCycle`은 input을 **가공 없이** `db.updateCycle`에 넘긴다. `db/scoped.ts:308-325`가 `.set({ ...input, updatedAt })`로 **그대로 스프레드** → zod가 `null`을 통과시키면 Drizzle이 컬럼 NULL로 UPDATE한다. 중복 검사도 `if (input.name && input.name !== existing.name)`(315)이라 **`null`이면 건너뛴다**(정상) | `server/services/cycles.ts`·`server/db/scoped.ts` 전수 |
| **F32** | UI가 실제로 보내는 값 | `CycleForm.tsx:34-42` `toggleLink(false)` → `setValue('name', undefined)`·`setValue('yearMonth', undefined)` → **JSON 직렬화에서 키가 사라짐** → 서버는 "변경 없음"으로 해석. 이 두 줄이 C-1의 "조용한 실패" 경로다. 저장 경로: `CycleList.tsx:58-67 handleUpdate` → `useUpdateCycle` → `api.ts:20-25 updateCycleRequest`(`json: input` 그대로) — **중간에 가공 0곳** | `src/features/cycle/{components/CycleForm.tsx, components/CycleList.tsx, hooks/useCycles.ts, api.ts}` |
| **F33** | **폼이 수정 모드에서도 `createCycleSchema`를 쓴다** | `CycleForm.tsx:29` `resolver: zodResolver(createCycleSchema)`, `onSubmit: (input: CreateCycleInput)`. 수정 경로(`CycleList.tsx:142`)도 이 폼을 재사용 → **update 전용 스키마에만 nullable을 넣으면 폼이 그 값을 만들 수 없다** | 동일 |
| **F34** | **2차·4차의 L1 하네스는 저장소에 없다** | 정식 테스트 6파일(`server/lib/path.test.ts`·`shared/schema.test.ts`·`shared/transition.test.ts`·`buildDocTree`·`versionSort`·`extractLinks`)뿐이고, 저장소 전체에서 `app.request` 참조 **0건**. 4차 analysis §197행이 사유를 명시 — "스크립트는 실행 후 삭제(정식 테스트 파일 아님)". `scripts/`에도 `import-docs.mjs` 하나뿐 | `grep -rl "app.request"` 전수, `find … *.test.ts`, 4차 analysis |
| **F35** | 하네스 실행 환경 | `vitest.config.ts` = node 환경 + `@`/`@shared` alias. `.env.local`의 `DATABASE_URL`이 **Neon dev 브랜치**를 가리킴(파일 주석 명시). `npm run dev:api`가 `set -a && . ./.env.local` 방식으로 env를 주입 → 하네스도 같은 방식 재현 가능. 앱 조립은 `server/app.ts`(`/cycles/*`에 `authMiddleware` 후 `cycleItemRoute`, `/projects/*`에 `projectCyclesRoute`) | `vitest.config.ts`·`package.json`·`.env.local`·`server/app.ts:21-40` |
| **F36** | **cycles MCP 툴은 0개다 (I-2 재확인)** | `server/mcp/tools.ts`의 `registerTool` **8건** — `project_list`·`document_list/read/write`·`backlog_list/create/update/reorder`. `server/mcp/` 전체에서 문자열 `cycle` **0건** | `grep -n registerTool`, `grep -rn cycle server/mcp/` (빈 출력) |
| **F37** | **DB 스키마 변경·마이그레이션 0건** | `cycles` 테이블(`db/schema.ts:82-101`)의 `name`(91)·`year_month`(92)는 **이미 nullable**(notNull 없음). 유일 인덱스 `cycles_proj_name_uq`(98)는 postgres 규칙상 **NULL을 서로 다른 값으로 취급**하므로 미연결 버전이 여럿이어도 충돌하지 않는다(3차 D-26이 이미 이 근거로 채택됨). `drizzle/0000~0003` 그대로 | `server/db/schema.ts` |
| **F38** | 3차 design §8.2 L1 시나리오 목록 전문 | 아래 §1.3.2 표 (11개) | `cycle-release-note.design.md` §8.2 |
| **F39** | **결정 번호 `D-19`~`D-26`이 두 사이클에 중복 존재** | 3차 report §1.5의 D-19~D-26(1급=버전, 릴리즈노트 컬럼, versionSort, `cycleStagePath` 단일 원천, 삭제 UI 제거, 상주 Hono, 팔레트 규약, name nullable+unique)과 4차 §7.2의 D-19~D-28(처리일 null, zod 형태, MCP null 배제, …)이 **번호가 정면으로 겹친다**. 3차가 사후 문서라 4차와 독립적으로 번호를 매긴 결과 | 두 문서 대조 |
| **F40** | **하네스 자산화 절충안(형 제안)이 3축 전부 성립한다 — 실측** | ①**기본 `vitest run`이 `*.l1.ts`를 안 잡는다**: 기본 include가 `*.{test,spec}.*`라 파일을 추가해도 `6 passed (6) / 49 passed (49)` 그대로 ②**별도 config + skip 가드가 동작한다**: `vitest.l1.config.ts`(`include:['**/*.l1.ts']`) + `describe.skipIf(!process.env.DATABASE_URL)` → DB 없으면 `1 skipped`, 있으면 `1 passed` ③**타입·린트가 커버한다**: `server/` 아래 두면 `tsconfig.server.json`의 `include:["server","api",…]`에 자동 포함돼 `tsc -b` 통과, `oxlint` 클린. env 주입은 `set -a && . ./.env.local && set +a`(package.json `dev:api`와 동일 패턴) | 임시 파일 2개(`server/probe.l1.ts`·`vitest.l1.config.ts`)로 3케이스 실행 후 삭제, 저장소 원상 복구 확인(2026-08-09) |

**F31이 이 사이클의 구현 범위를 절반으로 줄인다.** 3차 analysis C-1의 수정 방향은 "서버
`updateCycle`이 `null`을 지우기로 해석"이라고 적고 있지만, 실측하면 서버는 **이미 그렇게 동작한다** —
스프레드가 null을 그대로 컬럼 NULL로 반영하고 중복 검사도 null을 올바르게 건너뛴다. 4차에서
`server/services/backlog.ts`가 무변경으로 확정된 것(4차 F13)과 **같은 형태의 정정**이다. 즉
서버 수정은 **zod뿐이고 서비스·scoped·라우트는 무변경**이며, 남은 절반은 순수하게 UI(F32)다.

**F33이 4차 패턴의 직수입을 막는다.** 백로그는 `createBacklogItemSchema`(81행)와
`backlogItemFields`(90행)가 **분리**돼 있어서 `closedOn`을 update 쪽에만 nullable로 둘 수 있었다.
cycles는 `cycleFields` 하나를 create·update가 공유하고 폼도 `createCycleSchema`로 검증한다 —
**nullable을 어디에 넣을지가 이번 사이클의 고유한 설계 판단**이다(D-31, RK-19).

**F34는 결함 보고가 아니라 삭제 선례의 비용 증명서다**(형 지적, §1.5.1 A1). 2차가 하네스를 짓고
버렸고, 4차가 다시 지어 또 버렸다. 이번이 **세 번째 재건축**이고, 그 비용은 §6.2 검증 4
("인증 골격을 어떻게 만들었는지 재확인·재현")로 이미 이 문서에 청구서로 올라와 있다. 다음
사이클(I-2 cycles MCP 툴)도 하네스를 필요로 하므로 **네 번째가 예약돼 있다.** v0.1이 이 사실을
"선례 일관"의 근거로 읽은 것이 판단 착오였고, F40이 "선례를 깨는 비용"이 0에 가까움을 실측으로
확정했다 — 그래서 D-35를 뒤집는다.

#### 1.3.1 후보 수정 형태의 사전 실측 (D-31·D-32 근거)

`cycleFields`에 `.nullable()`을 넣고 `partial()` **뒤에** pair rule을 재부착하는 형태를 실제로
돌려봤다. 결과가 C-1과 I-1을 **한 형태로 동시에 닫는다**:

| # | 입력 (`fields.partial().refine(pairRule)`) | 결과 | 의미 |
|---|---|:---:|---|
| A1 | `{name:null, yearMonth:null}` | **OK** | C-1 해제 성립 |
| A2 | `{name:'x'}` 단독 | **FAIL** `pair` | **I-1 차단** |
| A3 | `{name:'x', yearMonth:'2026-08'}` | OK | 연결/변경 정상 |
| A4 | `{}` | OK | 무변경 PATCH 무회귀 |
| A5 | `{releaseNote:'r'}` | OK | 부분 수정 무회귀 |
| A6 | `{name:null}` 편측 해제 | **FAIL** `pair` | 편측 해제도 차단 |
| — | `refinedSchema.partial()` 직접 호출 | **throw** `".partial() cannot be used on object schemas containing refinements"` | F29가 `updateCycleSchema`를 refine 없이 만든 이유(2차 F7 규약의 근거)가 런타임으로 확인됨 |

**A2·A6이 성립하면 병합 상태 부정합이 구조적으로 불가능해진다**: 패치는 두 필드를 "둘 다 포함"
또는 "둘 다 미포함"으로만 보낼 수 있고, 둘 다 포함이면 패치 자체가 pair rule을 만족하며, 둘 다
미포함이면 병합 결과는 기존 레코드와 같다. 기존 레코드가 정합이면(생성 경로가 refine으로 강제)
**귀납적으로 항상 정합**이다 — 즉 서비스 계층 병합 재검증 없이 zod만으로 I-1이 닫힌다.
다만 이 논증은 **"기존 레코드가 이미 정합"을 전제**하므로, 수정 전 부정합 레코드 존재 여부를
먼저 확인해야 한다(§6.2 검증 3, RK-21).

**한 가지 함정**: 위 `pairRule`은 `undefined` 기준 비교라 **`{name:null, yearMonth:'2026-08'}`을
통과시킨다**(null은 `undefined`가 아니므로 "둘 다 정의됨"). nullable로 확장하는 순간 규칙 술어도
같이 고쳐야 한다 — §6.2 검증 1, RK-20.

#### 1.3.2 3차 design §8.2 L1 시나리오 (F38, 전문) + 이번 채택 범위

| # | 시나리오 | 3차가 적은 기대 | 이번 채택 | 비고 |
|:-:|----------|------|:---:|------|
| 1 | 미인증 `GET /api/projects/:id/cycles` | 401 | ✅ | 하네스 골격 검증 겸 |
| 2 | 타인 프로젝트의 cycles 조회 | 404 | ✅ | ownerId 2단 조인 경계 |
| 3 | 사이클 미연결 버전 생성 | 201, name·yearMonth null | ✅ | C-1 수정의 create 측 무회귀 |
| 4 | 사이클 연결 버전 생성 | 201, 둘 다 저장 | ✅ | 동일 |
| 5 | `name`만 보내고 `yearMonth` 생략 | **400 기대 / 실제 201** | ✅ **필수** | **I-1 재현 — red 대상** |
| 6 | 같은 version 재생성 | 409 `target:'version'` | ✅ | |
| 7 | 같은 name 재생성 | 409 `target:'name'` | ✅ | C-1 부수 피해(unique 점유)의 짝 |
| 8 | 잘못된 버전 형식(`0.1.0`) | 400 | ✅ | |
| 9 | 한글 사이클명 | 400 | ✅ | (I-3의 ImportDialog 경로는 스코프 외) |
| 10 | PATCH로 사이클 연결 해제 시도 | **해제 기대 / 실제 무시** | ✅ **필수** | **C-1 재현 — red 대상** |
| 11 | DELETE 후 재조회 | 404, 문서는 잔존 | ✅ | |

**채택 범위 = 11개 전건**(D-36). 근거: I-4가 닫으려는 것은 "cycles 런타임 실증 **0건**"이라는
상태 자체이고, 하네스 비용의 대부분은 인증·시드·정리 골격이지 시나리오 1건의 추가가 아니다.
11개는 그 골격 위에서 거의 공짜다. 여기에 C-1·I-1의 **회귀 고정용 신규 4건**을 더한다:

| # | 신규 시나리오 | 기대 | 닫는 것 |
|:-:|---|---|:---:|
| n1 | `PATCH {name:null, yearMonth:null}` → 재조회 | 200, **둘 다 `null`** | C-1 ②③ |
| n2 | n1 이후 **같은 name을 다른 버전에 부여** | 201 (409 아님) | C-1 부수 피해(unique 점유) 해소 |
| n3 | `PATCH {yearMonth:'2026-08'}` 단독 | 400 | I-1 대칭(F30에서 현재 통과 확인) |
| n4 | `PATCH {releaseNote:'x'}` 단독 | 200, name·yearMonth 유지 | pair rule 강화의 **무회귀** |

### 1.4 직전 사이클 Try 이행 현황 — **P-1 최초 적용**

> 3차 report §6.3의 **P-1**("새 Plan 문서에 '직전 사이클 Try 이행 현황' 표를 필수 섹션으로 둔다")을
> 처음으로 적용한 표다. 3차가 회고 Try 0/3을 낸 이유는 그 표가 없어서 **Try가 어디에서도 다시
> 읽히지 않았기** 때문이다. 대상은 **4차 report §6.3 전건 + 3차 report §6.3 P-1~P-5**.

#### 1.4.1 4차(refine-mcp-hardening) report §6.3

| # | Try 원문 요지 | 이행 | 사유 (한 줄) |
|:-:|---|:---:|---|
| 4T-1 | 프로덕션 인프라를 건드리는 검증 단계는 "이 환경에서 이 작업을 실행할 **권한이 실제로 있는가**"를 Design §6.2 검증 항목에 명시 포함 | ✅ | 이번엔 Plan 단계에서 이미 실행 주체를 못박았다 — dev DB 하네스는 클로드, **브라우저 실증(C17 후반)과 main 마이그레이션은 형**(§5 RK-22·§9). 다만 F37로 **마이그레이션 0건**이라 프로덕션 DB 접근 자체가 이번 스코프에 없다 |
| 4T-2a | Design §10 승격 규약 ①"날짜·선택 필드의 `.nullable()` 여부를 Design 표에 명시 결정"이 다음 사이클에서 실제로 지켜지는지 | ✅ | **이 사이클이 그 규약의 시험대 그 자체다.** P-2 형식(§1.4.2)으로 Design zod 표에 "지울 수 있는가" 열을 강제해, 권고가 아니라 형식으로 집행한다 |
| 4T-2b | 동 규약 ②"MCP 툴 입력은 `shared/schema.ts` 재사용" | **N/A** | cycles MCP 툴이 **0개**(F36)라 적용 대상이 없다. I-2(cycles MCP 툴 신설)는 재이월(§2.2)이며, **착수 시 이 규약과 D-34를 함께 적용할 것**을 재이월 표에 명시했다 |
| 4T-3 | (§7.2) 규약을 다음 Plan/Design 작성 시 **자동으로 다시 읽게 할 방법** 검토 | ⚠️ 부분 | 이 §1.4 표가 그 첫 수단이다. 다만 "자동"은 아니고 **문서 형식에 의한 강제**다. 자동화(체크리스트 도구화·RULE.md 개정)는 **스코프 외**(§2.2) — 형식이 값을 하는지 한 사이클 확인한 뒤 승격하는 게 순서 |

#### 1.4.2 3차(cycle-release-note) report §6.3 — P-1~P-5

| # | Try 원문 요지 | 이행 | 사유 (한 줄) |
|:-:|---|:---:|---|
| **P-1** | 새 Plan 문서에 "직전 사이클 Try 이행 현황" 표를 필수 섹션으로 | ✅ | **이 표(§1.4)가 최초 사례.** 대상을 직전 1개 사이클이 아니라 **4차 전건 + 3차 P-1~P-5**로 잡았다 — 3차가 사후 문서라 4차와 이월이 교차하기 때문 |
| **P-2** | zod 필드 정의 시 Design 표에 **"지울 수 있는가" 열**을 필수로 | ✅ (Design에 적용 예정) | **이번 Design의 zod 필드 표에 이 열을 넣는 것을 Plan이 명시 지시한다**(§8.2). 대상 필드는 `version`·`releaseNote`·`name`·`yearMonth` 4개 전부 — `name`/`yearMonth`가 "예"로 판정될 자리이고, 3차가 그 판정을 안 해서 C-1이 났다 |
| **P-3** | Design §8 Test Plan의 **L1 시나리오를 DoD 체크박스로** 옮긴다 (기준을 "작성"이 아니라 "실행"으로) | ✅ (DoD에 선반영) | §4.1 DoD에 §1.3.2의 **11+4 시나리오를 체크박스로 이미 넣었다**. Design은 이를 §8 표로 상세화하되 **DoD 체크박스가 판정의 원본**이다 |
| **P-4** | 도메인 순수 함수를 만들면 **같은 커밋 안에서 호출부를 grep으로 전수 확인** | **N/A** | 이번 사이클은 **신규 순수 함수 0건**(스키마 한 블록 + UI 두 줄). 기존 순수 함수의 호출부 우회 문제(I-3 `ImportDialog`)는 재이월(§2.2)이며, 그 사이클에서 P-4가 본래 대상을 만난다 |
| **P-5** | 릴리즈 버전 표기의 단일 원천을 `cycles.version`으로 정하고 report §9 Changelog를 거기서 생성하는 것 검토 | ❌ | **문서 프로세스 개정**이라 RULE.md·템플릿 개정과 같은 성격이고, 이번 스코프(cycles 데이터 무결성 3건)와 층이 다르다 — §2.2에 재이월. 이번 사이클도 git tag·report §9·`cycles` 레코드 세 곳에 버전을 따로 쓰게 되며, **그 어긋남을 report에 관찰로 기록**해 승격 근거를 쌓는다 |

**이 표가 만드는 판정 기준**: 이행 ✅ 4건 · 부분 1건 · N/A 2건 · ❌ 1건. ❌·N/A는 전부
**"이번 스코프와 층이 다름"** 한 가지 사유이고, 각각 §2.2 재이월 표에 행이 있다 — 즉 이 표에서
닫히지 않은 항목이 문서 어디에서도 사라지지 않는다.

### 1.5 Checkpoint 1·2 결정 사항

형의 지시서로 스코프 3건이 이미 확정돼 있어 스코프 질문은 없다. 지시서가 **Plan에서 결정하라고
명시한 2건**과, 실측 중 새로 발견돼 **Plan이 결정해야 하는 1건**을 아래에 답한다.

| # | 질문 | 결정 | 근거 |
|---|------|------|------|
| Q12 | C-1의 **MCP 경로** 판단 — 4차 D-21처럼 "MCP는 null 미허용 + 사유 주석"으로 갈까 | **해당 없음**(→ D-34) | F36 — cycles MCP 툴이 **0개**다. 조일 스키마도, 사유를 적을 주석 자리도 없다. 4차 D-21은 `backlog_update`라는 **실재하는 툴**이 있어서 성립한 결정이었다. 대신 I-2 재이월 행에 "cycles 쓰기 툴 신설 시 `null` 허용 여부를 D-34 형식으로 명시 결정"을 **조건부 지시로 남긴다** — 결정을 지금 내리지 않되 잊지도 않는 방식 |
| Q13 | I-4 하네스의 **시나리오 채택 범위** | **3차 §8.2 11개 전건 + 신규 4건**(→ D-36) | §1.3.2 근거. 최소 요구는 #5·#10뿐이지만, 하네스 비용은 골격에 있지 시나리오 수에 있지 않다. "cycles 런타임 실증 0건"을 닫는 게 I-4의 목적이므로 전건이 맞다 |
| Q14 | **(신규)** 하네스를 **저장소 자산으로 커밋할 것인가** — F34로 "2차와 같은 파일 구조"의 원본이 없음이 확인됐다 | **커밋한다 — 단 기본 `vitest run`에서 분리 + DB 없으면 skip**(→ D-35, **형 승인 A1로 v0.1 권고를 뒤집음**) | v0.1은 "임시 스크립트 유지"를 권고했으나 형이 반론 — **F34는 삭제 선례의 비용 증명서**이고 이번이 세 번째 재건축, I-2 사이클에 네 번째가 예약돼 있다. 형의 절충안(별도 `test:l1` 스크립트 + `DATABASE_URL` skip 가드)이 v0.1 근거 ②(`npm test` 안전)를 그대로 해소하고 ③(P-3 "실행" 기준)은 DoD 체크박스가 계속 집행하므로, **남는 건 ①선례 일관 하나뿐인데 그 선례가 이번에 값을 물렸다.** F40이 절충안 3축을 실측으로 확정 |

#### 1.5.1 형 승인 (2026-08-09)

Plan v0.1의 §10 확인 포인트 4건에 대한 형의 판단. **②③④ 동의, ①은 반론 + 절충안 채택.**
이 사이클의 판단 기준선으로 확정한다.

| # | 항목 | 형의 답 | 근거 / Plan 반영 |
|:-:|------|---------|-----------------|
| **A1** | **D-35** 하네스 자산화 | **반론 — 절충안 채택**: 저장소에 커밋하되 기본 `vitest run`에서 제외(`npm run test:l1` 분리 + `DATABASE_URL` 없으면 skip 가드) | **"F34 자체가 삭제 선례의 비용 증명서다.** 2차→4차→이번, 세 번째 재건축이고 I-2도 하네스가 필요할 텐데 또 지을 거냐." 절충안이 v0.1 근거 ②를 해소하고 ③은 DoD가 집행하므로 남는 반대 근거는 ①선례 일관뿐인데 그 선례가 이번에 값을 물렸다. → **D-35 뒤집음**, F40으로 3축 실측 확정, S3에 자산화 포함(FR-51·52), RK-27 신설 |
| **A2** | **D-32** pair rule = zod(a) | **동의** | 귀납 논증 + 전제 검사(§6.2 검증 3)가 완비돼 있고, 대가(리네임 시 동반 전송)는 `CycleForm`이 항상 둘을 보내므로 UX 회귀 0이 실측으로 확인됨 |
| **A3** | **D-36** 시나리오 11+4 | **동의** | "골격이 비용이고 I-4는 '0건'이라는 상태를 닫는 항목"이라는 논리가 정확 |
| **A4** | **D-33** Design Checkpoint 유지 | **동의 — 단 형의 의견은 확인 문구 추가 쪽** | Plan 판단(동선은 이미 있고 페이로드만 틀림)도 맞지만, **해제가 이름 점유 해소라는 부수효과까지 있는 파괴적 동작**이라 확인 문구를 붙이는 쪽. 결정 시점은 Design Checkpoint 유지 → **D-33에 형의 기울기를 명시 기록** |

**A1이 이 사이클의 스코프를 한 칸 넓힌다**: S3이 "하네스를 돌린다"에서 **"하네스를 자산으로
남긴다"**로 바뀌었다. 코드 변경 대상에 `package.json`·`vitest.l1.config.ts`가 추가되고(§6),
"다음 사이클이 재건축하지 않는다"가 이 사이클의 산출물이 된다.

**A4가 D-33의 성격을 바꾼다**: Design Checkpoint는 이제 "동선을 정하라"가 아니라 **"확인 문구의
문안과 발동 조건을 정하라"**에 가깝다 — 형의 기울기가 이미 기록됐으므로, Design이 백지에서
고르는 게 아니라 그 안을 구체화하고 대안이 있으면 반증하는 자리다.

### 1.6 관련 문서

- 이월 원천(3차): [cycle-release-note.plan.md](../cycle-release-note/cycle-release-note.plan.md) ·
  [design](../cycle-release-note/cycle-release-note.design.md) ·
  [analysis](../cycle-release-note/cycle-release-note.analysis.md) ·
  [report](../cycle-release-note/cycle-release-note.report.md)
- 직전 사이클(4차, 패턴 원본): [refine-mcp-hardening.plan.md](../refine-mcp-hardening/refine-mcp-hardening.plan.md) ·
  [design](../refine-mcp-hardening/refine-mcp-hardening.design.md) ·
  [analysis](../refine-mcp-hardening/refine-mcp-hardening.analysis.md) ·
  [report](../refine-mcp-hardening/refine-mcp-hardening.report.md)
- 이월 근거: 3차 analysis §3.1(C-1)·§3.2(I-1·I-4)·§6.4(P-1~P-4) / 3차 report §4.1·§6.3·§7.2·§8.2
- 배포 절차: [docs/deploy/CHECKLIST.md](../../../deploy/CHECKLIST.md)
- 문서 규칙: [RULE.md](../../../RULE.md) / 프로젝트 규칙: [CLAUDE.md](../../../../CLAUDE.md)

---

## 2. Scope

### 2.1 In Scope — 이월 3건 고정

- [ ] **S1 [Critical] 사이클 연결 해제 가능하게** (3차 C-1) — `name`/`yearMonth` nullable +
      `pairRule` 술어 정정 + UI가 `undefined`가 아니라 **`null`**을 보낸다. 해제 동선의 **형(形)은
      Design Checkpoint에서 형이 결정**(D-33). 서버 쓰기 계층은 **F31로 무변경 확인됨**
- [ ] **S2 [Important] `updateCycleSchema` pair rule 복원** (3차 I-1) — 2차 F7 규약(필드 스키마와
      refine 분리)을 **update 경로에도** 적용. §1.3.1 실측대로 `partial()` **뒤** 재부착. S1과 같은
      스키마 블록을 만지므로 **한 모듈**
- [ ] **S3 [Important] cycles L1 하네스 실증 + 자산화** (3차 I-4) — §1.3.2의 **11+4 시나리오**.
      원칙은 **수정 전 red → 수정 후 green** (#5·#10이 red 대상). **하네스를 저장소에 남긴다**
      (D-35, 형 승인 A1) — 기본 `vitest run`에서 분리 + `DATABASE_URL` 없으면 skip(F40).
      **세 번째 재건축을 마지막으로 만드는 것**이 이 항목의 절반

### 2.2 Out of Scope — 재이월 기록

> 스코프 3건 외는 전부 여기에 명시적으로 재이월한다. **재이월의 1차 원천은 백로그 보드**이며,
> 아래 표는 "이번 사이클이 안 한 것"의 기록이다. 실제 순서·착수는 형이 보드에서 정한다(4차 D-25 연장).

| 항목 | 출처 | 왜 이번에 안 하는가 |
|------|------|--------------------|
| **I-2 cycles MCP 툴 신설**(`cycle_list`·`cycle_read`) | 3차 analysis I-2 | 신규 기능이라 "새 기능 0건" 원칙에 반한다. **착수 시 조건부 지시**: 쓰기 툴을 만들면 `name`/`yearMonth`의 `null` 허용 여부를 **4차 D-21 형식으로 명시 결정**하고(D-34), 입력 스키마는 `shared/schema.ts` 재사용(4T-2b)한다 |
| **I-3 `ImportDialog` 단일 원천 정리** | 3차 analysis I-3 | `cycleStagePath`·`yearMonth.ts`·`cycleNameSchema` 3중 우회. 데이터 무결성이 아니라 DRY 문제이고, M-8·M-9와 함께 처리하는 게 효율적. **P-4가 본래 대상을 만나는 사이클** |
| **I-5 문서 제목 파생 규칙** | 3차 analysis I-5 | 사이드바 식별성 회귀. UI 표시 문제로 이번 축(데이터 무결성)과 다름 |
| **M-1~M-9** (사이드바 자동펼침 / 워크스페이스 N요청 / 버전 앵커 / `vercel.json` dev 예외 / `details.target` 표 미등재 / `cycles` 용어 괴리 / `catppuccin.css` 이름 / 미처리 rejection / dead code 2건) | 3차 analysis §6.3 | 전부 Minor. 3차 report가 이미 "낮음"으로 판정 |
| **`cycles` → `releases` 리네임** | 3차 report §7.2 M-6 | 테이블·라우트·feature 디렉터리 전면 리네임 — 이 마감 사이클의 몇 배 크기이고, 이번 스코프의 스키마 수정과 충돌하면 diff가 뒤섞인다. **이번 사이클 이후에 하는 게 맞다** |
| **Q10b 권한 경계 개정** | 2차 이월 | cycles와 무관. 백로그 상태 전이 축 |
| **"해소/완료" 명문화** | 누적 이월 | 용어·프로세스 정의 건 |
| **RULE.md·plan/design 템플릿의 P-1~P-3 개정 자체** | 3차 P-1~P-3, 4차 §7.2 | **명시적 재이월.** 이번 사이클은 §1.4·§4.1·§8.2로 **이 문서에 형식을 적용**하는 데까지만 간다. 형식이 실제로 값을 하는지 한 사이클 확인한 뒤 규칙으로 승격하는 게 순서다(§1.1-3) |
| **P-5 릴리즈 버전 표기 단일 원천화** | 3차 report §6.3 P-5 | 문서 프로세스 개정 — 위와 같은 층. 이번 사이클의 버전 표기 어긋남은 **report에 관찰로 기록**해 승격 근거를 쌓는다 |
| `backlog_reorder` MCP 툴 실행 확인 | 4차 report §4.1 | 백로그 축. 4차가 "낮음"으로 이월 |
| OAuth 2.1 정식 지원 | 4차 C13 | 승격 근거는 쌓였으나 형이 보류 결정 |
| 1차 사이클 기존 깨진 링크 11건 | 4차 report §4.1 | 이번 사이클과 무관한 파일 |
| 번들 최적화·코드 분할 | 2차 F9 | 4연속 이월. 이번에도 스코프 외 |

---

## 3. Requirements

### 3.1 기능 요구사항

| ID | 요구사항 | 스코프 | 우선순위 | 상태 |
|----|----------|:---:|:--------:|------|
| FR-39 | `cycleFields`의 `name`·`yearMonth`가 `null`을 허용한다 (배치 위치는 D-31, 형태는 4차 D-20 준용) | S1 | High | Pending |
| FR-40 | `cyclePairRule` 술어가 **`null`을 "미연결"로 취급**한다 — `{name:null, yearMonth:'2026-08'}`이 거부된다(RK-20) | S1 | High | Pending |
| FR-41 | `createCycleSchema`가 `{name:null, yearMonth:null}`을 **미연결 생성으로 통과**시키고, 기존 `{}`(키 생략) 경로도 그대로 통과한다(무회귀) | S1 | High | Pending |
| FR-42 | `CycleForm.toggleLink(false)`가 `undefined`가 아니라 **`null`을 세팅**해 PATCH 본문에 키가 실린다(F32) | S1 | High | Pending |
| FR-43 | 해제 동선이 화면에서 명확하다 — 기존 체크박스만으로 충분한지, 4차 D-27식 명시 동선을 추가할지 **Design Checkpoint에서 형이 결정**(D-33) | S1 | Medium | Pending |
| FR-44 | `updateCycleSchema`가 `cycleFields.partial()` **뒤에** pair rule을 재부착한다 — `{name:'x'}` 단독 PATCH가 400 | S2 | High | Pending |
| FR-45 | pair rule 강화가 부분 수정을 막지 않는다 — `{releaseNote}` 단독·`{version}` 단독·`{}`가 전부 200(무회귀) | S2 | High | Pending |
| FR-46 | pair rule 술어·메시지 상수를 **export해 단일 원천화**한다 — `documentKindStageRule`/`DOCUMENT_KIND_STAGE_MESSAGE`(schema.ts:45-47)가 4차에서 세운 선례 | S2 | Medium | Pending |
| FR-47 | cycles L1 하네스가 §1.3.2 **11+4 시나리오**를 실행한다 | S3 | High | Pending |
| FR-48 | 하네스를 **수정 전에 먼저 돌려** #5·#10의 red를 기록하고, 수정 후 green을 기록한다 — 두 결과 모두 analysis에 남는다 | S3 | High | Pending |
| FR-49 | `shared/schema.test.ts`에 cycles L0 케이스 추가 — 4차가 `closedOn`에 t1~t3을 넣은 것과 같은 형태(§4.1) | S3 | High | Pending |
| FR-50 | 하네스 실행이 dev DB에 **잔여 데이터를 남기지 않는다** — 생성한 레코드는 시나리오 종료 시 정리(RK-22) | S3 | High | Pending |
| FR-51 | **하네스가 저장소에 커밋된다**(D-35·A1) — 파일은 `server/` 아래 `*.l1.ts`(F40 ③으로 `tsc -b`·`oxlint` 자동 커버), 실행은 `npm run test:l1`(`vitest.l1.config.ts` + `.env.local` 주입). **기본 `npm test`의 결과가 이 사이클 전후로 달라지지 않는다** | S3 | **High** | Pending |
| FR-52 | 하네스가 **`DATABASE_URL` 부재 시 skip**된다(실패가 아니라 skip) — `describe.skipIf` 가드(F40 ②) | S3 | **High** | Pending |
| FR-53 | 하네스 파일 상단에 **재사용 지침 주석**을 남긴다 — 실행법·env 요구·데이터 격리 규칙·시나리오 추가 위치. **다음 사이클(I-2)이 재건축 대신 확장하게 하는 것**이 D-35의 목적이므로, 자산화는 파일 존재만으로 끝나지 않는다 | S3 | Medium | Pending |

### 3.2 비기능 요구사항

| 범주 | 기준 | 측정 방법 |
|------|------|-----------|
| 무회귀 | 기존 cycles REST 4엔드포인트 응답이 S1·S2 후에도 동일 — 특히 **`name`/`yearMonth` 키 생략 PATCH가 "변경 없음"** | L1 하네스 #3·#4·n4 |
| 무회귀 | 정식 테스트 49건(4차 기준) 전부 통과 + 신규분 | `vitest run` |
| 무회귀 | `tsc -b` + `oxlint` 통과 — `CreateCycleInput`/`UpdateCycleInput` 타입 파급(RK-19)을 컴파일러로 전수 확인 | 명령 실행 |
| 무회귀 | 4차 L1 시나리오(백로그·MCP)에 영향 없음 — `shared/schema.ts`를 만지므로 import 시점 런타임 에러 회귀 확인 | `shared/schema.test.ts` 스모크(파일 최상단 주석의 그 목적) |
| 데이터 | 수정 후 dev DB에 **부정합 레코드 0건**(`name` XOR `yearMonth`가 NULL) | 실 쿼리 1회 (§6.2 검증 3) |
| 실증 | cycles 런타임 실증 건수가 **0 → 15**(11+4) | 하네스 실행 로그 |
| 무회귀 | **기본 `npm test`의 동작이 이 사이클 전후로 동일** — 파일 수는 6 유지(`*.l1.ts` 미포함, F40 ①), 건수는 L0 추가분(FR-49)만 증가. `DATABASE_URL` 없는 환경에서도 `npm test`가 그린 | `npm test` 전후 대조 + `env -u DATABASE_URL npm test` |
| 자산 | 하네스가 **다음 사이클에서 재건축 없이 확장 가능**하다 — 실행법·env·격리 규칙·시나리오 추가 위치가 파일에서 읽힌다 | FR-53 주석 + `npm run test:l1` 재실행 |
| 문서 | 저장소 마크다운 링크 신규 깨짐 0건 (RULE.md 종료 절차 1) | 링크 추출 후 파일 존재 확인 |

---

## 4. Success Criteria

> **스코프 3건에 대응.** S1→C17, S2→C18, **S3→C19(실증)·C20(자산화)** — S3만 둘로 나뉘는 이유는
> 형 승인 A1로 "돌린다"에 "남긴다"가 더해졌기 때문이다. 판정 기준은 전부 "고쳤다"가 아니라
> **"실측/실증으로 닫혔다"**다(4차 방식).

| ID | 스코프 | 기준 | 검증 방법 |
|----|:---:|------|-----------|
| **C17** | S1 | **사이클 해제 3단계 실증** — ①연결된 버전을 재조회하면 `name`·`yearMonth`가 있다 ②`PATCH {name:null, yearMonth:null}`이 2xx ③**재조회에서 둘 다 `null`**. 여기에 **④브라우저에서 체크 해제→저장→새로고침 시 카드가 미연결로 표시**(4버튼이 사라진다) ⑤**해제한 사이클명을 다른 버전에 부여 → 409가 아니라 성공**(부수 피해 해소) | 하네스 n1·n2 + **형이 브라우저에서 직접**(API만으론 F32를 못 닫는다 — 4차 C11과 같은 구조) |
| **C18** | S2 | `PATCH {name:'x'}` 단독과 `PATCH {yearMonth:'…'}` 단독이 **둘 다 400**이고, `{releaseNote}`·`{version}`·`{}` 부분 수정은 **전부 200**(무회귀). 그리고 **dev DB의 부정합 레코드가 0건** | 하네스 #5·n3·n4 + 실 쿼리 1회 |
| **C19** | S3 | §1.3.2 **15개 시나리오 전건 실행**되고, **#5·#10이 수정 전 red → 수정 후 green으로 기록**된다. 실행 없이 "작성"만 된 시나리오가 0건이면 충족, 1건이라도 미실행이면 미충족 | 하네스 2회 실행(module-1 red / module-2 green) 결과를 analysis에 표로 |
| **C20** | S3 | **하네스가 자산으로 남는다**(A1) — ①파일이 커밋돼 있다 ②`npm run test:l1`으로 재실행된다 ③**`DATABASE_URL` 없이 실행하면 skip**(실패 아님) ④**기본 `npm test`가 이 사이클 전후로 동일하게 동작**(현 6파일 49건 + 이번 L0 추가분만 증가, `*.l1.ts`는 미포함) | 4가지 전부 명령 실행으로 확인 — `env -u DATABASE_URL npm run test:l1`(skip) / `npm run test:l1`(실행) / `npm test`(파일 수·건수 대조) |

### 4.1 Definition of Done

- [ ] FR-39~FR-53 구현 (Medium 미달 시 사유 명시)
- [ ] C17~C20 전부 충족

**L1 시나리오 실행 체크박스 — P-3 적용** (기준은 "작성"이 아니라 **"실행"**. Design §8이 이 목록을
상세화하되 **판정의 원본은 이 체크박스**다):

- [ ] #1 미인증 조회 → 401
- [ ] #2 타인 프로젝트 조회 → 404
- [ ] #3 미연결 버전 생성 → 201, 둘 다 null
- [ ] #4 연결 버전 생성 → 201, 둘 다 저장
- [ ] **#5 `name`만 전송 → 400** (수정 전 red 기록 필수)
- [ ] #6 같은 version 재생성 → 409 `target:'version'`
- [ ] #7 같은 name 재생성 → 409 `target:'name'`
- [ ] #8 잘못된 버전 형식 → 400
- [ ] #9 한글 사이클명 → 400
- [ ] **#10 PATCH로 연결 해제 → 해제됨** (수정 전 red 기록 필수)
- [ ] #11 DELETE 후 재조회 → 404, 문서는 잔존
- [ ] n1 `{name:null, yearMonth:null}` → 재조회 둘 다 null
- [ ] n2 해제한 name을 다른 버전에 부여 → 201
- [ ] n3 `{yearMonth}` 단독 → 400
- [ ] n4 `{releaseNote}` 단독 → 200, 연결 유지

**나머지 DoD**

- [ ] `shared/schema.test.ts`에 cycles L0 케이스 추가(FR-49) — 최소 4: `updateCycleSchema`가
      ①`{name:null,yearMonth:null}` 통과 ②`{name:'x'}` 거부 ③`{releaseNote}` 통과
      ④`{name:null,yearMonth:'2026-08'}` 거부(RK-20 고정)
- [ ] `tsc -b` · `oxlint` · `vitest run` 통과
- [ ] **하네스 자산화 4종 확인(C20)** — ①파일 커밋 ②`npm run test:l1` 재실행 ③`env -u DATABASE_URL npm run test:l1` → **skip**(실패 아님) ④`npm test`가 `*.l1.ts`를 안 잡는다(파일 수·건수 대조)
- [ ] 하네스 파일 상단 재사용 지침 주석(FR-53) — 다음 사이클이 확장할 지점이 읽힌다
- [ ] dev DB 부정합 레코드 0건 확인 쿼리 실행 + 결과 기록
- [ ] 하네스가 남긴 테스트 데이터 정리 확인(FR-50)
- [ ] `analysis` 문서로 Gap 분석 — **스코프 3건이 닫혔는지만** 본다(전면 재분석 아님, 4차 RK-18 방식)
- [ ] `report` 문서 + `_INDEX.md` 행 추가 + 링크 전수 검증 + git diff txt 저장(RULE.md 종료 절차 1~4)
- [ ] **다음 Plan을 위한 §1.4 갱신 재료**: 이번 사이클 report §6.3 Try를 P-1 표가 소비할 수 있는
      형태(번호 붙은 목록)로 작성

---

## 5. Risks and Mitigation

| ID | 리스크 | 영향 | 확률 | 완화 |
|----|--------|:----:|:----:|------|
| **RK-19** | **`cycleFields`가 create·update에 공유**돼 있어(F29) 4차의 백로그 패턴이 직수입되지 않는다. nullable을 넣으면 `CreateCycleInput.name`도 `string\|null\|undefined`가 되어 생성 경로·폼 타입으로 파급된다 | Medium | **High** | 파급 자체는 **오히려 필요하다** — F33으로 폼이 `createCycleSchema`를 쓰므로, 공유 필드에 넣지 않으면 폼이 `null`을 만들 수 없다. 즉 **공유 배치가 정답일 가능성이 높고**(D-31 후보 a), 대신 `createCycleSchema`의 refine이 null을 "미연결"로 해석하게 함께 고쳐야 한다(FR-40·41). 타입 파급 전수는 `tsc -b`가 판정 |
| **RK-20** | **`pairRule`의 `undefined` 기준 비교가 null 확장 후 구멍이 된다** — `{name:null, yearMonth:'2026-08'}`이 "둘 다 정의됨"으로 통과해 **부정합 레코드를 새로 허용**한다. C-1을 고치면서 I-1의 변종을 만드는 형태 | **High** | **High** | §1.3.1에서 **이미 실측으로 확인한 함정**이다. FR-40으로 술어 정정을 요구사항에 못박았고, DoD L0 케이스 ④로 회귀를 고정했으며, §6.2 검증 1에서 Design 착수 전에 다시 확인한다 |
| **RK-21** | pair rule 강화(S2)가 **이미 존재하는 부정합 레코드를 수정 불가로** 만든다 — `{name:'foo', yearMonth:null}` 레코드는 `{yearMonth:'…'}` 단독 PATCH로 고칠 수 없고(400), 해제하려면 `{name:null,yearMonth:null}`을 보내야 하는데 UI에는 그 동선이 없을 수 있다 | Medium | Low | **§6.2 검증 3에서 dev DB에 그런 레코드가 있는지 먼저 조회한다.** 있으면 Design에서 처리 방침 결정(수동 정리 vs 마이그레이션 vs 해제 동선으로 충분). §1.3.1의 귀납 논증이 "기존 레코드가 정합"을 전제하므로 이 확인은 **논증의 전제 검사**이기도 하다 |
| **RK-22** | 하네스가 **형이 실사용 중인 Neon dev 브랜치**를 직접 쓴다(F35) — 생성·삭제 시나리오 15건이 실데이터와 섞이거나 잔여물을 남긴다. **자산화(A1)로 이 리스크가 1회성에서 상시화된다** — 앞으로 매 사이클 반복 실행된다 | Medium | **High**(자산화로 상승) | FR-50을 Medium→**High로 승격**. 시나리오는 **전용 프로젝트/버전 접두어**(예: `v9.x.x`·`hns-*`)로 실데이터와 이름 공간을 분리하고, 정리 실패 시에도 식별·수동 삭제가 가능하게 한다. 정리는 `finally` 계열로 **실패 경로에서도** 돌게 한다. **main(프로덕션) DB는 이번 사이클에서 건드리지 않는다** — F37로 마이그레이션 0건 |
| **RK-23** | **red→green 원칙이 지켜지지 않는다** — "어차피 결함을 아는데 먼저 고치고 한 번만 돌리자"로 흐른다. 그러면 하네스가 결함을 **실제로 잡는다는 증거**가 사라지고, I-4가 닫으려던 "하네스만 돌렸으면 잡혔을 것"이라는 3차의 주장이 검증되지 않은 채 남는다 | Medium | **High** | **모듈 순서를 뒤집어 구조로 강제**한다(§9) — module-1이 하네스 작성·red 기록이고 module-2가 수정이다. FR-48로 red 기록을 요구사항화했고, C19가 "red→green 순서로 기록"을 판정 기준에 넣었다 |
| **RK-24** | 코드 변경이 **스키마 한 블록 + UI 두 줄**인데 문서 4종 + P-1~P-3 형식 적용까지 얹어 오버헤드가 본체보다 커진다(4차 RK-18의 재현이자 확대) | Low | **High** | 감내한다 — **이 사이클의 절반은 절차 실험이다.** 같은 결함이 3번 재발한 원인이 코드가 아니라 절차이므로, P-1~P-3이 값을 하는지 확인하는 것 자체가 산출물이다. 대신 analysis는 **스코프 3건 대조만** 하고 전면 재분석하지 않는다(DoD) |
| **RK-25** | **결정 번호 D-19~D-26 중복**(F39)으로 Design·analysis·report에서 잘못된 결정을 참조한다 | Low | Medium | §1.3 식별자 규약에 **사이클 접두 의무**를 명시했고, 이번 사이클은 **D-29부터** 매긴다(4차 최대 D-28 다음). 번호 체계 자체의 개정은 스코프 외 |
| **RK-26** | `.optional()`/`.nullable()` 결함이 **4번째로** 다른 컬럼에서 재발한다 — 이 사이클이 닫는 건 cycles 도메인뿐이고, 앞으로 추가될 테이블에는 아무 강제도 걸리지 않는다 | Medium | Medium | 이번 사이클이 할 수 있는 건 **P-2 형식의 첫 적용 사례를 남기는 것**까지다(§8.2). 규칙화(RULE.md·템플릿 개정)는 재이월(§2.2)이며, **이 사이클 report §6.3이 "형식이 값을 했는가"에 답하는 것**이 승격 판단의 입력이 된다 |
| **RK-27** | **(A1 신설)** 커밋된 하네스가 **유지보수 부채로 전환**된다 — 기본 `npm test`에서 빠져 있어(F40 ①) 아무도 안 돌리는 사이 dev DB 스키마·시드가 드리프트해 **다음 사이클에 "깨진 채 방치된 파일"**이 된다. 그러면 재건축보다 나쁜 상태(고치는 비용 + 신뢰 상실)가 된다 | **High** | Medium | 세 겹으로 막는다: ①**DoD 체크박스**(§4.1)가 매 사이클 실행을 요구 — P-3의 기준이 원래 "실행"이다 ②**skip이 실패로 위장하지 않게** 한다(FR-52) — DB 없으면 조용히 skip, 있으면 반드시 판정 ③**FR-53 재사용 지침 주석**으로 다음 사이클이 확장 지점을 즉시 찾게 한다. 그리고 **이 리스크의 실현 여부 자체가 A1 판단의 사후 검증**이므로, 다음 사이클 Plan의 §1.4 Try 표(P-1)에 "이번 하네스를 재사용했는가"를 항목으로 넣을 것을 report §6.3에 남긴다 |

---

## 6. Impact Analysis

| 대상 | 변경 유형 | 영향 |
|------|-----------|------|
| `shared/schema.ts` (107~140행) | **수정** (필드 2개 nullable + 술어 정정 + update refine 재부착 + export 승격) | `CreateCycleInput`·`UpdateCycleInput` 타입이 바뀌어 **폼·훅·api·서비스로 파급**(RK-19). 이번 사이클의 **유일한 넓은 회귀 표면** |
| `shared/schema.test.ts` | 수정 (cycles 케이스 4+) | 파일 최상단 주석대로 **import 스모크가 zod 런타임 에러를 잡는 자리** — `partial()` on refined 같은 사고(§1.3.1 마지막 행)를 여기서 걸러낸다 |
| `server/services/cycles.ts` | **무변경 예상** | **F31** — input을 가공 없이 넘긴다. 4차의 `services/backlog.ts`와 같은 정정 지점 |
| `server/db/scoped.ts` (cycles 7함수) | **무변경 예상** | F31 — `.set({...input})` 스프레드가 null을 NULL로 반영하고, `if (input.name && …)` 중복검사가 null을 올바르게 건너뛴다. **`tsc -b`가 최종 판정** |
| `server/routes/cycles.ts` | **무변경** | `zValidator`에 스키마를 넘길 뿐 |
| `src/features/cycle/components/CycleForm.tsx` | **수정** | `toggleLink`의 `undefined` → `null`(FR-42) + 해제 동선(FR-43, D-33). resolver가 `createCycleSchema`인 구조(F33)가 유지 가능한지 Design에서 확인 |
| `src/features/cycle/components/CycleList.tsx` | 확인 필요 | `handleUpdate(id, input: CreateCycleInput)`이 `UpdateCycleInput`으로 넘어가는 자리 — 타입 파급(RK-19)의 통과 지점 |
| `src/features/cycle/components/CycleCard.tsx` | **무변경 예상** | `hasCycle = !!cycle.name && !!cycle.yearMonth`(34행)는 **null에 이미 안전** |
| `src/features/cycle/{api.ts, hooks/useCycles.ts}` | 확인 필요 | 타입만 통과 — `tsc -b`가 판정 |
| `src/features/document/components/ImportDialog.tsx` | **무변경** | I-3대로 cycles 스키마를 **우회**하고 있어서(3차 analysis I-3) 이번 스키마 변경의 영향을 받지 않는다 — 역설적이지만 사실 |
| `server/mcp/**` | **무변경** | **F36** — cycles 툴 0개 |
| **DB 스키마·마이그레이션** | **무변경** | **F37** — 컬럼이 이미 nullable, 유일 인덱스가 이미 NULL 다중 허용. `drizzle/` 신규 파일 0건 |
| **L1 하네스 파일** (`server/**/*.l1.ts`) | **신규 — 커밋** | D-35·형 승인 A1. `server/` 아래라 `tsconfig.server.json` include에 자동 포함 → `tsc -b`·`oxlint`가 커버(F40 ③). 기본 `npm test`는 안 잡는다(F40 ①) |
| `vitest.l1.config.ts` (루트) | **신규 — 커밋** | `include:['**/*.l1.ts']` + 기존 `@`/`@shared` alias 복제. 기존 `vitest.config.ts`와 마찬가지로 tsc 프로젝트 밖(`tsconfig.node.json` include는 `vite.config.ts`뿐) — **기존과 일관** |
| `package.json` | **수정** (스크립트 1줄) | `test:l1` 추가 — `set -a && . ./.env.local && set +a && vitest run --config vitest.l1.config.ts`(`dev:api`와 동일 env 주입 패턴, F40). **기존 `test` 스크립트는 무변경** |

### 6.1 신규 외부 의존

없음. 패키지 추가·제거 0건.

### 6.2 검증 (Design 착수 전)

- [ ] **1. `pairRule` 술어 정정 형태 확정**(RK-20) — `null`을 미연결로 취급하는 술어
      (`(v.name ?? undefined) === undefined` 계열)로 `{name:null, yearMonth:'2026-08'}`이 거부되고
      A1~A6(§1.3.1) 전건이 유지되는지 실측. **create·update 양쪽에서** 확인
- [ ] **2. nullable을 `cycleFields`에 넣었을 때 생성 경로 무회귀** — 폼(`createCycleSchema` resolver,
      F33)이 `null`을 담아 통과시키는지, 그리고 react-hook-form `setValue(field, null)`이 실제로
      **JSON에 `null`로 실리는지**(F32의 `undefined`와 달라지는 지점) 확인
- [ ] **3. dev DB 부정합 레코드 조회**(RK-21, §1.3.1 귀납 논증의 전제 검사) —
      `name IS NOT NULL AND year_month IS NULL` 또는 그 역인 `cycles` 행이 있는지 실 쿼리
- [ ] **4. 하네스 골격 재구성 방식 확정**(F34) — `app.request()`로 `server/app.ts`를 실 dev DB에 대고
      돌릴 때 **인증(ownerId 획득) 경로**를 어떻게 만드는지 확정. 2차·4차 스크립트가 삭제됐으므로
      PAT 실발급 / JWT 목 / 미들웨어 우회 중 어느 방식이었는지 재확인하고 재현.
      **이번엔 이 결과가 커밋된다**(D-35·A1) — 세 번째이자 **마지막** 재구성이므로,
      "다음 사람이 읽고 확장할 수 있는가"를 판정 기준에 포함한다(FR-53)
- [ ] **5. 하네스 데이터 격리 방침**(RK-22) — 전용 프로젝트를 만들 것인지, 기존 프로젝트에
      접두어로 격리할 것인지. #2(타인 프로젝트 404)는 **소유자가 다른 워크스페이스**를 요구하므로
      그 시드를 어떻게 만들지 포함

---

## 7. Architecture Considerations

### 7.1 프로젝트 레벨

1~4차와 동일 — **Dynamic**, 옵션 B(서비스 계층) 유지. 이 사이클은 구조를 바꾸지 않는다.
**아키텍처 결정이 아니라 이미 내린 결정을 다른 도메인에 옮겨 붙이는 사이클**이다.

### 7.2 핵심 아키텍처 결정 (Decision Record)

> 4차 D-28을 이어 **D-29부터** 매긴다(F39·RK-25 — 3차의 D-19~D-26과는 별개의 번호 공간이다).

| # | 결정 | 후보 | 채택 | 근거 |
|---|------|------|------|:----|
| **D-29** | 이번 사이클의 식별자 체계 | 새로 1부터 / 4차를 이어감 | **4차를 이어감**(F28~ / FR-39~ / C17~ / RK-19~ / D-29~) | 4차가 2차를 이어간 선례. 단 D 번호는 3차와 이미 충돌(F39)하므로 **참조 시 사이클 접두 의무**를 규약으로 둔다 |
| **D-30** | 사이클 해제의 표현 | `null` 명시 전송 / 빈 문자열 / 전용 엔드포인트(`DELETE /cycles/:id/link`) | **`null`** (4차 D-19 재적용) | F31 — 스프레드가 null을 그대로 컬럼 NULL로 반영한다. 4차가 `closedOn`에서 같은 판단으로 값을 지불했고, 같은 결함 클래스에 다른 표현을 쓰면 규약이 갈라진다 |
| **D-31** | **nullable을 어느 스키마에 넣나** (cycles 고유 판단) | (a) `cycleFields` 공유 필드에 / (b) update 전용 필드 객체를 분리해 거기만 | **(a) 공유 필드 — 단 §6.2 검증 1·2 후 Design에서 최종 확정** | F33 — 폼이 수정 모드에서도 `createCycleSchema`를 쓰므로, (b)로 가면 **폼이 `null`을 만들 수 없다.** 백로그는 create/update 스키마가 애초에 분리돼 있어 (b)가 자연스러웠지만(4차 D-20) cycles는 구조가 다르다. (a)의 대가는 `createCycleSchema`가 `{name:null}`을 받게 되는 것인데, 이는 "미연결 생성"으로 **의미가 성립**한다(FR-41) |
| **D-32** | **I-1의 pair rule 검증 위치** | (a) zod — `partial()` 뒤 refine 재부착(패치 자기정합 강제) / (b) 서비스 계층 — 병합 상태 재검증 / (c) 둘 다 | **(a)** (형 승인 A2) | §1.3.1 실측 A2·A6 + 귀납 논증 — 패치가 두 필드를 "둘 다 또는 둘 다 아님"으로만 보낼 수 있으면 **병합 결과는 항상 정합**이다. (b)는 정확하지만 `existing`을 읽는 계층에 검증을 흩뜨려 "에러 응답은 `ServiceError` 경유"(4차 §9.1 규칙 6)와 검증 계층 단일화 원칙에 역행한다. **대가**: 연결된 사이클의 `name`만 바꾸는 리네임도 `yearMonth`를 함께 보내야 한다 — `CycleForm`은 항상 둘을 함께 보내므로(3차 analysis I-1 "현재 노출도") **UX 회귀 0**, MCP는 툴 0개(F36) |
| **D-33** | **해제 동선의 형(形)** | 기존 체크박스 유지(페이로드만 수정) / **체크박스 + 확인 문구** / 4차 D-27식 명시 버튼 추가 | **Design Checkpoint에서 형 결정 — 단 형의 기울기는 "확인 문구 추가"**(승인 A4) | 지시서가 "동선은 Design Checkpoint에서 형 결정"으로 명시했고 형도 유지에 동의. Plan 판단(**동선은 이미 있고 페이로드만 틀렸다** — 백로그는 date input 비우기 말고 동선이 없어서 ✕ 버튼이 필요했지만 여기선 체크박스가 그 역할)에도 형이 동의했으나, **해제가 이름 점유 해소라는 부수효과까지 있는 파괴적 동작**이라 확인 문구 쪽으로 기울었다(A4). → **Design Checkpoint는 백지 선택이 아니라 "문안과 발동 조건의 구체화 + 대안이 있으면 반증"** 자리다 |
| **D-34** | **C-1의 MCP 경로 판단** (4차 D-21에 대응) | 허용 / 미허용 + 사유 주석 / **해당 없음** | **해당 없음 — 대신 조건부 지시를 재이월 표에 남긴다** | F36 — cycles MCP 툴이 0개라 조일 스키마도 주석 자리도 없다. 4차 D-21은 `backlog_update`라는 실재 툴이 있어 성립한 결정이다. **I-2 착수 시** 쓰기 툴을 만들면 그때 4차 D-21 형식으로 `null` 허용 여부를 명시 결정한다(§2.2 I-2 행) |
| **D-35** | **L1 하네스의 자산화 여부** | 기본 테스트에 그대로 커밋 / 임시 스크립트 + 문서 자산화(v0.1 권고) / **커밋하되 기본 `vitest run`에서 분리 + DB 없으면 skip** | **커밋 + 분리 실행 + skip 가드** (**형 승인 A1 — v0.1 권고를 뒤집음**) | v0.1은 ①선례 일관 ②`npm test` 안전 ③P-3은 "실행"이 기준 세 근거로 임시 스크립트를 권고했다. 형의 반론: **F34는 삭제 선례의 비용 증명서**이고(2차→4차→이번 = 세 번째 재건축, I-2에 네 번째 예약) 절충안이 ②를 그대로 해소한다. **F40이 3축을 실측으로 확정** — 기본 `vitest run`은 `*.l1.ts`를 안 잡고(49건 불변), 별도 config + `skipIf`가 DB 유무로 갈리며, `server/` 배치로 `tsc -b`·`oxlint`가 커버된다. 남는 반대 근거 ①은 **그 선례가 이번에 값을 물렸으므로 기각**. I-4 원문("2차와 같은 파일 구조로 추가")과의 어긋남도 이 결정으로 해소된다 — 원본이 없으니 **이번 것이 그 원본이 된다** |
| **D-36** | 하네스 시나리오 채택 범위 | 최소 2건(#5·#10) / 3차 §8.2 11건 전건 / 11건 + 신규 | **11건 전건 + 신규 4건**(§1.3.2, 형 승인 A3) | 하네스 비용은 인증·시드·정리 골격에 있지 시나리오 1건 추가에 있지 않다. I-4가 닫는 건 "런타임 실증 **0건**"이라는 상태이므로 전건이 맞다. 신규 4건은 C-1·I-1의 **회귀 고정**용 |
| **D-37** | **(A1 파생)** 하네스 파일의 위치·명명 | `scripts/` / `server/**/*.l1.ts` / `test/` 신설 | **`server/` 아래 `*.l1.ts`** | F40 ③ — `tsconfig.server.json`의 `include:["server","api",…]`에 자동 포함돼 **별도 설정 없이 `tsc -b`·`oxlint`가 커버**한다. `scripts/`는 tsc 프로젝트 밖이라 타입 검사가 안 걸리고(현 `import-docs.mjs`가 `.mjs`인 이유), `test/` 신설은 6개 정식 테스트가 소스 옆에 있는 현 배치와 어긋난다. 확장자 `.l1.ts`는 vitest 기본 include(`*.{test,spec}.*`)와 **의도적으로 겹치지 않는 이름**이다 |

---

## 8. Convention Prerequisites

### 8.1 기존 규약

- [x] `CLAUDE.md` / `docs/RULE.md`
- [x] 옵션 B 계층 규칙(서비스만 도메인, 어댑터는 Drizzle import 금지)
- [x] 에러 코드 단일 원천(2차 FR-20·D-17) + **에러 응답은 `ServiceError` 경유**(4차 §9.1 규칙 6)
- [x] **2차 F7 규약 — zod 필드 정의와 refine 분리**(refined 스키마에 `.partial()` 불가, §1.3.1 실측 확인).
      **S2가 이 규약을 update 경로까지 확장하는 작업**이다
- [x] **4차 §10 규약 ① — 날짜·선택 필드의 `.nullable()` 여부를 Design 표에 명시 결정**.
      이 사이클이 그 규약의 첫 소비자다(4T-2a)
- [ ] 4차 §10 규약 ② — MCP 입력 스키마 `shared` 재사용: **이번 적용 대상 없음**(F36, 4T-2b)
- [x] 주석 규약 `// Design Ref: §N`, `// Plan SC: CN`, `// Decision: [Do] …`
- [x] 배포 절차 [docs/deploy/CHECKLIST.md](../../../deploy/CHECKLIST.md) — **§9 리스크 절 참조**

### 8.2 이번에 **적용할 형식** (신규 규약 정의 아님)

> 3차 P-2·P-3을 **이 사이클의 문서에 형식으로 적용**한다. 규칙 자체(RULE.md·템플릿)의 개정은
> 스코프 외(§2.2) — 형식이 값을 하는지 한 사이클 확인한 뒤 승격하는 게 순서다.

| # | 형식 | 어디에 | 구체 지시 |
|:-:|------|--------|-----------|
| **P-1** | 직전 사이클 Try 이행 현황 표 | **Plan §1.4** (이 문서) | 완료 — 4차 전건 + 3차 P-1~P-5, 각 항목에 ✅/⚠️/❌/N/A + 한 줄 사유 |
| **P-2** | zod 필드 표에 **"지울 수 있는가" 열** | **Design의 zod 스키마 표** | `version`·`releaseNote`·`name`·`yearMonth` **4개 전부**에 대해 "예/아니오"와 근거 1줄. `name`·`yearMonth`가 "예"로 판정될 자리이고, **3차가 이 판정을 안 해서 C-1이 났다.** 표에 빈칸이 있으면 Design 미완성으로 본다 |
| **P-3** | L1 시나리오를 **DoD 체크박스로** | **Plan §4.1** (선반영 완료) + Design §8 | Design §8은 시나리오를 상세화(요청 본문·기대 응답)하되, **판정의 원본은 §4.1 체크박스**다. "작성됨"이 아니라 "실행됨"이 체크 조건 |
| — | 사후 개정 표기 | 필요 시 | 4차 D-25 형식 유지 — 원문 유지 + `**(사후 YYYY-MM-DD 확인: …)**` + Version History 행 |

### 8.3 환경변수

변경 없음 — 신규 0건. 하네스는 기존 `.env.local`의 `DATABASE_URL`(Neon **dev** 브랜치)을 그대로 쓴다(F35).

---

## 9. [DO] 실행 마일스톤

**4차와 순서가 반대다.** 4차는 코드→검증이었지만 이번엔 **검증→코드**다 — 3차가 "하네스만
돌렸으면 공짜로 잡혔을 것"이라고 주장한 결함을 다루므로, 하네스가 **실제로 잡는다는 증거**를
먼저 확보해야 그 주장이 검증된다(RK-23을 구조로 막는다).

| Module | 스코프 | 산출물 | 완료 판정 |
|:------:|:---:|--------|-----------|
| **1** | S3 (전반 + 자산화) | §6.2 검증 5건 수행 → **하네스 실행 인프라 커밋**(`vitest.l1.config.ts`·`package.json test:l1`·skip 가드, FR-51·52) → 하네스 골격(인증·시드·정리) + §1.3.2 **15 시나리오 작성** → **수정 전 실행** | **red 확정 기록** — #5·#10이 기대와 다르게 나오고(현재 각각 201/무시), 나머지 13개는 통과. 이 결과가 C19 전반부. **+ C20 ③④**(skip 동작·`npm test` 불변)를 이 시점에 이미 확인 가능 |
| **2** | S1 + S2 | 스키마 수정(FR-39·40·41·44·45·46), `CycleForm` null 전송 + 해제 동선(FR-42·43), `schema.test.ts` L0 4케이스(FR-49) | **하네스 재실행 15/15 green**(C19 후반) + **C18** + `tsc -b`로 RK-19 파급 전수 확인 |
| **3** | S1 (실증) + S3 (마감) | 형이 브라우저에서 해제→저장→새로고침 + 해제한 이름 재사용 / 하네스 재사용 지침 주석(FR-53) + 잔여 데이터 정리 확인(FR-50) | **C17 ④⑤** — API만으론 F32를 못 닫는다(4차 C11과 같은 구조). **+ C20 전건** |

**순서 근거**

- **module-1이 먼저인 이유**: red 없이 green만 있으면 "하네스가 이 결함을 잡는다"는 증거가 없다.
  I-4의 가치 명제 자체가 그 증거다(3차 analysis I-4). 또 하네스를 먼저 세우면 §6.2 검증 3
  (부정합 레코드 조회, RK-21)을 하네스 골격 위에서 그대로 수행할 수 있다.
- **실행 인프라(config·스크립트·skip 가드)를 module-1 앞머리에 두는 이유**(A1): 시나리오를 다
  쓴 뒤에 커밋 방식을 정하면 임시 스크립트로 돌려놓고 나중에 옮기게 되고, 그러면 **자산화가
  "나중에 할 일"로 밀린다** — 그게 2차·4차에서 실제로 일어난 일이다(F34). 인프라가 먼저 있으면
  red 실행 자체가 곧 `npm run test:l1`의 첫 실행이 된다.
- **S1과 S2를 한 모듈에 묶는 이유**: 둘 다 `shared/schema.ts`의 **같은 블록**(107~140행)을 만지고
  회귀 검증(하네스 15건)을 공유한다. 나누면 검증만 두 번이다. 게다가 §1.3.1 실측대로 **한 형태가
  둘을 동시에 닫는다**.
- **module-3을 분리하는 이유**: 실행 주체가 형이다(4T-1). 클로드의 세션과 동기화될 필요가 없고,
  module-2 완료 후 비동기로 확인받는 게 형의 시간을 덜 쓴다.

**세션 분할 권고**: module-1~2 한 세션(하네스 컨텍스트가 이어진다) / module-3은 형의 확인 후
analysis·report 세션.

**Checkpoint 태깅**: module-1·2는 끝날 때 각각 C19 전반 / C18·C19 후반만 즉시 대조한다 —
2차 회고 Try(마지막에 몰아서 대조하지 않기)를 4차에 이어 이번에도 적용.

### 9.1 배포 리스크

**이번 사이클은 DB 스키마를 바꾸지 않는다**(F37 — `name`·`year_month`가 이미 nullable, 유일
인덱스가 이미 NULL 다중 허용). 따라서 [CHECKLIST.md](../../../deploy/CHECKLIST.md) **§1(마이그레이션)은
해당 없음**이고, §2(배포 순서)·§3(배포 후 확인)·§4(롤백 기준)만 적용된다.

**만약 Design·Do 과정에서 스키마 변경이 발생하면**(예: 부정합 레코드 정리를 마이그레이션으로
처리하기로 결정, RK-21) 다음이 동시에 발동한다:

1. CHECKLIST §1 전체 적용 — **dev·main 두 브랜치 각각** `drizzle-kit migrate`
2. **main 브랜치 마이그레이션은 형이 직접 수행한다** — 4차 회고 §6.2의 실행 환경 제약
   (CLI 세션이 프로덕션 시크릿을 자동 마스킹해 클로드가 대행 불가). Design §6.2에
   "이 작업을 실행할 권한이 실제로 있는가"를 명시 검증 항목으로 넣는다(4T-1)
3. 미적용 시 증상은 CHECKLIST §1에 실사례로 기록돼 있다(2차 `/api/tokens` 500)

---

## 10. Next Steps

1. [x] **형 Plan 승인** — 확인 포인트 4건 처리 완료(2026-08-09). **②③④ 동의, ①은 형의 반론으로
       Plan 권고를 뒤집어 절충안 채택.** 상세는 §1.5.1
2. [x] §6.2 검증 5건 수행 — **전건 실측 완료**(2026-08-09, design §1.3 V1~V5): 엄격 pairRule
       술어 확정(느슨 술어 반례 확보) / zodResolver 순수 호출로 폼 null 통과 확인 / dev DB
       부정합 **0건**(RK-21 미실현) / 하네스 인증 = PAT 직접 발급(JWKS 불요) / 격리 = 합성
       owner 2명(`hns-` 접두)
3. [x] 설계 문서 작성 완료 — [refine-cycles-hardening.design.md](./refine-cycles-hardening.design.md)
       (v0.1). P-2 표는 design §3.3(4필드 전부 판정), L1 15건 상세는 §8.3. **Checkpoint 3에서
       D-33 확정**: 저장 시점 confirm + 형 지정 문안(결과 2개 명시 + "(문서 자체는 삭제되지
       않음)" 괄호 필수)
4. [ ] module-1 착수 (하네스 실행 인프라 커밋 → 골격·시나리오 → red)
5. [ ] 사이클 종료 시 RULE.md 종료 절차 1~4 (링크 전수 검증 / `_INDEX.md` / docs 커밋 1개 /
       태그 간 git diff txt 저장)
6. [ ] report §6.3에 **A1 사후 검증 항목**을 남긴다 — "다음 사이클(I-2 등)이 이 하네스를 **재사용했는가,
       아니면 네 번째 재건축을 했는가**". RK-27의 실현 여부가 곧 A1 판단의 채점표다(P-1 표가 소비)

---

## Version History

| 버전 | 날짜 | 변경 내용 | 작성자 |
|------|------|-----------|--------|
| 0.2 | 2026-08-09 | **형 승인 4건 반영(§1.5.1 신설).** ②D-32 zod·③D-36 11+4·④D-33 Checkpoint 유지는 동의, **①D-35는 형의 반론으로 v0.1 권고를 뒤집었다** — "F34 자체가 삭제 선례의 비용 증명서"(2차→4차→이번 = 세 번째 재건축, I-2에 네 번째 예약)라는 지적을 받아 **하네스를 커밋하되 기본 `vitest run`에서 분리 + `DATABASE_URL` 없으면 skip**하는 절충안 채택. 절충안 3축을 실측해 **F40** 신설(기본 `vitest run`이 `*.l1.ts` 미포함 49건 불변 / 별도 config + `skipIf`가 DB 유무로 갈림 / `server/` 배치로 `tsc -b`·`oxlint` 자동 커버). 파생 변경: S3에 자산화 포함, **FR-51~53**·**C20**·**RK-27**(커밋된 하네스의 유지보수 부채) 신설, RK-22 확률 Medium→High·FR-50 Medium→High 승격, **D-37**(파일 위치·명명) 신설, §6 영향 대상에 `vitest.l1.config.ts`·`package.json` 추가, module-1 앞머리에 실행 인프라 커밋 배치(자산화가 "나중 일"로 밀리는 것을 순서로 차단). A4 반영해 **D-33에 형의 기울기(확인 문구 추가)를 명시** — Design Checkpoint의 성격이 "백지 선택"에서 "문안·발동 조건 구체화"로 바뀜 | cogmo |
| 0.1 | 2026-08-09 | 최초 작성. 3차(cycle-release-note) 이월 중 cycles 데이터 무결성 3건(C-1·I-1·I-4)을 스코프로 고정. 현 HEAD(`39cb3ba`) 실측 F28~F39 — 특히 **F31**(서버 update 흐름이 이미 null을 올바르게 처리 → services·scoped 무변경, 4차 F13의 재현), **F33**(폼이 수정 모드에서도 `createCycleSchema`를 써서 4차의 create/update 분리 패턴이 직수입 불가 → D-31), **F34**(2차·4차 L1 하네스가 저장소에 없음 → I-4의 "같은 파일 구조"에 원본이 없다 → D-35·§10 확인1), **F36**(cycles MCP 툴 0개 → C-1의 MCP 경로는 "해당 없음", D-34), **F37**(DB 컬럼이 이미 nullable → 마이그레이션 0건). §1.3.1에 후보 수정 형태를 런타임 실측해 **한 형태가 C-1·I-1을 동시에 닫음**과 **null 확장 시 `pairRule` 술어 구멍**(RK-20)을 확정. **§1.4는 P-1(직전 Try 이행 현황 표)의 최초 적용 사례**이며, P-2·P-3은 §8.2·§4.1로 이 사이클 Design·DoD에 형식 적용을 지시. module 순서를 4차와 반대(검증→코드)로 잡아 red→green을 구조로 강제(RK-23) | cogmo |
