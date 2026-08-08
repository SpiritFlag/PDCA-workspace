---
template: analysis
version: 1.3
---

# cycle-release-note 분석 문서

> **분석 유형**: 사후 규약 준수 분석 (Convention & Retrospective Compliance) — *통상의 Design vs Implementation Gap Analysis가 아니다*
> **프로젝트**: PDCA-workspace
> **작성자**: cogmo
> **작성일**: 2026-08-08
> **Plan 문서**: [cycle-release-note.plan.md](./cycle-release-note.plan.md)
> **Design 문서**: [cycle-release-note.design.md](./cycle-release-note.design.md)
> **대상 릴리즈**: `v0.1.2` (`v0.1.1..v0.1.2`, 커밋 4개)

---

## Context Anchor

> Design에서 복사.

| Key | Value |
|-----|-------|
| **WHY** | 문서·백로그는 1급 데이터가 됐는데 릴리즈(버전)만 데이터가 아니다. |
| **WHO** | 형(cogmo) — 브라우저 실사용자. 이번엔 클로드가 소비자가 아니다(cycles MCP 툴 0개). |
| **RISK** | PDCA 없이 구현부터(RK-01) / 사후 Design은 자기충족(RK-02) / 팔레트 규약 개정(RK-03) / 프로덕션 설정 오염(RK-04). |
| **SUCCESS** | C1~C8. 핵심은 C3 — 버전 카드 4버튼 왕복. |
| **SCOPE** | 축1 DB+API / 축2 버전 UI / 축3 임포트 재설계 / 축4 셸·화면 / 축5 테마 / 축6 로컬 개발 서버. |

---

## 1. 분석 개요

### 1.1 목적

v0.1.2가 **PDCA 절차 없이** 구현·태깅된 뒤 사후에 문서화됐다.
이 분석의 목적은 "설계대로 됐는가"가 아니라 **"절차를 건너뛴 대가가 코드 어디에 남았는가"**를 찾아내는 것이다.

### 1.2 이 분석이 통상 Gap Analysis일 수 없는 이유 — 기준선 재정의

> **이것이 이 문서에서 가장 중요한 절이다.**

[design](./cycle-release-note.design.md)은 구현을 읽고 쓴 문서다. 그러므로:

- Structural Match를 재면 **정의상 100%**가 나온다. 설계 문서가 구현의 사본이기 때문이다.
- Functional Depth도 **정의상 100%**다. 없는 기능은 설계에도 안 적혔다.
- API Contract도 **정의상 100%**다. 계약을 구현에서 베꼈다.

즉 **통상 3축을 그대로 돌리면 100%가 나오고, 그 100%는 단 한 비트의 정보도 없다.**
2차 사이클이 96%를 "실증으로 얻은 96%"라고 부를 수 있었던 건 Design이 구현보다 **먼저** 있었기 때문이다.

따라서 기준선을 구현 밖의 세 가지 **독립된 원천**으로 바꾼다.

| 기준선 | 원천 | 왜 독립적인가 |
|--------|------|---------------|
| **① 프로젝트 규약** | 1차·2차 Design이 확정한 계층 규칙·에러 코드 표·단일 원천 원칙·색상 규약 | 이 사이클 이전에 쓰였다 |
| **② 2차 사이클 회고 Try 3건** | [backlog-with-mcp.report.md](../backlog-with-mcp/backlog-with-mcp.report.md) §6.3 | 이 사이클 이전에 합의됐다 |
| **③ 실행 검증** | 실제로 돌린 테스트·린트·타입체크·런타임 시나리오 | 문서가 아니라 실행 결과다 |

### 1.3 범위·방법

