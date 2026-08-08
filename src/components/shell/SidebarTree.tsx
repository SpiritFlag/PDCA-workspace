// Design Ref: §5.3 SidebarTree — 워크스페이스 > 프로젝트 > (백로그·버전·문서) 계층 네비게이션.
// 현재 URL(wsSlug/projSlug/docPath)에 해당하는 노드는 자동으로 펼치고 하이라이트한다.
import { useState } from 'react'
import { Link, useLocation, useParams } from 'react-router-dom'
import { useWorkspaces } from '@/features/workspace/hooks/useWorkspaces'
import { useProjects } from '@/features/project/hooks/useProjects'
import { useDocuments } from '@/features/document/hooks/useDocuments'
import { useCycles } from '@/features/cycle/hooks/useCycles'
import { sortCycles } from '@/features/cycle/lib/versionSort'
import { buildDocTree, type TreeNode } from './buildDocTree'

type NavCtx = { wsSlug?: string; projSlug?: string; docPath: string; pathname: string }

export function SidebarTree() {
  const params = useParams<{ wsSlug: string; projSlug: string; '*': string }>()
  const { pathname } = useLocation()
  const { data: workspaces } = useWorkspaces()

  const ctx: NavCtx = {
    wsSlug: params.wsSlug,
    projSlug: params.projSlug,
    docPath: params['*'] ?? '',
    pathname,
  }

  if (!workspaces || workspaces.length === 0) {
    return <p className="px-3 py-2 text-xs text-(--ctp-overlay0)">워크스페이스가 없습니다.</p>
  }

  return (
    <nav className="flex flex-col gap-0.5 overflow-y-auto px-2 py-2 text-sm">
      {workspaces.map((ws) => (
        <WorkspaceNode key={ws.id} ws={ws} ctx={ctx} />
      ))}
    </nav>
  )
}

function WorkspaceNode({
  ws,
  ctx,
}: {
  ws: { id: string; slug: string; name: string }
  ctx: NavCtx
}) {
  const active = ctx.wsSlug === ws.slug
  const [open, setOpen] = useState(active)
  const { data: projects } = useProjects(ws.id)

  return (
    <div>
      <div className="flex items-center">
        <button
          onClick={() => setOpen((o) => !o)}
          className="shrink-0 px-1 text-xs text-(--ctp-overlay0)"
          aria-label="펼치기"
        >
          {open ? '▾' : '▸'}
        </button>
        <Link
          to={`/w/${ws.slug}`}
          className={`flex-1 truncate rounded px-1 py-1 font-medium ${active ? 'text-(--ctp-mauve)' : 'text-(--ctp-text) hover:bg-(--ctp-surface0)'}`}
        >
          {ws.name}
        </Link>
      </div>
      {open && (
        <div className="ml-2">
          {projects?.map((p) => (
            <ProjectNode key={p.id} ws={ws} project={p} ctx={ctx} />
          ))}
          {projects?.length === 0 && (
            <p className="px-2 py-1 text-xs text-(--ctp-overlay0)">프로젝트 없음</p>
          )}
        </div>
      )}
    </div>
  )
}

function ProjectNode({
  ws,
  project,
  ctx,
}: {
  ws: { slug: string }
  project: { id: string; slug: string; name: string }
  ctx: NavCtx
}) {
  const active = ctx.wsSlug === ws.slug && ctx.projSlug === project.slug
  const [open, setOpen] = useState(active)
  const base = `/w/${ws.slug}/p/${project.slug}`

  const onOverview = ctx.pathname === base
  const onBacklog = ctx.pathname === `${base}/backlog`

  return (
    <div>
      <div className="flex items-center">
        <button
          onClick={() => setOpen((o) => !o)}
          className="shrink-0 px-1 text-xs text-(--ctp-overlay0)"
          aria-label="펼치기"
        >
          {open ? '▾' : '▸'}
        </button>
        <Link
          to={base}
          className={`flex-1 truncate rounded px-1 py-1 ${active ? 'text-(--ctp-text)' : 'text-(--ctp-subtext1) hover:bg-(--ctp-surface0)'}`}
        >
          {project.name}
        </Link>
      </div>
      {open && (
        <div className="ml-3 flex flex-col gap-0.5">
          <Link
            to={`${base}/backlog`}
            className={`rounded px-2 py-1 ${onBacklog ? 'bg-(--ctp-surface0) text-(--ctp-mauve)' : 'text-(--ctp-text) hover:bg-(--ctp-surface0)'}`}
          >
            ★ 백로그
          </Link>
          <VersionsSection ws={ws} project={project} overviewActive={onOverview} />
          <DocumentsSection ws={ws} project={project} ctx={ctx} />
        </div>
      )}
    </div>
  )
}

