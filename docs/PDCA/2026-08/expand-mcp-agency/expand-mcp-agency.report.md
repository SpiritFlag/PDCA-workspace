---
template: report
version: 1.1
---

# expand-mcp-agency 완료 보고서

> **상태**: 완료 (Match Rate 97%, Success Criteria 5/5 — 이월 없음)
>
> **프로젝트**: PDCA-workspace
> **작성자**: cogmo
> **완료일**: 2026-08-09
> **PDCA Cycle**: expand-mcp-agency (문서화 기준 6번째 사이클)

---

## Executive Summary

### 1.1 프로젝트 개요

| 항목 | 내용 |
|------|------|
| 기능 | 클로드(MCP)의 작업 반경 확장. 4·5차와 달리 **마감이 아닌 기능 사이클**(Match Rate로 판정 복귀, D-40) |
| 시작일 | 2026-08-09 (Plan) |
| 종료일 | 2026-08-09 (Report) |
| 소요 | 단일 세션 연속(Plan→Design→Do×3모듈→형 배포·실증→Check→Report), dev DB 하네스 + 프로덕션 웹 커넥터 실증 병행 |

### 1.2 결과 요약

```
┌─────────────────────────────────────────────┐
│  Overall Match Rate: 97%                     │
│  Structural 100% · Functional 95%            │
│  Contract 92% · Runtime 100%                 │
├─────────────────────────────────────────────┤
│  ✅ Success Criteria: 5/5                     │
│  Critical 0 · Important 0 · Minor 2(백로그)   │
└─────────────────────────────────────────────┘
```

**Match Rate로 돌아간 이유**: 1~3차와 같은 성격의 기능 사이클이다 — 4·5차는 이미 확정된 이월
항목을 실측/실증으로 "닫는" 마감이라 Scope Closure Rate가 맞았지만, 이번은 새 권한 경계·새
상수·새 툴 2개를 **설계하고 구현**했다. Design 대 구현의 구조적 일치율 산식이 그대로 성립해
Plan D-40이 이 산식을 미리 못박았다(analysis §1).

### 1.3 실현된 가치

| 관점 | 내용 |
|------|------|
| **Problem** | 2차 Q10b 경계("클로드는 해소·삭제만")가 실사용 비용을 냈다 — 5차 사이클 완주 시 형이 완료 항목 7건을 UI에서 하나씩 손으로 전환해야 했다. 권한을 열려면 "완료(done)"·"해소(resolved)"의 의미가 코드 어디에도 없다는 문제가 같이 걸렸고, cycles 도메인은 MCP 툴이 0개라 클로드가 릴리즈 이력을 읽을 수단 자체가 없었다(3차부터 3회 이월된 I-2) |
| **Solution** | 축을 `shared/transition.ts` 하나로 수렴시켰다 — `MCP_ALLOWED_TARGETS`(허용 집합 export, 목적지가 전 상태−`todo`로 확대)와 `STATUS_MEANING`(형이 확정한 5키 의미 문안)을 신설해, MCP 툴 description·서비스 거부 메시지·UI 툴팁 3소비자가 전부 이 두 상수를 참조하게 했다. cycles는 읽기 전용 2툴(`cycle_list`·`cycle_read`)만 신설하고 쓰기는 의도적으로 0건— "한 사이클에 경계는 하나만 옮긴다"는 원칙. 5차가 남긴 L1 하네스 골격을 `server/l1-harness.ts`로 추출해 공유하고, 그 위에서 MCP 경로(`app.request()` JSON-RPC)까지 검증했다 |
| **Function/UX Effect** | 형이 클로드에게 "이 항목 완료로 바꿔줘"라고 시키면 클로드가 웹 커넥터로 실제 `done` 전환에 성공한다(전엔 거부됐다). "다시 대기로 되돌려줘"는 여전히 거부되고 클로드가 그 이유를 형에게 그대로 전달한다. "의도해서 고친 것"과 "우연히 같이 해결된 것"을 각각 시키면 `done`과 `resolved`로 정확히 갈라 찍는다. "릴리즈노트 읽고 요약해줘"가 `cycle_read` 실호출로 성공한다 |
| **Core Value** | **"경계를 옮기려면 그 자리에 새 경계를 그려야 한다."** 2차의 Core Value("판단은 클로드가, 결정은 형이")는 폐기된 게 아니라 다시 그어졌다 — 완료 판정은 사실 확인이라 클로드에게 넘겼고, 닫힌 판정을 무르는 것(재개·재작업, `todo` 복귀)과 파괴적 행위(hard delete)는 결정이라 형이 계속 쥔다. 이 사이클의 산출물은 코드 3덩이가 아니라 **그 새 경계선 자체**다 |

