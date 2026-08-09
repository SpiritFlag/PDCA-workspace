---
template: design
version: 1.2
---

# expand-mcp-agency 설계 문서

> **한 줄 요약**: `shared/transition.ts`를 **경계·의미의 단일 원천**으로 승격한다 — MCP 허용
> 집합(`todo` 복귀만 형 전용)과 상태 의미(`STATUS_MEANING`)를 한 파일에 두고, `tools.ts`의
> zod enum·description과 `ItemDialog` 툴팁이 전부 거기서 파생된다. cycles 읽기 툴 2개를
> 신설하고, 5차 하네스 골격을 `l1-harness.ts`로 추출해 MCP 경로 검증까지 같은 골격 위에서 돌린다.
>
> **프로젝트**: PDCA-workspace
> **작성자**: cogmo
> **작성일**: 2026-08-09
> **상태**: Approved 대기 아님 — Plan 승인(§1.5.1) + Checkpoint 3 확정(§1.4) 반영 완료
> **Plan 문서**: [expand-mcp-agency.plan.md](./expand-mcp-agency.plan.md) (v0.2 Approved)

---

## Context Anchor

> Plan에서 전파. Do 문서로 재전파되어 세션 간 컨텍스트 연속성 유지.

| Key | Value |
|-----|-------|
| **WHY** | 2차 Q10b 경계가 실사용 비용(5차 완주 시 형의 수동 전환 7건)을 발생시켰고, 형이 2026-08-08에 권한 확대를 결정했다. 동시에 "완료/해소"의 의미가 코드에 없어 권한만 열면 오작동한다 — **경계 이동과 의미 정의는 분리 불가**다. cycles 툴 0개(5차 F36)는 3차부터 3회 이월된 기능 공백이다. |
| **WHO** | 형(cogmo) — 승인자이자 **프로덕션 배포·웹 커넥터 실호출의 실행 주체**(4T-1) / 클로드(Claude Code CLI) — 코드·dev DB 하네스 / **claude.ai 웹 MCP 커넥터 — 이번 사이클의 1급 소비자** |
| **RISK** | 권한만 열고 의미를 안 박으면 클로드가 `done`을 남발한다(RK-28) / 골격 추출이 5차 하네스 15/15를 깬다(RK-30) / MCP L1 경로 3번째 재건축(RK-32) / 2차 문서 사후 개정 9곳 누락(RK-34) |
| **SUCCESS** | C21~C25 — **Match Rate**(D-40) + C21·C22·C23·C25는 "클로드가 웹 커넥터로 실제로 해냈다"까지(형+클로드 실증) |
| **SCOPE** | 5건 고정(S1 권한 확대 / S2 의미 명문화 / S3 cycles 읽기 툴 / S4 하네스 재사용 / S5 reorder 실행 확인). 쓰기 툴 0건(D-46·A2), `todo` 복귀는 형 전용(D-42·A1), hard delete 미노출 불변(D-43) |

---

## 1. Overview

### 1.1 설계 목표

1. **단일 원천의 물리적 강제** — 허용 집합이 `transition.ts`와 `tools.ts`에 각각 하드코딩된
   현행 구조(Plan F42)를 없앤다. 개정 후에는 `MCP_ALLOWED_TARGETS` 튜플 **하나**를 고치면
   `canTransition`(2차 방어)·zod enum(1차 방어)·툴 description(클로드가 읽는 텍스트)이 전부
   따라온다. 심층 방어 2층은 유지하되 **정의는 1곳**(D-44).
2. **의미가 소비자 3곳에 닿게** — `STATUS_MEANING`(D-45)을 툴 description(클로드가 호출 직전에
   읽는 유일한 텍스트, RK-28의 급소)·`ItemDialog` 툴팁(형이 보는 자리)·코드 주석이 아닌
   **런타임 값**으로 배선한다.
3. **골격 위의 확장** — MCP L1 검증을 5차 골격의 추출본 위에서 돌린다(D-48·D-49). 신규 설정
   파일 0건, `vitest.l1.config.ts`·`test:l1` 그대로 — **5차 자산화의 배당금을 소비하는 것
   자체가 S4의 실증**이다.

### 1.2 설계 원칙

- **경계를 옮기면 옮긴 자리를 문서화한다** — 코드 주석(`// Design Ref`)에 "무엇을 열었나"가
  아니라 **"무엇이 닫혀 있나"**(todo 복귀·hard delete)를 적는다. 다음에 읽는 사람이 물어볼
  질문이 그쪽이다.
- **새 판단 최소화** — MCP 툴 형태는 2차 §4.4(등록·ok/fail 헬퍼·RK-07 description), 에러는
  4차 §6.1 개정판, 하네스는 5차 D-35/D-37/D-39를 그대로 승계한다. 이 문서의 신규 결정은
  Checkpoint 3 문안 2건(§1.4)과 파생 세부(§3·§4)뿐이다.
- **기능 사이클의 검증 형식** — 4·5차의 red→green을 "기준선 기록"으로 변형한다: m1·m2를
  **개정 전에 돌려 거부(red)를 기록**하고, 개정 후 성공(green)으로 뒤집힌 것을 증거로 남긴다(§8.5).

### 1.3 Plan §6.2 검증 결과 (전건 실측 완료, 2026-08-09)

이 설계의 모든 결정은 아래 실측 위에 서 있다. 스크립트는 실행 후 삭제(2차 관례),
V6은 문안이므로 §8.4에 실물로 남는다.

