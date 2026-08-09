---
template: report
version: 1.0
---

# adopt-oauth-clerk 완료 보고서

> **요약**: `/api/mcp` 인증에 Clerk 기반 OAuth 2.1을 추가하고 legacy(PAT·Neon Auth JWT)는
> 병행 유지했다. Plan 단계 초안(mcp-handler 전제)이 코드 대조로 반증되며 자체 구현(C안:
> 신설+위임)으로 방향이 바뀌었고, Do 단계에서는 dev/prod Clerk 인스턴스 혼동, PRM 라우팅
> 버그, 리버스 프록시 구현·삭제, 커스텀 도메인 즉석 구매까지 이어지는 긴 실측 여정 끝에
> claude.ai가 **DCR로(Client ID/Secret 입력 없이) OAuth 커넥터를 등록·연결·툴 10종+프롬프트
> 2종 호출**에 성공했다. Check 단계 gap-detector 정적분석 91%(Critical 0)에서 발견한 9건을
> 전량 즉시 수정했고, 그 과정에서 이 사이클 최대 사각이던 **OAuth 성공 경로의 L1 자동
> 커버리지를 0%→실증**으로 메웠다.
>
> **프로젝트**: PDCA-workspace
> **작성자**: Claude
> **작성일**: 2026-08-10
> **PDCA Cycle**: adopt-oauth-clerk (11번째 사이클)
> **버전**: `v0.2.0` (예정 — 종료 절차에서 최종 확정)

---

## 1. Executive Summary

### 1.1 프로젝트 개요

| 관점 | 내용 |
|------|------|
| **Problem** | 웹 커넥터 인증이 URL 쿼리 평문 PAT(2차 D-18)였다 — 4차에서 Vercel 로그 잔존 확정, 2026-08-10엔 실제 노출 사고까지 발생. 워크플로 입구는 10차 이후 웹 커넥터로 확정된 상태였다 |
| **Solution** | MCP 스펙이 수렴한 OAuth 2.1을 RS(Resource Server) 역할로 도입 — 발급·회전은 IdP(Clerk)에 위임, 우리는 JWKS 검증 + PRM 노출 + 401 규약만 책임진다. legacy는 v0.2.1까지 병행 |
| **Function/UX Effect** | claude.ai에서 URL만으로 커넥터를 추가하면 DCR이 자동 등록하고, 브라우저 동의 화면 이후 토큰이 URL·로그 어디에도 남지 않는다. 기존 Claude Code·`pdcaw` 연결은 무변경 |
| **Core Value** | 2차 D-03("OAuth는 개인 앱에 과함")의 명시적 번복 — 조건이 바뀐 것을 백로그 `128404f2`가 3차례 사이클에 걸쳐 추적해 왔다는 사실 자체가 이 사이클의 자산이다 |

### 1.2 결과 요약

| 항목 | 계획(Plan v1.0) | 실제 |
|------|----------------|------|
| IdP | ①B(Neon Auth 자체 OIDC) 우선 실측 → 실패 시 ①A(Clerk) | Neon Auth 미지원 확정 → **Clerk 확정**(D-99) |
| DCR 대응 | 예상: 미지원 → 수동 클라이언트(D-107) | **최종 지원됨** — vercel.app 도메인에선 Account Portal 미지원으로 막혔으나, **형이 커스텀 도메인을 즉석 구매**하며 정공법으로 해소(D-111, Plan 밖 결정) |
| 프록시 구현 | (예상 없음) | prod Clerk이 `/__clerk` 경로 프록시 구조임을 발견해 SSRF-safe 구현(D-110) → 커스텀 도메인 확보 후 **통째로 삭제**(순증 0) |
| 파일 배치 | `server/middleware/mcp-auth.ts` 단일 신설(C56 정량 기준) | ✅ 그대로 + `server/root.ts` 추가 신설(D-99b, PRM이 `app`의 basePath 밖이라 필요) |
| Match Rate | 90% 게이트 | 정적 91% → gap 9건 즉시 수정 → iterate 불필요 |

