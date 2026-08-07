// Design Ref: §7.5 라우팅 — /w/:wsSlug/p/:projSlug/* 와일드카드가 문서 경로 그대로.
import { useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { useWorkspaces } from '@/features/workspace/hooks/useWorkspaces'
import { useProjects } from '@/features/project/hooks/useProjects'
import { useDocumentByPath, useTree } from '../hooks/useDocumentByPath'
import { useResolvedLinks } from '../hooks/useResolvedLinks'
import { MarkdownView } from './MarkdownView'
import { FolderView } from './FolderView'
import { ImportDialog } from './ImportDialog'
import { STAGE_COLOR } from '../lib/stageColor'

export function DocumentViewPage() {
  const { wsSlug, projSlug, '*': docPath = '' } = useParams<{
    wsSlug: string
    projSlug: string
    '*': string
  }>()

  const { data: workspaces, isLoading: wsLoading } = useWorkspaces()
  const workspace = workspaces?.find((w) => w.slug === wsSlug)
  const { data: projects, isLoading: projLoading } = useProjects(workspace?.id ?? '')
  const project = projects?.find((p) => p.slug === projSlug)

  if (wsLoading || (workspace && projLoading)) {
    return <p className="p-8 text-(--ctp-subtext1)">불러오는 중...</p>
  }
  if (!workspace) return <p className="p-8 text-(--ctp-red)">워크스페이스를 찾을 수 없습니다: {wsSlug}</p>
  if (!project) return <p className="p-8 text-(--ctp-red)">프로젝트를 찾을 수 없습니다: {projSlug}</p>

  if (docPath.endsWith('/') || docPath === '') {
    return (
      <FolderTreeContainer
        projectId={project.id}
        wsSlug={workspace.slug}
        projSlug={project.slug}
        prefix={docPath}
      />
    )
  }

  return (
    <DocumentContainer
      projectId={project.id}
      wsSlug={workspace.slug}
      projSlug={project.slug}
      docPath={docPath}
    />
  )
}

function FolderTreeContainer({
  projectId,
  wsSlug,
  projSlug,
  prefix,
}: {
  projectId: string
  wsSlug: string
  projSlug: string
  prefix: string
}) {
  const { data, isLoading } = useTree(projectId, prefix)
  if (isLoading) return <p className="p-8 text-(--ctp-subtext1)">불러오는 중...</p>
  return (
    <FolderView
      wsSlug={wsSlug}
      projSlug={projSlug}
      prefix={prefix}
      folders={data?.folders ?? []}
      documents={data?.documents.map((d) => ({ path: d.path, title: d.title })) ?? []}
    />
  )
}

function DocumentContainer({
  projectId,
  wsSlug,
  projSlug,
  docPath,
}: {
  projectId: string
  wsSlug: string
  projSlug: string
  docPath: string
}) {
  const { data: doc, isLoading } = useDocumentByPath(projectId, docPath)
  const { existingPaths } = useResolvedLinks(projectId, docPath, doc?.content ?? '')
  const [editing, setEditing] = useState(false)

  if (isLoading) return <p className="p-8 text-(--ctp-subtext1)">불러오는 중...</p>

  if (!doc) {
    return (
      <div className="p-8">
        <p className="text-(--ctp-text)">이 경로에 문서가 없습니다.</p>
        <p className="mt-1 font-mono text-sm text-(--ctp-overlay0)">{docPath}</p>
        <Link to={`/w/${wsSlug}/p/${projSlug}`} className="mt-4 inline-block text-(--ctp-blue) underline">
          ← 프로젝트로 돌아가서 임포트
        </Link>
      </div>
    )
  }

  if (editing) {
    return (
      <div className="mx-auto max-w-3xl p-8">
        <ImportDialog
          projectId={projectId}
          wsSlug={wsSlug}
          projSlug={projSlug}
          document={doc}
          onClose={() => setEditing(false)}
        />
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-3xl p-8">
      <nav className="mb-4 text-sm text-(--ctp-overlay0)">
        <Link to={`/w/${wsSlug}`} className="underline">
          {wsSlug}
        </Link>{' '}
        /{' '}
        <Link to={`/w/${wsSlug}/p/${projSlug}`} className="underline">
          {projSlug}
        </Link>{' '}
        / <span className="font-mono">{docPath}</span>
      </nav>
      <div className="mb-2 flex items-center gap-2">
        <h1 className="text-lg font-medium text-(--ctp-text)">{doc.title}</h1>
        {doc.kind === 'pdca' && doc.pdcaStage && (
          <span
            className="rounded bg-(--ctp-surface0) px-1.5 py-0.5 text-xs"
            style={{ color: STAGE_COLOR[doc.pdcaStage] }}
          >
            {doc.pdcaStage}
          </span>
        )}
        <button
          onClick={() => setEditing(true)}
          className="ml-auto text-sm text-(--ctp-subtext1) underline"
        >
          편집
        </button>
      </div>
      <MarkdownView
        content={doc.content}
        currentPath={docPath}
        wsSlug={wsSlug}
        projSlug={projSlug}
        existingPaths={existingPaths}
      />
    </div>
  )
}
