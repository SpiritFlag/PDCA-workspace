// Design Ref: §4.1, §9.1 — 파싱→서비스 호출→응답 변환만. 목록 응답에 tokenHash 없음(서비스가 이미 제외).
import { Hono } from 'hono'
import { zValidator } from '../lib/validate.js'
import { createApiTokenSchema } from '../../shared/schema.js'
import type { AuthEnv } from '../middleware/auth.js'
import * as tokensService from '../services/tokens.js'

export const tokensRoute = new Hono<AuthEnv>()
  .get('/', async (c) => {
    const rows = await tokensService.listTokens(c.get('ownerId'))
    return c.json({ data: rows })
  })
  .post('/', zValidator('json', createApiTokenSchema), async (c) => {
    const row = await tokensService.issueToken(c.get('ownerId'), c.req.valid('json').name)
    return c.json({ data: row }, 201)
  })
  .delete('/:id', async (c) => {
    await tokensService.revokeToken(c.get('ownerId'), c.req.param('id'))
    return c.body(null, 204)
  })
