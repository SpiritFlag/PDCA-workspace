---
template: design
version: 1.0
---

# adopt-oauth-clerk 설계 문서

> **요약**: `/api/mcp` 인증에 Clerk OAuth 2.1 경로를 추가한다. C안(신설+위임) —
> OAuth 검증·매핑·`WWW-Authenticate`만 `server/middleware/mcp-auth.ts` 신설 파일이 소유하고,
> legacy(PAT·Neon JWT)는 기존 `authMiddleware` **호출로 위임**해 사본 0줄을 유지한다.
> PRM(RFC 9728) 라우트와 `vercel.json` `/.well-known/` 규칙을 함께 추가한다.
>
> **프로젝트**: PDCA-workspace
> **작성자**: Claude
> **작성일**: 2026-08-10
> **PDCA Cycle**: adopt-oauth-clerk (11번째 사이클, `v0.2.0`)
> **선행 문서**: [adopt-oauth-clerk.plan.md](adopt-oauth-clerk.plan.md) (v1.6, 승인 완료)

---

## Context Anchor

| Key | Value |
|-----|-------|
| **WHY** | 웹 커넥터 입구의 인증이 URL 평문 PAT다. 로그 잔존(4차 C13) + 회전 부재 + 노출 사고 실발생(2026-08-10) |
| **WHO** | 형 — 유일 사용자, Clerk 대시보드·커넥터 등록 수행 / Claude — 서버 RS 구현 |
| **RISK** | RK-66(매핑 env 오설정 → fail-fast) · RK-67(`/.well-known/` SPA 폴백 — 배포 후 curl 필수, PRM·Clerk 프록시 2회 재발) · RK-68(DCR **최종 불가 확정** — prod Account Portal이 vercel.app 도메인 미지원, 커스텀 도메인은 스코프 밖. 수동 클라이언트 확정) · RK-70(인증 계층 오작동 시 전 경로 사망 — C안 격리로 반경 축소) · **RK-76(신규) — 웹 UI가 언젠가 커스텀 도메인으로 옮겨가면 DCR 재검토 가치가 생긴다** — RK-74(IdP 통일) 백로그와 연계해 함께 재검토 후보로 등록 |
| **SUCCESS** | C52~C57. 특히 C56 정량 기준: **파일 1개 삭제(+마운트 원복)=컷오버를 `git diff`로 확인** |
| **SCOPE** | S2(미들웨어)·S3(PRM)·S4(401 규약)·S5(실증). 웹 UI·PAT UI·`pdcaw`·툴/프롬프트 내용 무변경 |

---

## 1. 개요

### 1.1 설계 목표

1. **절단면 하나** — v0.2.1 컷오버(legacy 제거)와 OAuth 롤백이 각각 **한 곳의 삭제**로 끝난다(C56).
2. **사본 제로** — legacy 검증 규칙(쿼리는 PAT만, 401 문구, `last_used_at`)은 계속 `auth.ts` 한 곳에만 산다.
3. **폭발 반경 격리** — 이번 사이클의 diff가 기존 8개 API 경로에 물리적으로 닿지 않는다(RK-70).

### 1.2 설계 원칙

- 신뢰는 `jwtVerify` 이후에만 — 프리디코드(`iss` 판별)는 **분기에만** 쓰고 권한 부여에 쓰지 않는다.
- 에러 응답은 기존 규약(ServiceError/HTTPException 어댑터)을 벗어나지 않는다 — 신규 리터럴 응답 금지.
- env가 없으면 조용히 동작이 달라지는 게 아니라 **시끄럽게 실패**한다(fail-fast, Q-1 조건②).

## 2. 아키텍처

### 2.0 3안 비교와 선택 (Checkpoint 3 — 형 결정 2026-08-10: **C안**)

| 축 | A 최소 변경 (auth.ts 수정) | B 완전 분리 (사본) | **C 신설+위임 ★채택** |
|----|:---:|:---:|:---:|
| C56 "파일 1개 삭제=컷오버" | ❌ auth.ts 내부 절제 | ❌ 사본 때문에 파일 내부 절제 | ✅ 양방향 성립 |
| legacy 검증 중복 | 없음 | **~80줄 사본** — 5차가 세 번 값 치른 드리프트 패턴 | 없음(위임) |
| 이번 diff가 기존 8개 경로에 닿는가 | **닿음**(9개 경로 공유 파일 수정) | 안 닿음 | 안 닿음 |
| RK-70 폭발 반경 | 전 API | MCP만 | MCP만 |
| v0.2.1 컷오버 작업 | 줄 골라내기 | 줄 골라내기 | **위임 가지 ~10줄 삭제** |

