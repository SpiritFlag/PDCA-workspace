---
template: report
version: 1.1
---

# refine-mcp-hardening 완료 보고서

> **상태**: 완료 (Scope Closure Rate 6/6 = 100%, Checkpoint 5 — 이월 없음)
>
> **프로젝트**: PDCA-workspace
> **작성자**: Claude
> **완료일**: 2026-08-08
> **PDCA Cycle**: refine-mcp-hardening (문서화 기준 4번째 사이클)

---

## Executive Summary

### 1.1 프로젝트 개요

| 항목 | 내용 |
|------|------|
| 기능 | backlog-with-mcp(2차) Checkpoint 5가 이월한 6건(Critical 1·Important 1·보안확인 1·정합 1·문서 2)을 닫는 마감 사이클. 새 기능 0건 |
| 시작일 | 2026-08-08 (Plan) |
| 종료일 | 2026-08-08 (Report) |
| 소요 | 단일 세션 연속(Plan→Design→Do×4모듈→Check→Report), 실 DB 하네스 + 형의 브라우저·프로덕션 실증 병행 |

### 1.2 결과 요약

```
┌─────────────────────────────────────────────┐
│  Scope Closure Rate: 6/6 (100%)              │
├─────────────────────────────────────────────┤
│  ✅ 완료:  Success Criteria 6/6              │
│  ⚠️ 부분:  0/6                                │
│  ❌ 미완료: 0/6                                │
└─────────────────────────────────────────────┘
```

**Match Rate가 아니라 Scope Closure Rate를 쓴 이유**: 이 사이클은 새 아키텍처를 설계·구현하는
게 아니라 이미 확정된 이월 6건을 닫는 마감 사이클이다(Plan RK-18). Design 대 구현의 구조적
일치율(2차 방식)은 이번 스코프와 맞지 않아, Plan §4가 정의한 "실측/실증으로 닫혔는지"를
그대로 판정 기준으로 썼다(analysis.md §1.2).

### 1.3 실현된 가치

| 관점 | 내용 |
|------|------|
| **Problem** | 2차 사이클이 실사용 검증을 조건으로 열어둔 이월 6건이 형이 백로그를 실제로 쓰기 시작하면서 그대로 걸렸다 — 처리일 정정 불가, MCP 에러 코드 불일치, 문서-코드 어긋남 3곳 |
| **Solution** | 스코프를 이월 6건으로 고정하고 각각을 실측으로 닫았다. `closedOn` nullable + UI ✕ 버튼, `FORBIDDEN` 코드 신설, MCP 8툴 입력 스키마를 `shared/schema.ts` 재사용으로 전환(갭 16곳), 배포 체크리스트 신설, 2차 사이클 문서 3종 사후 정정 |
| **Function/UX Effect** | 형이 처리일 date input을 비우고 저장하면 실제로 지워진다(전에는 조용히 무시됐다). MCP로 잘못된 날짜를 보내면 `YYYY-MM-DD 형식이어야 합니다 at openedOn`처럼 필드 위치까지 짚어주는 거부가 온다(전에는 Postgres raw 에러가 그대로 노출됐다) |
| **Core Value** | "거의 지켜지는 원칙은 원칙이 아니다" — 2차가 "같은 서비스 함수까지"만 단일 원천으로 못박았던 걸 이번에 "검증 스키마까지" 넓혔고, 이 규약을 Design §10에 명문화해 다음 사이클부터 적용되는 규칙으로 승격시켰다 |

---

## 1.4 Success Criteria 최종 상태

| # | 기준 | 상태 | 근거 |
|---|------|:---:|------|
| C11 | 처리일 삭제 3단계 실증(세팅→null→재조회) + 브라우저 확인 | ✅ Met | 하네스 r1~r3(36/36 중) + 형이 브라우저에서 ✕ 버튼 클릭·저장·확인("✕ 잘 작동해") |
| C12 | Origin 위반 403 + `FORBIDDEN`, §6.1 표 정합 | ✅ Met | 하네스 r4 + `errors.ts`↔2차 design §6.1↔실응답 3중 대조 일치 |
| C13 | `?token=` 로그 잔존 여부 확정 기록 + 완화 결정 | ✅ Met | 형이 프로덕션에서 직접 실측 — **잔존함**(Search Params 필드에 평문). 완화: OAuth 2.1 승격 근거로 기록만(형 결정) |
| C14 | MCP 스키마 갭 16곳 폐쇄 + 실사용 무회귀 | ✅ Met | 정적 폐쇄(§4.2 대조표) + 하네스 r5~r7 + **형이 웹 커넥터로 4건 실호출**(정상 생성/수정 성공, 불량 포맷은 필드 위치까지 짚은 명시 거부) |
| C15 | design §6.3 정정 + 배포 체크리스트 신설 | ✅ Met | 2차 design §6.3 D-25 형식 정정, `docs/deploy/CHECKLIST.md` 신설(dev·main 마이그레이션+미적용 시 증상 포함) |
| C16 | 2차 report·analysis·`_INDEX.md`의 C7·C10 사후 정정 | ✅ Met | 3문서 전부 D-25 형식(원문 유지+사후 표기+Version History)으로 정정 |

