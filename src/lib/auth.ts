// Decision: [Do] Neon Auth 실제 제공자는 better_auth (Plan RK-03 실증).
// 세션은 쿠키로 유지하고, API 호출용 JWT는 better-auth의 jwt 플러그인이 여는 /token으로 별도 발급받는다.
import { createAuthClient } from 'better-auth/react'

const baseURL = import.meta.env.VITE_NEON_AUTH_BASE_URL as string

export const authClient = createAuthClient({ baseURL })

let cachedToken: { token: string; expiresAt: number } | null = null

/** Plan SC: C2 — API 호출에 실을 Bearer 토큰을 세션 쿠키로부터 발급받는다. 미로그인 시 null. */
export async function getAccessToken(): Promise<string | null> {
  if (cachedToken && cachedToken.expiresAt > Date.now()) return cachedToken.token

  const res = await fetch(`${baseURL}/token`, { credentials: 'include' })
  if (!res.ok) {
    cachedToken = null
    return null
  }
  const body = (await res.json()) as { token: string }
  // JWKS 검증 토큰의 실제 만료는 서버가 판단한다. 클라이언트 캐시는 재요청 폭주 방지용 여유 60초.
  cachedToken = { token: body.token, expiresAt: Date.now() + 60_000 }
  return body.token
}

export function clearAccessTokenCache() {
  cachedToken = null
}
