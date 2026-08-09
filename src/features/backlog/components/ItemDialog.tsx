// Design Ref: §5.3 상세 팝업 — 카드 클릭(수정) 또는 [+ 항목](생성) 양쪽에서 쓰는 모달.
import { useEffect, useState } from 'react'
import { canTransition, isClosed, STATUS_MEANING, type BacklogStatus } from '@shared/transition'
import { MarkdownView } from '@/features/document/components/MarkdownView'
import { useResolvedLinks } from '@/features/document/hooks/useResolvedLinks'
import type { BacklogItem } from '../api'
import { useCreateBacklogItem, useDeleteBacklogItem, useUpdateBacklogItem } from '../hooks/useBacklog'
import { Badge } from './BacklogCard'
import { PRIORITY_LABEL, PRIORITY_ORDER, STATUS_COLOR, STATUS_LABEL, STATUS_ORDER } from '../lib/labels'
import type { BacklogPriority } from '@shared/schema'

function todayStr() {
  return new Date().toISOString().slice(0, 10)
}

export function ItemDialog({
  projectId,
  item,
  wsSlug,
  projSlug,
  onClose,
}: {
  projectId: string
  item?: BacklogItem
  wsSlug: string
  projSlug: string
  onClose: () => void
}) {
  const [title, setTitle] = useState(item?.title ?? '')
  const [priority, setPriority] = useState<BacklogPriority>(item?.priority ?? 'medium')
  const [openedOn, setOpenedOn] = useState(item?.openedOn ?? todayStr())
  const [closedOn, setClosedOn] = useState(item?.closedOn ?? '')
  const [detailDraft, setDetailDraft] = useState(item?.detail ?? '')
  const [editingDetail, setEditingDetail] = useState(!item)

  const createMut = useCreateBacklogItem(projectId)
  const updateMut = useUpdateBacklogItem(projectId)
  const deleteMut = useDeleteBacklogItem(projectId)

  const { existingPaths } = useResolvedLinks(projectId, '', item?.detail ?? '')

  const dirty = item
    ? title !== item.title ||
      priority !== item.priority ||
      openedOn !== item.openedOn ||
      closedOn !== (item.closedOn ?? '') ||
      detailDraft !== (item.detail ?? '')
    : title !== '' || detailDraft !== ''

  function handleClose() {
    if (dirty && !confirm('편집 중인 내용이 있습니다. 닫을까요?')) return
    onClose()
  }

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') handleClose()
    }
    document.addEventListener('keydown', onKeyDown)
    return () => document.removeEventListener('keydown', onKeyDown)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dirty])

  async function handleStatusClick(next: BacklogStatus) {
    if (!item || next === item.status) return
    if (!canTransition(item.status, next, 'user')) return
    let nextClosedOn = closedOn
    if (isClosed(next) && !nextClosedOn) {
      nextClosedOn = todayStr()
      setClosedOn(nextClosedOn)
    }
    // Design Ref: §5.1 D-22·D-28 — 배지 클릭은 날짜 무변경(키 생략). 지우기는 폼 저장 경로만
    await updateMut.mutateAsync({
      id: item.id,
      input: { status: next, closedOn: nextClosedOn || undefined },
    })
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (item) {
      // Design Ref: §3.3 D-28 — 폼 저장 경로만 null을 보낸다: 빈 값 = 명시적으로 지움
      const result = await updateMut.mutateAsync({
        id: item.id,
        input: { title, priority, openedOn, closedOn: closedOn === '' ? null : closedOn, detail: detailDraft },
      })
      if (result.ok) onClose()
    } else {
      const result = await createMut.mutateAsync({
        title,
        priority,
        openedOn,
        detail: detailDraft || undefined,
      })
      if (result.ok) onClose()
    }
  }

  async function handleDelete() {
    if (!item) return
    if (!confirm('완전히 삭제됩니다 — "삭제" 상태와 다르게 되돌릴 수 없습니다. 계속할까요?')) return
    await deleteMut.mutateAsync(item.id)
    onClose()
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/40 p-4 pt-16"
      onClick={handleClose}
    >
      <form
        onClick={(e) => e.stopPropagation()}
        onSubmit={handleSubmit}
        className="flex w-full max-w-lg flex-col gap-3 rounded-lg border border-(--ctp-surface0) bg-(--ctp-mantle) p-4"
      >
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-medium text-(--ctp-text)">{item ? '항목 수정' : '항목 추가'}</h2>
          <button type="button" onClick={handleClose} className="text-(--ctp-overlay0) hover:text-(--ctp-text)">
            ✕
          </button>
        </div>

        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="이름"
          required
          maxLength={300}
          className="rounded border border-(--ctp-surface1) bg-(--ctp-base) px-3 py-1.5 text-(--ctp-text)"
        />

        <div className="flex flex-wrap items-center gap-3">
          <label className="flex items-center gap-2 text-sm text-(--ctp-subtext1)">
            중요도
            <select
              value={priority}
              onChange={(e) => setPriority(e.target.value as BacklogPriority)}
              className="rounded border border-(--ctp-surface1) bg-(--ctp-base) px-2 py-1 text-(--ctp-text)"
            >
              {PRIORITY_ORDER.map((p) => (
                <option key={p} value={p}>
                  {PRIORITY_LABEL[p]}
                </option>
              ))}
            </select>
          </label>
          <label className="flex items-center gap-2 text-sm text-(--ctp-subtext1)">
            생성일
            <input
              type="date"
              value={openedOn}
              onChange={(e) => setOpenedOn(e.target.value)}
              required
              className="rounded border border-(--ctp-surface1) bg-(--ctp-base) px-2 py-1 text-(--ctp-text)"
            />
          </label>
          <label className="flex items-center gap-2 text-sm text-(--ctp-subtext1)">
            처리일
            <input
              type="date"
              value={closedOn}
              onChange={(e) => setClosedOn(e.target.value)}
              className="rounded border border-(--ctp-surface1) bg-(--ctp-base) px-2 py-1 text-(--ctp-text)"
            />
            {/* Design Ref: §5.1 D-27 — 값이 있을 때만 지우기 동선 표시 */}
            {closedOn !== '' && (
              <button
                type="button"
                onClick={() => setClosedOn('')}
                aria-label="처리일 지우기"
                className="text-(--ctp-overlay0) hover:text-(--ctp-text)"
              >
                ✕
              </button>
            )}
          </label>
        </div>

        {item && (
          <div className="flex flex-wrap gap-1.5">
            {STATUS_ORDER.map((s) => (
              <button
                type="button"
                key={s}
                onClick={() => handleStatusClick(s)}
                title={STATUS_MEANING[s]}
                className={`rounded px-1.5 py-0.5 ${item.status === s ? 'ring-2 ring-(--ctp-mauve)' : 'opacity-70 hover:opacity-100'}`}
              >
                <Badge color={STATUS_COLOR[s]} label={STATUS_LABEL[s]} />
              </button>
            ))}
          </div>
        )}

        <div>
          <div className="mb-1 flex items-center justify-between">
            <span className="text-sm text-(--ctp-subtext1)">상세내용</span>
            <button
              type="button"
              onClick={() => setEditingDetail((v) => !v)}
              className="text-xs text-(--ctp-subtext1) underline"
            >
              {editingDetail ? '미리보기' : '편집'}
            </button>
          </div>
          {editingDetail ? (
            <textarea
              value={detailDraft}
              onChange={(e) => setDetailDraft(e.target.value)}
              rows={8}
              placeholder="마크다운으로 작성..."
              className="w-full rounded border border-(--ctp-surface1) bg-(--ctp-base) p-2 font-mono text-sm text-(--ctp-text)"
            />
          ) : (
            <div className="rounded border border-(--ctp-surface0) bg-(--ctp-base) p-2">
              <MarkdownView
                content={detailDraft || '_내용 없음_'}
                currentPath=""
                wsSlug={wsSlug}
                projSlug={projSlug}
                existingPaths={existingPaths}
              />
            </div>
          )}
        </div>

        <div className="flex items-center justify-between">
          {item ? (
            <button type="button" onClick={handleDelete} className="text-sm text-(--ctp-red) underline">
              삭제
            </button>
          ) : (
            <span />
          )}
          <button
            type="submit"
            disabled={createMut.isPending || updateMut.isPending}
            className="rounded bg-(--ctp-mauve) px-3 py-1.5 text-sm text-(--ctp-base) disabled:opacity-50"
          >
            저장
          </button>
        </div>
      </form>
    </div>
  )
}