| # | 검증 | 방법 | 결과 | 확정되는 결정 |
|---|------|------|------|------|
| **V1** | MCP 경로를 `app.request()`로 태우는 방법(RK-32) | 합성 owner(`hns-owner-probe-*`) PAT 실발급 → `/api/mcp`에 raw JSON-RPC POST 5케이스(dev DB) | **initialize 선행 불필요** — stateless라 단발 `tools/call`이 그대로 성립(200 JSON, `project_list` 정상 응답). **Accept 헤더도 불요**(`enableJsonResponse: true`가 JSON 응답 고정). 미인증은 401 `UNAUTHORIZED`. Content-Type: `application/json`만 필수 | **D-49 확정** — `rpc()` 헬퍼는 헤더 2개(Authorization·Content-Type)로 충분. 인증·Origin·라우팅 전 구간 통과 |
| **V2** | `as const` 튜플 → `z.enum` 파생 형태(FR-56) | `['doing','done','resolved','dropped'] as const satisfies readonly BacklogStatus[]` 선언으로 `z.enum`·`includes` 호출부 재현 | `z.enum(MCP_ALLOWED_TARGETS)` options 4값 정상, `todo` 거부. `includes(to)`는 **`as readonly BacklogStatus[]` 캐스팅 1회**로 성립(튜플 리터럴 타입이 `BacklogStatus` 전체를 안 받으므로). `satisfies`가 오타를 컴파일 에러로 잡는다 | §3.2의 선언 형태 확정 |
| **V3** | `l1-harness.ts` 파일명의 vitest 수집 여부(RK-31) | 더미 파일 생성 후 `npm test` + `vitest run --config vitest.l1.config.ts` 실행, 삭제 | **양쪽 다 미수집** — `npm test` 6파일 54건 불변, `test:l1` 1파일(cycles) 15건 그대로. "no test suite" 에러 없음 | **D-51 확정** — 파일명 `server/l1-harness.ts` |
| **V4** | 골격 추출의 최소 변경 형태(RK-30) | `cycles.l1.ts` 6함수의 의존 분석 | 6함수 **전건 추출 가능** — `cleanup`·`mintToken`은 독립, `req`는 REST·MCP 공용(MCP도 결국 `app.request` POST), `body`/`errBody`/`seedWorkspaceProject`는 `req`에만 의존. `cycles.l1.ts`에 남는 것은 `hasDb` 판정·RUN/OWNER 상수·시나리오뿐 — **diff가 import 교체 + 함수 정의 삭제로 끝난다** | §8.4 골격 구성 확정. 실행 검증은 module-1 FR-70 |
| **V5** | `releaseNote` 분포(RK-33) | dev DB `LENGTH(release_note)` 집계(읽기만) | 현 2건, 최대 4자(테스트 값 수준) — 현재는 위험 없음. 상한 50,000자는 스키마 사실로 유효 | **D-52 확정** — `cycle_list`는 본문 제외(`hasReleaseNote`로 치환), `cycle_read`만 본문 포함 |
| **V6** | 웹 커넥터 실증 시나리오 사전 정리(4T-1) | 형이 채팅에서 시킬 문장을 사전 작성 | §8.6 표로 작성 완료 — C22-②는 "의도한 완료"와 "우연한 해소" 두 상황의 대상 항목을 module-4 직전에 형이 백로그에서 지정 | §8.6 |

### 1.4 Checkpoint 3 — 형 결정 (2026-08-09)

아키텍처 3안 비교는 **생략** — 4·5차 선례대로 옵션 B(서비스 계층)가 형 승인으로 고정돼 있고,
이 사이클은 구조가 아니라 권한 경계를 바꾼다(Plan §7.1). 이번 Checkpoint 3은 5차 A4(확인
문구 문안)와 같은 성격 — **사용자에게 그대로 노출되는 문안 2건**을 형이 확정했다:

| # | 질문 | 형의 답 |
|---|------|---------|
| **CK3-1** | `STATUS_MEANING` 5키 문안 | **초안 승인 + `resolved` 1건 수정** — "의도한 건 아닌데 다른 작업 중 우연히 같이 해결됨 **또는 필요가 없어짐**". 나머지 4키(todo·doing·done·dropped)는 초안대로. done·resolved의 골격은 형 정의(2026-08-08) 원문 유지 |
| **CK3-2** | FR-57 거부 메시지 문안 | **A안** — "status를 todo로 되돌릴 수 없습니다 — 재개·재작업 결정은 사용자가 UI에서 직접 합니다." (잔여 경계의 **이유**까지 담아, 클로드가 형에게 그대로 전달할 수 있는 문장 — 2차 §6.2 원칙) |

`resolved`의 "또는 필요가 없어졌음" 추가가 의미를 넓힌다 — **우연한 해결뿐 아니라 전제 소멸**
(다른 결정으로 문제 자체가 사라진 경우)도 `resolved`다. `dropped`("하지 않기로 판단")와의
경계는 **능동적 판단 여부**: 내가 내려놓으면 dropped, 상황이 없애면 resolved.

---

## 2. Architecture

### 2.1 변경 지점 다이어그램

