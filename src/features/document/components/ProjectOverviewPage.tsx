// Design Ref: §7.5 라우팅 — /w/:wsSlug/p/:projSlug (문서 경로 와일드카드가 없는 정확한 매치)
import { useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { useWorkspaces } from '@/features/workspace/hooks/useWorkspaces'
import { useProjects, useUpdateProject } from '@/features/project/hooks/useProjects'
import { ProjectForm } from '@/features/project/components/ProjectForm'
import { CycleList } from '@/features/cycle/components/CycleList'
import { LatestReleaseCard } from '@/features/cycle/components/LatestReleaseCard'
import { useCycles } from '@/features/cycle/hooks/useCycles'
import { DocumentList } from './DocumentList'
import type { CreateProjectInput } from '@shared/schema'

export function ProjectOverviewPage() {
  const { wsSlug, projSlug } = useParams<{ wsSlug: string; projSlug: string }>()
  const { data: workspaces, isLoading: wsLoading } = useWorkspaces()
  const workspace = workspaces?.find((w) => w.slug === wsSlug)
  const { data: projects, isLoading: projLoading } = useProjects(workspace?.id ?? '')
  const updateMut = useUpdateProject(workspace?.id ?? '')
  const [editing, setEditing] = useState(false)
  const project = projects?.find((p) => p.slug === projSlug)
  // Design Ref: §5.3 — LatestReleaseCard(S7)용. 훅은 조건부 return 이전에 호출해야 한다.
  const { data: cycles } = useCycles(project?.id ?? '')

  if (wsLoading || (workspace && projLoading)) {
    return <p className="p-8 text-(--ctp-subtext1)">불러오는 중...</p>
  }
  if (!workspace) return <p className="p-8 text-(--ctp-red)">워크스페이스를 찾을 수 없습니다: {wsSlug}</p>
  if (!project) return <p className="p-8 text-(--ctp-red)">프로젝트를 찾을 수 없습니다: {projSlug}</p>

  const projectId = project.id
  async function handleUpdate(input: CreateProjectInput) {
    await updateMut.mutateAsync({ id: projectId, input })
    setEditing(false)
  }

  return (
    <div className="mx-auto max-w-4xl p-8">
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

          <ProjectIdRow projectId={projectId} />
        </div>
      )}

      <Link
        to={`/w/${workspace.slug}/p/${project.slug}/backlog`}
        className="mb-6 flex items-center justify-center gap-2 rounded-lg bg-(--ctp-mauve) px-4 py-3 font-medium text-(--ctp-base) hover:opacity-90"
      >
        ★ 백로그
      </Link>

      {cycles && (
        <LatestReleaseCard cycles={cycles} wsSlug={workspace.slug} projSlug={project.slug} />
      )}

      <div className="mb-8">
        <CycleList projectId={project.id} wsSlug={workspace.slug} projSlug={project.slug} />
      </div>

      <DocumentList projectId={project.id} wsSlug={workspace.slug} projSlug={project.slug} />
    </div>
  )
}

// Design Ref: §5.3, §9 D-83 — projectId 노출(S8). pdcaw .pdcarc.json 작성용, DB 직접
// 조회를 대체한다. 스니펫의 baseUrl은 window.location.origin(비밀 아님, D-83).
function ProjectIdRow({ projectId }: { projectId: string }) {
  const [feedback, setFeedback] = useState<string | null>(null)

  async function copy(text: string, label: string) {
    try {
      await navigator.clipboard.writeText(text)
      setFeedback(`${label} 복사됨`)
    } catch {
      setFeedback('복사 실패 — 직접 선택해 복사하세요')
    }
    setTimeout(() => setFeedback(null), 2000)
  }

  const snippet = JSON.stringify(
    { projectId, baseUrl: window.location.origin },
    null,
    2,
  )

  return (
    <div className="mt-2 flex flex-wrap items-center gap-2 text-xs">
      <span className="font-mono text-(--ctp-overlay0)">projectId: {projectId}</span>
      <button onClick={() => copy(projectId, 'ID')} className="text-(--ctp-blue) underline">
        ID 복사
      </button>
      <button onClick={() => copy(snippet, '.pdcarc.json')} className="text-(--ctp-blue) underline">
        .pdcarc.json 복사
      </button>
      {feedback && <span className="text-(--ctp-subtext1)">{feedback}</span>}
    </div>
  )
}
