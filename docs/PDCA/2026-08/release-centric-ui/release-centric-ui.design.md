---
template: design
version: 1.0
---

# release-centric-ui 설계 문서

> **요약**: 릴리즈 상세 페이지(`/r/:version`) 신설 + 사이드바·문서 목록의 PDCA 숨김을
> C안(Pragmatic)으로 설계한다 — 여러 곳에서 소비되는 릴리즈 URL·pdca 필터만 순수 함수로
> 단일 원천화하고 나머지는 인라인. 서버 0줄.
>
> **프로젝트**: PDCA-workspace
> **작성자**: Claude
> **작성일**: 2026-08-09
> **상태**: 확정 (Checkpoint 3 — 형 4건 일괄 결정, 2026-08-09)
> **Plan 문서**: [release-centric-ui.plan.md](./release-centric-ui.plan.md) (v0.3)

---

## Context Anchor

> Plan 문서에서 전파.

| Key | Value |
|-----|-------|
| **WHY** | 버전이 데이터 모델에선 1급인데 UI에선 URL도 없는 접힌 행이라, 릴리즈를 지목할 수 없고 PDCA 문서가 세 화면에 중복 노출된다 |
| **WHO** | 형 — 유일 사용자이자 브라우저 실증의 주체(데스크탑·모바일 각각) / Claude — 프론트 구현 |
| **RISK** | RK-47(새 라우트가 와일드카드에 먹힘) · RK-48(필터를 훅에 넣으면 4버튼 붕괴) · RK-49(빈 상태 미처리) · RK-54(S10 삭제 오조작) |
| **SUCCESS** | C36~C44 — 릴리즈 URL 왕복, PDCA 이중노출 소멸, 빈 상태 3종, 삭제 경로 유지, 서버 0줄, 무회귀 |
| **SCOPE** | S1~S10 고정 10건. 서버·DB·MCP 변경 없음. 프론트 전용 |

---

## 1. 개요

### 1.1 설계 목표

1. **버전 = URL** — `releaseUrl()` 하나가 만들는 주소로 사이드바·카드·하이라이트·리다이렉트가 전부 수렴
2. **PDCA 숨김의 반경 통제** — 필터는 표시 컴포넌트 2곳에만, 파생(`existingPaths`)은 절대 오염 금지(RK-48)
3. **삭제는 상세에서만** — 릴리즈(S6)·문서(S10) 동일 원칙, 하단 분리 배치(RK-54)
4. **기존 자산 최대 재사용** — `ReleaseNoteView`·`cycleStagePath`·`sortCycles`·`STAGE_COLOR`·`useDeleteDocument` 전부 그대로

### 1.2 설계 원칙

- **단일 원천은 "소비처 2곳 이상"일 때만 세운다** — CRN I-3(하드코딩 복제) 재발 방지와
  과설계 회피의 균형점. 릴리즈 URL(4곳)·pdca 필터(2곳)만 해당.
- **순수 함수만 단위 테스트**(7차 D-65 방침 유지) — 컴포넌트는 형 브라우저 실증이 담당.
- **빈 상태는 가드로, 단언(`!`)은 신규 코드에서 금지**(RK-49).

---

## 2. 아키텍처

### 2.0 3안 비교와 선택 (Checkpoint 3)

| 기준 | A. Minimal | B. Clean | **C. Pragmatic** |
|------|:---:|:---:|:---:|
| 접근 | 전부 인라인 | 전부 모듈화(+스테이지링크 컴포넌트 추상화) | 다소비 값만 단일 원천 |
| 신규 파일 | 1 | 7~8 | **6** (소스 4 + 테스트 2) |
| 릴리즈 URL | 4곳 문자열 복제 | `releaseUrl()` | `releaseUrl()` |
| pdca 필터 | 2곳 `.filter()` 복제 | 순수 함수 | 순수 함수 |
| 위험 | CRN I-3 동형 재발 구조 | 4개 고정 링크 컴포넌트 추상화는 과설계 | 균형 |

