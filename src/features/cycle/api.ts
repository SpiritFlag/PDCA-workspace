import { api } from '@/lib/api'
import type { CreateCycleInput, UpdateCycleInput } from '@shared/schema'

export async function fetchCycles(projectId: string) {
  const res = await api.projects[':projId'].cycles.$get({ param: { projId: projectId } })
  if (!res.ok) throw new Error('failed to fetch cycles')
  return (await res.json()).data
}

export async function createCycleRequest(projectId: string, input: CreateCycleInput) {
  const res = await api.projects[':projId'].cycles.$post({
    param: { projId: projectId },
    json: input,
  })
  const body = await res.json()
  if (!res.ok) return { ok: false as const, error: 'error' in body ? body.error : body }
  return { ok: true as const, data: 'data' in body ? body.data : undefined }
}

export async function updateCycleRequest(id: string, input: UpdateCycleInput) {
  const res = await api.cycles[':id'].$patch({ param: { id }, json: input })
  const body = await res.json()
  if (!res.ok) return { ok: false as const, error: 'error' in body ? body.error : body }
  return { ok: true as const, data: 'data' in body ? body.data : undefined }
}

export async function deleteCycleRequest(id: string) {
  const res = await api.cycles[':id'].$delete({ param: { id } })
  if (!res.ok) throw await res.json()
}
