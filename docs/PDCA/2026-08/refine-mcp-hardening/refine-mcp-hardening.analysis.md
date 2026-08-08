---
template: analysis
version: 1.3
---

# refine-mcp-hardening 분석 문서

> **분석 유형**: Scope Closure Verification — Plan §4.1 DoD·RK-18에 따라 **스코프 6건(S1~S6)이
> 실측/실증으로 닫혔는지만** 본다. gap-detector 전면 정적 스캔은 이번 사이클 목적과 맞지 않아
> 생략하고(RK-16·RK-18), 대신 Design §8이 정의한 시나리오를 전부 실행한 뒤 diff를 직접
> 재검토했다.
> **프로젝트**: PDCA-workspace
> **작성자**: cogmo
> **작성일**: 2026-08-08
> **Plan 문서**: [refine-mcp-hardening.plan.md](./refine-mcp-hardening.plan.md)
> **Design 문서**: [refine-mcp-hardening.design.md](./refine-mcp-hardening.design.md)

---

## Context Anchor

> Design에서 복사.

| Key | Value |
|-----|-------|
| **WHY** | 2차 사이클이 실사용 검증을 조건으로 열어둔 이월 6건이 지금 실사용에서 실제로 걸린다. 문서·코드·표가 각각 한 군데씩 어긋난 상태를 다음 사이클로 또 넘기면 원칙이 관행으로 무너진다. |
| **WHO** | 형(cogmo) — 브라우저 실사용자이자 승인자 / **클로드 2종**: Claude Code CLI(코드 작업)와 claude.ai 웹 MCP 커넥터(백로그·문서 운용). C7·C10·C14 실사용 확인 전부 웹 커넥터로 달성. |
| **RISK** | zod null 허용의 타입 파급 3소비처(RK-10) / MCP 스키마 조임이 실사용 호출을 거부(RK-14) / 종료 사이클 문서 사후 개정의 기록 오염(RK-15) / design 전면 재동기화로 스코프 번짐(RK-16). |
| **SUCCESS** | C11~C16 — 스코프 6건과 1:1. |
| **SCOPE** | 이월 6건 고정(S1~S6). |

---

## Strategic Alignment Check

### Plan Core Value 정합

| Plan 요소 | 기대 | 구현 상태 |
|-----------|------|:---------:|
| Problem(WHY) — 이월 6건이 실사용에서 실제로 걸림 | 6건 전부 실측으로 닫힘 | ✅ S1~S6 전 항목 완료 |
| Solution — 검증 계층까지 단일 원천(Design §1.1 목표 1) | `shared/schema.ts` 필드 스키마를 MCP 8툴이 재사용 | ✅ §1.3.1 갭 16곳 전수 폐쇄(§2.4) |
| Core Value — "거의 지켜지는 원칙은 원칙이 아니다" | 2차 회고 Try 3건을 규약(Design §10)으로 승격 | ✅ §10 코딩 컨벤션에 3개 규칙 반영. 다음 사이클부터 적용 대상 |

### Success Criteria 상태 (Plan §4)

| # | 기준 | 상태 | 근거 |
|---|------|:---:|------|
| **C11** | 처리일 삭제 3단계 실증(세팅→null→재조회) + 브라우저 확인 | ✅ Met | API: 하네스 r1·r2·r3(§2.1). 브라우저: 형이 ✕ 버튼 직접 클릭·저장·재확인("✕ 잘 작동해") |
| **C12** | Origin 위반 403 + `{"code":"FORBIDDEN"}`, 표 정합 | ✅ Met | 하네스 r4(§2.1) + §6.1 3중 대조(§2.5) — `errors.ts` 7코드 == 2차 design §6.1 표 7코드 |
| **C13** | `?token=` 로그 잔존 여부 확정 기록 + 완화 결정 | ✅ Met | 형이 프로덕션에서 직접 실측 — **잔존함**(평문). 완화: OAuth 2.1 승격 근거로 기록만(형 결정, 코드 변경 0) — Design §7.1.1 |
| **C14** | 갭 16곳 폐쇄 + 웹 커넥터 실사용 무회귀 | ✅ Met | 정적: §2.4 대조표 갭 0. API: 하네스 r5~r7. **실사용**: 형이 웹 커넥터로 4건 호출 — 정상 생성/수정 성공, 불량 포맷은 `YYYY-MM-DD 형식이어야 합니다 at openedOn`으로 명시 거부(500 아님) |
| **C15** | design §6.3 정정 + 배포 체크리스트(dev·main+미적용 시 증상) | ✅ Met | §6.3 D-25 형식 정정 완료. `docs/deploy/CHECKLIST.md` 신설 — §1에 2차 실사례(main 마이그레이션 미적용→`/api/tokens` 500) 포함 |
| **C16** | 2차 report·analysis·`_INDEX.md`에서 C7·C10 정정 + Version History | ✅ Met | 3문서 전부 D-25 형식(원문 유지+사후 표기)으로 정정, 각 Version History 행 추가(§2.6) |