**선택: C안** — 형 결정(Checkpoint 3, 2026-08-09). 함께 확정된 3건:
URL은 **`/r/:version`**(기존 `/w/`·`/p/` 한 글자 관례 일치), max-width는
**차등(문서 1024 / 목록 896)**(RK-51 대응), 삭제 배치는 **페이지 하단 분리**(RK-54 대응).

> Checkpoint 제시 때 "신규 4파일"로 셌던 것은 lib+test를 1단위로 센 수치다 —
> 파일 수로는 6개(`LatestReleaseCard` 분리 포함). §11.1이 확정 목록.

### 2.1 컴포넌트 다이어그램

```
                         ┌─ releaseUrl(ws, proj, version) ──────── [신규 lib, 단일 원천]
                         │      ▲          ▲            ▲       ▲
                         │  SidebarTree  CycleCard  LatestRelease  ReleasePage(삭제 리다이렉트 X —
                         │  (버전 노드)   (카드 클릭)    Card         삭제는 개요로 리다이렉트)
                         │
router.tsx ── /r/:version ──▶ ReleasePage [신규]
                         │      ├─ useCycles(projectId).find(version 매치)   ← 신규 API 없음
                         │      ├─ cycleStagePath(...) × 4  ── 존재 판정: useDocuments 파생 Set
                         │      ├─ ReleaseNoteView (재사용)
                         │      └─ 하단 위험 구역: 삭제(useDeleteCycle) → navigate(개요)
                         │
isGeneralDoc(d) ─────────┼──── [신규 lib, 단일 원천]
      ▲          ▲       │
DocumentList  SidebarTree.DocumentsSection     ← 표시 컴포넌트 2곳에만 (RK-48)
                         │
CycleList.existingPaths ─┴── 필터 미적용 (원본 useDocuments 그대로) ← 절대 불변
```

### 2.2 데이터 흐름

- **신규 서버 호출 0건.** ReleasePage는 `useCycles`(목록)에서 `version` 파라미터로
  단건을 `find`한다 — 개인 앱 규모(프로젝트당 버전 수십 건)에서 목록 캐시 재사용이
  단건 API 신설보다 낫고, 서버 0줄 제약과 정합(Plan §7.2에서 사실상 확정된 방향).
- ReleasePage·SidebarTree의 문서 존재 판정은 `useDocuments` 쿼리키 공유로 **캐시
  히트**(Plan §3.1 M-3) — Network 탭으로 요청 증가 0건을 실증한다(RK-50).

### 2.3 의존성

| 컴포넌트 | 의존 대상 | 용도 |
|----------|-----------|------|
| ReleasePage [신규] | `useCycles`·`useDocuments`·`useDeleteCycle`·`cycleStagePath`·`ReleaseNoteView`·`STAGE_COLOR`·`releaseUrl` | S1·S2·S6 |
| LatestReleaseCard [신규] | `sortCycles`·`releaseUrl` | S7 |
| releaseUrl [신규 lib] | 없음 (순수 함수) | URL 단일 원천 |
| docKind [신규 lib] | 없음 (순수 함수) | pdca 필터 단일 원천 |
| SidebarTree [수정] | +`useDocuments`(캐시 공유)·`cycleStagePath`·`releaseUrl`·`isGeneralDoc` | S1·S3 |
| DocumentViewPage [수정] | +`useDeleteDocument`·`useNavigate` | S10 |

---

## 3. 데이터 모델

**변경 없음.** `cycles`·`documents` 스키마 그대로 (Plan §3.3 제약: 서버·DB 0줄).
프론트가 쓰는 파생 관계만 재확인:

```
cycles.name + cycles.yearMonth ──cycleStagePath()──▶ 문서 path 4건 (FK 없음, 경로 파생)
문서 존재 판정 = existingPaths.has(path)            (클라이언트 Set 파생, 3차 D-20 유지)
```

