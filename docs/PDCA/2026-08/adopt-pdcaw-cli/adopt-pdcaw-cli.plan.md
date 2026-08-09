---
template: plan
version: 1.3
---

# adopt-pdcaw-cli 계획 문서

> **한 줄 요약**: refine-cycle-closing(7차)에서 이 프로젝트 전용으로 급조한
> `scripts/docs-upload.ts`를 걷어내고, 그걸 범용화해 npm에 이미 게시한 외부 패키지
> `pdcaw`(v0.2.0)로 갈아탄다. 새 기능 없음 — 자체 구현을 외부 소비로 옮기는 정리 사이클.
>
> **프로젝트**: PDCA-workspace
> **작성자**: Claude
> **작성일**: 2026-08-09
> **상태**: Draft
> **PDCA Cycle**: adopt-pdcaw-cli (문서화 기준 8번째 사이클)

---

## Executive Summary

| 관점 | 내용 |
|------|------|
| **Problem** | `scripts/docs-upload.ts`(+`scripts/lib/git-changes.ts`, `scripts/lib/workspace-api.ts`, 각 테스트)가 이 저장소에만 있는 사본으로 남아있다. 같은 로직을 이미 범용화해 별도 프로젝트(`pdcaw-cli`)로 재구현하고 npm에 `pdcaw@0.2.0`으로 게시까지 마쳤는데, 이 프로젝트는 여전히 옛 사본을 쓴다 — 로직이 두 곳에 존재하고, `pdcaw`가 개선돼도 이 저장소엔 반영되지 않는다 |
| **Solution** | 옛 스크립트 4개 파일(+테스트 2개)을 전부 삭제하고, `RULE.md` 종료 절차 3번 항목과 사이클 종료 시 실행 명령을 `npx pdcaw@latest upload --cycle <이름> --version <버전>`으로 직접 교체한다. `package.json`의 `docs:upload` 스크립트는 제거한다(래퍼 없이 CLI를 직접 노출). `.pdcarc.json`을 신설해 `baseUrl`·`projectId`를 커밋해두고, `.env.local`은 `PDCAW_PAT`만 담당하게 정리한다 |
| **Function/UX Effect** | 형이 사이클을 닫을 때 치는 명령이 `npm run docs:upload -- --cycle … --version …`에서 `npx pdcaw@latest upload --cycle … --version …`으로 바뀐다. 동작은 거의 동일하되, 업로드 대상이 `docs/PDCA/` 한정에서 **`docs/` 전체**(예: `docs/deploy/CHECKLIST.md`)로 넓어진다(형 확인 완료 — 의도된 변경) |
| **Core Value** | "이 저장소 전용 스크립트를 유지보수한다"에서 "관리되는 외부 CLI를 소비한다"로 축을 옮긴다 — `pdcaw`가 앞으로 받을 버그 수정·기능 추가가 이 저장소를 포함한 모든 소비 프로젝트에 별도 작업 없이 전파된다 |

---

## Context Anchor

> Executive Summary에서 생성. Design 문서로 전파되어 세션 간 컨텍스트 연속성 유지.

| Key | Value |
|-----|-------|
| **WHY** | 자체 구현 스크립트(`scripts/docs-upload.ts` 등)를 이미 범용화·게시된 외부 패키지(`pdcaw@0.2.0`)로 대체해 로직 이원화를 없앤다 |
| **WHO** | 형 — 명령 실행자·승인자(사이클 종료는 비가역이라 형 승인 필요) / Claude — 스크립트 삭제·`RULE.md`/`package.json`/`.env.local.example` 개정·`.pdcarc.json` 신설 |
| **RISK** | `npx pdcaw@latest`는 버전을 고정하지 않으므로 `pdcaw`의 향후 breaking release가 예고 없이 이 저장소의 종료 절차를 깨뜨릴 수 있음 / `pdcaw`는 `PDCAW_BASE_URL` 기본값이 없어 미설정 시 즉시 실패(기존 스크립트는 prod로 기본값 처리했음) / 업로드 대상이 `docs/` 전체로 넓어져 의도치 않은 문서가 함께 올라갈 가능성 |
| **SUCCESS** | 옛 스크립트·테스트 완전 삭제, `RULE.md` 개정 명령으로 실제 업로드 성공 재현, `.pdcarc.json`으로 `baseUrl`/`projectId` 커밋 완료, 기존 기능(멱등성·PAT 비노출·부분 실패 시 나머지 계속) 무손실 |
| **SCOPE** | 스크립트 교체 + `RULE.md`·`package.json`·`.env.local(.example)` 갱신 + `.pdcarc.json` 신설. `pdcaw` 자체의 기능 변경이나 이 저장소의 다른 기능 변경은 스코프 외 |

