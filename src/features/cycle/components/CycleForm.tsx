// 버전(release) 생성/수정 폼 — 버전·릴리즈노트(마크다운) + 'PDCA 사이클 연결' 토글(사이클명·사이클 폴더).
// pdca-skill v1: 연월 드롭다운 대신 사이클 폴더 경로(dir)를 그대로 받는다. 서버는 경로를 계산하지 않는다.
import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { createCycleSchema, type CreateCycleInput } from '@shared/schema'

/** 버전과 사이클명으로 표준 폴더 경로를 제안한다: docs/PDCA/v{major}/{version}-{name} */
function suggestDir(version: string, name: string): string {
  const m = /^v(\d+)\./.exec(version)
  const major = m ? `v${m[1]}` : 'v0'
  return `docs/PDCA/${major}/${version}-${name}`
}

export function CycleForm({
  defaultValues,
  onSubmit,
  onCancel,
  submitLabel,
}: {
  defaultValues?: Partial<CreateCycleInput>
  onSubmit: (input: CreateCycleInput) => Promise<void>
  onCancel: () => void
  submitLabel: string
}) {
  const [linkCycle, setLinkCycle] = useState(!!defaultValues?.name)
  const {
    register,
    handleSubmit,
    setValue,
    getValues,
    formState: { errors, isSubmitting },
  } = useForm<CreateCycleInput>({
    resolver: zodResolver(createCycleSchema),
    defaultValues: { version: 'v0.1.0', ...defaultValues },
  })

  // 토글 off는 undefined(키 소실)가 아니라 null을 세팅해야 PATCH 본문에 해제 의도가 실린다.
  // undefined였다면 JSON 직렬화에서 키가 사라져 "변경 없음"으로 해석된다.
  function toggleLink(on: boolean) {
    setLinkCycle(on)
    if (on) {
      if (getValues('name') === null || getValues('name') === undefined) setValue('name', '')
      if (getValues('dir') === null || getValues('dir') === undefined) setValue('dir', '')
    } else {
      setValue('name', null)
      setValue('dir', null)
    }
  }

  function fillSuggestedDir() {
    const version = getValues('version') ?? ''
    const name = getValues('name') ?? ''
    if (!name) return
    setValue('dir', suggestDir(version, name), { shouldValidate: true })
  }

  // 해제 confirm. "(문서 자체는 삭제되지 않음)" 괄호 필수 — "해제 = 문서 삭제" 오해가 해제를 못 쓰게 만든다.
  function submitGuard(input: CreateCycleInput) {
    const unlinking = !!defaultValues?.name && input.name === null
    if (unlinking) {
      const ok = confirm(
        `PDCA 사이클 연결을 해제할까요?\n\n` +
          `이 버전의 문서 버튼이 사라집니다. (문서 자체는 삭제되지 않음)`,
      )
      if (!ok) return Promise.resolve()
    }
    return onSubmit(input)
  }

  const inputCls =
    'mt-1 w-full rounded border border-(--ctp-surface1) bg-(--ctp-base) px-3 py-1.5 text-(--ctp-text)'

  return (
    <form
      onSubmit={handleSubmit(submitGuard)}
      className="flex flex-col gap-3 rounded-lg border border-(--ctp-surface0) bg-(--ctp-mantle) p-4"
    >
      <div>
        <label className="block text-sm text-(--ctp-subtext1)">버전 (예: v0.1.0)</label>
        <input {...register('version')} className={`${inputCls} font-mono`} />
        {errors.version && <p className="mt-1 text-xs text-(--ctp-red)">{errors.version.message}</p>}
      </div>

      <div>
        <label className="block text-sm text-(--ctp-subtext1)">릴리즈 노트 (마크다운)</label>
        <textarea
          {...register('releaseNote')}
          rows={6}
          placeholder="## v0.1.0&#10;- 새 기능 ..."
          className={`${inputCls} font-mono text-sm`}
        />
        {errors.releaseNote && (
          <p className="mt-1 text-xs text-(--ctp-red)">{errors.releaseNote.message}</p>
        )}
      </div>

      <label className="flex items-center gap-2 text-sm text-(--ctp-subtext1)">
        <input
          type="checkbox"
          checked={linkCycle}
          onChange={(e) => toggleLink(e.target.checked)}
        />
        PDCA 사이클 연결
      </label>

      {linkCycle && (
        <div className="flex flex-col gap-3">
          <div>
            <label className="block text-sm text-(--ctp-subtext1)">사이클명 (예: enhance-lyric-sync)</label>
            <input {...register('name')} className={`${inputCls} font-mono`} />
            {errors.name && <p className="mt-1 text-xs text-(--ctp-red)">{errors.name.message}</p>}
          </div>
          <div>
            <label className="flex items-center justify-between text-sm text-(--ctp-subtext1)">
              <span>사이클 폴더 (예: docs/PDCA/v1/v1.2.0-enhance-lyric-sync)</span>
              <button
                type="button"
                onClick={fillSuggestedDir}
                className="text-xs text-(--ctp-subtext1) underline"
              >
                표준 경로 채우기
              </button>
            </label>
            <input {...register('dir')} className={`${inputCls} font-mono text-sm`} />
            {errors.dir && <p className="mt-1 text-xs text-(--ctp-red)">{errors.dir.message}</p>}
          </div>
        </div>
      )}

      <div className="flex gap-2">
        <button
          type="submit"
          disabled={isSubmitting}
          className="rounded bg-(--ctp-mauve) px-3 py-1.5 text-(--ctp-base) disabled:opacity-50"
        >
          {isSubmitting ? '저장 중...' : submitLabel}
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="rounded bg-(--ctp-surface0) px-3 py-1.5 text-(--ctp-text)"
        >
          취소
        </button>
      </div>
    </form>
  )
}
