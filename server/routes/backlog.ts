// 백로그 CRUD + 순서 일괄 저장. actor는 항상 'user'(REST 경로).
// MCP 어댑터는 같은 backlog 서비스를 actor='mcp'로 호출한다.
// pdca-skill v1 §9.2: 목록 필터(status·stale·q·summary)와 단건 GET, PATCH appendDetail.
import { Hono } from 'hono'
import { zValidator } from '../lib/validate.js'
import {
  backlogListQuerySchema,
  createBacklogItemSchema,
  reorderBacklogSchema,
  updateBacklogItemSchema,
} from '../../shared/schema.js'
import type { AuthEnv } from '../middleware/auth.js'
import * as backlogService from '../services/backlog.js'

export const projectBacklogRoute = new Hono<AuthEnv>()
  .get('/:projId/backlog', zValidator('query', backlogListQuerySchema), async (c) => {
    const opts = backlogService.parseListOptions(c.req.valid('query'))
    const rows = await backlogService.listBacklog(c.get('ownerId'), c.req.param('projId'), opts)
    return c.json({ data: rows })
  })
  // 요약(detail 없음). 응답 타입이 전체 행과 유니온이 되지 않게 경로로 가른다.
  .get('/:projId/backlog/summary', zValidator('query', backlogListQuerySchema), async (c) => {
    const opts = backlogService.parseListOptions(c.req.valid('query'))
    const rows = await backlogService.listBacklogSummary(c.get('ownerId'), c.req.param('projId'), opts)
    return c.json({ data: rows })
  })
  .post('/:projId/backlog', zValidator('json', createBacklogItemSchema), async (c) => {
    const row = await backlogService.createBacklogItem(
      c.get('ownerId'),
      c.req.param('projId'),
      c.req.valid('json'),
    )
    return c.json({ data: row }, 201)
  })
  .put('/:projId/backlog/order', zValidator('json', reorderBacklogSchema), async (c) => {
    const { ids } = c.req.valid('json')
    await backlogService.reorderBacklog(c.get('ownerId'), c.req.param('projId'), ids)
    return c.json({ data: { ok: true } })
  })

export const backlogItemRoute = new Hono<AuthEnv>()
  .get('/:id', async (c) => {
    const row = await backlogService.getBacklogItem(c.get('ownerId'), c.req.param('id'))
    return c.json({ data: row })
  })
  .patch('/:id', zValidator('json', updateBacklogItemSchema), async (c) => {
    const row = await backlogService.updateBacklogItem(
      c.get('ownerId'),
      c.req.param('id'),
      c.req.valid('json'),
      'user',
    )
    return c.json({ data: row })
  })
  .delete('/:id', async (c) => {
    await backlogService.deleteBacklogItem(c.get('ownerId'), c.req.param('id'))
    return c.body(null, 204)
  })
