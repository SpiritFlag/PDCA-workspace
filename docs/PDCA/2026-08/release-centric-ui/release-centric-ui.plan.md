---
template: plan
version: 1.0
---

# release-centric-ui 계획 문서

> **요약**: 릴리즈(버전)를 고유 URL을 가진 UI의 1급 시민으로 승격하고, PDCA 문서를
> 릴리즈 아래로 모아 문서 트리·목록의 중복 노출을 없앤다. 서버 스키마·API 변경 0건이
> 전제인 프론트 중심 정보구조 개편.
>
> **프로젝트**: PDCA-workspace
> **작성자**: Claude
> **작성일**: 2026-08-09
> **PDCA Cycle**: release-centric-ui (9번째 사이클, 예정 버전 `v0.1.8`)
> **상태**: Draft — 형 승인 대기

---

## Executive Summary

| 관점 | 내용 |
|------|------|
| **Problem** | 3차에서 버전을 DB의 1급 엔티티로 세웠지만 UI에서는 여전히 프로젝트 페이지의 "접힌 행"이다. 버전에 URL이 없어 특정 릴리즈를 지목·공유·북마크할 수 없고(CRN M-3), 같은 PDCA 문서가 릴리즈 카드·사이드바 트리·문서 목록 세 곳에 중복 노출되면서 동일 라벨 도배(CRN I-5)와 일반 문서 매몰을 동시에 일으킨다 |
| **Solution** | 릴리즈 상세 페이지 라우트를 신설해 버전 하나 = URL 하나로 만들고, 그 페이지가 PDCA 4문서 진입점 + 릴리즈노트 본문을 함께 갖는다. 사이드바는 버전 노드 아래에 4문서를 펼치고, 기존 문서 트리·문서 목록에서는 `kind='pdca'`를 제외한다. 곁들여 데스크탑 가독폭 상향, 삭제 액션 이동, 최신 릴리즈 하이라이트, projectId 노출 |
| **Function/UX Effect** | 사이드바 버전 클릭이 프로젝트 개요가 아니라 그 버전의 상세 페이지로 착지한다. 문서 트리·목록에는 일반 문서만 남아 `RULE.md`·`CHECKLIST.md` 같은 문서가 PDCA 문서 더미에 묻히지 않는다. 삭제는 목록이 아니라 상세에서만 — 릴리즈도(S6), 문서도(S10). `.pdcarc.json`을 쓸 때 DB를 직접 열지 않아도 projectId를 복사할 수 있다 |
| **Core Value** | **"PDCA 산출물의 단위는 문서가 아니라 릴리즈다"(3차 D-19)를 정보구조까지 관철한다.** 3차는 데이터 모델에서만 이 명제를 지켰고 UI는 문서 중심 그대로였다 — 이 사이클이 그 미완을 닫는다 |

---

## Context Anchor

| Key | Value |
|-----|-------|
| **WHY** | 버전이 데이터 모델에선 1급인데 UI에선 URL도 없는 접힌 행이라, 릴리즈를 지목할 수 없고 PDCA 문서가 세 화면에 중복 노출된다 |
| **WHO** | 형 — 유일 사용자이자 브라우저 실증의 주체(데스크탑·모바일 각각) / Claude — 프론트 구현 |
| **RISK** | RK-47(새 라우트가 와일드카드 문서 라우트에 먹힘) · RK-48(pdca 필터를 훅에 넣으면 버전 카드 4버튼 붕괴) · RK-49(빈 상태 미처리 — 실데이터에 이미 존재) · RK-54(S10 삭제 버튼 오조작) |
| **SUCCESS** | C36~C43 — 릴리즈 URL 왕복, PDCA 이중노출 소멸, 빈 상태 3종, 서버 0줄, 무회귀 |
| **SCOPE** | S1~S10 고정 10건(S10은 RK-52 해법으로 형이 편입 승인). 서버·DB·MCP 변경 없음. 프론트 전용 |

---

## 1. 개요

### 1.1 목적

버전(릴리즈)을 UI의 1급 시민으로 승격한다. 구체적으로는 ①버전에 고유 URL을 주고
②그 URL을 PDCA 4문서의 진입점으로 만들며 ③그 결과로 문서 트리·문서 목록에서 PDCA
문서를 걷어내 일반 문서의 가시성을 회복한다.

### 1.2 배경

- **3차(cycle-release-note, `v0.1.2`)** 가 `cycles` 테이블로 버전을 1급 엔티티로 세웠다(D-19).
  데이터 모델은 그때 완성됐고 이후 5차·6차가 무결성·MCP 읽기까지 붙였다.
- 그러나 **UI는 문서 중심 그대로**다. 3차 analysis가 남긴 세 항목이 그 증거다:
  - **CRN M-3** — 사이드바 버전 링크가 전부 `to={base}`(프로젝트 개요). 버전별 URL 부재.
  - **CRN I-5** — pdca 문서 생성 시 제목이 사이클명으로 고정돼 트리에 동일 라벨 4개.
  - (파생) 같은 문서가 릴리즈 카드 4버튼 · 사이드바 문서 트리 · 문서 목록에 3중 노출.
- **8차(adopt-pdcaw-cli, `v0.1.7`)** 이후 `pdcaw`가 `docs/` 전체를 올리게 되면서
  일반 문서(`RULE.md`, `deploy/CHECKLIST.md`, `_INDEX.md`)가 서버에 올라오기 시작했다 —
  PDCA 문서에 묻히는 문제가 이때부터 실제로 체감되기 시작했다.
- **`.pdcarc.json` 신설(8차 D-72)** 로 projectId가 사람이 손으로 적는 값이 됐는데,
  현재 이 값을 얻는 방법은 DB 직접 조회뿐이다(형 실사용 중 발견).

### 1.3 관련 문서

| 문서 | 관계 |
|------|------|
| [cycle-release-note.analysis.md](../cycle-release-note/cycle-release-note.analysis.md) | CRN I-5 · M-1 · M-2 · M-3 원출처 |
| [adopt-pdcaw-cli.report.md](../adopt-pdcaw-cli/adopt-pdcaw-cli.report.md) | 직전 사이클. §6.3 P-4가 이 Plan §1.4의 대상 |
| [adopt-pdcaw-cli.analysis.md](../adopt-pdcaw-cli/adopt-pdcaw-cli.analysis.md) | M-1(`parseCycleStagePath` 고아 export) = S9 편입 근거 |
| [PDCA-workspace.analysis.md](../PDCA-workspace/PDCA-workspace.analysis.md) | 1차 백로그 F-2(문서 뷰 삭제 버튼) = S10 편입 원출처(:123) |
| [docs/RULE.md](../../../RULE.md) | 사이클 종료 절차 (마지막 개정 `c8f3eed`, 2026-08-09) |

---

## 1.4 P-1 — 직전 Try 이행 현황 (필수 섹션)

> 5차부터 고정된 형식. 이번 사이클이 **이번 Plan 안에서 무엇을 실제로 이행하는지**를
> 선언하고, 이행 불가 항목은 "N/A + 사유"로 회신해 다음 사이클로 릴레이한다.