| 항목 | 내용 |
|------|------|
| 대상 | `git diff v0.1.1..v0.1.2` 전 파일 (36파일, `package-lock.json` 제외 시 실질 21파일) |
| 방법 | 커밋별 diff 정독 → 규약 대조 → 코드 경로 추적으로 결함 재현 논증 → 실행 검증(vitest/oxlint/tsc) |
| 실행 검증 | `npx vitest run`(46/46), `npm run lint`(클린), `npx tsc -b`(클린) — 실측 |
| **미실행** | DB에 붙는 런타임 검증(2차의 `app.request()` 하네스), 브라우저 조작 확인 |
| 도구 | gap-detector 미사용 — 사후 Design 대비 비교가 무의미하므로 수동 규약 대조로 대체 |

---

## 2. 규약 준수 분석 (Gap Analysis 대체)

### 2.1 종합 점수

| 축 | 가중 | 점수 | 기여 |
|----|:---:|:---:|:---:|
| **A. 구조·계층 (옵션 B 3층)** | 20% | **100%** (6/6) | 20.0 |
| **B. 데이터 모델·계약 정합** | 20% | **71%** (5/7) | 14.3 |
| **C. 단일 원천(DRY) 규약** | 15% | **40%** (2/5) | 6.0 |
| **D. 2차 회고 Try 반영** | 15% | **0%** (0/3) | 0.0 |
| **E. 런타임 실증** | 20% | **0%** (0/11) | 0.0 |
| **F. 보안·회귀 안전** | 10% | **100%** (9/9) | 10.0 |
| **종합 Match Rate** | 100% | | **50%** |

> ⚠️ **이 50%를 2차의 96%와 같은 자에 놓을 수 없다.** 기준선이 다르다(§1.2).
> 2차의 96%는 "설계 대비 구현이 얼마나 맞았나"이고, 이 50%는 "절차 없이 짠 코드가 기존 규약과 학습을 얼마나 지켰나"다.
> **읽는 법**: 만들어진 물건(축 A·F)은 훌륭하고, **만든 방식(축 D·E)은 0점이다.**

### 2.2 축 A — 구조·계층: 6/6 (100%)

| # | 규약 | 결과 | 근거 |
|---|------|:---:|------|
| A1 | 라우트에 Drizzle import 0건 | ✅ | `routes/cycles.ts`는 Hono·zod·서비스만 import |
| A2 | 서비스가 유일한 도메인 로직 자리 | ✅ | `services/cycles.ts`가 scoped 판별 유니온을 `ServiceError`로 번역 |
| A3 | 전 쿼리 ownerId 2단 조인 | ✅ | cycles 7함수 전부 `cycles→projects→workspaces.ownerId` |
| A4 | 2분할 라우트 패턴(프로젝트 하위 / 단건) | ✅ | documents·backlog와 동형 |
| A5 | 에러 코드 신설 0건 | ✅ | 기존 6코드만 사용 |
| A6 | 새 계층·새 런타임 도입 0건 | ✅ | 기존 3층에 도메인 1개 추가 |

> **이 축이 만점인 게 우연이 아니다.** 2차에서 세운 구조가 충분히 명확해서, **설계 문서 없이도** 새 도메인이
> 같은 모양으로 흘러들어갔다. 좋은 아키텍처의 정의 그 자체다 — 회고 Keep 후보.

### 2.3 축 B — 데이터 모델·계약: 5/7 (71%)

| # | 항목 | 결과 | 비고 |
|---|------|:---:|------|
| B1 | `version` 프로젝트 내 유일 | ✅ | `cycles_proj_version_uq` |
| B2 | `name` nullable + 유일 양립 | ✅ | postgres btree unique의 NULL 허용 활용(D-26) — 정확한 판단 |
| B3 | 생성 시 pair rule 강제 | ✅ | `createCycleSchema.refine(cyclePairRule)` |
| B4 | **수정 시 pair rule 강제** | ❌ | `updateCycleSchema = cycleFields.partial()` → **refine 소실** (I-1) |
| B5 | **사이클 연결 해제 가능** | ❌ | `.optional()`만 있고 `.nullable()` 없음 → 해제 불가 (**C-1**) |
| B6 | 프로젝트 삭제 시 cascade | ✅ | `onDelete: 'cascade'` |
| B7 | 버전 삭제가 문서를 지우지 않음 | ✅ | 별개 테이블 + confirm 문구로 고지 |

