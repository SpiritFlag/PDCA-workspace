---
template: plan
version: 1.0
---

# adopt-oauth-clerk 계획 문서

> **요약**: `/api/mcp`의 인증을 URL 쿼리 PAT(2차 D-18)에서 **OAuth 2.1 위임 인증**으로
> 승격한다. 서버는 Resource Server(RS) 역할만 맡아 토큰을 JWKS로 검증하고,
> Protected Resource Metadata(RFC 9728)를 노출한다. legacy PAT 경로는 **병행 유지**하며,
> 제거는 다음 사이클(`v0.2.1 oauth-cutover`)로 명시 이관한다.
>
> **프로젝트**: PDCA-workspace
> **작성자**: Claude
> **작성일**: 2026-08-10
> **PDCA Cycle**: adopt-oauth-clerk (11번째 사이클, 버전 **`v0.2.0` 확정** — 형 승인 2026-08-10)
> **상태**: ✅ **승인 완료(2026-08-10)** — 스코프 §2.1 5건 · SC §4 6건 · Q-1~Q-5 · 버전 전건 승인

---

## Executive Summary

| 관점 | 내용 |
|------|------|
| **Problem** | claude.ai 웹 커넥터가 커스텀 `Authorization` 헤더를 넣을 자리를 주지 않아 2차에서 **URL 쿼리파라미터 PAT**로 타협했고(D-18), 4차 C13에서 그 토큰이 **Vercel 로그에 평문으로 잔존**함이 실측 확정됐다. 그 사이 워크플로 입구가 웹 커넥터로 확정됐고(10차 C50 — prompts까지 지원), 2026-08-10엔 PAT 평문 노출 사고가 실제로 발생했다. **입구는 웹인데 그 입구의 인증이 가장 약한 고리** |
| **Solution** | MCP 스펙이 수렴한 OAuth 2.1로 승격한다. 우리 서버는 **RS 역할만** — 토큰 발급·동의·회전은 IdP에 위임하고, 우리는 JWKS 검증 + PRM 노출 + 401 시 `WWW-Authenticate`만 책임진다. IdP는 **Clerk로 확정**(D-99) — Neon Auth 자체 OIDC를 먼저 실측했으나 매니지드라 미지원(§3.1.1 V1). `sub` 불일치는 매핑 env로 흡수하고 미설정 시 fail-fast |
| **Function/UX Effect** | claude.ai 커넥터 등록 시 URL에 토큰을 붙이지 않는다. 연결 버튼 → 브라우저 동의 화면 → 완료. 토큰은 만료·회전되며 URL·로그 어디에도 남지 않는다. 기존 연결(Claude Code·`pdcaw` CLI)은 **legacy PAT 경로로 무중단 동작** |
| **Core Value** | **2차 D-03("OAuth는 개인 앱 스코프에 과함")의 명시적 번복.** 그때는 맞았고 지금은 틀렸다 — 근거가 4차 C13(평문 잔존)·10차 C50(웹 입구 확정)·2026-08-10 노출 사고 3건으로 쌓였고, 백로그 `128404f2`가 승격 조건 충족을 기록해 뒀다. 결정을 뒤집는 게 아니라 **조건이 바뀐 것을 문서가 추적해 왔다는 사실**이 이 사이클의 진짜 자산이다 |

---

## Context Anchor

| Key | Value |
|-----|-------|
| **WHY** | 웹 커넥터 입구의 인증이 URL 평문 PAT다. 로그에 잔존(4차 C13)하고 회전 절차가 없으며, 노출 사고가 실제로 났다(2026-08-10) |
| **WHO** | 형 — 유일 사용자이자 IdP 대시보드 작업의 유일 수행자(F60 선례) / Claude — 서버 RS 구현 |
| **RISK** | ~~RK-65~~·~~RK-67~~·~~RK-68~~(전부 **종료** — 실측·실배포로 해소) · RK-66(매핑 env 오설정 → fail-fast로 방어 유지) · RK-69(병행 기간 중 legacy 노출면 존속, 수용) · RK-74(IdP 2개 분열 — 웹 UI는 여전히 Neon Auth, 이번 커스텀 도메인 확보와는 별개 축이라 방침 그대로 백로그 이월) |
| **SUCCESS** | C52~C57 — OAuth 커넥터로 툴 10종+프롬프트 2종 동작 · 401+`WWW-Authenticate` 실증 · legacy 무회귀 · 분기점 단일 레이어 격리. **C58은 ①A 확정으로 N/A** |
| **SCOPE** | S1~S5 고정. 웹 UI 로그인 경로·PAT 발급 UI·`pdcaw` CLI 인증·툴/프롬프트 내용은 전부 무변경. legacy 제거는 v0.2.1로 이관 |

---

## 1. 개요

### 1.1 목적

`/api/mcp` 엔드포인트의 인증을 OAuth 2.1 위임 방식으로 승격하되, **legacy PAT 경로와 병행 운영**해
무중단 전환의 기반을 만든다. 이번 사이클은 "두 경로가 동시에 산다"까지가 목표고,
"legacy가 죽는다"는 다음 사이클이다.

### 1.2 배경

| 시점 | 사건 | 문서 |
|------|------|------|
| 2차 | 웹 커넥터에 헤더를 넣을 자리가 없어 쿼리파라미터 PAT 폴백 채택. OAuth는 "개인 앱 스코프에 과함"으로 미채택 | 2차 D-03·D-18 |
| 4차 | `?token=` 프로덕션 로그 **잔존 확정**(형 직접 실측 — Search Params에 평문). 완화는 "OAuth 승격 근거 기록만" | 4차 C13 |
| 6·8차 | 승격 근거 누적, 형 보류 유지 | 6차 report §4.1 |
| 10차 | 웹 커넥터가 **prompts까지 지원** 확인 → 워크플로 입구가 웹으로 확정 | 10차 C50 |
| 2026-08-10 | **PAT 평문 노출 사고 실발생**(CC 세션). 용도별 분리 덕에 반경은 CLI용 1개로 한정됐지만, "토큰이 정적이라 폐기·재발급이 수동"이라는 구조적 약점이 드러남 | 백로그 `1909f32e` |
| 2026-08-10 | 형 착수 의사 표명 → 이 사이클 | 백로그 `128404f2` |

백로그 `128404f2`가 착수 시 지시로 남긴 것: **"Plan 실측 1번 = SDK·핸들러의 OAuth 지원 범위 +
claude.ai의 DCR 요구사항 — 지금까지 최대급 사이클임을 Plan에서 사전 고지."**
→ §3.1이 그 실측의 1차분이고, **사전 고지는 여기서 이행한다**: 이 사이클은 인증 경로를 바꾸므로
잘못되면 **모든 MCP 접근이 죽는다.** 그래서 legacy 병행을 스코프에 못 박았고(S4),
비가역 작업(IdP 설정 변경)은 전부 형 승인 후 형이 직접 수행한다(§2.3 Q-4).

### 1.3 관련 문서

- 2차 [backlog-with-mcp](../backlog-with-mcp/backlog-with-mcp.design.md) — D-18 쿼리 폴백의 원 결정
- 4차 [refine-mcp-hardening](../refine-mcp-hardening/refine-mcp-hardening.report.md) — C13 평문 잔존 실측
- 10차 [expand-mcp-prompts](../expand-mcp-prompts/expand-mcp-prompts.report.md) — C50 웹 커넥터 prompts 지원
- [docs/RULE.md](../../../RULE.md) — 문서 규약·사이클 종료 절차

---

## 1.4 이전 사이클 Try 이행 — 이 사이클과 관련된 것만

> **P-1 표 폐지 (형 결정, 2026-08-10)**: 5차부터 관행으로 들어오던 "직전 Try 이행 현황"
> 전수 표를 **이 사이클부터 쓰지 않는다.** 근거: 그 표는 어디에도 규정된 적이 없다 —
> `docs/RULE.md`에도, bkit plan 템플릿에도 없고, **3차(cycle-release-note) report §6.3의
> "개선 제안"**이 5차부터 관행으로 굳은 것이다(규약화는 백로그 `6a8844f4`에 todo로 남아
> 미착수). 사이클 주제와 무관한 항목이 Plan 본문을 차지하는 부작용이 실제로 나타났다.
> **이전 Try·이월 항목의 추적은 서버 백로그가 단일 원천이다**(§2.4 대조표).
>
> **→ 이 사건으로 `docs/RULE.md`에 규약이 신설됐다**(형 작성, 2026-08-10):
> *"이전 PDCA 문서의 형식을 참고하되 규칙으로 명시되지 않은 관행을 사용자의 명시적인 확인 없이
> 무지성으로 반복하면 안 된다."* — P-1 표는 그 규약의 **첫 적용 대상**이자 신설 계기다.
> 3차 report §6.3·§7.1과 analysis에도 폐기 주석을 달아 관행의 근원을 끊었다.

이 사이클 주제와 **실제로 맞물리는** 것만 아래에 남긴다.

| ID | 출처 | 이 사이클에서의 위치 |
|----|------|----------------------|
| **6T-1** | 6차 §6.3-1 / 백로그 `fcc0d14e` | `server/l1-harness.ts` 재사용 채점 — **이번은 인증 계층 자체를 바꾸는 첫 사이클**이라 하네스의 `mintToken`(PAT 발급) 전제가 흔들린다. RK-71에서 "하네스=legacy 무회귀 / 사람 실증=OAuth"라는 분담으로 다루며, **그 분담이 성립하는지가 곧 재채점**이다 |
| **10T-2** | 10차 §6.3-2 / 백로그 `6a8844f4` | "다루는 개체가 현재 몇 개 실재하는가"를 Plan 실측에 넣기 — **§3.1.1 V5**로 이행(초판이 스키마 구조 확인을 개체 수 조회로 착각한 것을 **형 검수 지적 P-2**로 정정) |

