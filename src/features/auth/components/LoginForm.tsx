// Design Ref: §5.3 (module-2 확장) — Design에 없던 최소 로그인 화면.
// Plan SC: C2 실증에 필요한 최소 범위(이메일/비밀번호)만. 소셜 로그인·비밀번호 재설정은 스코프 밖.
import { useState } from 'react'
import { authClient } from '@/lib/auth'
import { clearAccessTokenCache } from '@/lib/auth'

export function LoginForm({ onSuccess }: { onSuccess: () => void }) {
  const [mode, setMode] = useState<'sign-in' | 'sign-up'>('sign-in')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [pending, setPending] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setPending(true)
    clearAccessTokenCache()

    const result =
      mode === 'sign-in'
        ? await authClient.signIn.email({ email, password })
        : await authClient.signUp.email({ email, password, name: email })

    setPending(false)
    if (result.error) {
      setError(result.error.message ?? '로그인에 실패했습니다')
      return
    }
    onSuccess()
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="mx-auto mt-24 flex w-full max-w-sm flex-col gap-3 rounded-lg border border-(--ctp-surface0) bg-(--ctp-mantle) p-6"
    >
      <h1 className="text-lg font-medium text-(--ctp-text)">
        {mode === 'sign-in' ? '로그인' : '회원가입'}
      </h1>

      <input
        type="email"
        required
        placeholder="이메일"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        className="rounded border border-(--ctp-surface1) bg-(--ctp-base) px-3 py-2 text-(--ctp-text)"
      />
      <input
        type="password"
        required
        minLength={8}
        placeholder="비밀번호"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        className="rounded border border-(--ctp-surface1) bg-(--ctp-base) px-3 py-2 text-(--ctp-text)"
      />

      {error && <p className="text-sm text-(--ctp-red)">{error}</p>}

      <button
        type="submit"
        disabled={pending}
        className="rounded bg-(--ctp-mauve) px-3 py-2 text-(--ctp-base) disabled:opacity-50"
      >
        {pending ? '처리 중...' : mode === 'sign-in' ? '로그인' : '가입하기'}
      </button>

      <button
        type="button"
        onClick={() => setMode((m) => (m === 'sign-in' ? 'sign-up' : 'sign-in'))}
        className="text-sm text-(--ctp-subtext1) underline"
      >
        {mode === 'sign-in' ? '계정이 없으신가요? 회원가입' : '이미 계정이 있으신가요? 로그인'}
      </button>
    </form>
  )
}
