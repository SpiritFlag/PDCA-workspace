import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { fetchTokens, issueTokenRequest, revokeTokenRequest } from '../api'

const KEY = ['tokens']

export function useTokens() {
  return useQuery({ queryKey: KEY, queryFn: fetchTokens, staleTime: 30_000 })
}

export function useIssueToken() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (name: string) => issueTokenRequest(name),
    onSuccess: (result) => {
      if (result.ok) qc.invalidateQueries({ queryKey: KEY })
    },
  })
}

export function useRevokeToken() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => revokeTokenRequest(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: KEY }),
  })
}
