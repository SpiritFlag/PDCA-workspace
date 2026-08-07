// Design Ref: §5.5 — 목록은 TanStack Query 기본, 드래그 저장은 낙관적 갱신 + 실패 롤백
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  createBacklogItemRequest,
  deleteBacklogItemRequest,
  fetchBacklog,
  reorderBacklogRequest,
  updateBacklogItemRequest,
  type BacklogItem,
} from '../api'
import type { CreateBacklogItemInput, UpdateBacklogItemInput } from '@shared/schema'

const KEY = (projectId: string) => ['backlog', projectId]

export function useBacklog(projectId: string) {
  return useQuery({
    queryKey: KEY(projectId),
    queryFn: () => fetchBacklog(projectId),
    staleTime: 30_000,
    enabled: !!projectId,
  })
}

export function useCreateBacklogItem(projectId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (input: CreateBacklogItemInput) => createBacklogItemRequest(projectId, input),
    onSuccess: (result) => {
      if (result.ok) qc.invalidateQueries({ queryKey: KEY(projectId) })
    },
  })
}

export function useUpdateBacklogItem(projectId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, input }: { id: string; input: UpdateBacklogItemInput }) =>
      updateBacklogItemRequest(id, input),
    onSuccess: (result) => {
      if (result.ok) qc.invalidateQueries({ queryKey: KEY(projectId) })
    },
  })
}

export function useDeleteBacklogItem(projectId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => deleteBacklogItemRequest(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: KEY(projectId) }),
  })
}

export function useReorderBacklog(projectId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (ids: string[]) => reorderBacklogRequest(projectId, ids),
    onMutate: async (ids) => {
      await qc.cancelQueries({ queryKey: KEY(projectId) })
      const previous = qc.getQueryData<BacklogItem[]>(KEY(projectId))
      if (previous) {
        const byId = new Map(previous.map((item) => [item.id, item]))
        const reordered = ids
          .map((id, i) => {
            const item = byId.get(id)
            return item ? { ...item, sortOrder: i } : null
          })
          .filter((item): item is BacklogItem => item !== null)
        qc.setQueryData(KEY(projectId), reordered)
      }
      return { previous }
    },
    onError: (_err, _ids, context) => {
      if (context?.previous) qc.setQueryData(KEY(projectId), context.previous)
    },
    onSettled: () => qc.invalidateQueries({ queryKey: KEY(projectId) }),
  })
}