```
                     ┌─ shared/transition.ts ──────────────────────────────┐
                     │  MCP_ALLOWED_TARGETS  (2값 → 4값, export 승격)      │ ★ 급소
                     │  canTransition        (본체 무변경 — 배열만 넓어짐) │
                     │  STATUS_MEANING       (신설 — 의미의 단일 원천)     │
                     └───────┬───────────────────┬─────────────────┬───────┘
             파생(zod enum)  │        참조(문안) │                 │ 참조(툴팁)
                             ▼                   ▼                 ▼
   ┌─ server/mcp/tools.ts ─────────────┐  ┌─ services/backlog.ts ─┐  ┌─ src ItemDialog ─┐
   │ backlog_update:                   │  │ 거부 메시지 재작성    │  │ 배지 title=      │
   │   z.enum(MCP_ALLOWED_TARGETS)     │  │ (CK3-2, 분기 무변경)  │  │ STATUS_MEANING[s]│
   │   description ← STATUS_MEANING    │  └───────────────────────┘  └──────────────────┘
   │ cycle_list / cycle_read (신설)────┼──→ services/cycles.ts       src labels.ts
   │                                   │     getCycleByVersion 신설    (표시명 전용으로
   └───────────────────────────────────┘     (scoped 3함수는 기존)       역할 좁힘)

   ┌─ server/l1-harness.ts (신설) ─────────────────────────────────────────┐
   │ cleanup·mintToken·req·body·errBody·seedWorkspaceProject  ← cycles.l1.ts에서 추출
   │ rpc·callTool (MCP JSON-RPC 헬퍼, 신설 — V1 실측 형태)                 │
   └──────────┬──────────────────────────────┬─────────────────────────────┘
              │ import                       │ import
              ▼                              ▼
      server/cycles.l1.ts (15건 유지)   server/mcp.l1.ts (신설, m1~m13)
```

### 2.2 의존 관계 변화

| 관계 | 현행 | 개정 후 |
|------|------|---------|
| `tools.ts` → `transition.ts` | **없음** (enum 리터럴 복제) | `MCP_ALLOWED_TARGETS`·`STATUS_MEANING` import — 드리프트 구조적 불가 |
| `ItemDialog` → `transition.ts` | `canTransition`·`isClosed`만 | + `STATUS_MEANING` |
| `labels.ts` | "단일 원천" 자기선언(라벨+색) | **표시명·색 전용**으로 역할 축소 — 헤더 주석 갱신(FR-63) |
| `cycles.l1.ts` → 골격 | 자기 파일 안 | `l1-harness.ts` import — **시나리오 코드 무변경**(V4) |
| `tools.ts` → `services/cycles.ts` | 없음 | `listCycles`·`getCycleByVersion` 호출(§9.1 규칙 준수) |

---

## 3. Data Model

### 3.1 DB — 무변경

테이블·컬럼·인덱스·마이그레이션 **0건**(Plan §6). 상태는 이미 text 컬럼이고 cycles 툴은
기존 테이블을 읽기만 한다.

### 3.2 `shared/transition.ts` 개정 전문 (S1 + S2의 공유 지점)

```typescript
// Design Ref: §3.2 — Q10a·Q10b의 코드화(2차) → 6차 개정: 완료 판정은 "판단"이라 클로드도,
// todo 복귀(재개·재작업)는 "결정"이라 형 전용(D-42). 서버 서비스·MCP 툴·UI 배지가 전부 이것만 호출

export type BacklogStatus = 'todo' | 'doing' | 'done' | 'resolved' | 'dropped'
export type Actor = 'user' | 'mcp'

// Design Ref: §3.2 D-42·D-44 — mcp 허용 목적지 = 전 상태 − todo. tools.ts의 zod enum이
// 이 튜플에서 파생된다(1·2차 방어의 집합 단일 원천). 닫혀 있는 것: todo 복귀(여기), hard delete(D-43, 툴 미등록)
export const MCP_ALLOWED_TARGETS = [
  'doing', 'done', 'resolved', 'dropped',
] as const satisfies readonly BacklogStatus[]

/** actor='user'는 전 전이 허용. actor='mcp'는 to ∈ MCP_ALLOWED_TARGETS — todo 복귀만 형 전용(D-42). from===to는 항상 true */
export function canTransition(from: BacklogStatus, to: BacklogStatus, actor: Actor): boolean {
  if (from === to) return true
  if (actor === 'user') return true
  return (MCP_ALLOWED_TARGETS as readonly BacklogStatus[]).includes(to)  // V2 — 캐스팅 1회 필요
}

/** 종료 상태 여부 — 접힘 섹션 분류·closed_on 권장 판정에 공용 */
export function isClosed(status: BacklogStatus): boolean {
  return status === 'done' || status === 'resolved' || status === 'dropped'
}

// Design Ref: §3.2 D-45 — "언제 이 상태를 찍는가"의 단일 원천(형 정의 2026-08-08 + CK3-1 확정).
// 소비자: tools.ts backlog_update description / ItemDialog 배지 툴팁. labels.ts는 표시명·색 전용(FR-63)
export const STATUS_MEANING: Record<BacklogStatus, string> = {
  todo: '아직 착수하지 않은 항목',
  doing: '지금 작업 중인 항목',
  done: '이 문제를 해결하려고 의도했고, 의도대로 해결됨',
  resolved: '의도한 건 아닌데 다른 작업 중 우연히 같이 해결됨 또는 필요가 없어짐',
  dropped: '하지 않기로 판단해 내려놓은 항목 (되돌릴 수 있음)',
}
```

**변경 요약**: `canTransition`·`isClosed` **본체는 무변경**이다 — 배열이 2→4값이 되고 export가
붙고 상수 하나가 신설될 뿐. REST 경로(`actor='user'`)는 이 개정의 영향 밖(§3.2 NFR).

### 3.3 zod 필드 표 — **P-2 형식** ("지울 수 있는가" 열, 세 번째 적용)