- A 기각: C56(형 지정 정량 기준) 정면 위반 + 폭발 반경.
- B 기각: "격리"의 실체가 **중복** — `.optional()`/`.nullable()` 3회 재발(5차)과 동형의 씨앗.
- C 채택 전제였던 **위임 합성 안전성은 V8로 실측 완료**(§2.3).

### 2.1 구성 다이어그램

```
POST /api/mcp
  │
  ▼
[mcp-auth.ts — 신설]                        v0.2.1 컷오버: 아래 ⓑ만 삭제
  ├─ ⓐ Bearer JWT이고 iss가 Clerk?
  │     ├─ jwtVerify(JWKS, issuer 검증) 성공 → ownerId = resolveOwnerId(sub) → next()
  │     └─ 실패 → 401 (+ WWW-Authenticate)   ※ legacy로 재시도하지 않음 (D-108)
  ├─ ⓑ 그 외 전부 → authMiddleware(c, next)로 위임  ← legacy 사본 0줄
  │     └─ 401 발생 시 catch → WWW-Authenticate 헤더 부착 후 재던짐
  ▼
[mcpRoute — 무변경]

GET /.well-known/oauth-protected-resource/api/mcp
  → vercel.json 신규 라우트 → Hono app → [prm 라우트 — 신설, 인증 불요]
```

### 2.2 데이터 흐름 (claude.ai 관점)

1. 커넥터 등록: URL만 입력(`?token=` 없음) → 첫 요청이 401 + `WWW-Authenticate` 수신
2. 헤더의 `resource_metadata` URL → PRM 조회 → `authorization_servers`의 Clerk issuer 발견
3. Clerk AS 메타데이터 → (DCR 미광고이므로) **수동 등록 클라이언트**로 인가 코드 + PKCE(S256) 플로우
4. access token(JWT, V7)으로 `/api/mcp` 재호출 → ⓐ 경로 통과

### 2.3 사전 실측 (Design 확정 근거)

| ID | 내용 | 결과 |
|----|------|------|
| **V8** | C안 위임 합성 — `createMiddleware` 안에서 `authMiddleware(c, next)` 직접 호출 시 안전한가. 실제 Hono(로컬 `node_modules`)로 4케이스 실행 | ✅ **전건 통과(2026-08-10)** — OAuth 토큰/legacy 토큰 각 200·핸들러 **정확히 1회** 실행(이중 `next()` 없음), 무효·무토큰 401 + `WWW-Authenticate` 부착 확인 |
| V3′ | Clerk issuer·jwks_uri·PKCE S256·`token_endpoint_auth_methods: none` | ✅ Plan §3.1.2 |
| V7 | access token JWT 발급(RS256) | ✅ Plan §3.1.2 — JWKS 검증 성립 전제 |

### 2.4 의존성

새 패키지 0 (NFR-1) — module-2 실배포 중 발견한 프록시 필요성(아래 §2.5)도 이 원칙을 지켰다.
`jose`(기존)·`hono/factory`(기존)만 사용. Clerk SDK 미도입 — 우리는 RS라 검증만 하면 되고,
SDK는 발급·세션 관리용이라 불필요. **단, RS 역할과 별개로 §2.5의 프록시 자체는 Secret Key가
필요함이 실배포에서 드러났다** — Design 작성 시점엔 예상 못 한 것.

### 2.5 [module-2 실측 추가, ⛔ 이후 폐기됨] Clerk production 커스텀 도메인 프록시 (2026-08-10)

> **⛔ 이 절의 구현은 최종적으로 걷어냈다.** 형이 커스텀 도메인을 구매해 Clerk에 직결(`clerk.<도메인>`)
> 시키면서 리버스 프록시 자체가 불필요해졌다(§2.6). 아래는 **폐기 경위를 남기는 기록**이고,
> 현재 코드에는 `clerk-proxy.ts`가 존재하지 않는다.

**발견 경위**: prod Clerk 인스턴스는 dev와 인가서버 URL 체계가 다르다 — Frontend API가
`https://pdca-workspace.vercel.app/__clerk`로 **우리 도메인을 경유하는 프록시** 구조다.
`vercel.json`의 단순 URL 리라이트(`dest`)로 연결했더니 Clerk가 빈 바디 **501**을 반환(실측) —
Clerk 공식 문서(clerk.com/docs/guides/dashboard/dns-domains/proxy-fapi) 확인 결과 프록시는
**`Clerk-Proxy-Url`·`Clerk-Secret-Key`·`X-Forwarded-For` 3개 필수 헤더**를 요구하는데, Vercel의
선언적 URL 리라이트는 헤더를 못 실어 보낸다 — PRM 때(§4.1)와 같은 부류의 "구현 시 실측 필요" 사례가
한 번 더 재현된 것.

