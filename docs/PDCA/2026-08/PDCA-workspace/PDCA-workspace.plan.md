---
template: plan
version: 1.3
---

# PDCA-workspace 계획 문서

> **한 줄 요약**: 형 개인용 PDCA·산출물 관리 웹앱을 Workspace > Project > Document 3계층으로
> 세우되, **문서 URL을 레포 경로 그대로 미러링**해서 마크다운 상대링크가 resolver 없이
> 브라우저 기본 동작만으로 살아있게 한다.
>
> **프로젝트**: PDCA-workspace
> **작성자**: Claude
> **작성일**: 2026-08-07
> **상태**: Draft (v0.1 — Checkpoint 1·2 답변 반영)
> **PDCA Cycle**: PDCA-workspace (프로젝트 최초 사이클)

---

## Executive Summary

| 관점 | 내용 |
|------|------|
| **Problem** | 형이 만든 PDCA 산출물(cogmo-report 기준 67개 문서, 271KB)이 레포 안 마크다운 파일로만 존재한다. 레포를 클론하지 않으면 못 보고, 여러 프로젝트에 흩어지면 가로지르는 조회가 불가능하고, 문서 간 관계(어느 사이클이 어느 리뷰를 받았나)가 파일 시스템에만 암묵적으로 있다. 반면 단순히 "웹 뷰어"를 만들면 **링크가 죽는다** — 실측해보니 문서들이 `](../../../../app/infrastructure/db/repository.py#L52)` 처럼 docs 트리 **밖** 소스코드까지 라인 앵커째로 가리키고 있다(17종). |
| **Solution** | Workspace > Project > Document 3계층을 Neon Postgres에 두고, 문서마다 **레포 루트 기준 경로**(`path`)를 1급 컬럼으로 저장한다. 뷰어 URL을 `/w/{ws}/p/{proj}/{path}` 로 **경로를 그대로 미러링**하면 상대링크 해석은 브라우저가 공짜로 해준다 — 앱은 resolver를 만들 필요가 없고, 대상 문서 존재 여부만 조회해서 없는 링크를 비활성 표시하면 된다. 문서 유입은 마크다운 RAW 붙여넣기 + 제목·경로 지정. |
| **Function/UX Effect** | 형은 브라우저 하나로 모든 프로젝트의 PDCA 문서를 읽고 쓰고, 문서 안 링크를 실제로 눌러 이동할 수 있다. 죽은 링크(레포 소스코드 등)는 회색 비활성으로 표시돼 "깨진 척"을 하지 않는다. Catppuccin 파스텔 + 노션/리니어형 셸. |
| **Core Value** | **경로가 곧 주소다.** 문서를 DB에 넣으면 보통 경로 정보가 증발하고 링크도 같이 죽는데, 경로를 버리지 않고 URL로 승격시키면 링크 문제 전체가 "구현할 기능"이 아니라 "지키기만 하면 되는 불변식"이 된다. |

---

## Context Anchor

> Executive Summary에서 생성. Design/Do 문서로 전파되어 세션 간 컨텍스트 연속성 유지.

| Key | Value |
|-----|-------|
| **WHY** | PDCA 산출물이 레포 안 파일로만 존재해 조회·관리가 안 된다. 그렇다고 웹으로 옮기면 문서 간 상대링크(특히 docs 밖 소스코드 링크 17종)가 전부 죽는다. |
| **WHO** | 형 단독. 공유·협업·다중 유저 없음. 인증은 "나 말고 아무도 못 보게" 수준. |
| **RISK** | Vercel이 `.md`로 끝나는 URL을 정적 파일로 오인해 SPA 라우팅이 안 먹는 것(RK-01, 링크 요구사항 전체를 무너뜨림) / `path` 오입력이 조용히 링크를 죽이는 것(RK-02) / Neon Auth를 Vite SPA에 붙이는 경로가 Next.js 대비 덜 다져진 것(RK-03). |
| **SUCCESS** | C1~C10. 핵심은 **C6 — cogmo-report docs 67개를 실제로 넣고, 문서 내 마크다운 링크가 종류별(형제/타폴더/디렉터리/레포외부) 전부 의도대로 동작**(앞 3종 이동, 마지막 1종 비활성). |
| **SCOPE** | 축1 3계층 CRUD(Workspace/Project/Document) / 축2 경로 미러 뷰어 + 링크 판정 / 축3 에디터·테마·셸 / 축4 배포 파이프라인(Vercel main 직배 + Neon 브랜치 2개). 다중 유저·권한·전문검색·Git 동기화·실시간 협업은 스코프 외. |

---

## 1. Overview

### 1.1 목적

1. **산출물 단일 창구** — 여러 프로젝트에 흩어진 PDCA 문서를 Workspace > Project > Document
   한 트리에서 읽고 쓴다.
2. **링크 무결성 보존** — 레포에서 잘라온 문서의 마크다운 링크가 웹에서도 살아있게 한다.
   살릴 수 없는 링크는 **깨진 채로 두지 말고 비활성으로 명시**한다.
3. **작성 경험** — 마크다운 작성/미리보기가 노션·리니어급으로 쾌적해야 한다. 그래야 형이
   실제로 레포 대신 여기서 쓴다.

### 1.2 배경

형은 cogmo-report에서 PDCA를 실제로 굴려왔고, 그 결과 `docs/PDCA/YYYY-MM/{feature}/` 아래
plan·design·analysis·report 4종 규격이 자리잡았다(cogmo-report `CLAUDE.md`에 명문화). 현재
67개 문서 271KB, 최대 문서 101KB.

이 문서들은 **고립된 텍스트가 아니라 링크로 짜인 그래프**다. 사이클 문서끼리 서로를
참조하고, 코드리뷰 문서를 참조하고, 레포 소스코드의 특정 라인을 참조한다. "DB에 넣고
웹으로 보여준다"를 순진하게 하면 이 그래프가 통째로 끊긴다 — 이번 사이클이 실제로 푸는
문제는 CRUD가 아니라 이 그래프 보존이다.

