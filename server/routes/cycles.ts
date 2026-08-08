// PDCA 사이클 CRUD. documents/backlog와 동일한 2분할(프로젝트 하위 / 단건) 라우트 패턴.
import { Hono } from 'hono'
import { zValidator } from '../lib/validate.js'
import { createCycleSchema, updateCycleSchema } from '../../shared/schema.js'
import type { AuthEnv } from '../middleware/auth.js'
import * as cycleService from '../services/cycles.js'

export const projectCyclesRoute = new Hono<AuthEnv>()
  .get('/:projId/cycles', async (c) => {
    const rows = await cycleService.listCycles(c.get('ownerId'), c.req.param('projId'))
    return c.json({ data: rows })
  })
  .post('/:projId/cycles', zValidator('json', createCycleSchema), async (c) => {
    const row = await cycleService.createCycle(
      c.get('ownerId'),
      c.req.param('projId'),
      c.req.valid('json'),
    )
    return c.json({ data: row }, 201)
  })

export const cycleItemRoute = new Hono<AuthEnv>()
  .patch('/:id', zValidator('json', updateCycleSchema), async (c) => {
    const row = await cycleService.updateCycle(
      c.get('ownerId'),
      c.req.param('id'),
      c.req.valid('json'),
    )
    return c.json({ data: row })
  })
  .delete('/:id', async (c) => {
    await cycleService.deleteCycle(c.get('ownerId'), c.req.param('id'))
    return c.body(null, 204)
  })
