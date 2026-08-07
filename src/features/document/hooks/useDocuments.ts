import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  createDocumentRequest,
  deleteDocumentRequest,
  fetchDocuments,
  updateDocumentRequest,
} from '../api'
import type { CreateDocumentInput, UpdateDocumentInput } from '@shared/schema'

const KEY = (projectId: string) => ['documents', projectId]

export function useDocuments(projectId: string) {
  return useQuery({
    queryKey: KEY(projectId),
    queryFn: () => fetchDocuments(projectId),
    staleTime: 60_000,
    enabled: !!projectId,
  })
}

export function useCreateDocument(projectId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (input: CreateDocumentInput) => createDocumentRequest(projectId, input),
    onSuccess: (result) => {
      if (result.ok) qc.invalidateQueries({ queryKey: KEY(projectId) })
    },
  })
}

export function useUpdateDocument(projectId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, input }: { id: string; input: UpdateDocumentInput }) =>
      updateDocumentRequest(id, input),
    onSuccess: (result) => {
      if (result.ok) {
        qc.invalidateQueries({ queryKey: KEY(projectId) })
        qc.invalidateQueries({ queryKey: ['document-by-path'] })
      }
    },
  })
}

export function useDeleteDocument(projectId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => deleteDocumentRequest(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: KEY(projectId) }),
  })
}
