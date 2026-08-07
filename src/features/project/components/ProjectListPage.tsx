// Design Ref: §7.5 라우팅 — /w/:wsSlug. API는 id 기반이라 목록에서 slug로 조회해 id를 해석한다.
import { useParams } from 'react-router-dom'
import { useWorkspaces } from '@/features/workspace/hooks/useWorkspaces'
import { ProjectList } from './ProjectList'

export function ProjectListPage() {
  const { wsSlug } = useParams<{ wsSlug: string }>()
  const { data: workspaces, isLoading } = useWorkspaces()

  if (isLoading) return <p className="p-8 text-(--ctp-subtext1)">불러오는 중...</p>

  const workspace = workspaces?.find((w) => w.slug === wsSlug)
  if (!workspace) return <p className="p-8 text-(--ctp-red)">워크스페이스를 찾을 수 없습니다: {wsSlug}</p>

  return (
    <ProjectList
      workspaceId={workspace.id}
      workspaceSlug={workspace.slug}
      workspaceName={workspace.name}
    />
  )
}