> 나머지 이월(10차 프롬프트 실사용 회신 `6497d5ee`, 9차 브라우저 실증 `e671c513`)은
> **이 사이클과 무관**하므로 본문에 싣지 않는다 — 백로그에서 계속 추적된다.

---

## 2. 스코프

### 2.1 In Scope — 5건 고정 (확장 금지)

| ID | 항목 | 산출물 |
|----|------|--------|
| **S1** | ~~IdP 확정 실측~~ → **✅ 완료 (형 실측, 2026-08-10)** — Neon Auth **미지원 확인 → ①A(Clerk) 확정**. 잔여는 **V5(개체 수 SQL)** + **Clerk 기준 V3′·V4′ 재확인**(§3.1.1) | D-99 확정 완료. V5·V3′·V4′는 Design 착수 전 수행 |
| **S2** | **OAuth 검증 미들웨어** — `jose`로 IdP JWKS 검증(iss·aud·exp). `/api/mcp` 한정 적용. legacy PAT 분기와 **한 파일 안에서** 갈라지게 배치(SC-4) | `server/middleware/` 변경 |
| **S3** | **PRM 엔드포인트(RFC 9728)** — `/.well-known/oauth-protected-resource/api/mcp` 노출 + `vercel.json` 라우트 추가 | 라우트 1건 + `vercel.json` |
| **S4** | **401 응답 규약** — 미인증·만료 시 `WWW-Authenticate: Bearer resource_metadata="..."` 헤더 동반 401 | 미들웨어·에러 어댑터 |
| **S5** | **실증** — claude.ai에서 OAuth로 재연결 후 툴 10종 전수 + legacy 경로 무회귀 확인 | Check 단계 기록 |

### 2.2 Out of Scope — 명시적 이관

| 항목 | 이관처 | 사유 |
|------|--------|------|
| **legacy 쿼리·PAT 경로 제거** | **v0.2.1 `oauth-cutover`** | 병행 운영이 이 사이클의 설계 전제. 한 사이클에 경계는 하나만 옮긴다(6차 D-46 원칙) |
| **웹 UI 로그인의 Clerk 통일 + Neon Auth 제거** | **차후 사이클 (백로그 등록)** | **형 결정(2026-08-10, RK-74 대응)** — IdP 2개 분열을 이번엔 수용하되 기술 부채로 명시하고, 별도 사이클에서 웹 UI까지 Clerk로 통일해 분열을 끝낸다. **v0.2.1(legacy PAT 제거)과는 다른 축** — v0.2.1은 "옛 인증 방식 제거", 이건 "IdP 통일" |
| CIMD(Client ID Metadata Document) 전환 | 백로그 신설 | 스펙상 아직 SHOULD 미승격 — 추이 관찰 후 |
| scope 세분화 / 툴별 권한 | 범위 외 | 1인 사용. 현 시점 불필요 |
| **웹 UI 로그인(Neon Auth) 경로 변경** | 손대지 않음 | 이번은 `/api/mcp` 인증만. **①A 확정으로 IdP가 완전히 분리**되므로 웹 UI는 구조적으로 무영향 — C58(무회귀 스모크) 자체가 **N/A**가 됐다 |
| **PAT 발급 UI(`/tokens`)·`pdcaw` CLI 인증** | 무변경 | 둘 다 legacy PAT 경로를 계속 쓴다. `pdcaw`는 외부 패키지라 우리가 못 바꾼다(8차) |
| 툴·프롬프트 내용, UI, DB 스키마 | 무변경 | 인증 계층 전용 사이클 |

### 2.3 Q-1~Q-5 결정 후보 기록 (2026-08-10, `questions.tmp` 회수분)

> **출처 주의 (형 검수 지적 P-1 정정, 2026-08-10)**<br>
> ※ 이 **P-1은 형이 이 Plan을 검수하며 매긴 지적 번호**다. §1.4에서 폐지한 "3차 회고 P-1(Try 이행 표)"과
> 라벨만 같고 무관하다.
>
> 아래 논거는 **이 채팅(Claude)이 `questions.tmp`에 대해
> 낸 답변 원문**이지 형이 직접 쓴 문장이 아니다. 초판(v1.0)이 이를 "형의 논거"로 표기해
> 결정 주체를 오귀속했다 — 형 지적으로 정정. 논거 안의 "내가"는 **Claude**를 가리킨다.
> `questions.tmp`는 삭제됐으므로(DoD) **이 표가 유일한 결정 기록**이다.
>
> **형 승인 완료 (2026-08-10)**: Q-1~Q-5 전건 승인. Q-1은 승인과 동시에
> **형이 직접 Neon Auth 지원 여부를 확인해 "미지원"을 회신** → ①A(Clerk)로 확정됐다.

| Q | 권고 결정 | 논거 (Claude 채팅 권고) | 형 승인 |
|---|-----------|-------------------------|:-------:|
| **Q-1** | **①B 우선 실측 → 실패 시 ①A 폴백** (①C 과설계로 기각) | "내가(=Claude) Clerk를 권했던 이유(`mcp-handler` 궁합)가 소멸했고, M-2가 보여준 핵심은 **sub 일치가 곧 설계 단순성**이라는 것. Neon Auth OIDC가 되면 매핑도, IdP 분열도, Clerk 대시보드 작업도 전부 소멸한다. 실측 1회 비용이 이 셋을 걸고 하는 베팅치고 싸다" | ✅ **승인** + 형 실측으로 **①A 확정** |
| **Q-1 조건①** | **타임박스 필수** | "매니지드 Neon Auth에서 better_auth 플러그인을 못 켤 공산이 크다. 실측은 **문서 확인 + 대시보드 확인 수준으로 제한**하고, 안 되는 게 확인되면 미련 없이 ①A로. 헛도는 실측 방지" | ✅ **승인 — 실제로 그렇게 됐다**(공산이 크다는 예측이 적중) |
| **Q-1 조건②** | **①A 폴백 시 fail-fast** | "부팅 시 검증에 더해, **매핑 env 미설정이면 OAuth 경로 자체를 비활성화**한다. 조용한 빈 화면보다 시끄러운 에러가 낫다" | ✅ **승인 — ①A 확정으로 조건부가 아니라 필수 요건이 됨**(FR-130) |
| **Q-2** | **②A — `jose` 기반 Hono 미들웨어 자작** | "새 의존성 0개 + SC-4 구조 일치 + v0.2.1 컷오버 시 절단면이 깔끔. ②B의 이식 반경 평가도 타당" | ✅ **승인** |
| **Q-3** | **③A — `vercel.json` 라우트 추가 + 배포 후 curl 실증을 DoD에 명문화** | "③B는 사실상 ③A의 하위 단계라 따로 고를 이유가 없다. 폴백안(리다이렉트)은 Design에 한 줄 후보로만" | ✅ **승인** |
| **Q-4** | **①A 폴백 시에만 유효 — 형이 직접 수행**, Q-1 실측 결과 이후 착수 | "F60 선례대로 대시보드 작업은 형이 직접. 비밀값 stdout 미출력 규약 유지. ①B가 성공하면 이 항목은 통째로 소멸" | ✅ **승인 — ①A 확정으로 활성화.** Clerk 대시보드 작업이 실제 할 일이 됨 |
| **Q-5** | **동의 + 검증 절차 동반 조건** | "무회귀 SC는 **검증 절차 없으면 장식**이다. ①B 채택 시 IdP 설정 변경 직후 **웹 로그인 + 워크스페이스 목록 조회 1회**를 스모크로 DoD에 포함" | ✅ **승인 — 단 ①A 확정으로 C58 발동 조건 자체가 소멸**(웹 UI 무영향) |

**→ D-99 (확정, 2026-08-10)**: **①A — Clerk + sub→ownerId 매핑 env + fail-fast.**
근거: 형이 Neon Auth의 OIDC provider 지원 여부를 직접 확인한 결과 **미지원**.
타임박스 규칙(Q-1 조건①)대로 우회 구성 시도 없이 즉시 ①A로 전환했다.

**확정에 따른 파생 변경** (10T-1 grep 전수조사 결과, 20개 지점):

| 파생 | 내용 |
|------|------|
| **C58 → N/A** | 웹 UI(Neon Auth)와 MCP(Clerk)가 **완전히 분리된 IdP**가 되므로 웹 로그인은 구조적으로 무영향. 스모크 자체가 불필요 |
| **D-100b → N/A** | issuer 중복 경로(P-4 예약분)는 "같은 IdP"가 전제였다. Clerk와 Neon Auth는 issuer가 다르므로 **구분이 자동으로 성립** — 다만 그 사실을 Design에서 "왜 안전한가"로 1줄 명시 |
| **FR-129·130 조건 해제** | "①A 폴백 시"가 아니라 **무조건 적용**되는 필수 요건 |
| **RK-65 종료** | 실측 완료 — 헛돌 위험 소멸 |
| **RK-68 완화** | Clerk는 DCR 지원. 다만 **claude.ai가 실제로 붙는지는 미실증**이라 잔존 리스크는 남김 |
| **RK-74 신설** | **IdP 2개 분열이 영구화된다** — ①A의 대가. §5 참조 |
| **V3·V4 → V3′·V4′로 재발행** | Neon Auth 대상 확인은 타임박스로 중단됐다. **Clerk 기준으로 다시 확인해야 한다**(§3.1.1) |