### 1.3 실현된 가치

| 지표 | 이전 | 이후 |
|------|------|------|
| 웹 커넥터 인증 방식 | URL 쿼리 평문 PAT(폐기 불가, 회전 없음) | OAuth 2.1(만료·회전, 로그 미노출) — **legacy와 병행**(v0.2.1에서 legacy 제거 예정) |
| DCR 지원 | (해당 없음) | claude.ai가 Client ID/Secret 없이 URL만으로 연결 |
| L1 테스트 | 37건 | 48건(+11) — OAuth 성공 경로 자동 검증 신규 확보 |
| 신규 npm 의존성 | — | **0개**(NFR-1 끝까지 유지, Clerk SDK도 프록시도 결국 안 씀) |

### 1.4 Success Criteria 최종 상태

| ID | 기준 | 상태 | 근거 |
|----|------|:---:|------|
| C52 | 툴 10종+프롬프트 2종 전수(실토큰) | ✅ Met | 형 실사용 — Client ID/Secret 없이 URL만으로 연결 후 확인 |
| C53 | 401+`WWW-Authenticate` | ✅ Met | `curl -i` 양 도메인 |
| C54 | PRM 프로덕션 실경로 | ✅ Met | D-99b 해결 후 양 도메인 확인 |
| C55 | legacy 무회귀 | ✅ Met | L1 48건 + 배포본 curl |
| C56 | 파일 1개 삭제=컷오버(정량) | ✅ Met | `auth.ts` +2줄, `app.ts` OAuth 흔적 정확히 2줄 |
| C57 | S1 실측 전건 기록 | ✅ Met | V1·V3′·V5·D-99 전부 기록 |
| C58 | (①B 시) 웹 UI 무회귀 | ⛔ N/A | ①A 확정으로 발동 조건 소멸 |

**Success Rate: 6/6 Met (N/A 1건 제외)**

### 1.5 Decision Record 요약

| ID | 결정 | 따랐나 | 결과 |
|----|------|:---:|------|
| D-99 | IdP = Clerk | ✅ | Neon Auth OIDC 미지원 형 실측 확정 후 채택 |
| D-100 | `mcp-auth.ts` 단일 신설 | ✅ | C56 정량 기준 충족 |
| D-101 | OAuth 헤더 전용 | ✅ | L1 a10으로 회귀 방지 |
| D-105 | 분기 진입 시 fail-fast | ⚠️ 부분 | `CLERK_ISSUER` 케이스만 구조적 한계로 남음(I-1, 문서화+테스트 고정) |
| D-107 | DCR 대응 수동 클라이언트 | **미사용** | D-111(커스텀 도메인)로 경로 자체가 소멸 — 기각이 아니라 "필요 없어짐" |
| D-108 | Clerk형 실패 시 legacy 재시도 금지 | ✅ | a4·a9로 실증 |
| D-109 | aud 검증 생략+기록 | ⏳ 부분 | 코드는 규약대로. "실값 기록"(h5)만 미이행, 저우선 이월 |
| D-110 | Clerk 프록시 직접 구현 | **롤백됨** | SSRF-safe 구현까지 했으나 D-111로 불필요해져 삭제 — 순증 0 |
| **D-111** | **커스텀 도메인 채택**(Plan 밖) | ✅ | DCR을 정공법으로 살린 결정적 한 수. RK-68 최종 해소 |
| D-99b | `root.ts`로 app 밖 합성 | ✅ | PRM basePath 버그 실측 후 신설, I-3(dev-server) 수정으로 3개 진입점 완성 |

---

## 2. 관련 문서

- [Plan](adopt-oauth-clerk.plan.md) v1.7
- [Design](adopt-oauth-clerk.design.md) v1.2
- [Analysis](adopt-oauth-clerk.analysis.md) v1.0
- 선행: [backlog-with-mcp](../backlog-with-mcp/) D-18(쿼리 폴백 원결정) / [refine-mcp-hardening](../refine-mcp-hardening/) C13(평문 잔존 실측) / [expand-mcp-prompts](../expand-mcp-prompts/) C50(웹 커넥터 실지원 확인)

