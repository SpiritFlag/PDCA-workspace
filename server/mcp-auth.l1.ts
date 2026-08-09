// Design Ref: §8.2 — mcp-auth 미들웨어 L1(실 dev DB). a1·a2는 legacy 무회귀(C55), a3~a5b·a10은
// OAuth 분기 구조(fail-fast·D-108·WWW-Authenticate·D-101), a6은 위임 경로, a7·a7b는 PRM(C54
// 내부 확정분), a9는 OAuth 성공 경로(실 dev DB에 실제로 ownerId가 주입되는지까지).
//
// Check Gap 대응(a9) — RK-71은 "실 Clerk 토큰을 못 만든다"며 성공 경로 실증을 사람(h1~h5)에게
// 넘겼는데, 검증에 실제로 필요한 건 "Clerk가 발급한 토큰"이 아니라 "유효하게 서명된 토큰"이다.
// 로컬에서 키쌍을 만들고 진짜 HTTP 서버로 JWKS를 서빙하면(모킹 아님, 실제 네트워크 왕복) 이
// 프로젝트의 "실 DB·실 서비스만" 원칙을 지키면서 성공 경로까지 하네스로 덮을 수 있다.
import { randomUUID } from 'node:crypto'
import { createServer, type Server } from 'node:http'
import { exportJWK, generateKeyPair, SignJWT } from 'jose'
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

// 로컬 JWKS 서버 — a9·a10 전용. RSA 키쌍을 실제로 서명·검증하는 진짜 왕복이다(모킹 아님).
async function startLocalJwksServer() {
  const { publicKey, privateKey } = await generateKeyPair('RS256')
  const jwk = await exportJWK(publicKey)
  jwk.alg = 'RS256'
  jwk.use = 'sig'
  jwk.kid = 'hns-l1-test-key'

  const server: Server = createServer((req, res) => {
    if (req.url === '/.well-known/jwks.json') {
      res.writeHead(200, { 'content-type': 'application/json' })
      res.end(JSON.stringify({ keys: [jwk] }))
      return
    }
    res.writeHead(404)
    res.end()
  })
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve))
  const address = server.address()
  if (!address || typeof address === 'string') throw new Error('failed to bind local JWKS server')
  const issuer = `http://127.0.0.1:${address.port}`

  // 기본 1h 만료로 서명하는 편의 헬퍼. exp를 직접 조작해야 할 때(a9 만료 케이스)는
  // issuer·privateKey를 직접 써서 SignJWT를 조립한다.
  const sign = (payload: Record<string, unknown>) =>
    new SignJWT(payload)
      .setProtectedHeader({ alg: 'RS256', kid: 'hns-l1-test-key' })
      .setIssuer(issuer)
      .setIssuedAt()
      .setExpirationTime('1h')
      .sign(privateKey)

  return { issuer, privateKey, sign, close: () => new Promise<void>((resolve) => server.close(() => resolve())) }
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

  it('a5b CLERK_ISSUER만 미설정 → fail-fast 아닌 401 (I-1 알려진 한계, 현재 동작 고정)', async () => {
    await withEnv(
      { CLERK_ISSUER: undefined, MCP_OAUTH_SUBJECT: TEST_SUBJECT, MCP_OAUTH_OWNER_ID: TEST_OWNER_ID },
      async () => {
        const badToken = fakeJwt({ iss: TEST_CLERK_ISSUER, sub: TEST_SUBJECT, exp: Math.floor(Date.now() / 1000) + 3600 })
        const res = await rpc(badToken, 'tools/list')
        // CLERK_ISSUER가 없으면 isClerkIssued()가 항상 false → legacy로 위임돼 500이 아니라 401.
        expect(res.status).toBe(401)
        const json = (await res.json()) as { error: { code: string } }
        expect(json.error.code).toBe('UNAUTHORIZED')
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

  it('a7b PRM GET, CLERK_ISSUER 미설정 → authorization_servers 빈 배열 (M-2)', async () => {
    await withEnv({ CLERK_ISSUER: undefined }, async () => {
      const res = await req(null, '/.well-known/oauth-protected-resource/api/mcp')
      expect(res.status).toBe(200)
      const json = (await res.json()) as { authorization_servers: string[] }
      expect(json.authorization_servers).toEqual([])
    })
  })

  it('a9 OAuth 성공 경로 — 로컬 서명 유효 토큰 → ownerId 주입까지 실 DB로 확인', async () => {
    const jwks = await startLocalJwksServer()
    try {
      await withEnv(
        { CLERK_ISSUER: jwks.issuer, MCP_OAUTH_SUBJECT: TEST_SUBJECT, MCP_OAUTH_OWNER_ID: OWNER },
        async () => {
          const validToken = await jwks.sign({ sub: TEST_SUBJECT })
          const res = await rpc(validToken, 'tools/list')
          expect(res.status).toBe(200)

          // ownerId가 legacy PAT(OWNER)와 동일하게 주입됐는지 — 같은 프로젝트가 보이면 확인된 것.
          const projRes = await rpc(validToken, 'tools/call', {
            name: 'project_list',
            arguments: {},
          })
          expect(projRes.status).toBe(200)
        },
      )

      // 만료된 토큰은 거부돼야 한다 — 같은 서명키로, exp만 과거로.
      await withEnv(
        { CLERK_ISSUER: jwks.issuer, MCP_OAUTH_SUBJECT: TEST_SUBJECT, MCP_OAUTH_OWNER_ID: OWNER },
        async () => {
          const expiredToken = await new SignJWT({ sub: TEST_SUBJECT })
            .setProtectedHeader({ alg: 'RS256', kid: 'hns-l1-test-key' })
            .setIssuer(jwks.issuer)
            .setIssuedAt(Math.floor(Date.now() / 1000) - 7200)
            .setExpirationTime(Math.floor(Date.now() / 1000) - 3600)
            .sign(jwks.privateKey)
          const res = await rpc(expiredToken, 'tools/list')
          expect(res.status).toBe(401)
        },
      )
    } finally {
      await jwks.close()
    }
  })

  it('a10 Clerk 형 JWT를 쿼리로 전달 → 거부 (D-101: OAuth는 헤더 전용)', async () => {
    const jwks = await startLocalJwksServer()
    try {
      await withEnv(
        { CLERK_ISSUER: jwks.issuer, MCP_OAUTH_SUBJECT: TEST_SUBJECT, MCP_OAUTH_OWNER_ID: OWNER },
        async () => {
          const validToken = await jwks.sign({ sub: TEST_SUBJECT })
          // mcpAuth는 쿼리를 안 보므로 legacy로 위임되고, legacy 쿼리 폴백은 PAT만 받는다.
          const res = await req(null, `/api/mcp?token=${validToken}`, {
            method: 'POST',
            body: JSON.stringify({ jsonrpc: '2.0', id: randomUUID(), method: 'tools/list' }),
          })
          expect(res.status).toBe(401)
        },
      )
    } finally {
      await jwks.close()
    }
  })
})
