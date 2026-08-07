// Design Ref: §11.3 규칙 3 — RPC 클라이언트(@/lib/api) 경유만 허용
import { api } from '@/lib/api'
import type { CreateWorkspaceInput, UpdateWorkspaceInput } from '@shared/schema'

export async function fetchWorkspaces() {
  const res = await api.workspaces.$get()
  if (!res.ok) throw new Error('failed to fetch workspaces')
  return (await res.json()).data
}

export async function createWorkspaceRequest(input: CreateWorkspaceInput) {
  const res = await api.workspaces.$post({ json: input })
  if (!res.ok) throw await res.json()
  return (await res.json()).data
}

export async function updateWorkspaceRequest(id: string, input: UpdateWorkspaceInput) {
  const res = await api.workspaces[':id'].$patch({ param: { id }, json: input })
  if (!res.ok) throw await res.json()
  return (await res.json()).data
}

export async function deleteWorkspaceRequest(id: string) {
  const res = await api.workspaces[':id'].$delete({ param: { id } })
  if (!res.ok) throw await res.json()
}
