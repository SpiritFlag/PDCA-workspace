// Design Ref: §5.1 — 종료 3섹션(완료/해소/삭제) 각각 독립 접힘. 접힘 상태는 localStorage 유지(Q7).
import { useState } from 'react'
import type { ReactNode } from 'react'

export function SectionCollapse({
  storageKey,
  title,
  count,
  children,
}: {
  storageKey: string
  title: string
  count: number
  children: ReactNode
}) {
  const [open, setOpen] = useState(() => localStorage.getItem(storageKey) === 'open')

  function toggle() {
    setOpen((prev) => {
      const next = !prev
      localStorage.setItem(storageKey, next ? 'open' : 'closed')
      return next
    })
  }

  return (
    <div className="mt-3">
      <button
        onClick={toggle}
        className="flex w-full items-center gap-1.5 py-1.5 text-sm text-(--ctp-subtext1) hover:text-(--ctp-text)"
      >
        <span className="text-xs">{open ? '▾' : '▸'}</span>
        {title} ({count})
      </button>
      {open && <div className="flex flex-col gap-1.5 pl-1">{children}</div>}
    </div>
  )
}