### 1.3 확정 사실 (실측)

Plan 작성 시점에 cogmo-report `docs/`를 직접 스캔해 확정한 사실이다. Design은 이 표를
전제로 한다.

| # | 확인 항목 | 결과 | 근거 |
|---|-----------|------|------|
| F1 | 문서 규모 | 마크다운 67개 / 총 271KB / 최대 단일 문서 101KB (`260730-code-review-fix-cycle-4.plan.md`) | `find`+`wc -c` 실측 |
| F2 | 링크 종류 ① 형제 문서 | `](refine-db-cycle-1.plan.md)`, `](./refine-jenkins-ci.design.md)` — 같은 폴더 | 전수 grep |
| F3 | 링크 종류 ② docs 내 타 폴더 | `](../../../code-review/260730-code-review.md)`, `](../PDCA/_INDEX.md)`, `](../260731-python-314/260731-python-314.plan.md)` | 전수 grep |
| F4 | 링크 종류 ③ **디렉터리 링크** | `](../260731-python-314/)` — 파일이 아니라 폴더로 끝남 | 전수 grep, 4회 등장 |
| F5 | 링크 종류 ④ **docs 트리 밖 = 레포 소스코드** | **17종**. `](../../../../app/infrastructure/db/repository.py#L52)`, `](../../../../CLAUDE.md)`, `](../../../../tests/golden/README.md)`, `](../../../../reports/)` — `#L52`, `#L73-L83` 라인 앵커 포함 | 전수 grep |
| F6 | 상대경로 깊이 | 문서는 `docs/PDCA/YYYY-MM/{feature}/x.md`(레포 루트 기준 5단). 여기서 `../../../../`는 정확히 **레포 루트**를 가리킴 | 경로 산술 검증 |
| F7 | 문서 규격 | 표준 4종 `plan`/`design`/`analysis`/`report` + 임시 `.tmp` | cogmo-report `CLAUDE.md` |
| F8 | 로컬 환경 | **node/npm 미설치**(`node -v` → not found, nvm 없음). 이 디렉터리는 **git 저장소 아님** | 실측 |

**F6이 이번 설계의 핵심 근거다.** URL을 `/w/{ws}/p/{proj}/` + 레포 상대경로로 구성하면,
`docs/PDCA/2026-08/x/x.plan.md` 문서에서 `../../../../CLAUDE.md`는 브라우저 표준
상대 URL 해석만으로 `/w/{ws}/p/{proj}/CLAUDE.md`에 정확히 떨어진다. 앱이 계산할 게 없다.

### 1.4 Checkpoint 1·2 결정 사항

형에게 확인받은 답이다. (질문 파일 `PDCA-workspace.questions.tmp`는 반영 후 삭제)

| # | 질문 | 형의 답 |
|---|------|---------|
| Q1 | 문서 유입 방식 | **마크다운 RAW 붙여넣기.** 넣을 때 문서명과 경로(필요 시)를 지정. GitHub 동기화 없음. |
| Q2 | 링크 해석 규칙 | **워크스페이스 URL을 `docs/` 아래 구조 그대로 미러링**해서 상대경로 resolve를 안 한다. 해석 결과에 문서가 없는 링크(`CLAUDE.md` 등)만 **비활성화**. |
| Q3 | 파스텔 라이브러리 | **Tailwind** 확정. 색은 평소 daisyUI였는데 이번엔 **Catppuccin** 시도. |
| Q4 | 배포/DB | **Neon 브랜치 분리** — 로컬은 dev 브랜치, 프로덕션은 main 브랜치. main 직배 유지. |

### 1.5 관련 문서

- 요구사항 원문: `prompt.tmp` (RULE.md의 `.tmp` 규칙에 따라 답변 반영 후 삭제됨 — `c48d434`. 내용은 위 §1.4 Checkpoint 1·2 답변에 반영되어 있다)
- 프로젝트 규칙: [CLAUDE.md](../../../../CLAUDE.md)
- 문서 구조 레퍼런스: `cogmo-report` 저장소 `docs/` (외부 저장소, 본 저장소 링크 아님)

---

## 2. Scope

### 2.1 In Scope

- [ ] Workspace CRUD (단일 소유자 기준)
- [ ] Project CRUD — 이름, 서비스 URL, GitHub URL, 설명
- [ ] Document CRUD — 마크다운 본문 + 문서명 + **레포 기준 경로**
- [ ] Document 분류 — `pdca`(stage: plan/design/analysis/report) / `general`
- [ ] **경로 미러 라우팅** — `/w/{ws}/p/{proj}/{path}` 로 문서 조회
- [ ] **링크 활성/비활성 판정** — 렌더 시 링크 대상 문서 존재 여부를 일괄 조회해 표시
- [ ] **디렉터리 링크 처리** — `.../foo/` 형태는 경로 prefix 조회로 폴더 뷰 제공
- [ ] 마크다운 RAW 붙여넣기 임포트 (제목·경로 지정, 경로 프리뷰)
- [ ] 마크다운 에디터 — 작성/편집 + 미리보기
- [ ] Neon Auth 로그인 + 전 쿼리 소유자 스코프
- [ ] Catppuccin 팔레트 기반 테마 (Latte 라이트 / Mocha 다크)
- [ ] 노션/리니어형 셸 — 사이드바 문서 트리, 검색(제목·경로), 키보드 내비게이션
- [ ] Vercel 배포 + Neon 브랜치 2개(dev/main) 마이그레이션 절차

### 2.2 Out of Scope