이번 사이클의 신규·개정 zod 입력 전건. **빈칸 없음** — 예상대로(Plan §8.2) 전건 "아니오"이며,
그 사실 자체가 4·5차와 다른 점이다(이번엔 nullable 후보 필드가 아예 없다).

| 툴.필드 | 스키마 | 필수 | **지울 수 있는가** | 근거 |
|---------|--------|:---:|:---:|------|
| `backlog_update.status` | `z.enum(MCP_ALLOWED_TARGETS).optional()` (개정 — 파생) | 선택 | **아니오** | 키 생략=무변경. 상태는 항상 5값 중 하나로 존재하고 "지운다"는 개념 자체가 없다. `null` 불허 |
| `cycle_list.projectId` | `z.uuid()` (신규) | 필수 | **아니오** | 조회 키 |
| `cycle_read.projectId` | `z.uuid()` (신규) | 필수 | **아니오** | 조회 키 |
| `cycle_read.version` | `cycleVersionSchema` 재사용 (신규, 4T-2b) | 필수 | **아니오** | 조회 키. `shared/schema.ts:110-112` 원본 그대로 — 형식 오류는 zod가 조기 거부(4차 RK-14 방식) |

읽기 툴뿐이라 **쓰기 계열 nullable 판단이 발생하지 않는다** — 그 판단이 필요해지는 순간이
곧 5차 D-34 조건부 지시의 발동 시점이다(쓰기 툴 신설 시, §2.2 재이월).

---

## 4. API Specification

### 4.1 MCP 툴 — 개정 1 + 신설 2 (총 8 → 10)

> 등록 형태·`ok()`/`fail()` 헬퍼·`ServiceError` 경유는 2차 §4.4·4차 §6.2 그대로. description은
> "언제 호출하는지"(RK-07). **description 문자열은 `STATUS_MEANING`에서 조립**한다(FR-61) —
> 문장을 복제하지 않는다.

| 툴 | 입력 (zod) | description (확정 문안) |
|---|---|---|
| `backlog_update` (개정) | `id`, `title?`, `priority?`, `detail?`, `openedOn?`, `closedOn?`, **`status?: z.enum(MCP_ALLOWED_TARGETS)`** | ``항목 갱신. status 지정 기준 — doing: ${STATUS_MEANING.doing} / done: ${STATUS_MEANING.done} / resolved: ${STATUS_MEANING.resolved} / dropped: ${STATUS_MEANING.dropped}. todo로 되돌리기는 사용자 전용이라 거부된다(D-42). 날짜는 YYYY-MM-DD 형식`` |
| `cycle_list` (신설) | `projectId: z.uuid()` | `프로젝트의 릴리즈(버전) 목록과 PDCA 사이클 연결 상태를 확인할 때. 릴리즈노트 본문은 제외된다(hasReleaseNote로 유무만) — 본문은 cycle_read로 읽는다` |
| `cycle_read` (신설) | `projectId: z.uuid()`, `version: cycleVersionSchema` | `버전 하나의 릴리즈노트 본문을 읽는다. 백로그 판단에 이전 사이클의 릴리즈 이력이 필요할 때 (version은 v0.1.0 형식)` |

**`cycle_list`의 응답 성형**(D-52, V5): `listCycles` 결과의 각 행에서 `releaseNote`를
`hasReleaseNote: boolean`으로 치환한다. 치환은 **툴 어댑터(tools.ts)에서** 한다 — §9.1이 금지하는
것은 쿼리 직접 실행이지 응답 성형이 아니고, REST(`GET /cycles`)는 본문 포함 응답을 유지해야
하므로 서비스 계층에서 빼면 REST가 회귀한다.

**미노출 재확인**(D-43, FR-59): 전 리소스 delete 계열·workspace/project create/update·
**cycles 쓰기 전부**. `tools/list`는 정확히 10개여야 한다(m7).

### 4.2 서비스 계층 — 신설 1

```typescript
// services/cycles.ts에 추가
/** Design Ref: §4.2 — cycle_read의 단건 조회. ensureProject 선행으로 타인 프로젝트는 404(m12) */
export async function getCycleByVersion(ownerId: string, projectId: string, version: string) {
  await ensureProject(ownerId, projectId)
  const cycle = await db.getCycleByVersion(ownerId, projectId, version)
  if (!cycle) throw new ServiceError('NOT_FOUND', '')
  return cycle
}
```

`db.getCycleByVersion`은 기존 함수(scoped.ts:264, ownerId 2단 조인 스코프) — **db 계층 무변경**.
`ensureProject`가 이중 방어의 앞단(프로젝트 자체가 타인 것이면 version 존재 여부와 무관하게 404).

### 4.3 REST — 무변경

이번 개정은 `actor='mcp'` 분기와 MCP 툴만 건드린다. REST 단건 GET cycles를 만들지 않는다
(스코프 외 — MCP만 신설, Plan §1.3.3).

### 4.4 에러 응답 — 코드 신설 0건

4차 §6.1 개정판이 정본 그대로. `TRANSITION_DENIED`(403)의 **발생 조건만 좁아진다** —
"MCP가 doing/done 시도" → **"MCP가 todo 복귀 시도"**. 이 표의 원문 갱신이 2차 문서 사후
개정 9곳 중 하나다(§10.2).

---

## 5. UI/UX Design

### 5.1 `ItemDialog` — 배지 툴팁 (S2 ③, 신규 추가)

```tsx
// 현행 (ItemDialog.tsx:181-190): <button>에 설명 속성 없음 (Plan F45)
<button type="button" key={s} onClick={() => handleStatusClick(s)}
  title={STATUS_MEANING[s]}          // ← 이 한 줄 추가 (FR-62)
  className={…}>
  <Badge color={STATUS_COLOR[s]} label={STATUS_LABEL[s]} />
</button>
```