**Success Rate: 6/6 완전 충족.** Critical·Important 이월 0건 — Checkpoint 5에서 "그대로
진행"이 아니라 애초에 고칠 게 없는 상태로 Report에 도달했다.

## 1.5 Decision Record 요약

| 출처 | 결정 | 준수 | 결과 |
|------|:---:|:---:|------|
| [Plan] D-19 | 처리일 삭제 = `null` 명시 전송 | ✅ | 서버 쓰기 계층은 실측(F13)으로 무변경 확정 — zod 한 줄이 핵심이었다 |
| [Design] D-20 | `closedOn.nullable().optional()` (V1 실측으로 union과 완전 동등 확인 후 짧은 쪽 채택) | ✅ | L0 t1~t3 |
| [Design] D-21 | MCP `closedOn`은 null 배제 — 지우기는 형의 정정 행위 | ✅ | 하네스 r6로 raw null 거부 실증 |
| [Design] D-23 | `FORBIDDEN` 신설 + `mcp/index.ts`가 `ServiceError` 경유(리터럴 응답 제거) | ✅ | diff 확인 — 코드값보다 "표를 지나는 경로 하나로 통일"이 본질이었다 |
| [Design] D-26 | 필드 단위 재사용 기본 + `document_write`만 refine 포함 객체 전체(V2 실측: SDK가 한글 zod 메시지를 클라이언트까지 그대로 전달함을 확인) | ✅ | §4.2 갭 16곳 전수 폐쇄 |
| [Design] D-27 | 처리일 지우기 UI = ✕ 버튼 (Checkpoint 3, 형 결정) | ✅ | 형이 브라우저에서 직접 확인 |
| [Design] D-28 | `''`↔`null` 변환: 폼 저장만 null 전송, 배지 클릭은 키 생략 | ✅ | 재오픈 시 처리일 유지(D-22)와 충돌 없이 diff로 확인 |
| [Design] §9.1 규칙 6(신규) | 에러 응답은 반드시 `ServiceError` 경유 | ✅ | 위반 후보 1건(mcp/index.ts 리터럴)이 D-23으로 소거돼 위반 0건 |
| [Plan] Q11/D-23 | Origin 에러 코드 — Plan이 Design에 넘긴 유일한 미결 | ✅ | `FORBIDDEN` 신설(재매핑 2안 모두 기각) |
| [Design] Checkpoint 3/D-27 | 지우기 UI 동선 — Design이 형에게 넘긴 유일한 미결 | ✅ | ✕ 버튼(형 결정) |
| [실행 중 발견] | CLI가 프로덕션 시크릿에 접근 못 함(샌드박스 자동 마스킹) | — | S3 절차를 형이 직접 수행 — 계획에 없던 실행 경로 전환, Design §7.1.1에 기록 |

---

## 2. 관련 문서

| 단계 | 문서 | 상태 |
|------|------|:---:|
| Plan | [refine-mcp-hardening.plan.md](./refine-mcp-hardening.plan.md) | ✅ (v0.2, 형 승인 4건 반영) |
| Design | [refine-mcp-hardening.design.md](./refine-mcp-hardening.design.md) | ✅ (v0.2, S3 실측 결과 반영) |
| Check | [refine-mcp-hardening.analysis.md](./refine-mcp-hardening.analysis.md) | ✅ |
| Report | 현재 문서 | ✅ |
| 이전 사이클(사후 개정 대상) | [backlog-with-mcp.report.md](../backlog-with-mcp/backlog-with-mcp.report.md) · [analysis.md](../backlog-with-mcp/backlog-with-mcp.analysis.md) · [design.md](../backlog-with-mcp/backlog-with-mcp.design.md) | ✅ 사후 정정 |

---

## 3. 완료 항목

### 3.1 스코프 6건(Plan §3.1, FR-22~38)

