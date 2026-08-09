---
template: plan
version: 1.3
---

# expand-mcp-agency 계획 문서

> **한 줄 요약**: 클로드(MCP)의 작업 반경을 넓히는 **기능 사이클**. 백로그 상태 권한을 `doing`·`done`까지
> 열고(2차 Q10b/D-13 개정), 그 권한을 쓸 수 있게 하는 **"해소/완료" 의미 정의를 코드에 박고**,
> cycles 읽기 툴 2개를 신설한다. 4·5차와 달리 마감 사이클이 아니므로 판정은
> **Scope Closure Rate가 아니라 Match Rate**로 돌아간다.
>
> **프로젝트**: PDCA-workspace
> **작성자**: cogmo
> **작성일**: 2026-08-09
> **상태**: **Approved** (v0.2 — §10 확인 포인트 3건 **전건 동의**, 2026-08-09. §1.5.1 참조)
> **PDCA Cycle**: expand-mcp-agency (문서화 기준 6번째 사이클)

---

## Executive Summary

| 관점 | 내용 |
|------|------|
| **Problem** | 2차가 정한 권한 경계(Q10b: 클로드는 `resolved`·`dropped`만)가 **실사용에서 값을 물었다.** 5차 사이클을 완주할 때 형이 완료 7건을 손으로 하나씩 전환해야 했다 — 클로드는 무엇이 닫혔는지 정확히 알면서도 그걸 찍을 수 없다. 게다가 권한을 열어도 **"완료(done)"와 "해소(resolved)"의 차이가 코드 어디에도 정의돼 있지 않아**, 열자마자 "찍을 수 있는데 언제 찍는지 모르는" 상태가 된다. 그리고 cycles 도메인은 MCP 툴이 **0개**(5차 F36)라 클로드가 릴리즈 이력·릴리즈노트를 읽을 수단 자체가 없다(I-2, 3차 이월 → 2·5차 재이월). |
| **Solution** | 축을 하나로 묶는다 — **`server/mcp/` + `shared/transition.ts`**. ①`canTransition(actor='mcp')`의 허용 집합을 넓히되 **잔여 경계를 명시적으로 남긴다**(D-42: `todo` 복귀만 형 전용) ②`done`/`resolved`의 의미를 **`shared/transition.ts`에 상수로 박고** 툴 description·UI 툴팁이 그 하나를 참조한다(D-45) ③cycles **읽기 전용 2툴**(`cycle_list`·`cycle_read`) 신설 — 쓰기 툴은 0건(D-46) ④5차가 남긴 L1 하네스 골격을 **추출·공유해서** 재사용한다(D-48) ⑤덤으로 `backlog_reorder` 실행 확인(4차 이월). |
| **Function/UX Effect** | 형이 클로드에게 "이번 사이클 정리해줘"라고 하면 클로드가 **완료 항목을 직접 `done`으로 찍는다**(지금은 거부된다). 되돌리기(`→todo`)를 시키면 여전히 거부하고 형에게 보고한다. 클로드가 `cycle_read('v0.1.4')`로 5차 릴리즈노트를 읽어 백로그 판단에 쓴다. |
| **Core Value** | **"경계를 옮기려면 그 자리에 새 경계를 그려야 한다."** 2차의 Core Value("판단은 클로드, 결정은 형")는 폐기되는 게 아니라 **다시 그어진다** — 완료 판정은 *판단*이므로 클로드에게 넘기고, 닫힌 판정을 무르는 것(`→todo`)과 파괴적 행위(hard delete)는 *결정*이므로 형이 계속 쥔다. 이 사이클의 산출물은 코드 3덩이가 아니라 **그 새 경계선 자체**다. |

---

## Context Anchor

> Executive Summary에서 생성. Design/Do 문서로 전파되어 세션 간 컨텍스트 연속성 유지.

| Key | Value |
|-----|-------|
| **WHY** | 2차 Q10b 경계가 실사용 비용(5차 완주 시 형의 수동 전환 7건)을 발생시켰고, 형이 2026-08-08에 권한 확대를 결정했다. 동시에 "완료/해소"의 의미가 코드에 없어 권한만 열면 오작동한다 — **경계 이동과 의미 정의는 분리 불가**다. cycles 툴 0개(5차 F36)는 3차부터 3회 이월된 기능 공백이다. |
| **WHO** | 형(cogmo) — 승인자이자 **프로덕션 배포·웹 커넥터 실호출의 실행 주체**(4T-1) / 클로드(Claude Code CLI) — 코드·dev DB 하네스 / **claude.ai 웹 MCP 커넥터 — 이번 사이클의 1급 소비자**(4·5차와 정반대. C21·C23·C25의 판정 주체가 웹 커넥터 실호출이다) |
| **RISK** | 권한만 열고 의미를 안 박으면 클로드가 `done`을 남발한다(RK-28) / `todo` 복귀까지 열면 `canTransition`의 `actor` 축이 **사실상 무의미해져** 심층 방어 2층이 1층으로 붕괴한다(RK-29) / 5차 하네스 골격이 **하나도 export돼 있지 않다**(F46) — "import해서 쓰라"는 5차 §7.2의 지시가 실물과 어긋난다 / MCP L1 경로(`/api/mcp` raw JSON-RPC)는 2·4차가 짓고 두 번 버렸다(F48) |
| **SUCCESS** | C21~C25 — 스코프 5건에 대응. 판정 기준은 **Match Rate**(Design 대비 구현)로 복귀하되, C21·C23·C25는 **"클로드가 웹 커넥터로 실제로 해냈다"**까지가 충족 조건이다(형+클로드 실증). |
| **SCOPE** | 5건 고정(S1 상태 권한 확대 / S2 의미 명문화 / S3 cycles 읽기 툴 / S4 하네스 재사용 확인 / S5 `backlog_reorder` 실행 확인). **확장 금지** — I-3·I-5·M-1~M-9·`cycles`→`releases` 리네임·P-1~P-3 정식 개정·P-5 git tag 규칙화·OAuth 2.1·1차 깨진 링크는 전부 §2.2 재이월. |

---

## 1. Overview

### 1.1 목적

1. **클로드의 백로그 상태 권한을 `doing`·`done`까지 넓히되, 남길 경계를 Plan에서 못박는다.**
   이건 버그 수정이 아니라 **설계 변경**이다 — 2차 D-13(형 결정)을 개정하는 것이므로, "무엇을
   열었나"만큼 **"무엇을 안 열었나"를 같은 무게로 문서화**한다(§7.2 D-42·D-43).
2. **"완료/해소"의 의미를 코드의 단일 원천에 박는다.** 권한과 정의는 같은 사이클에서만 의미가
   있다 — 권한만 열면 "찍을 수 있는데 언제 찍는지 모르는" 상태가 되고, 정의만 박으면 쓸 데가 없다.
3. **cycles 읽기 툴을 신설해 3회 이월된 I-2를 닫는다** — 단 **읽기까지만**. 쓰기는 "무엇을
   릴리즈할지"라는 결정 행위라 이번 경계 개정의 논리(판단↔결정)가 그대로 막는다(D-46).
4. **5차가 자산화한 하네스가 실제로 재사용되는지 실측한다** — 5차 회고 Try 1이 지목한 채점표이고,
   형 반론(A1)으로 뒤집힌 D-35 판단의 사후 검증이다. **재사용 결과를 기록하는 것 자체가 스코프**다(S4).

### 1.2 배경

**2차 Q10b는 "안전장치가 아니라 역할 분담"이었다**(2차 plan §27행 Core Value). 그 전제는
"완료 판정은 의사결정"이라는 가정이었는데, 5차를 실제로 완주하면서 그 가정이 반증됐다 —
클로드는 하네스를 15/15로 돌리고 analysis까지 쓴 뒤에도 **자기가 닫은 항목을 닫힌 것으로
표시할 수 없었고**, 형이 완료 7건을 UI에서 하나씩 눌렀다. 사실 확인 결과를 아는 쪽과 그걸
기록하는 쪽이 갈려 있으면 그건 역할 분담이 아니라 **전달 비용**이다.

그런데 권한만 넓히면 새 문제가 생긴다. 지금 `resolved`의 툴 description은 "다른 작업으로
자연 해소됨"이고 `done`은 설명 자체가 없다(MCP에서 못 쓰니까). 형이 2026-08-08에 정의를 확정했다:

- **완료(done)**: 이 문제를 해결하려고 **의도했고 의도대로 해결됨**
- **해소(resolved)**: 의도한 건 아닌데 **다른 작업 중 우연히 같이 해결됨**

이 정의는 코드 어디에도 없다. `src/features/backlog/lib/labels.ts`의 `STATUS_LABEL`은 표시명
(`'완료'`·`'해소'`)만 갖고 있고(F44), 그 파일은 프런트 전용이라 `server/mcp/`가 import할 수도
없다. **정의를 담을 자리는 `shared/`뿐**이라는 게 실측의 결론이다(D-45).

세 번째 축은 cycles다. 3차 analysis I-2로 처음 잡히고, 2차·5차가 각각 재이월했다(5차 report
§4.1). 5차는 "새 기능이라 스코프 외"라는 명확한 사유로 미뤘고, **착수 시 조건부 지시**까지
남겼다(5차 D-34 + 4T-2b). 이번이 그 조건이 발동하는 사이클이다 — 다만 §7.2 D-46이 쓰기 툴을
0건으로 결정하므로, 조건부 지시의 발동 여부 자체가 Plan의 판단 대상이 된다(§1.4).

### 1.3 확정 사실 (실측)

Plan 작성 시점에 현재 저장소(HEAD `a87b5ea`)를 직접 읽고 확정한 사실이다. Design은 이 표를
전제로 한다. **추정은 표에 넣지 않았다** — 확인 못 한 것은 §6.2 검증 항목으로 내렸다.

> **식별자 규약**: 사실 `F41~`, 요구사항 `FR-54~`, 성공기준 `C21~`, 리스크 `RK-28~`, 결정 `D-40~`,
> 질문 `Q15~`. 5차(F28~F40 / FR-39~53 / C17~20 / RK-19~27 / D-29~39)를 이어간다.
> **⚠️ `D-19`~`D-26`은 3차와 4차에 각각 존재한다**(5차 F39) — 이 문서도 반드시 사이클을 붙여 쓴다.

