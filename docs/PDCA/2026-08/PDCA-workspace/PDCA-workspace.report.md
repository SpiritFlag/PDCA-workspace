---
template: report
version: 1.1
---

# PDCA-workspace 완료 보고서

> **상태**: 완료 (Match Rate 87%, 형 판단으로 Critical 수정 후 진행 — Important/Minor는 백로그)
>
> **프로젝트**: PDCA-workspace
> **작성자**: Claude
> **완료일**: 2026-08-07
> **PDCA Cycle**: PDCA-workspace (프로젝트 최초 사이클)

---

## Executive Summary

### 1.1 프로젝트 개요

| 항목 | 내용 |
|------|------|
| 기능 | PDCA-workspace — Workspace > Project > Document 웹앱 |
| 시작일 | 2026-08-07 (Plan) |
| 종료일 | 2026-08-07 (Report) |
| 소요 | 단일 세션 연속(Plan→Design→Do×4→Check→Report), 실배포 반복 검증 병행 |

### 1.2 결과 요약

```
┌─────────────────────────────────────────────┐
│  Match Rate: 87% (Critical 수정 후)          │
├─────────────────────────────────────────────┤
│  ✅ 완료:  Success Criteria 9/10             │
│  ⚠️ 부분:  1/10 (C4 — 프리뷰 자동재계산 미구현)│
│  ❌ 미완료: 0/10                              │
└─────────────────────────────────────────────┘
```

### 1.3 실현된 가치

| 관점 | 내용 |
|------|------|
| **Problem** | PDCA 산출물이 레포 파일로만 존재해 조회 불가. 웹으로 옮기면 상대링크(레포 외부 포함)가 죽는 문제 |
| **Solution** | URL 경로 미러링(`/w/ws/p/proj/{레포 경로}`)으로 resolver 없이 브라우저가 링크를 해석. 링크 존재 판정만 서버가 담당 |
| **Function/UX Effect** | 형 계정으로 워크스페이스·프로젝트·문서 CRUD, 마크다운 임포트+에디터+미리보기, 사이드바 트리, ⌘K 검색, Latte/Mocha 테마 전부 실사용 확인. **cogmo-report 실문서 67개**를 실제로 옮겨서 링크 4종(형제·타폴더·디렉터리·레포외부)이 전부 의도대로 동작함을 실증 |
| **Core Value** | "경로가 곧 주소다" — DB에 문서를 넣어도 경로 정보를 URL로 승격시켜 링크 문제를 기능이 아니라 불변식으로 만든 설계가 실제로 지켜짐 |

---

## 1.4 Success Criteria 최종 상태

| # | 기준 | 상태 | 근거 |
|---|------|:---:|------|
| C1 | 3계층 CRUD 전부 동작 | ✅ Met | module-2 전 배치 L1 실증 |
| C2 | 미인증 시 데이터 조회 불가 | ✅ Met | `GET /api/workspaces` 무토큰 401. **Check 단계에서 500 회귀(전역 onError가 HTTPException을 삼킴) 발견·수정·재실증** |
| C3 | 딥링크 새로고침·직접 URL 동작 | ✅ Met | RK-01 스파이크(module-1) + 매 배포마다 회귀 확인 |
| C4 | 임포트 링크 생사 프리뷰 카운트 정확 | ⚠️ Partial | 카운트 로직은 정확(뷰어와 동일 함수 공유)하나 경로 변경 시 자동 재계산 안 됨(수동 재클릭 필요) — 백로그 |
| C5 | 100KB 문서 렌더 무결성 | ✅ Met | 101,588바이트, 원본과 바이트 단위 일치 |
| **C6** | **실데이터 링크 4종 검증(이 사이클의 관문)** | ✅ Met | cogmo-report 67/67 임포트 성공, 형제·타폴더·디렉터리(`tree`)·레포외부(`existing:[]`) 전부 실측 |
| C7 | XSS 페이로드 무력화 | ✅ Met | 67개 문서 실측으로 raw HTML 0건 확인 → `rehype-raw` 자체 미사용(구조적 방어) |
| C8 | dev 검증 → main 적용 절차 | ✅ Met | Neon 두 브랜치에 순차 적용 실증 |
| C9 | 테마 일관성 | ✅ Met (색상 세부 편차 있음) | Latte/Mocha 전 화면 형 확인. 링크 색상이 mauve 대신 blue — 백로그 |
| C10 | 형이 실제 프로덕션 사용 | ✅ Met | 형 계정으로 전 기능 직접 확인 |