| ID | 출처 | Try 내용 | 이번 사이클 이행 | 근거 |
|----|------|---------|:---------------:|------|
| **8T-P4** | 8차 §6.3 | 외부 패키지 도입형 사이클에서 Design §6.3에 "검증에 필요한 실행 환경이 실제로 존재하는가"를 기본 체크 항목으로 추가 | ✅ **첫 적용(변형)** | 이번은 외부 패키지 도입 사이클이 아니지만, 그 취지(검증 환경 존재 확인)를 일반화해 **Plan §6.3에 미리 명시**한다 — 검증 환경 = `npm run dev:local`(상주 Hono + vite) + 형의 브라우저 2종(데스크탑/모바일). 실존 확인: `package.json` `dev:local` 스크립트 존재, 6차·5차가 같은 경로로 브라우저 실증 완료한 선례 있음 |
| **7T-1** | 7차 §6.3-1 | 문서 절 번호 참조 시 "Plan §N"/"Design §N"처럼 문서명 명시 | ✅ 이행 | 이 문서 전체가 `Plan §`/`Design §`/`CRN analysis §` 표기를 쓴다 |
| **7T-2** | 7차 §6.3-2 | 실행 중 관측한 실패를 "검증 목적과 무관"으로 넘기지 않고 별도 기록 | ✅ 채택 | Do 단계에서 브라우저 확인 중 스코프 밖 이상을 보면 §7 관찰 목록에 즉시 기록(수정은 안 함) |
| **7T-3** | 7차 §6.3-3 | gap-detector 확정 등급 항목도 최소 1건 직접 code Read 재확인 | ✅ 채택 | Check 단계 고정 루틴으로 유지 |
| **7T-4** | 7차 §6.3-4 | 다음 사이클이 `docs:upload` 실사용 회신 | ✅ **회신 완료(선행 사이클에서 종결)** | 8차가 `docs:upload`를 통째로 `pdcaw`로 대체하며 이 항목이 소멸. 8차 report §1.2가 실사용 결과(E1·E2 성공)를 이미 회신함 |
| **6T-1** | 6차 §6.3-1 | `server/l1-harness.ts`를 다음 사이클이 재사용했는지 확인 | ⛔ **N/A + 사유 → 다음 사이클로 릴레이** | 이번은 **서버 코드 0줄이 제약인 UI 사이클**이라 L1 하네스를 쓸 자리가 없다(§2.2). 7차가 이미 한 번 재사용을 실증했고(7차 §6.1), 다음 서버 변경 사이클에서 다시 확인한다 |
| **6T-2** | 6차 §6.3-2 | `cycle_create` MCP 툴 착수 시 5차 D-34 조건부 지시 적용 | ⛔ **N/A — 수요 소멸 확정** | 7차가 "미착수, 수요 소멸"로 이미 회신했고, 8차에서 `pdcaw`가 REST로 릴리즈를 생성하게 되면서 이 툴의 필요가 완전히 사라졌다. **이 항목을 여기서 종결한다** |
| **6T-3** | 6차 §6.3-3 | Design Decision Record에 "이 결정이 어디에 파생 효과를 내는가" 열 추가 | ✅ **이번 Design에 반영 지시** | Design §Decision Record 표에 `파생 효과` 열 필수. 특히 S3·S4(PDCA 숨김)는 파생 효과가 큰 결정이라 이 열이 실제로 값을 낼 자리다(§5 RK-48) |
| **6T-4** | 6차 §6.3-4 | Plan 착수 시 `git log -1 -- docs/RULE.md`로 RULE.md 변경 감지 | ✅ **이행 — 실행함** | `git log -3 -- docs/RULE.md` 실행 결과: 최신 `c8f3eed`(2026-08-09, 종료 절차 diff 파일명 규약 추가). **이번 사이클 종료 시 diff 파일명은 `v0.1.8_<커밋해시> (release-centric-ui, <완료일>).txt` 형식이어야 한다** — 이 규약이 적용되는 첫 사이클 |

**이행 6건 · N/A 릴레이 1건(6T-1) · N/A 종결 1건(6T-2) · 선행 종결 1건(7T-4).**

---

## 2. 스코프

### 2.1 In Scope — 10건 고정 (형 승인 완료, 추가 확장 금지)

> v0.1은 S1~S9 9건이었다. **S10은 형이 RK-52의 제3안으로 제시하고 스코프 +1을 직접
> 승인한 항목**이다(§2.4). 이후 추가 확장은 없다.


- [ ] **S1** 릴리즈 상세 페이지 라우트 신설 — 버전 하나가 고유 URL을 가짐. 사이드바 버전
      클릭·목록 카드 클릭 시 이 페이지로 이동
- [ ] **S2** 릴리즈 페이지 구성 — 상단에 해당 사이클 PDCA 4문서 바로가기, 아래에
      릴리즈노트 본문 렌더링 (CRN M-3 버전 앵커 문제 자연 해소)
- [ ] **S3** 사이드바 재편 — 버전 노드 아래에 해당 사이클 PDCA 4문서 트리. 기존 문서
      트리에서는 `kind='pdca'` 제외
- [ ] **S4** 프로젝트 페이지 하단 문서 목록에서 PDCA 문서 제외 — 일반 문서만 표시
      (개수 표기도 일반 문서 기준)
- [ ] **S5** 데스크탑 가로폭 반응형 — 본문 max-width 상향(Design에서 확정). 모바일 현행 유지
- [ ] **S6** 버전 목록 카드의 삭제 링크 제거 → 릴리즈 상세 페이지 안으로 이동
- [ ] **S7** 프로젝트 페이지 상단 최신 릴리즈 하이라이트 카드 (최신 1건 요약 + 상세 링크)
- [ ] **S8** projectId UI 노출 — 프로젝트 페이지에 projectId 표시 + 복사 버튼
- [ ] **S9** `parseCycleStagePath` 고아 export 정리 — 재사용/제거 방향 결정(§2.3)
- [ ] **S10** [편입, 1차 백로그 F-2] 문서 뷰 페이지에 삭제 버튼 — S4가 문서 목록에서
      PDCA 문서를 감추면서 삭제 접근 경로가 끊기는 문제(RK-52)의 해법. 형 승인 완료(§2.4)

### 2.2 Out of Scope

| 항목 | 사유 | 처리 |
|------|------|------|
| **서버·DB·MCP 변경** | 이 사이클의 **제약**. 필요한 데이터는 전부 기존 API가 이미 준다(§3.1 실측 M-2·M-4) | 발생 시 즉시 보고 후 대기 |
| **CRN I-5**(문서 제목 파생 규칙) | S3·S4가 주 노출 지점(트리·목록)을 소멸시키지만 **⌘K 팔레트·FolderView 2지점은 잔존**(§3.1 M-9) | Check에서 "주 지점 해소 / 잔여 2지점" 기록 → **`resolved` 전환은 형 결정**. 잔여 2지점은 **별도 백로그 항목으로 등록**(§2.5) |
| **FR-20**(문서 목록 kind·stage 필터) | 1차부터 Low 우선순위로 미착수. PDCA 숨김 후 필요성 재평가만 기록 | 구현 안 함. Check에서 재평가 1줄 |
| **★백로그 버튼 스타일** | 형이 의도한 강조 | 변경 금지 |
| **문서 목록 정렬 고도화** | 문서 증가 시 재검토 | 조건부 보류 |
| **CRN M-1**(사이드바 자동 펼침 시점)·**M-2**(워크스페이스 N요청) | 트리 재편의 영향 관찰만 | 직접 수정 금지, §7에 관찰 기록 |
| **CRN M-8**(삭제 실패 미처리 rejection) | S6이 삭제 액션을 **이동**시키므로 이 코드에 손이 닿지만, 오류 처리 신설은 별건 | 이동만. 재이월 기록 |
| **FolderView / ⌘K 팔레트의 PDCA 노출** | S3·S4가 명시한 두 지점(사이드바 트리·문서 목록)이 아님 | §3.1 M-9로 실측 기록 + **백로그 등록**(§2.5). 이번 구현 안 함 |
| **1차 백로그 F-1·F-3·F-4·F-6** | S10과 같은 1차 잔여 항목이지만 이 사이클의 인과와 무관 | 손대지 않음 — S10만 **RK-52의 해법이라는 인과**로 편입됐다 |

### 2.3 S9 방향 결정 — 실측 후 결론

**실측 결과**: `parseCycleStagePath`의 소비처는 **자기 테스트(`cyclePath.test.ts`)뿐**이다
(`git grep` 전수, 프로덕션 코드 0건). 유일했던 소비처 `scripts/docs-upload.ts`가 8차에서
삭제되며 고아가 됐다(8차 analysis M-1).

**이번 사이클이 이 함수를 부활시키는가? → 아니다.**

