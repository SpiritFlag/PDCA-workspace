// ImportDialog/편집 화면 — RAW 붙여넣기 + 링크 생사 프리뷰 + 기존 문서 수정.
// 문서 저장은 디바운스 자동저장(2s). 편집 모드에서만 적용(생성은 명시적 클릭).
// 생성(import) 모드는 PDCA 사이클 중심 UX — 사용자는 사이클명/단계/사이클 폴더만 주고 경로는 자동 조립한다.
// pdca-skill v1: 경로 규칙은 `{dir}/{basename(dir)}.{stage}.md` 하나. 연월 드롭다운은 없어졌다.
import { useEffect, useRef, useState } from 'react'
import { normalizePath } from '@/lib/path'
import { classifyLink, resolveRelative } from '@/lib/path'
import { PDCA_STAGES, cycleStagePath, type PdcaStage } from '@/features/cycle/lib/cyclePath'
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
  pdcaStage?: PdcaStage | null
  content: string
}

const DIR_RE = /^docs\/PDCA\/(?:[^/\s]+\/)*[^/\s]+$/

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
  // PDCA 사이클 카드에서 stage 버튼을 눌러 들어온 경우 — 사이클명/단계/폴더가 고정된 생성모드.
  prefill?: { name: string; stage: PdcaStage; dir: string }
  onClose: () => void
}) {
  const isEdit = !!document
  const isPrefilled = !isEdit && !!prefill
  // 편집 모드 전용 상태(기존 동작 보존): 제목·경로 직접 편집.
  const [title, setTitle] = useState(document?.title ?? '')
  const [path, setPath] = useState(document?.path ?? '')
  const [pathError, setPathError] = useState<string | null>(null)
  // 생성 모드 전용 상태: 사이클명/문서명·사이클 폴더·general 경로 뒷부분.
  const [name, setName] = useState(prefill?.name ?? '')
  const [dir, setDir] = useState(prefill?.dir ?? '')
  const [generalTail, setGeneralTail] = useState('')

  const [kind, setKind] = useState<'pdca' | 'general'>(document?.kind ?? 'pdca')
  const [stage, setStage] = useState<PdcaStage>(document?.pdcaStage ?? prefill?.stage ?? 'plan')
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

  // 생성 모드에서 사이클 폴더/단계/general꼬리로부터 경로·제목을 파생한다.
  const tail = generalTail.replace(/^\/+/, '')
  const trimmedDir = dir.trim().replace(/\/+$/, '')
  const derivedPath = kind === 'pdca' ? (trimmedDir ? cycleStagePath(trimmedDir, stage) : '') : `docs/${tail}`
  const effectivePath = isEdit ? path : derivedPath
  const effectiveTitle = isEdit ? title : name.trim()

  let genPathError: string | null = null
  if (!isEdit) {
    if (!name.trim()) {
      genPathError = kind === 'pdca' ? '사이클명을 입력하세요' : '문서명을 입력하세요'
    } else if (kind === 'pdca' && !trimmedDir) {
      genPathError = '사이클 폴더를 입력하세요 (예: docs/PDCA/v1/v1.2.0-enhance-x)'
    } else if (kind === 'pdca' && !DIR_RE.test(trimmedDir)) {
      genPathError = '사이클 폴더는 docs/PDCA/… 형태여야 하며 공백을 쓸 수 없습니다'
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

  // 편집 중인 문서를 2초 무입력 후 자동저장. 생성(import) 모드는 명시적 저장만.
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

  const stageSelect = (onChange: (s: PdcaStage) => void) => (
    <select value={stage} onChange={(e) => onChange(e.target.value as PdcaStage)} className={selectCls}>
      {PDCA_STAGES.map((s) => (
        <option key={s} value={s}>
          {s}
        </option>
      ))}
    </select>
  )

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
              경로 (레포 루트 기준, 예: docs/PDCA/v1/v1.2.0-x/v1.2.0-x.plan.md)
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
                {stageSelect(setStage)}
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
              {kind === 'pdca' ? '사이클명 (문서 제목이 된다)' : '문서명'}
            </label>
            <input
              value={name}
              onChange={(e) => {
                setName(e.target.value)
                setPreview(null)
              }}
              placeholder={kind === 'pdca' ? '예: enhance-lyric-sync' : '예: 회의록'}
              className={inputCls}
            />
          </div>

          {/* pdca: 단계 + 사이클 폴더 */}
          {kind === 'pdca' && (
            <>
              <div>
                <label className="block text-sm text-(--ctp-subtext1)">단계</label>
                {stageSelect((s) => {
                  setStage(s)
                  setPreview(null)
                })}
              </div>
              <div>
                <label className="block text-sm text-(--ctp-subtext1)">사이클 폴더</label>
                <input
                  value={dir}
                  onChange={(e) => {
                    setDir(e.target.value)
                    setPreview(null)
                  }}
                  placeholder="예: docs/PDCA/v1/v1.2.0-enhance-lyric-sync"
                  className={`${inputCls} font-mono text-sm`}
                />
              </div>
            </>
          )}

          {/* 3. 문서 경로 (자동 조립) */}
          <div>
            <label className="block text-sm text-(--ctp-subtext1)">문서 경로 (자동)</label>
            {kind === 'pdca' ? (
              <p className="mt-1 font-mono text-sm text-(--ctp-overlay0)">
                {derivedPath || '{사이클 폴더}/{폴더명}.' + stage + '.md'}
              </p>
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