### 2.4 서버 백로그 대조 (MCP `backlog_list` 실측, 2026-08-10)

| ID | 제목 | 이번 사이클 관계 | 처리 |
|----|------|------------------|------|
| `128404f2` | MCP OAuth 2.1 정식 지원 검토 (low) | **이 사이클 그 자체** | 착수 시 `doing`, 종료 시 `done` |
| `1909f32e` | 노출 PAT 폐기·용도별 재발급 (**urgent**) | **선행 조건 아님, 독립** — 다만 OAuth 도입이 이 항목의 근본 완화(토큰 회전·만료로 표준 흡수). 잔여 조치(CLI PAT 폐기·재발급)는 형이 오늘 중 수행 | detail에 "OAuth 승격 착수(11차)로 근본 완화 진행 중" 1줄 |
| `828cf081` | 전역 CLAUDE.md 비밀값 규약 명문화 (medium) | 이번 사이클이 IdP 시크릿을 다루므로 **적용 대상** — 클로드는 JWKS URL·클라이언트 시크릿을 stdout에 평문 출력하지 않는다 | 손대지 않음(규약만 준수) |
| `6497d5ee` | 10T-3 프롬프트 실사용 회신 (**high**) | §1.4.1 회신란으로 이행 중 | 형 회신 후 `resolved` |
| `e671c513` | 9차 E1~E10 브라우저 실증 (**high**) | 순수 릴레이 (①A 확정으로 곁들일 여지도 소멸) | 손대지 않음 |
| 그 외 17건 | UI·문서·리팩터 계열 | 무관 | 손대지 않음 |

> 상태 전환은 형 몫이거나 MCP `backlog_update` 허용 범위 내에서만(6차 D-42 — `todo` 복귀는 형 전용).

---

## 3. 요구사항

### 3.1 필수 실측 결과 (확정 사실 — 추정 없음)

`questions.tmp` 단계에서 코드 대조로 확정한 것들. **초안 전제 2건이 여기서 뒤집혔다.**

| # | 실측 사실 | 근거 | 설계 영향 |
|---|-----------|------|-----------|
| **M-1** | **`mcp-handler` 미설치.** 이 저장소 MCP는 Hono + `@hono/mcp` + 공식 SDK(`McpServer`)를 `/api/mcp`에 직접 마운트한다. `withMcpAuth`는 쓸 수 없다 | `server/mcp/index.ts`, `package.json` (`@hono/mcp@0.3.1`, `@modelcontextprotocol/sdk@1.30.0`) | **초안 §3 뒤집힘** → Q-2 ②A(자작 미들웨어) |
| **M-2** | **`workspaces.owner_id`는 users 테이블 없이 IdP `sub` 문자열을 그대로 담는다.** 현행 JWT 경로는 `payload.sub`를 그대로 `ownerId`로 주입한다. 다른 IdP의 `sub`를 그대로 받으면 **인증은 통과하는데 워크스페이스 0건** | `server/db/schema.ts:23`, `server/middleware/auth.ts` | **초안이 놓친 블로커** → Q-1의 존재 이유. SC-1이 매핑 없이는 구조적으로 불가 |
| **M-3** | `better-auth@1.6.26`이 설치돼 있고 **`oidc-provider`·`mcp` 플러그인을 포함**한다. **그러나 매니지드 Neon Auth에서는 우리가 그 플러그인을 켤 수 없음이 확인됐다**(V1, 형 실측 2026-08-10) | `node_modules/better-auth/dist/plugins/`, `.env.local`의 `NEON_AUTH_BASE_URL` | **①B 기각의 근거.** "패키지에 기능이 있다 ≠ 우리가 쓸 수 있다" — 의존성 트리 관찰만으로 가능성을 판단하면 안 된다는 사례로 남긴다 |
| **M-4** | 현행 `vercel.json`은 `^/api/(.+)$`만 함수로 보내고 나머지는 전부 SPA 폴백. `/.well-known/...`은 **지금 HTML이 응답된다** | `vercel.json` | S3 필수 + RK-67 |
| **M-5** | 현행 인증은 "URL 경로 내 Bearer"가 아니라 **쿼리파라미터 PAT**(`?token=pdcaw_...`). 헤더 Bearer도 병존하며 PAT·JWT 둘 다 받는다. 쿼리 폴백은 **PAT만** 허용(JWT는 거부) | `server/middleware/auth.ts`, 2차 D-18 | 초안 배경 문구 정정. 병행 운영 시 분기 순서 설계에 직결 |
| **M-6** | `authMiddleware`는 `/api/mcp` 전용이 아니라 **전 API 경로에 적용**돼 있다(`.use('/mcp', authMiddleware)` 포함 9개 마운트) | `server/app.ts` | SC-4("단일 레이어 격리")를 지키려면 **`/api/mcp` 전용 미들웨어 분리**가 유력 → §7.2 |
| **M-7** | 현행 401은 `HTTPException`으로 던져지고 `app.onError`가 그대로 통과시킨다. **`WWW-Authenticate` 헤더는 현재 없다** | `server/middleware/auth.ts`, `server/app.ts` | S4는 신규 추가. claude.ai의 OAuth discovery 시작 조건이라 **없으면 커넥터가 OAuth를 시도조차 안 한다** |
| **M-8** | MCP 표면은 **툴 10종 + 프롬프트 2종** — 툴: backlog 4(`list`/`create`/`update`/`reorder`), cycle 2(`list`/`read`), document 3(`list`/`read`/`write`), `project_list`. 프롬프트: `backlog_sync`·`make_cc_prompt`(10차 신설) | `server/mcp/tools.ts`(`registerTool` 10회), `server/mcp/prompts.ts`(`registerPrompt` 2회) | C52 전수 범위 확정. **prompts를 포함하는 이유**: 이 사이클의 착수 근거 자체가 C50(웹 커넥터가 prompts를 지원 → 입구 확정)이므로, 인증 전환 후 prompts가 검증 사각이 되면 근거였던 기능을 안 본 셈이 된다(P-3) |

#### 3.1.1 S1 실측 항목 — 결과 (타임박스 규칙 적용됨)

| ID | 확인할 것 | 결과 |
|----|-----------|------|
| **V1** | Neon Auth 콘솔/문서에 **OIDC provider(인가서버) 활성화 스위치**가 있는가 | ❌ **없음 — 형 실측(2026-08-10, 대시보드 + API 2원 확인)**<br>① Neon 콘솔 대시보드에 **OIDC Provider/DCR 설정 메뉴가 아예 없다**(소셜 로그인 설정만 존재)<br>② `NEON_AUTH_BASE_URL` 기준 `/.well-known/openid-configuration`·`/.well-known/oauth-authorization-server` **2종 모두 HTTP 404**<br>→ `better-auth` 패키지에 `oidc-provider` 플러그인이 있어도(M-3) **매니지드 Neon Auth에서는 켤 수 없음이 확정** |
| **V2** | **DCR(동적 클라이언트 등록)** 지원 여부 | ⏹ **미확인 — 타임박스 규칙대로 중단.** V1이 "없음"이므로 확인할 이유 소멸 (다만 ①의 "DCR 메뉴 없음"이 사실상 같은 답) |
| ~~V3~~ | AS 메타데이터 노출 여부 (Neon Auth 대상) | ❌ **미노출 — V1 ②에서 함께 실측됨**(404). 원래 타임박스로 중단 예정이었으나 형이 V1 확인 과정에서 같은 호출로 확보. → 대상이 바뀌었으므로 **V3′로 재발행** |
| ~~V4~~ | resource indicator(RFC 8707) 지원 (Neon Auth 대상) | ⏹ **미확인 — 중단.** → **V4′로 재발행** |
| **V5** | 현재 실제 신원 **개체 수** (10T-2 이행, 형 검수 지적 P-2 정정분) | 🔴 **SQL 실측 완료(2026-08-10, 형, production 브랜치) — 형 진술과 달리 2개였다.** `SELECT DISTINCT owner_id FROM workspaces` → `287b080d-...`(워크스페이스 Hobby·Hippo T&C, 2026-08-07 생성 — **형의 실제 계정**) / `d9109910-...`(워크스페이스 cogmo, 2026-08-07 생성 — **7차 refine-cycle-closing에서 이미 "작성자 오귀속"으로 잡아냈던 그 cogmo 계정**, 회사계정 혼입으로 추정). **10T-2가 정확히 노린 실패를 스스로 재현함** — "1개"는 형 본인의 진술조차 실측 없인 신뢰도가 부족했다는 사례. `MCP_OAUTH_OWNER_ID = 287b080d-5f7d-434c-9e08-9d72d4ccb03a` 확정(형의 실계정). `d9109910-...`은 **이 사이클 스코프 밖 — 손대지 않는다.** cogmo 계정은 이 변경 후에도 legacy 경로로 계속 동작(OAuth 매핑은 형 계정 하나만 가리키므로 cogmo 접근권엔 영향 없음) |

> **타임박스 규칙(§2.3 Q-1 조건①, ✅ 승인)이 실제로 작동했다** — V1이 "없음"으로 나온 시점에
> 우회 구성 시도 없이 즉시 ①A로 전환하고 V2~V4를 확인하지 않았다. 리스크 RK-65가 예측한
> "헛도는 실측"을 절차가 막은 사례.

#### 3.1.2 S1 잔여 실측 — Clerk 기준 재발행분 (Design 착수 전 수행)

V3·V4는 **Neon Auth를 대상으로 한 질문**이었다. IdP가 Clerk로 바뀌었으므로 **같은 질문을
Clerk에 다시 물어야 한다** — 이걸 안 하면 D-102(`aud` 검증)·D-103(PRM `authorization_servers`)이
근거 없이 확정된다.

