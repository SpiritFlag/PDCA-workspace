---
template: analysis
version: 1.0
---

# adopt-pdcaw-cli 분석 문서

> **요약**: gap-detector 정적 분석(Structural 100% / Functional 95%, API Contract는 서버
> 무변경이라 해당 없음)과 Do 단계에서 이미 실행한 종단 검증(무회귀 3종 + 프로덕션 실제
> 업로드 E1·E2)을 종합했다. Success Criteria C32~C35 **4/4 Met**. Critical·Important
> 이월 0건 — Minor 4건은 전부 스코프 밖 참고 사항.
>
> **프로젝트**: PDCA-workspace
> **작성자**: Claude
> **작성일**: 2026-08-09
> **PDCA Cycle**: adopt-pdcaw-cli (문서화 기준 8번째 사이클)

---

## Context Anchor

> Design 문서에서 전파.

| Key | Value |
|-----|-------|
| **WHY** | 자체 구현 스크립트를 이미 범용화·게시된 외부 패키지(`pdcaw@0.2.0`)로 대체해 로직 이원화를 없앤다 |
| **WHO** | 형 — 명령 실행자·승인자 / Claude — 스크립트 삭제·설정/문서 개정 |
| **RISK** | RK-44(`@latest` 브레이킹)·RK-45(스캔 범위 확대)·RK-46(base-url 기본값 없음) — 전부 코드 없이 문서·설정으로 완화 |
| **SUCCESS** | 옛 스크립트·테스트 완전 삭제, RULE.md 개정 명령 실제 성공, `.pdcarc.json` 커밋 |
| **SCOPE** | 스크립트 교체 + 설정/문서 갱신. 서버·DB·프론트 변경 없음 |

---

## 1. Success Criteria 최종 상태

| ID | 기준 | 상태 | 근거 |
|----|------|:----:|------|
| **C32** | 로직 이원화 해소 | ✅ Met | `scripts/docs-upload.ts`, `scripts/lib/{git-changes,workspace-api}.ts`(+test) 5개 파일 삭제(`scripts/lib/` 디렉터리 자체 소멸). gap-detector `grep`: `src/`·`server/`·`shared/`·`package.json`·`README` 어디에도 코드 참조 0건. 저장소 자체 `git grep`(module-2)도 exit 1(매치 없음)로 동일 확인 |
| **C33** | RULE.md 실물 정합 | ✅ Met | gap-detector: `docs/RULE.md` 26-38행이 Design §11.2 To-be와 **문구 100% 일치**. Do module-4에서 개정된 명령(`npx pdcaw@latest upload --cycle adopt-pdcaw-cli`)을 실제로 2회 실행(E1 신규 업로드, E2 `.pdcarc.json` 단독 해석)해 둘 다 성공(exit 0) |
| **C34** | 설정 이원화 정리 | ✅ Met | `.pdcarc.json`이 Design §3.2 스키마(`projectId`, `baseUrl` 2키, PAT 없음)와 바이트 단위 동일. `.env.local.example`은 `PDCAW_PAT`만 필수로 서술, 나머지는 "`.pdcarc.json`이 기본 출처"로 주석 갱신 |
| **C35** | 무회귀 | ✅ Met | `tsc -b` 그린(에러 0) / `oxlint` 0 warning / `npm test` 7 files, 64 tests 전부 통과(삭제된 `git-changes.test.ts`·`workspace-api.test.ts`만큼 케이스 수가 줄어든 게 정상 — 실패 0건이 회귀 없음의 근거) |

**4/4 Met.**

### 1.1 DoD 대조 (Plan §4.1)