---

## 4. API 명세

**변경 없음. 신설 없음.** 기존 엔드포인트 소비만:

| Method | Path | 소비처 변화 |
|--------|------|------------|
| GET | `/api/projects/:projId/cycles` | +ReleasePage, +LatestReleaseCard (캐시 공유) |
| GET | `/api/projects/:projId/documents` | +ReleasePage, +SidebarTree.VersionsSection (캐시 공유) |
| DELETE | `/api/cycles/:id` | CycleList → **ReleasePage로 이관** (S6) |
| DELETE | `/api/documents/:id` | DocumentList(유지) + **DocumentViewPage 추가** (S10) |

---

## 5. UI/UX 설계

### 5.1 릴리즈 상세 페이지 (신규, `/w/:wsSlug/p/:projSlug/r/:version`)

```
┌──────────────────────────────────────────┐
│ ← {프로젝트명}                            │  개요로 복귀 링크
│                                          │
│ [v0.1.7] adopt-pdcaw-cli      (mono 칩)  │  버전 + 사이클명(연결 시)
│                                          │
│ ┌────────┬────────┬──────────┬─────────┐ │  사이클 연결 시에만 (hasCycle 가드)
│ │  plan  │ design │ analysis │ report  │ │  존재=STAGE_COLOR 링크
│ └────────┴────────┴──────────┴─────────┘ │  부재=점선 비활성(생성 진입 없음, D-79)
│                                          │
│ ── 릴리즈 노트 ──────────────────────────  │
│ (ReleaseNoteView 재사용, 접기 없음)        │  없으면 "릴리즈 노트가 없습니다."
│                                          │
│ ═══════════════ 하단 분리 ═══════════════  │
│                        [이 버전 삭제]     │  red, confirm() → 성공 시 개요로
└──────────────────────────────────────────┘
   max-w-4xl (목록성 페이지 — 형 결정 차등폭)
```

- **FR-112 (없는 버전)**: `useCycles` 로드 완료 후 매치 없음 →
  `"이 버전이 없습니다: {version}"` + 개요 복귀 링크 (`DocumentViewPage` 부재 패턴 준용).
- **빈 상태 ②(사이클 미연결)**: 4버튼 영역 자체를 렌더하지 않음. ③(4종 미만): 있는 것만 링크.

### 5.2 사이드바 재편 (S1·S3)

```
▾ 프로젝트명
    ★ 백로그
    ▾ ⛿ 버전 (8)
        ▸ [v0.1.7] adopt-pdcaw-cli     ← 행 클릭 = releaseUrl로 이동 (기존 to={base} 교체)
        ▾ [v0.1.6] refine-cycle-closing ← ▸ 토글은 4문서 펼침 (기본 접힘, D-80)
             plan · design · analysis · report   ← 존재=문서 URL 링크 / 부재=흐림 텍스트
        ▸ [v0.1.5] (사이클 미연결이면 토글 없음 — 행 링크만)
    ▾ 문서 (3)                         ← isGeneralDoc 필터 후 개수·트리 (S3)
        RULE.md
        deploy/…
```

- 버전 하위 4문서는 **전용 평면 렌더** — `TreeItem`(폴더 재귀) 미사용(Plan §3.1 M-3 근거).
- `DocumentsSection`: `buildDocTree(documents.filter(isGeneralDoc))`, 개수도 필터 후 길이.

### 5.3 프로젝트 개요 페이지 (S4·S7·S8)