**보안 대응(GHSA-gjxx-92w9-8v8f)**: Clerk 공식 프록시 헬퍼(`@clerk/backend`의
`clerkFrontendApiProxy`)에 실제 SSRF CVE가 있었다 — `//`로 시작하는 경로를
`new URL(path, base)`로 조립하면 WHATWG URL이 이를 프로토콜 상대 URL로 오인해 origin이
공격자 서버로 바뀌고 `Clerk-Secret-Key`가 함께 샌다. **패키지 추가 대신 직접 구현하되, 그
취약점 클래스 자체를 구조적으로 차단**했다(`server/routes/clerk-proxy.ts`) — origin은
`UPSTREAM` 상수 문자열에 고정, 경로는 이중 슬래시 정규화 후 순수 문자열 접미사로만 사용,
`new URL(untrusted, base)` 패턴을 코드에서 아예 안 쓴다.

**PRM과 같은 이유로 `app`(basePath `/api`) 밖에 마운트** — `root.ts`(§4.1에서 이미 신설)에
`.route('/__clerk', clerkProxyRoute)`로 추가. `vercel.json`도 PRM과 동일 패턴으로 우리 함수를
거치게 변경(직접 외부 URL로 리라이트하면 헤더 주입 지점이 없어짐).

**배포 중 잡은 버그 2건**(둘 다 이 프록시 자체가 나중에 걷어내지며 함께 사라졌지만, 실측 과정과
버그 패턴은 기록해 둘 가치가 있다):
1. `fetch()`가 반환한 `Response`를 그대로 리턴했더니 헤더는 정상 도착하는데 **바디가 0바이트** —
   Vercel Node 함수 경계를 넘으며 스트림이 끊긴 것으로 추정. `arrayBuffer()`로 버퍼링 후 새
   `Response`로 재구성해 해결.
2. `fetch()` 기본값(`redirect: 'follow'`)이 Clerk의 3xx 리다이렉트를 **서버 안에서 몰래 다
   따라가버려**, 브라우저 주소창은 그대로인데 최종 페이지의 상대경로 리소스가 엉뚱한 origin
   기준이 돼 "Page not found"로 관측됨. `redirect: 'manual'`로 전환해 3xx를 브라우저에 그대로
   넘기도록 수정(Node `fetch()`가 `manual`에서도 status·`Location` 헤더를 정상 노출함을 로컬
   스크립트로 사전 검증 후 적용 — 브라우저의 opaqueredirect 제약과 다름).

### 2.6 [최종 확정] 커스텀 도메인 직결로 프록시 전량 제거 (2026-08-10)

`/__clerk` 프록시로도 Clerk 프론트엔드 API 자체(JWKS·discovery)는 정상 동작했지만, **DCR 등록이
Account Portal 부재로 거부**됐다 — Clerk의 명시 응답: *"Account Portal is not available for
your domain — Production instances that use a vercel.app domain do not currently support the
hosted Account Portal. Add a custom domain to enable."* 이는 D-107(수동 클라이언트 폴백)의
직접 원인이었다.

형이 **커스텀 도메인을 구매·연결**(Vercel에 도메인 추가 + Cloudflare CNAME, 프록시 끄기 필요했음
— Cloudflare 오렌지 클라우드가 Vercel 도메인 검증을 막는 흔한 함정)하고 Clerk Domains에서
**DNS 직결 서브도메인**(`clerk.<도메인>` — Frontend API, `accounts.<도메인>` — Account Portal)을
설정하자:
- Account Portal이 정상 활성화됨
- `POST /oauth/register`(DCR)가 **201로 실제 성공**(client_id 실발급 확인, curl 직접 실측)
- claude.ai가 **Client ID/Secret 없이 URL만으로** 커넥터 등록·연결·툴 호출까지 전부 성공

→ **`/__clerk` 프록시(`clerk-proxy.ts`)와 `CLERK_SECRET_KEY`가 전량 불필요해졌다** — 코드에서
제거(§2.5는 폐기 경위 기록으로만 보존). `root.ts`는 PRM 마운트 목적으로는 계속 필요(§4.1, D-99b는
프록시와 무관하게 유효).

