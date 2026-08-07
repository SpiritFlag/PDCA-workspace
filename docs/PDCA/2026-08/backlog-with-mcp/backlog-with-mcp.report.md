---
template: report
version: 1.1
---

# backlog-with-mcp 완료 보고서

> **상태**: 완료 (Match Rate 96%, Checkpoint 5에서 형 판단으로 Critical·Important 백로그 이월)
>
> **프로젝트**: PDCA-workspace
> **작성자**: cogmo
> **완료일**: 2026-08-07
> **PDCA Cycle**: backlog-with-mcp (2번째 사이클)

---

## Executive Summary

### 1.1 프로젝트 개요

| 항목 | 내용 |
|------|------|
| 기능 | 프로젝트별 백로그 보드 + 원격 MCP 서버(8툴) + PAT 인증 |
| 시작일 | 2026-08-07 (Plan) |
| 종료일 | 2026-08-07 (Report) |
| 소요 | 단일 세션 연속(Plan→Design→Do×4모듈→Check→Report), 실 DB 자체검증 병행 |

### 1.2 결과 요약

```
┌─────────────────────────────────────────────┐
│  Match Rate: 96%                             │
├─────────────────────────────────────────────┤
│  ✅ 완료:  Success Criteria 3/10             │
│  ⚠️ 부분:  5/10 (API는 실증, 브라우저 실사용 미확인)│
│  ❌ 미완료: 2/10 (C7·C10 — 배포 후 형의 실사용 필요)│
└─────────────────────────────────────────────┘
```

### 1.3 실현된 가치

| 관점 | 내용 |
|------|------|
| **Problem** | PDCA 산출물은 쌓이는데 "다음 할 일"이 사람 머리와 report.md 표에만 있었고, 그 판단에 필요한 문서를 클로드가 읽을 방법이 없었다 |
| **Solution** | 프로젝트 단위 백로그 보드(상태·중요도·처리일·드래그 정렬)를 1급 데이터로 만들고, Vercel Hono 앱에 원격 MCP 서버(`/api/mcp`)를 얹어 클로드가 문서와 백로그를 직접 읽고 쓸 수 있게 했다. 인증은 PAT — 그리고 Check 단계에서 claude.ai 웹 커넥터 대응으로 쿼리파라미터 폴백(D-18)까지 추가했다 |
| **Function/UX Effect** | 백로그 CRUD·드래그 정렬·PAT 발급/폐기·MCP 8툴 전부 실 DB 레벨(`app.request()` 하네스)로 API 전 구간 실증. Origin 검증·401/403/409 에러 분기·상태 전이 권한 경계(Q10a·Q10b)까지 실 요청으로 확인 |
| **Core Value** | "판단은 클로드가, 결정은 형이" — `shared/transition.ts`의 순수 함수 하나가 서버 서비스·MCP 툴·UI 배지 전부의 단일 원천이 되어, 권한 경계가 프롬프트가 아니라 코드 구조로 강제됨을 T1~T8 전수 테스트 + 실 MCP 호출(C8)로 확인 |

---

## 1.4 Success Criteria 최종 상태

| # | 기준 | 상태 | 근거 |
|---|------|:---:|------|
| C1 | 백로그 CRUD가 브라우저에서 전부 동작 | ⚠️ Partial | API 계층 100% 실증. 브라우저 클릭 확인은 형의 부분 사용(토큰 페이지)뿐 |
| C2 | 드래그 정렬 저장·새로고침 유지, 상태전환 시 순서보존 | ⚠️ Partial | `PUT /order` 원자성·재조회 일치 API 실증. 실제 드래그 UX 미확인 |
| C3 | 종료 항목 3섹션 접힘, 사라지지 않음 | ⚠️ Partial | 코드 완결(localStorage 유지), 브라우저 미확인 |
| C4 | 생성일·처리일 형 지정대로 저장·표시 | ⚠️ Partial | 생성일 정상. **처리일은 한 번 넣으면 지울 방법이 없음(Critical, 백로그 이월)** |
| C5 | PAT 발급 curl 성공, 폐기 후 401 | ✅ Met | 실 DB L1 #2·#3 |
| C6 | Claude Code 원격 MCP `tools/list`에 8개 | ⚠️ Partial | 프로토콜 레벨(`app.request()`) 완전 실증. **실제 `claude mcp add` 연결은 미실행** |
| C7 | 유즈케이스 3단계 완주(이 사이클의 관문) | ❌ Not Met | 배포 + 실제 Claude Code 세션 필요 — 형이 배포 후 진행 |
| C8 | `backlog_update`로 doing/done 거부 | ✅ Met | 실 DB L1 #6 — zod 1차 방어에서 거부 확인 |
| C9 | 미인증 MCP 401 | ✅ Met | 실 DB L1 #1 |
| C10 | 형이 실제로 이월 16건을 넣고 사용 | ❌ Not Met | 미실행 — 배포 후 형이 직접 |

