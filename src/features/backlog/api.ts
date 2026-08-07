// Design Ref: §4.1 — 백로그 RPC 클라이언트. hc<AppType> 경유(§11.3 규칙 3).
import { api } from '@/lib/api'
import type { CreateBacklogItemInput, UpdateBacklogItemInput } from '@shared/schema'

export async function fetchBacklog(projectId: string) {
  const res = await api.projects[':projId'].backlog.$get({ param: { projId: projectId } })
  if (!res.ok) throw new Error('failed to fetch backlog')
  return (await res.json()).data
}

export type BacklogItem = Awaited<ReturnType<typeof fetchBacklog>>[number]

export async function createBacklogItemRequest(projectId: string, input: CreateBacklogItemInput) {
  const res = await api.projects[':projId'].backlog.$post({
    param: { projId: projectId },
    json: input,
  })
  const body = await res.json()
  if (!res.ok) return { ok: false as const, error: 'error' in body ? body.error : body }
  return { ok: true as const, data: 'data' in body ? body.data : undefined }
}

export async function updateBacklogItemRequest(id: string, input: UpdateBacklogItemInput) {
  const res = await api.backlog[':id'].$patch({ param: { id }, json: input })
  const body = await res.json()
  if (!res.ok) return { ok: false as const, error: 'error' in body ? body.error : body }
  return { ok: true as const, data: 'data' in body ? body.data : undefined }
}

export async function deleteBacklogItemRequest(id: string) {
  const res = await api.backlog[':id'].$delete({ param: { id } })
  if (!res.ok) throw await res.json()
}

/** Design Ref: §3.4 — 표시 순서대로(활성+접힘 3섹션 concat) 전체 id 배열 전송 */
export async function reorderBacklogRequest(projectId: string, ids: string[]) {
  const res = await api.projects[':projId'].backlog.order.$put({
    param: { projId: projectId },
    json: { ids },
  })
  if (!res.ok) throw await res.json()
}
