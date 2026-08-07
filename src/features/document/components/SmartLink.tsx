// Design Ref: §7.5 링크 판정 흐름 — 링크 4분류(FR-07/08/09/10) 렌더.
import { Link } from 'react-router-dom'
import { classifyLink, resolveRelative } from '@/lib/path'

export function SmartLink({
  href,
  children,
  currentPath,
  wsSlug,
  projSlug,
  existingPaths,
}: {
  href?: string
  children?: React.ReactNode
  currentPath: string
  wsSlug: string
  projSlug: string
  existingPaths: Set<string>
}) {
  if (!href) return <span>{children}</span>

  const cls = classifyLink(href)

  if (cls === 'external') {
    return (
      <a href={href} target="_blank" rel="noreferrer" className="text-(--ctp-blue) underline">
        {children} ↗
      </a>
    )
  }
  if (cls === 'anchor') {
    return (
      <a href={href} className="text-(--ctp-blue) underline">
        {children}
      </a>
    )
  }

  const resolved = resolveRelative(currentPath, href)
  if (resolved === null) {
    return (
      <span
        title="워크스페이스 밖의 경로입니다"
        className="cursor-not-allowed text-(--ctp-overlay0) line-through decoration-(--ctp-overlay0)"
      >
        🚫 {children}
      </span>
    )
  }

  if (cls === 'directory') {
    return (
      <Link to={`/w/${wsSlug}/p/${projSlug}/${resolved}`} className="text-(--ctp-blue) underline">
        📁 {children}
      </Link>
    )
  }

  // document
  if (existingPaths.has(resolved)) {
    return (
      <Link to={`/w/${wsSlug}/p/${projSlug}/${resolved}`} className="text-(--ctp-blue) underline">
        {children}
      </Link>
    )
  }
  return (
    <span
      title={`워크스페이스에 없는 문서: ${resolved}`}
      className="cursor-not-allowed text-(--ctp-overlay0) line-through decoration-(--ctp-overlay0)"
    >
      🚫 {children}
    </span>
  )
}
