// 로컬 개발 전용 — server/app.ts의 Hono 앱을 상주 프로세스로 띄운다.
// vercel dev는 API 요청마다 함수를 재초기화해 매번 ~2초 오버헤드가 있었다. 이 서버는 프로세스가 살아있어
// JWKS 캐시·DB 커넥션이 재사용돼 응답이 수백 ms로 떨어진다. 프로덕션 배포는 여전히 api/[...route].ts를 쓴다.
import { serve } from '@hono/node-server'
import { app } from './app.js'

const port = Number(process.env.API_PORT ?? 3001)

serve({ fetch: app.fetch, port }, (info) => {
  console.log(`[dev-api] Hono API 서버 http://localhost:${info.port} (상주 프로세스)`)
})
