---
template: design
version: 1.0
---

# adopt-pdcaw-cli 설계 문서

> **요약**: Plan에서 확정한 대로 옛 스크립트 5개 파일을 삭제하고 `npx pdcaw@latest upload`로
> 직접 교체한다(래퍼 없음). `.pdcarc.json`을 신설해 `baseUrl`/`projectId`를 커밋하고,
> `RULE.md` 종료 절차 3번 항목의 문구를 실물과 정합시킨다. 서버·DB·프론트 변경 없음.
>
> **프로젝트**: PDCA-workspace
> **작성자**: Claude
> **작성일**: 2026-08-09
> **상태**: Draft (Checkpoint 3 — C안 Pragmatic 채택)

---

## Context Anchor

> Plan 문서에서 전파.

| Key | Value |
|-----|-------|
| **WHY** | 자체 구현 스크립트(`scripts/docs-upload.ts` 등)를 이미 범용화·게시된 외부 패키지(`pdcaw@0.2.0`)로 대체해 로직 이원화를 없앤다 |
| **WHO** | 형 — 명령 실행자·승인자 / Claude — 스크립트 삭제·`RULE.md`/`package.json`/`.env.local.example` 개정·`.pdcarc.json` 신설 |
| **RISK** | `npx pdcaw@latest`가 향후 breaking release로 종료 절차를 깨뜨릴 수 있음(RK-44) / `PDCAW_BASE_URL` 기본값 없음(RK-46) / 스캔 범위 확대로 의도치 않은 문서 업로드 가능성(RK-45) |
| **SUCCESS** | 옛 스크립트·테스트 완전 삭제, `RULE.md` 개정 명령으로 실제 업로드 성공 재현, `.pdcarc.json`으로 설정 커밋 완료 |
| **SCOPE** | 스크립트 교체 + `RULE.md`·`package.json`·`.env.local(.example)` 갱신 + `.pdcarc.json` 신설. 그 외 변경 없음 |

---

## 1. Overview

### 1.1 설계 목표

1. Plan Checkpoint 1·2 결정(§1.4)을 그대로 실행 가능한 파일 단위 변경으로 옮긴다.
2. RK-44(브레이킹 릴리즈)·RK-45(스캔 범위 확대)·RK-46(base-url 기본값 없음) 3건을
   **코드 추가 없이** 설정 파일 1개(`.pdcarc.json`)와 문서 각주로 완화한다.
3. 서버(`server/`, `api/`, `shared/`)와 프론트(`cyclePath.ts` 소비처)는 손대지 않는다 —
   변경 표면을 스크립트·설정·문서 3종으로 좁게 유지한다.

### 1.2 설계 원칙

- **코드를 늘리지 않는다** — 이번 사이클의 핵심은 "직접 구현을 지운다"이므로, RK 완화도
  새 코드(래퍼 스크립트 등)가 아니라 설정 파일과 문서 각주로 해결한다(Checkpoint 3, C안).
- **`.pdcarc.json`은 `pdcaw-cli`가 정의한 스키마를 그대로 따른다** — 이 저장소가 별도
  스키마를 재정의하지 않는다.
- **PAT는 절대 커밋 파일에 들어가지 않는다** — `.pdcarc.json`은 `baseUrl`/`projectId`만
  담고, `PDCAW_PAT`는 계속 `.env.local`(gitignore 대상)에 둔다.

### 1.3 Checkpoint 3 — 형 결정 (2026-08-09)

Plan §7.2에서 이미 확정된 3개 결정(`npx @latest`, 래퍼 제거, `.pdcarc.json` 병행)을 그대로
실행에 옮기는 **C안(Pragmatic)**을 채택했다. A안(`.pdcarc.json`도 생략)은 RK-46 안전망이
없어 Plan 결정 3과 어긋나고, B안(래퍼 재도입)은 Plan 결정 2(래퍼 제거)와 정면 충돌해
둘 다 기각했다.

---

## 2. Architecture

### 2.1 변경 범위 (컴포넌트 관점)

```
[삭제]  scripts/docs-upload.ts
        scripts/lib/git-changes.ts (+ .test.ts)
        scripts/lib/workspace-api.ts (+ .test.ts)

[신설]  .pdcarc.json                      ← baseUrl, projectId (커밋)

[수정]  package.json                       ← "docs:upload" 스크립트 항목 제거
        .env.local.example                 ← PDCAW_PAT만 필수로 서술 갱신
        docs/RULE.md                       ← 종료 절차 3번 항목 명령어 교체

[불변]  src/features/cycle/lib/cyclePath.ts  (프론트 CycleCard/CycleList가 계속 소비)
        server/, api/, shared/               (0줄 변경)
```

### 2.2 실행 흐름 (변경 후 확정본)