## 3. 환경변수 명세

| 변수 | 값 형태 | 필수 | 위치 |
|------|---------|:---:|------|
| `CLERK_ISSUER` | `https://clerk.pdca-workspace.spiritflag.work` (§2.6 커스텀 도메인 직결, **최종값**) | OAuth 경로 활성 조건 | Vercel(prod) — **형 수행** |
| `MCP_OAUTH_SUBJECT` | Clerk user `sub`(형이 커스텀 도메인 Account Portal에서 최초 가입 후 Users 목록에서 확보, V6 완료) | OAuth 경로 활성 조건 | 〃 |
| `MCP_OAUTH_OWNER_ID` | `287b080d-5f7d-434c-9e08-9d72d4ccb03a` (V5 SQL 실측 확정, 형의 실계정 — Plan §3.1.1) | OAuth 경로 활성 조건 | 〃 |
| ~~`CLERK_SECRET_KEY`~~ | ~~§2.5 프록시 전용~~ | ⛔ **불필요(§2.6) — 삭제 가능**. 남겨둬도 무해(아무 코드도 안 읽음) | — |

- JWKS URL은 `CLERK_ISSUER + '/.well-known/jwks.json'`로 **유도** — env 2중화하지 않는다(V3′에서 규칙 확인).
- `resolveOwnerId(sub)`: `sub === MCP_OAUTH_SUBJECT`면 `MCP_OAUTH_OWNER_ID` 반환, 아니면 401.
  다중 사용자 전환 시 이 함수 본문만 테이블 조회로 교체(D-106).

### 3.1 fail-fast 규칙 (D-105 확정)

**"첫 OAuth 분기 진입 시" 검사로 확정** — 모듈 로드 시 throw는 기각.

- 근거: `api/[...route].ts` 단일 서버리스 함수가 **전 API를 서빙**한다. 모듈 로드 throw는
  웹 UI·pdcaw까지 죽여 RK-70을 자초한다.
- 규칙: 세 env 중 **하나라도 없으면 ⓐ 분기 전체 비활성** — Clerk형 JWT가 와도 ⓑ(위임)로 보내지 않고
  `ServiceError('INTERNAL', 'OAuth env not configured: <빠진 변수명>')` **500으로 시끄럽게 실패**.
  (조용한 빈 화면 금지 — Q-1 조건②. 빠진 변수명을 메시지에 명시해 원인 추적 1스텝화.)
- PRM 라우트는 env와 무관하게 항상 응답한다(메타데이터는 정적 사실이므로).

## 4. API 명세

### 4.1 PRM — `GET /.well-known/oauth-protected-resource/api/mcp` (신설, 인증 불요)

```json
{
  "resource": "https://pdca-workspace.vercel.app/api/mcp",
  "authorization_servers": ["https://clerk.pdca-workspace.spiritflag.work"]
}
```

(작성 시점 예시는 dev issuer였으나, §2.6에서 커스텀 도메인 직결로 확정된 최종 실값으로 갱신)

- `resource`는 요청 host에서 유도(로컬 dev에서도 자기 origin으로 동작). `authorization_servers`는 `CLERK_ISSUER`.
- `vercel.json` routes 최상단에 추가: `{ "src": "^/\\.well-known/(.+)$", "dest": "/api/[...route]?...route=.well-known/$1" }`
  — 기존 `^/api/` 규칙과 SPA 폴백보다 **먼저** 평가되게 배치. Hono `basePath('/api')`와의 정합은
  구현 시 실측(라우트를 `/api/.well-known/...`으로 받게 매핑). **배포 후 curl이 최종 판정**(C54·RK-67).

### 4.2 401 응답 (S4 — 기존 규약 유지 + 헤더 추가)

| 케이스 | status | body | `WWW-Authenticate` |
|--------|:------:|------|:---:|
| 토큰 없음 / legacy 무효 (ⓑ 위임 결과) | 401 | `{"error":{"code":"UNAUTHORIZED",...}}` (auth.ts 기존 그대로) | ✅ 부착 |
| Clerk형 JWT 검증 실패(만료·서명·`sub` 불일치) | 401 | 〃 (같은 코드 재사용) | ✅ 부착 |
| OAuth env 미설정 + Clerk형 JWT (fail-fast) | 500 | `{"error":{"code":"INTERNAL","message":"OAuth env not configured: ..."}}` | — |

헤더 값: `Bearer resource_metadata="https://<host>/.well-known/oauth-protected-resource/api/mcp"`

