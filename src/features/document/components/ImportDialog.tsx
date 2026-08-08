// Design Ref: §5.4 ImportDialog/편집 화면 — FR-11(RAW 붙여넣기) + FR-12(링크 생사 프리뷰) + 기존 문서 수정.
// Design Ref: §7.5 캐싱·갱신 정책 — 문서 저장은 디바운스 자동저장(2s). 편집 모드에서만 적용(생성은 명시적 클릭).
// 생성(import) 모드는 PDCA 사이클 중심 UX — 사용자는 사이클명/단계/연월만 고르고 경로는 자동 조립한다.
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

// 연월 드롭다운 목록: 현재 기준 미래 2개월 ~ 과거 36개월 (최신순). 기본값은 현재 연월.
function ymOf(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}
function currentYm() {
  return ymOf(new Date())
}
const MONTH_OPTIONS: string[] = (() => {
  const now = new Date()
  const out: string[] = []
  for (let i = 2; i >= -36; i--) {
    out.push(ymOf(new Date(now.getFullYear(), now.getMonth() + i, 1)))
  }
  return out
})()

export function ImportDialog({
  projectId,
  wsSlug,
  projSlug,
  document,
  prefill,
  onClose,
}: {
  projectId: string
  wsSlug: string
  projSlug: string
  document?: ExistingDocument
  // PDCA 사이클 카드에서 stage 버튼을 눌러 들어온 경우 — 사이클명/단계/연월이 고정된 생성모드.
  prefill?: { name: string; stage: 'plan' | 'design' | 'analysis' | 'report'; yearMonth: string }
  onClose: () => void
}) {
  const isEdit = !!document
  const isPrefilled = !isEdit && !!prefill
  // 편집 모드 전용 상태(기존 동작 보존): 제목·경로 직접 편집.
  const [title, setTitle] = useState(document?.title ?? '')
  const [path, setPath] = useState(document?.path ?? '')
  const [pathError, setPathError] = useState<string | null>(null)
  // 생성 모드 전용 상태: 사이클명/문서명·연월·general 경로 뒷부분.
  const [name, setName] = useState(prefill?.name ?? '')
  const [ym, setYm] = useState(prefill?.yearMonth ?? currentYm())
  const [generalTail, setGeneralTail] = useState('')

  const [kind, setKind] = useState<'pdca' | 'general'>(document?.kind ?? 'pdca')
  const [stage, setStage] = useState<'plan' | 'design' | 'analysis' | 'report'>(
    document?.pdcaStage ?? prefill?.stage ?? 'plan',
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

  // 생성 모드에서 사이클명/단계/연월/general꼬리로부터 경로·제목을 파생한다.
  const tail = generalTail.replace(/^\/+/, '')
  const derivedPath =
    kind === 'pdca' ? `docs/PDCA/${ym}/${name}/${name}.${stage}.md` : `docs/${tail}`
  const effectivePath = isEdit ? path : derivedPath
  const effectiveTitle = isEdit ? title : name.trim()

  let genPathError: string | null = null
  if (!isEdit) {
    if (!name.trim()) {
      genPathError = kind === 'pdca' ? '사이클명을 입력하세요' : '문서명을 입력하세요'
    } else if (kind === 'pdca' && /[/\s]/.test(name)) {
      genPathError = '사이클명에 공백이나 /는 쓸 수 없습니다'
    } else if (kind === 'general' && !tail) {
      genPathError = '경로를 입력하세요'
    } else {
      try {
        normalizePath(derivedPath)
      } catch (e) {
        genPathError = e instanceof Error ? e.message : 'invalid path'
      }
    }
  }
  const effectivePathError = isEdit ? pathError : genPathError

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
    if (effectivePathError || !effectivePath) return
    setChecking(true)
    const normalized = normalizePath(effectivePath)
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
      title: effectiveTitle,
      path: normalizePath(effectivePath),
      kind,
      pdcaStage: kind === 'pdca' ? stage : undefined,
      content,
    }
    const result = isEdit
      ? await updateMut.mutateAsync({ id: document.id, input })
      : await createMut.mutateAsync(input)
    if (!result.ok) {
      const err = result.error as { code?: string; details?: { target?: string } }
      setSubmitError(
        err.code === 'CONFLICT' && err.details?.target === 'path'
          ? `이미 존재하는 경로입니다: ${input.path}`
          : '저장 실패',
      )
      return
    }
    onClose()
  }

  const inputCls =
    'mt-1 w-full rounded border border-(--ctp-surface1) bg-(--ctp-base) px-3 py-1.5 text-(--ctp-text)'
  const selectCls =
    'mt-1 rounded border border-(--ctp-surface1) bg-(--ctp-base) px-2 py-1.5 text-(--ctp-text)'

  return (
    <div className="flex flex-col gap-3 rounded-lg border border-(--ctp-surface0) bg-(--ctp-mantle) p-4">
      <h2 className="text-sm font-medium text-(--ctp-text)">{isEdit ? '문서 수정' : '문서 임포트'}</h2>

      {isEdit ? (
        <>
          <div>
            <label className="block text-sm text-(--ctp-subtext1)">제목</label>
            <input value={title} onChange={(e) => setTitle(e.target.value)} className={inputCls} />
          </div>

          <div>
            <label className="block text-sm text-(--ctp-subtext1)">
              경로 (레포 루트 기준, 예: docs/PDCA/2026-07/x/x.plan.md)
            </label>
            <input
              value={path}
              onChange={(e) => handlePathChange(e.target.value)}
              className={`${inputCls} font-mono text-sm`}
            />
            {pathError && <p className="mt-1 text-xs text-(--ctp-red)">{pathError}</p>}
          </div>

          <div className="flex gap-3">
            <div>
              <label className="block text-sm text-(--ctp-subtext1)">분류</label>
              <select
                value={kind}
                onChange={(e) => setKind(e.target.value as 'pdca' | 'general')}
                className={selectCls}
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
                  className={selectCls}
                >
                  <option value="plan">plan</option>
                  <option value="design">design</option>
                  <option value="analysis">analysis</option>
                  <option value="report">report</option>
                </select>
              </div>
            )}
          </div>
        </>
      ) : isPrefilled ? (
        // PDCA 사이클 카드에서 진입 — 대상 경로 고정, 사용자는 마크다운만 작성.
        <div className="rounded border border-(--ctp-surface0) bg-(--ctp-base) p-3">
          <p className="text-sm text-(--ctp-subtext1)">
            PDCA 사이클 문서 생성 —{' '}
            <span className="rounded bg-(--ctp-surface0) px-1.5 py-0.5 text-xs text-(--ctp-mauve)">
              {stage}
            </span>
          </p>
          <p className="mt-1 font-mono text-xs text-(--ctp-overlay0)">{effectivePath}</p>
          {effectivePathError && (
            <p className="mt-1 text-xs text-(--ctp-red)">{effectivePathError}</p>
          )}
        </div>
      ) : (
        <>
          {/* 1. 분류 먼저 */}
          <div>
            <label className="block text-sm text-(--ctp-subtext1)">분류</label>
            <select
              value={kind}
              onChange={(e) => {
                setKind(e.target.value as 'pdca' | 'general')
                setPreview(null)
              }}
              className={selectCls}
            >
              <option value="pdca">pdca</option>
              <option value="general">general</option>
            </select>
          </div>

          {/* 2. 사이클명 / 문서명 */}
          <div>
            <label className="block text-sm text-(--ctp-subtext1)">
              {kind === 'pdca' ? '사이클명' : '문서명'}
            </label>
            <input
              value={name}
              onChange={(e) => {
                setName(e.target.value)
                setPreview(null)
              }}
              placeholder={kind === 'pdca' ? '예: backlog-with-mcp' : '예: 회의록'}
              className={inputCls}
            />
          </div>

          {/* pdca 단계 */}
          {kind === 'pdca' && (
            <div>
              <label className="block text-sm text-(--ctp-subtext1)">단계</label>
              <select
                value={stage}
                onChange={(e) => {
                  setStage(e.target.value as typeof stage)
                  setPreview(null)
                }}
                className={selectCls}
              >
                <option value="plan">plan</option>
                <option value="design">design</option>
                <option value="analysis">analysis</option>
                <option value="report">report</option>
              </select>
            </div>
          )}

          {/* 3. 문서 경로 (자동 조립) */}
          <div>
            <label className="block text-sm text-(--ctp-subtext1)">문서 경로 (자동)</label>
            {kind === 'pdca' ? (
              <div className="mt-1 flex flex-wrap items-center gap-1 font-mono text-sm">
                <span className="text-(--ctp-overlay0)">docs/PDCA/</span>
                <select
                  value={ym}
                  onChange={(e) => {
                    setYm(e.target.value)
                    setPreview(null)
                  }}
                  className="rounded border border-(--ctp-surface1) bg-(--ctp-base) px-2 py-1 text-(--ctp-text)"
                >
                  {MONTH_OPTIONS.map((m) => (
                    <option key={m} value={m}>
                      {m}
                    </option>
                  ))}
                </select>
                <span className="text-(--ctp-overlay0)">
                  /{name || '사이클명'}/{name || '사이클명'}.{stage}.md
                </span>
              </div>
            ) : (
              <div className="mt-1 flex items-center gap-1 font-mono text-sm">
                <span className="shrink-0 text-(--ctp-overlay0)">docs/</span>
                <input
                  value={generalTail}
                  onChange={(e) => {
                    setGeneralTail(e.target.value)
                    setPreview(null)
                  }}
                  placeholder="폴더/문서.md"
                  className="flex-1 rounded border border-(--ctp-surface1) bg-(--ctp-base) px-3 py-1.5 text-(--ctp-text)"
                />
              </div>
            )}
            {effectivePathError && (
              <p className="mt-1 text-xs text-(--ctp-red)">{effectivePathError}</p>
            )}
          </div>
        </>
      )}

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
            currentPath={effectivePath || 'preview.md'}
          />
        </div>
      </div>

      <div>
        <button
          onClick={checkLinks}
          disabled={checking || !!effectivePathError || !effectivePath}
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
          disabled={pending || !!effectivePathError || !effectiveTitle || !effectivePath || !content}
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