네이티브 `title` 툴팁으로 충분하다 — 커스텀 툴팁 컴포넌트는 만들지 않는다(이 앱의 기존
관례도 `title`·`aria-label`, F45의 hard delete 버튼과 동일 수준). 상태 전이 로직·배지 색·
클릭 동작은 **전부 무변경**.

### 5.2 `labels.ts` — 역할 축소 (FR-63)

헤더 주석을 갱신한다: "enum ↔ 화면 라벨·색상 매핑 단일 원천" → **"표시명·색상 전용.
상태의 의미('언제 찍는가')는 `@shared/transition`의 `STATUS_MEANING`이 단일 원천"**.
코드 변경은 주석뿐 — `STATUS_LABEL`·`STATUS_COLOR`·`STATUS_ORDER` 전부 그대로.

### 5.3 Page UI Checklist (module-4, 형 실증)

- [ ] `ItemDialog` 열고 상태 배지 5개에 마우스 오버 → 각각 `STATUS_MEANING` 문안이 뜬다 (C22-③)
- [ ] 배지 클릭 전이(user 경로)가 기존과 동일하게 동작 — 회귀 없음
- [ ] 클로드가 `done`으로 찍은 항목이 새로고침 후 "완료" 섹션에 있다 (C21-② 후행 확인)

---

## 6. Error Handling

### 6.1 거부 메시지 — CK3-2 확정 문안

```typescript
// services/backlog.ts:37-43 — 분기 무변경, 메시지만 교체 (FR-57)
if (input.status !== undefined && !canTransition(existing.status, input.status, actor)) {
  throw new ServiceError(
    'TRANSITION_DENIED',
    'status를 todo로 되돌릴 수 없습니다 — 재개·재작업 결정은 사용자가 UI에서 직접 합니다.',
    { from: existing.status, to: input.status, actor },
  )
}
```

개정 후 `canTransition`이 false가 되는 경우는 **`actor='mcp'` ∧ `to='todo'` ∧ `from≠'todo'`
단 하나**이므로, 메시지가 `to`를 보간할 필요 없이 todo 고정 문안이 정확하다. `details`의
`from`/`to`/`actor`는 유지(디버깅용).

### 6.2 `cycle_read`의 NOT_FOUND

`fail()` 헬퍼가 `[NOT_FOUND]` 텍스트 + `isError`로 변환(4차 §6.2 매핑 그대로). 프로젝트가
타인 것이든 version이 없든 **구분 없이 404**(2차 §6.1 원칙 — 존재 여부 누설 방지, m11·m12가
같은 코드를 기대하는 이유).

---

## 7. Security · Data Considerations

- **잔여 경계의 코드 명시**(D-42): `MCP_ALLOWED_TARGETS` 주석에 "닫혀 있는 것"을 적는다(§3.2) —
  todo 복귀(이 파일)와 hard delete(툴 미등록, D-43). 경계를 찾는 사람이 한 파일에서 답을 얻는다.
- **hard delete 불변**(FR-59): `registerTools`에 delete 계열 0건 유지. m7(`tools/list` 10개,
  delete 0)이 회귀 감지선이다.
- **읽기 툴의 노출 범위**: `cycle_read`는 ownerId 2단 조인 스코프 + `ensureProject` 이중이라
  타 소유자 데이터 도달 경로가 없다(m12). `releaseNote`는 이미 형이 웹 UI로 보는 데이터 —
  MCP 노출로 새로 열리는 정보 없음.
- **하네스 격리**: 5차 규약 그대로 — `hns-` 접두 owner·`v9.` 버전 대역, `cleanup` 선실행/후실행.
  `mcp.l1.ts`의 픽스처(FX-*)도 같은 이름공간이라 기존 `cleanup`(workspaces cascade + api_tokens)에
  **자동으로 함께 걸린다**(Plan §1.3.4).

---

## 8. Test Plan

> 테스트 코드는 Do 단계에서 구현과 1:1 작성. **판정의 원본은 Plan §4.1 체크박스**(P-3).

### 8.1 테스트 범위

| 유형 | 대상 | 도구 | 단계 |
|------|------|------|------|
| **L0: 단위** | `transition.test.ts` T2·T3 반전 + T9·T10 + `STATUS_MEANING` 키 집합 | Vitest | Do (module-2) |
| L1: API | `mcp.l1.ts` m1~m13 + **`cycles.l1.ts` 15건 전수 재실행**(골격 추출 무회귀) | 실 dev DB `app.request()` 하네스 | Do (module-1~3) |
| L2: UI | §5.3 체크리스트 | 수동 — 형 | Do (module-4) |
| L3: 실배포·실사용 | §8.6 웹 커넥터 시나리오 5건 | 프로덕션 + claude.ai 웹 커넥터 | Do (module-4, 형) |

### 8.2 L0 — `transition.test.ts` 개정분

| # | 케이스 | 현행 기대 | 개정 기대 |
|---|--------|:---:|:---:|
| T2 | `todo → doing`, mcp | false | **true** (반전 — 2차 "TRANSITION_DENIED의 원천" 주석도 T9로 이관) |
| T3 | `doing → done`, mcp | false | **true** (반전. user는 계속 true) |
| T6 | `resolved → todo`, mcp | false | false (**유지** — 잔여 경계) |
| **T9** | `done → todo`, mcp | — | **false** (신설 — D-42의 직접 고정) |
| **T10** | `dropped → todo`, mcp | — | **false** (신설 — 대칭) |
| T1·T4·T5·T7·T8 | — | 무변경 | 무변경 (user 전 허용·mcp resolved/dropped·동일 상태) |
| **T11** | `STATUS_MEANING` | — | 5키 존재 + 키 집합 = `BacklogStatus` (Record 타입이 컴파일로 강제, 런타임은 문안 비어있지 않음만) |