---

## 1.4 Success Criteria 최종 상태

| # | 기준 | 상태 | 근거 |
|---|------|:---:|------|
| C21 | S1 권한 확대 3종 실증(하네스 성공+웹 커넥터 완료 전환+되돌리기 거부·전달) | ✅ Met | 하네스 m1·m2 + 형이 웹 커넥터로 "완료로 바꿔줘"→성공, "다시 대기로"→거부+전달 확인. 거부의 실제 형태가 Design 예측(서비스 메시지)과 달리 zod 스키마 거부였음이 실행 중 확인됨(analysis GAP-1) — 형 결정으로 "현 구조 유지" |
| C22 | S2 정의가 실제로 판단을 바꾼다(grep 단일원천+갈라찍기+툴팁) | ✅ Met | grep 전수 1곳 + 형이 "의도한 완료"·"우연한 해소" 두 항목을 각각 시켜 클로드가 `done`/`resolved`로 정확히 구분 + 브라우저 배지 툴팁 확인 |
| C23 | S3 cycles 읽기 실증(하네스+웹 커넥터+tools/list 10개) | ✅ Met | 하네스 m9~m12 green + 형이 "릴리즈노트 읽고 요약해줘"→`cycle_read` 성공 + `tools/list` 10개(단 캐시된 8개가 먼저 보였고 재연결로 갱신 — Design §9.1이 미리 지목했던 항목) |
| C24 | S4 하네스 재사용 결과 기록(5차 RK-27 채점) | ✅ Met | 골격을 `l1-harness.ts`로 추출해 `cycles.l1.ts`·`mcp.l1.ts` 공유, 추출 후 cycles 15/15 무회귀. 5차 §7.2의 "import해서 쓰라"가 실물(export 0건)과 어긋나 있었다는 게 비용 기록의 핵심(§6.3 5T-1 회신) |
| C25 | S5 `backlog_reorder` 실행 확인 | ✅ Met | 하네스 m8 + 형이 웹 커넥터로 재배열 실호출 |

**Success Rate: 5/5 완전 충족.** Critical·Important 이월 0건.

## 1.5 Decision Record 요약

| 출처 | 결정 | 준수 | 결과 |
|------|:---:|:---:|------|
| [Plan] D-40 | 판정 산식 = Match Rate(4·5차 Scope Closure Rate 아님) | ✅ | analysis §1이 이 산식으로 97% 산출 |
| [Plan] D-42(형 승인 A1) | 잔여 경계 = `todo` 복귀만 형 전용 | ✅ | 5차 A1과 반대로, 이번엔 형이 Plan 권고를 **그대로 승인**(v0.2, 3건 전건 동의) |
| [Plan] D-43 | hard delete·workspace/project create·update 미노출 불변 | ✅ | `tools/list` 10개, delete 계열 0(m7 실증) |
| [Plan] D-44 | zod enum을 `MCP_ALLOWED_TARGETS`에서 파생(1·2차 방어 집합 단일화) | ✅ | **의도한 결과가 그대로 실현** — 그 결과 `to='todo'`는 1차에서 걸려 2차엔 도달 못함이 밝혀짐(GAP-1) |
| [Plan] D-45(형 승인 A3) | `STATUS_MEANING`을 `shared/transition.ts`에 | ✅ | `labels.ts`는 표시명 전용으로 역할 축소 |
| [Plan] D-46(형 승인 A2) | cycles 쓰기 툴 0건 | ✅ | 읽기 2개만. RULE.md 종료 절차 개정(릴리즈를 MCP로 생성)으로 이 결정이 **다시 시험대에 올랐으나** 형이 재확인 — 이번은 브라우저로, `cycle_create` 신설은 다음 사이클 |
| [Design] CK3-1 | `STATUS_MEANING` 문안(형 확정, `resolved`에 "또는 필요가 없어짐") | ✅ | 코드에 문안 그대로 |
| [Design] CK3-2 | 거부 메시지 A안 | ✅(도달조건 정정) | MCP 경로에선 미도달, 코드엔 정확히 존재(GAP-1) |
| [Design] D-48 | 하네스 골격 `l1-harness.ts` 추출 | ✅ | F46 실측(5차 export 0건) 후 실행 |
| [실행 중 발견] | `.l1.ts` 파일 2개 → vitest 파일 간 병렬 실행이 실 DB 경합 | — | Design에 없던 리스크. module-1에서 `fileParallelism: false`로 해소 |
| [실행 중 발견] | RULE.md 종료 절차가 세션 밖에서 두 차례 개정됨(링크검증 삭제, MCP 릴리즈 생성 신설, "종료 절차를 문서에 TODO로 남기지 않는다" 원칙 신설) | — | 형과 논의해 "이번은 브라우저, `cycle_create` 툴은 다음 사이클"로 확정. 이 report도 그 신설 원칙에 맞춰 종료 절차 TODO 나열을 걷어냈다 |

