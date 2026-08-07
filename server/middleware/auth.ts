// Design Ref: §7 보안 (RK-03) — Neon Auth(Stack Auth) JWT를 JWKS로 검증해 ownerId를 주입한다.
// 세션 쿠키 방식이 Vite SPA에서 막히면 이 Bearer 토큰 방식이 기본안이다 (Plan RK-03 대안).
// Design Ref: §4.2 — pdcaw_ 접두어면 PAT 경로(해시 조회), 그 외는 기존 JWKS JWT 경로(무변경).
import { createMiddleware } from 'hono/factory'
import { HTTPException } from 'hono/http-exception'
import { createRemoteJWKSet, jwtVerify } from 'jose'
import { isPatToken } from '../lib/token.js'
import { authenticateToken } from '../services/tokens.js'

export type AuthEnv = {
  Variables: {
    ownerId: string
  }
}

let _jwks: ReturnType<typeof createRemoteJWKSet> | null = null

// Decision: [Do] Neon Auth의 실제 제공자는 Stack Auth가 아니라 better_auth였다 (Plan RK-03 실증).
// JWKS URL은 프로젝트 전역이 아니라 Neon 브랜치(=DB 엔드포인트)별로 다르므로 env로 주입한다.
// `neonctl neon-auth status --branch <dev|production>` 출력의 JWKS URL을 그대로 사용.
function getJwks() {
  if (_jwks) return _jwks
  const jwksUrl = process.env.NEON_AUTH_JWKS_URL
  if (!jwksUrl) throw new Error('NEON_AUTH_JWKS_URL is not set')
  _jwks = createRemoteJWKSet(new URL(jwksUrl))
  return _jwks
}

function unauthorized(message: string) {
  return new HTTPException(401, {
    res: Response.json({ error: { code: 'UNAUTHORIZED', message } }, { status: 401 }),
  })
}

/** Plan SC: C2 — 로그인 없이는 어떤 데이터도 조회되지 않는다 */
export const authMiddleware = createMiddleware<AuthEnv>(async (c, next) => {
  const authHeader = c.req.header('Authorization')
  const token = authHeader?.startsWith('Bearer ') ? authHeader.slice('Bearer '.length) : null

  if (!token) {
    throw unauthorized('Missing bearer token')
  }

  if (isPatToken(token)) {
    const ownerId = await authenticateToken(token)
    if (!ownerId) throw unauthorized('Invalid or revoked token')
    c.set('ownerId', ownerId)
    await next()
    return
  }

  try {
    const { payload } = await jwtVerify(token, getJwks())
    if (!payload.sub) throw new Error('token has no sub claim')
    c.set('ownerId', payload.sub)
  } catch {
    throw unauthorized('Invalid or expired token')
  }

  await next()
})