### 8.3 L1 — `mcp.l1.ts` 시나리오 상세 (m1~m13)

> Plan §1.3.4의 공유 픽스처 매트릭스(5T-2)를 그대로 승계. **`FX-item1`은 m1→m2→m5 3단 순차
> 종속** — vitest 파일 내 순차 실행에 의존하며, 5차의 오염 사고 형태라 전용 레코드로 이미 격리돼
> 있다(FX-item2~4 분리). 요청·기대만 여기서 상세화한다.

| # | 요청 (JSON-RPC `tools/call`) | 기대 | 픽스처 |
|:-:|------|------|:---:|
| m1 | `backlog_update {id: FX-item1, status:'doing'}` | 성공 — 응답 text JSON의 `status==='doing'` | FX-item1 |
| m2 | `backlog_update {id: FX-item1, status:'done'}` | 성공 — `status==='done'` | FX-item1 ←m1 |
| m3 | `backlog_update {id: FX-item2, status:'resolved'}` | 성공 (무회귀) | FX-item2 |
| m4 | `backlog_update {id: FX-item3, status:'dropped'}` | 성공 (무회귀) | FX-item3 |
| m5 | `backlog_update {id: FX-item1, status:'todo'}` | **isError + `[TRANSITION_DENIED]` + CK3-2 문안 포함** | FX-item1 ←m2 |
| m6 | REST `PATCH /api/backlog/:FX-item4 {status:'doing'}` (user) | 200 (무회귀) | FX-item4 |
| m7 | `tools/list` | **정확히 10개**, 이름에 `delete` 계열 0 | — |
| m8 | `backlog_reorder {projectId, ids: [FX-item1~4 전체 셔플]}` | 성공 `{ok:true}` — **S5** | 전체 |
| m9 | `cycle_list {projectId}` | 2건. `v9.1.2` 행은 `name`·`yearMonth` null + **`hasReleaseNote` 필드 존재, `releaseNote` 키 부재**(D-52) | FX-cycle1·2 |
| m10 | `cycle_read {projectId, version:'v9.1.1'}` | 성공 — **`releaseNote` 본문 일치** | FX-cycle1 |
| m11 | `cycle_read {projectId, version:'v9.9.9'}` | isError + `[NOT_FOUND]` | — |
| m12 | B 토큰으로 `cycle_read {projectId(A), version:'v9.1.1'}` | isError + `[NOT_FOUND]` (구분 없음, §6.2) | FX-B |
| m13 | 미인증 `/api/mcp` POST | **HTTP 401** `UNAUTHORIZED` (V1 ⑤ 실측 그대로) | — |
| — | `cycles.l1.ts` 15건 재실행 | **15/15** (FR-70) | 5차 픽스처 |

### 8.4 하네스 아키텍처 — `server/l1-harness.ts` (신설, D-48·D-51)

```typescript
// 골격(5차 cycles.l1.ts에서 추출 — V4: 6함수 전건):
export async function cleanup()                          // hns-% workspaces cascade + api_tokens
export async function mintToken(ownerId, label)          // PAT 실발급(5차 D-39)
export async function req(token, path, init?)            // app.request + Bearer 헤더
export async function body<T>(res)                       // REST 응답 캐스팅 (하네스 전용)
export async function errBody(res)
export async function seedWorkspaceProject(token, tag)   // ws+proj 시드
export const hasDb = !!process.env.DATABASE_URL          // describe.skipIf 공용

// MCP 헬퍼(신설 — V1 실측 형태, RK-32의 3번째 재건축 차단이 목적, FR-72):
export async function rpc(token, method, params?)        // 단발 JSON-RPC POST — initialize 불요(V1),
                                                         // 헤더는 Authorization·Content-Type 2개(V1)
export async function callTool(token, name, args)        // rpc('tools/call') + content[0].text 파싱
                                                         // → { ok, isError, data|text } 반환
```

- 파일명이 `.l1.ts` 접미사가 **아니므로** 어느 vitest config에도 수집되지 않고(V3),
  `server/` 아래라 `tsc -b`·`oxlint`가 커버한다(5차 F40 ③ 그대로).
- 파일 헤더 주석: 실행법·env 요구·격리 규칙(5차 FR-53 형식) + **"MCP 시나리오는 `callTool`을
  쓰라"**를 명시 — 다음 도메인의 확장 지점.
- `cycles.l1.ts`는 골격 6함수 정의를 지우고 import로 교체 — **시나리오 15건의 코드는 무변경**(V4).

### 8.5 기준선 red → green 절차 (C21-①의 증거 형식)

| 시점 | 실행 | 기대 결과 | 기록 |
|------|------|-----------|------|
| module-1 말 (개정 **전**) | `mcp.l1.ts` 중 m1·m2만 | **둘 다 isError `TRANSITION_DENIED`** — 현행 경계의 실측 기준선 | "red 2건" — analysis에 남긴다 |
| module-2 말 (개정 **후**) | m1~m6 전건 | m1·m2 **성공으로 반전**, m5는 **거부 유지** | red→green 반전 + 잔여 경계 생존을 한 표로 |

