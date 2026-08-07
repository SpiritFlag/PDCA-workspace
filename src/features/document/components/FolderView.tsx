// Design Ref: FR-09 — 디렉터리 링크 착지점. tree 조회 결과를 목록으로.
import { Link } from 'react-router-dom'

export function FolderView({
  wsSlug,
  projSlug,
  prefix,
  folders,
  documents,
}: {
  wsSlug: string
  projSlug: string
  prefix: string
  folders: { name: string; path: string }[]
  documents: { path: string; title: string }[]
}) {
  return (
    <div className="p-8">
      <h1 className="mb-1 text-lg font-medium text-(--ctp-text)">📁 {prefix || '(루트)'}</h1>
      <ul className="mt-4 flex flex-col gap-1">
        {folders.map((f) => (
          <li key={f.path}>
            <Link
              to={`/w/${wsSlug}/p/${projSlug}/${f.path}`}
              className="text-(--ctp-blue) underline"
            >
              📁 {f.name}/
            </Link>
          </li>
        ))}
        {documents.map((d) => (
          <li key={d.path}>
            <Link
              to={`/w/${wsSlug}/p/${projSlug}/${d.path}`}
              className="text-(--ctp-text) hover:text-(--ctp-mauve)"
            >
              {d.title}
            </Link>
            <span className="ml-2 font-mono text-xs text-(--ctp-overlay0)">{d.path}</span>
          </li>
        ))}
        {folders.length === 0 && documents.length === 0 && (
          <p className="text-sm text-(--ctp-overlay0)">비어 있습니다.</p>
        )}
      </ul>
    </div>
  )
}