- 다중 유저 / 초대 / 권한 모델 (스키마에 `owner_id`만 심어두고 확장 여지는 남김)
- GitHub 레포 자동 동기화 / 웹훅 / PR 생성 (Q1에서 명시적으로 제외)
- 죽은 링크의 GitHub URL 폴백 (`project.github_url` 컬럼은 미리 두되, v1에선 비활성 표시까지만 — 백로그)
- 문서 본문 전문 검색 (제목·경로 검색만. Postgres FTS는 백로그)
- 문서 리비전 히스토리 테이블 (문서 안 Version History 표로 대체. 백로그)
- 실시간 협업 편집 / 코멘트 / 알림
- 첨부 이미지 업로드 (마크다운 내 외부 이미지 URL만 렌더)
- 모바일 전용 레이아웃 (반응형은 하되 최적화 대상 아님)

---

## 3. Requirements

### 3.1 기능 요구사항

| ID | 요구사항 | 우선순위 | 상태 |
|----|----------|:--------:|------|
| FR-01 | Workspace 생성/조회/수정/삭제. 삭제 시 하위 Project·Document 캐스케이드 | High | Pending |
| FR-02 | Project 생성/조회/수정/삭제. 필드: 이름, 슬러그, 서비스 URL, GitHub URL, 설명 | High | Pending |
| FR-03 | Document 생성/조회/수정/삭제. 필드: 제목, 경로, 종류(pdca/general), PDCA 단계, 본문 | High | Pending |
| FR-04 | Document는 `(project_id, path)` 조합이 유일해야 한다 | High | Pending |
| FR-05 | `/w/{ws}/p/{proj}/{path}` URL로 문서를 직접 연다 (딥링크·새로고침·뒤로가기 전부 동작) | High | Pending |
| FR-06 | 마크다운 렌더링 — GFM(표, 체크박스, 코드펜스, 각주) 지원 | High | Pending |
| FR-07 | 렌더된 링크 중 **워크스페이스 내에 대상 문서가 있는 것**은 SPA 내부 이동으로 동작 | High | Pending |
| FR-08 | 대상이 없는 링크는 **비활성 표시**(클릭 불가 + 시각적 구분 + 사유 툴팁) | High | Pending |
| FR-09 | `/`로 끝나는 디렉터리 링크는 경로 prefix 조회 결과를 폴더 뷰로 보여준다 | Medium | Pending |
| FR-10 | 외부 링크(`http(s)://`)는 새 탭으로 정상 동작 | Medium | Pending |
| FR-11 | 마크다운 RAW 붙여넣기 임포트 — 붙여넣고 제목·경로 지정 후 저장 | High | Pending |
| FR-12 | 임포트/편집 시 경로 입력에 **링크 검사 프리뷰** — 이 경로로 저장하면 문서 내 링크 몇 개가 살고 몇 개가 죽는지 표시 | High | Pending |
| FR-13 | 에디터 — 작성/편집 + 미리보기(분할 또는 토글) | High | Pending |
| FR-14 | Neon Auth 로그인. 미인증 시 전 라우트 차단 | High | Pending |
| FR-15 | 모든 데이터 접근은 로그인 사용자 소유 Workspace로 스코프 | High | Pending |
| FR-16 | 사이드바 문서 트리 — 경로 계층으로 자동 구성(폴더 접기/펴기) | Medium | Pending |
| FR-17 | 커맨드 팔레트 / 빠른 이동 — 제목·경로 부분일치 | Medium | Pending |
| FR-18 | Catppuccin Latte(라이트) / Mocha(다크) 테마 토글 | Medium | Pending |
| FR-19 | PDCA 문서는 단계(plan/design/analysis/report) 배지로 구분 표시 | Low | Pending |
| FR-20 | 문서 목록에서 종류·단계 필터 | Low | Pending |

### 3.2 비기능 요구사항

| 범주 | 기준 | 측정 방법 |
|------|------|-----------|
| 성능 | 100KB 문서 렌더 후 상호작용까지 < 1.5s (로컬 기준) | 최대 문서(101KB) 실측 |
| 성능 | 문서 조회 API p95 < 400ms (Vercel 서버리스 웜) | 배포 후 실측 |
| 보안 | 붙여넣기 마크다운은 **반드시 sanitize**. `<script>`·이벤트 핸들러·`javascript:` URL 차단 | XSS 페이로드 문서를 넣어 실증 |
| 보안 | `DATABASE_URL`은 서버 함수에만. 클라이언트 번들에 DB 크리덴셜 0 | 빌드 산출물 grep |
| 보안 | 타인 소유 Workspace ID를 직접 때려도 404/403 | 수동 검증 |
| 정합성 | **링크 무결성** — 형제/타폴더/디렉터리 링크 정상 이동, 레포 외부 링크는 비활성 | C6 실데이터 검증 |
| 접근성 | 비활성 링크가 색상만이 아니라 텍스트/아이콘으로도 구분됨 | 수동 검증 |

---

## 4. Success Criteria

| ID | 기준 | 검증 방법 |
|----|------|-----------|
| **C1** | Workspace / Project / Document 3계층 CRUD가 전부 동작한다 | 각 엔티티 생성→수정→삭제 1회전 |
| **C2** | Neon Auth 로그인 없이는 어떤 데이터도 조회되지 않는다 | 로그아웃 상태로 API 직접 호출 → 401 |
| **C3** | `/w/{ws}/p/{proj}/docs/PDCA/2026-08/x/x.plan.md` 딥링크가 새로고침·뒤로가기까지 동작한다 | 프로덕션 배포본에서 직접 URL 입력 |
| **C4** | 붙여넣기 임포트로 문서를 넣을 때 경로를 지정할 수 있고, 링크 검사 프리뷰가 살/죽은 링크 수를 맞게 센다 | 실제 문서로 대조 |
| **C5** | 100KB 문서(`260730-code-review-fix-cycle-4.plan.md`)가 렌더 깨짐 없이 표시된다 | 실문서 렌더 |
| **C6** | **cogmo-report docs 67개를 넣고, 링크 4종이 전부 의도대로 동작한다** — ①형제 ②타폴더 ③디렉터리 이동 / ④레포외부 비활성 | 종류별 실링크를 직접 클릭해 확인 (F2~F5의 실제 사례로) |
| **C7** | XSS 페이로드가 든 마크다운을 넣어도 스크립트가 실행되지 않는다 | 페이로드 문서 실투입 |
| **C8** | 마이그레이션을 Neon dev 브랜치에서 먼저 적용해 검증한 뒤 main에 적용하는 절차가 문서화·실행된다 | 실제 스키마 변경 1회를 이 절차로 통과 |
| **C9** | Catppuccin Latte/Mocha 토글이 전 화면에 일관 적용된다 | 전 화면 순회 |
| **C10** | Vercel 프로덕션 배포가 완료되고 형이 실제로 브라우저에서 문서를 읽고 쓴다 | 형 확인 |

