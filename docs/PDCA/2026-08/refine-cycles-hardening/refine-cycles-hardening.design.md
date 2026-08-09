---
template: design
version: 1.3
---

# refine-cycles-hardening 설계 문서

> **한 줄 요약**: 코드 변경은 파일 3개 + 신규 3개 — `shared/schema.ts` cycles 블록에서
> `name`/`yearMonth`를 nullable로 넓히고 **엄격 pair 술어**(V1 실측)를 create·update 양쪽에 걸어
> C-1과 I-1을 한 형태로 닫는다. `CycleForm`은 해제 시 `null`을 보내고 **형이 문안을 확정한
> confirm**(D-33)을 저장 시점에 띄운다. 그리고 L1 하네스 15 시나리오를 **합성 owner 2명 방식**
> (V4·V5)으로 지어 red→green을 기록하고, 이번엔 **저장소에 커밋한다**(D-35·A1 — 세 번째이자
> 마지막 재건축). Plan §6.2 검증 5건 **전건 실측 완료** — 추정으로 남긴 결정 0건.
>
> **프로젝트**: PDCA-workspace
> **작성자**: cogmo
> **작성일**: 2026-08-09
> **상태**: Draft (v0.1 — §6.2 검증 5건 실측 + Checkpoint 3 D-33 확정)
> **계획 문서**: [refine-cycles-hardening.plan.md](./refine-cycles-hardening.plan.md)

---

## Context Anchor

> Plan에서 복사. Design→Do 인계 시 전략 컨텍스트 보존.

| Key | Value |
|-----|-------|
| **WHY** | `.optional()`/`.nullable()` 결함의 3번째 재발(3차 C-1)과, 그것이 코드 정독으로만 발견된 이유(I-4 런타임 실증 0건)를 **같은 사이클에서** 닫는다. 재발의 원인은 코드가 아니라 "회고가 다음 Plan에서 다시 읽히지 않음"이므로, 재발 방지 장치(P-1~P-3)를 이 사이클 문서에 형식으로 적용하는 것까지가 목적이다. |
| **WHO** | 형(cogmo) — 브라우저 실사용자이자 승인자, **브라우저 실증의 실행 주체**(4T-1) / 클로드(Claude Code CLI) — 코드·dev DB 하네스 / claude.ai 웹 MCP 커넥터 — **이번 스코프에서는 소비자가 아니다**(cycles MCP 툴 0개, F36) |
| **RISK** | `cycleFields` 공유로 인한 타입 파급(RK-19) / pairRule의 null 구멍(RK-20 — V1로 술어 확정) / 기존 부정합 레코드(RK-21 — **V3로 dev 0건 확정**) / dev DB 잔여물(RK-22 — V5 합성 owner로 격리) / red→green 미준수(RK-23 — module 순서로 강제) / 커밋된 하네스의 유지보수 부채(RK-27) |
| **SUCCESS** | C17~C20. **C17** 해제 3단계+브라우저 / **C18** 편측 400 + 부분수정 무회귀 / **C19** 15 시나리오 red→green 기록 / **C20** 하네스 자산화 4종(커밋·`test:l1`·skip·`npm test` 불변) |
| **SCOPE** | 이월 3건 고정(S1~S3). I-2·I-3·I-5·M-1~M-9·리네임·RULE.md 개정은 스코프 외(Plan §2.2 재이월). |

---

## 1. Overview

### 1.1 설계 목표

1. **한 형태로 두 결함을 닫는다** — `cycleFields.partial().refine(pairRule)`이 C-1(해제 불가)과
   I-1(pair 소실)을 동시에 폐쇄한다(Plan §1.3.1 실측·귀납 논증). 서버 계층은 실측(F31)으로
   무변경 확정 — 수정은 zod 한 블록 + 폼 두 갈래뿐이다.
2. **4차 패턴의 이식, 단 cycles의 구조 차이를 명시 처리** — 해제=null 전송(4차 D-19→D-30),
   nullable 명시 결정(4차 §10 규약→§3.3 P-2 표). 백로그와 달리 create/update가 `cycleFields`를
   공유하고 폼이 `createCycleSchema`를 쓰므로(F33) nullable은 **공유 필드에** 넣는다(D-31a).
3. **하네스를 1회용이 아니라 자산으로** — 15 시나리오를 red→green으로 실증하고(C19), 실행
   인프라(`test:l1`·skip 가드)째 커밋한다(C20). **다음 사이클(I-2)이 재건축 대신 확장**하게
   하는 것이 D-35의 목적이다(FR-53).

### 1.2 설계 원칙

- **1~4차 원칙 전부 유지** — 옵션 B 계층 / 라우트는 얇게 / 에러는 `ServiceError` 경유(4차 §9.1
  규칙 6) / YAGNI.
- **동작 변경은 스코프가 지목한 곳만** — 이번 계약 강화는 정확히 한 군데다: **편측 PATCH가
  200→400**(I-1 폐쇄). 그 외 모든 기존 경로(키 생략·부분 수정·미연결 생성)는 byte-동일하게
  유지하고 §8이 무회귀로 고정한다.
- **거부 메시지는 사용자가 스스로 고칠 수 있게** — pair 위반 메시지에 "해제 시 둘 다 null"을
  명시해, API 직접 호출자(향후 MCP 포함)가 재시도 방법을 메시지만으로 알게 한다(4차 RK-14 연장).