---

## 2. 관련 문서

| 단계 | 문서 | 상태 |
|------|------|:---:|
| Plan | [expand-mcp-agency.plan.md](./expand-mcp-agency.plan.md) | ✅ (v0.2, 형 승인 3건 전건 동의) |
| Design | [expand-mcp-agency.design.md](./expand-mcp-agency.design.md) | ✅ (v0.1, §6.2 검증 6건 실측 + Checkpoint 3 문안 2건 확정) |
| Check | [expand-mcp-agency.analysis.md](./expand-mcp-agency.analysis.md) | ✅ |
| Report | 현재 문서 | ✅ |
| 권한 경계 원천(2차) | [backlog-with-mcp.report.md](../backlog-with-mcp/backlog-with-mcp.report.md) — 이번에 §1.4·§7.5·§7.6·design §2.2·§3.3·§4.4·§6.1·§8.2·§8.3 사후 개정(9곳+2 부수 발견) | 개정 반영 |
| I-2 이월 원천(3차) | [cycle-release-note.analysis.md](../cycle-release-note/cycle-release-note.analysis.md) | 참조만 |
| 하네스 자산 원천(5차) | [refine-cycles-hardening.report.md](../refine-cycles-hardening/refine-cycles-hardening.report.md) §6.3 5T-1 | 이번 report §6.3에서 회신 |

---

## 3. 완료 항목

### 3.1 스코프 5건(Plan §2.1, FR-54~74)

| 범위 | 상태 | 비고 |
|------|:---:|------|
| S1 MCP 상태 권한 확대(FR-54~59) | ✅ 완료 | `MCP_ALLOWED_TARGETS` 4값+export, zod 파생, 거부 메시지(CK3-2), L0 T2·T3 반전+T9·T10, hard delete 불변 |
| S2 "해소/완료" 의미 명문화(FR-60~63) | ✅ 완료 | `STATUS_MEANING`(CK3-1) 신설, 툴 description 조립, `ItemDialog` 툴팁, `labels.ts` 역할 축소 |
| S3 cycles MCP 읽기 툴(FR-64~68) | ✅ 완료 | `cycle_list`·`cycle_read` 신설, `getCycleByVersion` 서비스 함수, D-52 응답 성형 |
| S4 하네스 재사용 확인(FR-69~73) | ✅ 완료 | `l1-harness.ts` 추출, cycles 15/15 무회귀, `mcp.l1.ts` 신설(m1~m13) |
| S5 `backlog_reorder` 실행 확인(FR-74) | ✅ 완료 | 하네스 m8 + 웹 커넥터 실호출 |

### 3.2 비기능 요구사항

