// Design Ref: §5.4 Workspace/Project CRUD — 생성/수정 폼(name·slug·description)
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { createWorkspaceSchema, type CreateWorkspaceInput } from '@shared/schema'

export function WorkspaceForm({
  defaultValues,
  onSubmit,
  onCancel,
  submitLabel,
}: {
  defaultValues?: Partial<CreateWorkspaceInput>
  onSubmit: (input: CreateWorkspaceInput) => Promise<void>
  onCancel: () => void
  submitLabel: string
}) {
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<CreateWorkspaceInput>({
    resolver: zodResolver(createWorkspaceSchema),
    defaultValues,
  })

  return (
    <form
      onSubmit={handleSubmit(onSubmit)}
      className="flex flex-col gap-3 rounded-lg border border-(--ctp-surface0) bg-(--ctp-mantle) p-4"
    >
      <div>
        <label className="block text-sm text-(--ctp-subtext1)">이름</label>
        <input
          {...register('name')}
          className="mt-1 w-full rounded border border-(--ctp-surface1) bg-(--ctp-base) px-3 py-1.5 text-(--ctp-text)"
        />
        {errors.name && <p className="mt-1 text-xs text-(--ctp-red)">{errors.name.message}</p>}
      </div>

      <div>
        <label className="block text-sm text-(--ctp-subtext1)">슬러그 (URL용, 예: cogmo)</label>
        <input
          {...register('slug')}
          className="mt-1 w-full rounded border border-(--ctp-surface1) bg-(--ctp-base) px-3 py-1.5 text-(--ctp-text)"
        />
        {errors.slug && <p className="mt-1 text-xs text-(--ctp-red)">{errors.slug.message}</p>}
      </div>

      <div>
        <label className="block text-sm text-(--ctp-subtext1)">설명</label>
        <textarea
          {...register('description')}
          rows={2}
          className="mt-1 w-full rounded border border-(--ctp-surface1) bg-(--ctp-base) px-3 py-1.5 text-(--ctp-text)"
        />
      </div>

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