### 1.3 Plan §6.2 검증 결과 (전건 실측 완료, 2026-08-09)

이 설계의 모든 결정은 아래 실측 위에 서 있다. 스크립트는 실행 후 삭제(관례 — 단 V4·V5의
결과물인 **하네스 본체는 이번엔 커밋 대상**이다, D-35).

| # | 검증 | 방법 | 결과 | 확정되는 결정 |
|---|------|------|------|------|
| **V1** | pairRule 술어 정정 형태(RK-20) | 후보 2형을 `fields.partial().refine()`에 걸어 update 10케이스 × create 6케이스 파싱 대조 | **엄격 술어**(`(name===undefined)===(ym===undefined) && (name===null)===(ym===null)`)가 16케이스 전부 정확 — 쌍 null(해제)·쌍 string(연결)·쌍 생략(무변경)만 통과, 편측 4형태 전부 거부. **느슨 술어(`== null` 동치)는 `{name:null}` 편측 패치를 통과**시켜 병합 부정합 `{name:null, ym:'2026-08'}`을 만든다 — 반례 확보, 기각. null이 `.partial()` 후에도 파싱 결과에 보존됨(`{"name":null,"yearMonth":null}`) | **D-38: 엄격 술어 채택.** create에도 같은 술어 적용 시 `{v,name:null,ym:null}` 미연결 생성 통과(FR-41) 확인 |
| **V2** | 생성 경로 무회귀 + 폼 null 통과(F33) | `zodResolver(createCycleSchema)`를 **순수 함수로 직접 호출**(React 불필요 — `(values, ctx, opts)` 시그니처) 4케이스 + `JSON.stringify` 대조 | 해제 제출(`{version, releaseNote, name:null, ym:null}`) **PASS·값 보존** / 편측 null 거부 / 연결·미연결 제출 무회귀 PASS. `JSON.stringify`: **null은 키 유지, undefined는 키 소실** — C-1의 조용한 실패 경로(F32)와 수정 후 경로의 차이를 직렬화 층에서 재확인 | **D-31(a) 확정**: nullable을 공유 `cycleFields`에 — 폼 resolver가 null을 통과시킴이 실측됨. 잔여: RHF `setValue(field, null)`이 제출 데이터까지 null로 남는 것은 문서화된 동작이나 **브라우저 실증은 §5.2 체크리스트**(module-3)에서 최종 확인 |
| **V3** | dev DB 부정합 레코드(RK-21) | `SELECT … WHERE (name IS NULL) != (year_month IS NULL)` 실 쿼리(읽기 전용) | **0건** (전체 cycles 1건, 연결 1건) | §1.3.1 귀납 논증의 전제("기존 레코드 정합") 성립 — **정리 마이그레이션·수동 조치 불필요**, RK-21 미실현. F37 재확인: 이번 사이클 DB 변경 0건 |
| **V4** | 하네스 인증 골격(F34) | `auth.ts`·`token.ts`·`services/tokens.ts`·`db/scoped.ts` 정독 | **PAT 경로 확정** — `authMiddleware`의 `pdcaw_` 분기는 JWKS를 **타지 않고** DB 해시 조회(`findApiTokenByHash`)만 탄다. `hashToken` = 단순 SHA-256, `generateToken`·`hashToken`이 export돼 있어 하네스가 재사용 가능. `api_tokens.ownerId`·`workspaces.ownerId` 둘 다 **FK 없는 text** | **D-39 전반**: 하네스는 PAT를 DB에 직접 삽입(`createApiToken`)해 인증한다 — JWKS·환경변수 `NEON_AUTH_*` 불필요, `DATABASE_URL` 하나로 완결 |
| **V5** | 데이터 격리 방침(RK-22) | V4 결과 + `scoped.ts` 전 쿼리의 ownerId 스코프 확인 | **합성 owner 2명**(`hns-a-*`/`hns-b-*`)을 만들면 모든 조회가 ownerId 2단 조인 스코프라 **형 계정에서 하네스 데이터가 아예 보이지 않는다** — Plan RK-22의 접두어 방식보다 강한 격리. #2(타인 프로젝트 404)의 시드 문제(다른 소유자 필요)도 owner B가 자연 해소 | **D-39 후반**: 격리 = 합성 owner. 정리 = `owner_id LIKE 'hns-%'` 삭제(workspaces cascade + api_tokens) — **이전 실행의 잔여물까지 쓸어내는 방식**이라 정리 실패가 누적되지 않는다(FR-50) |

### 1.4 Checkpoint 3 — 형 결정 (2026-08-09)

아키텍처 3안 비교는 **생략** — Plan §7.1("옵션 B 유지, 구조 무변경")이 형 승인(§1.5.1)으로
이미 고정됐고, 4차와 같은 마감 사이클이다. Plan이 Design Checkpoint로 넘긴 유일한 미결
(D-33 해제 동선)을 형의 기울기(A4 — 확인 문구)를 출발점으로 결정받았다:

| # | 질문 | 형의 답 |
|---|------|---------|
| **D-33 확정** | 해제 확인 동선 — 저장 시점 confirm / 토글 시점 confirm / 문구 없음 | **저장 시점 confirm + 문안 지정**. 형이 문안 요건을 직접 확정: **결과 두 개를 명시**할 것 — "문서 버튼이 사라지고, 사이클명 'X'를 다른 버전이 쓸 수 있게 됩니다. **(문서 자체는 삭제되지 않음)**". 특히 마지막 괄호가 핵심 — "해제 = 문서 삭제"로 오해하면 사용자가 겁먹고 해제를 못 쓴다. **해제는 가역(재연결 가능)이고 이름 점유만 풀린다는 게 정확한 심상** |

