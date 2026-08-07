// Design Ref: §5.4 Workspace/Project CRUD — 폼(name·slug·serviceUrl·githubUrl·description)
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { createProjectSchema, type CreateProjectInput } from '@shared/schema'

export function ProjectForm({
  defaultValues,
  onSubmit,
  onCancel,
  submitLabel,
}: {
  defaultValues?: Partial<CreateProjectInput>
  onSubmit: (input: CreateProjectInput) => Promise<void>
  onCancel: () => void
  submitLabel: string
}) {
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<CreateProjectInput>({
    resolver: zodResolver(createProjectSchema),
    defaultValues,
  })

  const field = (label: string, name: keyof CreateProjectInput, placeholder?: string) => (
    <div>
      <label className="block text-sm text-(--ctp-subtext1)">{label}</label>
      <input
        {...register(name)}
        placeholder={placeholder}
        className="mt-1 w-full rounded border border-(--ctp-surface1) bg-(--ctp-base) px-3 py-1.5 text-(--ctp-text)"
      />
      {errors[name] && <p className="mt-1 text-xs text-(--ctp-red)">{errors[name]?.message}</p>}
    </div>
  )

  return (
    <form
      onSubmit={handleSubmit(onSubmit)}
      className="flex flex-col gap-3 rounded-lg border border-(--ctp-surface0) bg-(--ctp-mantle) p-4"
    >
      {field('이름', 'name')}
      {field('슬러그 (URL용)', 'slug')}
      {field('서비스 URL', 'serviceUrl', 'https://...')}
      {field('GitHub URL', 'githubUrl', 'https://github.com/owner/repo')}
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