## 5. 미들웨어 명세 — `server/middleware/mcp-auth.ts` (신설, ~60줄)

```ts
// Design Ref: §2.1 — v0.2.1 컷오버: "위임 가지(ⓑ)" 삭제 = legacy 차단. 파일 삭제 = OAuth 롤백.
// 왜 IdP가 2개인가: Neon Auth는 OIDC provider 미지원(Plan V1). RK-74 백로그(웹 UI Clerk 통일)로 종료 예정.
// 다중 사용자 전환 시: resolveOwnerId 본문만 테이블 조회로 교체(D-106).
export const mcpAuth = createMiddleware<AuthEnv>(async (c, next) => {
  const token = bearerOf(c)                          // Authorization 헤더만. 쿼리는 보지 않음(D-101)
  if (token && !isPatToken(token) && isClerkIssued(token)) {   // iss 프리디코드 — 분기용, 신뢰 아님(D-108 주석 필수)
    assertOAuthEnv()                                  // D-105: 없으면 ServiceError 500 (빠진 변수명 명시)
    const { payload } = await jwtVerify(token, clerkJwks(), { issuer: CLERK_ISSUER })
    c.set('ownerId', resolveOwnerId(payload.sub))     // 불일치 시 401 (throw unauthorized)
    return next()
  }
  try { return await authMiddleware(c, next) }        // ⓑ 위임 — V8 실측 완료
  catch (e) { throw withWwwAuthenticate(e, c) }       // 401에만 헤더 부착, 그 외 그대로
})
```

핵심 결정:

| ID | 결정 | 근거 |
|----|------|------|
| **D-108** | **Clerk형 JWT 검증 실패 시 legacy로 재시도하지 않는다** | Clerk 모양의 토큰이 Neon JWT로 우연히 통과할 여지를 구조적으로 차단. 실패는 실패로 — 디버깅도 명확해짐 |
| **D-109** | `aud` 검증은 **이번 사이클 생략, 사실 기록** — 단 전제가 바뀜(아래) | V4′는 메타데이터로는 판정 불가였으나, **module-2 h1 실측(2026-08-10)으로 다른 경로가 열림**: claude.ai가 실제 `/oauth/authorize` 요청에 `resource=https%3A%2F%2Fpdca-workspace.vercel.app%2Fapi%2Fmcp`를 실어 보낸다(RFC 8707 resource indicator를 **claude.ai가 지원·전송함**, 우리 PRM `resource` 값과 일치). Clerk가 이 값을 받아 발급 토큰의 `aud`에 반영하는지는 **h5에서 실토큰으로 확인 필요** — 반영된다면 `aud` 검증을 다음 사이클 후보로 승격할 근거가 생긴다. 이번 사이클은 여전히 검증 코드 추가는 생략, **사실만 기록** |
| D-105 | fail-fast는 분기 진입 시 (§3.1) | 모듈 로드 throw는 전 API 사망(RK-70) |
| D-101 | OAuth는 **헤더만** — 쿼리 폴백 없음 | 쿼리 토큰이 이 사이클의 제거 대상 그 자체. OAuth에까지 물려줄 이유가 없음 |

## 6. 에러 처리

- 이 파일이 만드는 신규 에러는 두 종뿐: `unauthorized(...)`(auth.ts와 동일 헬퍼 재사용 불가 시 동일 형식 재정의 — **형식 사본 금지**, auth.ts의 `unauthorized`를 export해 import) / `ServiceError('INTERNAL', 'OAuth env not configured: ...')`.
- `app.onError` 무변경 — HTTPException 통과·ServiceError 매핑 기존 규약이 그대로 처리.

## 7. 보안 고려사항

| 항목 | 처리 |
|------|------|
| `iss` 프리디코드의 안전성 | 서명 검증 전 디코드는 **분기 결정에만** 사용. ownerId 주입은 반드시 `jwtVerify` 성공 후(§1.2 원칙) — 코드 주석 1줄 필수 |
| 시크릿 취급 | **최종 구현은 시크릿을 아예 안 씀**(RS는 공개 JWKS만 필요, §2.6 커스텀 도메인 직결로 `CLERK_SECRET_KEY`도 불필요해짐). 백로그 `828cf081` 규약 — 값 stdout 출력 금지 |
| Origin 검사 | `mcpRoute` 기존 로직 무변경 (미들웨어 앞단과 무관) |
| legacy 노출면 | RK-69 수용 그대로 — 이 사이클은 경로 추가만, 제거는 v0.2.1 |