문안·발동 조건의 구현 명세는 §5.1. `confirm()` 사용은 버전 삭제(`CycleList.tsx:70`)와 같은
코드베이스 관용구다.

---

## 2. Architecture

### 2.1 변경 지점 다이어그램

구조는 3차(cycles 도메인 신설) 그대로다. 이번 사이클이 손대는 지점만 표시한다:

```
┌── 브라우저 ─────────────────────────────┐   ┌── L1 하네스 (신규 자산) ────────────┐
│ CycleForm                               │   │ server/cycles.l1.ts                │
│  ② toggleLink(false) → null 세팅        │   │  ④ 합성 owner 2명 + PAT 직접 발급   │
│  ② 저장 시 confirm (D-33, 문안 §5.1)    │   │  ④ app.request()로 15 시나리오      │
└──────┬──────────────────────────────────┘   └──────┬─────────────────────────────┘
       │ PATCH { name:null, yearMonth:null }         │ (vitest --config vitest.l1.config.ts)
┌──────▼─────────────────── server/app.ts ───────────▼─────────────────────────────┐
│  routes/cycles.ts   무변경 (zValidator에 스키마만 갈림)                            │
│  services/cycles.ts 무변경 (F31 — input 무가공 전달)                              │
│  db/scoped.ts       무변경 (F31 — 스프레드가 null→NULL, 중복검사 null 건너뜀)      │
│  shared/schema.ts   ① name/yearMonth .nullable() + 엄격 pairRule(D-38)            │
│                     ① updateCycleSchema = partial() 뒤 refine 재부착 (I-1 폐쇄)   │
└──────────────────────────────────────────────────────────────────────────────────┘
  ①=S1+S2 (같은 블록)   ②=S1(UI)   ④=S3     DB·마이그레이션·MCP 전부 무변경(F36·F37)
```

### 2.2 의존 관계 변화

| 컴포넌트 | 변화 |
|----------|------|
| `server/cycles.l1.ts` → `server/app.ts`·`db/scoped.ts`·`lib/token.ts` | **신규** — 하네스가 앱 조립 전체 + PAT 발급 헬퍼를 재사용. 프로덕션 코드가 하네스에 의존하는 방향은 0건(단방향) |
| `vitest.l1.config.ts` (루트) | **신규** — `include: ['**/*.l1.ts']`. 기존 `vitest.config.ts`는 무변경 |
| 그 외 전부 | 무변경. 신규 패키지 0, 마이그레이션 0(F37), MCP 무변경(F36), `vercel.json` 무변경 |

---

## 3. Data Model

### 3.1 DB — 무변경

`cycles.name`·`cycles.year_month`는 이미 nullable 컬럼이고(F37, `db/schema.ts:91-92`),
`cycles_proj_name_uq`는 postgres 규칙상 NULL을 서로 다른 값으로 취급해 미연결 다중 허용이
이미 성립한다(3차 D-26). `updateCycle`의 `.set({ ...input })` 스프레드가 null을 그대로 NULL로
반영하고 중복 검사(`if (input.name && …)`)는 null을 건너뛴다(F31). **마이그레이션 0건.**

### 3.2 `shared/schema.ts` cycles 블록 개정 (S1 + S2의 공유 지점)

```typescript
// [무변경] cycleVersionSchema · yearMonthSchema · cycleNameSchema — 제약 그대로

// [S1] name/yearMonth nullable — D-31(a): create/update가 cycleFields를 공유하고
// 폼(CycleForm)이 createCycleSchema를 resolver로 쓰므로(F33) 공유 필드에 넣는다.
// null 쌍 = 해제(update) / 미연결 생성(create, FR-41). V2로 resolver 통과 실측.
const cycleFields = z.object({
  version: cycleVersionSchema,
  releaseNote: z.string().max(50000).optional(),
  name: cycleNameSchema.nullable().optional(),
  yearMonth: yearMonthSchema.nullable().optional(),
})

// [S2] D-38: 엄격 pair 술어 — null(해제)과 undefined(무변경)를 구분한다.
// 느슨한 `== null` 동치 비교는 {name:null} 편측 패치를 통과시켜 병합 부정합을 만든다(V1 반례).
// 2차 F7 규약(필드 정의/refine 분리)에 따라 술어·메시지를 이름 붙여 export — FR-46,
// documentKindStageRule/DOCUMENT_KIND_STAGE_MESSAGE(4차)와 같은 선례.
export const cyclePairRule = (v: { name?: string | null; yearMonth?: string | null }) =>
  (v.name === undefined) === (v.yearMonth === undefined) &&
  (v.name === null) === (v.yearMonth === null)
export const CYCLE_PAIR_MESSAGE =
  'PDCA 사이클 연결·해제에는 사이클명과 연월이 함께 있어야 합니다 (해제는 둘 다 null)'

export const createCycleSchema = cycleFields.refine(cyclePairRule, {
  message: CYCLE_PAIR_MESSAGE,
  path: ['name'],
})

// [S2] I-1 폐쇄 지점 — partial() **뒤** refine 재부착 (refined 스키마엔 partial 불가, §1.3.1 실측)
export const updateCycleSchema = cycleFields.partial().refine(cyclePairRule, {
  message: CYCLE_PAIR_MESSAGE,
  path: ['name'],
})
```