```
형: npx pdcaw@latest upload --cycle <이름> --version <버전>
      │
      ├─ 설정 해석 순서: CLI 플래그 > PDCAW_* 환경변수 > .pdcarc.json
      │     └─ baseUrl, projectId는 보통 .pdcarc.json에서, PAT는 .env.local에서
      ├─ git 최신 태그 이후 변경분(작업트리 ∪ 커밋분) 중 docs/ 하위 .md 전부 탐지
      ├─ 경로가 docs/PDCA/{yearMonth}/{name}/{name}.{stage}.md 형식이면 kind:'pdca'
      │     그 외 .md는 kind:'general' (예: docs/deploy/CHECKLIST.md)
      ├─ --version 지정 시 사이클(release) 생성 시도 (409 = 이미 존재, 실패 아님)
      └─ 문서별 upsert 실행 후 결과 요약 출력 (신규/덮어씀/실패 건수)
```

옛 스크립트 대비 바뀌는 지점은 **탐지 루트**(`docs/PDCA` → `docs/`)와 **base-url 해석**
(기본값 있음 → 없음, 대신 `.pdcarc.json`이 사실상 새 기본값 역할)뿐이다. 그 외(태그 기반
탐지, PDCA 경로 역파싱, upsert, 409 무시, 부분 실패 시 나머지 계속)는 `pdcaw` README 기준
옛 스크립트와 동일하게 동작한다.

---

## 3. Data Model

### 3.1 DB — 무변경

이번 사이클은 서버·DB에 손대지 않는다.

### 3.2 `.pdcarc.json` (신설, 커밋 대상)

```json
{
  "projectId": "4b06bd56-b697-4c04-a9ed-77e747cf5019",
  "baseUrl": "https://pdca-workspace.vercel.app"
}
```

`pdcaw-cli`의 `.pdcarc.example.json` 스키마와 필드명이 일치함을 대조 확인(Plan §6.3 검증
항목). PAT/토큰 키는 이 파일에 절대 넣지 않는다 — `pdcaw`가 해당 키를 만나면 경고 후
무시하지만, 애초에 작성하지 않는다.

### 3.3 환경변수 (Plan §8.3 확정)

| 변수 | 용도 | 필수 | 저장 위치 |
|------|------|:----:|-----------|
| `PDCAW_PAT` | 웹 UI `/tokens` 발급 PAT | ☑ | `.env.local`(gitignore) |
| `PDCAW_PROJECT_ID` | 대상 프로젝트 UUID | ☐ | `.pdcarc.json`으로 이관, `.env.local`에 남아있어도 우선순위상 무해 |
| `PDCAW_BASE_URL` | 대상 서버 | ☐(`.pdcarc.json`에 있으면) | `.pdcarc.json`으로 이관 |

---

## 4. API Specification — 서버 무변경

이 사이클은 `PDCA-workspace` 서버의 API를 호출하는 **클라이언트**만 교체한다. 서버가
노출하는 MCP 툴(`document_write` 등)과 REST 엔드포인트는 손대지 않는다 — `pdcaw`가 이미
같은 계약(REST 사이클 생성 + MCP upsert)을 구현해 게시된 상태다.

---

## 5. UI/UX Design — 해당 없음

CLI 출력 형식은 `pdcaw` 패키지 자체의 사양이며 이 저장소가 관여하지 않는다. 형이 보는
화면은 `pdcaw` README에 문서화된 형식(대상 목록, 신규/덮어씀/실패 건수 요약)을 그대로
따른다.

---

## 6. Error Handling

| 상황 | 옛 스크립트 | `pdcaw` 전환 후 | 대응 |
|------|-------------|-------------------|------|
| `PDCAW_BASE_URL` 미설정 | prod로 기본값 처리 (RK-46) | **에러 종료** | `.pdcarc.json` 커밋으로 원천 해소 — 새 클론에서도 항상 존재 |
| `pdcaw` breaking release | 해당 없음(자체 코드라 통제 가능) | `npx @latest`가 예고 없이 갱신될 수 있음 (RK-44) | `RULE.md` 각주에 버전 고정 대체 명령(`npx pdcaw@0.2.0 upload …`) 명시 |
| `docs/` 전체 스캔으로 의도치 않은 문서 포함 (RK-45) | 해당 없음(`docs/PDCA`만 스캔) | `docs/deploy/CHECKLIST.md` 등도 `kind:'general'`로 업로드 대상 | 형 확인 완료(의도된 변경) — `RULE.md`에 "서버에 올라가도 되는 문서만 `docs/` 하위에 둔다" 원칙 한 줄 추가 |
| PAT 미설정 / 401 / 네트워크 실패 등 | 자체 처리 | `pdcaw`가 동일 수준으로 처리(README 기준: 발급 안내, 파일 단위 실패 계속) | 별도 대응 불필요 — 회귀 여부만 module-4에서 실행 확인 |