| 범위 | 상태 | 비고 |
|------|:---:|------|
| S1 처리일 삭제(FR-22~25) | ✅ 완료 | zod nullable + UI ✕ 버튼 + MCP null 배제 |
| S2 MCP Origin 에러코드(FR-26~28) | ✅ 완료 | `FORBIDDEN` 신설, 코드·2차 design 표 같은 커밋(RK-12) |
| S3 프로덕션 로그 확인(FR-29~30) | ✅ 완료 | 잔존 확정, 완화는 기록만(형 결정) — **형이 직접 실행**(§6.1 회고) |
| S4 MCP 스키마 재사용(FR-31~33) | ✅ 완료 | 갭 16곳 전수 폐쇄, 웹 커넥터 실사용 무회귀 확인 |
| S5 배포 체크리스트(FR-34~35) | ✅ 완료 | 2차 design §6.3 정정 + `docs/deploy/CHECKLIST.md` 신설 |
| S6 C7·C10 기록(FR-36~38) | ✅ 완료 | 2차 report·analysis·`_INDEX.md` 3문서 사후 정정 |

### 3.2 비기능 요구사항

| 항목 | 목표 | 달성 | 상태 |
|------|------|------|:---:|
| 무회귀(REST) | `closedOn` 키 생략 PATCH가 여전히 "변경 없음" | 하네스 r3 실증 | ✅ |
| 무회귀(2차 L1 시나리오) | 13개 전부 기존 기대값 유지 | 재실행 13/13 통과 | ✅ |
| 타입 안전성 | `closedOn` nullable 타입 파급 전수 확인 | `tsc -b` 그린 | ✅ |
| 정합성 | `errors.ts`==2차 design §6.1==실응답 | 3중 대조 일치 | ✅ |
| 실사용 무회귀(MCP) | 조인 스키마가 실사용 호출을 거부하지 않음 | 웹 커넥터 4건 전부 성공/의도된 거부 | ✅ |
| 문서 | 저장소 링크 신규 깨짐 0 | 73개 중 11개 깨짐(전부 1차 사이클 기존분, 이번 무변경) | ✅ |

### 3.3 산출물

| 산출물 | 위치 | 상태 |
|--------|------|:---:|
| zod 필드 스키마 export 승격 + closedOn nullable | `shared/schema.ts` | ✅ |
| L0 스키마 단위 테스트 3케이스 | `shared/schema.test.ts` (49/49 통과) | ✅ |
| `FORBIDDEN` 에러 코드 | `server/lib/errors.ts` | ✅ |
| Origin 거부 `ServiceError` 경유 | `server/mcp/index.ts` | ✅ |
| MCP 8툴 입력 스키마 재사용 | `server/mcp/tools.ts` | ✅ |
| 처리일 ✕ 버튼 + null 전송 | `src/features/backlog/components/ItemDialog.tsx` | ✅ |
| 배포 체크리스트(신규) | `docs/deploy/CHECKLIST.md` | ✅ |
| 2차 사이클 문서 사후 정정(3종) | `docs/PDCA/2026-08/backlog-with-mcp/*.md` | ✅ |
| `_INDEX.md` 갱신 | `docs/PDCA/_INDEX.md` | ✅ (report 완료 후 최종 갱신 예정, §6.2) |
| 커밋 | `f474274`(코드 module-1+2), `00686f0`(문서 module-4) | ✅ |

---

## 4. 미완료 항목

### 4.1 다음 사이클 이월

| 항목 | 사유 | 우선순위 |
|------|------|:---:|
| `backlog_reorder` MCP 툴 실행 확인 미실시(하네스·웹 커넥터 둘 다) | Design 시나리오(§8.3)에도 없던 항목 — 스키마 교체는 `tsc -b`로만 검증됨. 스코프 이탈은 아니나 실행 확인 공백 | 낮음 |
| OAuth 2.1 정식 지원 재논의 | C13로 `?token=` 평문 잔존이 확정돼 승격 근거가 늘었다. 이번에도 착수는 보류(형 결정) | 낮음(필요해지면 승격) |
| 1차 사이클 `PDCA-workspace.plan.md`의 기존 깨진 링크 11건 | 이번 사이클과 무관(무변경 파일). 별도 정리 필요 | 낮음 |

### 4.2 취소/보류 항목

없음.

---

## 5. 품질 지표

### 5.1 최종 결과

