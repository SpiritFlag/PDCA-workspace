---
template: analysis
version: 1.0
---

# adopt-oauth-clerk 분석 문서

> **요약**: gap-detector 정적분석(Match Rate 91%, Critical 0·Important 3·Minor 6) 후 형이
> "지금 모두 수정"을 선택해 9건 전량 즉시 반영. 그 과정에서 이 사이클 최대 테스트 사각이었던
> **OAuth 성공 경로(L1 커버리지 0%)**를 로컬 서명 키쌍 + 실 HTTP JWKS 서버로 메웠다(a9·a10 신설).
>
> **프로젝트**: PDCA-workspace
> **작성자**: Claude
> **작성일**: 2026-08-10
> **PDCA Cycle**: adopt-oauth-clerk (11번째 사이클, `v0.2.0`)
> **선행 문서**: [Plan](adopt-oauth-clerk.plan.md) v1.7 / [Design](adopt-oauth-clerk.design.md) v1.2

---

## Context Anchor

| Key | Value |
|-----|-------|
| **WHY** | 웹 커넥터 인증이 URL 평문 PAT — 로그 잔존·노출 사고 실발생 |
| **RISK** | RK-65·67·68 전건 종료(실측·실배포로 해소). RK-66은 fail-fast로 방어 유지(단 I-1로 한 구멍 확인) |
| **SUCCESS** | C52~C57 — Do 단계에서 형 실사용으로 전건 Met 확인됨(analysis는 이를 정적 코드 기준으로 재검증) |
| **SCOPE** | mcp-auth.ts·prm.ts·root.ts·L1 하네스. 웹 UI·PAT UI·`pdcaw`·툴/프롬프트 내용 무변경 |

---

## 1. Success Criteria 최종 상태

| ID | 기준 | 상태 | 근거 |
|----|------|:---:|------|
| C52 | 툴 10종+프롬프트 2종 전수(실토큰) | ✅ Met | 형 실사용(module-2 h3) — Client ID/Secret 없이 URL만으로 연결 후 확인 |
| C53 | 401+`WWW-Authenticate` | ✅ Met | `curl -i` 양 도메인(vercel.app·커스텀 도메인) |
| C54 | PRM 프로덕션 실경로 | ✅ Met | D-99b(root.ts) 해결 후 양 도메인 확인 |
| C55 | legacy 무회귀 | ✅ Met | L1 48건 + 배포본 curl |
| C56 | 파일 1개 삭제=컷오버(정량) | ✅ Met | `auth.ts`엔 `unauthorized` export 1줄뿐, `app.ts`엔 import+마운트 정확히 2줄 — gap-detector가 코드 리딩으로 재확인 |
| C57 | S1 실측 전건 기록 | ✅ Met | V1·V3′·V5·D-99 전부 기록. V4′(aud)는 D-109로 의도적 생략, h5로 이월 |
| C58 | (N/A) 웹 UI 무회귀 | ⛔ N/A | ①A 확정으로 발동 조건 자체가 소멸 |

**7건 중 6건 Met, 1건 N/A — 미충족 0건.**

---

## 2. 정적 갭 분석 (gap-detector)

### 2.1 종합 점수

| 축 | 점수 | 근거 |
|---|:---:|---|
| Structural | 95% | `.env.local.example` 미갱신(I-2)·`dev-server.ts` Design 미기재로 감점 |
| Functional Depth | 88% | fail-fast 1케이스(I-1) 구멍, placeholder 실질 0건 |
| API Contract | 91% | FR-127~137 중 9 완전 / 2 부분(FR-130·133) |
| Intent Match | 94% | C52~C57 실증 확인. h5 미이행만 감점 |
| Behavioral Completeness | 85% | OAuth 성공 경로 L1 자동 커버리지 0% — 최대 감점 요인 |
| UX Fidelity | N/A | 백엔드 전용 사이클, `src/` 무변경(Design §8.3 규칙대로 비활성 처리) |
| **Overall (정적, non-frontend 공식)** | **91%** | `95×.10 + 88×.20 + 91×.20 + 94×.35 + 85×.15` |

> Runtime 증거(형 웹 커넥터 실연결 + 양 도메인 curl + L1)를 가중하면 ~92%. 90% 게이트를
> 이미 넘어 iterate(Act) 없이 이 문서 안에서 즉시수정으로 마감했다.

---

## 3. Gap 목록 및 처리 — 9건 전량 즉시 수정 완료

### 🟠 Important — 3건

| ID | 내용 | 처리 |
|----|------|------|
| **I-1** | `CLERK_ISSUER` 미설정 시 fail-fast(500)가 아니라 조용히 legacy로 위임돼 401 — `isClerkIssued()`의 게이트 조건 자체가 이 env에 의존해 원리적으로 회피 불가 | **수정 안 함(의도적) + 문서화 + 회귀 고정.** `mcp-auth.ts`에 이 한계를 명시하는 주석 추가, L1 **a5b** 신설로 현재 동작(401)을 회귀 테스트로 고정. 휴리스틱 탐지는 오탐 여지가 커 기각(gap-detector 권고 채택) |
| **I-2** | `.env.local.example`에 신규 env 3종 누락 — I-1의 근본 원인(존재를 잊기 쉬움) | ✅ **수정** — `CLERK_ISSUER`·`MCP_OAUTH_SUBJECT`·`MCP_OAUTH_OWNER_ID` 키+주석 추가 |
| **I-3** | `server/dev-server.ts`가 `app`을 서빙 — 로컬에서 PRM 404, D-99b 의도(배포·테스트·로컬이 같은 트리) 3곳 중 1곳 누락 | ✅ **수정** — `root` import로 교체 |