**Success Rate: 6/6 완전 충족.** 전부 "고쳤다"가 아니라 실측(API 하네스 36/36 + 브라우저 확인 +
웹 커넥터 실사용 4건 + 프로덕션 로그 실측 1건)으로 닫힌 것을 Plan C11~C16의 판정 기준
("실증으로 닫혔는지") 그대로 적용해 확인했다.

### Decision Record Verification

| 출처 | 결정 | 준수 여부 | 근거 |
|------|------|:---:|------|
| [Design] D-20 | `closedOn.nullable().optional()` | ✅ | `shared/schema.ts` — L0 t1~t3 통과 |
| [Design] D-21 | MCP `closedOn`은 null 배제 | ✅ | `tools.ts` backlog_update가 `dateStringSchema.optional()`(non-nullable) 유지 + 사유 주석. 하네스 r6로 raw null 거부 실증 |
| [Design] D-22 | 재오픈 시 처리일 자동 삭제 안 함 | ✅ | `handleStatusClick` 무변경 확인(diff에 로직 변경 없음, 주석만 추가) |
| [Design] D-23 | `FORBIDDEN` 신설 + `ServiceError` 경유(리터럴 응답 제거) | ✅ | `mcp/index.ts` — 리터럴 `c.json(...)` 삭제, `throw new ServiceError(...)`로 교체 확인(diff) |
| [Design] D-24 | 배포 체크리스트 위치 = `docs/deploy/CHECKLIST.md` | ✅ | 신규 파일 위치 일치 |
| [Design] D-25 | 사후 개정은 원문 유지 + "(사후 확인)" + Version History | ✅ | 2차 design·report·analysis 3문서 전부 이 형식 준수 |
| [Design] D-26 | 필드 단위 재사용 기본 + `document_write`만 refine 포함 객체 전체 | ✅ | §2.4 — `document_write`만 `documentFields.extend(...).refine(...)` 통짜 전달, 나머지 7툴은 필드 단위 |
| [Design] D-27 | ✕ 버튼(형 결정) | ✅ | `ItemDialog.tsx` — `closedOn !== ''` 조건부 렌더, 형이 브라우저에서 동작 확인 |
| [Design] D-28 | 폼 저장만 null 전송, 배지 클릭은 키 생략 | ✅ | diff에서 `handleSubmit`만 `=== '' ? null : closedOn`, `handleStatusClick`은 `|| undefined` 그대로 |
| [Design] §9.1 규칙 6(신규) | 에러 응답은 `ServiceError`만 경유 | ✅ | 위반 후보였던 `mcp/index.ts` 리터럴이 D-23으로 소거돼 위반 0건(신규 규칙 확정 시점 기준) |

---

## 1. 분석 개요

### 1.1 목적

module-1~4 구현이 Plan·Design과 얼마나 일치하는지, 스코프 6건(S1~S6)이 전부 실측으로
닫혔는지, 이 상태로 Report로 넘어가도 되는지 판단.

### 1.2 범위·방법

