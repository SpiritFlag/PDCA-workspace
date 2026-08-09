---
template: report
version: 1.1
---

# adopt-pdcaw-cli 완료 보고서

> **상태**: 완료 (Success Criteria 4/4 Met)
>
> **프로젝트**: PDCA-workspace
> **작성자**: Claude
> **완료일**: 2026-08-09
> **PDCA Cycle**: adopt-pdcaw-cli (문서화 기준 8번째 사이클)

---

## Executive Summary

### 1.1 프로젝트 개요

refine-cycle-closing(7차)에서 이 저장소 전용으로 급조했던 `scripts/docs-upload.ts` +
`scripts/lib/{git-changes,workspace-api}.ts`(+테스트, 합계 548줄)를 걷어내고, 같은 로직을
범용화해 npm에 이미 게시한 외부 패키지 `pdcaw@0.2.0`으로 대체했다. 새 기능은 0건 — "이
저장소 전용 사본을 유지보수한다"에서 "관리되는 외부 CLI를 소비한다"로 축을 옮긴 정리
사이클이다.

| 관점 | 내용 |
|------|------|
| **Problem** | 자체 구현 스크립트가 다른 프로젝트로 옮길 수 없는 사본으로 이 저장소에 남아, `pdcaw`가 받을 개선이 이 저장소엔 반영되지 않았다 |
| **Solution** | 옛 스크립트 5개 파일 삭제 + `npx pdcaw@latest upload`로 직접 교체(래퍼 없음) + `.pdcarc.json` 신설로 설정 이원화 정리 |
| **Function/UX Effect** | 사이클 종료 명령이 `npm run docs:upload -- …`에서 `npx pdcaw@latest upload …`로 바뀌었다. 업로드 대상은 `docs/PDCA/`에서 `docs/` 전체로 확대(의도된 변경) |
| **Core Value** | "자체 스크립트 유지보수"에서 "관리되는 외부 CLI 소비"로 축 이동 — 코드 548줄을 지우고 그 자리를 설정 파일 4줄(`.pdcarc.json`)로 대체했다 |

### 1.2 결과 요약

| 항목 | 계획(Plan) | 실제(Do) | 차이 |
|------|:----------:|:--------:|------|
| 스코프 | In Scope 6건(Plan §2.1) | 6건 전건 구현 | 없음 |
| 삭제 파일 | 5개(555줄 추정) | 5개(548줄 실측) | Plan 추정치와 7줄 차이(주석 재계산 오차, 무의미) |
| 신규 파일 | `.pdcarc.json` 1건 | 1건 | 없음 |
| 서버 코드 변경 | 0줄(제약) | **0줄 확정** | 없음 |
| 아키텍처 | Checkpoint 3 형 결정 | C안(Pragmatic) 채택 — 코드 추가 없이 설정·문서로만 리스크 완화 | 없음 |
| 종단 검증 대상 | Design은 dev 서버 가정 | **형이 프로덕션(멱등 업로드)으로 승인·대체**(D-74) | Design 가정과 실행 대상 변경, 형 승인으로 해소 |
| E3(릴리즈 생성) | Design §8.3 | 실행 안 함 — **의도적 대기**, 실제 사이클 종료 시점에 실증 | 7차 C31 선례와 동일 패턴 |

### 1.3 실현된 가치

- **로직 이원화 해소**: `scripts/docs-upload.ts` 등 548줄이 저장소에서 완전히 사라지고,
  `git grep`으로도 코드 참조가 0건임을 확인했다. 이제 이 저장소는 `pdcaw`의 **소비자**일
  뿐이라, `pdcaw`에 생기는 버그 수정·기능 추가가 별도 포팅 작업 없이 이 저장소에도 그대로
  적용된다.
- **설정 이원화 정리 실증**: `.pdcarc.json` 단독으로 `baseUrl`/`projectId`가 해석되는지
  `.env.local`에서 해당 값을 **실제로 잠깐 지웠다가 복원하며** 검증했다(module-4 E2) —
  이론이 아니라 재현된 사실이다.
- **프로덕션 실사용으로 회귀 확인**: 이 사이클 자신의 Plan·Design 문서를 실제로
  `npx pdcaw@latest upload`로 프로덕션에 업로드해(E1) 새로 만든 파이프라인이 처음부터
  끝까지 동작함을 실증했다.

---

## 1.4 Success Criteria 최종 상태

| ID | 기준 | 상태 | 근거 |
|----|------|:----:|------|
| C32 | 로직 이원화 해소 | ✅ Met | 5개 파일 삭제, 코드 참조 0건(gap-detector + `git grep` 이중 확인) |
| C33 | RULE.md 실물 정합 | ✅ Met | 개정 명령 실제 실행 성공(E1·E2), 문구 Design §11.2와 100% 일치 |
| C34 | 설정 이원화 정리 | ✅ Met | `.pdcarc.json` 스키마 일치, `.env.local.example` PAT 전용 서술 |
| C35 | 무회귀 | ✅ Met | `tsc -b` 그린 / `oxlint` 0 warning / `npm test` 64/64 |

