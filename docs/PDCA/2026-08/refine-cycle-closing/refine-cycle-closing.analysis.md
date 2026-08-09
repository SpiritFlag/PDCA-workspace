---
template: analysis
version: 1.1
---

# refine-cycle-closing 분석 문서

> **한 줄 요약**: 정적 3축 초판 **Overall 90.0%**(구조 100 / 기능 92 / 계약 83), Critical 0 /
> Important 3건. **Checkpoint 5(형 결정: "지금 모두 수정")에 따라 I-1~I-3 전건 수정하고 실제
> dev DB로 재검증 완료**(§8) — Important 0건, Critical 0건으로 종결. M-5·M-6도 함께 정정.
>
> **프로젝트**: PDCA-workspace
> **작성자**: Claude
> **작성일**: 2026-08-09
> **PDCA Cycle**: refine-cycle-closing (문서화 기준 7번째 사이클)

---

## Context Anchor

| Key | Value |
|-----|-------|
| **WHY** | 이전 사이클 사후개정분이 서버 미반영으로 최소 2회 새어나감(F65) |
| **WHO** | 형 — 승인자·PAT 발급 주체 / 클로드 — 1급 소비자이자 유일한 상시 호출자 |
| **RISK** | RK-38~RK-43 — 이번 분석에서 **RK-41(tsc 사각지대)은 module-2에서 실증 해소**, 나머지는 코드 검토로 재확인 |
| **SUCCESS** | C26~C31 — C31 제외 5건이 이번 분석 대상 |
| **SCOPE** | S1~S6 고정, 서버 코드 0줄 |

---

## 1. Success Criteria 최종 상태

| ID | 기준 | 상태 | 근거 |
|----|------|:----:|------|
| **C26** | 본문이 LLM을 경유하지 않는다 | ✅ Met | `docs-upload.ts` 전체에 `content` 값을 로그·에러에 출력하는 경로 0건(길이만 노출). module-1~4 세션 기록상 클로드 출력은 명령 1줄뿐 |
| **C27** | 이번 사이클 문서가 올라간다 | ✅ Met | module-4 E1 — dev DB 실 업로드, 신규 2건 확인 |
| **C28** | 멱등하다 | ✅ **Met** | 정상 재실행(E2, module-4) + **I-1·I-3 수정 후 §8 재검증**으로 name 충돌·0건 재실행 경로까지 확인 완료 |
| **C29** | 이전 사이클 사후개정분이 함께 올라간다 | ✅ Met | module-4 E3 — `expand-mcp-agency` 문서 실제 수정 후 필터 없이 실행, 자동 포함 확인. 이 사이클의 핵심 존재 이유가 실증됨 |
| **C30** | 형의 실 데이터·실 PAT 없이 종단 검증이 된다 | ✅ Met | `hns-owner-docs-*` 격리 픽스처로 E1~E7 전건 실행, `cleanup()`으로 삭제 확인 |
| **C31** | RULE.md 절차로 이 사이클 자신을 닫는다 | ⏳ 대기 | module-5에서 문서 개정만 완료. 실제 종료(태그·push 포함)는 비가역이라 형 승인 후 실행 예정 — 형·클로드 합의 사항 |

**5/6 Met, 1건 Partial, 1건 대기.** Partial(C28)은 Important 이슈로 아래 이어짐.

---

## 2. 정적 갭 분석 (gap-detector, 3축)

| 축 | 점수 |
|---|:---:|
| Structural Match | 100% |
| Functional Depth | 92% |
| API Contract | 83% |
| **Overall**(구조×0.2+기능×0.4+계약×0.4) | **90.0%** |

### 2.1 서버 무수정 제약 — 충족

```
git diff --stat HEAD -- server api shared       → (empty)
git diff --stat v0.1.5..HEAD -- server api shared → (empty)
```
`server/**`·`api/**`·`shared/**` 변경 **0줄** 확정.

### 2.2 Structural Match — Design §11.1 대비 10/10 + 목록 밖 1건

Design §11.1이 나열한 10개 파일 전건 존재. **목록 밖 1건**: `.env.local.example`(`PDCAW_*` 3종
추가) — Plan §6.1엔 있으나 Design §11.1 표엔 누락돼 있었음(Design 자체의 누락, 스코프 이탈 아님).

