import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  createProjectRequest,
  deleteProjectRequest,
  fetchProjects,
  updateProjectRequest,
} from '../api'
import type { CreateProjectInput, UpdateProjectInput } from '@shared/schema'

const KEY = (workspaceId: string) => ['projects', workspaceId]

export function useProjects(workspaceId: string) {
  return useQuery({
    queryKey: KEY(workspaceId),
    queryFn: () => fetchProjects(workspaceId),
    staleTime: 5 * 60_000,
    enabled: !!workspaceId,
  })
}

export function useCreateProject(workspaceId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (input: CreateProjectInput) => createProjectRequest(workspaceId, input),
    onSuccess: () => qc.invalidateQueries({ queryKey: KEY(workspaceId) }),
  })
}

export function useUpdateProject(workspaceId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, input }: { id: string; input: UpdateProjectInput }) =>
      updateProjectRequest(id, input),
    onSuccess: () => qc.invalidateQueries({ queryKey: KEY(workspaceId) }),
  })
}

export function useDeleteProject(workspaceId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => deleteProjectRequest(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: KEY(workspaceId) }),
  })
}
