// Design Ref: §4.1 — Protected Resource Metadata(RFC 9728). 인증 불요, env와 무관하게 항상 응답
// (메타데이터는 정적 사실 — CLERK_ISSUER 미설정이어도 이 라우트는 죽지 않아야 한다).
// Design Ref: §4.1 — vercel.json의 well-known 라우트가 이 경로를 /api/.well-known/... 로
// 매핑한다고 가정하고 작성(구현 시점 미실측). 실경로 확정은 module-2 배포 후 curl(C54, RK-67).
import { Hono } from 'hono'

export const prmRoute = new Hono().get('/', (c) => {
  const origin = new URL(c.req.url).origin
  return c.json({
    resource: `${origin}/api/mcp`,
    authorization_servers: [process.env.CLERK_ISSUER ?? ''],
  })
})
