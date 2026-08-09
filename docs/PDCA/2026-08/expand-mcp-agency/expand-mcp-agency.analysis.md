---
template: analysis
version: 1.3
---

# expand-mcp-agency 분석 문서

> **분석 유형**: Gap Analysis (Design vs Implementation) + Runtime Verification + 웹 커넥터 실사용
> **프로젝트**: PDCA-workspace
> **작성자**: Claude
> **작성일**: 2026-08-09
> **Plan 문서**: [expand-mcp-agency.plan.md](./expand-mcp-agency.plan.md) (v0.2 Approved)
> **Design 문서**: [expand-mcp-agency.design.md](./expand-mcp-agency.design.md) (v0.1)

---

## Context Anchor

> Design에서 복사.

| Key | Value |
|-----|-------|
| **WHY** | 2차 Q10b 경계가 실사용 비용(5차 완주 시 형의 수동 전환 7건)을 발생시켰고, 형이 2026-08-08에 권한 확대를 결정했다. 경계 이동과 의미 정의는 분리 불가. cycles 툴 0개(5차 F36)는 3차부터 3회 이월된 기능 공백이다. |
| **WHO** | 형 — 승인자·프로덕션 배포·웹 커넥터 실호출의 실행 주체 / 클로드(Claude Code CLI) — 코드·dev DB 하네스 / **claude.ai 웹 MCP 커넥터 — 이번 사이클의 1급 소비자** |
| **RISK** | 권한만 열고 의미를 안 박으면 클로드가 `done`을 남발(RK-28) / 골격 추출이 5차 하네스 15/15를 깬다(RK-30) / MCP L1 경로 3번째 재건축(RK-32) / 2차 문서 사후 개정 9곳 누락(RK-34) |
| **SUCCESS** | C21~C25 — Match Rate(D-40) + "클로드가 웹 커넥터로 실제로 해냈다"까지(형+클로드 실증) |
| **SCOPE** | 5건(S1 권한 확대 / S2 의미 명문화 / S3 cycles 읽기 툴 / S4 하네스 재사용 / S5 reorder 실행 확인). 쓰기 툴 0건(D-46), `todo` 복귀는 형 전용(D-42), hard delete 미노출 불변(D-43) |

---

## Strategic Alignment Check

### Plan Core Value 정합

| Plan 요소 | 기대 | 구현 상태 |
|-----------|------|:---------:|
| Problem(WHY) — 2차 경계가 실사용 비용을 냄 | 권한 확대로 형의 수동 전환 제거 | ✅ `backlog_update`가 `doing`·`done`을 받는다. 형이 웹 커넥터로 실제 완료 전환 성공(§8.6-1) |
| Solution — 경계 이동 + 의미 명문화 + cycles 읽기 | 3건이 `shared/transition.ts` 한 파일로 수렴 | ✅ `MCP_ALLOWED_TARGETS`·`STATUS_MEANING` 신설, 3소비자(툴 description·서비스 거부 메시지·UI 툴팁)가 전부 이걸 참조 |
| Core Value — "경계를 옮기려면 그 자리에 새 경계를 그려야 한다" | `todo` 복귀는 형 전용으로 남는다(D-42) | ✅ `canTransition`이 `to==='todo' ∧ actor==='mcp'`만 거부. m5(하네스)·§8.6-2(웹 커넥터)로 이중 실증 |

### Success Criteria 상태 (Plan §4)