## 8. 테스트 계획

### 8.1 범위와 분담 (RK-71 확정 반영)

| 축 | 수단 | 대상 |
|----|------|------|
| legacy 무회귀 (C55) | **L1 하네스** (기존 `l1-harness.ts` 재사용 — 6T-1 채점 대상) | 위임 경유 PAT·무토큰 |
| OAuth 분기 구조 | **L1 하네스** (실 Clerk 토큰 없이 가능한 범위) | 가짜 Clerk형 JWT의 거부·fail-fast·헤더 부착 |
| OAuth 실토큰 (C52·C53) | **사람 실증** (형 — 웹 커넥터) | 실제 플로우 전체 |
| PRM 라우팅 (C54) | **배포 후 curl** (dev 서버로는 vercel.json 검증 불가 — Plan §6.3) | 프로덕션 실경로 |

### 8.2 L1 시나리오 (`server/mcp-auth.l1.ts` 신설 — 실 dev DB)

| # | 시나리오 | 기대 |
|---|----------|------|
| a1 | 헤더 PAT로 `tools/list` (위임 경유) | 200, 기존과 동일 |
| a2 | 쿼리 PAT로 `tools/list` (위임 경유) | 200 (D-18 유지) |
| a3 | 무토큰 | **401 + `WWW-Authenticate` 헤더 존재 + `resource_metadata` URL 형식** |
| a4 | `iss`가 Clerk인 무서명 JWT | 401 (**D-108 — legacy 재시도 없음**을 응답 시간·로그로 확인) |
| a5 | `iss`가 Clerk인 JWT + OAuth env 미설정 상태 | **500 + 빠진 변수명 포함 메시지** (D-105) |
| a6 | `iss`가 타 값인 비PAT JWT (Neon JWT 모사) | ⓑ 위임 → 기존 JWKS 검증 결과 그대로 (401) |
| a7 | PRM GET (인증 없음) | 200 + `resource`·`authorization_servers` 형식 검증 |
| a8 | 기존 `mcp.l1.ts`·`cycles.l1.ts`·`prompts.l1.ts` 전건 재실행 | 무회귀 (마운트 교체가 유일한 접점) |

> a5는 env를 지웠다 복원하는 케이스라 **직렬 실행 필수** — 기존 `fileParallelism: false`(6차)가 이미 보장.

### 8.3 사람 실증 (module-2 — 형)

| # | 절차 | 판정 |
|---|------|------|
| h1 | claude.ai 커넥터를 URL만으로 등록 (**가장 먼저** — RK-68 조기 실패 확보) | 🔴 **최종 확정 — DCR 불가, D-107 (b) 수동 클라이언트로 폴백(2026-08-10)**. 경과: dev에서 DCR 미광고 확정 → prod 전환·`/__clerk` 프록시 구축 후 prod AS 메타데이터엔 `registration_endpoint`가 **광고는 됨** → **직접 `POST /oauth/register` 실측**(RFC 7591 최소 요청)하니 `invalid_client_metadata`: *"동적 등록 클라이언트엔 동의 화면이 필요한데 표시할 경로가 없다 — Account Portal이 꺼져 있고 커스텀 동의 경로도 없다"* → Account Portal 활성화 시도 → Clerk가 **"vercel.app 도메인은 Account Portal 미지원, 커스텀 도메인 필요"로 명시 거부**(플랫폼 제약, 커스텀 도메인 구매·설정은 Plan 스코프 밖). **결론: DCR은 광고와 실제 동작이 별개**(메타데이터에 필드가 있어도 기능이 안 됨) — 이 사이클에선 우회 없이 D-107 (b)로 진행 |
| h2 | 첫 성공 플로우에서 Clerk `sub` 확보 → `MCP_OAUTH_SUBJECT` env 설정(형) → 재연결 | V6 확보 |
| h3 | 툴 10종 + 프롬프트 2종 전수 (C52) | 전건 정상 |
| h4 | Claude Code(legacy PAT) 기존 연결 그대로 동작 (C55) | 무영향 |
| h5 | 실토큰 `aud` 값 확인·기록 (D-109) | 사실 기록만 |

## 9. Decision Record

