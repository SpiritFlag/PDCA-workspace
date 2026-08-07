// Design Ref: §9.1 규칙 #2 — 파싱→서비스 호출→응답 변환만. Drizzle import 금지.
import { Hono } from 'hono'
import { zValidator } from '../lib/validate.js'
import { z } from 'zod'
import {
  createDocumentSchema,
  resolveLinksSchema,
  updateDocumentSchema,
} from '../../shared/schema.js'
import type { AuthEnv } from '../middleware/auth.js'
import * as documentsService from '../services/documents.js'

export const documentsRoute = new Hono<AuthEnv>()
  .get('/:id', async (c) => {
    const row = await documentsService.getDocument(c.get('ownerId'), c.req.param('id'))
    return c.json({ data: row })
  })
  .patch('/:id', zValidator('json', updateDocumentSchema), async (c) => {
    const row = await documentsService.updateDocument(
      c.get('ownerId'),
      c.req.param('id'),
      c.req.valid('json'),
    )
    return c.json({ data: row })
  })
  .delete('/:id', async (c) => {
    await documentsService.deleteDocument(c.get('ownerId'), c.req.param('id'))
    return c.body(null, 204)
  })

export const projectDocumentsRoute = new Hono<AuthEnv>()
  .get('/:projId/documents', async (c) => {
    const rows = await documentsService.listDocuments(c.get('ownerId'), c.req.param('projId'))
    return c.json({ data: rows })
  })
  .get('/:projId/documents/by-path', zValidator('query', z.object({ path: z.string() })), async (c) => {
    const { path } = c.req.valid('query')
    const row = await documentsService.getDocumentByPath(c.get('ownerId'), c.req.param('projId'), path)
    return c.json({ data: row })
  })
  .post('/:projId/documents', zValidator('json', createDocumentSchema), async (c) => {
    const row = await documentsService.createDocument(
      c.get('ownerId'),
      c.req.param('projId'),
      c.req.valid('json'),
    )
    return c.json({ data: row }, 201)
  })
  .post('/:projId/links/resolve', zValidator('json', resolveLinksSchema), async (c) => {
    const { paths } = c.req.valid('json')
    const existing = await documentsService.resolveLinks(c.get('ownerId'), c.req.param('projId'), paths)
    return c.json({ data: { existing } })
  })
  .get('/:projId/tree', zValidator('query', z.object({ prefix: z.string().default('') })), async (c) => {
    const { prefix } = c.req.valid('query')
    const tree = await documentsService.getDocumentTree(c.get('ownerId'), c.req.param('projId'), prefix)
    return c.json({ data: tree })
  })
