// Design Ref: §5.3 CommandPalette — ⌘K 제목·경로 부분일치, ↑↓ 이동 + Enter (FR-17)
import { useEffect, useState } from 'react'
import { Command } from 'cmdk'
import { useNavigate, useParams } from 'react-router-dom'
import { useWorkspaces } from '@/features/workspace/hooks/useWorkspaces'
import { useProjects } from '@/features/project/hooks/useProjects'
import { useDocuments } from '@/features/document/hooks/useDocuments'

export function CommandPalette() {
  const [open, setOpen] = useState(false)
  const navigate = useNavigate()
  const { wsSlug, projSlug } = useParams<{ wsSlug: string; projSlug: string }>()

  const { data: workspaces } = useWorkspaces()
  const workspace = workspaces?.find((w) => w.slug === wsSlug)
  const { data: projects } = useProjects(workspace?.id ?? '')
  const project = projects?.find((p) => p.slug === projSlug)
  const { data: documents } = useDocuments(project?.id ?? '')

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault()
        setOpen((o) => !o)
      }
      if (e.key === 'Escape') setOpen(false)
    }
    document.addEventListener('keydown', onKeyDown)
    return () => document.removeEventListener('keydown', onKeyDown)
  }, [])

  if (!open) return null

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center bg-black/40 pt-24"
      onClick={() => setOpen(false)}
    >
      <div onClick={(e) => e.stopPropagation()} className="w-full max-w-lg">
        <Command
          className="overflow-hidden rounded-lg border border-(--ctp-surface0) bg-(--ctp-mantle) shadow-xl"
          shouldFilter
        >
          <Command.Input
            autoFocus
            placeholder={project ? '문서 제목·경로 검색...' : workspace ? '프로젝트 검색...' : '워크스페이스 검색...'}
            className="w-full border-b border-(--ctp-surface0) bg-transparent px-3 py-2.5 text-(--ctp-text) outline-none"
          />
          <Command.List className="max-h-80 overflow-y-auto p-1">
            <Command.Empty className="px-3 py-4 text-sm text-(--ctp-overlay0)">결과 없음</Command.Empty>

            {project && (
              <Command.Item
                value={`백로그 ${project.name}`}
                onSelect={() => {
                  navigate(`/w/${wsSlug}/p/${projSlug}/backlog`)
                  setOpen(false)
                }}
                className="cursor-pointer rounded px-3 py-2 text-sm text-(--ctp-text) data-[selected=true]:bg-(--ctp-surface0)"
              >
                ★ 백로그: {project.name}
              </Command.Item>
            )}

            {project &&
              documents?.map((d) => (
                <Command.Item
                  key={d.id}
                  value={`${d.title} ${d.path}`}
                  onSelect={() => {
                    navigate(`/w/${wsSlug}/p/${projSlug}/${d.path}`)
                    setOpen(false)
                  }}
                  className="cursor-pointer rounded px-3 py-2 text-sm text-(--ctp-text) data-[selected=true]:bg-(--ctp-surface0)"
                >
                  {d.title}
                  <span className="ml-2 font-mono text-xs text-(--ctp-overlay0)">{d.path}</span>
                </Command.Item>
              ))}

            {!project &&
              workspace &&
              projects?.map((p) => (
                <Command.Item
                  key={p.id}
                  value={p.name}
                  onSelect={() => {
                    navigate(`/w/${wsSlug}/p/${p.slug}`)
                    setOpen(false)
                  }}
                  className="cursor-pointer rounded px-3 py-2 text-sm text-(--ctp-text) data-[selected=true]:bg-(--ctp-surface0)"
                >
                  {p.name}
                </Command.Item>
              ))}

            {!workspace &&
              workspaces?.map((w) => (
                <Command.Item
                  key={w.id}
                  value={w.name}
                  onSelect={() => {
                    navigate(`/w/${w.slug}`)
                    setOpen(false)
                  }}
                  className="cursor-pointer rounded px-3 py-2 text-sm text-(--ctp-text) data-[selected=true]:bg-(--ctp-surface0)"
                >
                  {w.name}
                </Command.Item>
              ))}
          </Command.List>
        </Command>
      </div>
    </div>
  )
}
