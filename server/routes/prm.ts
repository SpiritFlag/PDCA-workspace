// Design Ref: §4.1 — Protected Resource Metadata(RFC 9728). 인증 불요, env와 무관하게 항상 응답
// (메타데이터는 정적 사실 — CLERK_ISSUER 미설정이어도 이 라우트는 죽지 않아야 한다).
// Design Ref: §4.1·D-99b — Vercel의 dest는 함수 선택용일 뿐 원래 요청 경로를 그대로 보존한다
// (curl 실측으로 확정, root.ts 참조). 그래서 이 라우트는 app(basePath /api) 밖의 root.ts에서
// /.well-known/oauth-protected-resource/api/mcp 경로로 직접 마운트된다.
import { Hono } from 'hono'

export const prmRoute = new Hono().get('/', (c) => {
  const origin = new URL(c.req.url).origin
  const issuer = process.env.CLERK_ISSUER
  return c.json({
    resource: `${origin}/api/mcp`,
    // Check Gap M-2 — issuer 미설정 시 [""] 같은 RFC 9728상 무의미한 값 대신 빈 배열.
    authorization_servers: issuer ? [issuer] : [],
  })
})