### 2.3 형이 지목한 결정 5건 — 전건 코드로 재확인

| 결정 | 확인 |
|---|---|
| D-64 (`--version`은 `--cycle` 필수, `--month` 없음, 연월은 파서 결과) | ✅ `docs-upload.ts:65-67, 117-126` |
| D-65 (순수 함수만 테스트, 목 0개) | ✅ 3개 테스트 파일에 `vi.mock`·`vi.fn` 0건 |
| D-67 (`-uall`) | ✅ `git-changes.ts:81` |
| D-68 (작업트리 우선 병합) | ✅ `git-changes.ts:84-86` |
| FR-88 (삭제·rename 경고만) | ✅ `docs-upload.ts:96-103` |

---

## 3. API Contract 대조 (Design §4, 3-way)

| # | 채널 | Design | 서버 스키마 | 클라이언트 | 판정 |
|---|---|:---:|:---:|:---:|:---:|
| 1 | MCP `document_write` | ✅ | `documentFields.extend({projectId})` | `docs-upload.ts:204-211` | PASS |
| 2 | MCP `project_list` | ✅ | 입력 없음 | `workspace-api.ts:80` | PASS |
| 3 | REST `POST /cycles` | ✅ | `createCycleSchema` | `workspace-api.ts:64-71` | **FAIL(응답 해석)** — §4.1 |

요청형 3채널 전부 서버 스키마와 일치 확인(`releaseNote` 미전송 — 형 결정 2 준수, `title`=사이클명
— D-59 준수). 불일치는 §4.1의 응답 해석 1건뿐.

### 4.1 확인된 이슈 — Critical 0 / Important 3 / Minor 확정 2건

> gap-detector 1차 보고의 Important 3건·Minor 7건을 전부 **직접 코드 Read로 재검증**했다.
> Important 3건은 확정. Minor는 이번 분석에서 재확인한 2건(M-5·M-6)만 기록하고 나머지는
> 낮은 우선순위로 재이월한다.

| ID | 심각도 | 이슈 | 위치 | 재현 시나리오 |
|---|:---:|---|---|---|
| **I-1** | Important | REST 409의 `name` 충돌을 `version` 충돌로 오판 → 실패를 성공으로 보고 | `workspace-api.ts:70` | 사이클 중간에 `v0.1.6`으로 이미 `refine-cycle-closing` 연결 → 종료 시 `v0.1.7`로 재실행 → 서버는 `NAME_TAKEN` 409(F68) → 클라이언트는 "v0.1.7 이미 존재 — 생성 생략" 출력, **exit 0**. 실제로 v0.1.7은 생성 안 됨 |
| **I-2** | Important | 문서 업로드 루프에 try/catch 없음 → 네트워크 예외 시 전체 중단 | `docs-upload.ts:198-225`, `workspace-api.ts:35`(`fetch` 무보호) | **module-3 V6에서 이미 관측**(`TypeError: fetch failed`로 프로세스 전체 종료) — 당시 "PAT 무출력 확인됐으니 OK"로 넘겼으나, FR-82("실패해도 계속, 파일 단위 사유 축적")를 실제로는 어긴 것 |
| **I-3** | Important | 대상 0건 + `--version` 조합이 주석과 다르게 항상 실패 | `docs-upload.ts:167-172, 117-126` | 태그를 단 뒤 같은 종료 명령을 재실행(대상 0건) → `resolveCycleYearMonth`가 연월을 못 구해 `fail()` → exit 1. 주석("사이클 생성 자체가 목적일 수 있어 계속 진행")이 약속한 경로가 코드상 도달 불가능 |
| **M-5** | Minor(확정) | `.env.local.example`의 `Design Ref: §8.3`이 잘못된 절 지목 | `.env.local.example:11` | 재확인 결과 **Design §8.3은 "종단 E1~E7"**(Test Plan 하위)이고, 환경변수 표는 **Plan §8.3**에만 있음. Design·Plan 양쪽에 동일 번호 §8.3이 다른 내용으로 존재하는 게 원인 — 문서 간 절 번호 충돌 |
| **M-6** | Minor(확정) | 신규 5개 파일에 `Plan SC:` 주석 0건 | 신규 파일 전체 | 기존 관례(`server/lib/path.ts:2`, `src/lib/auth.ts:11`)는 `Design Ref:`와 `Plan SC:` 두 종류를 병기. 이번 신규 파일은 `Design Ref:`만 있음 |