### 🔵 Minor — 6건

| ID | 내용 | 처리 |
|----|------|------|
| M-1 | `prm.ts` 주석이 반증된 가정("구현 시점 미실측")을 그대로 서술 | ✅ 수정 — D-99b 확정 사실로 갱신 |
| M-2 | `CLERK_ISSUER` 미설정 시 PRM이 `authorization_servers: [""]` 반환(RFC 9728상 무의미) | ✅ 수정 — 빈 배열로. L1 **a7b** 신설로 고정 |
| M-3 | `clerkIssuer()` 도달 불가 코드 + bare `Error` | ✅ 수정 — `clerkJwks(issuer)`로 인자 주입, 함수 삭제 |
| M-4 | JWKS 캐시가 최초 1회 issuer로 고정, issuer 변경 시 stale | ✅ 수정 — `Map<issuer, jwks>`로 키 분리 |
| M-5 | Plan D-103가 dev issuer 값을 최종값처럼 들고 있어 Design과 불일치 | ✅ 수정 — Plan을 커스텀 도메인 최종값으로 갱신 |
| M-6 | L1 a8이 `expect(true).toBe(true)` no-op | ✅ 수정 — 삭제하고 **a9·a10**으로 대체(아래) |

### 부가 성과 — L1 커버리지 갭 해소 (gap-detector 권고, Important/Minor 목록 밖)

gap-detector가 "이번 사이클 최대 테스트 사각"으로 지목: RK-71이 "실 Clerk 토큰을 못 만든다"며
사람 실증(h1~h5)에 넘긴 **OAuth 성공 경로**가, 사실은 "실 Clerk 토큰"이 아니라 **"유효 서명
토큰"**만 있으면 하네스로 검증 가능했다.

- **a9 신설** — 로컬 RSA 키쌍 생성 + 실제 HTTP 서버(모킹 아님)로 JWKS 서빙 → 유효 서명 토큰으로
  `tools/list`·`tools/call(project_list)` 200 확인, `ownerId` 주입까지 실 dev DB로 검증. 만료
  토큰 거부도 같은 키로 확인.
- **a10 신설** — Clerk형 JWT를 쿼리파라미터로 보내면 거부됨을 확인(D-101 회귀 방지).

L1 최종 **48건 전건 통과**(기존 37건 + mcp-auth 8→11건 순증).

---

## 4. Decision Record 준수 확인

| ID | 코드 반영 | 근거 |
|---|:---:|---|
| D-100 단일 신설 파일 | ✅ | `mcp-auth.ts`가 OAuth 로직 전량 소유 |
| D-101 헤더 전용·PAT 우선 | ✅ | a10으로 실증 보강 |
| D-103 PRM AS 값 | ✅ | M-5 수정으로 Plan·Design·코드 3자 일치 |
| D-105 분기 진입 시 fail-fast | ⚠️→📝 | `assertOAuthEnv()`는 규약대로. `CLERK_ISSUER` 케이스만 구조적 한계로 문서화(I-1) |
| D-106 `resolveOwnerId` 격리 | ✅ | 단일 함수 + 주석 3줄 |
| D-108 legacy 재시도 금지 | ✅ | a4·a9 만료 케이스로 재확인 |
| D-109 aud 검증 생략+기록 | ⏳ | 코드는 규약대로(미검증). "실값 기록"(h5)만 미이행 — 낮은 우선순위로 이월 |
| D-99b root.ts 합성 | ✅ | I-3 수정으로 3개 진입점(배포·L1·로컬) 전부 일치 완성 |

**C56 재확인**: `git diff` 정량 근거 — `auth.ts` +2줄(export+주석), `app.ts` OAuth 흔적 정확히
2줄(import+마운트). 컷오버 절단면 성립.

---

## 5. 남은 이월 항목 (스코프 밖 또는 저우선순위)

| 항목 | 상태 | 처리 |
|------|------|------|
| h5 — 실토큰 `aud` 값 확인·기록(D-109) | 미이행 | 선택 과제, 형이 원하면 로컬 디코드로(토큰 전체는 비밀값이라 채팅 미공유) |
| h7 — `pdcaw` CLI 실사용 확인 | 미이행 | legacy 코드 무변경이라 위험 낮음, 형 재량 |
| `d9109910-...`(cogmo) 계정 정리 | 미착수 | 이 사이클 스코프 밖 — 백로그 등록 필요(report에서 명시) |
| RK-74(IdP 통일) | 이월 | 별도 사이클, 이번 커스텀 도메인 확보와는 무관한 축 |

---

## 6. Checkpoint 5 — 결정

형 선택: **"지금 모두 수정"** → Important 3건·Minor 6건 전량 즉시 반영, 커밋 `190218a`.
iterate(Act) 단계 불필요 — Check 안에서 마감.

---

## Version History

| Version | Date | Changes | Author |
|---------|------|---------|--------|
| 1.0 | 2026-08-10 | 최초 작성 — gap-detector 정적분석(91%, Critical 0·Important 3·Minor 6) 결과 기록, 형 결정("지금 모두 수정")에 따라 9건 즉시 반영 + OAuth 성공 경로 L1(a9·a10) 신설 완료 기록 | Claude |
