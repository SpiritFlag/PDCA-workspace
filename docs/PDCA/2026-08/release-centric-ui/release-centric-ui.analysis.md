---
template: analysis
version: 1.0
---

# release-centric-ui 분석 문서

> **요약**: 정적 축(gap-detector)은 Structural 100% / Functional 93%로 매우 높고, 형이
> 직접 확인·수정을 지시한 급소 5건(RK-47·RK-48·S9·D-84·D-85)도 전부 PASS. 그러나 이
> 사이클이 스스로 세운 판정 원칙("브라우저 실증 없는 항목은 Met으로 안 친다")을 그대로
> 적용하면, **C36~C44 중 8건이 개별 시나리오 미실증으로 Partial**이다 — 3차의 "코드는
> 완결됐는데 실행으로 확인한 적 없다" 패턴을 형이 알면서도 이번엔 라이트 패스로
> 받아들이기로 결정했다(§1.6). Critical 0건, Important 2건은 Check 단계에서 즉시 수정·재검증했다.
>
> **프로젝트**: PDCA-workspace
> **작성자**: Claude
> **작성일**: 2026-08-09
> **PDCA Cycle**: release-centric-ui (문서화 기준 9번째 사이클)

---

## Context Anchor

> Design 문서에서 전파.

| Key | Value |
|-----|-------|
| **WHY** | 버전이 데이터 모델에선 1급인데 UI에선 URL도 없는 접힌 행이라, 릴리즈를 지목할 수 없고 PDCA 문서가 세 화면에 중복 노출된다 |
| **WHO** | 형 — 브라우저 실증(데스크탑·모바일) / Claude — 프론트 구현 |
| **RISK** | RK-47(라우트 순서)·RK-48(필터 위치)·RK-49(빈 상태)·RK-54(삭제 오조작) |
| **SUCCESS** | C36~C44 — 릴리즈 URL 왕복, PDCA 이중노출 소멸, 빈 상태 3종, 삭제 경로 유지, 서버 0줄, 무회귀 |
| **SCOPE** | S1~S10 고정. 서버·DB·MCP 변경 없음 |

---

## 1. Success Criteria 최종 상태

### 1.1 판정 원칙 재확인 (Plan §4)