---

## 3. 완료 항목

### 3.1 스코프 5건 (Plan §2.1)

| ID | 항목 | 상태 |
|----|------|:---:|
| S1 | IdP 확정 실측 | ✅ |
| S2 | OAuth 검증 미들웨어 | ✅ |
| S3 | PRM 엔드포인트 | ✅ |
| S4 | 401 응답 규약 | ✅ |
| S5 | 실증 | ✅ |

### 3.2 비기능 요구사항

- NFR-1(새 npm 의존성 0개) — ✅ 끝까지 유지
- NFR-2(DB 마이그레이션 0건) — ✅
- NFR-3(비밀값 stdout 미출력) — ✅ Clerk Secret/Client ID 등 전 과정 미노출
- NFR-4(`tsc`·`oxlint`·`npm test` 무회귀) — ✅ 매 커밋 확인

### 3.3 산출물

| 파일 | 종류 |
|------|------|
| `server/middleware/mcp-auth.ts` | 신설 — OAuth 검증+legacy 위임 |
| `server/routes/prm.ts` | 신설 — PRM |
| `server/root.ts` | 신설 — `app`+PRM 합성(basePath 밖) |
| `server/mcp-auth.l1.ts` | 신설 — L1 11건(a1~a10, a5b·a7b 포함) |
| `server/middleware/auth.ts` | 수정 — `unauthorized` export 1줄 |
| `server/app.ts` | 수정 — `/mcp` 마운트 교체 |
| `server/dev-server.ts` | 수정 — `root` 사용 |
| `server/l1-harness.ts` | 수정 — `root` 사용 |
| `api/[...route].ts` | 수정 — `root` export |
| `vercel.json` | 수정 — `.well-known` 라우트 |
| `.env.local.example` | 수정 — 신규 env 3종 키 |

---

## 4. 미완료 항목

### 4.1 다음 확인으로 이월

| 항목 | 사유 | 제안 |
|------|------|------|
| **h5** — 실토큰 `aud` 값 확인·기록(D-109) | 저우선, 선택 과제 | claude.ai가 `resource=` 파라미터를 실제로 보낸다는 건 확인됨(module-2 h1) — Clerk가 이걸 `aud`에 반영하는지만 남음. 반영되면 다음 사이클에서 `aud` 검증 추가 검토 |
| **h7** — `pdcaw` CLI 실사용 확인 | legacy 코드 무변경, 위험 낮음 | 형 재량 |

### 4.2 취소/보류 항목

| 항목 | 사유 |
|------|------|
| D-107 수동 클라이언트 경로 | 코드로 구현 안 함 — D-111이 정공법으로 대체. 기록만 남김(재발 시 참고) |
| CIMD 전환 | Plan §2.2에서 원래도 Out of Scope. DCR이 살아났으니 우선순위 더 낮아짐 |

### 4.3 새 백로그 후보 (이 사이클에서 발견, 스코프 밖)

| 후보 | 근거 | 우선순위(제안) |
|------|------|:---:|
| `d9109910-...`(cogmo) 계정 정리 | V5 실측 중 발견 — 7차가 이미 "작성자 오귀속"으로 식별했던 그 계정에 실제 워크스페이스 데이터(cogmo)가 남아있음 | Low |
| RK-74(웹 UI까지 Clerk 통일, Neon Auth 제거) 재평가 | 커스텀 도메인이 이제 있으므로 실행 난이도가 낮아졌을 수 있음(미확인 — 별도 실측 필요) | Low, 확인 후 재산정 |
| L1 하네스에 로컬 JWKS 서버 패턴 문서화 | a9·a10에서 쓴 "실 키쌍+로컬 HTTP 서버로 모킹 없이 서명 토큰 검증" 패턴이 다음 OAuth/JWT 관련 사이클에서 재사용 가치 있음(6T-1류 재사용 후보) | Low |

---

## 5. 품질 지표

### 5.1 최종 분석 결과 (Analysis 문서 참조)