**Success Rate**: 3/10 완전 충족, 5/10 부분(전부 "API는 확실히 되는데 브라우저·실연결로 형이 확인해야 완결"), 2/10 미충족(전부 배포가 전제조건).

## 1.5 Decision Record 요약

| 출처 | 결정 | 준수 | 결과 |
|------|------|:---:|------|
| [Plan] D-01·D-02 | 원격 HTTP MCP, Hono 라우트 | ✅ | `vercel.json` 무변경(F1·F2) 그대로 유지 |
| [Plan] D-03 | PAT 정적 토큰(OAuth 아님) | ✅ | 이번에도 OAuth 미채택. 대신 Check 단계에서 **D-18**로 확장 |
| [Plan] D-10 | 정렬 갱신 단일 SQL | ✅ (버그 1건 실측 수정) | `::int` 캐스팅 누락으로 "text vs integer" 500이 실 DB 테스트에서 나왔고 그 자리에서 수정 |
| [Plan] D-12·D-13 | shared 순수 함수 전이 규칙, 클로드는 해소·삭제만 | ✅ | T1~T8 전수 일치 + 실 MCP 호출로 거부 확인(C8) |
| [Design] 옵션 B(Clean) | 서비스 계층 분리 | ✅ | routes·mcp/tools.ts Drizzle import 0건(grep 전수, gap-detector 확인) |
| **[Check] D-18** | **MCP 인증에 `?token=` 쿼리 폴백 추가(PAT 한정)** | ✅ (신규) | claude.ai 웹 커넥터가 커스텀 헤더를 못 넣어 형이 결정. Design §4.2 갱신, 실 요청 3케이스로 실증 |
| [Check] 발견 | 처리일(closedOn) 삭제 불가(Critical) | ⏳ 이월 | Checkpoint 5에서 형이 "그대로 진행" 선택 — 다음 사이클로 |
| [Check] 발견 | MCP Origin 거부 에러코드가 §6.1 표 밖(Important) | ⏳ 이월 | 동일 |

---

## 2. 관련 문서

| 단계 | 문서 | 상태 |
|------|------|:---:|
| Plan | [backlog-with-mcp.plan.md](./backlog-with-mcp.plan.md) | ✅ |
| Design | [backlog-with-mcp.design.md](./backlog-with-mcp.design.md) | ✅ (D-18 반영, v0.2) |
| Check | [backlog-with-mcp.analysis.md](./backlog-with-mcp.analysis.md) | ✅ |
| Report | 현재 문서 | ✅ |

---

## 3. 완료 항목

### 3.1 기능 요구사항 (Plan §3.1, FR-01~FR-21)

| 범위 | 상태 | 비고 |
|------|:---:|------|
| FR-01~FR-11 (백로그 CRUD·필드·카드·팝업·드래그·접힘·URL·진입링크) | ✅ 완료 | FR-06 처리일 삭제만 이월 항목(C-1) |
| FR-12~FR-14 (PAT 발급·목록·폐기, authMiddleware 분기) | ✅ 완료 | D-18로 쿼리파라미터 경로 추가 |
| FR-15~FR-19 (MCP 엔드포인트·인증·툴 8개·권한 경계) | ✅ 완료 | Origin 에러코드만 이월 항목(I-3) |
| FR-20 (에러 코드 표 확정) | ✅ 완료 | PATH_TAKEN→CONFLICT 통일, 프론트 참조 갱신 |
| FR-21 (전역 401 핸들러) | ✅ 완료 (위치 변경) | Design은 QueryClient onError를 지정했으나 실제로는 `src/lib/api.ts`의 `authedFetch`에 구현 — 개별 api.ts가 401을 삼키는 경우가 있어 더 확실한 위치로 판단(주석에 사유 명시) |