| # | 확인 항목 | 결과 | 근거 |
|---|-----------|------|------|
| **F41** | **`shared/transition.ts` 현행 전문**(18줄) — 2차 백로그 detail의 서술과 대조 | `BacklogStatus` 5값 / `Actor = 'user' \| 'mcp'` / **`MCP_ALLOWED_TARGETS: readonly BacklogStatus[] = ['resolved','dropped']`**(6행, **미export**) / `canTransition(from,to,actor)`: `from===to`면 true → `actor==='user'`면 true → 그 외 `MCP_ALLOWED_TARGETS.includes(to)`(9~13행) / `isClosed`(16~18행). **`from` 값은 `from===to` 판정 외에는 전혀 쓰이지 않는다** — 즉 현행 규칙은 사실상 "목적지 화이트리스트"이지 전이 그래프가 아니다 | `shared/transition.ts` 전수 |
| **F42** | **`done`·`doing` 거부가 일어나는 지점은 정확히 2곳**(심층 방어 2층) | ①**1차 방어**: `server/mcp/tools.ts:173` `status: z.enum(['resolved','dropped']).optional()` — **리터럴 2값 하드코딩**, `shared`의 `backlogStatusSchema`(5값, `schema.ts:74`)와 별개 ②**2차 방어**: `server/services/backlog.ts:37-43` `canTransition(existing.status, input.status, actor)` false → `ServiceError('TRANSITION_DENIED', …)`. **REST 라우트는 `actor='user'`, MCP 툴은 `'mcp'`를 넘긴다**(`tools.ts:178`) | 3파일 전수 |
| **F43** | **거부 메시지 문안이 개정 후 거짓이 된다** | `services/backlog.ts:40` — `` `status를 ${input.status}(으)로 바꿀 수 없습니다. 진행·완료 전환은 사용자가 UI에서 직접 합니다.` `` . 권한 확대 후 이 문장은 **사실과 반대**가 된다. 잔여 경계(D-42)에 맞춘 재작성이 필수 | 동일 |
| **F44** | **상태 라벨의 단일 원천은 `src/features/backlog/lib/labels.ts`이고, 그것은 프런트 전용이다** | `STATUS_LABEL`(21~27행, 5키: 대기·진행·완료·해소·삭제)·`STATUS_COLOR`·`STATUS_ORDER`. 파일 헤더가 "enum(영문) ↔ 화면 라벨(한글)·색상 매핑 **단일 원천**"이라고 자기선언. **하지만 `src/` 아래라 `tsconfig.server.json`(`include:["server","api",…]`) 밖이고 `server/mcp/tools.ts`가 import할 수 없다.** 이 파일은 `@shared/transition`에서 `BacklogStatus`를 **import하는 쪽**이다(2행) — 의존 방향이 `shared → src`로 이미 고정돼 있다 | `labels.ts`·`tsconfig.server.json` |
| **F45** | **`ItemDialog`의 상태 배지 행에 툴팁이 0건이다** | `ItemDialog.tsx:181-190` — `STATUS_ORDER.map`으로 `<button>` 5개, 내용은 `<Badge color label>`뿐. `title`·`aria-describedby` 등 설명 속성 **없음**. 즉 S2의 ③반영처는 "수정"이 아니라 **신규 추가**다 | `ItemDialog.tsx` 전수 |
| **F46** | **5차 하네스 골격은 하나도 export돼 있지 않다 — 5차 §7.2의 지시가 실물과 어긋난다** | `server/cycles.l1.ts`에 `export` 문 **0건**. 모듈 로컬 함수 6개(`cleanup`·`mintToken`·`req`·`body`·`errBody`·`seedWorkspaceProject`). 5차 report §7.2는 "다음 도메인 L1이 **import해서 쓰게** — 파일 헤더에 이미 그렇게 적어뒀다"라고 적었지만, **파일 헤더(14행)의 실제 문안은 "가져다 쓰고"**이고 import 가능한 형태가 아니다. **추출이 재사용의 선행 조건**이다(D-48) | `grep -n '^export' server/cycles.l1.ts` (빈 출력) |
| **F47** | **하네스 헤더가 이번 스코프 5를 이름으로 지목해뒀다** | `cycles.l1.ts:13-14` — "확장: 새 도메인의 L1을 추가하려면 이 파일의 `mintToken`/`seedWorkspaceProject`/`cleanup`을 가져다 쓰고 파일명을 `*.l1.ts`로 두면 된다(**예: 다음 사이클의 `backlog_reorder` 실행 확인**)". S5가 그 예시와 정확히 일치 | 동일 |
| **F48** | **MCP 툴 검증의 기존 방식은 2종이고, 둘 다 저장소에 없다** | ①**HTTP 경로**: `app.request()`로 `/api/mcp`에 raw JSON-RPC — 2차 L1 #6·#7·#10~#12, 4차 L1 r4~r7 ②**SDK 인메모리**: `InMemoryTransport`로 서버·클라이언트 직결 후 `tools/list`·`tools/call` — 4차 설계 검증 V2(“스크립트는 실행 후 삭제”). **둘 다 파일이 없다**(5차 F34의 연장 — 저장소 전체 `app.request` 참조는 이제 `cycles.l1.ts` 1곳뿐이고 그건 REST 전용이다) | 2차 design §8.2, 4차 design §1.3 V2·§8.3, `grep -rl app.request` |
| **F49** | **cycles 조회 함수는 db 계층에 3개 있으나 서비스에 미노출이다** | `server/db/scoped.ts` — `getCycle(ownerId,id)`(254)·`getCycleByVersion(ownerId,projectId,version)`(264)·`getCycleByName(ownerId,projectId,name)`(280). **셋 다 `scoped.ts` 내부에서만 호출**된다(`updateCycle`·`deleteCycle`·`createCycle`의 중복 검사). `server/services/cycles.ts`는 `list/create/update/delete` 4개뿐 — **`cycle_read`는 서비스 함수 신설이 필요**하다(§9.1 규칙: MCP 툴은 `services/*`만 호출) | `grep -n 'export .*function' server/db/scoped.ts` + 호출부 전수 |
| **F50** | cycles 테이블 컬럼·유일키 | `id`·`projectId`·`version`(notNull)·`releaseNote`(text, nullable)·`name`(nullable)·`yearMonth`(nullable)·`createdAt`·`updatedAt`. 유일 인덱스 `(project_id, version)`·`(project_id, name)`. **`version`이 프로젝트 내 유일키이자 사람이 읽는 키** — `name`은 nullable이라 미연결 버전을 짚을 수 없다(D-47의 근거) | `server/db/schema.ts:82-101` |
| **F51** | **2차 design에는 상태 전이 "다이어그램"이 없다 — 사후 개정 대상은 6곳으로 흩어져 있다** | ASCII 다이어그램은 **2차 design이 아니라 2차 plan §1.4**(Q10a/Q10b 표 직후)에 있다. design 쪽 개정 대상은 ①**§3.3** 전이 모듈(코드 블록 주석 + **T1~T8 표**) ②**§2.2** 데이터 흐름 ⑤("doing으로 바꾸려는 시도 → TRANSITION_DENIED") ③**§4.4** MCP 툴 명세 표(`backlog_update` 행 + 그 아래 "zod enum으로 좁힌다" 문단) ④**§6.1** 에러 코드 표(`TRANSITION_DENIED` 행 "MCP가 doing/done 시도") ⑤**§8.2** L1 **#6**("MCP `backlog_update` status doing → isError, **C8**") ⑥**§8.3** L3 4단계("이거 진행으로 바꿔줘" → 거부, C8 실전). 여기에 2차 plan §1.4 다이어그램·§7.5 FR-19 문단·§7.6까지 더하면 **총 9곳** | 6문서 grep 전수(`전이`·`Q10b`·`FR-19`·`C8`) |
| **F52** | 현행 테스트 기준선 | `npm test` → **6파일 54건 green**(2026-08-09 실행). `shared/transition.test.ts`에 **T1~T8 전건 존재**(2차 design §3.3 표와 1:1). `npm run test:l1` → `server/cycles.l1.ts` 15 시나리오(5차 자산). `vitest.l1.config.ts`의 include 패턴은 `.l1.ts` 접미사 매칭이다 | 명령 실행 + 파일 전수 |
| **F53** | MCP 엔드포인트 현행 | 툴 **8개**(`project_list`·`document_list/read/write`·`backlog_list/create/update/reorder`). `/api/mcp`에 `authMiddleware` 적용(`app.ts:39`), Origin 검증(`mcp/index.ts:14`, 부재면 통과), stateless(요청마다 서버·트랜스포트 신규), `enableJsonResponse: true`. **delete 계열 툴 0건**(2차 D-14 유지, F54의 불변 대상) | `server/mcp/**`·`server/app.ts` |

**F41이 이번 개정의 성격을 규정한다.** `canTransition`은 이름과 달리 전이 그래프가 아니라
**목적지 화이트리스트**다(`from`은 `from===to` 판정에만 쓰인다). 그래서 "`doing`·`done` 허용"은
`MCP_ALLOWED_TARGETS` 배열에 두 값을 넣는 것으로 끝나고, 그 결과 **허용 집합은
`{doing, done, resolved, dropped}` = 전 상태 − `todo`**가 된다. 즉 **잔여 경계는 자동으로
"`todo`로 되돌리기만 형 전용"이 된다** — 이건 우연이 아니라 이 자료구조가 표현할 수 있는
유일한 중간 지점이고, 그래서 D-42의 후보가 사실상 두 개(잔여 경계 유지 / `actor` 축 폐지)뿐이다.

**F42+F44가 S1과 S2를 같은 모듈로 묶는다.** 허용 집합은 `transition.ts`에, 그 집합의 복제본은
`tools.ts`의 zod enum 리터럴에, 의미 정의는 어디에도 없고 표시명만 `src/`에 있다 — 세 곳이
**따로 고쳐야 하는 구조**다. 이번 개정이 `2값 → 4값`이라 드리프트 위험이 실제로 실현되는
자리이므로, 원천 공유(D-44)와 정의 배치(D-45)를 같이 결정한다.

**F46이 S4를 "확인"에서 "작업"으로 바꾼다.** 5차 report §7.2는 다음 사이클이 골격을 import하면
된다고 적었지만 실물은 전부 모듈 로컬이다. 재사용하려면 **추출이 선행**돼야 하고, 그 추출이
5차 하네스 15/15를 깨지 않는지 확인해야 한다(RK-30). 이건 5차 A1 판단의 채점표가 "재사용했는가"
단일 질문이 아니라 **"재사용 가능한 형태였는가"까지 포함**한다는 뜻이다 — 그대로 report에 기록한다.

#### 1.3.1 상태 권한 개정의 영향 지점 (실측 확정)

2차 백로그 detail이 지목한 수정 지점을 현행 코드와 1:1로 대조했다. **전건 일치하되 1곳이
추가로 발견됐다**(F43 거부 메시지).

| 지점 | detail의 서술 | 현행 실물 | 개정 내용 |
|------|---------------|-----------|-----------|
| 허용 집합 | `canTransition(actor='mcp')` | `transition.ts:6` `MCP_ALLOWED_TARGETS` (미export) | `['doing','done','resolved','dropped']` + **export 승격**(D-44) |
| MCP 스키마 협소화 | `backlog_update` zod 협소화 해제 | `tools.ts:173` `z.enum(['resolved','dropped'])` **리터럴** | `MCP_ALLOWED_TARGETS`에서 **파생**(D-44) |
| FR-19 거부 로직 | 거부 로직 | `services/backlog.ts:37-43` (분기 자체는 무변경) | **메시지 문안만** 잔여 경계에 맞춰 재작성(F43) |
| L0 | T1~T8 갱신 | `transition.test.ts` T1~T8 전건 존재 | **T2·T3 기대값 반전**, T6 유지, 신규 T9·T10 추가(§4.1) |
| L1 | 하네스 #6 갱신 | 2차 design §8.2 **#6**(문서만 — 실행 파일은 없음, F48) | 문서 사후 개정 + **하네스에서 실제 실행**(m1~m5) |
| 문서 | 2차 design 상태 전이 다이어그램 사후 개정 | **다이어그램은 design이 아니라 2차 plan §1.4에 있다**(F51) | **9곳** 사후 개정(4차 D-25 형식, D-50) |

#### 1.3.2 "해소/완료" 정의의 반영처 (실측 확정)

| # | 반영처 | 실물 위치 | 현행 | 이번 |
|:-:|--------|-----------|------|------|
| ① | `backlog_update` 툴 description | `tools.ts:162-163` | "resolved(다른 작업으로 자연 해소됨)·dropped(안 하기로 판단)만 지정 가능 — doing·done은 사용자 전용이라 거부된다(FR-19)" | 4상태 전부의 **"언제 찍는가"**를 정의 문장으로(RK-07 원칙) + 잔여 경계 명시 |
| ② | **의미 정의의 단일 원천** | **없음** — `labels.ts`는 표시명뿐이고 프런트 전용(F44) | — | `shared/transition.ts`에 `STATUS_MEANING` 신설(D-45). `tools.ts`·`labels.ts`·`ItemDialog`가 전부 이것을 참조 |
| ③ | `ItemDialog` 상태 툴팁 | `ItemDialog.tsx:181-190` | **툴팁 0건**(F45) | 배지 버튼에 `title={STATUS_MEANING[s]}` 신규 추가 |
| — | `RULE.md` | `docs/RULE.md`(27줄) | **PDCA 문서 작성 규칙 전용** — 도메인 상태 정의를 담는 문서가 아니다 | **넣지 않는다**(D-45 근거). 코드가 원천이고 문서는 필요 시 참조 |

#### 1.3.3 cycles 읽기 툴의 구현 지점 (실측 확정)

| 계층 | 현행 | 이번 |
|------|------|------|
| db (`scoped.ts`) | `listCycles`·`getCycle`·`getCycleByVersion`·`getCycleByName` **이미 존재**(F49) | **무변경** |
| service (`services/cycles.ts`) | `listCycles`만 노출. 단건 조회 **없음** | `getCycleByVersion` 노출 함수 **신설**(§9.1 규칙 준수) |
| MCP (`tools.ts`) | cycles 툴 0개(5차 F36) | `cycle_list`·`cycle_read` **신설** — 입력 스키마는 `shared/schema.ts`의 `cycleVersionSchema` 재사용(**4T-2b**) |
| REST | `GET /projects/:id/cycles`만. 단건 GET 없음(5차 하네스 n1이 "목록에서 찾는다"고 주석) | **무변경**(스코프 외 — MCP만 신설) |

#### 1.3.4 L1 시나리오 초안 + **공유 픽스처 매트릭스** (5차 Try 2 적용)

