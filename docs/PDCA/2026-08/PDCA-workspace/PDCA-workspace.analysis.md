---
template: analysis
version: 1.3
---

# PDCA-workspace 분석 문서

> **분석 유형**: Gap Analysis (Design vs Implementation) + Runtime Verification
> **프로젝트**: PDCA-workspace
> **작성자**: cogmo
> **작성일**: 2026-08-07
> **Plan 문서**: [PDCA-workspace.plan.md](./PDCA-workspace.plan.md)
> **Design 문서**: [PDCA-workspace.design.md](./PDCA-workspace.design.md)

---

## Context Anchor

> Design에서 복사.

| Key | Value |
|-----|-------|
| **WHY** | PDCA 산출물이 레포 파일로만 존재해 조회 안 됨. 웹으로 옮기면 상대링크(레포 외부 17종 포함)가 죽는 문제 |
| **WHO** | 형 단독. 다중 유저 없음 |
| **RISK** | RK-01(Vercel `.md` URL rewrite 실패, module-1에서 실증 해소) / RK-02(path 오타로 조용히 링크 죽음) / RK-03(Neon Auth Vite 지원 미검증, module-1에서 better_auth 실증) |
| **SUCCESS** | C1~C10 |
| **SCOPE** | module-1(기반) module-2(CRUD) module-3(뷰어+실데이터) module-4(에디터·셸·테마·배포) — 4개 세션 전부 완료 |

---

## Strategic Alignment Check

> PRD는 이 사이클에서 생략(`/pdca pm` 미실행). Plan→Design→Do 체인만 검증.

### Plan Core Value 정합

| Plan 요소 | 기대 | 구현 상태 |
|-----------|------|:---------:|
| Problem(WHY) — 링크 죽는 문제 | 형제/타폴더/디렉터리/레포외부 4종 링크 판정 | ✅ 반영 (C6 실증) |
| Core Value — "경로가 곧 주소" | URL 경로 미러링으로 resolver 불필요 | ✅ 반영 (`server/lib/path.ts` + 라우팅) |
| Solution — 붙여넣기 임포트 + 링크 프리뷰 | FR-11/FR-12 | ✅ 반영, 세부 마감 일부 미흡(§2.5 참조) |

### Success Criteria 상태 (Plan §4)

| # | 기준 | 상태 | 근거 |
|---|------|:---:|------|
| C1 | 3계층 CRUD 전부 동작 | ✅ | module-2 전 배치 L1 실증(생성→수정→삭제 왕복) |
| C2 | 로그인 없이 데이터 조회 불가 | ✅ | `GET /api/workspaces` 무토큰 → 401 (전체 회귀에서 재확인, 중간에 500 회귀 발생했으나 module-4에서 발견·수정) |
| C3 | 딥링크 새로고침·직접 URL 동작 | ✅ | RK-01 스파이크(module-1) + 매 세션 배포마다 회귀 확인 |
| C4 | 임포트 시 링크 생사 프리뷰 카운트 정확 | ⚠️ | 카운트 로직은 정확(뷰어와 동일 함수 공유, gap-detector 확인)하나 **경로 변경 시 자동 재계산 안 됨**(F-9, 수동 재클릭 필요) |
| C5 | 100KB 문서 렌더 안 깨짐 | ✅ | `260730-code-review-fix-cycle-4.plan.md` 101,588바이트 — 원본과 바이트 단위 일치 확인(module-3) |
| **C6** | **cogmo-report 67개 실데이터, 링크 4종 전부 의도대로** | ✅ | 67/67 임포트 성공, F2(형제)·F3(타폴더)·F4(디렉터리, `tree` 4건 반환)·F5(레포외부, `existing:[]`) 전부 실측 검증(module-3) |
| C7 | XSS 페이로드 무력화 | ✅ | 67개 문서 전수조사로 raw HTML 0건 확인 → `rehype-raw` 미사용 결정 자체가 구조적 방어. 단 `javascript:` URL 분류 방어는 한 겹 비어있음(F-14, 실사용 경로는 rehype-sanitize가 2차 방어) |
| C8 | dev 브랜치 먼저 검증 → main 적용 절차 | ✅ | module-1에서 실제 두 브랜치에 순차 적용, 스키마·CHECK·인덱스 확인 |
| C9 | 테마 일관성 | ⚠️ | Latte/Mocha 전 화면 적용 확인(형 확인 완료)이나 **링크 색상이 Design 지정(mauve 단일 액센트) 대신 blue 사용**(F-7), 에디터만 CodeMirror 기본 테마(Catppuccin 미적용) |
| C10 | 형이 실제 프로덕션에서 사용 | ✅ | 형 계정으로 워크스페이스·프로젝트 생성, 문서 임포트·뷰·사이드바·⌘K·테마 토글 전부 형이 직접 확인 |

