// module-3: 문서 제목 클릭 시 뷰어(DocumentViewPage)로 이동.
import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useDeleteDocument, useDocuments } from '../hooks/useDocuments'
import { ImportDialog } from './ImportDialog'
import { STAGE_COLOR } from '../lib/stageColor'

export function DocumentList({
  projectId,
  wsSlug,
  projSlug,
}: {
  projectId: string
  wsSlug: string
  projSlug: string
}) {
  const { data: documents, isLoading } = useDocuments(projectId)
  const deleteMut = useDeleteDocument(projectId)
  const [importing, setImporting] = useState(false)

  async function handleDelete(id: string, title: string) {
    if (!confirm(`"${title}" 문서를 삭제할까요?`)) return
    await deleteMut.mutateAsync(id)
  }

  return (
    <div>
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-sm font-medium text-(--ctp-text)">문서 ({documents?.length ?? 0})</h2>
        {!importing && (
          <button
            onClick={() => setImporting(true)}
            className="rounded bg-(--ctp-mauve) px-3 py-1.5 text-sm text-(--ctp-base)"
          >
            + 문서 임포트
          </button>
        )}
      </div>

      {importing && (
        <div className="mb-4">
          <ImportDialog
            projectId={projectId}
            wsSlug={wsSlug}
            projSlug={projSlug}
            onClose={() => setImporting(false)}
          />
        </div>
      )}

      {isLoading ? (
        <p className="text-sm text-(--ctp-subtext1)">불러오는 중...</p>
      ) : (
        <ul className="flex flex-col gap-1">
          {documents?.map((d) => (
            <li
              key={d.id}
              className="flex items-center justify-between rounded border border-(--ctp-surface0) bg-(--ctp-mantle) px-3 py-2"
            >
              <Link to={`/w/${wsSlug}/p/${projSlug}/${d.path}`} className="min-w-0">
                <span className="text-(--ctp-text) hover:text-(--ctp-mauve)">{d.title}</span>
                {d.kind === 'pdca' && d.pdcaStage && (
                  <span
                    className="ml-2 rounded bg-(--ctp-surface0) px-1.5 py-0.5 text-xs"
                    style={{ color: STAGE_COLOR[d.pdcaStage] }}
                  >
                    {d.pdcaStage}
                  </span>
                )}
                <div className="font-mono text-xs text-(--ctp-overlay0)">{d.path}</div>
              </Link>
              <button
                onClick={() => handleDelete(d.id, d.title)}
                className="shrink-0 text-sm text-(--ctp-red) underline"
              >
                삭제
              </button>
            </li>
          ))}
          {documents?.length === 0 && (
            <p className="text-sm text-(--ctp-overlay0)">아직 문서가 없습니다.</p>
          )}
        </ul>
      )}
    </div>
  )
}