```
┌──────────────────────────────────────────┐
│ ← 워크스페이스명                          │
│ 프로젝트명                        수정    │
│ /slug                                    │
│ projectId: 4b06bd56-…  [ID 복사] [.pdcarc.json 복사]   ← S8 (mono, 작게)
│                                          │
│ [        ★ 백로그        ]               │  ← 변경 금지 (형 강조)
│                                          │
│ ┌ 최신 릴리즈 ────────────────────────┐   │  ← S7 (백로그 버튼 아래 = 강조 순서 유지)
│ │ [v0.1.7] adopt-pdcaw-cli  상세 보기 →│   │  릴리즈 0건이면 카드 자체 비표시
│ └─────────────────────────────────────┘   │
│                                          │
│ 버전 (8)                     [+ 버전 추가]│  카드: 삭제 버튼 없음(S6),
│ [v0.1.7] adopt-pdcaw-cli   수정  ....... │  버전칩·이름 클릭 = 상세 이동(S1)
│   ├ plan design analysis report (유지)   │  ▶ 펼침 토글 제거(D-78)
│                                          │
│ 문서 (3)                   [+ 문서 임포트]│  ← isGeneralDoc 필터 (S4)
└──────────────────────────────────────────┘
   max-w-4xl
```

### 5.4 Page UI Checklist

#### ReleasePage (신규)

- [ ] 복귀 링크: `← {프로젝트명}` → 프로젝트 개요
- [ ] 버전 칩: mono·mauve (CycleCard 현행 스타일)
- [ ] 사이클명: `hasCycle`일 때만, mono·overlay0
- [ ] 스테이지 4버튼: `hasCycle`일 때만 렌더. 존재=`Link`(STAGE_COLOR) / 부재=점선 테두리 + overlay0 **비활성 텍스트**(버튼 아님)
- [ ] 릴리즈노트: `ReleaseNoteView` / 공백 시 "릴리즈 노트가 없습니다."
- [ ] 하단 위험 구역: 경계선 위 `mt`-분리, 우측 정렬 red "이 버전 삭제" + `confirm()`(현행 문구 유지) → 성공 시 `navigate(개요)`
- [ ] 부재 버전 상태: 안내 문구 + 복귀 링크 (FR-112)
- [ ] 로딩 상태: "불러오는 중..." (현행 관례)

#### SidebarTree (수정)

- [ ] 버전 행: `Link to={releaseUrl(...)}` (기존 `to={base}` 대체) — 칩+이름 렌더 현행 유지
- [ ] 버전 행 좌측 ▸ 토글: `hasCycle`인 버전만, 기본 접힘
- [ ] 펼침 시 4행: 존재=문서 URL `Link` / 부재=overlay0 텍스트(링크 아님)
- [ ] 문서 섹션 개수: `documents.filter(isGeneralDoc).length`
- [ ] 문서 트리: `buildDocTree(filtered)` — PDCA 경로 폴더(`docs/PDCA/…`)가 트리에서 사라짐

#### ProjectOverviewPage (수정)

- [ ] projectId 행: mono 축약 표시 + [ID 복사] + [.pdcarc.json 복사] 버튼, 복사 후 "복사됨" 피드백
- [ ] 최신 릴리즈 카드: `sortCycles(...,'version-desc')[0]` — 버전칩 + 사이클명 + "상세 보기 →". 0건이면 비표시
- [ ] ★백로그 버튼: **변경 없음** (스타일·위치·문구)
- [ ] max-w-2xl → max-w-4xl

#### CycleCard / CycleList (수정)

- [ ] 카드에서 삭제 버튼 제거 (수정 버튼 유지)
- [ ] 버전칩+사이클명 클릭 → `releaseUrl` 이동 (▶ 펼침 토글·인라인 노트 제거 — D-78)
- [ ] 스테이지 4버튼 현행 유지 (존재=링크 / 부재=`+ stage` 생성 프리필 — ImportDialog 흐름 불변)
- [ ] `existingPaths` 파생 **무변경** (RK-48)

#### DocumentList (수정)

- [ ] `documents.filter(isGeneralDoc)`로 목록·개수 산출
- [ ] pdca stage 배지 JSX 제거 (필터 후 도달 불가 — dead code 방지, Plan §6.2 확인 항목)
- [ ] 삭제 버튼 현행 유지 (일반 문서용)

