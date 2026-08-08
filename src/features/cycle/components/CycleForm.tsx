// 버전(release) 생성/수정 폼 — 버전·릴리즈노트(마크다운) + 'PDCA 사이클 연결' 토글(사이클명·연월).
import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { createCycleSchema, type CreateCycleInput } from '@shared/schema'
import { currentYearMonth, yearMonthOptions } from '../lib/yearMonth'

const MONTHS = yearMonthOptions()

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

  // 토글에 따라 name/yearMonth를 폼 상태와 동기화 — off면 둘 다 비워 refine(pair rule)을 만족시킨다.
  function toggleLink(on: boolean) {
    setLinkCycle(on)
    if (on) {
      if (!getValues('yearMonth')) setValue('yearMonth', currentYearMonth())
    } else {
      setValue('name', undefined)
      setValue('yearMonth', undefined)
    }
  }

  const inputCls =
    'mt-1 w-full rounded border border-(--ctp-surface1) bg-(--ctp-base) px-3 py-1.5 text-(--ctp-text)'

  return (
    <form
      onSubmit={handleSubmit(onSubmit)}
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
        <div className="flex gap-3">
          <div className="flex-1">
            <label className="block text-sm text-(--ctp-subtext1)">사이클명 (예: backlog-with-mcp)</label>
            <input {...register('name')} className={`${inputCls} font-mono`} />
            {errors.name && <p className="mt-1 text-xs text-(--ctp-red)">{errors.name.message}</p>}
          </div>
          <div>
            <label className="block text-sm text-(--ctp-subtext1)">연월</label>
            <select
              {...register('yearMonth')}
              className="mt-1 rounded border border-(--ctp-surface1) bg-(--ctp-base) px-2 py-1.5 font-mono text-(--ctp-text)"
            >
              {MONTHS.map((m) => (
                <option key={m} value={m}>
                  {m}
                </option>
              ))}
            </select>
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
