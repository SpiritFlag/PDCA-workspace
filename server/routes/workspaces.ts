// Design Ref: §4.1 — Workspace CRUD. 전 핸들러가 scoped.ts만 거쳐 ownerId 우회를 원천 차단.
import { Hono } from 'hono'
import { zValidator } from '../lib/validate.js'
import { createWorkspaceSchema, updateWorkspaceSchema } from '../../shared/schema.js'
import type { AuthEnv } from '../middleware/auth.js'
import {
  createWorkspace,
  deleteWorkspace,
  getWorkspace,
  listWorkspaces,
  updateWorkspace,
} from '../db/scoped.js'

export const workspacesRoute = new Hono<AuthEnv>()
  .get('/', async (c) => {
    const rows = await listWorkspaces(c.get('ownerId'))
    return c.json({ data: rows })
  })
  .post('/', zValidator('json', createWorkspaceSchema), async (c) => {
    const row = await createWorkspace(c.get('ownerId'), c.req.valid('json'))
    return c.json({ data: row }, 201)
  })
  .get('/:id', async (c) => {
    const row = await getWorkspace(c.get('ownerId'), c.req.param('id'))
    if (!row) return c.json({ error: { code: 'NOT_FOUND' } }, 404)
    return c.json({ data: row })
  })
  .patch('/:id', zValidator('json', updateWorkspaceSchema), async (c) => {
    const row = await updateWorkspace(c.get('ownerId'), c.req.param('id'), c.req.valid('json'))
    if (!row) return c.json({ error: { code: 'NOT_FOUND' } }, 404)
    return c.json({ data: row })
  })
  .delete('/:id', async (c) => {
    const ok = await deleteWorkspace(c.get('ownerId'), c.req.param('id'))
    if (!ok) return c.json({ error: { code: 'NOT_FOUND' } }, 404)
    return c.body(null, 204)
  })