### 3.2 비기능 요구사항

| 항목 | 목표 | 달성 | 상태 |
|------|------|------|:---:|
| PAT 평문 미저장 | 해시만 DB에 | SHA-256 hex, 발급 응답에만 평문 | ✅ |
| PAT 폐기 후 401 | 즉시 무효 | 실 DB 실증 | ✅ |
| MCP 파괴적 툴 미노출 | delete 계열 0개 | `tools/list` 실응답 0건 확인 | ✅ |
| `backlog_update` doing/done 거부 | 명시적 오류 | isError + 코드/사유 텍스트 | ✅ |
| 정렬 원자성 | 단일 SQL | 실 DB 검증 중 캐스팅 버그 발견·즉시 수정 | ✅ |

### 3.3 산출물

| 산출물 | 위치 | 상태 |
|--------|------|:---:|
| DB 스키마 + 마이그레이션(2테이블) | `server/db/schema.ts`, `drizzle/0001_*.sql` | ✅ dev·main 브랜치 둘 다 적용 확인 |
| 서비스 계층(옵션 B, 기존 라우트 4개 추출 포함) | `server/services/*.ts` | ✅ |
| REST API(백로그·토큰) + 기존 3개 무회귀 재작성 | `server/routes/*.ts` | ✅ |
| MCP 서버 + 툴 8개 | `server/mcp/{index,tools}.ts` | ✅ |
| 전이 규칙(순수 함수) | `shared/transition.ts` + 테스트 | ✅ |
| 백로그 UI 4컴포넌트 + PAT 관리 UI | `src/features/{backlog,tokens}/` | ✅ |
| 테스트 | `shared/transition.test.ts` 외 4개, 35 케이스 | ✅ |
| 배포 | Vercel + Neon(dev·main) | ✅ main 마이그레이션까지 완료 |

---

## 4. 미완료 항목

### 4.1 다음 사이클 이월

| 항목 | 사유 | 우선순위 |
|------|------|:---:|
| 처리일(closedOn) 삭제 불가 | Critical이지만 형이 "다른 사이클에서 실사용하며 검증" 선택 | 중 |
| MCP Origin 거부 에러코드가 §6.1 표 밖 | Important, 기능엔 지장 없음(403은 정확히 남) | 중 |
| MCP 툴 zod 스키마가 `shared/schema.ts` 미재사용 | Minor, 날짜 포맷 등에서 REST보다 느슨할 수 있음(구체 사례 미확인) | 낮음 |
| 종료 상태 전환 시 처리일 "제안"이 실제로는 즉시 확정 저장 | Minor | 낮음 |
| PAT 진입이 "사용자 메뉴"가 아니라 상시 헤더 링크 | Minor | 낮음 |
| OAuth 2.1 정식 지원 | claude.ai 웹의 근본 해법. D-18(쿼리토큰)로 임시 대응 중 | 낮음(필요해지면 승격) |

### 4.2 배포·실사용 필요 (C7·C10)

| 항목 | 필요 조건 |
|------|-----------|
| C7 — 실제 Claude Code 세션 유즈케이스 3단계 완주 | main 배포 + `claude mcp add --transport http` 연결 + 형이 실제 세션에서 확인 |
| C10 — 1차 사이클 이월 16건을 형이 실제로 백로그에 입력 | 배포 후 형이 직접 |

### 4.3 취소/보류 항목

없음.

---

## 5. 품질 지표

### 5.1 최종 분석 결과

| 지표 | 목표 | 최종 | 비고 |
|------|------|------|------|
| Match Rate | 90% | 96% | Runtime L1 13/13 실증 반영 |
| Structural Match | - | 98% | 51/52 |
| Functional Depth | - | 91% | §5.4 체크리스트 22항목 중 19 완전/3 부분 |
| API Contract | - | 94% | 17.5/18 |
| Runtime(L1) | - | 100% | 13/13, 실 DB(`app.request()` 하네스) |
| gap-detector 오탐 검출 | - | 2/5건 오탐 확정 | git 히스토리 대조로 I-1·I-2가 실제로는 1차 사이클과 byte-동일함을 확인 |
| 보안 Critical | 0 | 0 | PAT 노출면 확대(D-18)는 형이 인지하고 감내 결정 |
| 테스트 | - | 35/35 통과 | Vitest |