- 메시지 개정: 기존 "연결에는 … 모두 필요합니다"가 해제 거부(편측 null)에는 오독되므로
  연결·해제 양쪽을 덮는 문구로 바꾼다. **create 400 응답의 message가 바뀌는 유일한 지점** —
  코드·필드 경로는 동일, 소비처는 폼 에러 표시뿐(회귀 표면 §4.3).
- `cycleFields` 자체는 계속 모듈 로컬 — 하네스·테스트는 export된 `createCycleSchema`/
  `updateCycleSchema`/`cyclePairRule`만 쓰면 된다.

**타입 파급(RK-19)**: `CreateCycleInput['name']`·`UpdateCycleInput['name']`이
`string | undefined` → `string | null | undefined`. 소비처 — `CycleForm`(§5.1에서 명시 처리),
`CycleList.handleUpdate`(`CreateCycleInput` → `UpdateCycleInput` 대입은 계속 성립),
`api.ts`·`useCycles`(타입만 통과), 서버 3층(값 무가공, F31). 최종 판정은 `tsc -b`(DoD).

### 3.3 zod 필드 표 — **P-2 형식 첫 적용** ("지울 수 있는가" 열)

> 3차 P-2("zod 필드 정의 시 '지울 수 있는가'를 Design 표에 필수 열로")의 최초 적용.
> **4필드 전부 판정, 빈칸 없음** — 3차가 이 판정을 안 해서 C-1이 났다(Plan §8.2).

| 필드 | 제약 | create 필수 | **지울 수 있는가** | 근거·방식 |
|------|------|:---:|:---:|-----------|
| `version` | `^v\d+\.\d+\.\d+$` | 필수 | **아니오** | 프로젝트 내 유일키이자 레코드의 정체성. 지운 버전 카드는 무의미 — 변경(rename)만 허용, 삭제는 레코드 DELETE로 |
| `releaseNote` | `max(50000)` | 선택 | **예 — 빈 문자열 `''` (현행 유지)** | text 컬럼에서 `''`와 NULL의 의미 차이가 없고, 렌더(`CycleCard`)가 `?.trim()`으로 둘을 동일 처리한다. textarea 비우고 저장 → `''` 저장 → "릴리즈 노트가 없습니다" 표시. **null 방식으로 통일하지 않는 이유**: 동작이 이미 올바른 자리를 스코프 밖에서 고치지 않는다(4차 F13과 같은 판단) |
| `name` | `^[A-Za-z0-9._-]+$`, `min(1).max(100)` | 선택(쌍) | **예 — `null` (D-30·D-31)** | **C-1의 자리.** 해제 = `name`·`yearMonth` 쌍 null. `''`는 regex/min에 걸려 불가하므로 null이 유일한 해제 표현 — date 컬럼이라 `''`가 부적합했던 4차 D-19와 같은 결론에 다른 근거로 도달 |
| `yearMonth` | `^\d{4}-\d{2}$` | 선택(쌍) | **예 — `null` (쌍으로만)** | `name`과 운명 공동체(pair rule). 단독 지움은 D-38 술어가 거부 |

---

## 4. API Specification

### 4.1 REST — 계약 변경 2건

| Method | Path | 변경 |
|--------|------|------|
| PATCH | `/api/cycles/:id` | ①`name`·`yearMonth`에 **쌍 null 허용** = 연결 해제 ②**편측 전송(값이든 null이든)이 200→400** — I-1 폐쇄, **이번 사이클의 유일한 계약 강화** ③키 생략 = 변경 없음(기존 유지) |
| POST | `/api/projects/:projId/cycles` | `{name:null, yearMonth:null}` 명시 전송을 **미연결 생성으로 허용**(FR-41 — 키 생략과 동일 의미). 편측은 기존대로 400(메시지만 §3.2로 개정) |

### 4.2 계약 강화의 회귀 표면 (200→400이 되는 요청)

| 소비처 | 편측 PATCH를 보내는가 | 판정 |
|--------|:---:|------|
| `CycleForm`(브라우저 유일 UI) | 항상 쌍 전송(연결 시 둘 다 값, 해제 시 둘 다 null, 그 외 필드만) | **무영향** |
| MCP | cycles 툴 0개(F36) | 해당 없음 |
| 외부 직접 호출 | 형의 curl뿐 | 400 메시지가 재시도 방법을 안내(§1.2) |

### 4.3 에러 응답 — 코드 신설 0건

pair 위반은 기존 `VALIDATION_ERROR`(400) 경로(`zValidator`)를 그대로 탄다. 에러 코드 표
(4차 §6.1 개정판, 7코드)는 **무변경** — 이번 사이클은 표에 행을 더하지도 빼지도 않는다.
바뀌는 건 pair 위반 시 `message`뿐(§3.2 `CYCLE_PAIR_MESSAGE`).

---

## 5. UI/UX Design

### 5.1 `CycleForm` 개정 (S1 + D-33)

변경 3점(전부 `CycleForm.tsx` 안, 시그니처 무변경):

