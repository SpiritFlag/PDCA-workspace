---
template: analysis
version: 1.1
---

# refine-cycles-hardening 분석 문서

> **한 줄 요약**: 스코프 3건(C-1·I-1·I-4) **전부 실증으로 닫힘**. red 6건(module-1) → green
> 15/15(module-2), 브라우저 8항목 형 확인 완료(module-3). 이 사이클 자체는 **Plan RK-18에 따라
> 스코프 3건 대조만** 한다 — gap-detector 전면 스캔은 마감 사이클 성격과 안 맞는다(4차 선례).
>
> **프로젝트**: PDCA-workspace
> **작성자**: Claude
> **작성일**: 2026-08-09
> **PDCA Cycle**: refine-cycles-hardening (문서화 기준 5번째 사이클)

---

## Context Anchor

> Design에서 복사.

| Key | Value |
|-----|-------|
| **WHY** | `.optional()`/`.nullable()` 결함의 3번째 재발(3차 C-1)과, 코드 정독으로만 발견된 이유(I-4 실증 0건)를 같은 사이클에서 닫는다. |
| **WHO** | 형 — 브라우저 실증 / 클로드 — 코드·dev DB 하네스 |
| **RISK** | RK-19(타입 파급) / RK-20(pairRule null 구멍) / RK-21(기존 부정합) / RK-22(dev DB 잔여물) / RK-23(red 없이 green) / RK-27(커밋된 하네스 부채) |
| **SUCCESS** | C17~C20 |
| **SCOPE** | 이월 3건 고정(S1~S3) |

---

## 1. Success Criteria 최종 상태

| ID | 스코프 | 기준 | 상태 | 근거 |
|----|:---:|------|:---:|------|
| **C17** | S1 | 해제 3단계 실증(①연결 확인 ②`PATCH null쌍` 2xx ③재조회 null) + ④브라우저 새로고침 유지 + ⑤해제한 이름 재사용 성공 | ✅ Met | 하네스 #10(②)·n1(③) + 형 브라우저 §5.2 체크리스트 8항 전건 확인(2026-08-09, "다 됐어") — ④⑤는 체크리스트 2·4번에 대응 |
| **C18** | S2 | 편측 400(양쪽 필드) + 부분수정(releaseNote·version·`{}`) 200 무회귀 + dev DB 부정합 0건 | ✅ Met | 하네스 #5·n3(편측 400) + #6·#7·n4(무회귀) + V3 쿼리 재실행(수정 후 0건, §3) |
| **C19** | S3 | 15 시나리오 red→green 기록, 미실행 0건 | ✅ Met | module-1: **6 failed / 9 passed**(§2) → module-2: **15/15 passed**(§2). Design 예측(5건)과 실측(6건)의 차이도 §2에 기록 |
| **C20** | S3 | 하네스 자산화 4종(①커밋 ②`test:l1` 재실행 ③skip ④`npm test` 불변) | ✅ Met | ①`ce695a1` 커밋 ②module-2 시점 재실행 15/15 ③`env -u DATABASE_URL npx vitest run --config vitest.l1.config.ts` → 15 skipped ④`npm test` 6 files 불변(54/54, +5는 L0 신규분이지 하네스 유입 아님) |

**Success Rate: 4/4 완전 충족.** Critical·Important 이월 0건.

---

## 2. S3 — L1 하네스 red→green 기록 (C19 핵심 증거)

### 2.1 module-1 실행 (수정 전, red)

| 결과 | 시나리오 | 원인 |
|:---:|---|---|
| ❌ 6건 | #5, #10, n1, n2, n3, n4 | 아래 §2.2 참조 |
| ✅ 9건 | #1, #2, #3, #4, #6, #7, #8, #9, #11 | 이월 3건과 무관한 경로 — pair rule·nullable을 안 건드리는 시나리오는 현행에서도 정상 |

### 2.2 Design 예측(5건) vs 실측(6건) — 실행 후 발견한 차이