| 후보 지점 | 필요 여부 | 근거 |
|-----------|:---------:|------|
| S2 — 릴리즈 → PDCA 4문서 링크 | ❌ 불필요 | `cycleStagePath(yearMonth, name, stage)` **정방향**만 쓴다. `CycleCard.tsx:75`의 현행 패턴 그대로 |
| S3 — 사이드바 버전 노드 하위 4문서 | ❌ 불필요 | 위와 동일. cycle 레코드가 `name`+`yearMonth`를 이미 갖고 있어 경로를 **조립**하면 된다 |
| S3/S4 — PDCA 문서 필터링 | ❌ 불필요 | 경로를 파싱할 필요 없이 `document.kind === 'pdca'` 필드로 판정한다(§3.1 실측 M-4) |

**→ 방향: 제거(remove).** 함수 + 그 테스트 케이스(t1~t7 중 파서 전용분) + `ParsedCyclePath`
타입 + `CYCLE_PATH_RE` 상수를 삭제한다. 왕복 법칙 테스트(t2)는 파서가 사라지면 성립하지
않으므로 함께 정리하고, `cycleStagePath` 정방향 테스트(t1의 빌더 부분)는 남긴다.

> 이 결정은 Plan 단계에서 확정한다 — Design은 "무엇을 지울지"만 표로 확정하면 된다.

### 2.4 S10 편입 근거 — RK-52의 제3안 (형 결정, 2026-08-09)

RK-52("S4가 PDCA 문서의 삭제 접근 경로를 없앤다")에 대해 Plan v0.1은 두 선택지만
제시했다. 형이 **제3안**을 제시하고 스코프 +1을 승인했다.

| 안 | 내용 | 판정 |
|----|------|:----:|
| A | 릴리즈 상세에 PDCA 문서 삭제 4개 배치 | ❌ 지저분하고, 삭제를 노출 지점으로 끌어올리는 것이라 **S6(오조작 방지)의 방향과 역행** |
| B | 접근 경로 소실을 감수하고 기록만 | ❌ 오늘 실사용에서 니즈가 확인됨 |
| **C** | **1차 백로그 F-2(문서 뷰 페이지 삭제 버튼)를 S10으로 편입** | ✅ **채택** |

**C안이 옳은 이유** (형 논거 + Plan 실측 보강):

1. **오조작 방지 축과 정합한다.** S6이 "목록에서 지우지 말고 상세에서 지워라"는 원칙을
   릴리즈에 적용하는 것인데, S10은 **같은 원칙을 문서에 적용**한다 — 문서를 보면서 지운다.
   A안(릴리즈 페이지에 남의 문서 삭제 버튼 4개)만 이 원칙에서 벗어난다.
2. **PDCA·일반을 가리지 않고 접근 경로가 유지된다.** S4는 *목록*에서만 감추므로, 뷰어에
   삭제가 있으면 어떤 문서든 열어서 지울 수 있다. 예외 규칙이 생기지 않는다.
3. **F-2가 1차부터 묵힌 이유 자체가 이번에 무효화된다.**
   1차 analysis:123은 F-2를 `낮음(목록에는 있음)`으로 보류했다 —
   **그 괄호 안 사유가 바로 S4가 없애는 전제**다. 보류 근거가 사라진 항목을 이 사이클이
   자연 소화한다.

### 2.5 서버 백로그 대조 (MCP `backlog_list` 실측, 2026-08-09)

> **Plan v0.2의 오류 정정**: v0.2는 "B-1·B-2를 신규 등록"이라고 적었으나, **둘 다 이미
> 등록돼 있다.** 신규 생성은 중복이 된다. 이 사이클이 할 일은 **등록이 아니라 갱신·종결**이다.
> (v0.2가 MCP 미인증으로 오판한 것도 함께 정정 — 커넥터는 정상 동작한다.)

이 사이클이 **끝날 때 상태를 바꿔야 하는** 기존 백로그 항목 전수:

| id | 제목 | 이 사이클과의 관계 | 종료 시 처리 |
|----|------|-------------------|-------------|
| `d2dcbddc` | projectId UI 노출 | **S8이 구현** | → `done` |
| `4e47b81f` | 문서 뷰 UI 마감: 브레드크럼(F-1) + 삭제 버튼(F-2) | **S10이 F-2만 구현.** F-1은 미착수 | ⚠️ **묶음이라 통째 종결 불가** — detail에서 F-2 완료를 명시하고 **F-1만 남기거나**, 항목을 분리. Check에서 결정 |
| `2ea9c2ff` | CRN Minor 묶음 (M-1·M-2·M-3·M-4·M-5·M-7) | **M-3(버전 앵커 없음)을 S1·S2가 해소** | detail에서 M-3 삭선 + 잔여 5건만 유지. 묶음 자체는 `todo` 유지 |
| `28406acf` | 사이클 문서 제목 파생 규칙 (CRN I-5) | S3·S4가 주 지점 해소, **⌘K·FolderView 잔존**(§3.1 M-9) | detail 갱신 — 잔여 범위를 2지점으로 축소. `resolved` 전환 여부는 **형 결정** |
| `828cf081` | 8차 이월 묶음 (cyclePath 고아 export · RK-44 폴백) | **S9가 ①(고아 export)을 제거.** 본문에 이미 "release-centric-ui 편입 후보"로 적혀 있음 | detail에서 ① 완료 명시, ②(RK-44)만 잔여로 유지 |
| `fcc0d14e` | 6T-1: l1-harness.ts 재사용 사후 확인 | Plan §1.4가 **"N/A + 사유"로 회신**(UI 사이클이라 하네스 불요) | detail에 회신 기록 후 **다음 서버 사이클로 릴레이**. `todo` 유지 |
| `be2f3798` | 문서 목록 kind·stage 필터 (FR-20) | §2.2 — PDCA 숨김 후 **필요성 재평가만** | detail에 재평가 1줄 추가. 구현 안 함 |
| `7c428b0b` | ImportDialog 단일 원천 정리 (I-3 + **M-8**·M-9) | CRN M-8(삭제 미처리 rejection)이 **이미 이 묶음에 포함**돼 있다 | 손대지 않음 — S6은 코드를 이동만 하고 오류 처리는 신설 안 함(§2.2) |

**신규 등록 대상: 0건.** 이 사이클이 새로 만드는 관찰(§7)이 생기면 Check에서 그때 판단한다.

> **역할 분담 (형 지시, 2026-08-09)**: **클로드는 백로그를 직접 쓰지 않는다.** 위 표는
> Check 단계에서 클로드가 **"무엇이 어떻게 바뀌어야 하는지" 대조 결과만 보고**하고,
> 실제 상태 전환·detail 갱신은 형이 한다. 이 표의 값은 등록 대행이 아니라 **누락 방지**다.