| # | 지점 | 현행 | 개정 |
|---|------|------|------|
| 1 | `toggleLink(false)` | `setValue('name', undefined)` · `setValue('yearMonth', undefined)` → JSON에서 키 소실(F32) | **`setValue('name', null)` · `setValue('yearMonth', null)`** → PATCH 본문에 null 쌍이 실린다(FR-42, V2) |
| 2 | `toggleLink(true)` | `if (!getValues('yearMonth')) setValue('yearMonth', currentYearMonth())` | 유지 + **`if (getValues('name') === null) setValue('name', '')`** — 껐다 켠 뒤 입력이 null인 채 제출되면 pair 메시지가 뜨는 혼란을 막고, 빈 입력의 검증 경로를 현행(create와 동일: `min(1)` 거부)으로 정규화 |
| 3 | 제출 경로 | `handleSubmit(onSubmit)` 직결 | **confirm 래퍼**(D-33): 수정 모드에서 기존에 연결돼 있었고(`defaultValues?.name` 존재) 제출 페이로드가 `name === null`일 때만 발동. 문안은 아래 고정 — **형 확정, 임의 수정 금지** |

```typescript
// Design Ref: §5.1 D-33 — 해제 confirm. 문안은 형 확정(Checkpoint 3): 결과 2개 명시 +
// "(문서 자체는 삭제되지 않음)" 괄호 필수 — "해제 = 문서 삭제" 오해가 해제를 못 쓰게 만든다.
// 해제는 가역(재연결 가능)이고 이름 점유만 풀린다는 심상을 문안이 전달해야 한다.
function submitGuard(input: CreateCycleInput) {
  const unlinking = !!defaultValues?.name && input.name === null
  if (unlinking) {
    const ok = confirm(
      `PDCA 사이클 연결을 해제할까요?\n\n` +
        `문서 버튼이 사라지고, 사이클명 '${defaultValues!.name}'를 다른 버전이 쓸 수 있게 됩니다. ` +
        `(문서 자체는 삭제되지 않음)`,
    )
    if (!ok) return Promise.resolve() // 취소 — 전송 없음, 폼 상태 유지
  }
  return onSubmit(input)
}
// <form onSubmit={handleSubmit(submitGuard)}>
```

**발동 조건의 경계** (미발동이 정상인 경우):
- 신규 생성 폼에서 토글을 껐다 켰다 — `defaultValues?.name`이 없으므로 미발동
- 연결 없는 버전의 수정(릴리즈노트만) — 페이로드에 null 쌍이 있어도 기존 연결이 없으면 미발동
  (`toggleLink`를 안 건드리면 키 자체가 없고, 껐다 켜도 기존 연결이 없다)
- 연결 유지한 채 이름·연월 변경(리네임) — `input.name`이 문자열이므로 미발동

### 5.2 Page UI Checklist (module-3, 형 실증 — C17 ④⑤)

- [ ] 연결된 버전 수정 → 체크 해제 → 저장 → **confirm이 §5.1 문안 그대로** 뜬다
- [ ] confirm **확인** → 저장 성공 → 카드에서 4버튼·사이클명 사라짐 → **새로고침 후에도 미연결 유지** (C17④)
- [ ] confirm **취소** → PATCH 미전송(네트워크 탭 0건), 폼 상태 유지
- [ ] 해제한 사이클명을 **다른 버전에 연결 → 409 없이 성공** (C17⑤ — 이름 점유 해소)
- [ ] 같은 버전에 **재연결**(체크 켜고 이름·연월 재입력) → 4버튼 복귀 — **가역성**(D-33 문안의 근거)
- [ ] 신규 생성 폼에서 토글 껐다 켰다 → confirm 미발동, 생성 정상
- [ ] 토글 껐다(null) 다시 켰을 때 이름 입력이 빈칸으로 정상 표시(§5.1-2), 빈 채 저장 시 검증 에러
- [ ] 연결 없는 버전의 릴리즈노트만 수정 → confirm 미발동, 정상 저장 (n4의 UI 대응)

`CycleCard`는 무변경 — `hasCycle = !!name && !!yearMonth`(34행)가 null에 이미 안전(F28 확인).

---

## 6. Error Handling

### 6.1 에러 코드 표 — 무변경 (4차 §6.1 개정판이 정본)

이번 사이클은 코드 신설·삭제 0건(§4.3). pair 위반 = `VALIDATION_ERROR` 400.

### 6.2 pair 위반 응답 형태