#### DocumentViewPage (수정)

- [ ] 본문 하단 위험 구역: 경계선 + 우측 red "이 문서 삭제" + `confirm()`(DocumentList 문구와 동일) → 성공 시 `navigate(개요)` (S10, FR-113·114)
- [ ] 헤더는 현행 유지 (편집 버튼 위치 불변 — 삭제와 물리 분리, RK-54)
- [ ] max-w-3xl → **max-w-5xl** ×2곳 (뷰어·편집)

#### 폭 일괄 (S5)

- [ ] `BacklogPage`·`ProjectListPage`·`WorkspaceList`·`TokensPage`: max-w-2xl → max-w-4xl
- [ ] 모바일: 클래스가 상한이므로 렌더 불변 — 형 모바일 브라우저로 실증(C38)

---

## 6. 에러 처리

| 상황 | 처리 |
|------|------|
| 없는 버전 URL | FR-112 안내 + 복귀 링크 (서버 에러 아님 — 클라이언트 find 미스) |
| 버전 삭제 실패 (404/409) | `mutateAsync` try/catch로 감싸 인라인 에러 문구 표시 — **신규 코드이므로 CRN M-8(미처리 rejection)을 복제하지 않는다** |
| 문서 삭제 실패 | 동일 — DocumentViewPage 신규 코드도 try/catch |
| 클립보드 실패 | `catch`에서 "복사 실패 — 직접 선택해 복사하세요" + 값 노출(mono) 폴백 (RK-53) |

> 기존 `DocumentList`·(이관 전) `CycleList`의 미처리 rejection은 **이 사이클이 고치지
> 않는다**(Plan §2.2) — 단, S6·S10으로 **새로 쓰는 코드**는 처음부터 처리한다.

---

## 7. 보안 고려사항

- [x] 클립보드 복사 대상: `projectId`·`baseUrl` 2값만 — PAT·토큰류 절대 미포함 (Plan 비기능 요구)
- [x] `.pdcarc.json` 스니펫의 `baseUrl` = `window.location.origin` — 비밀 아님(저장소 커밋값과 동일 성질)
- [x] 릴리즈노트 렌더: `ReleaseNoteView` 재사용이므로 rehype-sanitize 방침 그대로
- [x] 신규 서버 표면 0 — 라우트·검증·인증 변경 없음

---

## 8. 테스트 계획

### 8.1 범위

| 유형 | 대상 | 도구 | 단계 |
|------|------|------|------|
| 단위 (순수 함수) | `releaseUrl`·`isGeneralDoc`·`cyclePath` 잔존분 | Vitest | Do (module-1, red 먼저) |
| 무회귀 | `tsc -b`·`oxlint`·`npm test` 전건 | CLI | Do 각 module 말 + Check |
| 브라우저 실증 | C36~C42·C44 (E1~E10) | 형 브라우저 (데스크탑+모바일) | Do module-5 |

### 8.2 단위 테스트 시나리오 (module-1)

| # | 대상 | 시나리오 | 기대 |
|---|------|---------|------|
| t1 | `releaseUrl` | `('hobby','pdca-workspace','v0.1.7')` | `/w/hobby/p/pdca-workspace/r/v0.1.7` |
| t2 | `releaseUrl` | 버전 문자셋은 `cycleVersionSchema`가 보증 — 인코딩 미적용 확인 | 원문 그대로 |
| t3 | `isGeneralDoc` | `kind:'general'` → true / `kind:'pdca'` → false | 경계 고정 |
| t4 | `cyclePath` 잔존 | `cycleStagePath` 4 stage 조립(기존 t1의 빌더 부분 유지) | 경로 4건 |
| t5 | `cyclePath` 정리 | `parseCycleStagePath`·`ParsedCyclePath`·`CYCLE_PATH_RE` export 부재 (tsc가 검증) | 컴파일 에러 없음 |

