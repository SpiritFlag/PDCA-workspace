// Design Ref: §2.0·§5 C안(신설+위임) — v0.2.1 컷오버: 아래 "위임 가지"(catch 블록 포함)만
// 삭제하면 legacy가 끊긴다. 이 파일 자체를 삭제하면 OAuth가 롤백된다. 절단면은 이 둘뿐이다.
//
// 왜 IdP가 2개인가(Clerk here / Neon Auth in auth.ts): Plan V1 — Neon Auth는 매니지드라
// OIDC provider를 켤 수 없음이 대시보드+API 2원 실측으로 확정됐다. 백로그 RK-74(웹 UI까지
// Clerk로 통일 + Neon Auth 제거)가 이 분열을 끝낼 종료 계획이다.
//
// 다중 사용자 전환 시: resolveOwnerId 함수 본문만 테이블 조회로 교체하면 된다(Plan D-106) —
// 지금은 형 1인이라 env 매핑 1쌍으로 충분하다(Plan V5, 형 진술 확정).
import { createMiddleware } from 'hono/factory'
import { HTTPException } from 'hono/http-exception'
import { createRemoteJWKSet, decodeJwt, jwtVerify } from 'jose'
import { ServiceError } from '../lib/errors.js'
import { isPatToken } from '../lib/token.js'
import { authMiddleware, unauthorized, type AuthEnv } from './auth.js'

let _clerkJwks: ReturnType<typeof createRemoteJWKSet> | null = null

function clerkIssuer(): string {
  const issuer = process.env.CLERK_ISSUER
  if (!issuer) throw new Error('CLERK_ISSUER is not set')
  return issuer
}

function clerkJwks() {
  if (_clerkJwks) return _clerkJwks
  _clerkJwks = createRemoteJWKSet(new URL(`${clerkIssuer()}/.well-known/jwks.json`))
  return _clerkJwks
}

// Design Ref: §2.1 — 서명 검증 전 프리디코드. 분기 결정에만 쓴다(신뢰 근거 아님) —
// ownerId 주입은 반드시 jwtVerify 성공 이후에만 일어난다(§1.2·§7 보안 원칙).
function isClerkIssued(token: string): boolean {
  try {
    const { iss } = decodeJwt(token)
    return iss === process.env.CLERK_ISSUER
  } catch {
    return false
  }
}

// Design Ref: §3.1 D-105 — fail-fast는 모듈 로드 시가 아니라 "분기 진입 시"로 확정.
// 이 서버리스 함수는 전 API를 서빙하므로, 모듈 로드 시 throw하면 웹 UI·pdcaw까지 죽는다(RK-70).
function assertOAuthEnv(): { issuer: string; subject: string; ownerId: string } {
  const issuer = process.env.CLERK_ISSUER
  const subject = process.env.MCP_OAUTH_SUBJECT
  const ownerId = process.env.MCP_OAUTH_OWNER_ID
  const missing = [
    !issuer && 'CLERK_ISSUER',
    !subject && 'MCP_OAUTH_SUBJECT',
    !ownerId && 'MCP_OAUTH_OWNER_ID',
  ].filter(Boolean)
  if (missing.length > 0) {
    throw new ServiceError('INTERNAL', `OAuth env not configured: ${missing.join(', ')}`)
  }
  return { issuer: issuer as string, subject: subject as string, ownerId: ownerId as string }
}

// Design Ref: §5 D-106 — 다중 사용자 전환 시 이 함수 본문만 테이블 조회로 교체.
function resolveOwnerId(sub: string | undefined, expectedSubject: string, ownerId: string) {
  if (!sub || sub !== expectedSubject) throw unauthorized('Invalid or expired token')
  return ownerId
}

function withWwwAuthenticate(err: unknown, c: { req: { url: string } }): unknown {
  if (!(err instanceof HTTPException) || err.status !== 401) return err
  const origin = new URL(c.req.url).origin
  const resourceMetadata = `${origin}/.well-known/oauth-protected-resource/api/mcp`
  const res = err.getResponse()
  const headers = new Headers(res.headers)
  headers.set('WWW-Authenticate', `Bearer resource_metadata="${resourceMetadata}"`)
  return new HTTPException(401, { res: new Response(res.body, { status: 401, headers }) })
}

/** Design Ref: §5 — OAuth(Clerk) 검증 + legacy 위임. Plan SC: C52·C53·C55·C56 */
export const mcpAuth = createMiddleware<AuthEnv>(async (c, next) => {
  const authHeader = c.req.header('Authorization')
  const token = authHeader?.startsWith('Bearer ') ? authHeader.slice('Bearer '.length) : null

  if (token && !isPatToken(token) && isClerkIssued(token)) {
    const { issuer, subject, ownerId } = assertOAuthEnv()
    // Design Ref: §5 D-108 — Clerk형 JWT 검증 실패 시 legacy로 재시도하지 않는다(구조적 차단).
    try {
      const { payload } = await jwtVerify(token, clerkJwks(), { issuer })
      c.set('ownerId', resolveOwnerId(payload.sub, subject, ownerId))
    } catch (e) {
      if (e instanceof HTTPException) throw withWwwAuthenticate(e, c)
      throw withWwwAuthenticate(unauthorized('Invalid or expired token'), c)
    }
    await next()
    return
  }

  try {
    await authMiddleware(c, next)
  } catch (e) {
    throw withWwwAuthenticate(e, c)
  }
})