---

## 1. Overview

### 1.1 목적

1. **로직 이원화를 없앤다** — `scripts/docs-upload.ts`가 하던 일(git 변경분 탐지 → 사이클 생성
   → 문서 upsert)을 그대로 하는 외부 CLI가 이미 있으므로, 이 저장소는 그걸 호출만 한다.
2. **종료 절차(`RULE.md` 3번)를 실물과 정합시킨다** — 명령어 표기를 `npx pdcaw upload …`로
   직접 바꾸고, 바뀐 동작(대상 범위 확대, `PDCAW_BASE_URL` 필수화)을 문서에 반영한다.
3. **`.pdcarc.json`으로 설정을 코드베이스에 고정한다** — PAT를 뺀 나머지(`baseUrl`,
   `projectId`)는 비밀이 아니므로 커밋해, `.env.local`은 PAT 하나만 책임지게 좁힌다.

### 1.2 배경

refine-cycle-closing(7차, `v0.1.6`)에서 "사이클 종료 시 문서를 서버에 반영하는 절차"의 두 누수
(본문 재타이핑, 이전 사이클 사후개정분 누락)를 닫기 위해 `scripts/docs-upload.ts` +
`scripts/lib/{git-changes,workspace-api}.ts`를 이 저장소에 직접 구현했다. 완료 보고서
(§1.1)가 스스로 밝히듯 "만들고 보니 범용적이지 못했다" — 로직이 이 저장소의 `cyclePath.ts`
경로 규칙과 `.env.local` 관례에 묶여 있어 다른 프로젝트에 그대로 옮길 수 없었다.

그래서 별도 저장소 `pdcaw-cli`에서 같은 문제를 범용 CLI로 다시 풀었고, npm에 `pdcaw@0.2.0`으로
이미 게시했다(`spiritflag <jsgnwk@naver.com>`, 1시간 전 게시 확인). 인터페이스는 옛 스크립트의
상위집합이다:

| 항목 | 옛 스크립트 | `pdcaw@0.2.0` |
|------|-------------|----------------|
| 커맨드 | `npm run docs:upload -- [flags]` | `npx pdcaw upload [flags]` |
| 플래그 | `--cycle` `--version` `--all` `--project` `--base-url` | 좌동 + `--path`(신규) |
| 환경변수 | `PDCAW_PAT` `PDCAW_PROJECT_ID` `PDCAW_BASE_URL` | **이름 동일** |
| `--base-url` 미지정 시 | 프로덕션으로 기본값 처리 | **기본값 없음 — 에러 종료** |
| 스캔 범위 | `docs/PDCA/` 하위만(`--all` 포함) | **`docs/` 전체**, PDCA 형식 경로만 `kind:'pdca'`, 나머지는 `kind:'general'` |
| 설정 파일 | 없음(`.env.local`만) | `.pdcarc.json`(`baseUrl`, `projectId` — PAT 제외) 지원 |

### 1.3 확정 사실 (실측)

- `npm view pdcaw` — `pdcaw@0.2.0`, dist-tag `latest`, `bin: pdcaw`, 의존성 0개, 1시간 전 게시.
  기존 우려("아직 게시 안 됨")는 착오였음(형 정정, Checkpoint 1).
- 옛 스크립트 4개 파일 실측 라인 수: `scripts/docs-upload.ts` 254줄,
  `scripts/lib/git-changes.ts` 90줄(+테스트 71줄), `scripts/lib/workspace-api.ts` 111줄
  (+테스트 29줄). 합계 555줄이 순수 삭제 대상.
- `src/features/cycle/lib/cyclePath.ts`는 옛 스크립트뿐 아니라 프론트(`CycleCard.tsx`,
  `CycleList.tsx`)에서도 쓰인다 — **삭제 대상 아님**, 그대로 유지.
