// Design Ref: §7.5 라우팅 — /w/:wsSlug. API는 id 기반이라 목록에서 slug로 조회해 id를 해석한다.
import { useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { useUpdateWorkspace, useWorkspaces } from '@/features/workspace/hooks/useWorkspaces'
import { WorkspaceForm } from '@/features/workspace/components/WorkspaceForm'
import { ProjectList } from './ProjectList'
import type { CreateWorkspaceInput } from '@shared/schema'

export function ProjectListPage() {
  const { wsSlug } = useParams<{ wsSlug: string }>()
  const { data: workspaces, isLoading } = useWorkspaces()
  const updateMut = useUpdateWorkspace()
  const [editing, setEditing] = useState(false)

  if (isLoading) return <p className="p-8 text-(--ctp-subtext1)">불러오는 중...</p>

  const workspace = workspaces?.find((w) => w.slug === wsSlug)
  if (!workspace)
    return <p className="p-8 text-(--ctp-red)">워크스페이스를 찾을 수 없습니다: {wsSlug}</p>

  const workspaceId = workspace.id
  async function handleUpdate(input: CreateWorkspaceInput) {
    await updateMut.mutateAsync({ id: workspaceId, input })
    setEditing(false)
  }

  return (
    <div className="mx-auto max-w-2xl p-8">
      <Link to="/" className="text-sm text-(--ctp-overlay0) underline">
        ← 워크스페이스 목록
      </Link>

      {editing ? (
        <div className="mt-2 mb-6">
          <WorkspaceForm
            defaultValues={{ ...workspace, description: workspace.description ?? undefined }}
            onSubmit={handleUpdate}
            onCancel={() => setEditing(false)}
            submitLabel="저장"
          />
        </div>
      ) : (
        <div className="mt-2 mb-6">
          <div className="flex items-start justify-between">
            <div>
              <h1 className="text-xl font-medium text-(--ctp-text)">{workspace.name}</h1>
              <p className="mt-0.5 text-sm text-(--ctp-overlay0)">/{workspace.slug}</p>
            </div>
            <button
              onClick={() => setEditing(true)}
              className="shrink-0 text-sm text-(--ctp-subtext1) underline"
            >
              수정
            </button>
          </div>
          {workspace.description && (
            <p className="mt-2 text-sm text-(--ctp-subtext0)">{workspace.description}</p>
          )}
        </div>
      )}

      <ProjectList workspaceId={workspace.id} workspaceSlug={workspace.slug} />
    </div>
  )
}