### 8.3 브라우저 실증 시나리오 (E1~E10, module-5 — 형)

| # | 시나리오 | SC |
|---|---------|:--:|
| E1 | 사이드바 버전 클릭 → 상세 착지 → plan 문서 이동 → 뒤로가기 복귀 → URL 새 탭 재현 | C36 |
| E2 | 사이드바 문서 트리·개요 문서 목록에 `.plan.md`류 부재 + 개수=일반 문서 수 + 버전 노드 펼침엔 4문서 표시 | C37 |
| E3 | 데스크탑 폭 확대 확인 (문서 1024 / 목록 896) | C38 |
| E4 | **모바일**: 가로 스크롤 없음, 이전과 동일 렌더 | C38 |
| E5 | 카드에 삭제 없음 → 상세 하단에서 테스트 버전 삭제 → 개요 리다이렉트 | C39 |
| E6 | 개요 상단 최신 릴리즈 카드 = 버전 번호 최대값, 상세 이동 | C40 |
| E7 | projectId 복사 → `.pdcarc.json` 실물과 값 대조 / 스니펫 복사 → JSON 형태 확인 | C41 |
| E8 | 빈 상태 3종: 릴리즈 0건 프로젝트(pdcaw-cli로 확인 가능)·사이클 미연결 버전·4종 미만 사이클 | C42 |
| E9 | 없는 버전 URL 직접 입력 → 안내 + 복귀 | C42 |
| E10 | PDCA 문서를 상세→뷰어로 열어 하단 삭제 → 개요 리다이렉트 → `pdcaw`로 재업로드 복구. 일반 문서도 뷰어 삭제 확인. "실수로 누를 만한가" 판정(RK-54) | C44 |

### 8.4 시드 데이터

신규 시드 불필요 — **실데이터가 이미 전 케이스를 갖췄다**: PDCA-workspace 프로젝트(버전
8건·PDCA 문서 32건+일반 문서), pdcaw-cli 프로젝트(릴리즈 0건 — E8 ①), 문서 3종만 있는
사이클(E8 ③). E8 ②(미연결 버전)만 없으면 테스트 버전 1건 생성 후 E5에서 삭제로 겸용.

---

## 9. Decision Record

> **6T-3 첫 적용**: `파생 효과` 열 — 이 결정이 다른 어디에 영향을 내는가를 결정 시점에 추적.

