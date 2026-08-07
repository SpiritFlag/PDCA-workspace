// Design Ref: §7.5 링크 판정 흐름 — 문서 로드 시 링크 후보를 한 번에 조회
import { useQuery } from '@tanstack/react-query'
import { classifyLink, resolveRelative } from '@/lib/path'
import { extractLinkHrefs } from '../lib/extractLinks'
import { resolveLinks } from '../api'

export function useResolvedLinks(projectId: string, currentPath: string, content: string) {
  const candidates = extractLinkHrefs(content)
    .filter((h) => {
      const cls = classifyLink(h)
      return cls === 'document' || cls === 'directory'
    })
    .map((h) => resolveRelative(currentPath, h))
    .filter((p): p is string => p !== null)

  const query = useQuery({
    queryKey: ['resolve-links', projectId, currentPath, candidates],
    queryFn: () => resolveLinks(projectId, candidates),
    enabled: !!projectId && !!content,
  })

  return {
    existingPaths: new Set(query.data?.existing ?? []),
    isLoading: query.isLoading,
  }
}