| # | 기준 | 상태 | 근거 |
|---|------|:---:|------|
| **C21** | S1 — 권한 확대 3종 실증 | ✅ Met | ①하네스 m1·m2 성공(21/21 시점) ②형이 웹 커넥터로 "○○ 완료로 바꿔줘" → `done` 전환 성공(§8.6-1, 형 확인) ③"다시 대기로" → 거부 + 클로드가 형에게 전달(§8.6-2, 형 확인). **단 거부의 실제 형태가 Design 예측과 다르다** — 아래 §2.6 GAP-1 참조 |
| **C22** | S2 — 정의가 실제로 판단을 바꾼다 | ✅ Met | ①`STATUS_MEANING` grep 전수 1곳(module-2 P-4) ②형이 "의도한 완료"·"우연한 해소" 두 항목을 각각 시켜 클로드가 `done`/`resolved`로 갈라 찍음(§8.6-3, 형 확인) ③브라우저 배지 툴팁 확인(형 확인, 이번 세션) |
| **C23** | S3 — cycles 읽기 실증 | ✅ Met | ①하네스 m9~m12 green(28/28) ②형이 "릴리즈노트 읽고 요약해줘" → `cycle_read` 실호출 성공(§8.6-4, 형 확인) ③`tools/list` 10개 — **단 캐시된 8개가 먼저 보였고 재연결 후 10개로 갱신됨**(§9.1 사전 확인 항목이 예견한 그대로 재현, 아래 §2.6 GAP-2) |
| **C24** | S4 — 하네스 재사용 결과 기록(5차 RK-27 채점) | ✅ Met | ①골격이 `l1-harness.ts`로 추출, `cycles.l1.ts`·`mcp.l1.ts` 둘 다 import ②추출 후 `cycles.l1.ts` 15/15 유지(재건축 0) ③`mcp.l1.ts`가 골격 위에서 m1~m13 실행 ④비용 기록 — 5차 §7.2의 "import해서 쓰게"는 실물과 어긋나 있었고(F46), **추출이 먼저 필요했다는 사실 자체가 회신 내용**(§4 report §6.3에서 5T-1에 답함). 부수 발견 1건은 아래 §2.6 GAP-3 |
| **C25** | S5 — `backlog_reorder` 실행 확인 | ✅ Met | ①하네스 m8 200 `{ok:true}` ②형이 웹 커넥터로 재배열 실호출(§8.6-5, 형 확인) |

**Success Rate**: 5/5 완전 충족. Critical·Important 이월 0건.

### Decision Record Verification

| 출처 | 결정 | 준수 여부 | 이탈 내용 |
|------|------|:---:|-----------|
| [Plan] D-40 | 판정 산식 = Match Rate(Scope Closure Rate 아님) | ✅ | 이 문서가 그 산식을 씀(§1) |
| [Plan] D-42(형 승인 A1) | 잔여 경계 = `todo` 복귀만 형 전용 | ✅ | `MCP_ALLOWED_TARGETS`가 전 상태−`todo`. T9·T10·m5로 고정 |
| [Plan] D-43 | hard delete·workspace/project create·update 미노출 불변 | ✅ | `tools/list` 10개, delete 계열 0(m7). 2차 plan §7.5 목록 사후 확인으로 병기 |
| [Plan] D-44 | zod enum을 `MCP_ALLOWED_TARGETS`에서 파생(1·2차 방어 집합 단일화) | ✅ | `z.enum(MCP_ALLOWED_TARGETS)`. **의도한 결과가 그대로 실현** — 1·2차 허용 집합이 항상 일치해, `to==='todo'`는 1차(zod)에서 걸리고 2차(canTransition)엔 도달하지 않는다(GAP-1) |
| [Plan] D-45(형 승인 A3) | `STATUS_MEANING`을 `shared/transition.ts`에 | ✅ | `labels.ts`는 표시명 전용으로 헤더만 갱신, 의미는 코드 신설 상수가 원천 |
| [Plan] D-46(형 승인 A2) | cycles 쓰기 툴 0건 | ✅ | `cycle_list`·`cycle_read` 읽기 2개만. 5차 D-34 조건부 지시는 재이월 유지(미발동) |
| [Design] CK3-1 | `STATUS_MEANING` 문안(형 확정, `resolved`에 "또는 필요가 없어짐") | ✅ | `shared/transition.ts:24-30` 문안 그대로 |
| [Design] CK3-2 | 거부 메시지 A안("todo로 되돌릴 수 없습니다…") | ✅ (도달 조건 정정) | `services/backlog.ts`에 그대로 존재하나, **MCP 경로에서는 도달하지 않는다**(GAP-1) — REST 경로(가정: 미래에 actor 확장 시)나 서비스 단위 테스트에서만 실행됨. 코드는 정확하고 Decision 주석으로 기록됨 |
| [Design] D-48 | 하네스 골격 `server/l1-harness.ts` 추출 | ✅ | 6함수 전건 + `rpc`/`callTool` 신설(FR-72) |
| [Design] D-51 | 하네스 파일명이 `.l1.ts` 접미사 아님(vitest 미수집) | ✅ | V3 실측대로 `npm test`·`test:l1` 양쪽 다 미수집 확인 |
| [Design] D-52 | `cycle_list`는 `hasReleaseNote`로 치환, `cycle_read`만 본문 | ✅ | m9로 실증(`'releaseNote' in row === false`) |
| [실행 중 발견] | `.l1.ts` 파일이 2개가 되며 vitest 파일 간 병렬 실행이 실 DB에서 `hns-owner-%` cleanup 경합을 냄 | — | Design에 없던 항목. `vitest.l1.config.ts`에 `fileParallelism: false` 추가로 해소(GAP-3, Decision 주석으로 코드에 기록) |

