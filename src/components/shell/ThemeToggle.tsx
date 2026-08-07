// Design Ref: §5.5 테마 — Latte(라이트)/Mocha(다크) 토글, localStorage 유지 (FR-18)
import { useEffect, useState } from 'react'

type Theme = 'latte' | 'mocha'

function getInitialTheme(): Theme {
  const stored = localStorage.getItem('theme')
  if (stored === 'latte' || stored === 'mocha') return stored
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'mocha' : 'latte'
}

export function ThemeToggle() {
  const [theme, setTheme] = useState<Theme>(getInitialTheme)

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme)
    localStorage.setItem('theme', theme)
  }, [theme])

  return (
    <button
      onClick={() => setTheme((t) => (t === 'latte' ? 'mocha' : 'latte'))}
      className="rounded px-1.5 py-0.5 text-(--ctp-subtext1) hover:bg-(--ctp-surface0)"
      title={theme === 'latte' ? '다크 모드로 전환' : '라이트 모드로 전환'}
    >
      {theme === 'latte' ? '🌙' : '☀️'}
    </button>
  )
}