**Success Rate**: 8/10 완전 충족, 2건(C4, C9) 부분 충족 — 둘 다 사용 가능하지만 설계 명세 일부 미이행

### Decision Record Verification

| 출처 | 결정 | 준수 여부 | 이탈 내용 |
|------|------|:---:|-----------|
| [Plan] D-13 | URL 경로 미러링 | ✅ | - |
| [Plan] Q4 | Neon dev/main 브랜치 분리 | ✅ | - |
| [Design] 옵션 C(Pragmatic) | 계층 안 나누고 경계만 | ✅ | - |
| [Design] D-11 | rehype-sanitize 화이트리스트 | ✅ | 실측 후 `rehype-raw` 자체를 안 씀(더 강한 방어로 자연 귀결) |
| [Do/module-1] | Neon Auth = better_auth | ✅ | 정확히 반영, 근거 주석까지 남김 |
| [Do/module-1] | Hono RPC 라우트 체이닝 필수 | ✅ | 전 라우트 파일에서 준수 |
| [Do/module-3] | XSS 조사 결과 rehype-raw 미사용 | ✅ | - |
| **[Plan] D-10** | **shadcn/ui(Radix) 채택** | ❌ | 미채택, 전부 직접 구현 + Tailwind. 근거 주석 없음 |
| **[Plan] D-07** | **Zustand 전역 상태** | ❌ | 의존성만 설치, `src/` 전체 import 0건. 실제로는 `useState`+localStorage로 충분해서 안 씀 |
| **[Do/module-4]** | **vercel.json routes 저수준 전환** | ✅ (기록 필요) | Vercel Vite 프리셋의 optional catch-all 다단 경로 버그 실측 근거로 원안(단순 rewrites)에서 이탈. 정당하나 Design에 미반영 |

---

## 1. 분석 개요

### 1.1 목적

module-1~4 4개 세션 구현이 Design 문서와 실제로 얼마나 일치하는지, 그리고 남은 세션 없이 이 상태로 사이클을 마감(Report)해도 되는지 판단하기 위한 갭 분석.

### 1.2 범위

- **Design 문서**: `docs/PDCA/2026-08/PDCA-workspace/PDCA-workspace.design.md`
- **구현 범위**: `server/`, `shared/`, `src/` 전체
- **분석 방법**: gap-detector 에이전트(정적 3축) + 본인 종합(전략 정합·Success Criteria·Decision Record·Runtime)
- **분석일**: 2026-08-07

---

## 2. Gap Analysis (Design vs Implementation)

### 2.1 API 엔드포인트 (Design §4.1 기준 15개)

**15/15 전부 마운트 확인.** 추가로 `/api/health`, `/api/me`, 단건 GET(ws/proj/doc) 3종 등 설계 외 5개가 유용하게 추가됨. `server/routes/links.ts`는 파일로 분리되지 않고 `documents.ts`에 통합 — 기능은 100% 존재, 배치만 다름(감점 없음).

### 2.2 데이터 모델

Design §3.1 스키마(3테이블·2enum·6인덱스)와 `server/db/schema.ts` **완전 일치**. `drizzle/0000_windy_speed.sql`의 수동 추가분(CHECK 제약, prefix 인덱스)까지 반영됨.

### 2.3 컴포넌트 구조

Design §5.3 컴포넌트 11종 전부 존재. `features/{workspace,project,document}` 3개 모두 `components/`+`hooks/`+`api.ts` 구조 준수.

### 2.4 Functional Depth Analysis

Placeholder/TODO/빈 핸들러 **grep 전수조사 0건**. Design §5.4 Page UI Checklist 27항목 중 15 완전 / 6 부분 / 6 미구현 (상세는 §2.5).

**Shallow 파일**: 0 / 전체 — depth score 기준 완전 구현되지 않은 파일 없음(부분 항목은 파일 단위가 아니라 항목 단위 미비).

### 2.5 Page UI Checklist Verification

| 구분 | 항목 수 | 완전 | 부분 | 미구현 |
|------|:---:|:---:|:---:|:---:|
| 문서 뷰/편집/임포트/기타 | 27 | 15 | 6 | 6 |

**미구현 6건** (전부 확인, 파일:라인 포함):