---

## 1. 분석 개요

### 1.1 목적

module-1~4 구현이 Design 문서와 얼마나 일치하는지, 그리고 이 상태로 Report로 넘어가도 되는지 판단.

### 1.2 범위·방법

- **Design 문서**: `docs/PDCA/2026-08/expand-mcp-agency/expand-mcp-agency.design.md`
- **구현 범위**: `shared/transition.ts`(+test)·`server/mcp/tools.ts`·`server/services/{backlog,cycles}.ts`·
  `server/l1-harness.ts`(신규)·`server/mcp.l1.ts`(신규)·`server/cycles.l1.ts`(수정)·
  `src/features/backlog/{components/ItemDialog.tsx,lib/labels.ts}`·`vitest.l1.config.ts`·
  2차 사이클 plan·design 문서 9곳(+2 부수 발견) 사후 개정
- **분석 방법**: Design §11.1 파일별 대조(구조) + 코드 내용을 Design §3·§4·§5·§6·§8 스펙과 줄 단위 대조(기능·계약) + 실행 결과 재확인(L0·L1) + 형의 웹 커넥터 실사용 5건 + 브라우저 확인 2건 반영
- **분석일**: 2026-08-09

---

## 2. Gap Analysis (Design vs Implementation)

### 2.1 Match Rate 요약

```
┌─────────────────────────────────────────────┐
│  Structural Match Rate: 100%  (11/11)        │
│  Functional Match Rate:  95%                 │
│  Contract Match Rate:    92%                 │
│  Runtime Match Rate:    100%  (L0 57 + L1 28)│
│  ─────────────────────────────────────────── │
│  Overall Match Rate:     97%                 │
│  = (100×0.15)+(95×0.25)+(92×0.25)+(100×0.35) │
│  = 15+23.75+23+35 = 96.75% ≈ 97%             │
└─────────────────────────────────────────────┘
```

Runtime이 실행돼 4축 가중 산식(§2.3.4)을 그대로 적용했다(gap-detector 없이 본인이 Design
스펙과 코드를 줄 단위로 대조 — 이번 사이클은 새 함수·파일 규모가 작아 정적 스캔 에이전트
없이도 전수 대조가 가능했다).

### 2.2 Structural Match — 100% (11/11)

Design §11.1 신규·수정 파일 10개 + "2차 문서 9곳 사후 개정" 1건(집합) = 11개 타깃 **전건 존재**:

| 타깃 | 상태 |
|------|:---:|
| `server/l1-harness.ts`(신규) | ✅ |
| `server/mcp.l1.ts`(신규) | ✅ |
| `server/cycles.l1.ts`(수정) | ✅ |
| `shared/transition.ts`(수정) | ✅ |
| `shared/transition.test.ts`(수정) | ✅ |
| `server/mcp/tools.ts`(수정) | ✅ |
| `server/services/backlog.ts`(수정) | ✅ |
| `server/services/cycles.ts`(수정) | ✅ |
| `src/features/backlog/components/ItemDialog.tsx`(수정) | ✅ |
| `src/features/backlog/lib/labels.ts`(수정) | ✅ |
| 2차 plan·design 9곳(사후 개정) | ✅ (+2 부수 발견, §2.6 GAP-2·GAP-4) |

**Design에 없던 파일 변경 1건**: `vitest.l1.config.ts`(`fileParallelism: false` 추가) — 구조
Match Rate에서 감점하지 않는다. 누락이 아니라 실행 중 발견한 필수 보강이고, Decision 주석으로
코드에 남겼다(§2.6 GAP-3).

### 2.3 Functional Depth — 95%

Design §3~§8의 코드 스펙과 실제 구현을 줄 단위로 대조:

