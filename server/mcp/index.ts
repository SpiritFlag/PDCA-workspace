// Design Ref: §4.3 MCP 엔드포인트 — 공식 SDK + @hono/mcp, stateless(요청마다 서버·트랜스포트 새로 생성).
// GET·DELETE는 405(서버→클라 푸시 없음). Origin은 존재하고 자기 도메인이 아니면 403(부재=CLI는 통과, 사양 MUST).
import { Hono } from 'hono'
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { StreamableHTTPTransport } from '@hono/mcp'
import type { AuthEnv } from '../middleware/auth.js'
import { registerTools } from './tools.js'
import { registerPrompts } from './prompts.js'
import { ServiceError } from '../lib/errors.js'

export const mcpRoute = new Hono<AuthEnv>()
  .post('/', async (c) => {
    const origin = c.req.header('origin')
    // Design Ref: §4.3, §9.1 규칙 6 — 에러 응답은 ServiceError만 경유(표 밖 리터럴 응답 금지)
    if (origin && origin !== new URL(c.req.url).origin) {
      throw new ServiceError('FORBIDDEN', 'Invalid Origin')
    }

    // Design Ref: §4.3 — ownerId별로 서버·트랜스포트를 새로 만드는 게 곧 stateless의 실체.
    // 세션 대신 요청마다 인스턴스를 격리하므로 동시 요청 간 ownerId 혼선이 구조적으로 불가능하다.
    const server = new McpServer({ name: 'pdca-workspace', version: '1.0.0' })
    registerTools(server, c.get('ownerId'))
    // Design Ref: §2.1 RK-57 — connect() 이전에만 capability 등록이 유효하다.
    // 이후로 옮기면 SDK가 registerCapabilities에서 throw한다.
    registerPrompts(server)
    const transport = new StreamableHTTPTransport({
      sessionIdGenerator: undefined,
      enableJsonResponse: true,
    })

    try {
      await server.connect(transport)
      const res = await transport.handleRequest(c)
      return res ?? c.body(null, 500)
    } finally {
      await server.close()
    }
  })
  .get('/', (c) => c.body(null, 405))
  .delete('/', (c) => c.body(null, 405))
