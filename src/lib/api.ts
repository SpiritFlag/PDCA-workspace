// Design Ref: §11.3 규칙 3 — 컴포넌트는 서버를 직접 fetch하지 않고 이 RPC 클라이언트로만 호출한다.
import { hc } from 'hono/client'
import type { AppType } from '@server/app'
import { getAccessToken } from './auth'

const authedFetch: typeof fetch = async (input, init) => {
  const token = await getAccessToken()
  const headers = new Headers(init?.headers)
  if (token) headers.set('Authorization', `Bearer ${token}`)
  return fetch(input, { ...init, headers })
}

export const api = hc<AppType>('/', { fetch: authedFetch }).api
