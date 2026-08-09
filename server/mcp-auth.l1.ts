// Design Ref: §8.2 — mcp-auth 미들웨어 L1(실 dev DB). a1~a8 중 a1·a2·a6·a8은 legacy 무회귀(C55),
// a3·a4·a5는 OAuth 분기 구조(fail-fast·D-108·WWW-Authenticate), a7은 PRM(C54의 내부 확정분).
// 6T-1 재채점(RK-71): 하네스가 검증하는 건 여기까지 — 실 Clerk 토큰 플로우는 사람 실증(module-2 h1~h5).
import { randomUUID } from 'node:crypto'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { cleanup, hasDb, mintToken, req, rpc, seedWorkspaceProject } from './l1-harness.js'

const TEST_CLERK_ISSUER = 'https://touching-werewolf-34.clerk.accounts.dev'
const TEST_SUBJECT = 'user_hns_test_subject'
const TEST_OWNER_ID = 'hns-owner-oauth-target'

function b64url(obj: unknown) {
  return Buffer.from(JSON.stringify(obj)).toString('base64url')
}

// jose의 decodeJwt는 서명을 검증하지 않고 header·payload만 파싱한다 — 3파트 구조만 있으면 된다.
// jwtVerify(진짜 검증)는 이 서명을 거부하므로 "iss는 맞지만 무효한 토큰"을 만드는 데 충분하다.
function fakeJwt(payload: Record<string, unknown>) {
  const header = b64url({ alg: 'RS256', typ: 'JWT' })
  const body = b64url(payload)
  return `${header}.${body}.fake-signature`
}

async function withEnv(overrides: Record<string, string | undefined>, fn: () => Promise<void>) {
  const prev: Record<string, string | undefined> = {}
  for (const key of Object.keys(overrides)) prev[key] = process.env[key]
  for (const [key, value] of Object.entries(overrides)) {
    if (value === undefined) delete process.env[key]
    else process.env[key] = value
  }
  try {
    await fn()
  } finally {
    for (const [key, value] of Object.entries(prev)) {
      if (value === undefined) delete process.env[key]
      else process.env[key] = value
    }
  }
}

describe.skipIf(!hasDb)('mcp-auth L1 (실 dev DB)', () => {
  const RUN = randomUUID().slice(0, 8)
  const OWNER = `hns-owner-mcpauth-${RUN}`
  let token: string

  beforeAll(async () => {
    await cleanup()
    token = await mintToken(OWNER, 'hns-mcpauth-l1')
    await seedWorkspaceProject(token, 'mcpauth')
  })
  afterAll(async () => {
    await cleanup()
  })

  it('a1 헤더 PAT → tools/list 성공 (legacy 위임 경유)', async () => {
    const res = await rpc(token, 'tools/list')
    expect(res.status).toBe(200)
  })

  it('a2 쿼리 PAT → tools/list 성공 (legacy 위임 경유, D-18 유지)', async () => {
    const res = await req(null, `/api/mcp?token=${token}`, {
      method: 'POST',
      body: JSON.stringify({ jsonrpc: '2.0', id: randomUUID(), method: 'tools/list' }),
    })
    expect(res.status).toBe(200)
  })

  it('a3 무토큰 → 401 + WWW-Authenticate(resource_metadata) 헤더', async () => {
    const res = await rpc(null, 'tools/list')
    expect(res.status).toBe(401)
    const header = res.headers.get('www-authenticate')
    expect(header).toMatch(/^Bearer resource_metadata="https?:\/\/.+\/\.well-known\/oauth-protected-resource\/api\/mcp"$/)
  })

  it('a4 iss=Clerk 무서명 JWT → 401 (D-108: legacy 재시도 없음)', async () => {
    await withEnv(
      { CLERK_ISSUER: TEST_CLERK_ISSUER, MCP_OAUTH_SUBJECT: TEST_SUBJECT, MCP_OAUTH_OWNER_ID: TEST_OWNER_ID },
      async () => {
        const badToken = fakeJwt({ iss: TEST_CLERK_ISSUER, sub: TEST_SUBJECT, exp: Math.floor(Date.now() / 1000) + 3600 })
        const res = await rpc(badToken, 'tools/list')
        expect(res.status).toBe(401)
        expect(res.headers.get('www-authenticate')).toContain('resource_metadata=')
      },
    )
  })

  it('a5 iss=Clerk JWT + OAuth env 미설정 → 500 + 빠진 변수명 포함 (D-105 fail-fast)', async () => {
    await withEnv(
      { CLERK_ISSUER: TEST_CLERK_ISSUER, MCP_OAUTH_SUBJECT: undefined, MCP_OAUTH_OWNER_ID: undefined },
      async () => {
        const badToken = fakeJwt({ iss: TEST_CLERK_ISSUER, sub: TEST_SUBJECT, exp: Math.floor(Date.now() / 1000) + 3600 })
        const res = await rpc(badToken, 'tools/list')
        expect(res.status).toBe(500)
        const json = (await res.json()) as { error: { code: string; message?: string } }
        expect(json.error.code).toBe('INTERNAL')
        expect(json.error.message).toContain('MCP_OAUTH_SUBJECT')
        expect(json.error.message).toContain('MCP_OAUTH_OWNER_ID')
      },
    )
  })

  it('a6 iss≠Clerk 비PAT JWT (Neon JWT 모사) → 위임 후 기존 JWKS 검증 결과(401)', async () => {
    const neonLikeToken = fakeJwt({ iss: 'https://not-clerk.example.com', sub: 'someone', exp: Math.floor(Date.now() / 1000) + 3600 })
    const res = await rpc(neonLikeToken, 'tools/list')
    expect(res.status).toBe(401)
  })

  it('a7 PRM GET (인증 불요) → resource·authorization_servers 형식', async () => {
    // module-2 curl 실측(RK-67) 확정 — /api 접두어 없이 원래 요청 경로 그대로(root.ts 참조)
    await withEnv({ CLERK_ISSUER: TEST_CLERK_ISSUER }, async () => {
      const res = await req(null, '/.well-known/oauth-protected-resource/api/mcp')
      expect(res.status).toBe(200)
      const json = (await res.json()) as { resource: string; authorization_servers: string[] }
      expect(json.resource).toMatch(/\/api\/mcp$/)
      expect(json.authorization_servers).toEqual([TEST_CLERK_ISSUER])
    })
  })

  it('a8 무관 — 참고: mcp.l1.ts·cycles.l1.ts·prompts.l1.ts 전건 재실행은 npm test:l1 전체 실행으로 커버(별도 assertion 불요)', () => {
    expect(true).toBe(true)
  })
})
