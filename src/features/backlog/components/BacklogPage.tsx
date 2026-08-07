// Design Ref: §5.1 백로그 화면 — 활성 1섹션 + 접힘 3섹션. 드래그는 각 섹션 내부만(§5.1 정신 계승).
import { useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { useWorkspaces } from '@/features/workspace/hooks/useWorkspaces'
import { useProjects } from '@/features/project/hooks/useProjects'
import { useBacklog, useReorderBacklog } from '../hooks/useBacklog'
import type { BacklogItem } from '../api'
import { BacklogCard } from './BacklogCard'
import { SectionCollapse } from './SectionCollapse'
import { ItemDialog } from './ItemDialog'

export function BacklogPage() {
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

  return <BacklogBoard projectId={project.id} wsSlug={workspace.slug} projSlug={project.slug} />
}

function BacklogBoard({
  projectId,
  wsSlug,
  projSlug,
}: {
  projectId: string
  wsSlug: string
  projSlug: string
}) {
  const { data: items, isLoading } = useBacklog(projectId)
  const reorderMut = useReorderBacklog(projectId)
  const [creating, setCreating] = useState(false)
  const [openItem, setOpenItem] = useState<BacklogItem | null>(null)

  if (isLoading) return <p className="p-8 text-(--ctp-subtext1)">불러오는 중...</p>

  const all = items ?? []
  // Design Ref: §5.1 — 활성(todo·doing 혼합, sort_order 순) + 종료 3종. 전체가 이미 sort_order로
  // 정렬돼 있으므로 status로 필터링만 해도 각 섹션 내부 순서가 그대로 보존된다.
  const active = all.filter((i) => i.status === 'todo' || i.status === 'doing')
  const done = all.filter((i) => i.status === 'done')
  const resolved = all.filter((i) => i.status === 'resolved')
  const dropped = all.filter((i) => i.status === 'dropped')

  function commitOrder(section: 'active' | 'done' | 'resolved' | 'dropped', newIds: string[]) {
    const order = {
      active: active.map((i) => i.id),
      done: done.map((i) => i.id),
      resolved: resolved.map((i) => i.id),
      dropped: dropped.map((i) => i.id),
    }
    order[section] = newIds
    reorderMut.mutate([...order.active, ...order.done, ...order.resolved, ...order.dropped])
  }

  return (
    <div className="mx-auto max-w-2xl p-8">
      <nav className="mb-1 text-sm text-(--ctp-overlay0)">
        <Link to={`/w/${wsSlug}`} className="underline">
          {wsSlug}
        </Link>{' '}
        /{' '}
        <Link to={`/w/${wsSlug}/p/${projSlug}`} className="underline">
          {projSlug}
        </Link>{' '}
        / 백로그
      </nav>

      <div className="mt-2 mb-4 flex items-center justify-between">
        <h1 className="text-lg font-medium text-(--ctp-text)">백로그</h1>
        {!creating && (
          <button
            onClick={() => setCreating(true)}
            className="rounded bg-(--ctp-mauve) px-3 py-1.5 text-sm text-(--ctp-base)"
          >
            + 항목
          </button>
        )}
      </div>

      {all.length === 0 && !creating && (
        <p className="text-sm text-(--ctp-overlay0)">백로그가 없습니다. + 항목으로 추가하세요.</p>
      )}

      <BacklogSection items={active} onOpen={setOpenItem} onReorder={(ids) => commitOrder('active', ids)} />

      <SectionCollapse storageKey={`backlog-collapse-done-${projectId}`} title="완료" count={done.length}>
        <BacklogSection items={done} onOpen={setOpenItem} onReorder={(ids) => commitOrder('done', ids)} />
      </SectionCollapse>
      <SectionCollapse
        storageKey={`backlog-collapse-resolved-${projectId}`}
        title="해소"
        count={resolved.length}
      >
        <BacklogSection items={resolved} onOpen={setOpenItem} onReorder={(ids) => commitOrder('resolved', ids)} />
      </SectionCollapse>
      <SectionCollapse
        storageKey={`backlog-collapse-dropped-${projectId}`}
        title="삭제"
        count={dropped.length}
      >
        <BacklogSection items={dropped} onOpen={setOpenItem} onReorder={(ids) => commitOrder('dropped', ids)} />
      </SectionCollapse>

      {creating && (
        <ItemDialog projectId={projectId} wsSlug={wsSlug} projSlug={projSlug} onClose={() => setCreating(false)} />
      )}
      {openItem && (
        <ItemDialog
          projectId={projectId}
          item={openItem}
          wsSlug={wsSlug}
          projSlug={projSlug}
          onClose={() => setOpenItem(null)}
        />
      )}
    </div>
  )
}

/** Design Ref: §5.1 드래그 구현 — HTML5 native DnD. 섹션 내부 재배열만, 저장은 상위가 concat해서 전송. */
function BacklogSection({
  items,
  onOpen,
  onReorder,
}: {
  items: BacklogItem[]
  onOpen: (item: BacklogItem) => void
  onReorder: (ids: string[]) => void
}) {
  const [dragId, setDragId] = useState<string | null>(null)
  const [overId, setOverId] = useState<string | null>(null)

  function handleDrop() {
    if (dragId && overId && dragId !== overId) {
      const ids = items.map((i) => i.id)
      const from = ids.indexOf(dragId)
      const to = ids.indexOf(overId)
      ids.splice(from, 1)
      ids.splice(to, 0, dragId)
      onReorder(ids)
    }
    setDragId(null)
    setOverId(null)
  }

  return (
    <div className="flex flex-col gap-1.5">
      {items.map((item) => (
        <BacklogCard
          key={item.id}
          item={item}
          onOpen={() => onOpen(item)}
          draggable
          dragging={dragId === item.id}
          showInsertLine={overId === item.id && dragId !== null && dragId !== item.id}
          onDragStart={() => setDragId(item.id)}
          onDragOver={(e) => {
            e.preventDefault()
            if (dragId) setOverId(item.id)
          }}
          onDrop={handleDrop}
          onDragEnd={() => {
            setDragId(null)
            setOverId(null)
          }}
        />
      ))}
    </div>
  )
}
