import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { createCycleRequest, deleteCycleRequest, fetchCycles, updateCycleRequest } from '../api'
import type { CreateCycleInput, UpdateCycleInput } from '@shared/schema'

const KEY = (projectId: string) => ['cycles', projectId]

export function useCycles(projectId: string) {
  return useQuery({
    queryKey: KEY(projectId),
    queryFn: () => fetchCycles(projectId),
    staleTime: 60_000,
    // Check G-2 — ReleasePage·ProjectOverviewPage가 project 미해석 구간에 projectId=''로
    // 부르는 경로가 생겨(9차), useDocuments.ts와 동일하게 빈 값 요청을 막는다.
    enabled: !!projectId,
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