- `.env.local`의 `PDCAW_PAT`/`PDCAW_PROJECT_ID`/`PDCAW_BASE_URL` 값은 이미 채워져 있고
  변수 이름이 `pdcaw`가 기대하는 이름과 동일 — 값 자체는 바꿀 필요 없음, 주석과
  "선택/기본값" 서술만 갱신 대상.
- `docs/RULE.md` 26행이 유일하게 `npm run docs:upload -- --cycle <사이클명> --version <버전>`
  문구를 담은 지점(사이클 종료 절차 3번).
- `docs/PDCA` 밖에서 `docs/`에 존재하는 유일한 마크다운은 `docs/deploy/CHECKLIST.md` —
  스캔 범위 확대 시 `kind:'general'`로 실제 영향받는 파일은 이 1건뿐임을 확인.
- `.gitignore`는 `.env*`를 전부 무시하되 `.env.local.example`만 예외 처리한다 —
  `.pdcarc.json`은 이 패턴에 걸리지 않아 **커밋 가능**함을 확인.
- 최신 태그: `v0.1.6`.

### 1.4 Checkpoint 1·2 결정 사항

| # | 쟁점 | 형의 답 |
|---|------|---------|
| 1 | `pdcaw` 의존성 연결 방식 | **`npx pdcaw@latest`로 매번 호출** — `package.json` devDependency 추가 안 함 |
| 2 | `RULE.md` 3번 항목 명령어 표기 | **`npx pdcaw upload`로 직접 노출** — 래퍼 스크립트(`npm run docs:upload`) 제거 |
| 3 | `.pdcarc.json` 커밋 여부 | **추가함** — `baseUrl`/`projectId` 고정, `.env.local`은 PAT 전용으로 좁힘 |
| 4 | 삭제 범위 | **`scripts/docs-upload.ts` + `scripts/lib/{git-changes,workspace-api}.ts`(+테스트) 전부 삭제**, `cyclePath.ts`는 유지 |
| 5 | `docs/` 전체 스캔 확대가 의도된 것인가 | **의도된 것 맞음** — `RULE.md` 3번 항목에 반영 필요 |

### 1.5 관련 문서

- 이전 구현: [refine-cycle-closing.plan.md](../refine-cycle-closing/refine-cycle-closing.plan.md),
  [refine-cycle-closing.report.md](../refine-cycle-closing/refine-cycle-closing.report.md)
- 외부 패키지 소스: `/home/singi/workspace/pdcaw-cli` (README, `package.json`)
- 종료 절차 원본: [docs/RULE.md](../../../RULE.md)

---

## 2. Scope

### 2.1 In Scope

- [ ] `scripts/docs-upload.ts`, `scripts/lib/git-changes.ts`, `scripts/lib/git-changes.test.ts`,
      `scripts/lib/workspace-api.ts`, `scripts/lib/workspace-api.test.ts` 삭제
- [ ] `package.json`의 `docs:upload` 스크립트 항목 제거
- [ ] `.pdcarc.json` 신설(`baseUrl`, `projectId` 커밋)
- [ ] `.env.local.example` 갱신 — `PDCAW_PROJECT_ID`/`PDCAW_BASE_URL`을 "선택, `.pdcarc.json`이
      기본 출처" 서술로 바꾸고, `PDCAW_PAT`만 필수로 남김. "scripts/docs-upload.ts 전용" 주석을
      `pdcaw` CLI 기준으로 교체
- [ ] `docs/RULE.md` 종료 절차 3번 항목 — 명령어를 `npx pdcaw@latest upload --cycle <사이클명>
      --version <버전>`으로 교체, 스캔 범위가 `docs/` 전체임을 명시
- [ ] `docs/PDCA/_INDEX.md`에 이 사이클 행 추가(사이클 종료 시, 기존 규칙대로)

### 2.2 Out of Scope

- `pdcaw` 패키지 자체의 기능 변경 — 별도 저장소(`pdcaw-cli`)의 몫, 이 사이클은 소비만 한다
- `cyclePath.ts` 및 프론트 사이클 UI 변경 — 옛 스크립트만 걷어내고 프론트가 쓰는 파일은 그대로 둔다
- `pdcaw`를 `devDependency`로 고정하는 방식(버전 핀) — Checkpoint 1에서 `npx@latest`로 결정,
  버전 핀이 필요해지면 별도 사이클