### 2.4 축 C — 단일 원천(DRY): 2/5 (40%)

| # | 단일 원천 | 재사용 | 결과 |
|---|-----------|--------|:---:|
| C1 | `stageColor.ts` (단계색) | `CycleCard`가 재사용 | ✅ |
| C2 | `errors.ts` (에러 코드) | `services/cycles.ts`가 재사용 | ✅ |
| C3 | `cyclePath.ts` (경로 조립) | `CycleCard`만 재사용, **`ImportDialog`는 하드코딩** | ❌ |
| C4 | `yearMonth.ts` (연월 옵션) | `CycleForm`만 재사용, **`ImportDialog`가 통째로 복제** | ❌ |
| C5 | `cycleNameSchema` (이름 규칙) | `CycleForm`만 재사용, **`ImportDialog`는 자체 정규식** | ❌ |

> 위반 3건이 **전부 같은 파일**(`ImportDialog.tsx`)에 있다. 이 파일만 사이클 도메인 바깥에서 쓰여진 탓이다 — I-3.

### 2.5 축 D — 2차 회고 Try 반영: 0/3 (0%)

> 2차 report §6.3에서 형과 합의한 "다음에 시도할 것" 3건. **하나도 적용되지 않았다.**

| # | 2차 Try | 이번 사이클 결과 | 판정 |
|---|---------|------------------|:---:|
| D1 | "날짜·선택 필드는 zod 작성 시 **'값을 지울 수 있어야 하는가'를 항상 명시적으로 결정**하고 `.nullable()` 여부를 Design 표에 기록" | `name`·`yearMonth`를 `.optional()`로만 두어 **연결 해제 불가**. `closedOn`과 **글자 그대로 같은 버그**가 다른 컬럼에서 재발 | ❌ |
| D2 | "MCP 툴 입력 스키마는 `shared/schema.ts`를 재사용하는 걸 원칙으로" | cycles MCP 툴 자체를 안 만들어 적용 기회조차 없음 | ❌ |
| D3 | "Plan 단계에서 **'이 기능을 실제로 쓸 클라이언트가 몇 종류인가'**를 스코프 질문에 명시적으로 포함" | Plan 단계가 없었다. 결과적으로 클로드(MCP)를 소비자로 세지 않아 I-2 발생 | ❌ |

> **이 축이 이 분석의 핵심 발견이다.** 회고에서 얻은 학습은 **다음 사이클의 Plan/Design 단계에서 소비된다.**
> 그 단계를 건너뛰면 회고는 저장은 되지만 **재생되지 않는다.** D1이 그 증명이다 —
> 2차에서 Critical로 잡고, 회고에 적고, 이월까지 시켜놓고, 3차에서 같은 실수를 했다.

### 2.6 축 E — 런타임 실증: 0/11 (0%)

[design](./cycle-release-note.design.md) §8.2의 L1 시나리오 11개 중 **실행된 것 0개.**

| 검증 종류 | 2차 | 3차(이번) |
|-----------|:---:|:---:|
| 순수 함수 단위 테스트 | 35 케이스 | ✅ 11 케이스(versionSort) |
| 실 DB `app.request()` 하네스 | ✅ 13/13 | ❌ **0건** |
| 실 MCP 호출 | ✅ | ❌ (툴 없음) |
| 브라우저 실사용 | 형이 부분 확인 | ⚠️ 미기록 |

> 2차 회고 Keep #1이 "실 DB 하네스로 배포 없이 배포처럼 검증"이었다. **이번엔 한 번도 안 썼다.**
> 그 결과 C-1·I-1은 **코드 정독으로만** 발견됐다 — 하네스가 있었으면 §8.2 시나리오 #5·#10이 즉시 잡았을 것들이다.