**Success Rate**: 9/10 완전 충족 (90%), 1건 부분 충족

## 1.5 Decision Record 요약

| 출처 | 결정 | 준수 | 결과 |
|------|------|:---:|------|
| [Plan] D-13 | URL 경로 미러링 | ✅ | resolver 0줄로 링크 4종 전부 해결 — 이 사이클의 핵심 판단이 그대로 적중 |
| [Plan] Q4 | Neon dev/main 브랜치 분리 | ✅ | 실제 스키마 변경을 dev에서 먼저 검증 후 main 적용하는 절차 실행됨 |
| [Design] 옵션 C(Pragmatic) | 계층 안 나누고 경계만 | ✅ | 신규 파일 ~50개 내외로 방어 표면 최소화, 급소(path.ts) 순수 모듈 유지 |
| [Do/module-1] | Neon Auth = better_auth | ✅ | Plan이 Stack Auth로 가정했던 게 실제론 달랐음(RK-03 적중) — JWKS URL 브랜치별 상이까지 확인 후 대응 |
| [Do/module-4] | vercel.json 저수준 routes 전환 | ✅ (미기록 이탈) | Vercel Vite 프리셋의 optional catch-all 다단 경로 버그 실측 — Design 원안(rewrites)에서 이탈했으나 정당함 |
| [Plan] D-10 | shadcn/ui 채택 | ❌ | 미채택, 직접 구현으로 충분 — 재사용 컴포넌트 라이브러리 없이도 개인 앱 스코프에선 문제없었음 |
| [Plan] D-07 | Zustand 전역 상태 | ❌ | 의존성만 설치, 실제로는 `useState`+localStorage로 충분해서 미사용 |

---

## 2. 관련 문서

| 단계 | 문서 | 상태 |
|------|------|------|
| Plan | [PDCA-workspace.plan.md](./PDCA-workspace.plan.md) | ✅ |
| Design | [PDCA-workspace.design.md](./PDCA-workspace.design.md) | ✅ |
| Check | [PDCA-workspace.analysis.md](./PDCA-workspace.analysis.md) | ✅ |
| Report | 현재 문서 | ✅ |

---

## 3. 완료 항목

### 3.1 기능 요구사항 (Plan §3.1, 20개 중)

| 범위 | 상태 | 비고 |
|------|:---:|------|
| FR-01~FR-10 (Workspace/Project/Document CRUD, 경로 미러 라우팅) | ✅ 완료 | |
| FR-11~FR-12 (임포트, 링크 프리뷰) | ✅ 완료 | 프리뷰 자동 재계산만 부분(C4) |
| FR-13 (에디터) | ✅ 완료 | CodeMirror 6 + 미리보기 토글 + 자동저장(2s 디바운스) |
| FR-14~FR-15 (인증·소유권 스코프) | ✅ 완료 | Check 단계에서 401 회귀 발견·수정 |
| FR-16~FR-17 (사이드바 트리·⌘K) | ✅ 완료 | |
| FR-18 (테마) | ✅ 완료 | |
| FR-19 (PDCA 배지) | ✅ 완료 | |
| FR-20 (목록 필터) | ⏳ 백로그 | Plan상 Low 우선순위, 사유 명시 |

### 3.2 비기능 요구사항

| 항목 | 목표 | 달성 | 상태 |
|------|------|------|:---:|
| 100KB 문서 렌더 | 무결성 | 바이트 단위 일치 | ✅ |
| XSS 방어 | sanitize | raw HTML 0건 실측 기반 구조적 방어 | ✅ |
| 인가 격리 | 타인 데이터 비노출 | 확인(별도 확인용 probe 계정으로 검증) | ✅ |
| 링크 판정 정합성 | resolve == 뷰어 로직 동일 | 코드 레벨 공유 함수로 구조적 보장 | ✅ |

### 3.3 산출물

| 산출물 | 위치 | 상태 |
|--------|------|:---:|
| DB 스키마 + 마이그레이션 | `server/db/schema.ts`, `drizzle/` | ✅ |
| API(15 엔드포인트) | `server/routes/`, `server/app.ts` | ✅ |
| 프론트엔드 3 feature | `src/features/{workspace,project,document}/` | ✅ |
| 셸(사이드바·⌘K·테마) | `src/components/shell/` | ✅ |
| 테스트 | `server/lib/path.test.ts` 외 3개, 25 케이스 | ✅ |
| 배포 | Vercel + Neon(dev/main) | ✅ 프로덕션 가동 중 |

---