- **정적 Match Rate: 91%** (Critical 0 · Important 3 · Minor 6, 전건 즉시 수정 완료)
- **L1: 48/48 통과**(실 dev DB) — 신규 11건 포함(a1~a10 + a5b/a7b)
- **배포본 curl**: PRM·401 헤더·legacy 무회귀 — vercel.app·커스텀 도메인 양쪽 확인
- **사람 실증**: claude.ai 웹 커넥터로 OAuth 연결·툴 10종+프롬프트 2종 호출 성공(형 확인)

### 5.2 해소된 이슈 (Check 단계)

| 심각도 | 건수 | 처리 |
|--------|:---:|------|
| Critical | 0 | — |
| Important | 3 | I-1(문서화+테스트 고정, 의도적 미수정) · I-2·I-3(수정) |
| Minor | 6 | 전건 수정(M-1~6) |

---

## 6. 회고

### 6.1 잘된 것 (Keep)

- **실측 우선이 여러 번 값을 냈다** — Plan의 "mcp-handler 전제"를 코드 대조로 즉시 반증한 것부터, PRM 404·프록시 501·redirect 자동추종까지 전부 "가정하지 말고 curl로 확인"으로 풀렸다. 만약 가정대로 코드를 밀어붙였으면 배포 후에도 원인을 못 찾았을 조합들이었다.
- **Plan/Design 문서를 실시간으로 계속 갱신한 것** — dev/prod 혼동, D-107→D-111 경로 교체, D-110 롤백 같은 큰 방향 전환이 여러 번 있었는데, 그때그때 문서에 "왜 바뀌었는지"까지 남겨서 지금 이 report를 쓰는 시점에도 전체 경위를 재구성할 수 있었다.
- **비밀값 취급 규율** — Client ID/Secret·Clerk Secret Key를 채팅에 붙여넣지 말라고 반복해서 요청했고, 실제로 전 과정에서 한 번도 노출되지 않았다. 이 프로젝트가 겪은 PAT 노출 사고(백로그 `1909f32e`) 직후 사이클이었다는 걸 감안하면 유의미하다.
- **10T-1(사후 결정 grep 전수조사)이 실제로 작동** — P-1 오귀속 발견, D-99 확정 시 20개 지점 일괄 갱신 등, "기억나는 곳만 고치기"였으면 놓쳤을 지점들을 grep으로 잡았다.

### 6.2 개선이 필요한 것 (Problem)

- **"패키지에 기능이 있다 ≠ 우리가 쓸 수 있다"를 두 번 겪었다** — Neon Auth의 `better-auth` `oidc-provider` 플러그인(M-3, 매니지드라 못 켬)과 Clerk의 `clerkFrontendApiProxy`(SSRF CVE 있는 공식 헬퍼)가 같은 축의 함정이었다. 의존성 존재 자체를 "동작 가능"으로 넘겨짚을 뻔한 순간이 두 번 있었다.
- **환경변수 설정 순서를 명시적으로 체크리스트화하지 않아 여러 번 헤맸다** — `CLERK_ISSUER`를 prod로 갱신하는 걸 깜빡하고 재시도했다가 "여전히 dev로 감"을 다시 진단해야 했던 순간이 있었다. env 변경이 여러 단계(값 확보 → Vercel 설정 → 재배포 → PRM으로 재확인)에 걸쳐 있는데 그 사슬을 매번 처음부터 다시 짚었다.
- **L1 커버리지 설계 시점의 판단(RK-71)이 너무 보수적이었다** — "실 Clerk 토큰을 못 만드니 사람 실증만"이라고 Design에서 확정했는데, Check 단계에서야 "필요한 건 유효 서명 토큰이지 실 Clerk 토큰이 아니다"라는 더 저렴한 답이 나왔다. Design 시점에 이 구분을 했다면 Do 단계에서 바로 a9를 만들 수 있었다.

### 6.3 다음에 시도할 것 (Try)