> "이 사이클은 기능 사이클이므로 Match Rate로 판정한다. 다만 UI 사이클 특성상 **브라우저
> 실증이 없는 항목은 Met으로 치지 않는다**(3차의 교훈 — 6/8 Partial이 전부 '코드는 완결,
> 실행 미확인'이 단일 사유였다)."

Do module-5에서 형이 E1~E10 개별 시나리오를 실행하지 않고 **"전반적으로 얼추 맞는 것
같다"** 는 일반 확인만 하기로 결정했다(2026-08-09, "귀찮아.. 다 하는게..ㅋ;"). 이 사이클이
스스로 세운 원칙을 그대로 적용하면 **개별 시나리오 증거가 없는 SC는 Met으로 표기하지
않는다.** 아래 표는 그 원칙을 정직하게 반영한다 — 정적 검증(코드 확인·자동 테스트)으로
커버되는 부분과 브라우저 실증이 필요한 부분을 분리해서 표기했다.

### 1.2 SC별 상태

| ID | 기준 | 상태 | 근거 |
|----|------|:----:|------|
| **C36** | 릴리즈 URL 왕복(관문) | ⚠️ Partial | 코드 완결(라우트·Link·복귀·URL 재현 전부 구현). gap-detector가 RK-47(라우트 순서) PASS 확인. **개별 브라우저 왕복 시나리오(E1) 미실증** |
| **C37** | PDCA 이중노출 소멸 + 버전 노드 하위 노출 | ⚠️ Partial | 코드·grep 이중 확인 — `DocumentList.tsx`·`SidebarTree.DocumentsSection` 필터 적용, `CycleList.existingPaths`는 원본 유지(RK-48 PASS). **화면상 실제 노출 여부(E2) 미실증** |
| **C38** | 데스크탑 가독폭 + 모바일 렌더 불변 | ⚠️ Partial | max-width 값 6파일 전건 적용 확인(코드). **데스크탑(E3)·모바일(E4) 둘 다 미실증** — E4는 이번에 신설된 검증축이라 선례조차 없음 |
| **C39** | 오조작 방지(카드 삭제 없음, 상세에서만) | ⚠️ Partial | 코드 확인 — `CycleCard`에서 삭제 버튼 완전 제거, `ReleasePage` 하단에서만 삭제 가능. **실제 삭제 후 리다이렉트(E5) 미실증** |
| **C40** | 최신 릴리즈 하이라이트 | ⚠️ Partial | `LatestReleaseCard`가 `sortCycles(...,'version-desc')[0]` 사용 확인(단위 테스트 11케이스로 정렬 로직 자체는 검증됨). **화면 표시(E6) 미실증** |
| **C41** | projectId 취득 | ⚠️ Partial | `ProjectIdRow` 구현 확인 — ID 복사·스니펫 복사·2초 피드백·실패 폴백 전부 코드상 존재. **실제 복사값과 `.pdcarc.json` 대조(E7) 미실증** |
| **C42** | 빈 상태 3종 + 없는 버전 URL | ⚠️ Partial | 코드 가드 확인 — `hasCycle` 분기, `FR-112` 안내 문구. **실데이터(pdcaw-cli 프로젝트 등) 화면 확인(E8·E9) 미실증** |
| **C43** | 무회귀 + 서버 0줄 | ✅ **Met** | `tsc -b` 그린(에러 0) / `oxlint` 0 warning / `npm test` 61/61 / `git diff --stat -- server shared api drizzle` empty(exit 0) — **전부 CLI 실행 결과로 직접 확인, 브라우저 불요 항목이라 원칙과 무충돌** |
| **C44** | 문서 삭제 경로 유지(S10) | ⚠️ Partial | 코드 확인 — `DocumentViewPage` 하단 삭제 구역, `useDeleteDocument` 재사용, try/catch(D-85 PASS). **실제 삭제·복구·오조작 판정(E10) 미실증** — RK-54가 요구한 "실수로 누를 만한가" 정성 판단은 형만 할 수 있어 완전 이월 |

**1/9 Met, 8/9 Partial.** Partial 8건의 공통 사유는 전부 동일 — **"코드는 완결됐는데
개별 시나리오로 실행 확인한 적 없다."** 3차(cycle-release-note)의 패턴과 판정 방식까지
동일하게 재현했다(§6 회고 참조).

---

## 2. 정적 갭 분석 (gap-detector)

### 2.1 종합 점수

| 축 | 점수 | 근거 |
|---|:---:|---|
| Structural Match | 100% | 예측 19파일(신규6+수정13) 전건 일치, 예측 밖 변경 0건 |
| Functional Depth | 93%→**수정 후 재확인 완료** | §5.4 체크리스트 28/28 구현. 최초 보고된 감점 사유(G-1, `!` 단언)는 §3에서 즉시 수정 |
| API Contract (서버 무변경 대체 판정) | PASS | `git diff --stat -- server shared api drizzle` empty |

> gap-detector는 Bash 도구가 없어 `tsc`/`oxlint`/`npm test`를 직접 실행하지 못했다 —
> Claude가 별도로 실행해 C43 근거로 사용했다(§1.2). 7T-3 원칙에 따라 gap-detector의
> 확정 등급 판정 중 5건(§2.2)은 Claude가 직접 code Read로 재확인했다.

### 2.2 급소 5건 재확인 (7T-3 — 직접 code Read)

| # | 항목 | gap-detector 판정 | Claude 재확인 | 결과 |
|---|---|:---:|:---:|:---:|
| RK-48 | `CycleList.existingPaths` 오염 여부 | PASS | `CycleList.tsx:44` 직접 Read — `new Set((documents ?? []).map(d => d.path))`, 필터 없음 확인 | ✅ 일치 |
| RK-47 | 라우트 순서 | PASS | `router.tsx` 직접 Read — `/r/:version`이 와일드카드보다 앞 | ✅ 일치 |
| S9 | 파서 3종 제거 | PASS | `cyclePath.ts` 직접 Read(7줄) + `git grep` 전수 — 참조 0건 | ✅ 일치 |
| D-85 | 신규 삭제 try/catch | PASS | `ReleasePage.tsx`·`DocumentViewPage.tsx` 직접 Read — 둘 다 try/catch + 에러 상태 표시 | ✅ 일치 |
| D-84 | confirm 문구 동일성 | PASS(주석 누락 지적) | 문구 완전 동일 확인. 주석 누락은 §3에서 보강 | ✅ 일치 + 보강 완료 |

---

## 3. Gap 목록 및 처리

### 🔴 Critical — 0건

### 🟡 Important — 2건 (전건 즉시 수정·재검증 완료)

| ID | 항목 | 위치 | 처리 |
|----|------|------|------|
| G-1 | Design §1.2("신규 코드 `!` 단언 금지") 위반 — `ReleasePage.tsx`·`SidebarTree.tsx`에 non-null 단언 6곳 | `ReleasePage.tsx` 구 57·60·85, `SidebarTree.tsx` 구 216 | **수정 완료** — 로컬 const 구조분해로 대체(`const { name, yearMonth } = cycle`). TS 프로퍼티 접근이 클로저 경계를 넘으면 내로잉이 유지되지 않는다는 사실을 실측으로 확인(수정 중 `tsc -b`가 즉시 에러로 증명) |
| G-2 | `useCycles`에 `enabled` 가드 없음 — 신규 소비처(ReleasePage·ProjectOverviewPage)가 `project` 미해석 구간에 `projectId=''`로 요청 발사 가능 | `useCycles.ts:7-13` | **수정 완료** — `useDocuments.ts`와 동일하게 `enabled: !!projectId` 추가 |

### 🔵 Minor — 3건 (전건 즉시 수정 완료)

| ID | 항목 | 처리 |
|----|------|------|
| G-3 | D-84가 지시한 문구 상호참조 주석 누락 | `DocumentViewPage.tsx` handleDelete 위에 `DocumentList.tsx`와의 관계 주석 추가 |
| G-4 | `releaseUrl.ts` 주석이 소비처를 "4곳"으로 오기(실제 3곳, ReleasePage는 미소비) | 주석 정정 — Design §2.1 다이어그램과 일치시킴 |
| G-5 | 삭제 버튼에 `isPending` 가드 없음 — 연타 시 중복 DELETE 가능 | `ReleasePage.tsx`·`DocumentViewPage.tsx` 삭제 버튼에 `disabled={deleteMut.isPending}` 추가 |

**Gap 5건 전부 Check 단계에서 즉시 수정 → 재검증(`tsc -b`·`oxlint`·`npm test` 61/61 재실행 그린) 완료.**

---

## 4. Decision Record 준수 확인

| ID | 결정 | 준수 | 결과 |
|----|------|:---:|------|
| D-75 | C안 — 소비처 2곳 이상만 단일 원천화 | ✅ | `releaseUrl`(3곳)·`isGeneralDoc`(2곳) 신설. 인라인 조립 우회 0건(`git grep '/r/\$\{'` 등으로 확인) |
| D-76 | URL `/r/:version` | ✅ | §2.2 RK-47 재확인 |
| D-77 | 단건 API 신설 안 함 | ✅ | ReleasePage는 `useCycles` 목록 `find`만 사용, 신규 fetch 함수 없음(`cycle/api.ts` 무변경) |
| D-78 | CycleCard 펼침·인라인 노트 제거 | ✅ | `CycleCard.tsx`에 `expanded` state·`ReleaseNoteView` 소비 없음. 카드 클릭 = `releaseUrl` 이동 확인 |
| D-79 | 부재 스테이지 = 비활성 표시(생성 진입 없음) | ✅ | `ReleasePage.tsx`에서 부재 시 `<span>`(버튼 아님), `onCreateStage` 미존재 |
| D-80 | 버전 하위 4문서 = 토글, 기본 접힘 | ✅ | `VersionRow`의 `docsOpen` 초기값 `false` |
| D-81 | max-width 차등(문서 5xl / 그외 4xl) | ✅ | §2.2, 6파일 전건 확인 |
| D-82 | 삭제 = 하단 분리 구역 | ✅ | ReleasePage·DocumentViewPage 동일 패턴, `mt-10 border-t` |
| D-83 | ID 복사 + 스니펫 복사 2버튼 | ✅ | `ProjectIdRow` 구현 확인. **스니펫 `baseUrl`이 실제 `.pdcarc.json`과 일치하는지는 브라우저 실증 필요(C41 Partial 사유)** |
| D-84 | confirm 문구 재사용(상수화 안 함) | ✅ | §2.2, G-3으로 주석 보강 완료 |
| D-85 | 신규 삭제 코드 try/catch 필수 | ✅ | §2.2 |

**11/11 결정 준수.** 이탈 0건.

---

## 5. Plan §2.5 백로그 대조 결과 (형 보고용 — 클로드는 직접 수정하지 않음)

> Plan §2.5에서 예고한 대로, 아래는 **보고만** 한다. 실제 상태 전환·detail 갱신은 형이 한다.

| id | 제목 | 이 사이클 처리 결과 | 형이 할 일 |
|----|------|---------------------|-----------|
| `d2dcbddc` | projectId UI 노출 | **구현 완료**(S8) — 단, 코드 확인만이고 브라우저 실증(C41) 전 | → `done` 전환은 형 판단(브라우저 확인 후 권장) |
| `4e47b81f` | 브레드크럼(F-1) + 삭제 버튼(F-2) 묶음 | **F-2만 구현 완료**(S10). F-1(브레드크럼 세그먼트 클릭)은 미착수 | 분리 또는 detail 갱신 — Plan §2.5의 A/B/C안 중 형 결정 필요 |
| `2ea9c2ff` | CRN Minor 묶음(M-1~M-7) | **M-3(버전 앵커 없음)이 코드상 해소**(S1·S2, C36 Partial이지만 구조는 존재) | detail에서 M-3 삭선, 잔여 5건(M-1·M-2·M-4·M-5·M-7)만 유지 |
| `28406acf` | 사이클 문서 제목 파생 규칙(CRN I-5) | **주 지점(사이드바 트리·문서 목록) 해소 확인**(코드) — ⌘K 팔레트·FolderView 2지점은 Plan §2.2대로 손대지 않음(그대로 잔존) | detail을 잔여 2지점으로 축소. `resolved` 전환 여부 형 결정 |
| `828cf081` | 8차 이월 묶음(cyclePath 고아 export·RK-44 폴백) | **①(고아 export) 완료**(S9, git grep 0건 확인) | detail에서 ① 완료 명시, ②(RK-44 폴백)만 잔여 |
| `fcc0d14e` | 6T-1: l1-harness.ts 재사용 확인 | **N/A 회신** — 이 사이클은 서버 하네스 불요(UI 전용, 서버 0줄) | detail에 회신 기록, 다음 서버 변경 사이클로 릴레이 |
| `be2f3798` | 문서 목록 kind·stage 필터(FR-20) | **미착수**(계획대로) — PDCA 숨김(S3·S4) 후 재평가: **필터 수요 자체가 낮아졌다**(PDCA가 이미 안 보이므로 "종류 필터"의 남은 용도는 문서 목록 안에서 stage 무의미, kind는 general 단일이라 필터링할 대상이 없음) | 재평가 반영 여부 판단 |
| `7c428b0b` | ImportDialog 단일 원천 정리(I-3+M-8) | **손대지 않음**(Plan §2.2대로). 단, `CycleList`의 옛 M-8 인스턴스(삭제 미처리 rejection)는 **삭제 로직 자체가 사라지며 자연 소멸**(ReleasePage로 이관 + try/catch 신설, D-85) | I-3(ImportDialog 하드코딩)은 여전히 잔존 — 묶음 유지, M-8 언급 부분만 참고용으로 갱신 검토 |

**신규 등록 0건.** §2.5 원칙(등록 대행 금지) 준수.

---

## 6. 회고 관찰 (Report에서 다룰 재료)

- **판정 원칙을 스스로 세우고 스스로 지켰다.** Plan §4가 "브라우저 실증 없는 항목은 Met
  아님"이라 미리 선언했고, 형이 실제로 라이트 패스를 택했을 때 그 선언을 그대로 적용해
  8/9 Partial로 정직하게 기록했다 — 압력이 있어도 판정 기준을 흔들지 않은 사례.
- **3차의 패턴이 그대로 재현됐다.** 3차 report는 "코드는 완결됐는데 실행으로 확인한 적
  없다"를 6/8 Partial의 단일 사유로 지목했다. 이번은 8/9 — 더 심하다. 다만 이번엔
  **사전에 위험을 알고 형에게 명시적으로 경고했고, 형이 그 트레이드오프를 알면서 선택**했다는
  점이 3차와 다르다(3차는 애초에 PDCA 없이 진행해 사후 발견).
- **7T-3(gap-detector 재확인 루틴)가 실제로 값을 냈다.** G-1(non-null 단언)은 gap-detector
  보고만으로는 "형태만 있고 안전한지 불확실"이었는데, 직접 code Read + `tsc -b` 실행으로
  실제 TS 클로저 내로잉 한계를 실증하고 올바른 수정 패턴(로컬 const 구조분해)을 확정했다.
- **Do 단계에서 스스로 실행한 무회귀 검증(tsc/oxlint/test)이 Check의 C43 근거로 그대로
  재사용됐다** — gap-detector가 Bash 미보유로 못 하는 부분을 Claude가 대신 실행하는 패턴이
  8차에 이어 이번에도 반복. 다음 Plan에 "gap-detector 프롬프트에 CLI 실행 결과를 함께
  넘기는" 걸 정식 절차로 굳힐 만하다.

---

## 7. Checkpoint 5 — 결정

- Critical 0건, Important 2건(즉시 수정·재검증 완료), Minor 3건(즉시 수정 완료) — **코드
  결함은 이 시점에 전부 해소됨.**
- 남은 것은 코드 수정이 아니라 **브라우저 실증 8건 미실시**뿐이었다.
- **형 결정(2026-08-09): "그대로 진행"** — 8/9 Partial 상태 그대로 Report로 진행한다.
  Do 단계에서 이미 트레이드오프를 인지하고 선택한 연장선. 코드는 완결됐으므로 형이 원하는
  시점에 언제든 브라우저로 개별 확인 가능(dev 서버 계속 기동 중, localhost:5173).

---

## Version History

| Version | Date | Changes | Author |
|---------|------|---------|--------|
| 0.1 | 2026-08-09 | 최초 작성 — gap-detector 정적분석 + 7T-3 직접 재확인 + Gap 5건 즉시 수정·재검증 + §2.5 백로그 대조 보고 | Claude |