### 2.7 축 F — 보안·회귀 안전: 9/9 (100%)

| # | 항목 | 결과 |
|---|------|:---:|
| F1~F6 | 소유권 조인 / 인증 미들웨어 / XSS sanitize / 경로 주입 차단 / 입력 크기 상한 / 신규 노출면 0 | ✅ (design §7) |
| F7 | 기존 테스트 무회귀 | ✅ 35 → 46, 전부 통과 |
| F8 | oxlint 클린 | ✅ |
| F9 | `tsc -b` 클린 | ✅ |

---

## 3. 발견 사항

### 3.1 Critical (1)

#### C-1. 한 번 연결한 PDCA 사이클을 해제할 수 없다 — 2차 `closedOn` 버그의 재발

| 항목 | 내용 |
|------|------|
| 위치 | `shared/schema.ts` `cycleFields.name`/`yearMonth`, `src/features/cycle/components/CycleForm.tsx` `toggleLink` |
| 재현 경로 | ① 사이클 연결된 버전을 수정 연다 → ② `☐ PDCA 사이클 연결` 체크를 **끈다** → ③ 저장 |
| 실제 동작 | `toggleLink(false)`가 `setValue('name', undefined)` → 클라이언트 zod pairRule은 통과 → **JSON 직렬화에서 `undefined` 키가 사라짐** → PATCH 본문에 `name` 없음 → `updateCycleSchema.partial()`이 "미변경"으로 해석 → DB 값 유지 |
| 사용자 체감 | **에러 없이 저장 성공 메시지가 뜨고, 화면을 새로고침하면 연결이 그대로 있다.** 조용한 실패 |
| 부수 피해 | 그 사이클명이 `cycles_proj_name_uq`를 계속 점유 → 다른 버전에 같은 이름을 못 쓴다 |
| 근본 원인 | `.optional()`만 쓰고 `.nullable()`을 안 넣음 — **2차 `closedOn`과 완전히 동일** |
| 심각도 근거 | 2차에서 같은 클래스를 Critical로 판정했고, 회고 Try D1로 재발 방지를 합의했는데도 재발 |
| 수정 방향 | `name`/`yearMonth`를 `.nullable()`로 확장하고, `toggleLink(false)`가 `undefined`가 아니라 **`null`**을 세팅. 서버 `updateCycle`이 `null`을 "지우기"로 해석 |

### 3.2 Important (5)

#### I-1. `updateCycleSchema.partial()`이 pair refine을 잃어 부정합 레코드를 허용한다

| 항목 | 내용 |
|------|------|
| 위치 | `shared/schema.ts` — `export const updateCycleSchema = cycleFields.partial()` |
| 문제 | `createCycleSchema`에만 `.refine(cyclePairRule)`가 붙어 있다. `partial()`은 refine 없는 `cycleFields`에서 파생되므로 **수정 경로에는 pair 규칙이 없다** |
| 재현 | `PATCH /api/cycles/:id` 본문 `{"name":"foo"}` → 200. `name='foo'`, `year_month=null` 레코드 생성 |
| 결과 | `CycleCard`의 `hasCycle = !!name && !!yearMonth`가 false → **화면엔 사이클 미연결로 보인다.** 그런데 `cycles_proj_name_uq`는 점유 중 → 다른 버전에 `foo`를 넣으면 "이미 존재하는 사이클명입니다" 409가 뜨는데 **그 이름을 쓰고 있는 버전이 화면 어디에도 안 보인다** |
| 현재 노출도 | 브라우저 UI에서는 `CycleForm`이 항상 둘을 함께 보내므로 도달 어려움. **API·MCP 경로에선 무방비** |
| 수정 방향 | `updateCycleSchema`에도 pair rule 적용(부분 갱신 후 병합 상태 기준으로 검증하거나, 서버 서비스에서 병합 결과를 재검증) |

#### I-2. 새 1급 데이터인데 MCP 툴이 0개 — 2차의 핵심 가치가 미적용