---

## 7. Security Considerations

- PAT는 `.env.local`(gitignore 대상)에만 존재 — `.pdcarc.json`에는 절대 두지 않는다(§3.2).
- `pdcaw`는 README에 따라 PAT를 로그·에러 메시지 어디에도 출력하지 않는다 — 옛 스크립트의
  FR-84와 동일 수준. module-4 종단 검증 시 실행 로그 전문을 `grep pdcaw_`로 확인해 재검증한다.
- `.pdcarc.json`은 비밀이 아닌 `baseUrl`/`projectId`만 담으므로 커밋해도 안전하다.

---

## 8. Test Plan

### 8.1 테스트 범위

이번 사이클은 **삭제 + 설정/문서 변경**이 전부라 신규 로직이 없다 — 별도 단위 테스트를
작성하지 않는다. 대신 (a) 삭제 후 기존 테스트 스위트 무회귀, (b) 실제 CLI 실행 성공을
확인한다.

### 8.2 무회귀 확인 (module-2 직후)

| 항목 | 명령 | 기대 결과 |
|------|------|-----------|
| 타입 체크 | `tsc -b` | 그린 — 삭제된 파일에 대한 참조 오류 0건 |
| 단위 테스트 | `npm test` | 그린 — `git-changes.test.ts`/`workspace-api.test.ts` 삭제로 케이스 수 감소는 정상, 나머지(특히 `cyclePath.test.ts`)는 그대로 통과 |
| 린트 | `npm run lint` | 0 warning |
| 잔존 참조 | `git grep -n "docs-upload\|scripts/lib"` | 코드 참조 0건(문서 내 과거 기록 언급은 예외) |

### 8.3 종단 검증 E1~E3 (module-4, dev 서버 대상)

| ID | 시나리오 | 절차 | 기대 결과 |
|----|----------|------|-----------|
| **E1** | 부분 동기화(버전 없음) | `npx pdcaw@latest upload --cycle adopt-pdcaw-cli --base-url http://localhost:3001` 실행 | 이 사이클 문서(Plan 최소)가 업로드 성공, exit 0 |
| **E2** | `.pdcarc.json` 단독으로 설정 해석 | `.env.local`에서 `PDCAW_PROJECT_ID`/`PDCAW_BASE_URL`을 잠시 비우고 재실행 | `.pdcarc.json` 값으로 정상 해석돼 동일하게 성공 |
| **E3** | RULE.md 개정 명령 그대로 실행 | 개정된 3번 항목 명령을 복사해 실행(`--version` 포함, dev 대상) | 사이클 생성 + 문서 업로드 성공(C33 근거) |

---

## 9. Clean Architecture — 해당 없음

계층 구조 변경이 아니다. 삭제되는 `scripts/docs-upload.ts`·`scripts/lib/*`는 애초에
Clean Architecture 계층 분리(refine-cycle-closing D-66)의 산물이었으나, 이번엔 그 계층
자체가 통째로 걷어내진다 — 대체할 계층을 이 저장소에 새로 두지 않는다(외부 패키지가
자기 계층을 갖는다).

---

## 10. Coding Convention Reference

### 10.1 Decision Record

| 결정 | 옵션 | 선택 | 근거 | 파생 효과 |
|------|------|------|------|-----------|
| **D-70** | 의존성 연결(devDependency 고정 / `npx @latest`) | `npx @latest` | 형 결정(Plan Checkpoint 1) | RK-44 상시 노출 — 문서 각주로만 완화, 코드 안전장치 없음 |
| **D-71** | 종료 절차 명령 표기(래퍼 유지 / 직접 노출) | 직접 노출 | 형 결정(Plan Checkpoint 1) | `package.json` `docs:upload` 항목 자체가 사라짐 — 향후 이 저장소에서 커스텀 검증을 끼워 넣으려면 다시 래퍼가 필요해짐(현재는 불필요 판단) |
| **D-72** | 설정 저장 위치(`.env.local`만 / `.pdcarc.json` 병행) | 병행 | 형 결정(Plan Checkpoint 1), RK-46 해소가 목적 | `.env.local.example`의 `PDCAW_PROJECT_ID`/`PDCAW_BASE_URL` 서술이 "필수"에서 "선택, `.pdcarc.json`이 대신함"으로 격하 |
| **D-73** | RK-44/45/46 완화 방식(코드 추가 / 문서·설정만) | 문서·설정만(Checkpoint 3 C안) | 이번 사이클 원칙(§1.2) — 코드를 늘리지 않는다 | 브레이킹 릴리즈 발생 시 **자동 감지·알림은 없음** — 형이 실행 실패를 보고 RULE.md 각주를 참고해 수동으로 버전 고정해야 함(수용된 트레이드오프) |