| ID | 결정 | 상태 |
|----|------|:---:|
| D-99 | IdP = Clerk (①A) | Plan 확정 |
| D-100 | `server/middleware/mcp-auth.ts` 단일 신설 | Plan 확정 |
| D-101 | OAuth는 헤더 전용, PAT 접두 판별 우선 | Design 확정 |
| D-103 | PRM `authorization_servers` = Clerk issuer 실값 | Plan 확정 |
| D-105 | fail-fast = 분기 진입 시 500 (모듈 로드 기각) | **Design 확정** (§3.1) |
| D-106 | `resolveOwnerId(sub)` 단일 함수 + 주석 3줄 | Plan 방침 → §5 반영 |
| D-107 | DCR 대응 — ~~(a) 자동~~ **(b) 수동 클라이언트 최종 확정** | Plan 방침 → **h1 실측으로 확정**(§h1 — Account Portal이 vercel.app 도메인 미지원) |
| **D-108** | Clerk형 JWT 실패 시 legacy 재시도 금지 | **Design 신규** |
| **D-109** | `aud` 검증 생략 + 실값 기록 (V4′ 판정 불가 귀결) — **module-2 h1 실측으로 갱신**: claude.ai가 실제로 `resource` 파라미터를 보낸다(RFC 8707 지원 확인), Clerk가 이를 토큰 `aud`에 반영하는지는 h5에서 확인 | Design 확정 → 갱신 |
| **D-110** | Clerk production Frontend API 프록시(`/__clerk`)를 `server/routes/clerk-proxy.ts` 직접 구현으로 처리(패키지 미도입) | **Design 신규(§2.5)** — SSRF 클래스(GHSA-gjxx-92w9-8v8f) 구조적 차단, `app` basePath 밖이라 `root.ts` 경유(D-99b와 동일 패턴) |
| **D-99b** | `app`(basePath `/api`) 밖의 공개 경로(PRM·Clerk 프록시)는 `server/root.ts`에서 별도 합성 — `app`/`AppType`(프론트엔드 `hc<AppType>` 소비, `src/lib/api.ts`)은 구조 불변 | **Design 신규** — module-2 h1 중 PRM이 basePath 안에서 404 나던 것을 실측으로 발견·수정하며 확정 |
| — | issuer 이원 안전성: Clerk와 Neon Auth는 **issuer가 다르므로** 두 JWT 검증 경로가 자동 구분된다 (Plan D-100b N/A의 "왜 안전한가" 1줄 의무 이행) | 기록 |

## 10. 코딩 컨벤션

- `auth.ts`의 `unauthorized` 헬퍼를 export로 승격해 재사용 — 401 형식 사본 금지(§6).
- Design Ref 주석 규약(기존): 파일 헤더에 §2.1 절단면 설명 + D-106 3줄 필수.
- `server/`·`api/`에서 상대경로 import만(기존 Decision — Vercel 런타임 alias 미해석).

## 11. 구현 가이드

### 11.1 파일 변경 목록 (예측 — Check에서 실측 대조)

| 파일 | 종류 | 예상 | 실제(module-2 반영) |
|------|------|------|------|
| `server/middleware/mcp-auth.ts` | **신설** | ~60줄 | 계획대로 |
| `server/routes/prm.ts` | **신설** | ~20줄 | 계획대로 |
| `server/middleware/auth.ts` | 수정 | `unauthorized` export 1줄만 (§10) | 계획대로 |
| `server/app.ts` | 수정 | `/mcp` 마운트 교체 1줄 + PRM 마운트 1줄 | **PRM 마운트는 제거**(D-99b — basePath 밖이라 안 됨) |
| **`server/root.ts`** | — | (예측에 없었음) | **신설**(D-99b) — `app`+PRM 합성. `l1-harness.ts`도 이걸 import하도록 변경. **최종적으로 PRM만 남음**(Clerk 프록시는 §2.6에서 제거) |
| ~~`server/routes/clerk-proxy.ts`~~ | — | (예측에 없었음) | **신설(D-110) → 최종 삭제(§2.6)** — 커스텀 도메인 직결로 불필요해짐. 순생성 0 |
| **`api/[...route].ts`** | — | (예측에 없었음) | 수정 — `app` 대신 `root` export |
| `vercel.json` | 수정 | 라우트 1줄 | **최종 2줄**(`.well-known`·기존 `/api`) — `__clerk` 규칙은 추가됐다 제거됨 |
| `server/mcp-auth.l1.ts` | **신설** | a1~a7 | a1~a8, PRM 경로 수정 1회(D-99b 반영) |
| `.env.local` / Vercel env | 값 3종 | **형 수행** | **최종 3종 그대로** — `CLERK_SECRET_KEY`는 잠시 추가됐다 §2.6에서 다시 불필요해짐(순증 0) |

