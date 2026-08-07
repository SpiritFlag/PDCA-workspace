// Design Ref: §11.3 규칙 3 — 컴포넌트는 서버를 직접 fetch하지 않고 이 RPC 클라이언트로만 호출한다.
import { hc } from 'hono/client'
import type { AppType } from '@server/app'
import { authClient, clearAccessTokenCache, getAccessToken } from './auth'

// Design Ref: §6.3 FR-21 — 전역 401 핸들러. 개별 feature의 api.ts가 401을 던지는 곳도 있고
// { ok: false }로 삼키는 곳도 있어(문서·백로그 쓰기 계열) QueryClient onError로는 절반만 잡힌다.
// 모든 요청이 이 fetch 하나를 지나므로 여기서 처리해야 진짜 "전역"이다. 세션을 끊어 AuthGate가
// 로그인 화면으로 되돌리게 한다(App.tsx: session이 없으면 LoginForm).
const authedFetch: typeof fetch = async (input, init) => {
  const token = await getAccessToken()
  const headers = new Headers(init?.headers)
  if (token) headers.set('Authorization', `Bearer ${token}`)
  const res = await fetch(input, { ...init, headers })
  if (res.status === 401) {
    clearAccessTokenCache()
    void authClient.signOut()
  }
  return res
}

export const api = hc<AppType>('/', { fetch: authedFetch }).api