### 4.1 Definition of Done

- [ ] FR-01~FR-20 구현 (Low 항목은 미달 시 사유 명시)
- [ ] C1~C10 전부 충족
- [ ] 링크 판정 로직에 단위 테스트 (경로 정규화·존재 판정)
- [ ] `analysis` 문서로 Gap 분석 완료
- [ ] `report` 문서 작성 + `docs/PDCA/_INDEX.md` 행 추가 + 링크 전수 검증

---

## 5. Risks and Mitigation

| ID | 리스크 | 영향 | 확률 | 완화 |
|----|--------|:----:|:----:|------|
| **RK-01** | **Vercel이 `.md`로 끝나는 URL을 정적 파일 요청으로 오인**해 SPA rewrite가 안 먹고 404. 이 사이클 요구사항 전체(경로 미러)가 무너짐 | High | Medium | Phase 0에서 **최소 스파이크 먼저** — 빈 Vite 앱 + `vercel.json` rewrite로 `/a/b/c.md`가 index.html에 도달하는지 실배포로 확인하고 진행. 실패 시 대안(경로에서 `.md` 제거 + 링크 재작성)으로 즉시 선회 |
| **RK-02** | 경로 미러는 `path` 정확성에 전적으로 의존 — 오타 하나면 문서 내 모든 상대링크가 **조용히** 죽는다 | High | High | FR-12 링크 검사 프리뷰를 필수로. 저장 전에 "살 링크 N개 / 죽을 링크 M개"를 보여주고, 죽는 링크 목록을 펼쳐서 확인 가능하게 |
| **RK-03** | Neon Auth(Stack Auth)의 공식 가이드가 Next.js 중심이라 **Vite SPA + Vercel Functions** 조합에서 JWT 검증 경로가 덜 다져져 있을 수 있음 | High | Medium | Phase 2 착수 전 스파이크. 막히면 대안 2개 — ⓐ Stack Auth 순수 REST/JWKS 검증 직접 구현 ⓑ 단일 유저이므로 임시로 환경변수 기반 단일 비밀번호 게이트 후 Auth는 별도 사이클로 이관 |
| **RK-04** | 붙여넣기 RAW 마크다운 XSS. 형 문서엔 HTML이 섞여 있고(`<br>`, `<details>`) 전부 막으면 렌더가 깨짐 | High | Medium | `rehype-sanitize` 화이트리스트 방식. cogmo-report 67개 문서의 실제 인라인 HTML 태그를 전수 조사해 화이트리스트를 실데이터로 결정 (C7) |
| **RK-05** | 마이그레이션 실수로 프로덕션 문서 유실 | High | Low | Q4 결정대로 Neon dev/main 브랜치 분리. 파괴적 마이그레이션은 형 승인 후 실행(CLAUDE.md 규칙) |
| **RK-06** | Neon HTTP 드라이버(`@neondatabase/serverless`)는 인터랙티브 트랜잭션 제약이 있음. 캐스케이드 삭제·일괄 임포트에서 걸릴 수 있음 | Medium | Medium | 캐스케이드는 애플리케이션이 아니라 **DB FK `on delete cascade`**로 처리. 다건 임포트는 단일 `insert ... values (...)` 배치 |
| **RK-07** | 100KB 문서 렌더가 메인 스레드를 막아 UI가 얼어붙음 | Medium | Medium | 실측 우선(C5). 초과 시 렌더 청킹 또는 `react-markdown` → 서버 사전 렌더로 전환 |
| **RK-08** | 디렉터리 링크(F4)와 파일 링크가 URL상 구분되지 않아 라우팅이 모호해짐 | Low | Medium | 규칙 고정 — **끝이 `/`면 디렉터리, 아니면 문서.** 정확히 이 판정만 하고 추론하지 않음 |
| **RK-09** | node 미설치·git 미초기화(F8)로 Phase 1 착수가 지연됨 | Low | High | Phase 0에 명시적으로 편성 |

---

## 6. Impact Analysis

> 신규 프로젝트라 기존 소비자는 없다. 대신 **외부 의존 인벤토리**로 대체한다 —
> 각 항목이 죽거나 스펙이 바뀌면 무엇이 무너지는지.

| 의존 | 종류 | 무엇에 쓰나 | 끊기면 |
|------|------|-------------|--------|
| Neon Postgres | 인프라 | 전 데이터 | 앱 전체 정지 |
| Neon Auth (Stack Auth) | 인프라 | 로그인·세션 | 접근 불가 (RK-03 대안 존재) |
| Vercel | 인프라 | 정적 호스팅 + 서버리스 함수 | 배포 불가. 로컬 개발은 무관 |
| Drizzle ORM | 라이브러리 | 스키마·쿼리·마이그레이션 | 마이그레이션 이력이 `drizzle/` SQL로 남아 있어 이관 가능 |
| `react-markdown` + `remark-gfm` + `rehype-sanitize` | 라이브러리 | 렌더·보안 | **링크 판정과 XSS 방어의 급소.** 교체 시 C6·C7 재검증 필수 |
| Tailwind + Catppuccin 팔레트 | 라이브러리 | 스타일 | 시각만 영향 |
| shadcn/ui (Radix) | 라이브러리 | 컴포넌트 | 소스 복사 방식이라 벤더 리스크 낮음 |