### 11.2 구현 순서

1. `auth.ts` `unauthorized` export → 2. `mcp-auth.ts`(fail-fast·검증·위임·헤더) → 3. `prm.ts` + `app.ts` 마운트
→ 4. `vercel.json` → 5. `mcp-auth.l1.ts` a1~a7 + 기존 L1 전건(a8) → 6. `tsc -b`·`oxlint`·`npm test`
→ 7. 배포 → 8. **curl: PRM 실경로(C54)·401 헤더(C53)** → 9. h1~h5(형)

### 11.3 Session Guide

| module | 범위 | 수행 |
|--------|------|------|
| **module-1** | 구현 순서 1~6 (코드 전체 + L1 그린) | CC |
| **module-2** | 7~8 (배포 + curl 실증) + h1~h5 릴레이 | CC + 형 |

Do 프롬프트 주의: **읽기 범위 제한**(Plan §6 진행 방식) — `server/middleware/`·`server/routes/`·`server/app.ts`·`vercel.json`·`server/*.l1.ts`·이 Design 문서로 한정. env 실값(issuer 제외)은 프롬프트에 싣지 않는다.

---

## Version History

| Version | Date | Changes | Author |
|---------|------|---------|--------|
| 1.2 | 2026-08-10 | **커스텀 도메인 확보로 프록시 전량 제거, OAuth 실연결 성공 — module-2 종료.** ①**§2.5에 폐기 경고 추가** + 배포 중 잡은 버그 2건 기록(body 버퍼링 0바이트, `fetch()` 기본 redirect 자동추종으로 "Page not found") ②**§2.6 신설** — Account Portal이 "vercel.app 도메인 미지원"으로 명시 거부되던 것을, 형이 커스텀 도메인(Cloudflare CNAME, 프록시 끄기 필요)을 구매·연결하며 해소. Clerk이 `clerk.<도메인>`(Frontend API)·`accounts.<도메인>`(Account Portal) DNS 직결을 제공 — **DCR이 실제로 201 성공**, `clerk-proxy.ts`·`CLERK_SECRET_KEY` 전량 삭제(순증 0으로 마감) ③**§3 env 표 최종값 갱신**(`CLERK_ISSUER`=커스텀 도메인) ④**§9 Decision Record·§11.1 파일 목록 최종 상태 반영** ⑤**§4.1 PRM 예시를 최종 실값으로 갱신** ⑥형이 claude.ai에서 Client ID/Secret 없이 URL만으로 커넥터 연결 + 툴 10종·프롬프트 2종 실호출 성공 확인(Plan C52~C57 Met) | Claude |
| 1.1 | 2026-08-10 | **module-2 실배포 중 발견 2건 반영.** ①**D-99b(PRM basePath 밖 마운트)** — Vercel의 `dest` URL 리라이트가 원경로를 그대로 보존한다는 사실을 curl 실측으로 확정(가정이 반증됨), `app`(basePath `/api`) 안에 PRM을 못 넣는다는 걸 발견해 `server/root.ts` 신설로 합성(`app`/`AppType`은 프론트엔드 RPC가 소비해 구조 불변). `l1-harness.ts`도 `root` 사용으로 전환, 배포·테스트가 같은 트리를 보게 함 ②**D-110(Clerk production 프록시)** — prod Clerk가 커스텀 도메인 프록시(`/__clerk`) 구조임을 발견, 단순 리라이트는 Clerk가 501로 거부(필수 헤더 3종 없음). 공식 문서(WebSearch)로 헤더 명세 확인, `server/routes/clerk-proxy.ts` 직접 구현(패키지 미도입, NFR-1 유지) — Clerk 공식 헬퍼의 실제 SSRF CVE(GHSA-gjxx-92w9-8v8f, `new URL(untrusted,base)`의 프로토콜 상대 URL 오해석)를 WebFetch로 확인 후 그 패턴을 구조적으로 배제. `CLERK_SECRET_KEY` 신규 env(§2.4·§3), §11.1 파일 목록·D-109(resource 파라미터 실측) 갱신 | Claude |
| 1.0 | 2026-08-10 | 최초 작성 — Checkpoint 3에서 형이 C안(신설+위임) 채택(`design-options.tmp` 회수·삭제). V8(위임 합성) 사전 실측 4케이스 전건 통과를 §2.3에 기록. D-105(fail-fast=분기 진입 시)·D-108(Clerk형 실패 시 legacy 재시도 금지)·D-109(`aud` 검증 생략+기록) 신규 확정 | Claude |