| 항목 | 내용 |
|------|------|
| 실측 | `server/mcp/tools.ts`의 `registerTool` 8건: `project_list`, `document_list/read/write`, `backlog_list/create/update/reorder`. cycles 관련 **0건** |
| 문제 | 2차 사이클의 Core Value는 "판단에 필요한 문서를 클로드가 직접 읽는다"였다. 이번에 만든 버전·릴리즈노트는 **판단에 가장 직접적인 데이터**(어느 릴리즈에 뭐가 들었나)인데 클로드가 못 읽는다 |
| 영향 | 형이 "v0.1.2에 뭐 했지?"를 클로드에게 물으면, 클로드는 여전히 문서 본문을 뒤져야 한다. 릴리즈노트가 DB에 있는데도 |
| 연결 | 2차 Try D3(클라이언트 종류를 스코프 질문에 포함)가 지켜졌다면 잡혔을 누락 |
| 수정 방향 | `cycle_list` / `cycle_read`(릴리즈노트) 최소 2툴. 쓰기는 2차 권한 경계 원칙에 따라 보수적으로 |

#### I-3. `ImportDialog`가 사이클 도메인의 단일 원천 3개를 전부 우회한다

| 위반 | 있는 것 | ImportDialog가 한 것 |
|------|---------|----------------------|
| 경로 조립 | `cycleStagePath(ym, name, stage)` | `` `docs/PDCA/${ym}/${name}/${name}.${stage}.md` `` 하드코딩 |
| 연월 옵션 | `yearMonth.ts`의 `ymOf`/`currentYearMonth`/`yearMonthOptions` | **동일 로직을 파일 상단에 그대로 재구현**(`ymOf`/`currentYm`/`MONTH_OPTIONS`) |
| 이름 규칙 | `cycleNameSchema` = `/^[A-Za-z0-9._-]+$/` | `/[/\s]/` 금지뿐 → **한글 사이클명이 통과한다** |

> 세 번째가 특히 나쁘다. 같은 문자열을 `ImportDialog`에 넣으면 문서가 만들어지고,
> `CycleForm`에 넣으면 400이 난다. **같은 개념에 두 규칙**이 생겼다 —
> D-22가 막으려던 바로 그 상황이며, 2차 회고 Problem #2("단일 원천을 서비스 계층까지만 적용하고 검증 계층까지 못 미침")의 재현.

#### I-4. 서버 런타임 실증 0건 — 확립된 검증 자산을 쓰지 않았다

2차에서 `app.request()` 실 DB 하네스로 13/13을 실증했고, 그 과정에서 정렬 SQL 캐스팅 버그를 잡았다.
이번엔 그 하네스가 **한 번도 실행되지 않았다.** C-1·I-1이 코드 정독으로만 발견된 이유이며,
그 둘은 design §8.2 시나리오 #10·#5에 정확히 대응한다 — **하네스만 돌렸으면 자동으로 잡혔을 결함이다.**

#### I-5. 임포트 폼 재설계로 문서 제목이 사이클명으로 고정 — 사이드바에 같은 이름 4개

| 항목 | 내용 |
|------|------|
| 위치 | `ImportDialog.tsx` — `const effectiveTitle = isEdit ? title : name.trim()` |
| 변경 전 | 생성 시 제목을 별도 입력했다 |
| 변경 후 | 생성 모드에서 제목 입력란이 **사라졌고**, 제목 = 사이클명 |
| 결과 | 한 사이클의 plan/design/analysis/report 4문서가 **전부 같은 title**을 갖는다. `SidebarTree`의 `TreeItem`이 `node.title`을 렌더하므로 → 같은 폴더 아래 **동일한 라벨 4개**가 나란히 뜬다 |
| 검증 | `buildDocTree`가 leaf에 `doc.title`을 싣고, `TreeItem`이 `{node.title}`을 출력 — 코드 확인 |
| 성격 | 편의(경로 안 치기)를 얻고 식별성(제목)을 잃은 **의도되지 않은 교환** |
| 수정 방향 | pdca 생성 시 제목을 `{name} {stage}`로 파생하거나, 트리 leaf 라벨을 파일명(`node.name`) 기준으로 |