- 서버(`server/`, `api/`, `shared/`) 코드 변경 — 이번 사이클은 로컬 스크립트/문서/설정만 대상

---

## 3. Requirements

### 3.1 기능 요구사항

| ID | 요구사항 | 우선순위 | 상태 |
|----|----------|:--------:|:----:|
| **FR-90** | `scripts/docs-upload.ts`, `scripts/lib/git-changes.ts`(+test), `scripts/lib/workspace-api.ts`(+test) 5개 파일을 삭제한다 | High | Pending |
| **FR-91** | `package.json`의 `docs:upload` 스크립트 항목을 제거한다 | High | Pending |
| **FR-92** | `.pdcarc.json`을 신설해 `projectId`·`baseUrl`을 담는다. PAT는 이 파일에 두지 않는다(README 경고와 일치) | High | Pending |
| **FR-93** | `.env.local.example`을 갱신한다 — `PDCAW_PAT`는 필수로 유지, `PDCAW_PROJECT_ID`/`PDCAW_BASE_URL`은 "`.pdcarc.json`이 있으면 생략 가능"으로 서술 변경 | Medium | Pending |
| **FR-94** | `docs/RULE.md` 종료 절차 3번 항목의 명령어를 `npx pdcaw@latest upload --cycle <사이클명> --version <버전>`으로 교체하고, 스캔 범위가 `docs/` 전체(PDCA 형식 외 문서는 `kind:'general'`)임을 명시한다 | High | Pending |
| **FR-95** | 교체 후 실제로 `npx pdcaw@latest upload --cycle adopt-pdcaw-cli`(버전 없이, 부분 동기화)를 dev 서버 대상으로 실행해 문서 업로드가 성공함을 확인한다 | High | Pending |
| **FR-96** | 삭제 이후 `npm test`, `tsc -b`, `oxlint`가 옛 스크립트 관련 참조 없이 그린으로 통과한다 | High | Pending |

### 3.2 비기능 요구사항

| 범주 | 기준 | 측정 방법 |
|------|------|-----------|
| **회귀 없음** | 옛 스크립트 삭제가 프론트(`cyclePath.ts` 소비처)에 영향 없음 | `npm test`, `tsc -b` 그린 |
| **비밀 비노출** | `.pdcarc.json`에 PAT가 들어가지 않음 | 파일 diff 육안 확인 + `pdcaw` README의 "pat/token 키는 경고 후 무시" 동작과 별개로 애초에 넣지 않음 |
| **문서 정합** | `RULE.md` 종료 절차가 실제 실행 가능한 명령과 100% 일치 | FR-95 실행 로그로 검증 |

---

## 4. Success Criteria

| ID | 기준 | 충족 조건 |
|----|------|-----------|
| **C32** | **로직 이원화 해소** | 옛 스크립트 5개 파일이 저장소에서 사라지고, `git grep`으로 `scripts/docs-upload\|scripts/lib`를 찾아도 코드 참조가 0건(문서의 과거 기록 언급은 예외) |
| **C33** | **RULE.md 실물 정합** | 개정된 3번 항목의 명령을 그대로 복사해 실행하면 성공한다(FR-95로 실증) |
| **C34** | **설정 이원화 정리** | `.pdcarc.json` 존재 + `.env.local`은 `PDCAW_PAT`만 필수 항목으로 남음 |
| **C35** | **무회귀** | 삭제·교체 전후로 `npm test` 결과·`tsc -b` 결과 동일(둘 다 그린) |

### 4.1 Definition of Done

- [ ] FR-90~FR-96 전건 적용
- [ ] C32~C35 전건 실증(로그 첨부)
- [ ] `npm test` 그린, `tsc -b` 그린, `oxlint` 0 warning
- [ ] `git grep -n "docs-upload\|scripts/lib"`로 남은 코드 참조 없음 확인(문서 내 과거 기록 제외)
- [ ] dev 서버 대상 `npx pdcaw@latest upload` 1회 실제 실행 성공 로그 확보

---

## 5. Risks and Mitigation

