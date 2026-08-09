// Design Ref: §5.3, §9 D-77 — 프로젝트 개요 상단 최신 릴리즈 하이라이트(S7). 신규 API 없음,
// useCycles 목록에서 sortCycles(version-desc)[0]로 산출.
import { Link } from 'react-router-dom'
import { sortCycles } from '../lib/versionSort'
import { releaseUrl } from '../lib/releaseUrl'

type Cycle = { id: string; version: string; name?: string | null }

export function LatestReleaseCard({
  cycles,
  wsSlug,
  projSlug,
}: {
  cycles: Cycle[]
  wsSlug: string
  projSlug: string
}) {
  const latest = sortCycles(cycles, 'version-desc')[0]
  if (!latest) return null

  return (
    <Link
      to={releaseUrl(wsSlug, projSlug, latest.version)}
      className="mb-6 flex items-center justify-between rounded-lg border border-(--ctp-surface0) bg-(--ctp-mantle) px-4 py-3 hover:bg-(--ctp-surface0)"
    >
      <div className="flex items-center gap-2 text-sm">
        <span className="text-(--ctp-overlay0)">최신 릴리즈</span>
        <span className="rounded bg-(--ctp-surface0) px-1.5 py-0.5 font-mono font-medium text-(--ctp-mauve)">
          {latest.version}
        </span>
        {latest.name && (
          <span className="font-mono text-xs text-(--ctp-overlay0)">{latest.name}</span>
        )}
      </div>
      <span className="text-sm text-(--ctp-blue)">상세 보기 →</span>
    </Link>
  )
}