- **비교 대상**: Plan §3(FR-22~38) / Design §3~§10 / 실 diff(`9b5c37e..f474274`, `f474274..00686f0`)
- **방법**: ①diff 직접 재검토(§2.4~2.6 근거) ②Do 단계에서 이미 실행한 L0(vitest)·L1(하네스)·
  실배포(S3)·실사용(웹 커넥터) 결과를 Plan 판정 기준에 재대입 ③저장소 전체 링크 전수 검증
  ④`errors.ts`↔2차 design §6.1↔실응답 3중 대조
- **분석일**: 2026-08-08

---

## 2. 스코프별 대조 (S1~S6)

### 2.1 S1 — 처리일 삭제 (Critical, C-1 해소)

| 항목 | 확인 |
|------|:---:|
| FR-22 `closedOn: null` 허용 | ✅ `backlogItemFields.closedOn = dateStringSchema.nullable().optional()` |
| FR-23 UI가 `null` 전송 | ✅ `handleSubmit`: `closedOn === '' ? null : closedOn` |
| FR-24 지우기 동선(✕ 버튼, D-27) | ✅ `closedOn !== ''`일 때만 렌더 — 형 실사용 확인 |
| FR-25 MCP는 null 미허용 + 사유 주석 | ✅ `backlog_update.closedOn = dateStringSchema.optional()`(non-nullable) + 주석 |

**실증**: 하네스 r1(세팅)·r2(null 전송+재조회 null 확인)·r3(키 생략 시 기존값 유지, 무회귀) +
브라우저 ✕ 클릭 확인. **C11 충족.**

### 2.2 S2 — MCP Origin 에러 코드 정합 (Important, I-3 해소)

| 항목 | 확인 |
|------|:---:|
| FR-26 `FORBIDDEN`(403) 추가 | ✅ `errors.ts` |
| FR-27 `mcp/index.ts`가 `ServiceError` 경유 | ✅ 리터럴 `c.json` 제거 확인(diff) |
| FR-28 2차 design §6.1에 같은 커밋으로 행 추가(RK-12) | ✅ 커밋 `f474274`에 코드+문서 동시 포함 |

**실증**: 하네스 r4(`403 + FORBIDDEN`) + §6.1 3중 대조(§2.5). **C12 충족.**

### 2.3 S3 — `?token=` 로그 잔존 확인 (보안 확인)

| 항목 | 확인 |
|------|:---:|
| FR-29 잔존 여부 확정 기록 | ✅ **잔존함**(형이 프로덕션에서 직접 실측, Search Params 필드에 평문) |
| FR-30 완화 결정 | ✅ 형이 "③ OAuth 2.1 승격 근거로 기록만" 선택 — 코드·설정 변경 0건 |

이 항목은 클로드가 CLI로 대행할 수 없었다 — 샌드박스가 Vercel API로 가져온 프로덕션 시크릿을
`[SENSITIVE]`로 자동 치환해 직접 DB 접근이 막혔고(§실행 로그), 형이 브라우저에서 §7.1 절차
1~6을 대신 수행했다. **의도된 안전장치가 계획된 CLI 실행 경로 하나를 막은 사례** — 결과 자체는
Design §7.1.1에 기록 완료. **C13 충족.**

### 2.4 S4 — MCP 툴 zod 스키마 재사용 (정합, M-4 해소)

Design §4.2 대조표를 diff 기준으로 재확인:

| 툴 | 갭 처리 | 확인 |
|---|---|:---:|
| `document_list`·`document_read`·`backlog_list`·`backlog_create`·`backlog_update`·`backlog_reorder`의 `projectId`/`id`/`ids` | `z.uuid()` 직접 사용(zod 내장, 사유 주석 1곳) | ✅ diff 전수 확인 |
| `document_read.path` | `documentPathSchema` 재사용 | ✅ |
| `document_write` 전체 | `documentFields.extend({projectId}).refine(documentKindStageRule)` 통짜 전달(D-26 예외) | ✅ |
| `backlog_create`·`backlog_update`의 `title`/`detail`/`openedOn`/`closedOn`(update만) | `backlogTitleSchema`/`backlogDetailSchema`/`dateStringSchema` 재사용 | ✅ |
| `backlog_update.closedOn` | 재사용 안 함(nullable 미적용) + 사유 주석(D-21) | ✅ 의도적 협소화, §2.1 |
| `backlog_update.status` | 기존 2값 협소화 유지 | ✅ 무변경 |
| `backlog_reorder.ids` | `reorderBacklogSchema.shape.ids` | ✅ |