| ID | 확인할 것 | 결과 / 왜 필요한가 |
|----|-----------|--------------------|
| **V2′** | Clerk의 **OAuth 인가서버 + DCR** 지원 | 🔴 **재확인 필요 — 대시보드와 실제 메타데이터가 어긋난다.**<br>형 대시보드 실측(2026-08-10): `Configure → OAuth Applications`에 인가서버·클라이언트 생성 기능 + CIMD 탭 존재, "DCR은 discovery `registration_endpoint`로 기본 노출".<br>**그러나 Claude가 실제 문서를 `curl`로 확인한 결과(2026-08-10) `registration_endpoint`가 두 discovery 문서 어디에도 없다** — `/.well-known/oauth-authorization-server`·`/.well-known/openid-configuration` 모두 200이지만 해당 키 부재.<br>**단 `POST /oauth/register`는 404가 아니라 422**(빈 body 거부) → **라우트는 실재하되 광고되지 않는 상태**로 보인다. → §3.1.5 |
| **V3′** | Clerk의 AS 메타데이터 URL과 **issuer 실값** | ✅ **완료 — Claude 실측(2026-08-10, `curl`)**<br>`issuer`: `https://touching-werewolf-34.clerk.accounts.dev`<br>`jwks_uri`: `<issuer>/.well-known/jwks.json` (RS256, 서명키 1개)<br>`authorization_endpoint`·`token_endpoint`·`revocation_endpoint`·`introspection_endpoint`·`userinfo_endpoint` 전부 노출.<br>`grant_types`: `authorization_code`·`refresh_token` / `code_challenge_methods`: **S256** / `token_endpoint_auth_methods`: `client_secret_basic`·`client_secret_post`·**`none`**(= public client + PKCE 가능) → **claude.ai가 요구하는 조합을 충족**<br>→ **D-103 확정 근거 확보** |
| **V4′** | Clerk의 **resource indicator(RFC 8707)** 지원 여부 | 🔵 **메타데이터로는 판정 불가** — AS 메타데이터에 RFC 8707 지원을 광고하는 **표준 필드 자체가 없다**(스펙에 정의돼 있지 않음). `claims_supported`에 `aud`가 있지만 이는 모든 JWT의 기본 클레임이라 **근거가 못 된다.**<br>→ **실제 토큰을 받아 `aud` 값을 확인해야 판정된다**(Do 단계). Clerk 문서 링크: `service_documentation` = `https://clerk.com/docs/oauth/scoped-access` |
| **V7** | **access token이 JWT로 발급되는가** (설계 성립의 전제) | ✅ **확보 — 형이 대시보드 `Generate access tokens as JWTs`를 ON**(2026-08-10). **이게 켜져야 이 사이클의 설계가 성립한다** — Clerk OAuth access token이 opaque라면 JWKS 검증(FR-128·Q-2 ②A)이 **원리적으로 불가능**하고 `introspection_endpoint` 호출 방식으로 설계를 갈아엎어야 했다(네트워크 왕복 추가 + Clerk secret 필요 → "새 의존성 0개"도 깨짐). **Plan이 이 전제를 명시적으로 확인하지 않은 채 FR-128을 썼던 것**이 뒤늦게 드러난 셈이라, 사실로 못 박아 둔다 |
| **V6** | Clerk 토큰의 `sub` 실값 형식 (FR-129 매핑 env의 좌변) | ⏳ **미확인 — 구조적으로 지금 불가**. Clerk `sub`는 **해당 인스턴스에 유저가 생겨야** 존재한다. 인스턴스만 만든 상태에선 값이 없다 → **Do 단계에서 첫 OAuth 플로우를 태운 뒤 확보**. 그때까지 FR-130(fail-fast)이 "설정 안 됨"을 명확히 드러낸다 |
| **V5** | (위 §3.1.1과 동일 — 여전히 미수행, 무조건 수행) | ①A의 "env 1쌍" 성립 근거. **⚠️ 프로덕션 DB 기준이어야 함**(§3.1.3) |

> **CIMD 메모**: V2′에서 Clerk의 CIMD 탭 존재가 확인됐다. CIMD 전환은 §2.2에서 백로그로 이관한
> 항목인데(스펙 SHOULD 미승격), **IdP 쪽 준비는 이미 돼 있다**는 사실만 기록해 둔다 — 이번 사이클
> 스코프는 그대로 유지한다.

#### 3.1.5 🔴 DCR 광고 부재 — 이 사이클 최대 미결 (2026-08-10)

**왜 치명적인가**: claude.ai는 PRM → AS 메타데이터를 읽고 **`registration_endpoint`가 있어야**
동적 클라이언트 등록을 시도한다. 광고가 없으면 클라이언트는 **DCR을 시도조차 하지 않고**,
커넥터 등록 자체가 실패한다 — 즉 **RK-68이 완화된 게 아니라 그대로 살아있다.**

| 관측 | 값 |
|------|-----|
| `GET /.well-known/oauth-authorization-server` | 200 — 키 목록에 `registration_endpoint` **없음** |
| `GET /.well-known/openid-configuration` | 200 — 역시 **없음**(`userinfo_endpoint`는 있음) |
| `POST /oauth/register` | **422** (404 아님) → **라우트 실재, 빈 body 거부로 해석** |
| `POST /oauth/clients` | 404 |

**해석(가설, v1.5 시점)**: 인스턴스 설정에서 DCR이 꺼져 있어 광고되지 않는 상태로 추정 →
**형이 토글을 켠 뒤 재실측으로 반증됨(아래).**

##### 재실측 결과 — DCR 광고 미지원 **확정** (2026-08-10, v1.6)

형이 Clerk 대시보드에서 **Dynamic client registration** + **Generate access tokens as JWTs**를
모두 ON으로 전환한 뒤 다시 받아봤다.

| 확인 | 결과 |
|------|------|
| 토글 ON 후 `/.well-known/oauth-authorization-server` | 200 — **`registration_endpoint` 여전히 없음**. 키 집합이 토글 전과 **완전히 동일**(추가 0·삭제 0) |
| 응답 캐시 여부 | **캐시 아님** — `cf-cache-status: DYNAMIC`. 캐시버스터 + `cache-control: no-cache`로 재요청해도 동일 |

→ **결론: Clerk는 DCR을 활성화해도 `registration_endpoint`를 메타데이터에 광고하지 않는다.**
가설(설정 문제)은 기각. RFC 8414에서 이 필드가 선택 사항이라 스펙 위반은 아니지만,
**클라이언트가 DCR을 자동 발견할 경로가 없다**는 실질은 그대로다.

**형 결정(2026-08-10)**: *"메타데이터 광고 유무와 관계없이, 발급해둔 OAuth Application
(Client ID/Secret) 수동 클라이언트 경로를 활용하거나 기존 설계대로 Design 단계 진행."*
→ **D-107은 (a) 기각, (b) 수동 클라이언트를 1순위로 두고 (c) CIMD를 예비로 남긴 채 진행.**

**Design 진행에 지장이 없는 이유**: DCR은 **claude.ai ↔ Clerk 사이의 문제**이고, 우리 서버가
맡은 RS 역할(PRM 노출 · JWKS 검증 · 401 헤더)은 **DCR 성사 여부와 무관하게 동일**하다.
영향은 **C52(커넥터 실동작)** 한 곳에 국한되며, 그 판정은 원래도 Do 단계 실증 사항이었다.

#### 3.1.3 V5 보류분 — 다중 사용자 시점의 재확인 쿼리

V5는 형 진술로 갈음했으나(§3.1.1), **다중 사용자로 갈 때는 반드시 실측이 필요**하다.
그때 쓸 쿼리와 주의사항을 여기 보존한다.

```sql
-- Neon 콘솔 SQL Editor에서 반드시 production 브랜치를 선택하고 실행할 것
SELECT 'workspaces' AS src, count(DISTINCT owner_id) AS distinct_owners, count(*) AS rows FROM workspaces
UNION ALL
SELECT 'api_tokens', count(DISTINCT owner_id), count(*) FROM api_tokens;
```

> **⚠️ dev/prod 함정**: `.env.local`의 `DATABASE_URL`은 **Neon dev 브랜치**를 가리킨다
> (`ep-steep-unit-...`, 1차 Design §8.3). 로컬에서 무심코 돌리면 dev 데이터를 프로덕션 사실로
> 착각한다. 대상 브랜치를 **결과와 함께** 기록할 것.
>
> **`api_tokens`를 같이 세는 이유**: 워크스페이스를 안 만든 채 PAT만 발급한 신원이 있으면
> `workspaces`만으론 안 잡힌다.

#### 3.1.4 다중 사용자 대비 — 지금 안 하는 이유 (형 결정, 2026-08-10)

**정정**: 초안 논의에서 Claude가 "가입 플로우가 없다"고 말했으나 **사실이 아니다** —
**Neon Auth는 다중 사용자 회원가입을 지원**한다(형 지적). 즉 지금도 누군가 가입하면
`owner_id`가 2개 이상이 될 수 있고, 그 사용자는 자기 워크스페이스를 갖되 **MCP는 못 쓴다**
(OAuth 매핑 env가 형 계정 1개만 가리키므로).

그럼에도 **이번 사이클에서 ①C(매핑 테이블)를 만들지 않는다** — 형 결정:

| 논거 | 내용 |
|------|------|
| ① 매핑 테이블만으론 안 끝난다 | 다중 사용자로 가려면 워크스페이스 소유권·초대·권한 모델이 함께 필요하다. 지금 만든 매핑 테이블은 그 사이클에서 **어차피 재설계된다** |
| ② 매핑 자체가 소멸 예정 | RK-74 종료 계획(웹 UI까지 Clerk 통일 + Neon Auth 제거)이 실행되면 IdP가 하나가 되고, `owner_id`를 Clerk `sub`로 정렬하면 매핑 env는 사라진다. **다중 사용자 대비의 정답은 매핑 테이블이 아니라 IdP 통일**이고 그건 이미 §2.2로 이관됐다 |
| ③ 대신 비용 0짜리 준비 | **D-106** — 매핑을 `resolveOwnerId(sub)` 단일 함수로 격리해 나중에 테이블 조회로 **함수 본문만 갈아끼우면** 되게 한다. C56(단일 파일 격리)이 이미 요구하는 형태라 추가 비용이 없다 |

### 3.2 기능 요구사항

| ID | 요구사항 | 스코프 | 우선순위 |
|----|----------|--------|:--------:|
| FR-127 | ~~S1 실측 V1~V5~~ → **V1 완료(D-99 확정).** 잔여 **V5·V3′·V4′·V6**을 수행해 표로 기록한다(§3.1.1·§3.1.2) | S1 | High |
| FR-128 | `/api/mcp` 요청의 `Authorization: Bearer <jwt>`를 **Clerk JWKS**로 검증한다(iss·exp 필수, aud는 **V4′** 결과에 따름) | S2 | High |
| FR-129 | 검증 성공 시 `ownerId`를 주입한다 — **Clerk `sub` → 현행 `ownerId` 매핑 env를 경유**(조건부 아님, ①A 확정) | S2 | High |
| FR-130 | **매핑 env 미설정이면 OAuth 경로를 비활성화**하고 기동 시점에 명시적으로 실패한다(fail-fast, Q-1 조건② ✅승인 — **①A 확정으로 필수 요건**) | S2 | High |
| FR-131 | legacy 경로(헤더 PAT·쿼리 PAT·Neon Auth JWT)는 **동작을 유지**한다 | S2 | High |
| FR-132 | OAuth 검증을 **`server/middleware/mcp-auth.ts` 단일 신설 파일**에 격리하고, 기존 `auth.ts`는 손대지 않는다(`app.ts`의 `/mcp` 마운트 1줄만 교체). **v0.2.1 컷오버 = 이 파일 삭제 + 마운트 원복**(형 지정 정량 기준, C56) | S2 | High |
| FR-133 | `/.well-known/oauth-protected-resource/api/mcp`가 RFC 9728 형식 JSON(`resource`, `authorization_servers`)을 반환한다 | S3 | High |
| FR-134 | `vercel.json`에 `/.well-known/` 라우트를 추가해 SPA 폴백보다 먼저 함수로 보낸다 | S3 | High |
| FR-135 | 미인증·만료 시 401 + `WWW-Authenticate: Bearer resource_metadata="<PRM URL>"` | S4 | High |
| FR-136 | claude.ai에서 OAuth 커넥터로 재연결 후 **툴 10종 + 프롬프트 2종 전수**가 노출·동작한다 | S5 | High |
| FR-137 | 재연결 후에도 Claude Code 등 legacy 연결이 **무영향**임을 실증한다 | S5 | High |

### 3.3 비기능 요구사항

| ID | 요구사항 | 판정 |
|----|----------|------|
| NFR-1 | 새 npm 의존성 **0개** (`jose` 재사용) | `package.json` diff |
| NFR-2 | DB 마이그레이션 **0건** (①C 기각의 귀결) | `drizzle/` diff |
| NFR-3 | 비밀값(JWKS URL·클라이언트 시크릿)을 stdout에 평문 출력하지 않는다 | 백로그 `828cf081` 규약 |
| NFR-4 | `tsc -b` · `oxlint` · `npm test` 무회귀 | 명령 결과 |

---

## 4. Success Criteria

| ID | 기준 | 검증 수단 | 상태 |
|----|------|-----------|:----:|
| **C52** | OAuth로 연결된 claude.ai 커넥터에서 **툴 10종 + 프롬프트 2종 전수** 정상 동작(M-8 목록). 프롬프트는 목록 노출 + 실행 1회씩 | 형이 웹 커넥터에서 직접 호출 | ✅ **Met (2026-08-10)** — 형이 실제 툴 호출·프롬프트 확인 완료 |
| **C53** | 무효·만료 토큰 요청 시 **401 + `WWW-Authenticate`(PRM URL 포함)** | `curl -i` (배포본) | ✅ **Met** — 커스텀 도메인·vercel.app 양쪽 다 확인(`resource_metadata` URL 정확) |
| **C54** | PRM 엔드포인트가 **프로덕션 루트 경로에서** RFC 9728 JSON을 반환 | `curl` (배포본, RK-67 방어) | ✅ **Met** — `basePath` 밖 마운트(D-99b)로 최종 해결. 커스텀 도메인에서도 `resource`·`authorization_servers` 정확 |
| **C55** | legacy 경로(쿼리 PAT·헤더 PAT) **동시 정상 동작** — Claude Code 연결 무영향 | 형 실사용 + L1 하네스 | ✅ **Met** — L1 45건 통과 + 배포본 curl 무회귀(양 도메인) |
| **C56** | OAuth 미들웨어가 **`server/middleware/mcp-auth.ts` 단일 파일로 신설 격리**되어, **v0.2.1에서 그 파일 1개 삭제만으로 컷오버가 완결**된다 | **`git status`/`git diff`로 정량 확인** | ✅ **Met** — `auth.ts`는 `unauthorized` export 1줄뿐(§C56 재확인 로그). `mcp-auth.ts`가 OAuth 로직 전량 소유 |
| **C57** | S1 실측 결과가 **사실로 기록**되고 D-99가 확정 + **잔여 V5·V3′·V4′·V6도 기록** | §3.1.1·§3.1.2 표 | ✅ **Met** — V1·V3′·V5·D-99 전부 실측 완료. V4′(aud)는 D-109에 따라 의도적 생략(h5 선택 과제로 이월) |
| ~~**C58**~~ | ~~*(①B 채택 시에만)* 웹 UI 로그인 무회귀~~ | — | ⛔ **N/A — ①A 확정으로 발동 조건 소멸**(IdP 완전 분리, §2.3 파생표) |

> **판정 원칙(9차 선례 계승)**: 브라우저·커넥터 실증이 필요한 항목은 **실제로 수행하지 않으면 Met으로 치지 않는다.**
> 정적 검증만으로 통과시키지 않는다.

### 4.1 Definition of Done

- [x] S1 실측 **V1**(형) + **D-99 확정**(①A Clerk) + **10T-1 grep 전수조사**(20지점 갱신) — 2026-08-10
- [x] **V5 실측 완료**(형, production SQL) — 잔여 V3′·V4′·V6은 진행 중
- [x] **V5 결과로 10T-2 🔄→✅ 전환**(P-2). **결과 2개 → DoD 지시대로 ①C 재검토를 형에게 즉시 보고함(아래).** 판단: 둘째 신원(cogmo)은 정당한 다중 사용자 유스케이스가 아니라 7차가 이미 식별한 이월 이슈(회사계정 혼입 추정)의 재현이라, ①C(매핑 테이블) 채택 사유가 아니다 — §3.1.4 방침(env 1쌍 + `resolveOwnerId` 단일 함수) 유지. `d9109910-...` 정리는 이 사이클 스코프 밖, 별도 백로그 후보로만 남김
- [x] **Clerk 인스턴스 생성 + JWKS/issuer 확보** (형이 직접). **DCR은 별도 활성화 조작 불필요로 판명** — 커스텀 도메인 Account Portal이 살아나며 자동으로 광고됨(D-107 경로 소멸, RK-68 최종 해소)
- [x] OAuth 검증 미들웨어 구현 (FR-128~132) — `server/middleware/mcp-auth.ts`
- [x] 매핑 env fail-fast 동작 확인 (FR-130) — L1 a5로 실 dev DB 검증(500 + 빠진 변수명)
- [x] PRM 엔드포인트 + `vercel.json` 라우트 (FR-133·134) — 1차 basePath 버그(D-99b) 실측·수정 후 확정
- [x] **배포 후 `curl`로 PRM 실경로 확인** — vercel.app·커스텀 도메인 양쪽 확인
- [x] 401 + `WWW-Authenticate` 실증 (`curl -i`) — 양 도메인 확인
- [x] claude.ai 커넥터 OAuth 재연결 + **툴 10종 + 프롬프트 2종** 전수 호출(P-3) — **형 실사용 성공(2026-08-10)**, DCR로 Client ID/Secret 입력 없이 URL만으로 연결
- [x] legacy 무회귀 — `curl`로 헤더 PAT·쿼리 PAT 401 형식 확인(양 도메인) + L1 45건. **`pdcaw` CLI 실사용 확인은 미실행**(형 재량, 낮은 우선순위 — legacy 코드 경로 자체가 무변경이라 위험 낮음)
- [x] ~~*(①B 시)* 웹 로그인 스모크~~ — **N/A**(①A 확정, C58 소멸)
- [x] `tsc -b` · `oxlint` · `npm test` 무회귀 — 매 커밋 직전 확인, 최종 61건 통과
- [x] `questions.tmp` 삭제 (RULE.md — 답 반영 후 삭제. 2026-08-10 완료, 내용은 §2.3·§3.1로 흡수)
- [ ] **h5 — 실토큰 `aud` 값 확인·기록** (D-109, 선택 과제) — 형이 원하면 로컬에서 토큰 payload만 디코드해 값 공유(전체 토큰은 비밀값이라 채팅에 붙여넣지 않음)
- [ ] `d9109910-...`(cogmo) 계정 정리 여부 — 스코프 밖, 백로그 등록 필요

