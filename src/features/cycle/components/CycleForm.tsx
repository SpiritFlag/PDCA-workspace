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

  // Design Ref: §5.1 — 토글 off는 undefined(키 소실)가 아니라 null을 세팅해야 PATCH 본문에
  // 해제 의도가 실린다(FR-42). undefined였다면 JSON 직렬화에서 키가 사라져 "변경 없음"으로
  // 해석된다(C-1의 조용한 실패 경로).
  function toggleLink(on: boolean) {
    setLinkCycle(on)
    if (on) {
      if (!getValues('yearMonth')) setValue('yearMonth', currentYearMonth())
      if (getValues('name') === null) setValue('name', '')
    } else {
      setValue('name', null)
      setValue('yearMonth', null)
    }
  }

  // Design Ref: §5.1 D-33 — 해제 confirm. 문안은 형 확정(Checkpoint 3): 결과 2개 명시 +
  // "(문서 자체는 삭제되지 않음)" 괄호 필수 — "해제 = 문서 삭제" 오해가 해제를 못 쓰게 만든다.
  // 해제는 가역(재연결 가능)이고 이름 점유만 풀린다는 심상을 문안이 전달해야 한다.
  function submitGuard(input: CreateCycleInput) {
    const unlinking = !!defaultValues?.name && input.name === null
    if (unlinking) {
      const ok = confirm(
        `PDCA 사이클 연결을 해제할까요?\n\n` +
          `문서 버튼이 사라지고, 사이클명 '${defaultValues!.name}'를 다른 버전이 쓸 수 있게 됩니다. ` +
          `(문서 자체는 삭제되지 않음)`,
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