| 요청 | 응답 |
|------|------|
| `PATCH {name:'x'}` 단독 (#5) | 400 `{"error":{"code":"VALIDATION_ERROR", …}}` — fieldErrors의 `name`에 `CYCLE_PAIR_MESSAGE` |
| `PATCH {yearMonth:'2026-08'}` 단독 (n3) | 동일 |
| `PATCH {name:null}` 편측 해제 | 동일 (V1 — 엄격 술어가 거부) |
| `PATCH {name:null, yearMonth:'2026-08'}` (RK-20) | 동일 — **느슨 술어였다면 통과했을 자리** |

---

## 7. Security · Data Considerations

- [ ] **권한 경계 무변경** — 해제는 인증된 소유자의 PATCH 안에서만 일어난다. ownerId 2단 조인
      스코프(3차 검증 완료 축) 그대로.
- [ ] **V3 — dev DB 부정합 0건 확정** (C18 후반의 절반). 수정 후 하네스 n1~n4 통과 시점에
      같은 쿼리를 재실행해 "수정 후에도 0건"을 기록한다(DoD).
- [ ] **main(프로덕션) DB 부정합** — CLI가 프로덕션 시크릿에 접근 불가(4차 §7.1.1 교훈, 4T-1).
      다만 위험은 사실상 0으로 판정한다: I-1 부정합은 API 직접 호출로만 만들 수 있는데, 형은
      브라우저 UI(항상 쌍 전송)로만 썼고 cycles MCP 툴이 0개다(F36). **선택 항목**: 형이 Neon
      콘솔(main 브랜치)에서 V3와 같은 SELECT 1회 — module-3에 선택으로만 둔다(막힘 조건 아님).
- [ ] **하네스가 프로덕션을 건드릴 경로 없음** — `DATABASE_URL`은 `.env.local`(dev 브랜치)에서만
      주입되고(F35), skip 가드(FR-52)가 env 부재 시 실행 자체를 막는다.

---

## 8. Test Plan

> **판정의 원본은 Plan §4.1 DoD 체크박스다**(P-3). 이 절은 그 15건의 요청·기대를 상세화하고
> 하네스 구조를 확정한다. 기준은 "작성"이 아니라 **"실행"** — red 1회 + green 1회.

### 8.1 테스트 범위

| 유형 | 대상 | 도구 | 단계 |
|------|------|------|------|
| **L0: 단위** | `shared/schema.test.ts` cycles 케이스 5 (§8.2) | Vitest (기본 `npm test`) | Do (module-2) |
| **L1: API** | 15 시나리오 (§8.3) — **red(module-1) → green(module-2)** | `server/cycles.l1.ts` + `npm run test:l1` (실 dev DB) | Do |
| L2: UI | §5.2 체크리스트 8항 | 수동 — 형 (module-3) | Do |
| 회귀 | 기존 6파일 49건 + `tsc -b` + `oxlint` + **`npm test` 불변 확인**(C20④) | 명령 실행 | Do (module-2 말) |

### 8.2 L0 — 스키마 단위 케이스 (`shared/schema.test.ts` 추가분)

| # | 케이스 | 기대 |
|---|--------|------|
| t1 | `updateCycleSchema.parse({ name: null, yearMonth: null })` | 통과, **둘 다 null 보존** (V1 정식화) |
| t2 | `updateCycleSchema.safeParse({ name: 'x' })` | 거부 (I-1 회귀 고정) |
| t3 | `updateCycleSchema.parse({ releaseNote: 'r' })` | 통과 (부분 수정 무회귀) |
| t4 | `updateCycleSchema.safeParse({ name: null, yearMonth: '2026-08' })` | **거부** (RK-20 회귀 고정 — 느슨 술어로의 퇴행 감지) |
| t5 | `createCycleSchema.parse({ version: 'v0.1.0', name: null, yearMonth: null })` | 통과 (FR-41 — 미연결 생성) |

### 8.3 L1 — 하네스 15 시나리오 (요청·기대 상세)

시드: owner A의 워크스페이스 `hns-ws` + 프로젝트 `hns-proj`. 버전은 `v9.` 대역(실데이터와
이름 공간 분리 — V5 격리에 더한 이중 안전).

| # | 요청 | 기대 | 비고 |
|:-:|------|------|------|
| 1 | 토큰 없이 `GET /api/projects/:id/cycles` | 401 `UNAUTHORIZED` | 골격 검증 겸 |
| 2 | **PAT B**로 A의 프로젝트 cycles 조회 | 404 `NOT_FOUND` | 소유권 경계(V5의 owner 2명이 시드) |
| 3 | `POST {version:'v9.0.1'}` (키 생략) | 201, `name`·`yearMonth` null | 미연결 생성 무회귀 |
| 4 | `POST {version:'v9.0.2', name:'hns-cycle-a', yearMonth:'2026-08'}` | 201, 둘 다 저장 | 연결 생성 무회귀 |
| **5** | `PATCH`(#4 대상) `{name:'hns-renamed'}` **단독** | **400** | **I-1 재현 — red 대상** (현행 201) |
| 6 | `POST {version:'v9.0.1'}` 재차 | 409 `details.target:'version'` | |
| 7 | `POST {version:'v9.0.3', name:'hns-cycle-a', …}` (이름 중복) | 409 `details.target:'name'` | n2의 대조군 |
| 8 | `POST {version:'9.0.4'}` (v 접두 없음) | 400 | |
| 9 | `POST {version:'v9.0.5', name:'한글이름', yearMonth:'2026-08'}` | 400 | `cycleNameSchema` regex |
| **10** | `PATCH`(#4 대상) `{name:null, yearMonth:null}` | **200** | **C-1 재현 — red 대상** (현행 400: zod가 null 거부) |
| 11 | `DELETE`(#3 대상) → 재조회 | 204 → 목록에서 소실, **사전 생성한 문서는 잔존** | 문서 독립성(FK 없음) |
| n1 | #10 직후 `GET` 재조회 | `name === null && yearMonth === null` | C17 ②③ — red 대상(#10 종속) |
| n2 | `POST {version:'v9.0.6', name:'hns-cycle-a', …}` (#10이 해제한 이름) | **201** (409 아님) | C17⑤ 이름 점유 해소 — red 대상(#10 종속) |
| n3 | `PATCH {yearMonth:'2026-09'}` 단독 | **400** | I-1 대칭 — red 대상 (F30: 현행 통과) |
| n4 | `PATCH {releaseNote:'hns note'}` 단독 | 200, `name`·`yearMonth` 유지 | pair 강화의 무회귀 — 현행도 green |

**red 예상 집합 (module-1 실행 시)**: **#5 · #10 · n1 · n2 · n3 — 5건 실패 / 10건 통과.**
Plan(C19)은 #5·#10을 필수 red로 못박았고, n1·n2·n3은 각각 #10·#10·#5의 종속·대칭이라 함께
red가 된다. 이 분포 자체가 analysis에 기록할 red 산출물이다. 5건 외 red가 나오면 하네스
골격 문제이므로 module-1 안에서 해소 후 기록한다.

### 8.4 하네스 아키텍처 (`server/cycles.l1.ts` — D-39, 커밋 자산)

```typescript
// ── 파일 상단 재사용 지침 주석 (FR-53) — 실행법·env·격리·확장 지점 4항목 필수 ──
// 실행: npm run test:l1  (.env.local의 DATABASE_URL(dev 브랜치) 주입 — 프로덕션 금지)
// env 없으면 skip (describe.skipIf — CI/DB 없는 환경에서 npm test와 무관)
// 격리: 합성 owner('hns-' 접두)로만 읽고 쓴다 — 실계정 데이터 접근 불가(ownerId 스코프)
// 확장: 새 도메인 L1은 이 파일의 골격(mintOwner/cleanup)을 import해 *.l1.ts로 추가

const hasDb = !!process.env.DATABASE_URL
describe.skipIf(!hasDb)('cycles L1 (실 dev DB)', () => {   // FR-52
  // beforeAll: ①cleanup() 선실행(이전 잔여물 제거) ②owner A·B 합성 id 생성
  //   ③PAT 2개 직접 발급: token = generateToken(); db.createApiToken(owner, 'hns-…', hashToken(token))
  //   ④app.request()로 A의 워크스페이스·프로젝트·문서 시드 (인증 헤더: Bearer <PAT>)
  // 시나리오: §8.3 표의 15건 — it() 하나당 한 행, 이름에 #번호 명시
  // afterAll: cleanup() — owner_id LIKE 'hns-%'인 workspaces(cascade)·api_tokens 삭제.
  //   beforeAll 선실행과 동일 함수라 정리 실패가 다음 실행에 누적되지 않는다(FR-50)
})
```

- `app.request()`는 서버 기동 없이 Hono 앱 전체(미들웨어→라우트→서비스→scoped→실 DB)를
  통과한다 — 2차가 확립한 검증 수준 그대로.
- 인증은 **PAT 경로만** 사용(V4) — JWKS 불필요, `DATABASE_URL` 하나로 완결. `NEON_AUTH_*`가
  없어도 돌게 하는 것이 skip 가드와 함께 재사용성의 핵심이다.
- `vitest.l1.config.ts`: 기존 config에서 alias 복제 + `include: ['**/*.l1.ts']`(F40).
- `package.json`: `"test:l1": "set -a && . ./.env.local && set +a && vitest run --config vitest.l1.config.ts"`
  (`dev:api`와 동일한 env 주입 패턴).

### 8.5 red→green 절차 (C19 — RK-23의 집행)

| 순서 | 실행 | 기록 |
|:---:|------|------|
| 1 | module-1 말: `npm run test:l1` (수정 전 코드) | **red 로그** — 5 failed(#5·#10·n1·n2·n3) / 10 passed. analysis §2에 표로 |
| 2 | module-2 말: `npm run test:l1` (수정 후) | **green 로그** — 15/15. 같은 표에 대비 기록 |
| 3 | module-2 말: `npm test` · `env -u DATABASE_URL npm run test:l1` | C20 ③④ — 기본 테스트 불변 + skip 동작 |

---

## 9. Clean Architecture

### 9.1 계층 규칙 — 4차 §9.1 유지 (추가 규칙 없음)

이번 변경(스키마·UI·하네스)은 규칙 1~6을 건드리지 않는다. 검증 위치를 zod로 단일화한
D-32가 규칙 6("에러는 `ServiceError` 경유")과 같은 축 — 서비스 계층에 검증 분기를 새로
만들지 않는다.

### 9.2 배치 — 변경 파일만

| 구성요소 | 위치 | 성격 |
|----------|------|------|
| cycles 스키마 개정(nullable·술어·update refine·export) | `shared/schema.ts` | 수정 (S1·S2) |
| L0 5케이스 | `shared/schema.test.ts` | 수정 |
| null 전송 + confirm | `src/features/cycle/components/CycleForm.tsx` | 수정 (S1) |
| **L1 하네스 15 시나리오** | `server/cycles.l1.ts` | **신규 — 커밋**(D-35·D-37) |
| L1 실행 config | `vitest.l1.config.ts` | **신규 — 커밋** |
| `test:l1` 스크립트 | `package.json` | 수정 (1줄) |

---

## 10. Coding Convention Reference

1~4차 규약 전부 유지. 이번 사이클에서 실제로 쓰는 것:

| 항목 | 적용 |
|------|------|
| zod 선택 필드(4차 §10 규약 ①) | **§3.3 P-2 표로 이행** — 4필드 전부 "지울 수 있는가" 판정 완료(4T-2a의 시험대) |
| 필드 정의/refine 분리(2차 F7) | `cycleFields` + `cyclePairRule` 분리 유지, update에도 확장(S2) |
| 술어·메시지 export 선례 | `cyclePairRule`/`CYCLE_PAIR_MESSAGE` — `documentKindStageRule`/`DOCUMENT_KIND_STAGE_MESSAGE`(4차) 형식 그대로(FR-46) |
| 주석 규약 | `// Design Ref: §N` — 스키마 블록·confirm 래퍼·하네스 상단(FR-53)에 필수 |
| MCP 스키마 재사용(4차 §10 규약 ②) | **이번 적용 대상 없음**(F36) — I-2 착수 시 D-34 조건부 지시 |

---

## 11. Implementation Guide

### 11.1 신규·수정 파일

```
코드 수정 (3):
  shared/schema.ts                              ← §3.2 cycles 블록 (S1+S2)
  shared/schema.test.ts                         ← §8.2 L0 5케이스
  src/features/cycle/components/CycleForm.tsx   ← §5.1 변경 3점 (null·정규화·confirm)
신규 (2) + 스크립트 (1):
  server/cycles.l1.ts                           ← §8.3·§8.4 하네스 (커밋 자산, FR-51~53)
  vitest.l1.config.ts                           ← F40 ② (include *.l1.ts)
  package.json                                  ← "test:l1" 1줄
확인만 (tsc -b가 판정, 수정 예상 0 — F31):
  server/services/cycles.ts · server/db/scoped.ts · server/routes/cycles.ts
  src/features/cycle/{components/CycleList.tsx, components/CycleCard.tsx, api.ts, hooks/useCycles.ts}
무변경 확정:
  server/db/schema.ts · drizzle/ (F37)  ·  server/mcp/** (F36)  ·  vercel.json
```

### 11.2 구현 순서 (Plan §9 모듈에 Design 섹션 매핑)

| Module | 스코프 | Design 참조 | 완료 판정 |
|:------:|:---:|-------------|-----------|
| 1 | S3 전반+자산화 | §8.3·§8.4 — **인프라(config·스크립트·skip) 먼저**, 골격·15 시나리오, red 실행 | **red 5건 확정 기록**(§8.5-1) + C20 ③④ 선확인 |
| 2 | S1+S2 | §3.2·§5.1·§8.2 | green 15/15(§8.5-2) + L0 5케이스 + `tsc -b`·`oxlint`·`npm test` 불변 + V3 쿼리 재실행 0건 (**C18·C19·C20**) |
| 3 | S1 실증+S3 마감 | §5.2 체크리스트 8항(형) + FR-53 주석 최종 + (선택) §7 main 부정합 조회(형) | **C17 ④⑤** + C20 전건 |

- **커밋 단위**: module-1(하네스+인프라) 1커밋 — red 상태의 하네스가 커밋되므로 메시지에
  "red 기준선" 명시. module-2(수정+green) 1커밋. 사이클 문서 4종은 RULE.md대로 종료 시 1커밋.
- **red 커밋의 CI 안전**: `*.l1.ts`는 기본 `npm test` 밖(F40①)이라 red 상태로 커밋해도
  기존 테스트·빌드는 그린 — red 기준선을 커밋으로 남길 수 있는 것 자체가 D-35의 부수 이득.

### 11.3 Session Guide

#### Module Map

| Module | Scope Key | 내용 | 예상 규모 |
|--------|-----------|------|:---------:|
| 하네스+red | `module-1` | 실행 인프라 + 골격 + 15 시나리오 + red 기록 | 중 (골격이 본체) |
| 수정+green | `module-2` | 스키마 블록 + 폼 3점 + L0 + green | 소 |
| 실증+마감 | `module-3` | 형 브라우저 8항 + 주석·정리 확인 | 소 (형 비동기) |

#### 권장 세션 계획 (Plan §9 그대로)

| 세션 | 스코프 | 비고 |
|------|--------|------|
| 1 | Plan + Design | 완료 (본 문서) |
| 2 | `--scope module-1,module-2` | 하네스 컨텍스트가 이어지므로 한 세션. red→green 연속 기록 |
| 3 | `--scope module-3` + analysis·report | 형 확인 후. C17 ④⑤는 형의 브라우저가 관문 |

---

## Version History

| 버전 | 날짜 | 변경 내용 | 작성자 |
|------|------|-----------|--------|
| 0.1 | 2026-08-09 | 최초 작성. Plan §6.2 검증 5건 전건 실측(§1.3): **V1**로 D-38(엄격 pair 술어) 확정 — 느슨 술어의 편측 해제 통과 반례 확보, **V2**로 D-31(a)(공유 필드 nullable) 확정 — zodResolver 순수 호출로 폼 경로 null 통과 실측, **V3**로 dev DB 부정합 0건(RK-21 미실현·정리 조치 불필요), **V4·V5**로 D-39(하네스 = PAT 직접 발급 + 합성 owner 2명 격리, `hns-` 접두 cleanup) 확정. Checkpoint 3에서 형이 **D-33 확정** — 저장 시점 confirm + 문안 지정(결과 2개 명시, "(문서 자체는 삭제되지 않음)" 괄호 필수 — 해제는 가역이고 이름 점유만 풀린다는 심상). §3.3에 **P-2 형식 첫 적용**(4필드 × "지울 수 있는가", 빈칸 없음 — releaseNote는 `''` 방식 현행 유지 판정). §8.3에 15 시나리오 요청·기대 상세 + **red 예상 집합 5건**(#5·#10·n1·n2·n3) 명시, §8.4에 커밋 자산 하네스 구조(FR-51~53) 확정 | cogmo |
