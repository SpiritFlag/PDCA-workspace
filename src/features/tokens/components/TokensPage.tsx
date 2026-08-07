// Design Ref: §5.4 [module-3] PAT 관리 — 목록(해시·평문 미표시)/발급(평문 1회+복사+경고)/폐기(확인)
import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useIssueToken, useRevokeToken, useTokens } from '../hooks/useTokens'

export function TokensPage() {
  const { data: tokens, isLoading } = useTokens()
  const issueMut = useIssueToken()
  const revokeMut = useRevokeToken()
  const [name, setName] = useState('')
  const [issued, setIssued] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)

  async function handleIssue(e: React.FormEvent) {
    e.preventDefault()
    const result = await issueMut.mutateAsync(name)
    if (result.ok && result.data) {
      setIssued(result.data.token)
      setName('')
      setCopied(false)
    }
  }

  async function handleRevoke(id: string, tokenName: string) {
    if (!confirm(`"${tokenName}" 토큰을 폐기할까요? 이 토큰을 쓰는 곳은 즉시 인증이 끊깁니다.`)) return
    await revokeMut.mutateAsync(id)
  }

  async function handleCopy() {
    if (!issued) return
    await navigator.clipboard.writeText(issued)
    setCopied(true)
  }

  return (
    <div className="mx-auto max-w-2xl p-8">
      <Link to="/" className="text-sm text-(--ctp-overlay0) underline">
        ← 홈
      </Link>
      <h1 className="mt-2 mb-4 text-lg font-medium text-(--ctp-text)">API 토큰</h1>
      <p className="mb-4 text-sm text-(--ctp-subtext1)">
        Claude Code 같은 MCP 클라이언트가 이 워크스페이스에 접근할 때 쓰는 개인 액세스 토큰입니다.
      </p>

      {issued && (
        <div className="mb-4 rounded-lg border border-(--ctp-mauve) bg-(--ctp-mantle) p-4">
          <p className="mb-2 text-sm font-medium text-(--ctp-mauve)">
            토큰이 발급됐습니다 — 지금 복사하세요. 다시 볼 수 없습니다.
          </p>
          <div className="flex items-center gap-2">
            <code className="min-w-0 flex-1 overflow-x-auto rounded bg-(--ctp-base) px-2 py-1.5 text-xs text-(--ctp-text)">
              {issued}
            </code>
            <button
              onClick={handleCopy}
              className="shrink-0 rounded bg-(--ctp-mauve) px-3 py-1.5 text-sm text-(--ctp-base)"
            >
              {copied ? '복사됨' : '복사'}
            </button>
          </div>
          <button
            onClick={() => setIssued(null)}
            className="mt-2 text-xs text-(--ctp-overlay0) underline"
          >
            닫기
          </button>
        </div>
      )}

      <form onSubmit={handleIssue} className="mb-6 flex items-center gap-2">
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="토큰 이름 (예: claude-code-wsl)"
          required
          maxLength={100}
          className="min-w-0 flex-1 rounded border border-(--ctp-surface1) bg-(--ctp-base) px-3 py-1.5 text-(--ctp-text)"
        />
        <button
          type="submit"
          disabled={issueMut.isPending}
          className="shrink-0 rounded bg-(--ctp-mauve) px-3 py-1.5 text-sm text-(--ctp-base) disabled:opacity-50"
        >
          발급
        </button>
      </form>

      {isLoading ? (
        <p className="text-sm text-(--ctp-subtext1)">불러오는 중...</p>
      ) : (
        <ul className="flex flex-col gap-1">
          {tokens?.map((t) => (
            <li
              key={t.id}
              className="flex items-center justify-between rounded border border-(--ctp-surface0) bg-(--ctp-mantle) px-3 py-2"
            >
              <div className="min-w-0">
                <span className="text-(--ctp-text)">{t.name}</span>
                <div className="text-xs text-(--ctp-overlay0)">
                  생성 {t.createdAt.slice(0, 10)} · 최종 사용{' '}
                  {t.lastUsedAt ? t.lastUsedAt.slice(0, 10) : '없음'}
                </div>
              </div>
              <button
                onClick={() => handleRevoke(t.id, t.name)}
                className="shrink-0 text-sm text-(--ctp-red) underline"
              >
                폐기
              </button>
            </li>
          ))}
          {tokens?.length === 0 && (
            <p className="text-sm text-(--ctp-overlay0)">발급된 토큰이 없습니다.</p>
          )}
        </ul>
      )}
    </div>
  )
}