| 대상 | 대조 결과 |
|------|-----------|
| §3.2 `MCP_ALLOWED_TARGETS`(as const satisfies) | ✅ 정확히 일치 |
| §3.2 `canTransition` 본체 | ✅ 무변경(Design 예측대로) |
| §3.2 `STATUS_MEANING`(CK3-1 문안) | ✅ 정확히 일치 |
| §4.1 `backlog_update` description 조립 | ✅ 정확히 일치(`STATUS_MEANING` 템플릿 리터럴) |
| §4.1 `cycle_list`/`cycle_read` description·D-52 성형 | ✅ 정확히 일치 |
| §4.2 `getCycleByVersion` | ✅ 정확히 일치(ensureProject + NOT_FOUND) |
| §5.1 `ItemDialog` `title` 속성 | ✅ 정확히 일치 |
| §5.2 `labels.ts` 헤더 주석 | ✅ 취지 일치(문구는 재구성) |
| §6.1 CK3-2 거부 메시지 | ✅ 문안 정확히 일치 — 단 **도달 조건이 Design 예측과 다르다**(GAP-1) |
| §8.4 `l1-harness.ts` 6함수 + `rpc`/`callTool` | ✅ 함수 목록 일치. `callTool` 반환 타입에 `httpStatus` 필드 추가(Design 스펙 확장, 감점 아님) |
| §8.3 m1~m13 | **12/13 정확히 일치, m5는 기대 결과 문구가 Design과 다르다**(GAP-1) |

TODO/FIXME/placeholder grep 0건. `shared/transition.test.ts`는 §8.2 T1~T11과 완전 일치
(단위 테스트로 전수 커버). 감점 5%는 전부 GAP-1(m5) 하나에서 나온다 — 그 외 전 항목이 Design
문안과 바이트 수준으로 일치한다.

### 2.4 API Contract — 92%

| 대상 | 대조 결과 |
|------|-----------|
| §4.1 툴 3건(변경 1·신설 2) | ✅ 3/3 |
| §4.2 서비스 시그니처 | ✅ 일치 |
| §4.3 REST 무변경 | ✅ `git diff server/routes/` 0줄 |
| §4.4(§6.2) 에러 코드 | **부분 일치** — `TRANSITION_DENIED`의 발생 조건이 서술대로 "MCP가 todo 복귀 시도"로 좁아진 건 맞지만, **실제 클라이언트가 받는 에러 형태가 Design이 명시한 `[TRANSITION_DENIED]` 텍스트가 아니라 SDK의 zod 스키마 검증 에러**(`MCP error -32602: ...`)다. 클로드(웹 커넥터)가 받는 신호 자체는 명시적 거부라 2차 원칙("조용한 무시 금지")은 충족하지만, **Design 문서가 약속한 정확한 에러 텍스트와는 다르다** — 계약 수준의 이탈이라 8%p 감점 |

이 이탈은 §2.6 GAP-1에서 상세 분석하고, module-2 구현 중 형과 논의해 "현 구조 유지"로
확정한 결정이다(Plan §6.2 검증 논의 연장) — **버그가 아니라 확인된 설계 특성**이지만, Design
문서 §8.3 표의 문구 자체는 실물과 다르므로 계약 불일치로 정직하게 반영한다.

### 2.5 Runtime Verification — L0 57/57 + L1 28/28 (100%)

**L0** (`npm test`): 6파일 **57건** 전부 통과(5차 기준 54 + 이번 T9·T10·T11 신규분).

**L1** (`npm run test:l1`, 실 dev DB):

| 파일 | 결과 |
|------|------|
| `cycles.l1.ts` | 15/15 (골격 추출 후 무회귀 — FR-70) |
| `mcp.l1.ts` | 13/13 (m1~m13 전건) |
| **합계** | **28/28** |

`env -u DATABASE_URL npx vitest run --config vitest.l1.config.ts` → 17→28건 전부 skip(가드
정상). 하네스 잔여 데이터 0건(`hns-%` 쿼리 재확인, §1.2 방법 참조).

**웹 커넥터 실사용 5건**(§8.6, 형 직접): 전부 성공 — ①`done` 전환 ②`→todo` 거부+전달
③`done`/`resolved` 갈라 찍기 ④`cycle_read` 요약 ⑤`reorder`. 브라우저 확인 2건(완료 섹션
반영, 배지 툴팁) 전부 성공.

### 2.6 실행 중 발견 사항 (GAP 4건)

