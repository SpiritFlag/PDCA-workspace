// Design Ref: §4.1 — Project CRUD. workspace 하위 목록/생성 + 개별 조회/수정/삭제.
import { Hono } from 'hono'
import { zValidator } from '../lib/validate.js'
import { createProjectSchema, updateProjectSchema } from '../../shared/schema.js'
import type { AuthEnv } from '../middleware/auth.js'
import {
  createProject,
  deleteProject,
  getProject,
  getWorkspace,
  listProjects,
  updateProject,
} from '../db/scoped.js'

export const projectsRoute = new Hono<AuthEnv>()
  .get('/:id', async (c) => {
    const row = await getProject(c.get('ownerId'), c.req.param('id'))
    if (!row) return c.json({ error: { code: 'NOT_FOUND' } }, 404)
    return c.json({ data: row })
  })
  .patch('/:id', zValidator('json', updateProjectSchema), async (c) => {
    const row = await updateProject(c.get('ownerId'), c.req.param('id'), c.req.valid('json'))
    if (!row) return c.json({ error: { code: 'NOT_FOUND' } }, 404)
    return c.json({ data: row })
  })
  .delete('/:id', async (c) => {
    const ok = await deleteProject(c.get('ownerId'), c.req.param('id'))
    if (!ok) return c.json({ error: { code: 'NOT_FOUND' } }, 404)
    return c.body(null, 204)
  })

export const workspaceProjectsRoute = new Hono<AuthEnv>()
  .get('/:wsId/projects', async (c) => {
    const ws = await getWorkspace(c.get('ownerId'), c.req.param('wsId'))
    if (!ws) return c.json({ error: { code: 'NOT_FOUND' } }, 404)
    const rows = await listProjects(c.get('ownerId'), c.req.param('wsId'))
    return c.json({ data: rows })
  })
  .post('/:wsId/projects', zValidator('json', createProjectSchema), async (c) => {
    const row = await createProject(c.get('ownerId'), c.req.param('wsId'), c.req.valid('json'))
    if (!row) return c.json({ error: { code: 'NOT_FOUND', message: 'workspace not found' } }, 404)
    return c.json({ data: row }, 201)
  })
