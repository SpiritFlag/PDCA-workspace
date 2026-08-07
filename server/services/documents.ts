// Design Ref: §9.1 — 기존 routes/documents.ts에서 기계적 추출.
// Design Ref: §6.1 FR-20 — 이 파일이 PATH_TAKEN → CONFLICT(details.target: 'path') 통일 지점.
import * as db from '../db/scoped.js'
import { ServiceError } from '../lib/errors.js'
import { normalizePath } from '../lib/path.js'
import type { CreateDocumentInput, UpdateDocumentInput } from '../../shared/schema.js'

function normalizeOrThrow(path: string): string {
  try {
    return normalizePath(path)
  } catch {
    throw new ServiceError('VALIDATION_ERROR', '', { fieldErrors: { path: ['invalid path'] } })
  }
}

async function ensureProject(ownerId: string, projectId: string) {
  const project = await db.getProject(ownerId, projectId)
  if (!project) throw new ServiceError('NOT_FOUND', '')
  return project
}

export async function getDocument(ownerId: string, id: string) {
  const row = await db.getDocument(ownerId, id)
  if (!row) throw new ServiceError('NOT_FOUND', '')
  return row
}

export async function updateDocument(ownerId: string, id: string, input: UpdateDocumentInput) {
  const patch = { ...input }
  if (patch.path !== undefined) patch.path = normalizeOrThrow(patch.path)
  const result = await db.updateDocument(ownerId, id, patch)
  if ('error' in result) {
    if (result.error === 'NOT_FOUND') throw new ServiceError('NOT_FOUND', '')
    throw new ServiceError('CONFLICT', '이미 존재하는 경로입니다', { target: 'path' })
  }
  return result.document
}

export async function deleteDocument(ownerId: string, id: string) {
  const ok = await db.deleteDocument(ownerId, id)
  if (!ok) throw new ServiceError('NOT_FOUND', '')
}

export async function listDocuments(ownerId: string, projectId: string) {
  await ensureProject(ownerId, projectId)
  return db.listDocuments(ownerId, projectId)
}

export async function getDocumentByPath(ownerId: string, projectId: string, rawPath: string) {
  let normalized: string
  try {
    normalized = normalizePath(rawPath)
  } catch {
    throw new ServiceError('NOT_FOUND', '')
  }
  const row = await db.getDocumentByPath(ownerId, projectId, normalized)
  if (!row) throw new ServiceError('NOT_FOUND', '')
  return row
}

export async function createDocument(
  ownerId: string,
  projectId: string,
  input: CreateDocumentInput,
) {
  const normalizedPath = normalizeOrThrow(input.path)
  const result = await db.createDocument(ownerId, projectId, { ...input, path: normalizedPath })
  if ('error' in result) {
    if (result.error === 'PROJECT_NOT_FOUND') throw new ServiceError('NOT_FOUND', '')
    throw new ServiceError('CONFLICT', '이미 존재하는 경로입니다', { target: 'path' })
  }
  return result.document
}

/** Design Ref: §4.4 document_write, RK-03 — 경로 upsert. 기존 문서 갱신 시 사후 확인용 replaced·previousLength 반환. */
export async function upsertDocumentByPath(
  ownerId: string,
  projectId: string,
  input: CreateDocumentInput,
) {
  const normalizedPath = normalizeOrThrow(input.path)
  const existing = await db.getDocumentByPath(ownerId, projectId, normalizedPath)

  if (existing) {
    const result = await db.updateDocument(ownerId, existing.id, {
      title: input.title,
      kind: input.kind,
      pdcaStage: input.pdcaStage,
      content: input.content,
    })
    if ('error' in result) throw new ServiceError('NOT_FOUND', '')
    return { document: result.document, replaced: true, previousLength: existing.content.length }
  }

  const result = await db.createDocument(ownerId, projectId, { ...input, path: normalizedPath })
  if ('error' in result) {
    if (result.error === 'PROJECT_NOT_FOUND') throw new ServiceError('NOT_FOUND', '')
    throw new ServiceError('CONFLICT', '이미 존재하는 경로입니다', { target: 'path' })
  }
  return { document: result.document, replaced: false, previousLength: 0 }
}

export async function resolveLinks(ownerId: string, projectId: string, paths: string[]) {
  const normalized: string[] = []
  for (const p of paths) {
    try {
      normalized.push(normalizePath(p))
    } catch {
      // skip invalid candidate — 배치 존재 판정이라 하나가 무효라고 요청 전체를 실패시키지 않는다
    }
  }
  return db.resolveExistingPaths(ownerId, projectId, normalized)
}

export async function getDocumentTree(ownerId: string, projectId: string, prefix: string) {
  const normalizedPrefix = prefix.replace(/^\/+/, '')
  const rows = await db.listByPrefix(ownerId, projectId, normalizedPrefix)

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

  return { folders, documents }
}