> gap-detector 없이 직접 대조했으므로, 이 섹션이 5차의 "gap-detector 재검증" 절 역할을 겸한다.
> 4건 전부 **버그가 아니라 실행해야 보이는 구조적 특성이거나 문서-실물 어긋남**이고, 전부
> 발견 시점에 처리됐다(3건은 코드/문서에 기록, 1건은 형의 실측으로 예견이 확인됨).

| # | 발견 | 판정 | 처리 |
|---|------|------|------|
| **GAP-1** | Design §8.3 m5가 "isError + `[TRANSITION_DENIED]` + CK3-2 문안"을 기대했으나, 실제로는 zod enum(`MCP_ALLOWED_TARGETS`)이 `to='todo'`를 1차에서 거부해 **service의 canTransition(2차 방어)엔 영영 도달하지 않는다**. 이는 D-44가 "1·2차 방어의 허용 집합을 구조적으로 일치시킨" 설계의 **필연적 귀결**이다 — 애초에 2차부터 그랬다(2차 zod enum이 2값일 때도 canTransition의 mcp 허용 2값과 항상 같았다) | **설계 특성, 버그 아님** | 형에게 AskUserQuestion으로 확인 → **"현 구조 유지"** 결정(module-2). `mcp.l1.ts`의 m5 테스트를 zod 거부 문구 기대로 수정, Decision 주석 기록. 2차 design §11.2 DoD의 "2차에서 걸린다"는 서술도 **2차 시점부터 이미 틀렸던 주장**임을 발견해 사후 정정(§10.2 부수 개정 1) |
| **GAP-2** | Design §9.1이 미리 지목한 "웹 커넥터 재연결 시 캐시된 툴 목록이 남을 수 있다"가 그대로 재현 — 8개로 보이다가 재연결 후 10개로 갱신 | **예견이 실측으로 확인됨** | 형이 재연결로 해소, report에 관찰 기록 |
| **GAP-3** | `.l1.ts` 파일이 2개(`cycles.l1.ts`+`mcp.l1.ts`)가 되면서 vitest 기본 파일 간 병렬 실행이 실 DB에서 `hns-owner-%` cleanup 경합을 냈다 — 5차는 파일이 1개뿐이라 드러나지 않았던 문제. Design D-48·D-51 어디에도 이 리스크는 없었다 | **Design 공백, module-1에서 발견·해소** | `vitest.l1.config.ts`에 `fileParallelism: false` 추가. Decision 주석 + 이 문서 §Decision Record Verification 마지막 행에 기록 |
| **GAP-4** | §10.2 체크리스트(9곳) 작성 중 grep 재확인으로 계획에 없던 2곳을 추가 발견 — ①2차 design §3.3 코드 블록 **내부 주석**(테이블만 고치고 코드 펜스 텍스트를 놓칠 뻔함) ②2차 design §11.2 DoD의 "심층 방어 2층" 서술(GAP-1과 연동) | **체크리스트 자체의 완결성 문제, module-4에서 해소** | 둘 다 원문 유지+사후 문구 병기로 개정 완료 |

**결론**: 4건 중 실제 코드 수정을 유발한 건 GAP-3(vitest 설정) 하나뿐이다. GAP-1·GAP-4는
문서 정합성 문제, GAP-2는 예견된 배포 인프라 특성. Critical·Important 이월 0건 — 전부
발견 시점에 처리됐다.

---

## 3. 보안 이슈

| 심각도 | 파일 | 위치 | 내용 | 권장 조치 |
|:---:|------|------|------|-----------|
| 🟢 Info | `server/mcp/tools.ts` | `cycle_read` | ownerId 2단 조인 + `ensureProject` 이중 방어로 타 소유자 데이터 도달 경로 없음(m12 실증) | 없음 — 확인만 |
| 🟢 Info | `server/mcp/tools.ts` | `cycle_list` | `releaseNote` 본문이 목록 응답에서 제외됨(D-52) — 컨텍스트 절약 + 노출면 최소화 겸함 | 없음 |
| 🟢 Info | — | — | hard delete·workspace/project create·update MCP 미노출 불변(D-43) — 이번 권한 확대가 파괴적 행위로는 확장되지 않음 | 없음 |