| 지표 | 목표 | 최종 | 비고 |
|------|------|------|------|
| Scope Closure Rate | 6/6 | 6/6 (100%) | Match Rate 대신 채택한 사유는 §1.2 |
| L0 단위 테스트 | 통과 | 49/49 | 2차 46 + 이번 3(schema t1~t3) |
| L1 API 하네스(신규+2차 재실행) | 통과 | 36/36 | r1~r7 신규 7 + 2차 L1 #1~13 재실행 |
| L2 브라우저 확인 | 통과 | ✅ | ✕ 버튼(형 직접) |
| L3 실배포·실사용 확인 | 통과 | ✅ | 프로덕션 로그(형) + 웹 커넥터 4건(형) |
| 타입·린트 | 통과 | `tsc -b`·`oxlint` 그린 | |
| 링크 신규 깨짐 | 0 | 0 | 기존 11건은 무관 파일 |
| 보안 Critical | 0 | 0 | C13의 잔존 발견은 완화 결정까지 완료(기록형) |

### 5.2 해소된 이슈

| 이슈 | 해소 방법 | 발견 시점 |
|------|-----------|:---:|
| 처리일(closedOn)을 한 번 넣으면 지울 방법이 없음(2차 Critical) | zod nullable + UI ✕ 버튼. 서버 쓰기 계층은 실측 결과 이미 정상 동작(F13) | 2차 Check, 이번 module-1에서 해소 |
| MCP Origin 거부가 에러 코드 표 밖(2차 Important) | `FORBIDDEN` 신설 + 리터럴 응답 제거 | 2차 Check, 이번 module-1에서 해소 |
| MCP 스키마 미재사용으로 `openedOn:'aaa'`가 Postgres raw 에러(`22007`)까지 노출 | zod 조기 거부로 DB 왕복 자체를 차단 | 이번 Design §6.2 검증(V3)에서 구체화 후 module-2에서 해소 |
| CLI가 프로덕션 시크릿에 접근 못 해 S3 절차 자동화 불가 | 형이 브라우저로 직접 수행 — 실행 경로만 바뀌었을 뿐 결과는 그대로 확보 | module-3 착수 중 발견 |

---

## 6. 회고

### 6.1 잘된 것 (Keep)

- **Plan/Design 단계에서 "추정 금지, 직접 읽고 확정"을 문자 그대로 지킨 게 구현 범위를
  절반으로 줄였다**: analysis §6.1이 지목한 수정 대상 파일 3개 중 실제로는 1.5개만 손댔다
  (F13 — `server/services/backlog.ts`는 input을 가공 없이 넘겨서 애초에 무변경이었다). 실측
  없이 analysis 문서를 그대로 믿었다면 안 써도 될 파일을 만졌을 것이다.
- **Design §6.2 검증 4건을 전건 실측하고 나서 결정을 확정한 것**: 특히 V3(현행
  `openedOn:'aaa'`의 실제 실패 지점)가 "크래시 방지"였던 애초 목표를 "raw DB 에러 누출
  제거"로 재정의시켰다 — 검증 없이 진행했으면 잘못된 목표로 구현했을 것이다.
- **실증 기준을 스코프 6건 각각에 못박은 것**(Plan C11~C16을 전부 "API+브라우저/실사용까지"로
  정의): 2차의 Critical(C-1)이 정확히 "코드는 고쳤는데 검증을 안 해서" 생긴 문제였는데, 이번엔
  같은 실패가 재발할 여지를 Success Criteria 정의 단계에서 막았다.

### 6.2 개선이 필요한 것 (Problem)

- **CLI 실행 환경의 시크릿 접근 제약을 Plan/Design 단계에서 예상하지 못했다**: S3(프로덕션
  로그 확인)를 설계할 때 "클로드가 CLI로 전체 수행"을 기본 경로로 짰는데, 실행 시점에 샌드박스가
  프로덕션 시크릿을 자동 마스킹한다는 걸 처음 알았다. 결과 자체는 형이 대신 수행해 확보했지만,
  설계 단계에서 "이 검증을 실제로 누가/어떤 권한으로 실행할 것인가"를 물었다면 더 빨리 갈
  수 있었다.
- **2차 회고가 지적한 "클라이언트 종류를 스코프 질문에 안 넣음"이 이번에도 정확히 재현됐다**:
  C14 실사용 확인을 설계할 때도 "claude.ai 웹 커넥터로"라고 명시했으면서, S3 실행 방법을 짤
  땐 다시 "클로드가 CLI로"를 기본값으로 깔았다 — 같은 세션 안에서도 같은 교훈을 두 번 안
  써먹었다.

### 6.3 다음에 시도할 것 (Try)

- 프로덕션 인프라(DB·시크릿·배포)를 건드리는 검증 단계를 설계할 때는 "이 환경에서 이 작업을
  실행할 권한이 실제로 있는가"를 Design §6.2 검증 항목에 명시적으로 포함한다 — 코드 검증뿐
  아니라 실행 환경 제약도 사전 검증 대상이다.