| ID | 리스크 | 영향 | 가능성 | 완화 |
|----|--------|:----:|:------:|------|
| **RK-44** | `npx pdcaw@latest`가 매번 최신 버전을 당겨오므로, `pdcaw`에 향후 breaking release가 나오면 이 저장소의 종료 절차가 예고 없이 깨진다(Checkpoint 1에서 버전 핀 대신 `@latest`로 결정한 트레이드오프) | Medium | Low | Design 단계에서 이 리스크를 `RULE.md`에 짧게 명시 — 실패 시 `npx pdcaw@0.2.0`처럼 버전을 임시 고정해 우회하는 방법을 문서에 남긴다 |
| **RK-45** | 스캔 범위가 `docs/` 전체로 넓어져 앞으로 `docs/` 밑에 추가되는 비-PDCA 문서(예: 임시 메모)가 의도치 않게 서버로 올라갈 수 있다 | Low | Medium | RULE.md의 `.tmp` 확장자 규칙(질문용 임시 파일)이 `.md`가 아니라서 애초에 스캔 대상이 아님을 확인·문서화. 그 외 `docs/` 하위 문서는 "서버에 올라가도 되는 문서만 둔다"는 암묵 규칙을 RULE.md에 한 줄 추가 |
| **RK-46** | `PDCAW_BASE_URL` 기본값이 없어, `.env.local`이나 `.pdcarc.json` 둘 다 없는 새 클론 환경에서 즉시 실패한다(옛 스크립트는 조용히 prod로 기본값 처리했음) | Low | Low | `.pdcarc.json`을 커밋해두면 저장소를 클론한 시점부터 `baseUrl`은 항상 존재 — PAT만 형이 별도로 채우면 됨(FR-92로 이미 대응) |

---

## 6. Impact Analysis

### 6.1 변경 리소스

| 리소스 | 유형 | 변경 내용 |
|--------|------|-----------|
| `scripts/docs-upload.ts` 외 4개 | Script | 삭제 |
| `package.json` | Config | `docs:upload` 스크립트 항목 제거 |
| `.pdcarc.json` | Config | 신규 생성(커밋) |
| `.env.local.example` | Config | 주석·필수 여부 서술 갱신 |
| `docs/RULE.md` | Doc | 종료 절차 3번 항목 명령어 교체 |

### 6.2 기존 소비자

| 리소스 | 소비처 | 영향 |
|--------|--------|------|
| `scripts/docs-upload.ts` | `package.json`의 `docs:upload` 스크립트, 형이 수동 실행 | Breaking — 명령 자체가 없어짐, `RULE.md` 개정으로 대체 명령 안내 |
| `scripts/lib/git-changes.ts`, `workspace-api.ts` | `scripts/docs-upload.ts`(유일 소비처) | None — 소비처와 함께 삭제되므로 고아 코드가 남지 않음 |
| `src/features/cycle/lib/cyclePath.ts` | `CycleCard.tsx`, `CycleList.tsx`, `cyclePath.test.ts`, (옛)`scripts/docs-upload.ts` | 옛 스크립트 소비만 사라짐 — 프론트 소비는 무영향 |
| `.env.local`의 `PDCAW_*` 변수 | 옛 스크립트 → `pdcaw` CLI로 소비 주체만 교체 | None — 변수명 동일, 값 재사용 가능 |

### 6.3 검증 (Design 착수 전)

- [ ] `cyclePath.ts`가 옛 스크립트 삭제 후에도 프론트에서 정상 동작(빌드/테스트로 확인)
- [ ] `.pdcarc.json` 스키마가 `pdcaw-cli` 저장소의 `.pdcarc.example.json`과 일치하는지 대조
- [ ] `docs/deploy/CHECKLIST.md`가 `kind:'general'`로 올라가도 문제없는 내용인지(민감정보 없음) 확인

---

## 7. Architecture Considerations

### 7.1 프로젝트 레벨

기존 프로젝트 레벨(Dynamic) 유지 — 이번 사이클은 아키텍처 변경이 아니라 도구 교체다.

### 7.2 핵심 아키텍처 결정