| 항목 | 목표 | 달성 | 상태 |
|------|------|------|:---:|
| 무회귀(L0) | 5차 54건 유지 + 신규분만 증가 | 57건(T9·T10·T11 신규) | ✅ |
| 무회귀(L1 cycles) | 5차 15/15 유지 | 15/15(골격 추출 후) | ✅ |
| 무회귀(REST) | `actor='user'` 경로 무변화 | m6 실증 + `git diff server/routes/` 0줄 | ✅ |
| 심층 방어 단일화 | 1·2차 방어 허용 집합 구조적 일치 | `MCP_ALLOWED_TARGETS` 파생(D-44) | ✅ |
| 타입 안전성 | `tsc -b` 클린 | 통과 | ✅ |
| 자산 | 하네스가 다음 사이클에서도 확장 가능 | `l1-harness.ts` 헤더 주석 + MCP 헬퍼(`rpc`·`callTool`) | ✅ |
| 문서 | 2차 문서 9곳 사후 개정 누락 0 | grep 4키워드 재확인 완료(+2 부수 발견도 정정) | ✅ |

### 3.3 산출물

| 산출물 | 위치 | 상태 |
|--------|------|:---:|
| 허용 집합 export + 의미 상수 신설 | `shared/transition.ts` | ✅ |
| L0 T9~T11 + T2·T3 반전 | `shared/transition.test.ts`(57/57 통과) | ✅ |
| MCP 툴 확장(8→10) | `server/mcp/tools.ts` | ✅ |
| 거부 메시지 CK3-2 | `server/services/backlog.ts` | ✅ |
| cycles 단건 조회 서비스 | `server/services/cycles.ts` | ✅ |
| L1 하네스 골격(신규, 공유 자산) | `server/l1-harness.ts` | ✅ |
| MCP L1 시나리오(신규, m1~m13) | `server/mcp.l1.ts` | ✅ |
| cycles L1(골격 import로 전환) | `server/cycles.l1.ts` | ✅ |
| vitest 파일 병렬 경합 해소 | `vitest.l1.config.ts`(`fileParallelism: false`) | ✅ |
| 배지 툴팁 | `src/features/backlog/components/ItemDialog.tsx` | ✅ |
| 표시명 역할 축소 주석 | `src/features/backlog/lib/labels.ts` | ✅ |
| 2차 사이클 문서 사후 개정(9곳+2) | `backlog-with-mcp.{plan,design}.md` | ✅ |
| 커밋 | `e808160`(module-1 하네스), `4447a42`(module-2 S1+S2), `45b38c9`(module-3 S3) | ✅ |
| 배포 | `git push origin main`(`a87b5ea..45b38c9`) — 클로드가 실행(형 승인) | ✅ |

---

## 4. 미완료 항목

### 4.1 다음 사이클 재이월 (Plan §2.2 + 이번에 발견된 신규 1건)

| 항목 | 사유 | 우선순위 |
|------|------|:---:|
| **`cycle_create`/`cycle_update` MCP 툴 신설** | 이번엔 D-46으로 0건 확정. **RULE.md 종료 절차 개정(릴리즈를 MCP로 생성)으로 필요성이 앞당겨짐** — 착수 시 5차 D-34 조건부 지시 그대로 적용: `name`/`yearMonth`의 `null` 허용 여부를 4차 D-21 형식으로 명시 결정 + `shared/schema.ts`(`cycleFields`·`cyclePairRule`) 재사용 | **높음**(RULE.md가 이 툴의 존재를 전제하기 시작함) |
| I-3 `ImportDialog` 단일 원천 정리 | 축이 다름(DRY). M-8·M-9와 함께 처리 권장 | 중 |
| I-5 문서 제목 파생 규칙 | UI 식별성 문제 | 중 |
| M-1~M-9 | 전부 Minor | 낮음 |
| `cycles` → `releases` 리네임 | 이번에 cycles 툴을 신설했으니 신설 직후 개명은 낭비 — 이후가 맞음 | 낮음 |
| RULE.md·템플릿의 P-1~P-3 정식 개정 | 3연속 적용(3·5·6차) 근거 누적, 승격 판단은 형 몫 | 중 |
| P-5(릴리즈 버전 표기 단일 원천화) | 문서 프로세스 개정, 층이 다름 | 낮음 |
| OAuth 2.1 정식 지원 | 형 보류 유지 | 낮음 |
| 1차 사이클 기존 깨진 링크 11건 | 무관 파일 | 낮음 |
| M-10(analysis) Design §8.3 m5 표 문구 정정 | 실물(zod 거부)과 다른 문구가 Design에 남아있음 | 낮음 |
| M-11(analysis) `callTool` 반환 타입에 `httpStatus` 추가 | Design §8.4 스펙보다 확장됨, 기능 영향 없음 | 낮음 |