> 5차 회고 Try 2("시나리오 간 상호작용 매트릭스를 Design 단계에 명시적으로 포함")를 **Plan
> 단계에서 선반영**한다. 5차는 `#5`가 `#4`의 레코드를 오염시키는 걸 실행 후에야 발견했다.
> **"공유 픽스처" 열이 그 재발 방지 장치**이고, Design §8은 이 표를 상세화한다.

**픽스처 정의** — 전부 `hns-` 이름공간(5차 `cleanup`이 함께 지운다) + `v9.` 버전 대역:

| 픽스처 | 내용 | 소유 |
|--------|------|------|
| `FX-A` | 합성 owner A + workspace + project | 전 시나리오 공유(읽기만) |
| `FX-B` | 합성 owner B (프로젝트 없음 — 타인 경계 시험용) | m12·m13 |
| `FX-item1` | 백로그 항목 1건 (`todo` 시작) | **m1→m2→m5 순차 mutation 체인** |
| `FX-item2` | 백로그 항목 1건 (`todo` 시작) | m3 전용 |
| `FX-item3` | 백로그 항목 1건 (`todo` 시작) | m4 전용 |
| `FX-item4` | 백로그 항목 1건 (`todo` 시작) | m6 전용(REST 무회귀) |
| `FX-cycle1` | `v9.1.1` + 사이클 연결 + `releaseNote` 본문 | m9·m10 (읽기만) |
| `FX-cycle2` | `v9.1.2` 미연결 버전 | m9 (읽기만) |