| 결정 | 옵션 | 선택 | 근거 |
|------|------|------|------|
| 의존성 연결 방식 | devDependency 고정 / `npx @latest` | **`npx @latest`** | 형 결정(Checkpoint 1) — 항상 최신, 대신 RK-44로 트레이드오프 기록 |
| 종료 절차 명령 표기 | `npm run docs:upload` 래퍼 유지 / `npx pdcaw upload` 직접 노출 | **직접 노출** | 형 결정 — 래퍼 계층 제거로 단순화, `package.json` 스크립트도 함께 제거 |
| 설정 저장 위치 | `.env.local`만 / `.pdcarc.json` 병행 | **`.pdcarc.json` 병행** | 형 결정 — PAT 없는 설정은 커밋해 새 클론 시 즉시 동작하게 함 |

### 7.3 실행 흐름 (변경 후)

```
형: npx pdcaw@latest upload --cycle <이름> --version <버전>
      │
      ├─ .pdcarc.json → baseUrl, projectId 로드
      ├─ .env.local → PDCAW_PAT 로드
      ├─ git 최신 태그 이후 변경분(docs/ 전체) 탐지
      ├─ PDCA 형식 경로 → kind:'pdca', 그 외 .md → kind:'general'
      ├─ --version 지정 시 사이클(release) 생성 (409는 실패 아님)
      └─ 문서별 upsert, 결과 요약 출력
```

---

## 8. Convention Prerequisites

### 8.1 기존 규약

- [x] `docs/RULE.md`에 PDCA 문서 경로·종료 절차 규약 존재
- [x] `tsconfig.json`, `.oxlintrc.json` 존재 — 삭제 대상 파일들이 커버 범위에서 자연히 빠짐
- [x] `.env.local.example`이 `.gitignore` 예외로 커밋됨 — 신규 설정 파일도 이 패턴을 따름

### 8.2 이번에 적용할 형식 (신규 규약 정의 아님)

- `.pdcarc.json`은 `pdcaw-cli` 저장소가 제시한 스키마(`projectId`, `baseUrl`)를 그대로 따른다 —
  이 저장소가 새로 스키마를 정의하지 않는다
- `RULE.md` 3번 항목 문구 교체는 기존 절차 번호·구조를 유지한 채 명령어만 바꾼다(절차 자체 재설계 아님)

### 8.3 환경변수

| 변수 | 용도 | 필수 | 비고 |
|------|------|:----:|------|
| `PDCAW_PAT` | 웹 UI `/tokens` 발급 PAT | ☑ | `.env.local`에만 존재(비밀) — 변경 없음 |
| `PDCAW_PROJECT_ID` | 대상 프로젝트 UUID | ☐ | **`.pdcarc.json`으로 이관 권장**, `.env.local`엔 유지해도 무방(우선순위: CLI 플래그 > env > `.pdcarc.json`) |
| `PDCAW_BASE_URL` | 대상 서버 | ☐(`.pdcarc.json`에 있으면) | **기본값 없음** — 옛 스크립트와의 핵심 차이(RK-46) |

---

## 9. [DO] 실행 마일스톤

| 모듈 | 내용 | 산출물 | 선행 |
|------|------|--------|:----:|
| **module-1** | `.pdcarc.json` 신설 + `.env.local.example` 갱신 | `.pdcarc.json`, `.env.local.example` | 없음 |
| **module-2** | 옛 스크립트 5개 파일 삭제 + `package.json` `docs:upload` 제거 | 삭제 diff, `package.json` | module-1 |
| **module-3** | `docs/RULE.md` 종료 절차 3번 항목 개정 | `docs/RULE.md` | module-2 |
| **module-4** | 종단 검증 — dev 대상 `npx pdcaw@latest upload` 실행(C33), `npm test`/`tsc -b`/`oxlint` 재확인(C35) | 실행 로그 | module-1~3 |

---

## 10. Next Steps

1. [ ] Design 문서 작성 — `.pdcarc.json` 실제 스키마 대조(§6.3), RULE.md 문구 초안 확정
2. [ ] Do 단계에서 module-1부터 순서대로 진행
3. [ ] 종단 검증(module-4) 통과 후 Check 단계로

---

## Version History

| Version | Date | Changes | Author |
|---------|------|---------|--------|
| 0.1 | 2026-08-09 | 최초 작성 — Checkpoint 1·2 반영 | Claude |