---

## 5. 리스크와 완화

| ID | 리스크 | 확률 | 영향 | 완화 |
|----|--------|:----:|:----:|------|
| ~~**RK-65**~~ | ~~①B 실측이 헛돈다~~ | — | — | ✅ **종료(2026-08-10)** — 타임박스 규칙이 실제로 작동해 V1 실패 시점에 중단. **예측(High)이 적중했고 완화책도 작동한** 드문 사례 |
| **RK-66** | 매핑 env 오설정이 **조용한 빈 화면**으로 나타나 원인 추적이 어렵다 | Medium | Medium | **fail-fast**(§2.3 Q-1 조건② ✅승인, FR-130) — env 미설정이면 OAuth 경로 자체를 비활성. 부팅 시점 검증. **①A 확정으로 이 리스크는 조건부가 아니라 현실화 확정** |
| **RK-67** | `/.well-known/`이 SPA 폴백에 먹혀 PRM이 HTML을 반환 → 커넥터가 discovery 실패 | **High** | **High** | 1차에서 Vercel 라우팅 버그 6건을 밟은 자리(M-4). **배포 후 `curl` 실증을 DoD에 명문화**(Q-3). 폴백안(리다이렉트)은 Design에 후보로 |
| **RK-68** | claude.ai가 **DCR로 클라이언트를 자동 등록하지 못해** 커넥터 등록이 막힌다 | — | — | ✅ **최종 해소(2026-08-10) — 예상 밖의 경로로.** vercel.app 도메인에선 `POST /oauth/register`가 `invalid_client_metadata`("Account Portal이 vercel.app 도메인에서 미지원")로 실패해 수동 클라이언트(D-107 (b))로 진행하던 중, **형이 커스텀 도메인을 구매**해 Vercel+Clerk 양쪽에 연결. `clerk.<커스텀도메인>` 직결로 전환하니 Account Portal이 정상 활성화되고 **DCR이 실제로 성공**(`POST /oauth/register` → 201, 실제 client_id 발급 확인). 최종적으로 claude.ai가 **Client ID/Secret 없이 URL만으로** 커넥터를 등록·연결·툴 호출까지 전부 성공(C52). D-107은 결과적으로 미사용 — 기록은 남기되 실제 채택 경로는 아니게 됨 |
| **RK-75** | *(잠재적이었으나 해소)* Clerk access token이 **opaque**면 JWKS 검증이 원리적으로 불가 → introspection 방식으로 설계 전면 교체 | — | **Critical(였음)** | ✅ **해소 — V7**(형이 `Generate access tokens as JWTs` ON). **Plan v1.0~v1.5가 이 전제를 확인하지 않은 채 FR-128을 쓰고 있었다**는 게 뒤늦게 드러난 자리라, 사실로 기록해 둔다(§3.1.2 V7) |
| **RK-69** | 병행 기간 중 legacy 노출면(쿼리 PAT 평문)이 존속 | High | Medium | **수용** — v0.2.1 조기 착수로 기간 최소화. 그 사이 용도별 PAT 분리(이미 적용)로 반경 한정 |
| **RK-70** | 인증 계층 변경이라 잘못되면 **MCP 전 경로가 죽는다** | Low | **Critical** | legacy 병행이 곧 안전망(S2 FR-131). 배포 직후 legacy 경로부터 확인(C55)하고 OAuth를 나중에 검증 |
| **RK-71** | L1 하네스가 PAT 발급(`mintToken`) 전제라 OAuth 경로를 하네스로 못 덮는다 | High | Low | **수용 + 명시** — OAuth 경로는 사람 실증(C52·C53)이 판정축. 하네스는 **legacy 무회귀**(C55) 담당. 6T-1 재채점은 이 분담이 성립하는지로 본다 |
| **RK-72** | Clerk 무료 티어 정책 변경 (①A 채택 시) | Low | Low | **수용** — MAU 1. 실질 영향 없음 |
| **RK-73** | IdP 장애 시 신규 연결·토큰 갱신 불가 | Low | Medium | **수용**(형 초안 R-1) — 업무보조 도구 특성상 accepted risk. 별도 우회 경로를 설계하지 않는다. 병행 기간엔 legacy가 사실상의 우회로 |
| **RK-74** | **IdP 2개 분열이 영구화된다** — 웹 UI는 Neon Auth, MCP는 Clerk. ①A 확정의 대가로, `sub` 매핑 env가 **v0.2.1 컷오버 이후에도 남는다**(legacy 제거로는 안 없어짐). 신원 진실이 두 곳에 존재하는 상태 | **확정(발생함)** | Medium | ✅ **형 결정(2026-08-10) — 이번 사이클에서는 수용(Accepted).** 단 **기술 부채로 백로그 등록**하고, **차후 사이클에서 웹 UI 로그인까지 Clerk로 완전 통일해 Neon Auth를 제거하는 컷오버**를 진행한다. 즉 분열은 "영구"가 아니라 **명시적 종료 계획이 있는 한시 상태**다. 완화: 매핑 env를 단일 지점에 두고 "왜 2개인가 + 언제 없어지는가"를 주석으로 남긴다 |

---

## 6. 영향 분석

### 6.1 변경 대상 자원

| 자원 | 변경 | 비고 |
|------|------|------|
| `server/middleware/auth.ts` | **수정 또는 분리** | SC-4 격리 요건상 `/api/mcp` 전용 미들웨어 분리가 유력(§7.2) |
| `server/app.ts` | 라우트 마운트 1~2줄 | `.use('/mcp', ...)` 교체 + `/.well-known/` 마운트 |
| `server/routes/` | **신규 1건** | PRM 엔드포인트 |
| `vercel.json` | 라우트 1줄 추가 | RK-67 대응 |
| `.env.local` + Vercel 환경변수 | 값 추가 | **형 수행**(비밀값 규약) |
| `drizzle/` | **변경 0건** | NFR-2 |
| `src/` (프론트) | **변경 0건** | 웹 UI 무변경(§2.2) |
| `server/mcp/tools.ts`·`prompts.ts` | **변경 0건** | 툴·프롬프트 내용 무변경 |

### 6.2 현행 소비자 전수

`/api/mcp`와 인증 미들웨어의 소비자를 빠짐없이 세운다 — **하나라도 놓치면 그게 곧 RK-70이다.**

| 소비자 | 현행 인증 | 이번 사이클 후 |
|--------|-----------|----------------|
| claude.ai 웹 커넥터 | 쿼리 PAT (`?token=`) | **OAuth로 전환**(형이 재연결) |
| Claude Code (이 세션 포함) | 쿼리 PAT 또는 헤더 PAT | **legacy 유지 — 무영향**(C55) |
| `pdcaw` CLI (`PDCAW_PAT`) | 헤더 PAT | **legacy 유지 — 무영향**. 외부 패키지라 우리가 못 바꿈 |
| 웹 UI 브라우저 세션 | Neon Auth JWT (헤더) | **무변경 — 구조적으로 무영향**(①A 확정으로 IdP 완전 분리, C58 N/A) |
| L1 하네스 (`server/*.l1.ts`) | `mintToken`으로 PAT 직접 발급 | **legacy 경로로 계속 동작**(RK-71) |

### 6.3 검증 — 실행 환경 존재 확인 (8T-P4)

| 검증 대상 | 환경 존재? | 방법 |
|-----------|:----------:|------|
| legacy 무회귀 (C55) | ✅ | `npm run test:l1` (실 dev DB 하네스, 기존 자산) |
| OAuth 토큰 검증 (C52) | ⚠️ **부분** | 하네스로 OAuth 토큰을 못 만든다(RK-71) → **사람 실증이 판정축**. 형이 웹 커넥터로 |
| PRM 경로 (C54) | ✅ | 배포본 `curl` — dev 서버는 Vercel 라우팅을 재현 못 하므로 **프로덕션 확인 필수** |
| 401 헤더 (C53) | ✅ | `curl -i` (토큰 없이 / 조작 토큰) |
| ~~웹 로그인 무회귀 (C58)~~ | ⛔ | **N/A** — ①A 확정으로 검증 대상 자체가 소멸 |

> **주의**: C54는 `vercel.json` 라우팅이 판정 대상이라 **로컬 dev 서버로는 검증되지 않는다.**
> 1차에서 "로컬 테스트로는 안 잡히는 배포 버그 6건"을 밟은 것과 정확히 같은 축이다.

---

## 7. 아키텍처 고려사항

### 7.1 프로젝트 레벨

Dynamic. 1인 사용, Vercel 서버리스 + Neon Postgres. 변경 반경은 서버 인증 계층 한 겹.

### 7.2 주요 결정 (Design에서 확정할 항목)