### 4.2 취소/보류 항목

없음.

---

## 5. 품질 지표

### 5.1 최종 결과

| 지표 | 목표 | 최종 | 비고 |
|------|------|------|------|
| Overall Match Rate | — | 97% | Structural 100·Functional 95·Contract 92·Runtime 100 |
| L0 단위 테스트 | 통과 | 57/57 | 5차 54 + 이번 T9·T10·T11 |
| L1 하네스(cycles) | 무회귀 | 15/15 | 골격 추출 후에도 재건축 0 |
| L1 하네스(mcp, 신규) | 전건 통과 | 13/13 | m1~m13 |
| L2 브라우저 확인 | 통과 | ✅ | 완료 섹션 반영 + 배지 툴팁(형 직접) |
| L3 웹 커넥터 실사용 | 5건 성공 | ✅ 5/5 | §8.6(Design) 전건(형 직접) |
| 타입·린트 | 통과 | `tsc -b`·`oxlint` 그린 | |
| dev DB 잔여 데이터 | 0건 | 0건 | `hns-%` 쿼리 재확인 |
| skip 가드 | 정상 | ✅ | `DATABASE_URL` 없으면 28건 skip |

### 5.2 해소된 이슈 (analysis GAP 4건)

| 이슈 | 해소 방법 | 발견 시점 |
|------|-----------|:---:|
| Design §8.3 m5 예측(서비스 TRANSITION_DENIED)이 실물(zod 스키마 거부)과 다름 | 형과 논의 후 "현 구조 유지" 결정, `mcp.l1.ts` 테스트를 실물 기준으로 수정 + 2차 design의 "심층 방어 2층" 서술도 사후 정정 | module-2 구현 중 |
| `tools/list` 캐싱(웹 커넥터 재연결 필요) | Design §9.1이 미리 예견 — 재연결로 해소, 관찰 기록 | module-4(형 실증) |
| `.l1.ts` 파일 2개 → vitest 파일 병렬 실행이 실 DB에서 경합 | `vitest.l1.config.ts`에 `fileParallelism: false` | module-1 |
| 2차 문서 사후 개정 체크리스트 자체의 누락 2곳 | grep 재확인으로 발견·정정 | module-4 |

---

## 6. 회고

### 6.1 잘된 것 (Keep)

- **"한 사이클에 경계는 하나만 옮긴다"는 원칙(D-46)이 실제로 스코프를 지켰다.** cycles 쓰기
  툴을 이번에 같이 만들었다면 RULE.md의 "MCP로 릴리즈 생성" 신설과 맞물려 정확히 그 자리에서
  검증 없이 급조하게 됐을 것이다 — Q16 결정이 report 단계에서 그 유혹을 실제로 막아냈다.
- **D-44(1·2차 방어 집합 단일화)가 의도한 대로 작동했고, 그 부작용(GAP-1)을 숨기지 않고
  기록했다.** "2차 방어가 MCP 경로에서 도달 불가능하다"는 사실이 이번 사이클이 만든 문제가
  아니라 **2차부터 있었던 구조적 특성**임을 발견해 원 사이클 문서까지 정정한 게, 5차의
  "실행해야 보이는 것" 교훈을 한 단계 더 밀어붙인 사례다.
- **형 승인이 Plan 권고를 그대로 확정한 첫 사이클이다(5차 A1과 대칭).** 5차는 형의 반론이
  Plan을 뒤집는 게 옳았던 사례였고, 이번은 Plan의 논증(F41 자료구조 근거 + 의미 근거 이중
  정합)이 그대로 받아들여진 사례다 — 두 경우 다 "형이 매번 클로드를 그냥 승인하지 않는다"는
  걸 보여준다.
- **웹 커넥터 실증을 형의 구간으로 명확히 분리한 게(4T-1) 세션 낭비를 줄였다.** module-4를
  통째로 형에게 넘기고 클로드는 그동안 문서 정정을 진행해, 대기 시간이 0에 가까웠다.

### 6.2 개선이 필요한 것 (Problem)