function VersionsSection({
  ws,
  project,
  overviewActive,
}: {
  ws: { slug: string }
  project: { id: string; slug: string }
  overviewActive: boolean
}) {
  const [open, setOpen] = useState(overviewActive)
  const { data: cycles } = useCycles(project.id)
  const sorted = sortCycles(cycles ?? [], 'version-desc')
  const base = `/w/${ws.slug}/p/${project.slug}`

  return (
    <div>
      <button
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-center gap-1 rounded px-2 py-1 text-left text-(--ctp-text) hover:bg-(--ctp-surface0)"
      >
        <span className="text-xs text-(--ctp-overlay0)">{open ? '▾' : '▸'}</span>
        <span>⛿ 버전 ({cycles?.length ?? 0})</span>
      </button>
      {open && (
        <div className="flex flex-col gap-0.5">
          {sorted.map((c) => (
            <Link
              key={c.id}
              to={base}
              style={{ paddingLeft: '1.4rem' }}
              className="flex items-center gap-1.5 truncate rounded py-1 text-(--ctp-text) hover:bg-(--ctp-surface0)"
            >
              <span className="shrink-0 font-mono text-xs text-(--ctp-mauve)">{c.version}</span>
              {c.name && (
                <span className="truncate font-mono text-xs text-(--ctp-overlay0)">{c.name}</span>
              )}
            </Link>
          ))}
          {cycles?.length === 0 && (
            <p className="px-3 py-1 text-xs text-(--ctp-overlay0)" style={{ paddingLeft: '1.4rem' }}>
              버전 없음
            </p>
          )}
        </div>
      )}
    </div>
  )
}

function DocumentsSection({
  ws,
  project,
  ctx,
}: {
  ws: { slug: string }
  project: { id: string; slug: string }
  ctx: NavCtx
}) {
  const viewingDoc = ctx.projSlug === project.slug && ctx.docPath !== ''
  const [open, setOpen] = useState(viewingDoc)
  const { data: documents } = useDocuments(project.id)
  const tree = buildDocTree(documents ?? [])

  return (
    <div>
      <button
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-center gap-1 rounded px-2 py-1 text-left text-(--ctp-text) hover:bg-(--ctp-surface0)"
      >
        <span className="text-xs text-(--ctp-overlay0)">{open ? '▾' : '▸'}</span>
        <span>문서 ({documents?.length ?? 0})</span>
      </button>
      {open && (
        <div>
          {tree.map((node) => (
            <TreeItem
              key={node.path}
              node={node}
              depth={1}
              wsSlug={ws.slug}
              projSlug={project.slug}
              currentDocPath={ctx.projSlug === project.slug ? ctx.docPath : ''}
            />
          ))}
          {documents?.length === 0 && (
            <p className="px-3 py-1 text-xs text-(--ctp-overlay0)">문서 없음</p>
          )}
        </div>
      )}
    </div>
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
      className={`block truncate rounded py-1 ${isActive ? 'bg-(--ctp-surface0) text-(--ctp-mauve)' : 'text-(--ctp-text) hover:bg-(--ctp-surface0)'}`}
    >
      {node.title}
    </Link>
  )
}
