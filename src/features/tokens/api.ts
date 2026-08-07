// Design Ref: §4.1 — PAT 발급·조회·폐기 RPC 클라이언트.
import { api } from '@/lib/api'

export async function fetchTokens() {
  const res = await api.tokens.$get()
  if (!res.ok) throw new Error('failed to fetch tokens')
  return (await res.json()).data
}

export async function issueTokenRequest(name: string) {
  const res = await api.tokens.$post({ json: { name } })
  const body = await res.json()
  if (!res.ok) return { ok: false as const, error: 'error' in body ? body.error : body }
  return { ok: true as const, data: 'data' in body ? body.data : undefined }
}

export async function revokeTokenRequest(id: string) {
  const res = await api.tokens[':id'].$delete({ param: { id } })
  if (!res.ok) throw await res.json()
}
