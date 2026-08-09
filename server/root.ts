// Design Ref: §4.1 — module-2 curl 실측(RK-67)으로 확정된 사실: Vercel의 `dest`
// (`/api/[...route]?...route=$1`)는 함수 선택용일 뿐, Hono가 실제로 받는 req.url은
// 원래 요청 경로 그대로다("/api/mcp" 요청 → "/api/mcp" 그대로, 재작성 없음).
// PRM(`/.well-known/...`)은 `/api` 접두어가 없는 경로라 `app`(basePath('/api'))
// 체인 안에 넣을 수 없다 — `app`/`AppType`은 프론트엔드 hc<AppType>가 그대로 소비하므로
// (src/lib/api.ts) 구조를 바꿀 수 없다. 그래서 이 파일에서 밖에서 합성한다.
// api/[...route].ts와 L1 하네스(l1-harness.ts)가 이 root를 함께 쓴다 — 실제 배포와
// 테스트가 같은 라우팅 트리를 보게 하기 위함.
//
// Decision: [Do] `/__clerk` 리버스 프록시(clerk-proxy.ts)는 커스텀 도메인(Clerk 자체
// Account Portal 활성화) 확보 후 제거했다 — Clerk가 `clerk.<커스텀도메인>`을 DNS로 직결
// 제공해 우리가 헤더 주입·SSRF 방어까지 직접 구현하던 프록시 자체가 불필요해졌다(실측 2026-08-10,
// 직결로 DCR 등록 201 확인). `CLERK_SECRET_KEY`도 이제 필요 없다.
import { Hono } from 'hono'
import { app } from './app.js'
import { prmRoute } from './routes/prm.js'

export const root = new Hono()
  .route('/', app)
  .route('/.well-known/oauth-protected-resource/api/mcp', prmRoute)
