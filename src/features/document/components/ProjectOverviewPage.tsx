// Design Ref: §7.5 라우팅 — /w/:wsSlug/p/:projSlug (문서 경로 와일드카드가 없는 정확한 매치)
import { useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { useWorkspaces } from '@/features/workspace/hooks/useWorkspaces'
import { useProjects, useUpdateProject } from '@/features/project/hooks/useProjects'
import { ProjectForm } from '@/features/project/components/ProjectForm'
import { CycleList } from '@/features/cycle/components/CycleList'
import { DocumentList } from './DocumentList'
import type { CreateProjectInput } from '@shared/schema'

export function ProjectOverviewPage() {
  const { wsSlug, projSlug } = useParams<{ wsSlug: string; projSlug: string }>()
  const { data: workspaces, isLoading: wsLoading } = useWorkspaces()
  const workspace = workspaces?.find((w) => w.slug === wsSlug)
  const { data: projects, isLoading: projLoading } = useProjects(workspace?.id ?? '')
  const updateMut = useUpdateProject(workspace?.id ?? '')
  const [editing, setEditing] = useState(false)

  if (wsLoading || (workspace && projLoading)) {
    return <p className="p-8 text-(--ctp-subtext1)">불러오는 중...</p>
  }
  if (!workspace) return <p className="p-8 text-(--ctp-red)">워크스페이스를 찾을 수 없습니다: {wsSlug}</p>

  const project = projects?.find((p) => p.slug === projSlug)
  if (!project) return <p className="p-8 text-(--ctp-red)">프로젝트를 찾을 수 없습니다: {projSlug}</p>

  const projectId = project.id
  async function handleUpdate(input: CreateProjectInput) {
    await updateMut.mutateAsync({ id: projectId, input })
    setEditing(false)
  }

  return (
    <div className="mx-auto max-w-2xl p-8">
      <Link to={`/w/${wsSlug}`} className="text-sm text-(--ctp-overlay0) underline">
        ← {workspace.name}
      </Link>

      {editing ? (
        <div className="mt-2 mb-6">
          <ProjectForm
            defaultValues={{
              ...project,
              serviceUrl: project.serviceUrl ?? undefined,
              githubUrl: project.githubUrl ?? undefined,
              githubBranch: project.githubBranch ?? undefined,
              description: project.description ?? undefined,
            }}
            onSubmit={handleUpdate}
            onCancel={() => setEditing(false)}
            submitLabel="저장"
          />
        </div>
      ) : (
        <div className="mt-2 mb-6">
          <div className="flex items-start justify-between">
            <div>
              <h1 className="text-xl font-medium text-(--ctp-text)">{project.name}</h1>
              <p className="mt-0.5 text-sm text-(--ctp-overlay0)">/{project.slug}</p>
            </div>
            <button
              onClick={() => setEditing(true)}
              className="shrink-0 text-sm text-(--ctp-subtext1) underline"
            >
              수정
            </button>
          </div>

          {(project.serviceUrl || project.githubUrl) && (
            <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-sm">
              {project.serviceUrl && (
                <a
                  href={project.serviceUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="text-(--ctp-blue) underline"
                >
                  🔗 서비스 URL
                </a>
              )}
              {project.githubUrl && (
                <a
                  href={project.githubUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="text-(--ctp-blue) underline"
                >
                  GitHub{project.githubBranch ? ` (${project.githubBranch})` : ''}
                </a>
              )}
            </div>
          )}

          {project.description && (
            <p className="mt-2 text-sm text-(--ctp-subtext0)">{project.description}</p>
          )}
        </div>
      )}

      <Link
        to={`/w/${workspace.slug}/p/${project.slug}/backlog`}
        className="mb-6 flex items-center justify-center gap-2 rounded-lg bg-(--ctp-mauve) px-4 py-3 font-medium text-(--ctp-base) hover:opacity-90"
      >
        ★ 백로그
      </Link>

      <div className="mb-8">
        <CycleList projectId={project.id} wsSlug={workspace.slug} projSlug={project.slug} />
      </div>

      <DocumentList projectId={project.id} wsSlug={workspace.slug} projSlug={project.slug} />
    </div>
  )
}