| # | 시나리오 | 기대 | 공유 픽스처 | 종속 |
|:-:|----------|------|-------------|:----:|
| m1 | MCP `backlog_update` `status:'doing'` | **성공** (2차 #6의 반전) | `FX-item1` | — |
| m2 | MCP `backlog_update` `status:'done'` | **성공** | `FX-item1` | **m1** |
| m3 | MCP `backlog_update` `status:'resolved'` | 성공 (무회귀) | `FX-item2` | — |
| m4 | MCP `backlog_update` `status:'dropped'` | 성공 (무회귀) | `FX-item3` | — |
| m5 | MCP `backlog_update` `status:'todo'` (done→todo) | **isError `TRANSITION_DENIED`** — 잔여 경계(D-42) | `FX-item1` | **m2** |
| m6 | REST `PATCH /backlog/:id` `status:'doing'` (user) | 200 (무회귀, 2차 #5) | `FX-item4` | — |
| m7 | MCP `tools/list` | 툴 **10개**(8+2), delete 계열 **0** | — | — |
| m8 | MCP `backlog_reorder` 실호출 | 200 `{ok:true}` (**S5**) | `FX-item1~4` | m1~m6 이후 |
| m9 | MCP `cycle_list` | `FX-cycle1`·`FX-cycle2` 반환, 미연결분은 `name`·`yearMonth` **null** | `FX-cycle1·2` | — |
| m10 | MCP `cycle_read` `version:'v9.1.1'` | **`releaseNote` 본문 포함** | `FX-cycle1` | — |
| m11 | MCP `cycle_read` 없는 version | isError `NOT_FOUND` | — | — |
| m12 | B 토큰으로 `cycle_read` (A의 프로젝트) | isError `NOT_FOUND` (소유 경계) | `FX-B`·`FX-cycle1` | — |
| m13 | 미인증 `/api/mcp` POST | 401 (2차 #1 재확인) | — | — |
| — | **`cycles.l1.ts` 15건 전수 재실행** | 전부 기존 기대값 유지 (**골격 추출 무회귀**, RK-30) | 5차 픽스처 | — |

**이 표가 잡아내는 것**: `FX-item1`이 m1→m2→m5로 **3단 순차 종속**이다. 5차에서 사고가 난 것과
정확히 같은 형태이므로, 순서 보장(또는 전용 레코드 격리)을 **Design이 아니라 여기서** 못박는다.
m8은 `FX-item1~4`의 id 집합 전체를 요구하므로(집합 완전성 검증, 2차 §3.4) **m1~m6 이후에만**
성립한다.

### 1.4 직전 사이클 Try 이행 현황 — **P-1 세 번째 적용**

> 5차 report §6.3 Try **4건 전건** + 미이행 재이월분(4차 4T-1·4T-2b, 3차 P-4·P-5)을 대상으로 한다.
> 3차 P-1이 요구한 형식이고, 4차·5차에 이어 **세 번째 연속 적용**이다.

#### 1.4.1 5차(refine-cycles-hardening) report §6.3

| # | Try 원문 요지 | 이행 | 사유 (한 줄) |
|:-:|---|:---:|---|
| **5T-1** | 5차 하네스(`server/cycles.l1.ts`)를 다음 사이클이 **재사용했는지 확인**. 재건축했다면 RK-27 실현 → D-35 재검토, 재사용했다면 report Keep에 추가 | ✅ | **이번 사이클이 그 시험대다** — S4로 스코프에 넣었다(§2.1). 다만 실측 결과 **골격이 export돼 있지 않아**(F46) "재사용/재건축" 이분법이 아니라 **"추출 후 재사용"**이 답이 됐다(D-48). 채점 결과는 **C24**가 판정하고 report §6.3이 5차 A1 판단에 회신한다 |
| **5T-2** | L1 하네스 설계 시 **"시나리오 간 상호작용 매트릭스"**를 명시 포함 | ✅ | **§1.3.4에 "공유 픽스처" 열로 실제 적용했다.** Design이 아니라 Plan 단계로 앞당겼다 — 5차가 놓친 `#5`↔`#4` 오염이 이번엔 `FX-item1`의 m1→m2→m5 3단 종속으로 **표에서 먼저 보인다** |
| **5T-3** | **git tag·릴리즈 시점을 RULE.md 종료 절차에 명시**(P-5 연장) | ❌ | **스코프 외.** 문서 프로세스 개정이라 이번 축(MCP 작업 반경)과 층이 다르다 — §2.2 재이월. 이번 사이클도 git tag·`cycles.version` 표기가 분리된 채 남으며 **그 어긋남을 report에 관찰로 기록**해 승격 근거를 쌓는다(5차와 동일 처리) |
| **5T-4** | P-1~P-3 형식이 두 사이클 연속 값을 했으니 **RULE.md·템플릿 정식 개정 검토** | ❌ | **스코프 외** — §2.2 재이월. 다만 이번이 **세 번째 연속 적용**(§1.4·§1.3.4·§4.1)이고, 특히 **P-1 표가 이번엔 스코프 항목 하나(S4)를 직접 만들어냈다**는 사실이 승격 근거로 추가된다. 승격 판단은 형의 몫 |

#### 1.4.2 미이행 재이월분 (4차·3차)

| # | Try 원문 요지 | 이행 | 사유 (한 줄) |
|:-:|---|:---:|---|
| **4T-1** | 프로덕션 인프라를 건드리는 검증은 **"실행 권한이 실제로 있는가"**를 명시 포함 | ✅ | **§9 module-4 전체가 형의 실행 구간이다** — 웹 커넥터 실호출은 프로덕션 배포에 종속되고, 배포·실호출 주체는 형이다(§9.1). C21·C23·C25의 판정 주체를 Success Criteria 표에 **명시적으로 적었다** |
| **4T-2b** | 4차 §10 규약 ② — **MCP 툴 입력은 `shared/schema.ts` 재사용** | ✅ | **이번에 본래 대상을 만난다.** 5차는 cycles 툴 0개라 N/A였다(5차 4T-2b). 신규 `cycle_read`가 `cycleVersionSchema`를 재사용하고(§1.3.3), `backlog_update`의 status enum도 리터럴에서 `MCP_ALLOWED_TARGETS` 파생으로 바꾼다(D-44) — **재사용 원칙을 `shared/schema.ts` 밖(`transition.ts`)까지 확장하는 사례** |
| **5차 D-34 조건부 지시** | cycles **쓰기** 툴을 만들면 `name`/`yearMonth`의 `null` 허용 여부를 4차 D-21 형식으로 명시 결정 | **N/A(조건 미발동)** | **D-46이 쓰기 툴을 0건으로 결정**했으므로 조건이 발동하지 않는다. 지시는 **소멸시키지 않고** §2.2 재이월 표에 같은 문안으로 유지한다 — 5차가 그렇게 넘긴 형식 그대로. **단 이 결정 자체가 §10 확인 포인트 ②다**(형이 뒤집으면 조건이 발동한다) |
| **3차 P-4** | 도메인 순수 함수를 만들면 **같은 커밋 안에서 호출부를 grep으로 전수 확인** | ✅ | **이번에 본래 대상을 만난다.** `MCP_ALLOWED_TARGETS` export 승격·`STATUS_MEANING` 신설이 정확히 그 대상이다 — DoD에 `canTransition`·`MCP_ALLOWED_TARGETS`·`STATUS_LABEL` 호출부 grep 전수를 넣었다(§4.1) |
| **3차 P-5** | 릴리즈 버전 표기의 단일 원천을 `cycles.version`으로 | ❌ | 5T-3과 같은 항목·같은 사유. §2.2 재이월 |

**이 표가 만드는 판정 기준**: 이행 ✅ 5건 · N/A 1건 · ❌ 3건. ❌·N/A 4건은 전부 §2.2 재이월
표에 행이 있다 — **이 표에서 닫히지 않은 항목이 문서 어디에서도 사라지지 않는다.**
그리고 **5T-1이 스코프 항목(S4)을 직접 만들어냈다** — P-1 형식이 "읽히는 표"를 넘어
"스코프를 결정하는 표"가 된 첫 사례다.

### 1.5 Checkpoint 1·2 결정 사항

형의 지시서로 스코프 5건이 이미 고정돼 있어 스코프 질문은 없다. 지시서가 **Plan에서 결정하라고
명시한 2건**과, 실측 중 새로 발견돼 **Plan이 결정해야 하는 1건**을 아래에 답한다.
셋 다 §10 확인 포인트로 올린다 — **경계를 옮기는 사이클이라 Plan의 권고가 형의 결정을
대신할 수 없다**(5차 A1 선례: 형이 클로드의 권고를 뒤집어 옳았다).

| # | 질문 | 결정 (권고) | 근거 |
|---|------|------|------|
| **Q15** | **(핵심) 권한 확대 후 남길 경계는 무엇인가** — 지시서가 "남길 경계를 Plan에서 명시"하라고 못박은 항목 | **`todo`로 되돌리기만 형 전용**(→ D-42). 허용 집합 = `{doing, done, resolved, dropped}` = 전 상태 − `todo` | F41 — `MCP_ALLOWED_TARGETS`가 목적지 화이트리스트라 표현 가능한 중간 지점이 이것뿐이다. 의미상으로도 정합한다: **완료 판정은 "판단"이라 클로드에게 넘기지만, 이미 닫힌 판정을 무르는 것(재개·재작업)은 "결정"**이라 형이 쥔다(2차 Core Value의 재적용). 이 잔여 경계가 있어야 `actor` 축과 심층 방어 2층이 살아남는다(RK-29). **대안**: `actor` 축 폐지(전면 허용) — 그러면 `transition.ts`의 존재 의의 자체를 재검토해야 하므로 **이번 스코프를 넘어선다** |
| **Q16** | **cycles 쓰기 툴을 만들 것인가** — 지시서가 "쓰기 툴 범위는 Plan에서 결정"으로 넘긴 항목 | **0건 — 읽기 2툴만**(→ D-46) | ①이 사이클은 이미 경계를 하나 옮긴다. **한 사이클에서 경계를 둘 옮기면 문제가 생겼을 때 어느 쪽인지 실증이 섞인다** ②cycles 쓰기 = 버전을 끊는 행위 = **"무엇을 릴리즈할지"라는 결정** — Q15가 `todo` 복귀를 막는 것과 **같은 논리**가 여기에도 걸린다 ③I-2의 목적("클로드가 사이클 이력을 읽어 백로그 판단에 쓴다")은 **읽기만으로 닫힌다** ④5차 D-34 조건부 지시는 소멸시키지 않고 재이월 유지(§1.4.2). **형이 뒤집으면** D-34가 발동해 `name`/`yearMonth`의 `null` 허용 여부를 4차 D-21 형식으로 결정하고 `shared/schema.ts`를 재사용한다(4T-2b) |
| **Q17** | **(신규) "해소/완료" 정의를 어디에 둘 것인가** — 지시서가 "RULE.md 또는 상태 라벨 단일 원천 위치(실측으로 확정)"라고 남긴 항목 | **`shared/transition.ts`에 `STATUS_MEANING` 신설**(→ D-45). `RULE.md`에는 넣지 않는다 | F44 — `labels.ts`가 자기를 "단일 원천"이라 선언하지만 **`src/` 아래라 `server/mcp/`가 import할 수 없다**(`tsconfig.server.json` include 밖). 의미 정의를 소비하는 곳이 툴 description(server)·툴팁(src) 양쪽이므로 **`shared/`가 유일한 공통 상위**다. `transition.ts`는 이미 "Q10a·Q10b의 코드화"를 자임하는 파일이고 이번 사이클이 그 경계를 개정하므로, **경계와 그 경계의 의미가 한 파일에 있는 게 정합**하다. `RULE.md`는 27줄짜리 **PDCA 문서 작성 규칙 전용**이라 도메인 상태 정의를 담을 자리가 아니다(F44 표 마지막 행) |

#### 1.5.1 형 승인 (2026-08-09)

Plan v0.1의 §10 확인 포인트 3건에 대한 형의 판단. **3건 전건 동의** — 5차(A1이 반론으로
뒤집힌 사례)와 달리 이번엔 Plan 권고가 그대로 기준선으로 확정된다.

| # | 항목 | 형의 답 | 근거 / Plan 반영 |
|:-:|------|---------|-----------------|
| **A1** | **D-42** `todo` 복귀만 형 전용 | **동의** | **"자료구조 근거(F41) + 의미 근거 이중 정합."** 전면 허용은 `transition.ts`의 존재 의의 재설계까지 끌고 나와 **이번 스코프가 아니다.** → D-42 확정, RK-29는 "완화됨" 상태로 유지(잔여 경계가 `actor` 축을 살린다). §2.2의 "`actor` 축 폐지" 재이월 행은 그대로 둔다 |
| **A2** | **D-46** 읽기 2툴만 | **동의** | **"한 사이클에 경계 하나" 원칙이 이 사이클의 실증 가치를 지킨다.** 형의 원 요청(권한 확대 + 읽기 툴)과도 일치. **5차 D-34 조건부 지시를 미발동 재이월로 보존한 처리도 승인** → §2.2 첫 행의 문안을 그대로 유지 |
| **A3** | **D-45** `STATUS_MEANING`을 코드에 | **동의** | `labels.ts`(`src/` 전용)·`RULE.md`(문서 규칙 27줄) **둘 다 실측으로 배제**됐고, "경계와 그 경계의 의미가 한 파일에" 논리가 정합 → D-45 확정, FR-60~63 그대로 |

**3건 동의가 스코프를 바꾸지 않는다** — Plan v0.1의 FR·C·RK·D 전부 무변경이다. 이 절의
의미는 **"경계를 옮기는 결정이 형의 승인 위에 서 있다"는 기록**을 남기는 것이다(2차 D-13을
개정하는 사이클이므로, 개정의 승인 주체가 원 결정의 승인 주체와 같아야 한다).

### 1.6 관련 문서

- 이월 원천(2차, 권한 경계): [backlog-with-mcp.plan.md](../backlog-with-mcp/backlog-with-mcp.plan.md) ·
  [design](../backlog-with-mcp/backlog-with-mcp.design.md) ·
  [analysis](../backlog-with-mcp/backlog-with-mcp.analysis.md) ·
  [report](../backlog-with-mcp/backlog-with-mcp.report.md)
- 이월 원천(3차, I-2): [cycle-release-note.analysis.md](../cycle-release-note/cycle-release-note.analysis.md) ·
  [report](../cycle-release-note/cycle-release-note.report.md)
- MCP 규약 원본(4차): [refine-mcp-hardening.design.md](../refine-mcp-hardening/refine-mcp-hardening.design.md) ·
  [report](../refine-mcp-hardening/refine-mcp-hardening.report.md)
- 직전 사이클(5차, 하네스 자산·Try 원천): [refine-cycles-hardening.plan.md](../refine-cycles-hardening/refine-cycles-hardening.plan.md) ·
  [design](../refine-cycles-hardening/refine-cycles-hardening.design.md) ·
  [analysis](../refine-cycles-hardening/refine-cycles-hardening.analysis.md) ·
  [report](../refine-cycles-hardening/refine-cycles-hardening.report.md)
- 배포 절차: [docs/deploy/CHECKLIST.md](../../../deploy/CHECKLIST.md)
- 문서 규칙: [RULE.md](../../../RULE.md) / 프로젝트 규칙: [CLAUDE.md](../../../../CLAUDE.md)

---

## 2. Scope

### 2.1 In Scope — 5건 고정 (확장 금지)

- [ ] **S1 [핵심] MCP 상태 권한 확대** (2차 Q10b/D-13 개정, 형 결정 2026-08-08) —
      `MCP_ALLOWED_TARGETS`에 `doing`·`done` 추가 + export 승격 / `backlog_update` zod 협소화를
      **파생으로 전환**(D-44) / 거부 메시지 재작성(F43) / L0 T1~T8 개정 + T9·T10 신설 /
      L1 하네스 m1~m6 / **2차 문서 9곳 사후 개정**(F51, D-50).
      **남길 경계**: `todo` 복귀는 형 전용(D-42) · **hard delete API MCP 미노출은 불변**(D-43)
- [ ] **S2 [분리 불가] "해소/완료" 의미 명문화** (형 정의 2026-08-08) —
      `shared/transition.ts`에 `STATUS_MEANING` 신설(D-45) → ①`backlog_update` 툴 description
      ②`labels.ts`·③`ItemDialog` 툴팁이 그 하나를 참조. **S1과 같은 모듈**(F42+F44)
- [ ] **S3 cycles MCP 읽기 툴 신설** (I-2 — 3차 이월, 2·5차 재이월) —
      `cycle_list`·`cycle_read`(**`releaseNote` 포함**). 서비스 단건 조회 함수 신설(F49).
      **쓰기 툴 0건**(D-46) · 입력 스키마는 `shared/schema.ts` 재사용(4T-2b)
- [ ] **S4 [P-1 표 필수 항목] 하네스 재사용 사후 확인** (5차 RK-27 채점 / 5T-1) —
      골격(`mintToken`·`seedWorkspaceProject`·`cleanup`)을 **`server/l1-harness.ts`로 추출**해
      `cycles.l1.ts`와 신규 `mcp.l1.ts`가 공유(D-48). **재건축 금지** — 추출 전후 cycles 15/15
      무회귀가 판정 조건. **HTTP 경로 vs MCP 경로 차이**(F48)의 흡수 방식은 §6.2 검증 1로 확정
- [ ] **S5 [덤] `backlog_reorder` MCP 툴 실행 확인** (4차 이월) — 하네스 m8 1건 + 웹 커넥터
      실호출 1건. S1 검증 동선에 얹으므로 **별도 비용 0**

### 2.2 Out of Scope — 재이월 기록

> **재이월의 1차 원천은 백로그 보드**이며, 아래 표는 "이번 사이클이 안 한 것"의 기록이다.
> 실제 순서·착수는 형이 보드에서 정한다(4차 D-25 연장).

| 항목 | 출처 | 왜 이번에 안 하는가 |
|------|------|--------------------|
| **cycles 쓰기 툴**(`cycle_create`·`cycle_update`) | 5차 D-34 조건부 지시 | **D-46으로 이번엔 0건.** 조건부 지시는 **문안 그대로 유지**한다: 쓰기 툴을 만들면 `name`/`yearMonth`의 `null` 허용 여부를 **4차 D-21 형식으로 명시 결정**하고 입력 스키마는 `shared/schema.ts` 재사용(4T-2b) |
| **I-3 `ImportDialog` 단일 원천 정리** | 3차 analysis I-3 | DRY 문제로 이번 축(MCP 작업 반경)과 다름. M-8·M-9와 함께 처리 권장. **3차 P-4가 본래 대상을 만나는 또 하나의 자리** |
| **I-5 문서 제목 파생 규칙** | 3차 analysis I-5 | UI 식별성 문제 — 축이 다름 |
| **M-1~M-9** | 3차 analysis §6.3 | 전부 Minor. 3차 report가 이미 "낮음" 판정 |
| **`cycles` → `releases` 리네임** | 3차 report §7.2 M-6 | 전면 리네임. 이번에 cycles 툴을 **신설**하므로 리네임하면 툴 이름까지 함께 바뀐다 — 신설 직후 개명은 낭비다. 이번 이후가 맞다 |
| **RULE.md·템플릿의 P-1~P-3 정식 개정** | 3차 P-1~P-3, 4차 §7.2, **5T-4** | 문서 프로세스 개정 — 이번 축과 층이 다르다. 이번이 **세 번째 연속 적용**이고 **P-1이 스코프 항목을 만들어낸 첫 사례**라는 근거가 추가되므로, 승격 판단 재료는 더 쌓인다 |
| **git tag·릴리즈 시점 규칙화(P-5 연장)** | 3차 P-5, **5T-3** | 위와 같은 층. 이번 사이클의 버전 표기 어긋남도 report에 관찰로 기록 |
| **OAuth 2.1 정식 지원** | 4차 C13 | 승격 근거는 쌓였으나 형이 보류 결정. `?token=` 폴백(2차 D-18) 유지 |
| **1차 사이클 기존 깨진 링크 11건** | 4차·5차 report §4.1 | 이번 사이클과 무관한 파일 |
| **`transition.ts`의 `actor` 축 폐지 / 전이 그래프화** | 이번 F41 발견 | Q15에서 대안으로만 검토. 채택 시 `transition.ts`의 존재 의의 재설계가 필요해 이번 스코프를 넘는다 |
| 번들 최적화·코드 분할 | 2차 F9 | 5연속 이월 |

---

## 3. Requirements

### 3.1 기능 요구사항

| ID | 요구사항 | 스코프 | 우선순위 | 상태 |
|----|----------|:---:|:--------:|------|
| FR-54 | `MCP_ALLOWED_TARGETS`가 `['doing','done','resolved','dropped']`이고 **`export`된다** | S1 | High | Pending |
| FR-55 | `canTransition(from,'todo','mcp')`이 **false**를 반환한다(`from!=='todo'`) — 잔여 경계(D-42) | S1 | High | Pending |
| FR-56 | `backlog_update`의 status zod가 **`MCP_ALLOWED_TARGETS`에서 파생**된다 — 리터럴 중복 0(D-44) | S1 | High | Pending |
| FR-57 | 거부 메시지가 잔여 경계를 정확히 서술한다 — "진행·완료 전환은 사용자가 UI에서" 문안 폐기(F43) | S1 | High | Pending |
| FR-58 | `transition.test.ts`의 T2·T3 기대값이 반전되고, T6은 유지되며, **T9(`done→todo`, mcp, false)·T10(`dropped→todo`, mcp, false)**가 추가된다 | S1 | High | Pending |
| FR-59 | **hard delete는 MCP에 노출되지 않는다** — `registerTool`에 delete 계열 0건 유지(2차 D-14, D-43) | S1 | High | Pending |
| FR-60 | `shared/transition.ts`에 `STATUS_MEANING: Record<BacklogStatus,string>` 5키가 신설되고, **형의 정의 문안을 그대로** 담는다 | S2 | High | Pending |
| FR-61 | `backlog_update` 툴 description이 **4상태 각각의 "언제 찍는가"**를 담고, `STATUS_MEANING`을 원천으로 삼는다(RK-07) | S2 | High | Pending |
| FR-62 | `ItemDialog` 상태 배지 5개에 `STATUS_MEANING` 툴팁이 붙는다(F45 — 신규 추가) | S2 | Medium | Pending |
| FR-63 | `labels.ts`가 `STATUS_MEANING`을 **재정의하지 않는다** — 표시명(`STATUS_LABEL`)과 의미가 역할 분리된다 | S2 | Medium | Pending |
| FR-64 | `services/cycles.ts`에 단건 조회 함수가 신설되고 `scoped.getCycleByVersion`을 호출한다 — MCP는 서비스만 부른다(§9.1) | S3 | High | Pending |
| FR-65 | `cycle_list(projectId)` 툴이 버전 목록을 반환한다 — 미연결 버전의 `name`·`yearMonth`가 `null`로 그대로 나온다 | S3 | High | Pending |
| FR-66 | `cycle_read(projectId, version)` 툴이 **`releaseNote` 본문을 포함**해 반환하고, 없는 version은 `NOT_FOUND`로 거부한다 | S3 | High | Pending |
| FR-67 | 두 툴의 입력 스키마가 `shared/schema.ts`의 `cycleVersionSchema`를 재사용한다(4T-2b) | S3 | High | Pending |
| FR-68 | 두 툴의 description이 **"언제 호출하는지"**를 쓴다(2차 RK-07 규약) | S3 | Medium | Pending |
| FR-69 | 하네스 골격이 **`server/l1-harness.ts`로 추출**되고 `cycles.l1.ts`·`mcp.l1.ts`가 **import해서** 쓴다(D-48) | S4 | High | Pending |
| FR-70 | 골격 추출 후 `cycles.l1.ts` **15 시나리오가 그대로 green**이다(무회귀, RK-30) | S4 | High | Pending |
| FR-71 | `l1-harness.ts`가 vitest include(`**/*.l1.ts`)에 **걸리지 않는다** — "no test suite" 실패 0(RK-31) | S4 | High | Pending |
| FR-72 | MCP JSON-RPC 호출 헬퍼가 **골격 파일에 남는다** — 다음 사이클이 재구성하지 않는다(F48의 3번째 재건축 차단) | S4 | Medium | Pending |
| FR-73 | `mcp.l1.ts`가 §1.3.4의 **m1~m13**을 실행하고, 픽스처가 `hns-` 이름공간·`v9.` 대역을 지켜 기존 `cleanup`에 함께 걸린다 | S4 | High | Pending |
| FR-74 | `backlog_reorder`가 **실제로 실행**된다 — 하네스 m8 + 웹 커넥터 1건 | S5 | Medium | Pending |

### 3.2 비기능 요구사항

| 범주 | 기준 | 측정 방법 |
|------|------|-----------|
| 무회귀 | `npm test` **6파일 54건**(F52) 전부 통과 + 신규 L0분만 증가 | `npm test` 전후 대조 |
| 무회귀 | `npm run test:l1`의 **cycles 15건이 그대로 green** — 골격 추출이 5차 자산을 깨지 않는다 | `test:l1` 추출 전후 2회 실행 |
| 무회귀 | REST 경로(`actor='user'`)의 상태 전이 동작이 **전혀 바뀌지 않는다** — 이번 개정은 `actor='mcp'` 분기만 건드린다 | 하네스 m6 + `tsc -b` |
| 심층 방어 | 1차 방어(zod)와 2차 방어(`canTransition`)의 **허용 집합이 구조적으로 일치**한다 — 드리프트 불가 | FR-56(파생) + 코드 리뷰 |
| 단일 원천 | `STATUS_MEANING`의 정의 문장이 저장소에서 **1곳에만** 존재한다 | grep 전수(P-4 형식) |
| 실증 | MCP 실호출 건수: 상태 전이 **0 → m1~m6**(하네스) + 웹 커넥터 **≥3건**(done 1·거부 1·reorder 1) | 하네스 로그 + 형의 확인 |
| 실증 | cycles MCP 실호출 건수 **0 → m9~m12**(하네스) + 웹 커넥터 `cycle_read` **≥1건** | 동일 |
| 타입·린트 | `tsc -b` · `oxlint` 그린 — `MCP_ALLOWED_TARGETS` export 승격의 타입 파급 전수 확인 | 명령 실행 |
| 자산 | 하네스가 **다음 사이클에서도 확장 가능**하다 — 골격 파일에 MCP 호출 헬퍼까지 남는다 | FR-72 + 파일 헤더 주석 갱신 |
| 문서 | 2차 문서 **9곳**(F51) 사후 개정 누락 0건 | grep 체크리스트(§4.1) |
| 문서 | 저장소 마크다운 링크 신규 깨짐 0건 (RULE.md 종료 절차 1) **(사후 2026-08-09 개정: RULE.md 종료 절차가 세션 밖에서 두 차례 개정돼 링크 전수 검증 단계 자체가 삭제됨 — 이 행의 참조는 무효, 최신 RULE.md 원문만 따른다)** | 링크 추출 후 파일 존재 확인 |

---

## 4. Success Criteria

> **스코프 5건에 대응.** 4·5차와 달리 **마감이 아니라 기능 사이클**이므로 판정 기준은
> **Match Rate**(Design 대비 구현의 구조적 일치율)로 복귀한다(D-40). 단 C21·C23·C25는
> "구현했다"가 아니라 **"클로드가 웹 커넥터로 실제로 해냈다"**까지가 충족 조건이다.
> **실행 주체를 각 행에 명시한다**(4T-1).

| ID | 스코프 | 기준 | 검증 방법 / **실행 주체** |
|----|:---:|------|-----------|
| **C21** | S1 | **권한 확대 실증 3종** — ①하네스에서 MCP `doing`·`done` 전환이 성공한다(m1·m2) ②**형이 클로드 채팅에서 "이 항목 완료로 바꿔줘"를 시켜 웹 커넥터로 실제 `done` 전환에 성공**하고 브라우저에서 확인된다 ③**되돌리기(`→todo`)를 시키면 거부되고, 클로드가 그 거부를 형에게 보고한다**(잔여 경계 D-42의 실증 — 2차 C8의 자리 이동) | ①클로드(하네스) ②③**형**(웹 커넥터, 프로덕션 배포 후) |
| **C22** | S2 | **정의가 실제로 판단을 바꾼다** — ①`STATUS_MEANING`이 저장소에 1곳 존재하고 3소비자가 전부 그것을 참조한다(grep 전수) ②**형이 두 상황을 각각 시켜 클로드가 `done`과 `resolved`를 올바르게 갈라 찍는다** — "이번 사이클에서 의도해서 고친 항목"과 "다른 작업 하다 우연히 같이 해결된 항목" ③`ItemDialog`에서 배지에 마우스를 올리면 정의가 뜬다 | ①클로드(grep) ②**형**(웹 커넥터) ③**형**(브라우저) |
| **C23** | S3 | **cycles 읽기 실증** — ①하네스 m9~m12 전건 green ②**형이 클로드에게 "5차 릴리즈노트 읽어봐"를 시켜 웹 커넥터로 `cycle_read` 실호출에 성공**하고, 응답에 `releaseNote` 본문이 담긴다 ③`tools/list`가 10개(m7) | ①③클로드(하네스) ②**형**(웹 커넥터) |
| **C24** | S4 | **하네스 재사용 결과가 기록된다**(5차 RK-27 채점표) — ①골격이 `l1-harness.ts`로 추출돼 **두 파일이 import**한다 ②추출 후 `cycles.l1.ts` **15/15 유지**(재건축 0) ③`mcp.l1.ts`가 골격 위에서 m1~m13을 돌린다 ④**재사용 과정에서 실제로 든 비용**(추출 필요성 F46 포함)이 report §6.3에 기록돼 5차 A1 판단에 회신된다 | 클로드 — ④는 report 작성 시 |
| **C25** | S5 | `backlog_reorder`가 **실행 확인**된다 — ①하네스 m8 200 ②**형이 웹 커넥터로 재배열 1건 실호출** 후 브라우저에서 순서 반영 확인 | ①클로드 ②**형** |

### 4.1 Definition of Done

- [ ] FR-54~FR-74 구현 (Medium 미달 시 사유 명시)
- [ ] C21~C25 전부 충족

**L1 시나리오 실행 체크박스 — P-3 적용** (기준은 "작성"이 아니라 **"실행"**. Design §8이
§1.3.4를 상세화하되 **판정의 원본은 이 체크박스**다):

- [ ] m1 MCP `status:'doing'` → 성공 *(2차 #6 반전 — 기준선 red 기록 필수)*
- [ ] m2 MCP `status:'done'` → 성공 *(기준선 red 기록 필수)*
- [ ] m3 MCP `status:'resolved'` → 성공 (무회귀)
- [ ] m4 MCP `status:'dropped'` → 성공 (무회귀)
- [ ] **m5 MCP `done → todo` → isError `TRANSITION_DENIED`** *(잔여 경계 D-42 — 이 사이클의 핵심 증거)*
- [ ] m6 REST `PATCH status:'doing'`(user) → 200 (무회귀)
- [ ] m7 `tools/list` → 10개, delete 계열 0
- [ ] m8 MCP `backlog_reorder` → 200 (**S5**)
- [ ] m9 `cycle_list` → 미연결분 `name`·`yearMonth` null
- [ ] m10 `cycle_read('v9.1.1')` → `releaseNote` 본문 포함
- [ ] m11 `cycle_read` 없는 version → `NOT_FOUND`
- [ ] m12 B 토큰으로 A의 `cycle_read` → `NOT_FOUND`
- [ ] m13 미인증 `/api/mcp` POST → 401
- [ ] **`cycles.l1.ts` 15건 전수 재실행 → 15/15**(골격 추출 무회귀, FR-70)

**L0 체크박스**

- [ ] T2 `todo→doing` mcp → **true**(반전) · T3 `doing→done` mcp → **true**(반전)
- [ ] T6 `resolved→todo` mcp → false(유지) · **T9 `done→todo` mcp → false**(신규) ·
      **T10 `dropped→todo` mcp → false**(신규)
- [ ] T1·T4·T5·T7·T8 기대값 무변경 확인
- [ ] `STATUS_MEANING` 5키 존재 + `BacklogStatus`와 키 집합 일치(타입으로 강제)

**나머지 DoD**

- [ ] **호출부 grep 전수(3차 P-4)** — `canTransition` · `MCP_ALLOWED_TARGETS` · `STATUS_LABEL` ·
      `STATUS_MEANING`의 참조를 같은 커밋 안에서 전수 확인, 우회 0건
- [ ] **2차 문서 9곳 사후 개정(F51, D-50)** — design §2.2·§3.3·§4.4·§6.1·§8.2 #6·§8.3 4단계 +
      plan §1.4 다이어그램·§7.5 FR-19 문단·§7.6 + 2차 Success Criteria **C8**의 성격 변경 표기
- [ ] `tsc -b` · `oxlint` · `npm test` · `npm run test:l1` 전부 그린
- [ ] `env -u DATABASE_URL npm run test:l1` → **skip**(실패 아님, 5차 FR-52 무회귀)
- [ ] 하네스가 남긴 테스트 데이터 정리 확인(`hns-owner-%` 조회 0건)
- [ ] 파일 헤더 재사용 지침 주석 갱신 — `l1-harness.ts`에 MCP 호출 헬퍼 사용법 포함(FR-72)
- [ ] `analysis` 문서로 Gap 분석 — **Match Rate 산식**으로(4·5차의 Scope Closure Rate 아님, D-40)
- [ ] `report` 문서 작성 — 사이클 종료 실행 자체는 최신 `docs/RULE.md`를 그때그때 참조한다(**사후 2026-08-09**: 절차가 세션 중 0~7단계로 재구성돼 이 항목의 "1~4" 참조는 무효. RULE.md 자체의 규칙 0에 따라 이후로는 종료 절차를 PDCA 문서에 TODO로 나열하지 않는다)
- [ ] **report §6.3에 5T-1 회신** — 하네스 재사용의 실제 비용(F46 추출 필요성 포함)을 기록해
      5차 A1(자산화 판단)에 답한다. 다음 Plan §1.4가 소비할 수 있게 번호 붙인 목록으로

---

## 5. Risks and Mitigation

| ID | 리스크 | 영향 | 확률 | 완화 |
|----|--------|:----:|:----:|------|
| **RK-28** | **권한만 열리고 의미가 안 박혀 클로드가 `done`을 남발한다** — 특히 `done`과 `resolved`의 경계가 모호하면 "닫혔다"는 사실은 맞지만 **기록의 의미가 오염**된다. 백로그는 형의 의사결정 입력이므로 오염이 곧 잘못된 우선순위로 이어진다 | **High** | Medium | **S2를 S1과 분리 불가로 묶었다**(§2.1) — 같은 모듈, 같은 커밋. 판정도 함께 간다(C22-②가 실호출로 갈라 찍는지 본다). 그리고 정의를 **툴 description에 넣는 게 핵심**이다(FR-61) — 클로드가 툴을 호출하기 직전에 읽는 유일한 텍스트가 거기다 |
| **RK-29** | **`actor` 축이 사실상 무의미해져 심층 방어 2층이 1층으로 붕괴한다** — 전면 허용이면 `canTransition`은 `from===to` 판정기만 남고, `transition.ts`가 자임한 "Q10a·Q10b의 코드화"라는 존재 의의가 사라진다 | **High** | Medium | **D-42가 잔여 경계(`→todo` 금지)를 남겨 축을 유지**한다. 잔여 경계가 있으면 T6·T9·T10이 계속 의미를 갖고 1·2차 방어의 집합도 계속 검증 대상이다. **형 승인 A1(2026-08-09)으로 D-42가 확정돼 이 리스크는 완화 상태로 고정**됐다 — 전면 허용은 `transition.ts` 재설계를 동반하므로 이번 스코프 밖이며, §2.2에 재이월 행으로 남아 있다 |
| **RK-30** | **골격 추출이 5차 하네스(15/15)를 깬다** — 5차의 유일한 자산을 이번 사이클이 망가뜨리면 RK-27(유지보수 부채)이 최악의 형태로 실현된다 | **High** | Medium | 추출을 **module-1 최우선**에 배치하고(§9), **추출 직후 `test:l1` 재실행 15/15를 module-1 완료 판정에 넣었다**(FR-70). 시나리오 코드는 손대지 않고 **import 문만 바뀌는 형태**를 목표로 한다 — 그 이상 바뀌면 Design에서 사유를 남긴다 |
| **RK-31** | **`l1-harness.ts`가 vitest include(`**/*.l1.ts`)에 걸려 "no test suite" 실패**를 낸다 — 파일명을 `harness.l1.ts`로 지으면 즉시 발생 | Medium | Medium | 파일명을 **`l1-harness.ts`**(접미사가 `.l1.ts`가 **아님**)로 고정하고 §6.2 검증 3에서 실측한다. 5차 D-37이 확장자 `.l1.ts`를 "vitest 기본 include와 의도적으로 겹치지 않는 이름"으로 고른 것과 **정확히 대칭인 함정** |
| **RK-32** | **MCP L1 경로가 3번째 재건축이 된다** — 2차·4차가 `app.request()` JSON-RPC 호출부를 짓고 두 번 버렸다(F48). 이번에도 `mcp.l1.ts` 안에 인라인으로 쓰면 다음 사이클이 또 짓는다 | Medium | **High** | **FR-72로 MCP 호출 헬퍼를 골격 파일(`l1-harness.ts`)에 남기는 것을 요구사항화**했다. 시나리오 파일이 아니라 골격에 있어야 다음 도메인이 가져다 쓴다 — S4의 목적 자체가 이것이다 |
| **RK-33** | **`cycle_read`가 `releaseNote` 전문을 반환해 컨텍스트를 폭발시킨다** — `releaseNote`는 최대 50,000자(`schema.ts:128`)이고, 클로드가 `cycle_list` 후 여러 건을 읽으면 누적된다 | Medium | Medium | §6.2 검증 5에서 실측한다(현 dev DB의 실제 `releaseNote` 길이 분포 + `document_read` 선례 대조). **`cycle_list`는 본문을 빼고**(목록은 메타만), **`cycle_read`만 본문 포함**이 기본 방향이다 — Design이 확정한다 |
| **RK-34** | **2차 문서 사후 개정 9곳이 흩어져 있어 누락된다**(F51) — 특히 다이어그램이 design이 아니라 **plan**에 있다는 게 반직관적이라 놓치기 쉽다 | Medium | **High** | F51 표를 **DoD 체크리스트로 그대로 옮겼다**(§4.1). 개정 후 `전이`·`Q10b`·`FR-19`·`C8` 4키워드 grep으로 잔여 서술을 재확인한다(P-4 형식의 문서판) |
| **RK-35** | **웹 커넥터 실증이 프로덕션 배포에 종속된다** — C21·C22·C23·C25의 절반이 배포 후에만 판정 가능하고, 배포·실호출 주체는 형이다(4T-1) | Medium | **High** | **module-4를 분리**해 형의 시간에 맞춘다(§9). 코드 완료(module-1~3) 시점에 하네스로 닫을 수 있는 절반은 먼저 닫고, 웹 커넥터 절반만 비동기로 확인받는다. **DB 스키마 변경 0건**이라 배포 리스크 자체는 낮다(§9.1) |
| **RK-36** | **기능 사이클인데 Match Rate 산식이 4·5차 관례(Scope Closure Rate)에 끌려간다** — 두 사이클 연속 같은 산식을 썼다 | Low | Medium | **D-40으로 Plan에서 미리 못박았다.** analysis는 Design 대비 구현 일치율로 측정하고, 그 사유를 §1.2에 적는다(4·5차가 반대 방향으로 한 것과 같은 형식) |
| **RK-37** | 스코프가 5건이라 4·5차(3~6건 마감)보다 **표면이 넓고 축이 셋**(전이·MCP·하네스)이다 — 한 사이클에 다 안 들어갈 수 있다 | Medium | Medium | S1+S2는 한 모듈(같은 파일 블록), S5는 비용 0(S1 동선에 얹힘), S4는 S3의 **선행 조건**이라 순서가 강제된다 — 실질 축은 **2개**(권한·cycles)다. 그래도 넘치면 **S3를 다음 사이클로 미루고 S1·S2만 닫는다**(S3는 이미 3회 이월된 항목이라 4회차가 치명적이지 않다) — 판단 시점은 module-2 완료 후 |

---

## 6. Impact Analysis

| 대상 | 변경 유형 | 영향 |
|------|-----------|------|
| `shared/transition.ts` | **수정** (허용 집합 2→4값 + export 승격 + `STATUS_MEANING` 신설) | 이번 사이클의 **급소**. 서버·MCP·UI 3소비자가 전부 이 파일을 본다. export 승격의 타입 파급은 `tsc -b`가 판정 |
| `shared/transition.test.ts` | **수정** (T2·T3 반전, T9·T10 신설) | 2차 design §3.3 표와 1:1이므로 **문서 개정과 짝**으로 움직인다(F51 ①) |
| `server/mcp/tools.ts` | **수정** (`backlog_update` enum 파생 + description 재작성 + **툴 2개 신설**) | 8툴 → **10툴**. `z.enum`은 non-empty tuple을 요구하므로 `readonly BacklogStatus[]`에서 파생하려면 `as const` 튜플 형태가 필요하다 — **Design이 형태를 확정**(§6.2 검증 2) |
| `server/services/backlog.ts` | **수정** (거부 메시지 문안만, 분기 무변경) | F43 |
| `server/services/cycles.ts` | **수정** (단건 조회 함수 신설) | F49 — `scoped.getCycleByVersion`을 감싼다. §9.1 계층 규칙 준수 |
| `server/db/scoped.ts` | **무변경** | F49 — 필요한 조회 함수가 이미 3개 있다 |
| `server/routes/**` | **무변경** | REST는 `actor='user'`라 이번 개정의 영향 밖 |
| `shared/schema.ts` | **무변경 예상** | `cycleVersionSchema`·`backlogStatusSchema`를 **재사용만** 한다(4T-2b) |
| `src/features/backlog/lib/labels.ts` | **수정 가능성** (역할 분리 명시 주석) | F44 — 자기선언한 "단일 원천"의 범위가 **표시명으로 좁혀진다**. 헤더 주석 갱신 필요 |
| `src/features/backlog/components/ItemDialog.tsx` | **수정** (배지 `title` 신규 추가) | F45 |
| **`server/l1-harness.ts`** | **신규 — 커밋** | 5차 골격 6함수 추출 + **MCP JSON-RPC 헬퍼 신규**(FR-72). 파일명이 `*.l1.ts`가 **아니어야** 한다(RK-31) |
| `server/cycles.l1.ts` | **수정** (import 문으로 골격 참조) | **시나리오 코드는 무변경 목표**. 15/15 유지가 판정 조건(FR-70) |
| **`server/mcp.l1.ts`** | **신규 — 커밋** | m1~m13. 5차 D-35·D-37 규약(`server/` 아래 `*.l1.ts`) 그대로 적용 |
| `vitest.l1.config.ts` · `package.json` | **무변경** | 5차가 이미 세운 인프라를 그대로 쓴다 — **이게 D-35 자산화의 배당금**이고, C24가 그걸 기록한다 |
| **DB 스키마·마이그레이션** | **무변경** | 상태 컬럼은 이미 text enum 없이 저장. 신규 컬럼 0건 → 배포 리스크 낮음(§9.1) |
| **2차 사이클 문서 9곳** | **사후 개정** | F51 · D-50(4차 D-25 형식) |

### 6.1 신규 외부 의존

없음. 패키지 추가·제거 0건. MCP SDK·`@hono/mcp`는 이미 의존성에 있다.

### 6.2 검증 (Design 착수 전)

- [ ] **1. MCP 경로를 `app.request()`로 태우는 방법 확정**(F48·D-49·RK-32) — `/api/mcp`에
      raw JSON-RPC를 POST할 때 필요한 **헤더(`Accept`)·초기화 시퀀스(`initialize` 선행 필요 여부)**를
      실측한다. `StreamableHTTPTransport`가 `sessionIdGenerator: undefined` + `enableJsonResponse: true`로
      떠 있으므로(`mcp/index.ts:22-25`) 세션 없는 단발 `tools/call`이 가능한지 확인.
      **대안**: SDK `InMemoryTransport`(4차 V2 방식) — 단 인증·Origin·라우팅을 건너뛴다.
      **판정 기준은 "인증까지 통과하는 경로인가"**
- [ ] **2. `MCP_ALLOWED_TARGETS`에서 zod enum을 파생하는 형태 확정**(FR-56) —
      `readonly BacklogStatus[]` → `z.enum(...)`은 non-empty tuple을 요구한다. `as const` 튜플로
      선언을 바꿨을 때 `includes(to)` 호출부의 타입이 깨지지 않는지, MCP `tools/list`의 JSON Schema
      출력이 정상인지 실측(4차 V2 방식으로 `InMemoryTransport` 1회)
- [ ] **3. `l1-harness.ts` 파일명이 vitest include에 안 걸리는지 실측**(RK-31) —
      `vitest.l1.config.ts`의 `include:['**/*.l1.ts']`와 기본 `vitest.config.ts` 양쪽에서
      수집되지 않고, `tsconfig.server.json`에는 포함돼 `tsc -b`·`oxlint`가 커버하는지 확인
- [ ] **4. 골격 추출의 최소 변경 형태 확정**(RK-30) — 6함수 중 어디까지 추출할지
      (`req`·`body`·`errBody`는 REST 전용 — MCP 쪽에서 재사용 가능한지). 추출 후
      `cycles.l1.ts`의 diff가 **import 문 교체로 끝나는지** 확인
- [ ] **5. `releaseNote` 실측 분포 + `cycle_read` 응답 크기 방침**(RK-33) — dev DB의
      `LENGTH(release_note)` 분포 조회(읽기만) + `document_read`가 본문 전체를 반환하는 선례 대조.
      `cycle_list`에서 본문을 뺄지 결정
- [ ] **6. 웹 커넥터 실증 시나리오의 사전 정리**(C21·C22·C23·C25, 4T-1) — 형이 채팅에서
      **무엇을 시킬지**를 문장 단위로 미리 적어둔다. 특히 C22-②는 "의도한 완료"와 "우연한 해소"
      **두 상황을 각각 만들어야** 하므로 대상 백로그 항목을 미리 골라둔다

---

## 7. Architecture Considerations

### 7.1 프로젝트 레벨

1~5차와 동일 — **Dynamic**, 옵션 B(서비스 계층) 유지. 계층 구조는 바꾸지 않는다.
다만 이 사이클은 **구조가 아니라 권한 경계를 바꾼다** — 코드 구조상으로는 배열 2값 추가지만,
설계상으로는 2차의 형 결정(D-13)을 개정하는 것이므로 **Decision Record의 무게가 코드 크기와
비례하지 않는다**.

### 7.2 핵심 아키텍처 결정 (Decision Record)

> 5차 D-39를 이어 **D-40부터** 매긴다(5차 F39·RK-25 — 3차의 D-19~D-26과는 별개 번호 공간이다).

| # | 결정 | 후보 | 채택 | 근거 |
|---|------|------|------|:----|
| **D-40** | **이번 사이클의 판정 산식** | Scope Closure Rate(4·5차) / **Match Rate**(1~3차) | **Match Rate** | **기능 사이클이다.** 4·5차는 "이미 확정된 이월을 닫는" 마감이라 Design 대 구현 일치율 산식이 안 맞았지만, 이번은 새 툴 2개·새 경계·새 상수를 **설계하고 구현**한다 — 산식의 전제가 성립한다. 이 결정을 Plan에 미리 박아 4·5차 관례에 끌려가는 것을 막는다(RK-36) |
| **D-41** | 식별자 체계 | 새로 1부터 / **5차를 이어감** | **이어감**(F41~ / FR-54~ / C21~ / RK-28~ / D-40~ / Q15~) | 4차가 2차를, 5차가 4차를 이은 선례. 참조 시 사이클 접두 의무도 그대로 승계 |
| **D-42** | **⭐ 권한 확대 후 남길 경계** (Q15) | 전면 허용(`actor` 축 폐지) / **`todo` 복귀만 형 전용** / `done`만 허용하고 `doing`은 유지 | **`todo` 복귀만 형 전용** — 허용 집합 `{doing,done,resolved,dropped}` | F41 — `MCP_ALLOWED_TARGETS`가 목적지 화이트리스트라 표현 가능한 중간 지점이 이것뿐이다. **의미상 근거가 더 중요하다**: 2차 Core Value("판단은 클로드, 결정은 형")를 폐기하는 게 아니라 **선을 다시 긋는다** — 완료 판정은 사실 확인이므로 *판단*, 닫힌 판정을 무르는 재개·재작업은 우선순위 재조정이므로 *결정*. 이 경계가 있어야 `actor` 축·심층 방어 2층·T6/T9/T10이 계속 살아있다(RK-29). **형이 뒤집으면**(전면 허용) `transition.ts` 재설계가 따라오므로 §2.2에 미리 재이월 행을 뒀다 |
| **D-43** | **⭐ 불변으로 둘 경계** | — | **hard delete API MCP 미노출 유지**(2차 D-14) + **workspace·project create/update 미노출 유지** | 2차 plan §7.5의 원문이 그대로 유효하다 — **"툴이 없으면 실수할 방법이 없다."** 상태 `dropped`는 **되돌릴 수 있는** 표시이고 hard delete는 **되돌릴 수 없다** — 이번에 넓히는 건 전자뿐이다. `ItemDialog`의 hard delete 확인 문구("완전히 삭제됩니다 — '삭제' 상태와 다르게 되돌릴 수 없습니다")가 이미 그 구분을 형에게 설명하고 있다. FR-59가 이 불변을 요구사항으로 고정 |
| **D-44** | **MCP status enum의 원천** | 리터럴 유지(현행, 독립 2층) / **`MCP_ALLOWED_TARGETS` export 후 파생** | **파생** | F42 — 지금은 허용 집합이 `transition.ts`와 `tools.ts`에 **각각 하드코딩**돼 있고, 이번 개정이 정확히 "두 곳을 따로 고쳐야 하는" 상황을 만든다(2값→4값). 드리프트가 실현되는 자리다. **"심층 방어의 독립성이 사라진다"는 반론**은 성립하지 않는다 — 심층 방어의 가치는 *두 계층에서 검사한다*는 것이지 *두 개의 다른 정의를 둔다*는 게 아니다(후자는 방어가 아니라 버그다). 4차 §10 규약 ②(MCP 입력은 `shared` 재사용)의 정신을 `schema.ts` 밖으로 확장하는 것이기도 하다(4T-2b) |
| **D-45** | **"해소/완료" 정의의 위치** (Q17) | `RULE.md` / `labels.ts` / **`shared/transition.ts`에 `STATUS_MEANING`** | **`shared/transition.ts`** | F44 — 소비자가 server(툴 description)와 src(툴팁) 양쪽이라 **`shared/`가 유일한 공통 상위**다. `labels.ts`는 `src/` 아래라 `tsconfig.server.json` include 밖이고, `RULE.md`는 PDCA 문서 규칙 전용 27줄이다. `transition.ts`는 이미 "Q10a·Q10b의 코드화"를 자임하므로 **경계와 그 경계의 의미가 한 파일에 사는 게 정합**하다. `labels.ts`의 역할은 **표시명으로 좁혀진다**(FR-63) |
| **D-46** | **cycles 쓰기 툴 범위** (Q16) | 읽기+쓰기 4툴 / **읽기 2툴만** / `releaseNote` 수정만 허용 | **읽기 2툴만 — 쓰기 0건** | ①**한 사이클에 경계를 둘 옮기지 않는다** — 문제 발생 시 어느 쪽인지 실증이 섞인다 ②cycles 쓰기 = 버전을 끊는 행위 = **"무엇을 릴리즈할지"라는 결정** — D-42가 `todo` 복귀를 막는 것과 같은 논리 ③I-2의 목적은 읽기만으로 닫힌다 ④5차 D-34 조건부 지시는 **미발동 상태로 재이월 유지**(§2.2) — 형이 뒤집으면 그때 발동한다 |
| **D-47** | `cycle_read`의 조회 키 | `id`(uuid) / **`version`** / `name` | **`projectId` + `version`** | F50 — `version`이 프로젝트 내 유일키이자 **사람이 읽는 키**다. `name`은 nullable이라 미연결 버전을 짚을 수 없고, `id`는 클로드가 `cycle_list`를 먼저 불러야만 얻는다. `document_read(projectId, path)`가 세운 선례(사람이 읽는 키로 단건 조회)와 같은 형태이고, `scoped.getCycleByVersion`이 이미 존재한다(F49) |
| **D-48** | **하네스 재사용 방식** (S4) | 복붙(=재건축, **금지**) / `cycles.l1.ts`에 시나리오 추가 / **골격을 `server/l1-harness.ts`로 추출해 공유** | **추출 후 공유** | F46 — 5차 §7.2는 "import해서 쓰라"고 적었지만 **export가 하나도 없다.** 복붙은 5차 RK-27의 실현이라 금지고, 한 파일에 도메인을 섞으면 `cleanup`·픽스처가 얽힌다(5차가 실행 중 겪은 오염 사고의 확대판). 추출이 유일한 답이며, **그 추출이 필요했다는 사실 자체가 5차 A1 판단에 대한 회신 내용**이 된다(C24-④) |
| **D-49** | **MCP L1 검증 경로** | SDK `InMemoryTransport`(4차 V2) / **`app.request()`로 `/api/mcp` raw JSON-RPC**(2차·4차 L1) | **`app.request()` HTTP 경로** | 이번 스코프의 핵심이 **권한 경계**이고, 경계는 `authMiddleware`(`app.ts:39`)로 얻은 `ownerId`가 `registerTools(server, ownerId)`에 주입되는 구조 위에 서 있다(`mcp/index.ts:21`). InMemoryTransport는 그 구간을 통째로 건너뛴다. 5차 하네스 골격이 이미 PAT 발급·인증 헤더를 다루므로(F46) **추가 비용도 거의 없다**. 단 헤더·시퀀스는 §6.2 검증 1로 실측 |
| **D-50** | 2차 문서 사후 개정 형식 | 원문 교체 / **원문 유지 + 사후 문구 병기** | **병기**(4차 D-25 형식) | 4차가 2차 문서 3종을 정정할 때 세운 선례 — 원문 유지 + `**(사후 YYYY-MM-DD 확인: …)**` + Version History 행. **결정이 왜 바뀌었는지가 원문과 함께 남아야** 다음 사이클이 같은 논의를 반복하지 않는다. 대상 9곳은 F51 |

---

## 8. Convention Prerequisites

### 8.1 기존 규약

- [x] `CLAUDE.md` / `docs/RULE.md`
- [x] 옵션 B 계층 규칙(서비스만 도메인, MCP 툴은 `services/*`만 호출 — 2차 §9.1 규칙 1)
- [x] 에러 코드 단일 원천(2차 FR-20·D-17) + **에러 응답은 `ServiceError` 경유**(4차 §9.1 규칙 6)
- [x] **2차 RK-07 — 툴 description은 "언제 호출하는지"를 쓴다.** FR-61·FR-68이 이 규약의 소비자
- [x] **4차 §10 규약 ② — MCP 툴 입력은 `shared` 재사용**(4T-2b). 이번에 **본래 대상을 만난다**
- [x] **5차 D-37 — L1 하네스는 `server/` 아래 `*.l1.ts`**(tsc·oxlint 자동 커버). `mcp.l1.ts`가 승계
- [x] **5차 D-35 — 하네스 자산화**(커밋 + `test:l1` 분리 + `DATABASE_URL` skip 가드). 이번 사이클이
      그 인프라를 **소비만** 한다 — 신규 설정 0건이라는 사실 자체가 자산화의 배당금이다(C24)
- [x] 주석 규약 `// Design Ref: §N`, `// Plan SC: CN`, `// Decision: [Do] …`
- [x] 배포 절차 [docs/deploy/CHECKLIST.md](../../../deploy/CHECKLIST.md) — **§9.1 참조**

### 8.2 이번에 **적용할 형식** (신규 규약 정의 아님)

> 3차 P-1~P-3을 **세 번째 연속**으로 적용한다. 규칙 자체(RULE.md·템플릿)의 개정은
> 스코프 외(§2.2, 5T-4) — 승격 판단은 형의 몫이고 이 사이클은 근거를 한 겹 더 쌓는다.

| # | 형식 | 어디에 | 구체 지시 |
|:-:|------|--------|-----------|
| **P-1** | 직전 사이클 Try 이행 현황 표 | **Plan §1.4** (이 문서) | 완료 — 5차 전건(5T-1~4) + 미이행 재이월분(4T-1·4T-2b·D-34 조건부·3차 P-4·P-5). **이번엔 이 표가 스코프 항목 S4를 직접 만들어냈다** |
| **P-2** | zod 필드 표에 **"지울 수 있는가" 열** | **Design의 zod 스키마 표** | 이번 신규 zod 입력은 `cycle_list`(`projectId`)·`cycle_read`(`projectId`·`version`)·`backlog_update.status`뿐이고 **전부 필수 또는 enum이라 "아니오"가 예상된다.** 그래도 **표에 열을 만들고 전건 판정**한다 — 빈칸이 있으면 Design 미완성 |
| **P-3** | L1 시나리오를 **DoD 체크박스로** | **Plan §4.1** (선반영 완료) + Design §8 | m1~m13 + cycles 15건 재실행 + L0 체크박스. Design §8은 요청 본문·기대 응답으로 상세화하되 **판정의 원본은 §4.1** |
| **5T-2** | L1 시나리오 표에 **"공유 픽스처" 열** | **Plan §1.3.4** (선반영 완료) + Design §8 | 5차 회고 Try 2의 최초 적용. 픽스처 8종 정의 + 시나리오별 소유·종속 표기. **`FX-item1`의 m1→m2→m5 3단 종속**이 이 형식이 잡아낸 첫 성과 |
| — | 사후 개정 표기 | 2차 문서 9곳 | 4차 D-25 형식 유지(D-50) |

### 8.3 환경변수

변경 없음 — 신규 0건. 하네스는 기존 `.env.local`의 `DATABASE_URL`(Neon **dev** 브랜치)을
그대로 쓴다(5차 F35). 웹 커넥터 실증은 **프로덕션 배포본**과 형의 기존 PAT를 쓴다.

---

## 9. [DO] 실행 마일스톤

**5차와 같은 순서(검증 인프라 → 코드)를 쓰되, 이유가 다르다.** 5차는 red를 먼저 남기려고
뒤집었지만, 이번엔 **S4(골격 추출)가 S3·S1의 검증 수단을 만드는 선행 조건**이라 자연스럽게
앞에 온다. 그리고 module-1에서 **현행 거부 동작을 기준선으로 기록**하면, m1·m2가 개정 후
성공으로 뒤집히는 것이 그대로 증거가 된다(5차 red→green 형식의 재적용).

| Module | 스코프 | 산출물 | 완료 판정 |
|:------:|:---:|--------|-----------|
| **1** | S4 (전반) | §6.2 검증 1·3·4 수행 → **골격을 `server/l1-harness.ts`로 추출**(FR-69·71·72, MCP JSON-RPC 헬퍼 포함) → `cycles.l1.ts`를 import 형태로 전환 → `mcp.l1.ts` 골격 + **현행 기준선 기록**(m1·m2가 지금은 거부됨) | **`test:l1` cycles 15/15 유지**(FR-70, RK-30 해소) + m1·m2 **기준선 red 기록** + `npm test` 54건 불변 |
| **2** | S1 + S2 | §6.2 검증 2 수행 → `MCP_ALLOWED_TARGETS` 확대·export(FR-54·55) → zod 파생(FR-56) → 거부 메시지(FR-57) → `STATUS_MEANING` 신설 + 3소비자 연결(FR-60~63) → L0 T2·T3 반전 + T9·T10(FR-58) → 호출부 grep 전수(P-4) | **m1~m6 green**(m1·m2가 red→green으로 뒤집힘, m5는 거부 유지) + L0 그린 + **C21-① · C22-①** |
| **3** | S3 (+ S5 하네스 측) | `services/cycles.ts` 단건 조회 신설(FR-64) → `cycle_list`·`cycle_read`(FR-65~68) → m7·m9~m13 + **m8**(S5) | **m7~m13 green** + `tools/list` 10개 + **C23-①③ · C25-①** |
| **4** | 실증 + 문서 | **형**: 프로덕션 배포 → 웹 커넥터로 ①`done` 전환 ②`→todo` 거부 확인 ③`done`/`resolved` 갈라 찍기 ④`cycle_read` ⑤`reorder`. **클로드**: 2차 문서 9곳 사후 개정(F51·D-50) + 툴팁 브라우저 확인 요청 | **C21-②③ · C22-②③ · C23-② · C25-②** + 문서 개정 누락 0건 |

**순서 근거**

- **module-1이 먼저인 이유**: S4가 S1·S3의 **검증 수단 자체**다. 골격 없이 시나리오를 쓰면
  `mcp.l1.ts` 안에 인라인으로 짓게 되고 그게 RK-32(3번째 재건축)의 실현이다. 또 5차 하네스를
  깨지 않았음을 **코드 변경 전에** 확인해야 RK-30의 원인을 분리할 수 있다.
- **S1과 S2를 한 모듈에 묶는 이유**: 둘 다 `shared/transition.ts`를 만지고(F42+F44),
  RK-28이 "권한만 열리고 정의가 안 박히는 것"이라 **커밋이 갈리면 그 리스크가 실제로 발생**한다.
- **S3를 module-3으로 분리하는 이유**: 축이 다르고(cycles vs 백로그 전이), RK-37이 실현되면
  **잘라낼 수 있는 유일한 단위**다. 판단 시점은 module-2 완료 후.
- **module-4가 형의 구간인 이유**(4T-1): 웹 커넥터 실호출은 프로덕션 배포에 종속되고 실행
  주체가 형이다. 클로드 세션과 동기화될 필요가 없으므로 비동기로 확인받는 게 형의 시간을 덜 쓴다.

**세션 분할 권고**: module-1~2 한 세션(하네스 컨텍스트가 이어진다) / module-3 한 세션 /
module-4는 형의 확인 후 analysis·report 세션.

**Checkpoint 태깅**: module-1·2·3은 끝날 때 각각 FR-70 / C21-①·C22-① / C23-①③·C25-①만
즉시 대조한다 — 2차 회고 Try(마지막에 몰아서 대조하지 않기)를 4·5차에 이어 이번에도 적용.

### 9.1 배포 리스크

**이번 사이클은 DB 스키마를 바꾸지 않는다** — 상태는 이미 text 컬럼이고 신규 컬럼 0건,
cycles 툴은 기존 테이블을 읽기만 한다. 따라서 [CHECKLIST.md](../../../deploy/CHECKLIST.md)
**§1(마이그레이션)은 해당 없음**이고 §2(배포 순서)·§3(배포 후 확인)·§4(롤백 기준)만 적용된다.

다만 이번 사이클은 **4·5차와 달리 배포가 판정의 필수 조건**이다 — C21·C22·C23·C25의 절반이
웹 커넥터 실호출이고, 그건 프로덕션에 배포된 `/api/mcp`를 친다(RK-35). 배포 실행 주체는
**형**이며(4T-1), 배포 후 확인 항목은 다음과 같다:

1. 웹 커넥터 재연결 시 `tools/list`가 **10개**로 갱신되는지(캐시된 툴 목록이 남을 수 있다 — 실측 대상)
2. `backlog_update`의 새 description이 클로드에게 실제로 전달되는지(C22-②의 전제)
3. 기존 툴 8개의 실사용 무회귀(특히 `backlog_update`의 `resolved`·`dropped` 경로)

**롤백 기준**: 웹 커넥터에서 기존 8툴 중 하나라도 회귀하면 즉시 이전 배포로 되돌린다 —
이번 변경은 권한 확대라 **되돌려도 데이터가 깨지지 않는다**(잘못 찍힌 상태는 형이 UI에서
정정 가능, `actor='user'`는 전 전이 허용).

---

## 10. Next Steps

1. [x] **형 Plan 승인 — 확인 포인트 3건 전건 동의**(2026-08-09). 상세는 §1.5.1
2. [x] §6.2 검증 6건 수행 — **전건 실측 완료**(2026-08-09, design §1.3 V1~V6): MCP 경로
       initialize 불요·Accept 불요(V1) / `as const satisfies` 튜플 → `z.enum` 파생 성립(V2) /
       `l1-harness.ts` 파일명 미수집(V3) / 골격 6함수 전건 추출 가능(V4) / `cycle_list`는
       `hasReleaseNote` 치환(V5) / 웹 커넥터 시나리오 5건 사전 작성(V6)
3. [x] 설계 문서 작성 완료 — [expand-mcp-agency.design.md](./expand-mcp-agency.design.md)
       (v0.1). P-2 표는 design §3.3(신규 입력 4건 전건 "아니오"), L1 상세는 §8.3(공유 픽스처
       열 승계). **Checkpoint 3에서 문안 2건 형 확정**: CK3-1 `STATUS_MEANING`(초안 승인 +
       `resolved`에 "또는 필요가 없어짐" 추가), CK3-2 거부 메시지 A안
4. [ ] module-1 착수 (골격 추출 → cycles 15/15 무회귀 → MCP 기준선 red)
5. [ ] 사이클 종료 시 최신 `docs/RULE.md`의 종료 절차를 그때그때 따른다 — **(사후 2026-08-09
       개정)** 절차가 세션 중 두 차례 바뀌어 0~7단계로 재구성됐고(버전 태깅·MCP 릴리즈 생성·
       docs 반영 추가, 링크 전수 검증 삭제), 규칙 0으로 이 문서에 그 단계를 TODO로 나열하는
       것 자체가 금지됐다. "1~4"라는 원래 참조는 무효
6. [ ] **report §6.3에 5T-1 회신** — 하네스 재사용의 실제 비용(F46 추출 필요성 포함)을
       5차 A1 판단에 답하는 형태로. 다음 Plan §1.4(P-1)가 소비할 수 있게 번호 붙인 목록으로

### 확인 포인트 (형 판단 필요)

> **처리 완료 — 3건 전건 동의**(2026-08-09, §1.5.1). 아래 표는 판단 이력으로 보존한다.
> "형이 뒤집을 경우의 파급" 열은 **실현되지 않은 대안의 비용 기록**이며, 이후 사이클에서
> 같은 논의가 다시 열릴 때의 입력이다.

| # | 항목 | Plan 권고 | 형의 답 | 형이 뒤집을 경우의 파급 |
|:-:|------|-----------|:---:|------------------------|
| **①** | **D-42 — 남길 경계**: `todo` 복귀를 형 전용으로 남길까, 아니면 전면 허용할까 | **`todo` 복귀만 형 전용** (허용 집합 = 전 상태 − `todo`) | **✅ 동의** | 전면 허용 시 `canTransition`의 `actor` 축이 무의미해진다(RK-29) → `transition.ts`의 존재 의의 재설계가 **다음 사이클 스코프로 추가**된다. m5·T6·T9·T10이 전부 삭제되고 C21-③(거부 실증)이 사라진다 |
| **②** | **D-46 — cycles 쓰기 툴**: 이번에 만들까, 읽기만 할까 | **읽기 2툴만 (쓰기 0건)** | **✅ 동의** | 쓰기를 넣으면 **5차 D-34 조건부 지시가 발동**한다 — `name`/`yearMonth`의 `null` 허용 여부를 4차 D-21 형식으로 명시 결정 + `shared/schema.ts`(`cycleFields`·`cyclePairRule`·`CYCLE_PAIR_MESSAGE`, 5차가 이미 export해둠) 재사용. 스코프가 6건이 되고 RK-37(스코프 초과)의 확률이 크게 오른다 |
| **③** | **D-45 — 정의의 위치**: 코드(`shared/transition.ts`)에 둘까, 문서(`RULE.md`)에 둘까 | **코드에 `STATUS_MEANING` 신설** (`RULE.md`는 무변경) | **✅ 동의** | 문서에만 두면 툴 description·툴팁이 **문자열을 각자 복제**하게 되고(현행 `labels.ts`가 정확히 그 상태), RK-28(정의가 클로드에게 안 닿음)이 실현된다. 문서에 **함께** 적는 것은 언제든 추가 가능하되, 그때도 원천은 코드 |

---

## Version History

| 버전 | 날짜 | 변경 내용 | 작성자 |
|------|------|-----------|--------|
| 0.3 | 2026-08-09 | **(사후 개정)** `docs/RULE.md`가 세션 중 두 차례 개정된 것을 report 작성 단계에서 발견 — 사이클 종료 절차가 4단계(링크검증·INDEX·커밋·태그diff)에서 0~7단계(**규칙 0**: PDCA 문서에 종료 절차를 TODO로 기록하지 않음 + 버전 태깅·PDCA-workspace MCP 릴리즈 생성·docs MCP 반영 추가)로 재구성됐다. 이 문서 안에서 옛 절차를 체크박스로 언급하던 3곳(§3.2 비기능요구사항, §4.1 DoD, §10 Next Steps)에 **원문 유지 + 사후 문구 병기**(4차 D-25 형식)로 무효화 표시. 스코프·FR·C·RK·D 등 실질 결정은 무변경 | cogmo |
| 0.2 | 2026-08-09 | **형 승인 3건 반영(§1.5.1 신설) — 확인 포인트 전건 동의.** ①**D-42**(`todo` 복귀만 형 전용): "자료구조 근거(F41) + 의미 근거 이중 정합, 전면 허용은 `transition.ts` 존재 의의 재설계까지 끌고 나와 이번 스코프가 아님" ②**D-46**(읽기 2툴만): "'한 사이클에 경계 하나' 원칙이 이 사이클의 실증 가치를 지킨다" + D-34 조건부 지시의 미발동 재이월 처리도 승인 ③**D-45**(`STATUS_MEANING`을 코드에): `labels.ts`·`RULE.md` 둘 다 실측 배제 근거를 인정. **스코프·FR·C·RK·D 전부 무변경** — 5차 A1(형이 Plan 권고를 반론으로 뒤집음)과 달리 이번엔 권고가 그대로 기준선으로 확정됐다. 파생 반영: 상태를 Approved로, §10 Next Steps 1번 체크, §10 확인 포인트 표에 "형의 답" 열 추가(판단 이력 보존), **RK-29를 "완화 상태로 고정"으로 갱신**(전면 허용 분기가 닫혔으므로) | cogmo |
| 0.1 | 2026-08-09 | 최초 작성. 스코프 5건(S1 MCP 상태 권한 확대 / S2 "해소·완료" 의미 명문화 / S3 cycles 읽기 툴 / S4 하네스 재사용 확인 / S5 `backlog_reorder` 실행 확인) 고정. 현 HEAD(`a87b5ea`) 실측 F41~F53 — 특히 **F41**(`canTransition`이 전이 그래프가 아니라 목적지 화이트리스트 → 잔여 경계가 자동으로 "`todo` 복귀만 형 전용"이 됨, D-42), **F42**(허용 집합이 `transition.ts`·`tools.ts` 두 곳에 하드코딩 → 2값→4값 개정에서 드리프트 실현 자리, D-44 파생), **F44**(상태 라벨 단일 원천 `labels.ts`가 `src/` 아래라 `server/mcp/`에서 import 불가 → 의미 정의는 `shared/`가 유일 자리, D-45), **F46**(5차 하네스 골격이 **export 0건** → 5차 §7.2의 "import해서 쓰라"가 실물과 어긋남 → 추출이 선행 조건, D-48), **F49**(cycles 단건 조회가 db엔 3개 있으나 서비스 미노출 → `cycle_read`는 서비스 함수 신설 필요), **F51**(2차 상태 전이 다이어그램은 design이 아니라 **plan §1.4**에 있고 사후 개정 대상은 **9곳**). 판정 산식을 **Match Rate로 복귀**(D-40, 4·5차의 Scope Closure Rate와 구분). 5차 Try 4건 전건을 §1.4 P-1 표로 이행 — **5T-1이 스코프 항목 S4를 직접 만들어낸 첫 사례**이고 **5T-2(상호작용 매트릭스)를 §1.3.4 "공유 픽스처" 열로 Plan 단계에 선반영**. §10 확인 포인트 3건(D-42 남길 경계 / D-46 쓰기 툴 범위 / D-45 정의 위치)을 형 판단으로 올림 — 경계를 옮기는 사이클이라 Plan 권고가 형의 결정을 대신할 수 없다(5차 A1 선례) | cogmo |
