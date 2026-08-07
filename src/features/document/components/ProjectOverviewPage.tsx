// Design Ref: §7.5 라우팅 — /w/:wsSlug/p/:projSlug (문서 경로 와일드카드가 없는 정확한 매치)
import { Link, useParams } from 'react-router-dom'
import { useWorkspaces } from '@/features/workspace/hooks/useWorkspaces'
import { useProjects } from '@/features/project/hooks/useProjects'
import { DocumentList } from './DocumentList'

export function ProjectOverviewPage() {
  const { wsSlug, projSlug } = useParams<{ wsSlug: string; projSlug: string }>()
  const { data: workspaces, isLoading: wsLoading } = useWorkspaces()
  const workspace = workspaces?.find((w) => w.slug === wsSlug)
  const { data: projects, isLoading: projLoading } = useProjects(workspace?.id ?? '')

  if (wsLoading || (workspace && projLoading)) {
    return <p className="p-8 text-(--ctp-subtext1)">불러오는 중...</p>
  }
  if (!workspace) return <p className="p-8 text-(--ctp-red)">워크스페이스를 찾을 수 없습니다: {wsSlug}</p>

  const project = projects?.find((p) => p.slug === projSlug)
  if (!project) return <p className="p-8 text-(--ctp-red)">프로젝트를 찾을 수 없습니다: {projSlug}</p>

  return (
    <div className="mx-auto max-w-2xl p-8">
      <Link to={`/w/${wsSlug}`} className="text-sm text-(--ctp-overlay0) underline">
        ← {workspace.name}
      </Link>
      <h1 className="mt-2 mb-4 text-lg font-medium text-(--ctp-text)">{project.name}</h1>
      <DocumentList projectId={project.id} wsSlug={workspace.slug} projSlug={project.slug} />
    </div>
  )
}
