// Design Ref: §4.1 확장 — Clerk 프로덕션 커스텀 도메인이 Frontend API를 `/__clerk`로 프록시하는
// 구조라 우리가 직접 리버스 프록시를 구현해야 한다(clerk.com/docs/guides/dashboard/dns-domains/proxy-fapi).
// 필수 헤더 3종(Clerk-Proxy-Url·Clerk-Secret-Key·X-Forwarded-For) 없이 단순 URL 리라이트만 하면
// Clerk가 501을 낸다(실측 2026-08-10, vercel.json의 dest-URL 리라이트로는 헤더 주입이 안 됨).
//
// 보안 주의(GHSA-gjxx-92w9-8v8f) — Clerk 공식 clerkFrontendApiProxy가 실제로 겪은 SSRF다.
// 경로가 `//`로 시작할 때 `new URL(path, base)`로 조립하면 WHATWG URL이 이를 프로토콜 상대
// URL로 해석해 origin 자체가 바뀐다(`new URL('//evil.com/x','https://good.com')` →
// `https://evil.com/x`, base가 통째로 무시됨) — 그 경로로 Clerk-Secret-Key가 공격자 서버로 샌다.
// 여기선 `new URL(untrusted, base)`를 절대 쓰지 않는다: origin은 UPSTREAM 상수 문자열에
// 고정하고, 경로는 이중 슬래시를 정규화한 뒤 순수 문자열 접미사로만 붙인다 — 어떤 입력을 줘도
// origin이 재해석될 수 없는 구조다.
import { Hono } from 'hono'
import { ServiceError } from '../lib/errors.js'

const UPSTREAM = 'https://frontend-api.clerk.dev'

export const clerkProxyRoute = new Hono().all('/*', async (c) => {
  const secretKey = process.env.CLERK_SECRET_KEY
  if (!secretKey) throw new ServiceError('INTERNAL', 'CLERK_SECRET_KEY is not set')

  const rawPath = c.req.path.replace(/^\/__clerk/, '') || '/'
  const path = rawPath.replace(/^\/+/, '/') // 이중 슬래시 정규화(SSRF 방어, GHSA-gjxx-92w9-8v8f)
  const reqUrl = new URL(c.req.url)
  const targetUrl = `${UPSTREAM}${path}${reqUrl.search}` // 문자열 접미사 — origin은 절대 안 바뀐다

  const headers = new Headers(c.req.raw.headers)
  headers.set('Clerk-Proxy-Url', `${reqUrl.origin}/__clerk`)
  headers.set('Clerk-Secret-Key', secretKey)
  headers.set('X-Forwarded-For', c.req.header('x-forwarded-for') ?? '')
  headers.set('X-Forwarded-Host', reqUrl.host)
  headers.set('X-Forwarded-Proto', 'https')
  headers.delete('host')

  const upstream = await fetch(targetUrl, {
    method: c.req.method,
    headers,
    body: ['GET', 'HEAD'].includes(c.req.method) ? undefined : await c.req.raw.blob(),
    // Decision: [Do] 기본값(follow)이면 fetch()가 서버 안에서 리다이렉트를 몰래 다 따라가버려,
    // 브라우저 주소창은 그대로인데 최종 페이지의 상대경로 리소스는 엉뚱한 origin 기준이 된다
    // (실측 2026-08-10 — OAuth 인가 화면 진입 시 "Page not found"). 3xx는 그대로 브라우저에
    // 넘겨서 실제 내비게이션이 일어나게 한다.
    redirect: 'manual',
  })

  // Decision: [Do] fetch()의 Response를 그대로 반환하면 Vercel Node 함수 경계를 넘으며 body
  // 스트림이 비어버렸다(실측 2026-08-10, 헤더는 정상 도착하는데 바디만 0바이트). 버퍼링해
  // 새 Response로 재구성 — content-encoding/length는 버퍼 기준으로 재계산되게 제거.
  const responseHeaders = new Headers(upstream.headers)
  responseHeaders.delete('content-encoding')
  responseHeaders.delete('content-length')
  return new Response(await upstream.arrayBuffer(), { status: upstream.status, headers: responseHeaders })
})