**Critical 0건 — 사이클 종료(report)를 막는 결함 없음.** I-1~I-3은 전부 module-4 E1~E7이
밟지 않은 경로(name 충돌 409·네트워크 예외·태그 후 0건 재실행)에 있어 **종단 검증 결과와
모순되지 않는다** — 실사용 골든 패스는 전건 통과했고, 엣지 케이스 3건이 남은 것.

---

## 5. Decision Record 준수 확인

| 결정 | 준수 | 비고 |
|---|:---:|---|
| D-53(MCP 경유 upsert) | ✅ | |
| D-54(`cycle_create` MCP 툴 미신설) | ✅ | |
| D-55(git 기반 대상 선정) | ✅ | |
| D-56(역파서를 `cyclePath.ts`에) | ✅ | |
| D-57(사이클 먼저, 문서 업로드는 실패해도 계속) | ⚠️ | 사이클 실패(`failed`) 시엔 계속 진행 맞음. **다만 I-1로 "실패인데 성공으로 보임"** — 순서 자체는 지켰으나 판정이 틀림 |
| D-58(409는 실패 아님) | ⚠️ | version 충돌만 해당한다는 전제가 코드에 반영 안 됨(I-1) |
| D-59(title=사이클명) | ✅ | |
| D-64(`--version`↔`--cycle`) | ✅ | I-3은 이 결정 자체가 아니라 **0건 대상 조합**에서만 발생 |
| D-65(순수 함수만 테스트) | ✅ | 파생 리스크(I/O 안전망을 module-4가 전담)가 **실제로 I-2를 못 잡은 사례** — module-4가 정상 흐름만 실행했고 네트워크 중단 재현 시나리오는 없었음 |
| D-67(`-uall`) | ✅ | |
| D-68(작업트리 우선) | ✅ | |

---

## 6. 코드 변경 범위 대조 (Design §11.1 예측 vs 실측)

| 파일 | 예측 | 실측 | 일치 |
|---|:---:|:---:|:---:|
| `cyclePath.ts`(+파서) | 수정 | 수정 | ✅ |
| `cyclePath.test.ts` | 신규 | 신규 | ✅ |
| `scripts/lib/git-changes.ts`(+.test) | 신규 | 신규 | ✅ |
| `scripts/lib/workspace-api.ts`(+.test) | 신규 | 신규 | ✅ |
| `scripts/docs-upload.ts` | 신규 | 신규 | ✅ |
| `package.json` | 수정 | 수정 | ✅ |
| `tsconfig.server.json` | 수정 | 수정 | ✅ |
| `docs/RULE.md` | 수정 | 수정 | ✅ |
| `.env.local.example` | (미기재) | 수정 | 예측 누락(Design 갭, 스코프 이탈 아님) |

10/10 + 1건 예측 누락. 신규 파일 추가 초과 없음.

---

## 7. 남는 관찰 (재이월 후보, 스코프 밖)

- M-1(작업트리/커밋분 출처 컬럼 미표시), M-2(rename 로그의 `undefined`), M-3(태그 없음·非git
  에러 메시지 미분리), M-4(`--project` 플래그가 Design 사용법에 미기재), M-7(다중 프로젝트 에러가
  스택과 함께 출력) — 전부 사용성·로그 품질 이슈로 **Critical/Important 아님**. 다음 사이클
  후보로 재이월.
- `cycle_create` MCP 툴 신설 — 6차 재이월분, 이번 D-54로 수요 소멸 판단. 계속 보류.

---

## 8. Checkpoint 5 이후 — I-1~I-3·M-5·M-6 수정 및 재검증

형 결정(2026-08-09): "지금 모두 수정". 서버 무수정 원칙은 그대로 — 전부 클라이언트(스크립트)
수정.