| ID | 항목 | 후보 | 비고 |
|----|------|------|------|
| **D-99** | **IdP** | ~~①B Neon Auth 자체 OIDC~~ / **①A Clerk + 매핑 env** | ✅ **확정(2026-08-10)** — 형 실측으로 Neon Auth OIDC 미지원(V1). §2.3 |
| **D-100** | 미들웨어 배치 | ~~(a) 기존 `authMiddleware`에 분기 추가~~ / **(b) `server/middleware/mcp-auth.ts` 신설** | ✅ **확정(2026-08-10, 형이 C56 정량 기준으로 지정)** — M-6대로 기존 미들웨어는 9개 경로가 공유하므로 OAuth를 섞으면 격리가 깨진다. **파일명까지 고정**해 "삭제 1개 = 컷오버"가 성립하게 한다 |
| ~~**D-100b**~~ | ~~①B 채택 시 issuer 중복 경로 처리~~ (P-4 예약분) | ⛔ **N/A — ①A 확정으로 전제 소멸.** Clerk와 Neon Auth는 **issuer가 다르므로** 두 검증 경로가 자동 구분된다. **단 Design에 "왜 안전한가"를 1줄 명시** — 문서화 안 하면 v0.2.1 컷오버 때 같은 질문이 재발한다 | *(아래는 v1.1 원문 보존)* ①B면 OAuth 토큰 발급자도 Neon Auth라 **같은 issuer를 보는 검증 경로가 2개**가 된다(M-5 — 현행 미들웨어에 이미 Neon Auth JWKS 검증이 있음). 구분 규칙을 안 정하면 "웹 세션 JWT로 MCP가 뚫리는가 / OAuth 토큰으로 웹 API가 뚫리는가"가 모호해지고, 그 모호성이 곧 **RK-70(인증 계층 오작동으로 전 경로 사망)의 각**이다. (b)가 스펙 정합(RFC 8707)이지만 **V4 결과에 종속** — `aud`를 못 좁히면 (b)가 불가하므로 Design에서 V4 결과와 함께 확정 |
| D-101 | 분기 순서 | Bearer JWT를 먼저 볼 것인가, PAT를 먼저 볼 것인가 | M-5 — PAT는 접두어(`pdcaw_`)로 구분되므로 접두어 판정이 먼저인 현행 형태를 유지하는 게 자연스럽다 |
| D-102 | `aud` 검증 | 검증함 / 안 함 | **V4′**(Clerk의 resource indicator 지원) 결과에 종속 — Neon Auth 대상 V4는 미확인 중단됐으므로 **Clerk 기준으로 다시 물어야 한다**(§3.1.2). 스펙은 MUST지만 IdP가 못 주면 못 한다 — **못 하면 그 사실을 리스크로 기록** |
| **D-103** | PRM `authorization_servers` 값 | ~~`["https://touching-werewolf-34.clerk.accounts.dev"]`~~ → **`["https://clerk.pdca-workspace.spiritflag.work"]`(최종)** | ✅ **확정, 값 갱신(Check Gap M-5)** — V3′는 dev 인스턴스 측정값이었다(당시엔 정확). D-111(커스텀 도메인)로 최종값이 바뀌었는데 이 행만 갱신이 누락돼 Design §3·§4.1과 다른 값을 가리키고 있었다. PRM의 `resource`는 `https://pdca-workspace.vercel.app/api/mcp`(또는 커스텀 도메인 동일 경로) |
| **D-107** | **DCR 광고 부재 대응** (§3.1.5) | ~~(a) 대시보드 토글~~ 기각 / ~~(b) 수동 클라이언트~~ **채택 안 함(결국 불필요)** / (c) CIMD — 여전히 미사용 | ⛔ **경로 자체가 소멸(2026-08-10)** — 커스텀 도메인 확보로 Account Portal이 살아나 **DCR이 그냥 됐다.** (a)는 "vercel.app 도메인 한정 미지원"이었지 Clerk 자체의 영구 제약이 아니었던 것으로 최종 확인. 수동 클라이언트용으로 준비했던 redirect_uri 등록 등은 실사용되지 않음(무해, 남겨둬도 됨) |
| **D-111** | **커스텀 도메인 채택** (`clerk.pdca-workspace.spiritflag.work` 등, Cloudflare DNS) | (a) vercel.app 유지 + 수동 클라이언트 / **(b) 커스텀 도메인 구매 + Account Portal 활성화** | ✅ **형 결정·실행(2026-08-10)** — Plan에는 없던 스코프였으나, DCR을 정공법으로 살리기 위해 형이 진행 중에 즉석 결정. 부수 효과: `server/routes/clerk-proxy.ts`(§2.5 Design D-110)와 `CLERK_SECRET_KEY`가 **다시 불필요해져 제거**(D-110 자체가 이 결정으로 무효화·롤백됨) |
| D-104 | `/.well-known/` 라우팅 | `vercel.json` 라우트(③A 확정) / 리다이렉트 폴백 | ③A 확정, 폴백은 후보 1줄로만 |
| D-105 | fail-fast 지점 | 모듈 로드 시 / 첫 요청 시 | 서버리스라 콜드스타트마다 재평가됨을 고려 |
| **D-106** | **매핑 격리 형태** (§3.1.4 ③) | `resolveOwnerId(sub)` 단일 함수 | ✅ **방침 확정(형 결정)** — 매핑 로직을 코드 여러 곳에 흩지 않고 한 함수에 둔다. 다중 사용자가 오면 **함수 본문만 테이블 조회로 교체**. `mcp-auth.ts` 주석에 3줄 남길 것: ①왜 IdP가 2개인가 ②언제 없어지는가(RK-74 백로그) ③다중 사용자 시 여기가 바뀐다 |

---

## 8. 규약 전제

- **문서**: `docs/PDCA/2026-08/adopt-oauth-clerk/` 고정, 한국어, `plan`→`design`→`analysis`→`report` 4종만(RULE.md)
- **질문**: `.tmp` 파일로 — 이번 사이클은 `questions.tmp` 사용 후 삭제 예정(DoD)
- **커밋**: PDCA 문서는 사이클 종료 전 커밋하지 않음. 코드는 평소대로
- **비밀값**: IdP 시크릿·JWKS URL을 stdout에 평문 출력하지 않음(백로그 `828cf081`)
- **비가역 작업**: IdP 대시보드 설정·Vercel 환경변수 변경은 **형 승인 후 형이 직접**(F60 선례)
- **번호 규약**: 이 사이클은 D-99~, RK-65~, C52~, FR-127~ 를 쓴다(전역 누적 연속)
- **실측 ID 규약**: `V<n>`은 Neon Auth 대상 원발행분, `V<n>′`은 **IdP 변경 후 Clerk 기준 재발행분**.
  같은 번호를 재사용하지 않는 이유는 "무엇을 대상으로 물었는가"가 결과 해석에 직결되기 때문이다
- **관행 반복 금지** — `docs/RULE.md` 신설 규약(형 작성, 2026-08-10): *"규칙으로 명시되지 않은
  관행을 사용자의 명시적인 확인 없이 무지성으로 반복하면 안 된다."* **이 사이클이 그 규약의 계기다**
- **P-1 표(직전 Try 이행 현황) 미사용** — 위 규약의 첫 적용(§1.4). 이월 추적의 단일 원천은 **서버 백로그**
- **이번 사이클 커밋 범위 메모**: `docs/RULE.md` 개정분(위 규약)은 별도 커밋하지 않고
  **사이클 종료 절차의 docs 커밋 1개에 함께 싣는다**(형 지시, 2026-08-10)
- **`P-n` 라벨 충돌 주의**: 이 문서에서 `P-1`은 두 곳에 나온다 — ①**3차 회고 P-1**(폐지된 Try 표, §1.4)
  ②**형 검수 지적 P-1~P-4**(v1.1에서 반영한 오귀속·근거부족 등, §2.3·Version History). 문맥으로 구분한다

---

## 9. 다음 단계

1. ~~형 승인~~ → ✅ **전건 완료(2026-08-10)** — Q-1~Q-5 · §2.1 스코프 5건 · §4 SC 6건(C56 정량 기준 형 지정) · `v0.2.0` 버전
2. **잔여 실측** — **V5**(프로덕션 DB SQL, §3.1.3 주의) / **V3′·V4′·V6**(형의 Clerk 인스턴스 생성 후)
3. **Clerk 인스턴스 준비** — 형이 직접(Q-4 ✅승인): 애플리케이션 생성 · DCR 활성화 · JWKS/issuer 확보
4. `/pdca design adopt-oauth-clerk` — 3안 비교 후 아키텍처 선택
5. Do — module 분할은 Design §11.3에서. 예상: module-1(미들웨어+PRM), module-2(배포·실증).
   **RK-68 완화상 커넥터 등록을 가장 먼저 시도**해 조기 실패를 확보
6. Check — 형이 웹 커넥터 재연결 + **C52~C57** 판정(C58은 N/A)
7. 종료 절차(RULE.md) — `_INDEX.md` 행 추가 → `v0.2.0`(승인 완료) → `npx pdcaw@latest upload` → README → 커밋 → 태그
   - **RK-74를 기술 부채로 백로그 등록**(형 결정) — 제목안: "웹 UI 로그인 Clerk 통일 + Neon Auth 제거 컷오버"

---

## Version History

