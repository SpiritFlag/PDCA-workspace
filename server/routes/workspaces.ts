// Design Ref: §9.1 규칙 #2 — 파싱→서비스 호출→응답 변환만. Drizzle import 금지.
import { Hono } from 'hono'
import { zValidator } from '../lib/validate.js'
import { createWorkspaceSchema, updateWorkspaceSchema } from '../../shared/schema.js'
import type { AuthEnv } from '../middleware/auth.js'
import * as workspacesService from '../services/workspaces.js'

export const workspacesRoute = new Hono<AuthEnv>()
  .get('/', async (c) => {
    const rows = await workspacesService.listWorkspaces(c.get('ownerId'))
    return c.json({ data: rows })
  })
  .post('/', zValidator('json', createWorkspaceSchema), async (c) => {
    const row = await workspacesService.createWorkspace(c.get('ownerId'), c.req.valid('json'))
    return c.json({ data: row }, 201)
  })
  .get('/:id', async (c) => {
    const row = await workspacesService.getWorkspace(c.get('ownerId'), c.req.param('id'))
    return c.json({ data: row })
  })
  .patch('/:id', zValidator('json', updateWorkspaceSchema), async (c) => {
    const row = await workspacesService.updateWorkspace(
      c.get('ownerId'),
      c.req.param('id'),
      c.req.valid('json'),
    )
    return c.json({ data: row })
  })
  .delete('/:id', async (c) => {
    await workspacesService.deleteWorkspace(c.get('ownerId'), c.req.param('id'))
    return c.body(null, 204)
  })