**갭 16곳 전부 (a)재사용 또는 (b)사유 주석으로 닫힘 — 제3의 상태 없음(FR-32 충족).**

**실증**: API 하네스 r5(불량 포맷 거부, raw DB 에러 누출 0)·r6(closedOn null 거부)·r7(정상
입력 성공) + **웹 커넥터 실사용 4건**(정상 생성, 불량 포맷 명시 거부 — 메시지에 `YYYY-MM-DD`와
필드 위치 `at openedOn` 포함, 기존 항목 수정, 상태 전환). **C14 충족.**

**Minor 관찰(권장 조치로만 기록, §6)**: `backlog_reorder` MCP 툴 자체의 실호출(하네스든
웹 커넥터든)은 이번 사이클에서 별도로 재현하지 않았다 — Design §8.3 L1 시나리오(r5~r7)에도
포함되지 않았던 항목이라 스코프 이탈은 아니지만, 스키마 교체(`z.array(z.string())` →
`reorderBacklogSchema.shape.ids`)가 `tsc -b` 통과 외의 실행 확인은 못 받았다.

### 2.5 §6.1 3중 대조 (C12 후반)

```
errors.ts ErrorCode 7종:
  VALIDATION_ERROR UNAUTHORIZED FORBIDDEN TRANSITION_DENIED NOT_FOUND CONFLICT INTERNAL
2차 design §6.1 표 7종: 동일 (grep 결과 일치, PATH_TAKEN은 이월 통일 작업 설명 문장 속 과거
  코드 언급이라 표의 행이 아님 — 제외 타당)
L1 실응답 관측: VALIDATION_ERROR(r9) UNAUTHORIZED(L1#1·3b) FORBIDDEN(r4) CONFLICT(L1#13c)
  — 이번 사이클이 직접 건드린 코드는 전부 실응답까지 일치. TRANSITION_DENIED·NOT_FOUND·
  INTERNAL은 2차에서 이미 실증됐고 이번 변경이 그 경로를 건드리지 않아 재실행 생략(무회귀
  전제 — diff에 해당 분기 변경 없음으로 확인)
```

일치. **C12 완전 충족.**

### 2.6 S5+S6 — 문서 (C15·C16)

| 항목 | 확인 |
|------|:---:|
| FR-34 2차 design §6.3 정정 | ✅ D-25 형식, Version History v0.4 |
| FR-35 배포 체크리스트 신규 | ✅ `docs/deploy/CHECKLIST.md`, §1에 미적용 시 증상(실사례) 포함 |
| FR-36 2차 report·analysis C7·C10 정정 | ✅ 헤더·§1.2·§1.4·§4.1·§4.2(report), Success Criteria 표·§7(analysis) — 전부 D-25 형식 |
| FR-37 C6 구분 기록(웹 기준/CLI 미검증) | ✅ report §1.4 C6 행에 반영 |
| FR-38 `_INDEX.md` 갱신 | ✅ backlog-with-mcp 행에 사후 해소 메모 + refine-mcp-hardening 신규 행 |
| 링크 전수 검증(RULE.md 종료 절차) | ✅ 73개 링크 중 깨짐 11건 — **전부 1차 사이클 `PDCA-workspace.plan.md`의 기존 깨짐**(이번 사이클 무변경 파일, 최근 수정 커밋 `ed55e16`으로 diff 0 확인). **이번 사이클발 신규 깨짐 0건** |

---

## 3. 보안 이슈