### 6.1 검증

- [ ] Neon Auth의 Vite SPA 지원 상태를 Design 착수 전 실검증 (RK-03)
- [ ] `rehype-sanitize` 화이트리스트를 cogmo-report 실문서 인라인 HTML 전수 조사로 결정 (RK-04)
- [ ] Vercel `.md` URL rewrite를 코드 작성 전 스파이크로 확인 (RK-01)

---

## 7. Architecture Considerations

### 7.1 프로젝트 레벨

| Level | 성격 | 선택 |
|-------|------|:----:|
| Starter | 정적 사이트 | ☐ |
| **Dynamic** | 기능 기반 모듈 + 백엔드 연동. 웹앱/SaaS MVP | ☑ |
| Enterprise | 엄격한 레이어 분리, DI, 마이크로서비스 | ☐ |

단일 유저 개인 앱 + 서버리스 CRUD. Enterprise 레이어링은 명백한 과설계다.

### 7.2 핵심 아키텍처 결정 (Decision Record)

| # | 결정 | 후보 | 채택 | 근거 |
|---|------|------|------|------|
| D-01 | 프레임워크 | Next.js / **Vite+React** | Vite+React | 형 지정. SSR 불필요(개인용·로그인 필수라 SEO 0) |
| D-02 | 서버 | Vercel Serverless Functions / 별도 서버 | Vercel Functions | 형 지정 스택. DB 크리덴셜을 브라우저에서 격리할 최소 서버가 필요 |
| D-03 | API 프레임워크 | 파일당 함수 / **Hono 단일 캐치올** | Hono `api/[[...route]].ts` | 라우트가 늘어도 함수 1개 → 콜드스타트 표면 최소. `hc<AppType>` RPC로 프론트-백 타입이 컴파일 타임에 묶임 |
| D-04 | DB 드라이버 | node-postgres / **@neondatabase/serverless** | Neon HTTP 드라이버 | 서버리스에서 커넥션 풀 고갈이 구조적으로 발생하지 않음. 제약은 RK-06으로 관리 |
| D-05 | ORM | **Drizzle** / Prisma | Drizzle | 형 제안. 마이그레이션이 평문 SQL로 남아 Neon 브랜치 절차(C8)와 궁합이 좋음 |
| D-06 | 서버 상태 | **TanStack Query** / SWR / 수동 | TanStack Query | 캐시 무효화·낙관적 갱신(문서 자동저장)이 기본 제공 |
| D-07 | 클라이언트 상태 | **Zustand** / Context / Redux | Zustand | 전역 상태가 얼마 없음(테마·사이드바·팔레트). Redux는 과함 |
| D-08 | 스타일 | **Tailwind** | Tailwind | 형 확정 |
| D-09 | 팔레트 | daisyUI / **Catppuccin** | Catppuccin | 형 선택. Latte(라이트)/Mocha(다크) 2종만 채택하고 4종 전부는 안 씀 |
| D-10 | 컴포넌트 | **shadcn/ui** / Mantine / 직접 | shadcn/ui | 소스 복사 방식이라 Catppuccin 토큰을 컴포넌트 내부까지 밀어넣기 쉬움. Radix라 접근성·키보드 내비 확보 |
| D-11 | 마크다운 | **react-markdown + remark-gfm + rehype-sanitize** / marked | react-markdown | 링크를 **React 컴포넌트로 가로챌 수 있는 것**이 결정적 — FR-07/08의 활성·비활성 판정이 여기서 구현됨 |
| D-12 | 에디터 | **CodeMirror 6** / Monaco / textarea | CodeMirror 6 | Monaco는 번들이 너무 크고, textarea는 노션급이 아님. CM6는 마크다운 문법 강조 + 가벼움 |
| D-13 | 링크 해석 | resolver 구현 / **URL 경로 미러링** | 경로 미러링 | **형 제안.** F6이 근거. 브라우저 표준 상대 URL 해석이 앱 로직을 대체 |
| D-14 | 폼 | **react-hook-form** + zod | react-hook-form | 서버 zod 스키마를 클라이언트와 공유 |
| D-15 | 테스트 | **Vitest**(단위) + 수동(E2E) | Vitest | 개인 앱. E2E 자동화는 과함. 단 **경로 정규화·링크 판정은 반드시 단위 테스트** |

### 7.3 데이터베이스 스키마 및 관계도 (Drizzle 기준) — *Action Item 1*

#### 관계도

```
neon_auth.users_sync (Neon Auth 관리, 앱은 읽기만)
        │ 1
        │
        │ N
   workspaces ─────1───────N───── projects ─────1───────N───── documents
   - id (uuid, pk)          - id (uuid, pk)          - id (uuid, pk)
   - owner_id ──┘           - workspace_id (fk)      - project_id (fk)
   - name                   - name                   - title
   - slug        UQ(owner,  - slug       UQ(ws,slug) - path      UQ(proj,path)
   - description     slug)  - service_url            - kind      pdca|general
   - created_at             - github_url             - pdca_stage plan|design|
   - updated_at             - github_branch                       analysis|report
                            - description            - content   (text)
                            - created_at             - created_at
                            - updated_at             - updated_at
```

전부 1:N이다. 다대다 없음.

#### 테이블 정의

**`workspaces`**

| 컬럼 | 타입 | 제약 | 설명 |
|------|------|------|------|
| `id` | uuid | PK, default gen_random_uuid() | |
| `owner_id` | text | NOT NULL, index | Neon Auth 사용자 ID. **다중 유저 확장 여지** |
| `name` | text | NOT NULL | 표시명 |
| `slug` | text | NOT NULL | URL 세그먼트 |
| `description` | text | | |
| `created_at` / `updated_at` | timestamptz | NOT NULL, default now() | |

