// Design Ref: §4.1 — module-2 curl 실측(RK-67)으로 확정된 사실: Vercel의 `dest`
// (`/api/[...route]?...route=$1`)는 함수 선택용일 뿐, Hono가 실제로 받는 req.url은
// 원래 요청 경로 그대로다("/api/mcp" 요청 → "/api/mcp" 그대로, 재작성 없음).
// PRM(`/.well-known/...`)은 `/api` 접두어가 없는 경로라 `app`(basePath('/api'))
// 체인 안에 넣을 수 없다 — `app`/`AppType`은 프론트엔드 hc<AppType>가 그대로 소비하므로
// (src/lib/api.ts) 구조를 바꿀 수 없다. 그래서 이 파일에서 밖에서 합성한다.
// api/[...route].ts와 L1 하네스(l1-harness.ts)가 이 root를 함께 쓴다 — 실제 배포와
// 테스트가 같은 라우팅 트리를 보게 하기 위함.
import { Hono } from 'hono'
import { app } from './app.js'
import { prmRoute } from './routes/prm.js'

export const root = new Hono()
  .route('/', app)
  .route('/.well-known/oauth-protected-resource/api/mcp', prmRoute)