| 항목 | 상태 | 비고 |
|------|:----:|------|
| FR-90~FR-96 전건 적용 | ✅ | §2 참고 |
| C32~C35 전건 실증(로그 첨부) | ✅ | 위 표 |
| `npm test`/`tsc -b`/`oxlint` 그린 | ✅ | module-2 실행 로그 |
| 코드 참조 잔존 0건 | ✅ | gap-detector + `git grep` 이중 확인 |
| dev 서버 대상 실제 실행 성공 로그 | ⚠️→✅ **대상 변경** | Design은 "dev 서버"를 가정했으나, Do 단계에서 이 저장소엔 `pdcaw` 전용 격리 하네스가 없어(외부 CLI라 `hns-` 픽스처 재사용 불가) 형이 **프로덕션에서 멱등 업로드로 대체 실행**을 직접 승인(2026-08-09). 실행 자체는 성공했고 대상만 dev→prod로 바뀐 것 — 아래 §7 D-74로 결정 기록 |

---

## 2. 정적 갭 분석 (gap-detector, 2축)

서버 무변경이라 API Contract 축은 가중치에서 제외하고 Structural·Functional 2축만 평가했다
(gap-detector 판단).

| 축 | 점수 | 근거 |
|------|:----:|------|
| **Structural Match** | 100% | Design §11.1 표 9개 변경 항목 + 불변 1개(`cyclePath.ts`) = 10/10 일치 |
| **Functional Depth** | 95% | 파일별 내용이 Design 문구와 실질 동일. `parseCycleStagePath` 고아 export 1건만 감점(§4 M-1) |
| API Contract | N/A | Design §4 — 서버 코드 0줄 변경, 검사 대상 제외 |

**정적 축 Overall ≈ 97%** (Structural×0.33 + Functional×0.67, gap-detector 가중)

> 이 사이클은 "구조적 일치율"보다 **Plan이 정의한 완료 기준(C32~C35)이 실제 판정축**이다
> (4·5차 마감 사이클 선례와 동일 이유 — 새 기능이 아니라 삭제·교체가 스코프라 Match Rate
> 산식이 스코프와 안 맞는다). §1의 **4/4 Met**을 최종 판정으로 채택한다.

---

## 3. 항목별 검증 (gap-detector 원자료)

| # | 검증 항목 | 결과 | 근거 |
|---|-----------|:----:|------|
| 1 | 삭제 대상 5개 파일 | ✅ | `scripts/lib/` 디렉터리 자체 소멸, `scripts/`엔 `import-docs.mjs`만 남음 |
| 2 | `.pdcarc.json` | ✅ | Design §3.2와 동일, PAT/token 키 없음, `.gitignore`에 안 걸려 커밋 가능 |
| 3 | `package.json` | ✅ | `docs:upload` 부재, 나머지 9개 스크립트 무손상 |
| 4 | `.env.local.example` | ✅ | `PDCAW_PAT`만 활성, 나머지 주석 처리 + 해석 순서 설명 |
| 5 | `docs/RULE.md` 3번 | ✅ | Design §11.2 To-be와 문구 100% 일치. 사전에 있던 다른 미커밋 수정(2번 문구, 4~7번 항목)과 공존 확인 — 3번 교체가 그 수정을 덮어쓰지 않음 |
| 6 | `cyclePath.ts` 존속 | ✅ | 26줄 그대로, `CycleCard.tsx`·`CycleList.tsx` 소비 정상 |
| 7 | `CLAUDE.md` | ℹ️ | 저장소 루트 부재 — **스코프 밖**, 형이 전역(`~/.claude/CLAUDE.md`)으로 이동시키며 지운 것으로 확인(2026-08-09 형 확인) |

---

## 4. Gap 목록

### 🔴 Critical — 0건
### 🟡 Important — 0건

gap-detector가 "미검증"으로 표시했던 V-1(무회귀·종단 검증)은 Bash 도구 제약으로 **정적
분석 시점에 확인 못 한 것**일 뿐 — 실제로는 Do module-2·module-4에서 이미 실행·통과했다
(§1 표 근거). 재실행 불필요, Gap 아님으로 종결.

### 🔵 Minor — 4건 (전부 이월/참고, 이번 사이클 스코프 아님)