> **왜 Plan에서 미리 대조했나**: 8차 회고 P-4("검증 환경이 실제로 존재하는가를 미리
> 확인")의 취지를 백로그에도 적용한 것이다. Check에서 "등록하려 했더니 이미 있더라"를
> 겪는 대신 Plan에서 확인했고, 실제로 **v0.2의 오판 2건과 DoD 오류 1건**이 이 대조에서 잡혔다.

---

## 3. 요구사항

### 3.1 필수 실측 결과 (확정 사실 — 추정 없음)

> 형이 지정한 실측 8항목 전건. 전부 코드 직접 확인(Read/grep) 결과다.

#### M-1. 현행 라우팅 구조 전수

**파일**: [src/app/router.tsx](../../../../src/app/router.tsx) — `createBrowserRouter` 단일 정의, 라우트 6개.

| # | path | element | 비고 |
|---|------|---------|------|
| 1 | `/settings/tokens` | `TokensPage` | `/w/` 트리 밖 최상위 |
| 2 | `/` | `WorkspaceList` | |
| 3 | `/w/:wsSlug` | `ProjectListPage` | |
| 4 | `/w/:wsSlug/p/:projSlug` | `ProjectOverviewPage` | 정확 매치 |
| 5 | `/w/:wsSlug/p/:projSlug/backlog` | `BacklogPage` | **와일드카드보다 먼저** (코드 주석에 명시) |
| 6 | `/w/:wsSlug/p/:projSlug/*` | `DocumentViewPage` | 문서 경로 와일드카드 |

**URL 설계 제약 (확정)**:
- `wsSlug`/`projSlug`는 **slug**이며 DB 유일 제약은 `(ownerId, slug)` / `(workspaceId, slug)`.
  프론트는 `useWorkspaces()`/`useProjects()` 목록에서 `find(w => w.slug === wsSlug)`로 해석한다
  — 즉 slug→id 변환에 별도 API 호출이 없다.
- **버전 문자열은 URL 세그먼트로 안전하다**: `cycleVersionSchema = /^v\d+\.\d+\.\d+$/`
  ([shared/schema.ts:110](../../../../shared/schema.ts)) — 영숫자와 `.`만. 인코딩 불필요.
- **신규 라우트는 반드시 #6 와일드카드보다 앞에 둬야 한다** (#5 backlog와 같은 이유).
- **경로 충돌 위험 낮음**: 문서 `path`는 `normalizePath`만 통과하면 되어 `docs/` 강제가
  **없지만**, 현행 생성 경로 2곳이 전부 `docs/` 접두를 강제한다 —
  `ImportDialog.tsx:85`(`docs/PDCA/…` 또는 `docs/${tail}`)와 `pdcaw`(스캔 대상이 `docs/`).
  → 릴리즈 라우트 세그먼트는 `docs`가 아닌 것이면 충돌하지 않는다. **최종 경로 형태는
  Design에서 확정**(후보: `/w/:ws/p/:proj/r/:version`, `/releases/:version`).

#### M-2. 릴리즈 → PDCA 문서 매핑의 현행 수단

**결론: DB 관계가 아니라 경로 파생이다.**

- `cycles` 테이블에 `documents`로의 FK가 **없다**([server/db/schema.ts:82-101](../../../../server/db/schema.ts)).
  연결 수단은 `name`(사이클 폴더명) + `yearMonth` 두 nullable 컬럼뿐.
- 경로 조립은 `cycleStagePath(yearMonth, name, stage)` 단일 원천
  ([cyclePath.ts:5](../../../../src/features/cycle/lib/cyclePath.ts)) →
  `docs/PDCA/{yearMonth}/{name}/{name}.{stage}.md`
- 문서 존재 판정은 **클라이언트 파생**: `CycleList.tsx:44`가
  `new Set(documents.map(d => d.path))`를 만들고 `CycleCard`가 `existingPaths.has(path)`로
  링크/생성폼을 가른다. **서버 조인 없음 → S2·S3도 이 패턴을 그대로 재사용 가능**.
- **한글 사이클명은 애초에 불가능하다**:
  `cycleNameSchema = /^[A-Za-z0-9._-]+$/` ([shared/schema.ts:114-119](../../../../shared/schema.ts))
  — 공백·슬래시·비ASCII 전부 서버가 거부. **URL 세그먼트로 안전**하며 인코딩 처리 불필요.
- `cyclePairRule`(shared/schema.ts:134)이 `name`/`yearMonth`를 **쌍으로 강제**하므로
  "이름만 있고 연월이 없는" 중간 상태는 존재할 수 없다 — 프론트는 `hasCycle = !!name && !!yearMonth`
  단일 판정만 하면 된다(`CycleCard.tsx:34` 현행).

#### M-3. 사이드바 트리 컴포넌트 구조

**파일**: [src/components/shell/SidebarTree.tsx](../../../../src/components/shell/SidebarTree.tsx) (278줄, 컴포넌트 5개)

```
SidebarTree
└ WorkspaceNode        useProjects(ws.id)          ← CRN M-2: 접혀 있어도 실행됨
  └ ProjectNode
    ├ (★ 백로그 링크)
    ├ VersionsSection  useCycles(project.id)       ← S1·S3 개입 지점
    │                  sortCycles(cycles,'version-desc')
    │                  현행: 모든 버전 링크가 to={base} ← CRN M-3
    └ DocumentsSection useDocuments(project.id)    ← S3 필터 삽입 지점
                       buildDocTree(documents)     ← 순수 함수
      └ TreeItem (재귀)
```

- **`kind='pdca'` 필터 삽입 지점 = `DocumentsSection`의 `buildDocTree(documents ?? [])` 직전**
  (`SidebarTree.tsx:191`). 개수 표기 `문서 ({documents?.length ?? 0})`(`:200`)도 같은 컴포넌트
  안이라 **한 곳만 고치면 트리와 개수가 동시에 맞는다**.
- `buildDocTree`는 `{path, title}[]`만 받는 순수 함수라 **시그니처 변경 불필요** —
  필터링된 배열을 넘기면 그만. 자체 테스트 `buildDocTree.test.ts` 존재.
- **버전 노드 하위 확장은 신규 구현**이다. `TreeItem`은 `TreeNode`(folder|doc) 재귀 전용이라
  버전→4문서 구조에 맞지 않는다. `VersionsSection` 안에 **평평한 4개 링크**를 직접 그리는
  편이 `TreeItem` 재사용보다 단순하다(4개 고정, 폴더 중첩 없음) — Design에서 확정.
- **`VersionsSection`은 `useCycles`만 쓰고 `useDocuments`는 안 쓴다.** S3에서 4문서의
  존재 여부(링크 vs 비활성)를 표시하려면 `useDocuments(project.id)`가 추가로 필요하다 —
  **다만 같은 `ProjectNode` 아래 `DocumentsSection`이 이미 같은 쿼리키를 쓰므로
  TanStack Query 캐시가 공유되어 추가 네트워크 요청은 발생하지 않는다**(`KEY = ['documents', projectId]`,
  `staleTime: 60_000`).

#### M-4. 문서 목록·개수 표기 지점 전수 (S4 반경)

| # | 위치 | 표시 내용 | S4 대상 |
|---|------|-----------|:-------:|
| 1 | `DocumentList.tsx:29` | `문서 ({documents?.length ?? 0})` 헤딩 | ✅ |
| 2 | `DocumentList.tsx:55-79` | 문서 `<li>` 목록 (제목 + stage 배지 + 경로 + 삭제) | ✅ |
| 3 | `SidebarTree.tsx:200` | `문서 ({documents?.length ?? 0})` | ✅ (S3) |
| 4 | `SidebarTree.tsx:191` | `buildDocTree(documents)` | ✅ (S3) |
| 5 | `FolderView.tsx:31-41` | 디렉터리 착지 페이지의 문서 목록 | ⚠️ **스코프 밖**(§2.2) |
| 6 | `CommandPalette.tsx:66-79` | ⌘K 검색 결과 | ⚠️ **스코프 밖**(§2.2, M-9) |
| 7 | `CycleList.tsx:44` | `existingPaths` 파생(표시 아님) | ❌ 필터 금지 — PDCA 문서를 걸러내면 4버튼이 전부 "없음"이 된다 |

**API 변경 불필요 (확정)**: `db.listDocuments`([server/db/scoped.ts:113-129](../../../../server/db/scoped.ts))가
`kind`와 `pdcaStage`를 **이미 select에 포함**하고 `content`는 제외한다. 즉 S3·S4는
**순수 클라이언트 필터**로 완결되며 서버 0줄 제약과 충돌하지 않는다.

> ⚠️ **#7이 이 사이클의 급소다.** `CycleList`가 `useDocuments`의 결과를 그대로 쓰므로,
> 필터를 훅(`useDocuments`) 레벨에 넣으면 4버튼이 통째로 깨진다. **필터는 반드시
> 표시 컴포넌트 레벨(`DocumentList`, `DocumentsSection`)에만 넣는다** — RK-48 참조.

#### M-5. 레이아웃 폭 정의 위치 (S5 반경)

**전역 정의가 없다. 페이지별 하드코딩이다.**

| 파일 | 현행 클래스 | S5 대상 |
|------|------------|:-------:|
| `ProjectOverviewPage.tsx:34` | `mx-auto max-w-2xl p-8` (672px) | ✅ |
| `DocumentViewPage.tsx:107,120` | `mx-auto max-w-3xl p-8` (768px) ×2 (뷰어·편집) | ✅ |
| `BacklogPage.tsx:65` | `mx-auto max-w-2xl p-8` | ✅ |
| `ProjectListPage.tsx:28` | `mx-auto max-w-2xl p-8` | ✅ |
| `WorkspaceList.tsx:29` | `mx-auto max-w-2xl p-8` | ✅ |
| `TokensPage.tsx:36` | `mx-auto max-w-2xl p-8` | ✅ |
| `LoginForm.tsx:34` | `max-w-sm` | ❌ 폼 전용, 제외 |
| `ItemDialog.tsx:114` / `CommandPalette.tsx:39` | `max-w-lg` | ❌ 모달, 제외 |

- `AppShell`은 폭 제한을 걸지 않는다 — `<main className="min-w-0 flex-1 overflow-y-auto">`
  (`AppShell.tsx:48`). 사이드바는 `w-64`(256px) 고정, `md:` 이상에서만 표시.
- **모바일은 자동으로 현행 유지된다**: `max-w-*`는 상한이라 뷰포트가 좁으면 무효.
  `p-8` 패딩만 유지하면 모바일 렌더는 바뀌지 않는다.
- **S5 반경 = 위 6개 파일 6~7군데**. 전역 유틸(예: `.page-container`) 도입 여부는 Design 결정.

#### M-6. 릴리즈노트 본문 렌더링 현행 (S2 재사용성)

- **재사용 가능하다.** [ReleaseNoteView.tsx](../../../../src/features/cycle/components/ReleaseNoteView.tsx)는
  `{ content: string }` 단일 prop 컴포넌트로, react-markdown + `remarkGfm` + `rehypeSanitize`를
  쓰고 `.prose-doc` 클래스를 두른다. **접기 UI와 결합돼 있지 않다** — `CycleCard.tsx:65`가
  `expanded &&` 블록 안에서 호출할 뿐이다.
- `MarkdownView`와 분리된 이유는 문서 링크 해석(`SmartLink`)이 불필요해서다 — 릴리즈
  상세 페이지도 같은 조건이므로 **`ReleaseNoteView`를 그대로 쓴다**. 신규 렌더러 불필요.
- `releaseNote`는 nullable + `.max(50000)`. `CycleCard.tsx:35`가 `.trim()` 후 빈 문자열을
  "노트 없음"으로 처리하는 현행 판정을 릴리즈 페이지도 따른다.

#### M-7. projectId를 프론트가 이미 갖고 있는가 (S8)

**갖고 있다. 표시만 하면 된다 — 조회 추가 불필요.**

- `ProjectOverviewPage.tsx:24,27`이 `projects.find(p => p.slug === projSlug)` →
  `const projectId = project.id`를 이미 갖는다. `CycleList`/`DocumentList`에 prop으로 넘기는
  값과 동일.
- 라우트 파라미터에는 없다(slug 기반). 스토어(zustand)에도 없다 — TanStack Query 캐시가 유일 출처.
- 복사 버튼은 `navigator.clipboard.writeText`. **HTTPS 또는 localhost에서만 동작**하며
  두 환경 모두 충족(`localhost:5173` / `pdca-workspace.vercel.app`).
- `.pdcarc.json` 스니펫 형태 복사 여부는 Design 결정. 현행 `.pdcarc.json`은
  `projectId` + `baseUrl` 2키이며 **PAT은 절대 포함하지 않는다**(8차 D-72) —
  스니펫을 만들더라도 이 2키 외 어떤 비밀도 넣지 않는다.

#### M-8. 삭제 액션 현행 구현 (S6) + 최신 릴리즈 판별 (S7)

**삭제 (S6)**:
- UI: `CycleCard.tsx:56-58` — `onDelete` prop을 받는 "삭제" 버튼(빨강 밑줄).
- 로직: `CycleList.tsx:69-72` `handleDelete(id, version)` — `confirm()` 후
  `deleteMut.mutateAsync(id)`. 문구: `"{version} 버전을 삭제할까요? (연결된 문서 자체는 그대로 남습니다)"`.
- 배선: `CycleList.tsx:160` `onDelete={() => handleDelete(cycle.id, cycle.version)}`.
- **이동 반경**: `CycleCard`에서 버튼 + `onDelete` prop 제거, `CycleList`의 `handleDelete`·
  `useDeleteCycle`을 릴리즈 상세 페이지로 이관. 삭제 성공 후 **프로젝트 개요로 리다이렉트**가
  필요하다(현재 보고 있던 페이지가 사라지므로) — 현행에는 없는 신규 동작.
- ⚠️ **CRN M-8 잔존**: `handleDelete`에 try/catch도 `onError`도 없어 실패가 미처리
  rejection이 된다. 이동만 하고 고치지 않는다(§2.2) — 재이월.

**최신 릴리즈 판별 (S7)**:
- `sortCycles(cycles, 'version-desc')[0]` — [versionSort.ts:30-46](../../../../src/features/cycle/lib/versionSort.ts).
  `compareVersions`가 각 숫자 파트를 정수 비교하므로 `v0.1.10 > v0.1.2`가 성립(단위 테스트 11케이스 통과 이력).
- **정렬 기준은 `createdAt`이 아니라 버전 번호다.** 즉 과거 버전을 나중에 추가해도
  "최신"은 버전 번호가 가장 큰 것이 된다 — 이 프로젝트의 실제 운영(태그와 1:1)에서는 일치.
- 동일 버전은 존재할 수 없다(`cycles_proj_version_uq`). tie-break 코드는 있지만 도달 불가.

#### M-9. (추가 실측) PDCA 문서 노출 지점 중 스코프 밖 2곳

형이 지정한 8항목 외에, S3·S4 판정에 직접 영향을 주는 사실이라 별도로 기록한다.

| 지점 | 현행 | I-5 해소 여부에 미치는 영향 |
|------|------|------------------------------|
| **⌘K 커맨드 팔레트** (`CommandPalette.tsx:66-79`) | `useDocuments` 전건을 필터 없이 나열, `{d.title}` 표시 | ❌ **동일 제목 4개가 여전히 보인다.** CRN I-5를 "완전 해소"로 판정하려면 이 지점도 처리해야 함 |
| **FolderView** (`FolderView.tsx:31-41`) | 디렉터리 링크 착지 시 그 폴더의 문서를 `{d.title}`로 나열 | ❌ `docs/PDCA/2026-08/{cycle}/` 에 착지하면 같은 제목 4개 |

> **판정 제안**: CRN I-5는 **"주 노출 지점(사이드바 트리·문서 목록)에서 해소, 잔여 2지점
> 존재"** 로 Check에서 기록하고, `resolved` 전환 여부는 형이 결정한다. Plan이 미리
> "resolved 예정"으로 단정하지 않는 이유가 이것이다 — 실측이 단정을 반증했다.

#### M-10. (S10 추가 실측) 문서 삭제 현행 구현

| 항목 | 실측 |
|------|------|
| 삭제 훅 | `useDeleteDocument(projectId)` — [useDocuments.ts:45-51](../../../../src/features/document/hooks/useDocuments.ts). `onSuccess`에서 `['documents', projectId]` 무효화 |
| 현행 유일 소비처 | `DocumentList.tsx:18,21-24` — `confirm(`"${title}" 문서를 삭제할까요?`)` 후 `mutateAsync(id)` |
| `DocumentViewPage`의 현황 | 삭제 **없음**. `:141-146`에 "편집" 버튼만 존재 (1차 백로그 F-2가 이 자리) |
| 필요한 추가 import | `useNavigate` — 현재 `Link, useParams`만 import 중(`DocumentViewPage.tsx:3`) |
| 문서 id 가용성 | ✅ `useDocumentByPath`가 반환하는 `doc`에 `id` 포함(단건 조회는 전체 행 select) |
| 서버 변경 | ❌ 불필요 — `DELETE /documents/:id` 기존 엔드포인트 그대로 |

> `DocumentList`의 `confirm` 문구를 그대로 쓰는 이유: 두 지점이 갈라지면 같은 파괴적
> 동작에 다른 경고가 뜬다. **문구를 상수로 뽑을지 복제할지는 Design 결정**(2곳뿐이라
> 과설계 위험도 있음).

---

### 3.2 기능 요구사항

| ID | 요구사항 | 스코프 | 우선순위 | 상태 |
|----|---------|:------:|:--------:|------|
| FR-97 | 릴리즈 상세 라우트 신설. 와일드카드 문서 라우트보다 **앞**에 배치 | S1 | High | Pending |
| FR-98 | 사이드바 버전 노드 클릭 → 릴리즈 상세로 이동(현행 `to={base}` 교체) | S1 | High | Pending |
| FR-99 | 버전 목록 카드 클릭 → 릴리즈 상세로 이동 | S1 | High | Pending |
| FR-100 | 릴리즈 상세 상단에 해당 사이클 PDCA 4문서 바로가기. 존재=링크 / 부재=비활성 또는 생성 진입 | S2 | High | Pending |
| FR-101 | 릴리즈 상세에 릴리즈노트 본문 렌더(`ReleaseNoteView` 재사용, 접기 없음) | S2 | High | Pending |
| FR-102 | 사이드바 버전 노드 하위에 해당 사이클 PDCA 4문서 펼침 | S3 | High | Pending |
| FR-103 | 사이드바 문서 트리에서 `kind==='pdca'` 제외 + 개수 표기도 제외 기준 | S3 | High | Pending |
| FR-104 | 프로젝트 페이지 문서 목록에서 `kind==='pdca'` 제외 + 개수 표기도 제외 기준 | S4 | High | Pending |
| FR-105 | 본문 max-width 상향(§3.1 M-5의 6파일). 모바일 렌더 불변 | S5 | Medium | Pending |
| FR-106 | 버전 카드에서 삭제 버튼 제거 | S6 | Medium | Pending |
| FR-107 | 릴리즈 상세 안으로 삭제 이동 + 삭제 후 프로젝트 개요로 리다이렉트 | S6 | Medium | Pending |
| FR-108 | 프로젝트 페이지 상단 최신 릴리즈 하이라이트 카드(최신 1건 + 상세 링크) | S7 | Medium | Pending |
| FR-109 | 프로젝트 페이지에 projectId 표시 + 클립보드 복사 버튼 | S8 | Medium | Pending |
| FR-110 | `parseCycleStagePath` 및 파서 전용 테스트·타입·정규식 제거 | S9 | Low | Pending |
| **FR-111** | **빈 상태 3종 처리** — ①릴리즈 0건 프로젝트(S7 카드·사이드바) ②사이클 미연결 버전(`name`/`yearMonth` null → 4문서 영역 자체 비표시) ③PDCA 문서 4종 미만 사이클(존재하는 것만 링크) | S1·S2·S3·S7 | **High** | Pending |
| **FR-112** | **존재하지 않는 버전 URL 직접 접근 시 명시적 안내** (404 문구 + 프로젝트로 돌아가기 링크) — `DocumentViewPage`의 "이 경로에 문서가 없습니다" 패턴 준용 | S1 | High | Pending |
| **FR-113** | **문서 뷰 페이지에 삭제 버튼** — `DocumentViewPage`의 편집 버튼 옆. `confirm()` 확인 문구는 `DocumentList`의 현행 문구를 재사용해 두 지점의 문구가 갈라지지 않게 한다 | S10 | **High** | Pending |
| **FR-114** | 문서 삭제 성공 후 **프로젝트 개요로 리다이렉트**(보고 있던 문서가 사라지므로). FR-107(버전 삭제 후 리다이렉트)과 동일 패턴 | S10 | High | Pending |

### 3.3 비기능 요구사항

| 범주 | 기준 | 측정 방법 |
|------|------|-----------|
| **제약 — 서버 무변경** | `server/`, `shared/`, `api/`, `drizzle/` 변경 **0줄** | `git diff --stat -- server shared api drizzle`이 empty |
| 성능 | S3의 버전 하위 4문서 표시가 **추가 네트워크 요청 0건** | `useDocuments` 쿼리키 공유 확인(§3.1 M-3) + 브라우저 Network 탭 |
| 회귀 | `tsc -b` 에러 0 / `oxlint` warning 0 / `npm test` 전건 통과 | 명령 실행 로그 |
| 보안 | 클립보드 복사 대상에 PAT·토큰류 **미포함** | 코드 확인(`.pdcarc.json` 2키만) |
| 접근성 | 신규 버튼·링크에 판별 가능한 텍스트 또는 `aria-label` | 코드 확인 |

---

## 4. Success Criteria

> **판정축 선언**: 이 사이클은 **기능 사이클**이므로 6차·8차 선례에 따라 판정은
> Match Rate(Design 대 구현 구조 일치율)로 한다. 다만 UI 사이클 특성상
> **브라우저 실증이 없는 항목은 Met으로 치지 않는다**(3차의 교훈 — "코드는 완결됐는데
> 실행으로 확인한 적이 없다"가 6/8 Partial의 단일 사유였다).

| ID | 기준 | 실증 방법 |
|----|------|-----------|
| **C36** | **릴리즈 URL 왕복(관문)** — 사이드바 버전 클릭 → 상세 페이지 착지 → PDCA 4문서 중 하나로 이동 → 뒤로가기로 복귀. URL을 복사해 새 탭에 붙여넣어도 같은 화면 | 형 브라우저(데스크탑) |
| **C37** | **PDCA 이중노출 소멸** — 사이드바 문서 트리와 프로젝트 문서 목록 어디에도 `.plan.md`류가 없고, 개수 표기가 일반 문서 수와 일치. 동시에 **버전 노드 아래에서는 4문서가 보인다** | 형 브라우저(데스크탑) + `git grep`으로 필터 삽입 지점 확인 |
| **C38** | **데스크탑 가독폭** — 데스크탑에서 본문이 넓어졌고, **모바일에서는 이전과 동일**(가로 스크롤 없음) | 형 브라우저 **2종(데스크탑·모바일 각각)** |
| **C39** | **오조작 방지** — 버전 목록 카드에 삭제가 없고, 릴리즈 상세 안에서만 삭제 가능하며 삭제 후 프로젝트 개요로 이동 | 형 브라우저(실제 삭제는 **테스트용 버전 1건**으로만) |
| **C40** | **최신 릴리즈 하이라이트** — 프로젝트 페이지 상단에 최신 1건이 뜨고 상세로 이동. 버전 번호 최대값 기준(`v0.1.10 > v0.1.2`) | 형 브라우저 + `versionSort` 기존 단위 테스트 |
| **C41** | **projectId 취득** — 프로젝트 페이지에서 projectId를 복사해 `.pdcarc.json`에 그대로 붙여넣을 수 있다(DB 조회 불필요) | 형 브라우저 — 복사한 값이 현행 `.pdcarc.json`의 값과 일치하는지 눈으로 대조 |
| **C42** | **빈 상태 3종**(FR-111) + **없는 버전 URL**(FR-112)이 전부 깨지지 않고 안내를 낸다 | 형 브라우저 — 실데이터에 이미 존재하는 케이스 우선, 없으면 URL 직접 입력으로 재현 |
| **C43** | **무회귀 + 서버 0줄** — `tsc -b` 그린 / `oxlint` 0 / `npm test` 전건 통과 / `git diff --stat -- server shared api drizzle` empty | 명령 실행 로그 |
| **C44** | **문서 삭제 경로 유지(S10, RK-52 해소 실증)** — S4로 목록에서 감춰진 **PDCA 문서**를 릴리즈 상세 → 문서 뷰어로 열어 실제로 삭제할 수 있고, 삭제 후 프로젝트 개요로 이동한다. **일반 문서도 뷰어에서 동일하게 삭제된다** | 형 브라우저 — 실제 삭제는 **테스트용 문서 1건**으로만. 삭제 후 `pdcaw`로 재업로드하면 복구되므로 PDCA 문서로 실증해도 안전 |

### 4.1 Definition of Done

- [ ] FR-97~FR-114 전건 적용 (미달 시 사유 명시)
- [ ] C36~C44 전건 실증 — **브라우저 확인 항목은 형의 확인 회신을 문서에 인용**
- [ ] S9 제거 완료 + `npm test` 케이스 수 감소가 파서 테스트분과 일치
- [ ] `git diff --stat -- server shared api drizzle` empty (제약 실증)
- [ ] §2.2 Out of Scope 항목이 실제로 손대지지 않았음 확인 (특히 ★백로그 버튼 스타일)
- [ ] CRN I-5 / FR-20 재평가 1줄씩 Check에 기록 (§3.1 M-9 반영)
- [ ] **§2.5 대조표 8건 전건을 Check에서 형에게 보고** (클로드는 백로그 직접 수정 안 함):
  - [ ] `d2dcbddc`(projectId) → `done`
  - [ ] `4e47b81f`(F-1+F-2 묶음) → **F-2만 해소되므로 분리 또는 detail 갱신** (형 결정)
  - [ ] `2ea9c2ff`에서 CRN M-3 삭선, `828cf081`에서 8차 M-1 완료 명시
  - [ ] `fcc0d14e`(6T-1)에 N/A 회신 기록 후 다음 서버 사이클로 릴레이
  - [ ] `28406acf`(I-5) detail을 잔여 2지점으로 축소 — `resolved` 전환은 형 결정

---

## 5. 리스크와 완화

| ID | 리스크 | 영향 | 가능성 | 완화 |
|----|--------|:----:|:------:|------|
| **RK-47** | 신규 릴리즈 라우트가 `/w/:ws/p/:proj/*` 와일드카드에 먹혀 문서 뷰어로 착지 | 높음 | 중 | 라우트 배열에서 와일드카드 **앞**에 배치(#5 backlog 선례). Do에서 URL 직접 입력으로 즉시 확인 |
| **RK-48** | `kind='pdca'` 필터를 **훅(`useDocuments`) 레벨**에 넣어 `CycleList`의 `existingPaths`가 비어버림 → 4버튼이 전부 "+생성"으로 뒤집힘 | **높음** | 중 | **필터는 표시 컴포넌트에만**(§3.1 M-4 #7). Design에서 삽입 지점을 파일:행으로 못박고, Do 후 버전 카드 4버튼이 여전히 링크인지 육안 확인 |
| **RK-49** | 빈 상태 미처리로 런타임 크래시 — 특히 `cycle.name!`/`cycle.yearMonth!` **non-null 단언**이 현행 코드에 이미 있다(`CycleList.tsx:154`, `CycleCard.tsx:75`) | 높음 | 중 | FR-111을 High로 고정. 신규 코드에서는 단언 대신 `hasCycle` 가드 사용 |
| **RK-50** | S3가 사이드바에 `useDocuments`를 추가하면서 요청이 늘어남(CRN M-2의 N+1 악화) | 중 | 낮 | 쿼리키 공유로 캐시 히트 확인(§3.1 M-3). Do에서 Network 탭 실측 — 늘면 즉시 보고 |
| **RK-51** | S5 폭 상향이 마크다운 표·코드블록 가독성을 오히려 해침(줄이 너무 길어짐) | 낮 | 중 | 문서 뷰어(`max-w-3xl`)와 목록 페이지(`max-w-2xl`)의 상향폭을 **다르게** 잡는 것을 Design에서 검토 |
| ~~RK-52~~ | ~~S4로 PDCA 문서를 목록에서 지우면 그 문서를 지울 수단이 사라진다~~ | 중 | 높음 | ✅ **해소 — S10 편입(§2.4, 형 결정)**. 문서 뷰어에 삭제를 두어 접근 경로를 유지한다. 실증은 C44 |
| RK-53 | 클립보드 API가 비보안 컨텍스트에서 실패 | 낮 | 낮 | localhost·HTTPS 모두 충족(§3.1 M-7). 실패 시 `<input readOnly>` 폴백을 Design에서 검토 |
| **RK-54** | **S10이 새로 만드는 오조작 위험** — 뷰어의 "편집" 바로 옆에 "삭제"가 붙으면 오클릭 가능. S6이 줄인 위험을 다른 자리에서 되살릴 수 있다 | 중 | 중 | `confirm()` 유지가 1차 방어. 배치(편집과의 거리·색·위치)를 Design UI 명세에서 명시적으로 결정하고, 형 브라우저 확인 시 **"실수로 누를 만한가"를 함께 판정** |
| **RK-55** | S10의 삭제가 릴리즈에 연결된 PDCA 문서를 지워도 `cycles` 레코드는 남아, 버전 카드 4버튼이 조용히 "+생성"으로 되돌아간다 | 낮 | 중 | **의도된 동작이다** — 문서와 릴리즈는 FK 없는 경로 파생 관계(§3.1 M-2). `pdcaw` 재업로드로 즉시 복구된다. `confirm` 문구에 이 사실을 덧붙일지는 Design 검토 |

---

## 6. 영향 분석

### 6.1 변경 대상 자원

| 자원 | 종류 | 변경 내용 |
|------|------|-----------|
| `src/app/router.tsx` | 라우팅 | 릴리즈 상세 라우트 1건 추가 (와일드카드 앞) |
| `src/features/cycle/components/CycleCard.tsx` | 컴포넌트 | 삭제 버튼 제거, 카드 클릭 → 상세 이동 |
| `src/features/cycle/components/CycleList.tsx` | 컴포넌트 | `handleDelete`·`useDeleteCycle` 이관, `onDelete` prop 제거 |
| `src/components/shell/SidebarTree.tsx` | 컴포넌트 | `VersionsSection` 링크 대상 교체 + 4문서 하위 트리, `DocumentsSection` pdca 필터 |
| `src/features/document/components/DocumentList.tsx` | 컴포넌트 | pdca 필터 + 개수 표기 |
| `src/features/document/components/ProjectOverviewPage.tsx` | 컴포넌트 | 최신 릴리즈 카드, projectId 표시, max-width |
| (신규) 릴리즈 상세 페이지 | 컴포넌트 | S1·S2·S6 집결지 |
| `src/features/document/components/DocumentViewPage.tsx` | 컴포넌트 | **S10** — 삭제 버튼 + 삭제 후 리다이렉트, max-width(S5) |
| `src/features/cycle/lib/cyclePath.ts`(+test) | 순수 함수 | `parseCycleStagePath` 계열 제거 |
| 페이지 6종 max-width | 스타일 | §3.1 M-5 표 |
| **`server/`, `shared/`, `api/`, `drizzle/`** | — | **변경 없음(제약)** |

### 6.2 현행 소비자 전수

| 자원 | 소비자 | 영향 |
|------|--------|------|
| `useDocuments(projectId)` | `DocumentList`(표시) | 필터 추가 — **의도된 변경** |
| | `SidebarTree.DocumentsSection`(표시) | 필터 추가 — **의도된 변경** |
| | `CycleList`(`existingPaths` 파생) | **필터 금지 — 넣으면 4버튼 붕괴(RK-48)** |
| | `CommandPalette`(검색) | 손대지 않음 — 스코프 밖(§2.2) |
| | `useDocumentByPath`/`useTree`는 별도 쿼리키 | 무영향 |
| `useCycles(projectId)` | `CycleList` | 카드 클릭 대상 변경 |
| | `SidebarTree.VersionsSection` | 링크 대상 변경 + 4문서 하위 |
| | (신규) 릴리즈 상세 | 신규 소비자 — 목록에서 `version` 매치로 단건 선택 |
| `useDeleteCycle` | `CycleList` | **릴리즈 상세로 이관** |
| `useDeleteDocument` | `DocumentList` | 유지 — S4로 목록에 PDCA가 안 뜰 뿐, 일반 문서 삭제는 그대로 |
| | (신규) `DocumentViewPage` | **신규 소비자(S10)**. 같은 훅을 재사용하므로 캐시 무효화 동작 동일 |
| `cycleStagePath()` | `CycleCard.tsx:75` | 유지 + 신규 2곳(릴리즈 상세, 사이드바)이 추가 소비 |
| `parseCycleStagePath()` | `cyclePath.test.ts`만 | **제거(§2.3)** |
| `ReleaseNoteView` | `CycleCard.tsx:65` | 유지 + 릴리즈 상세가 추가 소비 |
| `buildDocTree` | `SidebarTree.tsx:191` | 시그니처 불변, 입력만 필터링 |
| `sortCycles` | `CycleList`, `SidebarTree` | 유지 + S7이 `[0]` 추가 소비 |
| `STAGE_COLOR` | `CycleCard`, `DocumentList`, `DocumentViewPage` | 유지 (S4로 `DocumentList`의 배지는 사용처 소멸 가능 — Design 확인) |

### 6.3 검증 — 실행 환경 존재 확인 (8T-P4 첫 적용)

> 8차 회고 P-4: "검증에 필요한 실행 환경이 실제로 존재하는가"를 **사전에** 확인한다.

| 검증 수단 | 존재 여부 | 확인 근거 |
|-----------|:---------:|-----------|
| 로컬 dev 서버 | ✅ 존재 | `package.json`의 `dev:local`(API tsx watch + vite 동시 기동). 3차 D-24로 도입, 이후 전 사이클이 사용 |
| 형의 브라우저 — 데스크탑 | ✅ 가용 | 4·6차에서 브라우저 확인 회신 선례 |
| 형의 브라우저 — 모바일 | ✅ **가용 확인됨** | **형 회신(2026-08-09): "확인가능".** C38을 데스크탑·모바일 2종 실증으로 확정 — 축소하지 않는다. 8T-P4가 실제로 값을 낸 지점(사전 질문 → Do 단계 재질문 방지) |
| L1 서버 하네스 | ❌ **불필요** | 서버 0줄 제약이라 쓸 자리 없음. 6T-1 N/A 사유와 동일 |
| Playwright E2E | ❌ 미설치 | 저장소에 없음(`package.json` 확인). 이번에 도입하지 않는다 — 형 브라우저 확인이 실증 수단 |
| 단위 테스트 | ✅ 존재 | Vitest. 다만 이번 변경분은 대부분 컴포넌트라 **순수 함수만 테스트**(7차 D-65) 방침상 신규 테스트는 S9 정리분 외 없을 전망 |

- [x] 모바일 확인 가능 여부를 Do 착수 전 확인 — **완료(형 회신 "확인가능")**
- [ ] 신규 라우트가 기존 라우트를 가리지 않는지 URL 직접 입력으로 확인
- [ ] `existingPaths` 파생이 필터에 오염되지 않았는지 4버튼 육안 확인

---

## 7. 아키텍처 고려사항

### 7.1 프로젝트 레벨

**Dynamic** (기존 유지) — feature 기반 모듈, `src/features/{cycle,document,...}`.
이번 사이클은 레벨 변경 없음.

### 7.2 주요 결정 (Design에서 확정할 항목)

> Plan은 **선택지와 제약**만 확정한다. 결정은 Design Checkpoint 3.
> **6T-3 지시**: Design의 Decision Record 표에 `파생 효과` 열을 반드시 넣는다.

| 결정 대상 | 후보 | Plan이 확정한 제약 |
|-----------|------|-------------------|
| 릴리즈 상세 URL 형태 | `/w/:ws/p/:proj/r/:version` · `/w/:ws/p/:proj/releases/:version` | 와일드카드 앞 배치 필수. 세그먼트가 `docs`가 아니면 충돌 없음(§3.1 M-1) |
| 릴리즈 상세의 데이터 취득 | `useCycles` 목록에서 `find(c => c.version === version)` · 신규 단건 API | **신규 API 금지**(서버 0줄). → 전자 확정에 가까움 |
| 사이드바 버전 하위 4문서 렌더 | `TreeItem` 재사용 · 전용 평면 렌더 | 4개 고정·폴더 없음이라 전용 렌더가 단순(§3.1 M-3) |
| pdca 필터 삽입 위치 | 훅 · 표시 컴포넌트 | **표시 컴포넌트 확정**(RK-48) |
| max-width 값 | 단일 값 · 페이지 유형별 차등 | 모바일 불변이 조건. RK-51 고려 |
| projectId 복사 형식 | 값만 · `.pdcarc.json` 스니펫 | PAT 절대 미포함 |
| ~~PDCA 문서 삭제 경로 (RK-52)~~ | ~~릴리즈 상세에 삭제 배치 · 이번엔 감수~~ | ✅ **Plan에서 확정 — S10(문서 뷰어에 삭제), 형 결정 §2.4** |
| S10 삭제 버튼 배치 (RK-54) | 편집 옆 · 떨어뜨림 · 하단 별도 영역 | 오조작 방지 축과 정합해야 함. `confirm()`은 유지 |
| S10 확인 문구 관리 | 상수 추출 · 2곳 복제 | 2곳뿐이라 과설계 위험. 갈라지지만 않으면 됨(§3.1 M-10) |

---

## 8. 규약 전제

| 항목 | 현재 상태 |
|------|-----------|
| 전역 `~/.claude/CLAUDE.md` | ✅ 존재 (8차에서 저장소 루트 `CLAUDE.md`를 전역으로 이관) |
| `docs/RULE.md` | ✅ 존재, 최신 `c8f3eed`(2026-08-09) — **종료 절차 diff 파일명 규약 신설분이 이번 사이클에 처음 적용된다**(6T-4) |
| TypeScript / oxlint / Vitest | ✅ 전부 구성됨 |
| 환경변수 | **추가 없음** — 이번 사이클은 프론트 전용 |
| 미푸시 커밋 | ⚠️ `c8f3eed`(README + RULE.md) 1건이 로컬에만 있음. 형 계획대로 **이번 사이클 종료 시 함께 푸시** |

---

## 9. 다음 단계

1. [x] **형 승인 완료(2026-08-09)** — S9 제거 방향 동의 / I-5 판정 유보 동의(+잔여 2지점 백로그화) /
   RK-52는 **제3안 S10 편입**으로 해소, 스코프 +1 승인 / C38 모바일 확인 "가능" 회신
2. [ ] `/bkit:pdca design release-centric-ui` — 3안 비교 후 Checkpoint 3
3. [ ] Do — Design의 Session Guide에 따라 모듈 분할 구현
4. [ ] Check → Report → 종료 절차(`v0.1.8`)

---

## Version History

| Version | Date | Changes | Author |
|---------|------|---------|--------|
| 0.1 | 2026-08-09 | 최초 작성 — 형 지정 스코프 9건 + 실측 8항목(+M-9 추가) + P-1 표 | Claude |
| **0.3** | 2026-08-09 | **§2.5 전면 정정** — MCP `backlog_list` 실측 결과 v0.2가 "신규 등록"으로 적은 B-1·B-2가 **이미 등록된 항목**이었음(중복 생성 직전에 발견). "등록 대상"에서 **"기존 8건 대조·갱신표"** 로 교체. 함께 잡힌 오류: DoD의 "F-2 `done` 전환"은 실제 항목이 F-1+F-2 묶음이라 통째 종결 불가. v0.2의 "MCP 미인증" 서술도 오판이라 삭제 | Claude |
| **0.2** | 2026-08-09 | **형 승인 반영.** ①S9 제거 확정 ②I-5 판정 유보 확정 + 잔여 2지점 백로그화(§2.5 B-1·B-2) ③**RK-52를 제3안 S10(1차 백로그 F-2 편입)으로 해소** — §2.4 신설, FR-113·114, C44, M-10 실측, RK-54·55 신설, RK-52 종결 ④C38 모바일 확인 가능 회신 반영(§6.3 ⚠️→✅) | Claude |