신규 보안 이슈 0건. 이번 사이클은 권한을 **넓히는** 변경이라 RK-28(오남용)을 §2.5 웹 커넥터
실사용 5건 + §2.2 브라우저 확인으로 반증했다.

---

## 4. 테스트 커버리지

| 영역 | 현재 | 비고 |
|------|------|------|
| L0(`shared/transition.test.ts`) | T1~T11 (11케이스) | 5차 8케이스 + 이번 T9·T10(잔여 경계)·T11(`STATUS_MEANING`) |
| L0(기존 5개 스위트) | 무변경, 전부 통과 | `path.test.ts`·`schema.test.ts`·`buildDocTree.test.ts`·`extractLinks.test.ts`·`versionSort.test.ts` |
| L1(`cycles.l1.ts`) | 15/15 | 5차 자산, 골격 추출 후 무회귀 |
| L1(`mcp.l1.ts`, 신규) | 13/13 | m1~m13 전건 — 백로그 권한 6건 + cycles 읽기 5건 + reorder 1건 + 미인증 1건 |
| L2(브라우저) | 형 확인 2건 | 완료 섹션 반영, 배지 툴팁 |
| L3(웹 커넥터 실사용) | 형 확인 5건 | §8.6 전건 |

전체 Vitest **57건**(L0) + **28건**(L1, 별도 실행) = **85건**. `tsc -b`·`oxlint` 전체 그린.

---

## 5. Clean Architecture 준수 (옵션 B)

| 규칙 | 확인 |
|------|:---:|
| 1. 도메인 로직은 `server/services/*`에만 | ✅ |
| 2. `mcp/tools.ts`는 Drizzle import 금지 | ✅ (`cyclesService`·`backlogService` 경유만) |
| 3. 서비스는 HTTP 모름, `ServiceError`만 throw | ✅ |
| 4. `shared/transition.ts` import 0(순수) | ✅ |
| 5. `cycle_list` 응답 성형(`releaseNote`→`hasReleaseNote`)이 어댑터(tools.ts)에 위치 | ✅ Design §4.1이 명시한 위치(REST는 본문 유지해야 하므로 서비스가 아니라 어댑터가 맞음) |

**5/5 준수.**

---

## 6. 권장 조치

### 6.1 Critical (0)

없음.

### 6.2 Important (0)

없음.

### 6.3 Minor (2, 백로그)

| # | 항목 |
|---|------|
| M-10 | Design §8.3 m5 표의 기대 텍스트("isError + `[TRANSITION_DENIED]`")를 실물(zod 스키마 거부)에 맞춰 Design 문서 자체를 사후 정정할지 — 이번엔 `mcp.l1.ts` 코드와 이 analysis에만 기록했다. RULE.md상 Design은 사이클 종료 전 미확정이라 report 전 최종본에서 반영 여부 결정 |
| M-11 | `callTool` 반환 타입에 `httpStatus`가 추가돼 Design §8.4 스펙과 문자 그대로는 다르다 — 기능에 영향 없는 확장이라 우선순위 낮음. 다음 사이클이 하네스를 확장할 때 실물 시그니처를 참조하면 됨 |

---

## 7. Checkpoint 5 — 형 결정

**권장**: 그대로 진행 → Report.

근거: Success Criteria 5/5 완전 충족, Critical·Important 0건, Overall Match Rate 97%.
발견된 GAP 4건은 전부 발견 시점에 처리됐고(GAP-1은 형이 이미 module-2에서 "현 구조 유지"로
결정), M-10·M-11은 문서 표기 수준의 Minor라 백로그로 넘겨도 무방하다.

---

## Version History

| 버전 | 날짜 | 변경 내용 | 작성자 |
|------|------|-----------|--------|
| 0.1 | 2026-08-09 | 최초 분석. Design §11.1 구조 대조(11/11) + 코드 내용 줄 단위 대조(Functional 95%·Contract 92%) + Runtime 재확인(L0 57/57·L1 28/28) + 형의 웹 커넥터 실사용 5건·브라우저 확인 2건 반영. Overall Match Rate 97%. GAP 4건 발견·전건 처리 기록(GAP-1 m5 문구 불일치는 module-2에서 형 결정으로 이미 해소, GAP-3 vitest 파일 병렬 경합은 module-1에서 코드로 해소). Success Criteria C21~C25 5/5 완전 충족, Critical·Important 이월 0건 — Report 진행 권장 | Claude |
