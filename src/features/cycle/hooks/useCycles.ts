import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { createCycleRequest, deleteCycleRequest, fetchCycles, updateCycleRequest } from '../api'
import type { CreateCycleInput, UpdateCycleInput } from '@shared/schema'

const KEY = (projectId: string) => ['cycles', projectId]

export function useCycles(projectId: string) {
  return useQuery({
    queryKey: KEY(projectId),
    queryFn: () => fetchCycles(projectId),
    staleTime: 60_000,
  })
}

export function useCreateCycle(projectId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (input: CreateCycleInput) => createCycleRequest(projectId, input),
    onSuccess: () => qc.invalidateQueries({ queryKey: KEY(projectId) }),
  })
}

export function useUpdateCycle(projectId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, input }: { id: string; input: UpdateCycleInput }) =>
      updateCycleRequest(id, input),
    onSuccess: () => qc.invalidateQueries({ queryKey: KEY(projectId) }),
  })
}

export function useDeleteCycle(projectId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => deleteCycleRequest(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: KEY(projectId) }),
  })
}