| Version | Date | Changes | Author |
|---------|------|---------|--------|
| 1.0 | 2026-08-10 | 최초 작성 — 형 초안(v0.2.0) 기반. 실측 M-1~M-8로 초안 전제 2건(`mcp-handler` 사용·Clerk만 붙이면 완료) 정정, `questions.tmp` Q-1~Q-5 답변 반영(D-99 조건부·②A·③A·fail-fast·검증 절차 동반) | Claude |
| 1.7 | 2026-08-10 | **module-1·2 Do 완료 — OAuth 실연결 성공.** ①**module-1**: `mcp-auth.ts`(D-100 확정)·`prm.ts`·L1 8건(a1~a8) 구현, `tsc`·`oxlint`·`npm test`·L1 전건 무회귀 ②**PRM 404 발견·수정(D-99b)** — Vercel `dest`가 원경로를 보존한다는 사실을 curl로 반증 확인, `app`(basePath `/api`) 밖이라 `server/root.ts` 신설로 합성(`AppType`은 불변) ③**prod Clerk 인스턴스가 dev와 다른 커스텀 도메인 프록시(`/__clerk`) 구조임을 발견** → `server/routes/clerk-proxy.ts` 직접 구현(D-110) — Clerk 공식 헤더 명세(WebSearch) + 공식 헬퍼의 실제 SSRF CVE(GHSA-gjxx-92w9-8v8f, WebFetch로 확인) 회피 설계, body 버퍼링 버그·redirect 자동추종 버그 각 1건 실측·수정 ④**dev/prod Clerk 인스턴스 혼동을 여러 차례 반복**(issuer·Client ID·redirect_uri 전부 인스턴스별로 다시 확인해야 했음) — V5 재실측(형 SQL) 겸 owner 2명 발견(진짜 계정 `287b080d-...` vs 7차가 이미 식별한 `cogmo` 잔존 계정), 10T-2 최종 ✅ ⑤**DCR이 vercel.app 도메인에서 최종 불가 확정** — Account Portal이 "vercel.app 도메인 미지원"으로 명시 거부(Clerk 플랫폼 제약), D-107 (b) 수동 클라이언트로 폴백하던 중 ⑥**형이 커스텀 도메인을 즉석 구매·연결(D-111, Plan 밖 결정)** — Cloudflare CNAME(프록시 끄기 필요했음)+Clerk Domains 설정 → Account Portal 정상 활성화 → **DCR 실제 성공(201)** → `clerk-proxy.ts`·`CLERK_SECRET_KEY` 전량 제거(불필요해짐, D-110 사실상 롤백) ⑦**형이 Clerk 최초 가입(V6) + claude.ai 커넥터를 URL만으로(Client ID/Secret 없이) 연결 성공 + 툴·프롬프트 실호출 성공** — **C52~C57 전건 Met**, RK-65·67·68 전건 종료. Plan 스코프 밖이었던 커스텀 도메인 결정은 D-111로 별도 기록, RK-68 해소 경로가 D-107(예정안)이 아니라 D-111(즉흥 결정)이었다는 사실관계를 정확히 남김 | Claude |
| 1.6 | 2026-08-10 | **DCR 가설 기각 + 설계 전제 확보.** ①형이 `Dynamic client registration`·`Generate access tokens as JWTs` 두 토글 ON 후 재실측 — **`registration_endpoint`는 여전히 미광고, 키 집합 토글 전과 완전 동일, 캐시도 아님**(`cf-cache-status: DYNAMIC` + 캐시버스터 확인) → **"설정이 꺼져 있어서"라는 v1.5 가설 기각, Clerk의 DCR 광고 미지원 확정** ②**D-107 방침 확정**(형 결정) — (a) 기각, **(b) 수동 클라이언트 1순위**, (c) CIMD 예비. **Design은 DCR 성사와 무관하게 진행**(RS 역할 동일) ③**RK-68 성격 재정의** — 확률 High(확정)이나 **영향이 C52 하나로 축소** ④**V7 신설 + RK-75 기록** — access token JWT 발급이 ON이어야 JWKS 검증이 성립. **Plan v1.0~v1.5는 이 전제를 확인하지 않고 FR-128을 쓰고 있었다**(opaque였다면 introspection 방식으로 설계 전면 교체 대상이었음). 형이 토글을 켜며 결과적으로 해소 | Claude |
| 1.5 | 2026-08-10 | **Clerk 인스턴스 생성 후 discovery 실측(Claude, `curl`).** ①**V3′ 완료** — issuer·`jwks_uri`(RS256 1키)·엔드포인트 5종 확보, `grant_types`(code+refresh)·`code_challenge_methods`(S256)·`token_endpoint_auth_methods`에 `none` 포함 → claude.ai 요구 조합 충족. **D-103 확정** ②🔴**V2′ 뒤집힘 — `registration_endpoint`가 두 discovery 문서 어디에도 없음.** 대시보드 관측과 실제 메타데이터가 어긋남. `POST /oauth/register`는 **422**(라우트 실재, 미광고로 해석) → **§3.1.5 신설**, **RK-68 Low→High 재상향**(v1.3의 완화 취소), **D-107 신설**(토글/수동등록/CIMD 3안) ③**V4′ 판정 불가 확정** — RFC 8707 지원을 광고하는 표준 메타데이터 필드가 존재하지 않으므로 **실토큰 `aud` 확인이 유일한 판정 경로**(Do 단계) ④**V6 구조적 보류 명시** — Clerk `sub`는 유저가 생겨야 존재 | Claude |
| 1.4 | 2026-08-10 | **P-1 표 폐지 + 다중 사용자 방침 확정.** ①**§1.4 전면 축소** — "직전 Try 이행 현황" 전수 표를 폐지하고 이 사이클과 실제로 맞물리는 2건(6T-1·10T-2)만 남김. 계기: 형이 "P-1이 어디 규정돼 있냐"고 물어 확인한 결과 **RULE.md·bkit 템플릿 어디에도 없는 3차 report의 제안**이 관행화된 것이었음 ②**관행 근원 차단** — 3차 report §6.3·§7.1, analysis에 폐기 주석 사후 추가(해당 문서 VH 0.4) ③**`docs/RULE.md` 신설 규약 반영**(형 작성) — "규칙으로 명시되지 않은 관행을 무지성 반복 금지". 이 사이클이 그 계기이며, RULE.md 개정분은 종료 커밋에 합류 ④**§3.1.4 신설 — 다중 사용자 대비 방침**(형 결정: ①C 안 만들고 백로그로). **Claude 진술 정정** — "가입 플로우가 없다"는 틀렸고 **Neon Auth는 다중 사용자 가입을 지원**한다(형 지적) ⑤**D-106 신설** — 매핑을 `resolveOwnerId(sub)` 단일 함수로 격리(비용 0 준비) ⑥**V5를 형 진술로 갈음**(쿼리 미실행 사실 명시), 쿼리는 §3.1.3에 다중 사용자 시점용으로 보존 ⑦`P-n` 라벨 충돌(3차 회고 P-1 vs 형 검수 지적 P-1) 구분 표기 | Claude |
| 1.3 | 2026-08-10 | **형 실측 2건 + 결정 4건 반영, Plan 전건 승인.** ①**V1 근거 확정** — Neon 콘솔에 OIDC/DCR 메뉴 부재 + `/.well-known/openid-configuration`·`oauth-authorization-server` **2종 404**(대시보드+API 2원 실측). 이 과정에서 **V3(Neon Auth AS 메타데이터)도 함께 미노출 확정** ②**V2′ 신설·확인** — Clerk `Configure → OAuth Applications`에 인가서버·클라이언트 생성, DCR은 discovery `registration_endpoint`로 기본 노출, CIMD 탭 지원 → **RK-68 실질 해소** ③**RK-74 수용 확정** — 기술 부채로 백로그 등록 + **차후 사이클에서 웹 UI까지 Clerk 통일·Neon Auth 제거 컷오버**(§2.2 이관표 행 추가) ④**C56 정량화**(형 지정) — "`server/middleware/mcp-auth.ts` 단일 신설 + 파일 1개 삭제로 컷오버 완결을 `git status`/`diff`로 확인" → FR-132·**D-100 확정**에 반영 ⑤**§3.1.3 신설** — V5는 `.env.local`이 dev 브랜치를 가리키므로 **프로덕션 기준 수행** 경고 ⑥스코프·SC·`v0.2.0` 승인 반영(헤더 상태 전환) | Claude |
| 1.2 | 2026-08-10 | **D-99 확정 반영 — 형이 Neon Auth OIDC 미지원을 직접 확인(V1) → ①A(Clerk) 확정, Q-1~Q-5 전건 승인.** 10T-1 grep 전수조사로 영향 지점 20곳 일괄 갱신: Executive Summary·Context Anchor·§1.4(10T-1 ✅ 2회 이행, 9T-3)·§2.1 S1·§2.2·§2.3(승인란+파생 변경표)·§2.4·§3.1.1(V1 결과·V2~V4 타임박스 중단)·**§3.1.2 신설**(Clerk 기준 재발행 V3′·V4′·V6)·FR-127~130·C57·**C58→N/A**·DoD·RK-65 종료·RK-68 완화·**RK-74 신설**(IdP 2개 분열 영구화)·§6.2·§6.3·D-99 확정·**D-100b→N/A**·D-102·D-103·§8 실측 ID 규약·§9 | Claude |
| 1.1 | 2026-08-10 | **형 지적 4건(P-1~P-4) 반영.** **P-1(🔴 출처 오귀속)**: §2.3이 Claude 채팅 답변 원문을 "형의 논거"로 표기해 결정 주체를 오귀속 — 열을 "논거(Claude 채팅 권고)"+"형 승인" 체크란으로 재구성, 문서 전체 `grep`으로 "형 지시" 표기 5곳(§3.1.1·DoD 2곳·RK-65·RK-66)과 C58·Version History를 "§2.3 권고"로 정정, §9-1에 Q 승인 필요를 명시. **P-2(🟡)**: 10T-2를 ✅→🔄로 강등 — M-2는 스키마 구조 확인이지 개체 수 조회가 아님. S1에 V5(`count(DISTINCT owner_id)`) 추가, FR-127·DoD 반영. **P-3(🟡)**: C52·M-8·FR-136·DoD를 "툴 10종 **+ 프롬프트 2종**"으로 확장 — 착수 근거인 C50이 검증 사각이 되는 것 방지. **P-4(🟢)**: D-100b 예약 — ①B 시 같은 issuer를 보는 검증 경로 2개의 구분 규칙(통합/`aud`/경로), V4 결과 종속 | Claude |
