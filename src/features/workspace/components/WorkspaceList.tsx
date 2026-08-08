// Design Ref: §5.4 Workspace/Project CRUD — 목록 카드, 삭제 시 하위 전부 삭제 경고
import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useCreateWorkspace, useUpdateWorkspace, useWorkspaces } from '../hooks/useWorkspaces'
import { WorkspaceForm } from './WorkspaceForm'
import type { CreateWorkspaceInput } from '@shared/schema'

export function WorkspaceList() {
  const { data: workspaces, isLoading } = useWorkspaces()
  const createMut = useCreateWorkspace()
  const updateMut = useUpdateWorkspace()

  const [creating, setCreating] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)

  async function handleCreate(input: CreateWorkspaceInput) {
    await createMut.mutateAsync(input)
    setCreating(false)
  }

  async function handleUpdate(id: string, input: CreateWorkspaceInput) {
    await updateMut.mutateAsync({ id, input })
    setEditingId(null)
  }

  if (isLoading) return <p className="p-8 text-(--ctp-subtext1)">불러오는 중...</p>

  return (
    <div className="mx-auto max-w-2xl p-8">
      <div className="mb-4 flex items-center justify-between">
        <h1 className="text-lg font-medium text-(--ctp-text)">워크스페이스</h1>
        {!creating && (
          <button
            onClick={() => setCreating(true)}
            className="rounded bg-(--ctp-mauve) px-3 py-1.5 text-sm text-(--ctp-base)"
          >
            + 새 워크스페이스
          </button>
        )}
      </div>

      {creating && (
        <div className="mb-4">
          <WorkspaceForm
            onSubmit={handleCreate}
            onCancel={() => setCreating(false)}
            submitLabel="생성"
          />
        </div>
      )}

      <ul className="flex flex-col gap-2">
        {workspaces?.map((ws) => (
          <li
            key={ws.id}
            className="rounded-lg border border-(--ctp-surface0) bg-(--ctp-mantle) p-4"
          >
            {editingId === ws.id ? (
              <WorkspaceForm
                defaultValues={{ ...ws, description: ws.description ?? undefined }}
                onSubmit={(input) => handleUpdate(ws.id, input)}
                onCancel={() => setEditingId(null)}
                submitLabel="저장"
              />
            ) : (
              <div className="flex items-center justify-between">
                <Link to={`/w/${ws.slug}`} className="text-(--ctp-text) hover:text-(--ctp-mauve)">
                  <span className="font-medium">{ws.name}</span>
                  <span className="ml-2 text-sm text-(--ctp-overlay0)">/{ws.slug}</span>
                </Link>
                <div className="flex gap-2 text-sm">
                  <button
                    onClick={() => setEditingId(ws.id)}
                    className="text-(--ctp-subtext1) underline"
                  >
                    수정
                  </button>
                </div>
              </div>
            )}
          </li>
        ))}
        {workspaces?.length === 0 && (
          <p className="text-sm text-(--ctp-overlay0)">아직 워크스페이스가 없습니다.</p>
        )}
      </ul>
    </div>
  )
}