### 5.2 해소된 이슈

| 이슈 | 해소 방법 | 발견 시점 |
|------|-----------|:---:|
| 정렬 갱신 SQL이 `sort_order`를 text로 캐스팅 시도 → 500 | `VALUES` 튜플에 `::int` 명시 캐스팅 | module-1, 실 DB 테스트 |
| 프로덕션(main 브랜치) DB에 마이그레이션 미적용 → `/api/tokens` 500 | 형이 준 main `DATABASE_URL`로 `drizzle-kit migrate` 직접 실행 | Check 단계, 형의 실사용 중 보고 |
| PATH_TAKEN/CONFLICT 코드 분열(1차 사이클 이월 항목) | `CONFLICT` + `details.target:'path'`로 통일, 프론트 갱신 | module-1 |
| claude.ai 웹 커넥터가 커스텀 헤더 미지원 | `?token=` 쿼리 폴백(PAT 한정, D-18) | Check 단계, 형이 실사용 중 발견 |

---

## 6. 회고

### 6.1 잘된 것 (Keep)

- **실 DB 하네스로 "배포 없이 배포처럼" 검증**: `app.request()`로 Hono 앱 전체를 실 Neon DB에 대고 돌리는 패턴을 module-1부터 report까지 일관되게 써서, 서버 없이도 HTTP 계층·미들웨어·서비스·DB를 전부 통과하는 실증을 매 모듈 끝에 확보했다. 정렬 SQL 캐스팅 버그를 이 방식으로 그 자리에서 잡았다.
- **gap-detector 결과를 그대로 안 믿고 재검증**: "git 저장소 아니라 diff 불가"라는 gap-detector의 전제 자체가 틀렸다는 걸 확인하고, `git show`로 5건 중 2건을 오탐으로 확정했다. 정적 분석 에이전트 결과는 출발점이지 결론이 아니라는 걸 실제로 보여준 사례.
- **형의 실사용이 코드 리뷰가 못 잡는 것을 잡음**: `/api/tokens` 500은 dev/main 브랜치 마이그레이션 분리라는, 로컬 검증만으로는 절대 안 보이는 문제였다. 형이 실제로 눌러보고 바로 알려준 덕에 그 자리에서 해결했다.

### 6.2 개선이 필요한 것 (Problem)

- **처리일 nullable 처리를 zod 스키마 설계 시점에 놓침**: `dateStringSchema.optional()`만 쓰고 `.nullable()`을 안 넣은 게 "지울 방법이 없는" Critical 버그의 근본 원인. Design §5.3에 "날짜 지정 가능"이라고만 적혀있고 "지우기"는 명시가 안 됐던 게 스펙 단계의 빈틈.
- **MCP 툴 zod 스키마를 `shared/schema.ts`와 별도로 작성**: REST와 MCP가 같은 서비스를 부른다는 옵션 B의 원칙은 지켰지만, 입력 검증 스키마 자체는 두 곳에 따로 존재해 강도가 달라졌다. "단일 원천"을 서비스 계층까지만 적용하고 검증 계층까지 못 미친 것.
- **claude.ai 웹 연동을 Plan 단계에서 스코프 정의할 때 고려 안 함**: Plan §2.2 Out of Scope에 "MCP OAuth 2.1"만 적었지, "그럼 claude.ai 웹은 어떻게 붙이나"는 질문 자체를 안 던졌다. Claude Code CLI 기준으로만 C6·C7을 설계해서, 실제 형이 웹에서 시도하자마자 막혔다.

### 6.3 다음에 시도할 것 (Try)

