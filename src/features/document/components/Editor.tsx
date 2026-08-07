// Design Ref: §5.4 편집 화면 — CodeMirror 6 + 보기/분할 미리보기 토글 (D-12)
import { useState } from 'react'
import CodeMirror from '@uiw/react-codemirror'
import { markdown } from '@codemirror/lang-markdown'
import { EditorView } from '@codemirror/view'
import { MarkdownView } from './MarkdownView'

export function Editor({
  value,
  onChange,
  wsSlug,
  projSlug,
  currentPath,
}: {
  value: string
  onChange: (v: string) => void
  wsSlug: string
  projSlug: string
  currentPath: string
}) {
  const [preview, setPreview] = useState(false)

  return (
    <div>
      <div className="mb-1 flex gap-1">
        <button
          type="button"
          onClick={() => setPreview(false)}
          className={`rounded px-2 py-1 text-xs ${!preview ? 'bg-(--ctp-mauve) text-(--ctp-base)' : 'bg-(--ctp-surface0) text-(--ctp-text)'}`}
        >
          편집
        </button>
        <button
          type="button"
          onClick={() => setPreview(true)}
          className={`rounded px-2 py-1 text-xs ${preview ? 'bg-(--ctp-mauve) text-(--ctp-base)' : 'bg-(--ctp-surface0) text-(--ctp-text)'}`}
        >
          미리보기
        </button>
      </div>

      {preview ? (
        <div className="max-h-[28rem] overflow-y-auto rounded border border-(--ctp-surface1) bg-(--ctp-base) px-3 py-2">
          <MarkdownView
            content={value}
            currentPath={currentPath}
            wsSlug={wsSlug}
            projSlug={projSlug}
            existingPaths={new Set()}
          />
        </div>
      ) : (
        <div className="max-h-[28rem] overflow-y-auto rounded border border-(--ctp-surface1)">
          <CodeMirror
            value={value}
            height="28rem"
            extensions={[markdown(), EditorView.lineWrapping]}
            onChange={onChange}
          />
        </div>
      )}
    </div>
  )
}
