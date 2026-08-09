// 버전(release) 목록 — 버전 카드 + 정렬(버전최신/버전오래된/이름) + 버전 생성/수정.
// 사이클 연결된 버전의 stage 버튼(문서 없음) 클릭 시 ImportDialog를 프리필해 생성모드로 연다.
// 삭제는 릴리즈 상세 페이지로 이관됐다(Design §9 D-78, S6).
import { useState } from 'react'
import { useDocuments } from '@/features/document/hooks/useDocuments'
import { ImportDialog } from '@/features/document/components/ImportDialog'
import { useCreateCycle, useCycles, useUpdateCycle } from '../hooks/useCycles'
import { sortCycles, type CycleSortMode } from '../lib/versionSort'
import type { PdcaStage } from '../lib/cyclePath'
import { CycleCard } from './CycleCard'
import { CycleForm } from './CycleForm'
import type { CreateCycleInput } from '@shared/schema'

const SORT_LABELS: Record<CycleSortMode, string> = {
  'version-desc': '버전 최신순',
  'version-asc': '버전 오래된순',
  name: '이름순',
}

export function CycleList({
  projectId,
  wsSlug,
  projSlug,
}: {
  projectId: string
  wsSlug: string
  projSlug: string
}) {
  const { data: cycles, isLoading } = useCycles(projectId)
  const { data: documents } = useDocuments(projectId)
  const createMut = useCreateCycle(projectId)
  const updateMut = useUpdateCycle(projectId)

  const [sortMode, setSortMode] = useState<CycleSortMode>('version-desc')
  const [creating, setCreating] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [formError, setFormError] = useState<string | null>(null)
  const [stageCreate, setStageCreate] = useState<{
    name: string
    stage: PdcaStage
    yearMonth: string
  } | null>(null)

  const existingPaths = new Set((documents ?? []).map((d) => d.path))
  const sorted = sortCycles(cycles ?? [], sortMode)

  async function handleCreate(input: CreateCycleInput) {
    setFormError(null)
    const result = await createMut.mutateAsync(input)
    if (!result.ok) {
      const err = result.error as { message?: string }
      setFormError(err?.message ?? '버전 생성에 실패했습니다')
      return
    }
    setCreating(false)
  }

  async function handleUpdate(id: string, input: CreateCycleInput) {
    setFormError(null)
    const result = await updateMut.mutateAsync({ id, input })
    if (!result.ok) {
      const err = result.error as { message?: string }
      setFormError(err?.message ?? '버전 수정에 실패했습니다')
      return
    }
    setEditingId(null)
  }

  return (
    <div>
      <div className="mb-3 flex items-center justify-between gap-2">
        <h2 className="text-sm font-medium text-(--ctp-text)">버전 ({cycles?.length ?? 0})</h2>
        <div className="flex items-center gap-2">
          <select
            value={sortMode}
            onChange={(e) => setSortMode(e.target.value as CycleSortMode)}
            className="rounded border border-(--ctp-surface1) bg-(--ctp-base) px-2 py-1 text-xs text-(--ctp-text)"
          >
            {(Object.keys(SORT_LABELS) as CycleSortMode[]).map((m) => (
              <option key={m} value={m}>
                {SORT_LABELS[m]}
              </option>
            ))}
          </select>
          {!creating && (
            <button
              onClick={() => {
                setCreating(true)
                setFormError(null)
              }}
              className="rounded bg-(--ctp-mauve) px-3 py-1.5 text-sm text-(--ctp-base)"
            >
              + 버전 추가
            </button>
          )}
        </div>
      </div>

      {formError && <p className="mb-2 text-sm text-(--ctp-red)">{formError}</p>}

      {creating && (
        <div className="mb-4">
          <CycleForm
            onSubmit={handleCreate}
            onCancel={() => setCreating(false)}
            submitLabel="버전 추가"
          />
        </div>
      )}

      {stageCreate && (
        <div className="mb-4">
          <ImportDialog
            projectId={projectId}
            wsSlug={wsSlug}
            projSlug={projSlug}
            prefill={stageCreate}
            onClose={() => setStageCreate(null)}
          />
        </div>
      )}

      {isLoading ? (
        <p className="text-sm text-(--ctp-subtext1)">불러오는 중...</p>
      ) : (
        <div className="flex flex-col gap-2">
          {sorted.map((cycle) =>
            editingId === cycle.id ? (
              <CycleForm
                key={cycle.id}
                defaultValues={{
                  version: cycle.version,
                  releaseNote: cycle.releaseNote ?? undefined,
                  name: cycle.name ?? undefined,
                  yearMonth: cycle.yearMonth ?? undefined,
                }}
                onSubmit={(input) => handleUpdate(cycle.id, input)}
                onCancel={() => setEditingId(null)}
                submitLabel="저장"
              />
            ) : (
              <CycleCard
                key={cycle.id}
                cycle={cycle}
                wsSlug={wsSlug}
                projSlug={projSlug}
                existingPaths={existingPaths}
                onCreateStage={(stage) =>
                  setStageCreate({ name: cycle.name!, stage, yearMonth: cycle.yearMonth! })
                }
                onEdit={() => {
                  setEditingId(cycle.id)
                  setFormError(null)
                }}
              />
            ),
          )}
          {cycles?.length === 0 && (
            <p className="text-sm text-(--ctp-overlay0)">아직 버전이 없습니다.</p>
          )}
        </div>
      )}
    </div>
  )
}
