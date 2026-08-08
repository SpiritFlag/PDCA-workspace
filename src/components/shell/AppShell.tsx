// Design Ref: §5.1 화면 레이아웃 — 사이드바+상단바 프레임 (반응형: 좁은 화면에서 사이드바 숨김)
import { useState } from 'react'
import { Link } from 'react-router-dom'
import type { ReactNode } from 'react'
import { authClient } from '@/lib/auth'
import { SidebarTree } from './SidebarTree'
import { ThemeToggle } from './ThemeToggle'
import { CommandPalette } from './CommandPalette'

export function AppShell({ children }: { children: ReactNode }) {
  const { data: session } = authClient.useSession()
  const [sidebarOpen, setSidebarOpen] = useState(() => window.matchMedia('(min-width: 768px)').matches)

  return (
    <div className="flex h-screen flex-col">
      <header className="flex items-center justify-between border-b border-(--ctp-surface0) px-3 py-2 text-xs">
        <div className="flex items-center gap-2">
          <button
            onClick={() => setSidebarOpen((o) => !o)}
            className="rounded px-1.5 py-0.5 text-(--ctp-subtext1) hover:bg-(--ctp-surface0) md:hidden"
            aria-label="사이드바 토글"
          >
            ☰
          </button>
          <Link to="/" className="font-medium text-(--ctp-text)">
            PDCA-workspace
          </Link>
        </div>
        <div className="flex items-center gap-3">
          <span className="hidden text-(--ctp-overlay0) sm:inline">⌘K 검색</span>
          <ThemeToggle />
          <Link to="/settings/tokens" className="text-(--ctp-overlay0) underline">
            API 토큰
          </Link>
          <span className="text-(--ctp-subtext1)">{session?.user.email}</span>
          <button onClick={() => authClient.signOut()} className="text-(--ctp-overlay0) underline">
            로그아웃
          </button>
        </div>
      </header>

      <div className="flex min-h-0 flex-1">
        <aside
          className={`${sidebarOpen ? 'block' : 'hidden'} w-64 shrink-0 overflow-y-auto border-r border-(--ctp-surface0) bg-(--ctp-mantle) md:block`}
        >
          <SidebarTree />
        </aside>
        <main className="min-w-0 flex-1 overflow-y-auto">{children}</main>
      </div>

      <CommandPalette />
    </div>
  )
}
