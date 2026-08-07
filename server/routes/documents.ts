// Design Ref: §4.2 — Document CRUD + by-path 조회 + 링크 존재 판정(resolve).
import { Hono } from 'hono'
import { zValidator } from '../lib/validate.js'
import { z } from 'zod'
import {
  createDocumentSchema,
  resolveLinksSchema,
  updateDocumentSchema,
} from '../../shared/schema.js'
import type { AuthEnv } from '../middleware/auth.js'
import {
  createDocument,
  deleteDocument,
  getDocument,
  getDocumentByPath,
  getProject,
  listByPrefix,
  listDocuments,
  resolveExistingPaths,
  updateDocument,
} from '../db/scoped.js'
import { normalizePath } from '../lib/path.js'

export const documentsRoute = new Hono<AuthEnv>()
  .get('/:id', async (c) => {
    const row = await getDocument(c.get('ownerId'), c.req.param('id'))
    if (!row) return c.json({ error: { code: 'NOT_FOUND' } }, 404)
    return c.json({ data: row })
  })
  .patch('/:id', zValidator('json', updateDocumentSchema), async (c) => {
    const input = c.req.valid('json')
    if (input.path !== undefined) {
      try {
        input.path = normalizePath(input.path)
      } catch {
        return c.json(
          { error: { code: 'VALIDATION_ERROR', details: { fieldErrors: { path: ['invalid path'] } } } },
          400,
        )
      }
    }
    const result = await updateDocument(c.get('ownerId'), c.req.param('id'), input)
    if ('error' in result) {
      if (result.error === 'NOT_FOUND') return c.json({ error: { code: 'NOT_FOUND' } }, 404)
      return c.json({ error: { code: 'PATH_TAKEN', path: result.path } }, 409)
    }
    return c.json({ data: result.document })
  })
  .delete('/:id', async (c) => {
    const ok = await deleteDocument(c.get('ownerId'), c.req.param('id'))
    if (!ok) return c.json({ error: { code: 'NOT_FOUND' } }, 404)
    return c.body(null, 204)
  })

export const projectDocumentsRoute = new Hono<AuthEnv>()
  .get('/:projId/documents', async (c) => {
    const project = await getProject(c.get('ownerId'), c.req.param('projId'))
    if (!project) return c.json({ error: { code: 'NOT_FOUND' } }, 404)
    const rows = await listDocuments(c.get('ownerId'), c.req.param('projId'))
    return c.json({ data: rows })
  })
  .get('/:projId/documents/by-path', zValidator('query', z.object({ path: z.string() })), async (c) => {
    // Decision: [Do] Check 단계 발견(Critical) — 클라이언트가 보낸 path를 그대로 신뢰하지 않는다.
    // Design §7: "resolve 시 서버 재정규화 — 클라이언트 정규화를 신뢰하지 않음". 정규화 실패는 곧 미존재.
    const { path } = c.req.valid('query')
    let normalized: string
    try {
      normalized = normalizePath(path)
    } catch {
      return c.json({ error: { code: 'NOT_FOUND' } }, 404)
    }
    const row = await getDocumentByPath(c.get('ownerId'), c.req.param('projId'), normalized)
    if (!row) return c.json({ error: { code: 'NOT_FOUND' } }, 404)
    return c.json({ data: row })
  })
  .post('/:projId/documents', zValidator('json', createDocumentSchema), async (c) => {
    const input = c.req.valid('json')
    let normalizedPath: string
    try {
      normalizedPath = normalizePath(input.path)
    } catch {
      return c.json(
        { error: { code: 'VALIDATION_ERROR', details: { fieldErrors: { path: ['invalid path'] } } } },
        400,
      )
    }
    const result = await createDocument(c.get('ownerId'), c.req.param('projId'), {
      ...input,
      path: normalizedPath,
    })
    if ('error' in result) {
      if (result.error === 'PROJECT_NOT_FOUND') return c.json({ error: { code: 'NOT_FOUND' } }, 404)
      return c.json({ error: { code: 'PATH_TAKEN', path: result.path } }, 409)
    }
    return c.json({ data: result.document }, 201)
  })
  .post('/:projId/links/resolve', zValidator('json', resolveLinksSchema), async (c) => {
    // Decision: [Do] Check 단계 발견(Critical) — 후보 경로도 서버가 재정규화한다.
    // 정규화에 실패하는 후보(예: '..' 포함)는 조용히 걸러낸다 — 배치 존재 판정이라 하나가
    // 무효라고 요청 전체를 400으로 실패시킬 이유가 없다.
    const { paths } = c.req.valid('json')
    const normalized: string[] = []
    for (const p of paths) {
      try {
        normalized.push(normalizePath(p))
      } catch {
        // skip invalid candidate
      }
    }
    const existing = await resolveExistingPaths(c.get('ownerId'), c.req.param('projId'), normalized)
    return c.json({ data: { existing } })
  })
  .get('/:projId/tree', zValidator('query', z.object({ prefix: z.string().default('') })), async (c) => {
    // Design Ref: FR-09 — prefix 하위 문서·하위 폴더를 한 번에. 정규화(선행 '/' 제거)는 하되 trailing '/'는 보존.
    const { prefix } = c.req.valid('query')
    const normalizedPrefix = prefix.replace(/^\/+/, '')
    const rows = await listByPrefix(c.get('ownerId'), c.req.param('projId'), normalizedPrefix)

    const documents: typeof rows = []
    const folderNames = new Set<string>()
    for (const row of rows) {
      const rest = row.path.slice(normalizedPrefix.length)
      const slashIdx = rest.indexOf('/')
      if (slashIdx === -1) {
        documents.push(row)
      } else {
        folderNames.add(rest.slice(0, slashIdx))
      }
    }
    const folders = [...folderNames]
      .sort()
      .map((name) => ({ name, path: `${normalizedPrefix}${name}/` }))

    return c.json({ data: { folders, documents } })
  })