| ID | 결정 | 근거 | **파생 효과** |
|----|------|------|--------------|
| D-75 | C안 — `releaseUrl`·`isGeneralDoc` 2건만 단일 원천화 | 소비처 2곳 이상만 모듈화(CRN I-3 재발 방지 ↔ 과설계 회피) | 신규 lib 2개가 생기므로 **앞으로 릴리즈 URL·kind 판정을 인라인으로 쓰면 그 자체가 위반** — Check에서 `git grep '/r/'`로 우회 조립 검사 |
| D-76 | URL `/r/:version` (형 결정) | 기존 `/w/`·`/p/` 한 글자 관례 일치, `docs` 아님 → 충돌 없음 | 문서 path가 `r/`로 시작하면 이론상 충돌하나 현행 생성 경로 2곳이 전부 `docs/` 강제(Plan §3.1 M-1)라 실효 없음. 라우트는 와일드카드 앞 배치 필수(RK-47) |
| D-77 | 상세 데이터 = `useCycles` 목록 `find` (단건 API 신설 안 함) | 서버 0줄 제약 + 개인 앱 규모에서 목록 캐시 재사용이 우세 | 버전 수가 수백 건이 되면 재검토. 직접 URL 진입 시에도 목록 fetch 1회는 필요(개요 경유와 동일 비용) |
| D-78 | CycleCard의 ▶ 펼침 토글·인라인 노트 **제거**, 카드 클릭=상세 이동 | 노트의 자리가 상세 페이지로 이동(S2)했으므로 인라인 펼침은 중복 + 클릭 대상 충돌 | `ReleaseNoteView`의 CycleCard 소비가 사라지고 ReleasePage 소비로 대체. **expanded state 삭제로 카드가 순수 표시 컴포넌트에 가까워짐**. 수정 버튼·4버튼·생성 프리필 흐름은 불변 |
| D-79 | ReleasePage의 부재 스테이지 = **비활성 표시** (생성 진입 없음) | FR-100의 두 선택지 중 후자 — 생성 프리필(ImportDialog)은 개요 카드에 이미 있고, 상세 페이지에 ImportDialog까지 끌어오면 반경이 커짐 | 문서 생성 경로는 개요 카드 유일 유지. 형 실사용에서 상세 페이지 생성 니즈가 확인되면 후속 사이클 |
| D-80 | 사이드바 버전 하위 4문서 = 버전별 ▸ 토글, **기본 접힘** | 버전 8건 × 5행 = 40행 상시 노출 방지 | CRN M-1(자동 펼침이 마운트 시점만) 관찰 대상이 한 계층 늘어남 — 관찰만, 수정 안 함(Plan §2.2) |
| D-81 | max-width 차등: 문서 뷰어 `max-w-5xl`(1024) / 그 외 `max-w-4xl`(896) (형 결정) | RK-51 — 산문 줄길이 보호. 전역 유틸 클래스는 안 만든다(파일 6곳, 값 2종뿐) | 새 페이지(ReleasePage)는 4xl을 따른다. 이후 페이지 추가 시 이 2값 관례를 따르면 됨 |
| D-82 | 삭제 배치 = 페이지 하단 분리 구역, 우측 정렬 red (형 결정) | RK-54 — 헤더(편집)와 물리 분리 | ReleasePage·DocumentViewPage 동일 패턴 — **"위험 동작은 하단"이 이 앱의 관례가 됨**. E10에서 오클릭 가능성 판정 |
| D-83 | S8 = [ID 복사] + [.pdcarc.json 복사] 2버튼, 스니펫 `baseUrl`은 `window.location.origin` | 실사용 목적이 `.pdcarc.json` 작성이므로 스니펫이 본선, 원값 복사도 병행 | localhost(5173)에서 스니펫 복사 시 origin이 API 주소와 다름 — **프로덕션에서 복사하는 것이 정상 경로**, 문서화만(코드 방어 안 함) |
| D-84 | 삭제 confirm 문구는 기존 문구 재사용(상수 추출 안 함) | 릴리즈 문구는 이관이라 1곳 유지, 문서 문구는 2곳 — 상수화는 과설계(Plan §3.1 M-10) | DocumentViewPage에 복제되는 문구 1건에 상호참조 주석. 3곳째가 생기면 그때 상수화 |
| D-85 | 신규 삭제 코드(S6·S10)는 try/catch 필수 | CRN M-8(미처리 rejection)을 신규 코드에 복제하지 않는다 | 기존 `DocumentList`·`CycleList`의 미처리분은 그대로(스코프 밖) — 신구 코드의 에러 처리 수준이 갈라짐을 §6에 명시 |

---

## 10. 코딩 컨벤션

기존 관례 그대로: 컴포넌트 PascalCase.tsx / lib 순수 함수 camelCase.ts / 훅 재사용 /
Tailwind 인라인 + `--ctp-` 토큰 / `// Design Ref:` · `// Plan SC:` 주석 (7T-1: 문서명 명시).

---

## 11. 구현 가이드

### 11.1 파일 변경 목록 (예측 — Check에서 실측 대조)

**신규 6:**

| 파일 | 내용 |
|------|------|
| `src/features/cycle/lib/releaseUrl.ts` | `releaseUrl(wsSlug, projSlug, version)` 순수 함수 |
| `src/features/cycle/lib/releaseUrl.test.ts` | t1~t2 |
| `src/features/document/lib/docKind.ts` | `isGeneralDoc(d)` 순수 함수 |
| `src/features/document/lib/docKind.test.ts` | t3 |
| `src/features/cycle/components/ReleasePage.tsx` | S1·S2·S6 집결지 (§5.1) |
| `src/features/cycle/components/LatestReleaseCard.tsx` | S7 (§5.3) |