---

## 11. Implementation Guide

### 11.1 신규·수정·삭제 파일

| 파일 | 변경 | 비고 |
|------|:----:|------|
| `scripts/docs-upload.ts` | 삭제 | 254줄 |
| `scripts/lib/git-changes.ts` | 삭제 | 90줄 |
| `scripts/lib/git-changes.test.ts` | 삭제 | 71줄 |
| `scripts/lib/workspace-api.ts` | 삭제 | 111줄 |
| `scripts/lib/workspace-api.test.ts` | 삭제 | 29줄 |
| `package.json` | 수정 | `"docs:upload": "..."` 스크립트 항목 제거 |
| `.pdcarc.json` | 신설 | §3.2 스키마 그대로, 커밋 |
| `.env.local.example` | 수정 | `PDCAW_PAT`만 필수로 남기고 나머지 주석 갱신 |
| `docs/RULE.md` | 수정 | 종료 절차 3번 항목 — §11.2 |

### 11.2 RULE.md 개정안 (module-3에서 적용)

**As-is** (현재 26~30행):

```
3. **`npm run docs:upload -- --cycle <사이클명> --version <버전>`** 으로 릴리즈 생성 +
   변경 문서 업로드를 한 번에 처리한다 (릴리즈 노트는 공란 — 웹 UI에서 형이 직접 작성).
   - **MCP `document_write`를 직접 호출하지 않는다** — 본문 재타이핑은 토큰 낭비이자
     오타 위험. 스크립트는 파일을 그대로 읽어 보내므로 본문이 LLM을 경유하지 않는다.
   - 대상은 최신 태그 이후 변경된 `docs/PDCA` 문서 전부 — **이전 사이클 사후개정분도
     자동 포함**되므로 따로 기억할 필요 없다.
   - 사이클 중간에 문서만 동기화하려면 `--version` 없이 실행한다.
```

**To-be**:

```
3. **`npx pdcaw@latest upload --cycle <사이클명> --version <버전>`** 으로 릴리즈 생성 +
   변경 문서 업로드를 한 번에 처리한다 (릴리즈 노트는 공란 — 웹 UI에서 형이 직접 작성).
   - **MCP `document_write`를 직접 호출하지 않는다** — 본문 재타이핑은 토큰 낭비이자
     오타 위험. `pdcaw`는 파일을 그대로 읽어 보내므로 본문이 LLM을 경유하지 않는다.
   - 대상은 최신 태그 이후 변경된 **`docs/` 전체**(PDCA 형식 경로 + 그 밖의 `.md` 문서
     모두) — 이전 사이클 사후개정분도 자동 포함되므로 따로 기억할 필요 없다.
     `docs/` 하위에는 서버에 올라가도 되는 문서만 둔다.
   - 사이클 중간에 문서만 동기화하려면 `--version` 없이 실행한다.
   - `baseUrl`/`projectId`는 저장소에 커밋된 `.pdcarc.json`에서 읽는다. PAT만
     `.env.local`의 `PDCAW_PAT`로 별도 관리한다.
   - `pdcaw`가 breaking release로 갱신돼 위 명령이 실패하면, 마지막으로 정상 동작을
     확인한 버전으로 고정해 재시도한다: `npx pdcaw@0.2.0 upload --cycle <사이클명>
     --version <버전>`.
```

### 11.3 Session Guide

#### Module Map

| 모듈 | 범위 | 파일 |
|------|------|------|
| **module-1** | `.pdcarc.json` 신설 + `.env.local.example` 갱신 | §11.1 신설/수정 2건 |
| **module-2** | 옛 스크립트 5개 삭제 + `package.json` 정리 + 무회귀 확인(§8.2) | §11.1 삭제 5건, `package.json` |
| **module-3** | `docs/RULE.md` 종료 절차 개정 (§11.2 적용) | `docs/RULE.md` |
| **module-4** | 종단 검증 E1~E3(§8.3) | 없음(실행 로그만) |

#### Recommended Session Plan

전체 변경량이 작아(삭제 위주 + 설정 1개 + 문서 1곳) **단일 세션**으로 module-1→4를
순서대로 진행하면 충분하다. `/pdca do adopt-pdcaw-cli --scope module-N`으로 모듈 단위
분할도 가능하지만, 이 사이클 규모에서는 굳이 나눌 필요는 없다.

---

## Version History

| Version | Date | Changes | Author |
|---------|------|---------|--------|
| 0.1 | 2026-08-09 | 최초 작성 — Checkpoint 3(C안 Pragmatic) 반영 | Claude |
