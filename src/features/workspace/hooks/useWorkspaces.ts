// Design Ref: §7.5 캐싱·갱신 정책 — 워크스페이스 목록 staleTime 5분
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  createWorkspaceRequest,
  deleteWorkspaceRequest,
  fetchWorkspaces,
  updateWorkspaceRequest,
} from '../api'
import type { CreateWorkspaceInput, UpdateWorkspaceInput } from '@shared/schema'

const KEY = ['workspaces']

export function useWorkspaces() {
  return useQuery({ queryKey: KEY, queryFn: fetchWorkspaces, staleTime: 5 * 60_000 })
}

export function useCreateWorkspace() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (input: CreateWorkspaceInput) => createWorkspaceRequest(input),
    onSuccess: () => qc.invalidateQueries({ queryKey: KEY }),
  })
}

export function useUpdateWorkspace() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, input }: { id: string; input: UpdateWorkspaceInput }) =>
      updateWorkspaceRequest(id, input),
    onSuccess: () => qc.invalidateQueries({ queryKey: KEY }),
  })
}

export function useDeleteWorkspace() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => deleteWorkspaceRequest(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: KEY }),
  })
}
