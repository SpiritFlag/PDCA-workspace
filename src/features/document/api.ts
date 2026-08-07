import { api } from '@/lib/api'
import type { CreateDocumentInput, UpdateDocumentInput } from '@shared/schema'

export async function fetchDocuments(projectId: string) {
  const res = await api.projects[':projId'].documents.$get({ param: { projId: projectId } })
  if (!res.ok) throw new Error('failed to fetch documents')
  return (await res.json()).data
}

export async function createDocumentRequest(projectId: string, input: CreateDocumentInput) {
  const res = await api.projects[':projId'].documents.$post({
    param: { projId: projectId },
    json: input,
  })
  const body = await res.json()
  if (!res.ok) return { ok: false as const, error: 'error' in body ? body.error : body }
  return { ok: true as const, data: 'data' in body ? body.data : undefined }
}

export async function updateDocumentRequest(id: string, input: UpdateDocumentInput) {
  const res = await api.documents[':id'].$patch({ param: { id }, json: input })
  const body = await res.json()
  if (!res.ok) return { ok: false as const, error: 'error' in body ? body.error : body }
  return { ok: true as const, data: 'data' in body ? body.data : undefined }
}

export async function deleteDocumentRequest(id: string) {
  const res = await api.documents[':id'].$delete({ param: { id } })
  if (!res.ok) throw await res.json()
}

/** Plan SC: C4 — 저장 전 링크 생사 프리뷰. 서버 존재 판정은 resolveExistingPaths(단일 IN 쿼리)를 탄다. */
export async function resolveLinks(projectId: string, paths: string[]) {
  if (paths.length === 0) return { existing: [] as string[] }
  const res = await api.projects[':projId']['links']['resolve'].$post({
    param: { projId: projectId },
    json: { paths },
  })
  if (!res.ok) throw new Error('failed to resolve links')
  return (await res.json()).data
}

/** Design Ref: §4.2 by-path — FR-05의 심장. 404면 null. */
export async function fetchDocumentByPath(projectId: string, path: string) {
  const res = await api.projects[':projId'].documents['by-path'].$get({
    param: { projId: projectId },
    query: { path },
  })
  if (res.status === 404) return null
  if (!res.ok) throw new Error('failed to fetch document')
  return (await res.json()).data
}

/** Design Ref: FR-09 — 디렉터리 링크 착지점 */
export async function fetchTree(projectId: string, prefix: string) {
  const res = await api.projects[':projId'].tree.$get({
    param: { projId: projectId },
    query: { prefix },
  })
  if (!res.ok) throw new Error('failed to fetch tree')
  return (await res.json()).data
}