- Design §10에 승격한 두 규약(날짜·선택 필드 nullable 명시, MCP 스키마 재사용 원칙)이 다음
  사이클에서 실제로 지켜지는지 — cycle-release-note 사이클(이번 세션 밖에서 진행됨)이 이미
  같은 `.optional()`/`.nullable()` 버그를 다른 컬럼에서 재현했다는 걸 나중에 확인했다. 규약을
  문서에 적는 것과 다음 세션이 그 문서를 실제로 참조하는 것 사이의 간극을 어떻게 좁힐지가
  다음 과제다.

---

## 7. 프로세스 개선 제안

### 7.1 PDCA 프로세스

| 단계 | 현재 | 개선 제안 |
|------|------|-----------|
| Design §6.2 검증 | 코드 동작 검증만 포함 | 프로덕션 인프라를 건드리는 절차가 있으면 "실행 권한·환경 제약"도 검증 항목에 포함 |
| Check | 매 사이클 gap-detector 전면 스캔이 기본값 | 이번처럼 스코프가 이월 항목으로 고정된 마감 사이클은 스코프 대조만으로 충분(RK-18) — 사이클 성격(신규/마감)에 따라 Check 방식을 분기하는 걸 표준 절차에 반영 |

### 7.2 도구/환경

| 영역 | 개선 제안 | 기대 효과 |
|------|-----------|-----------|
| 실행 환경 | 이 세션이 프로덕션 시크릿을 자동 마스킹한다는 사실 자체를 프로젝트 문서(예: CLAUDE.md나 RULE.md)에 명시 | 다음 사이클이 같은 자리에서 또 놀라지 않게 |
| 규약 준수 | Design §10에 적은 규약(nullable 명시·MCP 스키마 재사용)을 다음 Plan/Design 작성 시 자동으로 다시 읽게 할 방법(체크리스트화 등) 검토 | cycle-release-note에서 재발한 `.optional()`/`.nullable()` 버그 같은 재발 방지 |

---

## 8. 다음 단계

### 8.1 즉시 (사이클 종료 절차, RULE.md)

- [ ] 저장소 전체 링크 전수 검증 재실행(신규 깨짐 0건 재확인)
- [ ] `docs/PDCA/_INDEX.md`의 refine-mcp-hardening 행을 "진행 중"에서 최종 상태로 갱신
- [x] `docs/PDCA/2026-08/new.tmp` 삭제 확인 — 이미 삭제되어 있음
- [ ] 이 사이클의 4종 문서(plan·design·analysis·report) docs 커밋 1개

### 8.2 다음 사이클 후보

| 항목 | 우선순위 | 비고 |
|------|:---:|------|
| `backlog_reorder` MCP 툴 실행 확인 | 낮음 | 스키마 교체 후 미재현 |
| OAuth 2.1 정식 지원 | 낮음(필요해지면 승격) | C13로 승격 근거 확정 |
| 1차 사이클 기존 깨진 링크 11건 정리 | 낮음 | 이번 사이클과 무관 |
| Design §10 규약(nullable 명시·MCP 스키마 재사용)의 다음 사이클 실제 준수 확인 | 중 | 6.3 Try 참조 |

---

## 9. Changelog

### v0.3.0 (2026-08-08)

**Fixed:**
- 백로그 처리일(closedOn)을 한 번 넣으면 지울 방법이 없던 문제(2차 Critical) — nullable 스키마 + UI ✕ 버튼
- MCP Origin 거부가 에러 코드 표 밖 조합을 반환하던 문제(2차 Important) — `FORBIDDEN` 신설
- MCP 툴 입력 검증이 REST보다 느슨해 `openedOn:'aaa'` 같은 값이 Postgres raw 에러까지 노출되던 문제 — zod 조기 거부로 전환

**Added:**
- 배포 체크리스트(`docs/deploy/CHECKLIST.md`) — dev·main 마이그레이션 절차 + 미적용 시 증상
- `shared/schema.ts` 필드 스키마 export 승격(재사용 가능한 단일 원천 확대)
- Design §10 코딩 컨벤션에 nullable 명시·MCP 스키마 재사용 원칙 규약화

**Docs:**
- 2차 사이클(backlog-with-mcp) report·analysis·design 3종 사후 정정 — C7·C10 완주(웹 커넥터), 이월 3건 해소 반영

---

## Version History

| 버전 | 날짜 | 변경 내용 | 작성자 |
|------|------|-----------|--------|
| 0.1 | 2026-08-08 | 완료 보고서 최초 작성. Scope Closure Rate 6/6(100%), Success Rate 6/6 — 이월 없음. Match Rate 대신 Scope Closure Rate 채택(마감 사이클 성격, RK-18) | Claude |
