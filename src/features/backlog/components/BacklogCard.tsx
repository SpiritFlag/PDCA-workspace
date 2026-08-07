// Design Ref: §5.1 카드 미리보기 — 이름 + 중요도 배지 + 상태 배지 + 날짜. §5.1 드래그: 섹션 내부만.
import type { BacklogItem } from '../api'
import { PRIORITY_COLOR, PRIORITY_LABEL, STATUS_COLOR, STATUS_LABEL } from '../lib/labels'

export function Badge({ color, label }: { color: string; label: string }) {
  return (
    <span
      className="shrink-0 rounded bg-(--ctp-surface0) px-1.5 py-0.5 text-xs"
      style={{ color }}
    >
      {label}
    </span>
  )
}

export function BacklogCard({
  item,
  onOpen,
  draggable,
  dragging,
  showInsertLine,
  onDragStart,
  onDragOver,
  onDrop,
  onDragEnd,
}: {
  item: BacklogItem
  onOpen: () => void
  draggable: boolean
  dragging: boolean
  showInsertLine: boolean
  onDragStart: () => void
  onDragOver: (e: React.DragEvent) => void
  onDrop: () => void
  onDragEnd: () => void
}) {
  return (
    <div>
      {showInsertLine && <div className="mb-1.5 h-0.5 rounded bg-(--ctp-mauve)" />}
      <div
        draggable={draggable}
        onDragStart={onDragStart}
        onDragOver={onDragOver}
        onDrop={onDrop}
        onDragEnd={onDragEnd}
        onClick={onOpen}
        className={`flex cursor-pointer items-center gap-2 rounded border border-(--ctp-surface0) bg-(--ctp-mantle) px-3 py-2 hover:border-(--ctp-mauve) ${dragging ? 'opacity-40' : ''}`}
      >
        <span className="shrink-0 cursor-grab text-(--ctp-overlay0)" aria-hidden>
          ≡
        </span>
        <span
          className={`min-w-0 flex-1 truncate text-(--ctp-text) ${item.status === 'dropped' ? 'line-through decoration-(--ctp-overlay0)' : ''}`}
        >
          {item.title}
        </span>
        <Badge color={PRIORITY_COLOR[item.priority]} label={PRIORITY_LABEL[item.priority]} />
        <Badge color={STATUS_COLOR[item.status]} label={STATUS_LABEL[item.status]} />
        <span className="hidden shrink-0 font-mono text-xs text-(--ctp-overlay0) sm:inline">
          {item.openedOn} ~ {item.closedOn ?? ''}
        </span>
      </div>
    </div>
  )
}