- UNIQUE `(owner_id, slug)` — 같은 사람 안에서만 슬러그 유일

**`projects`**

| 컬럼 | 타입 | 제약 | 설명 |
|------|------|------|------|
| `id` | uuid | PK | |
| `workspace_id` | uuid | FK → workspaces.id **ON DELETE CASCADE**, index | |
| `name` | text | NOT NULL | 프로젝트명 |
| `slug` | text | NOT NULL | URL 세그먼트 |
| `service_url` | text | | 서비스 URL |
| `github_url` | text | | GitHub 저장소 URL |
| `github_branch` | text | default `'main'` | 죽은 링크 GitHub 폴백용 (v1 미사용, 백로그 대비) |
| `description` | text | | |
| `created_at` / `updated_at` | timestamptz | NOT NULL | |

- UNIQUE `(workspace_id, slug)`

**`documents`**

| 컬럼 | 타입 | 제약 | 설명 |
|------|------|------|------|
| `id` | uuid | PK | |
| `project_id` | uuid | FK → projects.id **ON DELETE CASCADE**, index | |
| `title` | text | NOT NULL | 문서명 |
| `path` | text | NOT NULL | **레포 루트 기준 경로.** 예: `docs/PDCA/2026-08/x/x.plan.md` |
| `kind` | enum(`pdca`,`general`) | NOT NULL | |
| `pdca_stage` | enum(`plan`,`design`,`analysis`,`report`) | NULL 허용 | `kind='pdca'`일 때만 채움 |
| `content` | text | NOT NULL | 마크다운 RAW |
| `created_at` / `updated_at` | timestamptz | NOT NULL | |

- UNIQUE `(project_id, path)` ← **FR-04. 링크 판정 조회가 이 인덱스를 그대로 탄다**
- INDEX `(project_id, path text_pattern_ops)` ← 디렉터리 링크의 prefix 조회(FR-09)용
- CHECK: `kind='general'`이면 `pdca_stage IS NULL`

`path` 정규화 규칙(불변식):
- 선행 `/` 없음, `./` 없음, `..` 없음 (저장 전 정규화)
- 소문자 강제 안 함 (`CLAUDE.md` 대소문자 보존)
- 디렉터리는 문서가 아니므로 저장 대상 아님 — 폴더 뷰는 prefix 조회로 파생

### 7.4 프로젝트 디렉터리 구조 — *Action Item 2*

```
PDCA-workspace/
├── api/
│   └── [[...route]].ts        # Vercel 진입점. Hono 앱을 export만 하는 얇은 파일
├── server/                     # 함수 본문 (진입점과 분리해 테스트 가능하게)
│   ├── app.ts                  # Hono 앱 조립 + AppType export (RPC 타입 원천)
│   ├── db/
│   │   ├── client.ts           # Neon HTTP 드라이버 + Drizzle 인스턴스
│   │   ├── schema.ts           # 7.3 테이블 정의
│   │   └── relations.ts
│   ├── routes/
│   │   ├── workspaces.ts
│   │   ├── projects.ts
│   │   ├── documents.ts
│   │   └── links.ts            # 링크 존재 여부 일괄 조회 (FR-07/08/12)
│   ├── middleware/
│   │   └── auth.ts             # Neon Auth JWT 검증 + ownerId 주입
│   └── lib/
│       └── path.ts             # 경로 정규화 (클라이언트와 공유)
├── shared/
│   └── schema.ts               # zod 스키마 — 서버 검증 + 클라이언트 폼 공용
├── src/
│   ├── main.tsx
│   ├── app/
│   │   ├── router.tsx          # 경로 미러 라우팅 (7.5 참조)
│   │   └── providers.tsx       # QueryClient, Auth, Theme
│   ├── features/
│   │   ├── workspace/          # 각 폴더: components/ hooks/ api.ts
│   │   ├── project/
│   │   └── document/
│   │       ├── components/
│   │       │   ├── MarkdownView.tsx   # ★ 링크 가로채기 지점
│   │       │   ├── SmartLink.tsx      # ★ 활성/비활성 판정
│   │       │   ├── Editor.tsx         # CodeMirror 6
│   │       │   └── ImportDialog.tsx   # RAW 붙여넣기 + 경로 지정 + 링크 프리뷰
│   │       └── lib/
│   │           └── extractLinks.ts    # 본문에서 링크 추출 (프리뷰·판정 공용)
│   ├── components/
│   │   ├── ui/                 # shadcn/ui 생성물
│   │   └── shell/              # 사이드바, 커맨드팔레트, 테마 토글
│   ├── lib/
│   │   ├── api.ts              # hc<AppType> RPC 클라이언트
│   │   └── path.ts             # server/lib/path.ts re-export
│   └── styles/
│       ├── index.css
│       └── catppuccin.css      # Latte/Mocha → CSS 변수 → Tailwind 토큰
├── drizzle/                    # 마이그레이션 SQL (커밋 대상)
├── drizzle.config.ts
├── vite.config.ts
├── vercel.json                 # ★ SPA rewrite (RK-01의 급소)
├── tailwind.config.ts
├── .env.local                  # 커밋 금지
├── CLAUDE.md
└── docs/
    └── PDCA/
        ├── _INDEX.md
        └── 2026-08/PDCA-workspace/*.md
```

Vercel 배포 관점의 요점:
- `api/` 는 Vercel이 **규약으로** 서버리스 함수로 인식하는 유일한 위치 → 진입점만 두고 본문은 `server/`
- `server/`·`shared/` 는 프론트 번들에 섞이면 안 됨 → `vite.config.ts`에서 별칭·빌드 대상 분리
- `drizzle/` SQL은 반드시 커밋 (C8 절차의 근거 자료)

`vercel.json` 골자:

```jsonc
{
  "rewrites": [
    { "source": "/api/(.*)", "destination": "/api" },
    { "source": "/((?!api/).*)", "destination": "/index.html" }
  ]
}
```