**4/4 Met.**

---

## 1.5 Decision Record 요약

| 결정 | 따랐는가 | 결과 |
|---|:---:|---|
| D-70(`npx @latest`, devDependency 미고정) | ✅ | `package.json`에 `pdcaw` 없음 |
| D-71(래퍼 제거, 직접 노출) | ✅ | `docs:upload` 스크립트 삭제, RULE.md가 CLI를 직접 명시 |
| D-72(`.pdcarc.json` 병행) | ✅ | 신설·커밋, E2로 단독 동작 실증 |
| D-73(RK 완화는 코드 없이 문서·설정만) | ✅ | 래퍼·검증 코드 0줄 추가 |
| D-74(module-4 검증 대상 dev→prod 변경) | 형 승인 | `pdcaw`가 외부 CLI라 이 저장소의 `hns-` 격리 하네스를 재사용할 수 없어, 멱등 업로드라는 성질을 근거로 형이 프로덕션 실행을 직접 승인 |

---

## 2. 관련 문서

| 문서 | 상태 |
|---|---|
| [adopt-pdcaw-cli.plan.md](./adopt-pdcaw-cli.plan.md) | v0.1 |
| [adopt-pdcaw-cli.design.md](./adopt-pdcaw-cli.design.md) | v0.1 (Checkpoint 3 C안) |
| [adopt-pdcaw-cli.analysis.md](./adopt-pdcaw-cli.analysis.md) | v0.1 (4/4 Met) |
| 외부 패키지: `pdcaw@0.2.0` (npm) | 게시됨, 소스는 `/home/singi/workspace/pdcaw-cli` |

---

## 3. 완료 항목

### 3.1 스코프 6건 (Plan §2.1)

- [x] `scripts/docs-upload.ts`, `scripts/lib/git-changes.ts`(+test), `scripts/lib/workspace-api.ts`(+test) 삭제
- [x] `package.json`의 `docs:upload` 스크립트 항목 제거
- [x] `.pdcarc.json` 신설(`baseUrl`, `projectId` 커밋)
- [x] `.env.local.example` 갱신 — `PDCAW_PAT`만 필수, 주석 교체
- [x] `docs/RULE.md` 종료 절차 3번 항목 — 명령어 교체 + 스캔 범위 확대 명시
- [x] `docs/PDCA/_INDEX.md` 행 추가 — **종료 절차 1번 항목이라 이 사이클을 실제로 닫을 때 처리**(§8.1)

### 3.2 비기능 요구사항

| 범주 | 기준 | 결과 |
|------|------|:----:|
| 회귀 없음 | `npm test`/`tsc -b` 그린 | ✅ |
| 비밀 비노출 | `.pdcarc.json`에 PAT 없음 | ✅ |
| 문서 정합 | RULE.md 명령 실행 가능 | ✅(E1·E2로 실증) |

### 3.3 산출물

| 파일 | 변경 |
|------|:----:|
| `scripts/docs-upload.ts` 외 4개 | 삭제(548줄) |
| `.pdcarc.json` | 신규(4줄) |
| `.env.local.example` | 수정 |
| `docs/RULE.md` | 수정 |
| `package.json` | 수정 |

---

## 4. 미완료 항목

### 4.1 다음 사이클 후보 (재이월)

| ID | 항목 | 비고 |
|----|------|------|
| M-1 | `parseCycleStagePath` 고아 export(`cyclePath.ts:19`) | 유일 소비처였던 옛 스크립트가 삭제돼 이제 자기 테스트만 호출. Design이 `cyclePath.ts` 불변으로 명시해 이번엔 손대지 않음 |
| — | RK-44(`pdcaw` breaking release) 실물 대응 체계 없음 | 자동 감지·알림 없이 RULE.md 각주(`pdcaw@0.2.0` 폴백)로만 대응 — 실제 breaking release가 나야 실전 검증됨 |

### 4.2 확인 필요 (형의 결정 대기)

없음.

### 4.3 취소/보류 항목

- **E3(릴리즈 생성 종단 검증)** — 취소가 아니라 **의도적 대기**. 임의 버전으로 미리
  릴리즈를 만들면 실제 종료 시점의 태그와 어긋난 프로덕션 레코드가 남으므로, 이 사이클을
  실제로 닫는 §8.1 절차에서 실행하며 자연히 실증된다(7차 C31과 동일 패턴).

---

## 5. 품질 지표

### 5.1 최종 결과

| 지표 | 값 |
|------|:--:|
| Success Criteria | 4/4 Met |
| gap-detector 정적 축(Structural / Functional) | 100% / 95% |
| Critical | 0건 |
| Important | 0건 |
| Minor | 4건(전부 이월·참고, 코드 수정 불필요) |
| 삭제된 코드 | 548줄 |
| 추가된 코드 | 0줄(설정 파일 4줄 제외) |

