// Design Ref: §9.1 규칙 #2 — 파싱→서비스 호출→응답 변환만. Drizzle import 금지.
import { Hono } from 'hono'
import { zValidator } from '../lib/validate.js'
import { createProjectSchema, updateProjectSchema } from '../../shared/schema.js'
import type { AuthEnv } from '../middleware/auth.js'
import * as projectsService from '../services/projects.js'

export const projectsRoute = new Hono<AuthEnv>()
  .get('/:id', async (c) => {
    const row = await projectsService.getProject(c.get('ownerId'), c.req.param('id'))
    return c.json({ data: row })
  })
  .patch('/:id', zValidator('json', updateProjectSchema), async (c) => {
    const row = await projectsService.updateProject(
      c.get('ownerId'),
      c.req.param('id'),
      c.req.valid('json'),
    )
    return c.json({ data: row })
  })
  .delete('/:id', async (c) => {
    await projectsService.deleteProject(c.get('ownerId'), c.req.param('id'))
    return c.body(null, 204)
  })

export const workspaceProjectsRoute = new Hono<AuthEnv>()
  .get('/:wsId/projects', async (c) => {
    const rows = await projectsService.listProjectsInWorkspace(c.get('ownerId'), c.req.param('wsId'))
    return c.json({ data: rows })
  })
  .post('/:wsId/projects', zValidator('json', createProjectSchema), async (c) => {
    const row = await projectsService.createProjectInWorkspace(
      c.get('ownerId'),
      c.req.param('wsId'),
      c.req.valid('json'),
    )
    return c.json({ data: row }, 201)
  })