| ID | 수정 | 파일 |
|---|---|---|
| I-1 | 409 응답 바디의 `error.details.target`을 읽어 `version`/`name` 충돌을 구분. `name` 충돌은 `failed`로 승격 | `workspace-api.ts:createCycle` |
| I-2 | 업로드 루프 본문을 `try/catch`로 감싸 `readFile`·`fetch` throw도 `failed++`로 축적 | `docs-upload.ts` 업로드 루프 |
| I-3 | `targets.length === 0 && !args.version` 특례 제거 — Design §2.2·FR-87대로 대상 0건이면 `--version` 유무와 무관하게 무조건 exit 0. 도달 불가능했던 `resolveCycleYearMonth` 경로 자체가 사라짐 | `docs-upload.ts` 대상 0건 분기 |
| M-5 | `Design Ref: §8.3` → `Plan Ref: §8.3`로 정정(환경변수 표의 실제 소재) | `.env.local.example` |
| M-6 | 신규 5개 파일에 `Plan SC:` 주석 추가(C26·C27·C29 연결) | `cyclePath.ts`, `git-changes.ts`, `workspace-api.ts`, `docs-upload.ts` |

### 8.1 재검증 — 실 dev DB (`hns-owner-docs-cfb33009`, 격리 픽스처 재생성)

| 시나리오 | 결과 |
|---|---|
| **I-3**: 존재하지 않는 사이클명 + `--version` (대상 0건) | `변경된 문서 없음`, **exit 0** (수정 전엔 `resolveCycleYearMonth` 실패로 exit 1) |
| **I-1**: `refine-cycle-closing`을 `v1.0.0`에 연결한 뒤 `v1.0.1`로 재실행(name 충돌) | `사이클 FAIL: 버전 'v1.0.1'은 생성되지 않았습니다 — …`, **exit 1**. 문서 3건은 D-57대로 계속 업로드됨(덮어씀 3) — 수정 전엔 "이미 존재 — 생성 생략" + exit 0으로 오판했을 자리 |
| **I-2**: 업로드 도중 dev 서버 강제 종료(`pkill`) | 3개 파일 전부 `FAIL fetch failed` 개별 출력 + `문서: 신규 0 / 덮어씀 0 / 실패 3` 요약까지 정상 도달(수정 전 module-3 V6에서 본 raw stack trace 크래시가 사라짐) |

재검증 후 `cleanup()`으로 픽스처 삭제 확인. `tsc -b`·`oxlint`·`vitest run`(9 files/76 tests) 전건
재확인 — 무회귀.

**갱신된 판정**: Critical 0 / Important 0 / Minor 5건(M-1~M-4, M-7 — §7 재이월 유지). C28 Met으로
상향(§1). Overall Match Rate는 정적 3축 재산정 없이 **Important 전건 해소 + 실 DB 재검증**으로
report 진행 조건을 충족한 것으로 판단한다.

---

## Version History

| 버전 | 날짜 | 변경 내용 | 작성자 |
|------|------|-----------|--------|
| 0.2 | 2026-08-09 | Checkpoint 5 형 결정("지금 모두 수정") 반영 — I-1·I-2·I-3·M-5·M-6 전건 수정 후 실 dev DB로 재검증(§8). C28을 Met으로 상향. Important/Minor 확정분(M-5·M-6) 해소, 남은 Minor는 §7 재이월 유지 | Claude |
| 0.1 | 2026-08-09 | 최초 작성. gap-detector 정적 3축 분석(Overall 90.0%) 결과를 **전건 직접 코드 Read로 재검증** — Important 3건(I-1 name/version 409 오판, I-2 네트워크 예외 시 루프 전체 중단, I-3 태그 후 0건+`--version` 재실행 시 예상외 exit 1) 확정, Minor 2건(M-5 Design Ref 절 번호 오기재, M-6 `Plan SC:` 주석 누락) 확정. Critical 0건. C28(멱등성)을 Partial로 하향 — I-1·I-3이 정상 재실행 밖의 구체적 반례를 제시. I-2는 module-3 V6에서 이미 관측했으나 그때는 "PAT 무출력 확인"에 집중해 FR-82 위반임을 놓쳤던 것으로 재평가 | Claude |