| ID | 항목 | 근거 | 처리 |
|----|------|------|------|
| M-1 | `parseCycleStagePath` 고아 export | `cyclePath.ts:19` — 유일 소비처(`docs-upload.ts`)가 삭제돼 이제 자기 테스트만 호출 | Design이 `cyclePath.ts` 불변으로 명시했으므로 이번 사이클에서 손대지 않음. 다음 정리 사이클 후보로 기록 |
| M-2 | `_INDEX.md`에 이 사이클 행 없음 | 7차까지만 기재 | RULE.md 종료 절차 1번 항목 — **아직 시점 아님**(사이클 종료 시 처리), Gap 아님 |
| M-3 | `cyclePath.ts:18` 옛 `Plan SC: C27·C29` 주석 잔존 | 삭제된 스크립트를 위해 달았던 이전 사이클 참조 | 무해, 파서 로직엔 영향 없음. 방치 가능 |
| M-4 | Plan §2.1/§3.1/§4.1 체크박스·상태 열 미체크 | Plan 문서 자체의 진행 표기 | 문서 위생 — Report 작성 시 함께 정리 |

---

## 5. Decision Record 준수 확인

| 결정 | 따랐는가 | 결과 |
|---|:---:|---|
| D-70(`npx @latest`, devDependency 미고정) | ✅ | `package.json`에 `pdcaw` 없음, `npx pdcaw@latest`로만 호출 |
| D-71(래퍼 제거, 직접 노출) | ✅ | `package.json` `docs:upload` 삭제, RULE.md가 `npx pdcaw upload`를 직접 명시 |
| D-72(`.pdcarc.json` 병행) | ✅ | 신설·커밋 완료, E2로 단독 동작 실증 |
| D-73(RK 완화는 코드 없이 문서·설정만) | ✅ | 래퍼·검증 코드 0줄 추가, RULE.md 각주(`pdcaw@0.2.0` 폴백)로만 RK-44 대응 |
| **D-74(신규)** — module-4 검증 대상을 dev에서 prod로 변경 | 형 승인 | Design은 dev 서버 격리 검증을 가정했으나, `pdcaw`가 외부 CLI라 이 저장소의 `hns-` 격리 하네스를 재사용할 수 없었다. 멱등한 `upsert`라는 성질을 근거로 형이 프로덕션 실행을 직접 승인(2026-08-09) — E3(릴리즈 생성)만 실제 사이클 종료 시점으로 미루고, E1·E2는 그 자리에서 실행·성공 확인 |

---

## 6. 코드 변경 범위 대조 (Design §11.1 예측 vs 실측)

| 파일 | Design 예측 | 실측 | 일치 |
|------|:-----------:|:----:|:----:|
| `scripts/docs-upload.ts` | 삭제 | 삭제 | ✅ |
| `scripts/lib/git-changes.ts`(+test) | 삭제 | 삭제 | ✅ |
| `scripts/lib/workspace-api.ts`(+test) | 삭제 | 삭제 | ✅ |
| `package.json` | 수정 | 수정(`docs:upload` 제거) | ✅ |
| `.pdcarc.json` | 신설 | 신설 | ✅ |
| `.env.local.example` | 수정 | 수정 | ✅ |
| `docs/RULE.md` | 수정 | 수정 | ✅ |

예측과 실측 사이 편차 0건 — Design 단계 실측(§1.3 확정 사실)이 정확했다.

---

## 7. 남는 관찰 (재이월 후보, 스코프 밖)

- **M-1** — `parseCycleStagePath`가 이제 프로덕션 코드에서 호출되지 않는 고아 export다.
  당장 문제는 없지만, 다음에 `cyclePath.ts`를 정리할 사이클이 생기면 함께 검토
- **RK-44 실물 대응 체계 없음** — `pdcaw`가 실제로 breaking release를 내면 RULE.md 각주
  대로 형이 수동으로 버전을 고정해야 한다. 자동 감지·알림은 이번 사이클에서 의도적으로
  만들지 않았다(D-73)

---

## Version History

| Version | Date | Changes | Author |
|---------|------|---------|--------|
| 0.1 | 2026-08-09 | 최초 작성 — gap-detector 정적 분석 + Do 단계 종단 검증 종합 | Claude |