5차의 red→green(결함 재현→수정)과 형식은 같지만 의미가 다르다 — 이번 red는 결함이 아니라
**옛 경계의 마지막 기록**이고, m5의 지속 red가 **새 경계의 첫 기록**이다.

### 8.6 L3 — 웹 커넥터 실증 시나리오 (V6, module-4, 실행: **형**)

> 형이 claude.ai 채팅에서 시킬 문장을 미리 적어둔다(4T-1). ②는 대상 항목 2건(의도한 완료
> 1·우연한 해소 1)을 형이 실행 직전에 백로그에서 지정한다.

| # | 형이 시킬 문장 (예시) | 성공 기준 | SC |
|:-:|------|-----------|:---:|
| 1 | "PDCA-workspace 백로그에서 '○○' 항목 완료로 바꿔줘" | 클로드가 `backlog_update(status:'done')` 실호출 성공, 브라우저 새로고침 후 완료 섹션 | **C21-②** |
| 2 | "방금 완료한 '○○' 다시 대기로 되돌려줘" | 클로드가 거부 응답(`TRANSITION_DENIED` + CK3-2 문안)을 **형에게 그대로 전달** | **C21-③** |
| 3 | "'△△'는 이번에 의도해서 고친 거고, '□□'는 다른 작업 중에 같이 해결됐어. 각각 맞는 상태로 정리해줘" | △△→`done`, □□→`resolved`로 **갈라 찍는다** (description의 정의가 판단을 유도했는지가 관전 포인트) | **C22-②** |
| 4 | "이 프로젝트 최신 버전 릴리즈노트 읽고 요약해줘" | `cycle_list` → `cycle_read` 실호출, `releaseNote` 본문 기반 요약 | **C23-②** |
| 5 | "백로그 우선순위를 ~순으로 재배열해줘" | `backlog_reorder` 실호출 성공, 브라우저에서 순서 반영 | **C25-②** |

**사전 확인**(§9.1 배포 후): 웹 커넥터 재연결 시 `tools/list`가 10개로 갱신되는지 — 캐시가
남으면 커넥터 삭제·재등록으로 강제 갱신(실측해서 report에 기록).

---

## 9. Clean Architecture

### 9.1 계층 규칙 — 기존 유지 (추가 규칙 없음)

2차 §9.1 그대로: 도메인 로직은 `server/services/*`에만, MCP 툴은 서비스만 호출, 어댑터는
Drizzle import 금지, 에러는 `ServiceError` 경유(4차 규칙 6). `cycle_list`의 응답 성형
(`releaseNote`→`hasReleaseNote`)은 어댑터 책임으로 허용 — 도메인 판단이 아니라 표현 계층
변환이다(§4.1).

### 9.2 배치 — 변경 파일만

| 파일 | 계층 | 변경 |
|------|------|------|
| `shared/transition.ts` | 순수(급소) | 배열 확대 + export + `STATUS_MEANING` |
| `shared/transition.test.ts` | 테스트 | T2·T3 반전, T9~T11 |
| `server/mcp/tools.ts` | 어댑터 | enum 파생·description 조립·툴 2개 신설 |
| `server/services/backlog.ts` | 서비스 | 메시지 문안만 |
| `server/services/cycles.ts` | 서비스 | `getCycleByVersion` 신설 |
| `server/l1-harness.ts` | 하네스(신규) | 골격 6함수 + `rpc`/`callTool` |
| `server/cycles.l1.ts` | 하네스 | import 교체만 |
| `server/mcp.l1.ts` | 하네스(신규) | m1~m13 |
| `src/…/ItemDialog.tsx` | UI | `title` 1줄 |
| `src/…/lib/labels.ts` | UI | 헤더 주석만 |

---

## 10. Coding Convention Reference

### 10.1 기존 규약 (전부 유지)

주석 3종(`// Design Ref: §N` / `// Plan SC: CN` / `// Decision: [Do] …`), RK-07 description,
`ServiceError` 경유, `shared` 스키마 재사용(4T-2b — 이번엔 `transition.ts`까지 확장),
`server/`·`api/`에서 상대경로 import(alias 금지 — `app.ts` 헤더 Decision).

### 10.2 2차 문서 사후 개정 체크리스트 (F51 — 9곳, D-50 형식)

> 원문 유지 + `**(사후 2026-08-XX 개정: 6차 expand-mcp-agency D-42 — …)**` 병기 + Version History 행.

| # | 위치 | 개정 내용 |
|:-:|------|-----------|
| 1 | 2차 design §3.3 (전이 모듈 주석 + T1~T8 표) | T2·T3 기대 반전 병기, "TRANSITION_DENIED의 원천"을 todo 복귀로 이동 |
| 2 | 2차 design §2.2 (데이터 흐름 ⑤) | "doing 시도 → 거부" → 사후 문구로 "6차부터 허용, todo 복귀만 거부" |
| 3 | 2차 design §4.4 (`backlog_update` 행 + zod 협소화 문단) | enum 파생·4값 병기 |
| 4 | 2차 design §6.1 (에러 코드 표 `TRANSITION_DENIED` 행) | 발생 조건을 todo 복귀로 |
| 5 | 2차 design §8.2 #6 | 기대 반전 병기 |
| 6 | 2차 design §8.3 4단계 ("이거 진행으로 바꿔줘" 유도) | C8 실증의 자리가 m5/§8.6-2로 이동했음을 병기 |
| 7 | 2차 plan §1.4 (Q10a/Q10b 표 + ASCII 다이어그램) | 다이어그램에 사후 문구 — "형 전용" 상자가 todo 복귀로 축소 |
| 8 | 2차 plan §7.5 (FR-19 문단 + 미노출 목록) | 거부 대상 축소 병기 (미노출 목록은 불변 — D-43) |
| 9 | 2차 plan §7.6 (`canTransition` 명세) | `to ∈ {resolved,dropped}` → 4값 병기 |