## 4. 미완료 항목

### 4.1 다음 사이클 이월

| 항목 | 사유 | 우선순위 |
|------|------|:---:|
| CONFLICT/PATH_TAKEN 에러 코드 통일 | Important, DB 경합 시에만 발생하는 드문 경로 | 중 |
| `javascript:` URL 명시 차단 | Important, 실사용 경로는 rehype-sanitize가 2차 방어 중이라 실제 노출 없음 | 중 |
| 전역 QueryClient onError(401 리다이렉트) | Important, 토큰 만료 시 UX 저하 가능 | 중 |
| 409 시 덮어쓰기/경로수정 선택지 UI | Important | 중 |
| 링크 색상 mauve 통일, 브레드크럼 세그먼트, 자동 제목/kind 제안, 목록 필터(FR-20), 에디터 미리보기 링크 판정 | Minor, 사용에는 지장 없음 | 낮음 |

### 4.2 취소/보류 항목

없음.

---

## 5. 품질 지표

### 5.1 최종 분석 결과

| 지표 | 목표 | 최종 | 비고 |
|------|------|------|------|
| Match Rate | 90% | 87% | Critical 수정 후. Important/Minor 잔여로 미달, 형 판단으로 진행 |
| Structural Match | - | 97% | |
| Functional Depth | - | 67% | §5.4 주변부 마감 미흡이 원인 |
| API Contract | - | 90%(추정, Critical 수정 반영) | 서버 재정규화 복구로 상승 |
| Runtime(L1+L2+L3) | - | 95% | L1 100%(9/9), L2 83%(수동 확인), L3 100%(C6 스크립트 완전 자동 검증) |
| 보안 Critical | 0 | 0 | 서버 재정규화 누락 수정 완료 |
| 테스트 | - | 25/25 통과 | Vitest, L0 전용(Design D-15 결정) |

### 5.2 해소된 이슈

| 이슈 | 해소 방법 | 발견 시점 |
|------|-----------|:---:|
| `@shared` alias가 Vercel 함수 런타임 미해석 | 상대경로로 전환 | module-2 |
| zod `.refine()`+`.partial()` 충돌로 API 전체 다운 | 필드 정의/refine 분리 + 스모크 테스트 추가 | module-2 |
| Vercel Vite 프리셋이 다단 API 경로를 404 처리 | `vercel.json` 저수준 routes로 전환 | module-2 |
| 정적 자산이 SPA 폴백에 삼켜짐(흰 화면) | routes에 `handle: filesystem` 추가 | module-2 |
| postgres unique violation이 raw 500으로 노출 | 전역 onError 409 변환 | module-2 |
| **전역 onError가 인증 401까지 500으로 덮어씀** | `HTTPException` 인스턴스는 통과시키도록 수정 | **module-4(Check 회귀 스윕)** |
| **서버가 클라이언트 path를 재정규화 없이 신뢰** | by-path·links/resolve에 `normalizePath` 적용 | **Check 단계(gap-detector)** |

---

## 6. 회고

### 6.1 잘된 것 (Keep)

- **실측 기반 설계**: Plan 단계에서 cogmo-report 67개 문서를 미리 grep해 링크 4종·XSS 태그 0건을 실측하고 설계에 반영한 게, 이후 전 세션의 리스크를 크게 줄였다.
- **매 배치마다 배포+curl 자체검증**: 로컬 테스트 통과와 실배포 동작은 다른 문제였다(alias 해석, Vercel 라우팅 프리셋 버그 등 5건이 로컬에서는 전혀 안 잡혔다). 배치 단위로 즉시 배포·검증한 덕에 문제를 그 자리에서 잡았다.
- **전체 회귀 스윕의 가치**: 개별 배치 테스트를 다 통과해도 module-4 끝의 전체 회귀에서 C2(401) 500 회귀를 발견했다 — 배치 간 상호작용(전역 onError가 나중에 추가된 인증 흐름을 덮어씀)은 배치 단위 테스트로는 못 잡는 부류였다.
- **형의 즉각적인 브라우저 피드백**("흰화면", "그 db가 서로 다른거같은데")이 API 레벨 자체검증만으로는 못 잡는 문제(SPA 폴백, 계정 분리로 인한 혼선)를 빠르게 짚어줬다.

### 6.2 개선이 필요한 것 (Problem)