- **RULE.md가 세션 밖에서 바뀌는 걸 사전에 감지할 방법이 없었다.** report 작성 중에만
  **두 차례** 개정을 뒤늦게 발견했다 — 1차는 `git status`로 우연히(링크검증 삭제·MCP 릴리즈
  생성 신설), 2차는 형이 직접 IDE에서 열어 보여줘서(종료 절차를 문서에 TODO로 남기지 않는다는
  원칙 신설, 릴리즈 노트 공란·태그 전 확인 세부사항 추가). 매번 이미 써놓은 report 문구를
  거슬러 올라가 고쳐야 했다 — 더 일찍(예: 사이클 시작 시점) 확인했다면 이 왕복이 줄었을 것이다.
- **Design이 실행 세부사항(m5의 정확한 에러 형태)을 문서만으로 예측하는 데 한계가 있다는 게
  또 확인됐다.** V1~V6 검증을 그렇게 꼼꼼히 했는데도, `MCP_ALLOWED_TARGETS`와 zod enum의
  집합 동치가 만드는 "2차 방어 도달 불가능"이라는 **논리적 귀결**은 실행 전엔 안 보였다.
  이건 4·5차가 지적한 "시나리오 간 상호작용"과는 다른 종류의 맹점 — **한 결정(D-44)의
  파생 효과를 그 결정을 내리는 시점에 끝까지 추적하지 못한 것**이다.

### 6.3 다음에 시도할 것 (Try)

1. **[다음 Plan §1.4 필수 항목] 5T-1 회신**: 이 사이클의 하네스(`server/l1-harness.ts`)를
   다음 사이클이 재사용했는지 확인한다. 5차 report §7.2가 "import해서 쓰라"고 적었지만 실물이
   그렇지 않았던 것(F46)을 이번이 고쳤다 — 다음 사이클이 실제로 import해서 쓰는지가 그 교훈이
   자리잡았는지의 채점표다.
2. **`cycle_create` MCP 툴 착수 시 5차 D-34 조건부 지시를 그대로 적용한다.** null 허용 여부를
   4차 D-21 형식으로 결정하고 `cycleFields`/`cyclePairRule`을 재사용 — 이번 RULE.md 개정이
   그 착수 시점을 앞당겼다는 것도 함께 기록한다.
3. **결정(Decision)을 Design에 적을 때 "이 결정이 다른 어디에 파생 효과를 내는가"를 한 줄
   덧붙이는 걸 시도한다.** D-44를 적을 때 "1·2차 방어 집합 일치"까지만 적었지, "그럼 2차
   방어가 실제로 트리거되는 경우가 있는가"는 실행 전엔 안 물었다 — 이 질문 형식을 다음 Design
   Decision Record 표에 열로 추가해볼 것을 제안한다.
4. **RULE.md 변경 감지를 사이클 첫머리(Plan 착수 전) 루틴에 넣는 것을 검토한다.** `git log
   -1 -- docs/RULE.md`를 Plan 시작 시 확인하는 습관화 — 이번처럼 report 직전에 발견하면
   대응 여유가 줄어든다.

---

## 7. 프로세스 개선 제안

### 7.1 PDCA 프로세스

| 단계 | 현재 | 개선 제안 |
|------|------|-----------|
| Plan 착수 | RULE.md 변경 여부를 확인하지 않음 | `git log -1 -- docs/RULE.md` 확인을 Plan 첫 실측 항목에 넣을지 검토(Try 4) |
| Design Decision Record | 결정 + 근거만 기록 | "파생 효과" 열 추가 검토(Try 3) |
| 사이클 종료 | RULE.md 신 절차가 아직 없는 MCP 툴(`cycle_create`)을 전제 | 절차와 실제 툴 존재 여부의 정합을 다음 사이클 Plan에서 재확인 |
| report 문서 형식 | (이번에 형이 직접 확정) 종료 절차를 report에 TODO 체크박스로 반복 기록하던 4~6차 관례 | **이번 사이클부터 폐지**(RULE.md 종료 절차 0) — 실행은 RULE.md 원문만 참조. report는 "무엇을 결정했는지"만 서술형으로 남긴다(§1.5·§4.1) |

### 7.2 도구/환경