- [ ] 개정 후 `전이`·`Q10b`·`FR-19`·`C8` 4키워드 grep으로 잔여 서술 재확인(RK-34)
- [ ] 2차 plan·design **Version History에 각 1행** 추가

---

## 11. Implementation Guide

### 11.1 신규·수정 파일

| 구분 | 파일 | 내용 | Design |
|:---:|------|------|:---:|
| 신규 | `server/l1-harness.ts` | 골격 추출 + `rpc`/`callTool` | §8.4 |
| 신규 | `server/mcp.l1.ts` | m1~m13 + 픽스처 FX-* | §8.3 |
| 수정 | `server/cycles.l1.ts` | import 교체(시나리오 무변경) | §8.4 |
| 수정 | `shared/transition.ts` | §3.2 전문 | §3.2 |
| 수정 | `shared/transition.test.ts` | §8.2 | §8.2 |
| 수정 | `server/mcp/tools.ts` | enum 파생 + description 조립 + `cycle_list`/`cycle_read` | §4.1 |
| 수정 | `server/services/backlog.ts` | CK3-2 문안 | §6.1 |
| 수정 | `server/services/cycles.ts` | `getCycleByVersion` | §4.2 |
| 수정 | `src/features/backlog/components/ItemDialog.tsx` | `title` 1줄 | §5.1 |
| 수정 | `src/features/backlog/lib/labels.ts` | 헤더 주석 | §5.2 |
| 개정 | 2차 plan·design 9곳 | §10.2 체크리스트 | §10.2 |

### 11.2 구현 순서 (Plan §9 모듈에 Design 섹션 매핑)

| Module | Design 섹션 | 완료 판정 (Plan §9) |
|:------:|------|------|
| 1 | §8.4 골격 추출 → §8.3 픽스처 → §8.5 기준선 | cycles **15/15 유지** + m1·m2 red 기록 + `npm test` 54건 불변 |
| 2 | §3.2 → §4.1(backlog_update) → §6.1 → §8.2 → §5.1·§5.2 | m1~m6 green(m5는 거부 유지) + L0 그린 + P-4 grep |
| 3 | §4.2 → §4.1(cycle_list/read) → §8.3 m7~m13 | m7~m13 green + `tools/list` 10개 |
| 4 | §8.6(형) + §10.2(클로드) + §5.3(형) | C21-②③·C22-②③·C23-②·C25-② + 문서 개정 누락 0 |

### 11.3 Session Guide

#### Module Map

| Scope | 핵심 파일 | 선행 조건 |
|-------|-----------|-----------|
| module-1 | `l1-harness.ts`·`cycles.l1.ts`·`mcp.l1.ts`(골격+기준선) | 없음 |
| module-2 | `transition.ts`·`tools.ts`(backlog_update)·`backlog.ts`·`ItemDialog`·`labels.ts` | module-1 (m1·m2 red 기록) |
| module-3 | `services/cycles.ts`·`tools.ts`(신설 2툴)·`mcp.l1.ts`(m7~m13) | module-1 (골격) |
| module-4 | 프로덕션 배포·웹 커넥터(형) + 2차 문서 9곳(클로드) | module-2·3 + 배포 |

#### 권장 세션 계획 (Plan §9 그대로)

1. **세션 A**: module-1 → module-2 (하네스 컨텍스트 연속, red→green을 한 세션에서)
2. **세션 B**: module-3 (cycles 축 분리 — RK-37 실현 시 이 세션만 다음 사이클로 이월 가능)
3. **세션 C**: module-4 형 확인 후 → analysis·report

---

## Version History

| 버전 | 날짜 | 변경 내용 | 작성자 |
|------|------|-----------|--------|
| 0.1 | 2026-08-09 | 최초 작성. Plan §6.2 검증 6건 전건 실측(§1.3 V1~V6) — **V1**(MCP `app.request()` 경로: initialize 선행 불요·Accept 헤더 불요·인증 401 정상 → `rpc()` 헬퍼 형태 확정), **V2**(`as const satisfies` 튜플 → `z.enum` 파생 성립, `includes` 캐스팅 1회), **V3**(`l1-harness.ts` 파일명이 양쪽 vitest config에 미수집 → D-51), **V4**(골격 6함수 전건 추출 가능, `cycles.l1.ts` diff는 import 교체로 끝남), **V5**(dev DB releaseNote 최대 4자 → D-52: `cycle_list`는 `hasReleaseNote` 치환·`cycle_read`만 본문), **V6**(웹 커넥터 시나리오 5건 §8.6). **Checkpoint 3 형 확정 2건**(§1.4): CK3-1 `STATUS_MEANING` 문안 — 초안 승인 + `resolved`에 "또는 필요가 없어짐" 추가(dropped와의 경계 = 능동적 판단 여부), CK3-2 거부 메시지 A안("status를 todo로 되돌릴 수 없습니다 — 재개·재작업 결정은 사용자가 UI에서 직접 합니다"). 신규 결정 D-51(하네스 파일명)·D-52(cycle_list 응답 성형은 어댑터 책임). 2차 문서 사후 개정 9곳을 §10.2 체크리스트로 고정 | cogmo |
