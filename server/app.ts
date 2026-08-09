// Design Ref: §9.1 경계 규칙 #1 — api/ 진입점은 이 앱을 export만 한다. 로직은 전부 여기.
// Decision: [Do] Hono RPC 타입 추론은 라우트 체이닝이 하나의 표현식일 때만 정확하다.
// app.get(...)을 별도 문장으로 쓰면 AppType에서 라우트 정보가 소실된다 — 항상 .method().method()로 이어붙일 것.
// Decision: [Do] server/·api/ 아래에서 shared/ 등을 참조할 때는 @shared 별칭 대신 상대경로만 쓴다.
// alias는 Vite(브라우저 번들)만 해석하고 Vercel Node 함수 런타임은 해석 못 해 ERR_MODULE_NOT_FOUND로 죽는다.
import { Hono } from 'hono'
import { HTTPException } from 'hono/http-exception'
import { authMiddleware, type AuthEnv } from './middleware/auth.js'
import { mcpAuth } from './middleware/mcp-auth.js'
import { workspacesRoute } from './routes/workspaces.js'
import { projectsRoute, workspaceProjectsRoute } from './routes/projects.js'
import { documentsRoute, projectDocumentsRoute } from './routes/documents.js'
import { cycleItemRoute, projectCyclesRoute } from './routes/cycles.js'
import { backlogItemRoute, projectBacklogRoute } from './routes/backlog.js'
import { tokensRoute } from './routes/tokens.js'
import { mcpRoute } from './mcp/index.js'
import { ServiceError } from './lib/errors.js'

const app = new Hono<AuthEnv>()
  .basePath('/api')
  .get('/health', (c) => c.json({ data: { status: 'ok' } }))
  .use('/me', authMiddleware)
  .get('/me', (c) => c.json({ data: { ownerId: c.get('ownerId') } }))
  .use('/workspaces/*', authMiddleware)
  .route('/workspaces', workspacesRoute)
  .route('/workspaces', workspaceProjectsRoute)
  .use('/projects/*', authMiddleware)
  .route('/projects', projectsRoute)
  .route('/projects', projectDocumentsRoute)
  .route('/projects', projectCyclesRoute)
  .route('/projects', projectBacklogRoute)
  .use('/documents/*', authMiddleware)
  .route('/documents', documentsRoute)
  .use('/cycles/*', authMiddleware)
  .route('/cycles', cycleItemRoute)
  .use('/backlog/*', authMiddleware)
  .route('/backlog', backlogItemRoute)
  .use('/tokens/*', authMiddleware)
  .route('/tokens', tokensRoute)
  .use('/mcp', mcpAuth)
  .route('/mcp', mcpRoute)
  .onError((err, c) => {
    // Decision: [Do] 전체 회귀 스윕에서 발견 — HTTPException(예: authMiddleware의 401)을
    // 이 핸들러가 무조건 500으로 덮어쓰고 있었다. 의도된 응답은 그대로 통과시킨다.
    if (err instanceof HTTPException) return err.getResponse()
    // Design Ref: §6.2 ServiceError → 어댑터 매핑. message가 빈 문자열이면 필드 자체를 생략해
    // 서비스 추출 이전 라우트의 응답 바디와 byte-동일하게 유지한다(module-1 무회귀 조건).
    if (err instanceof ServiceError) {
      const body: { error: { code: string; message?: string; details?: unknown } } = {
        error: { code: err.code },
      }
      if (err.message) body.error.message = err.message
      if (err.details) body.error.details = err.details
      return c.json(body, err.status as 400 | 401 | 403 | 404 | 409 | 500)
    }
    // Decision: [Do] postgres unique violation(23505)이 raw 500으로 새던 버그 수정 — 409로 통일 변환
    const code = (err as { cause?: { code?: string } })?.cause?.code
    if (code === '23505') {
      return c.json({ error: { code: 'CONFLICT', message: '이미 존재하는 값입니다' } }, 409)
    }
    console.error(err)
    return c.json({ error: { code: 'INTERNAL', message: 'Internal Server Error' } }, 500)
  })

export { app }
export type AppType = typeof app
