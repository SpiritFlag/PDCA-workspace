// Design Ref: §5.1, §9 D-77~D-79, D-82 — 릴리즈 상세 페이지. 신규 서버 호출 없이
// useCycles 목록에서 version 매치(D-77). S1(라우트)·S2(4문서+노트)·S6(삭제 이관) 집결지.
import { useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { useWorkspaces } from '@/features/workspace/hooks/useWorkspaces'
import { useProjects } from '@/features/project/hooks/useProjects'
import { useDocuments } from '@/features/document/hooks/useDocuments'
import { STAGE_COLOR } from '@/features/document/lib/stageColor'
import { useCycles, useDeleteCycle } from '../hooks/useCycles'
import { PDCA_STAGES, cycleStagePath } from '../lib/cyclePath'
import { ReleaseNoteView } from './ReleaseNoteView'

export function ReleasePage() {
  const { wsSlug, projSlug, version } = useParams<{
    wsSlug: string
    projSlug: string
    version: string
  }>()
  const navigate = useNavigate()

  const { data: workspaces, isLoading: wsLoading } = useWorkspaces()
  const workspace = workspaces?.find((w) => w.slug === wsSlug)
  const { data: projects, isLoading: projLoading } = useProjects(workspace?.id ?? '')
  const project = projects?.find((p) => p.slug === projSlug)

  const { data: cycles, isLoading: cyclesLoading } = useCycles(project?.id ?? '')
  const { data: documents } = useDocuments(project?.id ?? '')
  const deleteMut = useDeleteCycle(project?.id ?? '')
  const [deleteError, setDeleteError] = useState<string | null>(null)

  if (wsLoading || (workspace && projLoading)) {
    return <p className="p-8 text-(--ctp-subtext1)">불러오는 중...</p>
  }
  if (!workspace) return <p className="p-8 text-(--ctp-red)">워크스페이스를 찾을 수 없습니다: {wsSlug}</p>
  if (!project) return <p className="p-8 text-(--ctp-red)">프로젝트를 찾을 수 없습니다: {projSlug}</p>

  if (cyclesLoading) return <p className="p-8 text-(--ctp-subtext1)">불러오는 중...</p>

  // Plan SC: C42 — FR-112, 없는 버전 URL 직접 접근 시 명시적 안내
  const cycle = cycles?.find((c) => c.version === version)
  if (!cycle) {
    return (
      <div className="p-8">
        <p className="text-(--ctp-text)">이 버전이 없습니다: {version}</p>
        <Link to={`/w/${wsSlug}/p/${projSlug}`} className="mt-4 inline-block text-(--ctp-blue) underline">
          ← 프로젝트로 돌아가기
        </Link>
      </div>
    )
  }

  // Design Ref: §1.2 — 로컬 const로 구조분해해 클로저 경계를 넘어도 내로잉이 유지되게 한다
  // (TS는 프로퍼티 접근의 내로잉을 클로저 너머로 보존하지 않는다). `!` 단언 대신 이 방식을 쓴다.
  const { id: cycleId, version: cycleVersion, name, yearMonth, releaseNote } = cycle
  const hasCycle = !!name && !!yearMonth
  const note = releaseNote?.trim()
  const existingPaths = new Set((documents ?? []).map((d) => d.path))

  const handleDelete = async () => {
    if (!confirm(`${cycleVersion} 버전을 삭제할까요? (연결된 문서 자체는 그대로 남습니다)`)) return
    setDeleteError(null)
    try {
      await deleteMut.mutateAsync(cycleId)
      navigate(`/w/${wsSlug}/p/${projSlug}`)
    } catch {
      setDeleteError('버전 삭제에 실패했습니다')
    }
  }

  return (
    <div className="mx-auto max-w-4xl p-8">
      <Link to={`/w/${wsSlug}/p/${projSlug}`} className="text-sm text-(--ctp-overlay0) underline">
        ← {project.name}
      </Link>

      <div className="mt-2 mb-6 flex items-center gap-2">
        <span className="rounded bg-(--ctp-surface0) px-1.5 py-0.5 font-mono text-sm font-medium text-(--ctp-mauve)">
          {cycleVersion}
        </span>
        {hasCycle && (
          <span className="font-mono text-sm text-(--ctp-overlay0)">{name}</span>
        )}
      </div>

      {hasCycle && name && yearMonth && (
        <div className="mb-8 grid grid-cols-4 gap-2">
          {PDCA_STAGES.map((stage) => {
            const path = cycleStagePath(yearMonth, name, stage)
            const exists = existingPaths.has(path)
            return exists ? (
              <Link
                key={stage}
                to={`/w/${wsSlug}/p/${projSlug}/${path}`}
                className="rounded border border-(--ctp-surface1) bg-(--ctp-mantle) py-2 text-center text-sm font-medium"
                style={{ color: STAGE_COLOR[stage] }}
              >
                {stage}
              </Link>
            ) : (
              <span
                key={stage}
                className="rounded border border-dashed border-(--ctp-surface1) py-2 text-center text-sm text-(--ctp-overlay0)"
              >
                {stage}
              </span>
            )
          })}
        </div>
      )}

      <div className="border-t border-(--ctp-surface0) pt-4">
        <h2 className="mb-2 text-sm font-medium text-(--ctp-text)">릴리즈 노트</h2>
        {note ? (
          <ReleaseNoteView content={note} />
        ) : (
          <p className="text-sm text-(--ctp-overlay0)">릴리즈 노트가 없습니다.</p>
        )}
      </div>

      {/* Design Ref: §9 D-82 — 위험 동작은 헤더(편집류)와 물리 분리된 하단 구역에 배치 */}
      <div className="mt-10 border-t border-(--ctp-surface0) pt-4">
        {deleteError && <p className="mb-2 text-sm text-(--ctp-red)">{deleteError}</p>}
        <div className="flex justify-end">
          <button
            onClick={handleDelete}
            disabled={deleteMut.isPending}
            className="text-sm text-(--ctp-red) underline disabled:opacity-50"
          >
            이 버전 삭제
          </button>
        </div>
      </div>
    </div>
  )
}