### 5.2 해소된 이슈

이번 사이클 자체에서 발견된 Critical/Important 결함은 없다. gap-detector가 초기에
"미검증"으로 표시했던 무회귀·종단 검증 1건은 Do 단계 실행 로그로 즉시 해소됐다(Gap 아님으로
종결).

---

## 6. 회고

### 6.1 잘된 것 (Keep)

- **Design 실측이 정확했다** — §11.1 표로 예측한 삭제·신설·수정 파일 9건이 실측과 100%
  일치. 사전에 파일 라인 수까지 세어둔 것(§1.3 확정 사실)이 편차를 0으로 만들었다.
- **코드 추가 없이 리스크를 완화한다는 원칙(Checkpoint 3 C안)을 끝까지 지켰다** — RK-44
  ~RK-46 3건 전부 설정 파일 1개 + 문서 각주로만 대응, 새 코드 0줄.
- **Do 단계에서 사전 조건 불일치(dev 서버 하네스 부재)를 발견했을 때 추정으로 넘어가지
  않고 즉시 확인 질문을 던졌다** — Design이 가정한 "dev 대상 검증"이 외부 CLI 특성상
  이 저장소 안에서 재현 불가능함을 실행 직전에 파악해 형에게 대안을 물었다(D-74).

### 6.2 개선이 필요한 것 (Problem)

- **Design 단계에서 "dev 서버 대상 검증"을 확정할 때 `pdcaw`가 외부 패키지라 이 저장소의
  `hns-` 격리 하네스를 재사용할 수 없다는 걸 미리 확인하지 못했다.** Plan §6.3
  "`.pdcarc.json` 스키마 대조"만 검증 항목으로 잡고, "검증 환경 자체가 존재하는가"는
  놓쳤다. 결과적으로 Do 단계에서 뒤늦게 발견해 형에게 다시 물어야 했다.

### 6.3 다음에 시도할 것 (Try)

- **P-4(신규 제안)**: 외부 패키지를 새로 들여오는 사이클에서는 Design §6.3(검증) 항목에
  "검증에 필요한 실행 환경(dev 서버·격리 픽스처·테스트 계정)이 실제로 존재하는가"를
  기본 체크 항목으로 추가한다. 이번 사이클처럼 "그 도구가 이 저장소의 기존 하네스를
  못 쓴다"는 사실은 Design 단계에 확인 가능했다.

---

## 7. 프로세스 개선 제안

### 7.1 PDCA 프로세스

- 외부 패키지 도입형 사이클(이번처럼 "직접 구현 → 외부 소비"로 전환)에서는 Design
  Checkpoint 3의 "코드 추가 없이 리스크 완화" 원칙이 유효했다 — 다음에도 유사 사이클이
  생기면 기본값으로 채택할 만하다.

### 7.2 도구/환경

- gap-detector가 Bash 도구 없이 실행되면 런타임 검증 항목을 "미검증"으로만 표시하고
  넘어간다 — orchestrator(이번엔 Claude 본인)가 Do 단계의 실제 실행 로그를 gap-detector
  결과에 **수동으로 병합**해야 했다. 다음엔 gap-detector 호출 시 Do 단계 실행 로그
  요약을 프롬프트에 함께 넘겨 이 병합 단계를 줄일 수 있다.

---

## 8. 다음 단계

### 8.1 즉시 (사이클 종료 절차, 개정된 RULE.md)

1. [ ] `docs/PDCA/_INDEX.md`에 이 사이클 행 추가
2. [ ] 최신 태그(`v0.1.6`) 확인 후 다음 버전 번호(`v0.1.7` 제안) — **형 확인 필요**
3. [ ] `npx pdcaw@latest upload --cycle adopt-pdcaw-cli --version <확정 버전>` 실행
   (이 명령 자체가 C33·E3의 최종 실증이자, 이번에 개정한 RULE.md 3번 항목의 첫 실사용)
4. [ ] README.md 최신화
5. [ ] docs 문서 + README.md 커밋 1개 — **형 지시 시에만**(CLAUDE.md 기본수칙)
6. [ ] 마지막 커밋에 버전 태그 후 푸시 — **푸시 전 형 확인**
7. [ ] 최신 태그~이번 태그 git diff를 txt로 저장(커밋 안 함)

### 8.2 다음 사이클 후보

- M-1(`cyclePath.ts` 고아 export) 정리 — 급하지 않음, 다음 관련 작업 때 함께
- `pdcaw` breaking release 발생 시 RULE.md 각주 폴백 명령이 실제로 동작하는지 실전 확인

---

## Version History

| Version | Date | Changes | Author |
|---------|------|---------|--------|
| 0.1 | 2026-08-09 | 최초 작성 | Claude |
