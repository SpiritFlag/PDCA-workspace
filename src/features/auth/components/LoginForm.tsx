// Design Ref: §5.3 (module-2 확장) — Design에 없던 최소 로그인 화면.
// Plan SC: C2 실증에 필요한 최소 범위(이메일/비밀번호)만. 소셜 로그인·비밀번호 재설정은 스코프 밖.
import { useState } from 'react'
import { authClient } from '@/lib/auth'
import { clearAccessTokenCache } from '@/lib/auth'

export function LoginForm({ onSuccess }: { onSuccess: () => void }) {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [pending, setPending] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setPending(true)
    clearAccessTokenCache()

    // Decision: 개발 단계 동안 회원가입 비활성화 — 로그인 경로만 노출한다.
    // authClient.signUp은 호출하지 않는다(서버 엔드포인트는 열려 있음, 별도 차단 필요).
    const result = await authClient.signIn.email({ email, password })

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
      <h1 className="text-lg font-medium text-(--ctp-text)">로그인</h1>

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
        {pending ? '처리 중...' : '로그인'}
      </button>

      <p className="text-center text-sm text-(--ctp-subtext0)">
        현재 개발 단계로 회원가입은 받지 않습니다
      </p>
    </form>
  )
}
