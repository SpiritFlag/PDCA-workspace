import { useQuery } from '@tanstack/react-query'
import { fetchDocumentByPath, fetchTree } from '../api'

export function useDocumentByPath(projectId: string, path: string) {
  return useQuery({
    queryKey: ['document-by-path', projectId, path],
    queryFn: () => fetchDocumentByPath(projectId, path),
    enabled: !!projectId && !!path,
    staleTime: 0,
  })
}

export function useTree(projectId: string, prefix: string) {
  return useQuery({
    queryKey: ['tree', projectId, prefix],
    queryFn: () => fetchTree(projectId, prefix),
    enabled: !!projectId,
    staleTime: 30_000,
  })
}