| 심각도 | 내용 | 상태 |
|:---:|------|:---:|
| 🟡 Warning (기존 RK-02 연장) | `?token=` PAT가 Vercel Logs Search Params에 평문 잔존 확인(C13) | 완화: OAuth 승격 근거로만 기록(형 결정), 코드 변경 없음 — 다음 사이클 후보 우선순위 상향 필요 |
| 🟢 Info | S4의 입력 검증 강화로 비정상 입력(날짜·길이·uuid)이 DB까지 안 내려감 — 원시 DB 에러 문자열 노출면이 오히려 줄었다(V3 대비) | 개선 방향, 조치 불필요 |
| 🟢 Info | `FORBIDDEN` 신설로 Origin 거부가 항상 `onError` 표준 경로를 지남 — 임의 응답 생성 지점 1곳 소거 | 개선 방향, 조치 불필요 |

---

## 4. 테스트 커버리지

| 영역 | 현재 | 비고 |
|------|------|------|
| L0(`shared/schema.test.ts`) | t1~t3 신규 3케이스(전체 49/49 통과) | ✅ Design §8.2 요구 충족 |
| L1(API, 실 DB 하네스) | 신규 r1~r7 + 2차 L1 #1~13 재실행, 총 36/36 | ✅ 무회귀 확인. 스크립트는 실행 후 삭제(RULE.md, 정식 테스트 파일 아님) |
| L2(브라우저) | 처리일 ✕ 버튼 — 형이 직접 확인 | ✅ |
| L3(실배포·실사용) | S3 프로덕션 로그 확인(형) + 웹 커넥터 4건 실호출(형) | ✅ |
| 미실행 | `backlog_reorder` MCP 툴 실호출 재현 | Design 스코프에도 없던 항목 — §6 Minor로 기록 |

전체 Vitest 49개 통과(2차 46 + 이번 3).

---

## 5. Clean Architecture 준수 (§9.1, 규칙 6 신설 포함)

| 규칙 | 확인 |
|------|:---:|
| 1~5 (2차 규칙: 서비스만 도메인 / 어댑터 Drizzle 금지 / ServiceError만 throw / transition 순수 / 기존 규약) | ✅ 이번 사이클 변경분(diff)에 위반 유발 코드 없음 |
| **6 (신규) 에러 응답은 `ServiceError`만 경유** | ✅ 유일한 위반 후보(`mcp/index.ts` 리터럴)가 S2에서 소거 — 규칙 확정 시점 위반 0건 |

**6/6 준수.**

---

## 6. 권장 조치

### 6.1 Critical / Important

없음 — 스코프 6건 전부 해소.

### 6.2 Minor (다음 사이클 후보, 백로그)

| # | 항목 |
|---|------|
| N-1 | `backlog_reorder` MCP 툴의 실행 확인(하네스 또는 웹 커넥터) — 이번 사이클 스코프·Design 시나리오에 없었던 항목, 타입 검증만 통과 |
| N-2 | C13에서 확정된 `?token=` 평문 잔존을 근거로 OAuth 2.1 승격 여부를 다음 Plan에서 재논의(형 결정 사항, 이미 report §4.1에 승격 근거로 기록됨) |
| N-3 | 1차 사이클 `PDCA-workspace.plan.md`의 기존 깨진 링크 11건(이번 사이클 무관) — 언젠가 별도 정리 필요 |

---

## 7. Checkpoint 5 — 형 결정

스코프 6건 전부 실측으로 닫혀 Critical·Important 이월 항목이 없다. Checkpoint 5의 3택 중
"지금 모두 수정" 대상이 없는 상태 — **그대로 Report로 진행**을 제안한다.

---

## Version History

| 버전 | 날짜 | 변경 내용 | 작성자 |
|------|------|-----------|--------|
| 0.1 | 2026-08-08 | 최초 분석. RK-18에 따라 gap-detector 전면 스캔 대신 스코프 6건(S1~S6) 대조로 한정. diff 재검토(`9b5c37e..00686f0`) + Do 단계 실증 결과(L0 49/49, L1 하네스 36/36, 브라우저 ✕ 버튼 확인, 프로덕션 로그 실측, 웹 커넥터 실사용 4건) 재대입. C11~C16 6/6 완전 충족, D-19~D-28·§9.1 규칙 6 전부 준수 확인. Critical/Important 이월 0건 — Report 진행 제안 | cogmo |