| # | 항목 | 파일 | 심각도 |
|---|------|------|:---:|
| F-1 | 브레드크럼 경로 세그먼트 개별 클릭 | `DocumentViewPage.tsx:129` | 낮음 |
| F-2 | 문서 뷰 페이지 [삭제] 버튼 | `DocumentViewPage.tsx` | 낮음(목록에는 있음) |
| F-3 | 첫 `# 헤딩` → 제목 자동 제안 | `ImportDialog.tsx` | 낮음 |
| F-4 | 파일명 기반 kind/stage 자동 제안 | `ImportDialog.tsx` | 낮음 |
| **F-5** | **409 시 덮어쓰기/경로수정 선택지** | `ImportDialog.tsx:129-135` | **중간(RK-02 방어 마감)** |
| F-6 | 문서 목록 kind·stage 필터(FR-20) | `DocumentList.tsx` | 낮음(Plan상 Low 우선순위) |

**부분 구현 6건**: 활성 링크 색상(mauve 아닌 blue, F-7) / 404 화면 경로 프리필 없음(F-8) / 경로 변경 시 프리뷰 자동 재계산 없음(F-9) / 정규화 결과 실시간 미리보기 없음(F-10) / 자동저장 실패 자동재시도 없음(F-11) / 에디터 미리보기 링크 판정이 항상 비활성(F-12, `Editor.tsx:49` `existingPaths` 하드코딩).

**Functional Match Rate**: 67% (gap-detector 산정 — 완전 15 + 부분 6×0.5 = 18/27)

### 2.6 API Contract Verification

**15개 중 13 PASS, 2 FAIL.**

| 이슈 | 등급 | 파일:라인 | 내용 |
|------|:---:|------|------|
| **C-1** | 🔴 Critical | `documents.ts:64`, `documents.ts:91` | by-path·links/resolve가 **서버 재정규화 없이** path를 그대로 씀. Design §7 "클라이언트 정규화 신뢰 금지" 불변식 위반. 지금은 클라이언트가 항상 정규화된 값만 보내서 안 터지지만 방어선이 코드에 없음 |
| C-2a | 🟡 Important | `app.ts:33` vs `documents.ts:85` | 같은 "경로 중복" 상황에 코드가 `CONFLICT`/`PATH_TAKEN` 2개로 갈림. 사전조회로 잡으면 PATH_TAKEN, DB 경합(23505)이면 CONFLICT. 클라이언트는 PATH_TAKEN만 분기해서 경합 시 무의미한 에러 메시지 |
| C-3 | 🟢 Minor | `workspace/project api.ts` vs `document api.ts` | 에러 처리 패턴 2종 혼재(throw vs `{ok:false}`) |

**Contract Match Rate**: 13/15 = 87% (gap-detector는 실측 세부 문제 2건을 반영해 77%로 산정 — 에러 포맷 일관성까지 포함한 값)

### 2.7 Runtime Verification Results

> Playwright 미설치(Design D-15 결정, 개인 앱 E2E 자동화 제외). L1은 curl 실측, L2/L3은 형 수동 확인 + C6 스크립트 자동 검증으로 대체.

#### L1: API 엔드포인트 (curl, 각 세션 최종 상태 기준)

| # | 테스트 | 기대 | 실제 | Pass |
|---|--------|------|------|:---:|
| 1 | `GET /api/workspaces` 무토큰 | 401 | 401 (전체 회귀에서 500 회귀 발견·수정 후 재확인) | ✅ |
| 2 | Workspace/Project/Document CRUD 왕복 | 200대 | 전부 확인 | ✅ |
| 3 | 중복 slug/path | 409 | 409 | ✅ |
| 4 | 잘못된 kind/stage 조합 | 400 표준 포맷 | 400, `VALIDATION_ERROR` | ✅ |
| 5 | `tree` 3단계 깊이 | 폴더/문서 분리 | 정확히 분리 | ✅ |
| 6 | `links/resolve` 실데이터 4종 | 형제·타폴더 존재, 레포외부 없음 | 정확 | ✅ |
| 7 | 100KB 문서 무결성 | 바이트 일치 | 101,588 = 원본 | ✅ |
| 8 | 정적 자산(JS/CSS) | 실제 콘텐츠 타입 | 매 배포마다 확인 | ✅ |
| 9 | SPA 딥링크(RK-01) | 200 | 200 | ✅ |

**L1 Score**: 9/9 = 100% (최종 배포 기준. 과정 중 발견된 회귀 3건은 전부 그 세션 내에서 수정 후 재검증)