### 3.3 Minor (10)

| # | 항목 | 위치 | 내용 |
|---|------|------|------|
| M-1 | 사이드바 자동 펼침이 마운트 시점만 | `SidebarTree` `useState(active)` | 사이드바는 라우트 전환에 언마운트되지 않으므로, 다른 워크스페이스로 이동해도 자동으로 안 펼쳐진다 |
| M-2 | 워크스페이스 수만큼 프로젝트 요청 | `WorkspaceNode` | 접혀 있어도 `useProjects(ws.id)`가 실행된다(훅은 조건부일 수 없음). 워크스페이스 N개 = 요청 N개 |
| M-3 | 사이드바 버전 링크가 전부 프로젝트 개요로 | `VersionsSection` `to={base}` | 버전별 앵커·상세 URL이 없어 목록에서 특정 버전으로 못 간다 |
| M-4 | 프로덕션 설정에 dev 예외 유입 | `vercel.json` | SPA 폴백 정규식에 `src/`·`@vite`·`node_modules/` 제외 추가. `vercel dev` 전용 관심사이며 프로덕션 산출물(`/assets/*`)엔 무해하지만 설정이 오염됐다 |
| M-5 | `details.target` 새 값 미등재 | 2차 Design §6.1 | `'version'`·`'name'`이 에러 코드 표에 없다. FR-20("표가 유일한 원천")의 정신에 미달 |
| M-6 | 테이블·라우트명이 의미를 배신 | `cycles` 전반 | 모델은 D-19로 "버전"이 됐는데 테이블·라우트·파일·훅이 전부 `cycles`. UI 레이블만 "버전" → 코드와 화면의 용어가 다르다 |
| M-7 | `catppuccin.css`가 더 이상 Catppuccin이 아니다 | `src/styles/catppuccin.css` | 값이 전부 커스텀 여름 팔레트로 교체됐는데 파일명·토큰 접두(`--ctp-`)는 유지. 접두 유지는 의도적 판단(D-25)이나 파일명은 오해를 부른다 |
| M-8 | 삭제 실패가 미처리 rejection | `CycleList.handleDelete` | `deleteCycleRequest`는 실패 시 throw하는데 `await deleteMut.mutateAsync(id)`에 try/catch도 `onError`도 없다. 409/404 시 화면에 아무 메시지가 안 뜬다 |
| M-9 | dead code 2건 | `useProjects.ts`, `useWorkspaces.ts` | D-23으로 삭제 UI를 제거하면서 `useDeleteProject`·`useDeleteWorkspace`가 호출부 0건으로 남았다(실측 확인) |
| M-10 | **v0.1.2가 문서 링크 1건을 깼다** | `PDCA-workspace.plan.md:100` | `c48d434`가 `prompt.tmp`를 삭제(RULE.md의 `.tmp` 규칙상 옳음)했는데, 1차 plan §1.5의 `prompt.tmp` 상대링크(4단계 상위 참조)가 그대로 남았다. 링크 전수 검증 결과 **56건 중 유일한 깨짐**. RULE.md 사이클 종료 절차 ①("신규 깨짐 0건")을 이 릴리즈가 위반한 상태. 수정은 1차 문서를 건드리므로 Version History 행 추가가 함께 필요 |

### 3.4 관찰 (결함 아님, 기록용)