1. **env 값이 여러 곳(발급처 대시보드·Vercel·우리 서버 응답)에 걸쳐 있는 사이클에서는, "지금 이 값이 실제로 반영됐는지"를 매 변경 후 자체 엔드포인트로 재확인하는 걸 명시적 루틴으로 못 박는다.** 이번엔 매번 즉흥으로 PRM을 다시 curl해서 확인했는데, 그게 사실상 표준 절차였다면 처음부터 그렇게 문서화했어야 한다.
2. **"실 서비스 토큰을 못 만든다"는 판단이 나오면, Design 단계에서 "정말 실 토큰이 필요한가, 아니면 유효 서명이면 충분한가"를 한 번 더 물어본다.** 이번 a9가 그 답이었다 — RK-71을 Design 시점에 더 파고들었으면 좋았다.
3. **커스텀 도메인·DNS처럼 사이클 스코프 밖일 수 있는 인프라 결정이 나오면, 바로 진행하기 전에 "지금 할까 다음 사이클로 미룰까"를 명시적으로 물어본다.** 이번엔 실제로 그렇게 했고(AskUserQuestion) 잘 작동했다 — 다음에도 같은 패턴 유지.

---

## 7. 프로세스 개선 제안

### 7.1 PDCA 프로세스

| 단계 | 현재 | 개선 제안 |
|------|------|-----------|
| Design | RK-71류("실 서비스로 못 만든다") 판단을 한 번 내리면 그대로 확정 | "진짜 필요한 게 무엇인지"(실 토큰 vs 유효 서명)를 한 단계 더 분해하는 체크 추가 검토 |
| Do | env 변경이 여러 단계에 걸칠 때 재확인 루틴이 즉흥적 | "env 변경 후 자체 엔드포인트로 즉시 재확인"을 표준 스텝으로 명문화 검토 |

### 7.2 도구/환경

| 영역 | 개선 제안 | 기대 효과 |
|------|-----------|-----------|
| L1 하네스 | 로컬 키쌍+HTTP JWKS 서버 패턴(a9)을 `l1-harness.ts` 공유 헬퍼로 추출할지 검토 | 다음 OAuth/JWT 사이클에서 재사용(6T-1류) |

---

## 8. 다음 단계

### 8.1 즉시

- [ ] **RULE.md 사이클 종료 절차** 진행 — `_INDEX.md` 행 추가 → 버전 확정(`v0.2.0` 예상) →
      `npx pdcaw@latest upload --cycle adopt-oauth-clerk --version v0.2.0` → README 최신화 →
      커밋 → 태그·푸시(확인 후) → diff txt 저장
- [ ] 백로그 `128404f2`(MCP OAuth 2.1 정식 지원 검토) → `done` 전환
- [ ] 백로그 `1909f32e`(노출 PAT 폐기·재발급) — 이 사이클과 무관하게 잔여 조치 남아있으면 형이 별도 처리
- [ ] §4.3의 새 백로그 후보 3건 등록(cogmo 정리·RK-74 재평가·L1 패턴 문서화)

### 8.2 다음 PDCA 사이클 후보

| 항목 | 우선순위 | 비고 |
|------|:---:|------|
| **v0.2.1 oauth-cutover** | High | legacy PAT 경로 제거(쿼리·헤더 둘 다). C56이 보장한 "파일 1개 삭제"로 시작 가능 |
| h5(aud 값 확인) 결과에 따른 aud 검증 추가 | Low | 형이 확인 후 판단 |
| RK-74(웹 UI Clerk 통일) 재평가 | Low | 커스텀 도메인 확보로 난이도 변화 여부 먼저 확인 |
| cogmo 계정 정리 | Low | §4.3 |

---

## Version History

| Version | Date | Changes | Author |
|---------|------|---------|--------|
| 1.0 | 2026-08-10 | 최초 작성 — Success Criteria 6/6 Met(N/A 1건), 정적 91% → gap 9건 즉시수정 완료, Decision Record 10건 기록(D-107 미사용·D-110 롤백·D-111 Plan 밖 결정 포함), 회고·프로세스 개선 제안 반영 | Claude |