- **에러 코드 설계를 미리 확정하지 않음**: 같은 "경로 중복"에 `PATH_TAKEN`과 `CONFLICT` 두 코드가 생긴 건, 각 배치에서 필요할 때마다 즉흥적으로 코드를 만들었기 때문. Design §6.1에 에러 코드 표를 먼저 못박았어야 했다.
- **§5.4 Page UI Checklist를 매 배치 끝에 대조하지 않음**: 27항목을 Design 작성 시점에 만들어두고 마지막 Check에서야 gap-detector로 전수 대조했다. 배치별로 그때그때 체크했으면 미구현 6건 중 일부는 훨씬 싸게 잡혔을 것.
- **번들 사이즈 무대응**: CodeMirror 도입 후 450KB→1.25MB로 뛰었는데 스코프 밖이라 방치. 개인 앱이라 지금은 무해하지만 인지하고 넘어간 것과 놓친 것은 다르다.

### 6.3 다음에 시도할 것 (Try)

- Design 문서에 에러 코드 표를 Plan/Design 단계에서 먼저 확정하고 모든 라우트가 그 표만 참조하게 강제.
- 배치 승인(Checkpoint 4) 시점에 "이번 배치가 커버하는 §5.4 체크리스트 항목" 매핑을 명시적으로 뽑아서, 배치 완료 시 그 항목만이라도 즉시 대조.
- 코드 분할(`dynamic import`)을 처음부터 고려해 CodeMirror·react-markdown 같은 무거운 라이브러리를 lazy load.

---

## 7. 프로세스 개선 제안

### 7.1 PDCA 프로세스

| 단계 | 현재 | 개선 제안 |
|------|------|-----------|
| Design | §5.4 체크리스트를 통짜로 작성 | 모듈별로 커버 항목을 미리 태깅해 Do 단계 배치 승인에 자동 반영 |
| Do | 배치별 배포 검증은 잘함 | 배치 간 상호작용(전역 미들웨어 등)은 마지막 회귀에서만 잡힘 — 미들웨어/전역 설정 변경 배치는 즉시 인접 기능 재검증 규칙화 |
| Check | gap-detector 정적 분석 + 본인 Runtime 종합 | 이 조합이 유효했음. 유지 |

### 7.2 도구/환경

| 영역 | 개선 제안 | 기대 효과 |
|------|-----------|-----------|
| 빌드 | 코드 분할 도입 | 초기 로드 개선 |
| 테스트 | Playwright 최소 도입 검토(개인 앱 스코프 재논의) | L2/L3 자동화로 회귀 스윕 신뢰도 상승 |

---

## 8. 다음 단계

### 8.1 즉시

- [x] Critical 이슈 수정·재배포·재검증 (완료)
- [ ] 사이클 종료 절차: 저장소 전체 링크 전수 검증 스크립트 실행
- [ ] `docs/PDCA/_INDEX.md`에 행 추가
- [ ] docs 커밋 1개 (RULE.md 규칙: PDCA 문서는 사이클 종료 시점에만 커밋)

### 8.2 다음 사이클 후보

| 항목 | 우선순위 | 비고 |
|------|:---:|------|
| Important 4건 정리(에러 코드 통일, 전역 에러 핸들러, javascript: 차단, 409 선택지) | 중 | 백로그 |
| 목록 필터(FR-20), 자동 제안류 | 낮음 | 백로그 |
| 코드 분할 | 낮음 | 성능, 개인 앱이라 급하지 않음 |

---

## 9. Changelog

### v0.1.0 (2026-08-07)

**Added:**
- Workspace/Project/Document 3계층 CRUD
- URL 경로 미러링 뷰어 + 링크 4종 판정(형제/타폴더/디렉터리/레포외부)
- better-auth 로그인, Neon Auth JWT 인증
- 마크다운 임포트 + CodeMirror 6 에디터 + 자동저장
- 사이드바 문서 트리, ⌘K 커맨드팔레트, Catppuccin Latte/Mocha 테마
- cogmo-report 실문서 67개 임포트 검증 스크립트

**Fixed:**
- postgres 유니크 제약 500 → 409 표준화
- 전역 onError의 인증 401 삼킴 (Check 단계 발견)
- 서버 재정규화 누락(by-path, links/resolve) (Check 단계 발견)
- Vercel 다단 API 경로 라우팅 실패
- SPA 폴백이 정적 자산을 삼키던 흰 화면 버그

---

## Version History

| 버전 | 날짜 | 변경 내용 | 작성자 |
|------|------|-----------|--------|
| 0.1 | 2026-08-07 | 완료 보고서 최초 작성. Match Rate 87%(Critical 수정 후), Success Rate 9/10 | Claude |