| 영역 | 개선 제안 | 기대 효과 |
|------|-----------|-----------|
| L1 하네스 | `l1-harness.ts`가 실제로 다음 사이클의 확장 지점이 되는지가 5T-1의 진짜 채점표 | RK-27류 부채의 재발 방지 |
| MCP 검증 | `rpc`/`callTool` 헬퍼가 자리잡아 3번째 MCP L1 재건축(RK-32)이 이번에 종결됐다 — 다음 도메인(예: `cycle_create`)의 L1도 이 헬퍼로 바로 시작 가능 | 재건축 비용 0 |

---

## 8. 다음 단계

> 사이클 종료 절차 자체는 이 문서에 TODO로 나열하지 않는다(RULE.md 종료 절차 0) — 실행은
> `docs/RULE.md`의 사이클 종료 절차를 그때그때 따른다.

### 8.1 다음 사이클 후보

| 항목 | 우선순위 | 비고 |
|------|:---:|------|
| **`cycle_create`/`cycle_update` MCP 툴** | **높음** | RULE.md 개정이 필요성을 앞당김. 5차 D-34 조건부 지시 적용 |
| **PDCA 문서 → PDCA-workspace docs MCP 반영 스크립트화** | 중 | RULE.md 종료 절차 4번("docs 문서 반영")이 매 사이클 수동 `document_write` 호출을 요구한다 — 이번엔 형이 수동으로 진행(2026-08-09). 경로 규칙(`docs/PDCA/2026-08/{feature}/{feature}.{stage}.md`, title=feature명)은 이미 기존 문서로 확인됨. 스크립트/헬퍼화 검토 |
| **5T-1 회신 확인**(하네스 재사용) | 높음 | 다음 Plan §1.4 표에 필수 포함 |
| I-3 `ImportDialog` 단일 원천 정리 | 중 | M-8·M-9 동시 처리 |
| I-5 문서 제목 파생 규칙 | 중 | |
| RULE.md·템플릿 P-1~P-3 정식 개정 | 중 | 3연속 적용 근거 누적 |
| `cycles` → `releases` 리네임 | 낮음 | 이번 툴 신설 직후라 미룸 |
| M-1~M-9, M-10·M-11(analysis) | 낮음 | 전부 Minor |

---

## 9. Changelog

### v0.1.5(가안) — 버전 확정은 RULE.md 종료 절차대로 진행

**Added:**
- MCP 백로그 상태 권한을 `doing`·`done`까지 확대(2차 Q10b/D-13 개정) — `todo` 복귀는 형 전용으로 유지
- `STATUS_MEANING` 상수 — "완료/해소"의 의미를 코드에 명문화, 툴 description·UI 툴팁이 공유
- cycles MCP 읽기 툴 `cycle_list`·`cycle_read` 신설(쓰기는 의도적으로 0건)
- L1 하네스 공유 골격(`server/l1-harness.ts`) — MCP JSON-RPC 헬퍼(`rpc`·`callTool`) 포함
- MCP L1 시나리오 하네스(`server/mcp.l1.ts`, 13 시나리오)

**Fixed:**
- `.l1.ts` 파일이 2개가 되며 발생한 vitest 파일 간 실 DB 경합(`fileParallelism: false`)

**Docs:**
- 2차 사이클(backlog-with-mcp) plan·design 사후 개정 9곳+2 — Q10b 권한 경계 개정 반영

---

## Version History

| 버전 | 날짜 | 변경 내용 | 작성자 |
|------|------|-----------|--------|
| 0.1 | 2026-08-09 | 완료 보고서 최초 작성. Overall Match Rate 97%, Success Rate 5/5 — 이월 없음. `_INDEX.md` 행 추가 완료. RULE.md 종료 절차가 세션 밖에서 개정된 것을 발견 — 형과 논의해 "이번 릴리즈는 브라우저로 생성, `cycle_create` MCP 툴은 다음 사이클 후보"로 확정(§4.1 재이월 표) | cogmo |
| 0.2 | 2026-08-09 | RULE.md가 재차 개정된 것을 형이 직접 확인시켜줌 — **종료 절차 규칙 0("PDCA 문서에 종료 절차를 TODO로 기록하지 않는다")** 신설을 반영해 §4.2(확인 필요)·§8.1(즉시) 두 섹션의 TODO 체크박스 나열을 삭제. 해당 정보는 §1.5·§4.1·§6에 서술형으로만 남기고, 실행 자체는 RULE.md를 그때그때 참조하는 방식으로 전환 | cogmo |