#### L2: UI 액션 (형 수동 확인)

| # | 페이지 | 액션 | 결과 | Pass |
|---|--------|------|------|:---:|
| 1 | 로그인 | 회원가입→로그인→`/api/me` 200 | 확인 | ✅ |
| 2 | Workspace/Project | 생성·클릭 네비게이션 | 확인 | ✅ |
| 3 | 문서 임포트 | 붙여넣기→저장→목록 반영 | 확인 | ✅ |
| 4 | 문서 뷰어 | 실제 마크다운 렌더 + 링크 활성/비활성 | 확인 | ✅ |
| 5 | 사이드바/⌘K/테마 | 트리·검색·토글 | 확인 | ✅ |
| 6 | 임포트 프리뷰 자동재계산 | 경로 변경 시 | **미확인 대상**(F-9로 미구현 확인됨) | ❌ |

**L2 Score**: 5/6 = 83%

#### L3: E2E 시나리오

| # | 시나리오 | 결과 | Pass |
|---|----------|------|:---:|
| 1 | **cogmo-report 67개 임포트 → 링크 4종 실사용 검증(C6)** | 스크립트+curl로 완전 자동 검증, 67/67 성공 | ✅ |
| 2 | 로그인→문서 생성→수정→삭제 전체 생애주기 | 확인 | ✅ |
| 3 | 딥링크 새로고침 생존 | 확인 | ✅ |

**L3 Score**: 3/3 = 100%

**Runtime Match Rate** = L1×0.4 + L2×0.3 + L3×0.3 = 100×0.4 + 83×0.3 + 100×0.3 = **95%**

### 2.8 Match Rate Summary

```
┌─────────────────────────────────────────────┐
│  Structural Match Rate:  97%                 │
│  Functional Match Rate:  67%                 │
│  Contract Match Rate:    77%                 │
│  Runtime Match Rate:     95%                 │
│  ─────────────────────────────────────────── │
│  Overall Match Rate:     84%                 │
│  = (97×0.15) + (67×0.25) + (77×0.25) + (95×0.35) │
│  = 14.55 + 16.75 + 19.25 + 33.25 = 83.8% ≈ 84%│
├─────────────────────────────────────────────┤
│  ✅ Match:          다수 (핵심 급소 전부)      │
│  ⚠️ Shallow:        §5.4 주변부 12항목        │
│  ❌ Not implemented: 서버 재정규화 2곳(Critical)│
└─────────────────────────────────────────────┘
```

**84% — 90% 문턱 미달.** 단, 미달 원인이 핵심 로직 결함이 아니라 §5.4 주변부 마감(자동제안·필터·프리뷰 재계산)과 에러 코드 일관성에 집중돼 있음. Critical은 1건(서버 재정규화 누락)뿐.

---

## 3. 보안 이슈

| 심각도 | 파일 | 위치 | 내용 | 권장 조치 |
|:---:|------|------|------|-----------|
| 🔴 Critical | `documents.ts` | :64, :91 | 읽기 경로(by-path, links/resolve) 서버 재정규화 누락 | `normalizePath` 적용, 실패 시 400 |
| 🟡 Warning | `server/lib/path.ts` | :17 | `javascript:` URL이 `'external'`로 분류돼 `target="_blank"` 링크로 렌더 (실사용 경로는 rehype-sanitize가 2차 방어하나 방어선 한 겹 비어있음) | `classifyLink`에서 `javascript:`/`data:`/`vbscript:` 명시 차단 |
| 🟢 Info | - | - | XSS 방어(C7)는 실측 기반 구조적 해결로 견고함 | - |

---

## 4. 테스트 커버리지

| 영역 | 현재 | 비고 |
|------|------|------|
| L0(경로 모듈) | T1~T9 전 케이스 + 추가 2건, `path.test.ts` | ✅ Design 요구 충족 |
| L0(schema 스모크) | `schema.test.ts` — 런타임 zod 에러(모듈 전체 다운시켰던 버그) 재발 방지 | ✅ |
| L0(extractLinks) | 4케이스 | ✅ |
| L0(buildDocTree) | 2케이스 | ✅ |
| L2/L3 자동화 | 없음 (Design D-15 결정) | 정당한 스코프 제외 |

전체 25개 Vitest 테스트 통과.

---

## 5. Clean Architecture 준수

Design §9 옵션 C(Pragmatic) 3규칙 검증:

| 규칙 | 확인 |
|------|:---:|
| 1. `api/`는 export만, 로직 0 | ✅ `api/[...route].ts` 4줄 |
| 2. `server/lib/path.ts` 등 급소 모듈은 import 0(순수) | ✅ 확인됨 |
| 3. 컴포넌트는 `@/lib/api` RPC 클라이언트로만 서버 호출 | ✅ 컴포넌트 직접 fetch 0건 |

**3/3 준수.**

---

## 6. 컨벤션 준수

| 항목 | 상태 |
|------|:---:|
| 네이밍(컴포넌트 PascalCase, 훅 `use*`, 유틸 camelCase) | ✅ |
| import 순서 | ✅ (oxlint 클린) |
| `// Design Ref:` / `// Decision:` 주석 | ✅ 핵심 결정마다 근거 남김 |
| 환경변수(`VITE_` 접두사 규칙) | ✅ |

---

## 7. 권장 조치

### 7.1 즉시 (Critical, 3줄 이내씩)

| 우선순위 | 항목 | 파일 |
|:---:|------|------|
| 🔴 1 | `getDocumentByPath` 호출 전 `normalizePath` 적용 | `documents.ts:64` |
| 🔴 2 | `links/resolve`의 `paths` 배열도 `normalizePath` 매핑 후 전달 | `documents.ts:91` |

### 7.2 단기 (Important)

| 우선순위 | 항목 | 파일 |
|:---:|------|------|
| 🟡 1 | `'CONFLICT'` → `'PATH_TAKEN'`으로 통일 | `app.ts:33` |
| 🟡 2 | `classifyLink`에서 `javascript:` 등 명시 차단 | `server/lib/path.ts:17` |
| 🟡 3 | 409 시 [덮어쓰기]/[경로 수정] 선택지 | `ImportDialog.tsx` |
| 🟡 4 | QueryClient 전역 onError(401→로그인, 그 외 토스트) | `app/providers.tsx` |

### 7.3 장기(백로그)

경로 세그먼트 브레드크럼, 자동 제목/kind 제안, 문서뷰 삭제 버튼, 목록 필터(FR-20), 링크 색상 mauve 통일, 에디터 미리보기 링크 판정, shadcn/Zustand 미채택 근거 문서화.

---

## 8. Decision Record 갱신 필요 사항 (문서만, 코드 변경 없음)

Design 문서에 다음 이탈을 Decision Record로 추가 권장:
1. `vercel.json`이 원안 rewrites 대신 저수준 routes 사용 (Vercel Vite 프리셋 실측 버그 근거)
2. `api/[[...route]].ts` → `api/[...route].ts`로 변경
3. shadcn/ui 미채택 (직접 구현으로 충분)
4. Zustand 미사용 (useState+localStorage로 충분)

---

## 9. Checkpoint 5 — 형 결정 및 후속 조치

**형 결정: "Critical만 수정"** — Important 4건·Minor 12건은 백로그로 남기고 진행.

### 9.1 Critical 수정 완료 (2건)

| # | 조치 | 파일 | 실증 |
|---|------|------|------|
| 1 | `documents.ts` by-path에 `normalizePath` 적용, 실패 시 404 | `documents.ts:62-73` | 선행슬래시 경로 정규화 통과(200), `..` 경로 404(500 아님) 확인 |
| 2 | `links/resolve` 후보도 `normalizePath` 매핑, 실패 후보는 조용히 필터링 | `documents.ts:97-110` | 정상/변형/`..` 혼합 배열 요청에서 정상 응답, 500 없음 |

프로덕션 재배포 후 curl 실증(정상 경로 200 / 선행슬래시 정규화 200 / `..` 404 / 배치 혼합 요청 200 무크래시) + RK-01 회귀 없음 확인.

### 9.2 백로그 이관 (Important 4건 + Minor 12건)

Important: CONFLICT/PATH_TAKEN 코드 통일, `javascript:` URL 명시 차단, 409 시 선택지 UI, 전역 QueryClient onError.
Minor: §7.3 참조.

### 9.3 다음 단계

- [x] Critical 2건 수정 및 재검증
- [ ] `report` 문서 작성

---

## Version History

| 버전 | 날짜 | 변경 내용 | 작성자 |
|------|------|-----------|--------|
| 0.1 | 2026-08-07 | 최초 분석. gap-detector 정적 3축 + Runtime 실측 종합. Overall 84% | cogmo |
| 0.2 | 2026-08-07 | Checkpoint 5: 형이 "Critical만 수정" 선택. 서버 재정규화 2건 수정·배포·실증 완료 | cogmo |