Design §8.3은 red 예상을 **#5·#10·n1·n2·n3 5건**으로 적었다. 실측은 **6건**(n4 추가) —
Design이 `n4`를 "PATCH 200 성공"만으로 판정했는데, 실제 구현한 n4는 상태 검증(`name`·
`yearMonth`가 null인지)까지 단언한다. `#10`이 pre-fix에서 실패(zod가 null 거부)하면 레코드가
계속 연결 상태로 남고, 그 상태에 대해 n4의 null 단언이 자연히 깨진다 — **n4는 실행 전 예측대로
`#10`에 종속돼 있었다**, Design이 그 종속을 놓쳤을 뿐이다. 코드가 아니라 **Design의 사전 예측이
실측으로 정정된 사례**이며, 이 자체가 I-4가 닫으려던 문제("하네스 없이는 이런 상호작용을 못
본다")를 증명한다.

### 2.3 구현 중 발견·수정한 하네스 자체 결함 2건

module-1 최초 실행에서 **7건 실패**가 나와, 5→6이 아니라 5→7로 어긋난 원인을 분석했다:

1. **`#5`를 `#4`가 만든 공유 레코드(`cycleLinkedId`)에 직접 걸었더니, 현행 버그가 그 편측
   패치를 실제로 성공시켜 `name`을 `'hns-renamed'`로 진짜 바꿔버렸다.** 그 오염이 `#7`(이름
   재사용 충돌 검사)·`n1`·`n2`·`n4`까지 번져 7건 실패로 나타났다 — Design 표가 지면 검토만
   거쳐 이 상호작용을 못 봤다. **조치**: `#5`·`n3`을 전용 격리 레코드(`v9.0.7`·`v9.0.8`)로
   옮겨 부작용을 차단(`server/cycles.l1.ts` 주석 — Decision: [Do] 표기).
2. **`n3`이 `#11`이 이미 DELETE한 `cycleUnlinkedId`를 잘못 타겟해 400이 아니라 404가 났다.**
   대상 레코드 선정 실수. 위 조치로 함께 해소.

두 결함 모두 §8.4·§8.5 절차(전용 레코드 격리)로 module-1 안에서 수정 후 재실행해 **6건**으로
안정화했다 — 이게 §2.1의 확정 red 기준선이다.

### 2.4 module-2 실행 (수정 후, green)

**15/15 passed.** red 6건이 전부 green으로 전환됐고, red가 아니었던 9건도 무회귀로 유지됐다.

### 2.5 회귀 확인 3종 (C20 ④, §3.2 NFR)

| 확인 | module-1(전) | module-2(후) | 무회귀 |
|---|:---:|:---:|:---:|
| `npm test`(기본) 파일 수 | 6 | 6 | ✅ |
| `npm test` 통과 건수 | 49 | 54(+5, L0 신규) | ✅ (신규분 외 무변화) |
| `tsc -b` / `oxlint` | 클린 | 클린 | ✅ |

---

## 3. S1+S2 — dev DB 무결성 (C18 후반)

| 시점 | 쿼리 | 결과 |
|---|---|:---:|
| Plan §6.2 검증 3(수정 전) | `WHERE (name IS NULL) != (year_month IS NULL)` | 0건 |
| module-2 완료 후(수정 후) | 동일 쿼리 재실행 | **0건** |
| 하네스 잔여물(FR-50) | `owner_id LIKE 'hns-owner-%'` (workspaces·api_tokens) | **0건** (module-3 확인) |

부정합 0건이 수정 전후 동일하게 유지됐다 — 이번 스코프가 새 부정합을 만들지 않았고, 기존에도
없었다(§1.3.1 귀납 논증의 전제가 실행 전후 모두 성립).

---

## 4. 코드 변경 범위 대조 (Design §11.1 예측 vs 실측)

| Design 예측 | 실측 | 판정 |
|---|---|:---:|
| 신규 3(`cycles.l1.ts`·`vitest.l1.config.ts`) + 수정 3(`schema.ts`·`schema.test.ts`·`CycleForm.tsx`) + `package.json` 1줄 | 정확히 동일 — **6파일 351줄 추가·12줄 삭제** | ✅ 일치 |
| `server/services/cycles.ts`·`db/scoped.ts`·`routes/cycles.ts` 무변경(F31) | `git diff --stat` **0줄** | ✅ 일치 |
| `CycleList.tsx`·`CycleCard.tsx`·`api.ts`·`useCycles.ts` 무변경 | 동일 — `tsc -b`·`oxlint` 클린으로 확인 | ✅ 일치 |
| DB 스키마·마이그레이션 0건(F37) | `drizzle/` diff **0파일** | ✅ 일치 |
| MCP 무변경(F36) | `server/mcp/` diff **0줄** | ✅ 일치 |

Design이 예측한 변경 표면이 실측과 **완전히 일치**했다 — F31(서버 무가공 전달)·F33(공유 필드
설계)·F36(MCP 툴 0개)·F37(마이그레이션 불필요) 네 실측 사실이 전부 구현 단계에서 재확인됐다.

---

## 5. FR 대조 (Plan §3.1)

| ID | 요구사항 | 상태 |
|----|----------|:---:|
| FR-39 | name/yearMonth nullable | ✅ `schema.ts` |
| FR-40 | 엄격 pairRule(null 미연결 취급) | ✅ D-38, t4로 RK-20 회귀 고정 |
| FR-41 | create null 쌍 = 미연결 생성 | ✅ t5, 하네스 #3 |
| FR-42 | toggleLink(false) → null 전송 | ✅ `CycleForm.tsx` |
| FR-43 | 해제 동선 명확 | ✅ D-33 확정(confirm) — Design Checkpoint 3 |
| FR-44 | update pair rule 재부착 | ✅ `partial().refine()` |
| FR-45 | 부분 수정 무회귀 | ✅ t3·n4 |
| FR-46 | 술어·메시지 export(4차 선례 형식) | ✅ `cyclePairRule`·`CYCLE_PAIR_MESSAGE` |
| FR-47 | 15 시나리오 실행 | ✅ §2 |
| FR-48 | red→green 기록 | ✅ §2.1·§2.4 |
| FR-49 | L0 케이스(최소 4) | ✅ 5케이스(t1~t5) |
| FR-50 | 하네스 정리 확인 | ✅ §3 |
| FR-51 | 커밋 + 분리 실행 | ✅ `test:l1`, `ce695a1` |
| FR-52 | skip 가드 | ✅ §2.5·module 검증 |
| FR-53 | 재사용 지침 주석 | ✅ `cycles.l1.ts` 파일 헤더(실행·env·격리·확장 4항목) |

**15/15 전건 충족.**

---

## 6. Decision Record 준수 확인

| 결정 | 준수 | 결과 |
|---|:---:|------|
| D-30 해제 = null 명시 전송 | ✅ | `toggleLink` + PATCH 본문 |
| D-31(a) nullable을 공유 필드에 | ✅ | 폼 resolver가 null 통과(V2 실측 그대로 재현) |
| D-32(a) pair 검증은 zod에서 | ✅ | 서비스 계층 무변경(§4) — 검증 위치 단일화 유지 |
| D-33 해제 confirm(형 문안) | ✅ | 문안 그대로 구현, 형이 브라우저에서 직접 확인 |
| D-35·형 승인 A1 하네스 커밋 자산화 | ✅ | `ce695a1`, 세 번째이자 마지막 재건축 — RK-27 관찰은 §7로 이월 |
| D-37 하네스 위치 `server/*.l1.ts` | ✅ | `tsc -b`·`oxlint` 자동 커버 확인(§4) |
| D-38 엄격 pairRule | ✅ | t4로 RK-20 반례 회귀 고정 |
| D-39 PAT 직접발급 + 합성 owner 격리 | ✅ | §3 잔여물 0건으로 격리 성립 확인 |

위반 0건.

---

## 7. 남는 관찰 (스코프 밖, 재이월 확인)

| 항목 | 상태 |
|---|---|
| RK-27(커밋된 하네스의 유지보수 부채) | **미실현.** 이번 사이클 안에서는 하네스가 2회(module-1 red, module-2 green) 실제로 돌았다. 다음 사이클(특히 I-2 cycles MCP 툴)이 재사용하는지가 진짜 판정 시점 — report §6.3에 Try로 남긴다 |
| RK-19(타입 파급) | 실현 안 됨 — `tsc -b` 클린, 소비처 3곳(폼·서비스·라우트) 전부 무변경 또는 예상대로만 변경 |
| Plan §2.2 재이월분(I-2·I-3·I-5·M-1~M-9·리네임 등) | 이번 스코프 밖 그대로 — 착수 0건, 재이월 유지 |
| P-5(릴리즈 버전 표기 단일 원천) | 이번 사이클도 git tag·`cycles.version`·문서 버전 표기가 분리된 채 — 관찰만 기록, 조치는 스코프 외 |

---

## Version History

| 버전 | 날짜 | 변경 내용 | 작성자 |
|------|------|-----------|--------|
| 0.1 | 2026-08-09 | 최초 작성. 스코프 3건(C17~C20) 전부 실증으로 충족 확인 — L1 하네스 red 6건(module-1, Design 예측 5건과 1건 차이 — n4의 #10 종속을 실행 후 발견) → green 15/15(module-2), 구현 중 하네스 자체 결함 2건 발견·수정(§2.3), dev DB 부정합 0건 유지, 하네스 잔여물 0건, 코드 변경 범위가 Design 예측과 완전 일치(§4), FR 15개 전건 충족. Critical·Important 이월 0건 | Claude |
