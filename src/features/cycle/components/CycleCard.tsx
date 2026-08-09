// 버전 카드 — 버전 클릭 시 릴리즈 상세로 이동(D-78, 릴리즈노트·삭제는 상세로 이관).
// PDCA 사이클 연결 시 4버튼(plan/design/analysis/report)은 카드에 유지.
import { Link } from 'react-router-dom'
import { STAGE_COLOR } from '@/features/document/lib/stageColor'
import { PDCA_STAGES, cycleStagePath, type PdcaStage } from '../lib/cyclePath'
import { releaseUrl } from '../lib/releaseUrl'

type Cycle = {
  id: string
  version: string
  releaseNote?: string | null
  name?: string | null
  yearMonth?: string | null
}

export function CycleCard({
  cycle,
  wsSlug,
  projSlug,
  existingPaths,
  onCreateStage,
  onEdit,
}: {
  cycle: Cycle
  wsSlug: string
  projSlug: string
  existingPaths: Set<string>
  onCreateStage: (stage: PdcaStage) => void
  onEdit: () => void
}) {
  const hasCycle = !!cycle.name && !!cycle.yearMonth

  return (
    <div className="rounded-lg border border-(--ctp-surface0) bg-(--ctp-mantle) p-4">
      <div className="flex items-start justify-between gap-2">
        <Link
          to={releaseUrl(wsSlug, projSlug, cycle.version)}
          className="flex min-w-0 items-center gap-2"
        >
          <span className="shrink-0 rounded bg-(--ctp-surface0) px-1.5 py-0.5 font-mono text-sm font-medium text-(--ctp-mauve)">
            {cycle.version}
          </span>
          {hasCycle && (
            <span className="truncate font-mono text-xs text-(--ctp-overlay0)">{cycle.name}</span>
          )}
        </Link>
        <div className="flex shrink-0 gap-2 text-sm">
          <button onClick={onEdit} className="text-(--ctp-subtext1) underline">
            수정
          </button>
        </div>
      </div>

      {hasCycle && (
        <div className="mt-3 grid grid-cols-4 gap-2">
          {PDCA_STAGES.map((stage) => {
            const path = cycleStagePath(cycle.yearMonth!, cycle.name!, stage)
            const exists = existingPaths.has(path)
            return exists ? (
              <Link
                key={stage}
                to={`/w/${wsSlug}/p/${projSlug}/${path}`}
                className="rounded border border-(--ctp-surface1) bg-(--ctp-base) py-2 text-center text-sm font-medium"
                style={{ color: STAGE_COLOR[stage] }}
              >
                {stage}
              </Link>
            ) : (
              <button
                key={stage}
                onClick={() => onCreateStage(stage)}
                className="rounded border border-dashed border-(--ctp-surface1) py-2 text-center text-sm text-(--ctp-overlay0) hover:text-(--ctp-subtext1)"
              >
                + {stage}
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}