두 번째 규칙이 `.md`로 끝나는 경로까지 `index.html`로 보내는지가 **RK-01 스파이크의 판정 대상**이다.

### 7.5 API 및 데이터 패칭 전략 — *Action Item 3*

#### 통신 경로

```
브라우저 (Vite SPA)
   │  TanStack Query
   │  Hono RPC 클라이언트 hc<AppType>  ← 타입이 서버 정의에서 직접 파생
   ▼  fetch (Cookie: Neon Auth 세션)
Vercel Serverless Function  api/[[...route]].ts
   │  ① auth 미들웨어 — JWT 검증 → ownerId 주입 (실패 시 401)
   │  ② zod 검증 (shared/schema.ts, 클라이언트 폼과 동일 스키마)
   │  ③ Drizzle 쿼리 — 전 쿼리에 ownerId 조인 강제
   ▼  HTTP (@neondatabase/serverless)
Neon Postgres  (dev 브랜치 / main 브랜치)
```

**브라우저는 DB에 직접 접근하지 않는다.** `DATABASE_URL`은 함수 런타임 전용이다(NFR).

#### 엔드포인트

| 메서드 | 경로 | 설명 |
|--------|------|------|
| GET | `/api/workspaces` | 내 워크스페이스 목록 |
| POST/PATCH/DELETE | `/api/workspaces[/:id]` | CRUD |
| GET | `/api/workspaces/:wsId/projects` | 프로젝트 목록 |
| POST/PATCH/DELETE | `/api/projects[/:id]` | CRUD |
| GET | `/api/projects/:projId/documents` | 문서 목록 (경로 트리 구성용, `content` 제외) |
| GET | `/api/projects/:projId/documents/by-path?path=...` | **경로로 문서 1건** ← FR-05의 심장 |
| POST/PATCH/DELETE | `/api/documents[/:id]` | CRUD |
| **POST** | `/api/projects/:projId/links/resolve` | **`{ paths: string[] }` → 존재하는 경로 집합.** FR-07/08/12가 전부 이걸 씀 |
| GET | `/api/projects/:projId/tree?prefix=...` | 디렉터리 링크(FR-09) prefix 조회 |

#### 프론트 라우팅과 경로 미러 (D-13의 구현 형태)

```
/w/:wsSlug                                  워크스페이스 대시보드
/w/:wsSlug/p/:projSlug                      프로젝트 개요
/w/:wsSlug/p/:projSlug/*                    ★ 와일드카드 = 문서 경로 그대로
```

- 와일드카드가 `docs/PDCA/2026-08/x/x.plan.md` 를 그대로 받아 `by-path`로 조회한다.
- 문서 안 링크 `](refine-db-cycle-1.plan.md)` 는 **앱이 아무것도 안 해도** 브라우저가
  현재 URL 기준으로 `/w/ws/p/proj/docs/PDCA/2026-08/x/refine-db-cycle-1.plan.md` 로 해석한다.
- `](../../../../CLAUDE.md)` 는 `/w/ws/p/proj/CLAUDE.md` 로 해석된다 → 그 경로에 문서가
  없으므로 **비활성**(FR-08). 형이 원한 동작 그대로.
- 끝이 `/` 면 디렉터리 → `tree?prefix=` 조회 (FR-09, RK-08의 규칙).

#### 링크 판정 흐름 (FR-07/08의 실제 동작)

1. 문서 로드 → `extractLinks.ts`가 본문에서 상대링크를 전부 추출
2. 각 링크를 현재 문서 `path` 기준으로 정규화 → 후보 경로 배열
3. `POST /links/resolve` **한 번**으로 존재 여부 일괄 조회 (N+1 없음)
4. `SmartLink`가 결과를 보고 `<Link>`(활성) 또는 `<span class="link-dead">`(비활성) 렌더

> 2번의 정규화는 "resolver를 안 만든다"와 모순처럼 보이지만 다르다. **런타임 내비게이션은
> 브라우저가 처리**하고(앱 로직 0), 정규화는 **미리 존재 여부를 알아내 비활성 표시를 하기
> 위한 사전 조회 전용**이다. 정규화가 틀려도 이동은 여전히 브라우저가 정확히 하고, 표시만
> 틀린다 — 실패 모드가 안전하다.

#### 캐싱·갱신 정책

| 대상 | 정책 |
|------|------|
| 워크스페이스/프로젝트 목록 | `staleTime` 5분, 변경 시 무효화 |
| 문서 목록(트리) | `staleTime` 1분 |
| 문서 본문 | `staleTime` 0, 편집 중엔 로컬 상태가 원천 |
| 문서 저장 | 디바운스 자동저장(2s) + 낙관적 갱신 + 실패 시 롤백·토스트 |
| `links/resolve` | 문서+본문 해시 키로 캐시. 편집 중엔 미조회 |

---

## 8. Convention Prerequisites

### 8.1 기존 규약

- [x] `CLAUDE.md` 존재 — 기본수칙·git·주석·PDCA 문서 규칙 명문화됨
- [ ] ESLint / Prettier — **없음. Phase 0에서 생성**
- [ ] `tsconfig.json` — 없음. Phase 0
- [ ] 저장소 — **git 미초기화(F8). Phase 0**

### 8.2 정의할 규약

| 범주 | 현재 | 정의할 것 | 우선순위 |
|------|------|-----------|:--------:|
| 네이밍 | 없음 | 컴포넌트 PascalCase / 훅 `use*` / 파일은 컴포넌트만 PascalCase, 나머지 camelCase | High |
| 폴더 구조 | 없음 | 7.4 확정. `features/*` 는 `components/ hooks/ api.ts` 3종만 | High |
| import 순서 | 없음 | 외부 → 별칭(`@/`) → 상대. ESLint `import/order` 강제 | Medium |
| 환경변수 | 없음 | 8.3 표 | High |
| 에러 처리 | 없음 | 서버는 Hono `HTTPException` 단일 경로, 클라이언트는 QueryClient 전역 에러 → 토스트 | Medium |
| 코드 주석 | `CLAUDE.md` 규칙 존재 | `// Design Ref: §N`, `// Plan SC: CN` 형식을 TS에도 그대로 적용 | High |

