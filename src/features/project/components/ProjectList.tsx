import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useCreateProject, useProjects, useUpdateProject } from '../hooks/useProjects'
import { ProjectForm } from './ProjectForm'
import type { CreateProjectInput } from '@shared/schema'

export function ProjectList({
  workspaceId,
  workspaceSlug,
}: {
  workspaceId: string
  workspaceSlug: string
}) {
  const { data: projects, isLoading } = useProjects(workspaceId)
  const createMut = useCreateProject(workspaceId)
  const updateMut = useUpdateProject(workspaceId)

  const [creating, setCreating] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)

  async function handleCreate(input: CreateProjectInput) {
    await createMut.mutateAsync(input)
    setCreating(false)
  }
  async function handleUpdate(id: string, input: CreateProjectInput) {
    await updateMut.mutateAsync({ id, input })
    setEditingId(null)
  }

  if (isLoading) return <p className="p-8 text-(--ctp-subtext1)">불러오는 중...</p>

  return (
    <div>
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-base font-medium text-(--ctp-text)">프로젝트</h2>
        {!creating && (
          <button
            onClick={() => setCreating(true)}
            className="rounded bg-(--ctp-mauve) px-3 py-1.5 text-sm text-(--ctp-base)"
          >
            + 새 프로젝트
          </button>
        )}
      </div>

      {creating && (
        <div className="mb-4">
          <ProjectForm onSubmit={handleCreate} onCancel={() => setCreating(false)} submitLabel="생성" />
        </div>
      )}

      <ul className="flex flex-col gap-2">
        {projects?.map((p) => (
          <li key={p.id} className="rounded-lg border border-(--ctp-surface0) bg-(--ctp-mantle) p-4">
            {editingId === p.id ? (
              <ProjectForm
                defaultValues={{
                  ...p,
                  serviceUrl: p.serviceUrl ?? undefined,
                  githubUrl: p.githubUrl ?? undefined,
                  githubBranch: p.githubBranch ?? undefined,
                  description: p.description ?? undefined,
                }}
                onSubmit={(input) => handleUpdate(p.id, input)}
                onCancel={() => setEditingId(null)}
                submitLabel="저장"
              />
            ) : (
              <div className="flex items-center justify-between">
                <Link
                  to={`/w/${workspaceSlug}/p/${p.slug}`}
                  className="text-(--ctp-text) hover:text-(--ctp-mauve)"
                >
                  <span className="font-medium">{p.name}</span>
                  <span className="ml-2 text-sm text-(--ctp-overlay0)">/{p.slug}</span>
                </Link>
                <div className="flex gap-2 text-sm">
                  <button onClick={() => setEditingId(p.id)} className="text-(--ctp-subtext1) underline">
                    수정
                  </button>
                </div>
              </div>
            )}
          </li>
        ))}
        {projects?.length === 0 && (
          <p className="text-sm text-(--ctp-overlay0)">아직 프로젝트가 없습니다.</p>
        )}
      </ul>
    </div>
  )
}
