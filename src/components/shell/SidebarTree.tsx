// Design Ref: §5.3 SidebarTree — 문서 목록→경로 트리, 접기/펴기, 현재 문서 하이라이트 (FR-16)
// Design Ref: §5.4 [module-2] 진입·셸 — 백로그 진입 링크 + 현재 페이지 하이라이트 (FR-11)
import { useState } from 'react'
import { Link, useLocation, useParams } from 'react-router-dom'
import { useWorkspaces } from '@/features/workspace/hooks/useWorkspaces'
import { useProjects } from '@/features/project/hooks/useProjects'
import { useDocuments } from '@/features/document/hooks/useDocuments'
import { buildDocTree, type TreeNode } from './buildDocTree'

export function SidebarTree() {
  const { wsSlug, projSlug, '*': currentDocPath } = useParams<{
    wsSlug: string
    projSlug: string
    '*': string
  }>()
  const { pathname } = useLocation()
  const { data: workspaces } = useWorkspaces()
  const workspace = workspaces?.find((w) => w.slug === wsSlug)
  const { data: projects } = useProjects(workspace?.id ?? '')
  const project = projects?.find((p) => p.slug === projSlug)
  const { data: documents } = useDocuments(project?.id ?? '')

  if (!workspace || !project) {
    return <p className="px-3 py-2 text-xs text-(--ctp-overlay0)">프로젝트를 선택하면 문서 트리가 보입니다.</p>
  }

  const tree = buildDocTree(documents ?? [])
  const onBacklog = pathname === `/w/${workspace.slug}/p/${project.slug}/backlog`

  return (
    <nav className="flex flex-col gap-0.5 overflow-y-auto px-2 py-2 text-sm">
      <Link
        to={`/w/${workspace.slug}/p/${project.slug}/backlog`}
        className={`rounded px-2 py-1 ${onBacklog ? 'bg-(--ctp-surface0) text-(--ctp-mauve)' : 'text-(--ctp-text) hover:bg-(--ctp-surface0)'}`}
      >
        ★ 백로그
      </Link>
      <div className="my-1 border-t border-(--ctp-surface0)" />
      {tree.map((node) => (
        <TreeItem
          key={node.path}
          node={node}
          depth={0}
          wsSlug={workspace.slug}
          projSlug={project.slug}
          currentDocPath={currentDocPath ?? ''}
        />
      ))}
    </nav>
  )
}

function TreeItem({
  node,
  depth,
  wsSlug,
  projSlug,
  currentDocPath,
}: {
  node: TreeNode
  depth: number
  wsSlug: string
  projSlug: string
  currentDocPath: string
}) {
  const [open, setOpen] = useState(true)
  const pad = { paddingLeft: `${depth * 0.9 + 0.5}rem` }

  if (node.type === 'folder') {
    return (
      <div>
        <button
          onClick={() => setOpen((o) => !o)}
          style={pad}
          className="flex w-full items-center gap-1 rounded py-1 text-left text-(--ctp-subtext1) hover:bg-(--ctp-surface0)"
        >
          <span className="text-xs">{open ? '▾' : '▸'}</span>
          <span className="truncate">{node.name}</span>
        </button>
        {open && (
          <div>
            {node.children.map((child) => (
              <TreeItem
                key={child.path}
                node={child}
                depth={depth + 1}
                wsSlug={wsSlug}
                projSlug={projSlug}
                currentDocPath={currentDocPath}
              />
            ))}
          </div>
        )}
      </div>
    )
  }

  const isActive = node.path === currentDocPath
  return (
    <Link
      to={`/w/${wsSlug}/p/${projSlug}/${node.path}`}
      style={pad}
      className={`truncate rounded py-1 ${isActive ? 'bg-(--ctp-surface0) text-(--ctp-mauve)' : 'text-(--ctp-text) hover:bg-(--ctp-surface0)'}`}
    >
      {node.title}
    </Link>
  )
}
