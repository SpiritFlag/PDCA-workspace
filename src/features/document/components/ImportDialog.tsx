// Design Ref: §5.4 ImportDialog/편집 화면 — FR-11(RAW 붙여넣기) + FR-12(링크 생사 프리뷰) + 기존 문서 수정.
// Design Ref: §7.5 캐싱·갱신 정책 — 문서 저장은 디바운스 자동저장(2s). 편집 모드에서만 적용(생성은 명시적 클릭).
import { useEffect, useRef, useState } from 'react'
import { normalizePath } from '@/lib/path'
import { classifyLink, resolveRelative } from '@/lib/path'
import { extractLinkHrefs } from '../lib/extractLinks'
import { resolveLinks } from '../api'
import { useCreateDocument, useUpdateDocument } from '../hooks/useDocuments'
import { Editor } from './Editor'
import type { CreateDocumentInput } from '@shared/schema'

type LinkPreview = { active: string[]; dead: string[] }
type ExistingDocument = {
  id: string
  title: string
  path: string
  kind: 'pdca' | 'general'
  pdcaStage?: 'plan' | 'design' | 'analysis' | 'report' | null
  content: string
}

export function ImportDialog({
  projectId,
  wsSlug,
  projSlug,
  document,
  onClose,
}: {
  projectId: string
  wsSlug: string
  projSlug: string
  document?: ExistingDocument
  onClose: () => void
}) {
  const isEdit = !!document
  const [title, setTitle] = useState(document?.title ?? '')
  const [path, setPath] = useState(document?.path ?? '')
  const [pathError, setPathError] = useState<string | null>(null)
  const [kind, setKind] = useState<'pdca' | 'general'>(document?.kind ?? 'pdca')
  const [stage, setStage] = useState<'plan' | 'design' | 'analysis' | 'report'>(
    document?.pdcaStage ?? 'plan',
  )
  const [content, setContent] = useState(document?.content ?? '')
  const [preview, setPreview] = useState<LinkPreview | null>(null)
  const [checking, setChecking] = useState(false)
  const [submitError, setSubmitError] = useState<string | null>(null)
  const createMut = useCreateDocument(projectId)
  const updateMut = useUpdateDocument(projectId)
  const pending = createMut.isPending || updateMut.isPending

  const [autosaveStatus, setAutosaveStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle')
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const isFirstRender = useRef(true)

  // Plan SC: C4 지원 — 편집 중인 문서를 2초 무입력 후 자동저장. 생성(import) 모드는 명시적 저장만.
  useEffect(() => {
    if (!isEdit) return
    if (isFirstRender.current) {
      isFirstRender.current = false
      return
    }
    if (pathError || !title || !path || !content) return

    if (debounceRef.current) clearTimeout(debounceRef.current)
    setAutosaveStatus('saving')
    debounceRef.current = setTimeout(async () => {
      const input: CreateDocumentInput = {
        title,
        path: normalizePath(path),
        kind,
        pdcaStage: kind === 'pdca' ? stage : undefined,
        content,
      }
      const result = await updateMut.mutateAsync({ id: document!.id, input })
      setAutosaveStatus(result.ok ? 'saved' : 'error')
    }, 2000)

    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [title, path, kind, stage, content])

  function handlePathChange(v: string) {
    setPath(v)
    setPreview(null)
    try {
      normalizePath(v)
      setPathError(null)
    } catch (e) {
      setPathError(e instanceof Error ? e.message : 'invalid path')
    }
  }

  async function checkLinks() {
    if (pathError || !path) return
    setChecking(true)
    const normalized = normalizePath(path)
    const hrefs = extractLinkHrefs(content)
    const candidates = hrefs
      .filter((h) => {
        const cls = classifyLink(h)
        return cls === 'document' || cls === 'directory'
      })
      .map((h) => resolveRelative(normalized, h))
      .filter((p): p is string => p !== null)

    const { existing } = await resolveLinks(projectId, candidates)
    const existingSet = new Set(existing)
    setPreview({
      active: candidates.filter((p) => existingSet.has(p)),
      dead: candidates.filter((p) => !existingSet.has(p)),
    })
    setChecking(false)
  }

  async function handleSubmit() {
    setSubmitError(null)
    const input: CreateDocumentInput = {
      title,
      path: normalizePath(path),
      kind,
      pdcaStage: kind === 'pdca' ? stage : undefined,
      content,
    }
    const result = isEdit
      ? await updateMut.mutateAsync({ id: document.id, input })
      : await createMut.mutateAsync(input)
    if (!result.ok) {
      const err = result.error as { code?: string; path?: string }
      setSubmitError(
        err.code === 'PATH_TAKEN' ? `이미 존재하는 경로입니다: ${err.path}` : '저장 실패',
      )
      return
    }
    onClose()
  }

  return (
    <div className="flex flex-col gap-3 rounded-lg border border-(--ctp-surface0) bg-(--ctp-mantle) p-4">
      <h2 className="text-sm font-medium text-(--ctp-text)">{isEdit ? '문서 수정' : '문서 임포트'}</h2>

      <div>
        <label className="block text-sm text-(--ctp-subtext1)">제목</label>
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          className="mt-1 w-full rounded border border-(--ctp-surface1) bg-(--ctp-base) px-3 py-1.5 text-(--ctp-text)"
        />
      </div>

      <div>
        <label className="block text-sm text-(--ctp-subtext1)">
          경로 (레포 루트 기준, 예: docs/PDCA/2026-07/x/x.plan.md)
        </label>
        <input
          value={path}
          onChange={(e) => handlePathChange(e.target.value)}
          className="mt-1 w-full rounded border border-(--ctp-surface1) bg-(--ctp-base) px-3 py-1.5 font-mono text-sm text-(--ctp-text)"
        />
        {pathError && <p className="mt-1 text-xs text-(--ctp-red)">{pathError}</p>}
      </div>

      <div className="flex gap-3">
        <div>
          <label className="block text-sm text-(--ctp-subtext1)">분류</label>
          <select
            value={kind}
            onChange={(e) => setKind(e.target.value as 'pdca' | 'general')}
            className="mt-1 rounded border border-(--ctp-surface1) bg-(--ctp-base) px-2 py-1.5 text-(--ctp-text)"
          >
            <option value="pdca">pdca</option>
            <option value="general">general</option>
          </select>
        </div>
        {kind === 'pdca' && (
          <div>
            <label className="block text-sm text-(--ctp-subtext1)">단계</label>
            <select
              value={stage}
              onChange={(e) => setStage(e.target.value as typeof stage)}
              className="mt-1 rounded border border-(--ctp-surface1) bg-(--ctp-base) px-2 py-1.5 text-(--ctp-text)"
            >
              <option value="plan">plan</option>
              <option value="design">design</option>
              <option value="analysis">analysis</option>
              <option value="report">report</option>
            </select>
          </div>
        )}
      </div>

      <div>
        <label className="block text-sm text-(--ctp-subtext1)">마크다운</label>
        <div className="mt-1">
          <Editor
            value={content}
            onChange={(v) => {
              setContent(v)
              setPreview(null)
            }}
            wsSlug={wsSlug}
            projSlug={projSlug}
            currentPath={path || 'preview.md'}
          />
        </div>
      </div>

      <div>
        <button
          onClick={checkLinks}
          disabled={checking || !!pathError || !path}
          className="rounded bg-(--ctp-surface0) px-3 py-1.5 text-sm text-(--ctp-text) disabled:opacity-50"
        >
          {checking ? '확인 중...' : '링크 확인'}
        </button>
        {preview && (
          <div className="mt-2 text-sm">
            <p className="text-(--ctp-text)">
              링크 {preview.active.length + preview.dead.length}개 중{' '}
              <span className="text-(--ctp-green)">활성 {preview.active.length}</span> ·{' '}
              <span className="text-(--ctp-red)">비활성 {preview.dead.length}</span>
            </p>
            {preview.dead.length > 0 && (
              <details className="mt-1">
                <summary className="cursor-pointer text-(--ctp-overlay0)">비활성 목록</summary>
                <ul className="mt-1 flex flex-col gap-0.5">
                  {preview.dead.map((p) => (
                    <li key={p} className="font-mono text-xs text-(--ctp-overlay0)">
                      {p}
                    </li>
                  ))}
                </ul>
              </details>
            )}
          </div>
        )}
      </div>

      {submitError && <p className="text-sm text-(--ctp-red)">{submitError}</p>}

      <div className="flex items-center gap-2">
        <button
          onClick={handleSubmit}
          disabled={pending || !!pathError || !title || !path || !content}
          className="rounded bg-(--ctp-mauve) px-3 py-1.5 text-(--ctp-base) disabled:opacity-50"
        >
          {pending ? '저장 중...' : isEdit ? '지금 저장' : '생성'}
        </button>
        <button onClick={onClose} className="rounded bg-(--ctp-surface0) px-3 py-1.5 text-(--ctp-text)">
          {isEdit ? '닫기' : '취소'}
        </button>
        {isEdit && (
          <span className="text-xs text-(--ctp-overlay0)">
            {autosaveStatus === 'saving' && '저장 중...'}
            {autosaveStatus === 'saved' && '자동저장됨'}
            {autosaveStatus === 'error' && (
              <span className="text-(--ctp-red)">자동저장 실패 — 지금 저장을 눌러 재시도</span>
            )}
          </span>
        )}
      </div>
    </div>
  )
}