**수정 13:**

| 파일 | 변경 |
|------|------|
| `src/app/router.tsx` | `/r/:version` 라우트 — **backlog와 와일드카드 사이** 삽입 |
| `src/components/shell/SidebarTree.tsx` | VersionsSection 링크 교체 + 4문서 토글 / DocumentsSection 필터 |
| `src/features/cycle/components/CycleCard.tsx` | 삭제·펼침 제거, 클릭=상세 이동 (D-78) |
| `src/features/cycle/components/CycleList.tsx` | `handleDelete`·`useDeleteCycle`·`onDelete` 제거 |
| `src/features/document/components/DocumentList.tsx` | `isGeneralDoc` 필터 + 배지 JSX 제거 |
| `src/features/document/components/DocumentViewPage.tsx` | 하단 삭제 구역(S10) + max-w-5xl ×2 |
| `src/features/document/components/ProjectOverviewPage.tsx` | projectId 행 + LatestReleaseCard + max-w-4xl |
| `src/features/cycle/lib/cyclePath.ts` | `parseCycleStagePath`·`ParsedCyclePath`·`CYCLE_PATH_RE` 삭제 (S9) |
| `src/features/cycle/lib/cyclePath.test.ts` | 파서 테스트 삭제, 빌더 테스트(t4) 유지 |
| `src/features/backlog/components/BacklogPage.tsx` | max-w-4xl |
| `src/features/project/components/ProjectListPage.tsx` | max-w-4xl |
| `src/features/workspace/components/WorkspaceList.tsx` | max-w-4xl |
| `src/features/tokens/components/TokensPage.tsx` | max-w-4xl |

**불변 (감시 대상):** `server/`·`shared/`·`api/`·`drizzle/` 전체(0줄 제약),
`useDocuments.ts`(필터 금지 — RK-48), `buildDocTree.ts`(시그니처 불변),
`ImportDialog.tsx`, ★백로그 버튼, `versionSort.ts`, `ReleaseNoteView.tsx`.

### 11.2 구현 순서

1. module-1: 순수 함수 신설 + S9 정리 (red 먼저 — 5차 선례)
2. module-2: 라우트 + ReleasePage (S1·S2·S6·FR-112)
3. module-3: 사이드바 + 문서 목록 (S3·S4) — **RK-48 육안 확인 포함**
4. module-4: 개요 페이지 (S7·S8) + 폭 일괄(S5) + 문서 뷰 삭제(S10)
5. module-5: 검증 — 무회귀 3종 + E1~E10 (형)

### 11.3 Session Guide

| Module | Scope Key | 내용 | 예상 규모 |
|--------|-----------|------|:--------:|
| 순수 함수·정리 | `module-1` | releaseUrl·docKind 신설(+test), cyclePath S9 정리 | 소 |
| 릴리즈 상세 | `module-2` | 라우트, ReleasePage, 카드 클릭 전환, 삭제 이관 | 중 |
| 숨김·트리 | `module-3` | 사이드바 재편, DocumentList 필터 | 중 |
| 개요·폭·문서삭제 | `module-4` | S7·S8·S5·S10 | 중 |
| 검증 | `module-5` | 무회귀 + 형 브라우저 E1~E10 | 소(형 구간) |

권장: module-1~2 / module-3~4 / module-5 의 3구간. 단일 세션 완주도 가능한 규모.

---

## Version History

| Version | Date | Changes | Author |
|---------|------|---------|--------|
| 0.1 | 2026-08-09 | 최초 작성 — Checkpoint 3 형 4건 일괄 결정(C안·`/r/:version`·차등폭·하단 삭제) 반영 | Claude |