| # | 관찰 |
|---|------|
| O-1 | `cyclePath.ts`·`yearMonth.ts`에 테스트가 없다. `versionSort`만 테스트된 건 "틀리기 쉬운 곳"을 정확히 골랐다는 뜻이기도 하다(v0.1.10 함정) |
| O-2 | 마이그레이션 `0002`→`0003`이 같은 커밋에 있다 — 설계 도중 모델이 뒤집힌 화석. 사전 Design이 있었으면 `0002` 하나로 끝났을 자리 |
| O-3 | `a78f188` 단일 커밋이 24파일 변경. 리뷰 단위로 과대 |
| O-4 | **main(프로덕션) DB 마이그레이션 적용 여부 미확인.** 2차에서 정확히 이 자리가 `/api/tokens` 500을 냈다. 배포 전 필수 확인 |
| O-5 | 팔레트 교체가 CSS 1파일 + 상수 1줄로 끝났다 — 1차 §5.5 "색은 변수로만" 규약이 실제로 값을 지불한 사례 |

---

## 4. 테스트 커버리지

| 대상 | 케이스 | 상태 |
|------|:---:|:---:|
| `versionSort.parseVersion` | 3 | ✅ |
| `versionSort.compareVersions` | 4 | ✅ (v0.1.10 > v0.1.2 포함) |
| `versionSort.sortCycles` | 4 | ✅ (원본 불변 포함) |
| `cyclePath` | 0 | ❌ |
| `yearMonth` | 0 | ❌ |
| cycles 서비스·라우트 | 0 | ❌ |
| 기존(1·2차) | 35 | ✅ 무회귀 |
| **합계** | **46 통과 / 46** | — |

---

## 5. 절차 생략의 대가 — 정리

> 이 사이클의 진짜 산출물은 아래 표다.

| 대가 | 구체적 증거 | 통상 사이클이라면 |
|------|-------------|-------------------|
| **학습이 재생되지 않는다** | 2차 회고 Try 3건 전부 미적용(§2.5). `closedOn` Critical이 `name`/`yearMonth`에서 그대로 재발(C-1) | Plan §1.4가 직전 이월·Try를 읽고 배치한다 |
| **모델 전환이 코드에 화석으로 남는다** | `0002`(사이클 우선) → `0003`(버전 우선)이 같은 커밋에(O-2) | Design §3에서 모델을 확정하고 마이그레이션 1개 |
| **검증 자산이 유휴 상태로 남는다** | 2차의 실 DB 하네스 0회 사용, L1 11/11 미실행(§2.6) | Design §8 Test Plan이 실행을 강제한다 |
| **소비자를 빠뜨린다** | cycles MCP 툴 0개(I-2) | Plan Context Anchor의 WHO가 클로드를 세운다 |
| **단일 원천이 도메인 밖에서 샌다** | `ImportDialog` 3중 위반(I-3) | Design §10 Convention Reference 대조 |
| **의도 없는 교환이 일어난다** | 제목 입력란 제거로 사이드바 라벨 중복(I-5) | Design §5 UI 명세가 제목 파생 규칙을 명시 |

**반대로, 절차 없이도 지켜진 것**: 계층 구조(6/6), 보안(6/6), 회귀 안전(3/3).
공통점은 셋 다 **코드 구조나 자동 검사로 강제되는 것**이라는 점이다.
사람의 기억에 의존하던 것(회고 Try, 단일 원천, 런타임 검증)만 무너졌다.

> **결론**: PDCA는 "구조로 강제되지 않는 것"을 붙잡는 장치다. 구조가 좋으면 절차 없이도 구조는 지켜진다.
> 절차가 지키는 건 **구조가 못 지키는 나머지**다.

---

## 6. 권장 조치

### 6.1 Critical (1) — 즉시

| # | 조치 | 규모 |
|---|------|:---:|
| C-1 | `name`·`yearMonth`를 `.nullable()`로, `toggleLink(false)`가 `null` 세팅, 서버가 `null`을 해제로 해석 | 5줄 내외 + 테스트 |

### 6.2 Important (5)

