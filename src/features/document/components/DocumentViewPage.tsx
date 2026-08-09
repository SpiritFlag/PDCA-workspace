// Design Ref: §7.5 라우팅 — /w/:wsSlug/p/:projSlug/* 와일드카드가 문서 경로 그대로.
import { useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { useWorkspaces } from '@/features/workspace/hooks/useWorkspaces'
import { useProjects } from '@/features/project/hooks/useProjects'
import { useDocumentByPath, useTree } from '../hooks/useDocumentByPath'
import { useResolvedLinks } from '../hooks/useResolvedLinks'
import { useDeleteDocument } from '../hooks/useDocuments'
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
  const [deleteError, setDeleteError] = useState<string | null>(null)
  const deleteMut = useDeleteDocument(projectId)
  const navigate = useNavigate()

  // Design Ref: §9 D-85 — 신규 삭제 코드는 try/catch 필수(CRN M-8 미복제).
  // Design Ref: §9 D-84 — confirm 문구는 DocumentList.tsx의 handleDelete와 동일하게 유지한다
  // (상수 추출은 소비처 2곳뿐이라 과설계로 보류 — Plan §3.1 M-10).
  async function handleDelete() {
    if (!doc || !confirm(`"${doc.title}" 문서를 삭제할까요?`)) return
    setDeleteError(null)
    try {
      await deleteMut.mutateAsync(doc.id)
      navigate(`/w/${wsSlug}/p/${projSlug}`)
    } catch {
      setDeleteError('문서 삭제에 실패했습니다')
    }
  }

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
      <div className="mx-auto max-w-5xl p-8">
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
    <div className="mx-auto max-w-5xl p-8">
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

      {/* Design Ref: §9 D-82 — 위험 동작은 편집 버튼과 물리 분리된 하단 구역에(RK-54) */}
      <div className="mt-10 border-t border-(--ctp-surface0) pt-4">
        {deleteError && <p className="mb-2 text-sm text-(--ctp-red)">{deleteError}</p>}
        <div className="flex justify-end">
          <button
            onClick={handleDelete}
            disabled={deleteMut.isPending}
            className="text-sm text-(--ctp-red) underline disabled:opacity-50"
          >
            이 문서 삭제
          </button>
        </div>
      </div>
    </div>
  )
}
