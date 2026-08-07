import { api } from '@/lib/api'
import type { CreateProjectInput, UpdateProjectInput } from '@shared/schema'

export async function fetchProjects(workspaceId: string) {
  const res = await api.workspaces[':wsId'].projects.$get({ param: { wsId: workspaceId } })
  if (!res.ok) throw new Error('failed to fetch projects')
  return (await res.json()).data
}

export async function createProjectRequest(workspaceId: string, input: CreateProjectInput) {
  const res = await api.workspaces[':wsId'].projects.$post({
    param: { wsId: workspaceId },
    json: input,
  })
  if (!res.ok) throw await res.json()
  return (await res.json()).data
}

export async function updateProjectRequest(id: string, input: UpdateProjectInput) {
  const res = await api.projects[':id'].$patch({ param: { id }, json: input })
  if (!res.ok) throw await res.json()
  return (await res.json()).data
}

export async function deleteProjectRequest(id: string) {
  const res = await api.projects[':id'].$delete({ param: { id } })
  if (!res.ok) throw await res.json()
}