| # | 조치 | 규모 |
|---|------|:---:|
| I-1 | `updateCycleSchema`에 pair rule 적용(병합 상태 기준 재검증) | 소 |
| I-4 | cycles L1 하네스 11 시나리오 작성·실행 (C-1·I-1 회귀 테스트 포함) | 중 |
| I-5 | pdca 생성 시 제목을 `{name} {stage}`로 파생 (또는 트리 라벨을 파일명 기준으로) | 소 |
| I-3 | `ImportDialog`가 `cycleStagePath`·`yearMonth.ts`·`cycleNameSchema`를 재사용하도록 정리 | 소~중 |
| I-2 | `cycle_list`·`cycle_read` MCP 툴 추가 (입력 스키마는 `shared/schema.ts` 재사용 = 2차 Try D2 동시 이행) | 중 |

### 6.3 Minor (9) — 백로그

M-1 ~ M-10. 개별 규모는 전부 소. M-8(미처리 rejection)·M-9(dead code)는 I-3 정리 시 함께 처리 가능.
**M-10(깨진 링크)은 사이클 종료 절차의 관문이므로 docs 커밋 전에 처리해야 한다.**

### 6.4 절차 조치 (이 사이클의 본질적 산출)

| # | 조치 |
|---|------|
| P-1 | **직전 사이클 회고 Try를 다음 Plan에 기계적으로 옮겨 적는 칸을 만든다.** Try가 Plan에 안 실리면 재생되지 않는다는 게 §2.5로 실증됐다 |
| P-2 | **zod 스키마 작성 시 필드별 "지울 수 있는가"를 Design 표에 필수 열로 둔다.** 2차 Try D1을 규약으로 승격 |
| P-3 | **Design §8 Test Plan의 L1 시나리오를 DoD 체크박스로 승격**한다. "작성"이 아니라 "실행"이 기준 |
| P-4 | 릴리즈노트·git tag·report §9 Changelog의 버전 표기를 하나로 맞춘다(2차 report는 `v0.2.0`, 태그는 `v0.1.1`로 어긋나 있다). **이번 사이클이 만든 `cycles.version`이 그 단일 원천 후보다** |

---

## 7. Checkpoint 5 — 형 결정 (사후)

> 통상 Checkpoint 5는 "지금 수정 / Critical만 / 그대로 진행" 3택이다. 이미 태그가 나간 뒤이므로 아래로 대체한다.

| 선택지 | 내용 |
|--------|------|
| **A** | C-1 + I-1 + I-5를 지금 고치고 `v0.1.3`으로 낸다 (전부 소규모, 사용자 체감 결함) |
| **B** | 위 3건 + I-4(L1 하네스)까지 묶어 다음 사이클(`refine-mcp-hardening`과 병합 가능)에서 처리 |
| **C** | 전부 백로그로 이월하고 실사용하며 판단 (2차와 같은 선택 — 단, 2차의 그 선택이 C-1 재발로 이어졌다) |

> 분석자 의견: **B**. C-1·I-1은 하네스(I-4) 없이 고치면 "고쳤다고 믿는" 상태로 또 남는다.
> 그리고 이미 열려 있는 `refine-mcp-hardening` plan의 이월 6건과 성격이 같으므로 한 사이클로 묶는 게 자연스럽다.

---

## Version History

| 버전 | 날짜 | 변경 내용 | 작성자 |
|------|------|-----------|--------|
| 0.1 | 2026-08-08 | 사후 규약 준수 분석 최초 작성. §1.2에서 통상 Gap Analysis가 불가능한 이유를 논증하고 기준선을 3원천으로 재정의. 종합 50%(A 100 / B 71 / C 40 / D 0 / E 0 / F 100). Critical 1(C-1 사이클 연결 해제 불가 — 2차 `closedOn` 재발)·Important 5·Minor 10·관찰 5 검출. §5에 절차 생략의 대가를 6항목으로 정리 | cogmo |
| 0.2 | 2026-08-08 | 링크 전수 검증(56건) 결과 반영 — `c48d434`의 `prompt.tmp` 삭제로 1차 plan §1.5 링크가 깨진 것을 M-10으로 추가. Minor 9 → 10 | cogmo |