### 8.3 환경변수

| 변수 | 용도 | 범위 | 생성 |
|------|------|------|:----:|
| `DATABASE_URL` | Neon 연결 문자열 (**로컬=dev 브랜치 / Vercel=main 브랜치**) | Server | ☐ |
| `VITE_STACK_PROJECT_ID` | Neon Auth 프로젝트 ID | Client | ☐ |
| `VITE_STACK_PUBLISHABLE_CLIENT_KEY` | Neon Auth 공개 키 | Client | ☐ |
| `STACK_SECRET_SERVER_KEY` | Neon Auth 서버 키 (JWT 검증) | Server | ☐ |

`VITE_` 접두사가 붙은 것만 클라이언트 번들에 들어간다 — 나머지가 새면 사고다.

---

## 9. [DO] 실행 마일스톤 — *Action Item 4*

각 Phase는 **끝났을 때 눈으로 확인 가능한 결과**를 남긴다. 리스크가 큰 것을 앞에 둔다.

| Phase | 이름 | 산출물 | 완료 판정 |
|:-----:|------|--------|-----------|
| **0** | 환경 + **리스크 스파이크** | Node LTS 설치, `git init`, Vite+TS+Tailwind 스캐폴드, Vercel/Neon 프로젝트 생성, `vercel.json` | **`/a/b/c.md` 딥링크가 배포본에서 index.html에 도달**(RK-01 해소). 여기서 막히면 D-13 재검토 |
| **1** | DB 스키마 | `server/db/schema.ts`, `drizzle/` 마이그레이션, Neon dev/main 브랜치 2개 | dev 브랜치에 3테이블 생성, 수동 INSERT/캐스케이드 삭제 확인 (C8 절차 1회전) |
| **2** | 인증 | Neon Auth 연동, `middleware/auth.ts`, 보호 라우트 | 로그아웃 상태 API 호출 → 401 (**C2**). 막히면 RK-03 대안 발동 |
| **3** | Hono 골격 + Workspace CRUD | `api/[[...route]].ts`, `server/app.ts`, `routes/workspaces.ts`, RPC 클라이언트, Workspace UI | 브라우저에서 Workspace 생성→수정→삭제 (**C1** 1/3) |
| **4** | Project CRUD | `routes/projects.ts` + Project UI (서비스/GitHub URL 포함) | Project 1회전 (**C1** 2/3) |
| **5** | Document 저장 + 임포트 | `routes/documents.ts`, `ImportDialog`, 경로 정규화 + **단위 테스트** | RAW 붙여넣기로 문서 저장, `(project, path)` 중복 거부 확인 (**C1** 3/3, **C4** 일부) |
| **6** | **경로 미러 뷰어 + 링크 판정 ★핵심★** | 와일드카드 라우팅, `MarkdownView`, `SmartLink`, `links/resolve`, `tree` | 딥링크 동작(**C3**), 100KB 문서 렌더(**C5**), sanitize 실증(**C7**) |
| **7** | 실데이터 검증 | cogmo-report docs 67개 임포트 | **링크 4종 실클릭 검증 (C6)** ← 이 사이클의 진짜 관문 |
| **8** | 에디터 | CodeMirror 6, 미리보기, 자동저장 | 웹에서 문서 작성·편집이 실제로 쾌적한가 (형 판단) |
| **9** | 셸 + 테마 | 사이드바 트리, 커맨드 팔레트, Catppuccin Latte/Mocha | 전 화면 테마 일관성 (**C9**) |
| **10** | 배포 + 마무리 | main 배포, 링크 프리뷰(FR-12) 마감, README | 형이 프로덕션에서 실사용 (**C10**) |

**순서 근거**
- Phase 0에 스파이크를 넣은 이유: RK-01이 참이면 D-13(경로 미러)이 통째로 무너져 스키마부터
  다시 짜야 한다. 코드를 쌓기 **전에** 확인해야 손실이 0이다.
- Phase 7(실데이터)을 Phase 8·9(에디터·테마)보다 앞에 둔 이유: C6가 이 사이클의 존재 이유고,
  에디터·테마는 C6가 깨져도 살아남지만 그 역은 아니다.
- Phase 2를 앞에 둔 이유: 인증을 나중에 끼우면 전 라우트를 다시 만져야 한다.

**세션 분할 권고**: Phase 0~2 / 3~5 / 6~7 / 8~10 — 4세션. Phase 6~7은 반드시 한 세션에 붙인다
(링크 판정 구현과 실데이터 검증이 분리되면 디버깅 왕복이 생긴다).

---

## 10. Next Steps

1. [ ] 형 Plan 승인
2. [ ] 설계 문서 작성 (`PDCA-workspace.design.md`) — 3가지 아키텍처 안 비교 포함
3. [ ] Phase 0 스파이크로 RK-01 해소 후 구현 착수

---

## Version History

| 버전 | 날짜 | 변경 내용 | 작성자 |
|------|------|-----------|--------|
| 0.1 | 2026-08-07 | 최초 작성. Checkpoint 1·2 답변(Q1 붙여넣기 임포트 / Q2 URL 경로 미러링 / Q3 Tailwind+Catppuccin / Q4 Neon 브랜치 분리) 반영. cogmo-report docs 실측(F1~F8) 기반 | Claude |
| 0.2 | 2026-08-08 | §1.5의 `prompt.tmp` 깨진 링크 제거 — v0.1.2(`c48d434`)에서 해당 `.tmp` 파일이 삭제되며 유일한 깨진 링크로 남아 있었다(3차 사이클 analysis M-10) | Claude |