- 날짜·선택 필드는 zod 스키마 작성 시 "값을 지울 수 있어야 하는가"를 항상 명시적으로 결정하고 `.nullable()` 여부를 Design 표에 기록.
- MCP 툴 입력 스키마는 `shared/schema.ts`의 필드 스키마를 재사용하는 걸 원칙으로 하고, 재사용 못 하는 경우(예: 부분 필드만 필요)엔 그 이유를 주석에 남긴다.
- Plan 단계에서 "이 기능을 실제로 쓸 클라이언트가 몇 종류인가"(CLI만? 웹도?)를 스코프 질문에 명시적으로 포함.

---

## 7. 프로세스 개선 제안

### 7.1 PDCA 프로세스

| 단계 | 현재 | 개선 제안 |
|------|------|-----------|
| Check | gap-detector 정적 분석을 그대로 신뢰 | 이번처럼 "확인 가능한 주장"(git diff로 검증되는 것)은 별도로 재검증하는 단계를 표준 절차에 포함 |
| Check | Checkpoint 5가 "지금 수정/Critical만/그대로" 3택 | 배포 필요 항목(C7·C10류)과 코드로 지금 고칠 수 있는 항목을 분리해서 제시하면 형의 판단이 더 쉬움 |

### 7.2 도구/환경

| 영역 | 개선 제안 | 기대 효과 |
|------|-----------|-----------|
| 인프라 | dev/main 브랜치 마이그레이션을 한 스크립트로 동시 적용하거나, 최소한 "적용 안 하면 무엇이 깨지는지"를 배포 체크리스트에 명시 | `/api/tokens` 500류 재발 방지 |
| 인증 | OAuth 2.1을 실제로 붙일지 여부를 다음 사이클 Plan에서 재논의(claude.ai 웹 사용 빈도에 따라) | - |

---

## 8. 다음 단계

### 8.1 즉시 (사이클 종료 절차, RULE.md)

- [ ] 저장소 전체 링크 전수 검증 스크립트 실행(신규 깨짐 0건 확인)
- [ ] `docs/PDCA/_INDEX.md`에 행 추가
- [ ] `docs/next.tmp`, `docs/backlog-with-mcp.q.tmp` 삭제
- [ ] docs 커밋 1개 (plan·design·analysis·report 4종)

### 8.2 다음 사이클 후보

| 항목 | 우선순위 | 비고 |
|------|:---:|------|
| C7·C10 실사용 검증 | 높음 | 형이 배포 후 `claude mcp add`로 직접 |
| 처리일 삭제 가능하게(Critical) | 중 | 3줄 내외 |
| MCP Origin 에러코드 표 정합 | 중 | |
| OAuth 2.1 (claude.ai 웹 대응 근본 해법) | 낮음 | D-18로 임시 대응 중, 필요해지면 재논의 |
| MCP 툴 zod 스키마 `shared/schema.ts` 재사용 | 낮음 | |

---

## 9. Changelog

### v0.2.0 (2026-08-07)

**Added:**
- 백로그 보드(상태·중요도·처리일·드래그 정렬·접힘 3섹션) DB+API+UI
- PAT(개인 액세스 토큰) 발급·목록·폐기 + `authMiddleware` PAT/JWT 분기
- 원격 MCP 서버(`/api/mcp`, stateless Streamable HTTP) + 툴 8개
- `shared/transition.ts` 상태 전이 순수 함수(서버·MCP·UI 공유)
- 서비스 계층 도입(옵션 B) — 기존 workspaces/projects/documents 라우트도 서비스로 추출
- MCP 인증 쿼리파라미터 폴백(D-18, claude.ai 웹 대응)

**Fixed:**
- 정렬 갱신 SQL의 `sort_order` text 캐스팅 버그 (module-1)
- PATH_TAKEN/CONFLICT 에러 코드 분열 통일 (1차 사이클 이월 항목 해소)
- main 브랜치 DB 마이그레이션 미적용으로 인한 `/api/tokens` 500

**Known Issues (이월):**
- 처리일(closedOn) 삭제 불가
- MCP Origin 거부 에러코드가 §6.1 표 밖

---

## Version History

| 버전 | 날짜 | 변경 내용 | 작성자 |
|------|------|-----------|--------|
| 0.1 | 2026-08-07 | 완료 보고서 최초 작성. Match Rate 96%, Success Rate 3/10(부분 5, 미충족 2 — 전부 형의 브라우저·배포 실사용이 필요한 항목) | cogmo |
